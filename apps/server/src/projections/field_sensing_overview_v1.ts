import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

type CandidateObservation = {
  device_id: string;
  metric: string;
  observed_at_ts_ms: number;
  value_num: number | null;
  confidence: number | null;
};

type SoilIndicatorItem = {
  metric: string;
  value: number | null;
  confidence: number | null;
  observed_at_ts_ms: number | null;
  freshness: "fresh" | "stale" | "unknown";
  source_device_id: string | null;
  explanation_codes: string[];
};

type FieldSensingOverviewV1 = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  observed_at_ts_ms: number | null;
  freshness: "fresh" | "stale" | "unknown";
  confidence: number | null;
  soil_indicators_json: SoilIndicatorItem[];
  explanation_codes_json: string[];
  updated_ts_ms: number;
};

const SOIL_METRIC_KEYS = [
  "soil_moisture_pct",
  "soil_moisture",
  "moisture_pct",
  "ec_ds_m",
  "ec",
  "soil_ec_ds_m",
  "salinity_ec_ds_m",
  "fertility_index",
  "soil_fertility_index",
  "n",
  "p",
  "k",
  "nitrogen",
  "phosphorus",
  "potassium",
  "soil_n",
  "soil_p",
  "soil_k",
] as const;

const FRESH_WINDOW_MS = 1000 * 60 * 60 * 6;

let ensurePromise: Promise<void> | null = null;

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toConfidence(v: unknown): number | null {
  const n = toFiniteNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function classifyFreshness(observedAtTsMs: number | null, nowMs: number): "fresh" | "stale" | "unknown" {
  if (!Number.isFinite(observedAtTsMs) || observedAtTsMs == null) return "unknown";
  return nowMs - observedAtTsMs <= FRESH_WINDOW_MS ? "fresh" : "stale";
}

function normalizeCodes(values: string[]): string[] {
  return Array.from(new Set(values.map((x) => String(x || "").trim()).filter(Boolean)));
}

export async function ensureFieldSensingOverviewProjectionV1(db: DbConn): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(
        `CREATE TABLE IF NOT EXISTS field_sensing_overview_v1 (
          tenant_id text NOT NULL,
          project_id text NULL,
          group_id text NULL,
          field_id text NOT NULL,
          observed_at_ts_ms bigint NULL,
          freshness text NOT NULL,
          confidence double precision NULL,
          soil_indicators_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_ts_ms bigint NOT NULL,
          PRIMARY KEY (tenant_id, field_id)
        )`
      );
      await db.query(`CREATE INDEX IF NOT EXISTS idx_field_sensing_overview_v1_scope ON field_sensing_overview_v1 (tenant_id, project_id, group_id, field_id)`);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

function pickBestCandidate(candidates: CandidateObservation[]): { primary: CandidateObservation; explanations: string[] } {
  const ranked = [...candidates].sort((a, b) => {
    if (b.observed_at_ts_ms !== a.observed_at_ts_ms) return b.observed_at_ts_ms - a.observed_at_ts_ms;
    const confA = a.confidence ?? -1;
    const confB = b.confidence ?? -1;
    if (confB !== confA) return confB - confA;
    return a.device_id.localeCompare(b.device_id);
  });

  const primary = ranked[0];
  const explanations: string[] = [];
  if (ranked.length > 1) explanations.push("multidevice_candidates_detected");

  const competitor = ranked.find((item) => item.device_id !== primary.device_id);
  if (competitor && primary.value_num != null && competitor.value_num != null) {
    const delta = Math.abs(primary.value_num - competitor.value_num);
    if (delta > 0.0001) {
      explanations.push("multidevice_value_conflict");
    }
  }
  if ((primary.confidence ?? 0) < 0.35) explanations.push("low_confidence_signal");

  return { primary, explanations };
}

export async function refreshFieldSensingOverviewV1(db: DbConn, params: {
  tenant_id: string;
  field_id: string;
  project_id?: string | null;
  group_id?: string | null;
  now_ms?: number;
}): Promise<FieldSensingOverviewV1> {
  await ensureFieldSensingOverviewProjectionV1(db);
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();

  const rows = await db.query(
    `SELECT tenant_id, project_id, group_id, field_id, device_id, metric, observed_at_ts_ms, value_num, confidence
       FROM device_observation_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND metric = ANY($5::text[])
      ORDER BY metric ASC, observed_at_ts_ms DESC, confidence DESC NULLS LAST`,
    [params.tenant_id, params.field_id, params.project_id ?? null, params.group_id ?? null, SOIL_METRIC_KEYS]
  );

  const byMetric = new Map<string, CandidateObservation[]>();
  for (const row of rows.rows ?? []) {
    const metric = String(row.metric ?? "").trim();
    if (!metric) continue;
    const candidate: CandidateObservation = {
      device_id: String(row.device_id ?? ""),
      metric,
      observed_at_ts_ms: Number(row.observed_at_ts_ms ?? 0),
      value_num: toFiniteNumber(row.value_num),
      confidence: toConfidence(row.confidence),
    };
    const list = byMetric.get(metric) ?? [];
    list.push(candidate);
    byMetric.set(metric, list);
  }

  const items: SoilIndicatorItem[] = [];
  const globalExplanations: string[] = [];

  for (const [metric, candidates] of byMetric.entries()) {
    if (!candidates.length) continue;
    const picked = pickBestCandidate(candidates);
    items.push({
      metric,
      value: picked.primary.value_num,
      confidence: picked.primary.confidence,
      observed_at_ts_ms: picked.primary.observed_at_ts_ms,
      freshness: classifyFreshness(picked.primary.observed_at_ts_ms, nowMs),
      source_device_id: picked.primary.device_id,
      explanation_codes: picked.explanations,
    });
    globalExplanations.push(...picked.explanations);
  }

  const observedAtTsMs = items.length
    ? Math.max(...items.map((x) => Number(x.observed_at_ts_ms ?? 0)))
    : null;
  const confidenceSeries = items.map((x) => x.confidence).filter((x): x is number => x != null);
  const confidence = confidenceSeries.length
    ? Number((confidenceSeries.reduce((sum, n) => sum + n, 0) / confidenceSeries.length).toFixed(3))
    : null;
  const overview: FieldSensingOverviewV1 = {
    tenant_id: params.tenant_id,
    project_id: params.project_id ?? null,
    group_id: params.group_id ?? null,
    field_id: params.field_id,
    observed_at_ts_ms: observedAtTsMs,
    freshness: classifyFreshness(observedAtTsMs, nowMs),
    confidence,
    soil_indicators_json: items.sort((a, b) => a.metric.localeCompare(b.metric)),
    explanation_codes_json: normalizeCodes(globalExplanations),
    updated_ts_ms: nowMs,
  };

  const upsert = await db.query(
    `INSERT INTO field_sensing_overview_v1
      (tenant_id, project_id, group_id, field_id, observed_at_ts_ms, freshness, confidence, soil_indicators_json, explanation_codes_json, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
     ON CONFLICT (tenant_id, field_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      observed_at_ts_ms = EXCLUDED.observed_at_ts_ms,
      freshness = EXCLUDED.freshness,
      confidence = EXCLUDED.confidence,
      soil_indicators_json = EXCLUDED.soil_indicators_json,
      explanation_codes_json = EXCLUDED.explanation_codes_json,
      updated_ts_ms = EXCLUDED.updated_ts_ms
     RETURNING *`,
    [
      overview.tenant_id,
      overview.project_id,
      overview.group_id,
      overview.field_id,
      overview.observed_at_ts_ms,
      overview.freshness,
      overview.confidence,
      JSON.stringify(overview.soil_indicators_json),
      JSON.stringify(overview.explanation_codes_json),
      overview.updated_ts_ms,
    ]
  );

  const row = upsert.rows?.[0] ?? overview;
  return {
    tenant_id: String(row.tenant_id),
    project_id: row.project_id == null ? null : String(row.project_id),
    group_id: row.group_id == null ? null : String(row.group_id),
    field_id: String(row.field_id),
    observed_at_ts_ms: row.observed_at_ts_ms == null ? null : Number(row.observed_at_ts_ms),
    freshness: String(row.freshness) as "fresh" | "stale" | "unknown",
    confidence: row.confidence == null ? null : Number(row.confidence),
    soil_indicators_json: Array.isArray(row.soil_indicators_json) ? row.soil_indicators_json as SoilIndicatorItem[] : [],
    explanation_codes_json: Array.isArray(row.explanation_codes_json) ? row.explanation_codes_json.map((x: unknown) => String(x)) : [],
    updated_ts_ms: Number(row.updated_ts_ms ?? nowMs),
  };
}
