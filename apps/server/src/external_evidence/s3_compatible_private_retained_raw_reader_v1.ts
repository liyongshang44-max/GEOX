// MCFT-CAP-09 Phase7 private retained-raw reader.
// Reads only already-retained formal raw Evidence objects by exact s3-private digest reference.
// No provider refetch, no raw mutation, no canonical/DB write, and no public URL surface.

import crypto from "node:crypto";

import {
  S3CompatiblePrivateEvidenceObjectClientV1,
  type S3CompatiblePrivateEvidenceObjectClientConfigV1,
} from "./s3_compatible_private_evidence_object_client_v1.js";

export const MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1 =
  "MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_V1" as const;
export const MCFT_CAP09_FORMAL_RAW_READER_PREFIX_V1 =
  "mcft-cap09-formal-raw-v1/sha256" as const;

export type PrivateRetainedRawReadInputV1 = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
};

export type PrivateRetainedRawReadReceiptV1 = {
  reader_id: typeof MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1;
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
  retained_at: string;
  bytes: Uint8Array;
  provider_refetch_count: 0;
  raw_store_write_count: 0;
  formal_database_write_count: 0;
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

function sha256V1(value: Buffer | Uint8Array | string): string {
  return "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
}

function digestHexV1(value: unknown): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(requiredTextV1(value, "PHASE7_RAW_READER_DIGEST_REQUIRED"));
  if (!match) throw new Error("PHASE7_RAW_READER_DIGEST_INVALID");
  return match[1];
}

function headerV1(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

export class S3CompatiblePrivateRetainedRawReaderV1 {
  private readonly client: S3CompatiblePrivateEvidenceObjectClientV1;

  constructor(config: S3CompatiblePrivateEvidenceObjectClientConfigV1) {
    this.client = new S3CompatiblePrivateEvidenceObjectClientV1(config);
  }

  private keyFromInputV1(input: PrivateRetainedRawReadInputV1): string {
    if (!Number.isSafeInteger(input.retained_bytes) || input.retained_bytes <= 0) {
      throw new Error("PHASE7_RAW_READER_BYTES_INVALID");
    }
    const hex = digestHexV1(input.retained_sha256);
    let parsed: URL;
    try {
      parsed = new URL(requiredTextV1(input.retention_ref, "PHASE7_RAW_READER_REF_REQUIRED"));
    } catch {
      throw new Error("PHASE7_RAW_READER_REF_INVALID");
    }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.client.bucket) {
      throw new Error("PHASE7_RAW_READER_REF_AUTHORITY_MISMATCH");
    }
    const key = parsed.pathname.replace(/^\/+/, "");
    const expected = MCFT_CAP09_FORMAL_RAW_READER_PREFIX_V1 + "/" + hex;
    if (key !== expected) throw new Error("PHASE7_RAW_READER_REF_DIGEST_MISMATCH");
    return key;
  }

  async readRetainedRawEvidence(input: PrivateRetainedRawReadInputV1): Promise<PrivateRetainedRawReadReceiptV1> {
    const key = this.keyFromInputV1(input);
    const head = await this.client.headObject(key, [200, 404]);
    if (head.status !== 200) throw new Error("PHASE7_RAW_READER_OBJECT_NOT_FOUND");
    const length = Number(headerV1(head.headers, "content-length"));
    if (!Number.isSafeInteger(length) || length !== input.retained_bytes) {
      throw new Error("PHASE7_RAW_READER_BYTE_COUNT_MISMATCH");
    }
    if (headerV1(head.headers, "x-amz-meta-geox-sha256") !== input.retained_sha256) {
      throw new Error("PHASE7_RAW_READER_METADATA_DIGEST_MISMATCH");
    }
    if (headerV1(head.headers, "x-amz-meta-geox-retention-class") !== "PRIVATE_RESTRICTED_RAW_EVIDENCE") {
      throw new Error("PHASE7_RAW_READER_RETENTION_CLASS_MISMATCH");
    }
    const retainedAt = canonicalIsoV1(
      headerV1(head.headers, "x-amz-meta-geox-retained-at"),
      "PHASE7_RAW_READER_RETAINED_AT_INVALID",
    );
    const get = await this.client.getObject(key);
    if (get.body.byteLength !== input.retained_bytes || sha256V1(get.body) !== input.retained_sha256) {
      throw new Error("PHASE7_RAW_READER_GET_DIGEST_OR_LENGTH_MISMATCH");
    }
    return {
      reader_id: MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
      retention_ref: input.retention_ref,
      retained_sha256: input.retained_sha256,
      retained_bytes: input.retained_bytes,
      retained_at: retainedAt,
      bytes: new Uint8Array(get.body),
      provider_refetch_count: 0,
      raw_store_write_count: 0,
      formal_database_write_count: 0,
    };
  }
}
