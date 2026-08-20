// Purpose: read-only producer-bound recovery of rolling transient raw Evidence for Formal promotion.
// Boundary: HEAD/GET only. No PUT/DELETE, no provider request, no canonicalization, no database write.

import crypto from "node:crypto";
import https from "node:https";

export const MCFT_CAP09_TRANSIENT_RAW_ROOT_PREFIX_V1 = "mcft-cap09-ea5e2-readiness-transient-v1" as const;
export const MCFT_CAP09_FORMAL_RAW_BUCKET_V1 = "geox-mcft-cap09-formal-raw-v1" as const;
export const MCFT_CAP09_TRANSIENT_RAW_CLASS_V1 = "EA5E2_PRIVATE_TRANSIENT_QUALIFICATION_DATA" as const;

export type ProducerBoundTransientRawReferenceV1 = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
};

export type ProducerBoundTransientRawReadV1 = ProducerBoundTransientRawReferenceV1 & {
  retained_at: string;
  bytes: Uint8Array;
};

export type ProducerBoundTransientRawReaderConfigV1 = {
  producer_subject_sha: string;
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  clock?: () => Date;
};

type SignedResponseV1 = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function sha256HexV1(value: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256V1(value: Buffer | Uint8Array | string): string {
  return `sha256:${sha256HexV1(value)}`;
}

function hmacV1(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKeyV1(secret: string, date: string, region: string): Buffer {
  const dateKey = hmacV1(`AWS4${secret}`, date);
  const regionKey = hmacV1(dateKey, region);
  const serviceKey = hmacV1(regionKey, "s3");
  return hmacV1(serviceKey, "aws4_request");
}

function uriEncodeV1(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodedPathV1(bucket: string, key: string): string {
  return `/${uriEncodeV1(bucket)}/${key.split("/").map(uriEncodeV1).join("/")}`;
}

function amzTimestampV1(date: Date): { amz_date: string; short_date: string } {
  if (!Number.isFinite(date.getTime())) throw new Error("AM19_TRANSIENT_RAW_CLOCK_INVALID");
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz_date: amzDate, short_date: amzDate.slice(0, 8) };
}

function rawDigestHexV1(value: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(value);
  if (!match) throw new Error("AM19_TRANSIENT_RAW_SHA256_INVALID");
  return match[1];
}

export class ProducerBoundTransientRawEvidenceReaderV1 {
  private readonly subject: string;
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly clock: () => Date;
  head_count = 0;
  get_count = 0;
  put_count = 0;
  delete_count = 0;
  provider_request_count = 0;

  constructor(config: ProducerBoundTransientRawReaderConfigV1) {
    this.subject = requiredTextV1(config.producer_subject_sha, "AM19_TRANSIENT_RAW_SUBJECT_REQUIRED");
    if (!/^[0-9a-f]{40}$/.test(this.subject)) throw new Error("AM19_TRANSIENT_RAW_EXACT_SUBJECT_REQUIRED");
    this.endpoint = new URL(requiredTextV1(config.endpoint, "AM19_TRANSIENT_RAW_ENDPOINT_REQUIRED"));
    if (this.endpoint.protocol !== "https:" || this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash) {
      throw new Error("AM19_TRANSIENT_RAW_REMOTE_HTTPS_ENDPOINT_REQUIRED");
    }
    if (["localhost", "127.0.0.1", "::1"].includes(this.endpoint.hostname) || this.endpoint.hostname.endsWith(".local")) {
      throw new Error("AM19_TRANSIENT_RAW_REMOTE_ENDPOINT_REQUIRED");
    }
    this.bucket = requiredTextV1(config.bucket, "AM19_TRANSIENT_RAW_BUCKET_REQUIRED");
    if (this.bucket !== MCFT_CAP09_FORMAL_RAW_BUCKET_V1) throw new Error("AM19_TRANSIENT_RAW_EXISTING_PRIVATE_BUCKET_REQUIRED");
    this.region = requiredTextV1(config.region, "AM19_TRANSIENT_RAW_REGION_REQUIRED");
    this.accessKeyId = requiredTextV1(config.access_key_id, "AM19_TRANSIENT_RAW_ACCESS_KEY_REQUIRED");
    this.secretAccessKey = requiredTextV1(config.secret_access_key, "AM19_TRANSIENT_RAW_SECRET_KEY_REQUIRED");
    this.clock = config.clock ?? (() => new Date());
  }

  private keyFromRefV1(ref: string, digest: string): string {
    let parsed: URL;
    try { parsed = new URL(requiredTextV1(ref, "AM19_TRANSIENT_RAW_REF_REQUIRED")); }
    catch { throw new Error("AM19_TRANSIENT_RAW_REF_INVALID"); }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.bucket) throw new Error("AM19_TRANSIENT_RAW_REF_BUCKET_MISMATCH");
    const key = parsed.pathname.replace(/^\/+/, "");
    const prefix = `${MCFT_CAP09_TRANSIENT_RAW_ROOT_PREFIX_V1}/${this.subject}/`;
    if (!key.startsWith(prefix)) throw new Error("AM19_TRANSIENT_RAW_PRODUCER_PREFIX_MISMATCH");
    if (key.startsWith("mcft-cap09-formal-raw-v1/sha256/")) throw new Error("AM19_TRANSIENT_RAW_FORMAL_PREFIX_FORBIDDEN");
    if (!key.endsWith(`/sha256/${rawDigestHexV1(digest)}`)) throw new Error("AM19_TRANSIENT_RAW_KEY_DIGEST_MISMATCH");
    return key;
  }

  private headerV1(headers: Record<string, string | string[] | undefined>, name: string): string {
    const value = headers[name.toLowerCase()];
    return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  }

  private async requestV1(method: "HEAD" | "GET", key: string): Promise<SignedResponseV1> {
    const payloadHash = sha256HexV1(Buffer.alloc(0));
    const { amz_date: amzDate, short_date: shortDate } = amzTimestampV1(this.clock());
    const requestPath = `${this.endpoint.pathname.replace(/\/$/, "")}${encodedPathV1(this.bucket, key)}`;
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name]!.trim()}\n`).join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [method, requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256HexV1(canonicalRequest)].join("\n");
    const signature = crypto.createHmac("sha256", signingKeyV1(this.secretAccessKey, shortDate, this.region)).update(stringToSign, "utf8").digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await new Promise<SignedResponseV1>((resolve, reject) => {
      const req = https.request({
        protocol: this.endpoint.protocol,
        hostname: this.endpoint.hostname,
        port: this.endpoint.port || undefined,
        method,
        path: requestPath,
        headers,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string | string[] | undefined>, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.setTimeout(60_000, () => req.destroy(new Error("AM19_TRANSIENT_RAW_REQUEST_TIMEOUT")));
      req.end();
    });
    if (response.status !== 200) throw new Error(`AM19_TRANSIENT_RAW_${method}_STATUS_${response.status}`);
    if (method === "HEAD") this.head_count += 1;
    else this.get_count += 1;
    return response;
  }

  private validateHeadV1(input: ProducerBoundTransientRawReferenceV1, key: string, response: SignedResponseV1): string {
    const bytes = Number(this.headerV1(response.headers, "content-length"));
    if (!Number.isSafeInteger(bytes) || bytes !== input.retained_bytes) throw new Error("AM19_TRANSIENT_RAW_RETAINED_BYTES_MISMATCH");
    if (this.headerV1(response.headers, "x-amz-meta-geox-sha256") !== input.retained_sha256) throw new Error("AM19_TRANSIENT_RAW_RETAINED_SHA_MISMATCH");
    if (this.headerV1(response.headers, "x-amz-meta-geox-retention-class") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("AM19_TRANSIENT_RAW_RETENTION_CLASS_MISMATCH");
    if (this.headerV1(response.headers, "x-amz-meta-geox-ea5e2-class") !== MCFT_CAP09_TRANSIENT_RAW_CLASS_V1) throw new Error("AM19_TRANSIENT_RAW_EA5E2_CLASS_MISMATCH");
    const retainedAt = canonicalIsoV1(this.headerV1(response.headers, "x-amz-meta-geox-retained-at"), "AM19_TRANSIENT_RAW_RETAINED_AT_INVALID");
    if (!key.endsWith(`/sha256/${rawDigestHexV1(input.retained_sha256)}`)) throw new Error("AM19_TRANSIENT_RAW_HEAD_KEY_DIGEST_MISMATCH");
    return retainedAt;
  }

  async readRetainedRawEvidence(input: ProducerBoundTransientRawReferenceV1): Promise<ProducerBoundTransientRawReadV1> {
    if (!Number.isSafeInteger(input.retained_bytes) || input.retained_bytes <= 0) throw new Error("AM19_TRANSIENT_RAW_RETAINED_BYTES_INVALID");
    rawDigestHexV1(input.retained_sha256);
    const key = this.keyFromRefV1(input.retention_ref, input.retained_sha256);
    const head = await this.requestV1("HEAD", key);
    const retainedAt = this.validateHeadV1(input, key, head);
    const get = await this.requestV1("GET", key);
    if (get.body.byteLength !== input.retained_bytes || sha256V1(get.body) !== input.retained_sha256) {
      throw new Error("AM19_TRANSIENT_RAW_GET_DIGEST_OR_LENGTH_MISMATCH");
    }
    return { ...input, retained_at: retainedAt, bytes: new Uint8Array(get.body) };
  }
}
