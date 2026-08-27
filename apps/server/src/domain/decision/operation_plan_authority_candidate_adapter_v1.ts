import {
  candidateDecisionV1Schema,
  type CandidateDecisionV1,
} from "../../contracts/canonical_decision_v1.js";
import type { EvidenceScopeV1 } from "../../contracts/canonical_evidence_v1.js";

/**
 * B-06f compatibility classifier + projection only.
 *
 * operation_plan_v1 is not uniformly a candidate object. Some plans are
 * approval-derived current plan authority, some are downstream plan state,
 * and the Agronomy Agent writes a grandfathered direct plan immediately
 * after recommendation generation.
 *
 * This module first classifies real source authority. Only the exact
 * grandfathered Agronomy Agent CREATED-plan provenance is candidate-view
 * compatible. No runtime consumer is wired and no source authority is removed.
 */

export type OperationPlanFactEnvelopeV1 = {
  fact_id?: string | null;
  source: string;
  record_json: Record<string, unknown>;
};

export type OperationPlanAuthorityClassV1 =
  | "GRANDFATHERED_DIRECT_PLAN_AUTHORITY"
  | "APPROVAL_DERIVED_PLAN_AUTHORITY"
  | "DOWNSTREAM_PLAN_AUTHORITY"
  | "UNKNOWN_PLAN_AUTHORITY";

export type OperationPlanAuthorityClassificationV1 = {
  classification: OperationPlanAuthorityClassV1;
  candidate_compatible: boolean;
  operation_plan_id: string | null;
  source: string;
  transition_source: string | null;
  transition_trigger: string | null;
  reasons: string[];
};

export type OperationPlanCandidateProjectionContextV1 = {
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

const AGRONOMY_AGENT_SOURCE = "jobs/agronomy_agent";
const AGRONOMY_AGENT_TRIGGER = "agronomy_agent_auto_create";
const CANDIDATE_ACTION_TYPES = new Set(["IRRIGATE", "FERTILIZE", "SPRAY", "INSPECT"]);
const DOWNSTREAM_STATUSES = new Set([
  "APPROVED",
  "READY",
  "DISPATCHED",
  "ACKED",
  "SUCCEEDED",
  "FAILED",
  "INVALID_EXECUTION",
  "PENDING_ACCEPTANCE",
  "EXECUTED",
]);

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

function nonEmptyField(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return key;
  }
  return null;
}

function booleanTrueField(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (source[key] === true) return key;
  }
  return null;
}

function classify(
  classification: OperationPlanAuthorityClassV1,
  operationPlanId: string | null,
  source: string,
  transitionSource: string | null,
  transitionTrigger: string | null,
  reasons: string[],
): OperationPlanAuthorityClassificationV1 {
  return {
    classification,
    candidate_compatible: classification === "GRANDFATHERED_DIRECT_PLAN_AUTHORITY",
    operation_plan_id: operationPlanId,
    source,
    transition_source: transitionSource,
    transition_trigger: transitionTrigger,
    reasons,
  };
}

export function classifyOperationPlanAuthorityV1(
  planFactValue: OperationPlanFactEnvelopeV1,
  transitionFactValue?: OperationPlanFactEnvelopeV1 | null,
): OperationPlanAuthorityClassificationV1 {
  const planFact = record(planFactValue);
  const source = text(planFact.source);
  const planRecord = record(planFact.record_json);
  const planType = text(planRecord.type);
  const payload = record(planRecord.payload);
  const operationPlanId = text(payload.operation_plan_id) || null;

  const transitionFact = transitionFactValue ? record(transitionFactValue) : {};
  const transitionSource = transitionFactValue ? text(transitionFact.source) || null : null;
  const transitionRecord = transitionFactValue ? record(transitionFact.record_json) : {};
  const transitionType = transitionFactValue ? text(transitionRecord.type) : "";
  const transitionPayload = transitionFactValue ? record(transitionRecord.payload) : {};
  const transitionTrigger = transitionFactValue ? text(transitionPayload.trigger) || null : null;

  if (planType !== "operation_plan_v1" || !operationPlanId || !source) {
    return classify(
      "UNKNOWN_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["OPERATION_PLAN_FACT_IDENTITY_INCOMPLETE"],
    );
  }

  const approvalField = nonEmptyField(payload, [
    "approval_request_id",
    "approval_decision_id",
    "approval_decision",
    "approval_decision_fact_id",
    "decision_id",
    "approval_id",
  ]);
  if (approvalField) {
    return classify(
      "APPROVAL_DERIVED_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["APPROVAL_LINEAGE_PRESENT:" + approvalField],
    );
  }

  const downstreamField = nonEmptyField(payload, [
    "act_task_id",
    "task_id",
    "dispatch_id",
    "receipt_fact_id",
    "ao_act_fact_id",
  ]);
  const downstreamBoolean = booleanTrueField(payload, [
    "task_created",
    "dispatch_created",
    "execution_created",
    "receipt_created",
  ]);
  const status = text(payload.status).toUpperCase();

  if (downstreamField || downstreamBoolean || DOWNSTREAM_STATUSES.has(status)) {
    return classify(
      "DOWNSTREAM_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      [
        downstreamField
          ? "DOWNSTREAM_ID_PRESENT:" + downstreamField
          : downstreamBoolean
            ? "DOWNSTREAM_FLAG_PRESENT:" + downstreamBoolean
            : "DOWNSTREAM_STATUS:" + status,
      ],
    );
  }

  if (source !== AGRONOMY_AGENT_SOURCE) {
    return classify(
      "UNKNOWN_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["SOURCE_NOT_AGRONOMY_AGENT"],
    );
  }

  if (!transitionFactValue) {
    return classify(
      "UNKNOWN_PLAN_AUTHORITY",
      operationPlanId,
      source,
      null,
      null,
      ["AGRONOMY_AGENT_TRANSITION_PROVENANCE_REQUIRED"],
    );
  }

  const transitionPlanId = text(transitionPayload.operation_plan_id);
  const transitionStatus = text(transitionPayload.status).toUpperCase();

  if (
    transitionType !== "operation_plan_transition_v1"
    || transitionSource !== AGRONOMY_AGENT_SOURCE
    || transitionTrigger !== AGRONOMY_AGENT_TRIGGER
    || transitionPlanId !== operationPlanId
    || status !== "CREATED"
    || transitionStatus !== "CREATED"
  ) {
    return classify(
      "UNKNOWN_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["AGRONOMY_AGENT_DUAL_PROVENANCE_NOT_EXACT"],
    );
  }

  const transitionApprovalField = nonEmptyField(transitionPayload, [
    "approval_request_id",
    "approval_decision_id",
    "approval_decision",
    "approval_decision_fact_id",
    "decision_id",
    "approval_id",
  ]);
  const transitionDownstreamField = nonEmptyField(transitionPayload, [
    "act_task_id",
    "task_id",
    "dispatch_id",
    "receipt_fact_id",
    "ao_act_fact_id",
  ]);
  if (transitionApprovalField) {
    return classify(
      "APPROVAL_DERIVED_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["TRANSITION_APPROVAL_LINEAGE_PRESENT:" + transitionApprovalField],
    );
  }
  if (transitionDownstreamField) {
    return classify(
      "DOWNSTREAM_PLAN_AUTHORITY",
      operationPlanId,
      source,
      transitionSource,
      transitionTrigger,
      ["TRANSITION_DOWNSTREAM_ID_PRESENT:" + transitionDownstreamField],
    );
  }

  return classify(
    "GRANDFATHERED_DIRECT_PLAN_AUTHORITY",
    operationPlanId,
    source,
    transitionSource,
    transitionTrigger,
    [
      "AGRONOMY_AGENT_PLAN_SOURCE_EXACT",
      "AGRONOMY_AGENT_AUTO_CREATE_TRANSITION_EXACT",
      "NO_APPROVAL_OR_DOWNSTREAM_LINEAGE_PRESENT",
    ],
  );
}

function assertScopeCompatibility(payload: Record<string, unknown>, scope: EvidenceScopeV1): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    const legacyValue = text(payload[key]);
    const canonicalValue = text(scope[key]);

    if (legacyValue && legacyValue !== canonicalValue) {
      throw new Error("B06F_OPERATION_PLAN_SCOPE_MISMATCH:" + key);
    }

    if (["tenant_id", "project_id", "group_id", "field_id"].includes(key) && !legacyValue) {
      throw new Error("B06F_OPERATION_PLAN_REQUIRED_SCOPE_MISSING:" + key);
    }
  }
}

export function projectLegacyOperationPlanProposalCandidateV1(
  planFact: OperationPlanFactEnvelopeV1,
  transitionFact: OperationPlanFactEnvelopeV1,
  context: OperationPlanCandidateProjectionContextV1,
): CandidateDecisionV1 {
  const authority = classifyOperationPlanAuthorityV1(planFact, transitionFact);
  if (!authority.candidate_compatible) {
    throw new Error("B06F_OPERATION_PLAN_NOT_CANDIDATE_COMPATIBLE:" + authority.classification);
  }

  const planRecord = record(planFact.record_json);
  const payload = record(planRecord.payload);
  assertScopeCompatibility(payload, context.scope);

  const actionType = text(payload.action_type).toUpperCase();
  if (!CANDIDATE_ACTION_TYPES.has(actionType)) {
    throw new Error("B06F_OPERATION_PLAN_ACTION_NOT_CANONICAL_CANDIDATE:" + (actionType || "MISSING"));
  }

  const recommendationId = text(payload.recommendation_id);
  if (!recommendationId) {
    throw new Error("B06F_AGRONOMY_AGENT_RECOMMENDATION_ID_REQUIRED");
  }

  const reasonCodes = uniqueText(payload.reason_codes);
  const ruleId = text(payload.rule_id);
  const programId = text(payload.program_id);
  const planFactId = text(planFact.fact_id);
  const transitionFactId = text(transitionFact.fact_id);

  return candidateDecisionV1Schema.parse({
    schema_version: "candidate_decision_v1",
    candidate_id: context.candidate_id,
    scope: context.scope,
    source_ref: context.source_ref,
    source_class: "LEGACY_OPERATION_PLAN_PROPOSAL",
    proposed_action: {
      action_type: actionType,
      target: {
        kind: "field",
        ref: text(context.scope.field_id),
      },
      parameters_hint: {},
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
        planFactId ? "fact:" + planFactId : "",
        transitionFactId ? "fact:" + transitionFactId : "",
        "recommendation:" + recommendationId,
        ruleId ? "rule:" + ruleId : "",
        programId ? "program:" + programId : "",
        ...(context.legacy_source_refs ?? []),
      ]),
    },
    confidence: null,
    reasons: reasonCodes,
    limitations: [
      "B06F_GRANDFATHERED_DIRECT_PLAN_PROJECTED_AS_CANDIDATE_VIEW",
      "SOURCE_OPERATION_PLAN_RETAINS_HISTORICAL_PLAN_AUTHORITY_UNTIL_B09",
      "NO_APPROVAL_OR_EXECUTION_AUTHORITY_PROMOTED",
      "LEGACY_OPERATION_PLAN_DEVICE_EXPECTED_EFFECT_NOT_PROMOTED",
      "LEGACY_CREATED_TS_NOT_USED_AS_CANONICAL_CREATED_AT",
    ],
    decision_time: context.decision_time ?? null,
    created_at: context.created_at,
    authority_state: "CANDIDATE_ONLY",
  });
}
