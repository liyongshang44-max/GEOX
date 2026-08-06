import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  PostgresPersistentSequentialSchedulerAdapterV1,
  StrictUtcHourlySchedulerClockV1,
  type PersistentSequentialSchedulerConfigV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import type {
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_S3_POSTGRESQL_ACCEPTANCE_RESULT.json");
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeSqlValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const config: PersistentSequentialSchedulerConfigV1 = {
  scope,
  schedule_start_logical_time: "2026-08-05T00:00:00.000Z",
  slot_interval_seconds: 3600,
};

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql"), "utf8"));
}

async function factCount(pool: Pool): Promise<number> {
  return (await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM facts")).rows[0].n;
}

function terminal(
  claim: ShadowOnlineSlotClaimV1,
  state: "COMPLETED" | "DEGRADED" | "FAILED",
  suffix: string,
): ShadowOnlineTerminalSlotResultV1 {
  return {
    boundary: structuredClone(claim.boundary),
    state,
    tick_ref: state === "FAILED" ? null : `tick:${suffix}`,
    health_ref: `health:${suffix}`,
    terminal_at: new Date(Date.parse(claim.boundary.logical_time) + 300_000).toISOString(),
  };
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_09_S3_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP_09_S3_DESTRUCTIVE_ACCEPTANCE_1");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/(mcft|cap.*09|s3|scheduler|acceptance|test)/i.test(databaseName)) {
    throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);
  }

  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);
    const beforeFacts = await factCount(pool);
    const fixedNow = new Date("2026-08-05T03:05:00.000Z");
    const clock = new StrictUtcHourlySchedulerClockV1(config, () => new Date(fixedNow));
    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, config);

    const boundaries: ShadowOnlineBoundaryV1[] = [];
    for (const slotId of ["O00", "O01", "O02", "O03"] as const) {
      boundaries.push(await clock.resolveBoundary({ scope, slot_id: slotId }));
    }
    assert.deepEqual(boundaries.map((item) => item.logical_time), [
      "2026-08-05T00:00:00.000Z",
      "2026-08-05T01:00:00.000Z",
      "2026-08-05T02:00:00.000Z",
      "2026-08-05T03:00:00.000Z",
    ]);
    assert(boundaries.every((item) => item.interval_seconds === 3600));
    await assert.rejects(
      () => new StrictUtcHourlySchedulerClockV1(
        { ...config, schedule_start_logical_time: "2099-01-01T00:00:00.000Z" },
        () => new Date("2026-08-05T03:05:00.000Z"),
      ).resolveBoundary({ scope, slot_id: "O00" }),
      /FUTURE_BOUNDARY_CLAIM_REJECTED/,
    );

    const initialMissed = await scheduler.listMissedSlots({ scope, through_logical_time: boundaries[3].logical_time });
    assert.deepEqual(initialMissed.map((item) => item.slot_id), ["O00", "O01", "O02", "O03"]);
    await assert.rejects(
      () => scheduler.claimDueSlot({ boundary: boundaries[1], lease_owner: "writer-b", lease_duration_seconds: 300 }),
      /OLDER_MISSED_SLOT_REQUIRED/,
    );

    const claim0 = await scheduler.claimDueSlot({ boundary: boundaries[0], lease_owner: "writer-a", lease_duration_seconds: 300 });
    const claim0Retry = await scheduler.claimDueSlot({ boundary: boundaries[0], lease_owner: "writer-a", lease_duration_seconds: 300 });
    assert.deepEqual(claim0Retry, claim0, "SAME_ACTIVE_CLAIM_MUST_BE_IDEMPOTENT");
    await assert.rejects(
      () => scheduler.claimDueSlot({ boundary: boundaries[0], lease_owner: "writer-b", lease_duration_seconds: 300 }),
      /SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER/,
    );
    assert.deepEqual(await scheduler.listMissedSlots({ scope, through_logical_time: boundaries[3].logical_time }), []);
    await assert.rejects(
      () => scheduler.recordTerminalResult({
        claim: { ...claim0, fencing_token: claim0.fencing_token - 1n },
        result: terminal(claim0, "COMPLETED", "o00-stale"),
      }),
      /STALE_FENCING_TOKEN/,
    );
    await scheduler.recordTerminalResult({ claim: claim0, result: terminal(claim0, "COMPLETED", "o00") });
    await assert.rejects(
      () => scheduler.recordTerminalResult({ claim: claim0, result: terminal(claim0, "COMPLETED", "o00-repeat") }),
      /TERMINAL_SLOT_ALREADY_RECORDED/,
    );
    await assert.rejects(
      () => scheduler.claimDueSlot({ boundary: boundaries[0], lease_owner: "writer-a", lease_duration_seconds: 300 }),
      /TERMINAL_SLOT_ALREADY_RECORDED/,
    );

    const afterO00 = await scheduler.listMissedSlots({ scope, through_logical_time: boundaries[3].logical_time });
    assert.deepEqual(afterO00.map((item) => item.slot_id), ["O01", "O02", "O03"]);
    await assert.rejects(
      () => scheduler.claimDueSlot({ boundary: boundaries[2], lease_owner: "writer-b", lease_duration_seconds: 300 }),
      /OLDER_MISSED_SLOT_REQUIRED/,
    );
    const claim1 = await scheduler.claimDueSlot({ boundary: boundaries[1], lease_owner: "writer-b", lease_duration_seconds: 300 });
    assert(claim1.fencing_token > claim0.fencing_token, "FENCING_TOKEN_MUST_INCREASE");
    const activeCount = (await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1 WHERE state IN ('CLAIMED','RUNNING')",
    )).rows[0].n;
    assert.equal(activeCount, 1);
    await assert.rejects(
      () => scheduler.claimDueSlot({ boundary: boundaries[2], lease_owner: "writer-b", lease_duration_seconds: 300 }),
      /OLDER_MISSED_SLOT_REQUIRED/,
    );
    await scheduler.recordTerminalResult({ claim: claim1, result: terminal(claim1, "DEGRADED", "o01") });

    const restartedScheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, config);
    const afterRestart = await restartedScheduler.listMissedSlots({ scope, through_logical_time: boundaries[3].logical_time });
    assert.deepEqual(afterRestart.map((item) => item.slot_id), ["O02", "O03"]);
    const claim2 = await restartedScheduler.claimDueSlot({ boundary: boundaries[2], lease_owner: "writer-c", lease_duration_seconds: 300 });
    assert(claim2.fencing_token > claim1.fencing_token, "RESTARTED_WRITER_FENCING_TOKEN_MUST_INCREASE");
    await pool.query(
      `UPDATE twin_shadow_online_scheduler_slot_v1 SET state='RUNNING'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
          AND logical_time=$7::timestamptz`,
      [...scopeSqlValues, boundaries[2].logical_time],
    );
    await assert.rejects(
      () => pool.query(
        `INSERT INTO twin_shadow_online_scheduler_slot_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,slot_id,logical_time,
          scheduler_wall_clock_observed_at,interval_seconds,state,lease_owner,fencing_token,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,'O03',$7::timestamptz,$8::timestamptz,3600,'RUNNING','rogue-writer',999,'rogue-running')`,
        [...scopeSqlValues, boundaries[3].logical_time, boundaries[3].scheduler_wall_clock_observed_at],
      ),
      /duplicate key value|unique constraint/i,
      "DATABASE_MUST_REJECT_SECOND_RUNNING_SLOT",
    );
    await restartedScheduler.recordTerminalResult({ claim: claim2, result: terminal(claim2, "FAILED", "o02") });

    const wrongScope = { ...scope, zone_id: "zoneB" };
    await assert.rejects(
      () => restartedScheduler.listMissedSlots({ scope: wrongScope, through_logical_time: boundaries[3].logical_time }),
      /SCHEDULER_EXACT_SIX_KEY_SCOPE_REQUIRED/,
    );
    await assert.rejects(
      () => restartedScheduler.claimDueSlot({
        boundary: { ...boundaries[3], scheduler_wall_clock_observed_at: "2026-08-05T02:59:59.000Z" },
        lease_owner: "writer-d",
        lease_duration_seconds: 300,
      }),
      /FUTURE_BOUNDARY_CLAIM_REJECTED/,
    );

    const cursor = (await pool.query<{
      next_slot_index: number;
      next_slot_id: string;
      next_logical_time: string | Date;
      last_terminal_slot_id: string;
      last_fencing_token: string;
    }>("SELECT next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_fencing_token FROM twin_shadow_online_scheduler_cursor_v1")).rows[0];
    assert.equal(cursor.next_slot_index, 3);
    assert.equal(cursor.next_slot_id, "O03");
    assert.equal(new Date(cursor.next_logical_time).toISOString(), boundaries[3].logical_time);
    assert.equal(cursor.last_terminal_slot_id, "O02");
    assert.equal(BigInt(cursor.last_fencing_token), claim2.fencing_token);

    const states = await pool.query<{ slot_id: string; state: string }>(
      "SELECT slot_id,state FROM twin_shadow_online_scheduler_slot_v1 ORDER BY logical_time",
    );
    assert.deepEqual(states.rows, [
      { slot_id: "O00", state: "COMPLETED" },
      { slot_id: "O01", state: "DEGRADED" },
      { slot_id: "O02", state: "FAILED" },
    ]);
    assert.equal(await factCount(pool), beforeFacts, "SCHEDULER_MUST_NOT_WRITE_CANONICAL_FACTS");
    const indexDefinitions = (await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='twin_shadow_online_scheduler_slot_v1'",
    )).rows.map((row) => row.indexdef).join("\n");
    assert.match(indexDefinitions, /WHERE \(state = 'RUNNING'::text\)/);
    assert.match(indexDefinitions, /state = ANY \(ARRAY\['CLAIMED'::text, 'RUNNING'::text\]\)/);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRESQL_ISOLATED_PERSISTENT_SEQUENTIAL_SCHEDULER",
      exact_six_key_scope_verified: true,
      strict_utc_hourly_clock_verified: true,
      future_boundary_rejected: true,
      durable_cursor_verified: true,
      restart_cursor_readback_verified: true,
      oldest_due_slot_first_verified: true,
      active_claim_idempotency_verified: true,
      terminal_success_implicit_retry_rejected: true,
      monotonically_increasing_fencing_token_verified: true,
      stale_fencing_token_rejected: true,
      maximum_one_active_slot_per_scope_verified: true,
      maximum_one_running_slot_per_scope_verified: true,
      terminal_states_verified: ["COMPLETED", "DEGRADED", "FAILED"],
      operational_table_count: 2,
      canonical_fact_delta: 0,
      canonical_write_performed: false,
      background_scheduler_started: false,
      production_wiring_present: false,
      final_cursor_slot_id: cursor.next_slot_id,
      final_cursor_slot_index: cursor.next_slot_index,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: String(error?.message ?? error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
