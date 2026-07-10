// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts
// Purpose: prove a real operating-system process restart resumes PostgreSQL ticks 13–24, and bounded backfill yields the same canonical identities as uninterrupted execution.
// Boundary: destructive isolated-database acceptance only; no production database, scheduler, route, Forecast success, Recommendation, Decision, or action.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ContiguousContinuationRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import { ContinuationTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_resume_service_v1.js";
import type { ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap02RestartBackfillFixtureV1,
  type RestartBackfillFixtureV1,
} from "./mcft_cap_02_restart_backfill_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_RELATIVE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts";
const SHARED_LEASE_OWNER = "mcft-cap-02-restart-backfill-db-acceptance";
const CHILD_MARKER = "MCFT_CAP_02_RESTART_CHILD_RESULT=";

if (process.env.MCFT_CAP_02_RESTART_BACKFILL_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_RESTART_BACKFILL_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

async function initializeAndResetV1(pool: Pool): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(`TRUNCATE TABLE
    twin_runtime_health_latest_index_v1,
    twin_runtime_checkpoint_latest_index_v1,
    twin_forecast_success_latest_index_v1,
    twin_forecast_result_latest_index_v1,
    twin_state_latest_index_v1,
    twin_state_history_projection_v1,
    twin_active_lineage_index_v1,
    twin_runtime_lease_v1,
    twin_object_idempotency_index_v1,
    twin_runtime_authority_snapshot_v1,
    facts
    RESTART IDENTITY CASCADE`);
}

async function seedV1(pool: Pool, fixture: RestartBackfillFixtureV1): Promise<void> {
  const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
  const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
  assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.realityBindingSnapshot)).status, "INSERTED");
  assert.equal((await runtimeRepository.commitRuntimeConfig(fixture.parentRuntimeConfig)).status, "INSERTED");
  const a0Lease = await runtimeRepository.acquireLease({
    ...fixture.scope,
    lease_owner: SHARED_LEASE_OWNER,
    lease_duration_seconds: 3600,
  });
  assert.equal((await runtimeRepository.commitBootstrapState({
    scope: fixture.scope,
    lease: a0Lease,
    expected: {
      active_lineage_ref: null,
      checkpoint_ref: null,
      state_ref: null,
      forecast_result_ref: null,
      successful_forecast_ref: null,
    },
    record_set: fixture.a0RecordSet,
  })).status, "INSERTED");
  assert.equal((await runtimeRepository.commitRuntimeConfig(fixture.continuationRuntimeConfig)).status, "INSERTED");
}

function createProductionServicesV1(pool: Pool, fixture: RestartBackfillFixtureV1) {
  const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
  const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
  const evidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords() {
      return structuredClone(fixture.candidateRecords);
    },
  };
  const handoffService = new PrepareNextTickInputServiceV1(nextTickRepository);
  const tickService = new ContinuationTickServiceV1(
    handoffService,
    evidenceSource,
    runtimeRepository,
    runtimeRepository,
  );
  const rangeService = new ContiguousContinuationRangeServiceV1(handoffService, tickService);
  const restartService = new RestartResumeServiceV1(handoffService, rangeService);
  return { runtimeRepository, nextTickRepository, handoffService, tickService, rangeService, restartService };
}

type DbSignatureV1 = {
  logical_time: string;
  idempotency_key: string;
  record_set_id: string;
  determinism_hash: string;
  member_object_ids: string[];
  member_determinism_hashes: Record<string, string>;
};

async function readSignaturesV1(pool: Pool): Promise<DbSignatureV1[]> {
  const result = await pool.query(
    `SELECT
       identity_basis->'continuation_operation_key'->>'logical_time' AS logical_time,
       idempotency_key,
       record_set_id,
       determinism_hash,
       member_object_ids,
       member_determinism_hashes
     FROM twin_object_idempotency_index_v1
     WHERE identity_kind='A2_RECORD_SET'
     ORDER BY identity_basis->'continuation_operation_key'->>'logical_time'`,
  );
  return result.rows as DbSignatureV1[];
}

async function scalarCountV1(pool: Pool, sql: string): Promise<number> {
  const result = await pool.query(sql);
  return result.rows[0].count as number;
}

async function leaseTokenV1(pool: Pool, scope: TwinScopeKeyV1): Promise<bigint> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(scope),
  );
  assert.equal(result.rows.length, 1);
  return BigInt(result.rows[0].fencing_token);
}

async function childResumeV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const services = createProductionServicesV1(pool, fixture);
    const result = await services.restartService.resumeFromCheckpointV1({
      ...fixture.request,
      to_logical_time: fixture.finalTargetLogicalTime,
      lease_owner: SHARED_LEASE_OWNER,
    });
    process.stdout.write(`${CHILD_MARKER}${JSON.stringify({
      operator_intent: result.operator_intent,
      persisted_checkpoint_ref: result.persisted_checkpoint_ref,
      persisted_terminal_tick_ref: result.persisted_terminal_tick_ref,
      persisted_start_logical_time: result.persisted_start_logical_time,
      executed_tick_count: result.range_result.executed_tick_count,
      next_logical_tick_time: result.range_result.final_handoff.next_logical_tick_time,
    })}\n`);
  } finally {
    await pool.end();
  }
}

function spawnResumeProcessV1(): {
  operator_intent: string;
  persisted_checkpoint_ref: string;
  persisted_terminal_tick_ref: string;
  persisted_start_logical_time: string;
  executed_tick_count: number;
  next_logical_tick_time: string;
} {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawnSync(command, ["exec", "tsx", SCRIPT_RELATIVE_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      MCFT_CAP_02_RESTART_BACKFILL_CHILD_STAGE: "resume",
    },
    encoding: "utf8",
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  assert.equal(child.status, 0, child.error?.message ?? child.stderr);
  const markerLine = child.stdout.split(/\r?\n/).find((line) => line.startsWith(CHILD_MARKER));
  assert.ok(markerLine, "child result marker required");
  return JSON.parse(markerLine.slice(CHILD_MARKER.length)) as ReturnType<typeof spawnResumeProcessV1>;
}

async function parentMainV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();

  let pool = new Pool({ connectionString: databaseUrl });
  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  ok("isolated PostgreSQL schema is initialized with A0, authority snapshot, and continuation Runtime Config");

  let services = createProductionServicesV1(pool, fixture);
  const firstProcess = await services.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.splitTargetLogicalTime,
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(firstProcess.executed_tick_count, 12);
  const restartHandoff = await services.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(restartHandoff.previous_tick_sequence, 12);
  assert.equal(restartHandoff.next_logical_tick_time, fixture.persistedResumeStartLogicalTime);
  assert.equal(restartHandoff.previous_terminal_tick_ref, firstProcess.tick_results[11].record_set.members.find((member) => member.object_type === "twin_runtime_tick_v1")?.object_id);
  ok("process 1 commits ticks 1–12 and PostgreSQL exposes the exact sequence-12 restart handoff");

  await pool.end();
  const childResult = spawnResumeProcessV1();
  assert.equal(childResult.operator_intent, "RESUME");
  assert.equal(childResult.persisted_start_logical_time, fixture.persistedResumeStartLogicalTime);
  assert.equal(childResult.executed_tick_count, 12);
  assert.equal(childResult.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
  ok("a new operating-system process constructs fresh services and resumes only ticks 13–24");

  pool = new Pool({ connectionString: databaseUrl });
  const splitSignatures = await readSignaturesV1(pool);
  assert.equal(splitSignatures.length, 24);
  assert.equal(
    await scalarCountV1(
      pool,
      `SELECT count(*)::int AS count
       FROM facts AS canonical_fact
       JOIN (
         SELECT jsonb_array_elements_text(member_object_ids) AS object_id
         FROM twin_object_idempotency_index_v1
         WHERE identity_kind='A2_RECORD_SET'
       ) AS a2_member
         ON canonical_fact.record_json->'payload'->>'object_id' = a2_member.object_id`,
    ),
    192,
  );
  assert.equal(await scalarCountV1(pool, "SELECT count(*)::int AS count FROM twin_state_history_projection_v1"), 25);
  assert.equal(await scalarCountV1(pool, "SELECT count(*)::int AS count FROM twin_active_lineage_index_v1"), 1);
  services = createProductionServicesV1(pool, fixture);
  const splitFinal = await services.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(splitFinal.previous_tick_sequence, 24);
  assert.equal(splitFinal.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
  ok("split-process execution persists exactly 24 A2 guards, 192 A2 facts, 25 States, and one active lineage");

  const factsBeforeRetry = await scalarCountV1(pool, "SELECT count(*)::int AS count FROM facts");
  const guardsBeforeRetry = await scalarCountV1(pool, "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1");
  const leaseBeforeRetry = await leaseTokenV1(pool, fixture.scope);
  const retry = await services.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(retry.range_result.status, "ALREADY_COMPLETE");
  assert.equal(retry.range_result.executed_tick_count, 0);
  assert.equal(await scalarCountV1(pool, "SELECT count(*)::int AS count FROM facts"), factsBeforeRetry);
  assert.equal(await scalarCountV1(pool, "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1"), guardsBeforeRetry);
  assert.equal(await leaseTokenV1(pool, fixture.scope), leaseBeforeRetry);
  ok("completed-target retry performs zero fact, guard, projection, or lease mutation");

  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  services = createProductionServicesV1(pool, fixture);
  const uninterrupted = await services.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(uninterrupted.executed_tick_count, 24);
  const uninterruptedSignatures = await readSignaturesV1(pool);
  assert.deepEqual(splitSignatures, uninterruptedSignatures);
  ok("split-process restart is byte-equivalent to uninterrupted execution for all record sets and member hashes");

  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  services = createProductionServicesV1(pool, fixture);
  const backfillFirstHalf = await services.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.splitTargetLogicalTime,
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(backfillFirstHalf.executed_tick_count, 12);
  const freshBackfillServices = createProductionServicesV1(pool, fixture);
  const backfill = await freshBackfillServices.restartService.runBoundedBackfillV1({
    ...fixture.request,
    to_logical_time: fixture.finalTargetLogicalTime,
    requested_start_logical_time: fixture.persistedResumeStartLogicalTime,
    evidence_intent: "MISSED_SCHEDULE_CATCH_UP",
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(backfill.range_result.executed_tick_count, 12);
  const backfillSignatures = await readSignaturesV1(pool);
  assert.deepEqual(backfillSignatures, uninterruptedSignatures);
  ok("bounded forward backfill fills the contiguous 12-hour gap and matches uninterrupted canonical hashes");

  const finalHandoff = await freshBackfillServices.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(finalHandoff.previous_tick_sequence, 24);
  assert.equal(finalHandoff.next_logical_tick_time, fixture.expectedFixture.next_logical_time);
  assert.equal(await scalarCountV1(pool, "SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1"), 0);
  ok("restart and backfill finish at checkpoint sequence 24 while successful-Forecast latest remains absent");

  await pool.end();
  console.log(`MCFT-CAP-02 restart backfill DB: ${pass} PASS, 0 FAIL`);
}

if (process.env.MCFT_CAP_02_RESTART_BACKFILL_CHILD_STAGE === "resume") {
  childResumeV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  parentMainV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
