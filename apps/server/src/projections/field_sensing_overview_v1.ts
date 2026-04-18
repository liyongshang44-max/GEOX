import type { Pool, PoolClient } from "pg";
import {
  STAGE1_ALL_SENSING_INPUT_METRICS,
  STAGE1_ALL_SUPPORTED_DERIVED_STATES,
  STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES,
} from "../domain/sensing/stage1_sensing_contract_v1.js";

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
  source_observation_ids_json: string[];
  updated_ts_ms: number;
};

const SOIL_METRIC_KEYS = STAGE1_ALL_SENSING_INPUT_METRICS;

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
  source_observation_ids_json: string[];
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
    source_observation_ids_json: Array.isArray(target?.source_observation_ids_json)
      ? target.source_observation_ids_json.map((x: unknown) => String(x ?? "").trim()).filter(Boolean)
      : [],
  };
}


type DerivedStateSelectors = {
  official: string;
  compatibility?: string[];
};

function selectLatestDerivedState(rows: any[], selectors: DerivedStateSelectors): LatestDerivedState | null {
  const official = extractLatestDerivedState(rows, selectors.official);
  if (official) return official;
  for (const legacyStateType of selectors.compatibility ?? []) {
    const legacy = extractLatestDerivedState(rows, legacyStateType);
    if (legacy) return legacy;
  }
  return null;
}

function selectCompatibilityOnlyDerivedState(rows: any[], compatibilityStateType: string): LatestDerivedState | null {
  return extractLatestDerivedState(rows, compatibilityStateType);
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
          source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
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
      await db.query(`ALTER TABLE field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);
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
    `SELECT state_type, payload_json, computed_at_ts_ms, confidence, source_observation_ids_json
       FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND state_type = ANY($5::text[])`,
    [
      params.tenant_id,
      params.field_id,
      params.project_id ?? null,
      params.group_id ?? null,
      STAGE1_ALL_SUPPORTED_DERIVED_STATES,
    ]
  );

  const derivedStateRows = derivedRows.rows ?? [];
  const canopyTemperaturePayload = selectLatestDerivedState(derivedStateRows, {
    official: "canopy_temperature_state",
    compatibility: [...STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES.canopy_temperature_state],
  });
  const evapotranspirationRiskPayload = selectLatestDerivedState(derivedStateRows, {
    official: "evapotranspiration_risk_state",
    compatibility: [...STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES.evapotranspiration_risk_state],
  });
  // customer/product recommended field: sensor_quality_level
  // internal diagnostics field: sensor_quality
  const qualityPayload = selectLatestDerivedState(derivedStateRows, {
    official: "sensor_quality_state",
  });
  const irrigationEffectivenessPayload = selectLatestDerivedState(derivedStateRows, {
    official: "irrigation_effectiveness_state",
    compatibility: [...STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES.irrigation_effectiveness_state],
  });
  const leakRiskPayload = selectLatestDerivedState(derivedStateRows, {
    official: "leak_risk_state",
    compatibility: [...STAGE1_DERIVED_STATE_COMPATIBILITY_ALIASES.leak_risk_state],
  });
  // compatibility-only / not stage-1 official field:
  // irrigation_need_state -> irrigation_need_level is retained only for backward compatibility.
  // It must not be treated as an official stage-1 sensing summary signal or customer whitelist source.
  const irrigationNeedPayload = selectCompatibilityOnlyDerivedState(derivedStateRows, "irrigation_need_state");

  // irrigation_need_level is retained for backward compatibility only.
  // It is not part of the official stage-1 customer-facing sensing summary whitelist
  // and must not be used as a source-of-truth field for new product or decision logic.
  const irrigationNeedLevel = coerceLevel(
    irrigationNeedPayload?.payload?.level ?? irrigationNeedPayload?.payload?.irrigation_need_level,
    ["LOW", "MEDIUM", "HIGH"] as const
  );
  const sensorQualityLevel = coerceSensorQualityLevel(
    qualityPayload?.payload?.level
      ?? qualityPayload?.payload?.sensor_quality_level
      ?? qualityPayload?.payload?.quality_level
      ?? qualityPayload?.payload?.sensor_quality
  );
  const canopyTempStatus = coerceEnumLower(
    canopyTemperaturePayload?.payload?.canopy_temp_status
      ?? canopyTemperaturePayload?.payload?.canopy_temperature_status
      ?? canopyTemperaturePayload?.payload?.temp_status
      ?? canopyTemperaturePayload?.payload?.level,
    ["normal", "elevated", "critical", "unknown"] as const
  );
  const evapotranspirationRisk = coerceEnumLower(
    evapotranspirationRiskPayload?.payload?.evapotranspiration_risk
      ?? evapotranspirationRiskPayload?.payload?.et_risk
      ?? evapotranspirationRiskPayload?.payload?.risk_level
      ?? evapotranspirationRiskPayload?.payload?.level,
    ["low", "medium", "high", "unknown"] as const
  );
  const sensorQuality = coerceSensorQuality(
    qualityPayload?.payload?.sensor_quality
      ?? qualityPayload?.payload?.level
      ?? qualityPayload?.payload?.sensor_quality_level
      ?? qualityPayload?.payload?.quality_level
  );
  const irrigationEffectiveness = coerceEnumLower(
    irrigationEffectivenessPayload?.payload?.irrigation_effectiveness
      ?? irrigationEffectivenessPayload?.payload?.flow_effectiveness
      ?? irrigationEffectivenessPayload?.payload?.level,
    ["low", "medium", "high", "unknown"] as const
  );
  const leakRisk = coerceEnumLower(
    leakRiskPayload?.payload?.leak_risk
      ?? leakRiskPayload?.payload?.leakage_risk
      ?? leakRiskPayload?.payload?.level,
    ["low", "medium", "high", "unknown"] as const
  );

  // irrigation_action_hint is a display hint, not an executable system control command.
  // official source first: irrigation_effectiveness_state / leak_risk_state payload hint fields.
  // compatibility fallback: irrigation_need_state legacy hint fields.
  const irrigationActionHintRaw =
    irrigationEffectivenessPayload?.payload?.action_hint
    ?? leakRiskPayload?.payload?.action_hint
    ?? irrigationEffectivenessPayload?.payload?.suggested_action
    ?? leakRiskPayload?.payload?.suggested_action
    ?? irrigationNeedPayload?.payload?.action_hint
    ?? irrigationNeedPayload?.payload?.suggested_action
    ?? irrigationNeedPayload?.payload?.recommendation;
  const irrigationActionHint = String(irrigationActionHintRaw ?? "").trim() || null;

  const observedAtTsMs = items.length
    ? Math.max(...items.map((x) => Number(x.observed_at_ts_ms ?? 0)))
    : null;
  const confidenceSeries = items.map((x) => x.confidence).filter((x): x is number => x != null);
  const soilConfidence = confidenceSeries.length
    ? Number((confidenceSeries.reduce((sum, n) => sum + n, 0) / confidenceSeries.length).toFixed(3))
    : null;
  const derivedConfidenceSeries = [
    canopyTemperaturePayload?.confidence,
    evapotranspirationRiskPayload?.confidence,
    qualityPayload?.confidence,
    irrigationEffectivenessPayload?.confidence,
    leakRiskPayload?.confidence,
  ].filter((x): x is number => x != null);
  const derivedConfidence = derivedConfidenceSeries.length
    ? Number((derivedConfidenceSeries.reduce((sum, n) => sum + n, 0) / derivedConfidenceSeries.length).toFixed(3))
    : null;
  const confidence = derivedConfidence ?? soilConfidence;
  const computedAtTsMs = [
    canopyTemperaturePayload?.computed_at_ts_ms,
    evapotranspirationRiskPayload?.computed_at_ts_ms,
    qualityPayload?.computed_at_ts_ms,
    irrigationEffectivenessPayload?.computed_at_ts_ms,
    leakRiskPayload?.computed_at_ts_ms,
  ]
    .filter((x): x is number => Number.isFinite(x ?? null))
    .sort((a, b) => b - a)[0] ?? null;
  const sourceObservedAtTsMs = [
    canopyTemperaturePayload?.source_observed_at_ts_ms,
    evapotranspirationRiskPayload?.source_observed_at_ts_ms,
    qualityPayload?.source_observed_at_ts_ms,
    irrigationEffectivenessPayload?.source_observed_at_ts_ms,
    leakRiskPayload?.source_observed_at_ts_ms,
  ]
    .filter((x): x is number => Number.isFinite(x ?? null))
    .sort((a, b) => b - a)[0] ?? null;
  const sourceObservationIds = normalizeCodes([
    ...(canopyTemperaturePayload?.source_observation_ids_json ?? []),
    ...(evapotranspirationRiskPayload?.source_observation_ids_json ?? []),
    ...(qualityPayload?.source_observation_ids_json ?? []),
    ...(irrigationEffectivenessPayload?.source_observation_ids_json ?? []),
    ...(leakRiskPayload?.source_observation_ids_json ?? []),
    ...(irrigationNeedPayload?.source_observation_ids_json ?? []),
  ]);
  // soil_indicators_json is an internal aggregate container.
  // Stage-1 clients should consume a minimal whitelist from this container instead of flattening all keys.
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
    source_observation_ids_json: sourceObservationIds,
    updated_ts_ms: nowMs,
  };

  const upsert = await db.query(
    `INSERT INTO field_sensing_overview_v1
      (tenant_id, project_id, group_id, field_id, observed_at_ts_ms, freshness, confidence, soil_indicators_json, irrigation_need_level, sensor_quality_level, canopy_temp_status, evapotranspiration_risk, sensor_quality, irrigation_effectiveness, leak_risk, irrigation_action_hint, computed_at_ts_ms, source_observed_at_ts_ms, explanation_codes_json, source_observation_ids_json, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21)
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
      source_observation_ids_json = EXCLUDED.source_observation_ids_json,
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
      JSON.stringify(overview.source_observation_ids_json),
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
    source_observation_ids_json: Array.isArray(row.source_observation_ids_json) ? row.source_observation_ids_json.map((x: unknown) => String(x)) : [],
    updated_ts_ms: Number(row.updated_ts_ms ?? nowMs),
  };
}
