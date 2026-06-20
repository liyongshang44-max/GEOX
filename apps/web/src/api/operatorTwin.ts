// apps/web/src/api/operatorTwin.ts
// Purpose: fetch scoped, read-only Operator Twin Workbench projections.
// Boundary: this API client must not submit recommendations, approvals, dispatches, or AO-ACT tasks.

import { apiRequestWithPolicy } from "./client";

export type OperatorTwinRequestScope = {
  tenant_id?: string | null;
  project_id?: string | null;
  group_id?: string | null;
};

export type OperatorTwinScopePolicy = {
  required: boolean;
  accepted_scope_keys: string[];
  scope_applied: boolean;
  missing_reason: string | null;
  index_tables: string[];
  field_scope_required?: boolean;
};

export type OperatorTwinGap = {
  gap_code: string;
  label: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
};

export type OperatorTwinBoundaryRule = {
  rule_code: string;
  label: string;
};

export type OperatorTwinSourceIndexInventoryRow = {
  table_name: string;
  label: string;
  available: boolean;
  row_count: number;
  latest_ts_ms: number | null;
  latest_evidence_refs: string[];
  scope_columns_present: string[];
  missing_reason: string | null;
};

export type OperatorTwinSourceIndexInventoryV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: OperatorTwinScopePolicy;
  source_indexes: OperatorTwinSourceIndexInventoryRow[];
  summary: {
    table_count: number;
    available_table_count: number;
    total_row_count: number;
    write_ready: false;
    approval_ready: false;
    dispatch_ready: false;
    task_creation_ready: false;
  };
  boundary_rules: OperatorTwinBoundaryRule[];
};

export type OperatorTwinOverviewField = {
  field_id: string;
  field_name: string;
  crop_text: string;
  current_state_text: string;
  risk_text: string;
  low_confidence: boolean;
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
  request_scope: OperatorTwinRequestScope;
  scope_policy: OperatorTwinScopePolicy;
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
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: OperatorTwinScopePolicy;
  field_context: {
    field_id: string;
    field_name: string;
    crop_text: string;
  };
  current_state: {
    state_text: string;
    risk_text: string;
    low_confidence: boolean;
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
    status: "AVAILABLE" | "NOT_AVAILABLE";
    unavailable_reason: string | null;
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


export type OperatorForecastRiskTimelineItem = {
  horizon: string;
  risk_text: string;
  confidence_text: string;
  evidence_refs: string[];
};

export type OperatorForecastWindowV1 = {
  available_horizon: string;
  forecast_horizon_limited: boolean;
  unavailable_horizons: string[];
  reason: string;
  evidence_refs: string[];
  risk_timeline: OperatorForecastRiskTimelineItem[];
};

export type OperatorFieldTwinForecastPanelV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_FIELD_TWIN_FORECAST_PANEL";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: OperatorTwinScopePolicy;
  field_context: {
    field_id: string;
    field_name: string;
    crop_text: string;
  };
  forecast_window_v1: OperatorForecastWindowV1;
  data_gaps: OperatorTwinGap[];
  boundary_rules: OperatorTwinBoundaryRule[];
};


export type OperatorScenarioCompareOption = {
  option_id: string;
  label: string;
  risk_delta: string | null;
  confidence_text: string | null;
  failure_conditions: string[];
};

export type OperatorScenarioCompareV1 = {
  no_action_baseline_present: boolean;
  options: OperatorScenarioCompareOption[];
  evidence_refs: string[];
  status: "AVAILABLE" | "NOT_AVAILABLE";
  unavailable_reason: string | null;
};

export type OperatorFieldTwinScenarioCompareV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_FIELD_TWIN_SCENARIO_COMPARE";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: OperatorTwinScopePolicy;
  field_context: {
    field_id: string;
    field_name: string;
    crop_text: string;
  };
  scenario_compare_v1: OperatorScenarioCompareV1;
  data_gaps: OperatorTwinGap[];
  boundary_rules: OperatorTwinBoundaryRule[];
};

export type OperatorEvidenceTraceItem = {
  stage: "Fact" | "Estimate" | "Forecast" | "Scenario" | "Recommendation" | string;
  label: string;
  source_table: string;
  available: boolean;
  latest_ts_ms: number | null;
  evidence_refs: string[];
  quality_flags: string[];
};

export type OperatorDataCoverageRow = {
  metric: string;
  source_table: string;
  available: boolean;
  row_count: number;
  latest_ts_ms: number | null;
  coverage_ratio: number | null;
  max_gap_ms: number | null;
  actual_points?: number | null;
  expected_points?: number | null;
  quality_status?: string | null;
  confidence?: string | null;
  coverage_details?: {
    coverage_ratio: number | null;
    max_gap_ms: number | null;
    actual_points: number | null;
    expected_points: number | null;
    quality_status: string | null;
    confidence: string | null;
  } | null;
  missing_windows: string[];
  quality_flags: string[];
  confidence_penalty: string | null;
  evidence_refs: string[];
};

export type OperatorLowQualityReason = {
  source_table: string;
  reason: string;
  evidence_refs: string[];
  missing_windows: string[];
};

export type OperatorQualitySummary = {
  status: "AVAILABLE" | "LIMITED" | "BLOCKING" | string;
  blocking_reason: string | null;
  low_quality_reasons: OperatorLowQualityReason[];
  simulation_data_present: boolean;
  official_data_qualified: boolean;
};

export type OperatorFieldTwinEvidenceQualityV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_FIELD_TWIN_EVIDENCE_QUALITY";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: OperatorTwinScopePolicy;
  field_context: { field_id: string; field_name: string; crop_text: string };
  evidence_trace_v1: { trace_items: OperatorEvidenceTraceItem[] };
  data_coverage_matrix_v1: { rows: OperatorDataCoverageRow[] };
  quality_summary: OperatorQualitySummary;
  source_index_inventory: OperatorTwinSourceIndexInventoryV1;
  data_gaps: OperatorTwinGap[];
  boundary_rules: OperatorTwinBoundaryRule[];
};

export type OperatorTwinSourceIndexInventoryResponse = {
  ok: boolean;
  source: "operator_twin_source_index_inventory_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_twin_source_index_inventory_v1: OperatorTwinSourceIndexInventoryV1;
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


export type OperatorFieldTwinForecastPanelResponse = {
  ok: boolean;
  source: "operator_field_twin_forecast_panel_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_field_twin_forecast_panel_v1: OperatorFieldTwinForecastPanelV1;
};


export type OperatorFieldTwinScenarioCompareResponse = {
  ok: boolean;
  source: "operator_field_twin_scenario_compare_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_field_twin_scenario_compare_v1: OperatorFieldTwinScenarioCompareV1;
};

export type OperatorFieldTwinEvidenceQualityResponse = {
  ok: boolean;
  source: "operator_field_twin_evidence_quality_api";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  operator_field_twin_evidence_quality_v1: OperatorFieldTwinEvidenceQualityV1;
};

function cleanScopeValue(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function buildOperatorTwinScopeQuery(scope?: OperatorTwinRequestScope | null): string {
  const params = new URLSearchParams();

  const tenantId = cleanScopeValue(scope?.tenant_id);
  const projectId = cleanScopeValue(scope?.project_id);
  const groupId = cleanScopeValue(scope?.group_id);

  if (tenantId) params.set("tenant_id", tenantId);
  if (projectId) params.set("project_id", projectId);
  if (groupId) params.set("group_id", groupId);

  const query = params.toString();
  return query ? "?" + query : "";
}

function withScope(path: string, scope?: OperatorTwinRequestScope | null): string {
  return path + buildOperatorTwinScopeQuery(scope);
}

export async function fetchOperatorTwinSourceIndexInventory(
  scope?: OperatorTwinRequestScope | null
): Promise<OperatorTwinSourceIndexInventoryResponse> {
  const response = await apiRequestWithPolicy<OperatorTwinSourceIndexInventoryResponse>(
    withScope("/api/v1/operator/twin/source-indexes", scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_TWIN_SOURCE_INDEX_INVENTORY_API_FAILED");
  }

  return response.data;
}

export async function fetchOperatorTwinOverview(scope?: OperatorTwinRequestScope | null): Promise<OperatorTwinOverviewResponse> {
  const response = await apiRequestWithPolicy<OperatorTwinOverviewResponse>(
    withScope("/api/v1/operator/twin", scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_TWIN_OVERVIEW_API_FAILED");
  }

  return response.data;
}

export async function fetchOperatorFieldTwinWorkspace(
  fieldId: string,
  scope?: OperatorTwinRequestScope | null
): Promise<OperatorFieldTwinWorkspaceResponse> {
  const safeFieldId = encodeURIComponent(String(fieldId || "").trim());
  const response = await apiRequestWithPolicy<OperatorFieldTwinWorkspaceResponse>(
    withScope("/api/v1/operator/twin/fields/" + safeFieldId, scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_FIELD_TWIN_WORKSPACE_API_FAILED");
  }

  return response.data;
}


export async function fetchOperatorFieldTwinEvidenceQuality(
  fieldId: string,
  scope?: OperatorTwinRequestScope | null
): Promise<OperatorFieldTwinEvidenceQualityResponse> {
  const safeFieldId = encodeURIComponent(String(fieldId || "").trim());
  const response = await apiRequestWithPolicy<OperatorFieldTwinEvidenceQualityResponse>(
    withScope("/api/v1/operator/twin/fields/" + safeFieldId + "/evidence", scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_FIELD_TWIN_EVIDENCE_QUALITY_API_FAILED");
  }

  return response.data;
}

export async function fetchOperatorFieldTwinForecastPanel(
  fieldId: string,
  scope?: OperatorTwinRequestScope | null
): Promise<OperatorFieldTwinForecastPanelResponse> {
  const safeFieldId = encodeURIComponent(String(fieldId || "").trim());
  const response = await apiRequestWithPolicy<OperatorFieldTwinForecastPanelResponse>(
    withScope("/api/v1/operator/twin/fields/" + safeFieldId + "/forecast", scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_FIELD_TWIN_FORECAST_PANEL_API_FAILED");
  }

  return response.data;
}


export async function fetchOperatorFieldTwinScenarioCompare(
  fieldId: string,
  scope?: OperatorTwinRequestScope | null
): Promise<OperatorFieldTwinScenarioCompareResponse> {
  const safeFieldId = encodeURIComponent(String(fieldId || "").trim());
  const response = await apiRequestWithPolicy<OperatorFieldTwinScenarioCompareResponse>(
    withScope("/api/v1/operator/twin/fields/" + safeFieldId + "/scenarios", scope),
    undefined,
    { dedupe: true, silent: true, timeoutMs: 10000 }
  );

  if (!response.ok || !response.data) {
    throw new Error("OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_API_FAILED");
  }

  return response.data;
}
