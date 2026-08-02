// Purpose: recompute and prove the frozen MCFT-CAP-08 S6 T17 A1 invariant before lease acquisition.
// Boundary: deterministic input classification only; no persistence, lease, transaction, projection mutation, route or authority issuance.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP08_S4_T17_A2_SCOPE_STATUS_V1,
  CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1,
  CAP08_S4_T17_FORMAL_OUTCOME_V1,
  assertCap08S4T17FormalA1OutcomeV1,
  validateCap08S4T17FormalA1ProofV1,
  type Cap08S4T17FormalA1ProofV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { buildAssimilatedContinuationEvidenceWindowV2 } from "./assimilated_continuation_evidence_window_v2.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { selectCap04FutureForcingOutcomeV1 } from "./future_forcing_outcome_classifier_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "./ports.js";

export type BuildCap08S4T17FormalA1ProofInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  authorized_future_forcing_binding_ids: readonly string[];
  runtime_config: CanonicalObjectEnvelopeV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
};

export function buildCap08S4T17FormalA1ProofV1(
  input: BuildCap08S4T17FormalA1ProofInputV1,
): Cap08S4T17FormalA1ProofV1 {
  const payload = input.runtime_config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const preliminary = buildAssimilatedContinuationEvidenceWindowV2({
    scope: input.scope,
    logical_time: input.logical_time,
    candidate_records: structuredClone(input.candidate_records),
    saturation_fraction: payload.soil_hydraulic_snapshot.saturation_fraction,
    crop_stage_context_ref: payload.crop_stage_context.context_ref,
    crop_stage_context_hash: payload.crop_stage_context.context_hash,
    crop_stage_context: input.crop_stage_context,
  });
  const baseWindow = preliminary.base_continuation_window;
  const selector = selectCap04FutureForcingOutcomeV1({
    scope: input.scope,
    logical_time: input.logical_time,
    candidate_records: structuredClone(input.candidate_records),
    authorized_binding_ids: [...input.authorized_future_forcing_binding_ids],
    crop_stage_context: {
      ref: payload.crop_stage_context.context_ref,
      hash: payload.crop_stage_context.context_hash,
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc: baseWindow.crop_stage_context.kc,
    },
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
    },
  });
  assertCap08S4T17FormalA1OutcomeV1(selector.status);
  if (selector.status !== "SELECTED") throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");

  const bindingIds = [...input.authorized_future_forcing_binding_ids].sort();
  if (JSON.stringify(bindingIds) !== JSON.stringify(["binding_et0", "binding_weather"])) {
    throw new Error("CAP08_S4_T17_FORMAL_BINDING_SET_MISMATCH");
  }
  const forcingHashes = input.candidate_records
    .filter((record) => bindingIds.includes(record.binding_id))
    .map((record) => record.source_record_hash)
    .sort();
  const basis = {
    schema_version: CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1,
    dataset_id: "mcft_cap08_stage1a_replay_v2" as const,
    profile_id: "MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1" as const,
    outcome_profile_id: "FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1" as const,
    t17_logical_time: input.logical_time,
    authorized_binding_ids: ["binding_et0", "binding_weather"] as const,
    forcing_relevant_record_hashes: forcingHashes,
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
    },
    crop_stage_context: {
      ref: payload.crop_stage_context.context_ref,
      hash: payload.crop_stage_context.context_hash,
      crop_stage_code: baseWindow.crop_stage_context.stage_code,
      kc: baseWindow.crop_stage_context.kc,
    },
    selector_status: "SELECTED" as const,
    selected_window_hash: semanticHashV1(selector.window),
    selection_trace_hash: semanticHashV1(selector.trace),
    formal_outcome: CAP08_S4_T17_FORMAL_OUTCOME_V1,
    a2_scope_status: CAP08_S4_T17_A2_SCOPE_STATUS_V1,
  };
  const proof: Cap08S4T17FormalA1ProofV1 = {
    ...basis,
    determinism_hash: semanticHashV1(basis),
  };
  validateCap08S4T17FormalA1ProofV1(proof);
  return proof;
}
