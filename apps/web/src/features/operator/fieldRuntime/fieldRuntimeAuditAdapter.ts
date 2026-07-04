// apps/web/src/features/operator/fieldRuntime/fieldRuntimeAuditAdapter.ts
// Purpose: build the H60-K Field Runtime Audit ViewModel from local route, source, contract, and boundary metadata.
// Boundary: this adapter is local-only; it performs no backend fetch and writes no objects.

export type FieldRuntimeAuditTabStatus = "available" | "not_enabled" | "reserved";

export type FieldRuntimeAuditTabRow = {
  tab: string;
  route: string;
  status: FieldRuntimeAuditTabStatus;
  phase: string;
  sourceContract: string;
  readOnly: true;
  productConclusionAllowed: false;
};

export type FieldRuntimeAuditSourceContractRow = {
  tab: string;
  readModel: string;
  fetcher: string;
  sourceContract: string;
  backendChangedByH60: false;
};

export type FieldRuntimeAuditBoundaryRow = {
  tab: string;
  noFactsWrite: true;
  noRecommendationCreation: true;
  noApproval: true;
  noDispatch: true;
  noAoActTask: true;
  noRoiWrite: true;
  noFieldMemoryWrite: true;
  noModelUpdate: true;
};

export type FieldRuntimeAuditLegacyRouteRow = {
  canonicalRoute: string;
  legacyRoute: string;
  strategy: "preserve_no_redirect";
};

export type FieldRuntimeTraceBridgeViewModel = {
  decisionCycleId: string;
  hasDecisionCycleId: boolean;
  traceReadbackPath: string;
  bridgeOnly: true;
};

export type FieldRuntimeAuditCompletionSummary = {
  h60D: "done";
  h60E: "done";
  h60F: "done";
  h60G: "done";
  h60H: "done";
  h60I: "done";
  health: "not_enabled_planned_h62";
  audit: "h60k";
};

export type FieldRuntimeAuditViewModel = {
  fieldId: string;
  source: "field_runtime_audit_v1";
  canonicalRouteFamily: "/operator/fields/*";
  legacyRouteFamily: "/operator/twin/fields/*";
  migratedTabs: FieldRuntimeAuditTabRow[];
  sourceContracts: FieldRuntimeAuditSourceContractRow[];
  boundaryMatrix: FieldRuntimeAuditBoundaryRow[];
  legacyRoutes: FieldRuntimeAuditLegacyRouteRow[];
  traceBridge: FieldRuntimeTraceBridgeViewModel;
  completionSummary: FieldRuntimeAuditCompletionSummary;
};

export type FieldRuntimeAuditLoadState = {
  status: "ready";
  audit: FieldRuntimeAuditViewModel;
};

function fieldRoute(fieldId: string, suffix = ""): string {
  const safeFieldId = fieldId || "not-selected";
  return suffix ? `/operator/fields/${safeFieldId}/${suffix}` : `/operator/fields/${safeFieldId}`;
}

function buildTraceBridge(decisionCycleId: string): FieldRuntimeTraceBridgeViewModel {
  const safeDecisionCycleId = String(decisionCycleId || "").trim();
  return {
    decisionCycleId: safeDecisionCycleId,
    hasDecisionCycleId: safeDecisionCycleId.length > 0,
    traceReadbackPath: safeDecisionCycleId ? `/operator/twin/traces/${encodeURIComponent(safeDecisionCycleId)}` : "",
    bridgeOnly: true,
  };
}

function buildBoundaryRow(tab: string): FieldRuntimeAuditBoundaryRow {
  return {
    tab,
    noFactsWrite: true,
    noRecommendationCreation: true,
    noApproval: true,
    noDispatch: true,
    noAoActTask: true,
    noRoiWrite: true,
    noFieldMemoryWrite: true,
    noModelUpdate: true,
  };
}

export function buildFieldRuntimeAudit(fieldId: string, decisionCycleId = ""): FieldRuntimeAuditLoadState {
  const safeFieldId = fieldId || "not-selected";
  const migratedTabs: FieldRuntimeAuditTabRow[] = [
    { tab: "Overview", route: fieldRoute(safeFieldId), status: "available", phase: "H60-D Overview / State", sourceContract: "operator_field_twin_workspace_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "State", route: fieldRoute(safeFieldId, "state"), status: "available", phase: "H60-D Overview / State", sourceContract: "operator_field_twin_workspace_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Evidence", route: fieldRoute(safeFieldId, "evidence"), status: "available", phase: "H60-E Evidence", sourceContract: "operator_field_twin_evidence_quality_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Forecast", route: fieldRoute(safeFieldId, "forecast"), status: "available", phase: "H60-F Forecast", sourceContract: "operator_field_twin_forecast_panel_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Scenario", route: fieldRoute(safeFieldId, "scenario"), status: "available", phase: "H60-G Scenario read-only split", sourceContract: "operator_field_twin_scenario_compare_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Residual", route: fieldRoute(safeFieldId, "residual"), status: "available", phase: "H60-H Residual / Verification", sourceContract: "operator_field_twin_post_irrigation_verification_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Calibration", route: fieldRoute(safeFieldId, "calibration"), status: "available", phase: "H60-I Calibration", sourceContract: "operator_field_twin_calibration_replay_v1", readOnly: true, productConclusionAllowed: false },
    { tab: "Health", route: fieldRoute(safeFieldId, "health"), status: "not_enabled", phase: "planned for H62", sourceContract: "not_enabled_planned_h62", readOnly: true, productConclusionAllowed: false },
    { tab: "Audit", route: fieldRoute(safeFieldId, "audit"), status: "available", phase: "H60-K", sourceContract: "field_runtime_audit_v1", readOnly: true, productConclusionAllowed: false },
  ];

  const sourceContracts: FieldRuntimeAuditSourceContractRow[] = [
    { tab: "Overview / State", readModel: "operator_field_twin_workspace_v1", fetcher: "fetchOperatorFieldTwinWorkspace", sourceContract: "operator_field_twin_workspace_v1", backendChangedByH60: false },
    { tab: "Evidence", readModel: "operator_field_twin_evidence_quality_v1", fetcher: "fetchOperatorFieldTwinEvidenceQuality", sourceContract: "operator_field_twin_evidence_quality_v1", backendChangedByH60: false },
    { tab: "Forecast", readModel: "operator_field_twin_forecast_panel_v1", fetcher: "fetchOperatorFieldTwinForecastPanel", sourceContract: "operator_field_twin_forecast_panel_v1 / forecast_window_v1", backendChangedByH60: false },
    { tab: "Scenario", readModel: "operator_field_twin_scenario_compare_v1", fetcher: "fetchOperatorFieldTwinScenarioCompare", sourceContract: "operator_field_twin_scenario_compare_v1 / scenario_compare_v1", backendChangedByH60: false },
    { tab: "Residual", readModel: "operator_field_twin_post_irrigation_verification_v1", fetcher: "fetchOperatorFieldTwinPostIrrigationVerification + fetchOperatorTwinH31H45Closure", sourceContract: "operator_field_twin_post_irrigation_verification_v1 / operator_twin_h31_h45_closure_v1", backendChangedByH60: false },
    { tab: "Calibration", readModel: "operator_field_twin_calibration_replay_v1", fetcher: "fetchOperatorFieldTwinCalibrationReplay", sourceContract: "operator_field_twin_calibration_replay_v1", backendChangedByH60: false },
    { tab: "Health", readModel: "not_enabled_planned_h62", fetcher: "none", sourceContract: "not_enabled_planned_h62", backendChangedByH60: false },
    { tab: "Audit", readModel: "field_runtime_audit_v1", fetcher: "none", sourceContract: "field_runtime_audit_v1", backendChangedByH60: false },
  ];

  const legacyRoutes: FieldRuntimeAuditLegacyRouteRow[] = [
    { canonicalRoute: fieldRoute(safeFieldId), legacyRoute: "/operator/twin/fields/:fieldId", strategy: "preserve_no_redirect" },
    { canonicalRoute: fieldRoute(safeFieldId, "forecast"), legacyRoute: "/operator/twin/fields/:fieldId/forecast", strategy: "preserve_no_redirect" },
    { canonicalRoute: fieldRoute(safeFieldId, "scenario"), legacyRoute: "/operator/twin/fields/:fieldId/scenarios", strategy: "preserve_no_redirect" },
    { canonicalRoute: fieldRoute(safeFieldId, "evidence"), legacyRoute: "/operator/twin/fields/:fieldId/evidence", strategy: "preserve_no_redirect" },
    { canonicalRoute: fieldRoute(safeFieldId, "calibration"), legacyRoute: "/operator/twin/fields/:fieldId/calibration", strategy: "preserve_no_redirect" },
    { canonicalRoute: fieldRoute(safeFieldId, "residual"), legacyRoute: "/operator/twin/fields/:fieldId/post-irrigation", strategy: "preserve_no_redirect" },
    { canonicalRoute: "/operator/twin/gateway-demo", legacyRoute: "/operator/twin/gateway-demo", strategy: "preserve_no_redirect" },
  ];

  return {
    status: "ready",
    audit: {
      fieldId: safeFieldId,
      source: "field_runtime_audit_v1",
      canonicalRouteFamily: "/operator/fields/*",
      legacyRouteFamily: "/operator/twin/fields/*",
      migratedTabs,
      sourceContracts,
      boundaryMatrix: migratedTabs.map((row) => buildBoundaryRow(row.tab)),
      legacyRoutes,
      traceBridge: buildTraceBridge(decisionCycleId),
      completionSummary: {
        h60D: "done",
        h60E: "done",
        h60F: "done",
        h60G: "done",
        h60H: "done",
        h60I: "done",
        health: "not_enabled_planned_h62",
        audit: "h60k",
      },
    },
  };
}
