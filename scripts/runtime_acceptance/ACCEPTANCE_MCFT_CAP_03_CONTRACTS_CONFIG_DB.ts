// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_DB.ts
// Purpose: prove CAP-03 Runtime Config canonical append, idempotency, parent pinning, and readback through the existing PostgreSQL D transaction family.
// Boundary: destructive isolated-database acceptance only; no A2 tick, Evidence selection, assimilation math, migration, route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { AssimilatedContinuationRuntimeConfigServiceV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v1.js";
import { buildMcftCap03ContractsConfigFixtureV1 } from "./mcft_cap_03_contracts_config_fixture_v1.js";

if (process.env.MCFT_CAP_03_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_03_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap03|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const service = new AssimilatedContinuationRuntimeConfigServiceV1(repository);

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

async function initializeV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
}

async function deleteConfigV1(objectId: string, idempotencyKey: string): Promise<void> {
  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1",
    [idempotencyKey],
  );
  await pool.query(
    "DELETE FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1",
    [objectId],
  );
}

async function countFactsV1(objectId: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1",
    [objectId],
  );
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  const fixture = await buildMcftCap03ContractsConfigFixtureV1();
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };
  try {
    await initializeV1();
    await deleteConfigV1(fixture.assimilatedRuntimeConfig.object_id, fixture.assimilatedRuntimeConfig.idempotency_key);
    await deleteConfigV1(fixture.continuationRuntimeConfig.object_id, fixture.continuationRuntimeConfig.idempotency_key);
    ok("isolated PostgreSQL schema initialized from repository-owned SQL");

    const parentCommit = await repository.commitRuntimeConfig(fixture.continuationRuntimeConfig);
    assert.equal(parentCommit.status, "INSERTED");
    assert.equal(await countFactsV1(fixture.continuationRuntimeConfig.object_id), 1);
    ok("predecessor latest-posterior Runtime Config is persisted before the CAP-03 child config");

    const first = await service.commitAndVerify(fixture.assimilatedRuntimeConfig);
    assert.equal(first.status, "INSERTED");
    validateAssimilatedContinuationRuntimeConfigPayloadV1(first.runtime_config.payload);
    assert.equal(await countFactsV1(fixture.assimilatedRuntimeConfig.object_id), 1);
    ok("CAP-03 Runtime Config is appended through the existing D transaction family");

    const second = await service.commitAndVerify({
      ...fixture.assimilatedRuntimeConfig,
      created_at: "2026-07-11T00:01:00.000Z",
    });
    assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await countFactsV1(fixture.assimilatedRuntimeConfig.object_id), 1);
    ok("same semantic CAP-03 Runtime Config returns idempotent success without duplicate fact");

    const readback = await repository.readRuntimeConfig(fixture.assimilatedRuntimeConfig.object_id);
    assert.ok(readback);
    assert.equal(readback.determinism_hash, fixture.assimilatedRuntimeConfig.determinism_hash);
    assert.equal(readback.payload.parent_runtime_config_ref, fixture.continuationRuntimeConfig.object_id);
    assert.equal(readback.payload.parent_runtime_config_hash, fixture.continuationRuntimeConfig.determinism_hash);
    assert.equal(readback.payload.config_purpose, "HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION");
    assert.equal(readback.payload.record_set_contract_id, "MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1");
    ok("canonical readback preserves explicit parent pin, purpose, discriminator, and config hash");

    const forged = structuredClone(fixture.assimilatedRuntimeConfig);
    forged.determinism_hash = `sha256:${"0".repeat(64)}`;
    await assert.rejects(repository.commitRuntimeConfig(forged), /SEMANTIC_HASH_MISMATCH/);
    assert.equal(await countFactsV1(fixture.assimilatedRuntimeConfig.object_id), 1);
    ok("forged CAP-03 Runtime Config hash is rejected without duplicate canonical write");

    console.log(`MCFT-CAP-03 contracts-config DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
