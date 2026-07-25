// apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts
// Purpose: resolve one exact irrigation execution Receipt Replay Evidence record, bind it to the active Approved Plan and canonical G Decision, commit canonical H Action Feedback, and produce the existing executed-irrigation adapter output when eligible.
// Boundary: internal Replay Runtime service only; no public route, approval, dispatch creation, State/checkpoint mutation, Forecast, Residual, clock, filesystem, environment or network authority.

import type { Pool } from "pg";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  adaptCap05ActionFeedbackToExecutedIrrigationV1,
  type Cap05ActionFeedbackAdapterResultV1,
} from "../../domain/twin_runtime/action_feedback_to_executed_irrigation_v1.js";
import {
  buildCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
  type Cap05DispatchDispositionV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  validateAndNormalizeCap05ExecutionReceiptEvidenceV1,
  type Cap05ExecutionReceiptEvidenceV1,
} from "../../evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import type { Cap05PersistenceStatusV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresImmutableDecisionActionCommitRepositoryV1 } from "../../persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.js";

export const CAP05_ACTION_FEEDBACK_NORMALIZATION_SERVICE_ID_V1 = "MCFT_CAP_05_ACTION_FEEDBACK_NORMALIZATION_SERVICE_V1" as const;

export type CommitCap05ActionFeedbackInputV1 = {
  scope: ContinuationScopeV1;
  receipt_evidence_ref: string;
  receipt_evidence_hash: string;
};

export type CommitCap05ActionFeedbackResultV1 = {
  service_id: typeof CAP05_ACTION_FEEDBACK_NORMALIZATION_SERVICE_ID_V1;
  persistence_status: Cap05PersistenceStatusV1;
  action_feedback: Cap05ActionFeedbackEnvelopeV1;
  adapter_result: Cap05ActionFeedbackAdapterResultV1 | null;
  receipt_evidence_ref: string;
  receipt_evidence_hash: string;
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  decision_ref: string;
  decision_hash: string;
  dispatch_disposition: Cap05DispatchDispositionV1;
  logical_time_shifted: false;
  coverage_applied_by_adapter: false;
  volume_conversion_performed: false;
};

type ApprovedPlanProjectionV1 = {
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
  binding_id: string;
  decision_request_ref: string;
  decision_request_hash: string;
  selected_option_ref: string;
  selected_option_hash: string;
  plan_effective_from: Date | string;
  plan_effective_to: Date | string;
  active_for_decision: boolean;
};

type ExternalDispatchEvidenceV1 = ContinuationScopeV1 & {
  source_record_id: string;
  source_record_hash: string;
  record_type: "external_dispatch_evidence_v1";
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  quality: { status: "PASS" | "LIMITED" | "FAIL" };
  canonical_payload: {
    approved_plan_ref: string;
    approved_plan_hash: string;
    dispatch_disposition: "EXTERNALLY_RECORDED";
    geox_dispatch_created: false;
  };
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalInstantV1(value: unknown, code: string): string {
  if (value instanceof Date) return value.toISOString();
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function assertScopeV1(expected: ContinuationScopeV1, actual: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (expected[field] !== actual[field]) throw new Error(`${code}:${field}`);
  }
}

export class Cap05ActionFeedbackNormalizationServiceV1 {
  private readonly repository: PostgresImmutableDecisionActionCommitRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.repository = new PostgresImmutableDecisionActionCommitRepositoryV1(pool);
  }

  private async readReceiptEvidenceV1(
    ref: string,
    hash: string,
  ): Promise<Cap05ExecutionReceiptEvidenceV1> {
    const result = await this.pool.query(
      `SELECT record_json FROM facts
       WHERE record_json->>'type'='irrigation_execution_receipt_evidence_v1'
         AND record_json->'payload'->>'source_record_id'=$1
       LIMIT 2`,
      [requiredStringV1(ref, "CAP05_RECEIPT_EVIDENCE_REF_REQUIRED")],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_RECEIPT_EVIDENCE_CARDINALITY");
    const receipt = result.rows[0].record_json?.payload as Cap05ExecutionReceiptEvidenceV1 | undefined;
    if (!receipt || receipt.source_record_id !== ref || receipt.source_record_hash !== requiredStringV1(hash, "CAP05_RECEIPT_EVIDENCE_HASH_REQUIRED")) {
      throw new Error("CAP05_RECEIPT_EVIDENCE_IDENTITY_MISMATCH");
    }
    return receipt;
  }

  private async readActivePlanV1(
    scope: ContinuationScopeV1,
    planRef: string,
    planHash: string,
  ): Promise<ApprovedPlanProjectionV1> {
    const result = await this.pool.query(
      `SELECT approved_plan_evidence_ref,approved_plan_evidence_hash,tenant_id,project_id,group_id,field_id,season_id,zone_id,
              binding_id,decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash,
              plan_effective_from,plan_effective_to,active_for_decision
       FROM twin_approved_plan_binding_projection_v1
       WHERE approved_plan_evidence_ref=$1 AND approved_plan_evidence_hash=$2
       LIMIT 2`,
      [planRef, planHash],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_ACTION_FEEDBACK_PLAN_BINDING_CARDINALITY");
    const plan = result.rows[0] as ApprovedPlanProjectionV1;
    assertScopeV1(scope, plan, "CAP05_ACTION_FEEDBACK_PLAN_SCOPE_MISMATCH");
    if (plan.active_for_decision !== true) throw new Error("CAP05_ACTION_FEEDBACK_ACTIVE_PLAN_REQUIRED");
    return plan;
  }

  private async resolveDecisionV1(
    scope: ContinuationScopeV1,
    plan: ApprovedPlanProjectionV1,
  ): Promise<Cap05DecisionEnvelopeV1> {
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
        plan.decision_request_ref,
        plan.decision_request_hash,
        plan.selected_option_ref,
        plan.selected_option_hash,
      ],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_ACTION_FEEDBACK_DECISION_BINDING_CARDINALITY");
    const object = await this.repository.readCanonicalObject(result.rows[0].decision_object_id);
    if (!object || object.object_type !== "twin_decision_record_v1") throw new Error("CAP05_ACTION_FEEDBACK_CANONICAL_DECISION_MISSING");
    return object;
  }

  private async resolveDispatchDispositionV1(
    scope: ContinuationScopeV1,
    plan: ApprovedPlanProjectionV1,
    dispatchRef: string | null,
    dispatchHash: string | null,
  ): Promise<Cap05DispatchDispositionV1> {
    if (!dispatchRef && !dispatchHash) return "NOT_OBSERVED";
    if (!dispatchRef || !dispatchHash) throw new Error("CAP05_ACTION_FEEDBACK_DISPATCH_IDENTITY_PAIR_REQUIRED");
    const result = await this.pool.query(
      `SELECT record_json FROM facts
       WHERE record_json->>'type'='external_dispatch_evidence_v1'
         AND record_json->'payload'->>'source_record_id'=$1
       LIMIT 2`,
      [dispatchRef],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_ACTION_FEEDBACK_DISPATCH_CARDINALITY");
    const evidence = result.rows[0].record_json?.payload as ExternalDispatchEvidenceV1 | undefined;
    if (!evidence || evidence.source_record_id !== dispatchRef || evidence.source_record_hash !== dispatchHash) {
      throw new Error("CAP05_ACTION_FEEDBACK_DISPATCH_IDENTITY_MISMATCH");
    }
    assertScopeV1(scope, evidence, "CAP05_ACTION_FEEDBACK_DISPATCH_SCOPE_MISMATCH");
    if (evidence.origin_source_kind !== "CONTROLLED_REPLAY_DATASET" || evidence.quality?.status !== "PASS") {
      throw new Error("CAP05_ACTION_FEEDBACK_DISPATCH_INELIGIBLE");
    }
    if (evidence.canonical_payload.approved_plan_ref !== plan.approved_plan_evidence_ref
      || evidence.canonical_payload.approved_plan_hash !== plan.approved_plan_evidence_hash
      || evidence.canonical_payload.dispatch_disposition !== "EXTERNALLY_RECORDED"
      || evidence.canonical_payload.geox_dispatch_created !== false) {
      throw new Error("CAP05_ACTION_FEEDBACK_DISPATCH_PLAN_BINDING_MISMATCH");
    }
    return "EXTERNALLY_RECORDED";
  }

  async commitActionFeedback(
    input: CommitCap05ActionFeedbackInputV1,
  ): Promise<CommitCap05ActionFeedbackResultV1> {
    const receipt = await this.readReceiptEvidenceV1(input.receipt_evidence_ref, input.receipt_evidence_hash);
    const normalized = validateAndNormalizeCap05ExecutionReceiptEvidenceV1(receipt, input.scope);
    const plan = await this.readActivePlanV1(
      input.scope,
      receipt.canonical_payload.approved_plan_ref,
      receipt.canonical_payload.approved_plan_hash,
    );
    const planFrom = canonicalInstantV1(plan.plan_effective_from, "CAP05_ACTION_FEEDBACK_PLAN_EFFECTIVE_FROM_INVALID");
    const planTo = canonicalInstantV1(plan.plan_effective_to, "CAP05_ACTION_FEEDBACK_PLAN_EFFECTIVE_TO_INVALID");
    if (normalized.execution_start < planFrom || normalized.execution_end > planTo) {
      throw new Error("CAP05_ACTION_FEEDBACK_EXECUTION_OUTSIDE_PLAN_WINDOW");
    }
    const decision = await this.resolveDecisionV1(input.scope, plan);
    const dispatchDisposition = await this.resolveDispatchDispositionV1(
      input.scope,
      plan,
      normalized.dispatch_ref,
      normalized.dispatch_hash,
    );

    const object = buildCap05ActionFeedbackV1({
      scope: input.scope,
      decision_ref: decision.object_id,
      decision_hash: decision.determinism_hash,
      approved_plan_evidence_ref: plan.approved_plan_evidence_ref,
      approved_plan_evidence_hash: plan.approved_plan_evidence_hash,
      origin_kind: "EXTERNAL_EVIDENCE",
      task_ref: null,
      receipt_ref: receipt.source_record_id,
      as_executed_ref: null,
      acceptance_ref: null,
      dispatch_disposition: dispatchDisposition,
      event_id: receipt.canonical_payload.event_id,
      source_record_id: receipt.source_record_id,
      binding_id: receipt.binding_id,
      origin_source_id: receipt.origin_source_id,
      execution_status: normalized.execution_status,
      validation_status: normalized.validation_status,
      source_quality: normalized.source_quality,
      eligible_for_state_input: normalized.eligible_for_state_input,
      actual_amount_mm: normalized.actual_amount_mm,
      spatial_coverage_fraction: normalized.spatial_coverage_fraction,
      execution_start: normalized.execution_start,
      execution_end: normalized.execution_end,
      ingested_at: normalized.ingested_at,
      available_to_runtime_at: normalized.available_to_runtime_at,
      runtime_config_ref: decision.runtime_config_ref,
      runtime_config_hash: decision.runtime_config_hash,
      context_lineage_ref: decision.context_lineage_ref,
      context_revision_ref: decision.context_revision_ref,
      created_at: normalized.available_to_runtime_at,
    });
    const persisted = await this.repository.commitCanonicalObject({ object });
    const feedback = persisted.object as Cap05ActionFeedbackEnvelopeV1;
    const adapterResult = feedback.payload.eligible_for_state_input
      ? adaptCap05ActionFeedbackToExecutedIrrigationV1(feedback)
      : null;
    return {
      service_id: CAP05_ACTION_FEEDBACK_NORMALIZATION_SERVICE_ID_V1,
      persistence_status: persisted.status,
      action_feedback: feedback,
      adapter_result: adapterResult,
      receipt_evidence_ref: receipt.source_record_id,
      receipt_evidence_hash: receipt.source_record_hash,
      approved_plan_evidence_ref: plan.approved_plan_evidence_ref,
      approved_plan_evidence_hash: plan.approved_plan_evidence_hash,
      decision_ref: decision.object_id,
      decision_hash: decision.determinism_hash,
      dispatch_disposition: dispatchDisposition,
      logical_time_shifted: false,
      coverage_applied_by_adapter: false,
      volume_conversion_performed: false,
    };
  }
}
