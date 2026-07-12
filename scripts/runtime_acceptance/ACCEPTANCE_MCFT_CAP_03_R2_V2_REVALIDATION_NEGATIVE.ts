// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_R2_V2_REVALIDATION_NEGATIVE.ts
// Purpose: prove R2 V2 validators and runtime services fail closed on semantic-hash tampering, version-dispatch mismatch, over-range execution, forbidden late-evidence backfill, and same-operation-key V1/V2 dual write.
// Boundary: deterministic in-memory negative acceptance only; no database mutation, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import {
  validateAssimilatedObservationCandidateV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.js";
import {
  validateVersionedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import {
  assertNoSameOperationKeyVersionConflictV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import {
  addHoursR2V2,
  buildMcftCap03R2V2FixtureV1,
  memberR2V2,
} from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function expectCode(
  action: () => unknown,
  code: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.equal(
      error instanceof Error ? error.message : String(error),
      code,
    );
    return true;
  });
}

async function expectCodeAsync(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.equal(
      error instanceof Error ? error.message : String(error),
      code,
    );
    return true;
  });
}

async function main(): Promise<void> {
  const fixture =
    await buildMcftCap03R2V2FixtureV1(24);

  const invalidConfig =
    structuredClone(fixture.firstV2Config.payload);
  invalidConfig.record_set_contract_id =
    "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1";

  expectCode(
    () =>
      validateAssimilatedContinuationRuntimeConfigPayloadV2(
        invalidConfig,
      ),
    "ASSIMILATED_CONFIG_RECORD_SET_CONTRACT_MISMATCH",
  );
  ok("V2 Runtime Config rejects a V1 record-set discriminator");

  const result =
    await fixture.tickService.executeOneTick(
      fixture.tickInput(),
    );

  const update = memberR2V2(
    result.record_set,
    "twin_assimilation_update_v1",
  );
  const candidates =
    update.payload.candidate_observations as
      Array<Record<string, unknown>>;
  const tampered = structuredClone(candidates[0]);
  tampered.observation_semantic_content_hash =
    "sha256:tampered";

  expectCode(
    () =>
      validateAssimilatedObservationCandidateV2(
        tampered,
      ),
    "ASSIMILATION_V2_CANDIDATE_SEMANTIC_CONTENT_HASH_MISMATCH",
  );
  ok("committed V2 candidate semantic hash is independently recomputable");

  expectCode(
    () =>
      validateVersionedContinuationRecordSetV1({
        record_set: result.record_set,
        runtime_config:
          fixture.source.assimilatedRuntimeConfig,
      }),
    "VALIDATOR_DISPATCH_RUNTIME_CONFIG_REF_MISMATCH",
  );
  ok("versioned dispatch rejects mismatched V1 config authority before contract dispatch");

  const overRange =
    await buildMcftCap03R2V2FixtureV1(24);

  await expectCodeAsync(
    () =>
      overRange.rangeService
        .runAssimilatedContiguousRangeV2({
          ...overRange.rangeInput(
            addHoursR2V2(
              overRange.firstLogicalTime,
              23,
            ),
          ),
          to_logical_time:
            addHoursR2V2(
              overRange.firstLogicalTime,
              24,
            ),
        }),
    "ASSIMILATED_RANGE_MAX_TICKS_EXCEEDED",
  );
  ok("V2 range rejects requests above the frozen 24-tick maximum");

  const lateEvidence =
    await buildMcftCap03R2V2FixtureV1(2);
  await lateEvidence.tickService.executeOneTick(
    lateEvidence.tickInput(),
  );

  await expectCodeAsync(
    () =>
      lateEvidence.restartService
        .runAssimilatedBoundedBackfillV2({
          ...lateEvidence.rangeInput(
            lateEvidence.lastLogicalTime,
          ),
          evidence_intent:
            "LATE_EVIDENCE_REVISION",
          requested_start_logical_time:
            addHoursR2V2(
              lateEvidence.firstLogicalTime,
              1,
            ),
        }),
    "LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN",
  );
  ok("V2 backfill rejects late-evidence revision semantics");

  expectCode(
    () =>
      assertNoSameOperationKeyVersionConflictV1({
        existing_contract_id:
          "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
        requested_contract_id:
          "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2",
      }),
    "VERSIONED_CONTINUATION_SAME_OPERATION_KEY_DUAL_WRITE_FORBIDDEN",
  );
  ok("same operation key cannot be dual-written across V1 and V2");

  console.log(
    `MCFT-CAP-03 R2 V2 negative: ${pass} PASS, 0 FAIL`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
