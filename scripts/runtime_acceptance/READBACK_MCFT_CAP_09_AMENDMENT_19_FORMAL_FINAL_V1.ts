import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
  validateMcftCap09Am19FormalArmV1,
  type McftCap09Am19FormalArmV1,
} from "./mcft_cap09_amendment19_formal_manifest_from_arm_v1.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_FINAL_READBACK_V1.json");
const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const TERMINAL_SLOT_STATES = new Set(["COMPLETED", "DEGRADED"]);
const ALLOWED_FORCING_MODES = new Set(["EXACT_PROVIDER_INTERVAL_PAIR", "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"]);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_FINAL_READBACK_ENV_REQUIRED:${name}`);
  return value;
}

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function canonicalIso(value: unknown, code: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function exactSeries(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addHours(start, index));
}

function exactSet(actual: readonly string[], expected: readonly string[], code: string): void {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`${code}:${JSON.stringify({ actual: a, expected: e })}`);
}

function assertExactMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_FINAL_READBACK_SUBJECT_INVALID");
  if (!["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("AM19_FORMAL_FINAL_READBACK_LIVE_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("AM19_FORMAL_FINAL_READBACK_EXACT_MAIN_REQUIRED");
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string, o23: string): Promise<string> {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("AM19_FORMAL_FINAL_READBACK_REMOTE_POSTGRES_REQUIRED");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_V3_DB_REQUIRED:${database}`);
  const row = (await pool.query("SELECT current_database() AS database_name, transaction_timestamp() AS database_now")).rows[0];
  if (String(row?.database_name ?? "") !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_FINAL_READBACK_DB_SESSION_IDENTITY_REQUIRED");
  const now = canonicalIso(new Date(row.database_now).toISOString(), "AM19_FORMAL_FINAL_READBACK_DB_NOW_INVALID");
  if (Date.parse(now) < Date.parse(o23)) throw new Error(`AM19_FORMAL_FINAL_READBACK_BEFORE_O23_FORBIDDEN:${now}:${o23}`);
  return now;
}

function formalRawRef(value: unknown, code: string): string {
  const ref = typeof value === "string" ? value : "";
  let parsed: URL;
  try { parsed = new URL(ref); } catch { throw new Error(code); }
  const key = parsed.pathname.replace(/^\/+/, "");
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== "geox-mcft-cap09-formal-raw-v1" || !key.startsWith(`${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`) || key.includes("mcft-cap09-ea5e2-readiness-transient-v1")) {
    throw new Error(code);
  }
  return ref;
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") {
    const start = "2026-08-20T05:00:00.000Z";
    const bases = exactSeries(start, 24);
    if (bases[0] !== start || bases[23] !== "2026-08-21T04:00:00.000Z") throw new Error("AM19_FORMAL_FINAL_READBACK_SELFTEST_BASE_SERIES");
    const ticks = exactSeries(addHours(start, 1), 24);
    if (ticks[23] !== "2026-08-21T05:00:00.000Z") throw new Error("AM19_FORMAL_FINAL_READBACK_SELFTEST_TICK_SERIES");
    console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_amendment19_formal_final_readback_selftest_v1", status: "PASS", required_base_snapshot_count: 24, required_hourly_promotions_after_a0: 23, required_terminal_ticks: 24, final_completion_claimed: false }));
    return;
  }
  if (process.argv[2] !== "run") throw new Error("AM19_FORMAL_FINAL_READBACK_MODE_REQUIRED:selftest|run");

  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactMain(subject);
  const arm = loadJson(path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_ARM_PATH"))) as McftCap09Am19FormalArmV1;
  validateMcftCap09Am19FormalArmV1(arm, subject);
  const bootstrap = loadJson(path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_A0_BOOTSTRAP_RESULT_PATH")));
  if (bootstrap?.status !== "PASS" || bootstrap.subject_sha !== subject || bootstrap.arm_identity_hash !== arm.arm_identity_hash || bootstrap.epoch_id !== arm.epoch_id || bootstrap.manifest_hash == null || bootstrap.formal_a0_bootstrapped !== true || bootstrap.formal_o00_started !== false) throw new Error("AM19_FORMAL_FINAL_READBACK_A0_PROOF_REQUIRED");

  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-am19-formal-final-readback" });
  try {
    const databaseNow = await assertFormalDatabase(pool, databaseUrl, arm.o23);
    const scope = MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
    const scopeParams = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
    const tickTimes = exactSeries(arm.o00, 24);
    const baseTimes = exactSeries(arm.a0, 24); // A0 + O00..O22. O23 would seed O24 and is forbidden.
    const expectedSlotIds = Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}`);

    const slots = (await pool.query(
      `SELECT slot_id,logical_time,state,fencing_token,tick_ref,health_ref,terminal_at,scheduler_wall_clock_observed_at
         FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`, scopeParams,
    )).rows;
    if (slots.length !== 24) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_24_SLOTS_REQUIRED:${slots.length}`);
    exactSet(slots.map((row) => String(row.slot_id)), expectedSlotIds, "AM19_FORMAL_FINAL_READBACK_SLOT_IDS_REQUIRED");
    exactSet(slots.map((row) => new Date(row.logical_time).toISOString()), tickTimes, "AM19_FORMAL_FINAL_READBACK_SLOT_TIMES_REQUIRED");
    for (const row of slots) {
      if (!TERMINAL_SLOT_STATES.has(String(row.state))) throw new Error(`AM19_FORMAL_FINAL_READBACK_NONTERMINAL_SLOT:${row.slot_id}:${row.state}`);
      if (!row.tick_ref || !row.health_ref || !row.terminal_at || row.fencing_token == null) throw new Error(`AM19_FORMAL_FINAL_READBACK_TERMINAL_SLOT_LINKAGE_REQUIRED:${row.slot_id}`);
    }

    const terminalTicks = (await pool.query(
      `SELECT logical_time,source_tick_object_id,record_set_id,aggregate_determinism_hash
         FROM twin_terminal_tick_uniqueness_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
        ORDER BY logical_time ASC`, scopeParams,
    )).rows;
    if (terminalTicks.length !== 24) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_24_TERMINAL_TICKS_REQUIRED:${terminalTicks.length}`);
    exactSet(terminalTicks.map((row) => new Date(row.logical_time).toISOString()), tickTimes, "AM19_FORMAL_FINAL_READBACK_TERMINAL_TICK_TIMES_REQUIRED");
    for (const row of terminalTicks) if (!row.source_tick_object_id || !row.record_set_id || !row.aggregate_determinism_hash) throw new Error("AM19_FORMAL_FINAL_READBACK_TERMINAL_TICK_LINKAGE_REQUIRED");

    const cursor = (await pool.query(
      `SELECT schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time,last_fencing_token
         FROM twin_shadow_online_scheduler_cursor_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams,
    )).rows;
    if (cursor.length !== 1) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_ONE_CURSOR_REQUIRED:${cursor.length}`);
    const c = cursor[0];
    if (new Date(c.schedule_start_logical_time).toISOString() !== arm.o00 || Number(c.next_slot_index) !== 24 || c.next_slot_id !== null || c.next_logical_time !== null || c.last_terminal_slot_id !== "O23" || new Date(c.last_terminal_logical_time).toISOString() !== arm.o23 || c.last_fencing_token == null) {
      throw new Error("AM19_FORMAL_FINAL_READBACK_CURSOR_TERMINAL_STATE_REQUIRED");
    }

    const latestTables = [
      ["twin_state_latest_index_v1", "state_object_id"],
      ["twin_runtime_checkpoint_latest_index_v1", "checkpoint_object_id"],
      ["twin_runtime_health_latest_index_v1", "health_object_id"],
      ["twin_forecast_result_latest_index_v1", "forecast_object_id"],
    ] as const;
    const latest: Record<string, unknown> = {};
    for (const [table, idColumn] of latestTables) {
      const rows = (await pool.query(
        `SELECT ${idColumn} AS object_id,logical_time,determinism_hash FROM ${table}
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams,
      )).rows;
      if (rows.length !== 1 || new Date(rows[0].logical_time).toISOString() !== arm.o23 || !rows[0].object_id || !rows[0].determinism_hash) throw new Error(`AM19_FORMAL_FINAL_READBACK_LATEST_O23_REQUIRED:${table}`);
      latest[table] = rows[0];
    }

    const health = latest.twin_runtime_health_latest_index_v1 as any;
    const healthStatus = String((await pool.query("SELECT operation_status FROM twin_runtime_health_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams)).rows[0]?.operation_status ?? "");
    if (!new Set(["HEALTHY", "DEGRADED"]).has(healthStatus)) throw new Error(`AM19_FORMAL_FINAL_READBACK_FINAL_HEALTH_FORBIDDEN:${healthStatus}`);
    void health;

    const leaseRows = (await pool.query(
      `SELECT lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,transaction_timestamp() AS database_now
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams,
    )).rows;
    if (leaseRows.length !== 1) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_ONE_LEASE_ROW_REQUIRED:${leaseRows.length}`);
    const lease = leaseRows[0];
    if (Date.parse(new Date(lease.expires_at).toISOString()) > Date.parse(new Date(lease.database_now).toISOString())) throw new Error("AM19_FORMAL_FINAL_READBACK_ACTIVE_LEASE_FORBIDDEN");

    const runtimeConfigs = (await pool.query(
      `SELECT record_json#>>'{payload,logical_time}' AS logical_time,record_json#>>'{payload,object_id}' AS object_id,record_json#>>'{payload,determinism_hash}' AS determinism_hash
         FROM facts
        WHERE source='twin_runtime' AND record_json->>'type'='twin_runtime_config_v1'
          AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2 AND record_json#>>'{payload,group_id}'=$3
          AND record_json#>>'{payload,field_id}'=$4 AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
        ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz ASC`, scopeParams,
    )).rows;
    if (runtimeConfigs.length !== 25) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_25_RUNTIME_CONFIGS_REQUIRED:${runtimeConfigs.length}`);
    exactSet(runtimeConfigs.map((row) => canonicalIso(row.logical_time, "AM19_FORMAL_FINAL_READBACK_RUNTIME_CONFIG_TIME_INVALID")), exactSeries(arm.a0, 25), "AM19_FORMAL_FINAL_READBACK_RUNTIME_CONFIG_TIMES_REQUIRED");

    for (const recordType of ["future_weather_assumption_v1", "future_et0_assumption_v1"] as const) {
      const rows = (await pool.query(
        `SELECT record_json#>>'{payload,dataset_id}' AS dataset_id,
                record_json#>>'{payload,role_time,valid_from}' AS valid_from,
                record_json#>>'{payload,source_payload,raw_provenance,retention_ref}' AS retention_ref,
                record_json#>>'{payload,quality,raw_retention_ref}' AS quality_ref,
                record_json#>>'{payload,source_record_id}' AS source_record_id
           FROM facts
          WHERE source=$1 AND record_json->>'type'=$2
            AND record_json#>>'{payload,tenant_id}'=$3 AND record_json#>>'{payload,project_id}'=$4 AND record_json#>>'{payload,group_id}'=$5
            AND record_json#>>'{payload,field_id}'=$6 AND record_json#>>'{payload,season_id}'=$7 AND record_json#>>'{payload,zone_id}'=$8
          ORDER BY (record_json#>>'{payload,role_time,valid_from}')::timestamptz ASC`,
        [EVIDENCE_SOURCE, recordType, ...scopeParams],
      )).rows;
      if (rows.length !== 24) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_24_ASSUMPTIONS_REQUIRED:${recordType}:${rows.length}`);
      exactSet(rows.map((row) => canonicalIso(row.valid_from, `AM19_FORMAL_FINAL_READBACK_VALID_FROM_INVALID:${recordType}`)), baseTimes, `AM19_FORMAL_FINAL_READBACK_BASE_SERIES_REQUIRED:${recordType}`);
      exactSet(rows.map((row) => String(row.dataset_id)), baseTimes.map((base) => `mcft_cap09_ea5e2_live_gfs_${base}`), `AM19_FORMAL_FINAL_READBACK_GFS_DATASET_SERIES_REQUIRED:${recordType}`);
      for (const row of rows) {
        const a = formalRawRef(row.retention_ref, `AM19_FORMAL_FINAL_READBACK_FORMAL_RAW_REQUIRED:${recordType}`);
        const b = formalRawRef(row.quality_ref, `AM19_FORMAL_FINAL_READBACK_QUALITY_RAW_REQUIRED:${recordType}`);
        if (a !== b || !row.source_record_id) throw new Error(`AM19_FORMAL_FINAL_READBACK_RAW_REFERENCE_IDENTITY_REQUIRED:${recordType}`);
      }
    }

    const soils = (await pool.query(
      `SELECT record_json#>>'{payload,dataset_id}' AS dataset_id,
              record_json#>>'{payload,source_payload,raw_provenance,retention_ref}' AS retention_ref,
              record_json#>>'{payload,quality,raw_retention_ref}' AS quality_ref,
              record_json#>>'{payload,source_record_id}' AS source_record_id
         FROM facts
        WHERE source=$1 AND record_json->>'type'='soil_moisture_observation_v1'
          AND record_json#>>'{payload,tenant_id}'=$2 AND record_json#>>'{payload,project_id}'=$3 AND record_json#>>'{payload,group_id}'=$4
          AND record_json#>>'{payload,field_id}'=$5 AND record_json#>>'{payload,season_id}'=$6 AND record_json#>>'{payload,zone_id}'=$7
        ORDER BY dataset_id ASC`, [EVIDENCE_SOURCE, ...scopeParams],
    )).rows;
    if (soils.length !== 24) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_24_SOIL_RECORDS_REQUIRED:${soils.length}`);
    exactSet(soils.map((row) => String(row.dataset_id)), baseTimes.map((base) => `mcft_cap09_ea5e2_live_soil_${base}`), "AM19_FORMAL_FINAL_READBACK_SOIL_DATASET_SERIES_REQUIRED");
    for (const row of soils) {
      const a = formalRawRef(row.retention_ref, "AM19_FORMAL_FINAL_READBACK_SOIL_FORMAL_RAW_REQUIRED");
      const b = formalRawRef(row.quality_ref, "AM19_FORMAL_FINAL_READBACK_SOIL_QUALITY_RAW_REQUIRED");
      if (a !== b || !row.source_record_id) throw new Error("AM19_FORMAL_FINAL_READBACK_SOIL_RAW_REFERENCE_IDENTITY_REQUIRED");
    }

    const o23ExtraAssumptions = Number((await pool.query(
      `SELECT count(*)::int AS n FROM facts
        WHERE source=$1 AND record_json->>'type'=ANY($2::text[])
          AND record_json#>>'{payload,dataset_id}'=ANY($3::text[])`,
      [EVIDENCE_SOURCE, ["future_weather_assumption_v1", "future_et0_assumption_v1"], [
        `mcft_cap09_ea5e2_live_gfs_${arm.o23}`,
      ]],
    )).rows[0]?.n ?? -1);
    if (o23ExtraAssumptions !== 0) throw new Error(`AM19_FORMAL_FINAL_READBACK_O23_SEED_FOR_O24_FORBIDDEN:${o23ExtraAssumptions}`);
    const o23ExtraSoil = Number((await pool.query(
      `SELECT count(*)::int AS n FROM facts WHERE source=$1 AND record_json->>'type'='soil_moisture_observation_v1' AND record_json#>>'{payload,dataset_id}'=$2`,
      [EVIDENCE_SOURCE, `mcft_cap09_ea5e2_live_soil_${arm.o23}`],
    )).rows[0]?.n ?? -1);
    if (o23ExtraSoil !== 0) throw new Error(`AM19_FORMAL_FINAL_READBACK_O23_SOIL_SEED_FOR_O24_FORBIDDEN:${o23ExtraSoil}`);

    const evidenceWindows = (await pool.query(
      `SELECT record_json#>>'{payload,logical_time}' AS logical_time,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,mode}' AS forcing_mode,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,provider_wait_required}' AS provider_wait_required,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,completed_tick_retroactive_rewrite_authorized}' AS rewrite_authorized,
              record_json#>>'{payload,payload,base_continuation_window,current_interval_forcing,relabel_assumption_as_provider_observation_authorized}' AS relabel_authorized
         FROM facts
        WHERE source='twin_runtime' AND record_json->>'type'='twin_evidence_window_v1'
          AND record_json#>>'{payload,tenant_id}'=$1 AND record_json#>>'{payload,project_id}'=$2 AND record_json#>>'{payload,group_id}'=$3
          AND record_json#>>'{payload,field_id}'=$4 AND record_json#>>'{payload,season_id}'=$5 AND record_json#>>'{payload,zone_id}'=$6
          AND (record_json#>>'{payload,logical_time}')::timestamptz >= $7::timestamptz
          AND (record_json#>>'{payload,logical_time}')::timestamptz <= $8::timestamptz
        ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz ASC`, [...scopeParams, arm.o00, arm.o23],
    )).rows;
    if (evidenceWindows.length !== 24) throw new Error(`AM19_FORMAL_FINAL_READBACK_EXACT_24_EVIDENCE_WINDOWS_REQUIRED:${evidenceWindows.length}`);
    exactSet(evidenceWindows.map((row) => canonicalIso(row.logical_time, "AM19_FORMAL_FINAL_READBACK_EVIDENCE_WINDOW_TIME_INVALID")), tickTimes, "AM19_FORMAL_FINAL_READBACK_EVIDENCE_WINDOW_TIMES_REQUIRED");
    const modeCounts: Record<string, number> = {};
    for (const row of evidenceWindows) {
      const mode = String(row.forcing_mode ?? "");
      if (!ALLOWED_FORCING_MODES.has(mode)) throw new Error(`AM19_FORMAL_FINAL_READBACK_FORCING_MODE_FORBIDDEN:${row.logical_time}:${mode}`);
      modeCounts[mode] = (modeCounts[mode] ?? 0) + 1;
      if (row.provider_wait_required !== "false" || row.rewrite_authorized !== "false" || row.relabel_authorized !== "false") throw new Error(`AM19_FORMAL_FINAL_READBACK_FORCING_AUTHORITY_DRIFT:${row.logical_time}`);
    }

    const result = {
      schema_version: "geox_mcft_cap09_amendment19_formal_final_readback_v1",
      status: "PASS",
      subject_sha: subject,
      arm_identity_hash: arm.arm_identity_hash,
      epoch_id: arm.epoch_id,
      manifest_hash: bootstrap.manifest_hash,
      formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
      database_readback_at: databaseNow,
      a0: arm.a0,
      o00: arm.o00,
      o23: arm.o23,
      scheduler_slot_count: slots.length,
      terminal_tick_count: terminalTicks.length,
      terminal_slot_states: Object.fromEntries([...TERMINAL_SLOT_STATES].map((state) => [state, slots.filter((row) => row.state === state).length])),
      cursor_next_slot_index: Number(c.next_slot_index),
      cursor_last_terminal_slot_id: c.last_terminal_slot_id,
      cursor_last_terminal_logical_time: new Date(c.last_terminal_logical_time).toISOString(),
      latest_state_logical_time: arm.o23,
      latest_checkpoint_logical_time: arm.o23,
      latest_health_logical_time: arm.o23,
      latest_health_status: healthStatus,
      latest_forecast_logical_time: arm.o23,
      runtime_config_count: runtimeConfigs.length,
      required_base_snapshot_count: baseTimes.length,
      required_base_snapshots: baseTimes,
      required_hourly_promotions_after_a0: 23,
      o23_extra_seed_for_o24_count: 0,
      evidence_window_count: evidenceWindows.length,
      forcing_mode_counts: modeCounts,
      provider_wait_required_count: 0,
      late_rewrite_authorized_count: 0,
      assumption_relabel_authorized_count: 0,
      active_lease: false,
      durable_formal_raw_retention_only: true,
      transient_raw_reference_count: 0,
      database_readback_pass: true,
      physical_pre_t_promotion_ledger_pass: false,
      final_actual_24h_still_required: true,
      human_override_used: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
