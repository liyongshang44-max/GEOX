// apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts
// Purpose: deterministically project H32 root-zone soil water state into a no-new-action daily forecast.
// Boundary: pure domain builder only; no database access, fact writes, projection writes, routes, environment reads, wall-clock reads, or random values.

import { createHash } from "node:crypto";
import type { RootZoneSoilWaterStatePayloadV1 } from "./root_zone_soil_water_state_builder_v1.js";

export const ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_VERSION_V1 = "root_zone_soil_water_forecast_v1";
export const ROOT_ZONE_SOIL_WATER_FORECAST_HORIZON_DAYS_V1 = 7;

export type RootZoneSoilWaterForecastStatusV1 =
  | "ESTIMATED"
  | "INSUFFICIENT_STATE"
  | "INVALID_INPUT"
  | "UNKNOWN";

export type RootZoneSoilWaterForecastWaterStatusV1 =
  | "SATURATED_OR_NEAR_SATURATED"
  | "READILY_AVAILABLE"
  | "LIMITED_AVAILABLE"
  | "STRESS"
  | "UNKNOWN";

export type RootZoneSoilWaterForecastBoundAppliedV1 =
  | "NONE"
  | "LOWER_BOUND"
  | "UPPER_BOUND";

export type RootZoneSoilWaterForecastDailyV1 = {
  day_index: number;
  date: string;
  precipitation_mm: number;
  effective_precipitation_mm: number;
  et0_mm: number;
  crop_coefficient: number;
  estimated_crop_et_mm: number;
  net_water_change_mm: number;
  projected_available_water_mm: number;
  projected_available_water_fraction: number;
  forecast_water_status: RootZoneSoilWaterForecastWaterStatusV1;
  bound_applied: RootZoneSoilWaterForecastBoundAppliedV1;
};

export type RootZoneSoilWaterForecastPayloadV1 = {
  forecast_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  source_state_id: string;
  source_state_ref: string;
  weather_forecast_ref: string | null;
  baseline_mode: "NO_NEW_ACTION";
  horizon_days: number;
  root_zone_depth_cm: number;
  root_zone_available_water_capacity_mm: number;
  initial_available_water_fraction: number | null;
  initial_weighted_matric_potential_kpa: number | null;
  daily_forecast: RootZoneSoilWaterForecastDailyV1[];
  min_available_water_fraction: number | null;
  max_available_water_fraction: number | null;
  first_stress_date: string | null;
  stress_day_count: number;
  limited_day_count: number;
  forecast_status: RootZoneSoilWaterForecastStatusV1;
  blocking_reasons: string[];
  calculation_inputs: Record<string, unknown>;
  derivation: Record<string, unknown>;
  confidence: {
    level: "LOW" | "MEDIUM" | "HIGH";
    score: number;
    basis: string;
  };
  computed_at: string;
  determinism_hash: string;
};

export type RootZoneSoilWaterForecastBuildInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  sourceState: RootZoneSoilWaterStatePayloadV1;
  weather_forecast_ref: string | null;
  root_zone_available_water_capacity_mm: number;
  effective_rainfall_factor: number;
  dailyWeather: Array<{
    date: string;
    precipitation_mm: number;
    et0_mm: number;
    crop_coefficient: number;
  }>;
  computed_at: string;
};

type DailyWeatherV1 = RootZoneSoilWaterForecastBuildInputV1["dailyWeather"][number];

const thresholds = {
  saturated_or_near_saturated_min: 0.9,
  readily_available_min: 0.5,
  limited_available_min: 0.25,
  stress_below: 0.25,
};

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function stableSha256(value: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sortedWeather(input: DailyWeatherV1[]): DailyWeatherV1[] {
  return [...input].sort((a, b) => a.date.localeCompare(b.date));
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const daysByMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysByMonth[month - 1] ?? 0);
}

function classify(value: number | null): RootZoneSoilWaterForecastWaterStatusV1 {
  if (value == null || !Number.isFinite(value)) return "UNKNOWN";
  if (value >= 0.9) return "SATURATED_OR_NEAR_SATURATED";
  if (value >= 0.5) return "READILY_AVAILABLE";
  if (value >= 0.25) return "LIMITED_AVAILABLE";
  return "STRESS";
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].sort();
}

function sameSourceStateScope(
  input: RootZoneSoilWaterForecastBuildInputV1,
  sourceState: RootZoneSoilWaterStatePayloadV1 | undefined,
): boolean {
  return (
    sourceState?.tenant_id === input.tenant_id &&
    sourceState.project_id === input.project_id &&
    sourceState.group_id === input.group_id &&
    sourceState.field_id === input.field_id &&
    sourceState.zone_id === input.zone_id
  );
}

function duplicateDates(dailyWeather: DailyWeatherV1[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const day of dailyWeather) {
    if (typeof day.date !== "string") continue;
    if (seen.has(day.date)) duplicates.add(day.date);
    seen.add(day.date);
  }

  return [...duplicates].sort();
}

export function buildRootZoneSoilWaterForecastV1(
  input: RootZoneSoilWaterForecastBuildInputV1,
): RootZoneSoilWaterForecastPayloadV1 {
  const unsortedDailyWeather = input.dailyWeather ?? [];
  const dailyWeather = sortedWeather(unsortedDailyWeather);
  const sourceState = input.sourceState;
  const hashBase = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    source_state_id: sourceState?.state_id ?? "",
    source_state_determinism_hash: sourceState?.determinism_hash ?? "",
    weather_forecast_ref: input.weather_forecast_ref,
    root_zone_available_water_capacity_mm: input.root_zone_available_water_capacity_mm,
    effective_rainfall_factor: input.effective_rainfall_factor,
    dailyWeather,
    model_version: ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_VERSION_V1,
  };
  const determinismHash = stableSha256(hashBase);
  const base = {
    forecast_id: `rzswf_${determinismHash.slice(0, 32)}`,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    source_state_id: sourceState?.state_id ?? "",
    source_state_ref: sourceState?.state_id ?? "",
    weather_forecast_ref: input.weather_forecast_ref,
    baseline_mode: "NO_NEW_ACTION" as const,
    horizon_days: dailyWeather.length,
    root_zone_depth_cm: sourceState?.root_zone_depth_cm ?? 0,
    root_zone_available_water_capacity_mm: input.root_zone_available_water_capacity_mm,
    initial_available_water_fraction: sourceState?.root_zone_available_water_fraction ?? null,
    initial_weighted_matric_potential_kpa: sourceState?.weighted_matric_potential_kpa ?? null,
    computed_at: input.computed_at,
    determinism_hash: determinismHash,
  };

  const invalidReasons: string[] = [];
  if (!isFiniteNumber(input.root_zone_available_water_capacity_mm) || input.root_zone_available_water_capacity_mm <= 0) {
    invalidReasons.push("invalid_root_zone_available_water_capacity_mm");
  }
  if (!isFiniteNumber(input.effective_rainfall_factor) || input.effective_rainfall_factor < 0 || input.effective_rainfall_factor > 1) {
    invalidReasons.push("invalid_effective_rainfall_factor");
  }
  if (unsortedDailyWeather.length === 0) {
    invalidReasons.push("empty_daily_weather");
  }
  if (unsortedDailyWeather.length !== ROOT_ZONE_SOIL_WATER_FORECAST_HORIZON_DAYS_V1) {
    invalidReasons.push("invalid_horizon_days");
  }
  if (duplicateDates(unsortedDailyWeather).length > 0) {
    invalidReasons.push("duplicate_weather_date");
  }

  for (const day of unsortedDailyWeather) {
    if (!isIsoDate(day.date)) invalidReasons.push("invalid_weather_date");
    if (!isFiniteNumber(day.precipitation_mm) || day.precipitation_mm < 0) invalidReasons.push("invalid_precipitation_mm");
    if (!isFiniteNumber(day.et0_mm) || day.et0_mm < 0) invalidReasons.push("invalid_et0_mm");
    if (!isFiniteNumber(day.crop_coefficient) || day.crop_coefficient < 0) invalidReasons.push("invalid_crop_coefficient");
  }

  const stateReasons: string[] = [];
  const awf = sourceState?.root_zone_available_water_fraction;
  if (sourceState?.input_status !== "ESTIMATED" && sourceState?.input_status !== "PARTIAL_ESTIMATE") {
    stateReasons.push("source_state_not_estimated");
  }
  if (!sameSourceStateScope(input, sourceState)) {
    stateReasons.push("source_state_scope_mismatch");
  }
  if (typeof sourceState?.determinism_hash !== "string" || sourceState.determinism_hash.trim() === "") {
    stateReasons.push("missing_source_state_determinism_hash");
  }
  if (awf == null || !isFiniteNumber(awf) || awf < 0 || awf > 1) {
    stateReasons.push("invalid_source_available_water_fraction");
  }

  const terminal = (
    status: RootZoneSoilWaterForecastStatusV1,
    reasons: string[],
  ): RootZoneSoilWaterForecastPayloadV1 => ({
    ...base,
    daily_forecast: [],
    min_available_water_fraction: null,
    max_available_water_fraction: null,
    first_stress_date: null,
    stress_day_count: 0,
    limited_day_count: 0,
    forecast_status: status,
    blocking_reasons: uniqueReasons(reasons),
    calculation_inputs: hashBase,
    derivation: {
      model_version: ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_VERSION_V1,
      required_horizon_days: ROOT_ZONE_SOIL_WATER_FORECAST_HORIZON_DAYS_V1,
      thresholds,
    },
    confidence: { level: "LOW", score: 0, basis: status.toLowerCase() },
  });

  if (invalidReasons.length > 0) return terminal("INVALID_INPUT", invalidReasons);
  if (stateReasons.length > 0) return terminal("INSUFFICIENT_STATE", stateReasons);

  let previous = round6((awf as number) * input.root_zone_available_water_capacity_mm);
  const daily_forecast = dailyWeather.map((day, index) => {
    const precipitation = round6(day.precipitation_mm);
    const effectivePrecipitation = round6(day.precipitation_mm * input.effective_rainfall_factor);
    const et0 = round6(day.et0_mm);
    const cropCoefficient = round6(day.crop_coefficient);
    const cropEt = round6(day.et0_mm * day.crop_coefficient);
    const net = round6(effectivePrecipitation - cropEt);
    let projected = round6(previous + net);
    let bound: RootZoneSoilWaterForecastBoundAppliedV1 = "NONE";

    if (projected < 0) {
      projected = 0;
      bound = "LOWER_BOUND";
    }
    if (projected > input.root_zone_available_water_capacity_mm) {
      projected = round6(input.root_zone_available_water_capacity_mm);
      bound = "UPPER_BOUND";
    }

    previous = projected;
    const fraction = round6(projected / input.root_zone_available_water_capacity_mm);

    return {
      day_index: index + 1,
      date: day.date,
      precipitation_mm: precipitation,
      effective_precipitation_mm: effectivePrecipitation,
      et0_mm: et0,
      crop_coefficient: cropCoefficient,
      estimated_crop_et_mm: cropEt,
      net_water_change_mm: net,
      projected_available_water_mm: projected,
      projected_available_water_fraction: fraction,
      forecast_water_status: classify(fraction),
      bound_applied: bound,
    };
  });
  const fractions = daily_forecast.map((day) => day.projected_available_water_fraction);

  return {
    ...base,
    daily_forecast,
    min_available_water_fraction: round6(Math.min(...fractions)),
    max_available_water_fraction: round6(Math.max(...fractions)),
    first_stress_date: daily_forecast.find((day) => day.forecast_water_status === "STRESS")?.date ?? null,
    stress_day_count: daily_forecast.filter((day) => day.forecast_water_status === "STRESS").length,
    limited_day_count: daily_forecast.filter((day) => day.forecast_water_status === "LIMITED_AVAILABLE").length,
    forecast_status: "ESTIMATED",
    blocking_reasons: [],
    calculation_inputs: hashBase,
    derivation: {
      model_version: ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_VERSION_V1,
      required_horizon_days: ROOT_ZONE_SOIL_WATER_FORECAST_HORIZON_DAYS_V1,
      thresholds,
      bucket_model: "bounded_daily",
    },
    confidence: {
      level: sourceState.input_status === "ESTIMATED" ? "HIGH" : "MEDIUM",
      score: sourceState.input_status === "ESTIMATED" ? 0.9 : 0.7,
      basis: "deterministic_no_new_action_bucket_model",
    },
  };
}
