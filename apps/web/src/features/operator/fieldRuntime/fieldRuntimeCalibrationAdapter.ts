// apps/web/src/features/operator/fieldRuntime/fieldRuntimeCalibrationAdapter.ts
// Purpose: map the existing read-only Operator Field Twin calibration replay response into the H60-I Field Runtime Calibration ViewModel.
// Boundary: this adapter reads calibration replay data only and exposes no write surface.

import {
  fetchOperatorFieldTwinCalibrationReplay,
  type OperatorCalibrationInputs,
  type OperatorCalibrationSummary,
  type OperatorFieldTwinCalibrationReplayV1,
  type OperatorReplayTimelineItem,
  type OperatorTwinGap,
  type OperatorTwinRequestScope,
} from "../../../api/operatorTwin";

export type FieldRuntimeReplayTimelineItemViewModel = {
  stage: string;
  label: string;
  statusText: string;
  occurredAt: string;
  sourceTable: string;
  refId: string;
  evidenceRefs: string[];
  replayNotes: string[];
};

export type FieldRuntimeCalibrationInputsViewModel = {
  predictionSourceCount: number;
  executionSourceCount: number;
  outcomeSourceCount: number;
  evidenceQualityRefs: string[];
};

export type FieldRuntimeCalibrationSummaryViewModel = {
  statusText: string;
  reasonText: string;
  reviewAvailabilityMetadata: boolean;
  writeReadinessMetadata: boolean;
};

export type FieldRuntimeReplayGapViewModel = {
  gapCode: string;
  label: string;
  gapStatus: string;
};

export type FieldRuntimeCalibrationViewModel = {
  fieldId: string;
  fieldName: string;
  cropText: string;
  source: "operator_field_twin_calibration_replay_v1";
  replayTimeline: FieldRuntimeReplayTimelineItemViewModel[];
  calibrationInputs: FieldRuntimeCalibrationInputsViewModel;
  calibrationSummary: FieldRuntimeCalibrationSummaryViewModel;
  replayGaps: FieldRuntimeReplayGapViewModel[];
  boundaryRules: string[];
};

export type FieldRuntimeCalibrationLoadState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; calibration: FieldRuntimeCalibrationViewModel }
  | { status: "error"; message: string };

function text(value: string | number | boolean | null | undefined, fallback = "Not available"): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "none" || raw === "n/a") return fallback;
  return raw;
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function mapTimelineItem(item: OperatorReplayTimelineItem): FieldRuntimeReplayTimelineItemViewModel {
  return {
    stage: text(item.stage),
    label: text(item.label),
    statusText: text(item.status),
    occurredAt: text(item.occurred_at),
    sourceTable: text(item.source_table),
    refId: text(item.ref_id),
    evidenceRefs: uniqueRefs(item.evidence_refs),
    replayNotes: item.replay_notes.map((note) => text(note)).filter(Boolean),
  };
}

function mapInputs(inputs: OperatorCalibrationInputs): FieldRuntimeCalibrationInputsViewModel {
  return {
    predictionSourceCount: inputs.prediction_sources.length,
    executionSourceCount: inputs.execution_sources.length,
    outcomeSourceCount: inputs.outcome_sources.length,
    evidenceQualityRefs: uniqueRefs(inputs.evidence_quality_refs),
  };
}

function mapSummary(summary: OperatorCalibrationSummary): FieldRuntimeCalibrationSummaryViewModel {
  return {
    statusText: text(summary.status),
    reasonText: text(summary.reason),
    reviewAvailabilityMetadata: summary.available_for_review,
    writeReadinessMetadata: summary.write_ready,
  };
}

function mapReplayGap(gap: OperatorTwinGap): FieldRuntimeReplayGapViewModel {
  return {
    gapCode: text(gap.gap_code),
    label: text(gap.label),
    gapStatus: text(gap.severity),
  };
}

export function mapFieldRuntimeCalibration(replay: OperatorFieldTwinCalibrationReplayV1): FieldRuntimeCalibrationViewModel {
  return {
    fieldId: replay.field_context.field_id,
    fieldName: replay.field_context.field_name,
    cropText: replay.field_context.crop_text,
    source: "operator_field_twin_calibration_replay_v1",
    replayTimeline: replay.replay_timeline_v1.items.map(mapTimelineItem),
    calibrationInputs: mapInputs(replay.calibration_inputs_v1),
    calibrationSummary: mapSummary(replay.calibration_summary),
    replayGaps: replay.replay_gaps.map(mapReplayGap),
    boundaryRules: replay.boundary_rules.map((rule) => rule.label),
  };
}

export async function loadFieldRuntimeCalibration(fieldId: string, scope?: OperatorTwinRequestScope | null): Promise<FieldRuntimeCalibrationLoadState> {
  const safeFieldId = String(fieldId || "").trim();
  if (!safeFieldId || safeFieldId === "not-selected") {
    return { status: "idle", message: "Select a field before loading Field Runtime Calibration." };
  }

  try {
    const response = await fetchOperatorFieldTwinCalibrationReplay(safeFieldId, scope);
    return {
      status: "ready",
      calibration: mapFieldRuntimeCalibration(response.operator_field_twin_calibration_replay_v1),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "FIELD_RUNTIME_CALIBRATION_LOAD_FAILED",
    };
  }
}
