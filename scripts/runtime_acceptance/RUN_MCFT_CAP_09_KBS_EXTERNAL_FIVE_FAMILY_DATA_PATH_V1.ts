import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
  type RawEvidenceRetentionInputV1,
  type RawEvidenceRetentionPortV1,
  type RawEvidenceRetentionReceiptV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const DECODER = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_DECODER_V1.py");
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH.json");
const KBS_URL = "https://lter.kbs.msu.edu/datatables/13.csv";
const PRIVATE_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const FORMAL_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const TRANSIENT_PREFIX = "mcft-cap09-kbs-five-family-transient-v1";
const EXPECTED_PRE_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"] as const;
const EXPECTED_FIVE_TYPES = ["future_et0_assumption_v1", "future_weather_assumption_v1", "historical_et0_estimate_v1", "observed_rainfall_v1", "soil_moisture_observation_v1"] as const;

type IntersectionProofV1 = {
  schema_version: string;
  status: string;
  temporal_authority: string;
  provider_publication_cadence: string;
  freshness_is_late_authoritative_admission_gate: boolean;
  selected: null | {
    producer_subject_sha: string;
    producer_workflow_run_id: number;
    artifact_id: number;
    artifact_digest: string;
    target_t: string;
    candidate_expires_at: string;
  };
  database_write_count: number;
  formal_effect: boolean;
  crop_authority_effect: string;
};

type RehydrationProofV1 = {
  schema_version: string;
  status: string;
  temporal_authority: string;
  consumer_subject_sha: string;
  producer_subject_sha: string;
  target_t: string;
  semantic_manifest_match: boolean;
  producer_bound_raw_reverification: boolean;
  provider_refetch_count: number;
  isolated_database_fact_count: number;
  private_r2_put_count: number;
  private_r2_delete_count: number;
  formal_database_write_count: number;
  formal_r2_prefix_write_count: number;
  scheduler_write_count: number;
  runtime_write_count: number;
  crop_authority_effect: string;
  formal_effect: boolean;
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

function exactHour(value: string, code: string): string {
  canonicalIso(value, code);
  if (!value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function sha256Hex(value: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function sha256(value: Buffer | Uint8Array | string): string {
  return `sha256:${sha256Hex(value)}`;
}
function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}
function signingKey(secret: string, date: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function encodedPath(bucket: string, key: string): string {
  return `/${uriEncode(bucket)}/${key.split("/").map(uriEncode).join("/")}`;
}
function amzTimestamp(date: Date): { amz_date: string; short_date: string } {
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz_date: amzDate, short_date: amzDate.slice(0, 8) };
}

type SignedResponseV1 = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

class FiveFamilyTransientR2V1 implements RawEvidenceRetentionPortV1, RawEvidenceRetentionVerificationPortV1 {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly prefix: string;
  private readonly tracked = new Set<string>();
  put_count = 0;
  head_count = 0;
  delete_count = 0;

  constructor(subject: string) {
    this.endpoint = new URL(required("MCFT_EA5E2_TRANSIENT_S3_ENDPOINT"));
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash || this.endpoint.pathname !== "/") throw new Error("MCFT_CAP09_FIVE_FAMILY_REMOTE_HTTPS_ENDPOINT_REQUIRED");
    this.bucket = required("MCFT_EA5E2_TRANSIENT_S3_BUCKET");
    if (this.bucket !== PRIVATE_BUCKET) throw new Error("MCFT_CAP09_FIVE_FAMILY_PRIVATE_BUCKET_BINDING_REQUIRED");
    this.region = required("MCFT_EA5E2_TRANSIENT_S3_REGION");
    this.accessKey = required("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID");
    this.secretKey = required("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY");
    this.prefix = `${TRANSIENT_PREFIX}/${subject}/${required("GITHUB_RUN_ID")}`;
    if (this.prefix.startsWith(FORMAL_PREFIX)) throw new Error("MCFT_CAP09_FIVE_FAMILY_FORMAL_PREFIX_FORBIDDEN");
  }

  private keyForDigest(digest: string): string {
    const match = /^sha256:([0-9a-f]{64})$/.exec(digest);
    if (!match) throw new Error("MCFT_CAP09_FIVE_FAMILY_RAW_SHA256_INVALID");
    return `${this.prefix}/sha256/${match[1]}`;
  }
  private refForKey(key: string): string { return `s3-private://${this.bucket}/${key}`; }
  private keyFromRef(ref: string): string {
    const parsed = new URL(ref);
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.bucket) throw new Error("MCFT_CAP09_FIVE_FAMILY_RETENTION_REF_INVALID");
    const key = parsed.pathname.replace(/^\/+/, "");
    if (!key.startsWith(`${this.prefix}/`) || key.startsWith(FORMAL_PREFIX)) throw new Error("MCFT_CAP09_FIVE_FAMILY_RETENTION_REF_PREFIX_MISMATCH");
    return key;
  }

  private async request(input: { method: "PUT" | "HEAD" | "DELETE"; key: string; body?: Buffer; content_type?: string; metadata?: Record<string, string>; allowed: readonly number[] }): Promise<SignedResponseV1> {
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256Hex(body);
    const { amz_date: amzDate, short_date: shortDate } = amzTimestamp(new Date());
    const requestPath = encodedPath(this.bucket, input.key);
    const headers: Record<string, string> = { host: this.endpoint.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
    if (input.method === "PUT") {
      headers["content-length"] = String(body.byteLength);
      headers["content-type"] = input.content_type || "application/octet-stream";
    }
    for (const [key, value] of Object.entries(input.metadata ?? {})) headers[key.toLowerCase()] = value;
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [input.method, requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const signature = crypto.createHmac("sha256", signingKey(this.secretKey, shortDate, this.region)).update(stringToSign, "utf8").digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await new Promise<SignedResponseV1>((resolve, reject) => {
      const req = https.request({ protocol: "https:", hostname: this.endpoint.hostname, port: this.endpoint.port || undefined, method: input.method, path: requestPath, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.setTimeout(60_000, () => req.destroy(new Error("MCFT_CAP09_FIVE_FAMILY_R2_REQUEST_TIMEOUT")));
      if (input.method === "PUT") req.write(body);
      req.end();
    });
    if (!input.allowed.includes(response.status)) throw new Error(`MCFT_CAP09_FIVE_FAMILY_R2_${input.method}_${response.status}`);
    if (input.method === "PUT") this.put_count += 1;
    if (input.method === "HEAD") this.head_count += 1;
    if (input.method === "DELETE") this.delete_count += 1;
    return response;
  }

  private verifyHead(input: VerifyRetainedRawEvidenceInputV1, key: string, head: SignedResponseV1): string {
    if (head.status !== 200) throw new Error("MCFT_CAP09_FIVE_FAMILY_RAW_NOT_FOUND");
    if (Number(head.headers["content-length"]) !== input.retained_bytes) throw new Error("MCFT_CAP09_FIVE_FAMILY_RETAINED_BYTES_MISMATCH");
    if (String(head.headers["x-amz-meta-geox-sha256"] ?? "") !== input.retained_sha256) throw new Error("MCFT_CAP09_FIVE_FAMILY_RETAINED_SHA_MISMATCH");
    if (String(head.headers["x-amz-meta-geox-retention-class"] ?? "") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("MCFT_CAP09_FIVE_FAMILY_RETAINED_CLASS_MISMATCH");
    if (key !== this.keyForDigest(input.retained_sha256)) throw new Error("MCFT_CAP09_FIVE_FAMILY_RETAINED_KEY_MISMATCH");
    return canonicalIso(String(head.headers["x-amz-meta-geox-retained-at"] ?? ""), "MCFT_CAP09_FIVE_FAMILY_RETAINED_AT_INVALID");
  }

  async retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> {
    const raw = Buffer.from(input.bytes);
    if (input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE" || raw.byteLength <= 0 || raw.byteLength !== input.raw_bytes || sha256(raw) !== input.raw_sha256) throw new Error("MCFT_CAP09_FIVE_FAMILY_RAW_RETENTION_INPUT_INVALID");
    const key = this.keyForDigest(input.raw_sha256);
    const ref = this.refForKey(key);
    const retainedAt = new Date().toISOString();
    await this.request({ method: "PUT", key, body: raw, content_type: input.content_type, metadata: {
      "x-amz-meta-geox-sha256": input.raw_sha256,
      "x-amz-meta-geox-retention-class": "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      "x-amz-meta-geox-retained-at": retainedAt,
    }, allowed: [200] });
    const head = await this.request({ method: "HEAD", key, allowed: [200] });
    const verifiedAt = this.verifyHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, head);
    this.tracked.add(ref);
    return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: verifiedAt, externally_publishable: false };
  }
  async verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void> {
    const key = this.keyFromRef(input.retention_ref);
    const head = await this.request({ method: "HEAD", key, allowed: [200] });
    this.verifyHead(input, key, head);
  }
  async cleanup(): Promise<number> {
    let count = 0;
    for (const ref of [...this.tracked]) {
      await this.request({ method: "DELETE", key: this.keyFromRef(ref), allowed: [200, 204, 404] });
      count += 1;
    }
    this.tracked.clear();
    return count;
  }
}

class KbsDailyBatchTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    this.provider_request_count += 1;
    if (request.locator !== KBS_URL || request.provider_id !== "KBS_LTER" || request.source_family !== "RAW_HOURLY_WEATHER") throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_REQUEST_IDENTITY_INVALID");
    const response = await fetch(KBS_URL, {
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-Five-Family-Qualification/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(180_000),
    });
    if (response.status !== 200) throw new Error(`MCFT_CAP09_FIVE_FAMILY_KBS_HTTP_${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.hostname !== "lter.kbs.msu.edu" || finalUrl.pathname !== "/datatables/13.csv") throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_FINAL_IDENTITY_DRIFT");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 110_000_000) throw new Error(`MCFT_CAP09_FIVE_FAMILY_KBS_BYTES_INVALID:${bytes.byteLength}`);
    const retrievedAt = new Date().toISOString();
    return { status: 200, final_locator: finalUrl.toString(), content_type: response.headers.get("content-type")?.trim() || "text/csv", retrieved_at: retrievedAt, available_at: retrievedAt, bytes };
  }
}

class ExactTargetKbsDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_AMENDMENT11_KBS_AUTHORITATIVE_LATE_DECODER_V1";
  readonly decoder_version = "1";
  safe_meta: Record<string, unknown> | null = null;
  constructor(private readonly target: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-five-family-kbs-"));
    const rawPath = path.join(temp, "kbs.csv");
    const outputPath = path.join(temp, "drafts.json");
    const metaPath = path.join(temp, "meta.json");
    try {
      fs.writeFileSync(rawPath, Buffer.from(input.raw_bytes));
      await execFileAsync(PYTHON, [DECODER, "decode", "--available-at", input.provenance.available_at, "--target-t", this.target, "--input", rawPath, "--output", outputPath, "--meta", metaPath], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      this.safe_meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, unknown>;
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

function assertExactMain(subject: string): void {
  if (!["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== subject) throw new Error("MCFT_CAP09_FIVE_FAMILY_EXACT_MAIN_REQUIRED");
}
function assertIsolatedDb(urlText: string): void {
  if (process.env.MCFT_CAP09_FIVE_FAMILY_ISOLATED_DB_ACK !== "true") throw new Error("MCFT_CAP09_FIVE_FAMILY_ISOLATED_DB_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname.replace(/^\//, "") !== "ea5e2_readiness") throw new Error("MCFT_CAP09_FIVE_FAMILY_LOCAL_DB_REQUIRED");
}
function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, "utf8")) as T; }
async function factTypes(pool: Pool): Promise<string[]> {
  const result = await pool.query("SELECT record_json->'payload'->>'record_type' AS record_type FROM facts ORDER BY record_json->'payload'->>'record_type'");
  return result.rows.map((row) => String(row.record_type));
}

function selftest(): void {
  const target = exactHour("2026-08-13T19:00:00.000Z", "MCFT_CAP09_FIVE_FAMILY_SELFTEST_TARGET");
  if (target !== "2026-08-13T19:00:00.000Z" || EXPECTED_PRE_TYPES.length !== 3 || EXPECTED_FIVE_TYPES.length !== 5) throw new Error("MCFT_CAP09_FIVE_FAMILY_SELFTEST_DRIFT");
  console.log(JSON.stringify({ status: "PASS", exact_target_required: true, preboundary_family_count: 3, kbs_family_count: 2, total_family_count: 5, provider_retry_count: 0, source_substitution_allowed: false, cap04_required: false, crop_authority_effect: "NONE" }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") return selftest();
  if (process.argv[2] !== "run") throw new Error("MCFT_CAP09_FIVE_FAMILY_MODE_REQUIRED");
  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("MCFT_CAP09_FIVE_FAMILY_SUBJECT_SHA_INVALID");
  assertExactMain(subject);
  const target = exactHour(required("MCFT_CAP09_FIVE_FAMILY_TARGET_T"), "MCFT_CAP09_FIVE_FAMILY_TARGET_INVALID");
  const intersection = readJson<IntersectionProofV1>(required("MCFT_CAP09_INTERSECTION_PROOF_PATH"));
  const rehydration = readJson<RehydrationProofV1>(required("MCFT_CAP09_REHYDRATION_PROOF_PATH"));
  if (intersection.schema_version !== "geox_mcft_cap09_rolling_kbs_intersection_v1" || intersection.status !== "PASS" || intersection.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1" || intersection.provider_publication_cadence !== "DAILY_BATCH" || intersection.freshness_is_late_authoritative_admission_gate !== false || !intersection.selected || intersection.selected.target_t !== target || intersection.database_write_count !== 0 || intersection.formal_effect !== false || intersection.crop_authority_effect !== "NONE") throw new Error("MCFT_CAP09_FIVE_FAMILY_INTERSECTION_PROOF_INVALID");
  if (rehydration.schema_version !== "geox_mcft_cap09_rolling_preboundary_rehydration_v1" || rehydration.status !== "PASS" || rehydration.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1" || rehydration.producer_subject_sha !== intersection.selected.producer_subject_sha || rehydration.target_t !== target || rehydration.semantic_manifest_match !== true || rehydration.producer_bound_raw_reverification !== true || rehydration.provider_refetch_count !== 0 || rehydration.isolated_database_fact_count !== 3 || rehydration.private_r2_put_count !== 0 || rehydration.private_r2_delete_count !== 0 || rehydration.formal_database_write_count !== 0 || rehydration.formal_r2_prefix_write_count !== 0 || rehydration.scheduler_write_count !== 0 || rehydration.runtime_write_count !== 0 || rehydration.crop_authority_effect !== "NONE" || rehydration.formal_effect !== false) throw new Error("MCFT_CAP09_FIVE_FAMILY_REHYDRATION_PROOF_INVALID");

  const databaseUrl = required("DATABASE_URL");
  assertIsolatedDb(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-kbs-five-family-data-path" });
  const store = new FiveFamilyTransientR2V1(subject);
  const transport = new KbsDailyBatchTransportV1();
  const decoder = new ExactTargetKbsDecoderV1(target);
  let cleanupCount = 0;
  try {
    const before = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    const beforeTypes = await factTypes(pool);
    if (before !== 3 || JSON.stringify(beforeTypes) !== JSON.stringify([...EXPECTED_PRE_TYPES])) throw new Error("MCFT_CAP09_FIVE_FAMILY_PREBOUNDARY_DB_REQUIRED");
    const requestedAt = new Date().toISOString();
    const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
      dataset_id: `mcft_cap09_kbs_five_family_${target}`,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: {
        request_id: `five-family-kbs-${crypto.randomUUID()}`,
        provider_id: "KBS_LTER",
        source_family: "RAW_HOURLY_WEATHER",
        locator: KBS_URL,
        allowed_final_hosts: ["lter.kbs.msu.edu"],
        use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
        requested_at: requestedAt,
        expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"],
        limitations: ["AMENDMENT11_KBS_FIVE_FAMILY_QUALIFICATION_ONLY", "PRIVATE_TRANSIENT_R2", "EXACT_TARGET_ONLY", "NO_FORMAL_WRITE", "NO_PUBLIC_VALUE_ARTIFACT"],
      },
    }, { transport, retention: store, decoder });
    if (results.length !== 2 || !decoder.safe_meta) throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_CANONICAL_PAIR_REQUIRED");
    if (String(decoder.safe_meta.selected_target_t ?? "") !== target || String(decoder.safe_meta.selection_mode ?? "") !== "EXACT_REQUESTED_TARGET") throw new Error("MCFT_CAP09_FIVE_FAMILY_EXACT_KBS_TARGET_REQUIRED");
    const kbsTypes = results.map((item) => item.record.record_type).sort();
    if (JSON.stringify(kbsTypes) !== JSON.stringify(["historical_et0_estimate_v1", "observed_rainfall_v1"])) throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_TYPES_INVALID");
    for (const result of results) if (result.record.role_time.interval_end !== target) throw new Error("MCFT_CAP09_FIVE_FAMILY_KBS_INTERVAL_END_DRIFT");
    const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, store);
    let writes = 0;
    for (const result of [...results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type))) writes += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
    const after = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    const afterTypes = await factTypes(pool);
    if (writes !== 2 || after !== 5 || JSON.stringify(afterTypes) !== JSON.stringify([...EXPECTED_FIVE_TYPES])) throw new Error("MCFT_CAP09_FIVE_FAMILY_EXACT_FIVE_FACTS_REQUIRED");
    cleanupCount = await store.cleanup();
    if (cleanupCount !== store.put_count) throw new Error("MCFT_CAP09_FIVE_FAMILY_TRANSIENT_CLEANUP_REQUIRED");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const proof = {
      schema_version: "geox_mcft_cap09_kbs_external_five_family_data_path_v1",
      status: "PASS",
      subject_sha: subject,
      target_t: target,
      producer_subject_sha: intersection.selected.producer_subject_sha,
      producer_workflow_run_id: intersection.selected.producer_workflow_run_id,
      producer_artifact_id: intersection.selected.artifact_id,
      producer_artifact_digest: intersection.selected.artifact_digest,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      kbs_authoritative_late_path: "PASS",
      kbs_causal_intersection: "PASS",
      cross_head_rehydration: "PASS",
      kbs_external_five_family_data_path_qualified: true,
      provider_publication_cadence: "DAILY_BATCH",
      observation_resolution: "HOURLY",
      exact_kbs_target: true,
      freshness_is_late_authoritative_admission_gate: false,
      preboundary_family_count: 3,
      kbs_family_count: 2,
      isolated_database_fact_count: after,
      isolated_database_new_kbs_fact_count: writes,
      record_types: afterTypes,
      producer_bound_raw_reverification: true,
      kbs_raw_retained_before_decode: true,
      kbs_provider_request_count: transport.provider_request_count,
      kbs_provider_retry_count: 0,
      kbs_source_substitution_allowed: false,
      private_transient_r2_put_count: store.put_count,
      private_transient_r2_head_count: store.head_count,
      private_transient_r2_cleanup_count: cleanupCount,
      private_transient_cleanup_confirmed: cleanupCount === store.put_count,
      cap04_runtime_successor_qualified: false,
      crop_authority_effect: "NONE",
      formal_database_write_count: 0,
      formal_r2_prefix_write_count: 0,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      formal_effect: false,
      ea5e2_operational_activation_qualified: false,
      full_operational_go: false,
      raw_values_emitted: false,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof));
  } catch (error) {
    try { if (!cleanupCount) await store.cleanup(); } catch { /* best-effort transient cleanup */ }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
