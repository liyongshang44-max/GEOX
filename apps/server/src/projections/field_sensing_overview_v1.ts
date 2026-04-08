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
  irrigation_need_level: "LOW" | "MEDIUM" | "HIGH" | null;
  sensor_quality_level: "GOOD" | "FAIR" | "POOR" | null;
  canopy_temp_status: "normal" | "elevated" | "critical" | "unknown" | null;
  evapotranspiration_risk: "low" | "medium" | "high" | "unknown" | null;
  sensor_quality: "good" | "fair" | "poor" | "unknown" | null;
  irrigation_effectiveness: "low" | "medium" | "high" | "unknown" | null;
  leak_risk: "low" | "medium" | "high" | "unknown" | null;
  irrigation_action_hint: string | null;
  computed_at_ts_ms: number | null;
  source_observed_at_ts_ms: number | null;
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

function coerceLevel<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const normalized = String(v ?? "").trim().toUpperCase();
  return (allowed as readonly string[]).includes(normalized) ? normalized as T : null;
}

function coerceEnumLower<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const normalized = String(v ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalized) ? normalized as T : null;
}

function coerceSensorQualityLevel(v: unknown): "GOOD" | "FAIR" | "POOR" | null {
  const normalized = String(v ?? "").trim().toUpperCase();
  if (normalized === "DEGRADED") return "FAIR";
  if (normalized === "INVALID") return "POOR";
  if (normalized === "GOOD" || normalized === "FAIR" || normalized === "POOR") return normalized;
  return null;
}

function coerceSensorQuality(v: unknown): "good" | "fair" | "poor" | "unknown" | null {
  const normalized = String(v ?? "").trim().toLowerCase();
  if (normalized === "degraded") return "fair";
  if (normalized === "invalid") return "poor";
  if (normalized === "good" || normalized === "fair" || normalized === "poor" || normalized === "unknown") return normalized;
  return null;
}

type LatestDerivedState = {
  payload: Record<string, any>;
  computed_at_ts_ms: number | null;
  confidence: number | null;
  source_observed_at_ts_ms: number | null;
};

function extractObservedAtFromPayload(payload: Record<string, any>): number | null {
  const candidate = toFiniteNumber(
    payload?.source_observed_at_ts_ms
    ?? payload?.observed_at_ts_ms
    ?? payload?.source_ts_ms
    ?? payload?.ts_ms
  );
  return candidate == null ? null : Math.trunc(candidate);
}

function extractLatestDerivedState(rows: any[], stateType: string): LatestDerivedState | null {
  const target = rows
    .filter((row) => String(row.state_type ?? "") === stateType)
    .sort((a, b) => Number(b.computed_at_ts_ms ?? 0) - Number(a.computed_at_ts_ms ?? 0))[0];
  const payload = target?.payload_json && typeof target.payload_json === "object"
    ? target.payload_json as Record<string, any>
    : null;
  if (!payload) return null;
  return {
    payload,
    computed_at_ts_ms: toFiniteNumber(target?.computed_at_ts_ms),
    confidence: toConfidence(target?.confidence),
    source_observed_at_ts_ms: extractObservedAtFromPayload(payload),
  };
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
          irrigation_need_level text NULL,
          sensor_quality_level text NULL,
          canopy_temp_status text NULL,
          evapotranspiration_risk text NULL,
          sensor_quality text NULL,
          irrigation_effectiveness text NULL,
          leak_risk text NULL,
          irrigation_action_hint text NULL,
          computed_at_ts_ms bigint NULL,
          source_observed_at_ts_ms bigint NULL,
          explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_ts_ms bigint NOT NULL,
          PRIMARY KEY (tenant_id, field_id)
        )`
      );
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_need_level text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS sensor_quality_level text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS canopy_temp_status text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS evapotranspiration_risk text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS sensor_quality text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_effectiveness text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS leak_risk text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_action_hint text NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS computed_at_ts_ms bigint NULL`);
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS source_observed_at_ts_ms bigint NULL`);
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

  const derivedRows = await db.query(
    `SELECT state_type, payload_json, computed_at_ts_ms, confidence
       FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND state_type = ANY($5::text[])`,
    [params.tenant_id, params.field_id, params.project_id ?? null, params.group_id ?? null, ["irrigation_need_state", "sensor_quality_state", "canopy_state", "water_flow_state"]]
  );
  const irrigationPayload = extractLatestDerivedState(derivedRows.rows ?? [], "irrigation_need_state");
  const qualityPayload = extractLatestDerivedState(derivedRows.rows ?? [], "sensor_quality_state");
  const canopyPayload = extractLatestDerivedState(derivedRows.rows ?? [], "canopy_state");
  const waterFlowPayload = extractLatestDerivedState(derivedRows.rows ?? [], "water_flow_state");
  const irrigationNeedLevel = coerceLevel(irrigationPayload?.payload?.level ?? irrigationPayload?.payload?.irrigation_need_level, ["LOW", "MEDIUM", "HIGH"] as const);
  const sensorQualityLevel = coerceSensorQualityLevel(qualityPayload?.payload?.level ?? qualityPayload?.payload?.sensor_quality_level ?? qualityPayload?.payload?.quality_level ?? qualityPayload?.payload?.sensor_quality);
  const canopyTempStatus = coerceEnumLower(canopyPayload?.payload?.canopy_temp_status ?? canopyPayload?.payload?.canopy_temperature_status ?? canopyPayload?.payload?.temp_status, ["normal", "elevated", "critical", "unknown"] as const);
  const evapotranspirationRisk = coerceEnumLower(canopyPayload?.payload?.evapotranspiration_risk ?? canopyPayload?.payload?.et_risk ?? canopyPayload?.payload?.risk_level, ["low", "medium", "high", "unknown"] as const);
  const sensorQuality = coerceSensorQuality(qualityPayload?.payload?.sensor_quality ?? qualityPayload?.payload?.level ?? qualityPayload?.payload?.sensor_quality_level ?? qualityPayload?.payload?.quality_level);
  const irrigationEffectiveness = coerceEnumLower(waterFlowPayload?.payload?.irrigation_effectiveness ?? waterFlowPayload?.payload?.flow_effectiveness, ["low", "medium", "high", "unknown"] as const);
  const leakRisk = coerceEnumLower(waterFlowPayload?.payload?.leak_risk ?? waterFlowPayload?.payload?.leakage_risk, ["low", "medium", "high", "unknown"] as const);
  const irrigationActionHintRaw = irrigationPayload?.payload?.action_hint ?? irrigationPayload?.payload?.suggested_action ?? irrigationPayload?.payload?.recommendation;
  const irrigationActionHint = String(irrigationActionHintRaw ?? "").trim() || null;

  const observedAtTsMs = items.length
    ? Math.max(...items.map((x) => Number(x.observed_at_ts_ms ?? 0)))
    : null;
  const confidenceSeries = items.map((x) => x.confidence).filter((x): x is number => x != null);
  const soilConfidence = confidenceSeries.length
    ? Number((confidenceSeries.reduce((sum, n) => sum + n, 0) / confidenceSeries.length).toFixed(3))
    : null;
  const derivedConfidenceSeries = [canopyPayload?.confidence, qualityPayload?.confidence, waterFlowPayload?.confidence]
    .filter((x): x is number => x != null);
  const derivedConfidence = derivedConfidenceSeries.length
    ? Number((derivedConfidenceSeries.reduce((sum, n) => sum + n, 0) / derivedConfidenceSeries.length).toFixed(3))
    : null;
  const confidence = derivedConfidence ?? soilConfidence;
  const computedAtTsMs = [canopyPayload?.computed_at_ts_ms, qualityPayload?.computed_at_ts_ms, waterFlowPayload?.computed_at_ts_ms]
    .filter((x): x is number => Number.isFinite(x ?? null))
    .sort((a, b) => b - a)[0] ?? null;
  const sourceObservedAtTsMs = [canopyPayload?.source_observed_at_ts_ms, qualityPayload?.source_observed_at_ts_ms, waterFlowPayload?.source_observed_at_ts_ms]
    .filter((x): x is number => Number.isFinite(x ?? null))
    .sort((a, b) => b - a)[0] ?? null;
  const overview: FieldSensingOverviewV1 = {
    tenant_id: params.tenant_id,
    project_id: params.project_id ?? null,
    group_id: params.group_id ?? null,
    field_id: params.field_id,
    observed_at_ts_ms: observedAtTsMs,
    freshness: classifyFreshness(observedAtTsMs, nowMs),
    confidence,
    soil_indicators_json: items.sort((a, b) => a.metric.localeCompare(b.metric)),
    irrigation_need_level: irrigationNeedLevel,
    sensor_quality_level: sensorQualityLevel,
    canopy_temp_status: canopyTempStatus,
    evapotranspiration_risk: evapotranspirationRisk,
    sensor_quality: sensorQuality,
    irrigation_effectiveness: irrigationEffectiveness,
    leak_risk: leakRisk,
    irrigation_action_hint: irrigationActionHint,
    computed_at_ts_ms: computedAtTsMs,
    source_observed_at_ts_ms: sourceObservedAtTsMs,
    explanation_codes_json: normalizeCodes(globalExplanations),
    updated_ts_ms: nowMs,
  };

  const upsert = await db.query(
    `INSERT INTO field_sensing_overview_v1
      (tenant_id, project_id, group_id, field_id, observed_at_ts_ms, freshness, confidence, soil_indicators_json, irrigation_need_level, sensor_quality_level, canopy_temp_status, evapotranspiration_risk, sensor_quality, irrigation_effectiveness, leak_risk, irrigation_action_hint, computed_at_ts_ms, source_observed_at_ts_ms, explanation_codes_json, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)
     ON CONFLICT (tenant_id, field_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      observed_at_ts_ms = EXCLUDED.observed_at_ts_ms,
      freshness = EXCLUDED.freshness,
      confidence = EXCLUDED.confidence,
      soil_indicators_json = EXCLUDED.soil_indicators_json,
      irrigation_need_level = EXCLUDED.irrigation_need_level,
      sensor_quality_level = EXCLUDED.sensor_quality_level,
      canopy_temp_status = EXCLUDED.canopy_temp_status,
      evapotranspiration_risk = EXCLUDED.evapotranspiration_risk,
      sensor_quality = EXCLUDED.sensor_quality,
      irrigation_effectiveness = EXCLUDED.irrigation_effectiveness,
      leak_risk = EXCLUDED.leak_risk,
      irrigation_action_hint = EXCLUDED.irrigation_action_hint,
      computed_at_ts_ms = EXCLUDED.computed_at_ts_ms,
      source_observed_at_ts_ms = EXCLUDED.source_observed_at_ts_ms,
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
      overview.irrigation_need_level,
      overview.sensor_quality_level,
      overview.canopy_temp_status,
      overview.evapotranspiration_risk,
      overview.sensor_quality,
      overview.irrigation_effectiveness,
      overview.leak_risk,
      overview.irrigation_action_hint,
      overview.computed_at_ts_ms,
      overview.source_observed_at_ts_ms,
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
    irrigation_need_level: coerceLevel(row.irrigation_need_level, ["LOW", "MEDIUM", "HIGH"] as const),
    sensor_quality_level: coerceSensorQualityLevel(row.sensor_quality_level),
    canopy_temp_status: coerceEnumLower(row.canopy_temp_status, ["normal", "elevated", "critical", "unknown"] as const),
    evapotranspiration_risk: coerceEnumLower(row.evapotranspiration_risk, ["low", "medium", "high", "unknown"] as const),
    sensor_quality: coerceSensorQuality(row.sensor_quality),
    irrigation_effectiveness: coerceEnumLower(row.irrigation_effectiveness, ["low", "medium", "high", "unknown"] as const),
    leak_risk: coerceEnumLower(row.leak_risk, ["low", "medium", "high", "unknown"] as const),
    irrigation_action_hint: String(row.irrigation_action_hint ?? "").trim() || null,
    computed_at_ts_ms: row.computed_at_ts_ms == null ? null : Number(row.computed_at_ts_ms),
    source_observed_at_ts_ms: row.source_observed_at_ts_ms == null ? null : Number(row.source_observed_at_ts_ms),
    explanation_codes_json: Array.isArray(row.explanation_codes_json) ? row.explanation_codes_json.map((x: unknown) => String(x)) : [],
    updated_ts_ms: Number(row.updated_ts_ms ?? nowMs),
  };
}
