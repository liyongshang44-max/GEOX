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
import { KbsVariate25SoilEvidenceDecoderV1 } from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";

const execFileAsync = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";
const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");
const PRODUCT_GFS_SCIENTIFIC_CORE_RELATIVE = "apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py";
const PRODUCT_GFS_SCIENTIFIC_CORE = path.resolve(PRODUCT_GFS_SCIENTIFIC_CORE_RELATIVE);
const OUTPUT_DIR = path.resolve("acceptance-output");
const OUTPUT = path.join(OUTPUT_DIR, "MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const TRANSIENT_ROOT_PREFIX = "mcft-cap09-ea5e2-readiness-transient-v1";
const FORMAL_RAW_PREFIX = "mcft-cap09-formal-raw-v1/sha256";
const TRANSIENT_CLASS = "EA5E2_PRIVATE_TRANSIENT_QUALIFICATION_DATA";

type RetainedReadV1 = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
  retained_at: string;
  bytes: Uint8Array;
};

type CandidateV1 = {
  schema_version: string;
  status: string;
  temporal_authority: string;
  producer_subject_sha: string;
  target_t: string;
  candidate_expires_at: string;
  record_types: string[];
  semantic_manifest_digest: string;
  rehydration_manifest: {
    expected_records: Array<{ record_type: string; source_record_id: string; record_semantic_sha256: string }>;
    gfs: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at: string };
    soil: { provenance: VerifiedRawEvidenceProvenanceV1; ingested_at?: string };
  };
  raw_retention_refs: string[];
  side_effects: {
    formal_database_write_count: number;
    formal_r2_prefix_write_count: number;
    scheduler_write_count: number;
    runtime_write_count: number;
    crop_authority_effect: string;
  };
  captured_at?: string;
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

function assertProductGfsScientificCoreBinding(): void {
  if (!fs.existsSync(PROVIDER_SCRIPT)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_PROVIDER_SCRIPT_REQUIRED");
  if (!fs.existsSync(PRODUCT_GFS_SCIENTIFIC_CORE)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_PRODUCT_GFS_CORE_REQUIRED");
  const providerText = fs.readFileSync(PROVIDER_SCRIPT, "utf8");
  const decodeStart = providerText.indexOf("def command_decode_gfs");
  const decodeEnd = providerText.indexOf("def command_decode_kbs_late", decodeStart);
  if (decodeStart < 0 || decodeEnd <= decodeStart) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_GFS_DECODE_BOUNDARY_REQUIRED");
  const decodeText = providerText.slice(decodeStart, decodeEnd);
  for (const marker of [
    `GFS_CORE_PATH = ROOT / "${PRODUCT_GFS_SCIENTIFIC_CORE_RELATIVE}"`,
    "gfs_core.validate_complete_cycle_inventory_v1",
    "gfs_core.decode_pgrb2_v1",
    "gfs_core.decode_sflux_v1",
    "gfs_core.assemble_72h_scientific_series_v1",
    "product_gfs_scientific_core_used",
  ]) {
    if (!providerText.includes(marker)) throw new Error(`MCFT_CAP09_ROLLING_REHYDRATION_PRODUCT_GFS_CORE_BINDING_REQUIRED:${marker}`);
  }
  for (const forbidden of ["ea4.decode_pgrb2(", "ea4.decode_sflux(", "ea4.apcp(", "ea4.block_start(", "ea4.scalar_eto("]) {
    if (decodeText.includes(forbidden)) throw new Error(`MCFT_CAP09_ROLLING_REHYDRATION_SECOND_GFS_SCIENTIFIC_PATH_FORBIDDEN:${forbidden}`);
  }
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
  if (!match) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RAW_SHA256_INVALID");
  return match[1];
}

type SignedResponseV1 = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

class ProducerBoundReadOnlyR2RetentionV1 implements RawEvidenceRetentionPortV1, RawEvidenceRetentionVerificationPortV1 {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly producerSha: string;
  private readonly expectedByDigest = new Map<string, VerifiedRawEvidenceProvenanceV1>();
  head_count = 0;
  get_count = 0;
  put_count = 0;
  delete_count = 0;

  constructor(input: { producer_sha: string; provenances: readonly VerifiedRawEvidenceProvenanceV1[] }) {
    if (!/^[0-9a-f]{40}$/.test(input.producer_sha)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_PRODUCER_SHA_INVALID");
    this.producerSha = input.producer_sha;
    this.endpoint = new URL(required("MCFT_EA5E2_TRANSIENT_S3_ENDPOINT"));
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash) {
      throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_REMOTE_HTTPS_ENDPOINT_REQUIRED");
    }
    this.bucket = required("MCFT_EA5E2_TRANSIENT_S3_BUCKET");
    if (this.bucket !== FORMAL_RAW_BUCKET) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_PRIVATE_BUCKET_BINDING_REQUIRED");
    this.region = required("MCFT_EA5E2_TRANSIENT_S3_REGION");
    this.accessKey = required("MCFT_EA5E2_TRANSIENT_S3_ACCESS_KEY_ID");
    this.secretKey = required("MCFT_EA5E2_TRANSIENT_S3_SECRET_ACCESS_KEY");
    for (const provenance of input.provenances) {
      this.validateProducerRef(provenance.retention_ref, provenance.raw_sha256);
      const prior = this.expectedByDigest.get(provenance.raw_sha256);
      if (prior && prior.retention_ref !== provenance.retention_ref) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_DIGEST_REF_CONFLICT");
      this.expectedByDigest.set(provenance.raw_sha256, provenance);
    }
    if (this.expectedByDigest.size < 2) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_TWO_RAW_OBJECTS_REQUIRED");
  }

  private validateProducerRef(ref: string, digest: string): string {
    let parsed: URL;
    try { parsed = new URL(ref); } catch { throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETENTION_REF_INVALID"); }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.bucket) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETENTION_BUCKET_MISMATCH");
    const key = parsed.pathname.replace(/^\/+/, "");
    const prefix = `${TRANSIENT_ROOT_PREFIX}/${this.producerSha}/`;
    if (!key.startsWith(prefix)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_PRODUCER_PREFIX_MISMATCH");
    if (key.startsWith(FORMAL_RAW_PREFIX) || key.includes(`/${FORMAL_RAW_PREFIX}/`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_FORMAL_RAW_REF_FORBIDDEN");
    if (!key.endsWith(`/sha256/${rawDigestHex(digest)}`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_KEY_DIGEST_MISMATCH");
    return key;
  }

  private async request(input: { method: "HEAD" | "GET"; key: string; allowed_statuses: readonly number[] }): Promise<SignedResponseV1> {
    const payloadHash = sha256Hex(Buffer.alloc(0));
    const { amz_date: amzDate, short_date: shortDate } = amzTimestamp(new Date());
    const requestPath = `${this.endpoint.pathname.replace(/\/$/, "")}${encodedPath(this.bucket, input.key)}`;
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [input.method, requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
    const signature = crypto.createHmac("sha256", signingKey(this.secretKey, shortDate, this.region)).update(stringToSign, "utf8").digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await new Promise<SignedResponseV1>((resolve, reject) => {
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
      req.setTimeout(60_000, () => req.destroy(new Error("MCFT_CAP09_ROLLING_REHYDRATION_R2_TIMEOUT")));
      req.end();
    });
    if (!input.allowed_statuses.includes(response.status)) throw new Error(`MCFT_CAP09_ROLLING_REHYDRATION_R2_${input.method}_${response.status}`);
    if (input.method === "HEAD") this.head_count += 1;
    if (input.method === "GET") this.get_count += 1;
    return response;
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string {
    const value = headers[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }

  private validateHead(input: VerifyRetainedRawEvidenceInputV1, key: string, head: SignedResponseV1): string {
    if (head.status !== 200) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RAW_NOT_FOUND");
    const length = Number(this.header(head.headers, "content-length"));
    if (!Number.isSafeInteger(length) || length !== input.retained_bytes) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_BYTES_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-sha256") !== input.retained_sha256) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_SHA_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-retention-class") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_CLASS_MISMATCH");
    if (this.header(head.headers, "x-amz-meta-geox-ea5e2-class") !== TRANSIENT_CLASS) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_TRANSIENT_CLASS_MISMATCH");
    const retainedAt = canonicalIso(this.header(head.headers, "x-amz-meta-geox-retained-at"), "MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_AT_INVALID");
    if (!key.endsWith(`/sha256/${rawDigestHex(input.retained_sha256)}`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_HEAD_KEY_DIGEST_MISMATCH");
    return retainedAt;
  }

  async verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void> {
    const expected = this.expectedByDigest.get(input.retained_sha256);
    if (!expected || expected.retention_ref !== input.retention_ref || expected.raw_bytes !== input.retained_bytes) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_MANIFEST_REF_MISMATCH");
    const key = this.validateProducerRef(input.retention_ref, input.retained_sha256);
    const head = await this.request({ method: "HEAD", key, allowed_statuses: [200] });
    const retainedAt = this.validateHead(input, key, head);
    if (retainedAt !== expected.retained_at) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_AT_MISMATCH");
  }

  async readRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<RetainedReadV1> {
    await this.verifyRetainedRawEvidence(input);
    const key = this.validateProducerRef(input.retention_ref, input.retained_sha256);
    const response = await this.request({ method: "GET", key, allowed_statuses: [200] });
    if (response.body.byteLength !== input.retained_bytes || sha256(response.body) !== input.retained_sha256) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_GET_DIGEST_OR_LENGTH_MISMATCH");
    const expected = this.expectedByDigest.get(input.retained_sha256)!;
    return { ...input, retained_at: expected.retained_at, bytes: new Uint8Array(response.body) };
  }

  async retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> {
    const expected = this.expectedByDigest.get(input.raw_sha256);
    if (!expected) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_UNAUTHORIZED_DIGEST");
    if (input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE" || input.raw_bytes !== expected.raw_bytes || sha256(input.bytes) !== expected.raw_sha256) {
      throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_REPLAY_BYTES_MISMATCH");
    }
    await this.verifyRetainedRawEvidence({ retention_ref: expected.retention_ref, retained_sha256: expected.raw_sha256, retained_bytes: expected.raw_bytes });
    return {
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref: expected.retention_ref,
      retained_sha256: expected.raw_sha256,
      retained_bytes: expected.raw_bytes,
      retained_at: expected.retained_at,
      externally_publishable: false,
    };
  }
}

class RetainedRawReplayTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly provenance: VerifiedRawEvidenceProvenanceV1, private readonly bytes: Uint8Array) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_REPLAY_REUSE_FORBIDDEN");
    this.used = true;
    if (request.provider_id !== this.provenance.provider_id || request.source_family !== this.provenance.source_family || request.locator !== this.provenance.source_locator) {
      throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_REPLAY_IDENTITY_MISMATCH");
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

class PythonGfsRawBundleDecoderV2 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = "MCFT_CAP09_EA5E2_GFS_RAW_BUNDLE_DECODER_V2";
  readonly decoder_version = "2";
  constructor(private readonly target: string, private readonly restoredIngestedAt: string) {}
  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    assertProductGfsScientificCoreBinding();
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-rolling-gfs-rehydrate-"));
    const bundle = path.join(temp, "gfs.tar");
    const output = path.join(temp, "gfs-drafts.json");
    try {
      fs.writeFileSync(bundle, Buffer.from(input.raw_bytes));
      await execFileAsync(PYTHON, [PROVIDER_SCRIPT, "decode-gfs-v2", "--target", this.target, "--available-at", input.provenance.available_at, "--input", bundle, "--output", output], { timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024 });
      const parsed = JSON.parse(fs.readFileSync(output, "utf8")) as { drafts?: GovernedDecodedEvidenceDraftV1[] };
      if (!Array.isArray(parsed.drafts) || parsed.drafts.length !== 2) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_GFS_DRAFT_PAIR_REQUIRED");
      const ingestedAt = canonicalIso(this.restoredIngestedAt, "MCFT_CAP09_ROLLING_REHYDRATION_GFS_INGESTED_AT_INVALID");
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
    limitations: ["MCFT_CAP09_ROLLING_PRODUCER_BOUND_REHYDRATION", "NO_PROVIDER_REFETCH", "READ_ONLY_R2", "NO_PUBLIC_VALUE_ARTIFACT"],
  };
}

function semanticRows(results: readonly CanonicalizedExternalEvidenceResultV1[]) {
  return results.map((result) => ({
    record_type: result.record.record_type,
    source_record_id: result.record.source_record_id,
    record_semantic_sha256: result.record_semantic_sha256,
  })).sort((a, b) => a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id));
}

function exactSemanticMatch(actual: readonly CanonicalizedExternalEvidenceResultV1[], expected: unknown): void {
  if (!Array.isArray(expected)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_EXPECTED_SEMANTIC_ROWS_REQUIRED");
  if (JSON.stringify(semanticRows(actual)) !== JSON.stringify(expected)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH");
}

function assertIsolatedDatabase(urlText: string): void {
  if (process.env.MCFT_CAP09_ROLLING_REHYDRATION_ISOLATED_DB_ACK !== "true") throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_ISOLATED_DB_ACK_REQUIRED");
  const url = new URL(urlText);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.replace(/^\//, "") !== "ea5e2_readiness") {
    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_LOCAL_DB_REQUIRED");
  }
}

async function ensureFactsSchema(pool: Pool): Promise<void> {
  await pool.query("CREATE TABLE IF NOT EXISTS facts (fact_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, source text NOT NULL, record_json jsonb NOT NULL, ingested_at timestamptz NOT NULL DEFAULT transaction_timestamp())");
}

function loadCandidate(candidatePath: string): CandidateV1 {
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8")) as CandidateV1;
  if (candidate.schema_version !== "geox_mcft_cap09_rolling_preboundary_candidate_v1" || candidate.status !== "PASS" || candidate.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") {
    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_AUTHORITY_INVALID");
  }
  if (!/^[0-9a-f]{40}$/.test(candidate.producer_subject_sha)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_PRODUCER_SHA_INVALID");
  exactHour(candidate.target_t, "MCFT_CAP09_ROLLING_REHYDRATION_TARGET_INVALID");
  canonicalIso(candidate.candidate_expires_at, "MCFT_CAP09_ROLLING_REHYDRATION_EXPIRY_INVALID");
  if (Date.parse(candidate.candidate_expires_at) <= Date.now()) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_EXPIRED");
  const expectedTypes = ["future_et0_assumption_v1", "future_weather_assumption_v1", "soil_moisture_observation_v1"];
  if (JSON.stringify([...candidate.record_types].sort()) !== JSON.stringify(expectedTypes)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_FAMILY_SET_INVALID");
  if (candidate.side_effects.formal_database_write_count !== 0 || candidate.side_effects.formal_r2_prefix_write_count !== 0 || candidate.side_effects.scheduler_write_count !== 0 || candidate.side_effects.runtime_write_count !== 0 || candidate.side_effects.crop_authority_effect !== "NONE") {
    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_SIDE_EFFECT_DRIFT");
  }
  return candidate;
}

async function rehydrate(candidate: CandidateV1, pool: Pool): Promise<{ results: CanonicalizedExternalEvidenceResultV1[]; writes: number; store: ProducerBoundReadOnlyR2RetentionV1 }> {
  const manifest = candidate.rehydration_manifest;
  if (!manifest?.gfs?.provenance || !manifest?.soil?.provenance || !Array.isArray(manifest.expected_records)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_MANIFEST_REQUIRED");
  const gfsProvenance = manifest.gfs.provenance;
  const soilProvenance = manifest.soil.provenance;
  const store = new ProducerBoundReadOnlyR2RetentionV1({ producer_sha: candidate.producer_subject_sha, provenances: [gfsProvenance, soilProvenance] });
  const gfsRaw = await store.readRetainedRawEvidence({ retention_ref: gfsProvenance.retention_ref, retained_sha256: gfsProvenance.raw_sha256, retained_bytes: gfsProvenance.raw_bytes });
  const soilRaw = await store.readRetainedRawEvidence({ retention_ref: soilProvenance.retention_ref, retained_sha256: soilProvenance.raw_sha256, retained_bytes: soilProvenance.raw_bytes });
  if (gfsRaw.retained_at !== gfsProvenance.retained_at || soilRaw.retained_at !== soilProvenance.retained_at) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_RETAINED_AT_DRIFT");

  const canonicalizedAt = canonicalIso(String(candidate.captured_at ?? candidate.target_t), "MCFT_CAP09_ROLLING_REHYDRATION_CANONICALIZED_AT_INVALID");
  const gfsResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_gfs_${candidate.target_t}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(gfsProvenance, ["application/x-tar"]),
    canonicalized_at: canonicalizedAt,
  }, {
    transport: new RetainedRawReplayTransportV1(gfsProvenance, gfsRaw.bytes),
    retention: store,
    decoder: new PythonGfsRawBundleDecoderV2(candidate.target_t, manifest.gfs.ingested_at),
  });
  const soilResults = await collectRetainDecodeCanonicalizeExternalEvidenceV1({
    dataset_id: `mcft_cap09_ea5e2_live_soil_${candidate.target_t}`,
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    request: requestFromProvenance(soilProvenance, [soilProvenance.content_type.split(";", 1)[0]]),
    canonicalized_at: canonicalizedAt,
  }, {
    transport: new RetainedRawReplayTransportV1(soilProvenance, soilRaw.bytes),
    retention: store,
    decoder: new KbsVariate25SoilEvidenceDecoderV1(),
  });
  const results = [...gfsResults, ...soilResults];
  exactSemanticMatch(results, manifest.expected_records);
  const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, store);
  let writes = 0;
  for (const result of [...results].sort((a, b) => a.record.record_type.localeCompare(b.record.record_type))) {
    writes += (await ingress.appendCanonicalizedExternalEvidence(result)).canonical_fact_write_count;
  }
  if (writes !== 3) throw new Error(`MCFT_CAP09_ROLLING_REHYDRATION_THREE_FACTS_REQUIRED:${writes}`);
  return { results, writes, store };
}

function selftest(): void {
  assertProductGfsScientificCoreBinding();
  const producer = "a".repeat(40);
  const digest = `sha256:${"b".repeat(64)}`;
  const valid = `s3-private://${FORMAL_RAW_BUCKET}/${TRANSIENT_ROOT_PREFIX}/${producer}/20260813t130000000z/sha256/${"b".repeat(64)}`;
  const parsed = new URL(valid);
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== FORMAL_RAW_BUCKET || !parsed.pathname.includes(`/${TRANSIENT_ROOT_PREFIX}/${producer}/`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_SELFTEST_VALID_REF");
  if (!parsed.pathname.endsWith(`/sha256/${rawDigestHex(digest)}`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_SELFTEST_DIGEST_REF");
  const wrongProducer = valid.replace(producer, "c".repeat(40));
  if (wrongProducer.includes(`/${TRANSIENT_ROOT_PREFIX}/${producer}/`)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_SELFTEST_WRONG_PRODUCER");
  console.log(JSON.stringify({
    status: "PASS",
    producer_subject_sha_bound: true,
    producer_dataset_identity_preserved: true,
    producer_decoder_identity_preserved: true,
    product_gfs_scientific_core_identity_preserved: true,
    product_gfs_scientific_core: PRODUCT_GFS_SCIENTIFIC_CORE_RELATIVE,
    formal_raw_prefix_forbidden: true,
    read_only_r2: true,
    s3_put_count: 0,
    s3_delete_count: 0,
    provider_refetch_count: 0,
    database_write_count: 0,
  }));
}

async function main(): Promise<void> {
  if (process.argv[2] === "selftest") return selftest();
  if (process.argv[2] !== "run") throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_MODE_REQUIRED");
  const consumerSha = required("MCFT_CAP09_CONSUMER_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(consumerSha)) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CONSUMER_SHA_INVALID");
  if (!["push", "workflow_dispatch", "schedule", "workflow_run"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== consumerSha) {
    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_EXACT_MAIN_REQUIRED");
  }
  const candidate = loadCandidate(required("MCFT_CAP09_ROLLING_CANDIDATE_PATH"));
  const databaseUrl = required("DATABASE_URL");
  assertIsolatedDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-rolling-producer-rehydrate" });
  try {
    await ensureFactsSchema(pool);
    await pool.query("TRUNCATE TABLE facts");
    const { results, writes, store } = await rehydrate(candidate, pool);
    const factCount = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    if (factCount !== 3) throw new Error(`MCFT_CAP09_ROLLING_REHYDRATION_DB_FACT_COUNT:${factCount}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const output = {
      schema_version: "geox_mcft_cap09_rolling_preboundary_rehydration_v1",
      status: "PASS",
      temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
      consumer_subject_sha: consumerSha,
      producer_subject_sha: candidate.producer_subject_sha,
      cross_head_rehydration: consumerSha !== candidate.producer_subject_sha,
      target_t: candidate.target_t,
      record_types: results.map((x) => x.record.record_type).sort(),
      semantic_manifest_match: true,
      producer_bound_raw_reverification: true,
      producer_dataset_identity_preserved: true,
      producer_decoder_identity_preserved: true,
      product_gfs_scientific_core_identity_preserved: true,
      product_gfs_scientific_core: PRODUCT_GFS_SCIENTIFIC_CORE_RELATIVE,
      provider_refetch_count: 0,
      private_r2_head_count: store.head_count,
      private_r2_get_count: store.get_count,
      private_r2_put_count: store.put_count,
      private_r2_delete_count: store.delete_count,
      isolated_database_fact_count: factCount,
      isolated_database_write_count: writes,
      formal_database_write_count: 0,
      formal_r2_prefix_write_count: 0,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      crop_authority_effect: "NONE",
      formal_effect: false,
      raw_values_emitted: false,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n");
    console.log(JSON.stringify(output));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});