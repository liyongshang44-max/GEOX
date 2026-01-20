// GEOX/apps/web/src/lib/state_windows.ts
// State Windows = Apple I "状态表达层"（非数值观察层）
// 规则：
// - 单一时间点唯一状态
// - 连续区间覆盖整个 range
// - 基于 overlays + weather(samples) 的确定性切片（不做“建议/解释/操作推断”）
//
// Label 文案必须为冻结文案（Apple I 语气）

export type StateLabel =
  | "根区状态仍处于低响应区"
  | "地下状态已发生明显偏移"
  | "地下状态已发生明显偏移，冠层尚未出现回应"
  | "当前变化仍在自然波动区间内"
  | "检测到局部异常，未计入趋势";

export type StateWindow = {
  startTs: number;
  endTs: number;
  label: StateLabel;

  // 用于 Debug 面板（GroupTimelinePage 里在读 evidence）
  evidence?: Record<string, any>;

  // 轻量 meta（不输出解释性语言）
  meta?: {
    groupId?: string;
    metric?: string | null;
    source?: string;
    reason?: string;
  };
};

// -------------------------
// Types (aligned with backend contracts allowlist)
// -------------------------

type Overlay = {
  startTs: number;
  endTs: number;
  sensorId?: string;
  metric?: string | null;
  kind: "device_fault" | "local_anomaly" | "step_candidate" | "drift_candidate";
  confidence?: "low" | "med" | "high" | null;
  source: "device" | "gateway" | "system";
  note?: string | null;
};

type Sample = {
  ts: number;
  sensorId: string;
  metric: string;
  value: number;
  quality?: string;
  source?: string;
};

// -------------------------
// Public API expected by GroupTimelinePage.tsx
// -------------------------

export type StateWindowConfig = {
  anomalyPadMs?: number;          // 预留：异常事件扩展窗口
  canopyAfterShiftMs?: number;    // 预留：地下偏移后等待冠层回应的时间
  rainMetric?: string;            // 默认 rain_mm
};

export type BuildStateWindowsArgs = {
  groupId?: string;
  startTs: number;
  endTs: number;
  samples: Sample[];
  overlays: Overlay[];
  canopyFrames?: any[]; // 先接住，当前版本不强行并入 state
  config?: StateWindowConfig;
};

/**
 * ✅ 兼容前端页面的签名：buildStateWindows(...)
 * 内部调用 computeStateWindows。config/canopyFrames 先接住不报错。
 */
export function buildStateWindows(args: BuildStateWindowsArgs): StateWindow[] {
  const rainMetric = args.config?.rainMetric ?? "rain_mm";

  // 目前 computeStateWindows 只基于 overlays + samples（天气仅用 rain）
  // 这里做一个轻量“metric 透传”适配：如果 rainMetric 被改名，就把 samples 映射成 rain_mm 逻辑所需
  const samples = (args.samples ?? []).map((s) => {
    if (s.metric === rainMetric) return s;
    // 不动其它 metric；只需要让 hasRainInRange 能正确识别“雨”
    return s;
  });

  // 直接复用核心确定性逻辑
  const windows = computeStateWindows({
    groupId: args.groupId,
    startTs: args.startTs,
    endTs: args.endTs,
    overlays: args.overlays ?? [],
    samples,
    rainMetric,
    config: args.config,
  });

  return windows;
}

// -------------------------
// Core deterministic implementation
// -------------------------

export type ComputeStateWindowsArgs = {
  groupId?: string;
  startTs: number;
  endTs: number;
  overlays: Overlay[];
  samples: Sample[];

  // ✅ 新增：让外层可以传 rainMetric/config 而不破坏调用方
  rainMetric?: string;
  config?: StateWindowConfig;
};

const MIN_WINDOW_MS = 60_000; // 最小可见窗口：1 分钟（避免点事件不可见）

function clampRange(a: number, b: number, start: number, end: number) {
  const s = Math.max(start, Math.min(end, a));
  const e = Math.max(start, Math.min(end, b));
  return [s, e] as const;
}

function hasOverlayInRange(overlays: Overlay[], kinds: Overlay["kind"][], s: number, e: number) {
  return overlays.some((o) => kinds.includes(o.kind) && Math.max(o.startTs, s) <= Math.min(o.endTs, e));
}

function hasRainInRange(samples: Sample[], s: number, e: number, rainMetric: string) {
  // 只用 rain 作为“裁判”信号：>0 视为自然扰动存在
  return samples.some((x) => x.metric === rainMetric && x.ts >= s && x.ts <= e && Number(x.value) > 0);
}

export function computeStateWindows(args: ComputeStateWindowsArgs): StateWindow[] {
  const start = args.startTs;
  const end = args.endTs;
  const rainMetric = args.rainMetric ?? "rain_mm";

  const overlays = (args.overlays ?? []).slice().sort((a, b) => a.startTs - b.startTs);
  const samples = (args.samples ?? []).slice().sort((a, b) => a.ts - b.ts);

  // 1) 构造切片点：rangeStart/rangeEnd + 所有 overlay 的时间点
  const cuts = new Set<number>();
  cuts.add(start);
  cuts.add(end);

  for (const o of overlays) {
    const ts0 = o.startTs;
    const ts1 = o.endTs;

    // overlay 点事件扩成一个最小窗口让它可见
    if (ts0 === ts1) {
      const [s0, e0] = clampRange(ts0, ts0 + MIN_WINDOW_MS, start, end);
      cuts.add(s0);
      cuts.add(e0);
    } else {
      const [s0, e0] = clampRange(ts0, ts1, start, end);
      cuts.add(s0);
      cuts.add(e0);
    }
  }

  // 2) 额外：用雨量采样切片（只用 rainMetric 的时间点，避免切太碎）
  for (const x of samples) {
    if (x.metric !== rainMetric) continue;
    if (x.ts < start || x.ts > end) continue;
    cuts.add(x.ts);
    cuts.add(Math.min(end, x.ts + MIN_WINDOW_MS));
  }

  const sortedCuts = Array.from(cuts).sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v !== arr[i - 1]);

  // 3) 对每个区间赋值（优先级从高到低）
  const windows: StateWindow[] = [];
  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const s = sortedCuts[i];
    const e = sortedCuts[i + 1];
    if (e <= s) continue;

    let label: StateLabel = "根区状态仍处于低响应区";
    let reason = "default";

    if (hasOverlayInRange(overlays, ["device_fault", "local_anomaly"], s, e)) {
      label = "检测到局部异常，未计入趋势";
      reason = "anomaly";
    } else if (hasOverlayInRange(overlays, ["step_candidate", "drift_candidate"], s, e)) {
      // 暂时不判断 canopy “回应”，先输出地下偏移
      label = "地下状态已发生明显偏移";
      reason = "shift";
    } else if (hasRainInRange(samples, s, e, rainMetric)) {
      label = "当前变化仍在自然波动区间内";
      reason = "weather";
    }

    windows.push({
      startTs: s,
      endTs: e,
      label,
      evidence: { reason, rainMetric }, // Debug 面板可见，但不用于主 UI 语言
      meta: {
        groupId: args.groupId,
        metric: null,
        source: "system",
        reason,
      },
    });
  }

  // 4) 合并相邻同 label 的窗口（减少碎片）
  const merged: StateWindow[] = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && last.label === w.label && last.endTs === w.startTs) {
      last.endTs = w.endTs;
      continue;
    }
    merged.push({ ...w });
  }

  // 5) 保底：必须覆盖全 range
  if (merged.length === 0) {
    return [
      {
        startTs: start,
        endTs: end,
        label: "根区状态仍处于低响应区",
        evidence: { reason: "empty", rainMetric },
        meta: { groupId: args.groupId, metric: null, source: "system", reason: "empty" },
      },
    ];
  }

  return merged;
}
