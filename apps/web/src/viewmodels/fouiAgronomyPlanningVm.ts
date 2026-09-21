import type {
  OperatorFieldTwinWorkspaceV1,
  OperatorScenarioCompareV1,
  OperatorTwinOverviewField,
} from "../api/operatorTwin";

export type AgronomyPlanningFieldContextV1 = {
  field_id: string;
  field_name: string;
  crop_text: string;
  current_state_text: string;
  risk_text: string;
  confidence_text: string;
  data_coverage_text: string;
  forecast_window_text: string;
  next_step_text: string;
};

export type AgronomyCapabilityStatusV1 = "AVAILABLE" | "ON_DEMAND" | "SPECIALIST_ROUTE" | "NOT_AUTHORIZED_HERE";

export type AgronomyCapabilityV1 = {
  key: "FIELD_CONTEXT" | "SCENARIO_COMPARE" | "PLANNING_WORKSPACE" | "RECOMMENDATION_REVIEW" | "ADR_DECISION_RESULT";
  label: string;
  status: AgronomyCapabilityStatusV1;
  reason: string;
};

export function buildAgronomyFieldContextV1(field: OperatorTwinOverviewField): AgronomyPlanningFieldContextV1 {
  return {
    field_id: field.field_id,
    field_name: field.field_name,
    crop_text: field.crop_text,
    current_state_text: field.current_state_text,
    risk_text: field.risk_text,
    confidence_text: field.confidence_text,
    data_coverage_text: field.data_coverage_text,
    forecast_window_text: field.forecast_window_text,
    next_step_text: field.next_step_text,
  };
}

export function agronomyCapabilitiesV1(): AgronomyCapabilityV1[] {
  return [
    {
      key: "FIELD_CONTEXT",
      label: "Field agronomic context",
      status: "AVAILABLE",
      reason: "Uses the existing read-only Operator Twin projection.",
    },
    {
      key: "SCENARIO_COMPARE",
      label: "Scenario comparison",
      status: "ON_DEMAND",
      reason: "Read-only Operator Twin scenario comparison is loaded only when requested.",
    },
    {
      key: "PLANNING_WORKSPACE",
      label: "Season & crop planning",
      status: "SPECIALIST_ROUTE",
      reason: "Existing /programs workspace remains separate and keeps its own authorization boundary.",
    },
    {
      key: "RECOMMENDATION_REVIEW",
      label: "Recommendation review",
      status: "SPECIALIST_ROUTE",
      reason: "Existing /agronomy/recommendations workspace requires its own recommendation.read authority.",
    },
    {
      key: "ADR_DECISION_RESULT",
      label: "ADR DecisionResult",
      status: "NOT_AUTHORIZED_HERE",
      reason: "Authoritative ADR Product Projection is not established on this surface.",
    },
  ];
}

export function workspaceAgronomyFactsV1(workspace: OperatorFieldTwinWorkspaceV1 | null): Array<{ label: string; value: string }> {
  if (!workspace) return [];
  return [
    { label: "Current state", value: workspace.current_state.state_text || "—" },
    { label: "Risk", value: workspace.current_state.risk_text || "—" },
    { label: "Confidence", value: workspace.current_state.confidence_text || "—" },
    { label: "Data coverage", value: workspace.data_coverage.coverage_text || "—" },
    { label: "Forecast horizon", value: workspace.forecast_window.available_horizon || "—" },
    { label: "Forecast limitation", value: workspace.forecast_window.reason || "—" },
  ];
}

export function scenarioFactsV1(scenario: OperatorScenarioCompareV1 | null): {
  status: string;
  no_action_baseline_present: boolean;
  option_count: number;
  unavailable_reason: string | null;
} {
  if (!scenario) return {
    status: "NOT_LOADED",
    no_action_baseline_present: false,
    option_count: 0,
    unavailable_reason: null,
  };
  return {
    status: scenario.status,
    no_action_baseline_present: scenario.no_action_baseline_present,
    option_count: scenario.options.length,
    unavailable_reason: scenario.unavailable_reason,
  };
}
