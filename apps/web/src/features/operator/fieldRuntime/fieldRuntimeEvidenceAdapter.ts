// apps/web/src/features/operator/fieldRuntime/fieldRuntimeEvidenceAdapter.ts
// Purpose: map the existing read-only Operator Field Twin evidence quality response into the H60-E Field Runtime Evidence ViewModel.
// Boundary: this adapter reuses the existing evidence quality read model and does not create backend endpoints, facts, recommendations, or control actions.

import {
  fetchOperatorFieldTwinEvidenceQuality,
  type OperatorDataCoverageRow,
  type OperatorEvidenceTraceItem,
  type OperatorFieldTwinEvidenceQualityV1,
  type OperatorLowQualityReason,
  type OperatorTwinGap,
  type OperatorTwinRequestScope,
  type OperatorTwinSourceIndexInventoryRow,
} from "../../../api/operatorTwin";

export type FieldRuntimeEvidenceTraceItem = {
  stage: string;
  label: string;
  sourceTable: string;
  available: boolean;
  latestTsText: string;
  evidenceRefs: string[];
  qualityFlags: string[];
};

export type FieldRuntimeEvidenceCoverageRow = {
  metric: string;
  sourceTable: string;
  available: boolean;
  rowCount: number;
  latestTsText: string;
  gapNotes: string[];
  evidenceRefCount: number;
  qualityStatus: string;
};

export type FieldRuntimeEvidenceQualitySummary = {
  status: string;
  blockingReason: string;
  simulationDataPresent: boolean;
  officialDataQualified: boolean;
  lowQualityReasonCount: number;
};

export type FieldRuntimeSourceIndexRow = {
  sourceLabel: string;
  tableName: string;
  available: boolean;
  rowCount: number;
  missingReason: string;
  latestEvidenceRefs: string[];
};

export type FieldRuntimeEvidenceGap = {
  code: string;
  label: string;
  gapStatus: string;
};

export type FieldRuntimeLowQualityReason = {
  sourceTable: string;
  reason: string;
  evidenceRefs: string[];
  missingWindows: string[];
};

export type FieldRuntimeEvidenceViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_evidence_quality_v1";
  traceItems: FieldRuntimeEvidenceTraceItem[];
  coverageRows: FieldRuntimeEvidenceCoverageRow[];
  qualitySummary: FieldRuntimeEvidenceQualitySummary;
  sourceIndexes: FieldRuntimeSourceIndexRow[];
  lowQualityReasons: FieldRuntimeLowQualityReason[];
  dataGaps: FieldRuntimeEvidenceGap[];
  boundaryRules: string[];
};

export type FieldRuntimeEvidenceLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; evidence: FieldRuntimeEvidenceViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function tsText(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function tableLabel(tableName: string): string {
  const labels: Record<string, string> = {
    field_index_v1: "Field Index",
    water_state_estimate_index_v1: "Water State Estimate Index",
    soil_moisture_sensing_window_index_v1: "Soil Moisture Sensing Window Index",
    weather_forecast_index_v1: "Weather Forecast Index",
    irrigation_scenario_set_index_v1: "Irrigation Scenario Set Index",
    decision_recommendation_index_v1: "Decision Recommendation Index",
  };
  return labels[tableName] || tableName;
}

function mapTraceItem(item: OperatorEvidenceTraceItem): FieldRuntimeEvidenceTraceItem {
  return {
    stage: text(item.stage),
    label: text(item.label),
    sourceTable: text(item.source_table),
    available: item.available,
    latestTsText: tsText(item.latest_ts_ms),
    evidenceRefs: item.evidence_refs.filter(Boolean),
    qualityFlags: item.quality_flags.filter(Boolean),
  };
}

function mapCoverageRow(row: OperatorDataCoverageRow): FieldRuntimeEvidenceCoverageRow {
  return {
    metric: text(row.metric),
    sourceTable: text(row.source_table),
    available: row.available,
    rowCount: Number(row.row_count || 0),
    latestTsText: tsText(row.latest_ts_ms),
    gapNotes: [...row.missing_windows, ...row.quality_flags, row.confidence_penalty].filter(Boolean) as string[],
    evidenceRefCount: row.evidence_refs.filter(Boolean).length,
    qualityStatus: text(row.quality_status || row.confidence, "Not reported"),
  };
}

function mapSourceIndex(row: OperatorTwinSourceIndexInventoryRow): FieldRuntimeSourceIndexRow {
  return {
    sourceLabel: text(row.label, tableLabel(row.table_name)),
    tableName: text(row.table_name),
    available: row.available,
    rowCount: Number(row.row_count || 0),
    missingReason: text(row.missing_reason, "None"),
    latestEvidenceRefs: row.latest_evidence_refs.filter(Boolean),
  };
}

function mapLowQualityReason(reason: OperatorLowQualityReason): FieldRuntimeLowQualityReason {
  return {
    sourceTable: text(reason.source_table),
    reason: text(reason.reason),
    evidenceRefs: reason.evidence_refs.filter(Boolean),
    missingWindows: reason.missing_windows.filter(Boolean),
  };
}

function mapGap(gap: OperatorTwinGap, index: number): FieldRuntimeEvidenceGap {
  return {
    code: text(gap.gap_code, `gap_${index + 1}`),
    label: text(gap.label, "Unnamed evidence gap"),
    gapStatus: text(gap.severity, "INFO"),
  };
}

export function mapFieldRuntimeEvidence(evidence: OperatorFieldTwinEvidenceQualityV1): FieldRuntimeEvidenceViewModel {
  return {
    fieldId: evidence.field_context.field_id,
    fieldName: evidence.field_context.field_name,
    cropText: evidence.field_context.crop_text,
    source: "operator_field_twin_evidence_quality_v1",
    traceItems: evidence.evidence_trace_v1.trace_items.map(mapTraceItem),
    coverageRows: evidence.data_coverage_matrix_v1.rows.map(mapCoverageRow),
    qualitySummary: {
      status: text(evidence.quality_summary.status),
      blockingReason: text(evidence.quality_summary.blocking_reason, "None"),
      simulationDataPresent: evidence.quality_summary.simulation_data_present,
      officialDataQualified: evidence.quality_summary.official_data_qualified,
      lowQualityReasonCount: evidence.quality_summary.low_quality_reasons.length,
    },
    sourceIndexes: evidence.source_index_inventory.source_indexes.map(mapSourceIndex),
    lowQualityReasons: evidence.quality_summary.low_quality_reasons.map(mapLowQualityReason),
    dataGaps: evidence.data_gaps.map(mapGap),
    boundaryRules: evidence.boundary_rules.map((rule) => rule.label),
  };
}

export async function loadFieldRuntimeEvidence(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeEvidenceLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Evidence." };
  }

  try {
    const response = await fetchOperatorFieldTwinEvidenceQuality(safeFieldId, scope);
    return {
      status: "ready",
      evidence: mapFieldRuntimeEvidence(response.operator_field_twin_evidence_quality_v1),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_EVIDENCE_LOAD_FAILED",
    };
  }
}
