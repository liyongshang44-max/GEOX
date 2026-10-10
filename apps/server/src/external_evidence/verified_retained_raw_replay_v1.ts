// MCFT-CAP-09 verified retained-raw replay primitive.
// Reconstructs the collector transport/retention seam from an already verified private retained object.
// No provider refetch, no raw-store write, no database access, no scheduler, no RuntimeTickCursor,
// and no production process activation.

import type {
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
  RawEvidenceRetentionInputV1,
  RawEvidenceRetentionPortV1,
  RawEvidenceRetentionReceiptV1,
  VerifiedRawEvidenceProvenanceV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  PrivateRetainedRawReadReceiptV1,
} from "./s3_compatible_private_retained_raw_reader_v1.js";

export const MCFT_CAP09_VERIFIED_RETAINED_RAW_REPLAY_ID_V1 =
  "MCFT_CAP09_VERIFIED_RETAINED_RAW_REPLAY_V1" as const;

export type VerifiedRetainedRawReplayProvenanceV1 = VerifiedRawEvidenceProvenanceV1;

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

function digestV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

function bytesV1(value: unknown, code: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(code);
  return number;
}

function optionalIsoV1(value: string | undefined, code: string): string | undefined {
  return value === undefined ? undefined : canonicalIsoV1(value, code);
}

function normalizeProvenanceV1(
  raw: VerifiedRetainedRawReplayProvenanceV1,
): VerifiedRetainedRawReplayProvenanceV1 {
  return {
    request_id: requiredTextV1(raw.request_id, "RETAINED_REPLAY_REQUEST_ID_REQUIRED"),
    provider_id: requiredTextV1(raw.provider_id, "RETAINED_REPLAY_PROVIDER_ID_REQUIRED"),
    source_family: requiredTextV1(raw.source_family, "RETAINED_REPLAY_SOURCE_FAMILY_REQUIRED"),
    source_locator: requiredTextV1(raw.source_locator, "RETAINED_REPLAY_SOURCE_LOCATOR_REQUIRED"),
    final_locator: requiredTextV1(raw.final_locator, "RETAINED_REPLAY_FINAL_LOCATOR_REQUIRED"),
    content_type: requiredTextV1(raw.content_type, "RETAINED_REPLAY_CONTENT_TYPE_REQUIRED"),
    retrieved_at: canonicalIsoV1(raw.retrieved_at, "RETAINED_REPLAY_RETRIEVED_AT_INVALID"),
    available_at: canonicalIsoV1(raw.available_at, "RETAINED_REPLAY_AVAILABLE_AT_INVALID"),
    raw_sha256: digestV1(raw.raw_sha256, "RETAINED_REPLAY_RAW_DIGEST_INVALID"),
    raw_bytes: bytesV1(raw.raw_bytes, "RETAINED_REPLAY_RAW_BYTES_INVALID"),
    retention_ref: requiredTextV1(raw.retention_ref, "RETAINED_REPLAY_RETENTION_REF_REQUIRED"),
    retained_at: canonicalIsoV1(raw.retained_at, "RETAINED_REPLAY_RETAINED_AT_INVALID"),
    use_policy_ref: requiredTextV1(raw.use_policy_ref, "RETAINED_REPLAY_USE_POLICY_REQUIRED"),
    ...(optionalIsoV1(raw.source_issue_time, "RETAINED_REPLAY_SOURCE_ISSUE_TIME_INVALID")
      ? { source_issue_time: optionalIsoV1(raw.source_issue_time, "RETAINED_REPLAY_SOURCE_ISSUE_TIME_INVALID") }
      : {}),
    ...(optionalIsoV1(raw.source_event_time, "RETAINED_REPLAY_SOURCE_EVENT_TIME_INVALID")
      ? { source_event_time: optionalIsoV1(raw.source_event_time, "RETAINED_REPLAY_SOURCE_EVENT_TIME_INVALID") }
      : {}),
  };
}

function allowedHostsV1(raw: VerifiedRetainedRawReplayProvenanceV1): string[] {
  const hosts = new Set<string>();
  for (const locator of [raw.source_locator, raw.final_locator]) {
    let parsed: URL;
    try { parsed = new URL(locator); } catch { throw new Error("RETAINED_REPLAY_LOCATOR_INVALID"); }
    if (parsed.protocol !== "https:") throw new Error("RETAINED_REPLAY_LOCATOR_HTTPS_REQUIRED");
    hosts.add(parsed.hostname);
  }
  return [...hosts].sort();
}

function assertReadReceiptV1(
  raw: VerifiedRetainedRawReplayProvenanceV1,
  read: PrivateRetainedRawReadReceiptV1,
): void {
  if (
    read.retention_ref !== raw.retention_ref
    || read.retained_sha256 !== raw.raw_sha256
    || read.retained_bytes !== raw.raw_bytes
    || read.retained_at !== raw.retained_at
    || read.provider_refetch_count !== 0
    || read.raw_store_write_count !== 0
    || read.formal_database_write_count !== 0
  ) {
    throw new Error("RETAINED_REPLAY_VERIFIED_READ_RECEIPT_MISMATCH");
  }
}

function sameOptionalV1(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}

export function buildVerifiedRetainedRawReplayRequestV1(
  rawInput: VerifiedRetainedRawReplayProvenanceV1,
  input: { purpose_limitations?: readonly string[] } = {},
): ExternalEvidenceFetchRequestV1 {
  const raw = normalizeProvenanceV1(rawInput);
  const purpose = (input.purpose_limitations ?? []).map((value) =>
    requiredTextV1(value, "RETAINED_REPLAY_PURPOSE_LIMITATION_REQUIRED")
  );
  const limitations = [
    "PRIVATE_RESTRICTED_RAW_EVIDENCE",
    "VERIFIED_RETAINED_RAW_REPLAY",
    "NO_PROVIDER_REFETCH",
    "NO_RAW_STORE_WRITE",
    ...purpose,
  ];
  if (new Set(limitations).size !== limitations.length) {
    throw new Error("RETAINED_REPLAY_LIMITATION_DUPLICATE");
  }
  return {
    request_id: raw.request_id,
    provider_id: raw.provider_id,
    source_family: raw.source_family,
    locator: raw.source_locator,
    allowed_final_hosts: allowedHostsV1(raw),
    use_policy_ref: raw.use_policy_ref,
    requested_at: raw.retrieved_at,
    ...(raw.source_issue_time ? { source_issue_time: raw.source_issue_time } : {}),
    ...(raw.source_event_time ? { source_event_time: raw.source_event_time } : {}),
    expected_content_type_prefixes: [raw.content_type],
    limitations,
  };
}

export class VerifiedRetainedRawReadbackTransportV1
  implements ExternalEvidenceTransportPortV1 {
  readonly replay_id = MCFT_CAP09_VERIFIED_RETAINED_RAW_REPLAY_ID_V1;
  readonly provider_refetch_count = 0;
  private readonly raw: VerifiedRetainedRawReplayProvenanceV1;

  constructor(
    rawInput: VerifiedRetainedRawReplayProvenanceV1,
    private readonly read: PrivateRetainedRawReadReceiptV1,
  ) {
    this.raw = normalizeProvenanceV1(rawInput);
    assertReadReceiptV1(this.raw, read);
  }

  async fetchRawEvidence(
    request: ExternalEvidenceFetchRequestV1,
  ): Promise<ExternalEvidenceFetchResponseV1> {
    const expectedHosts = allowedHostsV1(this.raw);
    const actualHosts = [...request.allowed_final_hosts].sort();
    if (
      request.request_id !== this.raw.request_id
      || request.provider_id !== this.raw.provider_id
      || request.source_family !== this.raw.source_family
      || request.locator !== this.raw.source_locator
      || request.use_policy_ref !== this.raw.use_policy_ref
      || request.requested_at !== this.raw.retrieved_at
      || !sameOptionalV1(request.source_issue_time, this.raw.source_issue_time)
      || !sameOptionalV1(request.source_event_time, this.raw.source_event_time)
      || JSON.stringify(actualHosts) !== JSON.stringify(expectedHosts)
      || request.expected_content_type_prefixes.length !== 1
      || request.expected_content_type_prefixes[0] !== this.raw.content_type
    ) {
      throw new Error("RETAINED_REPLAY_REQUEST_IDENTITY_MISMATCH");
    }
    return {
      status: 200,
      final_locator: this.raw.final_locator,
      content_type: this.raw.content_type,
      retrieved_at: this.raw.retrieved_at,
      available_at: this.raw.available_at,
      bytes: this.read.bytes,
    };
  }
}

export class ExistingRetainedRawVerificationBarrierV1
  implements RawEvidenceRetentionPortV1 {
  readonly replay_id = MCFT_CAP09_VERIFIED_RETAINED_RAW_REPLAY_ID_V1;
  readonly raw_store_write_count = 0;
  private readonly raw: VerifiedRetainedRawReplayProvenanceV1;

  constructor(
    rawInput: VerifiedRetainedRawReplayProvenanceV1,
    private readonly read: PrivateRetainedRawReadReceiptV1,
  ) {
    this.raw = normalizeProvenanceV1(rawInput);
    assertReadReceiptV1(this.raw, read);
  }

  async retainRawEvidence(
    input: RawEvidenceRetentionInputV1,
  ): Promise<RawEvidenceRetentionReceiptV1> {
    if (
      input.retention_class !== "PRIVATE_RESTRICTED_RAW_EVIDENCE"
      || input.raw_sha256 !== this.raw.raw_sha256
      || input.raw_bytes !== this.raw.raw_bytes
      || input.raw_sha256 !== this.read.retained_sha256
      || input.raw_bytes !== this.read.retained_bytes
      || input.request_id !== this.raw.request_id
      || input.provider_id !== this.raw.provider_id
      || input.source_family !== this.raw.source_family
      || input.source_locator !== this.raw.source_locator
      || input.final_locator !== this.raw.final_locator
      || input.content_type !== this.raw.content_type
      || input.retrieved_at !== this.raw.retrieved_at
      || input.available_at !== this.raw.available_at
      || !sameOptionalV1(input.source_issue_time, this.raw.source_issue_time)
      || !sameOptionalV1(input.source_event_time, this.raw.source_event_time)
      || input.use_policy_ref !== this.raw.use_policy_ref
    ) {
      throw new Error("RETAINED_REPLAY_EXISTING_RETENTION_BARRIER_MISMATCH");
    }
    return {
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      retention_ref: this.raw.retention_ref,
      retained_sha256: this.raw.raw_sha256,
      retained_bytes: this.raw.raw_bytes,
      retained_at: this.raw.retained_at,
      externally_publishable: false,
    };
  }
}
