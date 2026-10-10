import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06d compatibility adapter only.
 *
 * decision_plan_v0 is a recorded action proposal / execution candidate.
 * This adapter projects that frozen legacy contract into CandidateDecisionV1
 * without granting eligibility, approval, plan, task, scheduling, or execution
 * authority and without wiring any runtime consumer.
 */

export type DecisionPlanCandidateProjectionContextV1 = {
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

const FORBIDDEN_DECISION_PLAN_KEY =
  /^(priority|recommendation|trigger|condition|state|status|next_action|executor|schedule|scheduled|execute|execution|execution_time|execution_window|resource_lock)$/i;

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

function assertNoForbiddenDecisionPlanSemantics(value: unknown, path = "payload"): void {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenDecisionPlanSemantics(item, path + "[" + index + "]"));
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_DECISION_PLAN_KEY.test(key) || /^auto_/i.test(key)) {
      throw new Error("B06D_DECISION_PLAN_FORBIDDEN_SEMANTIC:" + path + "." + key);
    }
    assertNoForbiddenDecisionPlanSemantics(child, path + "." + key);
  }
}

function scalarParameters(value: unknown): {
  parameters: Record<string, string | number | boolean | null>;
  nestedOmitted: boolean;
} {
  const source = record(value);
  const parameters: Record<string, string | number | boolean | null> = {};
  let nestedOmitted = false;

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = text(rawKey);
    if (!key) continue;
    if (rawValue === null || typeof rawValue === "string" || typeof rawValue === "boolean") {
      parameters[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      parameters[key] = rawValue;
      continue;
    }
    nestedOmitted = true;
  }

  return { parameters, nestedOmitted };
}

function normalizedConfidence(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function legacyEvidenceFactRefs(basedOn: Record<string, unknown>): string[] {
  const refs = Array.isArray(basedOn.evidence_refs) ? basedOn.evidence_refs : [];
  return Array.from(new Set(refs.map((item) => {
    if (typeof item === "string") return text(item);
    return text(record(item).fact_id);
  }).filter(Boolean)));
}

export function projectDecisionPlanCandidateV1(
  sourceRecordValue: Record<string, unknown>,
  context: DecisionPlanCandidateProjectionContextV1,
): CandidateDecisionV1 {
  const sourceRecord = record(sourceRecordValue);
  if (text(sourceRecord.type) !== "decision_plan_v0") {
    throw new Error("B06D_SOURCE_TYPE_NOT_DECISION_PLAN_V0");
  }

  const payload = record(sourceRecord.payload);
  if (Object.keys(payload).length === 0) {
    throw new Error("B06D_DECISION_PLAN_PAYLOAD_REQUIRED");
  }

  assertNoForbiddenDecisionPlanSemantics(payload);

  if (text(payload.decision_scope).toLowerCase() !== "proposal") {
    throw new Error("B06D_DECISION_SCOPE_MUST_BE_PROPOSAL");
  }

  const subjectRef = record(payload.subject_ref);
  const subjectGroupId = text(subjectRef.groupId);
  const canonicalGroupId = text(context.scope.group_id);
  if (!subjectGroupId || !canonicalGroupId || subjectGroupId !== canonicalGroupId) {
    throw new Error("B06D_SUBJECT_GROUP_SCOPE_MISMATCH");
  }

  const proposedAction = record(payload.proposed_action);
  const actionType = text(proposedAction.action_type);
  const target = record(proposedAction.target);
  const targetKind = text(target.kind);
  const targetRef = text(target.ref);
  if (!actionType || !targetKind || !targetRef) {
    throw new Error("B06D_PROPOSED_ACTION_INCOMPLETE");
  }

  if (targetKind.toLowerCase() === "field") {
    const canonicalFieldId = text(context.scope.field_id);
    if (!canonicalFieldId || targetRef !== canonicalFieldId) {
      throw new Error("B06D_TARGET_FIELD_SCOPE_MISMATCH");
    }
  }

  if (targetKind.toLowerCase() === "group" && targetRef !== canonicalGroupId) {
    throw new Error("B06D_TARGET_GROUP_SCOPE_MISMATCH");
  }

  const { parameters, nestedOmitted } = scalarParameters(proposedAction.parameters_hint);
  const basedOn = record(payload.based_on);
  const legacyEvidenceRefs = legacyEvidenceFactRefs(basedOn);
  const confidence = normalizedConfidence(payload.confidence);
  const limitations = [
    "B06D_DECISION_PLAN_COMPATIBILITY_PROJECTION",
    "DECISION_PLAN_REMAINS_NON_EXECUTING",
  ];

  if (legacyEvidenceRefs.length > 0) {
    limitations.push("LEGACY_EVIDENCE_REFS_NOT_PROMOTED_TO_CANONICAL_QUALIFICATION");
  }
  if (nestedOmitted) {
    limitations.push("LEGACY_NESTED_PARAMETERS_NOT_PROMOTED_TO_PARAMETERS_HINT");
  }
  if (payload.confidence != null && confidence === null) {
    limitations.push("LEGACY_CONFIDENCE_INVALID_NOT_PROMOTED");
  }
  if (payload.created_at_ts != null) {
    limitations.push("LEGACY_CREATED_AT_TS_NOT_USED_AS_CANONICAL_CREATED_AT");
  }

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_DECISION_PLAN",
    proposed_action: {
      action_type: actionType,
      target: {
        kind: targetKind,
        ref: targetRef,
      },
      parameters_hint: parameters,
      action_spec_ref: null,
    },
    basis: {
      evidence_qualification_refs: uniqueText(context.evidence_qualification_refs),
      context_snapshot_ref: optionalRef(context.context_snapshot_ref),
      crop_stage_state_ref: optionalRef(context.crop_stage_state_ref),
      calculation_result_refs: uniqueText(context.calculation_result_refs),
      interpretation_refs: uniqueText(context.interpretation_refs),
      legacy_source_refs: uniqueText([
        context.source_ref,
        ...legacyEvidenceRefs,
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence,
    reasons: [],
    limitations: uniqueText(limitations),
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
