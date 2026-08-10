// MCFT-CAP-09 S6-EA5E2: executable External Formal collector phase composition.
// Boundary: no concrete provider transport, storage, database, environment, scheduler, or wall-clock read.
// The caller injects transport/retention/decoder and restricted ingress ports. This module binds both
// collector phases to one exact Formal slot, enforces Amendment-07 timing/family rules, and always
// completes raw retention + canonicalization for the whole phase before any canonical ingress call.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { TwinScopeKeyV1 } from "../runtime/twin_runtime/ports.js";
import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type CanonicalizedExternalEvidenceResultV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidencePipelineInputV1,
  type ExternalEvidenceTransportPortV1,
  type RawEvidenceRetentionPortV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";

export const MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_ORCHESTRATOR_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_ORCHESTRATOR_V1" as const;

export const MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_PROFILE_V1 = {
  pre_boundary_collector_offset_minutes: -30,
  late_exact_hour_collector_offset_minutes: 390,
  late_exact_hour_evidence_cutoff_offset_minutes: 432,
} as const;

export type ExternalFormalCollectorPhaseV1 = "PRE_BOUNDARY_CAUSAL" | "LATE_EXACT_HOUR";

export type ExternalFormalCollectorSlotAuthorityV1 = {
  epoch_id: string;
  slot_id: string;
  scope: TwinScopeKeyV1;
  logical_time: string;
  pre_boundary_causal_collector_target: string;
  late_exact_hour_collector_scheduled: string;
  late_exact_hour_evidence_cutoff: string;
};

export type ExternalFormalCollectorPipelineJobV1 = {
  pipeline_input: ExternalEvidencePipelineInputV1;
  ports: {
    transport: ExternalEvidenceTransportPortV1;
    retention: RawEvidenceRetentionPortV1;
    decoder: ExternalEvidenceDecoderPortV1;
  };
};

export type ExternalFormalCanonicalizedPhaseInputV1 = {
  phase: ExternalFormalCollectorPhaseV1;
  requested_at: string;
  canonicalized_at: string;
  provider_request_count: number;
  canonical_results: readonly CanonicalizedExternalEvidenceResultV1[];
  ingress: ExternalFormalEvidenceIngressPortV1;
};

export type ExternalFormalEvidenceIngressReceiptV1 = {
  record_type: string;
  source_record_id: string;
  canonical_fact_write_count: 0 | 1;
  [key: string]: unknown;
};

export interface ExternalFormalEvidenceIngressPortV1 {
  appendCanonicalizedExternalEvidence(
    result: CanonicalizedExternalEvidenceResultV1,
  ): Promise<ExternalFormalEvidenceIngressReceiptV1>;
}

export type ExternalFormalCollectorPhaseExecutionResultV1 = {
  orchestrator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_ORCHESTRATOR_ID_V1;
  slot_key: string;
  phase: ExternalFormalCollectorPhaseV1;
  logical_time: string;
  canonical_record_count: number;
  record_types: string[];
  source_record_ids: string[];
  raw_retention_refs: string[];
  provider_request_count: number;
  ingress_attempt_count: number;
  canonical_fact_write_count: number;
  ingress_receipts: ExternalFormalEvidenceIngressReceiptV1[];
};

type EvidenceAuthorityV1 = {
  binding_id: string;
  epistemic_class: "OBSERVED" | "ESTIMATED" | "ASSUMED";
};

const AUTHORITY_BY_RECORD_TYPE_V1: Readonly<Record<string, EvidenceAuthorityV1>> = {
  soil_moisture_observation_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
  },
  observed_rainfall_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
  },
  historical_et0_estimate_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    epistemic_class: "ESTIMATED",
  },
  future_weather_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
  },
  future_et0_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
  },
};

const PRE_BOUNDARY_REQUIRED_V1 = new Set([
  "soil_moisture_observation_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
]);
const LATE_EXACT_REQUIRED_V1 = new Set([
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
]);

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

function exactScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function slotKeyV1(slot: ExternalFormalCollectorSlotAuthorityV1): string {
  return `${slot.epoch_id}|${slot.slot_id}|${slot.logical_time}`;
}

function validateSlotAuthorityV1(slot: ExternalFormalCollectorSlotAuthorityV1): ExternalFormalCollectorSlotAuthorityV1 {
  requiredTextV1(slot.epoch_id, "EA5E2_COLLECTOR_EPOCH_ID_REQUIRED");
  if (!/^O(?:0\d|1\d|2[0-3])$/.test(requiredTextV1(slot.slot_id, "EA5E2_COLLECTOR_SLOT_ID_REQUIRED"))) {
    throw new Error("EA5E2_COLLECTOR_SLOT_ID_INVALID");
  }
  const logicalTime = canonicalHourV1(slot.logical_time, "EA5E2_COLLECTOR_LOGICAL_TIME_INVALID");
  exactScopeV1(slot.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EA5E2_COLLECTOR_SCOPE_MISMATCH");
  const pre = canonicalIsoV1(slot.pre_boundary_causal_collector_target, "EA5E2_COLLECTOR_PREBOUNDARY_TIME_INVALID");
  const late = canonicalIsoV1(slot.late_exact_hour_collector_scheduled, "EA5E2_COLLECTOR_LATE_TIME_INVALID");
  const cutoff = canonicalIsoV1(slot.late_exact_hour_evidence_cutoff, "EA5E2_COLLECTOR_CUTOFF_TIME_INVALID");
  if (pre !== addMinutesV1(logicalTime, MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_PROFILE_V1.pre_boundary_collector_offset_minutes)) {
    throw new Error("EA5E2_COLLECTOR_PREBOUNDARY_OFFSET_MISMATCH");
  }
  if (late !== addMinutesV1(logicalTime, MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_PROFILE_V1.late_exact_hour_collector_offset_minutes)) {
    throw new Error("EA5E2_COLLECTOR_LATE_OFFSET_MISMATCH");
  }
  if (cutoff !== addMinutesV1(logicalTime, MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_PROFILE_V1.late_exact_hour_evidence_cutoff_offset_minutes)) {
    throw new Error("EA5E2_COLLECTOR_CUTOFF_OFFSET_MISMATCH");
  }
  return structuredClone(slot);
}

function phaseDeadlineV1(slot: ExternalFormalCollectorSlotAuthorityV1, phase: ExternalFormalCollectorPhaseV1): string {
  return phase === "PRE_BOUNDARY_CAUSAL" ? slot.logical_time : slot.late_exact_hour_evidence_cutoff;
}

function phaseStartV1(slot: ExternalFormalCollectorSlotAuthorityV1, phase: ExternalFormalCollectorPhaseV1): string {
  return phase === "PRE_BOUNDARY_CAUSAL"
    ? slot.pre_boundary_causal_collector_target
    : slot.late_exact_hour_collector_scheduled;
}

function validatePhaseClockV1(input: {
  slot: ExternalFormalCollectorSlotAuthorityV1;
  phase: ExternalFormalCollectorPhaseV1;
  requested_at: string;
  canonicalized_at: string;
}): void {
  const requestedAt = canonicalIsoV1(input.requested_at, "EA5E2_COLLECTOR_REQUESTED_AT_INVALID");
  const canonicalizedAt = canonicalIsoV1(input.canonicalized_at, "EA5E2_COLLECTOR_CANONICALIZED_AT_INVALID");
  const start = phaseStartV1(input.slot, input.phase);
  const deadline = phaseDeadlineV1(input.slot, input.phase);
  if (Date.parse(requestedAt) < Date.parse(start)) throw new Error("EA5E2_COLLECTOR_PHASE_STARTED_BEFORE_AUTHORIZED_TARGET");
  if (Date.parse(requestedAt) > Date.parse(deadline)) throw new Error("EA5E2_COLLECTOR_PHASE_REQUEST_AFTER_DEADLINE");
  if (Date.parse(canonicalizedAt) < Date.parse(requestedAt)) throw new Error("EA5E2_COLLECTOR_CANONICALIZED_BEFORE_REQUEST");
  if (Date.parse(canonicalizedAt) > Date.parse(deadline)) throw new Error("EA5E2_COLLECTOR_CANONICALIZED_AFTER_DEADLINE");
}

function validateJobClockV1(
  slot: ExternalFormalCollectorSlotAuthorityV1,
  phase: ExternalFormalCollectorPhaseV1,
  input: ExternalEvidencePipelineInputV1,
): void {
  exactScopeV1(input.scope, slot.scope, "EA5E2_COLLECTOR_JOB_SCOPE_MISMATCH");
  validatePhaseClockV1({
    slot,
    phase,
    requested_at: input.request.requested_at,
    canonicalized_at: input.canonicalized_at,
  });
}

function validateRawRetentionV1(result: CanonicalizedExternalEvidenceResultV1): void {
  if (!result.raw_provenance.retention_ref.startsWith("s3-private://")) {
    throw new Error("EA5E2_COLLECTOR_PRIVATE_RAW_RETENTION_REQUIRED");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(result.raw_provenance.raw_sha256)) {
    throw new Error("EA5E2_COLLECTOR_RAW_SHA256_INVALID");
  }
  if (!Number.isSafeInteger(result.raw_provenance.raw_bytes) || result.raw_provenance.raw_bytes <= 0) {
    throw new Error("EA5E2_COLLECTOR_RAW_BYTES_INVALID");
  }
  canonicalIsoV1(result.raw_provenance.retained_at, "EA5E2_COLLECTOR_RETAINED_AT_INVALID");
}

function validateRecordAuthorityV1(
  slot: ExternalFormalCollectorSlotAuthorityV1,
  phase: ExternalFormalCollectorPhaseV1,
  result: CanonicalizedExternalEvidenceResultV1,
): void {
  validateRawRetentionV1(result);
  const record = result.record;
  exactScopeV1(record, slot.scope, "EA5E2_COLLECTOR_RECORD_SCOPE_MISMATCH");
  const authority = AUTHORITY_BY_RECORD_TYPE_V1[record.record_type];
  if (!authority) throw new Error(`EA5E2_COLLECTOR_RECORD_TYPE_NOT_AUTHORIZED:${record.record_type}`);
  const required = phase === "PRE_BOUNDARY_CAUSAL" ? PRE_BOUNDARY_REQUIRED_V1 : LATE_EXACT_REQUIRED_V1;
  if (!required.has(record.record_type)) throw new Error(`EA5E2_COLLECTOR_RECORD_TYPE_WRONG_PHASE:${record.record_type}`);
  if (record.binding_id !== authority.binding_id) throw new Error(`EA5E2_COLLECTOR_BINDING_MISMATCH:${record.record_type}`);
  if (record.epistemic_class !== authority.epistemic_class) throw new Error(`EA5E2_COLLECTOR_EPISTEMIC_MISMATCH:${record.record_type}`);
  const availableAt = canonicalIsoV1(record.available_to_runtime_at, "EA5E2_COLLECTOR_AVAILABLE_AT_INVALID");
  const ingestedAt = canonicalIsoV1(record.role_time?.ingested_at, "EA5E2_COLLECTOR_INGESTED_AT_INVALID");
  const deadline = phaseDeadlineV1(slot, phase);
  if (Date.parse(availableAt) > Date.parse(deadline) || Date.parse(ingestedAt) > Date.parse(deadline)) {
    throw new Error(`EA5E2_COLLECTOR_RECORD_AFTER_PHASE_DEADLINE:${record.record_type}`);
  }

  if (phase === "PRE_BOUNDARY_CAUSAL") {
    const eventField = record.record_type === "soil_moisture_observation_v1" ? "observed_at" : "issued_at";
    const eventTime = canonicalIsoV1(record.role_time?.[eventField], `EA5E2_COLLECTOR_PREBOUNDARY_EVENT_TIME_INVALID:${record.record_type}`);
    if (Date.parse(eventTime) > Date.parse(slot.logical_time)) {
      throw new Error(`EA5E2_COLLECTOR_PREBOUNDARY_FUTURE_EVENT_FORBIDDEN:${record.record_type}`);
    }
    return;
  }

  const intervalStart = canonicalIsoV1(record.role_time?.interval_start, `EA5E2_COLLECTOR_INTERVAL_START_INVALID:${record.record_type}`);
  const intervalEnd = canonicalIsoV1(record.role_time?.interval_end, `EA5E2_COLLECTOR_INTERVAL_END_INVALID:${record.record_type}`);
  if (intervalStart !== addMinutesV1(slot.logical_time, -60) || intervalEnd !== slot.logical_time) {
    throw new Error(`EA5E2_COLLECTOR_EXACT_INTERVAL_MISMATCH:${record.record_type}`);
  }
}

function validatePhaseFamilyCompletenessV1(
  phase: ExternalFormalCollectorPhaseV1,
  results: readonly CanonicalizedExternalEvidenceResultV1[],
): void {
  const required = phase === "PRE_BOUNDARY_CAUSAL" ? PRE_BOUNDARY_REQUIRED_V1 : LATE_EXACT_REQUIRED_V1;
  const found = new Set(results.map((item) => item.record.record_type));
  for (const recordType of required) {
    if (!found.has(recordType)) throw new Error(`EA5E2_COLLECTOR_REQUIRED_PHASE_FAMILY_MISSING:${recordType}`);
  }
}

async function validateAndIngressPhaseV1(input: {
  slot: ExternalFormalCollectorSlotAuthorityV1;
  slot_key: string;
  phase: ExternalFormalCollectorPhaseV1;
  canonical: readonly CanonicalizedExternalEvidenceResultV1[];
  provider_request_count: number;
  ingress: ExternalFormalEvidenceIngressPortV1;
}): Promise<ExternalFormalCollectorPhaseExecutionResultV1> {
  if (!Number.isSafeInteger(input.provider_request_count) || input.provider_request_count <= 0) {
    throw new Error("EA5E2_COLLECTOR_PROVIDER_REQUEST_COUNT_REQUIRED");
  }
  if (input.canonical.length === 0) throw new Error("EA5E2_COLLECTOR_CANONICAL_RESULT_REQUIRED");
  const sourceIds = new Set<string>();
  for (const result of input.canonical) {
    validateRecordAuthorityV1(input.slot, input.phase, result);
    if (sourceIds.has(result.record.source_record_id)) {
      throw new Error(`EA5E2_COLLECTOR_DUPLICATE_SOURCE_RECORD_ID:${result.record.source_record_id}`);
    }
    sourceIds.add(result.record.source_record_id);
  }
  validatePhaseFamilyCompletenessV1(input.phase, input.canonical);

  // Whole-phase validation is complete before the first canonical ingress call.
  const ordered = [...input.canonical].sort((left, right) =>
    left.record.record_type.localeCompare(right.record.record_type)
    || left.record.source_record_id.localeCompare(right.record.source_record_id),
  );
  const receipts: ExternalFormalEvidenceIngressReceiptV1[] = [];
  for (const result of ordered) {
    const receipt = await input.ingress.appendCanonicalizedExternalEvidence(result);
    if (receipt.record_type !== result.record.record_type || receipt.source_record_id !== result.record.source_record_id) {
      throw new Error("EA5E2_COLLECTOR_INGRESS_RECEIPT_IDENTITY_MISMATCH");
    }
    if (receipt.canonical_fact_write_count !== 0 && receipt.canonical_fact_write_count !== 1) {
      throw new Error("EA5E2_COLLECTOR_INGRESS_WRITE_COUNT_INVALID");
    }
    receipts.push(receipt);
  }

  return {
    orchestrator_id: MCFT_CAP09_EXTERNAL_FORMAL_COLLECTOR_PHASE_ORCHESTRATOR_ID_V1,
    slot_key: input.slot_key,
    phase: input.phase,
    logical_time: input.slot.logical_time,
    canonical_record_count: ordered.length,
    record_types: ordered.map((item) => item.record.record_type),
    source_record_ids: ordered.map((item) => item.record.source_record_id),
    raw_retention_refs: [...new Set(ordered.map((item) => item.raw_provenance.retention_ref))].sort(),
    provider_request_count: input.provider_request_count,
    ingress_attempt_count: receipts.length,
    canonical_fact_write_count: receipts.reduce((sum, item) => sum + item.canonical_fact_write_count, 0),
    ingress_receipts: receipts,
  };
}

export class McftCap09ExternalFormalCollectorPhaseOrchestratorV1 {
  readonly slot: ExternalFormalCollectorSlotAuthorityV1;
  readonly slot_key: string;

  constructor(slot: ExternalFormalCollectorSlotAuthorityV1) {
    this.slot = validateSlotAuthorityV1(slot);
    this.slot_key = slotKeyV1(this.slot);
  }

  async executePhase(input: {
    phase: ExternalFormalCollectorPhaseV1;
    jobs: readonly ExternalFormalCollectorPipelineJobV1[];
    ingress: ExternalFormalEvidenceIngressPortV1;
  }): Promise<ExternalFormalCollectorPhaseExecutionResultV1> {
    if (input.jobs.length === 0) throw new Error("EA5E2_COLLECTOR_PHASE_JOB_REQUIRED");
    const canonical: CanonicalizedExternalEvidenceResultV1[] = [];
    for (const job of input.jobs) {
      validateJobClockV1(this.slot, input.phase, job.pipeline_input);
      const results = await collectRetainDecodeCanonicalizeExternalEvidenceV1(job.pipeline_input, job.ports);
      canonical.push(...results);
    }
    return validateAndIngressPhaseV1({
      slot: this.slot,
      slot_key: this.slot_key,
      phase: input.phase,
      canonical,
      provider_request_count: input.jobs.length,
      ingress: input.ingress,
    });
  }

  async ingestCanonicalizedPhase(
    input: ExternalFormalCanonicalizedPhaseInputV1,
  ): Promise<ExternalFormalCollectorPhaseExecutionResultV1> {
    validatePhaseClockV1({
      slot: this.slot,
      phase: input.phase,
      requested_at: input.requested_at,
      canonicalized_at: input.canonicalized_at,
    });
    for (const result of input.canonical_results) {
      if (Date.parse(result.raw_provenance.retained_at) > Date.parse(input.canonicalized_at)) {
        throw new Error("EA5E2_COLLECTOR_CANONICALIZED_BEFORE_RAW_RETENTION");
      }
    }
    return validateAndIngressPhaseV1({
      slot: this.slot,
      slot_key: this.slot_key,
      phase: input.phase,
      canonical: input.canonical_results,
      provider_request_count: input.provider_request_count,
      ingress: input.ingress,
    });
  }
}
