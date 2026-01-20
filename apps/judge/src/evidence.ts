// apps/judge/src/evidence.ts
//
// C-2 / C-3 semantics:
//
// C-2: MAINTENANCE/CALIBRATION/... markers are "time-axis exclusions".
//      Coverage is computed on the effective timeline with those minutes removed.
//
// C-3: missing-origin raw samples are NOT evidence:
//      - they do NOT count toward coverage
//      - they do NOT participate in QC
//      - they represent "no evidence", not "bad evidence"
//
// Implementation detail:
// - We treat a raw_sample as "missing-origin" if:
//   (a) payload.quality === 'bad' AND
//   (b) there is a marker_v1(kind='MISSING_VALUE') for the same (metric, minute_ts)
//   This matches your simulator behavior (writes marker + carried-forward raw with quality=bad).

import type { ReplayRow } from "./applei_reader";

export type RawSample = {
  fact_id: string;
  ts: number; // ms
  sensorId: string;
  metric: string;
  value: number;
  quality: "unknown" | "ok" | "suspect" | "bad";
};

export type Marker = {
  fact_id: string;
  ts: number; // ms (minute-aligned)
  kind: string;
  sensorId: string;
  metric: string | null;

  // optional range
  startTsMs?: number | null;
  endTsMs?: number | null;

  source?: string | null;
  note?: string | null;
};

function safeNum(x: any): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const s = x.trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function safeInt(x: any): number {
  const n = safeNum(x);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function tsFromOccurredAt(r: ReplayRow): number {
  const d: any = (r as any).occurred_at;
  const t = d instanceof Date ? d.getTime() : Date.parse(String(d ?? ""));
  return Number.isFinite(t) ? t : NaN;
}

function baseMetric(metric: string): string {
  if (!metric) return metric;
  if (metric === "soil_moisture_vwc" || metric.startsWith("soil_moisture_vwc_")) return "soil_moisture_vwc";
  if (metric === "soil_temp_c" || metric.startsWith("soil_temp_c_")) return "soil_temp_c";
  return metric;
}

function metricVariants(metric: string): string[] {
  const b = baseMetric(metric);
  return b && b !== metric ? [metric, b] : [metric];
}

function minuteAlign(tsMs: number): number {
  return Math.floor(tsMs / 60_000) * 60_000;
}

export function splitEvidence(rows: ReplayRow[]): {
  samples: RawSample[];
  markers: Marker[];
  factIds: string[];
} {
  const samples: RawSample[] = [];
  const markers: Marker[] = [];
  const factIds: string[] = [];

  // marker lookup for C-3 (missing-origin)
  const missingAtMinute = new Set<string>(); // `${sensorId}|${metricVariant}|${minuteTs}`

  // 1) markers first
  for (const r of rows) {
    factIds.push(r.fact_id);
    if (r.type !== "marker_v1") continue;

    const payload = r.record_json?.payload ?? {};

    // Prefer ts_ms, then ts, finally occurred_at
    const tsMs =
      safeInt(payload?.ts_ms) ||
      safeInt(payload?.tsMs) ||
      safeInt(payload?.ts) ||
      tsFromOccurredAt(r);

    const kind = typeof payload?.kind === "string" ? payload.kind : "";

    const sensorId =
      typeof payload?.sensorId === "string"
        ? payload.sensorId
        : typeof r.sensor_id === "string"
          ? r.sensor_id
          : "";

    const metric = typeof payload?.metric === "string" ? payload.metric : null;

    if (!kind || !sensorId || !Number.isFinite(tsMs)) continue;

    const startTsMs = Number.isFinite(safeInt(payload?.start_ts_ms)) ? safeInt(payload?.start_ts_ms) : null;
    const endTsMs = Number.isFinite(safeInt(payload?.end_ts_ms)) ? safeInt(payload?.end_ts_ms) : null;

    const m: Marker = {
      fact_id: r.fact_id,
      ts: minuteAlign(tsMs),
      kind,
      sensorId,
      metric,
      startTsMs,
      endTsMs,
      source: typeof payload?.source === "string" ? payload.source : null,
      note: typeof payload?.note === "string" ? payload.note : null,
    };

    markers.push(m);

    if (kind === "MISSING_VALUE" && metric) {
      for (const mv of metricVariants(metric)) {
        missingAtMinute.add(`${sensorId}|${mv}|${m.ts}`);
      }
    }
  }

  // 2) raw samples, excluding missing-origin (C-3)
  for (const r of rows) {
    if (r.type !== "raw_sample_v1") continue;

    const payload = r.record_json?.payload ?? {};

    const ts =
      safeInt(payload?.ts_ms) ||
      safeInt(payload?.tsMs) ||
      safeInt(payload?.ts) ||
      tsFromOccurredAt(r);

    const sensorId =
      typeof payload?.sensorId === "string"
        ? payload.sensorId
        : typeof r.sensor_id === "string"
          ? r.sensor_id
          : "";

    const metric = typeof payload?.metric === "string" ? payload.metric : "";
    const value = safeNum(payload?.value);

    const qualityRaw = payload?.quality ?? "unknown";
    const quality =
      qualityRaw === "ok" || qualityRaw === "suspect" || qualityRaw === "bad" || qualityRaw === "unknown"
        ? (qualityRaw as RawSample["quality"])
        : ("unknown" as RawSample["quality"]);

    if (!Number.isFinite(ts) || !Number.isFinite(value) || !sensorId || !metric) continue;

    const minuteTs = minuteAlign(ts);

    const isMissingOrigin =
      quality === "bad" &&
      metricVariants(metric).some((mv) => missingAtMinute.has(`${sensorId}|${mv}|${minuteTs}`));

    if (isMissingOrigin) continue;

    samples.push({ fact_id: r.fact_id, ts, sensorId, metric, value, quality });
  }

  return {
    samples,
    markers,
    factIds: Array.from(new Set(factIds)).sort(),
  };
}