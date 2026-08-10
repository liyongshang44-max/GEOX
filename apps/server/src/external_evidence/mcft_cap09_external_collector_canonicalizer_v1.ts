// MCFT-CAP-09 S6-EA3 external Evidence collector + governed canonicalizer core.
// Boundary: this module has no concrete network transport, database writer, scheduler,
// Runtime loop, environment lookup, or wall-clock read. All I/O is injected.
// Raw bytes MUST receive a verified private-retention receipt before any decoder is called.

import { createHash } from "node:crypto";

import { semanticHashV1 } from "../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceExecutionMetadataV1,
  TwinScopeKeyV1,
} from "../runtime/twin_runtime/ports.js";

export const MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1 =
  "MCFT_CAP09_EXTERNAL_EVIDENCE_COLLECTOR_CANONICALIZER_V1" as const;

export const MCFT_CAP09_EXTERNAL_EVIDENCE_ROLE_POLICY_V1 = {
  SOIL_MOISTURE_OBSERVATION: {
    record_type: "soil_moisture_observation_v1",
    epistemic_class: "OBSERVED",
    event_time_field: "observed_at",
  },
  RAINFALL_OBSERVATION: {
    record_type: "observed_rainfall_v1",
    epistemic_class: "OBSERVED",
    event_time_field: "interval_end",
  },
  HISTORICAL_ET0_INPUT: {
    record_type: "historical_et0_estimate_v1",
    epistemic_class: "ESTIMATED",
    event_time_field: "interval_end",
  },
  FUTURE_WEATHER_ASSUMPTION: {
    record_type: "future_weather_assumption_v1",
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
  },
  FUTURE_ET0_ASSUMPTION: {
    record_type: "future_et0_assumption_v1",
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
  },
} as const;

export type McftCap09ExternalEvidenceRoleV1 =
  keyof typeof MCFT_CAP09_EXTERNAL_EVIDENCE_ROLE_POLICY_V1;

export type ExternalEvidenceFetchRequestV1 = {
  request_id: string;
  provider_id: string;
  source_family: string;
  locator: string;
  allowed_final_hosts: readonly string[];
  use_policy_ref: string;
  requested_at: string;
  source_issue_time?: string;
  source_event_time?: string;
  expected_content_type_prefixes: readonly string[];
  limitations: readonly string[];
};

export type ExternalEvidenceFetchResponseV1 = {
  status: number;
  final_locator: string;
  content_type: string;
  retrieved_at: string;
  available_at: string;
  bytes: Uint8Array;
};

export interface ExternalEvidenceTransportPortV1 {
  fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1>;
}

export type RawEvidenceRetentionInputV1 = {
  retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE";
  request_id: string;
  provider_id: string;
  source_family: string;
  source_locator: string;
  final_locator: string;
  content_type: string;
  retrieved_at: string;
  available_at: string;
  source_issue_time?: string;
  source_event_time?: string;
  use_policy_ref: string;
  raw_sha256: string;
  raw_bytes: number;
  bytes: Uint8Array;
};

export type RawEvidenceRetentionReceiptV1 = {
  retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE";
  retention_ref: string;
  retained_sha256: string;
  retained_bytes: number;
  retained_at: string;
  externally_publishable: false;
};

export interface RawEvidenceRetentionPortV1 {
  retainRawEvidence(input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1>;
}

export type VerifiedRawEvidenceProvenanceV1 = {
  request_id: string;
  provider_id: string;
  source_family: string;
  source_locator: string;
  final_locator: string;
  content_type: string;
  source_issue_time?: string;
  source_event_time?: string;
  retrieved_at: string;
  available_at: string;
  raw_sha256: string;
  raw_bytes: number;
  retention_ref: string;
  retained_at: string;
  use_policy_ref: string;
};

export type GovernedDecodedEvidenceDraftV1 = {
  role: McftCap09ExternalEvidenceRoleV1;
  source_record_id: string;
  binding_id: string;
  origin_source_kind: string;
  origin_source_id: string;
  epistemic_class: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
  quality: { status: "PASS" | "LIMITED"; [key: string]: unknown };
  source_payload: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
  conversion_rule: {
    conversion_rule_id: string;
    conversion_rule_version: string;
    authority_ref: string;
    [key: string]: unknown;
  };
  source_binding_version: number;
  limitations: readonly string[];
};

export type ExternalEvidenceDecoderInputV1 = {
  raw_bytes: Uint8Array;
  provenance: VerifiedRawEvidenceProvenanceV1;
};

export interface ExternalEvidenceDecoderPortV1 {
  readonly decoder_id: string;
  readonly decoder_version: string;
  decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]>;
}

export type ExternalEvidencePipelineInputV1 = {
  dataset_id: string;
  scope: TwinScopeKeyV1;
  request: ExternalEvidenceFetchRequestV1;
  canonicalized_at: string;
};

export type ExternalEvidenceLivePipelineInputV1 = Omit<ExternalEvidencePipelineInputV1, "canonicalized_at">;
export type ExternalEvidenceCompletionClockV1 = () => string;

export type CanonicalizedExternalEvidenceResultV1 = {
  pipeline_version: typeof MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1;
  raw_provenance: VerifiedRawEvidenceProvenanceV1;
  decoder: { decoder_id: string; decoder_version: string };
  record: CanonicalReplayEvidenceRecordV1;
  canonical_payload_sha256: string;
  record_semantic_sha256: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalIso(value: unknown, code: string): string {
  const raw = text(value);
  const milliseconds = Date.parse(raw);
  if (!raw || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== raw) {
    throw new Error(`${code}:${raw || "MISSING"}`);
  }
  return raw;
}

function rawSha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function validateScope(scope: TwinScopeKeyV1): TwinScopeKeyV1 {
  requireCondition(Object.values(scope).every((value) => text(value)), "EA3_SIX_KEY_SCOPE_REQUIRED");
  requireCondition(scope.field_id !== "field_c8_demo", "EA3_REPLAY_FIELD_ID_FORBIDDEN");
  return { ...scope };
}

function assertHttpsAllowedHost(locator: string, hosts: readonly string[], code: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(locator);
  } catch {
    throw new Error(`${code}_URL_INVALID`);
  }
  requireCondition(parsed.protocol === "https:", `${code}_HTTPS_REQUIRED`);
  requireCondition(hosts.includes(parsed.hostname), `${code}_HOST_NOT_ALLOWED:${parsed.hostname}`);
  return parsed;
}

function containsBinary(value: unknown, seen = new Set<object>()): boolean {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);
  if (Array.isArray(value)) return value.some((item) => containsBinary(item, seen));
  return Object.values(value as Record<string, unknown>).some((item) => containsBinary(item, seen));
}

function unsafeTrustSurface(value: Record<string, unknown>): boolean {
  const evidenceLevel = text(value.evidence_level).toUpperCase();
  const sourceLane = text(value.source_lane).toUpperCase();
  return value.formal_eligible === false
    || value.is_simulated === true
    || evidenceLevel === "DEBUG"
    || sourceLane === "DEBUG_ONLY"
    || sourceLane === "SIMULATED_DEV_ONLY";
}

function canonicalizeDraft(input: {
  dataset_id: string;
  scope: TwinScopeKeyV1;
  canonicalized_at: string;
  provenance: VerifiedRawEvidenceProvenanceV1;
  decoder: ExternalEvidenceDecoderPortV1;
  draft: GovernedDecodedEvidenceDraftV1;
}): CanonicalizedExternalEvidenceResultV1 {
  const policy = MCFT_CAP09_EXTERNAL_EVIDENCE_ROLE_POLICY_V1[input.draft.role];
  requireCondition(policy, `EA3_ROLE_NOT_ALLOWED:${String(input.draft.role)}`);
  requireCondition(text(input.dataset_id), "EA3_DATASET_ID_REQUIRED");
  requireCondition(text(input.draft.source_record_id), "EA3_SOURCE_RECORD_ID_REQUIRED");
  requireCondition(text(input.draft.binding_id), "EA3_BINDING_ID_REQUIRED");
  requireCondition(text(input.draft.origin_source_kind), "EA3_ORIGIN_SOURCE_KIND_REQUIRED");
  requireCondition(text(input.draft.origin_source_id), "EA3_ORIGIN_SOURCE_ID_REQUIRED");
  requireCondition(input.draft.epistemic_class === policy.epistemic_class, `EA3_EPISTEMIC_CLASS_MISMATCH:${input.draft.role}`);
  requireCondition(["PASS", "LIMITED"].includes(input.draft.quality.status), "EA3_QUALITY_STATUS_NOT_ALLOWED");
  requireCondition(text(input.draft.source_unit) && text(input.draft.canonical_unit), "EA3_UNITS_REQUIRED");
  requireCondition(Number.isInteger(input.draft.source_binding_version) && input.draft.source_binding_version > 0, "EA3_SOURCE_BINDING_VERSION_REQUIRED");
  requireCondition(text(input.draft.conversion_rule.conversion_rule_id), "EA3_CONVERSION_RULE_ID_REQUIRED");
  requireCondition(text(input.draft.conversion_rule.conversion_rule_version), "EA3_CONVERSION_RULE_VERSION_REQUIRED");
  requireCondition(text(input.draft.conversion_rule.authority_ref), "EA3_CONVERSION_RULE_AUTHORITY_REQUIRED");
  requireCondition(input.draft.limitations.length > 0 && input.draft.limitations.every((item) => text(item)), "EA3_LIMITATIONS_REQUIRED");
  requireCondition(!containsBinary(input.draft.source_payload) && !containsBinary(input.draft.canonical_payload), "EA3_RAW_BINARY_IN_CANONICAL_RECORD_FORBIDDEN");
  requireCondition(!unsafeTrustSurface(input.draft.source_payload) && !unsafeTrustSurface(input.draft.canonical_payload), "EA3_UNSAFE_TRUST_SURFACE_FORBIDDEN");

  const eventTime = canonicalIso(input.draft.role_time[policy.event_time_field], "EA3_ROLE_EVENT_TIME_INVALID");
  const ingestedAt = canonicalIso(input.draft.role_time.ingested_at, "EA3_INGESTED_AT_INVALID");
  const availableAt = canonicalIso(input.draft.available_to_runtime_at, "EA3_AVAILABLE_TO_RUNTIME_AT_INVALID");
  const canonicalizedAt = canonicalIso(input.canonicalized_at, "EA3_CANONICALIZED_AT_INVALID");
  const retrievedAt = canonicalIso(input.provenance.retrieved_at, "EA3_RETRIEVED_AT_INVALID");
  const sourceAvailableAt = canonicalIso(input.provenance.available_at, "EA3_SOURCE_AVAILABLE_AT_INVALID");

  requireCondition(Date.parse(eventTime) <= Date.parse(availableAt), "EA3_EVENT_TIME_AFTER_RUNTIME_AVAILABILITY");
  requireCondition(Date.parse(retrievedAt) <= Date.parse(availableAt), "EA3_RETRIEVAL_AFTER_RUNTIME_AVAILABILITY");
  requireCondition(Date.parse(sourceAvailableAt) <= Date.parse(availableAt), "EA3_SOURCE_AVAILABILITY_AFTER_RUNTIME_AVAILABILITY");
  requireCondition(Date.parse(availableAt) <= Date.parse(ingestedAt), "EA3_RUNTIME_AVAILABILITY_AFTER_INGESTED_AT");
  requireCondition(Date.parse(ingestedAt) <= Date.parse(canonicalizedAt), "EA3_INGESTED_AFTER_CANONICALIZATION");

  const canonicalPayloadSha256 = semanticHashV1(input.draft.canonical_payload);
  const sourceRecordHash = semanticHashV1({
    source_record_id: input.draft.source_record_id,
    raw_sha256: input.provenance.raw_sha256,
    retention_ref: input.provenance.retention_ref,
    decoder_id: input.decoder.decoder_id,
    decoder_version: input.decoder.decoder_version,
    source_payload: input.draft.source_payload,
  });
  const executionMetadata: ReplayEvidenceExecutionMetadataV1 = {
    policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
    source_binding_version: input.draft.source_binding_version,
    conversion_rule_version: input.draft.conversion_rule.conversion_rule_version,
  };
  const rawProvenancePublic = {
    provider_id: input.provenance.provider_id,
    source_family: input.provenance.source_family,
    final_locator: input.provenance.final_locator,
    source_issue_time: input.provenance.source_issue_time ?? null,
    source_event_time: input.provenance.source_event_time ?? null,
    retrieved_at: input.provenance.retrieved_at,
    available_at: input.provenance.available_at,
    raw_sha256: input.provenance.raw_sha256,
    raw_bytes: input.provenance.raw_bytes,
    retention_ref: input.provenance.retention_ref,
    retained_at: input.provenance.retained_at,
    use_policy_ref: input.provenance.use_policy_ref,
    decoder_id: input.decoder.decoder_id,
    decoder_version: input.decoder.decoder_version,
    raw_payload_embedded: false,
  };
  const record: CanonicalReplayEvidenceRecordV1 = {
    ...validateScope(input.scope),
    dataset_id: input.dataset_id,
    source_record_id: input.draft.source_record_id,
    source_record_hash: sourceRecordHash,
    record_type: policy.record_type,
    binding_id: input.draft.binding_id,
    origin_source_kind: input.draft.origin_source_kind,
    origin_source_id: input.draft.origin_source_id,
    epistemic_class: policy.epistemic_class,
    available_to_runtime_at: availableAt,
    role_time: { ...input.draft.role_time, ingested_at: ingestedAt },
    quality: {
      ...input.draft.quality,
      canonical_payload_sha256: canonicalPayloadSha256,
      raw_source_sha256: input.provenance.raw_sha256,
      raw_retention_ref: input.provenance.retention_ref,
      raw_payload_embedded: false,
    },
    source_payload: {
      ...input.draft.source_payload,
      raw_provenance: rawProvenancePublic,
    },
    canonical_payload: { ...input.draft.canonical_payload },
    source_unit: input.draft.source_unit,
    canonical_unit: input.draft.canonical_unit,
    conversion_rule: { ...input.draft.conversion_rule },
    execution_metadata: executionMetadata,
    limitations: [...input.draft.limitations],
  };
  requireCondition(!containsBinary(record), "EA3_BINARY_LEAK_IN_CANONICAL_OUTPUT");
  const recordSemanticSha256 = semanticHashV1(record);
  return {
    pipeline_version: MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
    raw_provenance: input.provenance,
    decoder: { decoder_id: input.decoder.decoder_id, decoder_version: input.decoder.decoder_version },
    record,
    canonical_payload_sha256: canonicalPayloadSha256,
    record_semantic_sha256: recordSemanticSha256,
  };
}

function validatePipelineRequestV1(input: ExternalEvidenceLivePipelineInputV1): void {
  validateScope(input.scope);
  canonicalIso(input.request.requested_at, "EA3_REQUESTED_AT_INVALID");
  requireCondition(text(input.request.request_id), "EA3_REQUEST_ID_REQUIRED");
  requireCondition(text(input.request.provider_id), "EA3_PROVIDER_ID_REQUIRED");
  requireCondition(text(input.request.source_family), "EA3_SOURCE_FAMILY_REQUIRED");
  requireCondition(text(input.request.use_policy_ref), "EA3_USE_POLICY_REF_REQUIRED");
  requireCondition(input.request.allowed_final_hosts.length > 0, "EA3_ALLOWED_FINAL_HOST_REQUIRED");
  requireCondition(input.request.expected_content_type_prefixes.length > 0, "EA3_EXPECTED_CONTENT_TYPE_REQUIRED");
  requireCondition(input.request.limitations.length > 0, "EA3_REQUEST_LIMITATIONS_REQUIRED");
  assertHttpsAllowedHost(input.request.locator, input.request.allowed_final_hosts, "EA3_REQUEST_LOCATOR");
}

async function collectRetainDecodeV1(
  input: ExternalEvidenceLivePipelineInputV1,
  ports: {
    transport: ExternalEvidenceTransportPortV1;
    retention: RawEvidenceRetentionPortV1;
    decoder: ExternalEvidenceDecoderPortV1;
  },
): Promise<{
  provenance: VerifiedRawEvidenceProvenanceV1;
  decoded: readonly GovernedDecodedEvidenceDraftV1[];
}> {
  validatePipelineRequestV1(input);
  const response = await ports.transport.fetchRawEvidence(input.request);
  requireCondition(Number.isInteger(response.status) && response.status >= 200 && response.status < 300, `EA3_SOURCE_HTTP_STATUS_NOT_SUCCESS:${response.status}`);
  assertHttpsAllowedHost(response.final_locator, input.request.allowed_final_hosts, "EA3_FINAL_LOCATOR");
  requireCondition(
    input.request.expected_content_type_prefixes.some((prefix) => response.content_type.toLowerCase().startsWith(prefix.toLowerCase())),
    `EA3_CONTENT_TYPE_NOT_ALLOWED:${response.content_type}`,
  );
  const retrievedAt = canonicalIso(response.retrieved_at, "EA3_RETRIEVED_AT_INVALID");
  const availableAt = canonicalIso(response.available_at, "EA3_SOURCE_AVAILABLE_AT_INVALID");
  requireCondition(Date.parse(availableAt) <= Date.parse(retrievedAt), "EA3_SOURCE_AVAILABLE_AFTER_RETRIEVAL");
  requireCondition(response.bytes.byteLength > 0, "EA3_EMPTY_RAW_RESPONSE_FORBIDDEN");

  const digest = rawSha256(response.bytes);
  const retentionInput: RawEvidenceRetentionInputV1 = {
    retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id: input.request.request_id,
    provider_id: input.request.provider_id,
    source_family: input.request.source_family,
    source_locator: input.request.locator,
    final_locator: response.final_locator,
    content_type: response.content_type,
    retrieved_at: retrievedAt,
    available_at: availableAt,
    source_issue_time: input.request.source_issue_time,
    source_event_time: input.request.source_event_time,
    use_policy_ref: input.request.use_policy_ref,
    raw_sha256: digest,
    raw_bytes: response.bytes.byteLength,
    bytes: response.bytes,
  };
  const receipt = await ports.retention.retainRawEvidence(retentionInput);
  requireCondition(receipt.retention_class === "PRIVATE_RESTRICTED_RAW_EVIDENCE", "EA3_RETENTION_CLASS_DRIFT");
  requireCondition(text(receipt.retention_ref), "EA3_RETENTION_REF_REQUIRED");
  requireCondition(receipt.retained_sha256 === digest, "EA3_RETENTION_DIGEST_MISMATCH");
  requireCondition(receipt.retained_bytes === response.bytes.byteLength, "EA3_RETENTION_BYTE_COUNT_MISMATCH");
  requireCondition(receipt.externally_publishable === false, "EA3_RAW_RETENTION_PUBLICATION_FORBIDDEN");
  const retainedAt = canonicalIso(receipt.retained_at, "EA3_RETAINED_AT_INVALID");
  requireCondition(Date.parse(retrievedAt) <= Date.parse(retainedAt), "EA3_RETAINED_BEFORE_RETRIEVAL");
  requireCondition(text(ports.decoder.decoder_id) && text(ports.decoder.decoder_version), "EA3_DECODER_IDENTITY_REQUIRED");

  const provenance: VerifiedRawEvidenceProvenanceV1 = {
    request_id: input.request.request_id,
    provider_id: input.request.provider_id,
    source_family: input.request.source_family,
    source_locator: input.request.locator,
    final_locator: response.final_locator,
    content_type: response.content_type,
    source_issue_time: input.request.source_issue_time,
    source_event_time: input.request.source_event_time,
    retrieved_at: retrievedAt,
    available_at: availableAt,
    raw_sha256: digest,
    raw_bytes: response.bytes.byteLength,
    retention_ref: receipt.retention_ref,
    retained_at: retainedAt,
    use_policy_ref: input.request.use_policy_ref,
  };

  // Decoder invocation is intentionally after the verified retention receipt barrier.
  const decoded = await ports.decoder.decodeRetainedEvidence({ raw_bytes: response.bytes, provenance });
  requireCondition(decoded.length > 0, "EA3_DECODER_EMPTY_RESULT_FORBIDDEN");
  return { provenance, decoded };
}

function canonicalizeDecodedV1(input: {
  pipeline: ExternalEvidenceLivePipelineInputV1;
  canonicalized_at: string;
  provenance: VerifiedRawEvidenceProvenanceV1;
  decoded: readonly GovernedDecodedEvidenceDraftV1[];
  decoder: ExternalEvidenceDecoderPortV1;
}): readonly CanonicalizedExternalEvidenceResultV1[] {
  const ids = new Set<string>();
  const results = input.decoded.map((draft) => {
    requireCondition(!ids.has(draft.source_record_id), `EA3_DUPLICATE_SOURCE_RECORD_ID:${draft.source_record_id}`);
    ids.add(draft.source_record_id);
    return canonicalizeDraft({
      dataset_id: input.pipeline.dataset_id,
      scope: input.pipeline.scope,
      canonicalized_at: input.canonicalized_at,
      provenance: input.provenance,
      decoder: input.decoder,
      draft,
    });
  });
  return results.sort((left, right) =>
    left.record.record_type.localeCompare(right.record.record_type)
    || left.record.source_record_id.localeCompare(right.record.source_record_id),
  );
}

export async function collectRetainDecodeCanonicalizeExternalEvidenceV1(
  input: ExternalEvidencePipelineInputV1,
  ports: {
    transport: ExternalEvidenceTransportPortV1;
    retention: RawEvidenceRetentionPortV1;
    decoder: ExternalEvidenceDecoderPortV1;
  },
): Promise<readonly CanonicalizedExternalEvidenceResultV1[]> {
  const canonicalizedAt = canonicalIso(input.canonicalized_at, "EA3_CANONICALIZED_AT_INVALID");
  const collected = await collectRetainDecodeV1(input, ports);
  return canonicalizeDecodedV1({
    pipeline: input,
    canonicalized_at: canonicalizedAt,
    provenance: collected.provenance,
    decoded: collected.decoded,
    decoder: ports.decoder,
  });
}

export async function collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1(
  input: ExternalEvidenceLivePipelineInputV1,
  ports: {
    transport: ExternalEvidenceTransportPortV1;
    retention: RawEvidenceRetentionPortV1;
    decoder: ExternalEvidenceDecoderPortV1;
  },
  completionClock: ExternalEvidenceCompletionClockV1 = () => new Date().toISOString(),
): Promise<readonly CanonicalizedExternalEvidenceResultV1[]> {
  const collected = await collectRetainDecodeV1(input, ports);
  const canonicalizedAt = canonicalIso(completionClock(), "EA3_COMPLETION_CLOCK_INVALID");
  requireCondition(
    Date.parse(collected.provenance.retained_at) <= Date.parse(canonicalizedAt),
    "EA3_CANONICALIZED_BEFORE_RAW_RETENTION",
  );
  return canonicalizeDecodedV1({
    pipeline: input,
    canonicalized_at: canonicalizedAt,
    provenance: collected.provenance,
    decoded: collected.decoded,
    decoder: ports.decoder,
  });
}
