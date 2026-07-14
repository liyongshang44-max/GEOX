// apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts
// Purpose: bind validated Approval Assertion and Approved Plan Replay Evidence to the unique canonical G Decision and current canonical Scenario, then persist Evidence and the rebuildable Plan binding projection.
// Boundary: internal Replay Runtime service only; GEOX exercises no approval or dispatch authority and creates no canonical Twin object, Recommendation, Task, Action Feedback, State/checkpoint, route, clock, filesystem, environment or network authority.

import type { Pool } from "pg";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import { resolveCap05ScenarioOptionMemberV1, type Cap05DecisionEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  normalizeCap05WaterAmountV1,
  validateCap05ApprovalAssertionEvidenceV1,
  validateCap05ApprovedPlanEvidenceV1,
  validateCap05ApprovalPlanDecisionBindingV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
  type Cap05DispatchDispositionV1,
} from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { PostgresApprovalPlanEvidenceRepositoryV1, type Cap05ApprovalPlanPersistenceResultV1 } from "../../persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";

export const CAP05_APPROVAL_PLAN_BINDING_SERVICE_ID_V1 = "MCFT_CAP_05_APPROVAL_PLAN_EVIDENCE_BINDING_SERVICE_V1" as const;

export type Cap05DispatchContextInputV1 = {
  disposition: Cap05DispatchDispositionV1;
  evidence_ref: string | null;
  evidence_hash: string | null;
};

export type CommitCap05ApprovalPlanBindingInputV1 = {
  scope: ContinuationScopeV1;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1;
  approved_plan: Cap05ApprovedPlanEvidenceV1;
  dispatch: Cap05DispatchContextInputV1;
};

export type CommitCap05ApprovalPlanBindingResultV1 = Cap05ApprovalPlanPersistenceResultV1 & {
  service_id: typeof CAP05_APPROVAL_PLAN_BINDING_SERVICE_ID_V1;
  scenario_set_ref: string;
  selected_option_ref: string;
  scenario_amount_mm: string;
  approved_amount_mm: string;
  amount_difference_mm: string;
  geox_approval_authority_exercised: false;
  geox_dispatch_created: false;
};

type ExternalDispatchEvidenceV1 = ContinuationScopeV1 & {
  record_type: "external_dispatch_evidence_v1";
  source_record_id: string;
  source_record_hash: string;
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  available_to_runtime_at: string;
  quality: { status: "PASS" | "LIMITED" | "FAIL" };
  canonical_payload: {
    approved_plan_ref: string;
    approved_plan_hash: string;
    dispatch_disposition: "EXTERNALLY_RECORDED";
    dispatcher_class: "EXTERNAL_SYSTEM";
    dispatcher_ref: string;
    geox_dispatch_created: false;
  };
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function decimalSixV1(value: unknown, code: string): string {
  return normalizeCap05WaterAmountV1(value, code);
}

function assertScopeV1(scope: ContinuationScopeV1, candidate: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (candidate[field] !== scope[field]) throw new Error(`${code}:${field}`);
  }
}

export class Cap05ApprovalPlanBindingServiceV1 {
  private readonly feedbackRepository: PostgresFeedbackPersistenceRepositoryV1;
  private readonly scenarioRepository: PostgresForecastScenarioRecoveryRepositoryV1;
  private readonly evidenceRepository: PostgresApprovalPlanEvidenceRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.feedbackRepository = new PostgresFeedbackPersistenceRepositoryV1(pool);
    this.scenarioRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    this.evidenceRepository = new PostgresApprovalPlanEvidenceRepositoryV1(pool);
  }

  private async resolveDecisionV1(
    scope: ContinuationScopeV1,
    assertion: Cap05ApprovalAssertionEvidenceV1,
  ): Promise<Cap05DecisionEnvelopeV1> {
    const payload = assertion.canonical_payload;
    const result = await this.pool.query(
      `SELECT decision_object_id FROM twin_decision_record_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND decision_request_evidence_ref=$7 AND decision_request_evidence_hash=$8
         AND selected_option_ref=$9 AND selected_option_hash=$10
       LIMIT 2`,
      [
        scope.tenant_id,
        scope.project_id,
        scope.group_id,
        scope.field_id,
        scope.season_id,
        scope.zone_id,
        payload.decision_request_ref,
        payload.decision_request_hash,
        payload.selected_option_ref,
        payload.selected_option_hash,
      ],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_APPROVAL_DECISION_BINDING_CARDINALITY");
    const object = await this.feedbackRepository.readCanonicalObject(result.rows[0].decision_object_id);
    if (!object || object.object_type !== "twin_decision_record_v1") throw new Error("CAP05_APPROVAL_DECISION_CANONICAL_MISSING");
    return object;
  }

  private assertEvidenceDecisionBindingV1(
    decision: Cap05DecisionEnvelopeV1,
    assertion: Cap05ApprovalAssertionEvidenceV1,
    plan: Cap05ApprovedPlanEvidenceV1,
  ): void {
    const assertionPayload = assertion.canonical_payload;
    const planPayload = plan.canonical_payload;
    if (assertionPayload.decision_request_ref !== decision.payload.decision_request_evidence_ref
      || assertionPayload.decision_request_hash !== decision.payload.decision_request_evidence_hash
      || assertionPayload.selected_option_ref !== decision.payload.selected_option_ref
      || assertionPayload.selected_option_hash !== decision.payload.selected_option_hash) {
      throw new Error("CAP05_APPROVAL_ASSERTION_DECISION_BINDING_MISMATCH");
    }
    if (planPayload.approval_assertion_ref !== assertion.source_record_id
      || planPayload.approval_assertion_hash !== assertion.source_record_hash) {
      throw new Error("CAP05_PLAN_ASSERTION_BINDING_MISMATCH");
    }
    if (planPayload.decision_request_ref !== assertionPayload.decision_request_ref
      || planPayload.decision_request_hash !== assertionPayload.decision_request_hash
      || planPayload.selected_option_ref !== assertionPayload.selected_option_ref
      || planPayload.selected_option_hash !== assertionPayload.selected_option_hash) {
      throw new Error("CAP05_PLAN_DECISION_BINDING_MISMATCH");
    }
    const assertionAvailable = canonicalInstantV1(assertion.available_to_runtime_at, "CAP05_APPROVAL_ASSERTION_AVAILABLE_AT_INVALID");
    const planAvailable = canonicalInstantV1(plan.available_to_runtime_at, "CAP05_APPROVED_PLAN_AVAILABLE_AT_INVALID");
    if (assertionAvailable < decision.as_of) throw new Error("CAP05_APPROVAL_ASSERTION_PRECEDES_DECISION");
    if (planAvailable < assertionAvailable) throw new Error("CAP05_APPROVED_PLAN_PRECEDES_ASSERTION");
  }

  private async validateDispatchContextV1(
    scope: ContinuationScopeV1,
    plan: Cap05ApprovedPlanEvidenceV1,
    dispatch: Cap05DispatchContextInputV1,
  ): Promise<void> {
    if (dispatch.disposition === "NOT_OBSERVED" || dispatch.disposition === "NOT_APPLICABLE") {
      if (dispatch.evidence_ref !== null || dispatch.evidence_hash !== null) throw new Error("CAP05_DISPATCH_EVIDENCE_FORBIDDEN_FOR_DISPOSITION");
      return;
    }
    const evidenceRef = requiredStringV1(dispatch.evidence_ref, "CAP05_DISPATCH_EVIDENCE_REF_REQUIRED");
    const evidenceHash = requiredStringV1(dispatch.evidence_hash, "CAP05_DISPATCH_EVIDENCE_HASH_REQUIRED");
    const result = await this.pool.query(
      `SELECT record_json FROM facts
       WHERE record_json->>'type'='external_dispatch_evidence_v1'
         AND record_json->'payload'->>'source_record_id'=$1
       LIMIT 2`,
      [evidenceRef],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_DISPATCH_EVIDENCE_CARDINALITY");
    const evidence = result.rows[0].record_json?.payload as ExternalDispatchEvidenceV1 | undefined;
    if (!evidence || evidence.source_record_id !== evidenceRef || evidence.source_record_hash !== evidenceHash) {
      throw new Error("CAP05_DISPATCH_EVIDENCE_IDENTITY_MISMATCH");
    }
    assertScopeV1(scope, evidence, "CAP05_DISPATCH_EVIDENCE_SCOPE_MISMATCH");
    if (evidence.origin_source_kind !== "CONTROLLED_REPLAY_DATASET" || evidence.quality?.status !== "PASS") {
      throw new Error("CAP05_DISPATCH_EVIDENCE_NOT_ELIGIBLE");
    }
    const payload = evidence.canonical_payload;
    if (payload.dispatch_disposition !== "EXTERNALLY_RECORDED"
      || payload.approved_plan_ref !== plan.source_record_id
      || payload.approved_plan_hash !== plan.source_record_hash
      || payload.geox_dispatch_created !== false) {
      throw new Error("CAP05_DISPATCH_EVIDENCE_PLAN_BINDING_MISMATCH");
    }
    if (canonicalInstantV1(evidence.available_to_runtime_at, "CAP05_DISPATCH_AVAILABLE_AT_INVALID") < plan.available_to_runtime_at) {
      throw new Error("CAP05_DISPATCH_PRECEDES_PLAN_AVAILABILITY");
    }
  }

  async commitApprovalPlanBinding(
    input: CommitCap05ApprovalPlanBindingInputV1,
  ): Promise<CommitCap05ApprovalPlanBindingResultV1> {
    validateCap05ApprovalAssertionEvidenceV1(input.approval_assertion, input.scope);
    validateCap05ApprovedPlanEvidenceV1(input.approved_plan, input.scope);
    const decision = await this.resolveDecisionV1(input.scope, input.approval_assertion);
    const amounts = validateCap05ApprovalPlanDecisionBindingV1({
      decision,
      approval_assertion: input.approval_assertion,
      approved_plan: input.approved_plan,
      as_of: input.approved_plan.available_to_runtime_at,
    });

    const scenarioRecord = await this.scenarioRepository.readScenarioSet(decision.payload.scenario_set_ref);
    if (!scenarioRecord || scenarioRecord.scenario_set.determinism_hash !== decision.payload.scenario_set_hash) {
      throw new Error("CAP05_APPROVAL_SCENARIO_CANONICAL_MISSING");
    }
    const option = resolveCap05ScenarioOptionMemberV1(scenarioRecord.scenario_set, decision.payload.selected_option_ref);
    if (option.option_hash !== decision.payload.selected_option_hash) throw new Error("CAP05_APPROVAL_SELECTED_OPTION_HASH_MISMATCH");
    const selected = scenarioRecord.scenario_set.payload.options.find((candidate) => candidate.option_id === decision.payload.selected_option_id);
    if (!selected) throw new Error("CAP05_APPROVAL_SELECTED_OPTION_MISSING");
    if (decimalSixV1(selected.requested_irrigation_mm, "CAP05_APPROVAL_SCENARIO_AMOUNT_INVALID") !== amounts.scenario_amount_mm) {
      throw new Error("CAP05_PLAN_SCENARIO_AMOUNT_NOT_FROM_SELECTED_OPTION");
    }
    await this.validateDispatchContextV1(input.scope, input.approved_plan, input.dispatch);

    const persisted = await this.evidenceRepository.commitApprovalPlanBinding({
      decision,
      approval_assertion: input.approval_assertion,
      approved_plan: input.approved_plan,
      dispatch_disposition: input.dispatch.disposition,
    });
    return {
      ...persisted,
      service_id: CAP05_APPROVAL_PLAN_BINDING_SERVICE_ID_V1,
      scenario_set_ref: decision.payload.scenario_set_ref,
      selected_option_ref: decision.payload.selected_option_ref,
      scenario_amount_mm: amounts.scenario_amount_mm,
      approved_amount_mm: amounts.approved_amount_mm,
      amount_difference_mm: amounts.amount_difference_mm,
      geox_approval_authority_exercised: false,
      geox_dispatch_created: false,
    };
  }
}
