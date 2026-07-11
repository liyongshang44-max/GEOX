// scripts/runtime_acceptance/mcft_cap_03_assimilated_persistence_recovery_fixture_v1.ts
// Purpose: assemble a coherent CAP-02 final handoff, CAP-03 Runtime Config, valid assimilated A2 record set, and same-key conflicting record set for S3B persistence acceptance.
// Boundary: deterministic acceptance fixture construction only; no database, lease, canonical write, Runtime tick orchestration, range execution, route, scheduler, or production claim.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  computeAssimilatedContinuationRecordSetDeterminismHashV1,
  type AssimilatedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  compileAssimilatedContinuationRuntimeConfigFromAuthorityV1,
  type McftCap03PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v1.js";
import { buildAssimilatedContinuationRecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.js";
import type {
  ContinuationExpectedPointersV1,
  PreparedNextTickInputV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap03AssimilatedRecordSetBuilderFixtureV1 } from "./mcft_cap_03_assimilated_record_set_builder_fixture_v1.js";

export const S3B_PREDECESSOR_LOGICAL_TIME_V1 = "2026-06-02T01:00:00.000Z";
export const S3B_LOGICAL_TIME_V1 = "2026-06-02T02:00:00.000Z";
export const S3B_CREATED_AT_V1 = "2026-07-11T04:10:00.000Z";

function memberByTypeV1(
  members: readonly CanonicalObjectEnvelopeV1[],
  objectType: CanonicalObjectEnvelopeV1["object_type"],
): CanonicalObjectEnvelopeV1 {
  const matches = members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`S3B_FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function clonePredecessorMemberV1(input: {
  template: CanonicalObjectEnvelopeV1;
  object_id: string;
  logical_time: string;
  payload_patch: Record<string, unknown>;
}): CanonicalObjectEnvelopeV1 {
  const member: CanonicalObjectEnvelopeV1 = {
    ...structuredClone(input.template),
    object_id: input.object_id,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    idempotency_key: deriveSemanticObjectIdV1("s3b_predecessor_member_key", {
      object_type: input.template.object_type,
      object_id: input.object_id,
      logical_time: input.logical_time,
    }),
    determinism_hash: "",
    created_at: S3B_CREATED_AT_V1,
    payload: {
      ...structuredClone(input.template.payload),
      ...structuredClone(input.payload_patch),
    },
  };
  member.determinism_hash = computeMemberDeterminismHashV1(
    member as unknown as Record<string, unknown>,
  );
  return member;
}

function buildConflictingRecordSetV1(
  source: AssimilatedContinuationRecordSetV1,
): AssimilatedContinuationRecordSetV1 {
  const conflicting = structuredClone(source);
  const health = memberByTypeV1(conflicting.members, "twin_runtime_health_v1");
  health.limitations = [
    ...health.limitations,
    "S3B_ACCEPTANCE_CONFLICTING_RECORD_SET_CONTENT",
  ];
  health.determinism_hash = computeMemberDeterminismHashV1(
    health as unknown as Record<string, unknown>,
  );
  conflicting.aggregate_identity_input.member_determinism_hashes = Object.fromEntries(
    conflicting.members.map((member) => [member.object_type, member.determinism_hash]),
  ) as AssimilatedContinuationRecordSetV1["aggregate_identity_input"]["member_determinism_hashes"];
  conflicting.continuation_record_set_determinism_hash =
    computeAssimilatedContinuationRecordSetDeterminismHashV1(
      conflicting.aggregate_identity_input,
    );
  return conflicting;
}

export async function buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1() {
  const source = await buildMcftCap03AssimilatedRecordSetBuilderFixtureV1();
  const cap02StateTemplate = memberByTypeV1(
    source.continuationRecordSet.members,
    "twin_state_estimate_v1",
  );
  const cap02ForecastTemplate = memberByTypeV1(
    source.continuationRecordSet.members,
    "twin_forecast_run_v1",
  );
  const cap02CheckpointTemplate = memberByTypeV1(
    source.continuationRecordSet.members,
    "twin_runtime_checkpoint_v1",
  );

  const predecessorState = clonePredecessorMemberV1({
    template: cap02StateTemplate,
    object_id: deriveSemanticObjectIdV1("s3b_cap02_final_state", {
      scope: source.scope,
      logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    }),
    logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    payload_patch: {},
  });
  const predecessorForecast = clonePredecessorMemberV1({
    template: cap02ForecastTemplate,
    object_id: deriveSemanticObjectIdV1("s3b_cap02_final_forecast", {
      scope: source.scope,
      logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    }),
    logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    payload_patch: {
      status: "BLOCKED",
      points: [],
      scenario_eligible: false,
      source_posterior_ref: predecessorState.object_id,
      successful_forecast_ref: null,
    },
  });
  const predecessorCheckpoint = clonePredecessorMemberV1({
    template: cap02CheckpointTemplate,
    object_id: deriveSemanticObjectIdV1("s3b_cap02_final_checkpoint", {
      scope: source.scope,
      logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    }),
    logical_time: S3B_PREDECESSOR_LOGICAL_TIME_V1,
    payload_patch: {
      checkpoint_kind: "CONTINUATION",
      tick_sequence: 24,
      last_posterior_state_ref: predecessorState.object_id,
      forecast_result_ref: predecessorForecast.object_id,
      successful_forecast_ref: null,
      next_tick_logical_time: S3B_LOGICAL_TIME_V1,
    },
  });

  const cap03Lock: McftCap03PredecessorLockV1 = {
    ...structuredClone(source.cap03Lock),
    canonical_identity: {
      ...structuredClone(source.cap03Lock.canonical_identity),
      latest_state_ref: predecessorState.object_id,
      latest_state_hash: predecessorState.determinism_hash,
      latest_checkpoint_ref: predecessorCheckpoint.object_id,
      latest_checkpoint_hash: predecessorCheckpoint.determinism_hash,
      latest_forecast_result_ref: predecessorForecast.object_id,
      latest_forecast_result_hash: predecessorForecast.determinism_hash,
      latest_successful_forecast_ref: null,
    },
  };

  const assimilatedRuntimeConfig =
    compileAssimilatedContinuationRuntimeConfigFromAuthorityV1({
      predecessor_lock: cap03Lock,
      predecessor_latest_state: predecessorState,
      parent_runtime_config: source.continuationRuntimeConfig,
      reality_artifact: source.reality,
      source_matrix_artifact: source.sourceMatrix,
      configuration_matrix_artifact: source.configurationMatrix,
      logical_time: S3B_LOGICAL_TIME_V1,
      created_at: S3B_CREATED_AT_V1,
    });

  const handoff: PreparedNextTickInputV1 = {
    ...structuredClone(source.handoff),
    active_lineage_ref: cap03Lock.canonical_identity.active_lineage_ref,
    previous_posterior_ref: predecessorState.object_id,
    previous_posterior_hash: predecessorState.determinism_hash,
    previous_checkpoint_ref: predecessorCheckpoint.object_id,
    previous_checkpoint_hash: predecessorCheckpoint.determinism_hash,
    previous_forecast_result_ref: predecessorForecast.object_id,
    lineage_id: cap03Lock.canonical_identity.lineage_id,
    revision_id: cap03Lock.canonical_identity.revision_id,
    previous_tick_sequence: 24,
    next_logical_tick_time: S3B_LOGICAL_TIME_V1,
    previous_state_runtime_config_ref: predecessorState.runtime_config_ref ?? "",
    previous_state_runtime_config_hash: predecessorState.runtime_config_hash ?? "",
    reality_binding_ref: String(assimilatedRuntimeConfig.payload.reality_binding_ref),
    reality_binding_hash: String(assimilatedRuntimeConfig.payload.reality_binding_hash),
  };

  const recordSet = buildAssimilatedContinuationRecordSetV1({
    scope: source.scope,
    logical_time: S3B_LOGICAL_TIME_V1,
    created_at: S3B_CREATED_AT_V1,
    handoff,
    previous_forecast_result_hash: predecessorForecast.determinism_hash,
    runtime_config: assimilatedRuntimeConfig,
    evidence_window: source.evidenceWindow,
    dynamics: source.dynamics,
    assimilation: source.assimilation,
  });
  const conflictingRecordSet = buildConflictingRecordSetV1(recordSet);
  const expected: ContinuationExpectedPointersV1 = {
    active_lineage_ref: cap03Lock.canonical_identity.active_lineage_ref,
    lineage_id: cap03Lock.canonical_identity.lineage_id,
    revision_id: cap03Lock.canonical_identity.revision_id,
    previous_checkpoint_ref: predecessorCheckpoint.object_id,
    previous_state_ref: predecessorState.object_id,
    previous_forecast_result_ref: predecessorForecast.object_id,
    latest_successful_forecast_ref: null,
  };

  return {
    ...source,
    cap03Lock,
    assimilatedRuntimeConfig,
    predecessorState,
    predecessorForecast,
    predecessorCheckpoint,
    handoff,
    recordSet,
    conflictingRecordSet,
    expected,
  };
}
