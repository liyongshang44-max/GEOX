// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts
// Purpose: prove process-boundary crash retry, stop-on-first-failure, idempotent response-loss recovery, fail-closed projection divergence, and explicit rebuild over the existing MCFT-CAP-02 PostgreSQL Runtime.
// Boundary: destructive isolated-database acceptance only; no production database, new Runtime path, migration, route, scheduler, Forecast success, Recommendation, Decision, or action.

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
import type {
  ReplayEvidenceSourcePortV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap02RestartBackfillFixtureV1,
  type RestartBackfillFixtureV1,
} from "./mcft_cap_02_restart_backfill_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_RELATIVE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_FAILURE_RECOVERY_DB.ts";
const PERSISTENCE_SCRIPT = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_DB.ts";
const SHARED_LEASE_OWNER = "mcft-cap-02-failure-recovery-db-acceptance";
const CHILD_MARKER = "MCFT_CAP_02_FAILURE_RECOVERY_CHILD_RESULT=";

if (process.env.MCFT_CAP_02_FAILURE_RECOVERY_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_02_FAILURE_RECOVERY_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap02|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
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
  assert.equal(
    (await nextTickRepository.commitRealityBindingSnapshot(fixture.realityBindingSnapshot)).status,
    "INSERTED",
  );
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
  assert.equal(
    (await runtimeRepository.commitRuntimeConfig(fixture.continuationRuntimeConfig)).status,
    "INSERTED",
  );
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
  return {
    runtimeRepository,
    nextTickRepository,
    handoffService,
    tickService,
    rangeService,
    restartService,
  };
}

async function runFirstTwelveV1(pool: Pool, fixture: RestartBackfillFixtureV1): Promise<void> {
  const services = createProductionServicesV1(pool, fixture);
  const result = await services.rangeService.runContiguousContinuationRangeV1({
    ...fixture.request,
    to_logical_time: fixture.splitTargetLogicalTime,
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(result.executed_tick_count, 12);
}

async function scalarCountV1(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rows[0].count as number;
}

async function a2GuardCountV1(pool: Pool): Promise<number> {
  return scalarCountV1(
    pool,
    "SELECT count(*)::int AS count FROM twin_object_idempotency_index_v1 WHERE identity_kind='A2_RECORD_SET'",
  );
}

async function a2FactCountV1(pool: Pool): Promise<number> {
  return scalarCountV1(
    pool,
    `SELECT count(*)::int AS count
     FROM facts AS canonical_fact
     JOIN (
       SELECT jsonb_array_elements_text(member_object_ids) AS object_id
       FROM twin_object_idempotency_index_v1
       WHERE identity_kind='A2_RECORD_SET'
     ) AS a2_member
       ON canonical_fact.record_json->'payload'->>'object_id'=a2_member.object_id`,
  );
}

async function leaseTokenV1(pool: Pool, scope: TwinScopeKeyV1): Promise<bigint> {
  const result = await pool.query(
    "SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    scopeValuesV1(scope),
  );
  assert.equal(result.rows.length, 1);
  return BigInt(result.rows[0].fencing_token);
}

async function latestPointersV1(pool: Pool, scope: TwinScopeKeyV1): Promise<Record<string, string>> {
  const values = scopeValuesV1(scope);
  const [active, checkpoint, state, forecast] = await Promise.all([
    pool.query("SELECT active_lineage_ref AS value FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values),
    pool.query("SELECT checkpoint_object_id AS value FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values),
    pool.query("SELECT state_object_id AS value FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values),
    pool.query("SELECT forecast_object_id AS value FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", values),
  ]);
  for (const result of [active, checkpoint, state, forecast]) assert.equal(result.rows.length, 1);
  return {
    active_lineage_ref: active.rows[0].value as string,
    checkpoint_object_id: checkpoint.rows[0].value as string,
    state_object_id: state.rows[0].value as string,
    forecast_object_id: forecast.rows[0].value as string,
  };
}

async function recordSetIdAtV1(pool: Pool, logicalTime: string): Promise<string> {
  const result = await pool.query(
    `SELECT record_set_id
     FROM twin_object_idempotency_index_v1
     WHERE identity_kind='A2_RECORD_SET'
       AND identity_basis->'continuation_operation_key'->>'logical_time'=$1`,
    [logicalTime],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].record_set_id as string;
}

function runExistingPersistenceDbV1(): void {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["exec", "tsx", PERSISTENCE_SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      MCFT_CAP_02_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE: "1",
    },
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.match(result.stdout, /MCFT-CAP-02 persistence DB: 15 PASS, 0 FAIL/);
}

type ChildResultV1 = {
  stage: string;
  status?: string;
  record_set_id?: string;
  record_set_hash?: string;
  logical_time?: string;
};

function spawnStageV1(stage: string, expectSuccess: boolean): ChildResultV1 | null {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawnSync(command, ["exec", "tsx", SCRIPT_RELATIVE_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      MCFT_CAP_02_FAILURE_RECOVERY_CHILD_STAGE: stage,
    },
    encoding: "utf8",
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (expectSuccess) {
    assert.equal(child.status, 0, child.error?.message ?? child.stderr);
    const marker = child.stdout.split(/\r?\n/).find((line) => line.startsWith(CHILD_MARKER));
    assert.ok(marker, `child marker required: ${stage}`);
    return JSON.parse(marker.slice(CHILD_MARKER.length)) as ChildResultV1;
  }
  assert.notEqual(child.status, 0, `child stage unexpectedly succeeded: ${stage}`);
  return null;
}

function writeChildResultV1(result: ChildResultV1): void {
  process.stdout.write(`${CHILD_MARKER}${JSON.stringify(result)}\n`);
}

async function childPrecommitCrashV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const services = createProductionServicesV1(pool, fixture);
    await services.tickService.executeOneTick({
      ...fixture.request,
      logical_time: fixture.persistedResumeStartLogicalTime,
      lease_owner: SHARED_LEASE_OWNER,
      fault_injection: (stage) => {
        if (stage === "before_commit") throw new Error("SIMULATED_PRECOMMIT_PROCESS_CRASH");
      },
    });
    throw new Error("PRECOMMIT_CRASH_NOT_TRIGGERED");
  } finally {
    await pool.end();
  }
}

async function childResumeOneV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const services = createProductionServicesV1(pool, fixture);
    const result = await services.tickService.executeOneTick({
      ...fixture.request,
      logical_time: fixture.persistedResumeStartLogicalTime,
      lease_owner: SHARED_LEASE_OWNER,
    });
    writeChildResultV1({
      stage: "resume-one",
      status: result.status,
      record_set_id: result.record_set.continuation_record_set_id,
      record_set_hash: result.record_set.continuation_record_set_determinism_hash,
      logical_time: result.record_set.continuation_operation_key.logical_time,
    });
  } finally {
    await pool.end();
  }
}

async function childPostcommitLossV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const services = createProductionServicesV1(pool, fixture);
    const result = await services.tickService.executeOneTick({
      ...fixture.request,
      logical_time: fixture.persistedResumeStartLogicalTime,
      lease_owner: SHARED_LEASE_OWNER,
    });
    assert.equal(result.status, "INSERTED");
    throw new Error("SIMULATED_RESPONSE_LOSS_AFTER_COMMIT");
  } finally {
    await pool.end();
  }
}

async function childRetryExistingV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const recordSetId = await recordSetIdAtV1(pool, fixture.persistedResumeStartLogicalTime);
    const recordSet = await runtimeRepository.readContinuationRecordSet(recordSetId);
    assert.ok(recordSet);
    const invalidLease: RuntimeLeaseClaimV1 = {
      ...fixture.scope,
      lease_owner: "intentionally-invalid-retry-owner",
      lease_duration_seconds: 1,
      fencing_token: 0n,
    };
    const result = await runtimeRepository.commitContinuationState({
      scope: fixture.scope,
      lease: invalidLease,
      expected: {
        active_lineage_ref: "invalid",
        lineage_id: "invalid",
        revision_id: "invalid",
        previous_checkpoint_ref: "invalid",
        previous_state_ref: "invalid",
        previous_forecast_result_ref: "invalid",
        latest_successful_forecast_ref: null,
      },
      record_set: recordSet,
    });
    writeChildResultV1({
      stage: "retry-existing",
      status: result.status,
      record_set_id: result.record_set.continuation_record_set_id,
      record_set_hash: result.record_set.continuation_record_set_determinism_hash,
      logical_time: result.record_set.continuation_operation_key.logical_time,
    });
  } finally {
    await pool.end();
  }
}

async function parentMainV1(): Promise<void> {
  const fixture = await buildMcftCap02RestartBackfillFixtureV1();

  runExistingPersistenceDbV1();
  ok("existing PostgreSQL fault injection, stale fencing, CAS, idempotency, and rebuild proofs pass unchanged");

  let pool = new Pool({ connectionString: databaseUrl });
  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  await runFirstTwelveV1(pool, fixture);
  const preCrashPointers = await latestPointersV1(pool, fixture.scope);
  const preCrashFacts = await a2FactCountV1(pool);
  const preCrashGuards = await a2GuardCountV1(pool);
  await pool.end();

  spawnStageV1("precommit-crash", false);

  pool = new Pool({ connectionString: databaseUrl });
  assert.equal(await a2GuardCountV1(pool), preCrashGuards);
  assert.equal(await a2FactCountV1(pool), preCrashFacts);
  assert.deepEqual(await latestPointersV1(pool, fixture.scope), preCrashPointers);
  const crashHandoff = await createProductionServicesV1(pool, fixture).handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(crashHandoff.previous_tick_sequence, 12);
  assert.equal(crashHandoff.next_logical_tick_time, fixture.persistedResumeStartLogicalTime);
  await pool.end();
  ok("pre-commit process crash leaves tick 13 with zero A2 append and all latest pointers at tick 12");

  const resumed = spawnStageV1("resume-one", true);
  assert.equal(resumed?.status, "INSERTED");
  assert.equal(resumed?.logical_time, fixture.persistedResumeStartLogicalTime);
  pool = new Pool({ connectionString: databaseUrl });
  assert.equal(await a2GuardCountV1(pool), 13);
  assert.equal(await a2FactCountV1(pool), 104);
  const resumedHandoff = await createProductionServicesV1(pool, fixture).handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(resumedHandoff.previous_tick_sequence, 13);
  await pool.end();
  ok("a fresh operating-system process retries the failed tick and commits tick 13 exactly once");

  pool = new Pool({ connectionString: databaseUrl });
  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  await runFirstTwelveV1(pool, fixture);
  const servicesForStop = createProductionServicesV1(pool, fixture);
  const attemptedTimes: string[] = [];
  const failingRange = new ContiguousContinuationRangeServiceV1(
    servicesForStop.handoffService,
    {
      async executeOneTick(input) {
        attemptedTimes.push(input.logical_time);
        return servicesForStop.tickService.executeOneTick({
          ...input,
          fault_injection: (stage) => {
            if (stage === "before_commit") throw new Error("STOP_ON_FIRST_FAILURE_SENTINEL");
          },
        });
      },
    },
  );
  await assert.rejects(
    failingRange.runContiguousContinuationRangeV1({
      ...fixture.request,
      to_logical_time: fixture.finalTargetLogicalTime,
      lease_owner: SHARED_LEASE_OWNER,
    }),
    /STOP_ON_FIRST_FAILURE_SENTINEL/,
  );
  assert.deepEqual(attemptedTimes, [fixture.persistedResumeStartLogicalTime]);
  assert.equal(await a2GuardCountV1(pool), 12);
  const stoppedHandoff = await servicesForStop.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(stoppedHandoff.previous_tick_sequence, 12);
  assert.equal(stoppedHandoff.next_logical_tick_time, fixture.persistedResumeStartLogicalTime);
  await pool.end();
  ok("range stops on the first failed tick and does not attempt ticks 14 through 24");

  pool = new Pool({ connectionString: databaseUrl });
  await initializeAndResetV1(pool);
  await seedV1(pool, fixture);
  await runFirstTwelveV1(pool, fixture);
  await pool.end();

  spawnStageV1("postcommit-loss", false);

  pool = new Pool({ connectionString: databaseUrl });
  assert.equal(await a2GuardCountV1(pool), 13);
  assert.equal(await a2FactCountV1(pool), 104);
  const postCommitPointers = await latestPointersV1(pool, fixture.scope);
  const postCommitFacts = await a2FactCountV1(pool);
  const postCommitGuards = await a2GuardCountV1(pool);
  const postCommitLease = await leaseTokenV1(pool, fixture.scope);
  const tick13RecordSetId = await recordSetIdAtV1(pool, fixture.persistedResumeStartLogicalTime);
  await pool.end();
  ok("simulated response loss occurs only after tick 13 is atomically committed");

  const retryResult = spawnStageV1("retry-existing", true);
  assert.equal(retryResult?.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(retryResult?.record_set_id, tick13RecordSetId);

  pool = new Pool({ connectionString: databaseUrl });
  assert.equal(await a2FactCountV1(pool), postCommitFacts);
  assert.equal(await a2GuardCountV1(pool), postCommitGuards);
  assert.equal(await leaseTokenV1(pool, fixture.scope), postCommitLease);
  assert.deepEqual(await latestPointersV1(pool, fixture.scope), postCommitPointers);
  await pool.end();
  ok("fresh-process retry after response loss returns existing success without facts, projections, or fence mutation");

  pool = new Pool({ connectionString: databaseUrl });
  const servicesForRepair = createProductionServicesV1(pool, fixture);
  const previousState = await pool.query(
    "SELECT state_object_id FROM twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND logical_time=$7::timestamptz",
    [...scopeValuesV1(fixture.scope), fixture.splitTargetLogicalTime],
  );
  assert.equal(previousState.rows.length, 1);
  const previousStateObjectId = previousState.rows[0].state_object_id as string;
  await pool.query(
    "UPDATE twin_state_latest_index_v1 SET state_object_id=$7 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6",
    [...scopeValuesV1(fixture.scope), previousStateObjectId],
  );
  const divergenceFacts = await a2FactCountV1(pool);
  const divergenceGuards = await a2GuardCountV1(pool);
  const divergenceLease = await leaseTokenV1(pool, fixture.scope);
  await assert.rejects(
    servicesForRepair.restartService.resumeFromCheckpointV1({
      ...fixture.request,
      to_logical_time: new Date(
        Date.parse(fixture.persistedResumeStartLogicalTime) + 3600000,
      ).toISOString(),
      lease_owner: SHARED_LEASE_OWNER,
    }),
    /CHECKPOINT_PROJECTION_DIVERGENCE/,
  );
  assert.equal(await a2FactCountV1(pool), divergenceFacts);
  assert.equal(await a2GuardCountV1(pool), divergenceGuards);
  assert.equal(await leaseTokenV1(pool, fixture.scope), divergenceLease);
  ok("projection divergence fails closed without silent repair, lease acquisition, or current-tick writes");

  const rebuilt = await servicesForRepair.runtimeRepository.rebuildContinuationProjections(tick13RecordSetId);
  assert.equal(rebuilt.rebuilt_projection_count, 5);
  const repairedHandoff = await servicesForRepair.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(repairedHandoff.previous_tick_sequence, 13);
  assert.equal(repairedHandoff.next_logical_tick_time, new Date(Date.parse(fixture.persistedResumeStartLogicalTime) + 3600000).toISOString());
  const tick14 = await servicesForRepair.tickService.executeOneTick({
    ...fixture.request,
    logical_time: repairedHandoff.next_logical_tick_time,
    lease_owner: SHARED_LEASE_OWNER,
  });
  assert.equal(tick14.status, "INSERTED");
  assert.equal(await a2GuardCountV1(pool), 14);
  const finalHandoff = await servicesForRepair.handoffService.resumeFromCheckpointV1(fixture.scope);
  assert.equal(finalHandoff.previous_tick_sequence, 14);
  await pool.end();
  ok("explicit canonical projection rebuild restores the handoff and continuation resumes through the existing single-tick path");

  console.log(`MCFT-CAP-02 failure recovery DB: ${pass} PASS, 0 FAIL`);
}

const childStage = process.env.MCFT_CAP_02_FAILURE_RECOVERY_CHILD_STAGE;
if (childStage === "precommit-crash") {
  childPrecommitCrashV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (childStage === "resume-one") {
  childResumeOneV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (childStage === "postcommit-loss") {
  childPostcommitLossV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (childStage === "retry-existing") {
  childRetryExistingV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  parentMainV1().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
