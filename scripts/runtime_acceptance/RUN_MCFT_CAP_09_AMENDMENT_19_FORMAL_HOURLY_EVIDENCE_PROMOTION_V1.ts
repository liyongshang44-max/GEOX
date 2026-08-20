import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
  type VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  ProducerBoundTransientRawEvidenceReaderV1,
  MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
} from "../../apps/server/src/external_evidence/producer_bound_transient_raw_evidence_reader_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { KbsVariate25SoilEvidenceDecoderV1 } from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
  validateMcftCap09Am19FormalArmV1,
  type McftCap09Am19FormalArmV1,
} from "./mcft_cap09_amendment19_formal_manifest_from_arm_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_HOURLY_EVIDENCE_PROMOTION_RESULT_V1.json");
const EXPECTED_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
const EVIDENCE_SOURCE = "mcft_cap09_external_formal_evidence_v1";

type RollingCandidateV1 = {
  schema_version: "geox_mcft_cap09_rolling_preboundary_candidate_v1";
  status: "PASS";
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1";
  producer_subject_sha: string;
  subject_sha: string;
  target_t: string;
  captured_at: string;
  candidate_expires_at: string;
  record_types: string[];
  semantic_manifest_digest: string;
  causal_contract: Record<string, boolean>;
  side_effects: Record<string, number | boolean>;
  rehydration_manifest: {
    expected_records: Array<{ record_type: string; source_record_id: string; record_semantic_sha256: string }>;
    gfs: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at: string };
    soil: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at?: string };
  };
};

type A0BootstrapResultV1 = {
  schema_version: "geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1";
  status: "PASS";
  subject_sha: string;
  arm_identity_hash: string;
  epoch_id: string;
  manifest_hash: string;
  formal_database_name: string;
  a0: string;
  o00: string;
  o23: string;
  formal_a0_bootstrapped: true;
  formal_o00_started: false;
  final_actual_24h_still_required: true;
  mcft_cap09_completed: false;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: unknown, code: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHour(value: unknown, code: string): string {
  const text = canonicalIso(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeOutput(value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function assertExactMain(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_SUBJECT_INVALID");
  if (!["workflow_run", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_LIVE_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_EXACT_MAIN_REQUIRED");
}

function assertLocalReferenceDatabase(urlText: string): void {
  const parsed = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname.replace(/^\//, "") !== "ea5e2_readiness") {
    throw new Error("AM19_FORMAL_HOURLY_PROMOTION_LOCAL_REFERENCE_DB_REQUIRED");
  }
}

async function assertFormalDatabase(pool: Pool, urlText: string, target: string): Promise<string> {
  const parsed = new URL(urlText);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_REMOTE_POSTGRES_REQUIRED");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_EXACT_V3_DB_REQUIRED:${database}`);
  const identity = String((await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
  if (identity !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_DB_SESSION_IDENTITY_REQUIRED");
  const now = new Date((await pool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
  if (Date.parse(now) >= Date.parse(target)) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_PREBOUNDARY_DEADLINE_MISSED:${now}:${target}`);
  return now;
}

class RetainedRawReplayTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly provenance: VerifiedRawEvidenceProvenanceV1, private readonly bytes: Uint8Array) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_RAW_REPLAY_REUSE_FORBIDDEN");
    this.used = true;
    if (request.provider_id !== this.provenance.provider_id || request.source_family !== this.provenance.source_family || request.locator !== this.provenance.source_locator) {
      throw new Error("AM19_FORMAL_HOURLY_PROMOTION_RAW_REPLAY_IDENTITY_MISMATCH");
    }
    return {
      status: 200,
      final_locator: this.provenance.final_locator,
      content_type: this.provenance.content_type,
      retrieved_at: this.provenance.retrieved_at,
      available_at: this.provenance.available_at,
      bytes: this.bytes,
    };
  }
}

class PythonGfsRawBundleDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string, private readonly restoredIngestedAt: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-formal-hourly-gfs-"));
    const bundle = path.join(temp, "gfs.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await execFileAsync(PYTHON, [PROVIDER_SCRIPT, "decode-gfs", "--target", this.target, "--available-at", input.provenance.available_at, "--input", bundle, "--output", output], { timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024 });
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_GFS_DRAFT_PAIR_REQUIRED");
      const ingestedAt = canonicalIso(this.restoredIngestedAt, "AM19_FORMAL_HOURLY_PROMOTION_GFS_INGESTED_AT_INVALID");
      return parsed.drafts.map((draft) => ({ ...draft, role_time: { ...draft.role_time, ingested_at: ingestedAt } }));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

function requestFromProvenance(provenance: VerifiedRawEvidenceProvenanceV1, contentPrefixes: readonly string[]): ExternalEvidenceFetchRequestV1 {
  const sourceHost = new URL(provenance.source_locator).hostname;
  const finalHost = new URL(provenance.final_locator).hostname;
  return {
    request_id: provenance.request_id,
    provider_id: provenance.provider_id,
    source_family: provenance.source_family,
    locator: provenance.source_locator,
    allowed_final_hosts: [...new Set([sourceHost, finalHost])],
    use_policy_ref: provenance.use_policy_ref,
    requested_at: provenance.retrieved_at,
    ...(provenance.source_issue_time ? { source_issue_time: provenance.source_issue_time } : {}),
    ...(provenance.source_event_time ? { source_event_time: provenance.source_event_time } : {}),
    expected_content_type_prefixes: [...contentPrefixes],
    limitations: ["MCFT_CAP09_AM19_FORMAL_HOURLY_PROMOTION", "PRODUCER_BOUND_RAW_REPLAY", "NO_PROVIDER_REFETCH", "DURABLE_FORMAL_RAW_BEFORE_DECODER"],
  };
}

function parseReferenceRecord(value: unknown): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof value === "string" ? JSON.parse(value) : value;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_REFERENCE_ENVELOPE_INVALID");
  const payload = (envelope as any).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_REFERENCE_PAYLOAD_INVALID");
  return payload as CanonicalReplayEvidenceRecordV1;
}

function normalizedSemanticProjection(record: CanonicalReplayEvidenceRecordV1): Record<string, unknown> {
  const sourcePayload = structuredClone(record.source_payload as Record<string, unknown>);
  delete (sourcePayload as any).raw_provenance;
  const quality = structuredClone(record.quality as Record<string, unknown>);
  delete (quality as any).raw_retention_ref;
  return {
    dataset_id: record.dataset_id,
    source_record_id: record.source_record_id,
    record_type: record.record_type,
    binding_id: record.binding_id,
    origin_source_kind: record.origin_source_kind,
    origin_source_id: record.origin_source_id,
    epistemic_class: record.epistemic_class,
    available_to_runtime_at: record.available_to_runtime_at,
    role_time: record.role_time,
    quality,
    source_payload: sourcePayload,
    canonical_payload: record.canonical_payload,
    source_unit: record.source_unit,
    canonical_unit: record.canonical_unit,
    conversion_rule: record.conversion_rule,
    execution_metadata: record.execution_metadata,
  };
}

function exactFormalRetention(result: CanonicalizedExternalEvidenceResultV1): void {
  const parsed = new URL(result.raw_provenance.retention_ref);
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_PRIVATE_FORMAL_RETENTION_REQUIRED");
  const key = parsed.pathname.replace(/^\/+/, "");
  if (!key.startsWith(`${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CONTENT_ADDRESS_REQUIRED");
  if (key.includes("mcft-cap09-ea5e2-readiness-transient-v1")) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_TRANSIENT_REF_FORBIDDEN");
}

function validateArmAndCandidate(arm: McftCap09Am19FormalArmV1, bootstrap: A0BootstrapResultV1, candidate: RollingCandidateV1, subject: string): string {
  validateMcftCap09Am19FormalArmV1(arm, subject);
  if (bootstrap?.schema_version !== "geox_mcft_cap09_amendment19_formal_a0_bootstrap_result_v1" || bootstrap.status !== "PASS") throw new Error("AM19_FORMAL_HOURLY_PROMOTION_BOOTSTRAP_PASS_REQUIRED");
  if (bootstrap.subject_sha !== subject || bootstrap.arm_identity_hash !== arm.arm_identity_hash || bootstrap.epoch_id !== arm.epoch_id || bootstrap.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3 || bootstrap.a0 !== arm.a0 || bootstrap.o00 !== arm.o00 || bootstrap.o23 !== arm.o23 || bootstrap.formal_a0_bootstrapped !== true || bootstrap.formal_o00_started !== false || bootstrap.final_actual_24h_still_required !== true || bootstrap.mcft_cap09_completed !== false) {
    throw new Error("AM19_FORMAL_HOURLY_PROMOTION_BOOTSTRAP_IDENTITY_REQUIRED");
  }
  if (candidate?.schema_version !== "geox_mcft_cap09_rolling_preboundary_candidate_v1" || candidate.status !== "PASS" || candidate.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CANDIDATE_PASS_REQUIRED");
  if (candidate.producer_subject_sha !== subject || candidate.subject_sha !== subject) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CANDIDATE_SUBJECT_REQUIRED");
  if (JSON.stringify([...candidate.record_types].sort()) !== JSON.stringify(EXPECTED_TYPES)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_EXACT_THREE_TYPES_REQUIRED");
  const target = canonicalHour(candidate.target_t, "AM19_FORMAL_HOURLY_PROMOTION_TARGET_INVALID");
  if (Date.parse(target) < Date.parse(arm.o00) || Date.parse(target) > Date.parse(arm.o23)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_TARGET_OUTSIDE_ARM_WINDOW");
  const capturedAt = canonicalIso(candidate.captured_at, "AM19_FORMAL_HOURLY_PROMOTION_CAPTURED_AT_INVALID");
  if (Date.parse(capturedAt) > Date.parse(target)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CAPTURE_AFTER_TARGET_FORBIDDEN");
  if (candidate.causal_contract?.soil_observation_inside_t_minus_15_to_t !== true || candidate.causal_contract?.future_weather_available_and_ingested_by_t !== true || candidate.causal_contract?.future_et0_available_and_ingested_by_t !== true || candidate.causal_contract?.same_cycle_future_weather_et0 !== true || candidate.causal_contract?.no_future_leakage !== true || candidate.causal_contract?.raw_retained_before_canonicalization !== true) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CAUSAL_CONTRACT_REQUIRED");
  if (Number(candidate.side_effects?.formal_database_write_count) !== 0 || Number(candidate.side_effects?.formal_r2_prefix_write_count) !== 0 || Number(candidate.side_effects?.scheduler_write_count) !== 0 || Number(candidate.side_effects?.runtime_write_count) !== 0 || candidate.side_effects?.formal_effect !== false) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_CANDIDATE_ZERO_EFFECT_REQUIRED");
  return target;
}

async function loadReferenceFacts(pool: Pool): Promise<Map<string, CanonicalReplayEvidenceRecordV1>> {
  const rows = (await pool.query("SELECT record_json FROM facts WHERE source=$1 ORDER BY record_json->>'type' ASC,fact_id ASC", [EVIDENCE_SOURCE])).rows;
  if (rows.length !== 3) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_REFERENCE_EXACT_THREE_REQUIRED:${rows.length}`);
  const map = new Map<string, CanonicalReplayEvidenceRecordV1>();
  for (const row of rows) {
    const record = parseReferenceRecord(row.record_json);
    if (!EXPECTED_TYPES.includes(record.record_type) || map.has(record.record_type)) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_REFERENCE_TYPE_INVALID:${record.record_type}`);
    map.set(record.record_type, record);
  }
  return map;
}

async function buildFormalResults(candidate: RollingCandidateV1): Promise<{ results: CanonicalizedExternalEvidenceResultV1[]; reader: ProducerBoundTransientRawEvidenceReaderV1 }> {
  const manifest = candidate.rehydration_manifest;
  if (!manifest?.gfs?.provenance || !manifest?.soil?.provenance) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_REHYDRATION_MANIFEST_REQUIRED");
  const reader = new ProducerBoundTransientRawEvidenceReaderV1({
    producer_subject_sha: candidate.producer_subject_sha,
    endpoint: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_ENDPOINT"),
    bucket: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_BUCKET"),
    region: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_REGION"),
    access_key_id: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID"),
    secret_access_key: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY"),
  });
  const gfs = manifest.gfs.provenance;
  const soil = manifest.soil.provenance;
  const gfsRaw = await reader.readRetainedRawEvidence({ retention_ref: gfs.retention_ref, retained_sha256: gfs.raw_sha256, retained_bytes: gfs.raw_bytes });
  const soilRaw = await reader.readRetainedRawEvidence({ retention_ref: soil.retention_ref, retained_sha256: soil.raw_sha256, retained_bytes: soil.raw_bytes });
  if (gfsRaw.retained_at !== gfs.retained_at || soilRaw.retained_at !== soil.retained_at) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_RETAINED_AT_DRIFT");
  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    endpoint: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT"),
    bucket: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_BUCKET"),
    region: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_REGION"),
    access_key_id: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID"),
    secret_access_key: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"),
  });
  const canonicalizedAt = new Date().toISOString();
  const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_gfs_${candidate.target_t}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(gfs, ["application/x-tar"]),
    canonicalized_at: canonicalizedAt,
  }, { transport: new RetainedRawReplayTransportV1(gfs, gfsRaw.bytes), retention, decoder: new PythonGfsRawBundleDecoderV1(candidate.target_t, manifest.gfs.ingested_at) });
  const soilResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_soil_${candidate.target_t}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(soil, [soil.content_type.split(";", 1)[0]!]),
    canonicalized_at: canonicalizedAt,
  }, { transport: new RetainedRawReplayTransportV1(soil, soilRaw.bytes), retention, decoder: new KbsVariate25SoilEvidenceDecoderV1() });
  const results = [...gfsResults, ...soilResults].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type));
  if (results.length !== 3 || JSON.stringify(results.map((x) => x.record.record_type)) !== JSON.stringify(EXPECTED_TYPES)) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_EXACT_THREE_RESULTS_REQUIRED");
  for (const result of results) exactFormalRetention(result);
  return { results, reader };
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") {
    const o00 = "2026-08-20T06:00:00.000Z";
    const o23 = "2026-08-21T05:00:00.000Z";
    if (Date.parse(o23) - Date.parse(o00) !== 23 * 3_600_000) throw new Error("AM19_FORMAL_HOURLY_PROMOTION_SELFTEST_WINDOW");
    console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_amendment19_formal_hourly_evidence_promotion_selftest_v1", status: "PASS", target_write_must_complete_before_t: true, exact_three_required_families: true, producer_bound_raw_reverification: true, durable_formal_raw_before_decoder: true, provider_refetch_count: 0, late_write_repair_authorized: false, formal_effect: false }));
    return;
  }
  if (process.argv[2] !== "run") throw new Error("AM19_FORMAL_HOURLY_PROMOTION_MODE_REQUIRED:selftest|run");
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactMain(subject);
  const arm = loadJson(path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_ARM_PATH"))) as McftCap09Am19FormalArmV1;
  const bootstrap = loadJson(path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_A0_BOOTSTRAP_RESULT_PATH"))) as A0BootstrapResultV1;
  const candidate = loadJson(path.resolve(requiredEnv("MCFT_CAP09_ROLLING_CANDIDATE_PATH"))) as RollingCandidateV1;
  const target = validateArmAndCandidate(arm, bootstrap, candidate, subject);
  const referenceUrl = requiredEnv("REFERENCE_DATABASE_URL");
  assertLocalReferenceDatabase(referenceUrl);
  const formalUrl = requiredEnv("DATABASE_URL");
  const referencePool = new Pool({ connectionString: referenceUrl, application_name: "mcft-cap09-am19-formal-hourly-reference" });
  const formalPool = new Pool({ connectionString: formalUrl, application_name: "mcft-cap09-am19-formal-hourly-promotion" });
  let writePhaseStarted = false;
  let writeCount = 0;
  try {
    const databaseNow = await assertFormalDatabase(formalPool, formalUrl, target);
    const reference = await loadReferenceFacts(referencePool);
    const built = await buildFormalResults(candidate);
    for (const result of built.results) {
      const expected = reference.get(result.record.record_type);
      if (!expected) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_REFERENCE_MISSING:${result.record.record_type}`);
      if (semanticHashV1(normalizedSemanticProjection(expected)) !== semanticHashV1(normalizedSemanticProjection(result.record))) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_NORMALIZED_SEMANTIC_DRIFT:${result.record.record_type}`);
      const referenceRaw = (expected.source_payload as any)?.raw_provenance;
      if (referenceRaw?.raw_sha256 !== result.raw_provenance.raw_sha256 || referenceRaw?.decoder_id !== result.decoder.decoder_id || referenceRaw?.decoder_version !== result.decoder.decoder_version) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_RAW_OR_DECODER_DRIFT:${result.record.record_type}`);
      const existing = Number((await formalPool.query("SELECT count(*)::int AS n FROM facts WHERE source=$1 AND record_json#>>'{payload,source_record_id}'=$2", [EVIDENCE_SOURCE, result.record.source_record_id])).rows[0]?.n ?? -1);
      if (existing !== 0) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_DUPLICATE_SOURCE_RECORD_FORBIDDEN:${result.record.source_record_id}:${existing}`);
    }
    const terminalAtTarget = Number((await formalPool.query("SELECT count(*)::int AS n FROM twin_terminal_tick_uniqueness_v1 WHERE logical_time=$1::timestamptz", [target])).rows[0]?.n ?? -1);
    if (terminalAtTarget !== 0) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_TARGET_ALREADY_TERMINAL:${target}`);
    const verifier = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
      endpoint: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT"), bucket: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_BUCKET"), region: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_REGION"), access_key_id: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID"), secret_access_key: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"),
    });
    const ingress = new PostgresExternalFormalEvidenceIngressV1(formalPool, verifier);
    writePhaseStarted = true;
    for (const result of built.results) {
      const beforeWriteNow = new Date((await formalPool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
      if (Date.parse(beforeWriteNow) >= Date.parse(target)) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_DEADLINE_CROSSED_DURING_WRITE:${beforeWriteNow}:${target}`);
      writeCount += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
    }
    const completedAt = new Date((await formalPool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
    if (Date.parse(completedAt) >= Date.parse(target)) throw new Error(`AM19_FORMAL_HOURLY_PROMOTION_COMPLETED_AFTER_TARGET_FORBIDDEN:${completedAt}:${target}`);
    writeOutput({
      schema_version: "geox_mcft_cap09_amendment19_formal_hourly_evidence_promotion_result_v1",
      status: "PASS", subject_sha: subject, arm_identity_hash: arm.arm_identity_hash, epoch_id: arm.epoch_id, manifest_hash: bootstrap.manifest_hash,
      formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3, target_t: target, database_preflight_at: databaseNow, promotion_completed_at: completedAt,
      record_types: built.results.map((x) => x.record.record_type), canonical_fact_write_count: writeCount,
      producer_bound_transient_raw_reverification: true, formal_content_addressed_raw_retention_before_decoder: true, normalized_semantics_match_reference: true, raw_sha256_preserved: true, decoder_identity_preserved: true,
      transient_r2_head_count: built.reader.head_count, transient_r2_get_count: built.reader.get_count, transient_r2_put_count: built.reader.put_count, transient_r2_delete_count: built.reader.delete_count, provider_refetch_count: built.reader.provider_request_count,
      scheduler_write_count: 0, runtime_write_count: 0, target_write_completed_before_t: true, late_write_repair_authorized: false, final_actual_24h_still_required: true, mcft_cap09_completed: false,
    });
  } catch (error) {
    if (writePhaseStarted) {
      try {
        writeOutput({ schema_version: "geox_mcft_cap09_amendment19_formal_hourly_evidence_promotion_result_v1", status: "FAIL", subject_sha: subject, arm_identity_hash: arm.arm_identity_hash, epoch_id: arm.epoch_id, formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3, target_t: target, failure_class: "FORMAL_HOURLY_PARTIAL_MUTATION_EPOCH_NO_GO", canonical_fact_write_count_before_failure: writeCount, store_reuse_authorized: false, truncate_and_retry_authorized: false, late_write_repair_authorized: false, formal_epoch_no_go: true, mcft_cap09_completed: false });
      } catch {}
    }
    throw error;
  } finally {
    await referencePool.end();
    await formalPool.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
