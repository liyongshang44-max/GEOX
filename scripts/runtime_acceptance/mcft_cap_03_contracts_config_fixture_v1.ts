// scripts/runtime_acceptance/mcft_cap_03_contracts_config_fixture_v1.ts
// Purpose: build deterministic CAP-03 S1 Runtime Config and eight-member contract fixtures without executing Evidence selection, assimilation math, or persistence.
// Boundary: acceptance support only; no A2 commit, selector, posterior calculation, route, scheduler, or production claim.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
  type AssimilatedContinuationUpdatePayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  buildAssimilatedContinuationRecordSetIdentityV1,
  type AssimilatedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationKeyV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  compileAssimilatedContinuationRuntimeConfigFromAuthorityV1,
  type McftCap03PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v1.js";
import type {
  Mcft00ConfigurationMatrixForContinuationV1,
  Mcft00RealityArtifactForContinuationV1,
  Mcft00SourceMatrixForContinuationV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.js";
import type {
  Mcft00ConfigurationMatrixArtifactV1,
  Mcft00RealityArtifactV1,
  Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import { buildMcftCap02PersistenceFixtureV1 } from "./mcft_cap_02_persistence_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGICAL_TIME = "2026-06-02T02:00:00.000Z";
const CREATED_AT = "2026-07-11T00:00:00.000Z";

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function buildPredecessorStateV1(input: {
  scope: ContinuationOperationKeyV1["scope"];
  lineage_id: string;
  revision_id: string;
  runtime_config: CanonicalObjectEnvelopeV1;
}): CanonicalObjectEnvelopeV1 {
  const identity = {
    object_type: "twin_state_estimate_v1",
    scope: input.scope,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    logical_time: "2026-06-02T01:00:00.000Z",
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
  };
  const state: CanonicalObjectEnvelopeV1 = {
    object_id: deriveSemanticObjectIdV1("twin_state_estimate", identity),
    object_type: "twin_state_estimate_v1",
    schema_version: "v1",
    ...input.scope,
    logical_time: identity.logical_time,
    as_of: identity.logical_time,
    source_refs: [],
    evidence_refs: [],
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    idempotency_key: deriveSemanticObjectIdV1("state_fixture_key", identity),
    determinism_hash: "",
    limitations: ["CONTROLLED_SYNTHETIC", "NO_CALIBRATED_CONFIDENCE_MODEL"],
    created_at: CREATED_AT,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    payload: {
      state_kind: "POSTERIOR",
      confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
      use_eligibility: {
        state_valid: true,
        posterior_chain_eligible: true,
        forecast_source_eligible: true,
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    },
  };
  state.determinism_hash = computeMemberDeterminismHashV1(state as unknown as Record<string, unknown>);
  return state;
}

export function noUsableObservationUpdatePayloadV1(input: {
  transition_ref: string;
  state_ref: string;
  runtime_config: CanonicalObjectEnvelopeV1;
}): AssimilatedContinuationUpdatePayloadV1 {
  return {
    status: "NOT_APPLIED",
    disposition: "NO_USABLE_OBSERVATION",
    policy_id: "MCFT_CAP_03_OBSERVATION_ASSIMILATION_POLICY_V1",
    record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    assimilation_method_id: "SCALAR_GAUSSIAN_ASSIMILATION_V1",
    observation_selector_id: "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1",
    candidate_observations: [],
    selected_observation_ref: null,
    evaluated_observation_refs: [],
    applied_observation_refs: [],
    consumed_observation_refs: [],
    observation_operator: {
      id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
      h: 1,
      direct_state_equivalence: false,
    },
    predicted_observation: null,
    actual_observation: null,
    innovation: null,
    residual: null,
    residual_kind: "STATE_OBSERVATION_INNOVATION",
    innovation_variance: null,
    normalized_innovation: null,
    squared_normalized_innovation: null,
    threshold_decision_basis: "INNOVATION_SQUARED_LE_16_TIMES_VARIANCE",
    prior_mean: 0.18921004,
    prior_variance: 0.002747455463,
    observation_variance: null,
    candidate_assimilation_gain: null,
    applied_assimilation_gain: null,
    candidate_unclipped_posterior_mean: null,
    candidate_posterior_variance: null,
    published_posterior_mean: 0.18921004,
    published_posterior_variance: 0.002747455463,
    state_correction_vwc: 0,
    state_correction_storage_mm: 0,
    clipping: { applied: false, lower_bound: 0, upper_bound: 0.45, delta: 0 },
    state_transition_ref: input.transition_ref,
    posterior_state_ref: input.state_ref,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    model_parameter_change_applied: false,
    reason_codes: ["NO_USABLE_OBSERVATION"],
  };
}

function buildAssimilatedRecordSetV1(input: {
  scope: ContinuationOperationKeyV1["scope"];
  lineage_id: string;
  revision_id: string;
  predecessor_state: CanonicalObjectEnvelopeV1;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_ref: string;
  previous_forecast_hash: string;
  runtime_config: CanonicalObjectEnvelopeV1;
}): AssimilatedContinuationRecordSetV1 {
  const operationKey: ContinuationOperationKeyV1 = {
    scope: structuredClone(input.scope),
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    logical_time: LOGICAL_TIME,
    operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
  };
  const operationIdentity = deriveContinuationOperationIdentityV1(operationKey);
  const ids = operationIdentity.member_object_ids;
  const buildMember = (
    objectType: ContinuationMemberObjectTypeV1,
    payload: Record<string, unknown>,
  ): CanonicalObjectEnvelopeV1 => {
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[objectType],
      object_type: objectType,
      schema_version: "v1",
      ...operationKey.scope,
      logical_time: operationKey.logical_time,
      as_of: operationKey.logical_time,
      source_refs: [],
      evidence_refs: [],
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("a2_member_key", {
        continuation_operation_key_hash: operationIdentity.continuation_operation_key_hash,
        object_type: objectType,
      }),
      determinism_hash: "",
      limitations: ["CONTROLLED_SYNTHETIC", "NO_SUCCESSFUL_FORECAST"],
      created_at: CREATED_AT,
      lineage_id: operationKey.lineage_id,
      revision_id: operationKey.revision_id,
      payload,
    };
    member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
    return member;
  };

  const update = noUsableObservationUpdatePayloadV1({
    transition_ref: ids.twin_state_transition_v1,
    state_ref: ids.twin_state_estimate_v1,
    runtime_config: input.runtime_config,
  });
  const evidenceDigest = semanticHashV1({
    contract_id: "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1",
    logical_time: LOGICAL_TIME,
    candidates: [],
  });
  const members = [
    buildMember("twin_evidence_window_v1", {
      evidence_window_contract_id: "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1",
      semantic_digest: evidenceDigest,
    }),
    buildMember("twin_state_transition_v1", {}),
    buildMember("twin_assimilation_update_v1", update as unknown as Record<string, unknown>),
    buildMember("twin_state_estimate_v1", {}),
    buildMember("twin_forecast_run_v1", {
      status: "BLOCKED",
      points: [],
      scenario_eligible: false,
    }),
    buildMember("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: "A2_BLOCKED_FORECAST",
      record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    }),
    buildMember("twin_runtime_checkpoint_v1", {}),
    buildMember("twin_runtime_health_v1", {}),
  ];
  const memberHashes = Object.fromEntries(
    CONTINUATION_MEMBER_OBJECT_TYPES_V1.map((objectType) => [
      objectType,
      members.find((member) => member.object_type === objectType)?.determinism_hash,
    ]),
  ) as Record<ContinuationMemberObjectTypeV1, string>;
  const identity = buildAssimilatedContinuationRecordSetIdentityV1({
    continuation_operation_key: operationKey,
    aggregate_identity_input: {
      previous_posterior_ref: input.predecessor_state.object_id,
      previous_posterior_hash: input.predecessor_state.determinism_hash,
      previous_checkpoint_ref: input.previous_checkpoint_ref,
      previous_checkpoint_hash: input.previous_checkpoint_hash,
      previous_forecast_result_ref: input.previous_forecast_ref,
      previous_forecast_result_hash: input.previous_forecast_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      reality_binding_ref: String(input.runtime_config.payload.reality_binding_ref),
      reality_binding_hash: String(input.runtime_config.payload.reality_binding_hash),
      evidence_window_semantic_digest: evidenceDigest,
      crop_stage_context_ref: String((input.runtime_config.payload.crop_stage_context as Record<string, unknown>).context_ref),
      crop_stage_context_hash: String((input.runtime_config.payload.crop_stage_context as Record<string, unknown>).context_hash),
      dynamics_model_version: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1:1",
      uncertainty_policy_version: "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1:1",
      observation_policy_version: "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1:1",
      assimilation_method_version: "SCALAR_GAUSSIAN_ASSIMILATION_V1:1",
      forecast_block_policy_version: "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1:1",
      member_determinism_hashes: memberHashes,
    },
  });
  return { ...identity, members };
}

export async function buildMcftCap03ContractsConfigFixtureV1() {
  const cap02 = await buildMcftCap02PersistenceFixtureV1();
  const reality = readJsonV1<Mcft00RealityArtifactV1 & Mcft00RealityArtifactForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
  );
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1 & Mcft00SourceMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const configurationMatrix = readJsonV1<Mcft00ConfigurationMatrixArtifactV1 & Mcft00ConfigurationMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  );
  const predecessorState = buildPredecessorStateV1({
    scope: cap02.scope,
    lineage_id: cap02.lock.lineage_id,
    revision_id: cap02.lock.revision_id,
    runtime_config: cap02.continuationRuntimeConfig,
  });
  const lock: McftCap03PredecessorLockV1 = {
    status: "COMPLETE",
    expected_scope: structuredClone(cap02.scope),
    expected_checkpoint: {
      tick_sequence: 24,
      last_continuation_logical_time: "2026-06-02T01:00:00.000Z",
      next_tick_logical_time: LOGICAL_TIME,
    },
    canonical_identity: {
      active_lineage_ref: cap02.lock.active_lineage_object_ref,
      lineage_id: cap02.lock.lineage_id,
      revision_id: cap02.lock.revision_id,
      latest_state_ref: predecessorState.object_id,
      latest_state_hash: predecessorState.determinism_hash,
      latest_checkpoint_ref: "twin_runtime_checkpoint_cap02_final_fixture",
      latest_checkpoint_hash: "sha256:cap02_final_checkpoint_fixture",
      latest_forecast_result_ref: "twin_forecast_run_cap02_final_fixture",
      latest_forecast_result_hash: "sha256:cap02_final_forecast_fixture",
      latest_successful_forecast_ref: null,
      runtime_config_ref: cap02.continuationRuntimeConfig.object_id,
      runtime_config_hash: cap02.continuationRuntimeConfig.determinism_hash,
    },
  };
  const assimilatedRuntimeConfig = compileAssimilatedContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: lock,
    predecessor_latest_state: predecessorState,
    parent_runtime_config: cap02.continuationRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
  });
  const assimilatedRecordSet = buildAssimilatedRecordSetV1({
    scope: cap02.scope,
    lineage_id: cap02.lock.lineage_id,
    revision_id: cap02.lock.revision_id,
    predecessor_state: predecessorState,
    previous_checkpoint_ref: lock.canonical_identity.latest_checkpoint_ref,
    previous_checkpoint_hash: lock.canonical_identity.latest_checkpoint_hash,
    previous_forecast_ref: lock.canonical_identity.latest_forecast_result_ref,
    previous_forecast_hash: lock.canonical_identity.latest_forecast_result_hash,
    runtime_config: assimilatedRuntimeConfig,
  });
  return {
    ...cap02,
    reality,
    sourceMatrix,
    configurationMatrix,
    predecessorState,
    cap03Lock: lock,
    assimilatedRuntimeConfig,
    assimilatedRecordSet,
  };
}
