// apps/server/src/domain/twin_kernel/scenario_set_v1.ts
// Purpose: build a deterministic scenario_set_v1 from a persisted forecast_run_v1 row.
// Boundary: this file only derives comparable scenarios; it does not select, rank, recommend, approve, dispatch, execute, evaluate ROI, write Field Memory, calibrate, learn, or create decision cycles.

import { createHash } from "node:crypto";

export type ScenarioSetForecastRunRowV1 = {
  forecast_run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  horizon_days: number;
  model_version: string;
  status: string;
  forecast_points_json: Array<Record<string, unknown>>;
  risk_timeline_json: Array<Record<string, unknown>>;
  uncertainty_json: Record<string, unknown>;
  assumptions_json: Record<string, unknown>;
  determinism_hash: string;
};

export type ScenarioSetV1 = {
  scenario_set_id: string;
  forecast_run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  scenario_model_version: string;
  status: "SCENARIO_SET_READY" | "SCENARIO_SET_BLOCKED";
  input_refs_json: Record<string, unknown>;
  baseline_scenario_json: Record<string, unknown>;
  option_scenarios_json: Array<Record<string, unknown>>;
  comparison_axes_json: Array<Record<string, unknown>>;
  constraints_json: Record<string, unknown>;
  assumptions_json: Record<string, unknown>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildScenarioSetArgsV1 = {
  forecastRun: ScenarioSetForecastRunRowV1;
  scenario_model_version?: string;
};

const DEFAULT_SCENARIO_MODEL_VERSION = "twin_kernel_scenario_water_v1";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) output[key] = canonical(input[key]);
    return output;
  }
  return value;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function maxRiskScore(points: Array<Record<string, unknown>>): number {
  const scores = points.map((point) => numberOrNull(point.risk_score)).filter((value): value is number => value !== null);
  return scores.length ? Math.max(...scores) : 0;
}

function highRiskDays(timeline: Array<Record<string, unknown>>): number[] {
  return timeline.filter((item) => text(item.risk_level).toUpperCase() === "HIGH").map((item) => numberOrNull(item.day)).filter((value): value is number => value !== null);
}

function optionForWaterMm(waterMm: number, maxRisk: number, highDays: number[]): Record<string, unknown> {
  const riskDelta = clamp(waterMm / 120, 0.05, 0.35);
  return {
    scenario_id: `irrigation_${waterMm}mm`,
    scenario_type: "IRRIGATION_OPTION",
    action_intent: "IRRIGATION",
    water_mm: waterMm,
    target_window: {
      earliest_day: highDays[0] ?? 1,
      latest_day: highDays[0] ? Math.min(highDays[0] + 1, 7) : 2,
    },
    modeled_risk_delta: Number((-riskDelta).toFixed(3)),
    modeled_max_risk_score: Number(clamp(maxRisk - riskDelta, 0, 1).toFixed(3)),
    resource_use: {
      water_mm: waterMm,
    },
    decision_status: "NOT_DECIDED",
    task_payload_created: false,
    approval_created: false,
  };
}

export function buildScenarioSetV1(args: BuildScenarioSetArgsV1): ScenarioSetV1 {
  const forecast = args.forecastRun;
  const asOfTs = new Date(forecast.as_of_ts).toISOString();
  const scenarioModelVersion = args.scenario_model_version || DEFAULT_SCENARIO_MODEL_VERSION;
  const blockingReasons: string[] = [];
  if (forecast.status !== "FORECAST_READY") blockingReasons.push("FORECAST_NOT_READY");
  if (!forecast.forecast_run_id) blockingReasons.push("FORECAST_RUN_ID_MISSING");
  if (!Array.isArray(forecast.forecast_points_json) || forecast.forecast_points_json.length === 0) blockingReasons.push("FORECAST_POINTS_MISSING");
  if (!Array.isArray(forecast.risk_timeline_json) || forecast.risk_timeline_json.length === 0) blockingReasons.push("RISK_TIMELINE_MISSING");
  const maxRisk = maxRiskScore(forecast.forecast_points_json);
  const highDays = highRiskDays(forecast.risk_timeline_json);
  const baselineScenario = {
    scenario_id: "no_action",
    scenario_type: "NO_ACTION_BASELINE",
    action_intent: "NONE",
    water_mm: 0,
    modeled_max_risk_score: Number(maxRisk.toFixed(3)),
    high_risk_days: highDays,
    decision_status: "BASELINE_ONLY",
    task_payload_created: false,
    approval_created: false,
  };
  const optionWaterLevels = maxRisk >= 0.75 ? [10, 20, 30] : maxRisk >= 0.5 ? [10, 20] : [10];
  const optionScenarios = optionWaterLevels.map((waterMm) => optionForWaterMm(waterMm, maxRisk, highDays));
  const comparisonAxes = [
    { axis: "modeled_max_risk_score", direction: "lower_is_less_water_risk" },
    { axis: "water_mm", direction: "lower_is_less_resource_use" },
    { axis: "target_window", direction: "earlier_window_is_not_preferred_or_ranked" },
  ];
  const constraints = {
    option_count: optionScenarios.length,
    must_include_no_action_baseline: true,
    direct_task_creation_allowed: false,
    direct_approval_creation_allowed: false,
    direct_selection_allowed: false,
  };
  const inputRefs = {
    forecast_run_id: forecast.forecast_run_id,
    forecast_run_determinism_hash: forecast.determinism_hash,
    source_object_type: "forecast_run_v1",
  };
  const assumptions = {
    scenario_model_version: scenarioModelVersion,
    forecast_model_version: forecast.model_version,
    horizon_days: forecast.horizon_days,
    scenario_type: "water_management_only",
    no_action_baseline_required: true,
  };
  const hashInput = {
    forecast_run_id: forecast.forecast_run_id,
    forecast_run_determinism_hash: forecast.determinism_hash,
    as_of_ts: asOfTs,
    scenario_model_version: scenarioModelVersion,
    input_refs_json: inputRefs,
    baseline_scenario_json: baselineScenario,
    option_scenarios_json: optionScenarios,
    comparison_axes_json: comparisonAxes,
    constraints_json: constraints,
    assumptions_json: assumptions,
    blocking_reasons_json: blockingReasons,
  };
  const determinismHash = hashPayload(hashInput);
  return {
    scenario_set_id: `ss_${determinismHash.slice(0, 24)}`,
    forecast_run_id: forecast.forecast_run_id,
    tenant_id: forecast.tenant_id,
    project_id: forecast.project_id,
    group_id: forecast.group_id,
    field_id: forecast.field_id,
    as_of_ts: asOfTs,
    scenario_model_version: scenarioModelVersion,
    status: blockingReasons.length === 0 ? "SCENARIO_SET_READY" : "SCENARIO_SET_BLOCKED",
    input_refs_json: inputRefs,
    baseline_scenario_json: baselineScenario,
    option_scenarios_json: optionScenarios,
    comparison_axes_json: comparisonAxes,
    constraints_json: constraints,
    assumptions_json: assumptions,
    blocking_reasons_json: blockingReasons,
    determinism_hash: determinismHash,
  };
}
