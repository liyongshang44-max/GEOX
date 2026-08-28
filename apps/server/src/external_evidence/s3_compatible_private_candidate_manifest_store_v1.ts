// MCFT-CAP-09 Phase7 durable private exact-base candidate manifest store.
// The candidate manifest is Evidence-plane operational authority, not a GitHub artifact.
// Capture writes no Formal DB rows; promotion may later rehydrate raw objects from this ref.

import crypto from "node:crypto";

import {
  S3CompatiblePrivateEvidenceObjectClientV1,
  type S3CompatiblePrivateEvidenceObjectClientConfigV1,
} from "./s3_compatible_private_evidence_object_client_v1.js";

export const MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1 =
  "MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_V1" as const;
export const MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_PREFIX_V1 =
  "mcft-cap09-formal-candidate-v1/sha256" as const;
export const MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1 =
  "geox_mcft_cap09_external_formal_exact_base_candidate_v1" as const;

export type ExternalFormalCandidateSemanticRecordV1 = {
  record_type: string;
  source_record_id: string;
  record_semantic_sha256: string;
};

export type ExternalFormalCandidateRawProvenanceV1 = {
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
  retained_at: string;
  request_id: string;
  provider_id: string;
  source_family: string;
  source_locator: string;
  final_locator: string;
  content_type: string;
  retrieved_at: string;
  available_at: string;
  use_policy_ref: string;
  source_issue_time?: string;
  source_event_time?: string;
};

export type ExternalFormalExactBaseCandidateManifestV1 = {
  schema_version: typeof MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1;
  base_target_t: string;
  subject_sha: string;
  producer_run_id: string;
  captured_at: string;
  candidate_expires_at: string;
  expected_records: readonly ExternalFormalCandidateSemanticRecordV1[];
  raw_objects: readonly ExternalFormalCandidateRawProvenanceV1[];
  raw_values_emitted: false;
  side_effects: {
    formal_database_write_count: 0;
    runtime_write_count: 0;
    scheduler_write_count: 0;
    twin_state_mutation: false;
    provider_refetch_during_rehydration_authorized: false;
  };
};

export type PrivateCandidateManifestWriteReceiptV1 = {
  store_id: typeof MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1;
  capture_ref: string;
  candidate_artifact_digest: string;
  manifest_bytes: number;
  stored_at: string;
  idempotent_existing_object: boolean;
  externally_publishable: false;
  formal_database_write_count: 0;
};

export type PrivateCandidateManifestReadReceiptV1 = {
  store_id: typeof MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1;
  capture_ref: string;
  candidate_artifact_digest: string;
  manifest_bytes: number;
  stored_at: string;
  manifest: ExternalFormalExactBaseCandidateManifestV1;
  externally_publishable: false;
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

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function sha256V1(value: Buffer | Uint8Array | string): string {
  return "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
}

function digestHexV1(value: unknown, code: string): string {
  const match = /^sha256:([0-9a-f]{64})$/.exec(requiredTextV1(value, code));
  if (!match) throw new Error(code);
  return match[1];
}

function headerV1(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function semanticRecordV1(input: ExternalFormalCandidateSemanticRecordV1): ExternalFormalCandidateSemanticRecordV1 {
  const recordType = requiredTextV1(input.record_type, "PHASE7_CANDIDATE_RECORD_TYPE_REQUIRED");
  const sourceRecordId = requiredTextV1(input.source_record_id, "PHASE7_CANDIDATE_SOURCE_RECORD_ID_REQUIRED");
  digestHexV1(input.record_semantic_sha256, "PHASE7_CANDIDATE_RECORD_SEMANTIC_DIGEST_INVALID");
  return {
    record_type: recordType,
    source_record_id: sourceRecordId,
    record_semantic_sha256: input.record_semantic_sha256,
  };
}

function rawProvenanceV1(input: ExternalFormalCandidateRawProvenanceV1): ExternalFormalCandidateRawProvenanceV1 {
  const retainedBytes = Number(input.retained_bytes);
  if (!Number.isSafeInteger(retainedBytes) || retainedBytes <= 0) {
    throw new Error("PHASE7_CANDIDATE_RAW_BYTES_INVALID");
  }
  const retainedHex = digestHexV1(input.retained_sha256, "PHASE7_CANDIDATE_RAW_DIGEST_INVALID");
  const retentionRef = requiredTextV1(input.retention_ref, "PHASE7_CANDIDATE_RETENTION_REF_REQUIRED");
  let parsedRetentionRef: URL;
  try {
    parsedRetentionRef = new URL(retentionRef);
  } catch {
    throw new Error("PHASE7_CANDIDATE_RETENTION_REF_INVALID");
  }
  if (
    parsedRetentionRef.protocol !== "s3-private:" ||
    parsedRetentionRef.pathname.replace(/^\/+/, "") !== "mcft-cap09-formal-raw-v1/sha256/" + retainedHex
  ) {
    throw new Error("PHASE7_CANDIDATE_RETENTION_REF_DIGEST_MISMATCH");
  }
  const value: ExternalFormalCandidateRawProvenanceV1 = {
    retention_ref: retentionRef,
    retained_sha256: input.retained_sha256,
    retained_bytes: retainedBytes,
    retained_at: canonicalIsoV1(input.retained_at, "PHASE7_CANDIDATE_RETAINED_AT_INVALID"),
    request_id: requiredTextV1(input.request_id, "PHASE7_CANDIDATE_REQUEST_ID_REQUIRED"),
    provider_id: requiredTextV1(input.provider_id, "PHASE7_CANDIDATE_PROVIDER_ID_REQUIRED"),
    source_family: requiredTextV1(input.source_family, "PHASE7_CANDIDATE_SOURCE_FAMILY_REQUIRED"),
    source_locator: requiredTextV1(input.source_locator, "PHASE7_CANDIDATE_SOURCE_LOCATOR_REQUIRED"),
    final_locator: requiredTextV1(input.final_locator, "PHASE7_CANDIDATE_FINAL_LOCATOR_REQUIRED"),
    content_type: requiredTextV1(input.content_type, "PHASE7_CANDIDATE_CONTENT_TYPE_REQUIRED"),
    retrieved_at: canonicalIsoV1(input.retrieved_at, "PHASE7_CANDIDATE_RETRIEVED_AT_INVALID"),
    available_at: canonicalIsoV1(input.available_at, "PHASE7_CANDIDATE_AVAILABLE_AT_INVALID"),
    use_policy_ref: requiredTextV1(input.use_policy_ref, "PHASE7_CANDIDATE_USE_POLICY_REQUIRED"),
  };
  if (input.source_issue_time !== undefined) {
    value.source_issue_time = canonicalIsoV1(input.source_issue_time, "PHASE7_CANDIDATE_SOURCE_ISSUE_TIME_INVALID");
  }
  if (input.source_event_time !== undefined) {
    value.source_event_time = canonicalIsoV1(input.source_event_time, "PHASE7_CANDIDATE_SOURCE_EVENT_TIME_INVALID");
  }
  return value;
}

export function normalizeExternalFormalExactBaseCandidateManifestV1(
  input: ExternalFormalExactBaseCandidateManifestV1,
): ExternalFormalExactBaseCandidateManifestV1 {
  if (input.schema_version !== MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1) {
    throw new Error("PHASE7_CANDIDATE_SCHEMA_INVALID");
  }
  const subjectSha = requiredTextV1(input.subject_sha, "PHASE7_CANDIDATE_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subjectSha)) throw new Error("PHASE7_CANDIDATE_SUBJECT_INVALID");
  const capturedAt = canonicalIsoV1(input.captured_at, "PHASE7_CANDIDATE_CAPTURED_AT_INVALID");
  const expiresAt = canonicalIsoV1(input.candidate_expires_at, "PHASE7_CANDIDATE_EXPIRY_INVALID");
  if (Date.parse(expiresAt) <= Date.parse(capturedAt)) throw new Error("PHASE7_CANDIDATE_EXPIRY_NOT_AFTER_CAPTURE");
  if (!Array.isArray(input.expected_records) || input.expected_records.length !== 3) {
    throw new Error("PHASE7_CANDIDATE_EXACT_THREE_SEMANTIC_RECORDS_REQUIRED");
  }
  if (!Array.isArray(input.raw_objects) || input.raw_objects.length < 2) {
    throw new Error("PHASE7_CANDIDATE_RAW_PROVENANCE_REQUIRED");
  }
  if (
    input.raw_values_emitted !== false ||
    input.side_effects?.formal_database_write_count !== 0 ||
    input.side_effects?.runtime_write_count !== 0 ||
    input.side_effects?.scheduler_write_count !== 0 ||
    input.side_effects?.twin_state_mutation !== false ||
    input.side_effects?.provider_refetch_during_rehydration_authorized !== false
  ) {
    throw new Error("PHASE7_CANDIDATE_SIDE_EFFECT_CONTRACT_INVALID");
  }

  const expectedRecords = input.expected_records.map(semanticRecordV1).sort((a, b) =>
    a.record_type.localeCompare(b.record_type) || a.source_record_id.localeCompare(b.source_record_id)
  );
  const semanticKeys = new Set(expectedRecords.map((row) => row.record_type + "\u0000" + row.source_record_id));
  if (semanticKeys.size !== expectedRecords.length) throw new Error("PHASE7_CANDIDATE_DUPLICATE_SEMANTIC_RECORD");

  const rawObjects = input.raw_objects.map(rawProvenanceV1).sort((a, b) =>
    a.retained_sha256.localeCompare(b.retained_sha256) || a.request_id.localeCompare(b.request_id)
  );
  const rawDigests = new Set(rawObjects.map((row) => row.retained_sha256));
  if (rawDigests.size !== rawObjects.length) throw new Error("PHASE7_CANDIDATE_DUPLICATE_RAW_DIGEST");

  return {
    schema_version: MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
    base_target_t: canonicalHourV1(input.base_target_t, "PHASE7_CANDIDATE_TARGET_INVALID"),
    subject_sha: subjectSha,
    producer_run_id: requiredTextV1(input.producer_run_id, "PHASE7_CANDIDATE_PRODUCER_RUN_REQUIRED"),
    captured_at: capturedAt,
    candidate_expires_at: expiresAt,
    expected_records: expectedRecords,
    raw_objects: rawObjects,
    raw_values_emitted: false,
    side_effects: {
      formal_database_write_count: 0,
      runtime_write_count: 0,
      scheduler_write_count: 0,
      twin_state_mutation: false,
      provider_refetch_during_rehydration_authorized: false,
    },
  };
}

function canonicalManifestBytesV1(input: ExternalFormalExactBaseCandidateManifestV1): Buffer {
  return Buffer.from(JSON.stringify(normalizeExternalFormalExactBaseCandidateManifestV1(input)) + "\n", "utf8");
}

export class S3CompatiblePrivateCandidateManifestStoreV1 {
  private readonly client: S3CompatiblePrivateEvidenceObjectClientV1;
  private readonly clock: () => Date;

  constructor(config: S3CompatiblePrivateEvidenceObjectClientConfigV1) {
    this.client = new S3CompatiblePrivateEvidenceObjectClientV1(config);
    this.clock = config.clock ?? (() => new Date());
  }

  private keyV1(digest: string): string {
    return MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_PREFIX_V1 + "/" +
      digestHexV1(digest, "PHASE7_CANDIDATE_DIGEST_INVALID");
  }

  private refV1(key: string): string {
    return "s3-private://" + this.client.bucket + "/" + key;
  }

  private keyFromRefV1(ref: string, digest: string): string {
    let parsed: URL;
    try {
      parsed = new URL(requiredTextV1(ref, "PHASE7_CANDIDATE_REF_REQUIRED"));
    } catch {
      throw new Error("PHASE7_CANDIDATE_REF_INVALID");
    }
    if (parsed.protocol !== "s3-private:" || parsed.hostname !== this.client.bucket) {
      throw new Error("PHASE7_CANDIDATE_REF_AUTHORITY_MISMATCH");
    }
    const key = parsed.pathname.replace(/^\/+/, "");
    const expected = this.keyV1(digest);
    if (key !== expected) throw new Error("PHASE7_CANDIDATE_REF_DIGEST_MISMATCH");
    return key;
  }

  private verifyHeadV1(input: {
    key: string;
    digest: string;
    bytes: number;
    status: number;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }): string {
    if (input.status !== 200) throw new Error("PHASE7_CANDIDATE_OBJECT_NOT_FOUND");
    const length = Number(headerV1(input.headers, "content-length"));
    if (!Number.isSafeInteger(length) || length !== input.bytes) throw new Error("PHASE7_CANDIDATE_BYTE_COUNT_MISMATCH");
    if (headerV1(input.headers, "x-amz-meta-geox-sha256") !== input.digest) {
      throw new Error("PHASE7_CANDIDATE_METADATA_DIGEST_MISMATCH");
    }
    if (headerV1(input.headers, "x-amz-meta-geox-object-class") !== "PRIVATE_EXTERNAL_FORMAL_CANDIDATE_MANIFEST") {
      throw new Error("PHASE7_CANDIDATE_OBJECT_CLASS_MISMATCH");
    }
    if (headerV1(input.headers, "x-amz-meta-geox-schema") !== MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1) {
      throw new Error("PHASE7_CANDIDATE_METADATA_SCHEMA_MISMATCH");
    }
    const storedAt = canonicalIsoV1(headerV1(input.headers, "x-amz-meta-geox-stored-at"), "PHASE7_CANDIDATE_STORED_AT_INVALID");
    if (input.key !== this.keyV1(input.digest)) throw new Error("PHASE7_CANDIDATE_KEY_DIGEST_MISMATCH");
    return storedAt;
  }

  async writeCandidateManifest(
    manifestInput: ExternalFormalExactBaseCandidateManifestV1,
  ): Promise<PrivateCandidateManifestWriteReceiptV1> {
    const manifest = normalizeExternalFormalExactBaseCandidateManifestV1(manifestInput);
    for (const raw of manifest.raw_objects) {
      const parsed = new URL(raw.retention_ref);
      if (parsed.hostname !== this.client.bucket) throw new Error("PHASE7_CANDIDATE_RAW_BUCKET_MISMATCH");
    }
    const body = canonicalManifestBytesV1(manifest);
    const digest = sha256V1(body);
    const key = this.keyV1(digest);
    const ref = this.refV1(key);

    const probe = await this.client.headObject(key, [200, 404]);
    if (probe.status === 200) {
      const storedAt = this.verifyHeadV1({
        key,
        digest,
        bytes: body.byteLength,
        status: probe.status,
        headers: probe.headers,
      });
      const existing = await this.client.getObject(key);
      if (existing.body.byteLength !== body.byteLength || sha256V1(existing.body) !== digest || !existing.body.equals(body)) {
        throw new Error("PHASE7_CANDIDATE_IDEMPOTENT_OBJECT_BODY_MISMATCH");
      }
      return {
        store_id: MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1,
        capture_ref: ref,
        candidate_artifact_digest: digest,
        manifest_bytes: body.byteLength,
        stored_at: storedAt,
        idempotent_existing_object: true,
        externally_publishable: false,
        formal_database_write_count: 0,
      };
    }

    const storedAt = this.clock().toISOString();
    canonicalIsoV1(storedAt, "PHASE7_CANDIDATE_STORE_CLOCK_INVALID");
    await this.client.putObject({
      key,
      body,
      content_type: "application/json",
      metadata: {
        "x-amz-meta-geox-sha256": digest,
        "x-amz-meta-geox-object-class": "PRIVATE_EXTERNAL_FORMAL_CANDIDATE_MANIFEST",
        "x-amz-meta-geox-schema": MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
        "x-amz-meta-geox-stored-at": storedAt,
        "x-amz-meta-geox-subject-sha": manifest.subject_sha,
      },
    });
    const head = await this.client.headObject(key);
    const verifiedStoredAt = this.verifyHeadV1({
      key,
      digest,
      bytes: body.byteLength,
      status: head.status,
      headers: head.headers,
    });
    const readback = await this.client.getObject(key);
    if (readback.body.byteLength !== body.byteLength || sha256V1(readback.body) !== digest || !readback.body.equals(body)) {
      throw new Error("PHASE7_CANDIDATE_WRITE_READBACK_MISMATCH");
    }
    return {
      store_id: MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1,
      capture_ref: ref,
      candidate_artifact_digest: digest,
      manifest_bytes: body.byteLength,
      stored_at: verifiedStoredAt,
      idempotent_existing_object: false,
      externally_publishable: false,
      formal_database_write_count: 0,
    };
  }

  async readCandidateManifest(input: {
    capture_ref: string;
    candidate_artifact_digest: string;
  }): Promise<PrivateCandidateManifestReadReceiptV1> {
    const key = this.keyFromRefV1(input.capture_ref, input.candidate_artifact_digest);
    const head = await this.client.headObject(key, [200, 404]);
    if (head.status !== 200) throw new Error("PHASE7_CANDIDATE_OBJECT_NOT_FOUND");
    const bytes = Number(headerV1(head.headers, "content-length"));
    if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error("PHASE7_CANDIDATE_BYTE_COUNT_INVALID");
    const storedAt = this.verifyHeadV1({
      key,
      digest: input.candidate_artifact_digest,
      bytes,
      status: head.status,
      headers: head.headers,
    });
    const get = await this.client.getObject(key);
    if (get.body.byteLength !== bytes || sha256V1(get.body) !== input.candidate_artifact_digest) {
      throw new Error("PHASE7_CANDIDATE_GET_DIGEST_OR_LENGTH_MISMATCH");
    }
    let parsed: ExternalFormalExactBaseCandidateManifestV1;
    try {
      parsed = JSON.parse(get.body.toString("utf8")) as ExternalFormalExactBaseCandidateManifestV1;
    } catch {
      throw new Error("PHASE7_CANDIDATE_JSON_INVALID");
    }
    const manifest = normalizeExternalFormalExactBaseCandidateManifestV1(parsed);
    for (const raw of manifest.raw_objects) {
      const parsedRef = new URL(raw.retention_ref);
      if (parsedRef.hostname !== this.client.bucket) throw new Error("PHASE7_CANDIDATE_RAW_BUCKET_MISMATCH");
    }
    if (!canonicalManifestBytesV1(manifest).equals(get.body)) throw new Error("PHASE7_CANDIDATE_NONCANONICAL_JSON");
    return {
      store_id: MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_STORE_ID_V1,
      capture_ref: input.capture_ref,
      candidate_artifact_digest: input.candidate_artifact_digest,
      manifest_bytes: bytes,
      stored_at: storedAt,
      manifest,
      externally_publishable: false,
    };
  }
}
