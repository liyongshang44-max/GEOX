import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getSeries, postMarker, postJudgeRun, type JudgeRunRequest, type PostMarkerBody } from "../lib/api";
import type { OverlaySegment, RawSampleV1, SeriesGapV1, SeriesResponseV1 } from "../lib/contracts";
import UPlotSeries from "../components/UPlotSeries";
import OverlaysTrack from "../components/OverlaysTrack";
import { Legend } from "../components/Legend";
import JudgeProblemCard from "../components/JudgeProblemCard";

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

const DEFAULT_RANGE_HOURS = 24;

// v1 冻结：默认展示 30/60/90（三个深度），用户可展开更多深度（以后再补）
const DEFAULT_METRICS: string[] = [
  "soil_moisture_vwc_30cm",
  "soil_moisture_vwc_60cm",
  "soil_moisture_vwc_90cm",
  "soil_temp_c_30cm",
  "soil_temp_c_60cm",
  "soil_temp_c_90cm",
];

// 兼容没有深度后缀的旧数据（用于你当前 DB 里 CAF007 的 2 个 metric）
const FALLBACK_METRICS: string[] = ["soil_moisture_vwc", "soil_temp_c"];

function nowMs(): number {
  return Date.now();
}

function fmtIso(ts: number): string {
  try {
    return new Date(ts).toISOString().replace(".000Z", "Z");
  } catch {
    return String(ts);
  }
}

function dedupOverlays(xs: OverlaySegment[]): OverlaySegment[] {
  const key = (o: OverlaySegment) =>
    `${o.kind}|${o.sensorId}|${o.metric ?? ""}|${o.startTs}|${o.endTs}|${o.note ?? ""}|${o.source}`;
  const seen = new Set<string>();
  const out: OverlaySegment[] = [];
  for (const o of xs) {
    const k = key(o);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  out.sort((a, b) => a.startTs - b.startTs);
  return out;
}

export default function GroupTimelinePage(): React.ReactElement {
  const { groupId: groupIdParam } = useParams();
  const groupId = groupIdParam ?? "G_DEFAULT";

  const [sp, setSp] = useSearchParams();

  // Live mode (default): keep the time window sliding with current time so the UI
  // refreshes while simulator is streaming.
  const live = (sp.get("live") ?? "1") !== "0";
  const rangeHours = useMemo(() => {
    const v = sp.get("rangeH");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_RANGE_HOURS;
  }, [sp]);

  // 时间：系统默认给（不是第一步让用户填）
  const endTs = useMemo(() => {
    const q = sp.get("endTs");
    return q ? Number(q) : nowMs();
  }, [sp]);

  const startTs = useMemo(() => {
    const q = sp.get("startTs");
    const fallback = endTs - rangeHours * 60 * 60 * 1000;
    return q ? Number(q) : fallback;
  }, [sp, endTs, rangeHours]);

  const [metrics, setMetrics] = useState<string[]>(DEFAULT_METRICS);

  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const [samples, setSamples] = useState<RawSampleV1[]>([]);
  const [overlays, setOverlays] = useState<OverlaySegment[]>([]);
  const [gaps, setGaps] = useState<SeriesGapV1[]>([]);
  const [hoverTs, setHoverTs] = useState<number | null>(null);

  const [markerOpen, setMarkerOpen] = useState(false);

  // Apple II（Judge）——默认隐藏，用户点“我看不懂这里”才出现
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [judgeBusy, setJudgeBusy] = useState(false);
  const [judgeErr, setJudgeErr] = useState<string | null>(null);
  const [judgeResp, setJudgeResp] = useState<any>(null);

  useEffect(() => {
    const next = new URLSearchParams(sp);
    next.set("startTs", String(startTs));
    next.set("endTs", String(endTs));
    const nextStr = next.toString();
    if (nextStr !== sp.toString()) setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTs, endTs]);

  async function refresh(): Promise<void> {
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      setFetchState({ kind: "error", message: "invalid time range" });
      return;
    }

    setFetchState({ kind: "loading" });
    try {
      // 先尝试深度 metric；如果 0 样本，再 fallback（兼容旧库）
      const tryFetch = async (ms: string[]): Promise<SeriesResponseV1> => {
        return (await getSeries({
          groupId,
          metrics: ms as any,
          startTs,
          endTs,
          maxPoints: 6000,
        } as any)) as any;
      };

      let r = await tryFetch(metrics);
      const got = Array.isArray((r as any)?.samples) ? (r as any).samples.length : 0;
      if (got === 0) {
        r = await tryFetch(FALLBACK_METRICS);
        // 同步 UI 的 legend，让用户知道当前看的是什么
        setMetrics(FALLBACK_METRICS);
      }

      const mergedSamples: RawSampleV1[] = [...((r as any).samples ?? [])];
      const ovs = dedupOverlays([...(r as any).overlays ?? []]);
      const gs = [...((r as any).gaps ?? [])];

      mergedSamples.sort((a, b) => a.ts - b.ts);

      setSamples(mergedSamples);
      setOverlays(ovs);
      setGaps(gs);
      setFetchState({ kind: "ok" });
    } catch (e: any) {
      setFetchState({ kind: "error", message: String(e?.bodyText ?? e?.message ?? e) });
    }
  }

  // Live auto-refresh: bump endTs to "now" (minute-aligned) on an interval.
  // This updates the URL params, which in turn triggers the existing refresh() effect.
  useEffect(() => {
    if (!live) return;

    const id = setInterval(() => {
      const end = Math.floor(Date.now() / 60000) * 60000;
      const start = end - rangeHours * 3600 * 1000;
      const next = new URLSearchParams(sp);
      next.set("live", "1");
      next.set("rangeH", String(rangeHours));
      next.set("startTs", String(start));
      next.set("endTs", String(end));
      // Replace to avoid polluting browser history.
      setSp(next, { replace: true });
    }, 2000);

    return () => clearInterval(id);
  }, [live, rangeHours, sp, setSp]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, startTs, endTs]);

  async function runJudge(): Promise<void> {
    setJudgeBusy(true);
    setJudgeErr(null);
    try {
      const body: JudgeRunRequest = {
        subjectRef: { projectId: "P_DEFAULT", groupId },
        scale: "group",
        window: { startTs, endTs },
        options: { persist: true, include_reference_views: true, include_lb_candidates: false, config_profile: "default" },
      };
      const out = await postJudgeRun(body);
      setJudgeResp(out);
    } catch (e: any) {
      setJudgeErr(String(e?.bodyText ?? e?.message ?? e));
      setJudgeResp(null);
    } finally {
      setJudgeBusy(false);
    }
  }

  function setRangeHours(h: number) {
    const e = nowMs();
    const s = e - h * 60 * 60 * 1000;
    setSp({ ...Object.fromEntries(sp.entries()), startTs: String(s), endTs: String(e), live: "1", rangeH: String(h) });
  }

  const rangeLabel = `${fmtIso(startTs)} → ${fmtIso(endTs)}`;
  const qcHint = "QC 标注是“事实标注”，表示这段数据曾被质控流程标记；它不是建议，也不是结论。";

  const ps: any = judgeResp?.problem_states?.[0] ?? null;
  const ao: any[] = Array.isArray(judgeResp?.ao_sense) ? judgeResp.ao_sense : [];

  return (
    <div className="page">
      <header className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Apple I · {groupId}</h1>
          <div className="subtle">
            <span title="系统默认给定的时间窗（可调整，但不是第一步让你手写参数）">range</span>: <b>{rangeLabel}</b>
          </div>
        </div>

        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <Link className="btn ghost" to="/">
            ← 返回选地
          </Link>

          <div className="pill" title="系统默认时间范围。你可以切换，但不需要手动输入时间戳。">
            时间范围
            <select className="select" value="" onChange={(e) => setRangeHours(Number(e.target.value))}>
              <option value="">选择…</option>
              <option value="24">最近 1 天</option>
              <option value="168">最近 7 天</option>
              <option value="720">最近 30 天</option>
            </select>
          </div>

          <button className="btn" onClick={() => refresh()} disabled={fetchState.kind === "loading"}>
            {fetchState.kind === "loading" ? "加载中…" : "刷新"}
          </button>

          <button className="btn" onClick={() => setMarkerOpen(true)} disabled={fetchState.kind !== "ok"}>
            添加标注
          </button>

          <button
            className={"btn" + (judgeOpen ? " primary" : "")}
            title="我看不懂这里：允许系统诚实说明当前不可被可靠理解的部分。"
            onClick={async () => {
              const next = !judgeOpen;
              setJudgeOpen(next);
              if (next) await runJudge();
            }}
          >
            我看不懂这里
          </button>
        </div>
      </header>

      {fetchState.kind === "error" ? (
        <div className="card" style={{ padding: 12, borderColor: "rgba(200,0,0,0.3)" }}>
          <b>无法加载</b>：{fetchState.message}
        </div>
      ) : null}

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: "0 0 6px 0" }}>事实曲线</h2>
            <div className="subtle" title={qcHint}>
              曲线仅展示观测事实；QC / range / spike 会以“事实标注”叠加（hover 可查看说明）。
            </div>
          </div>

          <details>
            <summary className="judgeSummary">切换深度</summary>
            <div className="card" style={{ padding: 12, marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 8 }}>
                v1 默认展示 30/60/90cm。深度是 metric 的一部分（不是新的“地”）。
              </div>
              <div className="row" style={{ gap: 8 }}>
                {DEFAULT_METRICS.map((m) => {
                  const on = metrics.includes(m);
                  return (
                    <button
                      key={m}
                      className={on ? "pill pill-on" : "pill"}
                      onClick={() => setMetrics((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        </div>

        <div style={{ marginTop: 12 }}>
          <Legend metrics={metrics as any} sensors={[]} />
          <UPlotSeries
            samples={samples as any}
            overlays={overlays as any}
            metrics={metrics as any}
            sensors={[]}
            range={{ startTs, endTs }}
            onHover={(h) => setHoverTs(h ? h.ts : null)}
          />
          {hoverTs ? <div className="subtle">hover: {fmtIso(hoverTs)}</div> : null}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ margin: "0 0 6px 0" }} title={qcHint}>
          QC / 标注轨道
        </h2>
        <OverlaysTrack
          overlays={overlays}
          range={{ startTs, endTs }}
          enabledKinds={{ device_fault: true, local_anomaly: true, step_candidate: true, drift_candidate: true }}
          cursorTs={hoverTs}
        />
        <div className="subtle" title={qcHint}>
          这些是事实标注（QC / marker），不是建议，也不是结论。
        </div>
      </section>

      {judgeOpen ? (
        <section className="panel">
          <h2 style={{ margin: "0 0 6px 0" }}>Apple II · 认知边界</h2>
          {judgeErr ? (
            <div className="card" style={{ padding: 12, borderColor: "rgba(200,0,0,0.3)" }}>
              <b>Judge 运行失败</b>：{judgeErr}
            </div>
          ) : null}

          {judgeBusy ? <div className="muted">运行中…</div> : null}

          {!judgeBusy && !ps ? (
            <div className="muted">当前时间窗内，没有可声明的问题态。（沉默 ≠ 正常；仅表示没有可声明的不确定性。）</div>
          ) : null}

          {ps ? <JudgeProblemCard problemState={ps} aoSense={ao} showAudit={false} /> : null}

          <div className="muted" style={{ marginTop: 8 }}>
            这里不是告诉你该做什么的地方；这里只是系统诚实承认自己的认知边界。
          </div>
        </section>
      ) : null}

      {markerOpen ? (
        <AddMarkerModal
          defaultTs={hoverTs ?? startTs}
          defaultSensorId={"(by_group)"}
          onClose={() => setMarkerOpen(false)}
          onCreate={async (m) => {
            await postMarker(m);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AddMarkerModal(props: {
  defaultTs: number;
  defaultSensorId: string;
  onClose: () => void;
  onCreate: (body: PostMarkerBody) => Promise<void>;
}): React.ReactElement {
  const [sensorId, setSensorId] = useState(props.defaultSensorId);
  const [ts, setTs] = useState(String(props.defaultTs));
  const [type, setType] = useState<PostMarkerBody["type"]>("local_anomaly");
  const [source, setSource] = useState<PostMarkerBody["source"]>("device");
  const [note, setNote] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const tsNum = Number(ts);
      if (!Number.isFinite(tsNum) || tsNum <= 0) throw new Error("invalid ts (ms)");

      // v1：marker 仍然写到 sensorId 维度（后端 schema 约束）。
      // 这里允许用户填具体 sensor_id；默认填一个占位。
      await props.onCreate({
        ts: tsNum,
        sensorId: sensorId.trim(),
        type,
        source,
        note: note.trim() ? note.trim() : null,
      });

      props.onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>添加标注</h3>
        <div className="subtle">写入 marker_v1 事实标注（不是建议，不是结论）。</div>

        <div className="form">
          <label>
            sensorId（暂存于 sensor 维度；后续可升级为 group 维度）
            <input value={sensorId} onChange={(e) => setSensorId(e.target.value)} />
          </label>

          <label>
            ts（毫秒）
            <input value={ts} onChange={(e) => setTs(e.target.value)} />
          </label>

          <label>
            type
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="device_fault">device_fault</option>
              <option value="local_anomaly">local_anomaly</option>
            </select>
          </label>

          <label>
            source
            <select value={source} onChange={(e) => setSource(e.target.value as any)}>
              <option value="device">device</option>
              <option value="gateway">gateway</option>
              <option value="system">system</option>
            </select>
          </label>

          <label>
            note（可选）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
        </div>

        {err ? <div className="error">Error: {err}</div> : null}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button onClick={props.onClose} disabled={busy}>
            取消
          </button>
          <button onClick={submit} disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
