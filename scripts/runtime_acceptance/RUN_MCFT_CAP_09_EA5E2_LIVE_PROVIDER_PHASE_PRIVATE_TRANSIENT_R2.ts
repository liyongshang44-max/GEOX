import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";

import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
  type RawEvidenceRetentionInputV1,
  type RawEvidenceRetentionPortV1,
  type RawEvidenceRetentionReceiptV1,
  type VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  McftCap09ExternalFormalCollectorPhaseOrchestratorV1,
  type ExternalFormalCollectorSlotAuthorityV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  prefetchLiveKbsVariate25RawV1,
  type PrefetchedKbsSoilRawV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");
const OUTPUT_DIR = path.resolve("acceptance-output");
const PRE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json");
const LATE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_SAFE_PROOF.json");
const TRANSIENT_REF_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_TRANSIENT_R2_REFS.json");
const TRANSIENT_SMOKE_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_TRANSIENT_R2_SMOKE.json");
const TRANSIENT_CLEANUP_OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_EA5E2_TRANSIENT_R2_CLEANUP.json");

const MINUTE = 60_000;
const PRE_OFFSET_MINUTES = -30;
const LATE_OFFSET_MINUTES = 390;
const CUTOFF_OFFSET_MINUTES = 432;
const MIN_INGRESS_MARGIN_MINUTES = 5;
const SOIL_WINDOW_MINUTES = 15;
const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 15;
const KBS_RAW_HOURLY_URL = "https://lter.kbs.msu.edu/datatables/13.csv";
const GFS_ROOT = "https://nomads.ncep.noaa.gov/";
const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const FORMAL_RAW_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const TRANSIENT_ROOT_PREFIX = "mcft-cap09-ea5e2-readiness-transient-v1";
const TRANSIENT_CLASS = "EA5E2_PRIVATE_TRANSIENT_QUALIFICATION_DATA";

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

function canonicalHour(value: string, code: string): string {
  canonicalIso(value, code);
  if (!value.endsWith(":00:00.000Z")) throw new Error(code);
  return value;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * MINUTE).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(value: string): Promise<void> {
  const remaining = Date.parse(value) - Date.now();
  if (remaining > 0) await sleep(remaining);
}

function assertIsolatedDatabase(urlText: string): void {
  if (process.env.MCFT_EA5E2_ISOLATED_READINESS_ACK !== "true") throw new Error("EA5E2_ISOLATED_READINESS_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("EA5E2_READINESS_DATABASE_MUST_BE_LOCALHOST");
  if (url.pathname.replace(/^\//, "") !== "ea5e2_readiness") throw new Error("EA5E2_READINESS_DATABASE_NAME_REQUIRED");
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

function rawDigestHex(value: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(value);
  if (!match) throw new Error("EA5E2_TRANSIENT_RAW_SHA256_INVALID");
  return match[1];
}

type SignedResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

type RetainedRead = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
  retained_at: string;
  bytes: Uint8Array;
};

class Ea5e2PrivateTransientR2StoreV1 implements RawEvidenceRetentionPortV1, RawEvidenceRetentionVerificationPortV1 {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly subjectSha: string;
  private readonly namespace: string;
  private readonly refs = new Map<string, { retention_ref: string; retained_sha256: string; retained_bytes: number }>();
  put_count = 0;
  get_count = 0;
  delete_count = 0;

  constructor(input: { subject_sha: string; namespace: string }) {
    if (!/^[0-9a-f]{40}$/.test(input.subject_sha)) throw new Error("EA5E2_TRANSIENT_SUBJECT_SHA_INVALID");
    if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(input.namespace)) throw new Error("EA5E2_TRANSIENT_NAMESPACE_INVALID");
    this.subjectSha = input.subject_sha;
    this.namespace = input.namespace;
    this.endpoint = new URL(required("MCFT_EA5E2_TRANSIENT_S3_ENDPOINT"));
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash || this.endpoint.pathname !== "/") {
      throw new Error("EA5E2_TRANSIENT_REMOTE_HTTPS_ENDPOINT_REQUIRED");
    }
    if (["localhost", "127.0.0.1", "::1"].includes(this.endpoint.hostname) || this.endpoint.hostname.endsWith(".local")) {
      throw new Error("EA5E2_TRANSIENT_REMOTE_ENDPOINT_REQUIRED");
    }
    this.bucket = required("MCFT_EA5E2_TRANSIENT_S3_BUCKET");
    if (this.bucket !== FORMAL_RAW_BUCKET) throw new Error("EA5E2_TRANSIENT_EXISTING_PRIVATE_BUCKET_BINDING_REQUIRED");
    this.region = required("MCFT_EA5E2_TRANSIENT_S3_REGION");
    this.accessKey = required("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID");
    this.secretKey = required("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY");
    if (this.accessKey === "minioadmin" || this.secretKey === "minioadmin123") throw new Error("EA5E2_TRANSIENT_CI_CREDENTIAL_FORBIDDEN");
  }

  private scopePrefix(): string {
    return `${TRANSIENT_ROOT_PREFIX}/${this.subjectSha}/${this.namespace}`;
  }

  private keyForDigest(digest: string): string {
    const key = `${this.scopePrefix()}/sha256/${rawDigestHex(digest)}`;
    if (key.startsWith(FORMAL_RAW_PREFIX)) throw new Error("EA5E2_FORMAL_RAW_PREFIX_WRITE_FORBIDDEN");
    return key;
  }

  private refForKey(key: string): string {
    return `s3-private://${this.bucket}/${key}`;
  }

  private keyFromRef(ref: string): string {
    let parsed: URL;
    try { parsed = new URL(ref); } catch { throw new Error("EA5E2_TRANSIENT_RETENTION_REF_INVALID"); }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.bucket) throw new Error("EA5E2_TRANSIENT_RETENTION_REF_BUCKET_MISMATCH");
    const key = parsed.pathname.replace(/^\/+/, "");
    const subjectPrefix = `${TRANSIENT_ROOT_PREFIX}/${this.subjectSha}/`;
    if (!key.startsWith(subjectPrefix)) throw new Error("EA5E2_TRANSIENT_RETENTION_REF_SUBJECT_PREFIX_MISMATCH");
    if (key.startsWith(FORMAL_RAW_PREFIX)) throw new Error("EA5E2_FORMAL_RAW_PREFIX_REFERENCE_FORBIDDEN");
    return key;
  }

  private recordRef(ref: string, digest: string, bytes: number): void {
    this.refs.set(ref, { retention_ref: ref, retained_sha256: digest, retained_bytes: bytes });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(TRANSIENT_REF_OUTPUT, JSON.stringify({
      schema_version: "geox_mcft_cap09_ea5e2_transient_r2_refs_v1",
      subject_sha: this.subjectSha,
      transient_root_prefix: TRANSIENT_ROOT_PREFIX,
      formal_raw_prefix_write_count: 0,
      refs: [...this.refs.values()].sort((a, b) => a.retention_ref.localeCompare(b.retention_ref)),
      raw_values_emitted: false,
    }, null, 2) + "\n");
  }

  private async request(input: {
    method: "PUT" | "HEAD" | "GET" | "DELETE";
    key: string;
    body?: Buffer;
    content_type?: string;
    metadata?: Record<string, string>;
    allowed_statuses: readonly number[];
  }): Promise<SignedResponse> {
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256Hex(body);
    const now = new Date();
    const { amz_date: amzDate, short_date: shortDate } = amzTimestamp(now);
    const requestPath = `${this.endpoint.pathname.replace(/\/$/, "")}${encodedPath(this.bucket, input.key)}`;
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
      const req = https.request({
        protocol: this.endpoint.protocol,
        hostname: this.endpoint.hostname,
        port: this.endpoint.port || undefined,
        method: input.method,
        path: requestPath,
        headers,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.setTimeout(60_000, () => req.destroy(new Error("EA5E2_TRANSIENT_S3_REQUEST_TIMEOUT")));
      if (input.method === "PUT") req.write(body);
      req.end();
    });
    if (!input.allowed_statuses.includes(response.status)) throw new Error(`EA5E2_TRANSIENT_S3_${input.method}_STATUS_${response.status}`);
    return response;
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string {
    const value = headers[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }

  private validateHead(input: VerifyRetainedRawEvidenceInputV1, key: string, head: SignedResponse): string {
    if (head.status !== 200) throw new Error("EA5E2_TRANSIENT_OBJECT_NOT_FOUND");
    const length = Number(this.header(head.headers, "content-length"));
    if (!Number.isSafeInteger(length) || length !== input.retained_bytes) throw new Error("EA5E2_TRANSIENT_RETAINED_BYTE_COUNT_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-sha256") !== input.retained_sha256) throw new Error("EA5E2_TRANSIENT_RETAINED_SHA256_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-retention-class") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("EA5E2_TRANSIENT_RETAINED_CLASS_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-ea5e2-class") !== TRANSIENT_CLASS) throw new Error("EA5E2_TRANSIENT_CLASSIFICATION_MISMATCH");
    const retainedAt = canonicalIso(this.header(head.headers, "x-amz-meta-geox-retained-at"), "EA5E2_TRANSIENT_RETAINED_AT_INVALID");
    if (!key.endsWith(`/sha256/${rawDigestHex(input.retained_sha256)}`)) throw new Error("EA5E2_TRANSIENT_KEY_DIGEST_MISMATCH");
    return retainedAt;
  }

  async verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void> {
    const key = this.keyFromRef(input.retention_ref);
    const head = await this.request({ method: "HEAD", key, allowed_statuses: [200, 404] });
    this.validateHead(input, key, head);
  }

  async retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> {
    if (input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("EA5E2_TRANSIENT_RETENTION_CLASS_REQUIRED");
    const raw = Buffer.from(input.bytes);
    if (!raw.byteLength || raw.byteLength !== input.raw_bytes || sha256(raw) !== input.raw_sha256) throw new Error("EA5E2_TRANSIENT_RAW_DIGEST_OR_LENGTH_MISMATCH");
    const retrievedAt = canonicalIso(input.retrieved_at, "EA5E2_TRANSIENT_RETRIEVED_AT_INVALID");
    const key = this.keyForDigest(input.raw_sha256);
    const ref = this.refForKey(key);
    const probe = await this.request({ method: "HEAD", key, allowed_statuses: [200, 404] });
    if (probe.status === 200) {
      const retainedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, probe);
      if (Date.parse(retainedAt) >= Date.parse(retrievedAt)) {
        this.recordRef(ref, input.raw_sha256, raw.byteLength);
        return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: retainedAt, externally_publishable: false };
      }
      await this.deleteRetainedRawEvidence(ref);
    }
    const retainedAt = new Date().toISOString();
    await this.request({
      method: "PUT",
      key,
      body: raw,
      content_type: input.content_type || "application/octet-stream",
      metadata: {
        "x-amz-meta-geox-sha256": input.raw_sha256,
        "x-amz-meta-geox-retention-class": "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        "x-amz-meta-geox-retained-at": retainedAt,
        "x-amz-meta-geox-ea5e2-class": TRANSIENT_CLASS,
      },
      allowed_statuses: [200],
    });
    this.put_count += 1;
    const head = await this.request({ method: "HEAD", key, allowed_statuses: [200] });
    const verifiedAt = this.validateHead({ retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength }, key, head);
    this.recordRef(ref, input.raw_sha256, raw.byteLength);
    return { retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", retention_ref: ref, retained_sha256: input.raw_sha256, retained_bytes: raw.byteLength, retained_at: verifiedAt, externally_publishable: false };
  }

  async readRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<RetainedRead> {
    await this.verifyRetainedRawEvidence(input);
    const key = this.keyFromRef(input.retention_ref);
    const response = await this.request({ method: "GET", key, allowed_statuses: [200] });
    if (response.body.byteLength !== input.retained_bytes || sha256(response.body) !== input.retained_sha256) throw new Error("EA5E2_TRANSIENT_GET_DIGEST_OR_LENGTH_MISMATCH");
    this.get_count += 1;
    const head = await this.request({ method: "HEAD", key, allowed_statuses: [200] });
    const retainedAt = this.validateHead(input, key, head);
    return { ...input, retained_at: retainedAt, bytes: new Uint8Array(response.body) };
  }

  async deleteRetainedRawEvidence(ref: string): Promise<void> {
    const key = this.keyFromRef(ref);
    await this.request({ method: "DELETE", key, allowed_statuses: [200, 204] });
    this.delete_count += 1;
    const probe = await this.request({ method: "HEAD", key, allowed_statuses: [404] });
    if (probe.status !== 404) throw new Error("EA5E2_TRANSIENT_DELETE_NOT_CONFIRMED");
  }
}

function subjectSha(): string {
  const value = required("MCFT_EA5E2_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error("EA5E2_EXACT_SUBJECT_SHA_REQUIRED");
  return value;
}

function namespaceFor(target: string): string {
  return target.replace(/[^0-9]/g, "").toLowerCase();
}

function slotAuthority(target: string): ExternalFormalCollectorSlotAuthorityV1 {
  return {
    epoch_id: `ea5e2_live_readiness_${namespaceFor(target)}`,
    slot_id: "O00",
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    logical_time: target,
    pre_boundary_causal_collector_target: addMinutes(target, PRE_OFFSET_MINUTES),
    late_exact_hour_collector_scheduled: addMinutes(target, LATE_OFFSET_MINUTES),
    late_exact_hour_evidence_cutoff: addMinutes(target, CUTOFF_OFFSET_MINUTES),
  };
}

async function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(PYTHON, [PROVIDER_SCRIPT, ...args], { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024, timeout: 20 * 60_000 });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

class PythonGfsRawBundleTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  safe_meta: Record<string, unknown> | null = null;
  constructor(private readonly target: string) {}
  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-gfs-"));
    const bundle = path.join(temp, "gfs-raw-bundle.tar");
    const meta = path.join(temp, "gfs-safe-meta.json");
    try {
      await runPython(["fetch-gfs", "--target", this.target, "--output", bundle, "--meta", meta]);
      const safe = JSON.parse(fs.readFileSync(meta, "utf8")) as Record<string, unknown>;
      this.safe_meta = safe;
      this.provider_request_count = Number(safe.provider_request_count);
      if (!Number.isSafeInteger(this.provider_request_count) || this.provider_request_count <= 0) throw new Error("EA5E2_GFS_PROVIDER_REQUEST_COUNT_INVALID");
      const bytes = new Uint8Array(fs.readFileSync(bundle));
      const retrievedAt = canonicalIso(String(safe.retrieved_at), "EA5E2_GFS_RETRIEVED_AT_INVALID");
      return { status: 200, final_locator: GFS_ROOT, content_type: "application/x-tar", retrieved_at: retrievedAt, available_at: retrievedAt, bytes };
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}

class PythonGfsRawBundleDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string, private readonly restoredIngestedAt?: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-gfs-decode-"));
    const bundle = path.join(temp, "gfs-raw-bundle.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await runPython(["decode-gfs", "--target", this.target, "--available-at", input.provenance.available_at, "--input", bundle, "--output", output]);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_GFS_DRAFT_PAIR_REQUIRED");
      if (!this.restoredIngestedAt) return parsed.drafts;
      const ingestedAt = canonicalIso(this.restoredIngestedAt, "EA5E2_GFS_RESTORED_INGESTED_AT_INVALID");
      return parsed.drafts.map((draft) => ({ ...draft, role_time: { ...draft.role_time, ingested_at: ingestedAt } }));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}

class OneShotSoilTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5E2_SOIL_PREFETCH_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) throw new Error("EA5E2_SOIL_PREFETCH_IDENTITY_MISMATCH");
    return this.prefetched.response;
  }
}

class KbsRawHourlyTransportV1 implements ExternalEvidenceTransportPortV1 {
  provider_request_count = 0;
  async fetchRawEvidence(_: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    this.provider_request_count += 1;
    const response = await fetch(KBS_RAW_HOURLY_URL, { method: "GET", redirect: "follow", headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-EA5E2-LIVE/1" }, signal: AbortSignal.timeout(90_000) });
    if (response.status < 200 || response.status >= 300) throw new Error(`EA5E2_KBS_RAW_HOURLY_HTTP:${response.status}`);
    const finalUrl = new URL(response.url || KBS_RAW_HOURLY_URL);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "lter.kbs.msu.edu" || finalUrl.pathname !== "/datatables/13.csv") throw new Error("EA5E2_KBS_RAW_HOURLY_IDENTITY_DRIFT");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 110_000_000) throw new Error(`EA5E2_KBS_RAW_HOURLY_BYTES:${bytes.byteLength}`);
    const retrievedAt = new Date().toISOString();
    return { status: response.status, final_locator: finalUrl.toString(), content_type: response.headers.get("content-type")?.trim() || "text/csv", retrieved_at: retrievedAt, available_at: retrievedAt, bytes };
  }
}

class PythonKbsLateDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1";
  readonly decoder_version = "1";
  constructor(private readonly target: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-ea5e2-kbs-late-"));
    const raw = path.join(temp, "kbs-raw-hourly.csv");
    const output = path.join(temp, "kbs-late-drafts.json");
    try {
      fs.writeFileSync(raw, Buffer.from(input.raw_bytes));
      await runPython(["decode-kbs-late", "--target", this.target, "--available-at", input.provenance.available_at, "--input", raw, "--output", output]);
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("EA5E2_KBS_LATE_DRAFT_PAIR_REQUIRED");
      return parsed.drafts;
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}

class RetainedRawReplayTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly provenance: VerifiedRawEvidenceProvenanceV1, private readonly bytes: Uint8Array) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5E2_RETAINED_REPLAY_TRANSPORT_REUSE_FORBIDDEN");
    this.used = true;
    if (request.provider_id !== this.provenance.provider_id || request.source_family !== this.provenance.source_family || request.locator !== this.provenance.source_locator) throw new Error("EA5E2_RETAINED_REPLAY_REQUEST_IDENTITY_MISMATCH");
    return { status: 200, final_locator: this.provenance.final_locator, content_type: this.provenance.content_type, retrieved_at: this.provenance.retrieved_at, available_at: this.provenance.available_at, bytes: this.bytes };
  }
}

async function ensureFactsSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp())`);
}

function writeSafe(pathName: string, value: unknown): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(pathName, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value));
}

function semanticRows(results: readonly CanonicalizedExternalEvidenceResultV1[]) {
  return results.map((result) => ({ record_type: result.record.record_type, source_record_id: result.record.source_record_id, record_semantic_sha256: result.record_semantic_sha256 })).sort((a, b) => a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id));
}

function exactSemanticMatch(actual: readonly CanonicalizedExternalEvidenceResultV1[], expected: unknown): void {
  if (!Array.isArray(expected)) throw new Error("EA5E2_REHYDRATION_EXPECTED_SEMANTIC_ROWS_REQUIRED");
  if (JSON.stringify(semanticRows(actual)) !== JSON.stringify(expected)) throw new Error("EA5E2_REHYDRATION_SEMANTIC_HASH_MISMATCH");
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
    expected_content_type_prefixes: contentPrefixes,
    limitations: ["EA5E2_PRIVATE_TRANSIENT_REHYDRATION", "NO_PROVIDER_REFETCH", "NO_PUBLIC_VALUE_ARTIFACT"],
  };
}

async function rehydratePreBoundary(input: { pool: Pool; store: Ea5e2PrivateTransientR2StoreV1; target: string; proof: Record<string, unknown> }): Promise<{ results: CanonicalizedExternalEvidenceResultV1[]; write_count: number }> {
  const manifest = input.proof.rehydration_manifest as Record<string, unknown> | undefined;
  if (!manifest) throw new Error("EA5E2_REHYDRATION_MANIFEST_REQUIRED");
  const gfs = manifest.gfs as Record<string, unknown> | undefined;
  const soil = manifest.soil as Record<string, unknown> | undefined;
  if (!gfs || !soil) throw new Error("EA5E2_REHYDRATION_FAMILY_MANIFEST_REQUIRED");

  const gfsProvenance = gfs.provenance as VerifiedRawEvidenceProvenanceV1;
  const soilProvenance = soil.provenance as VerifiedRawEvidenceProvenanceV1;
  const gfsRaw = await input.store.readRetainedRawEvidence({ retention_ref: gfsProvenance.retention_ref, retained_sha256: gfsProvenance.raw_sha256, retained_bytes: gfsProvenance.raw_bytes });
  const soilRaw = await input.store.readRetainedRawEvidence({ retention_ref: soilProvenance.retention_ref, retained_sha256: soilProvenance.raw_sha256, retained_bytes: soilProvenance.raw_bytes });
  if (gfsRaw.retained_at !== gfsProvenance.retained_at || soilRaw.retained_at !== soilProvenance.retained_at) throw new Error("EA5E2_REHYDRATION_RETAINED_AT_MISMATCH");

  const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_gfs_${input.target}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(gfsProvenance, ["application/x-tar"]),
    canonicalized_at: canonicalIso(String(input.proof.phase_canonicalized_at), "EA5E2_REHYDRATION_PRE_CANONICALIZED_AT_REQUIRED"),
  }, {
    transport: new RetainedRawReplayTransportV1(gfsProvenance, gfsRaw.bytes),
    retention: input.store,
    decoder: new PythonGfsRawBundleDecoderV1(input.target, String(gfs.ingested_at)),
  });
  const soilResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_soil_${input.target}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(soilProvenance, [soilProvenance.content_type.split(";", 1)[0]]),
    canonicalized_at: canonicalIso(String(input.proof.phase_canonicalized_at), "EA5E2_REHYDRATION_PRE_CANONICALIZED_AT_REQUIRED"),
  }, {
    transport: new RetainedRawReplayTransportV1(soilProvenance, soilRaw.bytes),
    retention: input.store,
    decoder: new KbsVariate25SoilEvidenceDecoderV1(),
  });
  const results = [...gfsResults, ...soilResults];
  exactSemanticMatch(results, manifest.expected_records);
  const ingress = new PostgresExternalFormalEvidenceIngressV1(input.pool, input.store);
  let writes = 0;
  for (const result of [...results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type))) {
    const receipt = await ingress.appendCanonicalizedExternalEvidence(result);
    writes += receipt.canonical_fact_write_count;
  }
  if (writes !== 3) throw new Error(`EA5E2_REHYDRATION_THREE_FACT_WRITES_REQUIRED:${writes}`);
  return { results, write_count: writes };
}

async function smokeTransientStore(): Promise<void> {
  const subject = subjectSha();
  const store = new Ea5e2PrivateTransientR2StoreV1({ subject_sha: subject, namespace: `smoke-${required("GITHUB_RUN_ID")}` });
  const bytes = crypto.randomBytes(96);
  const digest = sha256(bytes);
  const now = new Date().toISOString();
  const receipt = await store.retainRawEvidence({ retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE", request_id: `smoke-${crypto.randomUUID()}`, provider_id: "EA5E2_READINESS_SMOKE", source_family: "NON_PROVIDER_RANDOM_BYTES", source_locator: "https://example.invalid/ea5e2-readiness-smoke", final_locator: "https://example.invalid/ea5e2-readiness-smoke", content_type: "application/octet-stream", retrieved_at: now, available_at: now, use_policy_ref: "EA5E2_PRIVATE_TRANSIENT_STORE_SMOKE_ONLY", raw_sha256: digest, raw_bytes: bytes.byteLength, bytes });
  const read = await store.readRetainedRawEvidence({ retention_ref: receipt.retention_ref, retained_sha256: digest, retained_bytes: bytes.byteLength });
  if (!Buffer.from(read.bytes).equals(bytes)) throw new Error("EA5E2_TRANSIENT_SMOKE_READBACK_MISMATCH");
  await store.deleteRetainedRawEvidence(receipt.retention_ref);
  writeSafe(TRANSIENT_SMOKE_OUTPUT, { schema_version: "geox_mcft_cap09_ea5e2_transient_r2_smoke_v1", status: "PASS", subject_sha: subject, transient_root_prefix: TRANSIENT_ROOT_PREFIX, formal_raw_prefix_write_count: 0, transient_private_put_count: store.put_count, transient_private_get_count: store.get_count, transient_private_delete_count: store.delete_count, payload_sha256: digest, payload_bytes: bytes.byteLength, raw_values_emitted: false, public_value_artifact_count: 0 });
}

function collectTransientRefs(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string" && value.startsWith(`s3-private://${FORMAL_RAW_BUCKET}/${TRANSIENT_ROOT_PREFIX}/`)) output.add(value);
  else if (Array.isArray(value)) for (const item of value) collectTransientRefs(item, output);
  else if (value && typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) collectTransientRefs(item, output);
  return output;
}

async function cleanupTransientStore(): Promise<void> {
  const subject = subjectSha();
  const store = new Ea5e2PrivateTransientR2StoreV1({ subject_sha: subject, namespace: "cleanup" });
  const refs = new Set<string>();
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const file of fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith(".json"))) {
      try { collectTransientRefs(JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), "utf8")), refs); } catch { /* ignore non-JSON/partial output */ }
    }
  }
  const deleted: string[] = [];
  for (const ref of [...refs].sort()) {
    await store.deleteRetainedRawEvidence(ref);
    deleted.push(ref);
  }
  writeSafe(TRANSIENT_CLEANUP_OUTPUT, { schema_version: "geox_mcft_cap09_ea5e2_transient_r2_cleanup_v1", status: "PASS", subject_sha: subject, transient_root_prefix: TRANSIENT_ROOT_PREFIX, deleted_ref_count: deleted.length, deleted_refs: deleted, formal_raw_prefix_delete_count: 0, raw_values_emitted: false, public_value_artifact_count: 0 });
}

async function main(): Promise<void> {
  const mode = required("MCFT_EA5E2_LIVE_PHASE");
  if (mode === "TRANSIENT_STORE_SMOKE") return smokeTransientStore();
  if (mode === "CLEANUP_TRANSIENT") return cleanupTransientStore();
  if (mode !== "PRE_BOUNDARY_CAUSAL" && mode !== "LATE_EXACT_HOUR") throw new Error("MCFT_EA5E2_LIVE_PHASE_INVALID");

  const subject = subjectSha();
  const target = canonicalHour(required("MCFT_EA5E2_TARGET_T"), "EA5E2_TARGET_T_INVALID");
  const databaseUrl = required("DATABASE_URL");
  assertIsolatedDatabase(databaseUrl);
  const store = new Ea5e2PrivateTransientR2StoreV1({ subject_sha: subject, namespace: namespaceFor(target) });
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-ea5e2-private-r2-${mode.toLowerCase()}` });
  const slot = slotAuthority(target);
  const orchestrator = new McftCap09ExternalFormalCollectorPhaseOrchestratorV1(slot);
  const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, store);
  await ensureFactsSchema(pool);

  try {
    if (mode === "PRE_BOUNDARY_CAUSAL") {
      await sleepUntil(slot.pre_boundary_causal_collector_target);
      const phaseRequestedAt = new Date().toISOString();
      if (Date.parse(phaseRequestedAt) > Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES))) throw new Error("EA5E2_PREBOUNDARY_MINIMUM_INGRESS_MARGIN_LOST_BEFORE_GFS");

      const gfsTransport = new PythonGfsRawBundleTransportV1(target);
      const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
        dataset_id: `mcft_cap09_ea5e2_live_gfs_${target}`,
        scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
        request: { request_id: `ea5e2-live-gfs-${crypto.randomUUID()}`, provider_id: "NOAA_NCEP_NOMADS_GFS", source_family: "GFS_PGRB2_SFLUX_RAW_BUNDLE", locator: GFS_ROOT, allowed_final_hosts: ["nomads.ncep.noaa.gov"], use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1", requested_at: phaseRequestedAt, expected_content_type_prefixes: ["application/x-tar"], limitations: ["EA5E2_PRIVATE_TRANSIENT_RAW_BUNDLE", "NO_FORMAL_RAW_PREFIX_WRITE", "NO_PUBLIC_VALUE_ARTIFACT"] },
      }, { transport: gfsTransport, retention: store, decoder: new PythonGfsRawBundleDecoderV1(target) });
      if (gfsResults.length !== 2) throw new Error("EA5E2_PREBOUNDARY_GFS_PAIR_REQUIRED");

      await sleepUntil(addMinutes(target, -SOIL_FIRST_FETCH_BEFORE_T_MINUTES));
      let soilResult: CanonicalizedExternalEvidenceResultV1 | null = null;
      let soilRequestCount = 0;
      const soilWindowStart = Date.parse(addMinutes(target, -SOIL_WINDOW_MINUTES));
      const latestIngressStartMs = Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES));
      while (Date.now() < latestIngressStartMs) {
        const prefetched = await prefetchLiveKbsVariate25RawV1();
        soilRequestCount += 1;
        const results = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({ dataset_id: `mcft_cap09_ea5e2_live_soil_${target}`, scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, request: prefetched.request }, { transport: new OneShotSoilTransportV1(prefetched), retention: store, decoder: new KbsVariate25SoilEvidenceDecoderV1() });
        if (results.length !== 1 || results[0].record.record_type !== "soil_moisture_observation_v1") throw new Error("EA5E2_PREBOUNDARY_SOIL_RESULT_REQUIRED");
        const observedAt = Date.parse(String(results[0].record.role_time.observed_at));
        if (observedAt >= soilWindowStart && observedAt <= Date.parse(target)) { soilResult = results[0]; break; }
        if (Date.now() + MINUTE >= latestIngressStartMs) break;
        await sleep(MINUTE);
      }
      if (!soilResult) throw new Error("EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW");
      const canonicalizedAt = new Date().toISOString();
      if (Date.parse(canonicalizedAt) > latestIngressStartMs) throw new Error("EA5E2_PREBOUNDARY_MINIMUM_INGRESS_MARGIN_LOST");
      const allPre = [...gfsResults, soilResult];
      const result = await orchestrator.ingestCanonicalizedPhase({ phase: "PRE_BOUNDARY_CAUSAL", requested_at: phaseRequestedAt, canonicalized_at: canonicalizedAt, provider_request_count: gfsTransport.provider_request_count + soilRequestCount, canonical_results: allPre, ingress });
      if (result.canonical_record_count !== 3 || result.canonical_fact_write_count !== 3) throw new Error("EA5E2_PREBOUNDARY_THREE_FACTS_REQUIRED");
      const gfsIngestedAt = String(gfsResults[0].record.role_time.ingested_at);
      if (gfsResults.some((item) => String(item.record.role_time.ingested_at) !== gfsIngestedAt)) throw new Error("EA5E2_PREBOUNDARY_GFS_INGESTED_AT_PAIR_MISMATCH");
      writeSafe(PRE_OUTPUT, {
        schema_version: "geox_mcft_cap09_ea5e2_live_provider_preboundary_safe_proof_v2",
        status: "PASS",
        subject_sha: subject,
        target_logical_time: target,
        phase_requested_at: phaseRequestedAt,
        phase_canonicalized_at: canonicalizedAt,
        minimum_ingress_margin_minutes: MIN_INGRESS_MARGIN_MINUTES,
        provider_request_count: result.provider_request_count,
        raw_provider_object_count: Number(gfsTransport.safe_meta?.raw_provider_object_count ?? 0) + soilRequestCount,
        raw_retention_refs: result.raw_retention_refs,
        record_types: result.record_types,
        source_record_ids: result.source_record_ids,
        canonical_fact_write_count: result.canonical_fact_write_count,
        soil_observation_inside_t_minus_15_to_t: true,
        gfs_same_cycle_pair: true,
        rehydration_manifest: {
          expected_records: semanticRows(allPre),
          gfs: { provenance: gfsResults[0].raw_provenance, ingested_at: gfsIngestedAt },
          soil: { provenance: soilResult.raw_provenance },
        },
        transient_root_prefix: TRANSIENT_ROOT_PREFIX,
        transient_private_r2_put_count: store.put_count,
        formal_raw_prefix_write_count: 0,
        public_value_artifact_count: 0,
        raw_values_emitted: false,
        formal_database_write_count: 0,
        formal_r2_write_count: 0,
        formal_window_started: false,
      });
      return;
    }

    const preProof = JSON.parse(fs.readFileSync(PRE_OUTPUT, "utf8")) as Record<string, unknown>;
    if (preProof.status !== "PASS" || preProof.subject_sha !== subject || preProof.target_logical_time !== target) throw new Error("EA5E2_LATE_PREBOUNDARY_SAFE_PROOF_IDENTITY_REQUIRED");
    const rehydrated = await rehydratePreBoundary({ pool, store, target, proof: preProof });
    if (rehydrated.write_count !== 3 || Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n) !== 3) throw new Error("EA5E2_LATE_REHYDRATED_PREBOUNDARY_THREE_FACTS_REQUIRED");

    await sleepUntil(slot.late_exact_hour_collector_scheduled);
    const phaseRequestedAt = new Date().toISOString();
    const latestIngressStartMs = Date.parse(addMinutes(slot.late_exact_hour_evidence_cutoff, -MIN_INGRESS_MARGIN_MINUTES));
    if (Date.parse(phaseRequestedAt) > latestIngressStartMs) throw new Error("EA5E2_LATE_MINIMUM_INGRESS_MARGIN_LOST_BEFORE_FETCH");
    const transport = new KbsRawHourlyTransportV1();
    const lateResults = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1({
      dataset_id: `mcft_cap09_ea5e2_live_kbs_exact_${target}`,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: { request_id: `ea5e2-live-kbs-late-${crypto.randomUUID()}`, provider_id: "KBS_LTER", source_family: "RAW_HOURLY_WEATHER", locator: KBS_RAW_HOURLY_URL, allowed_final_hosts: ["lter.kbs.msu.edu"], use_policy_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1", requested_at: phaseRequestedAt, source_event_time: target, expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"], limitations: ["EA5E2_PRIVATE_TRANSIENT_RAW_HOURLY", "NO_FORMAL_RAW_PREFIX_WRITE", "NO_PUBLIC_VALUE_ARTIFACT"] },
    }, { transport, retention: store, decoder: new PythonKbsLateDecoderV1(target) });
    const canonicalizedAt = new Date().toISOString();
    if (Date.parse(canonicalizedAt) > latestIngressStartMs) throw new Error("EA5E2_LATE_MINIMUM_INGRESS_MARGIN_LOST");
    const result = await orchestrator.ingestCanonicalizedPhase({ phase: "LATE_EXACT_HOUR", requested_at: phaseRequestedAt, canonicalized_at: canonicalizedAt, provider_request_count: transport.provider_request_count, canonical_results: lateResults, ingress });
    if (result.canonical_record_count !== 2 || result.canonical_fact_write_count !== 2) throw new Error("EA5E2_LATE_TWO_FACTS_REQUIRED");

    const dbSource = await new PostgresExternalFormalEvidenceSourceV1(pool).loadCandidateRecords({ scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, logical_time: target, exact_interval_availability_cutoff_time: slot.late_exact_hour_evidence_cutoff });
    if (dbSource.selected_record_count !== 5 || dbSource.database_write_count !== 0 || dbSource.provider_request_count !== 0) throw new Error("EA5E2_LIVE_DB_ONLY_FIVE_FAMILY_HANDOFF_REQUIRED");
    const byType = new Map(dbSource.records.map((record) => [record.record_type, record]));
    const weather = byType.get("future_weather_assumption_v1");
    const futureEt0 = byType.get("future_et0_assumption_v1");
    if (!weather || !futureEt0 || weather.role_time.issued_at !== futureEt0.role_time.issued_at) throw new Error("EA5E2_LIVE_GFS_SAME_CYCLE_DB_HANDOFF_REQUIRED");
    const exactFactCount = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (exactFactCount !== 5) throw new Error(`EA5E2_LIVE_EXACT_FIVE_FACTS_REQUIRED:${exactFactCount}`);

    writeSafe(LATE_OUTPUT, {
      schema_version: "geox_mcft_cap09_ea5e2_live_provider_two_phase_safe_proof_v2",
      status: "PASS",
      subject_sha: subject,
      target_logical_time: target,
      phase_requested_at: phaseRequestedAt,
      phase_canonicalized_at: canonicalizedAt,
      late_exact_hour_scheduled: slot.late_exact_hour_collector_scheduled,
      late_exact_hour_cutoff: slot.late_exact_hour_evidence_cutoff,
      minimum_ingress_margin_minutes: MIN_INGRESS_MARGIN_MINUTES,
      pre_rehydrated_fact_count: rehydrated.write_count,
      pre_rehydration_semantic_hash_match: true,
      pre_rehydration_provider_request_count: 0,
      pre_raw_retention_reverified: true,
      transient_private_r2_get_count: store.get_count,
      transient_private_r2_put_count: store.put_count,
      formal_raw_prefix_write_count: 0,
      public_value_artifact_count: 0,
      late_provider_request_count: result.provider_request_count,
      late_raw_retention_refs: result.raw_retention_refs,
      late_record_types: result.record_types,
      late_source_record_ids: result.source_record_ids,
      late_canonical_fact_write_count: result.canonical_fact_write_count,
      database_exact_fact_count: exactFactCount,
      db_only_selected_record_count: dbSource.selected_record_count,
      db_only_family_cardinality: dbSource.family_cardinality,
      db_only_provider_request_count: dbSource.provider_request_count,
      db_only_database_write_count: dbSource.database_write_count,
      same_gfs_cycle_future_weather_et0: true,
      exact_rain_et0_interval_t_minus_1_to_t: true,
      post_t_future_forcing_excluded: true,
      raw_values_emitted: false,
      formal_database_write_count: 0,
      formal_r2_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      formal_window_started: false,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}:${error.message}` : String(error));
  process.exitCode = 1;
});
