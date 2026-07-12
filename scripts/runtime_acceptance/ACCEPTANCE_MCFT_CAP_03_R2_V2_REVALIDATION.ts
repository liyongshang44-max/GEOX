// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION.ts
// Purpose: prove the additive R2 V2 Runtime Config, A2 builder/validator/dispatch, one real V2 tick, 24 contiguous ticks, restart resume, and bounded forward-backfill hash equivalence.
// Boundary: deterministic in-memory Replay acceptance only; no production database, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import {
  validateAssimilatedContinuationCrossReferencesV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v2.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.js";
import {
  validateVersionedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import {
  addHoursR2V2,
  buildMcftCap03R2V2FixtureV1,
  memberR2V2,
  R2_V2_STANDARD_TICK_COUNT,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const single =
    await buildMcftCap03R2V2FixtureV1(1);

  validateAssimilatedContinuationRuntimeConfigPayloadV2(
    single.firstV2Config.payload,
  );
  ok("V2 Runtime Config validates with explicit V2 discriminators");

  const first =
    await single.tickService.executeOneTick(
      single.tickInput(),
    );

  assert.equal(first.status, "INSERTED");
  assert.equal(
    first.record_set.record_set_contract_id,
    ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
  );
  assert.equal(first.record_set.members.length, 8);
  validateAssimilatedContinuationCrossReferencesV2(
    first.record_set,
  );
  ok("one real V2 tick commits one valid eight-object A2 record set");

  const tick = memberR2V2(
    first.record_set,
    "twin_runtime_tick_v1",
  );
  const forecast = memberR2V2(
    first.record_set,
    "twin_forecast_run_v1",
  );
  assert.equal(
    tick.payload.record_set_contract_id,
    ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
  );
  assert.equal(forecast.payload.status, "BLOCKED");
  assert.equal(
    forecast.payload.successful_forecast_ref,
    null,
  );
  ok("V2 discriminator is committed while Forecast remains blocked");

  const v2Dispatch =
    validateVersionedContinuationRecordSetV1({
      record_set: first.record_set,
      runtime_config: single.firstV2Config,
    });
  assert.equal(
    v2Dispatch.contract_id,
    ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V2,
  );
  ok("versioned dispatch accepts CAP-03 V2 explicitly");

  const v1Dispatch =
    validateVersionedContinuationRecordSetV1({
      record_set: single.source.recordSet,
      runtime_config:
        single.source.assimilatedRuntimeConfig,
    });
  assert.equal(
    v1Dispatch.contract_id,
    "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
  );
  ok("historical CAP-03 V1 dispatch remains valid");

  const replay =
    await single.tickService.executeOneTick(
      single.tickInput(),
    );
  assert.equal(
    replay.status,
    "EXISTING_IDEMPOTENT_SUCCESS",
  );
  assert.equal(
    replay.record_set
      .continuation_record_set_determinism_hash,
    first.record_set
      .continuation_record_set_determinism_hash,
  );
  ok("same V2 tick replay is idempotent before a second write");

  const range =
    await buildMcftCap03R2V2FixtureV1(
      R2_V2_STANDARD_TICK_COUNT,
    );
  const rangeResult =
    await range.rangeService
      .runAssimilatedContiguousRangeV2(
        range.rangeInput(range.lastLogicalTime),
      );

  assert.equal(rangeResult.status, "COMPLETED");
  assert.equal(
    rangeResult.executed_tick_count,
    R2_V2_STANDARD_TICK_COUNT,
  );
  assert.equal(
    rangeResult.final_handoff.previous_tick_sequence,
    24 + R2_V2_STANDARD_TICK_COUNT,
  );
  ok("24 contiguous V2 ticks complete through the dedicated V2 range service");

  const direct =
    await buildMcftCap03R2V2FixtureV1(4);
  const directResult =
    await direct.rangeService
      .runAssimilatedContiguousRangeV2(
        direct.rangeInput(direct.lastLogicalTime),
      );

  const resumed =
    await buildMcftCap03R2V2FixtureV1(4);
  await resumed.rangeService
    .runAssimilatedContiguousRangeV2(
      resumed.rangeInput(
        addHoursR2V2(
          resumed.firstLogicalTime,
          1,
        ),
      ),
    );

  const resumeResult =
    await resumed.restartService
      .resumeAssimilatedFromCheckpointV2(
        resumed.rangeInput(resumed.lastLogicalTime),
      );

  assert.equal(
    resumeResult.operator_intent,
    "RESUME",
  );

  const directHash =
    directResult.tick_results.at(-1)?.record_set
      .continuation_record_set_determinism_hash;
  const resumedHash =
    resumeResult.range_result.tick_results.at(-1)
      ?.record_set
      .continuation_record_set_determinism_hash;

  assert.equal(resumedHash, directHash);
  ok("restart resume reaches the same terminal V2 record-set hash as uninterrupted execution");

  const backfill =
    await buildMcftCap03R2V2FixtureV1(4);
  await backfill.tickService.executeOneTick(
    backfill.tickInput(),
  );

  const backfillResult =
    await backfill.restartService
      .runAssimilatedBoundedBackfillV2({
        ...backfill.rangeInput(
          backfill.lastLogicalTime,
        ),
        evidence_intent:
          "MISSED_SCHEDULE_CATCH_UP",
        requested_start_logical_time:
          addHoursR2V2(
            backfill.firstLogicalTime,
            1,
          ),
      });

  assert.equal(
    backfillResult.operator_intent,
    "BACKFILL",
  );
  assert.equal(
    backfillResult.range_result.tick_results.at(-1)
      ?.record_set
      .continuation_record_set_determinism_hash,
    directHash,
  );
  ok("bounded forward backfill reaches the same deterministic terminal hash");

  console.log(
    `MCFT-CAP-03 R2 V2 positive: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
