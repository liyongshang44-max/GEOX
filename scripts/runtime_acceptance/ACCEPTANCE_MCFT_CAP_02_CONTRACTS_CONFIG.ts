// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.ts
// Purpose: prove continuation Runtime Config authority binding, D-transaction service semantics, operation-key/aggregate-hash separation, eight-object contracts, checkpoint bridge, and graph validation.
// Boundary: acceptance-only filesystem reads and in-memory repository; no PostgreSQL, hourly Dynamics execution, Evidence selection, A2 canonical write, routes, scheduler, or production claim.

import assert from "node:assert/strict";
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
  CONTINUATION_ASSIMILATION_REASON_CODES_V1,
  CONTINUATION_FORECAST_REASON_CODES_V1,
  CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1,
  CONTINUATION_TICK_LIMITATIONS_V1,
  resolvePreviousCheckpointTickSequenceV1,
  validateContinuationMemberV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationKeyV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  buildContinuationRecordSetIdentityV1,
  computeContinuationRecordSetDeterminismHashV1,
  type ContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.js";
import {
  CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
  validateContinuationRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.js";
import {
  compileContinuationRuntimeConfigFromAuthorityV1,
  type Mcft00ConfigurationMatrixForContinuationV1,
  type Mcft00RealityArtifactForContinuationV1,
  type Mcft00SourceMatrixForContinuationV1,
  type McftCap02PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.js";
import { ContinuationRuntimeConfigServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_service_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREATED_AT = "2026-07-10T00:00:00.000Z";

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

function memberV1(recordSet: ContinuationRecordSetV1, objectType: ContinuationMemberObjectTypeV1): CanonicalObjectEnvelopeV1 {
  const member = recordSet.members.find((candidate) => candidate.object_type === objectType);
  if (!member) throw new Error(`MEMBER_NOT_FOUND:${objectType}`);
  return member;
}

class InMemoryRuntimeConfigRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  commitCount = 0;

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1) {
    const existing = this.configs.get(config.object_id);
    if (existing) {
      if (existing.determinism_hash !== config.determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS" as const,
        object_id: config.object_id,
        fact_id: `fact_${config.object_id}`,
      };
    }
    this.commitCount += 1;
    this.configs.set(config.object_id, cloneV1(config));
    return {
      status: "INSERTED" as const,
      object_id: config.object_id,
      fact_id: `fact_${config.object_id}`,
    };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    return cloneV1(this.configs.get(objectId) ?? null);
  }
}

function buildRecordSetV1(input: {
  lock: McftCap02PredecessorLockV1;
  runtimeConfig: CanonicalObjectEnvelopeV1;
}): ContinuationRecordSetV1 {
  const operationKey: ContinuationOperationKeyV1 = {
    scope: cloneV1(input.lock.scope),
    lineage_id: input.lock.lineage_id,
    revision_id: input.lock.revision_id,
    logical_time: input.lock.next_logical_tick_time,
    operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
  } as ContinuationOperationKeyV1;
  const operationIdentity = deriveContinuationOperationIdentityV1(operationKey);
  const ids = operationIdentity.member_object_ids;
  const trace = {
    previous_storage_mm: "57.778512",
    gross_rainfall_mm: "0.000000",
    surface_runoff_mm: "0.000000",
    effective_rainfall_mm: "0.000000",
    execution_events: [],
    effective_irrigation_mm: "0.000000",
    reference_et0_mm: "0.085000",
    crop_stage_code: "INITIAL",
    kc: "0.300000",
    requested_crop_et_mm: "0.025500",
    actual_crop_et_mm: "0.025500",
    unmet_crop_et_mm: "0.000000",
    storage_before_drainage_mm: "57.753012",
    drainage_mm: "0.000000",
    storage_after_drainage_mm: "57.753012",
    saturation_overflow_mm: "0.000000",
    next_storage_mm: "57.753012",
    mass_balance_error_mm: "0.000000",
  };
  const traceHash = semanticHashV1(trace);
  const evidenceDigest = semanticHashV1({
    logical_time: operationKey.logical_time,
    exact_hour_rainfall_ref: "rainfall_exact_hour_ref_v1",
    exact_hour_et0_ref: "et0_exact_hour_ref_v1",
  });
  const nextTickLogicalTime = "2026-06-01T03:00:00.000Z";

  const buildMember = (
    objectType: ContinuationMemberObjectTypeV1,
    payload: Record<string, unknown>,
    evidenceRefs: string[] = [],
  ): CanonicalObjectEnvelopeV1 => {
    const object: CanonicalObjectEnvelopeV1 = {
      object_id: ids[objectType],
      object_type: objectType,
      schema_version: "v1",
      ...operationKey.scope,
      logical_time: operationKey.logical_time,
      as_of: operationKey.logical_time,
      source_refs: [input.lock.reality_binding_ref],
      evidence_refs: [...evidenceRefs].sort(),
      runtime_config_ref: input.runtimeConfig.object_id,
      runtime_config_hash: input.runtimeConfig.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("a2_member_key", {
        continuation_operation_key_hash: operationIdentity.continuation_operation_key_hash,
        object_type: objectType,
      }),
      determinism_hash: "",
      limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
      created_at: CREATED_AT,
      lineage_id: operationKey.lineage_id,
      revision_id: operationKey.revision_id,
      payload,
    };
    object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
    return object;
  };

  const members: CanonicalObjectEnvelopeV1[] = [
    buildMember("twin_evidence_window_v1", {
      window_rule_id: "OPEN_START_CLOSED_END_PT1H_V1",
      window_start_exclusive: "2026-06-01T01:00:00.000Z",
      window_end_inclusive: operationKey.logical_time,
      frozen: true,
      entries: [],
      semantic_digest: evidenceDigest,
    }),
    buildMember("twin_state_transition_v1", {
      transition_kind: "CONTINUATION",
      previous_posterior_ref: input.lock.bootstrap_state_ref,
      previous_posterior_hash: input.lock.bootstrap_state_hash,
      process_model_status: "APPLIED",
      process_model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
      process_model_version: 1,
      propagation_start: "2026-06-01T01:00:00.000Z",
      propagation_end: operationKey.logical_time,
      previous_state_runtime_config_ref: input.lock.bootstrap_runtime_config_ref,
      current_runtime_config_ref: input.runtimeConfig.object_id,
      mass_balance_trace: trace,
      mass_balance_trace_hash: traceHash,
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    buildMember("twin_assimilation_update_v1", {
      status: "NOT_APPLIED",
      disposition: "DEFERRED_TO_MCFT_CAP_03",
      candidate_observation_refs: ["soil_candidate_ref_v1"],
      consumed_observation_refs: [],
      predicted_observation: null,
      innovation: null,
      residual: null,
      assimilation_gain: null,
      prior_mean: 0.19251,
      posterior_mean: 0.19251,
      prior_variance: 0.002681,
      posterior_variance: 0.002681,
      reason_codes: [...CONTINUATION_ASSIMILATION_REASON_CODES_V1],
      policy_id: CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
      state_transition_ref: ids.twin_state_transition_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    buildMember("twin_state_estimate_v1", {
      state_kind: "POSTERIOR",
      previous_posterior_ref: input.lock.bootstrap_state_ref,
      transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      reality_binding_ref: input.lock.reality_binding_ref,
      reality_binding_hash: input.lock.reality_binding_hash,
      root_zone_storage_mm: { mean: 57.753012, variance: 241.270014630625 },
      root_zone_vwc_fraction: { mean: 0.19251, variance: 0.002681, stddev: 0.051776 },
      uncertainty: {
        policy_id: CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
        interval: {
          raw_lower: 0.091029,
          raw_upper: 0.293991,
          published_lower: 0.091029,
          published_upper: 0.293991,
          clipping_applied: false,
          clipping_lower_bound: 0,
          clipping_upper_bound: 0.45,
          clipping_policy_id: "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1",
        },
      },
      computation_basis: {
        basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
        source_posterior_ref: input.lock.bootstrap_state_ref,
        source_vwc_variance: "0.002678",
        root_zone_depth_mm: "300.000000",
        storage_mean_mm_decimal: { value: "57.753012", scale: 6 },
        storage_variance_mm2_decimal: { value: "241.270014630625", scale: 12 },
      },
      available_water_fraction: 0.402834,
      depletion_from_field_capacity_mm: 32.246988,
      mass_balance_trace_hash: traceHash,
      confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
      use_eligibility: {
        state_valid: true,
        posterior_chain_eligible: true,
        forecast_source_eligible: true,
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    }),
    buildMember("twin_forecast_run_v1", {
      status: "BLOCKED",
      points: [],
      scenario_eligible: false,
      source_posterior_ref: ids.twin_state_estimate_v1,
      successful_forecast_ref: null,
      reason_codes: [...CONTINUATION_FORECAST_REASON_CODES_V1],
      policy_id: CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
    }),
    buildMember("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
      status: "COMPLETED_WITH_LIMITATIONS",
      transition_kind: "CONTINUATION",
      limitations: [...CONTINUATION_TICK_LIMITATIONS_V1],
      evidence_window_ref: ids.twin_evidence_window_v1,
      state_transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      next_tick_logical_time: nextTickLogicalTime,
    }),
    buildMember("twin_runtime_checkpoint_v1", {
      checkpoint_kind: "CONTINUATION",
      previous_checkpoint_ref: input.lock.bootstrap_checkpoint_ref,
      last_completed_tick_ref: ids.twin_runtime_tick_v1,
      last_posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      next_tick_logical_time: nextTickLogicalTime,
      tick_sequence: 1,
    }),
    buildMember("twin_runtime_health_v1", {
      operation_status: "CONTINUATION_STATE_COMMITTED_WITH_BLOCKED_FORECAST",
      runtime_mode: "REPLAY",
      active_lineage_ref: input.lock.active_lineage_object_ref,
      lineage_id: operationKey.lineage_id,
      revision_id: operationKey.revision_id,
      tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      limitation_reason_codes: [...CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1],
    }),
  ];

  const memberHashes = Object.fromEntries(
    members.map((member) => [member.object_type, member.determinism_hash]),
  ) as Record<ContinuationMemberObjectTypeV1, string>;
  const identity = buildContinuationRecordSetIdentityV1({
    continuation_operation_key: operationKey,
    aggregate_identity_input: {
      previous_posterior_ref: input.lock.bootstrap_state_ref,
      previous_posterior_hash: input.lock.bootstrap_state_hash,
      previous_checkpoint_ref: input.lock.bootstrap_checkpoint_ref,
      previous_checkpoint_hash: input.lock.bootstrap_checkpoint_hash,
      runtime_config_ref: input.runtimeConfig.object_id,
      runtime_config_hash: input.runtimeConfig.determinism_hash,
      reality_binding_ref: input.lock.reality_binding_ref,
      reality_binding_hash: input.lock.reality_binding_hash,
      evidence_window_semantic_digest: evidenceDigest,
      crop_stage_context_ref: CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
      crop_stage_context_hash: CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
      dynamics_model_version: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1:1",
      uncertainty_policy_version: "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1:1",
      no_observation_update_policy_version: "DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1:1",
      forecast_block_policy_version: "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1:1",
      member_determinism_hashes: memberHashes,
    },
  });
  return { ...identity, members };
}

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const lock = readJsonV1<McftCap02PredecessorLockV1 & Record<string, string>>(
    "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json",
  );
  const reality = readJsonV1<Mcft00RealityArtifactV1 & Mcft00RealityArtifactForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
  );
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1 & Mcft00SourceMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const configurationMatrix = readJsonV1<Mcft00ConfigurationMatrixArtifactV1 & Mcft00ConfigurationMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  );

  const parentRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(parentRuntimeConfig.object_id, lock.bootstrap_runtime_config_ref);
  assert.equal(parentRuntimeConfig.determinism_hash, lock.bootstrap_runtime_config_hash);
  ok("canonical parent Runtime Config reproduces predecessor lock identity");

  const firstConfig = compileContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: lock,
    parent_runtime_config: parentRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: lock.next_logical_tick_time,
    created_at: CREATED_AT,
  });
  const secondConfig = compileContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: lock,
    parent_runtime_config: parentRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: lock.next_logical_tick_time,
    created_at: "2026-07-10T00:01:00.000Z",
  });
  validateContinuationRuntimeConfigPayloadV1(firstConfig.payload);
  assert.equal(firstConfig.object_id, secondConfig.object_id);
  assert.equal(firstConfig.determinism_hash, secondConfig.determinism_hash);
  ok("continuation Runtime Config identity excludes audit created_at");

  const repository = new InMemoryRuntimeConfigRepositoryV1();
  const service = new ContinuationRuntimeConfigServiceV1(repository);
  const firstCommit = await service.commitAndVerify(firstConfig);
  const secondCommit = await service.commitAndVerify(secondConfig);
  assert.equal(firstCommit.status, "INSERTED");
  assert.equal(secondCommit.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(repository.commitCount, 1);
  ok("D-transaction service commits once and verifies idempotent canonical readback");

  const recordSet = buildRecordSetV1({ lock, runtimeConfig: firstConfig });
  validateContinuationRecordSetV1(recordSet);
  assert.equal(recordSet.members.length, 8);
  assert.deepEqual(recordSet.members.map((member) => member.object_type).sort(), [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort());
  ok("complete eight-object continuation record set validates");

  const initialCheckpoint = {
    ...memberV1(recordSet, "twin_runtime_checkpoint_v1"),
    payload: { checkpoint_kind: "INITIAL", previous_checkpoint_ref: null },
  } as CanonicalObjectEnvelopeV1;
  assert.equal(resolvePreviousCheckpointTickSequenceV1(initialCheckpoint), 0);
  assert.equal(resolvePreviousCheckpointTickSequenceV1(memberV1(recordSet, "twin_runtime_checkpoint_v1")), 1);
  ok("INITIAL checkpoint implicit tick sequence bridge is uniquely zero");

  const alternateAggregate = cloneV1(recordSet.aggregate_identity_input);
  alternateAggregate.evidence_window_semantic_digest = semanticHashV1({ alternate: true });
  const alternateHash = computeContinuationRecordSetDeterminismHashV1(alternateAggregate);
  assert.equal(
    deriveContinuationOperationIdentityV1(recordSet.continuation_operation_key).continuation_idempotency_key,
    recordSet.continuation_idempotency_key,
  );
  assert.notEqual(alternateHash, recordSet.continuation_record_set_determinism_hash);
  ok("same operation key retains idempotency key while different Evidence changes aggregate hash");

  const illegalKey = {
    ...recordSet.continuation_operation_key,
    evidence_window_semantic_digest: "sha256:forbidden",
  } as unknown as ContinuationOperationKeyV1;
  assert.throws(() => deriveContinuationOperationIdentityV1(illegalKey), /EVIDENCE_DIGEST_FORBIDDEN_IN_CONTINUATION_OPERATION_KEY/);
  ok("Evidence digest is forbidden in continuation operation key");

  const transitionWithBootstrap = cloneV1(memberV1(recordSet, "twin_state_transition_v1"));
  transitionWithBootstrap.payload.bootstrap_prior = { mean: 0.1 };
  transitionWithBootstrap.determinism_hash = computeMemberDeterminismHashV1(transitionWithBootstrap as unknown as Record<string, unknown>);
  assert.throws(() => validateContinuationMemberV1(transitionWithBootstrap), /CONTINUATION_BOOTSTRAP_PRIOR_FORBIDDEN/);
  ok("CONTINUATION transition rejects hidden bootstrap prior");

  const assimilationWithInnovation = cloneV1(memberV1(recordSet, "twin_assimilation_update_v1"));
  assimilationWithInnovation.payload.innovation = 0.01;
  assimilationWithInnovation.determinism_hash = computeMemberDeterminismHashV1(assimilationWithInnovation as unknown as Record<string, unknown>);
  assert.throws(() => validateContinuationMemberV1(assimilationWithInnovation), /INNOVATION_MUST_BE_NULL/);
  ok("NOT_APPLIED assimilation rejects innovation");

  const checkpointWithoutPrevious = cloneV1(memberV1(recordSet, "twin_runtime_checkpoint_v1"));
  checkpointWithoutPrevious.payload.previous_checkpoint_ref = null;
  checkpointWithoutPrevious.determinism_hash = computeMemberDeterminismHashV1(checkpointWithoutPrevious as unknown as Record<string, unknown>);
  assert.throws(() => validateContinuationMemberV1(checkpointWithoutPrevious), /CONTINUATION_PREVIOUS_CHECKPOINT_REF_REQUIRED/);
  ok("CONTINUATION checkpoint requires previous checkpoint");

  const graphMismatch = cloneV1(recordSet);
  const mismatchedState = memberV1(graphMismatch, "twin_state_estimate_v1");
  mismatchedState.payload.mass_balance_trace_hash = semanticHashV1({ wrong: true });
  mismatchedState.determinism_hash = computeMemberDeterminismHashV1(mismatchedState as unknown as Record<string, unknown>);
  graphMismatch.aggregate_identity_input.member_determinism_hashes.twin_state_estimate_v1 = mismatchedState.determinism_hash;
  graphMismatch.continuation_record_set_determinism_hash = computeContinuationRecordSetDeterminismHashV1(graphMismatch.aggregate_identity_input);
  assert.throws(() => validateContinuationRecordSetV1(graphMismatch), /CONTINUATION_STATE_TRANSITION_TRACE_HASH_MISMATCH/);
  ok("Transition and State mass-balance trace hash mismatch is rejected");

  const forgedLock = cloneV1(lock);
  forgedLock.bootstrap_runtime_config_hash = "sha256:forged";
  assert.throws(() => compileContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: forgedLock,
    parent_runtime_config: parentRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: forgedLock.next_logical_tick_time,
    created_at: CREATED_AT,
  }), /CONTINUATION_PARENT_CONFIG_HASH_MISMATCH/);
  ok("forged predecessor parent Runtime Config hash is rejected");

  console.log(`MCFT-CAP-02 contracts-config: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
