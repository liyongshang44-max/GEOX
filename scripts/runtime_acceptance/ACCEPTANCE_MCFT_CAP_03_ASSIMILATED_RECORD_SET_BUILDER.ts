// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER.ts
// Purpose: prove deterministic pure construction of the CAP-03 eight-object record set, complete cross-reference validation, posterior State publication, and versioned dispatch compatibility.
// Boundary: in-memory acceptance only; no database, persistence, lease, Runtime tick execution, route, scheduler, range, or live-field claim.

import {
  computeAssimilatedContinuationRecordSetDeterminismHashV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
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

function memberV1(
  recordSet: Awaited<
    ReturnType<typeof buildMcftCap03AssimilatedRecordSetBuilderFixtureV1>
  >["recordSet"],
  objectType: string,
) {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`ACCEPTANCE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

async function mainV1(): Promise<void> {
  const fixture = await buildMcftCap03AssimilatedRecordSetBuilderFixtureV1();
  const recordSet = fixture.recordSet;
  validateAssimilatedContinuationCrossReferencesV1(recordSet);
  check(recordSet.members.length === 8, "builder emits exactly eight canonical objects");
  check(
    recordSet.record_set_contract_id === "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
    "record set publishes the CAP-03 contract discriminator",
  );
  check(
    recordSet.continuation_record_set_determinism_hash
      === computeAssimilatedContinuationRecordSetDeterminismHashV1(
        recordSet.aggregate_identity_input,
      ),
    "aggregate determinism hash is independently reproducible",
  );

  const rebuilt = buildAssimilatedContinuationRecordSetV1({
    scope: fixture.scope,
    logical_time: fixture.logicalTime,
    created_at: fixture.createdAt,
    handoff: fixture.handoff,
    previous_forecast_result_hash:
      fixture.cap03Lock.canonical_identity.latest_forecast_result_hash,
    runtime_config: fixture.assimilatedRuntimeConfig,
    evidence_window: fixture.evidenceWindow,
    dynamics: fixture.dynamics,
    assimilation: fixture.assimilation,
  });
  check(
    rebuilt.continuation_record_set_determinism_hash
      === recordSet.continuation_record_set_determinism_hash,
    "same canonical inputs reproduce the same aggregate hash",
  );
  check(
    JSON.stringify(rebuilt.members) === JSON.stringify(recordSet.members),
    "same canonical inputs reproduce byte-equivalent member payloads",
  );

  const evidence = memberV1(recordSet, "twin_evidence_window_v1");
  const assimilation = memberV1(recordSet, "twin_assimilation_update_v1");
  const state = memberV1(recordSet, "twin_state_estimate_v1");
  const forecast = memberV1(recordSet, "twin_forecast_run_v1");
  const tick = memberV1(recordSet, "twin_runtime_tick_v1");
  const checkpoint = memberV1(recordSet, "twin_runtime_checkpoint_v1");
  const health = memberV1(recordSet, "twin_runtime_health_v1");

  check(
    evidence.payload.evidence_window_contract_id
      === "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1",
    "canonical Evidence Window publishes the independent CAP-03 contract",
  );
  check(
    JSON.stringify(evidence.payload.assimilation_applied_evidence_refs)
      === JSON.stringify(fixture.assimilation.applied_observation_refs),
    "Evidence Window applied refs equal the pure assimilation result",
  );
  check(
    (evidence.payload.consumed_evidence_refs as string[]).includes(
      fixture.observation.source_record_id,
    ),
    "accepted observation enters the canonical consumed Evidence union",
  );
  check(
    assimilation.payload.innovation === assimilation.payload.residual
      && assimilation.payload.residual_kind === "STATE_OBSERVATION_INNOVATION",
    "assimilation object preserves innovation and residual identity",
  );
  check(
    assimilation.payload.posterior_state_ref === state.object_id,
    "assimilation object references the same aggregate posterior State",
  );

  const stateVwc = state.payload.root_zone_vwc_fraction as Record<string, unknown>;
  const computationBasis = state.payload.computation_basis as Record<string, unknown>;
  check(
    stateVwc.mean
      === Number(fixture.assimilation.canonical_decimal_basis.posterior_vwc_decimal.value)
      && stateVwc.variance
        === Number(
          fixture.assimilation.canonical_decimal_basis.posterior_vwc_variance_decimal.value,
        ),
    "State publishes the posterior mean and variance",
  );
  check(
    computationBasis.basis_origin === "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE"
      && computationBasis.previous_state_ref === fixture.predecessorState.object_id,
    "State computation basis carries the exact predecessor State",
  );
  check(
    (computationBasis.propagated_prior_storage_mean_mm_decimal as Record<string, unknown>)
      .value === fixture.dynamics.computation_basis.storage_mean_mm_decimal.value,
    "State basis keeps propagated prior storage separate from posterior storage",
  );
  check(
    (computationBasis.storage_mean_mm_decimal as Record<string, unknown>).value
      === fixture.assimilation.canonical_decimal_basis.storage_mean_mm_decimal.value,
    "State basis publishes posterior storage as next-tick authority",
  );

  check(
    forecast.payload.status === "BLOCKED"
      && Array.isArray(forecast.payload.points)
      && forecast.payload.points.length === 0
      && forecast.payload.successful_forecast_ref === null,
    "Forecast remains BLOCKED with no points or successful Forecast ref",
  );
  check(
    tick.payload.record_set_contract_id === "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
    "Runtime Tick carries the immutable record-set discriminator",
  );
  check(
    checkpoint.payload.tick_sequence === 25
      && checkpoint.payload.last_posterior_state_ref === state.object_id,
    "Checkpoint advances from predecessor sequence 24 to posterior sequence 25",
  );
  check(
    health.payload.operation_status
      === "CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST",
    "Health distinguishes an assimilated State with blocked Forecast",
  );

  const cap03Dispatch = validateVersionedContinuationRecordSetV1({
    record_set: recordSet,
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  check(
    cap03Dispatch.contract_id === "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
    "versioned dispatch selects the full CAP-03 cross-reference validator",
  );
  const cap02Dispatch = validateVersionedContinuationRecordSetV1({
    record_set: fixture.continuationRecordSet,
    runtime_config: fixture.continuationRuntimeConfig,
  });
  check(
    cap02Dispatch.contract_id === "MCFT_CAP_02_CONTINUATION_V1",
    "historical CAP-02 record-set dispatch remains unchanged",
  );

  console.log(`MCFT-CAP-03 assimilated record-set builder: ${pass} PASS, ${fail} FAIL`);
  if (fail) process.exitCode = 1;
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
