// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts
// Purpose: prove CAP-04 S5B A1/A2/B atomic persistence, cross-variant and Scenario uniqueness, idempotent readback, pending-Scenario recovery, rollback safety, and projection rebuild in isolated PostgreSQL.
// Boundary: destructive isolated-database acceptance only; no route, web, scheduler, recommendation, decision, AO-ACT, live data, or field claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresForecastScenarioRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { buildCap04S5BPersistenceFixtureV1 } from "./mcft_cap_04_persistence_fixture_v1.js";

if (process.env.MCFT_CAP_04_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_04_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap04|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
const repository = new PostgresForecastScenarioRepositoryV1(pool);
const readSql = (relativePath: string): string => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

async function initialize(): Promise<void> {
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
}

async function seedPredecessor(): Promise<ReturnType<typeof buildCap04S5BPersistenceFixtureV1>> {
  const fixture = buildCap04S5BPersistenceFixtureV1();
  const scope = fixture.scope;
  await runtimeRepository.commitRuntimeConfig(fixture.runtime_config);
  await pool.query(
    `INSERT INTO twin_active_lineage_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'CONTROLLED_REPLAY','mcft_cap04_s5b_fixture',NULL)`,
    [...Object.values(scope), fixture.predecessor.active_lineage_ref],
  );
  await pool.query(
    `INSERT INTO twin_state_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'2026-06-03T01:00:00.000Z',$10,'seed_state_fact')`,
    [...Object.values(scope), fixture.predecessor.previous_state_ref, fixture.expected.lineage_id, fixture.expected.revision_id, fixture.predecessor.previous_state_hash],
  );
  await pool.query(
    `INSERT INTO twin_forecast_result_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'COMPLETED','2026-06-03T01:00:00.000Z',$8,'seed_forecast_fact')`,
    [...Object.values(scope), fixture.predecessor.previous_forecast_ref, fixture.predecessor.previous_forecast_hash],
  );
  if (fixture.predecessor.previous_successful_forecast_ref) {
    await pool.query(
      `INSERT INTO twin_forecast_success_latest_index_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,logical_time,determinism_hash,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'2026-06-03T01:00:00.000Z',$8,'seed_forecast_success_fact')`,
      [...Object.values(scope), fixture.predecessor.previous_successful_forecast_ref, fixture.predecessor.previous_forecast_hash],
    );
  }
  await pool.query(
    `INSERT INTO twin_runtime_checkpoint_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'2026-06-03T01:00:00.000Z',$10,'seed_checkpoint_fact')`,
    [...Object.values(scope), fixture.predecessor.previous_checkpoint_ref, fixture.expected.lineage_id, fixture.expected.revision_id, fixture.predecessor.previous_checkpoint_hash],
  );
  await pool.query(
    `INSERT INTO twin_runtime_health_latest_index_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,'seed_health','READY','2026-06-03T01:00:00.000Z','sha256:seed_health','seed_health_fact')`,
    Object.values(scope),
  );
  return fixture;
}

async function count(query: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${query}`, values);
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  let pass = 0;
  const ok = (message: string): void => { pass += 1; console.log(`PASS ${message}`); };
  try {
    await initialize();
    const fixture = await seedPredecessor();
    ok("isolated PostgreSQL schema and the single additive CAP-04 migration initialize");

    const lease = await runtimeRepository.acquireLease({
      ...fixture.scope,
      lease_owner: "mcft-cap04-s5b-acceptance",
      lease_duration_seconds: 300,
    });

    await assert.rejects(
      repository.commitARecordSet({
        scope: fixture.scope,
        lease,
        expected: fixture.expected,
        record_set: fixture.a1,
        fault_injection: (stage) => { if (stage === "before_state_history_projection") throw new Error("INJECTED_A1_ROLLBACK"); },
      }),
      /INJECTED_A1_ROLLBACK/,
    );
    assert.equal(await count("facts WHERE record_json->>'type'='twin_forecast_run_v1'"), 0);
    assert.equal(await count("twin_terminal_tick_uniqueness_v1"), 0);
    assert.equal(await count("twin_forecast_run_projection_v1"), 0);
    ok("A1 fault injection rolls back facts, uniqueness guard, pointers and projections atomically");

    const a1 = await repository.commitARecordSet({
      scope: fixture.scope,
      lease,
      expected: fixture.expected,
      record_set: fixture.a1,
    });
    assert.equal(a1.status, "INSERTED");
    assert.equal(Object.keys(a1.fact_ids_by_object_id).length, 8);
    assert.equal(await count("facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [fixture.a1.members.map((member) => member.object_id)]), 8);
    assert.equal(await count("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await count("twin_forecast_run_projection_v1"), 1);
    assert.equal(await count("twin_forecast_point_projection_v1"), 72);
    ok("A1 commits eight canonical facts, terminal uniqueness, pointer CAS and 72 Forecast points atomically");

    const a1Again = await repository.commitARecordSet({
      scope: fixture.scope,
      lease,
      expected: fixture.expected,
      record_set: fixture.a1,
    });
    assert.equal(a1Again.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await count("twin_terminal_tick_uniqueness_v1"), 1);
    assert.equal(await count("facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [fixture.a1.members.map((member) => member.object_id)]), 8);
    ok("A1 response-loss replay is idempotent and creates no duplicate facts or guards");

    await assert.rejects(
      repository.commitARecordSet({
        scope: fixture.scope,
        lease,
        expected: fixture.expected,
        record_set: fixture.a2,
      }),
      /TERMINAL_TICK_VARIANT_CONFLICT|CAP04_PERSISTENCE_UNIQUENESS_CONFLICT/,
    );
    assert.equal(await count("twin_terminal_tick_uniqueness_v1"), 1);
    ok("A2 cannot coexist with A1 for the same terminal tick uniqueness identity");

    const pending = await repository.detectPendingScenario(fixture.scope);
    assert.ok(pending);
    assert.equal(pending.object_id, fixture.b.scenario_set_uniqueness_key.source_forecast_ref);
    ok("successful A1 with no B commit is detected as pending Scenario recovery");

    await assert.rejects(
      repository.commitScenarioSet({
        scope: fixture.scope,
        lease,
        record: fixture.b,
        fault_injection: (stage) => { if (stage === "before_scenario_projections") throw new Error("INJECTED_B_ROLLBACK"); },
      }),
      /INJECTED_B_ROLLBACK/,
    );
    assert.equal(await count("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 0);
    assert.equal(await count("twin_scenario_set_uniqueness_v1"), 0);
    assert.ok(await repository.detectPendingScenario(fixture.scope));
    ok("B fault injection rolls back canonical fact, uniqueness guard and projections atomically");

    const b = await repository.commitScenarioSet({
      scope: fixture.scope,
      lease,
      record: fixture.b,
    });
    assert.equal(b.status, "INSERTED");
    assert.equal(await count("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 1);
    assert.equal(await count("twin_scenario_set_uniqueness_v1"), 1);
    assert.equal(await count("twin_scenario_set_projection_v1"), 1);
    assert.equal(await count("twin_scenario_point_projection_v1"), 216);
    assert.equal(await count("twin_scenario_latest_index_v1"), 1);
    assert.equal(await repository.detectPendingScenario(fixture.scope), null);
    ok("B commits one canonical Scenario Set, 216 Scenario points and clears pending recovery");

    const bAgain = await repository.commitScenarioSet({
      scope: fixture.scope,
      lease,
      record: fixture.b,
    });
    assert.equal(bAgain.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await count("facts WHERE record_json->>'type'='twin_scenario_set_v1'"), 1);
    assert.equal(await count("twin_scenario_set_uniqueness_v1"), 1);
    ok("B response-loss replay is idempotent under Scenario canonical uniqueness");

    const aRead = await repository.readARecordSet(fixture.a1.record_set_id);
    const bRead = await repository.readScenarioSet(fixture.b.scenario_set_id);
    assert.ok(aRead && bRead);
    assert.equal(aRead.aggregate_determinism_hash, fixture.a1.aggregate_determinism_hash);
    assert.equal(bRead.aggregate_determinism_hash, fixture.b.aggregate_determinism_hash);
    ok("canonical A1 and B readback reconstruct exact aggregate identities from facts plus guards");

    await pool.query("DELETE FROM twin_forecast_point_projection_v1");
    await pool.query("DELETE FROM twin_forecast_run_projection_v1");
    await pool.query("DELETE FROM twin_scenario_point_projection_v1");
    await pool.query("DELETE FROM twin_scenario_set_projection_v1");
    await pool.query("DELETE FROM twin_scenario_latest_index_v1");
    const forecastRebuild = await repository.rebuildForecastProjections(fixture.a1.record_set_id);
    const scenarioRebuild = await repository.rebuildScenarioProjections(fixture.b.scenario_set_id);
    assert.deepEqual(forecastRebuild, { rebuilt_forecast_run_count: 1, rebuilt_forecast_point_count: 72 });
    assert.deepEqual(scenarioRebuild, { rebuilt_scenario_set_count: 1, rebuilt_scenario_point_count: 216, rebuilt_latest_count: 1 });
    assert.equal(await count("twin_forecast_point_projection_v1"), 72);
    assert.equal(await count("twin_scenario_point_projection_v1"), 216);
    ok("Forecast and Scenario projections rebuild exactly from append-only canonical facts");

    console.log(`MCFT-CAP-04 persistence DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
