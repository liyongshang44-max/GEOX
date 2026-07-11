// apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts
// Purpose: compose the additive MCFT-CAP-03 V2 observation selection trace around the immutable CAP-02 Evidence Window.
// Boundary: pure application composition only; no database, persistence, filesystem, network, wall clock, Runtime tick execution, canonical write, or V1 reinterpretation.

import type { AssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2,
} from "../../domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  selectAssimilatedContinuationObservationV2,
  type SelectedAssimilatedObservationV2,
} from "./assimilated_continuation_observation_selector_v2.js";
import {
  buildContinuationEvidenceWindowV1,
  type ContinuationCropStageConfigurationContextV1,
  type ContinuationEvidenceWindowV1,
} from "./continuation_evidence_window_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type AssimilatedContinuationEvidenceWindowV2 = {
  evidence_window_contract_id:
    typeof ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2;
  logical_time: string;
  frozen: true;
  base_continuation_window: ContinuationEvidenceWindowV1;
  observation_selection: SelectedAssimilatedObservationV2;
  dynamics_consumed_evidence_refs: string[];
  assimilation_evaluated_evidence_refs: string[];
  assimilation_applied_evidence_refs: string[];
  context_only_evidence_refs: string[];
  rejected_evidence_refs: string[];
  consumed_evidence_refs: string[];
  semantic_digest: string;
};

function uniqueSortedV2(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function digestV2(
  value: Omit<AssimilatedContinuationEvidenceWindowV2, "semantic_digest">,
): string {
  return semanticHashV1(value);
}

export function buildAssimilatedContinuationEvidenceWindowV2(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  observation_candidate_records?: readonly CanonicalReplayEvidenceRecordV1[];
  saturation_fraction: number;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
}): AssimilatedContinuationEvidenceWindowV2 {
  const baseWindow = buildContinuationEvidenceWindowV1({
    scope: input.scope,
    logical_time: input.logical_time,
    candidate_records: input.candidate_records,
    crop_stage_context_ref: input.crop_stage_context_ref,
    crop_stage_context_hash: input.crop_stage_context_hash,
    crop_stage_context: input.crop_stage_context,
  });

  const observationRecords = input.observation_candidate_records
    ?? input.candidate_records.filter(
      (record) => typeof record.role_time?.observed_at === "string",
    );

  const selection = selectAssimilatedContinuationObservationV2({
    scope: input.scope,
    logical_time: input.logical_time,
    saturation_fraction: input.saturation_fraction,
    observation_records: observationRecords,
  });

  const dynamicsConsumed = uniqueSortedV2(
    baseWindow.consumed_evidence_refs,
  );
  const observationRefs = new Set(
    observationRecords.map((record) => record.source_record_id),
  );
  const contextOnly = uniqueSortedV2(
    baseWindow.context_only_evidence_refs.filter(
      (ref) => !observationRefs.has(ref),
    ),
  );

  const value: Omit<
    AssimilatedContinuationEvidenceWindowV2,
    "semantic_digest"
  > = {
    evidence_window_contract_id:
      ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_CONTRACT_ID_V2,
    logical_time: baseWindow.logical_time,
    frozen: true,
    base_continuation_window: baseWindow,
    observation_selection: selection,
    dynamics_consumed_evidence_refs: dynamicsConsumed,
    assimilation_evaluated_evidence_refs:
      selection.evaluated_observation_refs,
    assimilation_applied_evidence_refs: [],
    context_only_evidence_refs: contextOnly,
    rejected_evidence_refs: selection.rejected_observation_refs,
    consumed_evidence_refs: dynamicsConsumed,
  };

  return {
    ...value,
    semantic_digest: digestV2(value),
  };
}

export function finalizeAssimilatedContinuationEvidenceWindowV2(input: {
  window: AssimilatedContinuationEvidenceWindowV2;
  assimilation: AssimilatedContinuationPosteriorV1;
}): AssimilatedContinuationEvidenceWindowV2 {
  const selectedRef =
    input.window.observation_selection.selected_observation_ref;

  if (input.assimilation.selected_observation_ref !== selectedRef) {
    throw new Error("ASSIMILATION_V2_EVIDENCE_SELECTED_REF_MISMATCH");
  }
  if (
    JSON.stringify(input.assimilation.evaluated_observation_refs)
    !== JSON.stringify(
      input.window.assimilation_evaluated_evidence_refs,
    )
  ) {
    throw new Error("ASSIMILATION_V2_EVIDENCE_EVALUATED_REFS_MISMATCH");
  }

  const dynamicsConsumed = uniqueSortedV2(
    input.window.dynamics_consumed_evidence_refs,
  );
  const applied = uniqueSortedV2(
    input.assimilation.applied_observation_refs,
  );
  if (
    JSON.stringify(applied)
    !== JSON.stringify(
      uniqueSortedV2(input.assimilation.consumed_observation_refs),
    )
  ) {
    throw new Error("ASSIMILATION_V2_APPLIED_CONSUMED_REFS_MISMATCH");
  }

  const value: Omit<
    AssimilatedContinuationEvidenceWindowV2,
    "semantic_digest"
  > = {
    evidence_window_contract_id:
      input.window.evidence_window_contract_id,
    logical_time: input.window.logical_time,
    frozen: true,
    base_continuation_window:
      input.window.base_continuation_window,
    observation_selection:
      input.window.observation_selection,
    dynamics_consumed_evidence_refs: dynamicsConsumed,
    assimilation_evaluated_evidence_refs: [
      ...input.assimilation.evaluated_observation_refs,
    ],
    assimilation_applied_evidence_refs: applied,
    context_only_evidence_refs: uniqueSortedV2(
      input.window.context_only_evidence_refs,
    ),
    rejected_evidence_refs: uniqueSortedV2(
      input.window.rejected_evidence_refs,
    ),
    consumed_evidence_refs: uniqueSortedV2([
      ...dynamicsConsumed,
      ...applied,
    ]),
  };

  return {
    ...value,
    semantic_digest: digestV2(value),
  };
}
