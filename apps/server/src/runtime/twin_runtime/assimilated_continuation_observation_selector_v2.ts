// apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts
// Purpose: deterministically classify, deduplicate, and select one supported soil-moisture observation under the remediated MCFT-CAP-03 V2 semantic order.
// Boundary: pure caller-supplied Evidence logic only; no database, persistence, filesystem, network, wall clock, Runtime tick execution, canonical write, or V1 mutation.

import {
  computeAssimilatedObservationSemanticContentHashV2,
  type AssimilatedObservationCandidateV2,
  type AssimilatedObservationQualityV2,
} from "../../domain/twin_runtime/assimilated_continuation_contracts_v2.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const ASSIMILATED_OBSERVATION_SELECTOR_ID_V2 =
  "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2" as const;

export const ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2 =
  900_000 as const;

export const ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V2 =
  "INGESTED_DESC_SOURCE_RECORD_ID_ASC_V2" as const;

export const ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V2 =
  "OBSERVED_DESC_INGESTED_DESC_SOURCE_RECORD_ID_ASC_V2" as const;

export type SelectedAssimilatedObservationV2 = {
  selector_id: typeof ASSIMILATED_OBSERVATION_SELECTOR_ID_V2;
  duplicate_winner_policy_id: typeof ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V2;
  usable_sort_policy_id: typeof ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V2;
  logical_time: string;
  candidates: AssimilatedObservationCandidateV2[];
  selected_observation: AssimilatedObservationCandidateV2 | null;
  selected_observation_ref: string | null;
  evaluated_observation_refs: string[];
  rejected_observation_refs: string[];
  semantic_digest: string;
};

type CandidateWorkV2 = {
  candidate: AssimilatedObservationCandidateV2;
  semantic_identity: string;
  structural_reasons: string[];
};

function canonicalIsoV2(value: unknown, code: string): string {
  if (typeof value !== "string") {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function requiredStringV2(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function requiredRecordV2(
  value: unknown,
  code: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value as Record<string, unknown>;
}

function finiteNumberV2(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MALFORMED_CANONICAL_OBSERVATION:${code}`);
  }
  return value;
}

function sameScopeV2(
  record: CanonicalReplayEvidenceRecordV1,
  scope: TwinScopeKeyV1,
): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function sourceVersionV2(record: CanonicalReplayEvidenceRecordV1): string {
  return requiredStringV2(
    record.source_payload.source_version,
    "SOURCE_VERSION_REQUIRED",
  );
}

function semanticIdentityV2(
  record: CanonicalReplayEvidenceRecordV1,
  observedAt: string,
  quantityKind: string,
): string {
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
    source_version: sourceVersionV2(record),
  });
}

function classifyCandidateV2(input: {
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
}): CandidateWorkV2 {
  const { record } = input;
  const sourceRecordId = requiredStringV2(
    record.source_record_id,
    "SOURCE_RECORD_ID_REQUIRED",
  );
  const sourceRecordHash = requiredStringV2(
    record.source_record_hash,
    "SOURCE_RECORD_HASH_REQUIRED",
  );

  if (record.record_type !== "soil_moisture_observation_v1") {
    throw new Error(
      "MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_RECORD_TYPE",
    );
  }

  const roleTime = requiredRecordV2(
    record.role_time,
    "ROLE_TIME_REQUIRED",
  );
  const canonicalPayload = requiredRecordV2(
    record.canonical_payload,
    "CANONICAL_PAYLOAD_REQUIRED",
  );
  const sourcePayload = requiredRecordV2(
    record.source_payload,
    "SOURCE_PAYLOAD_REQUIRED",
  );
  const observedAt = canonicalIsoV2(
    roleTime.observed_at,
    "OBSERVED_AT_INVALID",
  );
  const availableAt = canonicalIsoV2(
    record.available_to_runtime_at,
    "AVAILABLE_AT_INVALID",
  );
  const ingestedAt = canonicalIsoV2(
    roleTime.ingested_at,
    "INGESTED_AT_INVALID",
  );
  const sourceUnit = requiredStringV2(
    sourcePayload.unit,
    "SOURCE_UNIT_REQUIRED",
  );
  const canonicalUnit = requiredStringV2(
    canonicalPayload.unit,
    "CANONICAL_UNIT_REQUIRED",
  );
  const quantityKind = requiredStringV2(
    canonicalPayload.quantity_kind,
    "QUANTITY_KIND_REQUIRED",
  );
  const canonicalValue = finiteNumberV2(
    canonicalPayload.value,
    "CANONICAL_VALUE_NON_FINITE",
  );
  const qualityStatus = requiredStringV2(
    record.quality?.status,
    "QUALITY_STATUS_REQUIRED",
  );
  if (!( ["PASS", "LIMITED", "FAIL"] as const).includes(
    qualityStatus as AssimilatedObservationQualityV2["status"],
  )) {
    throw new Error(
      "MALFORMED_CANONICAL_OBSERVATION:UNKNOWN_QUALITY_STATUS",
    );
  }

  const conversion = requiredRecordV2(
    record.conversion_rule,
    "CONVERSION_RULE_REQUIRED",
  );
  const conversionRule = {
    id: requiredStringV2(
      conversion.id,
      "CONVERSION_RULE_ID_REQUIRED",
    ),
    version: requiredStringV2(
      conversion.version,
      "CONVERSION_RULE_VERSION_REQUIRED",
    ),
  };
  const epistemicClass = requiredStringV2(
    record.epistemic_class,
    "EPISTEMIC_CLASS_REQUIRED",
  );
  if (epistemicClass !== "OBSERVED") {
    throw new Error(
      "MALFORMED_CANONICAL_OBSERVATION:UNSUPPORTED_EPISTEMIC_CLASS",
    );
  }

  const logicalMs = Date.parse(input.logical_time);
  const observedMs = Date.parse(observedAt);
  const ageMilliseconds = logicalMs - observedMs;
  const structuralReasons: string[] = [];

  if (!sameScopeV2(record, input.scope)) {
    structuralReasons.push("REJECTED_SCOPE");
  }
  if (observedMs > logicalMs) {
    structuralReasons.push("REJECTED_TIME_FUTURE");
  }
  if (
    Date.parse(availableAt) > logicalMs
    || Date.parse(ingestedAt) > logicalMs
  ) {
    structuralReasons.push("REJECTED_TIME_LATE");
  }
  if (ageMilliseconds > ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2) {
    structuralReasons.push("REJECTED_TIME_STALE");
  }
  if (
    record.binding_id
    !== ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1
  ) {
    structuralReasons.push("REJECTED_UNAUTHORIZED_BINDING");
  }
  if (
    quantityKind
    !== ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1
  ) {
    structuralReasons.push("REJECTED_QUANTITY");
  }
  if (canonicalUnit !== "fraction" || record.canonical_unit !== "fraction") {
    structuralReasons.push("REJECTED_CANONICAL_UNIT");
  }

  const committedCanonicalPayload = structuredClone(canonicalPayload);
  const quality = {
    status: qualityStatus as AssimilatedObservationQualityV2["status"],
  };
  const contentHash = computeAssimilatedObservationSemanticContentHashV2({
    canonical_payload: committedCanonicalPayload,
    quality,
    source_unit: sourceUnit,
    canonical_unit: canonicalUnit,
    conversion_rule: conversionRule,
    epistemic_class: "OBSERVED",
  });

  const primary = structuralReasons[0] ?? "ELIGIBLE";
  const candidate: AssimilatedObservationCandidateV2 = {
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
    quantity_kind: quantityKind,
    source_unit: sourceUnit,
    canonical_unit: canonicalUnit,
    conversion_rule: conversionRule,
    canonical_payload: committedCanonicalPayload,
    canonical_value: canonicalValue,
    quality,
    quality_status: quality.status,
    temporal_offset_milliseconds: ageMilliseconds,
    candidate_assessment:
      primary as AssimilatedObservationCandidateV2["candidate_assessment"],
    reason_codes: [...structuralReasons],
  };

  return {
    candidate,
    semantic_identity: semanticIdentityV2(
      record,
      observedAt,
      quantityKind,
    ),
    structural_reasons: structuralReasons,
  };
}

function winnerSortV2(a: CandidateWorkV2, b: CandidateWorkV2): number {
  return b.candidate.ingested_at.localeCompare(a.candidate.ingested_at)
    || a.candidate.source_record_id.localeCompare(
      b.candidate.source_record_id,
    );
}

function usableSortV2(a: CandidateWorkV2, b: CandidateWorkV2): number {
  return b.candidate.observed_at.localeCompare(a.candidate.observed_at)
    || b.candidate.ingested_at.localeCompare(a.candidate.ingested_at)
    || a.candidate.source_record_id.localeCompare(
      b.candidate.source_record_id,
    );
}

function finalSortV2(
  a: AssimilatedObservationCandidateV2,
  b: AssimilatedObservationCandidateV2,
): number {
  return b.observed_at.localeCompare(a.observed_at)
    || b.ingested_at.localeCompare(a.ingested_at)
    || a.source_record_id.localeCompare(b.source_record_id);
}

function applyPhysicalAndQualityEligibilityV2(
  item: CandidateWorkV2,
  saturationFraction: number,
): boolean {
  const reasons: string[] = [];
  if (
    item.candidate.canonical_value < 0
    || item.candidate.canonical_value > saturationFraction
  ) {
    reasons.push("REJECTED_PHYSICAL_BOUNDS");
  }
  if (item.candidate.quality.status === "FAIL") {
    reasons.push("REJECTED_QUALITY_FAIL");
  }
  if (reasons.length > 0) {
    item.candidate.candidate_assessment =
      reasons[0] as AssimilatedObservationCandidateV2["candidate_assessment"];
    item.candidate.reason_codes = reasons;
    return false;
  }
  item.candidate.candidate_assessment = "ELIGIBLE";
  item.candidate.reason_codes = [];
  return true;
}

export function selectAssimilatedContinuationObservationV2(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  saturation_fraction: number;
  observation_records: readonly CanonicalReplayEvidenceRecordV1[];
}): SelectedAssimilatedObservationV2 {
  const logicalTime = canonicalIsoV2(
    input.logical_time,
    "LOGICAL_TIME_INVALID",
  );
  if (
    !Number.isFinite(input.saturation_fraction)
    || input.saturation_fraction <= 0
    || input.saturation_fraction > 1
  ) {
    throw new Error("INVALID_RUNTIME_CONFIG:SATURATION_FRACTION");
  }

  const classified = input.observation_records.map((record) =>
    classifyCandidateV2({
      record,
      scope: input.scope,
      logical_time: logicalTime,
    })
  );

  const duplicateEligible = classified.filter(
    (item) => item.structural_reasons.length === 0,
  );
  const groups = new Map<string, CandidateWorkV2[]>();
  for (const item of duplicateEligible) {
    const group = groups.get(item.semantic_identity) ?? [];
    group.push(item);
    groups.set(item.semantic_identity, group);
  }

  const usableWinners: CandidateWorkV2[] = [];
  for (const identity of [...groups.keys()].sort()) {
    const group = groups.get(identity) ?? [];
    const contentHashes = new Set(
      group.map(
        (item) => item.candidate.observation_semantic_content_hash,
      ),
    );
    if (contentHashes.size > 1) {
      throw new Error(`CONFLICTING_DUPLICATE_EVIDENCE:${identity}`);
    }

    group.sort(winnerSortV2);
    const winner = group[0];
    if (!winner) {
      continue;
    }
    for (const duplicate of group.slice(1)) {
      duplicate.candidate.candidate_assessment =
        "IDENTICAL_DUPLICATE_SUPPRESSED";
      duplicate.candidate.reason_codes = [
        "IDENTICAL_DUPLICATE_SUPPRESSED",
      ];
    }

    if (
      applyPhysicalAndQualityEligibilityV2(
        winner,
        input.saturation_fraction,
      )
    ) {
      usableWinners.push(winner);
    }
  }

  usableWinners.sort(usableSortV2);
  const selected = usableWinners[0] ?? null;
  if (selected) {
    selected.candidate.candidate_assessment = "SELECTED";
    selected.candidate.reason_codes = [];
    for (const older of usableWinners.slice(1)) {
      older.candidate.candidate_assessment =
        "NOT_SELECTED_OLDER_USABLE";
      older.candidate.reason_codes = [
        "NOT_SELECTED_OLDER_USABLE",
      ];
    }
  }

  const candidates = classified
    .map((item) => item.candidate)
    .sort(finalSortV2);
  const selectedRef = selected?.candidate.observation_ref ?? null;
  const evaluatedRefs = selectedRef === null ? [] : [selectedRef];
  const rejectedRefs = candidates
    .filter((candidate) =>
      candidate.candidate_assessment.startsWith("REJECTED_")
    )
    .map((candidate) => candidate.observation_ref)
    .sort();

  const semanticBasis = {
    selector_id: ASSIMILATED_OBSERVATION_SELECTOR_ID_V2,
    duplicate_winner_policy_id:
      ASSIMILATED_OBSERVATION_DUPLICATE_WINNER_POLICY_V2,
    usable_sort_policy_id:
      ASSIMILATED_OBSERVATION_USABLE_SORT_POLICY_V2,
    logical_time: logicalTime,
    candidates,
    selected_observation_ref: selectedRef,
    evaluated_observation_refs: evaluatedRefs,
    rejected_observation_refs: rejectedRefs,
  };

  return {
    ...semanticBasis,
    selected_observation: selected?.candidate ?? null,
    semantic_digest: semanticHashV1(semanticBasis),
  };
}
