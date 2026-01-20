import type { MetricIdV1, OverlaySegment, RawSampleV1 } from "./contracts";

export type Readability =
  | "ok"
  | "gap"
  | "stale"
  | "suspect"
  | "bad"
  | "unknown";

export type P5SupportRow = {
  sensor_id: string;
  metric: MetricIdV1;

  latest: { ts: number; value: number } | null;

  readability: Readability;
  trend_label: string;

  latest_candidate: string | null;
  window_status: string;
};

export function buildP5Support(args: {
  startTs: number;
  endTs: number;
  sensorIds: string[];
  metrics: MetricIdV1[];
  samples: RawSampleV1[];
  overlays: OverlaySegment[];
  gaps: { startTs: number; endTs: number; reason: string }[];
}): P5SupportRow[] {
  const rows: P5SupportRow[] = [];
  const { endTs } = args;

  const byKeySamples = new Map<string, RawSampleV1[]>();
  for (const s of args.samples) {
    if (!args.sensorIds.includes(s.sensor_id)) continue;
    if (!args.metrics.includes(s.metric)) continue;
    const key = `${s.sensor_id}|${s.metric}`;
    const arr = byKeySamples.get(key) ?? [];
    arr.push(s);
    byKeySamples.set(key, arr);
  }
  for (const arr of byKeySamples.values()) arr.sort((a, b) => a.ts - b.ts);

  const byKeyOverlays = new Map<string, OverlaySegment[]>();
  for (const o of args.overlays) {
    const key = `${o.sensor_id}|${o.metric}`;
    const arr = byKeyOverlays.get(key) ?? [];
    arr.push(o);
    byKeyOverlays.set(key, arr);
  }
  for (const arr of byKeyOverlays.values()) arr.sort((a, b) => a.startTs - b.startTs);

  const gapKey = (sensor_id: string, metric: MetricIdV1) => `${sensor_id}|${metric}`;
  const byKeyGaps = new Map<string, { startTs: number; endTs: number; reason: string }[]>();
  for (const g of args.gaps) {
    // gaps currently do not carry sensor/metric in API; treat as global-range honesty.
    // If later becomes keyed, this can tighten without changing UI contract.
  }
  // current gaps are rendered globally on track; for "readability" we infer from sample recency + quality.

  for (const sensor_id of args.sensorIds) {
    for (const metric of args.metrics) {
      const key = `${sensor_id}|${metric}`;
      const arr = byKeySamples.get(key) ?? [];
      const ovs = byKeyOverlays.get(key) ?? [];

      const latest = arr.length ? arr[arr.length - 1] : null;

      const readability: Readability = (() => {
        if (!latest) return "unknown";
        if (latest.quality === "bad") return "bad";
        if (latest.quality === "suspect") return "suspect";
        // stale: no sample within 2 hours (conservative, avoids pretending we know sampling interval)
        if (endTs - latest.ts > 2 * 60 * 60 * 1000) return "stale";
        return "ok";
      })();

      // trend: compare last 6h vs now (if not enough, show "—")
      const trend_label = (() => {
        if (!latest) return "—";
        const win = 6 * 60 * 60 * 1000;
        const cut = endTs - win;
        const base = arr.find((s) => s.ts >= cut && s.quality === "ok") ?? arr.find((s) => s.ts >= cut);
        if (!base) return "—";
        const dv = latest.value - base.value;
        const abs = Math.abs(dv);

        // band thresholds are intentionally coarse (Apple I): direction > exact value.
        const band = abs < eps(metric) ? "flat" : dv > 0 ? "up" : "down";
        const mag = abs < eps(metric) ? "" : abs < 3 * eps(metric) ? " (slight)" : abs < 8 * eps(metric) ? " (mid)" : " (strong)";
        return `${band}${mag}`;
      })();

      const latest_candidate = (() => {
        // only list candidate overlays (no interpretation)
        const cand = ovs
          .filter((o) => o.kind === "step_candidate" || o.kind === "drift_candidate")
          .sort((a, b) => b.endTs - a.endTs)[0];
        if (!cand) return null;
        const sev = cand.severity ? ` • ${cand.severity}` : "";
        return `${cand.kind}${sev} @ ${new Date(cand.startTs).toISOString().slice(0, 10)}`;
      })();

      const window_status = (() => {
        // purely descriptive: "in window" since last candidate shift.
        const cand = ovs
          .filter((o) => o.kind === "step_candidate" || o.kind === "drift_candidate")
          .sort((a, b) => b.endTs - a.endTs)[0];
        if (!cand) return "—";
        const ageH = (endTs - cand.endTs) / (60 * 60 * 1000);
        if (ageH < 0) return "—";
        if (ageH <= 48) return `rootzone window: ${ageH.toFixed(1)}h since candidate end`;
        const ageD = ageH / 24;
        if (ageD <= 14) return `canopy window: ${ageD.toFixed(1)}d since candidate end`;
        return `post-window: ${ageD.toFixed(1)}d since candidate end`;
      })();

      rows.push({
        sensor_id,
        metric,
        latest: latest ? { ts: latest.ts, value: latest.value } : null,
        readability,
        trend_label,
        latest_candidate,
        window_status,
      });
    }
  }

  return rows;
}

function eps(metric: MetricIdV1): number {
  // Coarse "meaningful change" thresholds.
  // These are NOT agronomy thresholds; they are display thresholds to avoid "false movement".
  switch (metric) {
    case "soil_moisture_vwc":
      return 0.5; // %VWC
    case "soil_temp_c":
    case "air_temp_c":
      return 0.3; // °C
    case "air_rh_pct":
      return 1.0; // %RH
    case "rain_mm":
      return 0.2; // mm
    case "soil_ec_ds_m":
      return 0.02; // dS/m (small but measurable)
    default:
      return 0.1;
  }
}
