import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { ExternalFormalBootstrapPersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap09Am19FormalManifestFromArmV1,
  MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
  validateMcftCap09Am19FormalArmV1,
  type McftCap09Am19FormalArmV1,
} from "./mcft_cap09_amendment19_formal_manifest_from_arm_v1.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_A0_BOOTSTRAP_RESULT_V1.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const A0_EVIDENCE_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"] as const;
const LEASE_SECONDS = 900;
const PREBOOTSTRAP_ZERO_TABLES = [
  "twin_action_feedback_cycle_projection_v1",
  "twin_action_feedback_evidence_index_v1",
  "twin_action_feedback_projection_v1",
  "twin_active_lineage_index_v1",
  "twin_approved_plan_binding_projection_v1",
  "twin_decision_record_projection_v1",
  "twin_forecast_point_projection_v1",
  "twin_forecast_residual_projection_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_run_projection_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_object_idempotency_index_v1",
  "twin_runtime_authority_snapshot_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_runtime_lease_v1",
  "twin_scenario_latest_index_v1",
  "twin_scenario_point_projection_v1",
  "twin_scenario_set_projection_v1",
  "twin_scenario_set_uniqueness_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_terminal_tick_uniqueness_v1",
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: unknown, code: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function writeOutput(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function assertExactMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_SUBJECT_INVALID");
  if (!["workflow_run", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_LIVE_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_EXACT_MAIN_REQUIRED");
}

function exactScope(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) throw new Error(`${code}:${key}`);
  }
}

class FrozenFormalA0DbEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  private frozen: CanonicalReplayEvidenceRecordV1[] | null = null;
  constructor(private readonly pool: Pool, private readonly a0: string) {}

  async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (input.logical_time !== this.a0) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_SOURCE_ONLY_EXACT_A0");
    exactScope(input.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "AM19_FORMAL_A0_BOOTSTRAP_SCOPE_MISMATCH");
    if (this.frozen) return structuredClone(this.frozen);
    const s = MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
    const rows = (await this.pool.query(
      `SELECT record_json->'payload' AS payload
         FROM facts
        WHERE source=$1
          AND record_json#>>'{payload,tenant_id}'=$2
          AND record_json#>>'{payload,project_id}'=$3
          AND record_json#>>'{payload,group_id}'=$4
          AND record_json#>>'{payload,field_id}'=$5
          AND record_json#>>'{payload,season_id}'=$6
          AND record_json#>>'{payload,zone_id}'=$7
          AND record_json->>'type'=ANY($8::text[])
          AND (record_json#>>'{payload,role_time,ingested_at}')::timestamptz <= $9::timestamptz
          AND (record_json#>>'{payload,available_to_runtime_at}')::timestamptz <= $9::timestamptz
        ORDER BY occurred_at ASC,fact_id ASC`,
      [EVIDENCE_SOURCE, s.tenant_id, s.project_id, s.group_id, s.field_id, s.season_id, s.zone_id, [...A0_EVIDENCE_TYPES], this.a0],
    )).rows as Array<{ payload: CanonicalReplayEvidenceRecordV1 }>;
    if (rows.length !== 3) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_EXACT_THREE_CAUSAL_FACTS_REQUIRED:${rows.length}`);
    const records = rows.map((row) => structuredClone(row.payload));
    const types = records.map((record) => record.record_type).sort();
    if (JSON.stringify(types) !== JSON.stringify([...A0_EVIDENCE_TYPES].sort())) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_EXACT_TYPE_SET_REQUIRED");
    this.frozen = records;
    return structuredClone(this.frozen);
  }
}

async function assertPrebootstrapState(pool: Pool, databaseUrl: string): Promise<string> {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_REMOTE_DATABASE_REQUIRED");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_EXACT_V3_DB_REQUIRED:${database}`);
  const identity = String((await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
  if (identity !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_DB_SESSION_IDENTITY_REQUIRED");
  const factCount = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n ?? -1);
  if (factCount !== 3) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_EXACT_PROMOTED_FACTS_REQUIRED:${factCount}`);
  for (const table of PREBOOTSTRAP_ZERO_TABLES) {
    const count = Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]?.n ?? -1);
    if (count !== 0) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_ZERO_STATE_REQUIRED:${table}:${count}`);
  }
  return identity;
}

function validatePromotion(promotion: any, arm: McftCap09Am19FormalArmV1, subject: string): void {
  if (promotion?.schema_version !== "geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_result_v1" || promotion.status !== "PASS") throw new Error("AM19_FORMAL_A0_BOOTSTRAP_PROMOTION_PASS_REQUIRED");
  if (promotion.subject_sha !== subject || promotion.arm_identity_hash !== arm.arm_identity_hash || promotion.epoch_id !== arm.epoch_id || promotion.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_PROMOTION_IDENTITY_REQUIRED");
  if (promotion.a0 !== arm.a0 || promotion.canonical_fact_write_count !== 3 || promotion.formal_fact_count !== 3) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_PROMOTION_EXACT_THREE_REQUIRED");
  if (promotion.producer_bound_transient_raw_reverification !== true || promotion.formal_content_addressed_raw_retention_before_decoder !== true || promotion.normalized_semantics_match_producer_bound_reference !== true || promotion.raw_sha256_preserved !== true || promotion.decoder_identity_preserved !== true || promotion.source_record_identity_preserved !== true || promotion.transient_ref_present_in_formal_fact !== false || promotion.provider_refetch_count !== 0) {
    throw new Error("AM19_FORMAL_A0_BOOTSTRAP_PROMOTION_PROVENANCE_REQUIRED");
  }
  if (promotion.scheduler_write_count !== 0 || promotion.runtime_write_count !== 0 || promotion.formal_a0_bootstrapped !== false || promotion.formal_o00_started !== false || promotion.mcft_cap09_completed !== false) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_PROMOTION_PREMATURE_RUNTIME_EFFECT");
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") {
    const scope = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
    exactScope(scope, scope, "AM19_FORMAL_A0_BOOTSTRAP_SELFTEST_SCOPE");
    console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_amendment19_formal_a0_bootstrap_selftest_v1", status: "PASS", exact_three_a0_facts_required: true, bootstrap_before_logical_a0_forbidden: true, lease_expiry_must_be_lte_o00: true, scheduler_slot_write_count: 0, provider_request_count: 0, formal_o00_started: false }));
    return;
  }
  if (process.argv[2] !== "run") throw new Error("AM19_FORMAL_A0_BOOTSTRAP_MODE_REQUIRED:selftest|run");
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactMain(subject);
  const armPath = path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_ARM_PATH"));
  const promotionPath = path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_PROMOTION_RESULT_PATH"));
  const arm = loadJson(armPath) as McftCap09Am19FormalArmV1;
  validateMcftCap09Am19FormalArmV1(arm, subject);
  const promotion = loadJson(promotionPath);
  validatePromotion(promotion, arm, subject);
  const cropAuthority = loadJson(CROP_AUTHORITY_PATH) as Record<string, unknown>;
  const matrix = loadJson(MATRIX_PATH) as Record<string, unknown>;
  const built = buildMcftCap09Am19FormalManifestFromArmV1({ arm, crop_authority: cropAuthority, configuration_matrix: matrix, expected_subject_sha: subject });

  const databaseUrl = requiredEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-am19-formal-a0-bootstrap" });
  let mutationStarted = false;
  try {
    await assertPrebootstrapState(pool, databaseUrl);
    const nowRow = (await pool.query("SELECT transaction_timestamp() AS database_now")).rows[0];
    const databaseNow = canonicalIso(new Date(nowRow.database_now).toISOString(), "AM19_FORMAL_A0_BOOTSTRAP_DB_NOW_INVALID");
    if (Date.parse(databaseNow) < Date.parse(arm.a0)) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_BEFORE_A0_FORBIDDEN:${databaseNow}:${arm.a0}`);
    if (Date.parse(databaseNow) + LEASE_SECONDS * 1000 > Date.parse(arm.o00)) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_TOO_LATE_FOR_LEASE_EXPIRY:${databaseNow}:${arm.o00}`);

    const runtimeRepo = new PostgresRuntimeRepositoryV1(pool);
    const nextRepo = new PostgresNextTickRepositoryV1(pool);
    const service = new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository: runtimeRepo,
      bootstrap_persistence: runtimeRepo,
      authority_snapshot_repository: nextRepo,
      evidence_source: new FrozenFormalA0DbEvidenceSourceV1(pool, arm.a0),
    });
    const leaseOwner = `mcft-cap09-am19-formal-bootstrap-${process.env.GITHUB_RUN_ID ?? "manual"}`;
    mutationStarted = true;
    const result = await service.execute({
      bundle: built.bundle.persistence_bundle,
      created_at: arm.a0,
      lease_owner: leaseOwner,
      lease_duration_seconds: LEASE_SECONDS,
    });
    if (result.hourly_runtime_config_count !== 24 || result.a0_member_count !== 9 || result.provider_request_count !== 0 || result.scheduler_slot_write_count !== 0 || result.formal_window_started !== false) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_SIDE_EFFECT_BOUNDARY_DRIFT");

    const snapshot = await nextRepo.readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
    if (!snapshot || snapshot.checkpoint.logical_time !== arm.a0 || snapshot.checkpoint.payload.next_tick_logical_time !== arm.o00 || snapshot.previous_posterior.logical_time !== arm.a0 || snapshot.runtime_config.object_id !== built.bundle.persistence_bundle.bootstrap_runtime_config.object_id) {
      throw new Error("AM19_FORMAL_A0_BOOTSTRAP_NEXT_TICK_SNAPSHOT_DRIFT");
    }
    const slotCount = Number((await pool.query("SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1")).rows[0]?.n ?? -1);
    if (slotCount !== 0) throw new Error(`AM19_FORMAL_A0_BOOTSTRAP_SCHEDULER_SLOT_FORBIDDEN:${slotCount}`);
    const lease = (await pool.query(
      `SELECT lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at,transaction_timestamp() AS database_now
         FROM twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id],
    )).rows[0];
    if (!lease || String(lease.lease_owner) !== leaseOwner || BigInt(lease.fencing_token) !== 1n) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_LEASE_IDENTITY_REQUIRED");
    const leaseExpiresAt = new Date(lease.expires_at).toISOString();
    if (Date.parse(leaseExpiresAt) > Date.parse(arm.o00)) throw new Error("AM19_FORMAL_A0_BOOTSTRAP_LEASE_EXPIRES_AFTER_O00");

    writeOutput({
      schema_version: "geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1",
      status: "PASS",
      subject_sha: subject,
      arm_identity_hash: arm.arm_identity_hash,
      epoch_id: arm.epoch_id,
      manifest_hash: built.manifest.manifest_hash,
      manifest_ref: built.manifest.manifest_ref,
      formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
      a0: arm.a0,
      o00: arm.o00,
      o23: arm.o23,
      promotion_result_sha256: sha256File(promotionPath),
      a0_member_count: result.a0_member_count,
      hourly_runtime_config_count: result.hourly_runtime_config_count,
      scheduler_slot_count: slotCount,
      checkpoint_logical_time: snapshot.checkpoint.logical_time,
      next_tick_logical_time: snapshot.checkpoint.payload.next_tick_logical_time,
      previous_posterior_logical_time: snapshot.previous_posterior.logical_time,
      lease_owner: leaseOwner,
      lease_fencing_token: String(lease.fencing_token),
      lease_acquired_at: new Date(lease.acquired_at).toISOString(),
      lease_expires_at: leaseExpiresAt,
      lease_expiry_lte_o00: true,
      bootstrap_database_now: databaseNow,
      provider_request_count: 0,
      scheduler_slot_write_count: 0,
      formal_a0_bootstrapped: true,
      formal_o00_started: false,
      final_actual_24h_still_required: true,
      store_reuse_authorized_after_success: true,
      human_override_used: false,
      mcft_cap09_completed: false,
    });
  } catch (error) {
    if (mutationStarted) {
      try {
        const footprint = (await pool.query(`SELECT
          (SELECT count(*)::int FROM facts) AS facts,
          (SELECT count(*)::int FROM twin_runtime_lease_v1) AS leases,
          (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) AS checkpoints,
          (SELECT count(*)::int FROM twin_state_latest_index_v1) AS states,
          (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS slots`)).rows[0];
        writeOutput({
          schema_version: "geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1",
          status: "FAIL",
          subject_sha: subject,
          arm_identity_hash: arm.arm_identity_hash,
          epoch_id: arm.epoch_id,
          formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
          failure_class: "FORMAL_STORE_BOOTSTRAP_PARTIAL_MUTATION_NON_REUSABLE",
          footprint,
          store_reuse_authorized: false,
          truncate_and_retry_authorized: false,
          formal_epoch_no_go: true,
          mcft_cap09_completed: false,
        });
      } catch {}
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
