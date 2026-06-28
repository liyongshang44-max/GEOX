// apps/server/src/domain/twin_kernel/calibration_replay_v1.ts
// Purpose: build deterministic TK4 calibration_replay_v1 and forecast_error_v1 records from formal prior Twin Kernel objects.
// Boundary: this file calculates replay and error evidence only; it does not write learning candidates, Field Memory, ROI, recommendations, approvals, tasks, receipts, or decision cycles.

import { createHash } from "node:crypto";

export type CalibrationScenarioSetRowV1 = {
  scenario_set_id: string;
  forecast_run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  baseline_scenario_json: Record<string, unknown>;
  option_scenarios_json: Array<Record<string, unknown>>;
  determinism_hash: string;
};

export type CalibrationForecastRunRowV1 = {
  forecast_run_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string | Date;
  status: string;
  forecast_points_json: Array<Record<string, unknown>>;
  risk_timeline_json: Array<Record<string, unknown>>;
  determinism_hash: string;
};

export type CalibrationObservedPayloadV1 = {
  observed_at?: string;
  post_soil_moisture_percent?: number;
  observed_water_state?: string;
  verification_ref_id?: string;
  evidence_refs?: Array<Record<string, string>>;
};

export type CalibrationReplayV1 = {
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  selected_option_id: string | null;
  status: "CALIBRATION_REPLAY_READY" | "CALIBRATION_REPLAY_BLOCKED";
  input_refs_json: Record<string, unknown>;
  predicted_json: Record<string, unknown>;
  observed_json: Record<string, unknown>;
  error_summary_json: Record<string, unknown>;
  reason_candidates_json: Array<Record<string, unknown>>;
  evidence_refs_json: Array<Record<string, string>>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type ForecastErrorV1 = {
  forecast_error_id: string;
  calibration_replay_id: string;
  forecast_run_id: string;
  scenario_set_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  as_of_ts: string;
  error_metric: string;
  error_value: number | null;
  error_direction: "OVER_ESTIMATED_RESPONSE" | "UNDER_ESTIMATED_RESPONSE" | "NO_NUMERIC_OBSERVATION" | "BLOCKED";
  predicted_json: Record<string, unknown>;
  observed_json: Record<string, unknown>;
  evidence_refs_json: Array<Record<string, string>>;
  blocking_reasons_json: string[];
  determinism_hash: string;
};

export type BuildCalibrationReplayArgsV1 = {
  scenarioSet: CalibrationScenarioSetRowV1;
  forecastRun: CalibrationForecastRunRowV1;
  observed?: CalibrationObservedPayloadV1;
  selected_option_id?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
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

function lastForecastPoint(points: Array<Record<string, unknown>>): Record<string, unknown> {
  return points[points.length - 1] ?? {};
}

function selectScenario(scenarioSet: CalibrationScenarioSetRowV1, selectedOptionId: string | null): Record<string, unknown> {
  if (!selectedOptionId || selectedOptionId === "no_action") return scenarioSet.baseline_scenario_json;
  return scenarioSet.option_scenarios_json.find((option) => text(option.scenario_id) === selectedOptionId) ?? {};
}

function predictedMoistureFromScenario(scenario: Record<string, unknown>, forecastPoint: Record<string, unknown>): number | null {
  const modeledRisk = numberOrNull(scenario.modeled_max_risk_score) ?? numberOrNull(forecastPoint.risk_score);
  if (modeledRisk === null) return null;
  return Number((32 - modeledRisk * 20).toFixed(3));
}

function errorDirection(errorValue: number | null): ForecastErrorV1["error_direction"] {
  if (errorValue === null) return "NO_NUMERIC_OBSERVATION";
  if (errorValue > 0) return "OVER_ESTIMATED_RESPONSE";
  if (errorValue < 0) return "UNDER_ESTIMATED_RESPONSE";
  return "NO_NUMERIC_OBSERVATION";
}

function reasonCandidates(errorValue: number | null, blockingReasons: string[]): Array<Record<string, unknown>> {
  if (blockingReasons.length > 0) return [{ reason: "calibration_blocked", confidence: "HIGH", blocking_reasons: blockingReasons }];
  if (errorValue === null) return [{ reason: "missing_numeric_observation", confidence: "HIGH" }];
  const magnitude = Math.abs(errorValue);
  if (magnitude < 1) return [{ reason: "within_expected_uncertainty", confidence: "MEDIUM" }];
  return [
    { reason: "weather_forecast_error", confidence: "LOW" },
    { reason: "application_efficiency_lower_than_assumed", confidence: "LOW" },
    { reason: "sensor_gap_or_depth_mismatch", confidence: "LOW" },
  ];
}

export function buildCalibrationReplayAndForecastErrorV1(args: BuildCalibrationReplayArgsV1): { calibrationReplay: CalibrationReplayV1; forecastError: ForecastErrorV1 } {
  const scenarioSet = args.scenarioSet;
  const forecastRun = args.forecastRun;
  const observed = args.observed ?? {};
  const asOfTs = new Date(scenarioSet.as_of_ts).toISOString();
  const selectedOptionId = text(args.selected_option_id) || "no_action";
  const blockingReasons: string[] = [];
  if (scenarioSet.status !== "SCENARIO_SET_READY") blockingReasons.push("SCENARIO_SET_NOT_READY");
  if (forecastRun.status !== "FORECAST_READY") blockingReasons.push("FORECAST_NOT_READY");
  if (scenarioSet.forecast_run_id !== forecastRun.forecast_run_id) blockingReasons.push("FORECAST_SCENARIO_LINK_MISMATCH");
  if (!text(observed.observed_at)) blockingReasons.push("OBSERVED_AT_MISSING");
  if (numberOrNull(observed.post_soil_moisture_percent) === null) blockingReasons.push("POST_SOIL_MOISTURE_OBSERVATION_MISSING");
  const selectedScenario = selectScenario(scenarioSet, selectedOptionId);
  if (Object.keys(selectedScenario).length === 0) blockingReasons.push("SELECTED_SCENARIO_NOT_FOUND");
  const forecastPoint = lastForecastPoint(forecastRun.forecast_points_json);
  const predictedPercent = predictedMoistureFromScenario(selectedScenario, forecastPoint);
  if (predictedPercent === null) blockingReasons.push("PREDICTED_SOIL_MOISTURE_UNAVAILABLE");
  const observedPercent = numberOrNull(observed.post_soil_moisture_percent);
  const errorValue = predictedPercent !== null && observedPercent !== null ? Number((predictedPercent - observedPercent).toFixed(3)) : null;
  const inputRefs = {
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_set_id: scenarioSet.scenario_set_id,
    forecast_run_determinism_hash: forecastRun.determinism_hash,
    scenario_set_determinism_hash: scenarioSet.determinism_hash,
    selected_option_id: selectedOptionId,
  };
  const predictedJson = {
    selected_option_id: selectedOptionId,
    forecast_day: forecastPoint.day ?? null,
    predicted_water_state: forecastPoint.water_state ?? null,
    predicted_soil_moisture_percent: predictedPercent,
    selected_scenario_type: selectedScenario.scenario_type ?? null,
  };
  const observedJson = {
    observed_at: text(observed.observed_at) || null,
    observed_water_state: text(observed.observed_water_state) || null,
    post_soil_moisture_percent: observedPercent,
    verification_ref_id: text(observed.verification_ref_id) || null,
  };
  const errorSummary = {
    error_metric: "post_soil_moisture_percent_absolute_error",
    error_value: errorValue,
    error_direction: blockingReasons.length > 0 ? "BLOCKED" : errorDirection(errorValue),
    absolute_error: errorValue === null ? null : Math.abs(errorValue),
  };
  const evidenceRefs = Array.isArray(observed.evidence_refs) ? observed.evidence_refs : [];
  const reasons = reasonCandidates(errorValue, blockingReasons);
  const replayHashInput = {
    input_refs_json: inputRefs,
    predicted_json: predictedJson,
    observed_json: observedJson,
    error_summary_json: errorSummary,
    reason_candidates_json: reasons,
    evidence_refs_json: evidenceRefs,
    blocking_reasons_json: blockingReasons,
  };
  const replayHash = hashPayload(replayHashInput);
  const calibrationReplay: CalibrationReplayV1 = {
    calibration_replay_id: `cr_${replayHash.slice(0, 24)}`,
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_set_id: scenarioSet.scenario_set_id,
    tenant_id: scenarioSet.tenant_id,
    project_id: scenarioSet.project_id,
    group_id: scenarioSet.group_id,
    field_id: scenarioSet.field_id,
    as_of_ts: asOfTs,
    selected_option_id: selectedOptionId,
    status: blockingReasons.length === 0 ? "CALIBRATION_REPLAY_READY" : "CALIBRATION_REPLAY_BLOCKED",
    input_refs_json: inputRefs,
    predicted_json: predictedJson,
    observed_json: observedJson,
    error_summary_json: errorSummary,
    reason_candidates_json: reasons,
    evidence_refs_json: evidenceRefs,
    blocking_reasons_json: blockingReasons,
    determinism_hash: replayHash,
  };
  const errorHash = hashPayload({ calibration_replay_id: calibrationReplay.calibration_replay_id, error_summary_json: errorSummary, predicted_json: predictedJson, observed_json: observedJson, evidence_refs_json: evidenceRefs, blocking_reasons_json: blockingReasons });
  const forecastError: ForecastErrorV1 = {
    forecast_error_id: `fe_${errorHash.slice(0, 24)}`,
    calibration_replay_id: calibrationReplay.calibration_replay_id,
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_set_id: scenarioSet.scenario_set_id,
    tenant_id: scenarioSet.tenant_id,
    project_id: scenarioSet.project_id,
    group_id: scenarioSet.group_id,
    field_id: scenarioSet.field_id,
    as_of_ts: asOfTs,
    error_metric: "post_soil_moisture_percent_absolute_error",
    error_value: errorValue,
    error_direction: blockingReasons.length > 0 ? "BLOCKED" : errorDirection(errorValue),
    predicted_json: predictedJson,
    observed_json: observedJson,
    evidence_refs_json: evidenceRefs,
    blocking_reasons_json: blockingReasons,
    determinism_hash: errorHash,
  };
  return { calibrationReplay, forecastError };
}
