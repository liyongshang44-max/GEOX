import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  ExternalFormalNextTickNotViablePreclaimErrorV1,
  ExternalFormalV5ViabilityGatedSchedulerV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v5_viability_gated_scheduler_v1.js";
import {
  PostgresExternalFormalNextTickViabilityV1,
  type ExternalFormalNextTickViabilityPortV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_next_tick_viability_v1.js";
import type {
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineTerminalSlotResultV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_NEXT_TICK_VIABILITY_POSTGRES_RESULT.json");
const SUBJECT = "c".repeat(40);
const O00 = "2099-03-01T04:00:00.000Z";
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];

function addHours(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 3_600_000).toISOString();
}
function addMinutes(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 60_000).toISOString();
}
function boundary(index: number): ShadowOnlineBoundaryV1 {
  return {
    scope: { ...scope },
    slot_id: `O${String(index).padStart(2, "0")}` as ShadowOnlineBoundaryV1["slot_id"],
    logical_time: addHours(O00, index),
    scheduler_wall_clock_observed_at: addMinutes(addHours(O00, index), 5),
    interval_seconds: 3600,
  };
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql"), "utf8"));
}

async function setRuntimeCursor(pool: Pool, index: number): Promise<void> {
  await pool.query("DELETE FROM twin_shadow_online_scheduler_cursor_v1");
  await pool.query(
    `INSERT INTO twin_shadow_online_scheduler_cursor_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10::timestamptz)`,
    [...scopeValues, O00, index, `O${String(index).padStart(2, "0")}`, addHours(O00, index)],
  );
}

async function seedForcingCursor(pool: Pool, epoch: string, lastContiguous: string): Promise<void> {
  const first = O00;
  const last = addHours(O00, 22);
  const completed = lastContiguous === last;
  const next = completed ? null : addHours(lastContiguous, 1);
  await pool.query(
    `INSERT INTO twin_external_formal_forcing_base_cursor_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,first_required_base,last_required_base,last_contiguous_eligible_base,next_missing_required_base,completed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11::timestamptz,$12::timestamptz,$13)`,
    [...scopeValues, epoch, SUBJECT, first, last, lastContiguous, next, completed],
  );
}

async function seedAttestedTarget(pool: Pool, epoch: string, base: string, attestedAt = addMinutes(base, -4)): Promise<void> {
  await pool.query(
    `INSERT INTO twin_external_formal_forcing_base_target_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key,
      weather_fact_id,weather_source_record_hash,weather_record_semantic_hash,
      et0_fact_id,et0_source_record_hash,et0_record_semantic_hash,
      soil_fact_id,soil_source_record_hash,soil_record_semantic_hash,
      post_commit_db_readback_at,formal_visible_attested_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz,'FORMAL_VISIBLE_ATTESTED',$10,
             'weather-fact','weather-source-hash','weather-semantic-hash',
             'et0-fact','et0-source-hash','et0-semantic-hash',
             'soil-fact','soil-source-hash','soil-semantic-hash',
             $11::timestamptz,$12::timestamptz)`,
    [...scopeValues, epoch, SUBJECT, base, `viability:${epoch}:${base}`, addMinutes(base, -5), attestedAt],
  );
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_VIABILITY_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_VIABILITY_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);

    const epoch = "v13-next-tick-viability";
    const checker = new PostgresExternalFormalNextTickViabilityV1(pool, { scope, epoch_id: epoch, subject_sha: SUBJECT, o00_logical_time: O00 });

    // O00 is A0 warm-start, but still requires the runtime cursor to name exact O00 preclaim.
    await setRuntimeCursor(pool, 0);
    const o00 = await checker.checkPreclaimViability(boundary(0));
    assert.equal(o00.status, "PASS");
    if (o00.status !== "PASS") throw new Error("V13_VIABILITY_O00_PASS_REQUIRED");
    assert.equal(o00.mode, "A0_WARM_START");

    // O01 cannot claim until O00 forcing base is contiguous and physically attested.
    await setRuntimeCursor(pool, 1);
    await seedForcingCursor(pool, epoch, addHours(O00, -1));
    const o01Before = await checker.checkPreclaimViability(boundary(1));
    assert.equal(o01Before.status, "NOT_VIABLE");
    if (o01Before.status !== "NOT_VIABLE") throw new Error("V13_VIABILITY_O01_PRE_ATTEST_FAIL_REQUIRED");
    assert.equal(o01Before.reason, "FORCING_CURSOR_BEHIND_REQUIRED_BASE");

    await pool.query("DELETE FROM twin_external_formal_forcing_base_cursor_v1 WHERE epoch_id=$1", [epoch]);
    await seedForcingCursor(pool, epoch, O00);
    await seedAttestedTarget(pool, epoch, O00);
    const o01After = await checker.checkPreclaimViability(boundary(1));
    assert.equal(o01After.status, "PASS");
    if (o01After.status !== "PASS") throw new Error("V13_VIABILITY_O01_POST_ATTEST_PASS_REQUIRED");
    assert.equal(o01After.required_forcing_base, O00);
    assert.equal(o01After.physical_ingress_attestation_verified, true);

    // Reproduce the v4 seam structurally: runtime has advanced through O07 and wants O08,
    // but the O07 forcing base was never made viable. O08 must be refused before claim.
    const seamEpoch = "v13-a2-blocked-successor-seam";
    await setRuntimeCursor(pool, 8);
    await seedForcingCursor(pool, seamEpoch, addHours(O00, 6));
    await pool.query(
      `INSERT INTO twin_external_formal_forcing_base_target_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key,failure_class)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz,'DEADLINE_MISSED_TERMINAL',$10,'FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED')`,
      [...scopeValues, seamEpoch, SUBJECT, addHours(O00, 7), "v13-o07-terminal"],
    );
    const seamChecker = new PostgresExternalFormalNextTickViabilityV1(pool, { scope, epoch_id: seamEpoch, subject_sha: SUBJECT, o00_logical_time: O00 });
    const o08 = await seamChecker.checkPreclaimViability(boundary(8));
    assert.equal(o08.status, "NOT_VIABLE");
    if (o08.status !== "NOT_VIABLE") throw new Error("V13_VIABILITY_O08_BLOCK_REQUIRED");
    assert.equal(o08.required_forcing_base, addHours(O00, 7));
    assert.equal(o08.reason, "REQUIRED_FORCING_BASE_TERMINAL");

    // Even a cursor claiming continuity is insufficient if physical attestation is late.
    const lateEpoch = "v13-late-physical-attestation";
    await setRuntimeCursor(pool, 1);
    await seedForcingCursor(pool, lateEpoch, O00);
    await seedAttestedTarget(pool, lateEpoch, O00, addMinutes(O00, 1));
    const lateChecker = new PostgresExternalFormalNextTickViabilityV1(pool, { scope, epoch_id: lateEpoch, subject_sha: SUBJECT, o00_logical_time: O00 });
    const late = await lateChecker.checkPreclaimViability(boundary(1));
    assert.equal(late.status, "NOT_VIABLE");
    if (late.status !== "NOT_VIABLE") throw new Error("V13_VIABILITY_LATE_ATTEST_BLOCK_REQUIRED");
    assert.equal(late.reason, "REQUIRED_FORCING_BASE_ATTESTATION_LATE");

    // Gate proof: NOT_VIABLE prevents the underlying durable scheduler claim call entirely.
    let claimCalls = 0;
    const inner: Pick<SchedulerPortV1, "listMissedSlots" | "claimDueSlot" | "recordTerminalResult"> = {
      async listMissedSlots() { return [boundary(8)]; },
      async claimDueSlot(): Promise<ShadowOnlineSlotClaimV1> { claimCalls += 1; throw new Error("INNER_CLAIM_MUST_NOT_RUN"); },
      async recordTerminalResult(_input: { claim: ShadowOnlineSlotClaimV1; result: ShadowOnlineTerminalSlotResultV1 }): Promise<void> {},
    };
    const notViablePort: ExternalFormalNextTickViabilityPortV1 = {
      async checkPreclaimViability(b) {
        return {
          viability_id: "NEXT_TICK_FORCING_VIABILITY_V1",
          status: "NOT_VIABLE",
          slot_id: b.slot_id,
          logical_time: b.logical_time,
          required_forcing_base: addHours(b.logical_time, -1),
          reason: "FORCING_CURSOR_BEHIND_REQUIRED_BASE",
          detail: "controlled-negative",
        };
      },
    };
    const gated = new ExternalFormalV5ViabilityGatedSchedulerV1(inner, notViablePort);
    await assert.rejects(
      () => gated.claimDueSlot({ boundary: boundary(8), lease_owner: "runner", lease_duration_seconds: 300 }),
      (error: unknown) => error instanceof ExternalFormalNextTickNotViablePreclaimErrorV1,
    );
    assert.equal(claimCalls, 0);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_NEXT_TICK_FORCING_VIABILITY",
      o00_a0_warm_start_exception_verified: true,
      runtime_cursor_exact_preclaim_boundary_verified: true,
      o01_requires_o00_forcing_base_attestation: true,
      exact_predecessor_forcing_base_required: true,
      physical_attestation_before_base_required: true,
      a2_blocked_does_not_imply_successor_viable: true,
      o08_claim_prevented_when_o07_forcing_base_terminal: true,
      viability_failure_underlying_scheduler_claim_count: claimCalls,
      successor_claim_forbidden_when_next_tick_viable_false: claimCalls === 0,
      canonical_tick_core_changed: false,
      production_workflow_effect: false,
      mcft_cap09_completed: false,
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
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
