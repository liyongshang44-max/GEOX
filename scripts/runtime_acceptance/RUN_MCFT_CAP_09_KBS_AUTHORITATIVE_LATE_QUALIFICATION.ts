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
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_KBS_AUTHORITATIVE_LATE_QUALIFICATION.json");
const KBS_URL = "https://lter.kbs.msu.edu/datatables/13.csv";
const PRIVATE_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const FORMAL_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const TRANSIENT_PREFIX = "mcft-cap09-amendment11-kbs-late-transient-v1";
const HISTORICAL_FRESHNESS_HOURS = 6;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function subjectSha(): string {
  const value = required("MCFT_CAP09_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("MCFT_CAP09_KBS_LATE_SUBJECT_SHA_INVALID");
  return value;
}

function assertExactMain(subject: string): void {
  if (!["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")
      || process.env.GITHUB_REF !== "refs/heads/main"
      || process.env.GITHUB_SHA !== subject) {
    throw new Error("MCFT_CAP09_KBS_LATE_EXACT_MAIN_ACTION_RUN_REQUIRED");
  }
}

function assertIsolatedDb(urlText: string): void {
  if (process.env.MCFT_CAP09_KBS_LATE_ISOLATED_DB_ACK !== "true") throw new Error("MCFT_CAP09_KBS_LATE_ISOLATED_DB_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("MCFT_CAP09_KBS_LATE_DATABASE_MUST_BE_LOCALHOST");
  if (url.pathname.replace(/^\//, "") !== "ea5e2_readiness") throw new Error("MCFT_CAP09_KBS_LATE_DATABASE_NAME_REQUIRED");
}

function canonicalIso(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
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

type SignedResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

class QualificationTransientR2V1 implements RawEvidenceRetentionPortV1, RawEvidenceRetentionVerificationPortV1 {
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
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash || this.endpoint.pathname !== "/") {
      throw new Error("MCFT_CAP09_KBS_LATE_REMOTE_HTTPS_ENDPOINT_REQUIRED");
    }
    this.bucket = required("MCFT_EA5E2_TRANSIENT_S3_BUCKET");
    if (this.bucket !== PRIVATE_BUCKET) throw new Error("MCFT_CAP09_KBS_LATE_PRIVATE_BUCKET_BINDING_REQUIRED");
    this.region = required("MCFT_EA5E2_TRANSIENT_S3_REGION");
    this.accessKey = required("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID");
    this.secretKey = required("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY");
    const runId = required("GITHUB_RUN_ID");
    this.prefix = `${TRANSIENT_PREFIX}/${subject}/${runId}`;
    if (this.prefix.startsWith(FORMAL_PREFIX)) throw new Error("MCFT_CAP09_KBS_LATE_FORMAL_PREFIX_FORBIDDEN");
  }

  private keyForDigest(digest: string): string {
    const match = /^sha256:([0-9a-f]{64})$/.exec(digest);
    if (!match) throw new Error("MCFT_CAP09_KBS_LATE_RAW_SHA256_INVALID");
    return `${this.prefix}/sha256/${match[1]}`;
  }

  private refForKey(key: string): string {
    return `s3-private://${this.bucket}/${key}`;
  }

  private keyFromRef(ref: string): string {
    const parsed = new URL(ref);
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.bucket) throw new Error("MCFT_CAP09_KBS_LATE_RETENTION_REF_INVALID");
    const key = parsed.pathname.replace(/^\/+/, "");
    if (!key.startsWith(`${this.prefix}/`) || key.startsWith(FORMAL_PREFIX)) throw new Error("MCFT_CAP09_KBS_LATE_RETENTION_REF_PREFIX_MISMATCH");
    return key;
  }

  private async request(input: { method: "PUT" | "HEAD" | "DELETE"; key: string; body?: Buffer; content_type?: string; metadata?: Record<string, string>; allowed: readonly number[] }): Promise<SignedResponse> {
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256Hex(body);
    const { amz_date: amzDate, short_date: shortDate } = amzTimestamp(new Date());
    const requestPath = encodedPath(this.bucket, input.key);
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
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
    const response = await new Promise<SignedResponse>((resolve, reject) => {
      const req = https.request({ protocol: "https:", hostname: this.endpoint.hostname, port: this.endpoint.port || undefined, method: input.method, path: requestPath, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.setTimeout(30_000, () => req.destroy(new Error("MCFT_CAP09_KBS_LATE_R2_REQUEST_TIMEOUT")));
      if (input.method === "PUT") req.write(body);
      req.end();
    });
    if (!input.allowed.includes(response.status)) throw new Error(`MCFT_CAP09_KBS_LATE_R2_${input.method}_STATUS_${response.status}`);
    if (input.method === "PUT") this.put_count += 1;
    if (input.method === "HEAD") this.head_count += 1;
    if (input.method === "DELETE") this.delete_count += 1;
    return response;
  }

  private verifyHead(input: VerifyRetainedRawEvidenceInputV1, key: string, head: SignedResponse): string {
    if (head.status !== 200) throw new Error("MCFT_CAP09_KBS_LATE_RAW_OBJECT_NOT_FOUND");
    if (Number(head.headers["content-length"]) !== input.retained_bytes) throw new Error("MCFT_CAP09_KBS_LATE_RETAINED_BYTES_MISMATCH");
    if (String(head.headers["x-amz-meta-geox-sha256"] ?? "") !== input.retained_sha256) throw new Error("MCFT_CAP09_KBS_LATE_RETAINED_SHA_MISMATCH");
    if (String(head.headers["x-amz-meta-geox-retention-class"] ?? "") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("MCFT_CAP09_KBS_LATE_RETAINED_CLASS_MISMATCH");
    if (key !== this.keyForDigest(input.retained_sha256)) throw new Error("MCFT_CAP09_KBS_LATE_RETAINED_KEY_MISMATCH");
    return canonicalIso(String(head.headers["x-amz-meta-geox-retained-at"] ?? ""), "MCFT_CAP09_KBS_LATE_RETAINED_AT_INVALID");
  }

  async retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> {
    const raw = Buffer.from(input.bytes);
    if (input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE" || raw.byteLength <= 0 || raw.byteLength !== input.raw_bytes || sha256(raw) !== input.raw_sha256) {
      throw new Error("MCFT_CAP09_KBS_LATE_RAW_RETENTION_INPUT_INVALID");
    }
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
    if (request.locator !== KBS_URL || request.provider_id !== "KBS_LTER" || request.source_family !== "RAW_HOURLY_WEATHER") throw new Error("MCFT_CAP09_KBS_LATE_REQUEST_IDENTITY_INVALID");
    const response = await fetch(KBS_URL, { headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-Amendment11-KBS-Late-Qualification/1.0" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (response.status !== 200) throw new Error(`MCFT_CAP09_KBS_LATE_HTTP_${response.status}`);
    const finalUrl = new URL(response.url);
    if (finalUrl.hostname !== "lter.kbs.msu.edu" || finalUrl.pathname !== "/datatables/13.csv") throw new Error("MCFT_CAP09_KBS_LATE_FINAL_IDENTITY_DRIFT");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 110_000_000) throw new Error(`MCFT_CAP09_KBS_LATE_BYTES_INVALID:${bytes.byteLength}`);
    const retrievedAt = new Date().toISOString();
    return { status: 200, final_locator: finalUrl.toString(), content_type: response.headers.get("content-type")?.trim() || "text/csv", retrieved_at: retrievedAt, available_at: retrievedAt, bytes };
  }
}

class Amendment11KbsLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_AMENDMENT11_KBS_AUTHORITATIVE_LATE_DECODER_V1";
  readonly decoder_version = "1";
  safe_meta: Record<string, unknown> | null = null;

  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-kbs-late-"));
    const rawPath = path.join(temp, "kbs.csv");
    const outputPath = path.join(temp, "drafts.json");
    const metaPath = path.join(temp, "meta.json");
    try {
      fs.writeFileSync(rawPath, Buffer.from(input.raw_bytes));
      await execFileAsync(PYTHON, [DECODER, "decode", "--available-at", input.provenance.available_at, "--input", rawPath, "--output", outputPath, "--meta", metaPath], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
      const parsed = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      this.safe_meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, unknown>;
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("MCFT_CAP09_KBS_LATE_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}

async function ensureFactsSchema(pool: Pool): Promise<void> {
  await pool.query("CREATE TABLE IF NOT EXISTS facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp())");
}

async function main(): Promise<void> {
  const subject = subjectSha();
  assertExactMain(subject);
  const databaseUrl = required("DATABASE_URL");
  assertIsolatedDb(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-kbs-authoritative-late" });
  const store = new QualificationTransientR2V1(subject);
  const transport = new KbsDailyBatchTransportV1();
  const decoder = new Amendment11KbsLateDecoderV1();
  let cleanupCount = 0;
  try {
    await ensureFactsSchema(pool);
    await pool.query("TRUNCATE TABLE facts");
    const requestedAt = new Date().toISOString();
    const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
      dataset_id: `mcft_cap09_amendment11_kbs_authoritative_late_${subject.slice(0, 12)}`,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: {
        request_id: `amendment11-kbs-late-${crypto.randomUUID()}`,
        provider_id: "KBS_LTER",
        source_family: "RAW_HOURLY_WEATHER",
        locator: KBS_URL,
        allowed_final_hosts: ["lter.kbs.msu.edu"],
        use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
        requested_at: requestedAt,
        expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"],
        limitations: ["AMENDMENT11_AUTHORITATIVE_LATE_QUALIFICATION_ONLY", "PRIVATE_TRANSIENT_R2", "NO_FORMAL_WRITE", "NO_PUBLIC_VALUE_ARTIFACT"],
      },
    }, { transport, retention: store, decoder });
    if (results.length !== 2 || !decoder.safe_meta) throw new Error("MCFT_CAP09_KBS_LATE_CANONICAL_PAIR_REQUIRED");
    const types = results.map((item) => item.record.record_type).sort();
    if (JSON.stringify(types) !== JSON.stringify(["historical_et0_estimate_v1", "observed_rainfall_v1"])) throw new Error("MCFT_CAP09_KBS_LATE_RECORD_TYPES_INVALID");
    const target = String(decoder.safe_meta.selected_target_t ?? "");
    const intervalStart = String(decoder.safe_meta.selected_interval_start ?? "");
    for (const result of results) {
      if (result.record.role_time.interval_end !== target || result.record.role_time.interval_start !== intervalStart) throw new Error("MCFT_CAP09_KBS_LATE_EXACT_INTERVAL_DRIFT");
      if (Date.parse(result.record.available_to_runtime_at) < Date.parse(target)) throw new Error("MCFT_CAP09_KBS_LATE_AVAILABILITY_BEFORE_EVENT_INVALID");
    }
    const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, store);
    let writes = 0;
    for (const result of [...results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type))) writes += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
    const factCount = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (writes !== 2 || factCount !== 2) throw new Error("MCFT_CAP09_KBS_LATE_TWO_ISOLATED_FACTS_REQUIRED");
    const chronology = results.map((item) => ({ record_type: item.record.record_type, event_time: String(item.record.role_time.interval_end), available_to_runtime_at: item.record.available_to_runtime_at, ingested_at: String(item.record.role_time.ingested_at), retained_at: item.raw_provenance.retained_at }));
    cleanupCount = await store.cleanup();
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const latestAge = Number(decoder.safe_meta.provider_latest_age_hours);
    const proof = {
      schema_version: "geox_mcft_cap09_kbs_authoritative_late_qualification_v1",
      status: "PASS",
      subject_sha: subject,
      exact_main_action_run: true,
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      provider_publication_cadence: "DAILY_BATCH",
      observation_resolution: "HOURLY",
      provider_request_count: transport.provider_request_count,
      selected_target_t: target,
      selected_interval_start: intervalStart,
      selected_interval_end: target,
      provider_latest_timestamp: decoder.safe_meta.provider_latest_timestamp,
      provider_latest_age_hours: latestAge,
      historical_online_freshness_diagnostic_le_6h: latestAge <= HISTORICAL_FRESHNESS_HOURS,
      freshness_is_late_authoritative_admission_gate: false,
      delayed_authoritative_evidence_eligible: true,
      exact_source_identity: true,
      exact_interval_identity: true,
      raw_retained_before_decode: true,
      real_chronology_retained: true,
      valid_quality_required: true,
      identity_conflict_allowed: false,
      interpolation_allowed: false,
      persistence_fill_allowed: false,
      source_substitution_allowed: false,
      record_types: types,
      chronology,
      isolated_database_fact_count: factCount,
      isolated_database_write_count: writes,
      private_transient_r2_put_count: store.put_count,
      private_transient_r2_head_count: store.head_count,
      private_transient_r2_cleanup_count: cleanupCount,
      private_transient_cleanup_confirmed: cleanupCount === store.put_count,
      formal_database_write_count: 0,
      formal_r2_prefix_write_count: 0,
      scheduler_write_count: 0,
      crop_authority_effect: "NONE",
      authority_effect: false,
      formal_effect: false,
      live_dispatch_authorized: false,
      raw_values_emitted: false,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof));
  } catch (error) {
    try { if (!cleanupCount) await store.cleanup(); } catch { /* best effort transient cleanup */ }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
