// apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts
// Purpose: deterministically validate, classify, deduplicate, and select the latest usable authorized soil-moisture observation for one CAP-03 logical tick.
// Boundary: pure application logic over caller-supplied canonical Evidence; no database, persistence, filesystem, network, wall clock, tick execution, or multi-sensor fusion.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { AssimilatedObservationCandidateV1 } from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "./ports.js";

export const ASSIMILATED_OBSERVATION_SELECTOR_ID_V1 =
  "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1" as const;
export const ASSIMILATED_OBSERVATION_MAX_AGE_SECONDS_V1 = 15 * 60 as const;
export const ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V1 =
  "INGESTED_DESC_SOURCE_RECORD_ID_ASC_V1" as const;
export const ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V1 =
  "OBSERVED_DESC_INGESTED_DESC_SOURCE_RECORD_ID_ASC_V1" as const;

export type SelectedAssimilatedObservationV1 = {
  selector_id: typeof ASSIMILATED_OBSERVATION_SELECTOR_ID_V1;
  duplicate_winner_policy_id: typeof ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V1;
  usable_sort_policy_id: typeof ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V1;
  logical_time: string;
  candidates: AssimilatedObservationCandidateV1[];
  selected_observation: AssimilatedObservationCandidateV1 | null;
  selected_observation_ref: string | null;
  evaluated_observation_refs: string[];
  rejected_observation_refs: string[];
  semantic_digest: string;
};

type CandidateWorkV1 = {
  record: CanonicalReplayEvidenceRecordV1;
  candidate: AssimilatedObservationCandidateV1;
  semantic_identity: string;
  preliminary_reasons: string[];
};

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string") throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function requiredRecordV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value as Record<string, unknown>;
}

function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function sourceVersionV1(record: CanonicalReplayEvidenceRecordV1): string {
  return requiredStringV1(record.source_payload.source_version, "SOURCE_VERSION_REQUIRED");
}

function semanticIdentityV1(record: CanonicalReplayEvidenceRecordV1, observedAt: string, quantityKind: string): string {
  return semanticHashV1({
    tenant_id: record.tenant_id,
    project_id: record.project_id,
    group_id: record.group_id,
    field_id: record.field_id,
    season_id: record.season_id,
    zone_id: record.zone_id,
    binding_id: record.binding_id,
    quantity_kind: quantityKind,
    observed_at: observedAt,
    origin_source_kind: record.origin_source_kind,
    origin_source_id: record.origin_source_id,
    source_version: sourceVersionV1(record),
  });
}

function semanticContentHashV1(input: {
  canonical_payload: Record<string, unknown>;
  quality_status: string;
  source_unit: string;
  canonical_unit: string;
  conversion_rule: { id: string; version: string };
  epistemic_class: string;
}): string {
  return semanticHashV1({
    canonical_payload: input.canonical_payload,
    quality_status: input.quality_status,
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: input.conversion_rule,
    epistemic_class: input.epistemic_class,
  });
}

function classifyCandidateV1(input: {
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  saturation_fraction: number;
}): CandidateWorkV1 {
  const { record } = input;
  const sourceRecordId = requiredStringV1(record.source_record_id, "SOURCE_RECORD_ID_REQUIRED");
  const sourceRecordHash = requiredStringV1(record.source_record_hash, "SOURCE_RECORD_HASH_REQUIRED");
  requiredRecordV1(record.role_time, "ROLE_TIME_REQUIRED");
  const canonicalPayload = requiredRecordV1(record.canonical_payload, "CANONICAL_PAYLOAD_REQUIRED");
  const sourcePayload = requiredRecordV1(record.source_payload, "SOURCE_PAYLOAD_REQUIRED");
  const observedAt = canonicalIsoV1(record.role_time.observed_at, "OBSERVED_AT_INVALID");
  const availableAt = canonicalIsoV1(record.available_to_runtime_at, "AVAILABLE_AT_INVALID");
  const ingestedAt = canonicalIsoV1(record.role_time.ingested_at, "INGESTED_AT_INVALID");
  const sourceUnit = requiredStringV1(sourcePayload.unit, "SOURCE_UNIT_REQUIRED");
  const canonicalUnit = requiredStringV1(canonicalPayload.unit, "CANONICAL_UNIT_REQUIRED");
  const quantityKind = requiredStringV1(canonicalPayload.quantity_kind, "QUANTITY_KIND_REQUIRED");
  const canonicalValue = finiteNumberV1(canonicalPayload.value, "CANONICAL_VALUE_NON_FINITE");
  const qualityStatus = requiredStringV1(record.quality?.status, "QUALITY_STATUS_REQUIRED");
  if (!(["PASS", "LIMITED", "FAIL"] as const).includes(qualityStatus as "PASS" | "LIMITED" | "FAIL")) {
    throw new Error("MALFORMED_CANONICAL_OBSERVATION:UNKNOWN_QUALITY_STATUS");
  }
  const conversion = requiredRecordV1(record.conversion_rule, "CONVERSION_RULE_REQUIRED");
  const conversionRule = {
    id: requiredStringV1(conversion.id, "CONVERSION_RULE_ID_REQUIRED"),
    version: requiredStringV1(conversion.version, "CONVERSION_RULE_VERSION_REQUIRED"),
  };
  const epistemicClass = requiredStringV1(record.epistemic_class, "EPISTEMIC_CLASS_REQUIRED");
  if (epistemicClass !== "OBSERVED") {
    throw new Error("MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_EPISTEMIC_CLASS");
  }

  const logicalMs = Date.parse(input.logical_time);
  const observedMs = Date.parse(observedAt);
  const ageSeconds = Math.trunc((logicalMs - observedMs) / 1000);
  const reasons: string[] = [];
  if (!sameScopeV1(record, input.scope)) reasons.push("REJECTED_SCOPE");
  if (observedMs > logicalMs) reasons.push("REJECTED_TIME_FUTURE");
  if (Date.parse(availableAt) > logicalMs || Date.parse(ingestedAt) > logicalMs) reasons.push("REJECTED_TIME_LATE");
  if (ageSeconds > ASSIMILATED_OBSERVATION_MAX_AGE_SECONDS_V1) reasons.push("REJECTED_TIME_STALE");
  if (record.binding_id !== ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1) reasons.push("REJECTED_UNAUTHORIZED_BINDING");
  if (record.record_type !== "soil_moisture_observation_v1") reasons.push("REJECTED_RECORD_TYPE");
  if (quantityKind !== ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1) reasons.push("REJECTED_QUANTITY");
  if (canonicalUnit !== "fraction" || record.canonical_unit !== "fraction") reasons.push("REJECTED_CANONICAL_UNIT");
  if (canonicalValue < 0 || canonicalValue > input.saturation_fraction) reasons.push("REJECTED_PHYSICAL_BOUNDS");
  if (qualityStatus === "FAIL") reasons.push("REJECTED_QUALITY_FAIL");

  const contentHash = semanticContentHashV1({
    canonical_payload: canonicalPayload,
    quality_status: qualityStatus,
    source_unit: sourceUnit,
    canonical_unit: canonicalUnit,
    conversion_rule: conversionRule,
    epistemic_class: epistemicClass,
  });

  const primary = reasons[0] ?? "ELIGIBLE";
  const candidate: AssimilatedObservationCandidateV1 = {
    observation_ref: sourceRecordId,
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    observation_semantic_content_hash: contentHash,
    record_type: "soil_moisture_observation_v1",
    epistemic_class: "OBSERVED",
    observed_at: observedAt,
    available_to_runtime_at: availableAt,
    ingested_at: ingestedAt,
    binding_id: record.binding_id,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    source_unit: sourceUnit,
    canonical_unit: "fraction",
    conversion_rule: conversionRule,
    canonical_payload: { unit: "fraction", value: canonicalValue },
    canonical_value: canonicalValue,
    quality_status: qualityStatus as "PASS" | "LIMITED" | "FAIL",
    temporal_offset_seconds: ageSeconds,
    candidate_assessment: primary as AssimilatedObservationCandidateV1["candidate_assessment"],
    reason_codes: reasons,
  };

  return {
    record,
    candidate,
    semantic_identity: semanticIdentityV1(record, observedAt, quantityKind),
    preliminary_reasons: reasons.slice(0, 8),
  };
}

function winnerSortV1(a: CandidateWorkV1, b: CandidateWorkV1): number {
  return b.candidate.ingested_at.localeCompare(a.candidate.ingested_at)
    || a.candidate.source_record_id.localeCompare(b.candidate.source_record_id);
}

function usableSortV1(a: CandidateWorkV1, b: CandidateWorkV1): number {
  return b.candidate.observed_at.localeCompare(a.candidate.observed_at)
    || b.candidate.ingested_at.localeCompare(a.candidate.ingested_at)
    || a.candidate.source_record_id.localeCompare(b.candidate.source_record_id);
}

function finalSortV1(a: AssimilatedObservationCandidateV1, b: AssimilatedObservationCandidateV1): number {
  return b.observed_at.localeCompare(a.observed_at)
    || b.ingested_at.localeCompare(a.ingested_at)
    || a.source_record_id.localeCompare(b.source_record_id);
}

export function selectAssimilatedContinuationObservationV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  saturation_fraction: number;
  observation_records: readonly CanonicalReplayEvidenceRecordV1[];
}): SelectedAssimilatedObservationV1 {
  const logicalTime = canonicalIsoV1(input.logical_time, "LOGICAL_TIME_INVALID");
  if (!Number.isFinite(input.saturation_fraction) || input.saturation_fraction <= 0 || input.saturation_fraction > 1) {
    throw new Error("INVALID_RUNTIME_CONFIG:SATURATION_FRACTION");
  }

  const classified = input.observation_records.map((record) => classifyCandidateV1({
    record,
    scope: input.scope,
    logical_time: logicalTime,
    saturation_fraction: input.saturation_fraction,
  }));

  const duplicateEligible = classified.filter((item) => item.preliminary_reasons.length === 0);
  const groups = new Map<string, CandidateWorkV1[]>();
  for (const item of duplicateEligible) {
    const group = groups.get(item.semantic_identity) ?? [];
    group.push(item);
    groups.set(item.semantic_identity, group);
  }

  const usableWinners: CandidateWorkV1[] = [];
  for (const [identity, group] of groups) {
    const contentHashes = new Set(group.map((item) => item.candidate.observation_semantic_content_hash));
    if (contentHashes.size > 1) throw new Error(`CONFLICTING_DUPLICATE_EVIDENCE:${identity}`);
    group.sort(winnerSortV1);
    usableWinners.push(group[0]);
    for (const duplicate of group.slice(1)) {
      duplicate.candidate.candidate_assessment = "IDENTICAL_DUPLICATE_SUPPRESSED";
      duplicate.candidate.reason_codes = ["IDENTICAL_DUPLICATE_SUPPRESSED"];
    }
  }

  usableWinners.sort(usableSortV1);
  const selected = usableWinners[0] ?? null;
  if (selected) {
    selected.candidate.candidate_assessment = "SELECTED";
    selected.candidate.reason_codes = [];
    for (const older of usableWinners.slice(1)) {
      older.candidate.candidate_assessment = "NOT_SELECTED_OLDER_USABLE";
      older.candidate.reason_codes = ["NOT_SELECTED_OLDER_USABLE"];
    }
  }

  const candidates = classified.map((item) => item.candidate).sort(finalSortV1);
  const selectedRef = selected?.candidate.observation_ref ?? null;
  const rejectedRefs = candidates
    .filter((candidate) => candidate.candidate_assessment !== "SELECTED")
    .map((candidate) => candidate.observation_ref)
    .sort();
  const semanticDigest = semanticHashV1({
    selector_id: ASSIMILATED_OBSERVATION_SELECTOR_ID_V1,
    duplicate_winner_policy_id: ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V1,
    usable_sort_policy_id: ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V1,
    logical_time: logicalTime,
    candidates,
    selected_observation_ref: selectedRef,
  });

  return {
    selector_id: ASSIMILATED_OBSERVATION_SELECTOR_ID_V1,
    duplicate_winner_policy_id: ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V1,
    usable_sort_policy_id: ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V1,
    logical_time: logicalTime,
    candidates,
    selected_observation: selected?.candidate ?? null,
    selected_observation_ref: selectedRef,
    evaluated_observation_refs: selectedRef ? [selectedRef] : [],
    rejected_observation_refs: rejectedRefs,
    semantic_digest: semanticDigest,
  };
}
