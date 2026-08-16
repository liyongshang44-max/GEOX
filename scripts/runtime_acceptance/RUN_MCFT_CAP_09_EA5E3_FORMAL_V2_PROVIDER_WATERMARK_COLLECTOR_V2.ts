import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool, type PoolClient, type QueryResult } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  prefetchLiveKbsVariate25RawV1,
  type PrefetchedKbsSoilRawV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const GFS_HELPER = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");
const KBS_LATE_DECODER = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py");
const EA5E3_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E3-FORMAL-AUTHORITY-V3.json");
const HARDENING_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-RUNTIME-HARDENING-AUTHORITY-V1.json");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_COLLECTOR_V2_RESULT.json");

const EPOCH_ID = "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2";
const O00 = "2026-08-17T20:00:00.000Z";
const O23 = "2026-08-18T19:00:00.000Z";
const SLOT_COUNT = 24;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const PREBOUNDARY_MAX_START_LEAD_MINUTES = 70;
const PREBOUNDARY_MIN_START_LEAD_MINUTES = 30;
const SOIL_WINDOW_MINUTES = 15;
const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 10;
const PREBOUNDARY_HARD_STOP_BEFORE_T_MINUTES = 2;
const GFS_MAX_ATTEMPTS = 3;
const GFS_RETRY_BACKOFF_MS = 60_000;
const GFS_ROOT = "https://nomads.ncep.noaa.gov/";
const KBS_RAW_HOURLY_URL = "https://lter.kbs.msu.edu/datatables/13.csv";
const FORMAL_DATABASE_NAME = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const FORMAL_RAW_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const SOURCE_MATRIX_REF = "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1";

type SafePhaseResultV1 = {
  phase: "DELAYED_EXACT" | "PREBOUNDARY";
  status: "INSERTED" | "ALREADY_COMPLETE" | "WAITING" | "NOT_DUE";
  slot_id: string | null;
  logical_time: string | null;
  canonical_fact_write_count: number;
  provider_request_count: number;
  raw_values_emitted: false;
  dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION";
  gfs_attempt_count?: number;
};

type Ea5e3AuthorityV1 = {
  schema_version: string;
  selected_epoch: { epoch_id: string; o00: string; o23: string; slot_count: number };
  formal_store: { database_name: string };
  activation_gate: { ea5e3_effective_if_present_on_protected_main: boolean; formal_evidence_collector_enabled_after_effectiveness: boolean };
};

type HardeningAuthorityV1 = {
  schema_version: string;
  selected_epoch: { epoch_id: string; o00: string; o23: string };
  formal_store: { database_name: string };
  collector_hardening: {
    temporal_authority: string;
    gfs_preboundary_minimum_start_lead_minutes: number;
    gfs_retry_is_operational_only: boolean;
    multi_record_dataset_atomic_commit_required: boolean;
    raw_retention_before_canonicalization_required: boolean;
    fixed_lag_7h_normative_authority: boolean;
    fixed_t_plus_432_normative_cutoff: boolean;
    fixed_t_plus_437_normative_observer: boolean;
  };
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE_MS).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(value: string): Promise<void> {
  const remaining = Date.parse(value) - Date.now();
  if (remaining > 0) await sleep(remaining);
}

function slotTimes(): Array<{ slot_id: string; logical_time: string }> {
  return Array.from({ length: SLOT_COUNT }, (_, index) => ({
    slot_id: `O${String(index).padStart(2, "0")}`,
    logical_time: new Date(Date.parse(O00) + index * HOUR_MS).toISOString(),
  }));
}

function datasetIds(target: string): { gfs: string; soil: string; kbs: string } {
  const key = target.replace(/[-:.]/g, "").replace("000Z", "Z").toLowerCase();
  return {
    gfs: `mcft_cap09_formal_v2_gfs_${key}`,
    soil: `mcft_cap09_formal_v2_soil_${key}`,
    kbs: `mcft_cap09_formal_v2_kbs_exact_${key}`,
  };
}

function loadAuthorities(): void {
  const ea5e3 = JSON.parse(fs.readFileSync(EA5E3_AUTHORITY_PATH, "utf8")) as Ea5e3AuthorityV1;
  if (ea5e3.schema_version !== "geox_mcft_cap09_ea5e3_formal_authority_v3") throw new Error("EA5E3_V2_FORMAL_AUTHORITY_SCHEMA_REQUIRED");
  if (ea5e3.selected_epoch?.epoch_id !== EPOCH_ID || ea5e3.selected_epoch?.o00 !== O00 || ea5e3.selected_epoch?.o23 !== O23 || ea5e3.selected_epoch?.slot_count !== SLOT_COUNT) throw new Error("EA5E3_V2_FORMAL_AUTHORITY_EPOCH_DRIFT");
  if (ea5e3.formal_store?.database_name !== FORMAL_DATABASE_NAME || ea5e3.activation_gate?.ea5e3_effective_if_present_on_protected_main !== true || ea5e3.activation_gate?.formal_evidence_collector_enabled_after_effectiveness !== true) throw new Error("EA5E3_V2_FORMAL_COLLECTOR_NOT_AUTHORIZED");

  const hardening = JSON.parse(fs.readFileSync(HARDENING_AUTHORITY_PATH, "utf8")) as HardeningAuthorityV1;
  if (hardening.schema_version !== "geox_mcft_cap09_pre_runtime_hardening_authority_v1") throw new Error("EA5E3_V2_HARDENING_AUTHORITY_SCHEMA_REQUIRED");
  if (hardening.selected_epoch?.epoch_id !== EPOCH_ID || hardening.selected_epoch?.o00 !== O00 || hardening.selected_epoch?.o23 !== O23 || hardening.formal_store?.database_name !== FORMAL_DATABASE_NAME) throw new Error("EA5E3_V2_HARDENING_EPOCH_OR_DATABASE_DRIFT");
  const c = hardening.collector_hardening;
  if (c?.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1" || c?.gfs_preboundary_minimum_start_lead_minutes !== PREBOUNDARY_MIN_START_LEAD_MINUTES || c?.gfs_retry_is_operational_only !== true || c?.multi_record_dataset_atomic_commit_required !== true || c?.raw_retention_before_canonicalization_required !== true || c?.fixed_lag_7h_normative_authority !== false || c?.fixed_t_plus_432_normative_cutoff !== false || c?.fixed_t_plus_437_normative_observer !== false) throw new Error("EA5E3_V2_HARDENING_COLLECTOR_CONTRACT_DRIFT");
}

function assertExactProtectedMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("EA5E3_V2_COLLECTOR_SUBJECT_SHA_INVALID");
  if (!["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("EA5E3_V2_COLLECTOR_EXACT_PROTECTED_MAIN_REQUIRED");
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("EA5E3_V2_FORMAL_REMOTE_DATABASE_REQUIRED");
  if (parsed.pathname.replace(/^\//, "") !== FORMAL_DATABASE_NAME) throw new Error("EA5E3_V2_FORMAL_DATABASE_URL_NAME_REQUIRED");
  const result = await pool.query("SELECT current_database() AS database_name");
  if (String(result.rows[0]?.database_name ?? "") !== FORMAL_DATABASE_NAME) throw new Error("EA5E3_V2_FORMAL_DATABASE_SESSION_IDENTITY_REQUIRED");
}

async function datasetCount(pool: Pool, datasetId: string): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS n FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1' AND record_json->'payload'->>'dataset_id'=$1", [datasetId]);
  return Number(result.rows[0]?.n ?? 0);
}

async function datasetTypes(pool: Pool, datasetId: string): Promise<string[]> {
  const result = await pool.query("SELECT record_json->'payload'->>'record_type' AS record_type FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1' AND record_json->'payload'->>'dataset_id'=$1 ORDER BY record_type", [datasetId]);
  return result.rows.map((row) => String(row.record_type));
}

function assertFormalRetention(results: readonly CanonicalizedExternalEvidenceResultV1[]): void {
  for (const result of results) {
    const expectedPrefix = `s3-private://${FORMAL_RAW_BUCKET}/${FORMAL_RAW_PREFIX}/`;
    if (!result.raw_provenance.retention_ref.startsWith(expectedPrefix)) throw new Error(`EA5E3_V2_FORMAL_RAW_RETENTION_REQUIRED:${result.record.record_type}`);
  }
}

function assertPreboundaryChronology(target: string, results: readonly CanonicalizedExternalEvidenceResultV1[]): void {
  for (const result of results) {
    const available = canonicalIso(result.record.available_to_runtime_at, "EA5E3_V2_PREBOUNDARY_AVAILABLE_INVALID");
    const ingested = canonicalIso(String(result.record.role_time.ingested_at ?? ""), "EA5E3_V2_PREBOUNDARY_INGESTED_INVALID");
    if (Date.parse(available) > Date.parse(target) || Date.parse(ingested) > Date.parse(target)) throw new Error(`EA5E3_V2_PREBOUNDARY_POST_T_EVIDENCE_FORBIDDEN:${result.record.record_type}`);
  }
}

function assertDelayedExactInterval(target: string, results: readonly CanonicalizedExternalEvidenceResultV1[]): void {
  const expectedStart = new Date(Date.parse(target) - HOUR_MS).toISOString();
  for (const result of results) {
    const start = String(result.record.role_time.interval_start ?? "");
    const end = String(result.record.role_time.interval_end ?? "");
    if (start !== expectedStart || end !== target) throw new Error(`EA5E3_V2_DELAYED_EXACT_INTERVAL_REQUIRED:${result.record.record_type}`);
  }
}

function transactionBoundPool(client: PoolClient): Pool {
  let savepoint = 0;
  return {
    query: client.query.bind(client),
    connect: async () => {
      const name = `mcft_cap09_ea5e3_atomic_${++savepoint}`;
      let active = false;
      return {
        async query(text: string, values?: unknown[]): Promise<QueryResult> {
          const command = text.trim().toUpperCase();
          if (command.startsWith("BEGIN")) {
            assert(!active, "EA5E3_V2_NESTED_TRANSACTION_REENTRY");
            active = true;
            return client.query(`SAVEPOINT ${name}`);
          }
          if (command === "COMMIT") {
            assert(active, "EA5E3_V2_NESTED_COMMIT_WITHOUT_BEGIN");
            active = false;
            return client.query(`RELEASE SAVEPOINT ${name}`);
          }
          if (command === "ROLLBACK") {
            if (active) {
              await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
              active = false;
              return client.query(`RELEASE SAVEPOINT ${name}`);
            }
            return { rows: [], rowCount: 0 } as unknown as QueryResult;
          }
          return client.query(text, values);
        },
        release(): void {
          assert(!active, "EA5E3_V2_NESTED_TRANSACTION_NOT_TERMINAL");
        },
      };
    },
  } as unknown as Pool;
}

async function appendResultsAtomically(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, results: readonly CanonicalizedExternalEvidenceResultV1[]): Promise<number> {
  assertFormalRetention(results);
  if (results.length < 1 || results.length > 2) throw new Error(`EA5E3_V2_ATOMIC_DATASET_CARDINALITY_INVALID:${results.length}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ingress = new PostgresExternalFormalEvidenceIngressV1(transactionBoundPool(client), retention);
    let writes = 0;
    for (const result of [...results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type))) {
      writes += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
    }
    await client.query("COMMIT");
    return writes;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function runPython(script: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(PYTHON, [script, ...args], { cwd: process.cwd(), timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024 });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

class PythonGfsTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  constructor(private readonly target: string) {}
  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-ea5e3-gfs-v2-"));
    const bundle = path.join(temp, "gfs.tar");
    const meta = path.join(temp, "gfs-meta.json");
    try {
      await runPython(GFS_HELPER, ["fetch-gfs", "--target", this.target, "--output", bundle, "--meta", meta]);
      const safe = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, unknown>;
      this.provider_request_count = Number(safe.provider_request_count ?? 0);
      if (!Number.isSafeInteger(this.provider_request_count) || this.provider_request_count <= 0) throw new Error("EA5E3_V2_GFS_PROVIDER_REQUEST_COUNT_REQUIRED");
      const retrievedAt = canonicalIso(String(safe.retrieved_at ?? ""), "EA5E3_V2_GFS_RETRIEVED_AT_INVALID");
      return { status: 200, final_locator: GFS_ROOT, content_type: "application/x-tar", retrieved_at: retrievedAt, available_at: retrievedAt, bytes: new Uint8Array(fs.readFileSync(bundle)) };
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

class PythonGfsDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-ea5e3-gfs-decode-v2-"));
    const bundle = path.join(temp, "gfs.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await runPython(GFS_HELPER, ["decode-gfs", "--target", this.target, "--available-at", input.provenance.available_at, "--input", bundle, "--output", output]);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E3_V2_GFS_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

class OneShotSoilTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5E3_V2_SOIL_PREFETCH_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) throw new Error("EA5E3_V2_SOIL_PREFETCH_IDENTITY_MISMATCH");
    return this.prefetched.response;
  }
}

class KbsBatchTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    this.provider_request_count += 1;
    const response = await fetch(KBS_RAW_HOURLY_URL, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-EA5E3-FORMAL-COLLECTOR-V2/1" },
      signal: AbortSignal.timeout(180_000),
    });
    if (response.status !== 200) throw new Error(`EA5E3_V2_KBS_HTTP_STATUS:${response.status}`);
    const finalUrl = new URL(response.url || KBS_RAW_HOURLY_URL);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "lter.kbs.msu.edu" || finalUrl.pathname !== "/datatables/13.csv") throw new Error("EA5E3_V2_KBS_FINAL_IDENTITY_DRIFT");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 110_000_000) throw new Error(`EA5E3_V2_KBS_RAW_BYTES_INVALID:${bytes.byteLength}`);
    const retrievedAt = new Date().toISOString();
    return { status: 200, final_locator: finalUrl.toString(), content_type: response.headers.get("content-type")?.trim() || "text/csv", retrieved_at: retrievedAt, available_at: retrievedAt, bytes };
  }
}

class PythonKbsAuthoritativeLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_AMENDMENT11_KBS_AUTHORITATIVE_LATE_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-ea5e3-kbs-v2-"));
    const raw = path.join(temp, "kbs.csv");
    const output = path.join(temp, "drafts.json");
    const meta = path.join(temp, "meta.json");
    try {
      fs.writeFileSync(raw, Buffer.from(input.raw_bytes));
      await runPython(KBS_LATE_DECODER, ["decode", "--available-at", input.provenance.available_at, "--target-t", this.target, "--input", raw, "--output", output, "--meta", meta]);
      const safe = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, unknown>;
      if (safe.selection_mode !== "EXACT_REQUESTED_TARGET" || safe.selected_target_t !== this.target || safe.freshness_is_late_authoritative_admission_gate !== false) throw new Error("EA5E3_V2_KBS_AMENDMENT11_META_REQUIRED");
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E3_V2_KBS_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

async function preboundaryComplete(pool: Pool, target: string): Promise<boolean> {
  const ids = datasetIds(target);
  const gfs = await datasetCount(pool, ids.gfs);
  const soil = await datasetCount(pool, ids.soil);
  if (![0, 2].includes(gfs)) throw new Error(`EA5E3_V2_GFS_PARTIAL_DATASET_FAIL_CLOSED:${target}:${gfs}`);
  if (![0, 1].includes(soil)) throw new Error(`EA5E3_V2_SOIL_PARTIAL_DATASET_FAIL_CLOSED:${target}:${soil}`);
  return gfs === 2 && soil === 1;
}

async function assertNoExpiredPreboundaryGap(pool: Pool, now: string): Promise<void> {
  for (const slot of slotTimes()) {
    if (Date.parse(slot.logical_time) > Date.parse(now)) break;
    if (!(await preboundaryComplete(pool, slot.logical_time))) throw new Error(`EA5E3_V2_PREBOUNDARY_GAP_EXPIRED_FAIL_CLOSED:${slot.slot_id}:${slot.logical_time}`);
  }
}

async function runDelayedPhase(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, now: string): Promise<SafePhaseResultV1> {
  for (const slot of slotTimes()) {
    if (Date.parse(slot.logical_time) > Date.parse(now)) break;
    if (!(await preboundaryComplete(pool, slot.logical_time))) continue;
    const ids = datasetIds(slot.logical_time);
    const existing = await datasetCount(pool, ids.kbs);
    if (existing === 2) continue;
    if (existing !== 0) throw new Error(`EA5E3_V2_DELAYED_PARTIAL_DATASET_FAIL_CLOSED:${slot.slot_id}:${existing}`);
    const transport = new KbsBatchTransportV1();
    try {
      const requestedAt = new Date().toISOString();
      const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
        dataset_id: ids.kbs,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: {
          request_id: `ea5e3-formal-v2-kbs-${crypto.randomUUID()}`,
          provider_id: "KBS_LTER",
          source_family: "RAW_HOURLY_WEATHER",
          locator: KBS_RAW_HOURLY_URL,
          allowed_final_hosts: ["lter.kbs.msu.edu"],
          use_policy_ref: SOURCE_MATRIX_REF,
          requested_at: requestedAt,
          source_event_time: slot.logical_time,
          expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"],
          limitations: ["AMENDMENT11_AUTHORITATIVE_LATE", "FORMAL_V2_EVIDENCE_ONLY", "NO_RUNTIME_PROVIDER_FETCH", "ATOMIC_CANONICAL_PAIR_COMMIT"],
        },
      }, { transport, retention, decoder: new PythonKbsAuthoritativeLateDecoderV1(slot.logical_time) });
      if (results.length !== 2) throw new Error("EA5E3_V2_DELAYED_EXACT_PAIR_REQUIRED");
      const types = results.map((result) => result.record.record_type).sort();
      if (JSON.stringify(types) !== JSON.stringify(["historical_et0_estimate_v1", "observed_rainfall_v1"])) throw new Error("EA5E3_V2_DELAYED_TYPE_PAIR_REQUIRED");
      assertDelayedExactInterval(slot.logical_time, results);
      const writes = await appendResultsAtomically(pool, retention, results);
      if (writes !== 2) throw new Error(`EA5E3_V2_DELAYED_EXACT_NEW_WRITE_PAIR_REQUIRED:${writes}`);
      return { phase: "DELAYED_EXACT", status: "INSERTED", slot_id: slot.slot_id, logical_time: slot.logical_time, canonical_fact_write_count: writes, provider_request_count: transport.provider_request_count, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION" };
    } catch (error) {
      const text = error instanceof Error ? `${error.message}\n${(error as Error & { stderr?: string }).stderr ?? ""}` : String(error);
      if (text.includes("MCFT_CAP09_KBS_LATE_REQUESTED_TARGET_MISSING")) return { phase: "DELAYED_EXACT", status: "WAITING", slot_id: slot.slot_id, logical_time: slot.logical_time, canonical_fact_write_count: 0, provider_request_count: transport.provider_request_count, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION" };
      throw error;
    }
  }
  return { phase: "DELAYED_EXACT", status: "NOT_DUE", slot_id: null, logical_time: null, canonical_fact_write_count: 0, provider_request_count: 0, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION" };
}

function upcomingPreboundarySlot(now: string): { slot_id: string; logical_time: string } | null {
  const nowMs = Date.parse(now);
  for (const slot of slotTimes()) {
    const leadMinutes = (Date.parse(slot.logical_time) - nowMs) / MINUTE_MS;
    if (leadMinutes >= PREBOUNDARY_MIN_START_LEAD_MINUTES && leadMinutes <= PREBOUNDARY_MAX_START_LEAD_MINUTES) return slot;
  }
  return null;
}

async function collectGfsWithBoundedRetry(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, target: string, datasetId: string): Promise<{ writes: number; providerRequests: number; attempts: number }> {
  const cutoff = Date.parse(addMinutes(target, -PREBOUNDARY_MIN_START_LEAD_MINUTES));
  let providerRequests = 0;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= GFS_MAX_ATTEMPTS; attempt += 1) {
    const requestedAt = new Date().toISOString();
    if (Date.parse(requestedAt) >= cutoff) {
      if (lastError) throw new Error(`EA5E3_V2_GFS_RETRY_WINDOW_EXHAUSTED_AFTER_${attempt - 1}_ATTEMPTS:${lastError instanceof Error ? lastError.message : String(lastError)}`);
      throw new Error("EA5E3_V2_GFS_MINIMUM_START_LEAD_LOST");
    }
    const transport = new PythonGfsTransportV1(target);
    try {
      const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
        dataset_id: datasetId,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: {
          request_id: `ea5e3-formal-v2-gfs-${crypto.randomUUID()}`,
          provider_id: "NOAA_NCEP_NOMADS_GFS",
          source_family: "GFS_PGRB2_SFLUX_RAW_BUNDLE",
          locator: GFS_ROOT,
          allowed_final_hosts: ["nomads.ncep.noaa.gov"],
          use_policy_ref: SOURCE_MATRIX_REF,
          requested_at: requestedAt,
          expected_content_type_prefixes: ["application/x-tar"],
          limitations: ["PREBOUNDARY_CAUSAL", "FORMAL_V2_EVIDENCE_ONLY", "NO_POST_T_FUTURE_FORCING", "BOUNDED_OPERATIONAL_RETRY_NOT_TEMPORAL_AUTHORITY", "ATOMIC_CANONICAL_PAIR_COMMIT"],
        },
      }, { transport, retention, decoder: new PythonGfsDecoderV1(target) });
      providerRequests += Math.max(transport.provider_request_count, 1);
      if (results.length !== 2) throw new Error("EA5E3_V2_GFS_EXACT_PAIR_REQUIRED");
      const types = results.map((result) => result.record.record_type).sort();
      if (JSON.stringify(types) !== JSON.stringify(["future_et0_assumption_v1", "future_weather_assumption_v1"])) throw new Error("EA5E3_V2_GFS_TYPE_PAIR_REQUIRED");
      assertPreboundaryChronology(target, results);
      const writes = await appendResultsAtomically(pool, retention, results);
      if (writes !== 2) throw new Error(`EA5E3_V2_GFS_NEW_WRITE_PAIR_REQUIRED:${writes}`);
      return { writes, providerRequests, attempts: attempt };
    } catch (error) {
      providerRequests += transport.provider_request_count === 0 ? 1 : 0;
      lastError = error;
      if (attempt >= GFS_MAX_ATTEMPTS) throw error;
      if (Date.now() + GFS_RETRY_BACKOFF_MS >= cutoff) throw new Error(`EA5E3_V2_GFS_RETRY_WOULD_CROSS_T_MINUS_30:${error instanceof Error ? error.message : String(error)}`);
      await sleep(GFS_RETRY_BACKOFF_MS);
    }
  }
  throw lastError ?? new Error("EA5E3_V2_GFS_RETRY_UNREACHABLE");
}

async function runPreboundaryPhase(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, now: string): Promise<SafePhaseResultV1> {
  const slot = upcomingPreboundarySlot(now);
  if (!slot) return { phase: "PREBOUNDARY", status: "NOT_DUE", slot_id: null, logical_time: null, canonical_fact_write_count: 0, provider_request_count: 0, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION", gfs_attempt_count: 0 };
  const target = slot.logical_time;
  const ids = datasetIds(target);
  let gfsCount = await datasetCount(pool, ids.gfs);
  let soilCount = await datasetCount(pool, ids.soil);
  if (![0, 2].includes(gfsCount)) throw new Error(`EA5E3_V2_GFS_PARTIAL_DATASET_FAIL_CLOSED:${slot.slot_id}:${gfsCount}`);
  if (![0, 1].includes(soilCount)) throw new Error(`EA5E3_V2_SOIL_PARTIAL_DATASET_FAIL_CLOSED:${slot.slot_id}:${soilCount}`);
  if (gfsCount === 2 && soilCount === 1) return { phase: "PREBOUNDARY", status: "ALREADY_COMPLETE", slot_id: slot.slot_id, logical_time: target, canonical_fact_write_count: 0, provider_request_count: 0, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION", gfs_attempt_count: 0 };

  let writes = 0;
  let providerRequests = 0;
  let gfsAttempts = 0;
  if (gfsCount === 0) {
    const gfs = await collectGfsWithBoundedRetry(pool, retention, target, ids.gfs);
    writes += gfs.writes;
    providerRequests += gfs.providerRequests;
    gfsAttempts = gfs.attempts;
    gfsCount = await datasetCount(pool, ids.gfs);
  }

  if (soilCount === 0) {
    await sleepUntil(addMinutes(target, -SOIL_FIRST_FETCH_BEFORE_T_MINUTES));
    const soilWindowStart = Date.parse(addMinutes(target, -SOIL_WINDOW_MINUTES));
    const hardStop = Date.parse(addMinutes(target, -PREBOUNDARY_HARD_STOP_BEFORE_T_MINUTES));
    while (Date.now() < hardStop) {
      const prefetched = await prefetchLiveKbsVariate25RawV1();
      providerRequests += 1;
      const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
        dataset_id: ids.soil,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: prefetched.request,
      }, { transport: new OneShotSoilTransportV1(prefetched), retention, decoder: new KbsVariate25SoilEvidenceDecoderV1() });
      if (results.length !== 1 || results[0].record.record_type !== "soil_moisture_observation_v1") throw new Error("EA5E3_V2_SOIL_EXACT_ONE_REQUIRED");
      const observedAt = Date.parse(String(results[0].record.role_time.observed_at ?? ""));
      if (observedAt > soilWindowStart && observedAt <= Date.parse(target)) {
        assertPreboundaryChronology(target, results);
        const inserted = await appendResultsAtomically(pool, retention, results);
        if (inserted !== 1) throw new Error(`EA5E3_V2_SOIL_NEW_WRITE_REQUIRED:${inserted}`);
        writes += inserted;
        soilCount = 1;
        break;
      }
      if (Date.now() + MINUTE_MS >= hardStop) break;
      await sleep(MINUTE_MS);
    }
    if (soilCount !== 1) throw new Error(`EA5E3_V2_SOIL_T_MINUS_15_TO_T_NOT_OBSERVED_FAIL_CLOSED:${slot.slot_id}`);
  }

  if (gfsCount !== 2 || soilCount !== 1) throw new Error(`EA5E3_V2_PREBOUNDARY_THREE_FAMILY_INCOMPLETE:${slot.slot_id}`);
  const gfsTypes = await datasetTypes(pool, ids.gfs);
  const soilTypes = await datasetTypes(pool, ids.soil);
  if (JSON.stringify(gfsTypes) !== JSON.stringify(["future_et0_assumption_v1", "future_weather_assumption_v1"]) || JSON.stringify(soilTypes) !== JSON.stringify(["soil_moisture_observation_v1"])) throw new Error(`EA5E3_V2_PREBOUNDARY_DATASET_TYPE_DRIFT:${slot.slot_id}`);
  return { phase: "PREBOUNDARY", status: "INSERTED", slot_id: slot.slot_id, logical_time: target, canonical_fact_write_count: writes, provider_request_count: providerRequests, raw_values_emitted: false, dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION", gfs_attempt_count: gfsAttempts };
}

function selftest(): void {
  loadAuthorities();
  const slots = slotTimes();
  if (slots.length !== 24 || slots[0].slot_id !== "O00" || slots[0].logical_time !== O00 || slots[23].logical_time !== O23) throw new Error("EA5E3_V2_COLLECTOR_SELFTEST_SLOT_RANGE");
  const atExactHour = upcomingPreboundarySlot("2026-08-17T19:00:00.000Z");
  if (atExactHour?.slot_id !== "O00" || atExactHour.logical_time !== O00) throw new Error("EA5E3_V2_COLLECTOR_SELFTEST_UPCOMING_SLOT");
  if (upcomingPreboundarySlot("2026-08-16T12:00:00.000Z") !== null) throw new Error("EA5E3_V2_COLLECTOR_SELFTEST_EARLY_NOOP");
  if (datasetIds(O00).gfs === datasetIds(O00).kbs) throw new Error("EA5E3_V2_COLLECTOR_SELFTEST_DATASET_SEPARATION");
  if (GFS_MAX_ATTEMPTS !== 3 || GFS_RETRY_BACKOFF_MS >= 30 * MINUTE_MS) throw new Error("EA5E3_V2_COLLECTOR_SELFTEST_BOUNDED_RETRY_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    epoch_id: EPOCH_ID,
    slot_count: 24,
    o00: O00,
    o23: O23,
    provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    gfs_max_attempts: GFS_MAX_ATTEMPTS,
    gfs_retry_operational_only: true,
    gfs_retry_never_crosses_t_minus_30: true,
    multi_record_dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION",
    raw_retention_before_canonicalization: true,
    cron_minute_is_normative_temporal_authority: false,
    fixed_lag_7h_normative_authority: false,
    fixed_t_plus_432_normative_cutoff: false,
    fixed_t_plus_437_normative_observer: false,
    formal_database_name: FORMAL_DATABASE_NAME,
    formal_raw_prefix: FORMAL_RAW_PREFIX,
    runtime_provider_request_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    database_write_count: 0,
  }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") return selftest();
  if (process.argv[2] !== "cycle") throw new Error("EA5E3_V2_COLLECTOR_MODE_REQUIRED");
  loadAuthorities();
  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  assertExactProtectedMain(subject);
  const databaseUrl = required("DATABASE_URL");
  if (required("MCFT_CAP09_FORMAL_S3_BUCKET") !== FORMAL_RAW_BUCKET) throw new Error("EA5E3_V2_FORMAL_RAW_BUCKET_REQUIRED");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-ea5e3-formal-v2-provider-watermark-collector-v2" });
  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    endpoint: required("MCFT_CAP09_FORMAL_S3_ENDPOINT"),
    bucket: FORMAL_RAW_BUCKET,
    region: required("MCFT_CAP09_FORMAL_S3_REGION"),
    access_key_id: required("MCFT_CAP09_FORMAL_S3_ACCESS_KEY_ID"),
    secret_access_key: required("MCFT_CAP09_FORMAL_S3_SECRET_ACCESS_KEY"),
  });
  try {
    await assertFormalDatabase(pool, databaseUrl);
    const cycleStartedAt = new Date().toISOString();
    await assertNoExpiredPreboundaryGap(pool, cycleStartedAt);
    const delayed = await runDelayedPhase(pool, retention, cycleStartedAt);
    const preboundary = await runPreboundaryPhase(pool, retention, new Date().toISOString());
    const result = {
      schema_version: "geox_mcft_cap09_ea5e3_formal_v2_provider_watermark_collector_result_v2",
      status: "PASS",
      subject_sha: subject,
      epoch_id: EPOCH_ID,
      cycle_started_at: cycleStartedAt,
      cycle_completed_at: new Date().toISOString(),
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      provider_publication_cadence: "DAILY_BATCH",
      observation_resolution: "HOURLY",
      freshness_is_late_authoritative_admission_gate: false,
      fixed_lag_7h_normative_authority: false,
      fixed_t_plus_432_normative_cutoff: false,
      fixed_t_plus_437_normative_observer: false,
      cron_minute_is_normative_temporal_authority: false,
      gfs_retry_is_operational_only: true,
      multi_record_dataset_commit_mode: "ATOMIC_OUTER_TRANSACTION",
      formal_database_name: FORMAL_DATABASE_NAME,
      formal_raw_prefix: FORMAL_RAW_PREFIX,
      delayed,
      preboundary,
      formal_evidence_fact_write_count: delayed.canonical_fact_write_count + preboundary.canonical_fact_write_count,
      runtime_provider_request_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      recommendation_write_count: 0,
      approval_write_count: 0,
      ao_act_write_count: 0,
      dispatch_write_count: 0,
      raw_values_emitted: false,
    };
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
