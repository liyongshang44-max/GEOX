import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06e compatibility adapter only.
 *
 * This module projects the explicit ROOT_ZONE_SCENARIO_SELECTION
 * decision_recommendation_v1 payload into CandidateDecisionV1.
 *
 * It does not read a scenario table, infer a missing action from option ids,
 * qualify Evidence, create Decision Eligibility/Approval/Plan/Task, or connect
 * any runtime consumer.
 */

export type RootZoneScenarioCandidateProjectionContextV1 = {
  candidate_id: string;
  source_ref: string;
  scope: EvidenceScopeV1;
  evidence_qualification_refs: string[];
  context_snapshot_ref?: string | null;
  crop_stage_state_ref?: string | null;
  calculation_result_refs?: string[];
  interpretation_refs?: string[];
  legacy_source_refs?: string[];
  created_at: string;
  decision_time?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueText(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function optionalRef(value: string | null | undefined): string | null {
  const normalized = text(value);
  return normalized || null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireFalse(source: Record<string, unknown>, key: string): void {
  if (source[key] !== false) {
    throw new Error("B06E_DOWNSTREAM_FLAG_MUST_BE_FALSE:" + key);
  }
}

function assertScope(source: Record<string, unknown>, scope: EvidenceScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "zone_id"] as const) {
    const sourceValue = text(source[key]);
    const canonicalValue = text(scope[key]);
    if (!sourceValue || !canonicalValue || sourceValue !== canonicalValue) {
      throw new Error("B06E_SOURCE_SCOPE_MISMATCH:" + key);
    }
  }
}

function assertSourceEnvelope(source: Record<string, unknown>): void {
  if (text(source.source) !== "ROOT_ZONE_SCENARIO_SELECTION") {
    throw new Error("B06E_SOURCE_CLASS_INVALID");
  }
  if (text(source.recommendation_kind) !== "IRRIGATION_CANDIDATE_FROM_SCENARIO") {
    throw new Error("B06E_RECOMMENDATION_KIND_INVALID");
  }
  if (text(source.status).toUpperCase() !== "CANDIDATE") {
    throw new Error("B06E_STATUS_NOT_CANDIDATE");
  }
  if (source.human_approval_required !== true) {
    throw new Error("B06E_HUMAN_APPROVAL_BOUNDARY_MISSING");
  }
  if (source.no_direct_execution !== true) {
    throw new Error("B06E_NO_DIRECT_EXECUTION_BOUNDARY_MISSING");
  }

  for (const key of [
    "approval_created",
    "operation_plan_created",
    "task_created",
    "dispatch_created",
    "roi_created",
    "field_memory_created",
  ]) {
    requireFalse(source, key);
  }

  for (const key of [
    "recommendation_id",
    "source_scenario_set_id",
    "source_option_id",
    "source_forecast_id",
    "source_submission_id",
  ]) {
    if (!text(source[key])) {
      throw new Error("B06E_SOURCE_ID_REQUIRED:" + key);
    }
  }

  const evidenceRefs = uniqueText(source.evidence_refs);
  if (evidenceRefs.length === 0) {
    throw new Error("B06E_LEGACY_EVIDENCE_REFS_REQUIRED");
  }

  const quality = record(source.quality);
  if (text(quality.selected_option_quality_status) !== "COMPARABLE") {
    throw new Error("B06E_LEGACY_OPTION_NOT_COMPARABLE");
  }
  if (quality.evidence_quality_blocking !== false) {
    throw new Error("B06E_LEGACY_EVIDENCE_QUALITY_BLOCKING");
  }

  const derivation = record(source.derivation);
  if (
    derivation.scenario_derived !== true
    || derivation.no_direct_execution !== true
    || derivation.requires_human_approval !== true
    || derivation.auto_selected !== false
  ) {
    throw new Error("B06E_LEGACY_DERIVATION_BOUNDARY_INVALID");
  }
}

function parseProposedAction(source: Record<string, unknown>): {
  actionType: "IRRIGATE" | "DELAYED_IRRIGATION";
  irrigationMm: number;
  effectiveIrrigationMm: number;
  timing: "DAY0" | "DAY3";
} {
  const proposed = record(source.proposed_action);
  if (Object.keys(proposed).length === 0) {
    throw new Error("B06E_PROPOSED_ACTION_REQUIRED");
  }

  const actionType = text(proposed.action_type);
  if (actionType !== "IRRIGATE" && actionType !== "DELAYED_IRRIGATION") {
    throw new Error("B06E_ACTION_TYPE_INVALID:" + (actionType || "MISSING"));
  }

  const irrigationMm = finiteNumber(proposed.total_irrigation_mm);
  if (irrigationMm == null || irrigationMm <= 0) {
    throw new Error("B06E_IRRIGATION_AMOUNT_INVALID");
  }

  const effectiveIrrigationMm = finiteNumber(proposed.total_effective_irrigation_mm);
  if (effectiveIrrigationMm == null || effectiveIrrigationMm < 0) {
    throw new Error("B06E_EFFECTIVE_IRRIGATION_AMOUNT_INVALID");
  }

  const timing = text(proposed.timing);
  if (timing !== "DAY0" && timing !== "DAY3") {
    throw new Error("B06E_TIMING_INVALID");
  }
  if (actionType === "IRRIGATE" && timing !== "DAY0") {
    throw new Error("B06E_ACTION_TIMING_MISMATCH");
  }
  if (actionType === "DELAYED_IRRIGATION" && timing !== "DAY3") {
    throw new Error("B06E_ACTION_TIMING_MISMATCH");
  }

  return {
    actionType,
    irrigationMm,
    effectiveIrrigationMm,
    timing,
  };
}

export function projectRootZoneScenarioCandidateV1(
  sourceValue: Record<string, unknown>,
  context: RootZoneScenarioCandidateProjectionContextV1,
): CandidateDecisionV1 {
  const source = record(sourceValue);
  assertSourceEnvelope(source);
  assertScope(source, context.scope);
  const proposed = parseProposedAction(source);

  const sourceRef = context.source_ref;
  const legacySourceRefs = uniqueText([
    sourceRef,
    "root_zone_scenario_set:" + text(source.source_scenario_set_id),
    "root_zone_scenario_option:" + text(source.source_option_id),
    "root_zone_forecast:" + text(source.source_forecast_id),
    "operator_submission:" + text(source.source_submission_id),
    ...(context.legacy_source_refs ?? []),
  ]);

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: sourceRef,
    source_class: "LEGACY_RECOMMENDATION",
    proposed_action: {
      action_type: proposed.actionType,
      target: { kind: "zone", ref: text(context.scope.zone_id) },
      parameters_hint: {
        irrigation_mm: proposed.irrigationMm,
        effective_irrigation_mm: proposed.effectiveIrrigationMm,
        timing: proposed.timing,
      },
      action_spec_ref: null,
    },
    basis: {
      evidence_qualification_refs: uniqueText(context.evidence_qualification_refs),
      context_snapshot_ref: optionalRef(context.context_snapshot_ref),
      crop_stage_state_ref: optionalRef(context.crop_stage_state_ref),
      calculation_result_refs: uniqueText(context.calculation_result_refs),
      interpretation_refs: uniqueText(context.interpretation_refs),
      legacy_source_refs: legacySourceRefs,
    },
    confidence: null,
    reasons: [],
    limitations: [
      "B06E_ROOT_ZONE_SCENARIO_COMPATIBILITY_PROJECTION",
      "LEGACY_SCENARIO_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION",
      "LEGACY_SCENARIO_QUALITY_NOT_EQUIVALENT_TO_CANONICAL_EVIDENCE_QUALIFICATION",
      "LEGACY_SCENARIO_CONFIDENCE_NOT_REPORTED",
      "LEGACY_SOURCE_CREATED_AT_NOT_PROMOTED_TO_CANONICAL_CREATED_AT",
    ],
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
