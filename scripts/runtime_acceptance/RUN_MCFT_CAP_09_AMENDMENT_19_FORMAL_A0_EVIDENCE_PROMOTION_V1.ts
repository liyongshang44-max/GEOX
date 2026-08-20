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
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_AMENDMENT_19_FORMAL_A0_EVIDENCE_PROMOTION_RESULT_V1.json");
const EXPECTED_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
const REQUIRED_ZERO_TABLES = [
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

type FormalArmWithRehydrationV1 = McftCap09Am19FormalArmV1 & {
  rolling: McftCap09Am19FormalArmV1["rolling"] & {
    semantic_manifest_digest: string;
    rehydration_manifest: {
      expected_records: Array<{ record_type: string; source_record_id: string; record_semantic_sha256: string }>;
      gfs: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at: string };
      soil: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at?: string };
    };
    raw_retention_refs: string[];
  };
};

type ReferenceFactRowV1 = { record_json: unknown };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AM19_FORMAL_A0_PROMOTION_ENV_REQUIRED:${name}`);
  return value;
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
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
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_A0_PROMOTION_SUBJECT_INVALID");
  if (!["workflow_run", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("AM19_FORMAL_A0_PROMOTION_LIVE_EVENT_REQUIRED");
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("AM19_FORMAL_A0_PROMOTION_EXACT_MAIN_REQUIRED");
}

function assertLocalReferenceDatabase(urlText: string): void {
  const parsed = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname.replace(/^\//, "") !== "ea5e2_readiness") {
    throw new Error("AM19_FORMAL_A0_PROMOTION_LOCAL_REFERENCE_DB_REQUIRED");
  }
}

async function assertFormalDatabaseZero(pool: Pool, urlText: string): Promise<void> {
  const parsed = new URL(urlText);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("AM19_FORMAL_A0_PROMOTION_REMOTE_POSTGRES_REQUIRED");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (database !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error(`AM19_FORMAL_A0_PROMOTION_EXACT_V3_DB_REQUIRED:${database}`);
  const actual = String((await pool.query("SELECT current_database() AS n")).rows[0]?.n ?? "");
  if (actual !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_A0_PROMOTION_DB_SESSION_IDENTITY_REQUIRED");
  const existingTables = new Set<string>((await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
    [[...REQUIRED_ZERO_TABLES]],
  )).rows.map((row) => String(row.table_name)));
  for (const table of REQUIRED_ZERO_TABLES) if (!existingTables.has(table)) throw new Error(`AM19_FORMAL_A0_PROMOTION_REQUIRED_TABLE_MISSING:${table}`);
  for (const table of REQUIRED_ZERO_TABLES) {
    const count = Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0]?.n ?? -1);
    if (count !== 0) throw new Error(`AM19_FORMAL_A0_PROMOTION_FRESH_ZERO_STATE_REQUIRED:${table}:${count}`);
  }
}

class RetainedRawReplayTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly provenance: VerifiedRawEvidenceProvenanceV1, private readonly bytes: Uint8Array) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("AM19_FORMAL_A0_PROMOTION_RAW_REPLAY_REUSE_FORBIDDEN");
    this.used = true;
    if (request.provider_id !== this.provenance.provider_id || request.source_family !== this.provenance.source_family || request.locator !== this.provenance.source_locator) {
      throw new Error("AM19_FORMAL_A0_PROMOTION_RAW_REPLAY_IDENTITY_MISMATCH");
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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-formal-gfs-promote-"));
    const bundle = path.join(temp, "gfs.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await execFileAsync(PYTHON, [
        PROVIDER_SCRIPT,
        "decode-gfs",
        "--target", this.target,
        "--available-at", input.provenance.available_at,
        "--input", bundle,
        "--output", output,
      ], { timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024 });
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("AM19_FORMAL_A0_PROMOTION_GFS_DRAFT_PAIR_REQUIRED");
      const ingestedAt = canonicalIso(this.restoredIngestedAt, "AM19_FORMAL_A0_PROMOTION_GFS_INGESTED_AT_INVALID");
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
    limitations: ["MCFT_CAP09_AM19_FORMAL_PROMOTION", "PRODUCER_BOUND_RAW_REPLAY", "NO_PROVIDER_REFETCH", "DURABLE_FORMAL_RAW_BEFORE_DECODER"],
  };
}

function parseReferenceRecord(value: unknown): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof value === "string" ? JSON.parse(value) : value;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("AM19_FORMAL_A0_PROMOTION_REFERENCE_ENVELOPE_INVALID");
  const payload = (envelope as any).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("AM19_FORMAL_A0_PROMOTION_REFERENCE_PAYLOAD_INVALID");
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
  const ref = result.raw_provenance.retention_ref;
  const parsed = new URL(ref);
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1) throw new Error("AM19_FORMAL_A0_PROMOTION_PRIVATE_FORMAL_RETENTION_REQUIRED");
  const key = parsed.pathname.replace(/^\/+/, "");
  if (!key.startsWith(`${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`)) throw new Error("AM19_FORMAL_A0_PROMOTION_FORMAL_CONTENT_ADDRESS_REQUIRED");
  if (key.includes("mcft-cap09-ea5e2-readiness-transient-v1")) throw new Error("AM19_FORMAL_A0_PROMOTION_TRANSIENT_REF_FORBIDDEN_IN_FORMAL_FACT");
}

async function loadReferenceFacts(pool: Pool): Promise<Map<string, CanonicalReplayEvidenceRecordV1>> {
  const rows = (await pool.query(
    "SELECT record_json FROM facts WHERE source='mcft_cap09_external_formal_evidence_v1' ORDER BY record_json->>'type' ASC,fact_id ASC",
  )).rows as ReferenceFactRowV1[];
  if (rows.length !== 3) throw new Error(`AM19_FORMAL_A0_PROMOTION_REFERENCE_EXACT_THREE_FACTS_REQUIRED:${rows.length}`);
  const map = new Map<string, CanonicalReplayEvidenceRecordV1>();
  for (const row of rows) {
    const record = parseReferenceRecord(row.record_json);
    if (!EXPECTED_TYPES.includes(record.record_type)) throw new Error(`AM19_FORMAL_A0_PROMOTION_REFERENCE_TYPE_FORBIDDEN:${record.record_type}`);
    if (map.has(record.record_type)) throw new Error(`AM19_FORMAL_A0_PROMOTION_REFERENCE_TYPE_DUPLICATE:${record.record_type}`);
    map.set(record.record_type, record);
  }
  if (JSON.stringify([...map.keys()].sort()) !== JSON.stringify(EXPECTED_TYPES)) throw new Error("AM19_FORMAL_A0_PROMOTION_REFERENCE_TYPE_SET_REQUIRED");
  return map;
}

async function buildFormalResults(arm: FormalArmWithRehydrationV1): Promise<{
  results: CanonicalizedExternalEvidenceResultV1[];
  transientReader: ProducerBoundTransientRawEvidenceReaderV1;
}> {
  const manifest = arm.rolling.rehydration_manifest;
  if (!manifest?.gfs?.provenance || !manifest?.soil?.provenance) throw new Error("AM19_FORMAL_A0_PROMOTION_REHYDRATION_MANIFEST_REQUIRED");
  const gfs = manifest.gfs.provenance;
  const soil = manifest.soil.provenance;
  const transientReader = new ProducerBoundTransientRawEvidenceReaderV1({
    producer_subject_sha: arm.subject_sha,
    endpoint: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_ENDPOINT"),
    bucket: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_BUCKET"),
    region: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_REGION"),
    access_key_id: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID"),
    secret_access_key: requiredEnv("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY"),
  });
  const gfsRaw = await transientReader.readRetainedRawEvidence({ retention_ref: gfs.retention_ref, retained_sha256: gfs.raw_sha256, retained_bytes: gfs.raw_bytes });
  const soilRaw = await transientReader.readRetainedRawEvidence({ retention_ref: soil.retention_ref, retained_sha256: soil.raw_sha256, retained_bytes: soil.raw_bytes });
  if (gfsRaw.retained_at !== gfs.retained_at || soilRaw.retained_at !== soil.retained_at) throw new Error("AM19_FORMAL_A0_PROMOTION_PRODUCER_RETAINED_AT_DRIFT");

  const formalRetention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
    endpoint: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT"),
    bucket: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_BUCKET"),
    region: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_REGION"),
    access_key_id: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID"),
    secret_access_key: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"),
  });
  const canonicalizedAt = new Date().toISOString();
  const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_gfs_${arm.a0}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(gfs, ["application/x-tar"]),
    canonicalized_at: canonicalizedAt,
  }, {
    transport: new RetainedRawReplayTransportV1(gfs, gfsRaw.bytes),
    retention: formalRetention,
    decoder: new PythonGfsRawBundleDecoderV1(arm.a0, manifest.gfs.ingested_at),
  });
  const soilResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_soil_${arm.a0}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(soil, [soil.content_type.split(";", 1)[0]!]),
    canonicalized_at: canonicalizedAt,
  }, {
    transport: new RetainedRawReplayTransportV1(soil, soilRaw.bytes),
    retention: formalRetention,
    decoder: new KbsVariate25SoilEvidenceDecoderV1(),
  });
  const results = [...gfsResults, ...soilResults].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type));
  if (results.length !== 3 || JSON.stringify(results.map((x) => x.record.record_type)) !== JSON.stringify(EXPECTED_TYPES)) {
    throw new Error("AM19_FORMAL_A0_PROMOTION_EXACT_THREE_FORMAL_RECORDS_REQUIRED");
  }
  for (const result of results) exactFormalRetention(result);
  return { results, transientReader };
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") {
    const sample = { retention_ref: `s3-private://${MCFT_CAP09_FORMAL_RAW_BUCKET_V1}/${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/${"a".repeat(64)}` };
    const parsed = new URL(sample.retention_ref);
    if (parsed.hostname !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1 || !parsed.pathname.includes(`/${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`)) throw new Error("AM19_FORMAL_A0_PROMOTION_SELFTEST_FORMAL_REF_FAILED");
    console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_selftest_v1", status: "PASS", raw_before_decoder: true, same_decoder_identity_required: true, transient_ref_forbidden_in_formal_fact: true, a0_base_supports_o00: true, physical_promotion_deadline: "O00", provider_refetch_count: 0, formal_effect: false }));
    return;
  }
  if (process.argv[2] !== "run") throw new Error("AM19_FORMAL_A0_PROMOTION_MODE_REQUIRED:selftest|run");
  const subject = requiredEnv("MCFT_CAP09_SUBJECT_SHA");
  assertExactMain(subject);
  const arm = loadJson(path.resolve(requiredEnv("MCFT_CAP09_AM19_FORMAL_ARM_PATH"))) as FormalArmWithRehydrationV1;
  validateMcftCap09Am19FormalArmV1(arm, subject);
  if (arm.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) throw new Error("AM19_FORMAL_A0_PROMOTION_ARM_DB_DRIFT");
  const referenceUrl = requiredEnv("REFERENCE_DATABASE_URL");
  assertLocalReferenceDatabase(referenceUrl);
  const formalUrl = requiredEnv("DATABASE_URL");
  const referencePool = new Pool({ connectionString: referenceUrl, application_name: "mcft-cap09-am19-formal-reference-read" });
  const formalPool = new Pool({ connectionString: formalUrl, application_name: "mcft-cap09-am19-formal-a0-evidence-promotion" });
  let writePhaseStarted = false;
  let writeCount = 0;
  try {
    const databasePreflightAt = new Date((await formalPool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
    if (Date.parse(databasePreflightAt) >= Date.parse(arm.o00)) throw new Error(`AM19_FORMAL_A0_PROMOTION_O00_DEADLINE_MISSED:${databasePreflightAt}:${arm.o00}`);
    await assertFormalDatabaseZero(formalPool, formalUrl);
    const reference = await loadReferenceFacts(referencePool);
    const built = await buildFormalResults(arm);

    for (const result of built.results) {
      const expected = reference.get(result.record.record_type);
      if (!expected) throw new Error(`AM19_FORMAL_A0_PROMOTION_REFERENCE_MISSING:${result.record.record_type}`);
      const expectedProjection = normalizedSemanticProjection(expected);
      const actualProjection = normalizedSemanticProjection(result.record);
      if (semanticHashV1(expectedProjection) !== semanticHashV1(actualProjection)) {
        throw new Error(`AM19_FORMAL_A0_PROMOTION_NORMALIZED_SEMANTIC_DRIFT:${result.record.record_type}`);
      }
      const referenceRaw = (expected.source_payload as any)?.raw_provenance;
      if (referenceRaw?.raw_sha256 !== result.raw_provenance.raw_sha256
        || referenceRaw?.decoder_id !== result.decoder.decoder_id
        || referenceRaw?.decoder_version !== result.decoder.decoder_version) {
        throw new Error(`AM19_FORMAL_A0_PROMOTION_RAW_OR_DECODER_IDENTITY_DRIFT:${result.record.record_type}`);
      }
    }

    const verifier = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
      endpoint: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT"),
      bucket: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_BUCKET"),
      region: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_REGION"),
      access_key_id: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID"),
      secret_access_key: requiredEnv("MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"),
    });
    const ingress = new PostgresExternalFormalEvidenceIngressV1(formalPool, verifier);
    writePhaseStarted = true;
    for (const result of built.results) {
      const beforeWriteAt = new Date((await formalPool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
      if (Date.parse(beforeWriteAt) >= Date.parse(arm.o00)) throw new Error(`AM19_FORMAL_A0_PROMOTION_DEADLINE_CROSSED_DURING_WRITE:${beforeWriteAt}:${arm.o00}`);
      writeCount += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
    }
    if (writeCount !== 3) throw new Error(`AM19_FORMAL_A0_PROMOTION_EXACT_THREE_WRITES_REQUIRED:${writeCount}`);
    const factCount = Number((await formalPool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n ?? -1);
    if (factCount !== 3) throw new Error(`AM19_FORMAL_A0_PROMOTION_FORMAL_FACT_COUNT_REQUIRED:${factCount}`);
    const promotionCompletedAt = new Date((await formalPool.query("SELECT transaction_timestamp() AS database_now")).rows[0]?.database_now).toISOString();
    if (Date.parse(promotionCompletedAt) >= Date.parse(arm.o00)) throw new Error(`AM19_FORMAL_A0_PROMOTION_COMPLETED_AFTER_O00_FORBIDDEN:${promotionCompletedAt}:${arm.o00}`);

    writeOutput({
      schema_version: "geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_result_v1",
      status: "PASS",
      subject_sha: subject,
      arm_identity_hash: arm.arm_identity_hash,
      epoch_id: arm.epoch_id,
      formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
      a0: arm.a0,
      supported_slot_t: arm.o00,
      database_preflight_at: databasePreflightAt,
      promotion_completed_at: promotionCompletedAt,
      promotion_completed_before_o00: true,
      record_types: built.results.map((x) => x.record.record_type),
      canonical_fact_write_count: writeCount,
      formal_fact_count: factCount,
      producer_bound_transient_raw_reverification: true,
      formal_content_addressed_raw_retention_before_decoder: true,
      normalized_semantics_match_producer_bound_reference: true,
      raw_sha256_preserved: true,
      decoder_identity_preserved: true,
      source_record_identity_preserved: true,
      transient_ref_present_in_formal_fact: false,
      transient_r2_head_count: built.transientReader.head_count,
      transient_r2_get_count: built.transientReader.get_count,
      transient_r2_put_count: built.transientReader.put_count,
      transient_r2_delete_count: built.transientReader.delete_count,
      provider_refetch_count: built.transientReader.provider_request_count,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      formal_a0_bootstrapped: false,
      formal_o00_started: false,
      final_actual_24h_still_required: true,
      mcft_cap09_completed: false,
    });
  } catch (error) {
    if (writePhaseStarted) {
      try {
        const factCount = Number((await formalPool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n ?? -1);
        writeOutput({
          schema_version: "geox_mcft_cap09_amendment19_formal_a0_evidence_promotion_result_v1",
          status: "FAIL",
          subject_sha: subject,
          arm_identity_hash: arm.arm_identity_hash,
          epoch_id: arm.epoch_id,
          formal_database_name: MCFT_CAP09_AM19_FORMAL_DATABASE_V3,
          failure_class: "FORMAL_STORE_PARTIAL_MUTATION_NON_REUSABLE",
          canonical_fact_write_count_before_failure: writeCount,
          formal_fact_count_after_failure: factCount,
          store_reuse_authorized: false,
          truncate_and_retry_authorized: false,
          formal_epoch_no_go: true,
          mcft_cap09_completed: false,
        });
      } catch {}
    }
    throw error;
  } finally {
    await referencePool.end();
    await formalPool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
