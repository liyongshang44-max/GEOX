import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
  materializeExternalFormalA18CropContextV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.js";
import { ExternalFormalBootstrapPersistenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import { ExternalFormalV3Amendment19PersistentTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  ExternalFormalV3Amendment19RunnerV1,
  type ExternalFormalV3Am19WindowManifestV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { PostgresExternalFormalAmendment19EvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  PostgresPersistentSequentialSchedulerAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_RESULT.json");
const PERSISTENCE_FREE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T_RESULT.json");
const REHYDRATION_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
const CANDIDATE_PATH_DEFAULT = path.resolve("rolling-candidate/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");

const MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v2";
const BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v2";
const FORMAL_V3_DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v3";
const FAILED_DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const FAILED_EPOCH = "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2";
const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const LEASE_SECONDS = 900;
const LEASE_POLL_MS = 1000;
const LEASE_WAIT_OPERATIONAL_TIMEOUT_MS = 20 * 60_000;
const COLUMN_FP = "873a8e86f55d75a04a5f671627e98ae1";
const CONSTRAINT_FP = "7803f7e7706e52eca3ca2aa4290ff5dd";
const INDEX_FP = "ea5b3ba0392fd52fb471bc754e94ed35";

const REQUIRED_TABLES = [
  "facts",
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

const EVIDENCE_TYPES = [
  "soil_moisture_observation_v1",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;

const REQUIRED_MACHINE_STATUS_KEYS = [
  "PERSISTENCE_FREE_24T",
  "PERSISTENT_24T",
  "O00_WARM_START",
  "MODE_A",
  "MODE_B",
  "PARTIAL_PAIR",
  "LATE_EXACT_NO_REWRITE",
  "RESTART",
  "MISSED_SLOT_BACKFILL",
  "IDEMPOTENCY",
  "ZERO_PROVIDER_WAIT",
  "SCHEMA_ENV_PREFLIGHT",
  "FULL_CHAIN_READBACK",
] as const;

type MachineStatusKey = (typeof REQUIRED_MACHINE_STATUS_KEYS)[number];
type MachineStatuses = Record<MachineStatusKey, "PASS" | "NOT_RUN">;

type CandidateV1 = {
  schema_version: string;
  status: string;
  temporal_authority: string;
  producer_subject_sha: string;
  subject_sha?: string;
  target_t: string;
  captured_at?: string;
  candidate_expires_at: string;
  record_types: string[];
  source_record_ids?: string[];
};

type FactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  source: string;
  record_json: unknown;
  ingested_at: string | Date;
};

type BuiltQualificationV1 = {
  a0: string;
  o00: string;
  o23: string;
  epoch_id: string;
  created_at: string;
  bundle: ReturnType<typeof buildExternalFormalPrewindowAuthorityBundleV3>;
  manifest: ExternalFormalV3Am19WindowManifestV1;
  crop_authority: Record<string, unknown>;
  configuration_matrix: Record<string, unknown>;
};

type MainRunProofV1 = {
  pool: Pool;
  restart: boolean;
  backfill: boolean;
  idempotency: boolean;
  late: boolean;
  o00_real: boolean;
  mode_a: boolean;
  mode_b: boolean;
  partial: boolean;
  zero_provider_wait: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_P24_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHour(value: string, code: string): string {
  const out = canonicalIso(value, code);
  if (!out.endsWith(":00:00.000Z")) throw new Error(code);
  return out;
}

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function objectValue(value: unknown, code: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, any>;
}

function exactScope(record: Record<string, any>, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (record[key] !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key]) throw new Error(`${code}:${key}`);
  }
}

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function databaseUrlFor(base: string, database: string): string {
  const parsed = new URL(base);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error("AM19_P24_POSTGRES_URL_REQUIRED");
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("AM19_P24_REMOTE_DATABASE_REQUIRED");
  const baseDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (baseDatabase !== FORMAL_V3_DB) throw new Error(`AM19_P24_PARENT_SECRET_MUST_POINT_FORMAL_V3:${baseDatabase}`);
  if (database === FAILED_DB || database === FORMAL_V3_DB) throw new Error(`AM19_P24_QUALIFICATION_DATABASE_FORBIDDEN:${database}`);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function writeOutput(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

function initialStatuses(): MachineStatuses {
  return Object.fromEntries(REQUIRED_MACHINE_STATUS_KEYS.map((key) => [key, "NOT_RUN"])) as MachineStatuses;
}

function loadCandidate(subject: string): CandidateV1 {
  const file = process.env.MCFT_CAP09_ROLLING_CANDIDATE_PATH?.trim() || CANDIDATE_PATH_DEFAULT;
  const candidate = loadJson(file) as CandidateV1;
  if (candidate.schema_version !== "geox_mcft_cap09_rolling_preboundary_candidate_v1") throw new Error("AM19_P24_CANDIDATE_SCHEMA_REQUIRED");
  if (candidate.status !== "PASS" || candidate.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") throw new Error("AM19_P24_CANDIDATE_AUTHORITY_REQUIRED");
  if (candidate.producer_subject_sha !== subject || (candidate.subject_sha !== undefined && candidate.subject_sha !== subject)) throw new Error("AM19_P24_CANDIDATE_EXACT_SUBJECT_REQUIRED");
  canonicalHour(candidate.target_t, "AM19_P24_CANDIDATE_TARGET_HOUR_REQUIRED");
  canonicalIso(candidate.candidate_expires_at, "AM19_P24_CANDIDATE_EXPIRY_INVALID");
  const captured = canonicalIso(String(candidate.captured_at ?? ""), "AM19_P24_CANDIDATE_CAPTURED_AT_REQUIRED");
  if (Date.parse(captured) > Date.parse(candidate.target_t)) throw new Error("AM19_P24_CANDIDATE_CAPTURE_AFTER_A0_FORBIDDEN");
  if (Date.now() >= Date.parse(candidate.candidate_expires_at)) throw new Error("AM19_P24_CANDIDATE_EXPIRED");
  const exactTypes = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
  if (!Array.isArray(candidate.record_types) || JSON.stringify([...candidate.record_types].sort()) !== JSON.stringify(exactTypes)) throw new Error("AM19_P24_CANDIDATE_EXACT_THREE_RECORD_TYPES_REQUIRED");
  return candidate;
}

function assertPersistenceFreeProof(): void {
  if (!fs.existsSync(PERSISTENCE_FREE_OUTPUT)) throw new Error("AM19_P24_PERSISTENCE_FREE_PROOF_REQUIRED");
  const proof = loadJson(PERSISTENCE_FREE_OUTPUT);
  if (proof.status !== "PASS" || proof.machine_statuses?.PERSISTENCE_FREE_24T !== "PASS") throw new Error("AM19_P24_PERSISTENCE_FREE_PASS_REQUIRED");
  if (Number(proof.canonical_tick_count) !== 24 || Number(proof.provider_wait_count) !== 0 || Number(proof.database_write_count) !== 0 || Number(proof.provider_request_count) !== 0) throw new Error("AM19_P24_PERSISTENCE_FREE_BOUNDARY_DRIFT");
}

function assertRehydrationProof(candidate: CandidateV1, subject: string): void {
  if (!fs.existsSync(REHYDRATION_OUTPUT)) throw new Error("AM19_P24_REHYDRATION_PROOF_REQUIRED");
  const proof = loadJson(REHYDRATION_OUTPUT);
  if (proof.status !== "PASS" || proof.consumer_subject_sha !== subject || proof.producer_subject_sha !== candidate.producer_subject_sha || proof.target_t !== candidate.target_t) throw new Error("AM19_P24_REHYDRATION_IDENTITY_REQUIRED");
  if (proof.semantic_manifest_match !== true || proof.producer_bound_raw_reverification !== true || proof.producer_dataset_identity_preserved !== true || proof.producer_decoder_identity_preserved !== true) throw new Error("AM19_P24_REHYDRATION_PROVENANCE_REQUIRED");
  if (Number(proof.provider_refetch_count) !== 0 || Number(proof.formal_database_write_count) !== 0 || Number(proof.formal_r2_prefix_write_count) !== 0 || Number(proof.scheduler_write_count) !== 0 || Number(proof.runtime_write_count) !== 0 || Number(proof.isolated_database_fact_count) !== 3) throw new Error("AM19_P24_REHYDRATION_SIDE_EFFECT_BOUNDARY_DRIFT");
}

async function assertDatabaseIdentity(pool: Pool, expected: string): Promise<void> {
  const actual = String((await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
  if (actual !== expected) throw new Error(`AM19_P24_DATABASE_IDENTITY_MISMATCH:${actual}:${expected}`);
}

async function schemaPreflight(pool: Pool, expectedDb: string): Promise<void> {
  await assertDatabaseIdentity(pool, expectedDb);
  const wanted = REQUIRED_TABLES.map((_, index) => `($${index + 1})`).join(",");
  const sql = `WITH wanted(name) AS (VALUES ${wanted}),
    colshape AS (
      SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,COALESCE(pg_get_expr(ad.adbin,ad.adrelid),'') def
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN wanted w ON w.name=c.relname
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
      WHERE n.nspname='public'
    ),
    conshape AS (
      SELECT c.relname,con.conname,con.contype::text contype,pg_get_constraintdef(con.oid,true) def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN wanted w ON w.name=c.relname
      WHERE n.nspname='public' AND con.contype IN ('p','u','c','f')
    ),
    idxshape AS (
      SELECT i.tablename,i.indexname,i.indexdef
      FROM pg_indexes i JOIN wanted w ON w.name=i.tablename
      WHERE i.schemaname='public'
    )
    SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN (SELECT name FROM wanted))::int AS required_table_count,
      (SELECT md5(string_agg(relname||'|'||attnum::text||'|'||attname||'|'||typ||'|'||attnotnull::text||'|'||def,E'\\n' ORDER BY relname,attnum)) FROM colshape) AS column_fingerprint,
      (SELECT md5(string_agg(relname||'|'||conname||'|'||contype||'|'||def,E'\\n' ORDER BY relname,conname)) FROM conshape) AS constraint_fingerprint,
      (SELECT md5(string_agg(tablename||'|'||indexname||'|'||indexdef,E'\\n' ORDER BY tablename,indexname)) FROM idxshape) AS index_fingerprint`;
  const row = (await pool.query(sql, [...REQUIRED_TABLES])).rows[0];
  if (Number(row.required_table_count) !== 26 || row.column_fingerprint !== COLUMN_FP || row.constraint_fingerprint !== CONSTRAINT_FP || row.index_fingerprint !== INDEX_FP) {
    throw new Error(`AM19_P24_SCHEMA_FINGERPRINT_MISMATCH:${JSON.stringify(row)}`);
  }
}

async function allTableCounts(pool: Pool): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of REQUIRED_TABLES) out[table] = Number((await pool.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0]?.n ?? -1);
  return out;
}

async function zeroState(pool: Pool): Promise<boolean> {
  const counts = await allTableCounts(pool);
  return Object.values(counts).every((count) => count === 0);
}

async function assertZeroState(pool: Pool, database: string): Promise<void> {
  await schemaPreflight(pool, database);
  const counts = await allTableCounts(pool);
  const nonzero = Object.entries(counts).filter(([, count]) => count !== 0);
  if (nonzero.length) throw new Error(`AM19_P24_AUDIT_ONLY_RETRY_DB_VERSION_REQUIRED:${database}:${JSON.stringify(nonzero)}`);
}

function payloadFromFact(row: FactRowV1): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof row.record_json === "string" ? JSON.parse(row.record_json) : row.record_json;
  const payload = objectValue((envelope as any)?.payload, "AM19_P24_FACT_PAYLOAD_REQUIRED") as unknown as CanonicalReplayEvidenceRecordV1;
  if ((envelope as any)?.type !== payload.record_type) throw new Error("AM19_P24_FACT_WRAPPER_TYPE_MISMATCH");
  return payload;
}

async function localRehydratedFacts(localPool: Pool, candidate: CandidateV1): Promise<FactRowV1[]> {
  const database = String((await localPool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
  if (database !== "ea5e2_readiness") throw new Error("AM19_P24_LOCAL_REHYDRATION_DB_REQUIRED");
  const rows = (await localPool.query<FactRowV1>("SELECT fact_id,occurred_at,source,record_json,ingested_at FROM facts ORDER BY fact_id ASC")).rows;
  if (rows.length !== 3 || rows.some((row) => row.source !== EVIDENCE_SOURCE)) throw new Error("AM19_P24_REHYDRATED_EXACT_THREE_FACTS_REQUIRED");
  const records = rows.map(payloadFromFact);
  const byType = new Map(records.map((record) => [record.record_type, record]));
  for (const type of ["soil_moisture_observation_v1", "future_weather_assumption_v1", "future_et0_assumption_v1"]) {
    if (!byType.has(type)) throw new Error(`AM19_P24_REHYDRATED_TYPE_REQUIRED:${type}`);
  }
  if (candidate.source_record_ids && JSON.stringify([...candidate.source_record_ids].sort()) !== JSON.stringify(records.map((record) => record.source_record_id).sort())) throw new Error("AM19_P24_REHYDRATED_SOURCE_ID_SET_MISMATCH");

  const a0 = candidate.target_t;
  const o00 = addHours(a0, 1);
  const soil = byType.get("soil_moisture_observation_v1")!;
  exactScope(soil as any, "AM19_P24_REAL_SOIL_SCOPE_MISMATCH");
  const observed = canonicalIso(String(soil.role_time?.observed_at ?? ""), "AM19_P24_REAL_SOIL_OBSERVED_INVALID");
  const available = canonicalIso(String(soil.available_to_runtime_at ?? ""), "AM19_P24_REAL_SOIL_AVAILABLE_INVALID");
  const ingested = canonicalIso(String(soil.role_time?.ingested_at ?? ""), "AM19_P24_REAL_SOIL_INGESTED_INVALID");
  if (Date.parse(observed) <= Date.parse(addHours(a0, -1)) || Date.parse(observed) > Date.parse(a0) || Date.parse(available) > Date.parse(a0) || Date.parse(ingested) > Date.parse(a0)) throw new Error("AM19_P24_REAL_SOIL_NOT_CAUSAL_A0");

  for (const type of ["future_weather_assumption_v1", "future_et0_assumption_v1"] as const) {
    const record = byType.get(type)!;
    exactScope(record as any, `AM19_P24_REAL_${type}_SCOPE_MISMATCH`);
    if (record.epistemic_class !== "ASSUMED" || record.role_time?.valid_from !== a0 || record.role_time?.valid_to !== addHours(a0, 72)) throw new Error(`AM19_P24_REAL_${type}_WINDOW_MISMATCH`);
    for (const field of [record.role_time?.issued_at, record.available_to_runtime_at, record.role_time?.ingested_at]) {
      if (Date.parse(canonicalIso(String(field ?? ""), `AM19_P24_REAL_${type}_CAUSAL_TIME_INVALID`)) > Date.parse(a0)) throw new Error(`AM19_P24_REAL_${type}_NOT_KNOWN_BY_A0`);
    }
    const points = objectValue(record.canonical_payload, `AM19_P24_REAL_${type}_PAYLOAD_INVALID`).points;
    if (!Array.isArray(points) || points.length !== 72) throw new Error(`AM19_P24_REAL_${type}_72_POINTS_REQUIRED`);
    const h1 = objectValue(points[0], `AM19_P24_REAL_${type}_H1_INVALID`);
    if (h1.valid_from !== a0 || h1.valid_to !== o00) throw new Error(`AM19_P24_REAL_${type}_H1_O00_REQUIRED`);
  }
  return rows;
}

async function copyRealFacts(rows: FactRowV1[], remote: Pool): Promise<void> {
  for (const row of rows) {
    const inserted = await remote.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,$3,$4::jsonb)
       ON CONFLICT (fact_id) DO NOTHING`,
      [row.fact_id, new Date(row.occurred_at).toISOString(), row.source, JSON.stringify(row.record_json)],
    );
    if (inserted.rowCount !== 1) throw new Error(`AM19_P24_REAL_FACT_ID_CONFLICT:${row.fact_id}`);
  }
}

function weatherPoints(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: index === 0 ? Number((0.15 + seed * 0.003).toFixed(6)) : Number((0.02 + (index % 4) * 0.005).toFixed(6)),
  }));
}

function et0Points(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: Number((0.12 + seed * 0.0005 + (index % 3) * 0.002).toFixed(6)),
  }));
}

function assumptionRecord(kind: "weather" | "et0", base: string, seed: number): CanonicalReplayEvidenceRecordV1 {
  const issuedAt = addMinutes(base, -30);
  const availableAt = addMinutes(base, -20);
  const recordType = kind === "weather" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
  const bindingId = kind === "weather" ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1 : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const sourceId = `am19_p24_current_${kind}_${base}_${seed}`;
  const payload = {
    snapshot_kind: kind === "weather" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION",
    points: kind === "weather" ? weatherPoints(base, seed) : et0Points(base, seed),
  };
  return {
    dataset_id: "mcft_cap09_amendment19_persistent24_engineering_fixture",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({ sourceId, bindingId, issuedAt, availableAt, payload }),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: kind === "weather" ? "NOAA_GFS_ENGINEERING_FIXTURE" : "ASCE_ET0_FROM_GFS_ENGINEERING_FIXTURE",
    epistemic_class: "ASSUMED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: {
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      retrieved_at: availableAt,
      ingested_at: availableAt,
      valid_from: base,
      valid_to: addHours(base, 72),
    },
    quality: { status: "PASS" },
    source_payload: structuredClone(payload),
    canonical_payload: payload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: kind === "weather" ? "PRECIPITATION_MM_IDENTITY_V1" : "ET0_MM_PER_HOUR_IDENTITY_V1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE", "CURRENT_72H"],
  };
}

function currentPair(logicalTime: string, seed: number): CanonicalReplayEvidenceRecordV1[] {
  return [assumptionRecord("weather", logicalTime, seed), assumptionRecord("et0", logicalTime, seed)];
}

function soilRecord(logicalTime: string, seed: number, lane = "HOURLY"): CanonicalReplayEvidenceRecordV1 {
  const observedAt = addMinutes(logicalTime, -5);
  const availableAt = addMinutes(logicalTime, -4);
  const value = Number((0.30 + (seed % 5) * 0.001).toFixed(6));
  const sourceId = `am19_p24_soil_${lane}_${logicalTime}_${seed}`;
  const canonicalPayload = {
    quantity_kind: ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
    unit: "fraction",
    value,
  };
  return {
    dataset_id: "mcft_cap09_amendment19_persistent24_engineering_fixture",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({ sourceId, observedAt, availableAt, canonicalPayload }),
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "KBS_SOIL_ENGINEERING_FIXTURE",
    epistemic_class: "OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: { observed_at: observedAt, ingested_at: availableAt },
    quality: { status: "PASS" },
    source_payload: { source_version: "engineering-v1", unit: "fraction", value },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: { id: "VWC_FRACTION_IDENTITY_V1", version: "1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function exactRecord(kind: "rainfall" | "et0", logicalTime: string, sourceId: string, value: number, availableAt: string): CanonicalReplayEvidenceRecordV1 {
  const intervalStart = addHours(logicalTime, -1);
  const bindingId = kind === "rainfall" ? MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1 : MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
  return {
    dataset_id: "mcft_cap09_amendment19_persistent24_engineering_fixture",
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({ sourceId, bindingId, intervalStart, logicalTime, value, availableAt }),
    record_type: kind === "rainfall" ? "observed_rainfall_v1" : "historical_et0_estimate_v1",
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "KBS_ENGINEERING_FIXTURE",
    epistemic_class: kind === "rainfall" ? "OBSERVED" : "ESTIMATED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: availableAt,
    role_time: { interval_start: intervalStart, interval_end: logicalTime, ingested_at: availableAt },
    quality: { status: "PASS" },
    source_payload: { value },
    canonical_payload: { value },
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: "ENGINEERING_MM_IDENTITY_V1" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}

function eventTime(record: CanonicalReplayEvidenceRecordV1): string {
  if (record.record_type === "soil_moisture_observation_v1") return String(record.role_time?.observed_at);
  if (record.record_type === "future_weather_assumption_v1" || record.record_type === "future_et0_assumption_v1") return String(record.role_time?.issued_at);
  return String(record.role_time?.interval_end);
}

async function insertFixture(pool: Pool, record: CanonicalReplayEvidenceRecordV1): Promise<void> {
  const factId = `am19_p24_${crypto.createHash("sha256").update(`${record.source_record_id}|${record.source_record_hash}`).digest("hex")}`;
  const inserted = await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,$3,$4::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [factId, eventTime(record), EVIDENCE_SOURCE, JSON.stringify({ type: record.record_type, payload: record })],
  );
  if (inserted.rowCount !== 1) throw new Error(`AM19_P24_FIXTURE_ID_CONFLICT:${factId}`);
}

async function insertMainFixtures(pool: Pool, built: BuiltQualificationV1): Promise<number> {
  let count = 0;
  for (let index = 0; index < 24; index += 1) {
    const t = addHours(built.o00, index);
    for (const record of [soilRecord(t, index + 1), ...currentPair(t, index + 1)]) {
      await insertFixture(pool, record);
      count += 1;
    }
    if (index === 6) {
      for (const record of [
        exactRecord("rainfall", t, "am19_p24_mode_a_rain", 0.8, addMinutes(t, -1)),
        exactRecord("et0", t, "am19_p24_mode_a_et0", 0.13, addMinutes(t, -1)),
      ]) {
        await insertFixture(pool, record);
        count += 1;
      }
    }
    if (index === 9) {
      await insertFixture(pool, exactRecord("rainfall", t, "am19_p24_partial_rain_only", 0.4, addMinutes(t, -1)));
      count += 1;
    }
    if (index === 10) {
      await insertFixture(pool, exactRecord("et0", t, "am19_p24_partial_et0_only", 0.11, addMinutes(t, -1)));
      count += 1;
    }
  }
  return count;
}

function materializationHash(materialized: ReturnType<typeof materializeExternalFormalA18CropContextV2>): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    context_ref: materialized.context_ref,
    context_identity_hash: materialized.context_identity_hash,
    materialized_context: materialized.context,
  });
}

function buildQualification(candidate: CandidateV1, subject: string, databaseName: string): BuiltQualificationV1 {
  const a0 = candidate.target_t;
  const createdAt = canonicalIso(String(candidate.captured_at ?? ""), "AM19_P24_CONFIG_CREATED_AT_REQUIRED");
  const epoch = `mcft_cap09_am19_accel24t_${a0.replace(/[^0-9]/g, "")}_${subject.slice(0, 12)}_${databaseName === BLOCKED_DB ? "blocked" : "main"}`;
  if (epoch === FAILED_EPOCH) throw new Error("AM19_P24_FAILED_EPOCH_REUSE_FORBIDDEN");

  const bundle = buildExternalFormalPrewindowAuthorityBundleV3({
    epoch_id: epoch,
    bootstrap_logical_time: a0,
    created_at: createdAt,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_stage_codes: Array.from({ length: 24 }, () => "MID" as const),
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
    fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
  });
  const cropAuthority = loadJson(CROP_AUTHORITY_PATH) as Record<string, unknown>;
  const matrix = loadJson(MATRIX_PATH) as Record<string, unknown>;

  // The production materializer is the actual stage-legality gate. Any transition risk fails before DB write.
  materializeExternalFormalA18CropContextV2({
    logical_time: a0,
    expected_identity_hash: bundle.persistence_bundle.crop_stage_context_hash,
    crop_authority: cropAuthority,
    configuration_matrix: matrix,
  });

  const configs = bundle.persistence_bundle.runtime_configs;
  const slotCore = configs.map((config, index) => {
    const pin = bundle.hourly_crop_pins[index]!;
    const materialized = materializeExternalFormalA18CropContextV2({
      logical_time: pin.logical_time,
      expected_identity_hash: pin.crop_stage_context_hash,
      crop_authority: cropAuthority,
      configuration_matrix: matrix,
    });
    const payload = config.payload as Record<string, any>;
    return {
      epoch_id: epoch,
      slot_id: pin.slot_id,
      logical_time: pin.logical_time,
      runtime_config_ref: config.object_id,
      runtime_config_hash: config.determinism_hash,
      parent_runtime_config_ref: String(payload.parent_runtime_config_ref),
      parent_runtime_config_hash: String(payload.parent_runtime_config_hash),
      crop_stage_context_ref: String(payload.crop_stage_context_authority.context_ref),
      crop_stage_context_hash: pin.crop_stage_context_hash,
      crop_stage_context_materialization_hash: materializationHash(materialized),
    };
  });

  const manifestRef = `qualification://mcft-cap09/amendment19/persistent24/${epoch}/${databaseName}`;
  const manifestHash = semanticHashV1({
    profile: "MCFT_CAP09_AM19_ACCELERATED_PERSISTENT24_MANIFEST_V1",
    manifest_ref: manifestRef,
    epoch_id: epoch,
    database_name: databaseName,
    scope: bundle.persistence_bundle.scope,
    o00: bundle.o00_logical_time,
    o23: bundle.o23_logical_time,
    slots: slotCore,
  });
  const manifest: ExternalFormalV3Am19WindowManifestV1 = {
    manifest_ref: manifestRef,
    manifest_hash: manifestHash,
    epoch_id: epoch,
    database_name: databaseName,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    o00_logical_time: bundle.o00_logical_time,
    o23_logical_time: bundle.o23_logical_time,
    slots: slotCore.map((slot) => ({ ...slot, manifest_ref: manifestRef, manifest_hash: manifestHash })) as ExternalFormalV3Am19WindowManifestV1["slots"],
  };
  return {
    a0,
    o00: bundle.o00_logical_time,
    o23: bundle.o23_logical_time,
    epoch_id: epoch,
    created_at: createdAt,
    bundle,
    manifest,
    crop_authority: cropAuthority,
    configuration_matrix: matrix,
  };
}

class FrozenA0DbEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  private frozen: CanonicalReplayEvidenceRecordV1[] | null = null;
  constructor(private readonly pool: Pool, private readonly a0: string) {}

  async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (input.logical_time !== this.a0) throw new Error("AM19_P24_A0_SOURCE_ONLY_EXACT_A0");
    for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
      if (input.scope[key] !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key]) throw new Error(`AM19_P24_A0_SCOPE_MISMATCH:${key}`);
    }
    if (this.frozen) return structuredClone(this.frozen);
    const s = MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
    const rows = (await this.pool.query(
      `SELECT record_json->'payload' AS payload FROM facts
       WHERE source=$1
         AND record_json#>>'{payload,tenant_id}'=$2
         AND record_json#>>'{payload,project_id}'=$3
         AND record_json#>>'{payload,group_id}'=$4
         AND record_json#>>'{payload,field_id}'=$5
         AND record_json#>>'{payload,season_id}'=$6
         AND record_json#>>'{payload,zone_id}'=$7
         AND record_json->>'type'=ANY($8::text[])
         AND (record_json#>>'{payload,role_time,ingested_at}')::timestamptz <= $9::timestamptz
       ORDER BY occurred_at ASC,fact_id ASC`,
      [EVIDENCE_SOURCE, s.tenant_id, s.project_id, s.group_id, s.field_id, s.season_id, s.zone_id, [...EVIDENCE_TYPES], this.a0],
    )).rows;
    this.frozen = rows.map((row) => structuredClone(row.payload as CanonicalReplayEvidenceRecordV1));
    return structuredClone(this.frozen);
  }
}

function persistencePort(repository: PostgresForecastScenarioRecoveryRepositoryV1): Cap04ForecastScenarioPersistencePortV1 {
  return {
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    commitARecordSet: repository.commitARecordSet.bind(repository),
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    commitScenarioSet: repository.commitScenarioSet.bind(repository),
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast: repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections: repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections: repository.rebuildScenarioProjections.bind(repository),
  };
}

async function bootstrap(pool: Pool, built: BuiltQualificationV1, lane: string): Promise<void> {
  const repo = new PostgresRuntimeRepositoryV1(pool);
  const service = new ExternalFormalBootstrapPersistenceServiceV1({
    runtime_config_repository: repo,
    bootstrap_persistence: repo,
    authority_snapshot_repository: new PostgresNextTickRepositoryV1(pool),
    evidence_source: new FrozenA0DbEvidenceSourceV1(pool, built.a0),
  });
  const result = await service.execute({
    bundle: built.bundle.persistence_bundle,
    created_at: built.a0,
    lease_owner: `am19-p24-bootstrap-${lane}`,
    lease_duration_seconds: LEASE_SECONDS,
  });
  if (result.hourly_runtime_config_count !== 24 || result.provider_request_count !== 0 || result.scheduler_slot_write_count !== 0 || result.formal_window_started !== false) throw new Error("AM19_P24_BOOTSTRAP_SIDE_EFFECT_BOUNDARY_DRIFT");
  const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  if (!snapshot || snapshot.checkpoint.payload.next_tick_logical_time !== built.o00 || snapshot.runtime_config.object_id !== built.bundle.persistence_bundle.bootstrap_runtime_config.object_id) throw new Error("AM19_P24_BOOTSTRAP_NEXT_TICK_DRIFT");
  const slots = Number((await pool.query("SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1")).rows[0]?.n ?? -1);
  if (slots !== 0) throw new Error("AM19_P24_BOOTSTRAP_SCHEDULER_NONSTART_REQUIRED");
}

async function waitForBootstrapLeaseExpiry(pool: Pool, expectedOwner: string): Promise<void> {
  const operationalDeadline = Date.now() + LEASE_WAIT_OPERATIONAL_TIMEOUT_MS;
  for (;;) {
    const result = await pool.query(
      `SELECT lease_owner,fencing_token,acquired_at,expires_at,transaction_timestamp() AS database_now
       FROM twin_runtime_lease_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
      ],
    );
    if (result.rows.length !== 1) throw new Error("AM19_P24_BOOTSTRAP_LEASE_ROW_REQUIRED");
    const row = result.rows[0];
    if (String(row.lease_owner) !== expectedOwner || BigInt(row.fencing_token) !== 1n) throw new Error("AM19_P24_BOOTSTRAP_LEASE_IDENTITY_DRIFT");
    if (new Date(row.expires_at).getTime() <= new Date(row.database_now).getTime()) return;
    if (Date.now() >= operationalDeadline) throw new Error("AM19_P24_BOOTSTRAP_LEASE_DID_NOT_EXPIRE");
    await sleep(LEASE_POLL_MS);
  }
}

function composition(pool: Pool, built: BuiltQualificationV1, syntheticNow: () => Date) {
  const runtimeRepo = new PostgresRuntimeRepositoryV1(pool);
  const nextRepo = new PostgresNextTickRepositoryV1(pool);
  const recovery = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
  const evidenceSource = new PostgresExternalFormalAmendment19EvidenceSourceV1(pool);
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
    pool,
    { scope: built.manifest.scope, schedule_start_logical_time: built.o00 },
    {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
      now: syntheticNow,
    },
  );
  const tickService = new ExternalFormalV3Amendment19PersistentTickServiceV1(
    new PrepareNextTickInputServiceV1(nextRepo),
    evidenceSource,
    runtimeRepo,
    persistencePort(recovery),
  );
  const materializer = {
    materialize(input: { logical_time: string; expected_identity_hash: string }) {
      return materializeExternalFormalA18CropContextV2({
        logical_time: input.logical_time,
        expected_identity_hash: input.expected_identity_hash,
        crop_authority: built.crop_authority,
        configuration_matrix: built.configuration_matrix,
      });
    },
  };
  const runner = new ExternalFormalV3Amendment19RunnerV1(built.manifest, scheduler, runtimeRepo, materializer, evidenceSource, tickService);
  return { runner, evidenceSource };
}

function forcingFromTick(result: any): Record<string, any> {
  const members = result?.tick_result?.a_record_set?.members;
  if (!Array.isArray(members)) throw new Error("AM19_P24_TICK_MEMBERS_REQUIRED");
  const evidence = members.filter((member: any) => member.object_type === "twin_evidence_window_v1");
  if (evidence.length !== 1) throw new Error("AM19_P24_EXACT_ONE_EVIDENCE_MEMBER_REQUIRED");
  return objectValue(evidence[0].payload?.current_interval_forcing, "AM19_P24_PERSISTED_CURRENT_FORCING_REQUIRED");
}

function assertTickZeroSideEffects(result: any): void {
  if (result.provider_request_count !== 0 || result.r2_request_count !== 0) throw new Error("AM19_P24_RUNNER_PROVIDER_OR_R2_REQUEST_FORBIDDEN");
  if (result.status !== "COMPLETED" && result.status !== "DEGRADED") return;
  const tick = result.tick_result;
  if (tick.provider_wait_required !== false || tick.runtime_provider_request_count !== 0 || tick.runtime_r2_head_count !== 0) throw new Error("AM19_P24_RUNTIME_PROVIDER_WAIT_OR_REQUEST_FORBIDDEN");
  for (const field of ["recommendation_write_count", "approval_write_count", "action_write_count", "dispatch_write_count", "model_activation_write_count"] as const) {
    if (Number(tick[field]) !== 0) throw new Error(`AM19_P24_DOWNSTREAM_WRITE_FORBIDDEN:${field}`);
  }
}

async function latestStateCheckpoint(pool: Pool): Promise<{ state_ref: string; state_hash: string; checkpoint_ref: string; checkpoint_hash: string }> {
  const s = MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  const p = [s.tenant_id, s.project_id, s.group_id, s.field_id, s.season_id, s.zone_id];
  const row = (await pool.query(
    `SELECT
       s.state_object_id AS state_ref,
       s.determinism_hash AS state_hash,
       c.checkpoint_object_id AS checkpoint_ref,
       c.determinism_hash AS checkpoint_hash
     FROM twin_state_latest_index_v1 s
     JOIN twin_runtime_checkpoint_latest_index_v1 c
       ON c.tenant_id=s.tenant_id AND c.project_id=s.project_id AND c.group_id=s.group_id
      AND c.field_id=s.field_id AND c.season_id=s.season_id AND c.zone_id=s.zone_id
     WHERE s.tenant_id=$1 AND s.project_id=$2 AND s.group_id=$3 AND s.field_id=$4 AND s.season_id=$5 AND s.zone_id=$6`,
    p,
  )).rows[0];
  if (!row) throw new Error("AM19_P24_LATEST_STATE_CHECKPOINT_REQUIRED");
  return {
    state_ref: String(row.state_ref),
    state_hash: String(row.state_hash),
    checkpoint_ref: String(row.checkpoint_ref),
    checkpoint_hash: String(row.checkpoint_hash),
  };
}

async function workFootprint(pool: Pool): Promise<{ facts: number; slots: number; terminal_ticks: number }> {
  const row = (await pool.query(
    `SELECT
      (SELECT count(*)::int FROM facts) AS facts,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS slots,
      (SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1) AS terminal_ticks`,
  )).rows[0];
  return { facts: Number(row.facts), slots: Number(row.slots), terminal_ticks: Number(row.terminal_ticks) };
}

async function runMain24(input: {
  pool: Pool;
  url: string;
  built: BuiltQualificationV1;
  realRecords: CanonicalReplayEvidenceRecordV1[];
}): Promise<MainRunProofV1> {
  let pool = input.pool;
  let synthetic = input.built.o00;
  let runtime = composition(pool, input.built, () => new Date(synthetic));
  const results: any[] = [];
  let restart = false;
  let backfill = false;
  let idempotency = false;
  let late = false;
  let partialRain = false;
  let partialEt0 = false;
  let zeroProviderWait = true;

  async function executeThrough(through: string): Promise<any> {
    synthetic = through;
    const result = await runtime.runner.executeOneDueSlot({
      through_logical_time: through,
      observer_started_at: through,
      lease_owner: `am19-p24-${process.env.GITHUB_RUN_ID ?? "local"}`,
      lease_duration_seconds: LEASE_SECONDS,
    });
    if (["NOT_READY_PRECLAIM", "FAILED_TERMINAL_RECORDED", "BLOCKED_TERMINAL_RECORDED"].includes(result.status)) throw new Error(`AM19_P24_MAIN_RUNNER_UNEXPECTED:${result.status}:${"detail" in result ? result.detail : ""}`);
    assertTickZeroSideEffects(result);
    if (result.provider_request_count !== 0 || result.r2_request_count !== 0) zeroProviderWait = false;
    if (result.status === "COMPLETED" || result.status === "DEGRADED") {
      if (result.tick_result.provider_wait_required !== false) zeroProviderWait = false;
      results.push(result);
    }
    await sleep(5);
    return result;
  }

  for (let index = 0; index <= 5; index += 1) await executeThrough(addHours(input.built.o00, index));

  await pool.end();
  pool = new Pool({ connectionString: input.url, application_name: "mcft-cap09-am19-p24-restart" });
  await assertDatabaseIdentity(pool, MAIN_DB);
  const restartSnapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  const restartPreviousLogicalTime = addHours(input.built.o00, 5);
  const restartNextLogicalTime = addHours(input.built.o00, 6);
  restart = Boolean(
    restartSnapshot
      && restartSnapshot.checkpoint.logical_time === restartPreviousLogicalTime
      && restartSnapshot.checkpoint.payload.next_tick_logical_time === restartNextLogicalTime
      && restartSnapshot.previous_posterior.logical_time === restartPreviousLogicalTime
      && restartSnapshot.previous_forecast_result?.logical_time === restartPreviousLogicalTime
      && restartSnapshot.last_terminal_tick?.logical_time === restartPreviousLogicalTime
      && restartSnapshot.checkpoint.payload.last_posterior_state_ref === restartSnapshot.previous_posterior.object_id
      && restartSnapshot.checkpoint.payload.forecast_result_ref === restartSnapshot.previous_forecast_result?.object_id
      && restartSnapshot.checkpoint.payload.last_completed_tick_ref === restartSnapshot.last_terminal_tick?.object_id
      && restartSnapshot.runtime_config.object_id === input.built.bundle.persistence_bundle.runtime_configs[5]!.object_id,
  );
  if (!restart) throw new Error("AM19_P24_RESTART_CHECKPOINT_CONTINUITY_REQUIRED");
  runtime = composition(pool, input.built, () => new Date(synthetic));

  await executeThrough(addHours(input.built.o00, 6));

  const backfillThrough = addHours(input.built.o00, 8);
  const firstBackfill = await executeThrough(backfillThrough);
  const secondBackfill = await executeThrough(backfillThrough);
  backfill = firstBackfill.slot_id === "O07" && secondBackfill.slot_id === "O08";
  if (!backfill) throw new Error("AM19_P24_OLDEST_FIRST_BACKFILL_REQUIRED");

  const beforeDuplicate = await workFootprint(pool);
  const duplicateProbe = await executeThrough(backfillThrough);
  const afterDuplicate = await workFootprint(pool);
  idempotency = duplicateProbe.status === "NO_DUE_SLOT" && JSON.stringify(beforeDuplicate) === JSON.stringify(afterDuplicate);
  if (!idempotency) throw new Error("AM19_P24_IDEMPOTENT_REPEAT_NO_WORK_REQUIRED");

  for (let index = 9; index < 24; index += 1) {
    const t = addHours(input.built.o00, index);
    const result = await executeThrough(t);

    if (index === 9 || index === 10) {
      const forcing = forcingFromTick(result);
      const expected = index === 9 ? ["am19_p24_partial_rain_only"] : ["am19_p24_partial_et0_only"];
      const pass = forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"
        && forcing.precipitation_epistemic_class === "ASSUMED"
        && forcing.et0_epistemic_class === "ASSUMED"
        && JSON.stringify(forcing.partial_exact_provider_refs_suppressed) === JSON.stringify(expected);
      if (index === 9) partialRain = pass;
      else partialEt0 = pass;
    }

    if (index === 11) {
      const before = await latestStateCheckpoint(pool);
      await insertFixture(pool, exactRecord("rainfall", t, "am19_p24_late_rain", 1.2, addMinutes(t, 10)));
      await insertFixture(pool, exactRecord("et0", t, "am19_p24_late_et0", 0.14, addMinutes(t, 10)));
      const evidenceAfterLate = await new PostgresExternalFormalAmendment19EvidenceSourceV1(pool).loadCandidateRecords({
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        logical_time: t,
        evidence_snapshot_time: t,
      });
      const lateIds = new Set(["am19_p24_late_rain", "am19_p24_late_et0"]);
      const selectedLate = evidenceAfterLate.records.filter((record) => lateIds.has(record.source_record_id));
      const after = await latestStateCheckpoint(pool);
      const slotCountBefore = Number((await pool.query("SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1")).rows[0]?.n ?? -1);
      const noDue = await executeThrough(t);
      const slotCountAfter = Number((await pool.query("SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1")).rows[0]?.n ?? -1);
      late = JSON.stringify(before) === JSON.stringify(after)
        && selectedLate.length === 0
        && evidenceAfterLate.excluded_after_causal_cutoff_count >= 2
        && noDue.status === "NO_DUE_SLOT"
        && slotCountBefore === slotCountAfter;
      if (!late) throw new Error("AM19_P24_LATE_EXACT_NO_REWRITE_REQUIRED");
    }
  }

  if (results.length !== 24) throw new Error(`AM19_P24_EXACT_24_RESULTS_REQUIRED:${results.length}`);
  const o00 = results[0]!;
  const o00Forcing = forcingFromTick(o00);
  const realIds = input.realRecords
    .filter((record) => record.record_type === "future_weather_assumption_v1" || record.record_type === "future_et0_assumption_v1")
    .map((record) => record.source_record_id)
    .sort();
  const o00Real = o00.status === "DEGRADED"
    && o00Forcing.mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"
    && o00Forcing.interval_start === input.built.a0
    && o00Forcing.interval_end === input.built.o00
    && o00Forcing.forcing_cycle_basis?.valid_from === input.built.a0
    && o00Forcing.forcing_cycle_basis?.valid_to === addHours(input.built.a0, 72)
    && JSON.stringify([...o00Forcing.source_record_refs].sort()) === JSON.stringify(realIds);

  const modeA = results.filter((result) => forcingFromTick(result).mode === "EXACT_PROVIDER_INTERVAL_PAIR").length === 1
    && results.find((result) => result.slot_id === "O06")?.status === "COMPLETED";
  const modeB = results.filter((result) => forcingFromTick(result).mode === "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR").length === 23
    && results.filter((result) => result.status === "DEGRADED").length === 23;
  const partial = partialRain && partialEt0;

  if (!o00Real) throw new Error("AM19_P24_O00_REAL_CAUSAL_GFS_H1_REQUIRED");
  if (!modeA) throw new Error("AM19_P24_MODE_A_REQUIRED");
  if (!modeB) throw new Error("AM19_P24_MODE_B_REQUIRED");
  if (!partial) throw new Error("AM19_P24_PARTIAL_PAIR_WHOLE_MODE_B_REQUIRED");
  if (!zeroProviderWait) throw new Error("AM19_P24_ZERO_PROVIDER_WAIT_REQUIRED");

  return {
    pool,
    restart,
    backfill,
    idempotency,
    late,
    o00_real: o00Real,
    mode_a: modeA,
    mode_b: modeB,
    partial,
    zero_provider_wait: zeroProviderWait,
  };
}

async function readback(pool: Pool): Promise<Record<string, number>> {
  const s = MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  const p = [s.tenant_id, s.project_id, s.group_id, s.field_id, s.season_id, s.zone_id];
  const row = (await pool.query(
    `SELECT
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS slots,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND state='COMPLETED') AS completed,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND state='DEGRADED') AS degraded,
      (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND state='FAILED') AS failed,
      (SELECT count(*)::int FROM twin_terminal_tick_uniqueness_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS terminal_ticks,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_config_v1') AS runtime_configs,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_tick_v1') AS canonical_ticks,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_state_estimate_v1') AS canonical_states,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1') AS canonical_checkpoints,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_forecast_run_v1') AS canonical_forecasts,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_runtime_health_v1') AS canonical_health,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_evidence_window_v1') AS canonical_evidence_windows,
      (SELECT count(*)::int FROM twin_state_history_projection_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_history,
      (SELECT count(*)::int FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS active_lineage,
      (SELECT count(*)::int FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_latest,
      (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_latest,
      (SELECT count(*)::int FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_latest,
      (SELECT count(*)::int FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_success_latest,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_evidence_window_v1' AND record_json#>>'{payload,payload,current_interval_forcing,mode}'='EXACT_PROVIDER_INTERVAL_PAIR') AS mode_a,
      (SELECT count(*)::int FROM facts WHERE record_json->>'type'='twin_evidence_window_v1' AND record_json#>>'{payload,payload,current_interval_forcing,mode}'='PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR') AS mode_b,
      (SELECT count(*)::int FROM twin_decision_record_projection_v1) AS decision_records,
      (SELECT count(*)::int FROM twin_approved_plan_binding_projection_v1) AS approved_plans,
      ((SELECT count(*)::int FROM twin_action_feedback_projection_v1)+(SELECT count(*)::int FROM twin_action_feedback_evidence_index_v1)+(SELECT count(*)::int FROM twin_action_feedback_cycle_projection_v1)) AS action_feedback_rows,
      (SELECT count(*)::int FROM facts WHERE lower(record_json->>'type') ~ '(decision|recommend|approval|action|dispatch|model_activation)') AS downstream_named_facts`,
    p,
  )).rows[0] ?? {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

async function assertFullMainReadback(pool: Pool, built?: BuiltQualificationV1): Promise<Record<string, number>> {
  const r = await readback(pool);
  if (
    r.slots !== 24
    || r.completed !== 1
    || r.degraded !== 23
    || r.failed !== 0
    || r.terminal_ticks !== 24
    || r.runtime_configs !== 25
    || r.canonical_ticks !== 25
    || r.canonical_states !== 25
    || r.canonical_checkpoints !== 25
    || r.canonical_forecasts !== 25
    || r.canonical_health !== 25
    || r.canonical_evidence_windows !== 25
    || r.state_history !== 25
    || r.active_lineage !== 1
    || r.state_latest !== 1
    || r.checkpoint_latest !== 1
    || r.forecast_latest !== 1
    || r.forecast_success_latest !== 1
    || r.mode_a !== 1
    || r.mode_b !== 23
    || r.decision_records !== 0
    || r.approved_plans !== 0
    || r.action_feedback_rows !== 0
    || r.downstream_named_facts !== 0
  ) throw new Error(`AM19_P24_FULL_CHAIN_READBACK_FAILED:${JSON.stringify(r)}`);

  const cursor = (await pool.query(
    `SELECT next_slot_index,next_slot_id,next_logical_time,last_terminal_slot_id,last_terminal_logical_time
     FROM twin_shadow_online_scheduler_cursor_v1
     WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    [
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
      MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
    ],
  )).rows[0];
  if (!cursor || Number(cursor.next_slot_index) !== 24 || cursor.next_slot_id !== null || cursor.next_logical_time !== null || cursor.last_terminal_slot_id !== "O23") throw new Error("AM19_P24_SCHEDULER_CURSOR_COMPLETE_REQUIRED");

  const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  if (!snapshot || snapshot.previous_posterior.logical_time !== snapshot.checkpoint.logical_time || snapshot.previous_forecast_result.logical_time !== snapshot.checkpoint.logical_time) throw new Error("AM19_P24_LATEST_POINTER_GRAPH_REQUIRED");
  if (built) {
    if (snapshot.checkpoint.logical_time !== built.o23 || snapshot.checkpoint.payload.next_tick_logical_time !== addHours(built.o23, 1) || snapshot.runtime_config.object_id !== built.bundle.persistence_bundle.runtime_configs[23]!.object_id) throw new Error("AM19_P24_FINAL_O23_POINTER_REQUIRED");
  }
  return r;
}

async function blockedComplete(pool: Pool): Promise<boolean> {
  const slot = (await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE state='FAILED' AND health_ref LIKE '%BLOCKED_NO_CAUSAL_FORCING%')::int AS blocked
     FROM twin_shadow_online_scheduler_slot_v1`,
  )).rows[0];
  if (Number(slot?.total ?? 0) !== 1 || Number(slot?.blocked ?? 0) !== 1) return false;
  const terminal = Number((await pool.query("SELECT count(*)::int AS n FROM twin_terminal_tick_uniqueness_v1")).rows[0]?.n ?? -1);
  const configs = Number((await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'='twin_runtime_config_v1'")).rows[0]?.n ?? -1);
  const stateHistory = Number((await pool.query("SELECT count(*)::int AS n FROM twin_state_history_projection_v1")).rows[0]?.n ?? -1);
  return terminal === 0 && configs === 25 && stateHistory === 1;
}

async function runBlocked(pool: Pool, built: BuiltQualificationV1): Promise<boolean> {
  let synthetic = built.o00;
  const { runner } = composition(pool, built, () => new Date(synthetic));
  const result = await runner.executeOneDueSlot({
    through_logical_time: built.o00,
    observer_started_at: built.o00,
    lease_owner: `am19-p24-blocked-${process.env.GITHUB_RUN_ID ?? "local"}`,
    lease_duration_seconds: LEASE_SECONDS,
  });
  if (result.status !== "BLOCKED_TERMINAL_RECORDED" || result.detail !== "AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR" || result.provider_request_count !== 0 || result.r2_request_count !== 0) return false;
  const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
  if (!snapshot
    || snapshot.checkpoint.logical_time !== built.a0
    || snapshot.checkpoint.payload.checkpoint_kind !== "INITIAL"
    || snapshot.checkpoint.payload.next_tick_logical_time !== built.o00
    || snapshot.runtime_config.object_id !== built.bundle.persistence_bundle.bootstrap_runtime_config.object_id) return false;
  return blockedComplete(pool);
}

async function existingSuccessReadOnlyReverify(mainPool: Pool, blockedPool: Pool): Promise<boolean> {
  try {
    await assertFullMainReadback(mainPool);
    return await blockedComplete(blockedPool);
  } catch {
    return false;
  }
}

function selftest(): void {
  const subject = "a".repeat(40);
  const a0 = "2026-08-19T12:00:00.000Z";
  const candidate: CandidateV1 = {
    schema_version: "geox_mcft_cap09_rolling_preboundary_candidate_v1",
    status: "PASS",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    producer_subject_sha: subject,
    subject_sha: subject,
    target_t: a0,
    candidate_expires_at: "2026-08-20T12:00:00.000Z",
    captured_at: "2026-08-19T11:20:00.000Z",
    record_types: ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"],
  };
  const built = buildQualification(candidate, subject, MAIN_DB);
  if (built.o00 !== addHours(a0, 1) || built.o23 !== addHours(a0, 24) || built.manifest.slots.length !== 24 || built.bundle.persistence_bundle.runtime_configs.length !== 24) throw new Error("AM19_P24_SELFTEST_EXACT_RANGE_REQUIRED");
  if (built.epoch_id === FAILED_EPOCH || built.manifest.database_name !== MAIN_DB) throw new Error("AM19_P24_SELFTEST_FAILED_AUTHORITY_REUSE");
  const pair = currentPair(built.o00, 1);
  if (pair.some((record) => record.epistemic_class !== "ASSUMED" || !record.limitations.includes("ENGINEERING_FIXTURE_ONLY") || !record.limitations.includes("NOT_FORMAL_EXTERNAL_EVIDENCE"))) throw new Error("AM19_P24_SELFTEST_FIXTURE_DISCLOSURE_REQUIRED");
  if (pair.some((record) => record.role_time.valid_from !== built.o00 || record.role_time.valid_to !== addHours(built.o00, 72))) throw new Error("AM19_P24_SELFTEST_CURRENT_PAIR_WINDOW_REQUIRED");
  const testUrl = databaseUrlFor(`postgresql://u:p@example.invalid/${FORMAL_V3_DB}?sslmode=require`, MAIN_DB);
  if (!testUrl.includes(`/${MAIN_DB}`) || testUrl.includes(`/${FORMAL_V3_DB}`)) throw new Error("AM19_P24_SELFTEST_DATABASE_PATH_REPLACEMENT_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    production_scheduler_class_reused: true,
    production_runner_class_reused: true,
    production_persistent_tick_service_reused: true,
    production_bootstrap_persistence_service_reused: true,
    production_persistence_repositories_reused: true,
    bootstrap_lease_uses_real_database_clock: true,
    accelerated_clock_substitution_only_after_bootstrap_lease_expiry: true,
    exact_24_manifest_slots: true,
    failed_epoch_reuse_forbidden: true,
    formal_database_write_authorized: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
  }));
}

async function run(): Promise<void> {
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_P24_SUBJECT_SHA_INVALID");
  assertPersistenceFreeProof();

  const sourceUrl = requiredEnv("MCFT_CAP09_PARENT_DATABASE_URL");
  const localUrl = requiredEnv("LOCAL_REHYDRATION_DATABASE_URL");
  const mainUrl = databaseUrlFor(sourceUrl, MAIN_DB);
  const blockedUrl = databaseUrlFor(sourceUrl, BLOCKED_DB);
  let mainPool = new Pool({ connectionString: mainUrl, application_name: "mcft-cap09-am19-p24-main" });
  const blockedPool = new Pool({ connectionString: blockedUrl, application_name: "mcft-cap09-am19-p24-blocked" });
  const localPool = new Pool({ connectionString: localUrl, application_name: "mcft-cap09-am19-p24-local-read" });
  const statuses = initialStatuses();
  statuses.PERSISTENCE_FREE_24T = "PASS";

  try {
    await schemaPreflight(mainPool, MAIN_DB);
    await schemaPreflight(blockedPool, BLOCKED_DB);
    statuses.SCHEMA_ENV_PREFLIGHT = "PASS";

    const mainIsZero = await zeroState(mainPool);
    const blockedIsZero = await zeroState(blockedPool);
    if (!mainIsZero || !blockedIsZero) {
      if (await existingSuccessReadOnlyReverify(mainPool, blockedPool)) {
        writeOutput({
          schema_version: "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1",
          status: "ALREADY_QUALIFIED_READ_ONLY",
          subject_sha: subject,
          main_database_name: MAIN_DB,
          blocked_database_name: BLOCKED_DB,
          database_write_count: 0,
          runtime_write_count: 0,
          scheduler_write_count: 0,
          provider_request_count: 0,
          r2_request_count: 0,
          new_machine_gate_claim: false,
          existing_success_evidence_unchanged: true,
          final_actual_24h_still_required: true,
          formal_o00_started: false,
          mcft_cap09_completed: false,
        });
        return;
      }
      throw new Error(`AM19_P24_AUDIT_ONLY_RETRY_DB_VERSION_REQUIRED:${MAIN_DB}:${BLOCKED_DB}`);
    }

    await assertZeroState(mainPool, MAIN_DB);
    await assertZeroState(blockedPool, BLOCKED_DB);

    const candidate = loadCandidate(subject);
    assertRehydrationProof(candidate, subject);
    const mainBuilt = buildQualification(candidate, subject, MAIN_DB);
    const blockedBuilt = buildQualification(candidate, subject, BLOCKED_DB);
    if (mainBuilt.a0 !== blockedBuilt.a0 || mainBuilt.o00 !== blockedBuilt.o00 || mainBuilt.o23 !== blockedBuilt.o23) throw new Error("AM19_P24_LANE_TIME_DRIFT");

    const localFacts = await localRehydratedFacts(localPool, candidate);
    const realRecords = localFacts.map(payloadFromFact);
    await copyRealFacts(localFacts, mainPool);
    const fixtureCount = await insertMainFixtures(mainPool, mainBuilt);

    await insertFixture(blockedPool, soilRecord(blockedBuilt.a0, 9000, "BLOCKED_A0"));
    for (const record of [soilRecord(blockedBuilt.o00, 9001, "BLOCKED_O00"), ...currentPair(blockedBuilt.o00, 9001)]) await insertFixture(blockedPool, record);

    await Promise.all([
      bootstrap(mainPool, mainBuilt, "main"),
      bootstrap(blockedPool, blockedBuilt, "blocked"),
    ]);

    await Promise.all([
      waitForBootstrapLeaseExpiry(mainPool, "am19-p24-bootstrap-main"),
      waitForBootstrapLeaseExpiry(blockedPool, "am19-p24-bootstrap-blocked"),
    ]);

    const blocked = await runBlocked(blockedPool, blockedBuilt);
    if (!blocked) throw new Error("AM19_P24_BLOCKED_NO_CAUSAL_FORCING_PROOF_REQUIRED");

    const mainRun = await runMain24({ pool: mainPool, url: mainUrl, built: mainBuilt, realRecords });
    mainPool = mainRun.pool;
    statuses.O00_WARM_START = mainRun.o00_real ? "PASS" : "NOT_RUN";
    statuses.MODE_A = mainRun.mode_a ? "PASS" : "NOT_RUN";
    statuses.MODE_B = mainRun.mode_b ? "PASS" : "NOT_RUN";
    statuses.PARTIAL_PAIR = mainRun.partial ? "PASS" : "NOT_RUN";
    statuses.LATE_EXACT_NO_REWRITE = mainRun.late ? "PASS" : "NOT_RUN";
    statuses.RESTART = mainRun.restart ? "PASS" : "NOT_RUN";
    statuses.MISSED_SLOT_BACKFILL = mainRun.backfill ? "PASS" : "NOT_RUN";
    statuses.IDEMPOTENCY = mainRun.idempotency ? "PASS" : "NOT_RUN";
    statuses.ZERO_PROVIDER_WAIT = mainRun.zero_provider_wait && blocked ? "PASS" : "NOT_RUN";

    const readbackResult = await assertFullMainReadback(mainPool, mainBuilt);
    statuses.FULL_CHAIN_READBACK = "PASS";
    statuses.PERSISTENT_24T = "PASS";

    const staticBlockers = REQUIRED_MACHINE_STATUS_KEYS.filter((key) => statuses[key] !== "PASS");
    if (staticBlockers.length !== 0) throw new Error(`AM19_P24_STATIC_BLOCKERS_REMAIN:${staticBlockers.join(",")}`);

    writeOutput({
      schema_version: "geox_mcft_cap09_amendment19_persistent24_qualification_result_v1",
      status: "PASS",
      subject_sha: subject,
      producer_subject_sha: candidate.producer_subject_sha,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      qualification_clock: "ACCELERATED_ENGINEERING_ONLY",
      accelerated_clock_scope: "REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY",
      bootstrap_lease_clock: "REAL_DATABASE_TRANSACTION_TIMESTAMP",
      bootstrap_lease_duration_seconds: LEASE_SECONDS,
      bootstrap_lease_real_expiry_required: true,
      lease_and_fencing_clock_substitution: false,
      formal_clock_authority_changed: false,
      a0: mainBuilt.a0,
      o00: mainBuilt.o00,
      o23: mainBuilt.o23,
      qualification_epoch_id: mainBuilt.epoch_id,
      main_database_name: MAIN_DB,
      blocked_database_name: BLOCKED_DB,
      real_provider_evidence_fact_count: 3,
      controlled_engineering_fixture_fact_count_before_late_pair: fixtureCount,
      fixture_provider_claim_count: 0,
      runtime_provider_request_count: 0,
      runtime_r2_request_count: 0,
      production_scheduler_reused: true,
      production_lease_fencing_reused: true,
      production_runner_reused: true,
      production_persistent_tick_service_reused: true,
      production_persistence_repositories_reused: true,
      production_bootstrap_persistence_service_reused: true,
      o00_real_causal_gfs_h1_required: true,
      o00_real_causal_gfs_h1_proved: mainRun.o00_real,
      blocked_fault_isolated_from_main_24t_store: true,
      no_assumption_pair_blocks_explicitly_without_wait: blocked,
      restart_reconstructed_all_production_objects: mainRun.restart,
      missed_slot_oldest_first_backfill: mainRun.backfill,
      repeated_runner_call_created_no_duplicate_canonical_work: mainRun.idempotency,
      late_exact_causal_cutoff_excluded_and_no_state_rewrite: mainRun.late,
      readback: readbackResult,
      machine_statuses: statuses,
      static_blocker_count: 0,
      formal_database_write_count: 0,
      future_formal_epoch_selected: false,
      formal_o00_started: false,
      final_actual_24h_still_required: true,
      final_actual_24h_substituted_by_this_run: false,
      mcft_cap09_completed: false,
      raw_values_emitted: false,
    });
  } finally {
    await Promise.allSettled([mainPool.end(), blockedPool.end(), localPool.end()]);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "selftest") return selftest();
  if (mode !== "run") throw new Error("AM19_P24_MODE_REQUIRED");
  await run();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
