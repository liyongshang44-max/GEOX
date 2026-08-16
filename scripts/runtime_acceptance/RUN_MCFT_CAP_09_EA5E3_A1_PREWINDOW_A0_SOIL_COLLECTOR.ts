import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  prefetchLiveKbsVariate25RawV1,
  type PrefetchedKbsSoilRawV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

const AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E3-AMENDMENT-01-PREWINDOW-A0-SOIL-EVIDENCE-AUTHORITY.json");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E3_A1_PREWINDOW_A0_SOIL_COLLECTOR_RESULT.json");
const FORMAL_DATABASE_NAME = "geox_mcft_cap09_s6_formal_t3r1_24h_v2";
const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const FORMAL_RAW_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const SOURCE_MATRIX_REF = "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1";
const PREWINDOW_A0 = "2026-08-17T19:00:00.000Z";
const WINDOW_START = "2026-08-17T18:00:00.000Z";
const HARD_STOP = "2026-08-17T18:58:00.000Z";
const DATASET_ID = "mcft_cap09_formal_v2_prewindow_a0_soil_20260817t190000z";
const MINUTE_MS = 60_000;

type AmendmentAuthority = {
  schema_version: string;
  activation_gate: {
    amendment_effective_if_present_on_protected_main: boolean;
    prewindow_a0_soil_collector_enabled_after_effectiveness: boolean;
  };
  prewindow_a0_evidence_contract: {
    logical_time: string;
    window_start_exclusive: string;
    window_end_inclusive: string;
    required_record_type: string;
  };
};

type PhaseResult = {
  status: "NOT_DUE" | "ALREADY_COMPLETE" | "INSERTED";
  logical_time: string;
  dataset_id: string;
  provider_request_count: number;
  canonical_fact_write_count: number;
  raw_values_emitted: false;
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

function loadAuthority(): AmendmentAuthority {
  const value = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8")) as AmendmentAuthority;
  if (value.schema_version !== "geox_mcft_cap09_ea5e3_amendment_01_prewindow_a0_soil_evidence_authority_v1") throw new Error("EA5E3_A1_AUTHORITY_SCHEMA_REQUIRED");
  if (value.activation_gate?.amendment_effective_if_present_on_protected_main !== true || value.activation_gate?.prewindow_a0_soil_collector_enabled_after_effectiveness !== true) throw new Error("EA5E3_A1_COLLECTOR_NOT_AUTHORIZED");
  const contract = value.prewindow_a0_evidence_contract;
  if (contract?.logical_time !== PREWINDOW_A0 || contract?.window_start_exclusive !== WINDOW_START || contract?.window_end_inclusive !== PREWINDOW_A0 || contract?.required_record_type !== "soil_moisture_observation_v1") throw new Error("EA5E3_A1_A0_EVIDENCE_CONTRACT_DRIFT");
  return value;
}

function assertExactProtectedMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("EA5E3_A1_SUBJECT_SHA_INVALID");
  if (!["schedule", "workflow_dispatch", "push"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("EA5E3_A1_EXACT_PROTECTED_MAIN_REQUIRED");
}

async function assertFormalDatabase(pool: Pool, databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("EA5E3_A1_REMOTE_FORMAL_DATABASE_REQUIRED");
  if (parsed.pathname.replace(/^\//, "") !== FORMAL_DATABASE_NAME) throw new Error("EA5E3_A1_FORMAL_DATABASE_URL_REQUIRED");
  const row = (await pool.query("SELECT current_database() AS database_name")).rows[0];
  if (String(row?.database_name ?? "") !== FORMAL_DATABASE_NAME) throw new Error("EA5E3_A1_FORMAL_DATABASE_SESSION_REQUIRED");
}

async function datasetCount(pool: Pool): Promise<number> {
  const row = (await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1' AND record_json->'payload'->>'dataset_id'=$1",
    [DATASET_ID],
  )).rows[0];
  return Number(row?.n ?? 0);
}

function assertFormalRetention(result: CanonicalizedExternalEvidenceResultV1): void {
  const expected = `s3-private://${FORMAL_RAW_BUCKET}/${FORMAL_RAW_PREFIX}/`;
  if (!result.raw_provenance.retention_ref.startsWith(expected)) throw new Error("EA5E3_A1_FORMAL_RAW_RETENTION_REQUIRED");
}

function isUsableA0Soil(result: CanonicalizedExternalEvidenceResultV1): boolean {
  if (result.record.record_type !== "soil_moisture_observation_v1") return false;
  const observedAt = canonicalIso(String(result.record.role_time.observed_at ?? ""), "EA5E3_A1_OBSERVED_AT_INVALID");
  const availableAt = canonicalIso(result.record.available_to_runtime_at, "EA5E3_A1_AVAILABLE_AT_INVALID");
  const ingestedAt = canonicalIso(String(result.record.role_time.ingested_at ?? ""), "EA5E3_A1_INGESTED_AT_INVALID");
  return Date.parse(observedAt) > Date.parse(WINDOW_START)
    && Date.parse(observedAt) <= Date.parse(PREWINDOW_A0)
    && Date.parse(availableAt) <= Date.parse(PREWINDOW_A0)
    && Date.parse(ingestedAt) <= Date.parse(PREWINDOW_A0)
    && result.record.quality.status !== "FAIL";
}

class OneShotSoilTransport implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5E3_A1_PREFETCH_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) throw new Error("EA5E3_A1_PREFETCH_IDENTITY_MISMATCH");
    return this.prefetched.response;
  }
}

async function collectOneCandidate(retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1): Promise<CanonicalizedExternalEvidenceResultV1> {
  const prefetched = await prefetchLiveKbsVariate25RawV1();
  const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
    dataset_id: DATASET_ID,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: {
      ...prefetched.request,
      request_id: `ea5e3-a1-a0-soil-${crypto.randomUUID()}`,
      use_policy_ref: SOURCE_MATRIX_REF,
      limitations: ["PREWINDOW_A0_EVIDENCE_ONLY", "NO_RUNTIME_PROVIDER_FETCH", "NO_TIMESTAMP_RELABEL"],
    },
  }, {
    transport: new OneShotSoilTransport({ ...prefetched, request: { ...prefetched.request, request_id: `ea5e3-a1-a0-soil-${crypto.randomUUID()}` } }),
    retention,
    decoder: new KbsVariate25SoilEvidenceDecoderV1(),
  });
  if (results.length !== 1) throw new Error(`EA5E3_A1_EXACT_ONE_SOIL_RESULT_REQUIRED:${results.length}`);
  assertFormalRetention(results[0]);
  return results[0];
}

async function appendSoil(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, result: CanonicalizedExternalEvidenceResultV1): Promise<number> {
  const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, retention);
  return (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
}

async function runCycle(pool: Pool, retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1, now: string): Promise<PhaseResult> {
  const existing = await datasetCount(pool);
  if (![0, 1].includes(existing)) throw new Error(`EA5E3_A1_DATASET_CARDINALITY_FAIL_CLOSED:${existing}`);
  if (existing === 1) return { status: "ALREADY_COMPLETE", logical_time: PREWINDOW_A0, dataset_id: DATASET_ID, provider_request_count: 0, canonical_fact_write_count: 0, raw_values_emitted: false };

  const nowMs = Date.parse(now);
  if (nowMs < Date.parse(WINDOW_START)) return { status: "NOT_DUE", logical_time: PREWINDOW_A0, dataset_id: DATASET_ID, provider_request_count: 0, canonical_fact_write_count: 0, raw_values_emitted: false };
  if (nowMs >= Date.parse(PREWINDOW_A0)) throw new Error("EA5E3_A1_PREWINDOW_A0_SOIL_DEADLINE_MISSED_FAIL_CLOSED");

  let providerRequests = 0;
  while (Date.now() < Date.parse(HARD_STOP)) {
    providerRequests += 1;
    const result = await collectOneCandidate(retention);
    if (isUsableA0Soil(result)) {
      const writes = await appendSoil(pool, retention, result);
      if (writes !== 1) throw new Error(`EA5E3_A1_NEW_SOIL_WRITE_REQUIRED:${writes}`);
      return { status: "INSERTED", logical_time: PREWINDOW_A0, dataset_id: DATASET_ID, provider_request_count: providerRequests, canonical_fact_write_count: writes, raw_values_emitted: false };
    }
    if (Date.now() + MINUTE_MS >= Date.parse(HARD_STOP)) break;
    await new Promise((resolve) => setTimeout(resolve, MINUTE_MS));
  }
  throw new Error("EA5E3_A1_NO_USABLE_SOIL_OBSERVATION_IN_PREWINDOW_A0_WINDOW_FAIL_CLOSED");
}

function selftest(): void {
  if (Date.parse(PREWINDOW_A0) - Date.parse(WINDOW_START) !== 3_600_000) throw new Error("EA5E3_A1_SELFTEST_EXACT_PT1H_WINDOW_REQUIRED");
  if (Date.parse(HARD_STOP) >= Date.parse(PREWINDOW_A0)) throw new Error("EA5E3_A1_SELFTEST_HARD_STOP_BEFORE_A0_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    logical_time: PREWINDOW_A0,
    window_start_exclusive: WINDOW_START,
    window_end_inclusive: PREWINDOW_A0,
    required_record_type: "soil_moisture_observation_v1",
    formal_database_name: FORMAL_DATABASE_NAME,
    formal_raw_prefix: FORMAL_RAW_PREFIX,
    provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    fixed_lag_normative_authority: false,
    source_substitution_authorized: false,
    interpolation_authorized: false,
    persistence_fill_authorized: false,
    timestamp_relabel_authorized: false,
    provider_request_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
  }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") return selftest();
  if (process.argv[2] !== "cycle") throw new Error("EA5E3_A1_MODE_REQUIRED");
  loadAuthority();
  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  assertExactProtectedMain(subject);
  const databaseUrl = required("DATABASE_URL");
  if (required("MCFT_CAP09_FORMAL_S3_BUCKET") !== FORMAL_RAW_BUCKET) throw new Error("EA5E3_A1_FORMAL_RAW_BUCKET_REQUIRED");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-ea5e3-a1-prewindow-a0-soil" });
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
    const phase = await runCycle(pool, retention, cycleStartedAt);
    const result = {
      schema_version: "geox_mcft_cap09_ea5e3_a1_prewindow_a0_soil_collector_result_v1",
      status: "PASS",
      subject_sha: subject,
      cycle_started_at: cycleStartedAt,
      cycle_completed_at: new Date().toISOString(),
      formal_database_name: FORMAL_DATABASE_NAME,
      formal_raw_prefix: FORMAL_RAW_PREFIX,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      prewindow_a0_soil: phase,
      formal_evidence_fact_write_count: phase.canonical_fact_write_count,
      runtime_provider_request_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      runtime_config_write_count: 0,
      prewindow_a0_state_write_count: 0,
      formal_o00_started: false,
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
