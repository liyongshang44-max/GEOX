// MCFT-CAP-09 Phase7 private Evidence object I/O foundation.
// Purpose: authenticated S3-compatible PUT/HEAD/GET for private Evidence-plane objects.
// This client exposes no public/presigned URL surface and performs no provider, database,
// Twin Runtime, scheduler, or Formal activation work.

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

export type S3CompatiblePrivateEvidenceObjectClientConfigV1 = {
  endpoint: string;
  bucket: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  allow_insecure_http_for_test?: boolean;
  clock?: () => Date;
};

export type PrivateEvidenceObjectResponseV1 = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function sha256HexV1(value: Buffer | Uint8Array | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacV1(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKeyV1(secret: string, date: string, region: string): Buffer {
  const dateKey = hmacV1("AWS4" + secret, date);
  const regionKey = hmacV1(dateKey, region);
  const serviceKey = hmacV1(regionKey, "s3");
  return hmacV1(serviceKey, "aws4_request");
}

function uriEncodeV1(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function encodedPathV1(bucket: string, key: string): string {
  return "/" + uriEncodeV1(bucket) + "/" + key.split("/").map(uriEncodeV1).join("/");
}

function amzTimestampV1(date: Date): { amz_date: string; short_date: string } {
  if (!Number.isFinite(date.getTime())) throw new Error("PHASE7_PRIVATE_S3_CLOCK_INVALID");
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz_date: amzDate, short_date: amzDate.slice(0, 8) };
}

function normalizedKeyV1(value: unknown): string {
  const key = requiredTextV1(value, "PHASE7_PRIVATE_S3_KEY_REQUIRED").replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) throw new Error("PHASE7_PRIVATE_S3_KEY_INVALID");
  return key;
}

export class S3CompatiblePrivateEvidenceObjectClientV1 {
  readonly bucket: string;
  private readonly endpoint: URL;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly clock: () => Date;

  constructor(config: S3CompatiblePrivateEvidenceObjectClientConfigV1) {
    this.endpoint = new URL(requiredTextV1(config.endpoint, "PHASE7_PRIVATE_S3_ENDPOINT_REQUIRED"));
    if (this.endpoint.username || this.endpoint.password || this.endpoint.search || this.endpoint.hash) {
      throw new Error("PHASE7_PRIVATE_S3_ENDPOINT_CREDENTIAL_OR_QUERY_FORBIDDEN");
    }
    if (
      this.endpoint.protocol !== "https:" &&
      !(this.endpoint.protocol === "http:" && config.allow_insecure_http_for_test === true)
    ) {
      throw new Error("PHASE7_PRIVATE_S3_HTTPS_REQUIRED");
    }
    this.bucket = requiredTextV1(config.bucket, "PHASE7_PRIVATE_S3_BUCKET_REQUIRED");
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(this.bucket)) {
      throw new Error("PHASE7_PRIVATE_S3_BUCKET_INVALID");
    }
    this.region = requiredTextV1(config.region, "PHASE7_PRIVATE_S3_REGION_REQUIRED");
    this.accessKeyId = requiredTextV1(config.access_key_id, "PHASE7_PRIVATE_S3_ACCESS_KEY_REQUIRED");
    this.secretAccessKey = requiredTextV1(config.secret_access_key, "PHASE7_PRIVATE_S3_SECRET_KEY_REQUIRED");
    this.clock = config.clock ?? (() => new Date());
  }

  private async requestV1(input: {
    method: "PUT" | "HEAD" | "GET";
    key: string;
    body?: Buffer;
    content_type?: string;
    metadata?: Readonly<Record<string, string>>;
    allowed_statuses: readonly number[];
  }): Promise<PrivateEvidenceObjectResponseV1> {
    const key = normalizedKeyV1(input.key);
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256HexV1(body);
    const now = this.clock();
    const { amz_date: amzDate, short_date: shortDate } = amzTimestampV1(now);
    const basePath = this.endpoint.pathname.replace(/\/$/, "");
    const requestPath = basePath + encodedPathV1(this.bucket, key);
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (input.method === "PUT") {
      headers["content-length"] = String(body.byteLength);
      headers["content-type"] = requiredTextV1(input.content_type, "PHASE7_PRIVATE_S3_CONTENT_TYPE_REQUIRED");
      for (const [rawKey, rawValue] of Object.entries(input.metadata ?? {})) {
        const metadataKey = rawKey.toLowerCase();
        if (!/^x-amz-meta-[a-z0-9-]+$/.test(metadataKey)) {
          throw new Error("PHASE7_PRIVATE_S3_METADATA_KEY_INVALID");
        }
        headers[metadataKey] = requiredTextV1(rawValue, "PHASE7_PRIVATE_S3_METADATA_VALUE_REQUIRED");
      }
    }

    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => name + ":" + headers[name].trim() + "\n").join("");
    const signedHeaders = names.join(";");
    const canonicalRequest = [
      input.method,
      requestPath,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = shortDate + "/" + this.region + "/s3/aws4_request";
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256HexV1(canonicalRequest),
    ].join("\n");
    const signature = crypto
      .createHmac("sha256", signingKeyV1(this.secretAccessKey, shortDate, this.region))
      .update(stringToSign, "utf8")
      .digest("hex");
    headers.authorization =
      "AWS4-HMAC-SHA256 Credential=" + this.accessKeyId + "/" + scope +
      ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

    const client = this.endpoint.protocol === "https:" ? https : http;
    const response = await new Promise<PrivateEvidenceObjectResponseV1>((resolve, reject) => {
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
        res.on("end", () => resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }));
      });
      req.on("error", reject);
      req.setTimeout(30_000, () => req.destroy(new Error("PHASE7_PRIVATE_S3_REQUEST_TIMEOUT")));
      if (input.method === "PUT") req.write(body);
      req.end();
    });

    if (!input.allowed_statuses.includes(response.status)) {
      const safeBody = response.body.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
      throw new Error(
        "PHASE7_PRIVATE_S3_" + input.method + "_STATUS_" + response.status +
        (safeBody ? ":" + safeBody : ""),
      );
    }
    return response;
  }

  async putObject(input: {
    key: string;
    body: Buffer | Uint8Array;
    content_type: string;
    metadata: Readonly<Record<string, string>>;
  }): Promise<PrivateEvidenceObjectResponseV1> {
    return this.requestV1({
      method: "PUT",
      key: input.key,
      body: Buffer.from(input.body),
      content_type: input.content_type,
      metadata: input.metadata,
      allowed_statuses: [200],
    });
  }

  async headObject(key: string, allowedStatuses: readonly number[] = [200]): Promise<PrivateEvidenceObjectResponseV1> {
    return this.requestV1({ method: "HEAD", key, allowed_statuses: allowedStatuses });
  }

  async getObject(key: string, allowedStatuses: readonly number[] = [200]): Promise<PrivateEvidenceObjectResponseV1> {
    return this.requestV1({ method: "GET", key, allowed_statuses: allowedStatuses });
  }
}
