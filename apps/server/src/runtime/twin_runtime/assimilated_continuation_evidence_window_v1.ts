// apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v1.ts
// Purpose: preserve immutable CAP-02 Evidence Window semantics while adding CAP-03 observation candidate assessment, selection, and assimilation trace classifications.
// Boundary: pure application composition only; no database, persistence, filesystem, network, wall clock, Runtime tick execution, or canonical write.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import { ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V1 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import type { AssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  buildContinuationEvidenceWindowV1,
  type ContinuationCropStageConfigurationContextV1,
  type ContinuationEvidenceWindowV1,
} from "./continuation_evidence_window_service_v1.js";
import {
  selectAssimilatedContinuationObservationV1,
  type SelectedAssimilatedObservationV1,
} from "./assimilated_continuation_observation_selector_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "./ports.js";

export type AssimilatedContinuationEvidenceWindowV1 = {
  evidence_window_contract_id: typeof ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V1;
  logical_time: string;
  frozen: true;
  base_continuation_window: ContinuationEvidenceWindowV1;
  observation_selection: SelectedAssimilatedObservationV1;
  dynamics_consumed_evidence_refs: string[];
  assimilation_evaluated_evidence_refs: string[];
  assimilation_applied_evidence_refs: string[];
  context_only_evidence_refs: string[];
  rejected_evidence_refs: string[];
  consumed_evidence_refs: string[];
  semantic_digest: string;
};

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function digestV1(value: Omit<AssimilatedContinuationEvidenceWindowV1, "semantic_digest">): string {
  return semanticHashV1(value);
}

export function buildAssimilatedContinuationEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  observation_candidate_records?: readonly CanonicalReplayEvidenceRecordV1[];
  saturation_fraction: number;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
}): AssimilatedContinuationEvidenceWindowV1 {
  const baseWindow = buildContinuationEvidenceWindowV1({
    scope: input.scope,
    logical_time: input.logical_time,
    candidate_records: input.candidate_records,
    crop_stage_context_ref: input.crop_stage_context_ref,
    crop_stage_context_hash: input.crop_stage_context_hash,
    crop_stage_context: input.crop_stage_context,
  });
  const observationRecords = input.observation_candidate_records
    ?? input.candidate_records.filter((record) => typeof record.role_time?.observed_at === "string");
  const selection = selectAssimilatedContinuationObservationV1({
    scope: input.scope,
    logical_time: input.logical_time,
    saturation_fraction: input.saturation_fraction,
    observation_records: observationRecords,
  });
  const dynamicsConsumed = uniqueSortedV1(baseWindow.consumed_evidence_refs);
  const contextOnly = uniqueSortedV1(
    baseWindow.context_only_evidence_refs.filter((ref) => !observationRecords.some((record) => record.source_record_id === ref)),
  );
  const value: Omit<AssimilatedContinuationEvidenceWindowV1, "semantic_digest"> = {
    evidence_window_contract_id: ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V1,
    logical_time: baseWindow.logical_time,
    frozen: true,
    base_continuation_window: baseWindow,
    observation_selection: selection,
    dynamics_consumed_evidence_refs: dynamicsConsumed,
    assimilation_evaluated_evidence_refs: selection.evaluated_observation_refs,
    assimilation_applied_evidence_refs: [],
    context_only_evidence_refs: contextOnly,
    rejected_evidence_refs: selection.rejected_observation_refs,
    consumed_evidence_refs: dynamicsConsumed,
  };
  return { ...value, semantic_digest: digestV1(value) };
}

export function finalizeAssimilatedContinuationEvidenceWindowV1(input: {
  window: AssimilatedContinuationEvidenceWindowV1;
  assimilation: AssimilatedContinuationPosteriorV1;
}): AssimilatedContinuationEvidenceWindowV1 {
  const selectedRef = input.window.observation_selection.selected_observation_ref;
  if (input.assimilation.selected_observation_ref !== selectedRef) {
    throw new Error("ASSIMILATION_EVIDENCE_SELECTED_REF_MISMATCH");
  }
  if (JSON.stringify(input.assimilation.evaluated_observation_refs) !== JSON.stringify(input.window.assimilation_evaluated_evidence_refs)) {
    throw new Error("ASSIMILATION_EVIDENCE_EVALUATED_REFS_MISMATCH");
  }
  const dynamicsConsumed = uniqueSortedV1(input.window.dynamics_consumed_evidence_refs);
  const applied = uniqueSortedV1(input.assimilation.applied_observation_refs);
  if (JSON.stringify(applied) !== JSON.stringify(uniqueSortedV1(input.assimilation.consumed_observation_refs))) {
    throw new Error("ASSIMILATION_APPLIED_CONSUMED_REFS_MISMATCH");
  }
  const value: Omit<AssimilatedContinuationEvidenceWindowV1, "semantic_digest"> = {
    evidence_window_contract_id: input.window.evidence_window_contract_id,
    logical_time: input.window.logical_time,
    frozen: true,
    base_continuation_window: input.window.base_continuation_window,
    observation_selection: input.window.observation_selection,
    dynamics_consumed_evidence_refs: dynamicsConsumed,
    assimilation_evaluated_evidence_refs: [...input.assimilation.evaluated_observation_refs],
    assimilation_applied_evidence_refs: applied,
    context_only_evidence_refs: uniqueSortedV1(input.window.context_only_evidence_refs),
    rejected_evidence_refs: uniqueSortedV1(input.window.rejected_evidence_refs),
    consumed_evidence_refs: uniqueSortedV1([...dynamicsConsumed, ...applied]),
  };
  return { ...value, semantic_digest: digestV1(value) };
}
