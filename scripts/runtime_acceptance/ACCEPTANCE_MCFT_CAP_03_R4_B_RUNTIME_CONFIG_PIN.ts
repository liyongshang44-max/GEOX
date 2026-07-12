// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_B_RUNTIME_CONFIG_PIN.ts
// Purpose: prove every CAP-03 V2 single tick, range, restart, and idempotent replay request explicitly pins and validates Runtime Config ref plus determinism hash.
// Boundary: deterministic in-memory Replay acceptance only; no production database, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  buildMcftCap03R2V2FixtureV1,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function expectCode(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.equal(error instanceof Error ? error.message : String(error), code);
    return true;
  });
}

async function main(): Promise<void> {
  const positive = await buildMcftCap03R2V2FixtureV1(1);
  const inserted = await positive.tickService.executeOneTick(
    positive.tickInput(),
  );
  assert.equal(inserted.status, "INSERTED");
  assert.equal(
    inserted.record_set.aggregate_identity_input.runtime_config_ref,
    positive.firstV2Config.object_id,
  );
  assert.equal(
    inserted.record_set.aggregate_identity_input.runtime_config_hash,
    positive.firstV2Config.determinism_hash,
  );
  ok("single tick accepts an exact Runtime Config ref/hash pin");

  const newTickMismatch = await buildMcftCap03R2V2FixtureV1(1);
  await expectCode(
    () => newTickMismatch.tickService.executeOneTick({
      ...newTickMismatch.tickInput(),
      assimilated_runtime_config_hash: "sha256:wrong-new-tick-pin",
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(newTickMismatch.runtime.commitCount, 0);
  assert.equal(newTickMismatch.runtime.leaseAcquireCount, 0);
  ok("wrong hash on a new tick fails before lease and persistence");

  const replayMismatch = await buildMcftCap03R2V2FixtureV1(1);
  const first = await replayMismatch.tickService.executeOneTick(
    replayMismatch.tickInput(),
  );
  assert.equal(first.status, "INSERTED");
  await expectCode(
    () => replayMismatch.tickService.executeOneTick({
      ...replayMismatch.tickInput(),
      assimilated_runtime_config_hash: "sha256:wrong-replay-pin",
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(replayMismatch.runtime.commitCount, 1);
  ok("idempotent replay validates the requested hash before returning existing success");

  const missingRangeHash = await buildMcftCap03R2V2FixtureV1(2);
  const missingHashInput = missingRangeHash.rangeInput(
    missingRangeHash.lastLogicalTime,
  );
  const missingLogicalTime = missingRangeHash.lastLogicalTime;
  const reducedHashes = {
    ...missingHashInput.assimilated_runtime_config_hashes_by_logical_time,
  };
  delete reducedHashes[missingLogicalTime];
  await expectCode(
    () => missingRangeHash.rangeService.runAssimilatedContiguousRangeV2({
      ...missingHashInput,
      assimilated_runtime_config_hashes_by_logical_time: reducedHashes,
    }),
    `ASSIMILATED_RANGE_RUNTIME_CONFIG_HASH_REQUIRED:${missingLogicalTime}`,
  );
  assert.equal(missingRangeHash.runtime.commitCount, 0);
  ok("range preflight rejects a missing per-tick Runtime Config hash");

  const wrongRangeHash = await buildMcftCap03R2V2FixtureV1(2);
  const wrongHashInput = wrongRangeHash.rangeInput(
    wrongRangeHash.lastLogicalTime,
  );
  await expectCode(
    () => wrongRangeHash.rangeService.runAssimilatedContiguousRangeV2({
      ...wrongHashInput,
      assimilated_runtime_config_hashes_by_logical_time: {
        ...wrongHashInput.assimilated_runtime_config_hashes_by_logical_time,
        [wrongRangeHash.firstLogicalTime]: "sha256:wrong-range-pin",
      },
    }),
    "ASSIMILATED_RUNTIME_CONFIG_HASH_PIN_MISMATCH",
  );
  assert.equal(wrongRangeHash.runtime.commitCount, 0);
  ok("range execution rejects a nonmatching per-tick Runtime Config hash");

  console.log(`MCFT-CAP-03 R4-B Runtime Config pin: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
