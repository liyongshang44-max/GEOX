// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_NEGATIVE.ts
// Purpose: prove the MCFT-CAP-02 persistence boundary declares and preserves all required fail-closed errors before destructive PostgreSQL acceptance.
// Boundary: static and pure negative acceptance only; no database writes, projection mutation, Runtime tick orchestration, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import { buildContinuationProjectionRowsV1 } from "../../apps/server/src/projections/twin_runtime/projection_rebuilder_v1.js";
import { buildMcftCap02PersistenceFixtureV1 } from "./mcft_cap_02_persistence_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repositorySource = fs.readFileSync(
  path.join(ROOT, "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts"),
  "utf8",
);
const migrationSource = fs.readFileSync(
  path.join(ROOT, "apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"),
  "utf8",
);
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "fixtures/mcft/water_state/negative/MCFT_CAP_02_PERSISTENCE_NEGATIVE_FIXTURES.json"), "utf8"),
) as { cases: Array<{ case_id: string; expected_error: string }> };

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  assert.ok(fixture.cases.length >= 15);
  ok("negative persistence fixture freezes at least fifteen fail-closed cases");

  for (const testCase of fixture.cases) {
    if (testCase.case_id === "FAULT_INJECTION_ATOMIC_ROLLBACK") {
      assert.ok(repositorySource.includes("fault_injection") && repositorySource.includes("inject(`before_fact_${index + 1}_${object.object_type}`)"));
    } else if (testCase.case_id === "CONTINUATION_INPUT_SCOPE_MISMATCH") {
      assert.ok(repositorySource.includes("CONTINUATION_INPUT_SCOPE_MISMATCH"));
    } else {
      assert.ok(repositorySource.includes(testCase.expected_error), `missing source error anchor ${testCase.expected_error}`);
    }
    ok(testCase.case_id);
  }

  assert.ok(migrationSource.includes("'A2_RECORD_SET'"));
  assert.ok(!migrationSource.includes("CREATE TABLE"));
  ok("A2 identity kind extends the existing guard without creating a parallel table");

  const persistenceFixture = await buildMcftCap02PersistenceFixtureV1();
  assert.equal(
    persistenceFixture.continuationRecordSet.continuation_idempotency_key,
    persistenceFixture.conflictingContinuationRecordSet.continuation_idempotency_key,
  );
  assert.notEqual(
    persistenceFixture.continuationRecordSet.continuation_record_set_determinism_hash,
    persistenceFixture.conflictingContinuationRecordSet.continuation_record_set_determinism_hash,
  );
  ok("same A2 key with different Evidence is a valid deterministic idempotency-conflict fixture");

  const incomplete = structuredClone(persistenceFixture.continuationRecordSet);
  incomplete.members = incomplete.members.slice(1);
  assert.throws(() => validateContinuationRecordSetV1(incomplete), /CONTINUATION_MEMBER_COUNT_MISMATCH/);
  ok("incomplete continuation record set is rejected before persistence");

  const facts = persistenceFixture.continuationRecordSet.members
    .filter((member) => member.object_type !== "twin_state_estimate_v1")
    .map((object) => ({ fact_id: `fact_${object.object_id}`, object }));
  assert.throws(() => buildContinuationProjectionRowsV1(facts), /EXPECTED_EXACTLY_ONE_twin_state_estimate_v1/);
  ok("projection mapping rejects a canonical set missing the continuation State");

  console.log(`MCFT-CAP-02 persistence negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
