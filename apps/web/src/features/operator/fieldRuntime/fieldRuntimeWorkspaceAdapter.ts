// apps/web/src/features/operator/fieldRuntime/fieldRuntimeWorkspaceAdapter.ts
// Purpose: map the existing read-only Operator Field Twin workspace response into H60-D Field Runtime Overview and State ViewModels.
// Boundary: this adapter reuses the existing workspace read model, changes no backend response, and creates no new estimates or conclusions.

import {
  fetchOperatorFieldTwinWorkspace,
  type OperatorFieldTwinWorkspaceV1,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";
import {
  type FieldRuntimeCoverageSummaryViewModel,
  type FieldRuntimeDataGapViewModel,
  type FieldRuntimeEvidenceSummaryViewModel,
  type FieldRuntimeOverviewViewModel,
  type FieldRuntimeStateViewModel,
  type FieldRuntimeStateVectorItem,
  type FieldRuntimeSummaryCard,
} from "./fieldRuntimeViewModel";

export type FieldRuntimeWorkspaceLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; overview: FieldRuntimeOverviewViewModel; state: FieldRuntimeStateViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function boolAvailability(value: boolean): string {
  return value ? "available" : "limited";
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function collectEvidenceRefs(workspace: OperatorFieldTwinWorkspaceV1): string[] {
  return uniqueRefs([
    ...workspace.current_state.evidence_refs,
    ...workspace.data_coverage.evidence_refs,
    ...workspace.scenario_comparison.evidence_refs,
    ...workspace.recommendation_candidate.evidence_refs,
    ...workspace.layers.flatMap((layer) => layer.evidence_refs),
  ]);
}

function mapEvidenceSummary(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeEvidenceSummaryViewModel {
  const evidenceRefs = collectEvidenceRefs(workspace);
  return {
    source: "operator_field_twin_workspace_v1",
    evidenceRefs,
    evidenceRefCount: evidenceRefs.length,
    summaryText: evidenceRefs.length > 0 ? `${evidenceRefs.length} evidence refs from workspace summary` : "No evidence refs returned by workspace summary",
  };
}

function mapCoverageSummary(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeCoverageSummaryViewModel {
  return {
    source: "operator_field_twin_workspace_v1",
    coverageText: text(workspace.data_coverage.coverage_text),
    sensingAvailable: workspace.data_coverage.sensing_available,
    weatherAvailable: workspace.data_coverage.weather_available,
    forecastWindow: text(workspace.forecast_window.available_horizon),
    unavailableWindows: workspace.forecast_window.unavailable_horizons,
    reason: text(workspace.forecast_window.reason),
    evidenceRefCount: uniqueRefs(workspace.data_coverage.evidence_refs).length,
  };
}

function mapDataGaps(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeDataGapViewModel[] {
  return workspace.data_gaps.map((gap, index) => ({
    gapCode: text(gap.gap_code, `gap_${index + 1}`),
    label: text(gap.label, "Unnamed gap"),
    severityLabel: text(gap.severity, "INFO"),
  }));
}

function mapOverviewSummaryCards(workspace: OperatorFieldTwinWorkspaceV1, evidenceSummary: FieldRuntimeEvidenceSummaryViewModel, coverageSummary: FieldRuntimeCoverageSummaryViewModel, dataGaps: FieldRuntimeDataGapViewModel[]): FieldRuntimeSummaryCard[] {
  return [
    {
      label: "Field",
      value: text(workspace.field_context.field_name, workspace.field_context.field_id),
      detail: `fieldId: ${workspace.field_context.field_id}`,
    },
    {
      label: "Crop",
      value: text(workspace.field_context.crop_text),
    },
    {
      label: "State Summary",
      value: text(workspace.current_state.state_text),
      detail: text(workspace.current_state.confidence_text),
    },
    {
      label: "Evidence Summary",
      value: `${evidenceSummary.evidenceRefCount} refs`,
      detail: evidenceSummary.summaryText,
    },
    {
      label: "Coverage Summary",
      value: coverageSummary.coverageText,
      detail: `sensing: ${boolAvailability(coverageSummary.sensingAvailable)} · weather: ${boolAvailability(coverageSummary.weatherAvailable)}`,
    },
    {
      label: "Data Gaps",
      value: dataGaps.length > 0 ? `${dataGaps.length} gaps` : "No workspace gaps returned",
    },
  ];
}

function mapStateVectorItems(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeStateVectorItem[] {
  return [
    {
      label: "State Summary",
      value: text(workspace.current_state.state_text),
      confidenceLabel: text(workspace.current_state.confidence_text),
      evidenceRefCount: workspace.current_state.evidence_refs.length,
    },
    {
      label: "Classification",
      value: text(workspace.current_state.classification),
      evidenceRefCount: workspace.current_state.evidence_refs.length,
    },
    {
      label: "Confidence",
      value: text(workspace.current_state.confidence_text),
      confidenceLabel: workspace.current_state.low_confidence ? "low confidence" : "confidence ok",
      evidenceRefCount: workspace.current_state.evidence_refs.length,
    },
  ];
}

function mapOverview(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeOverviewViewModel {
  const evidenceSummary = mapEvidenceSummary(workspace);
  const coverageSummary = mapCoverageSummary(workspace);
  const dataGaps = mapDataGaps(workspace);
  return {
    fieldId: workspace.field_context.field_id,
    fieldName: workspace.field_context.field_name,
    cropText: workspace.field_context.crop_text,
    source: "operator_field_twin_workspace_v1",
    loaded: true,
    summaryCards: mapOverviewSummaryCards(workspace, evidenceSummary, coverageSummary, dataGaps),
    evidenceSummaryAvailable: evidenceSummary.evidenceRefCount > 0,
    coverageSummaryAvailable: true,
    dataGapSummaryAvailable: dataGaps.length > 0,
    evidenceSummary,
    coverageSummary,
    dataGaps,
    boundaryRules: workspace.boundary_rules.map((rule) => rule.label),
  };
}

function mapState(workspace: OperatorFieldTwinWorkspaceV1): FieldRuntimeStateViewModel {
  return {
    fieldId: workspace.field_context.field_id,
    fieldName: workspace.field_context.field_name,
    source: "operator_field_twin_workspace_v1",
    loaded: true,
    stateVectorItems: mapStateVectorItems(workspace),
    evidenceRefs: uniqueRefs(workspace.current_state.evidence_refs),
    boundaryCopy: [
      "State content is derived from the existing read-only Operator Field Twin workspace.",
      "source: operator_field_twin_workspace_v1",
      "No new state estimate is generated in the Field Runtime frontend.",
      "Confidence is displayed as workspace metadata, not as an agronomic recommendation.",
    ],
  };
}

export function mapFieldRuntimeWorkspaceOverview(workspace: OperatorFieldTwinWorkspaceV1): { overview: FieldRuntimeOverviewViewModel; state: FieldRuntimeStateViewModel } {
  return {
    overview: mapOverview(workspace),
    state: mapState(workspace),
  };
}

export async function loadFieldRuntimeWorkspaceOverview(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeWorkspaceLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Overview or State." };
  }

  try {
    const response = await fetchOperatorFieldTwinWorkspace(safeFieldId, scope);
    const mapped = mapFieldRuntimeWorkspaceOverview(response.operator_field_twin_workspace_v1);
    return { status: "ready", overview: mapped.overview, state: mapped.state };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_WORKSPACE_OVERVIEW_LOAD_FAILED",
    };
  }
}
