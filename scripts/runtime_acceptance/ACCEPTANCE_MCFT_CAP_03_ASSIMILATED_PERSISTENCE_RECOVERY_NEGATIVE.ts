// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_NEGATIVE.ts
// Purpose: prove S3B fails closed on discriminator, config, member integrity, scope, predecessor authority, and zero-migration boundary violations before any PostgreSQL write.
// Boundary: pure negative acceptance only; no database, lease, canonical write, Runtime tick orchestration, range execution, route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import { validateVersionedContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.js";
import { buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1 } from "./mcft_cap_03_assimilated_persistence_recovery_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1();

  const unknownTopLevel = structuredClone(fixture.recordSet) as unknown as Record<string, unknown>;
  unknownTopLevel.record_set_contract_id = "UNKNOWN_CONTRACT";
  assert.throws(
    () => validateVersionedContinuationRecordSetV1({
      record_set: unknownTopLevel as never,
      runtime_config: fixture.assimilatedRuntimeConfig,
    }),
    /UNKNOWN_RECORD_SET_CONTRACT|VALIDATOR_DISPATCH_MISMATCH/,
  );
  ok("unknown top-level record-set discriminator fails closed");

  const missingTopLevel = structuredClone(fixture.recordSet) as unknown as Record<string, unknown>;
  delete missingTopLevel.record_set_contract_id;
  assert.throws(
    () => validateVersionedContinuationRecordSetV1({
      record_set: missingTopLevel as never,
      runtime_config: fixture.assimilatedRuntimeConfig,
    }),
    /VALIDATOR_DISPATCH_MISMATCH/,
  );
  ok("missing CAP-03 top-level discriminator cannot be inferred from payload shape");

  assert.throws(
    () => validateVersionedContinuationRecordSetV1({
      record_set: fixture.recordSet,
      runtime_config: fixture.continuationRuntimeConfig,
    }),
    /VALIDATOR_DISPATCH_RUNTIME_CONFIG_REF_MISMATCH|VALIDATOR_DISPATCH_MISMATCH/,
  );
  ok("CAP-03 record set cannot be read under historical CAP-02 Runtime Config");

  const wrongConfigHash = structuredClone(fixture.assimilatedRuntimeConfig);
  wrongConfigHash.determinism_hash = "sha256:wrong_runtime_config_hash";
  assert.throws(
    () => validateVersionedContinuationRecordSetV1({
      record_set: fixture.recordSet,
      runtime_config: wrongConfigHash,
    }),
    /VALIDATOR_DISPATCH_RUNTIME_CONFIG_HASH_MISMATCH/,
  );
  ok("Runtime Config hash mismatch fails before contract dispatch");

  const memberMutation = structuredClone(fixture.recordSet);
  const state = memberMutation.members.find(
    (member) => member.object_type === "twin_state_estimate_v1",
  );
  assert.ok(state);
  state.payload.root_zone_storage_mm = { mean: 999, variance: 1 };
  assert.throws(
    () => validateAssimilatedContinuationCrossReferencesV1(memberMutation),
    /DETERMINISM|HASH|MEMBER/,
  );
  ok("member payload mutation without rehash is rejected");

  const scopeMutation = structuredClone(fixture.recordSet);
  const health = scopeMutation.members.find(
    (member) => member.object_type === "twin_runtime_health_v1",
  );
  assert.ok(health);
  health.field_id = "field_scope_drift";
  health.determinism_hash = computeMemberDeterminismHashV1(
    health as unknown as Record<string, unknown>,
  );
  assert.throws(
    () => validateAssimilatedContinuationCrossReferencesV1(scopeMutation),
    /SCOPE|FIELD|MEMBER/,
  );
  ok("member scope drift remains invalid even after member rehash");

  const evidenceUnionMutation = structuredClone(fixture.recordSet);
  const evidence = evidenceUnionMutation.members.find(
    (member) => member.object_type === "twin_evidence_window_v1",
  );
  assert.ok(evidence);
  evidence.payload.consumed_evidence_refs = [];
  evidence.determinism_hash = computeMemberDeterminismHashV1(
    evidence as unknown as Record<string, unknown>,
  );
  assert.throws(
    () => validateAssimilatedContinuationCrossReferencesV1(evidenceUnionMutation),
    /EVIDENCE|CONSUMED|HASH|MEMBER/,
  );
  ok("Evidence consumed-union divergence cannot enter persistence");

  assert.equal(
    fixture.recordSet.continuation_idempotency_key,
    fixture.conflictingRecordSet.continuation_idempotency_key,
  );
  assert.notEqual(
    fixture.recordSet.continuation_record_set_determinism_hash,
    fixture.conflictingRecordSet.continuation_record_set_determinism_hash,
  );
  ok("same-key different-hash conflict fixture is valid and deterministic");

  const repository = fs.readFileSync(
    path.join(ROOT, "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts"),
    "utf8",
  );
  const idempotencyPosition = repository.indexOf("identity_kind='A2_RECORD_SET'");
  const leasePosition = repository.indexOf("verifyLease(client");
  assert.ok(idempotencyPosition >= 0);
  assert.ok(leasePosition > idempotencyPosition);
  ok("shared A2 implementation retains idempotency lookup before lease verification");

  assert.doesNotMatch(repository, /INSERT INTO\s+twin_forecast_success_latest_index_v1/i);
  assert.doesNotMatch(repository, /UPDATE\s+twin_active_lineage_index_v1/i);
  ok("S3B cannot create a successful Forecast pointer or mutate active lineage");

  const changedMigrationMarker = /2026_07_11.*cap_03.*persistence/i;
  assert.doesNotMatch(repository, changedMigrationMarker);
  assert.equal(
    fs.readdirSync(path.join(ROOT, "apps/server/db/migrations"))
      .some((name) => /cap_03.*persistence|assimilated.*persistence/i.test(name)),
    false,
  );
  ok("no hidden CAP-03 persistence migration is present");

  console.log(`MCFT-CAP-03 assimilated persistence recovery negative: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
