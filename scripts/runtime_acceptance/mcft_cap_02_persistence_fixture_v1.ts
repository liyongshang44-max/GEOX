// scripts/runtime_acceptance/mcft_cap_02_persistence_fixture_v1.ts
// Purpose: construct the real MCFT-CAP-01 A0 predecessor record set, canonical continuation Runtime Config, and valid MCFT-CAP-02 A2 eight-object candidate sets for persistence acceptance.
// Boundary: acceptance fixture construction only; no PostgreSQL writes, lease acquisition, projection mutation, Runtime tick orchestration, or production claim.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
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
} from "../../apps/server/src/domain/twin_runtime/continuation_contracts_v1.js";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationKeyV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  buildContinuationRecordSetIdentityV1,
  type ContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.js";
import {
  CONTINUATION_CROP_STAGE_CONTEXT_HASH_V1,
  CONTINUATION_CROP_STAGE_CONTEXT_REF_V1,
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { buildA0RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.js";
import {
  compileContinuationRuntimeConfigFromAuthorityV1,
  type Mcft00ConfigurationMatrixForContinuationV1,
  type Mcft00RealityArtifactForContinuationV1,
  type Mcft00SourceMatrixForContinuationV1,
  type McftCap02PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

export const PERSISTENCE_FIXTURE_ROOT_V1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const A0_LOGICAL_TIME_V1 = "2026-06-01T01:00:00.000Z";
export const A2_LOGICAL_TIME_V1 = "2026-06-01T02:00:00.000Z";
export const FIXTURE_CREATED_AT_V1 = "2026-07-10T00:00:00.000Z";

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1
  & Mcft00ConfigurationMatrixForContinuationV1
  & {
    configuration_source_definitions: Array<{
      configuration_source_id: string;
      parameters: Record<string, { value: unknown }>;
    }>;
  };

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(PERSISTENCE_FIXTURE_ROOT_V1, relativePath), "utf8")) as T;
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

function buildContinuationRecordSetV1(input: {
  lock: McftCap02PredecessorLockV1;
  runtimeConfig: CanonicalObjectEnvelopeV1;
  evidenceVariant: string;
}): ContinuationRecordSetV1 {
  const operationKey: ContinuationOperationKeyV1 = {
    scope: structuredClone(input.lock.scope),
    lineage_id: input.lock.lineage_id,
    revision_id: input.lock.revision_id,
    logical_time: input.lock.next_logical_tick_time,
    operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
  };
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
  const evidenceEntries = [{ fixture_variant: input.evidenceVariant, rainfall_ref: "rainfall_exact_hour_ref_v1", et0_ref: "et0_exact_hour_ref_v1" }];
  const evidenceDigest = semanticHashV1({ logical_time: operationKey.logical_time, entries: evidenceEntries });
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
      created_at: FIXTURE_CREATED_AT_V1,
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
      window_start_exclusive: A0_LOGICAL_TIME_V1,
      window_end_inclusive: operationKey.logical_time,
      frozen: true,
      entries: evidenceEntries,
      semantic_digest: evidenceDigest,
    }),
    buildMember("twin_state_transition_v1", {
      transition_kind: "CONTINUATION",
      previous_posterior_ref: input.lock.bootstrap_state_ref,
      previous_posterior_hash: input.lock.bootstrap_state_hash,
      process_model_status: "APPLIED",
      process_model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
      process_model_version: 1,
      propagation_start: A0_LOGICAL_TIME_V1,
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

export async function buildMcftCap02PersistenceFixtureV1() {
  const lock = readJsonV1<McftCap02PredecessorLockV1 & Record<string, unknown>>(
    "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json",
  );
  const reality = readJsonV1<Mcft00RealityArtifactV1 & Mcft00RealityArtifactForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
  );
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1 & Mcft00SourceMatrixForContinuationV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  );
  const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
  const parentRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  const continuationRuntimeConfig = compileContinuationRuntimeConfigFromAuthorityV1({
    predecessor_lock: lock,
    parent_runtime_config: parentRuntimeConfig,
    reality_artifact: reality,
    source_matrix_artifact: sourceMatrix,
    configuration_matrix_artifact: configurationMatrix,
    logical_time: lock.next_logical_tick_time,
    created_at: A2_LOGICAL_TIME_V1,
  });
  const evidenceSource = new CanonicalReplayFileSourceV1(path.join(PERSISTENCE_FIXTURE_ROOT_V1, "fixtures/mcft/water_state/replay_v1"));
  const candidates = await evidenceSource.loadCandidateRecords({ scope, logical_time: A0_LOGICAL_TIME_V1 });
  const a0EvidenceWindow = buildFrozenEvidenceWindowV1({ scope, logical_time: A0_LOGICAL_TIME_V1, candidate_records: candidates });
  const a0RecordSet = buildA0RecordSetV1({
    scope,
    logical_time: A0_LOGICAL_TIME_V1,
    created_at: A0_LOGICAL_TIME_V1,
    runtime_config: parentRuntimeConfig,
    evidence_window: a0EvidenceWindow,
    hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
  });
  const continuationRecordSet = buildContinuationRecordSetV1({
    lock,
    runtimeConfig: continuationRuntimeConfig,
    evidenceVariant: "BASE",
  });
  const conflictingContinuationRecordSet = buildContinuationRecordSetV1({
    lock,
    runtimeConfig: continuationRuntimeConfig,
    evidenceVariant: "CONFLICTING_EVIDENCE",
  });
  return {
    lock,
    scope,
    parentRuntimeConfig,
    continuationRuntimeConfig,
    a0RecordSet,
    continuationRecordSet,
    conflictingContinuationRecordSet,
  };
}
