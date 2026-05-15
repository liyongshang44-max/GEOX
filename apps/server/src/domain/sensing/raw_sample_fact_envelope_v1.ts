import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type RawSampleSourceV1 = "device" | "gateway" | "system" | "human" | "import" | "sim";
export type RawSampleQualityV1 = "unknown" | "ok" | "suspect" | "bad";
export type SeriesOverlayKindV1 = "marker" | "candidate" | "annotation";
export type SeriesGapReasonV1 = "no_data" | "device_offline" | "unknown";

export const OFFICIAL_SERIES_OVERLAY_KIND_ALLOWLIST_V1 = ["marker", "candidate", "annotation"] as const;
const OFFICIAL_SERIES_OVERLAY_KIND_SET_V1 = new Set<string>(OFFICIAL_SERIES_OVERLAY_KIND_ALLOWLIST_V1);
const FORBIDDEN_OVERLAY_TERMS_V1 = ["recommendation", "prescription", "acceptance", "conclusion"] as const;
const EC_METRIC_ALIASES_REQUIRING_DS_M_V1 = new Set<string>([
  "ec",
  "soil_ec",
  "soil_ec_ds_m",
  "ec_ds_m",
  "salinity_ec_ds_m",
  "soil_salinity_ec",
]);

export class RawSampleFactEnvelopeErrorV1 extends Error {
  constructor(public code: string, public statusCode = 400) {
    super(code);
  }
}

export type RawSampleFactEnvelopeTenantV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type RawSampleWriteInputV1 = {
  sample_id?: unknown;
  sampleId?: unknown;
  sensor_id?: unknown;
  sensorId?: unknown;
  group_id?: unknown;
  groupId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  field_id?: unknown;
  fieldId?: unknown;
  ts_ms?: unknown;
  ts?: unknown;
  timestamp_ms?: unknown;
  metric?: unknown;
  value?: unknown;
  unit?: unknown;
  qc_quality?: unknown;
  quality?: unknown;
  source?: unknown;
  payload?: unknown;
  interpolated?: unknown;
  synthetic?: unknown;
  fake_sample?: unknown;
  sample_kind?: unknown;
};

export type RawSampleEnvelopeV1 = {
  sample_id: string;
  sensor_id: string;
  group_id: string | null;
  project_id: string | null;
  field_id: string | null;
  ts_ms: number;
  metric: string;
  value: number;
  unit: string | null;
  qc_quality: RawSampleQualityV1;
  source: RawSampleSourceV1;
  payload_json: Record<string, any>;
  fact_id: string;
  created_at?: string | null;
  interpolated: false;
  synthetic: false;
};

export type RawSampleReadFilterV1 = RawSampleFactEnvelopeTenantV1 & {
  sensor_id?: string | null;
  group_id?: string | null;
  field_id?: string | null;
  metrics?: string[];
  start_ts_ms: number;
  end_ts_ms: number;
  limit?: number;
};

export type SeriesGapV1 = {
  startTs: number;
  endTs: number;
  reason: SeriesGapReasonV1;
  sensorId?: string | null;
  metric?: string | null;
};

export type SeriesOverlayV1 = {
  overlay_id: string;
  startTs: number;
  endTs: number;
  sensorId: string | null;
  groupId: string | null;
  metric: string | null;
  kind: SeriesOverlayKindV1;
  note: string | null;
  source: "device" | "gateway" | "system" | "human";
};

export type SeriesResponseV1 = {
  range: {
    startTs: number;
    endTs: number;
    maxGapMs: number;
  };
  query: {
    sensor_id: string | null;
    group_id: string | null;
    field_id: string | null;
    metrics: string[];
  };
  samples: RawSampleEnvelopeV1[];
  gaps: SeriesGapV1[];
  overlays: SeriesOverlayV1[];
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asPositiveInt(v: unknown): number | null {
  const n = asFiniteNumber(v);
  if (n == null || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseJsonObject(v: unknown): Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return { ...(v as Record<string, any>) };
}

function normalizeSource(v: unknown): RawSampleSourceV1 {
  const s = String(v ?? "device").trim();
  if (s === "gateway" || s === "system" || s === "human" || s === "import" || s === "sim") return s;
  return "device";
}

function normalizeQuality(v: unknown): RawSampleQualityV1 {
  const s = String(v ?? "unknown").trim();
  if (s === "ok" || s === "suspect" || s === "bad") return s;
  return "unknown";
}

function isTruthyFlag(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return ["true", "1", "yes", "y", "on"].includes(v.trim().toLowerCase());
  return false;
}

function assertNoSyntheticOrInterpolatedSample(input: RawSampleWriteInputV1, payload: Record<string, any>): void {
  const values = [
    input.interpolated,
    input.synthetic,
    input.fake_sample,
    payload.interpolated,
    payload.synthetic,
    payload.fake_sample,
  ];
  if (values.some(isTruthyFlag)) {
    throw new RawSampleFactEnvelopeErrorV1("INTERPOLATED_SAMPLE_REJECTED", 400);
  }
  const sampleKind = asTrimmedString(input.sample_kind) ?? asTrimmedString(payload.sample_kind);
  if (sampleKind && sampleKind.toLowerCase() !== "raw") {
    throw new RawSampleFactEnvelopeErrorV1("NON_RAW_SAMPLE_KIND_REJECTED", 400);
  }
}

function metricRequiresDsM(metric: string): boolean {
  const normalized = metric.trim().toLowerCase();
  return EC_METRIC_ALIASES_REQUIRING_DS_M_V1.has(normalized);
}

function makeSampleId(input: { sensor_id: string; ts_ms: number; metric: string; value: number; unit: string | null }): string {
  const digest = createHash("sha256")
    .update(`${input.sensor_id}|${input.ts_ms}|${input.metric}|${input.value}|${input.unit ?? ""}`)
    .digest("hex")
    .slice(0, 24);
  return `rs_${digest}`;
}

function normalizeRawSampleWriteInputV1(input: RawSampleWriteInputV1, tenant: RawSampleFactEnvelopeTenantV1): RawSampleEnvelopeV1 {
  const payload = parseJsonObject(input.payload);
  assertNoSyntheticOrInterpolatedSample(input, payload);

  const sensor_id = asTrimmedString(input.sensor_id) ?? asTrimmedString(input.sensorId);
  if (!sensor_id) throw new RawSampleFactEnvelopeErrorV1("MISSING_SENSOR_ID", 400);

  const metric = asTrimmedString(input.metric);
  if (!metric) throw new RawSampleFactEnvelopeErrorV1("MISSING_METRIC", 400);

  const ts_ms = asPositiveInt(input.ts_ms ?? input.timestamp_ms ?? input.ts);
  if (ts_ms == null) throw new RawSampleFactEnvelopeErrorV1("MISSING_TS_MS", 400);

  const value = asFiniteNumber(input.value);
  if (value == null) throw new RawSampleFactEnvelopeErrorV1("MISSING_VALUE", 400);

  const unit = asTrimmedString(input.unit) ?? asTrimmedString(payload.unit);
  if (metricRequiresDsM(metric) && unit !== "dS/m") {
    throw new RawSampleFactEnvelopeErrorV1("EC_UNIT_DS_M_REQUIRED", 400);
  }

  const group_id = asTrimmedString(input.group_id) ?? asTrimmedString(input.groupId) ?? asTrimmedString(payload.group_id) ?? tenant.group_id;
  const project_id = asTrimmedString(input.project_id) ?? asTrimmedString(input.projectId) ?? asTrimmedString(payload.project_id) ?? tenant.project_id;
  const field_id = asTrimmedString(input.field_id) ?? asTrimmedString(input.fieldId) ?? asTrimmedString(payload.field_id);
  const source = normalizeSource(input.source ?? payload.source);
  const qc_quality = normalizeQuality(input.qc_quality ?? input.quality ?? payload.qc_quality ?? payload.quality);
  const sample_id = asTrimmedString(input.sample_id) ?? asTrimmedString(input.sampleId) ?? makeSampleId({ sensor_id, ts_ms, metric, value, unit });
  const fact_id = `raw_sample:${sample_id}`;

  const payload_json = {
    ...payload,
    tenant_id: tenant.tenant_id,
    project_id,
    group_id,
    field_id,
    sensor_id,
    ts_ms,
    metric,
    value,
    unit,
    qc_quality,
    sample_kind: "raw",
    interpolated: false,
    synthetic: false,
    fake_sample: false,
  };

  return {
    sample_id,
    sensor_id,
    group_id,
    project_id,
    field_id,
    ts_ms,
    metric,
    value,
    unit,
    qc_quality,
    source,
    payload_json,
    fact_id,
    interpolated: false,
    synthetic: false,
  };
}

function parsePayloadJson(v: unknown): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, any>;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function rowToRawSampleEnvelopeV1(row: any): RawSampleEnvelopeV1 {
  const payload = parsePayloadJson(row.payload_json);
  const unit = asTrimmedString(payload.unit);
  const group_id = asTrimmedString(payload.group_id);
  const project_id = asTrimmedString(payload.project_id);
  const field_id = asTrimmedString(payload.field_id);
  const sample_id = String(row.sample_id ?? "");
  return {
    sample_id,
    sensor_id: String(row.sensor_id ?? payload.sensor_id ?? ""),
    group_id,
    project_id,
    field_id,
    ts_ms: Number(row.ts_ms),
    metric: String(row.metric ?? payload.metric ?? ""),
    value: Number(row.value),
    unit,
    qc_quality: normalizeQuality(row.qc_quality ?? payload.qc_quality),
    source: normalizeSource(row.source ?? payload.source),
    payload_json: payload,
    fact_id: `raw_sample:${sample_id}`,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    interpolated: false,
    synthetic: false,
  };
}

export async function appendRawSampleV1(pool: Pool, input: RawSampleWriteInputV1, tenant: RawSampleFactEnvelopeTenantV1): Promise<RawSampleEnvelopeV1> {
  const normalized = normalizeRawSampleWriteInputV1(input, tenant);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO raw_samples (sample_id, sensor_id, ts_ms, metric, value, qc_quality, source, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (sample_id) DO NOTHING
       RETURNING sample_id`,
      [
        normalized.sample_id,
        normalized.sensor_id,
        normalized.ts_ms,
        normalized.metric,
        normalized.value,
        normalized.qc_quality,
        normalized.source,
        JSON.stringify(normalized.payload_json),
      ],
    );
    if (!inserted.rows.length) {
      throw new RawSampleFactEnvelopeErrorV1("RAW_SAMPLE_ALREADY_EXISTS_APPEND_ONLY", 409);
    }

    const factRecord = {
      type: "raw_sample_v1",
      schema_version: "1.0.0",
      occurred_at_ts_ms: normalized.ts_ms,
      source: normalized.source,
      entity: {
        tenant_id: tenant.tenant_id,
        project_id: normalized.project_id,
        group_id: normalized.group_id,
        field_id: normalized.field_id,
        sensor_id: normalized.sensor_id,
      },
      payload: {
        sample_id: normalized.sample_id,
        ts_ms: normalized.ts_ms,
        metric: normalized.metric,
        value: normalized.value,
        unit: normalized.unit,
      },
      qc: { quality: normalized.qc_quality },
      integrity: {
        no_interpolation: true,
        sample_kind: "raw",
      },
    };
    await client.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, to_timestamp($2 / 1000.0), $3, $4)
       ON CONFLICT (fact_id) DO NOTHING`,
      [normalized.fact_id, normalized.ts_ms, normalized.source, JSON.stringify(factRecord)],
    );
    await client.query("COMMIT");
    return normalized;
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof RawSampleFactEnvelopeErrorV1) throw error;
    if (error?.code === "23514") {
      throw new RawSampleFactEnvelopeErrorV1("RAW_SAMPLE_CONSTRAINT_FAILED", 400);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function readRawSamplesV1(pool: Pool, filter: RawSampleReadFilterV1): Promise<RawSampleEnvelopeV1[]> {
  const start = asPositiveInt(filter.start_ts_ms);
  const end = asPositiveInt(filter.end_ts_ms);
  if (start == null || end == null || end < start) {
    throw new RawSampleFactEnvelopeErrorV1("INVALID_TIME_RANGE", 400);
  }
  const limit = Math.max(1, Math.min(Number(filter.limit ?? 5000) || 5000, 20000));
  const where: string[] = [
    `(payload_json ->> 'tenant_id') = $1`,
    `ts_ms >= $2`,
    `ts_ms <= $3`,
  ];
  const args: any[] = [filter.tenant_id, start, end];
  let p = 4;

  if (filter.sensor_id) {
    where.push(`sensor_id = $${p++}`);
    args.push(filter.sensor_id);
  }
  if (filter.group_id) {
    where.push(`(payload_json ->> 'group_id') = $${p++}`);
    args.push(filter.group_id);
  }
  if (filter.field_id) {
    where.push(`(payload_json ->> 'field_id') = $${p++}`);
    args.push(filter.field_id);
  }
  const metrics = (filter.metrics ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (metrics.length) {
    where.push(`metric = ANY($${p++}::text[])`);
    args.push(metrics);
  }
  args.push(limit);

  const result = await pool.query(
    `SELECT sample_id, sensor_id, ts_ms, metric, value, qc_quality, source, payload_json, created_at
     FROM raw_samples
     WHERE ${where.join(" AND ")}
     ORDER BY ts_ms ASC, sample_id ASC
     LIMIT $${p}`,
    args,
  );
  return (result.rows ?? []).map(rowToRawSampleEnvelopeV1);
}

function gapKey(sample: RawSampleEnvelopeV1): string {
  return `${sample.sensor_id}::${sample.metric}`;
}

export function computeGapsForSeriesV1(samples: RawSampleEnvelopeV1[], params: {
  startTs: number;
  endTs: number;
  maxGapMs: number;
  requestedSensorId?: string | null;
  requestedMetrics?: string[];
}): SeriesGapV1[] {
  const { startTs, endTs, maxGapMs } = params;
  if (!samples.length) {
    const metrics = (params.requestedMetrics ?? []).filter(Boolean);
    if (params.requestedSensorId && metrics.length) {
      return metrics.map((metric) => ({ startTs, endTs, reason: "no_data", sensorId: params.requestedSensorId ?? null, metric }));
    }
    return [{ startTs, endTs, reason: "no_data", sensorId: params.requestedSensorId ?? null, metric: metrics[0] ?? null }];
  }

  const buckets = new Map<string, RawSampleEnvelopeV1[]>();
  for (const sample of samples) {
    const k = gapKey(sample);
    const arr = buckets.get(k) ?? [];
    arr.push(sample);
    buckets.set(k, arr);
  }

  const gaps: SeriesGapV1[] = [];
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.ts_ms - b.ts_ms);
    const first = arr[0];
    const last = arr[arr.length - 1];
    if (first.ts_ms > startTs) {
      gaps.push({ startTs, endTs: first.ts_ms, reason: "no_data", sensorId: first.sensor_id, metric: first.metric });
    }
    for (let i = 1; i < arr.length; i += 1) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if (cur.ts_ms - prev.ts_ms > maxGapMs) {
        gaps.push({ startTs: prev.ts_ms, endTs: cur.ts_ms, reason: "no_data", sensorId: cur.sensor_id, metric: cur.metric });
      }
    }
    if (last.ts_ms < endTs) {
      gaps.push({ startTs: last.ts_ms, endTs, reason: "no_data", sensorId: last.sensor_id, metric: last.metric });
    }
  }

  return gaps.sort((a, b) => a.startTs - b.startTs || String(a.sensorId ?? "").localeCompare(String(b.sensorId ?? "")) || String(a.metric ?? "").localeCompare(String(b.metric ?? "")));
}

function normalizeOverlayKindV1(kind: unknown, payload: Record<string, any>): SeriesOverlayKindV1 | null {
  const candidates = [kind, payload.kind, payload.type, payload.overlay_kind]
    .map((x) => String(x ?? "").trim().toLowerCase())
    .filter(Boolean);
  const joined = candidates.join(" ");
  if (FORBIDDEN_OVERLAY_TERMS_V1.some((term) => joined.includes(term))) return null;
  for (const candidate of candidates) {
    if (OFFICIAL_SERIES_OVERLAY_KIND_SET_V1.has(candidate)) return candidate as SeriesOverlayKindV1;
    if (candidate.includes("candidate")) return "candidate";
    if (candidate.includes("annotation")) return "annotation";
  }
  return candidates.length ? "marker" : null;
}

function sourceForOverlay(v: unknown): SeriesOverlayV1["source"] {
  const s = String(v ?? "system").trim();
  if (s === "device" || s === "gateway" || s === "human") return s;
  return "system";
}

export async function readSeriesOverlaysV1(pool: Pool, filter: RawSampleReadFilterV1): Promise<SeriesOverlayV1[]> {
  const where: string[] = [`occurred_at >= to_timestamp($1 / 1000.0)`, `occurred_at <= to_timestamp($2 / 1000.0)`];
  const args: any[] = [filter.start_ts_ms, filter.end_ts_ms];
  let p = 3;
  if (filter.sensor_id) {
    where.push(`(sensor_id = $${p} OR payload_json ->> 'sensor_id' = $${p})`);
    args.push(filter.sensor_id);
    p += 1;
  }
  if (filter.group_id) {
    where.push(`(group_id = $${p} OR payload_json ->> 'group_id' = $${p})`);
    args.push(filter.group_id);
    p += 1;
  }
  if (filter.field_id) {
    where.push(`payload_json ->> 'field_id' = $${p}`);
    args.push(filter.field_id);
    p += 1;
  }

  const result = await pool.query(
    `SELECT marker_id, sensor_id, group_id, kind, source, payload_json, occurred_at
     FROM markers
     WHERE ${where.join(" AND ")}
     ORDER BY occurred_at ASC, marker_id ASC
     LIMIT 5000`,
    args,
  );

  const overlays: SeriesOverlayV1[] = [];
  for (const row of result.rows ?? []) {
    const payload = parsePayloadJson(row.payload_json);
    const kind = normalizeOverlayKindV1(row.kind, payload);
    if (!kind) continue;
    const occurredMs = new Date(row.occurred_at).getTime();
    const startTs = asPositiveInt(payload.startTs ?? payload.start_ts) ?? occurredMs;
    const endTs = asPositiveInt(payload.endTs ?? payload.end_ts) ?? startTs;
    const metric = asTrimmedString(payload.metric);
    const sensorId = asTrimmedString(row.sensor_id) ?? asTrimmedString(payload.sensor_id);
    const groupId = asTrimmedString(row.group_id) ?? asTrimmedString(payload.group_id);
    overlays.push({
      overlay_id: String(row.marker_id ?? randomUUID()),
      startTs: Math.min(startTs, endTs),
      endTs: Math.max(startTs, endTs),
      sensorId,
      groupId,
      metric,
      kind,
      note: asTrimmedString(payload.note)?.slice(0, 240) ?? null,
      source: sourceForOverlay(row.source ?? payload.source),
    });
  }
  return overlays;
}

export async function buildSeriesResponseV1(pool: Pool, filter: RawSampleReadFilterV1 & { max_gap_ms?: number }): Promise<SeriesResponseV1> {
  const samples = await readRawSamplesV1(pool, filter);
  const maxGapMs = Math.max(1, Math.min(Number(filter.max_gap_ms ?? 30 * 60 * 1000) || 30 * 60 * 1000, 24 * 60 * 60 * 1000));
  const gaps = computeGapsForSeriesV1(samples, {
    startTs: filter.start_ts_ms,
    endTs: filter.end_ts_ms,
    maxGapMs,
    requestedSensorId: filter.sensor_id ?? null,
    requestedMetrics: filter.metrics ?? [],
  });
  const overlays = await readSeriesOverlaysV1(pool, filter);
  return {
    range: { startTs: filter.start_ts_ms, endTs: filter.end_ts_ms, maxGapMs },
    query: {
      sensor_id: filter.sensor_id ?? null,
      group_id: filter.group_id ?? null,
      field_id: filter.field_id ?? null,
      metrics: filter.metrics ?? [],
    },
    samples,
    gaps,
    overlays,
  };
}
