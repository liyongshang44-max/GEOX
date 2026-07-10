// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.ts
// Purpose: prove the MCFT-CAP-02 persistence candidate consumes a real A0 predecessor, preserves canonical continuation identity, and derives exactly the authorized five projection rows before PostgreSQL execution.
// Boundary: pure acceptance only; no database, lease, canonical write, projection mutation, tick orchestration, restart, range, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateA0RecordSetV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import {
  CONTINUATION_MEMBER_OBJECT_TYPES_V1,
  type ContinuationMemberObjectTypeV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import { buildContinuationProjectionRowsV1 } from "../../apps/server/src/projections/twin_runtime/projection_rebuilder_v1.js";
import { buildMcftCap02PersistenceFixtureV1 } from "./mcft_cap_02_persistence_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expected = JSON.parse(
  fs.readFileSync(path.join(ROOT, "fixtures/mcft/water_state/expected/MCFT_CAP_02_PERSISTENCE_FIXTURES.json"), "utf8"),
) as {
  identity_kind: string;
  expected: {
    canonical_member_count: number;
    canonical_member_types: string[];
    continuation_projection_count: number;
    projection_names: string[];
    first_continuation_logical_time: string;
    next_tick_logical_time: string;
    checkpoint_tick_sequence: number;
    forecast_status: string;
    successful_forecast_ref: null;
    same_key_same_hash_status: string;
    same_key_different_hash_error: string;
    rebuild_projection_count: number;
  };
};

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function memberByTypeV1(
  members: readonly { object_type: string; object_id: string; determinism_hash: string; lineage_id?: string; revision_id?: string; payload: Record<string, unknown> }[],
  objectType: ContinuationMemberObjectTypeV1 | "twin_runtime_lineage_v1",
) {
  const matches = members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1);
  return matches[0];
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap02PersistenceFixtureV1();
  validateA0RecordSetV1(fixture.a0RecordSet);
  ok("real MCFT-CAP-01 A0 predecessor record set validates");

  const a0Lineage = memberByTypeV1(fixture.a0RecordSet.members, "twin_runtime_lineage_v1");
  const a0State = memberByTypeV1(fixture.a0RecordSet.members, "twin_state_estimate_v1");
  const a0Checkpoint = memberByTypeV1(fixture.a0RecordSet.members, "twin_runtime_checkpoint_v1");
  const a0Forecast = memberByTypeV1(fixture.a0RecordSet.members, "twin_forecast_run_v1");
  assert.equal(a0Lineage.object_id, fixture.lock.active_lineage_object_ref);
  assert.equal(a0Lineage.lineage_id, fixture.lock.lineage_id);
  assert.equal(a0Lineage.revision_id, fixture.lock.revision_id);
  assert.equal(a0State.object_id, fixture.lock.bootstrap_state_ref);
  assert.equal(a0State.determinism_hash, fixture.lock.bootstrap_state_hash);
  assert.equal(a0Checkpoint.object_id, fixture.lock.bootstrap_checkpoint_ref);
  assert.equal(a0Checkpoint.determinism_hash, fixture.lock.bootstrap_checkpoint_hash);
  assert.equal(a0Forecast.object_id, a0Checkpoint.payload.forecast_result_ref);
  ok("A0 predecessor canonical identities exactly reproduce the frozen predecessor lock");

  assert.equal(fixture.parentRuntimeConfig.object_id, fixture.lock.bootstrap_runtime_config_ref);
  assert.equal(fixture.parentRuntimeConfig.determinism_hash, fixture.lock.bootstrap_runtime_config_hash);
  assert.equal(fixture.continuationRuntimeConfig.payload.parent_runtime_config_ref, fixture.parentRuntimeConfig.object_id);
  assert.equal(fixture.continuationRuntimeConfig.payload.parent_runtime_config_hash, fixture.parentRuntimeConfig.determinism_hash);
  ok("continuation Runtime Config is pinned to the persisted predecessor config identity");

  validateContinuationRecordSetV1(fixture.continuationRecordSet);
  assert.equal(fixture.continuationRecordSet.members.length, expected.expected.canonical_member_count);
  assert.deepEqual(
    fixture.continuationRecordSet.members.map((member) => member.object_type).sort(),
    [...expected.expected.canonical_member_types].sort(),
  );
  assert.deepEqual(
    fixture.continuationRecordSet.members.map((member) => member.object_type).sort(),
    [...CONTINUATION_MEMBER_OBJECT_TYPES_V1].sort(),
  );
  ok("complete A2 eight-object candidate record set validates");

  assert.equal(fixture.continuationRecordSet.continuation_operation_key.logical_time, expected.expected.first_continuation_logical_time);
  assert.equal(fixture.continuationRecordSet.continuation_operation_key.operation_variant, "A2_BLOCKED_FORECAST");
  assert.equal(fixture.continuationRecordSet.continuation_operation_key.lineage_id, fixture.lock.lineage_id);
  assert.equal(fixture.continuationRecordSet.continuation_operation_key.revision_id, fixture.lock.revision_id);
  ok("A2 operation key preserves active lineage, revision, logical hour, and frozen operation variant");

  const rows = buildContinuationProjectionRowsV1(
    fixture.continuationRecordSet.members.map((object) => ({ fact_id: `fact_${object.object_id}`, object })),
  );
  assert.equal(Object.keys(rows).length, expected.expected.continuation_projection_count);
  assert.deepEqual(Object.keys(rows).sort(), [...expected.expected.projection_names].sort());
  assert.ok(!("active_lineage" in rows));
  assert.ok(!("successful_forecast_latest" in rows));
  ok("continuation projection mapper derives exactly five rows without lineage or successful-Forecast mutation");

  const continuationState = memberByTypeV1(fixture.continuationRecordSet.members, "twin_state_estimate_v1");
  const continuationCheckpoint = memberByTypeV1(fixture.continuationRecordSet.members, "twin_runtime_checkpoint_v1");
  const continuationForecast = memberByTypeV1(fixture.continuationRecordSet.members, "twin_forecast_run_v1");
  assert.equal(continuationState.payload.previous_posterior_ref, fixture.lock.bootstrap_state_ref);
  assert.equal(continuationCheckpoint.payload.previous_checkpoint_ref, fixture.lock.bootstrap_checkpoint_ref);
  assert.equal(continuationCheckpoint.payload.tick_sequence, expected.expected.checkpoint_tick_sequence);
  assert.equal(continuationCheckpoint.payload.next_tick_logical_time, expected.expected.next_tick_logical_time);
  assert.equal(continuationForecast.payload.status, expected.expected.forecast_status);
  assert.equal(continuationForecast.payload.successful_forecast_ref, expected.expected.successful_forecast_ref);
  ok("first continuation pointers, checkpoint sequence, next hour, and BLOCKED Forecast are exact");

  validateContinuationRecordSetV1(fixture.conflictingContinuationRecordSet);
  assert.equal(
    fixture.conflictingContinuationRecordSet.continuation_idempotency_key,
    fixture.continuationRecordSet.continuation_idempotency_key,
  );
  assert.equal(
    fixture.conflictingContinuationRecordSet.continuation_record_set_id,
    fixture.continuationRecordSet.continuation_record_set_id,
  );
  assert.notEqual(
    fixture.conflictingContinuationRecordSet.continuation_record_set_determinism_hash,
    fixture.continuationRecordSet.continuation_record_set_determinism_hash,
  );
  ok("same operation key preserves A2 idempotency identity while different Evidence changes aggregate hash");

  assert.equal(expected.identity_kind, "A2_RECORD_SET");
  assert.equal(expected.expected.same_key_same_hash_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(expected.expected.same_key_different_hash_error, "IDEMPOTENCY_CONFLICT");
  assert.equal(expected.expected.rebuild_projection_count, 5);
  ok("persistence fixture freezes A2 identity, idempotent replay, conflict, and rebuild semantics");

  console.log(`MCFT-CAP-02 persistence: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
