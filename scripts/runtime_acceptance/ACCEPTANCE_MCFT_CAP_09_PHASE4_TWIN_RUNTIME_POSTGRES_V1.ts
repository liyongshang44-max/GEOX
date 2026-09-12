import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  PostgresTwinRuntimeDatabaseClockV1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.js";
import {
  PostgresExpiredSlotRecoveryAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import {
  PostgresPersistentSequentialSchedulerAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import type {
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_TWIN_RUNTIME_POSTGRES_V1_RESULT.json",
);

const scope: TwinScopeKeyV1 = {
  tenant_id: "phase4_twin_runtime_acceptance",
  project_id: "phase4_project",
  group_id: "phase4_group",
  field_id: "phase4_field",
  season_id: "phase4_season",
  zone_id: "phase4_zone",
};

const scopeValues = [
  scope.tenant_id,
  scope.project_id,
  scope.group_id,
  scope.field_id,
  scope.season_id,
  scope.zone_id,
];

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function boundary(
  start: string,
  slot: number,
  observedAt: string,
): ShadowOnlineBoundaryV1 {
  return {
    scope: { ...scope },
    slot_id: `O${String(slot).padStart(2, "0")}` as ShadowOnlineSlotIdV1,
    logical_time: addHours(start, slot),
    scheduler_wall_clock_observed_at: observedAt,
    interval_seconds: 3600,
  };
}

function terminal(
  claim: ShadowOnlineSlotClaimV1,
  observedAt: string,
  suffix: string,
) {
  return {
    boundary: structuredClone(claim.boundary),
    state: "COMPLETED" as const,
    tick_ref: `phase4:tick:${suffix}`,
    health_ref: `phase4:health:${suffix}`,
    terminal_at: observedAt,
  };
}

async function cleanup(pool: Pool): Promise<void> {
  await pool.query(
    `DELETE FROM public.twin_shadow_online_scheduler_slot_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValues,
  );
  await pool.query(
    `DELETE FROM public.twin_shadow_online_scheduler_cursor_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValues,
  );
  await pool.query(
    `DELETE FROM public.twin_runtime_lease_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValues,
  );
}

async function main(): Promise<void> {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  assert(databaseUrl, "PHASE4_POSTGRES_DATABASE_URL_REQUIRED");

  const pool = new Pool({ connectionString: databaseUrl, max: 8 });
  try {
    await cleanup(pool);

    const beforeFacts = Number(
      (await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM public.facts"))
        .rows[0]?.n ?? "0",
    );

    const databaseClock = new PostgresTwinRuntimeDatabaseClockV1(pool);
    const firstClock = await databaseClock.readDatabaseNow();
    const floorHour = new Date(
      Math.floor(Date.parse(firstClock.observed_at) / 3_600_000) * 3_600_000,
    ).toISOString();
    const scheduleStart = addHours(floorHour, -3);

    const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
      pool,
      {
        scope,
        schedule_start_logical_time: scheduleStart,
        slot_interval_seconds: 3600,
      },
      { mode: "SYSTEM_DATABASE_UTC" },
    );
    const recovery = new PostgresExpiredSlotRecoveryAdapterV1(pool, scope);

    const observed = (await databaseClock.readDatabaseNow()).observed_at;
    const due = [0, 1, 2, 3].map((slot) =>
      boundary(scheduleStart, slot, observed),
    );

    const initialMissed = await scheduler.listMissedSlots({
      scope,
      through_logical_time: observed,
    });
    assert.deepEqual(
      initialMissed.slice(0, 4).map((item) => item.slot_id),
      ["O00", "O01", "O02", "O03"],
      "PHASE4_DB_CLOCK_OLDEST_DUE_SET_REQUIRED",
    );

    await assert.rejects(
      () => scheduler.claimDueSlot({
        boundary: due[1],
        lease_owner: "phase4-owner-b",
        lease_duration_seconds: 300,
      }),
      /OLDER_MISSED_SLOT_REQUIRED/,
    );

    await assert.rejects(
      () => scheduler.claimDueSlot({
        boundary: boundary(scheduleStart, 4, observed),
        lease_owner: "phase4-owner-future",
        lease_duration_seconds: 300,
      }),
      /FUTURE_BOUNDARY_CLAIM_REJECTED/,
    );

    const preSlotOwner = await scheduler.acquireOrRenewOwnershipLease({
      lease_owner: "phase4-owner-a",
      lease_duration_seconds: 300,
    });
    assert(preSlotOwner, "PHASE4_PRE_SLOT_SCHEDULER_OWNER_LEASE_REQUIRED");
    const preSlotRenewed = await scheduler.acquireOrRenewOwnershipLease({
      lease_owner: "phase4-owner-a",
      lease_duration_seconds: 300,
    });
    assert(preSlotRenewed, "PHASE4_PRE_SLOT_SCHEDULER_OWNER_RENEW_REQUIRED");
    assert.equal(
      preSlotRenewed.fencing_token,
      preSlotOwner.fencing_token,
      "PHASE4_SAME_OWNER_HEARTBEAT_MUST_PRESERVE_FENCE",
    );
    const standbyOwner = await scheduler.acquireOrRenewOwnershipLease({
      lease_owner: "phase4-owner-standby",
      lease_duration_seconds: 300,
    });
    assert.equal(
      standbyOwner,
      null,
      "PHASE4_DUPLICATE_PRE_SLOT_SCHEDULER_OWNER_MUST_STANDBY",
    );

    const claim0 = await scheduler.claimDueSlot({
      boundary: due[0],
      lease_owner: "phase4-owner-a",
      lease_duration_seconds: 300,
    });
    assert.equal(
      claim0.fencing_token,
      preSlotOwner.fencing_token,
      "PHASE4_DUE_SLOT_MUST_REUSE_PRE_SLOT_OWNER_FENCE",
    );
    const claim0Retry = await scheduler.claimDueSlot({
      boundary: due[0],
      lease_owner: "phase4-owner-a",
      lease_duration_seconds: 300,
    });
    assert.deepEqual(claim0Retry, claim0);

    await assert.rejects(
      () => scheduler.claimDueSlot({
        boundary: due[0],
        lease_owner: "phase4-owner-other",
        lease_duration_seconds: 300,
      }),
      /SLOT_ALREADY_CLAIMED_BY_OTHER_OWNER/,
    );

    await pool.query(
      `UPDATE public.twin_runtime_lease_v1
          SET acquired_at=transaction_timestamp()-interval '10 minutes',
              heartbeat_at=transaction_timestamp()-interval '5 minutes',
              expires_at=transaction_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValues,
    );

    const recoveryClock = (await databaseClock.readDatabaseNow()).observed_at;
    const recovered = await recovery.recoverExpiredActiveSlot({
      scope,
      through_logical_time: recoveryClock,
      lease_owner: "phase4-owner-after-restart",
      lease_duration_seconds: 300,
    });
    assert(recovered, "PHASE4_EXPIRED_ACTIVE_SLOT_MUST_RECOVER");
    assert.equal(recovered.idempotency_key, claim0.idempotency_key);
    assert(recovered.fencing_token > claim0.fencing_token);

    await assert.rejects(
      () => scheduler.recordTerminalResult({
        claim: claim0,
        result: terminal(claim0, recoveryClock, "stale-o00"),
      }),
      /STALE_FENCING_TOKEN|LEASE_OWNER_MISMATCH/,
    );

    await scheduler.recordTerminalResult({
      claim: recovered,
      result: terminal(recovered, recoveryClock, "o00"),
    });

    const restartedScheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
      pool,
      {
        scope,
        schedule_start_logical_time: scheduleStart,
        slot_interval_seconds: 3600,
      },
      { mode: "SYSTEM_DATABASE_UTC" },
    );

    const afterRestart = await restartedScheduler.listMissedSlots({
      scope,
      through_logical_time: (await databaseClock.readDatabaseNow()).observed_at,
    });
    assert.deepEqual(
      afterRestart.slice(0, 3).map((item) => item.slot_id),
      ["O01", "O02", "O03"],
      "PHASE4_RESTART_DURABLE_CURSOR_OLDEST_FIRST_REQUIRED",
    );

    const fences = [recovered.fencing_token];
    for (let slot = 1; slot <= 3; slot += 1) {
      const now = (await databaseClock.readDatabaseNow()).observed_at;
      const claim = await restartedScheduler.claimDueSlot({
        boundary: boundary(scheduleStart, slot, now),
        lease_owner: `phase4-catchup-${slot}`,
        lease_duration_seconds: 300,
      });
      assert(
        claim.fencing_token > fences[fences.length - 1]!,
        "PHASE4_FENCING_TOKEN_MUST_MONOTONICALLY_ADVANCE",
      );
      fences.push(claim.fencing_token);
      await restartedScheduler.recordTerminalResult({
        claim,
        result: terminal(claim, now, `o0${slot}`),
      });
    }

    const cursor = (
      await pool.query<{
        next_slot_index: number;
        next_slot_id: string | null;
        next_logical_time: string | Date | null;
        last_terminal_slot_id: string | null;
        last_fencing_token: string | number | bigint | null;
      }>(
        `SELECT next_slot_index,next_slot_id,next_logical_time,
                last_terminal_slot_id,last_fencing_token
           FROM public.twin_shadow_online_scheduler_cursor_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        scopeValues,
      )
    ).rows[0];
    assert(cursor, "PHASE4_DURABLE_RUNTIME_CURSOR_REQUIRED");
    assert.equal(cursor.next_slot_index, 4);
    assert.equal(cursor.next_slot_id, "O04");
    assert.equal(cursor.last_terminal_slot_id, "O03");
    assert.equal(BigInt(cursor.last_fencing_token ?? 0), fences.at(-1));

    const slots = (
      await pool.query<{ slot_id: string; state: string }>(
        `SELECT slot_id,state
           FROM public.twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
            AND field_id=$4 AND season_id=$5 AND zone_id=$6
          ORDER BY logical_time`,
        scopeValues,
      )
    ).rows;
    assert.deepEqual(slots, [
      { slot_id: "O00", state: "COMPLETED" },
      { slot_id: "O01", state: "COMPLETED" },
      { slot_id: "O02", state: "COMPLETED" },
      { slot_id: "O03", state: "COMPLETED" },
    ]);

    const postScheduleOwner = await restartedScheduler.acquireOrRenewOwnershipLease({
      lease_owner: "phase4-owner-presence-after-o03",
      lease_duration_seconds: 300,
    });
    assert(postScheduleOwner, "PHASE4_POST_SLOT_OWNER_PRESENCE_REQUIRED");
    assert(
      postScheduleOwner.fencing_token > fences.at(-1)!,
      "PHASE4_POST_SLOT_OWNER_PRESENCE_MUST_ADVANCE_EXPIRED_FENCE",
    );
    const releaseStatus = await restartedScheduler.releaseOwnershipLease({
      claim: postScheduleOwner,
    });
    assert.equal(releaseStatus, "RELEASED");

    const activeCount = Number(
      (
        await pool.query<{ n: string }>(
          `SELECT count(*)::text AS n
             FROM public.twin_shadow_online_scheduler_slot_v1
            WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
              AND field_id=$4 AND season_id=$5 AND zone_id=$6
              AND state IN ('CLAIMED','RUNNING')`,
          scopeValues,
        )
      ).rows[0]?.n ?? "0",
    );
    assert.equal(activeCount, 0);

    const afterFacts = Number(
      (await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM public.facts"))
        .rows[0]?.n ?? "0",
    );
    assert.equal(afterFacts, beforeFacts, "PHASE4_SCHEDULER_MUST_NOT_WRITE_FACTS");

    const proof = {
      schema_version: "geox_mcft_cap09_phase4_twin_runtime_postgres_qualification_v1",
      status: "PASS",
      database_clock_authority: "POSTGRES_TRANSACTION_TIMESTAMP",
      real_postgres: true,
      runtime_tick_cursor_durable: true,
      oldest_due_first: true,
      future_slot_rejected: true,
      same_owner_claim_idempotent: true,
      pre_slot_scheduler_owner_presence: true,
      same_owner_presence_renew_preserves_fence: true,
      duplicate_pre_slot_owner_standby: true,
      due_slot_reuses_pre_slot_owner_fence: true,
      owner_presence_compare_and_set_release: true,
      duplicate_owner_rejected: true,
      expired_active_slot_recovered: true,
      recovery_preserved_idempotency_key: true,
      recovery_advanced_fence: true,
      stale_fence_rejected: true,
      process_restart_cursor_readback: true,
      bounded_catch_up_slots: ["O00", "O01", "O02", "O03"],
      final_next_slot_id: cursor.next_slot_id,
      final_next_slot_index: cursor.next_slot_index,
      maximum_active_slot_count: activeCount,
      canonical_fact_delta: afterFacts - beforeFacts,
      provider_request_count: 0,
      r2_request_count: 0,
      evidence_supply_cursor_mutation: false,
      production_container_activation: false,
      formal_v5_armed: false,
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await cleanup(pool).catch(() => undefined);
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
