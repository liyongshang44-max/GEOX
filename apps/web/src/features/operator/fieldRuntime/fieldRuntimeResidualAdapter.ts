// apps/web/src/features/operator/fieldRuntime/fieldRuntimeResidualAdapter.ts
// Purpose: map existing read-only post-irrigation verification and H31-H45 closure responses into the H60-H Field Runtime Residual ViewModel.
// Boundary: this adapter reads verification data only and does not create recommendations, ROI, Field Memory, tasks, or control actions.

import {
  fetchOperatorFieldTwinPostIrrigationVerification,
  type OperatorExecutionEvidence,
  type OperatorFieldTwinPostIrrigationVerificationV1,
  type OperatorIrrigationResponseDelta,
  type OperatorIrrigationStateSnapshot,
  type OperatorTwinGap,
  type OperatorTwinRequestScope,
  type OperatorZoneResponseMatrix,
} from "../../../api/operatorTwin";
import {
  fetchOperatorTwinH31H45Closure,
  type OperatorTwinH31H45ClosureV1,
} from "../../../api/operatorTwinClosure";

export type FieldRuntimeStateSnapshotViewModel = {
  available: boolean | null;
  observedAt: string;
  soilMoistureValue: string;
  waterState: string;
};

export type FieldRuntimeVerificationSummaryViewModel = {
  statusText: string;
  reasonText: string;
  verificationId: string;
  classTransitionText: string;
  fieldMemoryCandidate: boolean;
  roiCandidate: boolean;
  writeReadyMetadata: boolean;
};

export type FieldRuntimePrePostStateViewModel = {
  pre: FieldRuntimeStateSnapshotViewModel;
  post: FieldRuntimeStateSnapshotViewModel;
};

export type FieldRuntimeResponseDeltaViewModel = {
  statusText: string;
  deltaDirection: string;
  deltaValue: string;
  meetsExpectedResponse: string;
  reasonCodes: string[];
};

export type FieldRuntimeExecutionEvidenceViewModel = {
  receiptAvailable: boolean;
  asExecutedAvailable: boolean;
  acceptanceAvailable: boolean;
  operationReportAvailable: boolean;
  evidenceRefs: string[];
};

export type FieldRuntimeZoneResponseViewModel = {
  rows: Array<{
    zoneId: string;
    statusText: string;
    deltaValue: string;
  }>;
};

export type FieldRuntimeVerificationGapViewModel = {
  gapCode: string;
  label: string;
  gapStatus: string;
};

export type FieldRuntimeExecutionTailStageViewModel = {
  stageCode: string;
  label: string;
  statusText: string;
  ref: string;
};

export type FieldRuntimeResidualViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_post_irrigation_verification_v1";
  closureSource: "operator_twin_h31_h45_closure_v1";
  verificationSummary: FieldRuntimeVerificationSummaryViewModel;
  prePostState: FieldRuntimePrePostStateViewModel;
  responseDelta: FieldRuntimeResponseDeltaViewModel;
  executionEvidence: FieldRuntimeExecutionEvidenceViewModel;
  zoneResponse: FieldRuntimeZoneResponseViewModel;
  verificationGaps: FieldRuntimeVerificationGapViewModel[];
  executionTail: FieldRuntimeExecutionTailStageViewModel[];
  boundaryRules: string[];
};

export type FieldRuntimeResidualLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; residual: FieldRuntimeResidualViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return fallback;
  return raw;
}

function booleanText(value: boolean | null | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function refText(value: string | null | undefined): string {
  return text(value, "Not available");
}

function mapStateSnapshot(snapshot: OperatorIrrigationStateSnapshot): FieldRuntimeStateSnapshotViewModel {
  return {
    available: snapshot.available,
    observedAt: text(snapshot.observed_at),
    soilMoistureValue: text(snapshot.soil_moisture_value),
    waterState: text(snapshot.water_state),
  };
}

function mapResponseDelta(delta: OperatorIrrigationResponseDelta, closure: OperatorTwinH31H45ClosureV1 | null): FieldRuntimeResponseDeltaViewModel {
  const summary = closure?.response_summary;
  return {
    statusText: text(summary?.status || delta.status),
    deltaDirection: text(delta.delta_direction),
    deltaValue: text(summary?.delta_value ?? summary?.available_water_fraction_delta ?? delta.delta_value),
    meetsExpectedResponse: booleanText(delta.meets_expected_response),
    reasonCodes: delta.reason_codes.map((code) => text(code)).filter(Boolean),
  };
}

function mapExecutionEvidence(evidence: OperatorExecutionEvidence): FieldRuntimeExecutionEvidenceViewModel {
  return {
    receiptAvailable: evidence.receipt_available,
    asExecutedAvailable: evidence.as_executed_available,
    acceptanceAvailable: evidence.acceptance_available,
    operationReportAvailable: evidence.operation_report_available,
    evidenceRefs: uniqueRefs(evidence.evidence_refs),
  };
}

function mapZoneResponse(matrix: OperatorZoneResponseMatrix): FieldRuntimeZoneResponseViewModel {
  return {
    rows: matrix.rows.map((row, index) => ({
      zoneId: text(String(row.zone_id ?? index + 1)),
      statusText: text(String(row.status ?? "UNKNOWN")),
      deltaValue: text(String(row.delta_value ?? "Not available")),
    })),
  };
}

function mapVerificationGap(gap: OperatorTwinGap): FieldRuntimeVerificationGapViewModel {
  return {
    gapCode: text(gap.gap_code),
    label: text(gap.label),
    gapStatus: text(gap.severity),
  };
}

function buildExecutionTailStages(verification: OperatorFieldTwinPostIrrigationVerificationV1, closure: OperatorTwinH31H45ClosureV1 | null): FieldRuntimeExecutionTailStageViewModel[] {
  const tail = closure?.execution_tail ?? {};
  return [
    { stageCode: "H40", label: "Task", statusText: refText(tail.task_id ?? verification.operation_context.task_id) !== "Not available" ? "AVAILABLE" : "MISSING", ref: refText(tail.task_id ?? verification.operation_context.task_id) },
    { stageCode: "H41", label: "Receipt", statusText: tail.receipt_id || verification.execution_evidence_v1.receipt_available ? "AVAILABLE" : "MISSING", ref: refText(tail.receipt_id ?? verification.operation_context.receipt_id) },
    { stageCode: "H42", label: "As-executed", statusText: tail.as_executed_id || verification.execution_evidence_v1.as_executed_available ? "AVAILABLE" : "MISSING", ref: refText(tail.as_executed_id ?? verification.operation_context.as_executed_id) },
    { stageCode: "H43", label: "Execution Evidence", statusText: verification.execution_evidence_v1.evidence_refs.length > 0 ? "AVAILABLE" : "MISSING", ref: verification.execution_evidence_v1.evidence_refs.join(", ") || "Not available" },
    { stageCode: "H44", label: "Acceptance", statusText: tail.acceptance_result_id || verification.execution_evidence_v1.acceptance_available ? "AVAILABLE" : "MISSING", ref: refText(tail.acceptance_result_id ?? verification.operation_context.acceptance_result_id) },
    { stageCode: "H45", label: "Water Response Verification", statusText: text(closure?.response_summary?.status ?? verification.verification_summary.status), ref: refText(tail.water_response_verification_id ?? closure?.response_summary?.verification_id ?? verification.verification_summary.reason) },
  ];
}

export function mapFieldRuntimeResidual(
  verification: OperatorFieldTwinPostIrrigationVerificationV1,
  closure: OperatorTwinH31H45ClosureV1 | null,
): FieldRuntimeResidualViewModel {
  const summary = verification.verification_summary;
  const closureSummary = closure?.response_summary;
  return {
    fieldId: verification.field_context.field_id,
    fieldName: verification.field_context.field_name,
    cropText: verification.field_context.crop_text,
    source: "operator_field_twin_post_irrigation_verification_v1",
    closureSource: "operator_twin_h31_h45_closure_v1",
    verificationSummary: {
      statusText: text(closureSummary?.status ?? summary.status),
      reasonText: text(summary.reason),
      verificationId: text(closureSummary?.verification_id),
      classTransitionText: text(closureSummary?.class_transition),
      fieldMemoryCandidate: summary.field_memory_candidate,
      roiCandidate: summary.roi_candidate,
      writeReadyMetadata: summary.write_ready,
    },
    prePostState: {
      pre: mapStateSnapshot(verification.pre_irrigation_state_v1),
      post: mapStateSnapshot(verification.post_irrigation_state_v1),
    },
    responseDelta: mapResponseDelta(verification.response_delta_v1, closure),
    executionEvidence: mapExecutionEvidence(verification.execution_evidence_v1),
    zoneResponse: mapZoneResponse(verification.zone_response_matrix_v1),
    verificationGaps: verification.verification_gaps.map(mapVerificationGap),
    executionTail: buildExecutionTailStages(verification, closure),
    boundaryRules: [...verification.boundary_rules, ...(closure?.boundary_rules ?? [])].map((rule) => rule.label),
  };
}

export async function loadFieldRuntimeResidual(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeResidualLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Residual / Verification." };
  }

  try {
    const [verificationResponse, closureResponse] = await Promise.all([
      fetchOperatorFieldTwinPostIrrigationVerification(safeFieldId, scope),
      fetchOperatorTwinH31H45Closure(safeFieldId, scope),
    ]);
    return {
      status: "ready",
      residual: mapFieldRuntimeResidual(
        verificationResponse.operator_field_twin_post_irrigation_verification_v1,
        closureResponse.operator_twin_h31_h45_closure_v1,
      ),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_RESIDUAL_LOAD_FAILED",
    };
  }
}
