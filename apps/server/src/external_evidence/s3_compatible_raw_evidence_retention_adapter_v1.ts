// MCFT-CAP-09 S6-EA5C1 durable private raw Evidence retention.
// Boundary: collector-side S3-compatible object persistence only. This module is not Runtime,
// never writes canonical facts, never decodes provider bytes, and never exposes presigned/public URLs.

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

import type {
  RawEvidenceRetentionInputV1,
  RawEvidenceRetentionPortV1,
  RawEvidenceRetentionReceiptV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";

export const MCFT_CAP09_FORMAL_RAW_RETENTION_ADAPTER_ID_V1 =
  "MCFT_CAP09_S3_COMPAT_PRIVATE_RAW_RETENTION_V1" as const;
export const MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1 =
  "mcft-cap09-formal-raw-v1/sha256" as const;

export type VerifyRetainedRawEvidenceInputV1 = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
};

export interface RawEvidenceRetentionVerificationPortV1 {
  verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void>;
}

export type S3CompatiblePrivateRawRetentionConfigV1 = {
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  allow_insecure_http_for_test?: boolean;
  clock?: () => Date;
};

type SignedResponseV1 = {
  status: number;
  headers: http.IncomingHttpHeaders;
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
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodedPathV1(bucket: string, key: string): string {
  return `/${uriEncodeV1(bucket)}/${key.split("/").map(uriEncodeV1).join("/")}`;
}

function amzTimestampV1(date: Date): { amz_date: string; short_date: string } {
  if (!Number.isFinite(date.getTime())) throw new Error("EA5C1_S3_CLOCK_INVALID");
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz_date: amzDate, short_date: amzDate.slice(0, 8) };
}

function rawDigestHexV1(value: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(value);
  if (!match) throw new Error("EA5C1_RAW_SHA256_INVALID");
  return match[1];
}

function retentionKeyV1(sha256: string): string {
  return `${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/${rawDigestHexV1(sha256)}`;
}

function retentionRefV1(bucket: string, key: string): string {
  return `s3-private://${bucket}/${key}`;
}

function keyFromRetentionRefV1(ref: string, bucket: string): string {
  let parsed: URL;
  try {
    parsed = new URL(requiredTextV1(ref, "EA5C1_RETENTION_REF_REQUIRED"));
  } catch {
    throw new Error("EA5C1_RETENTION_REF_INVALID");
  }
  if (parsed.protocol !== "s3-private:" || parsed.hostname !== bucket) {
    throw new Error("EA5C1_RETENTION_REF_AUTHORITY_MISMATCH");
  }
  const key = parsed.pathname.replace(/^\/+/, "");
  if (!key.startsWith(`${MCFT_CAP09_FORMAL_RAW_RETENTION_PREFIX_V1}/`)) {
    throw new Error("EA5C1_RETENTION_REF_PREFIX_MISMATCH");
  }
  return key;
}

export class S3CompatiblePrivateRawEvidenceRetentionAdapterV1
  implements RawEvidenceRetentionPortV1, RawEvidenceRetentionVerificationPortV1 {
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly clock: () => Date;

  constructor(config: S3CompatiblePrivateRawRetentionConfigV1) {
    this.endpoint = new URL(requiredTextV1(config.endpoint, "EA5C1_S3_ENDPOINT_REQUIRED"));
    if (this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash) {
      throw new Error("EA5C1_S3_ENDPOINT_CREDENTIAL_OR_QUERY_FORBIDDEN");
    }
    if (this.endpoint.protocol !== "https:" && !(this.endpoint.protocol === "http:" && config.allow_insecure_http_for_test === true)) {
      throw new Error("EA5C1_S3_HTTPS_REQUIRED");
    }
    this.bucket = requiredTextV1(config.bucket, "EA5C1_S3_BUCKET_REQUIRED");
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(this.bucket)) throw new Error("EA5C1_S3_BUCKET_INVALID");
    this.region = requiredTextV1(config.region, "EA5C1_S3_REGION_REQUIRED");
    this.accessKeyId = requiredTextV1(config.access_key_id, "EA5C1_S3_ACCESS_KEY_REQUIRED");
    this.secretAccessKey = requiredTextV1(config.secret_access_key, "EA5C1_S3_SECRET_KEY_REQUIRED");
    this.clock = config.clock ?? (() => new Date());
  }

  private async requestV1(input: {
    method: "PUT" | "HEAD";
    key: string;
    body?: Buffer;
    content_type?: string;
    metadata?: Record<string, string>;
    allowed_statuses: readonly number[];
  }): Promise<SignedResponseV1> {
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256HexV1(body);
    const now = this.clock();
    const { amz_date: amzDate, short_date: shortDate } = amzTimestampV1(now);
    const path = encodedPathV1(this.bucket, input.key);
    const basePath = this.endpoint.pathname.replace(/\/$/, "");
    const requestPath = `${basePath}${path}` || "/";
    const host = this.endpoint.host;

    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (input.method === "PUT") {
      headers["content-length"] = String(body.byteLength);
      headers["content-type"] = requiredTextV1(input.content_type, "EA5C1_S3_CONTENT_TYPE_REQUIRED");
    }
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      const normalized = key.toLowerCase();
      if (!/^x-amz-meta-[a-z0-9-]+$/.test(normalized)) throw new Error("EA5C1_S3_METADATA_KEY_INVALID");
      headers[normalized] = requiredTextV1(value, "EA5C1_S3_METADATA_VALUE_REQUIRED");
    }

    const headerNames = Object.keys(headers).sort();
    const canonicalHeaders = headerNames.map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const signedHeaders = headerNames.join(";");
    const canonicalRequest = [
      input.method,
      requestPath,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256HexV1(canonicalRequest),
    ].join("\n");
    const signature = crypto.createHmac("sha256", signingKeyV1(this.secretAccessKey, shortDate, this.region))
      .update(stringToSign, "utf8")
      .digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const client = this.endpoint.protocol === "https:" ? https : http;
    const response = await new Promise<SignedResponseV1>((resolve, reject) => {
      const req = client.request({
        protocol: this.endpoint.protocol,
        hostname: this.endpoint.hostname,
        port: this.endpoint.port || undefined,
        method: input.method,
        path: requestPath,
        headers,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on("error", reject);
      req.setTimeout(30_000, () => req.destroy(new Error("EA5C1_S3_REQUEST_TIMEOUT")));
      if (input.method === "PUT") req.write(body);
      req.end();
    });
    if (!input.allowed_statuses.includes(response.status)) {
      const safeBody = response.body.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
      throw new Error(`EA5C1_S3_${input.method}_STATUS_${response.status}${safeBody ? `:${safeBody}` : ""}`);
    }
    return response;
  }

  private verifyHeadV1(input: VerifyRetainedRawEvidenceInputV1, key: string, head: SignedResponseV1): string {
    if (head.status !== 200) throw new Error("EA5C1_RAW_OBJECT_NOT_FOUND");
    const length = Number(head.headers["content-length"]);
    if (!Number.isSafeInteger(length) || length !== input.retained_bytes) throw new Error("EA5C1_RETAINED_BYTE_COUNT_MISMATCH");
    const metadataHash = String(head.headers["x-amz-meta-geox-sha256"] ?? "");
    if (metadataHash !== input.retained_sha256) throw new Error("EA5C1_RETAINED_SHA256_MISMATCH");
    const retentionClass = String(head.headers["x-amz-meta-geox-retention-class"] ?? "");
    if (retentionClass !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("EA5C1_RETAINED_CLASS_MISMATCH");
    const retainedAt = canonicalIsoV1(head.headers["x-amz-meta-geox-retained-at"], "EA5C1_RETAINED_AT_INVALID");
    if (key !== retentionKeyV1(input.retained_sha256)) throw new Error("EA5C1_RETENTION_KEY_DIGEST_MISMATCH");
    return retainedAt;
  }

  async verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void> {
    if (!Number.isSafeInteger(input.retained_bytes) || input.retained_bytes <= 0) throw new Error("EA5C1_RETAINED_BYTES_INVALID");
    rawDigestHexV1(input.retained_sha256);
    const key = keyFromRetentionRefV1(input.retention_ref, this.bucket);
    const head = await this.requestV1({ method: "HEAD", key, allowed_statuses: [200, 404] });
    this.verifyHeadV1(input, key, head);
  }

  async retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> {
    if (input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") throw new Error("EA5C1_RETENTION_CLASS_REQUIRED");
    const raw = Buffer.from(input.bytes);
    if (!raw.byteLength || raw.byteLength !== input.raw_bytes) throw new Error("EA5C1_RAW_BYTE_COUNT_MISMATCH");
    const actualHash = `sha256:${sha256HexV1(raw)}`;
    if (actualHash !== input.raw_sha256) throw new Error("EA5C1_RAW_DIGEST_MISMATCH");
    canonicalIsoV1(input.retrieved_at, "EA5C1_RETRIEVED_AT_INVALID");
    canonicalIsoV1(input.available_at, "EA5C1_AVAILABLE_AT_INVALID");
    requiredTextV1(input.request_id, "EA5C1_REQUEST_ID_REQUIRED");
    requiredTextV1(input.provider_id, "EA5C1_PROVIDER_ID_REQUIRED");
    requiredTextV1(input.source_family, "EA5C1_SOURCE_FAMILY_REQUIRED");
    requiredTextV1(input.final_locator, "EA5C1_FINAL_LOCATOR_REQUIRED");
    requiredTextV1(input.use_policy_ref, "EA5C1_USE_POLICY_REQUIRED");

    const key = retentionKeyV1(actualHash);
    const ref = retentionRefV1(this.bucket, key);
    const probe = await this.requestV1({ method: "HEAD", key, allowed_statuses: [200, 404] });
    if (probe.status === 200) {
      const retainedAt = this.verifyHeadV1({ retention_ref: ref, retained_sha256: actualHash, retained_bytes: raw.byteLength }, key, probe);
      return {
        retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        retention_ref: ref,
        retained_sha256: actualHash,
        retained_bytes: raw.byteLength,
        retained_at: retainedAt,
        externally_publishable: false,
      };
    }

    const retainedAt = this.clock().toISOString();
    canonicalIsoV1(retainedAt, "EA5C1_RETAINED_AT_INVALID");
    await this.requestV1({
      method: "PUT",
      key,
      body: raw,
      content_type: input.content_type || "application/octet-stream",
      metadata: {
        "x-amz-meta-geox-sha256": actualHash,
        "x-amz-meta-geox-retention-class": "PRIVATE_RESTRICTED_RAW_EVIDENCE",
        "x-amz-meta-geox-retained-at": retainedAt,
      },
      allowed_statuses: [200],
    });
    const head = await this.requestV1({ method: "HEAD", key, allowed_statuses: [200] });
    const verifiedRetainedAt = this.verifyHeadV1({ retention_ref: ref, retained_sha256: actualHash, retained_bytes: raw.byteLength }, key, head);
    return {
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref: ref,
      retained_sha256: actualHash,
      retained_bytes: raw.byteLength,
      retained_at: verifiedRetainedAt,
      externally_publishable: false,
    };
  }
}
