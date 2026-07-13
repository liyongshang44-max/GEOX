// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts
// Purpose: prove S6 fails closed on time, Runtime Config, crop-stage and forcing authority drift, distinguishes malformed FAILED from legal unavailable BLOCKED, commits A2 only for BLOCKED, and rejects a wrong Config pin on completed-idempotent paths.
// Boundary: in-memory negative/degraded-path acceptance only; no production database, route, scheduler, range, restart/backfill, recommendation, decision, or action.

import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

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

async function expectReject(
  action: () => Promise<unknown>,
  pattern: RegExp,
  message: string,
): Promise<void> {
  try {
    await action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && pattern.test(error.message), message);
  }
}

function candidateAuthorityV1(runtime: unknown): {
  candidateRecords: CanonicalReplayEvidenceRecordV1[];
} {
  return runtime as { candidateRecords: CanonicalReplayEvidenceRecordV1[] };
}

function memberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP04_S6_NEGATIVE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

async function main(): Promise<void> {
  const wrongTime = buildCap04S6SingleTickFixtureV1();
  await expectReject(
    () => wrongTime.service.executeOneTick({ ...wrongTime.input, logical_time: "2026-06-03T03:00:00.000Z" }),
    /CAP04_SINGLE_TICK_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK/,
    "requested T must equal the persisted next logical tick",
  );
  check(
    wrongTime.runtime.evidenceLoadCount === 0
      && wrongTime.runtime.leaseAcquireCount === 0
      && wrongTime.runtime.aCommitCount === 0,
    "wrong logical time fails before Evidence, lease and persistence",
  );

  const wrongConfigHash = buildCap04S6SingleTickFixtureV1();
  await expectReject(
    () => wrongConfigHash.service.executeOneTick({ ...wrongConfigHash.input, runtime_config_hash: "sha256:forged" }),
    /CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH/,
    "new tick rejects a forged Runtime Config hash pin",
  );
  check(
    wrongConfigHash.runtime.evidenceLoadCount === 0
      && wrongConfigHash.runtime.leaseAcquireCount === 0,
    "forged Runtime Config hash fails before Evidence and lease",
  );

  const noForcingAuthority = buildCap04S6SingleTickFixtureV1();
  await expectReject(
    () => noForcingAuthority.service.executeOneTick({ ...noForcingAuthority.input, authorized_future_forcing_binding_ids: [] }),
    /CAP04_SINGLE_TICK_FORCING_BINDING_AUTHORITY_REQUIRED/,
    "Future Forcing binding authority is mandatory",
  );
  check(noForcingAuthority.runtime.configReadCount === 0, "missing forcing authority fails before handoff and Config reads");

  const wrongCropMatrix = buildCap04S6SingleTickFixtureV1();
  await expectReject(
    () => wrongCropMatrix.service.executeOneTick({
      ...wrongCropMatrix.input,
      crop_stage_context: {
        ...wrongCropMatrix.crop_stage_context,
        configuration_matrix_hash: "sha256:forged",
      },
    }),
    /CAP04_SINGLE_TICK_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH/,
    "crop-stage configuration matrix drift is rejected",
  );
  check(
    wrongCropMatrix.runtime.evidenceLoadCount === 0
      && wrongCropMatrix.runtime.leaseAcquireCount === 0,
    "crop-stage matrix drift fails before Evidence and lease",
  );

  const blocked = buildCap04S6SingleTickFixtureV1();
  const blockedCandidates = candidateAuthorityV1(blocked.runtime);
  blockedCandidates.candidateRecords = blockedCandidates.candidateRecords.filter((record) =>
    record.record_type !== "future_weather_assumption_v1"
      && record.record_type !== "future_et0_assumption_v1"
  );
  const blockedResult = await blocked.service.executeOneTick(blocked.input);
  const blockedForecast = memberV1(blockedResult.a_record_set, "twin_forecast_run_v1");
  check(
    blockedResult.status === "BLOCKED_INSERTED"
      && blockedResult.b_record === null
      && blockedForecast.payload.status === "BLOCKED"
      && blockedForecast.payload.scenario_eligible === false
      && blockedForecast.payload.points.length === 0,
    "legal complete-pair unavailability commits one A2 with no Scenario",
  );
  check(
    blocked.runtime.aCommitCount === 1
      && blocked.runtime.bCommitCount === 0
      && blockedResult.next_handoff.latest_successful_forecast_ref === null,
    "A2 advances terminal handoff while preserving the prior successful-Forecast pointer",
  );

  const malformed = buildCap04S6SingleTickFixtureV1();
  const malformedCandidates = candidateAuthorityV1(malformed.runtime);
  const weather = malformedCandidates.candidateRecords.find((record) => record.record_type === "future_weather_assumption_v1");
  if (!weather || !Array.isArray(weather.canonical_payload.points)) throw new Error("CAP04_S6_MALFORMED_WEATHER_FIXTURE_MISSING");
  weather.canonical_payload.points = weather.canonical_payload.points.slice(0, 71);
  await expectReject(
    () => malformed.service.executeOneTick(malformed.input),
    /CAP04_SINGLE_TICK_FORCING_FAILED:MALFORMED_FORCING_RECORD:FORCING_POINTS_NOT_EXACT_72_HOURLY/,
    "malformed forcing is FAILED rather than degraded to BLOCKED",
  );
  check(
    malformed.runtime.aCommitCount === 0
      && malformed.runtime.bCommitCount === 0
      && malformed.runtime.leaseAcquireCount === 0,
    "malformed forcing creates no A1, A2 or B canonical write",
  );

  const completed = buildCap04S6SingleTickFixtureV1();
  await completed.service.executeOneTick(completed.input);
  const counters = {
    evidence: completed.runtime.evidenceLoadCount,
    config: completed.runtime.configReadCount,
    lease: completed.runtime.leaseAcquireCount,
    aCommit: completed.runtime.aCommitCount,
    bCommit: completed.runtime.bCommitCount,
  };
  await expectReject(
    () => completed.service.executeOneTick({ ...completed.input, runtime_config_hash: "sha256:forged" }),
    /CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH/,
    "completed-idempotent replay still enforces the requested Runtime Config hash",
  );
  check(
    completed.runtime.evidenceLoadCount === counters.evidence
      && completed.runtime.configReadCount === counters.config
      && completed.runtime.leaseAcquireCount === counters.lease
      && completed.runtime.aCommitCount === counters.aCommit
      && completed.runtime.bCommitCount === counters.bCommit,
    "wrong Config pin on completed replay fails without recomputation or writes",
  );

  const aFailure = buildCap04S6SingleTickFixtureV1();
  await expectReject(
    () => aFailure.service.executeOneTick({
      ...aFailure.input,
      fault_injection_a: (stage) => {
        if (stage === "before_commit") throw new Error("INJECTED_A_FAILURE");
      },
    }),
    /INJECTED_A_FAILURE/,
    "injected A1 failure is surfaced",
  );
  check(
    aFailure.runtime.aCommitCount === 0
      && aFailure.runtime.bCommitCount === 0
      && aFailure.runtime.currentSnapshotV1().checkpoint.payload.next_tick_logical_time === aFailure.input.logical_time,
    "A1 failure leaves predecessor handoff unchanged and never starts B",
  );

  console.log(`MCFT-CAP-04 single-tick integration negative: ${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
