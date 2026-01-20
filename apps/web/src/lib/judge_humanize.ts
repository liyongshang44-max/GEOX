// GEOX/apps/web/src/lib/judge_humanize.ts
// 目标：
// - 不暴露内部枚举细节（ref_id/hash 等）
// - 不推理
// - 只做人类可读映射
// - 所有 Judge UI 只依赖这里

type ProblemState = any;
type AoSense = any;

export function safeList<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function fmtIso(ts: unknown): string {
  const n =
    typeof ts === "number"
      ? ts
      : typeof ts === "string"
        ? Date.parse(ts)
        : NaN;

  if (!Number.isFinite(n)) return String(ts ?? "");
  return new Date(n).toISOString().replace(".000Z", "Z");
}

export function fmtWindow(w: any): string {
  if (!w) return "—";
  const s = w.startTs ?? w.start_ts ?? w.start ?? null;
  const e = w.endTs ?? w.end_ts ?? w.end ?? null;
  if (s == null || e == null) return "—";
  return `${fmtIso(s)} → ${fmtIso(e)}`;
}

// -----------------------------
// Human labels
// -----------------------------

/**
 * Problem type → 卡片标题（一句话声明）
 * 注意：不输出“正常/健康/建议”
 */
export function labelForProblemType(t: unknown): string {
  switch (String(t ?? "")) {
    case "INSUFFICIENT_EVIDENCE":
      return "当前时间窗内，证据不足，系统无法可靠理解。";
    case "TIME_COVERAGE_GAPPY":
      return "当前时间窗内，时间覆盖不完整，判读不可靠。";
    case "WINDOW_NOT_SUPPORT":
      return "当前时间窗内，该窗口形态不支持判读。";
    case "QC_CONTAMINATION":
      return "当前时间窗内，质量状态污染，证据可靠性不足。";
    case "SENSOR_HEALTH_DEGRADED":
      return "当前时间窗内，设备健康退化，读数可靠性不足。";
    case "EVIDENCE_CONFLICT":
      return "当前时间窗内，不同证据之间存在无法解释的冲突。";
    case "REFERENCE_CONFLICT":
      return "当前时间窗内，与参照证据存在无法解释的冲突。";
    case "SENSOR_SUSPECT":
      return "当前时间窗内，传感器偏离形态目前不可解释。";
    case "SCALE_POLICY_BLOCKED":
      return "当前窗口内，判读被尺度策略阻断。";
    case "EXCLUSION_WINDOW_ACTIVE":
      return "当前时间窗内，处于排除窗，判读被降级或阻断。";
    case "MARKER_PRESENT":
      return "当前时间窗内，存在事实标注，判读被降级或阻断。";
    default:
      return "当前时间窗内，系统存在无法可靠理解的情况。";
  }
}

/** 不确定性来源（为什么看不懂）——只做映射，不补推断 */
export function labelForUncertainty(u: unknown): string {
  switch (String(u ?? "")) {
    case "TIME_GAPS":
      return "时间覆盖存在空洞";
    case "LOW_SAMPLE_COUNT":
      return "数据采样不足";
    case "MISSING_METRICS":
      return "关键指标缺失";
    case "QC_CONTAMINATION":
      return "质量状态污染";
    case "REFERENCE_UNAVAILABLE":
      return "参照数据不可用";
    case "SCALE_POLICY_BLOCKED":
      return "跨尺度理解被策略阻断";
    default: {
      const s = String(u ?? "").trim();
      return s || "未命名的不确定性来源";
    }
  }
}

/** Evidence kind → 给用户看的“证据类型”（不显示 ref_id/hash/ledger_slice token） */
export function labelForEvidenceKind(kind: unknown): string {
  switch (String(kind ?? "")) {
    case "ledger_slice":
      return "本窗口内传感器数据";
    case "qc_summary":
      return "质量检查汇总";
    case "series_query":
      return "历史/参照序列";
    case "marker":
    case "markers":
      return "事实标注";
    default:
      return String(kind ?? "").trim() || "";
  }
}

/** Sense focus → 给用户看的“希望多看什么”（描述系统缺什么，不是行动指令） */
export function labelForSenseFocus(focus: unknown): string {
  switch (String(focus ?? "")) {
    case "WINDOW_COVERAGE":
      return "缺少该时间窗的观测覆盖";
    case "QC_STATUS":
      return "缺少质量/校验信息";
    case "REFERENCE":
      return "缺少可用的参照观测";
    case "SENSOR_HEALTH":
      return "缺少设备健康相关观测";
    case "UNKNOWN":
      return "仍缺少一些能减少不确定性的信息";
    default: {
      const s = String(focus ?? "").trim();
      return s || "仍缺少一些能减少不确定性的信息";
    }
  }
}

/** 给卡片的一句“引导语”（不是结论）；优先用后端 summary */
export function summarizeProblem(ps: ProblemState): string {
  const s = typeof ps?.summary === "string" ? ps.summary.trim() : "";
  if (s) return s;
  return "系统仅声明当前不可被可靠理解的部分，不输出“正常/健康/建议”。";
}

/**
 * 从一组 ao_sense 里挑出“属于这个 problem_state”的那些
 * 不推理：只按 supporting_problem_state_id 关联；关联不到就返回 []
 */
export function pickAoSenseForProblem(all: AoSense[], problemStateId?: string | null): AoSense[] {
  if (!problemStateId) return [];
  return safeList(all).filter((s: any) => {
    const sid = s?.supporting_problem_state_id ?? s?.supportingProblemStateId ?? null;
    return sid && String(sid) === String(problemStateId);
  });
}

/**
 * 清洗 AO-SENSE note：去掉设备/开发口吻的半自动文本，只保留短信息
 */
export function sanitizeAoNote(note: unknown): string {
  if (typeof note !== "string") return "";
  let s = note.trim();
  if (!s) return "";

  // 去掉常见的“supporting evidence ...; request additional observation”这类组合
  s = s.replace(/supporting\s+evidence[^;]*;\s*request\s+additional\s+observation/gi, "").trim();
  s = s.replace(/request\s+additional\s+observation/gi, "").trim();

  // 去掉多余分隔符
  s = s.replace(/^[;:，,\-\s]+/g, "").replace(/[;:，,\-\s]+$/g, "").trim();
  return s;
}

// -----------------------------
// Tooltip rule text
// -----------------------------

export function ruleForSection(kind: "why" | "based_on" | "ao_sense"): string {
  switch (kind) {
    case "why":
      return "这些是系统无法可靠理解的来源分类（不是结论，不代表好坏）。";
    case "based_on":
      return "这里只展示证据类别（不展示 ref_id/hash 等内部引用）。";
    case "ao_sense":
      return "这不是行动建议；它描述系统还缺哪些信息来减少不确定性。";
    default:
      return "";
  }
}

export function ruleForProblemType(t: unknown): string {
  switch (String(t ?? "")) {
    case "INSUFFICIENT_EVIDENCE":
      return "触发：关键指标在窗口内样本不足/缺失，无法支撑理解。";
    case "TIME_COVERAGE_GAPPY":
      return "触发：窗口内存在显著时间空洞、边界效应或尾部覆盖不足。";
    case "WINDOW_NOT_SUPPORT":
      return "触发：窗口形态/长度不满足判读约束（如过短或尾部不足）。";
    case "QC_CONTAMINATION":
      return "触发：窗口内大量 QC 标注，证据可靠性被降级。";
    case "SENSOR_HEALTH_DEGRADED":
      return "触发：设备健康相关信号表明读数可信度下降。";
    case "EVIDENCE_CONFLICT":
      return "触发：多来源证据出现稳定、可复现且无法用 QC 解释的冲突。";
    case "REFERENCE_CONFLICT":
      return "触发：与参照/对照证据出现稳定冲突，当前无法解释。";
    case "SENSOR_SUSPECT":
      return "触发：某传感器偏离形态无法被系统解释（不等于‘坏了’）。";
    case "SCALE_POLICY_BLOCKED":
      return "触发：理解需要跨尺度，但被策略明确禁止。";
    case "EXCLUSION_WINDOW_ACTIVE":
      return "触发：窗口处于维护/校准等排除期，判读被阻断或降级。";
    case "MARKER_PRESENT":
      return "触发：窗口内存在事实标注（维护/干预等），判读被降级或阻断。";
    default:
      return "触发：系统在该窗口内存在无法可靠理解的情况（未细分）。";
  }
}

export function ruleForUncertainty(u: unknown): string {
  switch (String(u ?? "")) {
    case "TIME_GAPS":
      return "判定：采样时间间隔或缺口超过可读阈值，覆盖不足。";
    case "LOW_SAMPLE_COUNT":
      return "判定：样本数量低于最小要求，难以支持理解。";
    case "MISSING_METRICS":
      return "判定：关键指标集合未满足（缺少必需指标）。";
    case "QC_CONTAMINATION":
      return "判定：QC 标注覆盖高或集中，证据可靠性下降。";
    case "REFERENCE_UNAVAILABLE":
      return "判定：需要的参照/对照数据不可用。";
    case "SCALE_POLICY_BLOCKED":
      return "判定：需要跨尺度解释，但策略禁止。";
    default:
      return "判定规则：由后端规则集给出该不确定性来源。";
  }
}

export function ruleForEvidenceKind(kind: unknown): string {
  switch (String(kind ?? "")) {
    case "ledger_slice":
      return "来自：窗口内时序观测数据（曲线）。";
    case "qc_summary":
      return "来自：质量控制标注的汇总信息。";
    case "series_query":
      return "来自：历史/参照视图（对照序列）。";
    case "marker":
    case "markers":
      return "来自：事实标注（维护/校准/干预等）。";
    default:
      return "来自：后端提供的证据类别。";
  }
}
