// apps/server/src/projections/water_state_estimate_v1.ts
// Purpose: derive and project H14 Water State Estimate v1 from sensing-window, usable weather forecast, and irrigation requirement evidence.
// Boundary: no recommendation, no irrigation scenario comparison, no prescription, no operation, no route, and no frontend coupling.

import type { Pool, PoolClient } from "pg";
import { createHash, randomUUID } from "node:crypto";
import type { SoilMoistureSensingWindowIndexV1 } from "./soil_moisture_sensing_window_v1.js";
import type { WeatherForecastIndexV1 } from "./weather_forecast_v1.js";
import type { IrrigationRequirementIndexV1 } from "./irrigation_requirement_v1.js";

export const WATER_STATE_ESTIMATE_INDEX_V1_TABLE = "water_state_estimate_index_v1";

export type WaterStateV1 = "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN";

export type WaterStateQualityStatusV1 = "ESTIMATED" | "UNKNOWN";

export type WaterStateEstimateFactV1 = {
  type: "water_state_estimate_v1";
  payload: WaterStateEstimatePayloadV1;
};

export type WaterStateEstimatePayloadV1 = {
  estimate_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  state: WaterStateV1;
  root_zone_soil_moisture_percent: number | null;
  target_min_soil_moisture_percent: number | null;
  target_max_soil_moisture_percent: number | null;
  net_irrigation_mm: number | null;
  gross_irrigation_requirement_mm: number | null;
  source_sensing_window_id: string | null;
  source_forecast_id: string | null;
  source_requirement_id: string | null;
  source_input_id: string | null;
  source_sensing_window_fact_id: string | null;
  source_weather_fact_id: string | null;
  source_requirement_fact_id: string | null;
  input_refs: Record<string, unknown>;
  evidence_refs: string[];
  calculation_inputs: Record<string, unknown>;
  derivation: Record<string, unknown>;
  quality: {
    status: WaterStateQualityStatusV1;
    reason_codes: string[];
    deterministic: boolean;
  };
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    score: number;
    basis: string;
  };
  created_at: string;
};

export type WaterStateEstimateIndexV1 = WaterStateEstimatePayloadV1 & {
  source_fact_id: string | null;
  updated_at?: string;
};

type DbConn = Pool | PoolClient;

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function isoOrNow(value: unknown): string {
  const text = textOrNull(value);
  if (!text) return new Date().toISOString();
  const parsedMs = Date.parse(text);
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : text;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : (() => {
      if (typeof value !== "string" || !value.trim()) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function stableEstimateId(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  source_sensing_window_id: string | null;
  source_forecast_id: string | null;
  source_requirement_id: string | null;
}): string {
  const raw = [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.field_id,
    input.source_sensing_window_id ?? "",
    input.source_forecast_id ?? "",
    input.source_requirement_id ?? "",
  ].join("|");

  return "wstate_" + createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function confidenceForState(state: WaterStateV1, reasonCodes: string[]): WaterStateEstimatePayloadV1["confidence"] {
  if (state === "UNKNOWN") {
    return {
      level: "LOW",
      score: 0.2,
      basis: reasonCodes.length ? "insufficient_water_state_evidence_v1" : "unknown_water_state_v1",
    };
  }

  if (reasonCodes.length) {
    return {
      level: "MEDIUM",
      score: 0.62,
      basis: "partial_water_state_evidence_v1",
    };
  }

  return {
    level: "HIGH",
    score: 0.9,
    basis: "sensing_window_weather_requirement_bound_v1",
  };
}

function classifyWaterState(args: {
  sensingWindow: SoilMoistureSensingWindowIndexV1 | null;
  weatherForecast: WeatherForecastIndexV1 | null;
  irrigationRequirement: IrrigationRequirementIndexV1 | null;
}): { state: WaterStateV1; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  if (!args.sensingWindow) reasonCodes.push("SENSING_WINDOW_MISSING");
  if (args.sensingWindow && args.sensingWindow.quality_status !== "PASS") reasonCodes.push("SENSING_WINDOW_NOT_PASS");

  if (!args.weatherForecast) reasonCodes.push("WEATHER_FORECAST_MISSING");
  if (args.weatherForecast?.quality?.stale === true) reasonCodes.push("WEATHER_FORECAST_STALE");
  if (args.weatherForecast?.quality?.provider_status && args.weatherForecast.quality.provider_status !== "OK") reasonCodes.push("WEATHER_FORECAST_NOT_OK");

  if (!args.irrigationRequirement) reasonCodes.push("IRRIGATION_REQUIREMENT_MISSING");

  const soilMoisture = numberOrNull(args.sensingWindow?.summary?.last_value);
  const targetMin = numberOrNull(args.irrigationRequirement?.target_min_soil_moisture_percent);
  const netIrrigation = numberOrNull(args.irrigationRequirement?.net_irrigation_mm);

  if (soilMoisture == null) reasonCodes.push("SOIL_MOISTURE_NOT_FINITE");
  if (targetMin == null) reasonCodes.push("TARGET_MIN_NOT_FINITE");
  if (netIrrigation == null) reasonCodes.push("NET_IRRIGATION_NOT_FINITE");

  if (reasonCodes.length) {
    return { state: "UNKNOWN", reasonCodes };
  }

  if (soilMoisture! >= targetMin! && netIrrigation! <= 0.5) {
    return { state: "NORMAL", reasonCodes };
  }

  if ((soilMoisture! >= 20 && soilMoisture! < targetMin!) || (netIrrigation! > 0.5 && netIrrigation! < 15)) {
    return { state: "LIGHT_DEFICIT", reasonCodes };
  }

  if (soilMoisture! < 20 || netIrrigation! >= 15) {
    return { state: "MODERATE_DEFICIT", reasonCodes };
  }

  return { state: "UNKNOWN", reasonCodes: ["CLASSIFICATION_FALLTHROUGH"] };
}

export function buildWaterStateEstimateV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  sensingWindow: SoilMoistureSensingWindowIndexV1 | null;
  weatherForecast: WeatherForecastIndexV1 | null;
  irrigationRequirement: IrrigationRequirementIndexV1 | null;
  created_at?: string;
  estimate_id?: string;
}): WaterStateEstimatePayloadV1 {
  const sourceSensingWindowId = textOrNull(input.sensingWindow?.window_id);
  const sourceForecastId = textOrNull(input.weatherForecast?.forecast_id ?? input.irrigationRequirement?.source_forecast_id);
  const sourceRequirementId = textOrNull(input.irrigationRequirement?.requirement_id);

  const classification = classifyWaterState({
    sensingWindow: input.sensingWindow,
    weatherForecast: input.weatherForecast,
    irrigationRequirement: input.irrigationRequirement,
  });

  const soilMoisture = numberOrNull(input.sensingWindow?.summary?.last_value);
  const targetMin = numberOrNull(input.irrigationRequirement?.target_min_soil_moisture_percent);
  const targetMax = numberOrNull(input.irrigationRequirement?.target_max_soil_moisture_percent);
  const netIrrigation = numberOrNull(input.irrigationRequirement?.net_irrigation_mm);
  const grossIrrigationRequirement = numberOrNull(input.irrigationRequirement?.gross_irrigation_requirement_mm);

  const estimateId = textOrNull(input.estimate_id) ?? stableEstimateId({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    source_sensing_window_id: sourceSensingWindowId,
    source_forecast_id: sourceForecastId,
    source_requirement_id: sourceRequirementId,
  });

  const qualityStatus: WaterStateQualityStatusV1 = classification.state === "UNKNOWN" ? "UNKNOWN" : "ESTIMATED";

  return {
    estimate_id: estimateId,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    season_id: input.season_id,
    state: classification.state,
    root_zone_soil_moisture_percent: soilMoisture,
    target_min_soil_moisture_percent: targetMin,
    target_max_soil_moisture_percent: targetMax,
    net_irrigation_mm: netIrrigation,
    gross_irrigation_requirement_mm: grossIrrigationRequirement,
    source_sensing_window_id: sourceSensingWindowId,
    source_forecast_id: sourceForecastId,
    source_requirement_id: sourceRequirementId,
    source_input_id: textOrNull(input.irrigationRequirement?.calculation_inputs?.source_input_id),
    source_sensing_window_fact_id: textOrNull(input.sensingWindow?.source_fact_id),
    source_weather_fact_id: textOrNull(input.weatherForecast?.source_fact_id),
    source_requirement_fact_id: textOrNull(input.irrigationRequirement?.source_fact_id),
    input_refs: {
      sensing_window_id: sourceSensingWindowId,
      sensing_window_fact_id: textOrNull(input.sensingWindow?.source_fact_id),
      weather_forecast_id: sourceForecastId,
      weather_fact_id: textOrNull(input.weatherForecast?.source_fact_id),
      weather_issue_time: textOrNull(input.weatherForecast?.issue_time),
      weather_forecast_version: textOrNull(input.weatherForecast?.forecast_version),
      weather_provider_run_id: textOrNull(input.weatherForecast?.provider_run_id),
      weather_external_forecast_id: textOrNull(input.weatherForecast?.external_forecast_id),
      requirement_id: sourceRequirementId,
      requirement_fact_id: textOrNull(input.irrigationRequirement?.source_fact_id),
      source_forecast_id: textOrNull(input.irrigationRequirement?.source_forecast_id),
    },
    evidence_refs: [
      sourceSensingWindowId,
      sourceForecastId,
      sourceRequirementId,
      textOrNull(input.sensingWindow?.source_fact_id),
      textOrNull(input.weatherForecast?.source_fact_id),
      textOrNull(input.irrigationRequirement?.source_fact_id),
    ].filter((value): value is string => Boolean(value)),
    calculation_inputs: {
      soil_moisture_percent: soilMoisture,
      target_min_soil_moisture_percent: targetMin,
      target_max_soil_moisture_percent: targetMax,
      net_irrigation_mm: netIrrigation,
      gross_irrigation_requirement_mm: grossIrrigationRequirement,
      sensing_window_quality_status: input.sensingWindow?.quality_status ?? null,
      weather_provider_status: input.weatherForecast?.quality?.provider_status ?? null,
      weather_stale: input.weatherForecast?.quality?.stale ?? null,
    },
    derivation: {
      derivation_type: "water_state_estimate_from_sensing_weather_requirement_v1",
      deterministic: true,
      rule_version: "water_state_estimate_v1",
      state_thresholds: {
        normal: "soil_moisture >= target_min_soil_moisture_percent && net_irrigation_mm <= 0.5",
        light_deficit: "soil_moisture >= 20 && soil_moisture < target_min_soil_moisture_percent || 0.5 < net_irrigation_mm < 15",
        moderate_deficit: "soil_moisture < 20 || net_irrigation_mm >= 15",
      },
      reason_codes: classification.reasonCodes,
    },
    quality: {
      status: qualityStatus,
      reason_codes: classification.reasonCodes,
      deterministic: true,
    },
    confidence: confidenceForState(classification.state, classification.reasonCodes),
    created_at: isoOrNow(input.created_at),
  };
}

export function mapWaterStateEstimateIndexV1Row(row: any): WaterStateEstimateIndexV1 {
  return {
    estimate_id: String(row.estimate_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: String(row.field_id ?? ""),
    season_id: String(row.season_id ?? ""),
    state: String(row.state ?? "UNKNOWN") as WaterStateV1,
    root_zone_soil_moisture_percent: numberOrNull(row.root_zone_soil_moisture_percent),
    target_min_soil_moisture_percent: numberOrNull(row.target_min_soil_moisture_percent),
    target_max_soil_moisture_percent: numberOrNull(row.target_max_soil_moisture_percent),
    net_irrigation_mm: numberOrNull(row.net_irrigation_mm),
    gross_irrigation_requirement_mm: numberOrNull(row.gross_irrigation_requirement_mm),
    source_sensing_window_id: textOrNull(row.source_sensing_window_id),
    source_forecast_id: textOrNull(row.source_forecast_id),
    source_requirement_id: textOrNull(row.source_requirement_id),
    source_input_id: textOrNull(row.source_input_id),
    source_sensing_window_fact_id: textOrNull(row.source_sensing_window_fact_id),
    source_weather_fact_id: textOrNull(row.source_weather_fact_id),
    source_requirement_fact_id: textOrNull(row.source_requirement_fact_id),
    input_refs: parseJsonObject(row.input_refs_json),
    evidence_refs: parseJsonStringArray(row.evidence_refs_json),
    calculation_inputs: parseJsonObject(row.calculation_inputs_json),
    derivation: parseJsonObject(row.derivation_json),
    quality: parseJsonObject(row.quality_json) as WaterStateEstimatePayloadV1["quality"],
    confidence: parseJsonObject(row.confidence_json) as WaterStateEstimatePayloadV1["confidence"],
    source_fact_id: textOrNull(row.source_fact_id),
    created_at: isoOrNow(row.created_at),
    updated_at: row.updated_at ? isoOrNow(row.updated_at) : undefined,
  };
}

export async function ensureWaterStateEstimateIndexV1(pool: DbConn): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS water_state_estimate_index_v1 (
      estimate_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      season_id text NOT NULL,
      state text NOT NULL,
      root_zone_soil_moisture_percent double precision,
      target_min_soil_moisture_percent double precision,
      target_max_soil_moisture_percent double precision,
      net_irrigation_mm double precision,
      gross_irrigation_requirement_mm double precision,
      source_sensing_window_id text,
      source_forecast_id text,
      source_requirement_id text,
      source_input_id text,
      source_sensing_window_fact_id text,
      source_weather_fact_id text,
      source_requirement_fact_id text,
      input_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      calculation_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT water_state_estimate_index_v1_state_check CHECK (state IN ('NORMAL','LIGHT_DEFICIT','MODERATE_DEFICIT','UNKNOWN'))
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_water_state_estimate_index_v1_scope_latest
      ON water_state_estimate_index_v1 (tenant_id, project_id, group_id, field_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_water_state_estimate_index_v1_requirement
      ON water_state_estimate_index_v1 (source_requirement_id)
  `);
}

export async function appendWaterStateEstimateFactV1(pool: DbConn, payloadInput: WaterStateEstimatePayloadV1): Promise<{ fact_id: string; payload: WaterStateEstimatePayloadV1 }> {
  const factId = "water_state_estimate_fact_" + randomUUID();
  const record: WaterStateEstimateFactV1 = {
    type: "water_state_estimate_v1",
    payload: payloadInput,
  };

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (fact_id) DO NOTHING`,
    [factId, payloadInput.created_at, "water_state_estimate_v1", JSON.stringify(record)],
  );

  return { fact_id: factId, payload: payloadInput };
}

export async function upsertWaterStateEstimateIndexV1(pool: DbConn, payload: WaterStateEstimatePayloadV1, sourceFactId: string | null): Promise<WaterStateEstimateIndexV1> {
  await ensureWaterStateEstimateIndexV1(pool);

  await pool.query(
    `INSERT INTO water_state_estimate_index_v1 (
      estimate_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      state,
      root_zone_soil_moisture_percent,
      target_min_soil_moisture_percent,
      target_max_soil_moisture_percent,
      net_irrigation_mm,
      gross_irrigation_requirement_mm,
      source_sensing_window_id,
      source_forecast_id,
      source_requirement_id,
      source_input_id,
      source_sensing_window_fact_id,
      source_weather_fact_id,
      source_requirement_fact_id,
      input_refs_json,
      evidence_refs_json,
      calculation_inputs_json,
      derivation_json,
      quality_json,
      confidence_json,
      source_fact_id,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::jsonb,$26,$27,now())
    ON CONFLICT (estimate_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      field_id = EXCLUDED.field_id,
      season_id = EXCLUDED.season_id,
      state = EXCLUDED.state,
      root_zone_soil_moisture_percent = EXCLUDED.root_zone_soil_moisture_percent,
      target_min_soil_moisture_percent = EXCLUDED.target_min_soil_moisture_percent,
      target_max_soil_moisture_percent = EXCLUDED.target_max_soil_moisture_percent,
      net_irrigation_mm = EXCLUDED.net_irrigation_mm,
      gross_irrigation_requirement_mm = EXCLUDED.gross_irrigation_requirement_mm,
      source_sensing_window_id = EXCLUDED.source_sensing_window_id,
      source_forecast_id = EXCLUDED.source_forecast_id,
      source_requirement_id = EXCLUDED.source_requirement_id,
      source_input_id = EXCLUDED.source_input_id,
      source_sensing_window_fact_id = EXCLUDED.source_sensing_window_fact_id,
      source_weather_fact_id = EXCLUDED.source_weather_fact_id,
      source_requirement_fact_id = EXCLUDED.source_requirement_fact_id,
      input_refs_json = EXCLUDED.input_refs_json,
      evidence_refs_json = EXCLUDED.evidence_refs_json,
      calculation_inputs_json = EXCLUDED.calculation_inputs_json,
      derivation_json = EXCLUDED.derivation_json,
      quality_json = EXCLUDED.quality_json,
      confidence_json = EXCLUDED.confidence_json,
      source_fact_id = EXCLUDED.source_fact_id,
      created_at = EXCLUDED.created_at,
      updated_at = now()`,
    [
      payload.estimate_id,
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.season_id,
      payload.state,
      payload.root_zone_soil_moisture_percent,
      payload.target_min_soil_moisture_percent,
      payload.target_max_soil_moisture_percent,
      payload.net_irrigation_mm,
      payload.gross_irrigation_requirement_mm,
      payload.source_sensing_window_id,
      payload.source_forecast_id,
      payload.source_requirement_id,
      payload.source_input_id,
      payload.source_sensing_window_fact_id,
      payload.source_weather_fact_id,
      payload.source_requirement_fact_id,
      JSON.stringify(payload.input_refs || {}),
      JSON.stringify(payload.evidence_refs || []),
      JSON.stringify(payload.calculation_inputs || {}),
      JSON.stringify(payload.derivation || {}),
      JSON.stringify(payload.quality || {}),
      JSON.stringify(payload.confidence || {}),
      sourceFactId,
      payload.created_at,
    ],
  );

  return { ...payload, source_fact_id: sourceFactId };
}

export async function ingestWaterStateEstimateV1(pool: DbConn, payload: WaterStateEstimatePayloadV1): Promise<WaterStateEstimateIndexV1> {
  const appended = await appendWaterStateEstimateFactV1(pool, payload);
  return upsertWaterStateEstimateIndexV1(pool, appended.payload, appended.fact_id);
}

export async function getLatestWaterStateEstimateIndexV1(pool: DbConn, tenant: { tenant_id: string; project_id: string; group_id: string }, params: { field_id: string; source_requirement_id?: string | null }): Promise<WaterStateEstimateIndexV1 | null> {
  await ensureWaterStateEstimateIndexV1(pool);

  const result = await pool.query(
    `SELECT *
       FROM water_state_estimate_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND ($5::text IS NULL OR source_requirement_id = $5)
      ORDER BY
        CASE WHEN $5::text IS NOT NULL AND source_requirement_id = $5 THEN 0 ELSE 1 END,
        created_at DESC,
        estimate_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, params.field_id, textOrNull(params.source_requirement_id)],
  );

  const row = result.rows?.[0] ?? null;
  return row ? mapWaterStateEstimateIndexV1Row(row) : null;
}
