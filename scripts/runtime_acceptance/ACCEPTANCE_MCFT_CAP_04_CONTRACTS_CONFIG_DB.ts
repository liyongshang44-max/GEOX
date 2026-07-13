// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG_DB.ts
// Purpose: prove the exact 24-object CAP-04 Runtime Config chain through the existing PostgreSQL D transaction family.
// Boundary: destructive isolated-database acceptance only; no A/B record persistence, Future Forcing selection, Forecast/Scenario math, route or scheduler.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ForecastScenarioRuntimeConfigServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_runtime_config_service_v1.js";
import { validateCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import { buildCap04ConfigChainFixtureV1 } from "./mcft_cap_04_contracts_config_fixture_v1.js";

if (process.env.MCFT_CAP_04_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_04_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap04|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const service = new ForecastScenarioRuntimeConfigServiceV1(repository);
const readSql = (relativePath: string): string => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

async function initialize(): Promise<void> {
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
}

async function countConfigFacts(): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'='twin_runtime_config_v1'");
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  const fixture = buildCap04ConfigChainFixtureV1();
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };
  try {
    await initialize();
    ok("isolated PostgreSQL schema initialized from repository-owned SQL");

    const predecessor = await repository.commitRuntimeConfig(fixture.predecessor);
    assert.equal(predecessor.status, "INSERTED");
    ok("State-bound predecessor Runtime Config is persisted before C1");

    const first = await service.commitChainAndVerify({
      configs: fixture.configs,
      predecessor_runtime_config_ref: fixture.predecessor.object_id,
      predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
      first_effective_logical_time: "2026-06-03T02:00:00.000Z",
    });
    assert.equal(first.inserted_count, 24);
    assert.equal(first.existing_count, 0);
    assert.equal(await countConfigFacts(), 25);
    validateCap04RuntimeConfigChainV1(first.runtime_configs, {
      predecessor_runtime_config_ref: fixture.predecessor.object_id,
      predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
      first_effective_logical_time: "2026-06-03T02:00:00.000Z",
    });
    ok("24 configs append and read back through the existing D transaction family");

    const second = await service.commitChainAndVerify({
      configs: fixture.configs.map((config) => ({ ...config, created_at: "2026-07-13T00:00:00.000Z" })),
      predecessor_runtime_config_ref: fixture.predecessor.object_id,
      predecessor_runtime_config_hash: fixture.predecessor.determinism_hash,
      first_effective_logical_time: "2026-06-03T02:00:00.000Z",
    });
    assert.equal(second.inserted_count, 0);
    assert.equal(second.existing_count, 24);
    assert.equal(await countConfigFacts(), 25);
    ok("same semantic chain is idempotent and creates no duplicate config facts");

    const firstRead = await repository.readRuntimeConfig(fixture.configs[0].object_id);
    const finalRead = await repository.readRuntimeConfig(fixture.configs[23].object_id);
    assert.ok(firstRead && finalRead);
    assert.equal(firstRead.payload.parent_runtime_config_ref, fixture.predecessor.object_id);
    assert.equal(finalRead.payload.parent_runtime_config_ref, fixture.configs[22].object_id);
    assert.equal(finalRead.payload.effective_logical_time, "2026-06-04T01:00:00.000Z");
    ok("canonical readback preserves predecessor pin, chained parent and terminal effective time");

    const forged = structuredClone(fixture.configs[0]);
    forged.determinism_hash = `sha256:${"0".repeat(64)}`;
    await assert.rejects(repository.commitRuntimeConfig(forged), /SEMANTIC_HASH_MISMATCH/);
    assert.equal(await countConfigFacts(), 25);
    ok("forged config hash is rejected without duplicate canonical write");

    console.log(`MCFT-CAP-04 contracts-config DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
