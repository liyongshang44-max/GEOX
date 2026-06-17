// apps/server/src/projections/irrigation_scenario_set_v1.ts
// Purpose: build and project H15 formal irrigation scenario sets from H14 water state, irrigation requirement, and weather evidence.
// Boundary: comparison only; no recommendation, approval, operation plan, AO-ACT task, frontend, or customer page behavior.

import type { Pool, PoolClient } from "pg";
import { createHash, randomUUID } from "node:crypto";
import type { WaterStateEstimateIndexV1, WaterStateV1 } from "./water_state_estimate_v1.js";
import type { IrrigationRequirementIndexV1 } from "./irrigation_requirement_v1.js";
import type { WeatherForecastIndexV1 } from "./weather_forecast_v1.js";
import type { SoilMoistureSensingWindowIndexV1 } from "./soil_moisture_sensing_window_v1.js";

export const IRRIGATION_SCENARIO_SET_INDEX_V1_TABLE = "irrigation_scenario_set_index_v1";

export type IrrigationScenarioRiskV1 = "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN";

export type IrrigationScenarioRiskDeltaV1 = "IMPROVED" | "UNCHANGED" | "WORSENED" | "UNKNOWN";

export type IrrigationScenarioQualityStatusV1 = "COMPARABLE" | "UNKNOWN";

export type IrrigationScenarioOptionV1 = {
  option_id: "no_action" | "irrigate_10mm" | "irrigate_20mm" | "irrigate_22mm" | "delay_3d";
  action_type: "NO_ACTION" | "IRRIGATE" | "DELAY_IRRIGATION";
  assumed_irrigation_mm: number;
  effective_irrigation_mm_within_72h: number;
  delay_days: number;
  projected_soil_moisture_range: {
    min: number | null;
    max: number | null;
    unit: "%";
  };
  risk_before: IrrigationScenarioRiskV1;
  risk_after: IrrigationScenarioRiskV1;
  risk_delta: IrrigationScenarioRiskDeltaV1;
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    score: number;
    basis: string;
    reasons: string[];
  };
  failure_conditions: string[];
  calculation_trace: Record<string, unknown>;
};

export type IrrigationScenarioSetPayloadV1 = {
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  source_water_state_estimate_id: string | null;
  source_requirement_id: string | null;
  source_forecast_id: string | null;
  source_sensing_window_id: string | null;
  baseline_water_state: string | null;
  baseline_soil_moisture_percent: number | null;
  target_min_soil_moisture_percent: number | null;
  target_max_soil_moisture_percent: number | null;
  net_irrigation_mm: number | null;
  gross_irrigation_requirement_mm: number | null;
  options: IrrigationScenarioOptionV1[];
  recommended_option_id: string | null;
  input_refs: Record<string, unknown>;
  evidence_refs: string[];
  derivation: Record<string, unknown>;
  quality: {
    status: IrrigationScenarioQualityStatusV1;
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

export type IrrigationScenarioSetIndexV1 = IrrigationScenarioSetPayloadV1 & {
  source_fact_id: string | null;
  updated_at?: string;
};

export type IrrigationScenarioSetFactV1 = {
  type: "irrigation_scenario_set_v1";
  payload: IrrigationScenarioSetPayloadV1;
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

function round1(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
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

function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function stableScenarioSetId(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  source_water_state_estimate_id: string | null;
  source_requirement_id: string | null;
  source_forecast_id: string | null;
}): string {
  const raw = [
    input.tenant_id,
    input.project_id,
    input.group_id,
    input.field_id,
    input.source_water_state_estimate_id ?? "",
    input.source_requirement_id ?? "",
    input.source_forecast_id ?? "",
  ].join("|");

  return "iscen_" + createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function riskFromRangeMin(rangeMin: number | null, targetMin: number | null): IrrigationScenarioRiskV1 {
  if (rangeMin == null || targetMin == null) return "UNKNOWN";
  if (rangeMin >= targetMin) return "NORMAL";
  if (rangeMin >= 20) return "LIGHT_DEFICIT";
  return "MODERATE_DEFICIT";
}

function riskRank(risk: IrrigationScenarioRiskV1): number | null {
  if (risk === "NORMAL") return 0;
  if (risk === "LIGHT_DEFICIT") return 1;
  if (risk === "MODERATE_DEFICIT") return 2;
  return null;
}

function riskDelta(before: IrrigationScenarioRiskV1, after: IrrigationScenarioRiskV1): IrrigationScenarioRiskDeltaV1 {
  const beforeRank = riskRank(before);
  const afterRank = riskRank(after);
  if (beforeRank == null || afterRank == null) return "UNKNOWN";
  if (afterRank < beforeRank) return "IMPROVED";
  if (afterRank > beforeRank) return "WORSENED";
  return "UNCHANGED";
}

function optionConfidence(optionId: IrrigationScenarioOptionV1["option_id"], riskAfter: IrrigationScenarioRiskV1): IrrigationScenarioOptionV1["confidence"] {
  const baseReasons = [
    "water_state_estimate_available",
    "versioned_weather_forecast_available",
    "formal_requirement_available",
  ];

  if (riskAfter === "UNKNOWN") {
    return {
      level: "LOW",
      score: 0.2,
      basis: "scenario_option_unknown_risk_v1",
      reasons: baseReasons,
    };
  }

  if (optionId === "delay_3d") {
    return {
      level: "LOW",
      score: 0.45,
      basis: "delay_option_higher_uncertainty_v1",
      reasons: [...baseReasons, "delay_increases_uncertainty"],
    };
  }

  if (optionId === "no_action" || optionId === "irrigate_10mm") {
    return {
      level: "MEDIUM",
      score: 0.68,
      basis: "formal_scenario_delta_model_v1",
      reasons: baseReasons,
    };
  }

  return {
    level: "HIGH",
    score: 0.82,
    basis: "formal_scenario_delta_model_v1",
    reasons: baseReasons,
  };
}

function failureConditions(input: {
  option_id: IrrigationScenarioOptionV1["option_id"];
  risk_after: IrrigationScenarioRiskV1;
}): string[] {
  const conditions: string[] = [
    "rainfall_forecast_deviation_gt_5mm",
    "sensor_coverage_below_threshold",
    "weather_provider_status_not_ok",
  ];

  if (input.risk_after !== "NORMAL") conditions.push("PROJECTED_DEFICIT_REMAINS");
  if (input.option_id === "no_action") conditions.push("NO_IRRIGATION_APPLIED");

  if (input.option_id.startsWith("irrigate_")) {
    conditions.push("EXECUTION_REQUIRED");
    conditions.push("actual_application_efficiency_lt_assumed");
    conditions.push("post_irrigation_soil_response_not_observed");
    conditions.push("irrigation_execution_not_completed");
  }

  if (input.option_id === "delay_3d") {
    conditions.push("IRRIGATION_DELAY_EXPOSURE");
    conditions.push("soil_moisture_declines_faster_than_expected");
    conditions.push("forecast_window_changes_before_execution");
  }

  return Array.from(new Set(conditions));
}

function weatherCoversAsOf(weather: WeatherForecastIndexV1 | null, asOfIso: string): boolean {
  if (!weather) return false;

  const asOfMs = Date.parse(asOfIso);
  const validFromMs = Date.parse(weather.valid_from);
  const validToMs = Date.parse(weather.valid_to);

  if (!Number.isFinite(asOfMs) || !Number.isFinite(validFromMs) || !Number.isFinite(validToMs)) return false;
  return validFromMs <= asOfMs && asOfMs <= validToMs;
}

function buildOption(input: {
  option_id: IrrigationScenarioOptionV1["option_id"];
  action_type: IrrigationScenarioOptionV1["action_type"];
  assumed_irrigation_mm: number;
  effective_irrigation_mm_within_72h: number;
  delay_days: number;
  baseline_soil_moisture_percent: number;
  target_min_soil_moisture_percent: number;
  rainfall_forecast_mm_72h: number;
  et0_mm_72h: number;
  root_zone_depth_mm: number;
  application_efficiency: number;
  uncertainty_margin_percent: number;
  risk_before: IrrigationScenarioRiskV1;
}): IrrigationScenarioOptionV1 {
  const weatherDeltaPercent = (input.rainfall_forecast_mm_72h - input.et0_mm_72h) / input.root_zone_depth_mm * 100;
  const irrigationDeltaPercent = input.effective_irrigation_mm_within_72h * input.application_efficiency / input.root_zone_depth_mm * 100;
  const center = input.baseline_soil_moisture_percent + weatherDeltaPercent + irrigationDeltaPercent;
  const rangeMinRaw = center - input.uncertainty_margin_percent;
  const rangeMaxRaw = center + input.uncertainty_margin_percent;
  const riskAfter = riskFromRangeMin(rangeMinRaw, input.target_min_soil_moisture_percent);

  return {
    option_id: input.option_id,
    action_type: input.action_type,
    assumed_irrigation_mm: round6(input.assumed_irrigation_mm),
    effective_irrigation_mm_within_72h: round6(input.effective_irrigation_mm_within_72h),
    delay_days: input.delay_days,
    projected_soil_moisture_range: {
      min: round1(rangeMinRaw),
      max: round1(rangeMaxRaw),
      unit: "%",
    },
    risk_before: input.risk_before,
    risk_after: riskAfter,
    risk_delta: riskDelta(input.risk_before, riskAfter),
    confidence: optionConfidence(input.option_id, riskAfter),
    failure_conditions: failureConditions({ option_id: input.option_id, risk_after: riskAfter }),
    calculation_trace: {
      formula_version: "formal_irrigation_scenario_delta_model_v1",
      baseline_soil_moisture_percent: round6(input.baseline_soil_moisture_percent),
      rainfall_forecast_mm_72h: round6(input.rainfall_forecast_mm_72h),
      et0_mm_72h: round6(input.et0_mm_72h),
      root_zone_depth_mm: round6(input.root_zone_depth_mm),
      application_efficiency: round6(input.application_efficiency),
      weather_delta_percent: round6(weatherDeltaPercent),
      irrigation_delta_percent: round6(irrigationDeltaPercent),
      projected_center_percent: round6(center),
      uncertainty_margin_percent: input.uncertainty_margin_percent,
      rounding_policy: "risk_before_rounding_range_min_max_rounded_to_1_decimal",
    },
  };
}

function confidenceFromWaterState(waterState: WaterStateEstimateIndexV1 | null, status: IrrigationScenarioQualityStatusV1): IrrigationScenarioSetPayloadV1["confidence"] {
  if (status === "UNKNOWN") {
    return {
      level: "LOW",
      score: 0.2,
      basis: "scenario_set_not_comparable_when_water_state_unknown_v1",
    };
  }

  if (waterState?.confidence?.level === "HIGH") {
    return {
      level: "HIGH",
      score: 0.86,
      basis: "h14_water_state_high_confidence_v1",
    };
  }

  return {
    level: "MEDIUM",
    score: 0.62,
    basis: "h14_water_state_available_v1",
  };
}

export function buildIrrigationScenarioSetV1(input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  waterStateEstimate: WaterStateEstimateIndexV1 | null;
  irrigationRequirement: IrrigationRequirementIndexV1 | null;
  weatherForecast: WeatherForecastIndexV1 | null;
  sensingWindow: SoilMoistureSensingWindowIndexV1 | null;
  created_at?: string;
  scenario_set_id?: string;
}): IrrigationScenarioSetPayloadV1 {
  const waterState = input.waterStateEstimate;
  const requirement = input.irrigationRequirement;
  const weather = input.weatherForecast;
  const sensingWindow = input.sensingWindow;
  const asOfIso = isoOrNow(input.created_at ?? waterState?.created_at ?? weather?.generated_at);

  const sourceWaterStateId = textOrNull(waterState?.estimate_id);
  const sourceRequirementId = textOrNull(requirement?.requirement_id ?? waterState?.source_requirement_id);
  const sourceForecastId = textOrNull(weather?.forecast_id ?? waterState?.source_forecast_id ?? requirement?.source_forecast_id);
  const sourceSensingWindowId = textOrNull(sensingWindow?.window_id ?? waterState?.source_sensing_window_id);

  const requirementInputs = parseJsonObject(requirement?.calculation_inputs);
  const reasonCodes: string[] = [];

  if (!waterState) reasonCodes.push("WATER_STATE_MISSING");
  if (waterState && waterState.state === "UNKNOWN") reasonCodes.push("WATER_STATE_UNKNOWN");
  if (waterState && waterState.quality?.status !== "ESTIMATED") reasonCodes.push("WATER_STATE_NOT_ESTIMATED");
  if (!requirement) reasonCodes.push("IRRIGATION_REQUIREMENT_MISSING");
  if (!weather) reasonCodes.push("WEATHER_FORECAST_MISSING");
  if (weather && weather.quality?.provider_status !== "OK") reasonCodes.push("WEATHER_PROVIDER_NOT_OK");
  if (weather?.quality?.stale === true) reasonCodes.push("WEATHER_FORECAST_STALE");
  if (weather && !weatherCoversAsOf(weather, asOfIso)) reasonCodes.push("WEATHER_FORECAST_NOT_VALID_FOR_AS_OF");
  if (!sensingWindow) reasonCodes.push("SENSING_WINDOW_MISSING");
  if (sensingWindow && sensingWindow.quality_status !== "PASS") reasonCodes.push("SENSING_WINDOW_NOT_PASS");

  const baselineSoil = numberOrNull(waterState?.root_zone_soil_moisture_percent ?? requirement?.root_zone_soil_moisture_percent ?? sensingWindow?.summary?.last_value);
  const targetMin = numberOrNull(waterState?.target_min_soil_moisture_percent ?? requirement?.target_min_soil_moisture_percent);
  const targetMax = numberOrNull(waterState?.target_max_soil_moisture_percent ?? requirement?.target_max_soil_moisture_percent);
  const netIrrigation = numberOrNull(waterState?.net_irrigation_mm ?? requirement?.net_irrigation_mm);
  const grossIrrigation = numberOrNull(waterState?.gross_irrigation_requirement_mm ?? requirement?.gross_irrigation_requirement_mm ?? requirement?.gross_irrigation_mm);
  const rainfall = numberOrNull(weather?.rainfall_forecast_mm_72h ?? requirement?.rainfall_forecast_mm_72h);
  const et0 = numberOrNull(weather?.et0_mm_72h);
  const rootZoneDepthMm = numberOrNull(requirementInputs.root_zone_depth_mm);
  const applicationEfficiency = numberOrNull(requirementInputs.application_efficiency);

  if (baselineSoil == null) reasonCodes.push("BASELINE_SOIL_MOISTURE_NOT_FINITE");
  if (targetMin == null) reasonCodes.push("TARGET_MIN_NOT_FINITE");
  if (grossIrrigation == null) reasonCodes.push("GROSS_IRRIGATION_NOT_FINITE");
  if (rainfall == null) reasonCodes.push("RAINFALL_NOT_FINITE");
  if (et0 == null) reasonCodes.push("ET0_NOT_FINITE");
  if (rootZoneDepthMm == null || rootZoneDepthMm <= 0) reasonCodes.push("ROOT_ZONE_DEPTH_NOT_FINITE");
  if (applicationEfficiency == null || applicationEfficiency <= 0) reasonCodes.push("APPLICATION_EFFICIENCY_NOT_FINITE");

  const status: IrrigationScenarioQualityStatusV1 = reasonCodes.length ? "UNKNOWN" : "COMPARABLE";
  const options: IrrigationScenarioOptionV1[] = [];
  const baselineRisk = (waterState?.state ?? "UNKNOWN") as WaterStateV1;

  if (status === "COMPARABLE") {
    const common = {
      baseline_soil_moisture_percent: baselineSoil!,
      target_min_soil_moisture_percent: targetMin!,
      rainfall_forecast_mm_72h: rainfall!,
      et0_mm_72h: et0!,
      root_zone_depth_mm: rootZoneDepthMm!,
      application_efficiency: applicationEfficiency!,
      risk_before: baselineRisk as IrrigationScenarioRiskV1,
    };

    options.push(buildOption({
      option_id: "no_action",
      action_type: "NO_ACTION",
      assumed_irrigation_mm: 0,
      effective_irrigation_mm_within_72h: 0,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }));

    options.push(buildOption({
      option_id: "irrigate_10mm",
      action_type: "IRRIGATE",
      assumed_irrigation_mm: 10,
      effective_irrigation_mm_within_72h: 10,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }));

    options.push(buildOption({
      option_id: "irrigate_20mm",
      action_type: "IRRIGATE",
      assumed_irrigation_mm: 20,
      effective_irrigation_mm_within_72h: 20,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }));

    options.push(buildOption({
      option_id: "irrigate_22mm",
      action_type: "IRRIGATE",
      assumed_irrigation_mm: 22,
      effective_irrigation_mm_within_72h: 22,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }));

    options.push(buildOption({
      option_id: "delay_3d",
      action_type: "DELAY_IRRIGATION",
      assumed_irrigation_mm: 22,
      effective_irrigation_mm_within_72h: 0,
      delay_days: 3,
      uncertainty_margin_percent: 1.5,
      ...common,
    }));
  }

  const scenarioSetId = textOrNull(input.scenario_set_id) ?? stableScenarioSetId({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    source_water_state_estimate_id: sourceWaterStateId,
    source_requirement_id: sourceRequirementId,
    source_forecast_id: sourceForecastId,
  });

  return {
    scenario_set_id: scenarioSetId,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    season_id: input.season_id,
    source_water_state_estimate_id: sourceWaterStateId,
    source_requirement_id: sourceRequirementId,
    source_forecast_id: sourceForecastId,
    source_sensing_window_id: sourceSensingWindowId,
    baseline_water_state: textOrNull(waterState?.state),
    baseline_soil_moisture_percent: baselineSoil,
    target_min_soil_moisture_percent: targetMin,
    target_max_soil_moisture_percent: targetMax,
    net_irrigation_mm: netIrrigation,
    gross_irrigation_requirement_mm: grossIrrigation,
    options,
    recommended_option_id: null,
    input_refs: {
      as_of: asOfIso,
      water_state_estimate_id: sourceWaterStateId,
      water_state_fact_id: textOrNull(waterState?.source_fact_id),
      sensing_window_id: sourceSensingWindowId,
      sensing_window_fact_id: textOrNull(sensingWindow?.source_fact_id ?? waterState?.source_sensing_window_fact_id),
      weather_forecast_id: sourceForecastId,
      weather_fact_id: textOrNull(weather?.source_fact_id ?? waterState?.source_weather_fact_id),
      weather_forecast_version: textOrNull(weather?.forecast_version ?? waterState?.input_refs?.weather_forecast_version),
      weather_provider_run_id: textOrNull(weather?.provider_run_id ?? waterState?.input_refs?.weather_provider_run_id),
      weather_external_forecast_id: textOrNull(weather?.external_forecast_id ?? waterState?.input_refs?.weather_external_forecast_id),
      weather_valid_from: textOrNull(weather?.valid_from),
      weather_valid_to: textOrNull(weather?.valid_to),
      weather_provider_status: textOrNull(weather?.quality?.provider_status),
      requirement_id: sourceRequirementId,
      requirement_fact_id: textOrNull(requirement?.source_fact_id ?? waterState?.source_requirement_fact_id),
      requirement_calculation_inputs: requirementInputs,
      root_zone_depth_mm: rootZoneDepthMm,
      application_efficiency: applicationEfficiency,
    },
    evidence_refs: [
      sourceWaterStateId,
      sourceSensingWindowId,
      sourceForecastId,
      sourceRequirementId,
      textOrNull(waterState?.source_fact_id),
      textOrNull(sensingWindow?.source_fact_id ?? waterState?.source_sensing_window_fact_id),
      textOrNull(weather?.source_fact_id ?? waterState?.source_weather_fact_id),
      textOrNull(requirement?.source_fact_id ?? waterState?.source_requirement_fact_id),
    ].filter((value): value is string => Boolean(value)),
    derivation: {
      derivation_type: "formal_irrigation_scenario_set_from_h14_water_state_v1",
      deterministic: true,
      rule_version: "formal_irrigation_scenario_delta_model_v1",
      comparison_only: true,
      no_recommendation: true,
      recommended_option_id: null,
      fixed_option_ids: ["no_action", "irrigate_10mm", "irrigate_20mm", "irrigate_22mm", "delay_3d"],
      reason_codes: reasonCodes,
      delay_3d_semantics: "effective_irrigation_mm_within_72h_is_zero",
    },
    quality: {
      status,
      reason_codes: reasonCodes,
      deterministic: true,
    },
    confidence: confidenceFromWaterState(waterState, status),
    created_at: asOfIso,
  };
}

export function mapIrrigationScenarioSetIndexV1Row(row: any): IrrigationScenarioSetIndexV1 {
  return {
    scenario_set_id: String(row.scenario_set_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    field_id: String(row.field_id ?? ""),
    season_id: String(row.season_id ?? ""),
    source_water_state_estimate_id: textOrNull(row.source_water_state_estimate_id),
    source_requirement_id: textOrNull(row.source_requirement_id),
    source_forecast_id: textOrNull(row.source_forecast_id),
    source_sensing_window_id: textOrNull(row.source_sensing_window_id),
    baseline_water_state: textOrNull(row.baseline_water_state),
    baseline_soil_moisture_percent: numberOrNull(row.baseline_soil_moisture_percent),
    target_min_soil_moisture_percent: numberOrNull(row.target_min_soil_moisture_percent),
    target_max_soil_moisture_percent: numberOrNull(row.target_max_soil_moisture_percent),
    net_irrigation_mm: numberOrNull(row.net_irrigation_mm),
    gross_irrigation_requirement_mm: numberOrNull(row.gross_irrigation_requirement_mm),
    options: parseJsonArray<IrrigationScenarioOptionV1>(row.options_json),
    recommended_option_id: textOrNull(row.recommended_option_id),
    input_refs: parseJsonObject(row.input_refs_json),
    evidence_refs: parseJsonArray<string>(row.evidence_refs_json).map(String),
    derivation: parseJsonObject(row.derivation_json),
    quality: parseJsonObject(row.quality_json) as IrrigationScenarioSetPayloadV1["quality"],
    confidence: parseJsonObject(row.confidence_json) as IrrigationScenarioSetPayloadV1["confidence"],
    source_fact_id: textOrNull(row.source_fact_id),
    created_at: isoOrNow(row.created_at),
    updated_at: row.updated_at ? isoOrNow(row.updated_at) : undefined,
  };
}

export async function ensureIrrigationScenarioSetIndexV1(pool: DbConn): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS irrigation_scenario_set_index_v1 (
      scenario_set_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      season_id text NOT NULL,
      source_water_state_estimate_id text,
      source_requirement_id text,
      source_forecast_id text,
      source_sensing_window_id text,
      baseline_water_state text,
      baseline_soil_moisture_percent double precision,
      target_min_soil_moisture_percent double precision,
      target_max_soil_moisture_percent double precision,
      net_irrigation_mm double precision,
      gross_irrigation_requirement_mm double precision,
      options_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      recommended_option_id text,
      input_refs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      evidence_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      confidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_fact_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    DO $
    BEGIN
      ALTER TABLE irrigation_scenario_set_index_v1
        ADD CONSTRAINT irrigation_scenario_set_index_v1_options_array_check
        CHECK (jsonb_typeof(options_json) = 'array');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $;
  `);

  const optionsConstraintResult = await pool.query(`
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'irrigation_scenario_set_index_v1'::regclass
       AND conname = 'irrigation_scenario_set_index_v1_options_array_check'
  `);

  if (!optionsConstraintResult.rows.length) {
    await pool.query(`
      ALTER TABLE irrigation_scenario_set_index_v1
        ADD CONSTRAINT irrigation_scenario_set_index_v1_options_array_check
        CHECK (jsonb_typeof(options_json) = 'array')
    `);
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_scope_latest
      ON irrigation_scenario_set_index_v1 (tenant_id, project_id, group_id, field_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_water_state
      ON irrigation_scenario_set_index_v1 (source_water_state_estimate_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_irrigation_scenario_set_index_v1_requirement
      ON irrigation_scenario_set_index_v1 (source_requirement_id)
  `);
}

export async function appendIrrigationScenarioSetFactV1(pool: DbConn, payloadInput: IrrigationScenarioSetPayloadV1): Promise<{ fact_id: string; payload: IrrigationScenarioSetPayloadV1 }> {
  const factId = "irrigation_scenario_set_fact_" + randomUUID();
  const record: IrrigationScenarioSetFactV1 = {
    type: "irrigation_scenario_set_v1",
    payload: payloadInput,
  };

  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (fact_id) DO NOTHING`,
    [factId, payloadInput.created_at, "irrigation_scenario_set_v1", JSON.stringify(record)],
  );

  return { fact_id: factId, payload: payloadInput };
}

export async function upsertIrrigationScenarioSetIndexV1(pool: DbConn, payload: IrrigationScenarioSetPayloadV1, sourceFactId: string | null): Promise<IrrigationScenarioSetIndexV1> {
  await ensureIrrigationScenarioSetIndexV1(pool);

  await pool.query(
    `INSERT INTO irrigation_scenario_set_index_v1 (
      scenario_set_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      source_water_state_estimate_id,
      source_requirement_id,
      source_forecast_id,
      source_sensing_window_id,
      baseline_water_state,
      baseline_soil_moisture_percent,
      target_min_soil_moisture_percent,
      target_max_soil_moisture_percent,
      net_irrigation_mm,
      gross_irrigation_requirement_mm,
      options_json,
      recommended_option_id,
      input_refs_json,
      evidence_refs_json,
      derivation_json,
      quality_json,
      confidence_json,
      source_fact_id,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24,$25,now())
    ON CONFLICT (scenario_set_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      field_id = EXCLUDED.field_id,
      season_id = EXCLUDED.season_id,
      source_water_state_estimate_id = EXCLUDED.source_water_state_estimate_id,
      source_requirement_id = EXCLUDED.source_requirement_id,
      source_forecast_id = EXCLUDED.source_forecast_id,
      source_sensing_window_id = EXCLUDED.source_sensing_window_id,
      baseline_water_state = EXCLUDED.baseline_water_state,
      baseline_soil_moisture_percent = EXCLUDED.baseline_soil_moisture_percent,
      target_min_soil_moisture_percent = EXCLUDED.target_min_soil_moisture_percent,
      target_max_soil_moisture_percent = EXCLUDED.target_max_soil_moisture_percent,
      net_irrigation_mm = EXCLUDED.net_irrigation_mm,
      gross_irrigation_requirement_mm = EXCLUDED.gross_irrigation_requirement_mm,
      options_json = EXCLUDED.options_json,
      recommended_option_id = EXCLUDED.recommended_option_id,
      input_refs_json = EXCLUDED.input_refs_json,
      evidence_refs_json = EXCLUDED.evidence_refs_json,
      derivation_json = EXCLUDED.derivation_json,
      quality_json = EXCLUDED.quality_json,
      confidence_json = EXCLUDED.confidence_json,
      source_fact_id = EXCLUDED.source_fact_id,
      created_at = EXCLUDED.created_at,
      updated_at = now()`,
    [
      payload.scenario_set_id,
      payload.tenant_id,
      payload.project_id,
      payload.group_id,
      payload.field_id,
      payload.season_id,
      payload.source_water_state_estimate_id,
      payload.source_requirement_id,
      payload.source_forecast_id,
      payload.source_sensing_window_id,
      payload.baseline_water_state,
      payload.baseline_soil_moisture_percent,
      payload.target_min_soil_moisture_percent,
      payload.target_max_soil_moisture_percent,
      payload.net_irrigation_mm,
      payload.gross_irrigation_requirement_mm,
      JSON.stringify(payload.options || []),
      payload.recommended_option_id,
      JSON.stringify(payload.input_refs || {}),
      JSON.stringify(payload.evidence_refs || []),
      JSON.stringify(payload.derivation || {}),
      JSON.stringify(payload.quality || {}),
      JSON.stringify(payload.confidence || {}),
      sourceFactId,
      payload.created_at,
    ],
  );

  return { ...payload, source_fact_id: sourceFactId };
}

export async function ingestIrrigationScenarioSetV1(pool: DbConn, payload: IrrigationScenarioSetPayloadV1): Promise<IrrigationScenarioSetIndexV1> {
  const appended = await appendIrrigationScenarioSetFactV1(pool, payload);
  return upsertIrrigationScenarioSetIndexV1(pool, appended.payload, appended.fact_id);
}

export async function getLatestIrrigationScenarioSetIndexV1(pool: DbConn, tenant: { tenant_id: string; project_id: string; group_id: string }, params: { field_id: string; source_water_state_estimate_id?: string | null }): Promise<IrrigationScenarioSetIndexV1 | null> {
  await ensureIrrigationScenarioSetIndexV1(pool);

  const result = await pool.query(
    `SELECT *
       FROM irrigation_scenario_set_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND ($5::text IS NULL OR source_water_state_estimate_id = $5)
      ORDER BY
        CASE WHEN $5::text IS NOT NULL AND source_water_state_estimate_id = $5 THEN 0 ELSE 1 END,
        created_at DESC,
        scenario_set_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, params.field_id, textOrNull(params.source_water_state_estimate_id)],
  );

  const row = result.rows?.[0] ?? null;
  return row ? mapIrrigationScenarioSetIndexV1Row(row) : null;
}
