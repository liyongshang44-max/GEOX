// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY.ts
// Purpose: prove the CAP-03 assimilated record set is compatible with the shared A2 persistence contract, versioned readback dispatch, five projection rows, idempotency identity, and zero-migration boundary before PostgreSQL execution.
// Boundary: pure in-memory acceptance only; no database, lease, canonical write, Runtime tick orchestration, range execution, route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import { validateVersionedContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import { buildContinuationProjectionRowsV1 } from "../../apps/server/src/projections/twin_runtime/projection_rebuilder_v1.js";
import { buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1 } from "./mcft_cap_03_assimilated_persistence_recovery_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1();

  validateAssimilatedContinuationCrossReferencesV1(fixture.recordSet);
  assert.equal(fixture.recordSet.members.length, 8);
  ok("CAP-03 S3B fixture is a valid eight-object assimilated record set");

  const dispatched = validateVersionedContinuationRecordSetV1({
    record_set: fixture.recordSet,
    runtime_config: fixture.assimilatedRuntimeConfig,
  });
  assert.equal(dispatched.contract_id, "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1");
  ok("versioned persistence readback dispatch selects the CAP-03 validator");

  validateContinuationRecordSetV1(fixture.continuationRecordSet);
  const historical = validateVersionedContinuationRecordSetV1({
    record_set: fixture.continuationRecordSet,
    runtime_config: fixture.continuationRuntimeConfig,
  });
  assert.equal(historical.contract_id, "MCFT_CAP_02_CONTINUATION_V1");
  ok("historical CAP-02 record-set validation and dispatch remain unchanged");

  const rows = buildContinuationProjectionRowsV1(
    fixture.recordSet.members.map((object) => ({
      fact_id: `fact_${object.object_id}`,
      object,
    })),
  );
  assert.deepEqual(Object.keys(rows).sort(), [
    "checkpoint_latest",
    "forecast_result_latest",
    "runtime_health_latest",
    "state_history",
    "state_latest",
  ]);
  assert.equal(Object.keys(rows).length, 5);
  ok("assimilated record set derives exactly the existing five continuation projections");

  assert.equal(
    rows.state_latest.state_object_id,
    fixture.recordSet.member_object_ids.twin_state_estimate_v1,
  );
  assert.equal(
    rows.checkpoint_latest.checkpoint_object_id,
    fixture.recordSet.member_object_ids.twin_runtime_checkpoint_v1,
  );
  assert.equal(
    rows.forecast_result_latest.forecast_object_id,
    fixture.recordSet.member_object_ids.twin_forecast_run_v1,
  );
  assert.equal(rows.forecast_result_latest.forecast_status, "BLOCKED");
  ok("State, checkpoint, and blocked Forecast-result projection authorities are exact");

  assert.equal(
    fixture.recordSet.continuation_idempotency_key,
    fixture.conflictingRecordSet.continuation_idempotency_key,
  );
  assert.equal(
    fixture.recordSet.continuation_record_set_id,
    fixture.conflictingRecordSet.continuation_record_set_id,
  );
  assert.notEqual(
    fixture.recordSet.continuation_record_set_determinism_hash,
    fixture.conflictingRecordSet.continuation_record_set_determinism_hash,
  );
  validateAssimilatedContinuationCrossReferencesV1(fixture.conflictingRecordSet);
  ok("same operation key preserves idempotency identity while member content changes aggregate hash");

  assert.equal(
    fixture.recordSet.aggregate_identity_input.record_set_contract_id,
    "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1",
  );
  assert.equal(
    fixture.recordSet.record_set_contract_id,
    fixture.recordSet.aggregate_identity_input.record_set_contract_id,
  );
  ok("CAP-03 discriminator is present in both top-level and aggregate identity authority");

  assert.equal(
    fixture.recordSet.aggregate_identity_input.runtime_config_ref,
    fixture.assimilatedRuntimeConfig.object_id,
  );
  assert.equal(
    fixture.recordSet.aggregate_identity_input.runtime_config_hash,
    fixture.assimilatedRuntimeConfig.determinism_hash,
  );
  assert.equal(
    fixture.predecessorState.runtime_config_ref,
    fixture.continuationRuntimeConfig.object_id,
  );
  ok("CAP-03 aggregate pins its config while predecessor State remains pinned to CAP-02 config");

  assert.equal(fixture.expected.previous_state_ref, fixture.predecessorState.object_id);
  assert.equal(
    fixture.expected.previous_checkpoint_ref,
    fixture.predecessorCheckpoint.object_id,
  );
  assert.equal(
    fixture.expected.previous_forecast_result_ref,
    fixture.predecessorForecast.object_id,
  );
  assert.equal(fixture.expected.latest_successful_forecast_ref, null);
  ok("expected-current State, checkpoint, Forecast-result, and successful-Forecast authorities are frozen");

  const migrationNames = fs
    .readdirSync(path.join(ROOT, "apps/server/db/migrations"))
    .filter((name) => /cap_03.*persistence|assimilated.*persistence/i.test(name));
  assert.deepEqual(migrationNames, []);
  ok("CAP-03 persistence uses existing JSONB identity basis and requires zero migration");

  const ports = fs.readFileSync(
    path.join(ROOT, "apps/server/src/runtime/twin_runtime/ports.ts"),
    "utf8",
  );
  const repository = fs.readFileSync(
    path.join(ROOT, "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts"),
    "utf8",
  );
  assert.match(ports, /interface AssimilatedContinuationPersistencePortV1/);
  assert.match(repository, /commitAssimilatedContinuationState/);
  assert.match(repository, /readAssimilatedContinuationRecordSet/);
  assert.match(repository, /rebuildAssimilatedContinuationProjections/);
  assert.match(repository, /commitVersionedContinuationStateV1/);
  ok("independent CAP-03 port reuses one shared internal A2 transaction implementation");

  console.log(`MCFT-CAP-03 assimilated persistence recovery: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
