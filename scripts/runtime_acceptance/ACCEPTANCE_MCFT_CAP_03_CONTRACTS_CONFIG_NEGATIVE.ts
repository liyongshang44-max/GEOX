// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_NEGATIVE.ts
// Purpose: prove unknown or mismatched contract/config combinations, invalid update combinations, forged config semantics, and predecessor-parent mismatches fail closed.
// Boundary: in-memory negative acceptance only; no PostgreSQL, A2 write, selector, assimilation math, route, scheduler, or production claim.

import assert from "node:assert/strict";
import {
  validateAssimilatedContinuationUpdatePayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  validateVersionedContinuationRecordSetV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import {
  compileAssimilatedContinuationRuntimeConfigFromAuthorityV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v1.js";
import {
  buildMcftCap03ContractsConfigFixtureV1,
  noUsableObservationUpdatePayloadV1,
} from "./mcft_cap_03_contracts_config_fixture_v1.js";

async function main(): Promise<void> {
  const fixture = await buildMcftCap03ContractsConfigFixtureV1();
  let pass = 0;
  const rejected = async (action: () => unknown | Promise<unknown>, pattern: RegExp, message: string): Promise<void> => {
    await assert.rejects(async () => action(), pattern);
    pass += 1;
    console.log(`PASS ${message}`);
  };

  const missingTickDiscriminator = structuredClone(fixture.assimilatedRecordSet);
  const tick = missingTickDiscriminator.members.find((member) => member.object_type === "twin_runtime_tick_v1");
  assert.ok(tick);
  delete tick.payload.record_set_contract_id;
  await rejected(
    () => validateVersionedContinuationRecordSetV1({
      record_set: missingTickDiscriminator,
      runtime_config: fixture.assimilatedRuntimeConfig,
    }),
    /UNKNOWN_RECORD_SET_CONTRACT/,
    "CAP-03 missing tick discriminator fails closed before any record-set acceptance",
  );

  const missingTopLevelDiscriminator = structuredClone(fixture.assimilatedRecordSet) as unknown as Record<string, unknown>;
  delete missingTopLevelDiscriminator.record_set_contract_id;
  await rejected(
    () => validateVersionedContinuationRecordSetV1({
      record_set: missingTopLevelDiscriminator as never,
      runtime_config: fixture.assimilatedRuntimeConfig,
    }),
    /VALIDATOR_DISPATCH_MISMATCH/,
    "CAP-03 top-level/tick discriminator mismatch fails closed",
  );

  const cap02WithCap03Discriminator = structuredClone(fixture.continuationRecordSet);
  const historicalTick = cap02WithCap03Discriminator.members.find((member) => member.object_type === "twin_runtime_tick_v1");
  assert.ok(historicalTick);
  historicalTick.payload.record_set_contract_id = "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1";
  await rejected(
    () => validateVersionedContinuationRecordSetV1({
      record_set: cap02WithCap03Discriminator,
      runtime_config: fixture.continuationRuntimeConfig,
    }),
    /VALIDATOR_DISPATCH_MISMATCH/,
    "historical CAP-02 config purpose cannot be paired with the CAP-03 discriminator",
  );

  const forgedPurpose = structuredClone(fixture.assimilatedRuntimeConfig);
  forgedPurpose.payload.config_purpose = "UNKNOWN_CONTINUATION_PURPOSE";
  await rejected(
    () => validateVersionedContinuationRecordSetV1({
      record_set: fixture.assimilatedRecordSet,
      runtime_config: forgedPurpose,
    }),
    /SEMANTIC_HASH_MISMATCH/,
    "forged Runtime Config purpose fails canonical hash validation",
  );

  const invalidWeights = structuredClone(fixture.assimilatedRuntimeConfig.payload);
  const assimilation = invalidWeights.observation_assimilation as Record<string, unknown>;
  assimilation.quality_weights = { PASS: 1, LIMITED: 0.5, FAIL: 0.1 };
  await rejected(
    () => validateAssimilatedContinuationRuntimeConfigPayloadV1(invalidWeights),
    /ASSIMILATED_FAIL_WEIGHT_MISMATCH/,
    "FAIL quality weight must remain exactly zero and cannot enter effective observation variance",
  );

  const invalidCombination = noUsableObservationUpdatePayloadV1({
    transition_ref: "transition_ref",
    state_ref: "state_ref",
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  invalidCombination.status = "APPLIED";
  await rejected(
    () => validateAssimilatedContinuationUpdatePayloadV1(invalidCombination),
    /ASSIMILATION_STATUS_DISPOSITION_COMBINATION_INVALID/,
    "illegal APPLIED/NO_USABLE_OBSERVATION combination is rejected",
  );

  const nonzeroNotAppliedCorrection = noUsableObservationUpdatePayloadV1({
    transition_ref: "transition_ref",
    state_ref: "state_ref",
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  nonzeroNotAppliedCorrection.state_correction_vwc = 0.001;
  await rejected(
    () => validateAssimilatedContinuationUpdatePayloadV1(nonzeroNotAppliedCorrection),
    /ASSIMILATION_NO_OBSERVATION_CORRECTION_NOT_ZERO/,
    "NOT_APPLIED update cannot publish a nonzero State correction",
  );

  const mismatchedState = structuredClone(fixture.predecessorState);
  mismatchedState.object_id = "twin_state_estimate_wrong_parent";
  await rejected(
    () => compileAssimilatedContinuationRuntimeConfigFromAuthorityV1({
      predecessor_lock: fixture.cap03Lock,
      predecessor_latest_state: mismatchedState,
      parent_runtime_config: fixture.continuationRuntimeConfig,
      reality_artifact: fixture.reality,
      source_matrix_artifact: fixture.sourceMatrix,
      configuration_matrix_artifact: fixture.configurationMatrix,
      logical_time: fixture.cap03Lock.expected_checkpoint.next_tick_logical_time,
      created_at: "2026-07-11T00:00:00.000Z",
    }),
    /SEMANTIC_HASH_MISMATCH|ASSIMILATED_PREDECESSOR_STATE_REF_MISMATCH/,
    "parent Runtime Config selection cannot bypass the predecessor latest-posterior lock",
  );

  console.log(`MCFT-CAP-03 contracts-config negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
