import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import { PostgresExternalFormalForcingBaseContinuityRepositoryV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1,
  PostgresExternalFormalForcingSupplyAdmissionV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_FORCING_SUPPLY_ADMISSION_POSTGRES_RESULT.json");
const SUBJECT = "b".repeat(40);
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];

function budget(selectedMs: number): FormalForcingAcquisitionBudgetAdjudicationV1 {
  return {
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    status: "PASS",
    real_sample_count: 3,
    controlled_delay_case_count: 6,
    maximum_real_end_to_end_ms: Math.max(1, selectedMs - 120_000),
    maximum_controlled_end_to_end_ms: Math.max(1, selectedMs - 60_000),
    measured_envelope_ms: Math.max(1, selectedMs - 60_000),
    selected_budget_ms: selectedMs,
    safety_margin_ms: 60_000,
    hardcoded_default_budget_minutes: null,
    selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
  };
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql"), "utf8"));
}

async function dbHour(pool: Pool, offsetHours: number): Promise<string> {
  const row = (await pool.query<{ value: string | Date }>(
    "SELECT date_trunc('hour',clock_timestamp()) + ($1::int * interval '1 hour') AS value",
    [offsetHours],
  )).rows[0];
  if (!row) throw new Error("V13_ADMISSION_DB_HOUR_REQUIRED");
  return new Date(row.value).toISOString();
}

async function initEpoch(pool: Pool, epochId: string, base: string): Promise<void> {
  const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
    scope,
    epoch_id: epochId,
    subject_sha: SUBJECT,
    first_required_base: base,
    last_required_base: base,
  });
  await continuity.initializeCursor();
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_ADMISSION_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_ADMISSION_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/(mcft|cap.*09|v13|forcing|admission|acceptance|test)/i.test(databaseName)) throw new Error(`ISOLATED_V13_ADMISSION_DATABASE_REQUIRED:${databaseName}`);

  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);

    // On-time claim: DB clock, target selection, budget deadline, fence and lease are one transaction.
    const onTimeBase = await dbHour(pool, 2);
    await initEpoch(pool, "v13-admission-on-time", onTimeBase);
    const onTime = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope,
      epoch_id: "v13-admission-on-time",
      subject_sha: SUBJECT,
      first_required_base: onTimeBase,
      last_required_base: onTimeBase,
      qualified_budget: budget(30 * 60_000),
    });
    const first = await onTime.claimNextRequiredBase({ lease_owner: "producer-a", lease_duration_seconds: 900 });
    assert.equal(first.status, "CLAIMED");
    if (first.status !== "CLAIMED") throw new Error("V13_ADMISSION_FIRST_CLAIM_REQUIRED");
    assert.equal(first.claim.base_target_t, onTimeBase);
    assert(Date.parse(first.database_now) <= Date.parse(first.acquisition_start_deadline));
    const duplicate = await onTime.claimNextRequiredBase({ lease_owner: "producer-a", lease_duration_seconds: 900 });
    assert.equal(duplicate.status, "EXISTING_ACTIVE_CLAIM");
    const busy = await onTime.claimNextRequiredBase({ lease_owner: "producer-b", lease_duration_seconds: 900 });
    assert.equal(busy.status, "BUSY");
    const persisted = (await pool.query<{
      acquisition_budget_authority_id: string;
      selected_acquisition_budget_ms: string;
      acquisition_start_deadline: string | Date;
      controller_admitted_at: string | Date;
      state: string;
    }>(
      `SELECT acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at,state
         FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id='v13-admission-on-time'`,
    )).rows[0];
    assert.equal(persisted.state, "CLAIMED");
    assert.equal(persisted.acquisition_budget_authority_id, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1);
    assert.equal(Number(persisted.selected_acquisition_budget_ms), 30 * 60_000);
    assert(Date.parse(new Date(persisted.controller_admitted_at).toISOString()) <= Date.parse(onTimeBase));

    // Late first wake: exact next_missing base is terminalized; the controller must not ceil to a later hour.
    const lateBase = await dbHour(pool, 1);
    await initEpoch(pool, "v13-admission-late", lateBase);
    const lateRepo = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope,
      epoch_id: "v13-admission-late",
      subject_sha: SUBJECT,
      first_required_base: lateBase,
      last_required_base: lateBase,
      qualified_budget: budget(2 * 60 * 60_000),
    });
    const late = await lateRepo.claimNextRequiredBase({ lease_owner: "producer-late", lease_duration_seconds: 900 });
    assert.equal(late.status, "TERMINAL_LATE_WAKE");
    if (late.status !== "TERMINAL_LATE_WAKE") throw new Error("V13_ADMISSION_LATE_WAKE_REQUIRED");
    assert.equal(late.base_target_t, lateBase);
    assert.equal(late.failure_class, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1);
    const lateRow = (await pool.query<{ state: string; failure_class: string }>(
      "SELECT state,failure_class FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id='v13-admission-late'",
    )).rows[0];
    assert.equal(lateRow.state, "DEADLINE_MISSED_TERMINAL");
    assert.equal(lateRow.failure_class, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1);

    // Physical deadline has higher precedence once base time itself has arrived.
    const pastBase = await dbHour(pool, 0);
    await initEpoch(pool, "v13-admission-past", pastBase);
    const pastRepo = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope,
      epoch_id: "v13-admission-past",
      subject_sha: SUBJECT,
      first_required_base: pastBase,
      last_required_base: pastBase,
      qualified_budget: budget(30 * 60_000),
    });
    const past = await pastRepo.claimNextRequiredBase({ lease_owner: "producer-past", lease_duration_seconds: 900 });
    assert.equal(past.status, "TERMINAL_LATE_WAKE");
    if (past.status !== "TERMINAL_LATE_WAKE") throw new Error("V13_ADMISSION_PAST_BASE_REQUIRED");
    assert.equal(past.failure_class, "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED");

    // A legitimately admitted long-running claim remains valid after the start deadline while its lease is live.
    const liveBase = await dbHour(pool, 1);
    await initEpoch(pool, "v13-admission-live-after-start", liveBase);
    const longBudgetMs = 2 * 60 * 60_000;
    const startDeadline = new Date(Date.parse(liveBase) - longBudgetMs).toISOString();
    await pool.query(
      `INSERT INTO twin_external_formal_forcing_base_target_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key,
        claim_owner,fencing_token,lease_expires_at,claimed_at,acquisition_started_at,
        acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz,'ACQUIRING',$10,
               'producer-live',1,LEAST(clock_timestamp()+interval '5 minute',$9::timestamptz-interval '1 second'),clock_timestamp(),clock_timestamp(),
               $11,$12::bigint,$13::timestamptz,$13::timestamptz)`,
      [
        ...scopeValues,
        "v13-admission-live-after-start",
        SUBJECT,
        liveBase,
        "v13-live-after-start",
        MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
        longBudgetMs,
        startDeadline,
      ],
    );
    const liveRepo = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope,
      epoch_id: "v13-admission-live-after-start",
      subject_sha: SUBJECT,
      first_required_base: liveBase,
      last_required_base: liveBase,
      qualified_budget: budget(longBudgetMs),
    });
    const live = await liveRepo.claimNextRequiredBase({ lease_owner: "producer-live", lease_duration_seconds: 900 });
    assert.equal(live.status, "EXISTING_ACTIVE_CLAIM");

    // If that lease is lost after the qualified start window, reacquisition is terminal rather than optimistic restart.
    await initEpoch(pool, "v13-admission-expired-after-start", liveBase);
    await pool.query(
      `INSERT INTO twin_external_formal_forcing_base_target_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,epoch_id,subject_sha,base_target_t,causal_deadline,state,idempotency_key,
        claim_owner,fencing_token,lease_expires_at,claimed_at,acquisition_started_at,
        acquisition_budget_authority_id,selected_acquisition_budget_ms,acquisition_start_deadline,controller_admitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$9::timestamptz,'ACQUIRING',$10,
               'producer-dead',1,clock_timestamp()-interval '1 second',clock_timestamp()-interval '10 minute',clock_timestamp()-interval '10 minute',
               $11,$12::bigint,$13::timestamptz,$13::timestamptz)`,
      [
        ...scopeValues,
        "v13-admission-expired-after-start",
        SUBJECT,
        liveBase,
        "v13-expired-after-start",
        MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
        longBudgetMs,
        startDeadline,
      ],
    );
    const expiredRepo = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope,
      epoch_id: "v13-admission-expired-after-start",
      subject_sha: SUBJECT,
      first_required_base: liveBase,
      last_required_base: liveBase,
      qualified_budget: budget(longBudgetMs),
    });
    const expired = await expiredRepo.claimNextRequiredBase({ lease_owner: "producer-recovery", lease_duration_seconds: 900 });
    assert.equal(expired.status, "TERMINAL_LATE_WAKE");
    if (expired.status !== "TERMINAL_LATE_WAKE") throw new Error("V13_ADMISSION_EXPIRED_RECOVERY_TERMINAL_REQUIRED");
    assert.equal(expired.failure_class, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_START_DEADLINE_MISSED_V1);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_FORCING_SUPPLY_ADMISSION",
      cursor_lock_database_clock_budget_and_claim_single_transaction: true,
      next_missing_required_base_is_only_claim_target: true,
      late_first_wake_terminalized_without_hour_skip: true,
      physical_visibility_deadline_precedence: true,
      qualified_budget_metadata_persisted: true,
      live_inflight_claim_survives_start_deadline: true,
      expired_inflight_claim_after_start_deadline_cannot_optimistically_restart: true,
      hardcoded_35_minute_budget_authorized: false,
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
