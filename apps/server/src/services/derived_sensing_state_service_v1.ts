import crypto from "node:crypto";
import { z } from "zod";
import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

export const DERIVED_SENSING_STATE_TYPES_V1 = [
  "fertility_state",
  "salinity_risk_state",
  "irrigation_need_state",
  "sensor_quality_state",
] as const;
export type DerivedSensingStateTypeV1 = typeof DERIVED_SENSING_STATE_TYPES_V1[number];

const FertilityStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  soil_moisture_pct: z.number().finite().optional(),
  canopy_temp_c: z.number().finite().optional(),
}).passthrough();

const SalinityRiskStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  soil_moisture_pct: z.number().finite().optional(),
  canopy_temp_c: z.number().finite().optional(),
}).passthrough();

const IrrigationNeedStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH"]),
  action_hint: z.string().trim().min(1).max(120).optional(),
}).passthrough();

const SensorQualityStatePayloadSchema = z.object({
  level: z.enum(["GOOD", "FAIR", "POOR"]),
  reason: z.string().trim().min(1).max(160).optional(),
}).passthrough();

export type DerivedSensingStateV1Input = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  state_type: DerivedSensingStateTypeV1;
  payload: Record<string, any>;
  confidence: number | null;
  explanation_codes: string[];
  source_device_ids: string[];
  computed_at_ts_ms: number;
  source: string;
};

export type DerivedSensingStateV1Row = {
  tenant_id: string;
  project_id: string | null;
  group_id: string | null;
  field_id: string;
  state_type: DerivedSensingStateTypeV1;
  payload: Record<string, any>;
  confidence: number | null;
  explanation_codes: string[];
  source_device_ids: string[];
  computed_at_ts_ms: number;
  fact_id: string;
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function clampConfidence(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(1, v));
}

function normalizeArray(values: string[]): string[] {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((x) => String(x || "").trim()).filter(Boolean)));
}

function normalizeStatePayload(stateType: DerivedSensingStateTypeV1, payload: Record<string, any>): Record<string, any> {
  const source = (payload && typeof payload === "object") ? payload : {};
  const levelCandidate = String(
    source.level
      ?? source.fertility_level
      ?? source.salinity_risk
      ?? source.risk
      ?? source.irrigation_need_level
      ?? source.sensor_quality_level
      ?? source.quality_level
      ?? ""
  ).trim().toUpperCase();

  if (stateType === "fertility_state") {
    const parsed = FertilityStatePayloadSchema.safeParse({
      ...source,
      level: levelCandidate,
    });
    if (!parsed.success) {
      throw new Error(`DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION:fertility_state:${parsed.error.issues.map((x) => x.message).join("|")}`);
    }
    return parsed.data;
  }

  if (stateType === "salinity_risk_state") {
    const parsed = SalinityRiskStatePayloadSchema.safeParse({
      ...source,
      level: levelCandidate,
    });
    if (!parsed.success) {
      throw new Error(`DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION:salinity_risk_state:${parsed.error.issues.map((x) => x.message).join("|")}`);
    }
    return parsed.data;
  }

  if (stateType === "irrigation_need_state") {
    const parsed = IrrigationNeedStatePayloadSchema.safeParse({
      ...source,
      level: levelCandidate,
      action_hint: source.action_hint ?? source.suggested_action ?? source.recommendation,
    });
    if (!parsed.success) {
      throw new Error(`DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION:irrigation_need_state:${parsed.error.issues.map((x) => x.message).join("|")}`);
    }
    return parsed.data;
  }

  if (stateType === "sensor_quality_state") {
    const parsed = SensorQualityStatePayloadSchema.safeParse({
      ...source,
      level: levelCandidate,
    });
    if (!parsed.success) {
      throw new Error(`DERIVED_SENSING_STATE_PAYLOAD_CONTRACT_VIOLATION:sensor_quality_state:${parsed.error.issues.map((x) => x.message).join("|")}`);
    }
    return parsed.data;
  }

  throw new Error(`UNSUPPORTED_STATE_TYPE:${stateType}`);
}

export async function ensureDerivedSensingStateProjectionV1(db: DbConn): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS derived_sensing_state_index_v1 (
      tenant_id text NOT NULL,
      project_id text NULL,
      group_id text NULL,
      field_id text NOT NULL,
      state_type text NOT NULL,
      payload_json jsonb NOT NULL,
      confidence double precision NULL,
      explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_device_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      computed_at timestamptz NOT NULL,
      computed_at_ts_ms bigint NOT NULL,
      fact_id text NOT NULL,
      PRIMARY KEY (tenant_id, field_id, state_type, computed_at_ts_ms)
    )`
  );
  await db.query(`CREATE INDEX IF NOT EXISTS idx_derived_sensing_state_index_v1_scope_time ON derived_sensing_state_index_v1 (tenant_id, project_id, group_id, field_id, computed_at_ts_ms DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_derived_sensing_state_index_v1_type_time ON derived_sensing_state_index_v1 (tenant_id, field_id, state_type, computed_at_ts_ms DESC)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_derived_sensing_state_index_v1_fact_id ON derived_sensing_state_index_v1 (fact_id)`);
}

export async function appendDerivedSensingStateV1(db: DbConn, input: DerivedSensingStateV1Input): Promise<{ fact_id: string; occurred_at_iso: string }> {
  const occurred_at_iso = new Date(input.computed_at_ts_ms).toISOString();
  const stateType = String(input.state_type ?? "").trim() as DerivedSensingStateTypeV1;
  if (!DERIVED_SENSING_STATE_TYPES_V1.includes(stateType)) {
    throw new Error(`UNSUPPORTED_STATE_TYPE:${stateType}`);
  }
  const payload = normalizeStatePayload(stateType, input.payload ?? {});
  const fact_id = `derived_state_${sha256Hex(`${input.tenant_id}|${input.field_id}|${stateType}|${input.computed_at_ts_ms}`)}`;
  const normalizedCodes = normalizeArray(input.explanation_codes);
  const normalizedDevices = normalizeArray(input.source_device_ids);

  const record = {
    type: "derived_sensing_state_v1",
    entity: {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
    },
    payload: {
      state_type: stateType,
      payload,
      confidence: clampConfidence(input.confidence),
      explanation_codes: normalizedCodes,
      source_device_ids: normalizedDevices,
      computed_at_ts_ms: input.computed_at_ts_ms,
    },
  };

  await db.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, occurred_at_iso, input.source || "system", JSON.stringify(record)]
  );

  await db.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10::timestamptz, $11, $12)
     ON CONFLICT (tenant_id, field_id, state_type, computed_at_ts_ms) DO NOTHING`,
    [
      input.tenant_id,
      input.project_id,
      input.group_id,
      input.field_id,
      stateType,
      JSON.stringify(payload),
      clampConfidence(input.confidence),
      JSON.stringify(normalizedCodes),
      JSON.stringify(normalizedDevices),
      occurred_at_iso,
      input.computed_at_ts_ms,
      fact_id,
    ]
  );

  return { fact_id, occurred_at_iso };
}

export async function getLatestDerivedSensingStatesByFieldV1(db: DbConn, params: {
  tenant_id: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id: string;
  state_types?: DerivedSensingStateTypeV1[];
}): Promise<DerivedSensingStateV1Row[]> {
  const stateTypes = Array.isArray(params.state_types) && params.state_types.length > 0
    ? params.state_types
    : [...DERIVED_SENSING_STATE_TYPES_V1];

  const res = await db.query(
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
        computed_at_ts_ms,
        fact_id
      FROM derived_sensing_state_index_v1
      WHERE tenant_id = $1
        AND field_id = $2
        AND ($3::text IS NULL OR project_id = $3)
        AND ($4::text IS NULL OR group_id = $4)
        AND state_type = ANY($5::text[])
      ORDER BY state_type, computed_at_ts_ms DESC`,
    [params.tenant_id, params.field_id, params.project_id ?? null, params.group_id ?? null, stateTypes]
  );

  return (res.rows ?? []).map((row: any) => ({
    tenant_id: String(row.tenant_id),
    project_id: row.project_id == null ? null : String(row.project_id),
    group_id: row.group_id == null ? null : String(row.group_id),
    field_id: String(row.field_id),
    state_type: String(row.state_type) as DerivedSensingStateTypeV1,
    payload: (row.payload_json && typeof row.payload_json === "object") ? row.payload_json : {},
    confidence: row.confidence == null ? null : Number(row.confidence),
    explanation_codes: Array.isArray(row.explanation_codes_json) ? row.explanation_codes_json.map((x: any) => String(x)) : [],
    source_device_ids: Array.isArray(row.source_device_ids_json) ? row.source_device_ids_json.map((x: any) => String(x)) : [],
    computed_at_ts_ms: Number(row.computed_at_ts_ms),
    fact_id: String(row.fact_id),
  }));
}

export async function getLatestDerivedSensingStateMapByFieldV1(db: DbConn, params: {
  tenant_id: string;
  project_id?: string | null;
  group_id?: string | null;
  field_id: string;
  state_types?: DerivedSensingStateTypeV1[];
}): Promise<Partial<Record<DerivedSensingStateTypeV1, DerivedSensingStateV1Row>>> {
  const rows = await getLatestDerivedSensingStatesByFieldV1(db, params);
  return rows.reduce((acc, row) => {
    acc[row.state_type] = row;
    return acc;
  }, {} as Partial<Record<DerivedSensingStateTypeV1, DerivedSensingStateV1Row>>);
}
