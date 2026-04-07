import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

type FieldFertilityStateV1 = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  fertility_level: string | null;
  salinity_risk: string | null;
  recommendation_bias: string | null;
  confidence: number | null;
  computed_at_ts_ms: number | null;
  explanation_codes_json: string[];
  source_device_ids_json: string[];
  updated_ts_ms: number;
};

type DerivedStateProjectionRowV1 = {
  payload_json?: Record<string, any> | null;
  state_type: string;
  confidence?: number | null;
  explanation_codes_json?: string[] | null;
  source_device_ids_json?: string[] | null;
  computed_at_ts_ms?: number | null;
};

let ensurePromise: Promise<void> | null = null;

function asTextOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampConfidence(v: unknown): number | null {
  const n = toFiniteNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function normalizeCodes(values: string[]): string[] {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((x) => String(x || "").trim()).filter(Boolean)));
}

function extractPayloadValue(payload: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asTextOrNull(payload?.[key]);
    if (value) return value;
  }
  return null;
}

export function composeFieldFertilityStateFromDerivedRowsV1(rows: DerivedStateProjectionRowV1[], context: {
  tenant_id: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id: string;
  now_ms?: number;
}): FieldFertilityStateV1 {
  const nowMs = Number.isFinite(context.now_ms) ? Number(context.now_ms) : Date.now();

  let fertilityLevel: string | null = null;
  let salinityRisk: string | null = null;
  let recommendationBias: string | null = null;
  let confidence: number | null = null;
  let computedAtTsMs: number | null = null;
  const explanationCodes: string[] = [];
  const sourceDeviceIds: string[] = [];

  for (const row of rows ?? []) {
    const payload = (row.payload_json && typeof row.payload_json === "object") ? row.payload_json as Record<string, any> : {};
    const rowConfidence = clampConfidence(row.confidence);
    const rowComputedAt = Number(row.computed_at_ts_ms ?? 0);

    if (String(row.state_type) === "fertility_state") {
      fertilityLevel = extractPayloadValue(payload, ["fertility_level", "fertility_state", "level"]);
      recommendationBias = extractPayloadValue(payload, ["recommendation_bias", "bias"]);
      if (!salinityRisk) salinityRisk = extractPayloadValue(payload, ["salinity_risk", "salinity_risk_state"]);
    }

    if (String(row.state_type) === "salinity_risk_state") {
      salinityRisk = extractPayloadValue(payload, ["salinity_risk", "salinity_risk_state", "risk"]);
      if (!recommendationBias) {
        recommendationBias = extractPayloadValue(payload, ["recommendation_bias", "bias"]);
      }
    }

    if (computedAtTsMs == null || rowComputedAt > computedAtTsMs) {
      computedAtTsMs = rowComputedAt;
    }
    if (rowConfidence != null) {
      confidence = confidence == null ? rowConfidence : Math.max(confidence, rowConfidence);
    }

    if (Array.isArray(row.explanation_codes_json)) {
      explanationCodes.push(...row.explanation_codes_json.map((x: unknown) => String(x)));
    }
    if (Array.isArray(row.source_device_ids_json)) {
      sourceDeviceIds.push(...row.source_device_ids_json.map((x: unknown) => String(x)));
    }
  }

  if ((rows?.length ?? 0) > 1) {
    explanationCodes.push("multisource_derived_state_merged");
  }

  return {
    tenant_id: context.tenant_id,
    project_id: context.project_id ?? null,
    group_id: context.group_id ?? null,
    field_id: context.field_id,
    fertility_level: fertilityLevel,
    salinity_risk: salinityRisk,
    recommendation_bias: recommendationBias,
    confidence,
    computed_at_ts_ms: computedAtTsMs,
    explanation_codes_json: normalizeCodes(explanationCodes),
    source_device_ids_json: normalizeCodes(sourceDeviceIds),
    updated_ts_ms: nowMs,
  };
}

export async function ensureFieldFertilityStateProjectionV1(db: DbConn): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(
        `CREATE TABLE IF NOT EXISTS field_fertility_state_v1 (
          tenant_id text NOT NULL,
          project_id text NULL,
          group_id text NULL,
          field_id text NOT NULL,
          fertility_level text NULL,
          salinity_risk text NULL,
          recommendation_bias text NULL,
          confidence double precision NULL,
          computed_at_ts_ms bigint NULL,
          explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          source_device_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_ts_ms bigint NOT NULL,
          PRIMARY KEY (tenant_id, field_id)
        )`
      );
      await db.query(`CREATE INDEX IF NOT EXISTS idx_field_fertility_state_v1_scope ON field_fertility_state_v1 (tenant_id, project_id, group_id, field_id)`);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

export async function refreshFieldFertilityStateV1(db: DbConn, params: {
  tenant_id: string;
  field_id: string;
  project_id?: string | null;
  group_id?: string | null;
  now_ms?: number;
}): Promise<FieldFertilityStateV1> {
  await ensureFieldFertilityStateProjectionV1(db);
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();

  const latestStates = await db.query(
    `SELECT DISTINCT ON (state_type)
        tenant_id,
        project_id,
        group_id,
        field_id,
        state_type,
        payload_json,
        confidence,
        explanation_codes_json,
        source_device_ids_json,
        computed_at_ts_ms
      FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND state_type = ANY($5::text[])
      ORDER BY state_type, computed_at_ts_ms DESC, confidence DESC NULLS LAST`,
    [params.tenant_id, params.field_id, params.project_id ?? null, params.group_id ?? null, ["fertility_state", "salinity_risk_state"]]
  );

  const state = composeFieldFertilityStateFromDerivedRowsV1(latestStates.rows ?? [], {
    tenant_id: params.tenant_id,
    project_id: params.project_id ?? null,
    group_id: params.group_id ?? null,
    field_id: params.field_id,
    now_ms: nowMs,
  });

  const upsert = await db.query(
    `INSERT INTO field_fertility_state_v1
      (tenant_id, project_id, group_id, field_id, fertility_level, salinity_risk, recommendation_bias, confidence, computed_at_ts_ms, explanation_codes_json, source_device_ids_json, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
     ON CONFLICT (tenant_id, field_id)
     DO UPDATE SET
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      fertility_level = EXCLUDED.fertility_level,
      salinity_risk = EXCLUDED.salinity_risk,
      recommendation_bias = EXCLUDED.recommendation_bias,
      confidence = EXCLUDED.confidence,
      computed_at_ts_ms = EXCLUDED.computed_at_ts_ms,
      explanation_codes_json = EXCLUDED.explanation_codes_json,
      source_device_ids_json = EXCLUDED.source_device_ids_json,
      updated_ts_ms = EXCLUDED.updated_ts_ms
     RETURNING *`,
    [
      state.tenant_id,
      state.project_id,
      state.group_id,
      state.field_id,
      state.fertility_level,
      state.salinity_risk,
      state.recommendation_bias,
      state.confidence,
      state.computed_at_ts_ms,
      JSON.stringify(state.explanation_codes_json),
      JSON.stringify(state.source_device_ids_json),
      state.updated_ts_ms,
    ]
  );

  const row = upsert.rows?.[0] ?? state;
  return {
    tenant_id: String(row.tenant_id),
    project_id: row.project_id == null ? null : String(row.project_id),
    group_id: row.group_id == null ? null : String(row.group_id),
    field_id: String(row.field_id),
    fertility_level: asTextOrNull(row.fertility_level),
    salinity_risk: asTextOrNull(row.salinity_risk),
    recommendation_bias: asTextOrNull(row.recommendation_bias),
    confidence: clampConfidence(row.confidence),
    computed_at_ts_ms: row.computed_at_ts_ms == null ? null : Number(row.computed_at_ts_ms),
    explanation_codes_json: Array.isArray(row.explanation_codes_json) ? row.explanation_codes_json.map((x: unknown) => String(x)) : [],
    source_device_ids_json: Array.isArray(row.source_device_ids_json) ? row.source_device_ids_json.map((x: unknown) => String(x)) : [],
    updated_ts_ms: Number(row.updated_ts_ms ?? nowMs),
  };
}
