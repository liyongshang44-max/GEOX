// apps/server/src/domain/soil_water/root_zone_scenario_recommendation_submission_builder_v1.ts
// Purpose: purely transform a selected H34 root-zone irrigation scenario option into an operator submission and recommendation candidate payload.
// Boundary: pure domain builder only; no database access, fact writes, projection writes, routes, environment reads, wall-clock reads, or random values.

import type { RootZoneIrrigationScenarioSetPayloadV1 } from "./root_zone_irrigation_scenario_builder_v1.js";

export type RootZoneScenarioRecommendationSubmissionStatusV1 =
  | "SUBMITTED_TO_RECOMMENDATION"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_SCENARIO_NOT_FOUND"
  | "REJECTED_OPTION_NOT_FOUND"
  | "REJECTED_NO_ACTION"
  | "REJECTED_NOT_COMPARABLE"
  | "REJECTED_EVIDENCE_BLOCKING"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type RootZoneScenarioDecisionRecommendationPayloadV1 = Record<string, unknown>;

export type OperatorRootZoneScenarioRecommendationSubmissionPayloadV1 = {
  version: "v1";
  surface: "OPERATOR";
  submission_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  operator_id: string;
  idempotency_key: string;
  submission_reason: string;
  scenario_source_type: "ROOT_ZONE_IRRIGATION_SCENARIO_SET_V1";
  scenario_set_id: string;
  selected_option_id: string;
  source_forecast_id: string;
  source_forecast_ref: string;
  recommendation_id: string | null;
  recommendation_fact_id: string | null;
  status: RootZoneScenarioRecommendationSubmissionStatusV1;
  approval_created: false;
  operation_plan_created: false;
  task_created: false;
  dispatch_created: false;
  roi_created: false;
  field_memory_created: false;
  human_approval_required: true;
  no_direct_execution: true;
  evidence_refs: string[];
  selected_option_summary: Record<string, unknown> | null;
  decision_recommendation_v1: RootZoneScenarioDecisionRecommendationPayloadV1 | null;
  boundary_rules: Array<{ rule_code: string; label: string }>;
  created_at: string;
};

export type RootZoneScenarioRecommendationSubmissionInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  scenarioSet: RootZoneIrrigationScenarioSetPayloadV1 | null | undefined;
  selected_option_id: string;
  operator_id: string;
  idempotency_key: string;
  submission_reason: string;
  submission_id: string;
  recommendation_id: string;
  created_at: string;
};

const BOUNDARY_RULES = [
  { rule_code: "CANDIDATE_ONLY", label: "Creates a recommendation candidate only." },
  { rule_code: "HUMAN_APPROVAL_REQUIRED", label: "Human approval is required before execution." },
  { rule_code: "NO_DOWNSTREAM_WRITES", label: "Does not create approval, plan, task, dispatch, ROI, or field memory." },
];

function trim(value: unknown): string {
  return String(value ?? "").trim();
}

function evidenceRefs(scenarioSet: RootZoneIrrigationScenarioSetPayloadV1): string[] {
  const refs = scenarioSet.derivation?.evidence_refs;
  return Array.isArray(refs) ? [...new Set(refs.map(trim).filter(Boolean))] : [];
}

function base(input: RootZoneScenarioRecommendationSubmissionInputV1, status: RootZoneScenarioRecommendationSubmissionStatusV1): OperatorRootZoneScenarioRecommendationSubmissionPayloadV1 {
  return {
    version: "v1",
    surface: "OPERATOR",
    submission_id: trim(input.submission_id),
    tenant_id: trim(input.tenant_id),
    project_id: trim(input.project_id),
    group_id: trim(input.group_id),
    field_id: trim(input.field_id),
    zone_id: trim(input.zone_id),
    operator_id: trim(input.operator_id),
    idempotency_key: trim(input.idempotency_key),
    submission_reason: trim(input.submission_reason),
    scenario_source_type: "ROOT_ZONE_IRRIGATION_SCENARIO_SET_V1",
    scenario_set_id: trim(input.scenarioSet?.scenario_set_id),
    selected_option_id: trim(input.selected_option_id),
    source_forecast_id: trim(input.scenarioSet?.source_forecast_id),
    source_forecast_ref: trim(input.scenarioSet?.source_forecast_ref),
    recommendation_id: null,
    recommendation_fact_id: null,
    status,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
    human_approval_required: true,
    no_direct_execution: true,
    evidence_refs: [],
    selected_option_summary: null,
    decision_recommendation_v1: null,
    boundary_rules: BOUNDARY_RULES,
    created_at: trim(input.created_at),
  };
}

export function buildRootZoneScenarioRecommendationSubmissionV1(input: RootZoneScenarioRecommendationSubmissionInputV1): OperatorRootZoneScenarioRecommendationSubmissionPayloadV1 {
  if (![input.tenant_id, input.project_id, input.group_id, input.field_id, input.zone_id, input.operator_id, input.idempotency_key, input.submission_reason].every((value) => trim(value))) {
    return base(input, "REJECTED_INVALID_INPUT");
  }
  const scenarioSet = input.scenarioSet;
  if (!scenarioSet || scenarioSet.input_status !== "COMPARABLE") return base(input, "REJECTED_SCENARIO_NOT_FOUND");
  if (["tenant_id", "project_id", "group_id", "field_id", "zone_id"].some((key) => trim((scenarioSet as any)[key]) !== trim((input as any)[key]))) {
    return base(input, "REJECTED_SCOPE_MISMATCH");
  }
  const option = scenarioSet.options.find((candidate) => candidate.option_id === input.selected_option_id);
  if (!option) return base(input, "REJECTED_OPTION_NOT_FOUND");
  if (input.selected_option_id === "NO_ACTION" || option.action_type === "NO_ACTION") return base(input, "REJECTED_NO_ACTION");
  if (option.quality.status !== "COMPARABLE") return base(input, "REJECTED_NOT_COMPARABLE");
  const refs = evidenceRefs(scenarioSet);
  if (refs.length === 0 || !trim(scenarioSet.source_forecast_id) || !trim(scenarioSet.source_forecast_ref)) return base(input, "REJECTED_EVIDENCE_BLOCKING");

  const timing = option.irrigation_events.some((event) => event.day_index === 3) ? "DAY3" : "DAY0";
  const selectedSummary = {
    action_type: option.action_type,
    total_irrigation_mm: option.option_summary.total_irrigation_mm,
    total_effective_irrigation_mm: option.option_summary.total_effective_irrigation_mm,
    stress_days_delta_vs_baseline: option.comparison.stress_days_delta_vs_baseline,
    limited_days_delta_vs_baseline: option.comparison.limited_days_delta_vs_baseline,
    min_awf_delta_vs_baseline: option.comparison.min_awf_delta_vs_baseline,
  };
  const recommendation = {
    version: "v1",
    recommendation_id: trim(input.recommendation_id),
    tenant_id: trim(input.tenant_id),
    project_id: trim(input.project_id),
    group_id: trim(input.group_id),
    field_id: trim(input.field_id),
    zone_id: trim(input.zone_id),
    source: "ROOT_ZONE_SCENARIO_SELECTION",
    source_scenario_set_id: scenarioSet.scenario_set_id,
    source_option_id: option.option_id,
    source_forecast_id: scenarioSet.source_forecast_id,
    source_submission_id: trim(input.submission_id),
    status: "CANDIDATE",
    human_approval_required: true,
    no_direct_execution: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
    recommendation_kind: "IRRIGATION_CANDIDATE_FROM_SCENARIO",
    proposed_action: { action_type: option.action_type, total_irrigation_mm: option.option_summary.total_irrigation_mm, total_effective_irrigation_mm: option.option_summary.total_effective_irrigation_mm, timing },
    source_option_summary: { stress_days_delta_vs_baseline: option.comparison.stress_days_delta_vs_baseline, limited_days_delta_vs_baseline: option.comparison.limited_days_delta_vs_baseline, min_awf_delta_vs_baseline: option.comparison.min_awf_delta_vs_baseline, first_stress_date: option.option_summary.first_stress_date, stress_day_count: option.option_summary.stress_day_count, limited_day_count: option.option_summary.limited_day_count },
    evidence_refs: refs,
    derivation: { scenario_derived: true, scenario_layer: "ROOT_ZONE_IRRIGATION_SCENARIO_SET_V1", no_direct_execution: true, requires_human_approval: true, auto_selected: false },
    quality: { selected_option_quality_status: "COMPARABLE", evidence_quality_blocking: false },
    created_at: trim(input.created_at),
  };
  return { ...base(input, "SUBMITTED_TO_RECOMMENDATION"), scenario_set_id: scenarioSet.scenario_set_id, source_forecast_id: scenarioSet.source_forecast_id, source_forecast_ref: scenarioSet.source_forecast_ref, recommendation_id: trim(input.recommendation_id), evidence_refs: refs, selected_option_summary: selectedSummary, decision_recommendation_v1: recommendation };
}
