// apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts
// Purpose: deterministically compare fixed hypothetical irrigation options against an H33 root-zone no-action forecast.
// Boundary: pure domain builder only; no database access, fact writes, projection writes, routes, environment reads, wall-clock reads, or random values.

import { createHash } from "node:crypto";
import type {
  RootZoneSoilWaterForecastBoundAppliedV1,
  RootZoneSoilWaterForecastPayloadV1,
  RootZoneSoilWaterForecastWaterStatusV1,
} from "./root_zone_soil_water_forecast_builder_v1.js";

export const ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1 = "root_zone_irrigation_scenario_set_v1";
export const ROOT_ZONE_IRRIGATION_SCENARIO_HORIZON_DAYS_V1 = 7;

export type RootZoneIrrigationScenarioOptionIdV1 =
  | "NO_ACTION"
  | "IRRIGATE_10MM_DAY0"
  | "IRRIGATE_20MM_DAY0"
  | "IRRIGATE_30MM_DAY0"
  | "DELAY_3_DAYS_THEN_IRRIGATE_20MM";

export type RootZoneIrrigationScenarioInputStatusV1 =
  | "COMPARABLE"
  | "INSUFFICIENT_FORECAST"
  | "INVALID_INPUT"
  | "UNKNOWN";

export type RootZoneIrrigationScenarioEventV1 = {
  day_index: number;
  irrigation_mm: number;
  application_efficiency: number;
  effective_irrigation_mm: number;
};

export type RootZoneIrrigationScenarioDailyProjectionV1 = {
  day_index: number;
  date: string;
  baseline_available_water_fraction: number;
  projected_available_water_fraction: number;
  delta_vs_baseline_fraction: number;
  projected_available_water_mm: number;
  forecast_water_status: RootZoneSoilWaterForecastWaterStatusV1;
  bound_applied: RootZoneSoilWaterForecastBoundAppliedV1;
};

export type RootZoneIrrigationScenarioOptionV1 = {
  option_id: RootZoneIrrigationScenarioOptionIdV1;
  action_type: "NO_ACTION" | "IRRIGATE" | "DELAYED_IRRIGATION";
  irrigation_events: RootZoneIrrigationScenarioEventV1[];
  daily_projection: RootZoneIrrigationScenarioDailyProjectionV1[];
  option_summary: {
    min_available_water_fraction: number | null;
    max_available_water_fraction: number | null;
    first_stress_date: string | null;
    stress_day_count: number;
    limited_day_count: number;
    total_irrigation_mm: number;
    total_effective_irrigation_mm: number;
  };
  comparison: {
    stress_days_delta_vs_baseline: number;
    limited_days_delta_vs_baseline: number;
    min_awf_delta_vs_baseline: number | null;
  };
  quality: {
    status: "COMPARABLE" | "NOT_COMPARABLE";
    reason_codes: string[];
  };
  confidence: {
    level: "LOW" | "MEDIUM" | "HIGH";
    score: number;
    basis: string;
  };
  calculation_trace: Record<string, unknown>;
};

export type RootZoneIrrigationScenarioSetPayloadV1 = {
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  source_forecast_id: string;
  source_forecast_ref: string;
  baseline_mode: "FORECAST_BASELINE";
  comparison_mode: "HYPOTHETICAL_IRRIGATION_OPTIONS";
  horizon_days: number;
  root_zone_depth_cm: number;
  root_zone_available_water_capacity_mm: number;
  baseline_summary: {
    min_available_water_fraction: number | null;
    first_stress_date: string | null;
    stress_day_count: number;
    limited_day_count: number;
  };
  options: RootZoneIrrigationScenarioOptionV1[];
  input_status: RootZoneIrrigationScenarioInputStatusV1;
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

export type RootZoneIrrigationScenarioBuildInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  sourceForecast: RootZoneSoilWaterForecastPayloadV1;
  application_efficiency: number;
  computed_at: string;
};

type ScenarioOptionDefinitionV1 = {
  option_id: RootZoneIrrigationScenarioOptionIdV1;
  action_type: RootZoneIrrigationScenarioOptionV1["action_type"];
  events: Array<{
    day_index: number;
    irrigation_mm: number;
  }>;
};

const AWF_THRESHOLDS_V1 = {
  saturated_or_near_saturated_min: 0.9,
  readily_available_min: 0.5,
  limited_available_min: 0.25,
  stress_below: 0.25,
};

const FIXED_SCENARIO_OPTIONS_V1: ScenarioOptionDefinitionV1[] = [
  { option_id: "NO_ACTION", action_type: "NO_ACTION", events: [] },
  { option_id: "IRRIGATE_10MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 10 }] },
  { option_id: "IRRIGATE_20MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 20 }] },
  { option_id: "IRRIGATE_30MM_DAY0", action_type: "IRRIGATE", events: [{ day_index: 0, irrigation_mm: 30 }] },
  {
    option_id: "DELAY_3_DAYS_THEN_IRRIGATE_20MM",
    action_type: "DELAYED_IRRIGATION",
    events: [{ day_index: 3, irrigation_mm: 20 }],
  },
];

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

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

function classifyAwf(value: number | null): RootZoneSoilWaterForecastWaterStatusV1 {
  if (value == null || !Number.isFinite(value)) return "UNKNOWN";
  if (value >= AWF_THRESHOLDS_V1.saturated_or_near_saturated_min) return "SATURATED_OR_NEAR_SATURATED";
  if (value >= AWF_THRESHOLDS_V1.readily_available_min) return "READILY_AVAILABLE";
  if (value >= AWF_THRESHOLDS_V1.limited_available_min) return "LIMITED_AVAILABLE";
  return "STRESS";
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].sort();
}

function sortedDailyForecast(sourceForecast: RootZoneSoilWaterForecastPayloadV1 | undefined) {
  return [...(sourceForecast?.daily_forecast ?? [])].sort((a, b) => a.day_index - b.day_index || a.date.localeCompare(b.date));
}

function buildDeterminismHash(input: RootZoneIrrigationScenarioBuildInputV1): string {
  const sourceForecast = input.sourceForecast;
  const sortedOptionDefinitions = [...FIXED_SCENARIO_OPTIONS_V1].sort((a, b) => a.option_id.localeCompare(b.option_id));

  return stableSha256({
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    source_forecast_id: sourceForecast?.forecast_id ?? "",
    source_forecast_determinism_hash: sourceForecast?.determinism_hash ?? "",
    application_efficiency: input.application_efficiency,
    fixed_scenario_option_definitions: sortedOptionDefinitions,
    model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1,
  });
}

function insufficientForecastReasons(sourceForecast: RootZoneSoilWaterForecastPayloadV1 | undefined): string[] {
  const reasons: string[] = [];

  if (sourceForecast?.forecast_status !== "ESTIMATED") reasons.push("source_forecast_not_estimated");
  if (!Array.isArray(sourceForecast?.daily_forecast)) reasons.push("missing_daily_forecast");
  if (Array.isArray(sourceForecast?.daily_forecast) && sourceForecast.daily_forecast.length !== ROOT_ZONE_IRRIGATION_SCENARIO_HORIZON_DAYS_V1) {
    reasons.push("insufficient_daily_forecast");
  }
  if (sourceForecast?.horizon_days !== ROOT_ZONE_IRRIGATION_SCENARIO_HORIZON_DAYS_V1) reasons.push("invalid_source_horizon_days");
  if (!isFiniteNumber(sourceForecast?.root_zone_available_water_capacity_mm) || sourceForecast.root_zone_available_water_capacity_mm <= 0) {
    reasons.push("invalid_source_capacity");
  }
  if (!sourceForecast?.source_state_id) reasons.push("missing_source_state_id");
  if (!sourceForecast?.determinism_hash) reasons.push("missing_source_forecast_determinism_hash");

  return reasons;
}

function invalidInputReasons(input: RootZoneIrrigationScenarioBuildInputV1): string[] {
  const reasons: string[] = [];
  const sourceForecast = input.sourceForecast;
  const dailyForecast = sourceForecast?.daily_forecast ?? [];

  if (!isFiniteNumber(input.application_efficiency) || input.application_efficiency <= 0 || input.application_efficiency > 1) {
    reasons.push("invalid_application_efficiency");
  }

  if (
    sourceForecast &&
    (sourceForecast.tenant_id !== input.tenant_id ||
      sourceForecast.project_id !== input.project_id ||
      sourceForecast.group_id !== input.group_id ||
      sourceForecast.field_id !== input.field_id ||
      sourceForecast.zone_id !== input.zone_id)
  ) {
    reasons.push("source_forecast_scope_mismatch");
  }

  const dayIndexes = new Set<number>();
  const dates = new Set<string>();
  for (const day of dailyForecast) {
    if (!isFiniteNumber(day.projected_available_water_mm)) reasons.push("non_finite_projected_available_water_mm");
    if (!isFiniteNumber(day.net_water_change_mm)) reasons.push("non_finite_net_water_change_mm");
    if (dayIndexes.has(day.day_index)) reasons.push("duplicate_day_index");
    if (dates.has(day.date)) reasons.push("duplicate_date");
    dayIndexes.add(day.day_index);
    dates.add(day.date);

    if (isFiniteNumber(sourceForecast?.root_zone_available_water_capacity_mm) && sourceForecast.root_zone_available_water_capacity_mm > 0) {
      const expectedAwf = round6(day.projected_available_water_mm / sourceForecast.root_zone_available_water_capacity_mm);
      if (!isFiniteNumber(day.projected_available_water_fraction) || Math.abs(round6(day.projected_available_water_fraction) - expectedAwf) > 0.000001) {
        reasons.push("baseline_awf_inconsistent_with_mm_capacity");
      }
    }
  }

  if (
    dailyForecast.length === ROOT_ZONE_IRRIGATION_SCENARIO_HORIZON_DAYS_V1 &&
    [...dayIndexes].sort((a, b) => a - b).join(",") !== "0,1,2,3,4,5,6"
  ) {
    reasons.push("invalid_day_index_set");
  }

  return uniqueReasons(reasons);
}

function summarizeProjection(rows: RootZoneIrrigationScenarioDailyProjectionV1[]) {
  const fractions = rows
    .map((row) => row.projected_available_water_fraction)
    .filter((value) => Number.isFinite(value));

  return {
    min_available_water_fraction: fractions.length ? round6(Math.min(...fractions)) : null,
    max_available_water_fraction: fractions.length ? round6(Math.max(...fractions)) : null,
    first_stress_date: rows.find((row) => row.forecast_water_status === "STRESS")?.date ?? null,
    stress_day_count: rows.filter((row) => row.forecast_water_status === "STRESS").length,
    limited_day_count: rows.filter((row) => row.forecast_water_status === "LIMITED_AVAILABLE").length,
  };
}

function baselineSummary(sourceForecast: RootZoneSoilWaterForecastPayloadV1 | undefined) {
  return {
    min_available_water_fraction: sourceForecast?.min_available_water_fraction ?? null,
    first_stress_date: sourceForecast?.first_stress_date ?? null,
    stress_day_count: sourceForecast?.stress_day_count ?? 0,
    limited_day_count: sourceForecast?.limited_day_count ?? 0,
  };
}

function buildOption(
  definition: ScenarioOptionDefinitionV1,
  input: RootZoneIrrigationScenarioBuildInputV1,
  inputStatus: RootZoneIrrigationScenarioInputStatusV1,
  blockingReasons: string[],
): RootZoneIrrigationScenarioOptionV1 {
  const sourceForecast = input.sourceForecast;
  const dailyForecast = sortedDailyForecast(sourceForecast);
  const capacity =
    isFiniteNumber(sourceForecast?.root_zone_available_water_capacity_mm) && sourceForecast.root_zone_available_water_capacity_mm > 0
      ? sourceForecast.root_zone_available_water_capacity_mm
      : 1;
  const safeEfficiency = isFiniteNumber(input.application_efficiency) ? input.application_efficiency : 0;
  const baseline = baselineSummary(sourceForecast);

  const irrigationEvents = definition.events.map((event) => ({
    day_index: event.day_index,
    irrigation_mm: event.irrigation_mm,
    application_efficiency: input.application_efficiency,
    effective_irrigation_mm: round6(event.irrigation_mm * safeEfficiency),
  }));

  let previousProjectedAvailableWaterMm = 0;
  const dailyProjection = dailyForecast.map((day, index) => {
    const effectiveIrrigationMm = irrigationEvents
      .filter((event) => event.day_index === day.day_index)
      .reduce((sum, event) => sum + event.effective_irrigation_mm, 0);
    const rawProjectedAvailableWaterMm =
      index === 0
        ? day.projected_available_water_mm + effectiveIrrigationMm
        : previousProjectedAvailableWaterMm + day.net_water_change_mm + effectiveIrrigationMm;
    const projectedAvailableWaterMm = Math.max(0, Math.min(capacity, rawProjectedAvailableWaterMm));
    const boundApplied: RootZoneSoilWaterForecastBoundAppliedV1 =
      rawProjectedAvailableWaterMm < 0 ? "LOWER_BOUND" : rawProjectedAvailableWaterMm > capacity ? "UPPER_BOUND" : "NONE";
    const baselineAwf = round6(day.projected_available_water_mm / capacity);
    const projectedAwf = round6(projectedAvailableWaterMm / capacity);

    previousProjectedAvailableWaterMm = projectedAvailableWaterMm;

    if (definition.option_id === "NO_ACTION") {
      return {
        day_index: day.day_index,
        date: day.date,
        baseline_available_water_fraction: day.projected_available_water_fraction,
        projected_available_water_fraction: day.projected_available_water_fraction,
        delta_vs_baseline_fraction: 0,
        projected_available_water_mm: day.projected_available_water_mm,
        forecast_water_status: day.forecast_water_status,
        bound_applied: day.bound_applied,
      };
    }

    return {
      day_index: day.day_index,
      date: day.date,
      baseline_available_water_fraction: baselineAwf,
      projected_available_water_fraction: projectedAwf,
      delta_vs_baseline_fraction: round6(projectedAwf - baselineAwf),
      projected_available_water_mm: round6(projectedAvailableWaterMm),
      forecast_water_status: classifyAwf(projectedAwf),
      bound_applied: boundApplied,
    };
  });

  const optionSummary = summarizeProjection(dailyProjection);
  const totalIrrigationMm = irrigationEvents.reduce((sum, event) => sum + event.irrigation_mm, 0);
  const totalEffectiveIrrigationMm = irrigationEvents.reduce((sum, event) => sum + event.effective_irrigation_mm, 0);

  return {
    option_id: definition.option_id,
    action_type: definition.action_type,
    irrigation_events: irrigationEvents,
    daily_projection: dailyProjection,
    option_summary: {
      ...optionSummary,
      total_irrigation_mm: round6(totalIrrigationMm),
      total_effective_irrigation_mm: round6(totalEffectiveIrrigationMm),
    },
    comparison: {
      stress_days_delta_vs_baseline: optionSummary.stress_day_count - baseline.stress_day_count,
      limited_days_delta_vs_baseline: optionSummary.limited_day_count - baseline.limited_day_count,
      min_awf_delta_vs_baseline:
        optionSummary.min_available_water_fraction == null || baseline.min_available_water_fraction == null
          ? null
          : round6(optionSummary.min_available_water_fraction - baseline.min_available_water_fraction),
    },
    quality: {
      status: inputStatus === "COMPARABLE" ? "COMPARABLE" : "NOT_COMPARABLE",
      reason_codes: blockingReasons,
    },
    confidence: {
      level: inputStatus === "COMPARABLE" ? "MEDIUM" : "LOW",
      score: inputStatus === "COMPARABLE" ? 0.75 : 0.1,
      basis: "deterministic_hypothetical_irrigation_comparison",
    },
    calculation_trace: {
      application_efficiency: input.application_efficiency,
      model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1,
      source: "H33_baseline_net_water_change_mm",
    },
  };
}

export function buildRootZoneIrrigationScenarioSetV1(
  input: RootZoneIrrigationScenarioBuildInputV1,
): RootZoneIrrigationScenarioSetPayloadV1 {
  const sourceForecast = input.sourceForecast;
  const dailyForecast = sortedDailyForecast(sourceForecast);
  const determinismHash = buildDeterminismHash(input);
  const insufficientReasons = insufficientForecastReasons(sourceForecast);
  const invalidReasons = invalidInputReasons(input);
  const inputStatus: RootZoneIrrigationScenarioInputStatusV1 = insufficientReasons.length
    ? "INSUFFICIENT_FORECAST"
    : invalidReasons.length
      ? "INVALID_INPUT"
      : "COMPARABLE";
  const blockingReasons = uniqueReasons([...insufficientReasons, ...invalidReasons]);

  return {
    scenario_set_id: `rziss_${determinismHash.slice(0, 32)}`,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    source_forecast_id: sourceForecast?.forecast_id ?? "",
    source_forecast_ref: sourceForecast?.forecast_id ?? "",
    baseline_mode: "FORECAST_BASELINE",
    comparison_mode: "HYPOTHETICAL_IRRIGATION_OPTIONS",
    horizon_days: dailyForecast.length,
    root_zone_depth_cm: sourceForecast?.root_zone_depth_cm ?? 0,
    root_zone_available_water_capacity_mm: sourceForecast?.root_zone_available_water_capacity_mm ?? 0,
    baseline_summary: baselineSummary(sourceForecast),
    options: FIXED_SCENARIO_OPTIONS_V1.map((definition) => buildOption(definition, input, inputStatus, blockingReasons)),
    input_status: inputStatus,
    blocking_reasons: blockingReasons,
    calculation_inputs: {
      source_forecast_id: sourceForecast?.forecast_id ?? "",
      application_efficiency: input.application_efficiency,
    },
    derivation: {
      thresholds: AWF_THRESHOLDS_V1,
      model_version: ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_VERSION_V1,
      fixed_scenario_option_definitions: FIXED_SCENARIO_OPTIONS_V1,
    },
    confidence: {
      level: inputStatus === "COMPARABLE" ? "MEDIUM" : "LOW",
      score: inputStatus === "COMPARABLE" ? 0.75 : 0.1,
      basis: "deterministic_hypothetical_irrigation_comparison",
    },
    computed_at: input.computed_at,
    determinism_hash: determinismHash,
  };
}
