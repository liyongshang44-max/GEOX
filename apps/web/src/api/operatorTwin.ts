// apps/web/src/api/operatorTwin.ts
// Purpose: fetch read-only Operator Twin Workbench projections.
// Boundary: this API client must not submit recommendations, approvals, dispatches, or AO-ACT tasks.

import { apiRequestWithPolicy, withQuery } from "./client";

export type OperatorTwinGap = {
  gap_code: string;
  label: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
};

export type OperatorTwinBoundaryRule = {
  rule_code: string;
  label: string;
};

export type OperatorTwinOverviewField = {
  field_id: string;
  field_name: string;
  crop_text: string;
  current_state_text: string;
  confidence_text: string;
  data_coverage_text: string;
  forecast_window_text: string;
  next_step_text: string;
  twin_href: string;
};

export type OperatorTwinOverviewV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_TWIN_OVERVIEW";
  fields: OperatorTwinOverviewField[];
  data_gaps: OperatorTwinGap[];
  boundary_rules: OperatorTwinBoundaryRule[];
  summary: {
    field_count: number;
    write_ready: boolean;
    approval_ready: boolean;
    dispatch_ready: boolean;
    task_creation_ready: boolean;
  };
};

export type OperatorTwinLayer = {
  layer: "Fact" | "Estimate" | "Forecast" | "Scenario" | "Recommendation";
  title: string;
  body: string;
  status: "AVAILABLE" | "LIMITED" | "NOT_AVAILABLE";
  evidence_refs: string[];
};

export type OperatorFieldTwinWorkspaceV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_FIELD_TWIN_WORKSPACE";
  field_context: {
    field_id: string;
    field_name: string;
    crop_text: string;
  };
  current_state: {
    state_text: string;
    confidence_text: string;
    classification: "Estimate";
    evidence_refs: string[];
  };
  data_coverage: {
    coverage_text: string;
    sensing_available: boolean;
    weather_available: boolean;
    evidence_refs: string[];
  };
  forecast_window: {
    available_horizon: string;
    forecast_horizon_limited: boolean;
    unavailable_horizons: string[];
    reason: string;
  };
  scenario_comparison: {
    no_action_baseline_present: boolean;
    options: Array<{
      option_id: string;
      label: string;
      risk_delta: string | null;
      confidence_text: string | null;
      failure_conditions: string[];
    }>;
    evidence_refs: string[];
  };
  recommendation_candidate: {
    recommendation_id: string | null;
    action_type: string | null;
    amount_mm: number | string | null;
    human_approval_required: boolean;
    no_direct_execution: boolean;
    evidence_refs: string[];
  };
  layers: OperatorTwinLayer[];
  data_gaps: OperatorTwinGap[];
  boundary_rules: OperatorTwinBoundaryRule[];
};

export type OperatorTwinOverviewResponse = {
  ok: boolean;
  source: "operator_twin_overview_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_twin_overview_v1: OperatorTwinOverviewV1;
};

export type OperatorFieldTwinWorkspaceResponse = {
  ok: boolean;
  source: "operator_field_twin_workspace_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_field_twin_workspace_v1: OperatorFieldTwinWorkspaceV1;
};

export async function fetchOperatorTwinOverview(): Promise<OperatorTwinOverviewResponse> {
  const response = await apiRequestWithPolicy<OperatorTwinOverviewResponse>(
    withQuery("/api/v1/operator/twin"),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_TWIN_OVERVIEW_API_FAILED");
  }

  return response.data;
}

export async function fetchOperatorFieldTwinWorkspace(fieldId: string): Promise<OperatorFieldTwinWorkspaceResponse> {
  const safeFieldId = encodeURIComponent(String(fieldId || "").trim());
  const response = await apiRequestWithPolicy<OperatorFieldTwinWorkspaceResponse>(
    withQuery("/api/v1/operator/twin/fields/" + safeFieldId),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_FIELD_TWIN_WORKSPACE_API_FAILED");
  }

  return response.data;
}
