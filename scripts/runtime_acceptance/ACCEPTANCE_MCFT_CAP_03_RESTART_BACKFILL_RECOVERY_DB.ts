// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_DB.ts
// Purpose: compose the verified CAP-03 PostgreSQL recovery and 24-tick suites, then prove the S6 restart orchestrator reads the completed canonical chain without a new lease, fact, guard, or revision.
// Boundary: destructive isolated-database acceptance only; no production database, migration, route, scheduler, successful Forecast, late-Evidence revision, Recommendation, Decision, action, calibration, or model activation.

import assert from "node:assert/strict";
import cp from "node:child_process";
import { Pool } from "pg";
import {
  PostgresAssimilatedRuntimeRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  AssimilatedContiguousRangeServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.js";
import {
  AssimilatedContinuationTickServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
import {
  AssimilatedRestartResumeServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.js";
import {
  PrepareNextTickInputServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1,
  S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
} from "./mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.js";

if (
  process.env
    .MCFT_CAP_03_S6_DESTRUCTIVE_ACCEPTANCE
  !== "1"
) {
  throw new Error(
    "SET_MCFT_CAP_03_S6_DESTRUCTIVE_ACCEPTANCE_1",
  );
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_REQUIRED");
}

const databaseName = new URL(databaseUrl)
  .pathname
  .replace(/^\//, "")
  .toLowerCase();

if (
  !/(mcft|cap03|s6|restart|acceptance|test)/
    .test(databaseName)
) {
  throw new Error(
    "ISOLATED_ACCEPTANCE_DATABASE_REQUIRED",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
});

let pass = 0;

function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

function runExistingDbAcceptanceV1(input: {
  script: string;
  environment_key: string;
}): void {
  cp.execFileSync(
    process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm",
    [
      "exec",
      "tsx",
      input.script,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        [input.environment_key]: "1",
      },
      stdio: "inherit",
    },
  );
}

function scopeParamsV1(
  scope: TwinScopeKeyV1,
): unknown[] {
  return [
    scope.tenant_id,
    scope.project_id,
    scope.group_id,
    scope.field_id,
    scope.season_id,
    scope.zone_id,
  ];
}

async function fencingTokenV1(
  scope: TwinScopeKeyV1,
): Promise<bigint> {
  const result = await pool.query(
    `SELECT fencing_token
     FROM twin_runtime_lease_v1
     WHERE tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
    scopeParamsV1(scope),
  );

  assert.equal(result.rows.length, 1);

  return BigInt(
    result.rows[0].fencing_token,
  );
}

async function scopedFactCountV1(
  scope: TwinScopeKeyV1,
): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
     FROM facts
     WHERE record_json->'payload'->>'tenant_id'=$1
       AND record_json->'payload'->>'project_id'=$2
       AND record_json->'payload'->>'group_id'=$3
       AND record_json->'payload'->>'field_id'=$4
       AND record_json->'payload'->>'season_id'=$5
       AND record_json->'payload'->>'zone_id'=$6`,
    scopeParamsV1(scope),
  );

  return result.rows[0].count as number;
}

async function scopedA2GuardCountV1(
  scope: TwinScopeKeyV1,
): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS count
     FROM twin_object_idempotency_index_v1
     WHERE identity_kind='A2_RECORD_SET'
       AND tenant_id=$1
       AND project_id=$2
       AND group_id=$3
       AND field_id=$4
       AND season_id=$5
       AND zone_id=$6`,
    scopeParamsV1(scope),
  );

  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  runExistingDbAcceptanceV1({
    script:
      "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts",
    environment_key:
      "MCFT_CAP_03_S3B_DESTRUCTIVE_ACCEPTANCE",
  });
  ok("verified PostgreSQL recovery suite proves precommit rollback, response-loss idempotency, fencing, CAS, divergence, and explicit rebuild");

  runExistingDbAcceptanceV1({
    script:
      "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts",
    environment_key:
      "MCFT_CAP_03_S5_DESTRUCTIVE_ACCEPTANCE",
  });
  ok("verified PostgreSQL range suite persists the canonical 24-tick CAP-03 chain");

  const fixture =
    await buildMcftCap03TwentyFourObservationAwareTickRangeFixtureV1();

  const repository =
    new PostgresAssimilatedRuntimeRepositoryV1(
      pool,
    );

  const nextTickRepository =
    new PostgresNextTickRepositoryV1(pool);

  const handoffService =
    new PrepareNextTickInputServiceV1(
      nextTickRepository,
    );

  const tickService =
    new AssimilatedContinuationTickServiceV1(
      handoffService,
      fixture.evidenceSource,
      repository,
      repository,
    );

  const rangeService =
    new AssimilatedContiguousRangeServiceV1(
      handoffService,
      tickService,
    );

  const restartService =
    new AssimilatedRestartResumeServiceV1(
      handoffService,
      rangeService,
    );

  const persistedRestart =
    await handoffService.resumeFromCheckpointV1(
      fixture.scope,
    );

  assert.equal(
    persistedRestart.previous_tick_sequence,
    48,
  );
  assert.equal(
    persistedRestart.next_logical_tick_time,
    S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  );
  assert.equal(
    persistedRestart.previous_terminal_tick_logical_time,
    fixture.lastLogicalTime,
  );
  ok("fresh PostgreSQL restart read reconstructs checkpoint 48, terminal tick 24, and the frozen next handoff");

  const factsBefore =
    await scopedFactCountV1(fixture.scope);

  const guardsBefore =
    await scopedA2GuardCountV1(fixture.scope);

  const tokenBefore =
    await fencingTokenV1(fixture.scope);

  const completedResume =
    await restartService
      .resumeAssimilatedFromCheckpointV1({
        ...fixture.rangeInput,
        lease_owner:
          "mcft-cap-03-s6-db-completed-resume",
      });

  assert.equal(
    completedResume.operator_intent,
    "RESUME",
  );
  assert.equal(
    completedResume.persisted_start_logical_time,
    S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
  );
  assert.equal(
    completedResume.range_result.status,
    "ALREADY_COMPLETE",
  );
  assert.equal(
    completedResume.range_result.executed_tick_count,
    0,
  );
  assert.deepEqual(
    completedResume.range_result.tick_results,
    [],
  );
  ok("S6 restart orchestrator treats an already completed PostgreSQL target as zero-mutation canonical success");

  assert.equal(
    await scopedFactCountV1(fixture.scope),
    factsBefore,
  );
  assert.equal(
    await scopedA2GuardCountV1(fixture.scope),
    guardsBefore,
  );
  assert.equal(
    await fencingTokenV1(fixture.scope),
    tokenBefore,
  );
  ok("completed PostgreSQL resume adds no fact, A2 guard, lease, revision, or successful-Forecast pointer");

  const completedBackfill =
    await restartService
      .runAssimilatedBoundedBackfillV1({
        ...fixture.rangeInput,
        lease_owner:
          "mcft-cap-03-s6-db-completed-backfill",
        evidence_intent:
          "MISSED_SCHEDULE_CATCH_UP",
        requested_start_logical_time:
          S5_NEXT_HANDOFF_LOGICAL_TIME_V1,
      });

  assert.equal(
    completedBackfill.operator_intent,
    "BACKFILL",
  );
  assert.equal(
    completedBackfill.range_result.status,
    "ALREADY_COMPLETE",
  );
  assert.equal(
    completedBackfill.range_result.executed_tick_count,
    0,
  );
  assert.equal(
    await scopedFactCountV1(fixture.scope),
    factsBefore,
  );
  assert.equal(
    await scopedA2GuardCountV1(fixture.scope),
    guardsBefore,
  );
  assert.equal(
    await fencingTokenV1(fixture.scope),
    tokenBefore,
  );
  ok("completed bounded backfill also performs zero PostgreSQL mutation");

  console.log(
    `MCFT-CAP-03 restart backfill recovery DB: ${pass} PASS, 0 FAIL`,
  );
}

main()
  .finally(async () => {
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
