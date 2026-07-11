// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER_NEGATIVE.ts
// Purpose: prove fail-closed S3A behavior for malformed graph references, Evidence classifications, posterior State mismatch, discriminator mismatch, and historical dispatch confusion.
// Boundary: in-memory negative acceptance only; no database, persistence, lease, Runtime tick execution, route, scheduler, or production claim.

import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  computeAssimilatedContinuationRecordSetDeterminismHashV1,
  type AssimilatedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import type { ContinuationMemberObjectTypeV1 } from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import { validateVersionedContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import { buildAssimilatedContinuationRecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.js";
import { buildMcftCap03AssimilatedRecordSetBuilderFixtureV1 } from "./mcft_cap_03_assimilated_record_set_builder_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function expectThrowV1(run: () => unknown, expected: string, message: string): void {
  try {
    run();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && error.message.includes(expected), message);
  }
}

function mutateMemberV1(
  original: AssimilatedContinuationRecordSetV1,
  objectType: ContinuationMemberObjectTypeV1,
  mutate: (payload: Record<string, unknown>) => void,
): AssimilatedContinuationRecordSetV1 {
  const clone = structuredClone(original);
  const member = clone.members.find((candidate) => candidate.object_type === objectType);
  if (!member) throw new Error(`NEGATIVE_MEMBER_NOT_FOUND:${objectType}`);
  mutate(member.payload);
  member.determinism_hash = computeMemberDeterminismHashV1(
    member as unknown as Record<string, unknown>,
  );
  clone.aggregate_identity_input.member_determinism_hashes[objectType]
    = member.determinism_hash;
  clone.continuation_record_set_determinism_hash
    = computeAssimilatedContinuationRecordSetDeterminismHashV1(
      clone.aggregate_identity_input,
    );
  return clone;
}

async function mainV1(): Promise<void> {
  const fixture = await buildMcftCap03AssimilatedRecordSetBuilderFixtureV1();
  const original = fixture.recordSet;

  const consumedUnionMismatch = mutateMemberV1(
    original,
    "twin_evidence_window_v1",
    (payload) => {
      payload.consumed_evidence_refs = [];
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(consumedUnionMismatch),
    "ASSIMILATED_EVIDENCE_CONSUMED_UNION_MISMATCH",
    "Evidence consumed refs cannot omit an applied observation",
  );

  const candidateTraceMismatch = mutateMemberV1(
    original,
    "twin_evidence_window_v1",
    (payload) => {
      const selection = payload.observation_selection as Record<string, unknown>;
      selection.candidates = [];
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(candidateTraceMismatch),
    "ASSIMILATED_EVIDENCE_CANDIDATE_TRACE_MISMATCH",
    "Evidence candidate trace must equal the assimilation object trace",
  );

  const posteriorMeanMismatch = mutateMemberV1(
    original,
    "twin_state_estimate_v1",
    (payload) => {
      const vwc = payload.root_zone_vwc_fraction as Record<string, unknown>;
      vwc.mean = Number(vwc.mean) + 0.01;
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(posteriorMeanMismatch),
    "ASSIMILATED_STATE_POSTERIOR_MEAN_MISMATCH",
    "State cannot publish a mean different from the assimilation posterior",
  );

  const transitionStateMismatch = mutateMemberV1(
    original,
    "twin_state_transition_v1",
    (payload) => {
      payload.posterior_state_ref = "twin_state_estimate_wrong";
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(transitionStateMismatch),
    "ASSIMILATED_TRANSITION_STATE_REF_MISMATCH",
    "transition posterior reference must resolve inside the same aggregate",
  );

  const successfulForecastForbidden = mutateMemberV1(
    original,
    "twin_forecast_run_v1",
    (payload) => {
      payload.successful_forecast_ref = "forecast_success_forbidden";
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(successfulForecastForbidden),
    "ASSIMILATED_FORECAST_SUCCESS_REF_FORBIDDEN",
    "S3A cannot publish a successful Forecast reference",
  );

  const discriminatorMismatch = mutateMemberV1(
    original,
    "twin_runtime_tick_v1",
    (payload) => {
      payload.record_set_contract_id = "MCFT_CAP_02_CONTINUATION_V1";
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(discriminatorMismatch),
    "UNKNOWN_RECORD_SET_CONTRACT",
    "unknown or mixed Tick discriminator fails closed",
  );

  const checkpointMismatch = mutateMemberV1(
    original,
    "twin_runtime_checkpoint_v1",
    (payload) => {
      payload.last_posterior_state_ref = "twin_state_estimate_wrong";
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(checkpointMismatch),
    "ASSIMILATED_CHECKPOINT_STATE_REF_MISMATCH",
    "Checkpoint must advance to the same aggregate posterior State",
  );

  const healthMismatch = mutateMemberV1(
    original,
    "twin_runtime_health_v1",
    (payload) => {
      payload.operation_status = "CONTINUATION_STATE_PROPAGATED_WITHOUT_USABLE_OBSERVATION";
    },
  );
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(healthMismatch),
    "ASSIMILATED_HEALTH_STATUS_DISPOSITION_MISMATCH",
    "Health status must match the assimilation disposition",
  );

  const directHashMismatch = structuredClone(original);
  const directState = directHashMismatch.members.find(
    (member) => member.object_type === "twin_state_estimate_v1",
  );
  if (!directState) throw new Error("NEGATIVE_STATE_NOT_FOUND");
  directState.payload.state_kind = "PRIOR";
  expectThrowV1(
    () => validateAssimilatedContinuationCrossReferencesV1(directHashMismatch),
    "ASSIMILATED_MEMBER_HASH_MISMATCH",
    "member mutation without rehash is rejected before cross-reference validation",
  );

  expectThrowV1(
    () => validateVersionedContinuationRecordSetV1({
      record_set: original,
      runtime_config: fixture.continuationRuntimeConfig,
    }),
    "VALIDATOR_DISPATCH_RUNTIME_CONFIG_REF_MISMATCH",
    "CAP-03 record set cannot be validated under the historical CAP-02 config",
  );

  expectThrowV1(
    () => buildAssimilatedContinuationRecordSetV1({
      scope: fixture.scope,
      logical_time: fixture.logicalTime,
      created_at: fixture.createdAt,
      handoff: {
        ...fixture.handoff,
        field_id: "field_wrong",
      },
      previous_forecast_result_hash:
        fixture.cap03Lock.canonical_identity.latest_forecast_result_hash,
      runtime_config: fixture.assimilatedRuntimeConfig,
      evidence_window: fixture.evidenceWindow,
      dynamics: fixture.dynamics,
      assimilation: fixture.assimilation,
    }),
    "ASSIMILATED_BUILDER_HANDOFF_SCOPE_MISMATCH",
    "builder rejects handoff scope drift before constructing members",
  );

  expectThrowV1(
    () => buildAssimilatedContinuationRecordSetV1({
      scope: fixture.scope,
      logical_time: fixture.logicalTime,
      created_at: fixture.createdAt,
      handoff: {
        ...fixture.handoff,
        reality_binding_hash: "sha256:wrong_reality_binding",
      },
      previous_forecast_result_hash:
        fixture.cap03Lock.canonical_identity.latest_forecast_result_hash,
      runtime_config: fixture.assimilatedRuntimeConfig,
      evidence_window: fixture.evidenceWindow,
      dynamics: fixture.dynamics,
      assimilation: fixture.assimilation,
    }),
    "ASSIMILATED_BUILDER_REALITY_BINDING_MISMATCH",
    "builder rejects Runtime Config and handoff Reality Binding divergence",
  );

  console.log(
    `MCFT-CAP-03 assimilated record-set builder negative: ${pass} PASS, ${fail} FAIL`,
  );
  if (fail) process.exitCode = 1;
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
