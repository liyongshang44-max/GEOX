// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_DB.ts
// Purpose: prove MCFT-CAP-02 continuation Runtime Config canonical append, idempotency, and readback through the existing PostgreSQL D transaction family.
// Boundary: destructive isolated-database acceptance only; no A2 continuation tick, Dynamics, Evidence selection, State write, Forecast success, route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  compileContinuationRuntimeConfigFromAuthorityV1,
  type Mcft00ConfigurationMatrixForContinuationV1,
  type Mcft00RealityArtifactForContinuationV1,
  type Mcft00SourceMatrixForContinuationV1,
  type McftCap02PredecessorLockV1,
} from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_authority_adapter_v1.js";
import { ContinuationRuntimeConfigServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_runtime_config_service_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import { validateContinuationRuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.js";

if (process.env.MCFT_CAP_02_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

const lock = readJsonV1<McftCap02PredecessorLockV1>(
  "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PREDECESSOR-LOCK.json",
);
const reality = readJsonV1<Mcft00RealityArtifactV1 & Mcft00RealityArtifactForContinuationV1>(
  "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
);
const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1 & Mcft00SourceMatrixForContinuationV1>(
  "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
);
const configurationMatrix = readJsonV1<Mcft00ConfigurationMatrixArtifactV1 & Mcft00ConfigurationMatrixForContinuationV1>(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
);

const parentRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
  realityArtifact: reality,
  sourceMatrixArtifact: sourceMatrix,
  configurationMatrixArtifact: configurationMatrix,
  logical_time: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
});
const continuationRuntimeConfig = compileContinuationRuntimeConfigFromAuthorityV1({
  predecessor_lock: lock,
  parent_runtime_config: parentRuntimeConfig,
  reality_artifact: reality,
  source_matrix_artifact: sourceMatrix,
  configuration_matrix_artifact: configurationMatrix,
  logical_time: lock.next_logical_tick_time,
  created_at: lock.next_logical_tick_time,
});

const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const service = new ContinuationRuntimeConfigServiceV1(repository);
let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function deleteRuntimeConfigV1(objectId: string, idempotencyKey: string): Promise<void> {
  await pool.query(
    "DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1",
    [idempotencyKey],
  );
  await pool.query(
    "DELETE FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1",
    [objectId],
  );
}

async function countConfigFactsV1(objectId: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_runtime_config_v1' AND record_json->'payload'->>'object_id'=$1",
    [objectId],
  );
  return result.rows[0].count as number;
}

async function countConfigGuardsV1(idempotencyKey: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1",
    [idempotencyKey],
  );
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  try {
    await pool.query(fs.readFileSync(
      path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"),
      "utf8",
    ));
    await deleteRuntimeConfigV1(continuationRuntimeConfig.object_id, continuationRuntimeConfig.idempotency_key);
    await deleteRuntimeConfigV1(parentRuntimeConfig.object_id, parentRuntimeConfig.idempotency_key);

    const parentCommit = await repository.commitRuntimeConfig(parentRuntimeConfig);
    assert.equal(parentCommit.status, "INSERTED");
    assert.equal(await countConfigFactsV1(parentRuntimeConfig.object_id), 1);
    ok("canonical predecessor Runtime Config inserted into isolated PostgreSQL");

    const first = await service.commitAndVerify(continuationRuntimeConfig);
    assert.equal(first.status, "INSERTED");
    validateContinuationRuntimeConfigPayloadV1(first.runtime_config.payload);
    assert.equal(await countConfigFactsV1(continuationRuntimeConfig.object_id), 1);
    assert.equal(await countConfigGuardsV1(continuationRuntimeConfig.idempotency_key), 1);
    ok("continuation Runtime Config appended by existing D transaction family");

    const second = await service.commitAndVerify({
      ...continuationRuntimeConfig,
      created_at: "2026-07-10T00:01:00.000Z",
    });
    assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await countConfigFactsV1(continuationRuntimeConfig.object_id), 1);
    assert.equal(await countConfigGuardsV1(continuationRuntimeConfig.idempotency_key), 1);
    ok("same continuation Runtime Config returns idempotent success without duplicate writes");

    const readback = await repository.readRuntimeConfig(continuationRuntimeConfig.object_id);
    assert.ok(readback);
    assert.equal(readback.object_id, continuationRuntimeConfig.object_id);
    assert.equal(readback.determinism_hash, continuationRuntimeConfig.determinism_hash);
    assert.equal(readback.payload.parent_runtime_config_ref, parentRuntimeConfig.object_id);
    assert.equal(readback.payload.parent_runtime_config_hash, parentRuntimeConfig.determinism_hash);
    ok("canonical readback preserves parent ref/hash and continuation config hash");

    const forged = structuredClone(continuationRuntimeConfig);
    forged.determinism_hash = `sha256:${"0".repeat(64)}`;
    await assert.rejects(repository.commitRuntimeConfig(forged), /SEMANTIC_HASH_MISMATCH/);
    assert.equal(await countConfigFactsV1(continuationRuntimeConfig.object_id), 1);
    ok("forged continuation Runtime Config hash is rejected without duplicate fact");

    console.log(`MCFT-CAP-02 contracts-config DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
