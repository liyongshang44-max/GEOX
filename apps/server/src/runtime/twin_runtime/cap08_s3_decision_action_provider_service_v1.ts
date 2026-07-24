// Purpose: materialize the frozen MCFT-CAP-08.S3 Replay Decision/Approval/Plan/Receipt Evidence and reuse the canonical CAP-05 G/H services for one exact formal episode.
// Boundary: bounded internal Replay provider only; no public route, Recommendation, GEOX approval authority, dispatch creation, AO-ACT, State/checkpoint write, Residual, Calibration, scheduler, wall clock, filesystem, environment, or production Runtime authority.

import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  CAP08_S3_APPROVED_AMOUNT_MM_V1,
  CAP08_S3_COVERAGE_FRACTION_V1,
  CAP08_S3_EXECUTED_AMOUNT_MM_V1,
  CAP08_S3_FORMAL_DATASET_ID_V1,
  CAP08_S3_SELECTED_OPTION_ID_V1,
  CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap05ScenarioOptionMemberRefV1,
  resolveCap05ScenarioOptionMemberV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap04ScenarioSetRecordV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  computeCap05ReplayEvidenceSourceRecordHashV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { Cap05ActionFeedbackNormalizationServiceV1 } from "./action_feedback_normalization_service_v1.js";
import { Cap05ApprovalPlanBindingServiceV1 } from "./approval_plan_binding_service_v1.js";
import { Cap05HumanDecisionServiceV1 } from "./human_decision_service_v1.js";

export const CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1 =
  "MCFT_CAP_08_S3_FORMAL_DECISION_ACTION_PROVIDER_V1" as const;
export const CAP08_S3_DECISION_REQUEST_BINDING_ID_V1 = "decision_source_c8_replay_v1" as const;
export const CAP08_S3_APPROVAL_ASSERTION_BINDING_ID_V1 = "approval_assertion_c8_replay_v1" as const;
export const CAP08_S3_APPROVED_PLAN_BINDING_ID_V1 = "approved_plan_snapshot_c8_replay_v1" as const;
export const CAP08_S3_EXECUTION_RECEIPT_BINDING_ID_V1 = "execution_receipt_c8_replay_v1" as const;
export const CAP08_S3_REPLAY_ORIGIN_SOURCE_ID_V1 = "mcft_cap08_stage1a_replay_action_source_v1" as const;

export type Cap08S3DecisionCommitResultV1 = {
  service_id: typeof CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1;
  decision_request_ref: string;
  decision_request_hash: string;
  decision: Cap05DecisionEnvelopeV1;
  persistence_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | "EXISTING_RECOVERED";
};

export type Cap08S3ApprovalPlanCommitResultV1 = {
  service_id: typeof CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1;
  approved_plan: Cap05ApprovedPlanEvidenceV1;
  decision_ref: string;
  decision_hash: string;
  approval_assertion_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  approved_plan_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
};

export type Cap08S3ReceiptMaterializationResultV1 = {
  service_id: typeof CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1;
  receipt: Cap05ExecutionReceiptEvidenceV1;
  persistence_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
};

export type Cap08S3ActionFeedbackCommitResultV1 = {
  service_id: typeof CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1;
  receipt_ref: string;
  receipt_hash: string;
  action_feedback: Cap05ActionFeedbackEnvelopeV1;
  persistence_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS" | "EXISTING_RECOVERED";
};

type DecisionRequestEvidenceV1 = ContinuationScopeV1 & {
  formal_run_id: string;
  dataset_id: typeof CAP08_S3_FORMAL_DATASET_ID_V1;
  source_record_id: string;
  source_record_hash: string;
  record_type: "controlled_human_decision_request_v1";
  binding_id: typeof CAP08_S3_DECISION_REQUEST_BINDING_ID_V1;
  origin_source_kind: "CONTROLLED_REPLAY_DATASET";
  origin_source_id: typeof CAP08_S3_REPLAY_ORIGIN_SOURCE_ID_V1;
  source_version: "1";
  ingress_adapter_id: "canonical_replay_evidence_ingress_v1";
  ingress_adapter_version: 1;
  epistemic_class: "ASSERTED";
  action_lifecycle_class: "DECISION_REQUEST";
  available_to_runtime_at: string;
  role_time: {
    requested_at: string;
    ingested_at: string;
    available_to_runtime_at: string;
  };
  evidence_identity_key: string;
  idempotency_key: string;
  quality: { status: "PASS" };
  limitations: string[];
  source_payload: {
    actor_class: "HUMAN";
    actor_ref: string;
    decision_cycle_key: string;
    scenario_set_ref: string;
    scenario_set_hash: string;
    selected_option_ref: string;
    selected_option_hash: string;
    selected_option_id: typeof CAP08_S3_SELECTED_OPTION_ID_V1;
    requested_disposition: "SELECT_OPTION";
  };
  canonical_payload: DecisionRequestEvidenceV1["source_payload"];
};

type EvidenceBaseInputV1<Payload extends Record<string, unknown>> = {
  formal_run_id: string;
  scope: ContinuationScopeV1;
  record_type: string;
  binding_id: string;
  epistemic_class: "ASSERTED" | "OBSERVED";
  action_lifecycle_class: string;
  role_time: Record<string, string>;
  available_to_runtime_at: string;
  payload: Payload;
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

function exactScopeValuesV1(scope: ContinuationScopeV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function buildEvidenceRecordV1<Payload extends Record<string, unknown>>(
  input: EvidenceBaseInputV1<Payload>,
): Record<string, unknown> {
  const identityBasis = {
    formal_run_id: input.formal_run_id,
    dataset_id: CAP08_S3_FORMAL_DATASET_ID_V1,
    record_type: input.record_type,
    binding_id: input.binding_id,
    scope: input.scope,
    role_time: input.role_time,
    canonical_payload: input.payload,
  };
  const identityDigest = semanticHashV1(identityBasis).slice(7, 39);
  const sourceRecordId = `mcft08_s3_src_${identityDigest}`;
  const evidenceIdentityKey = `${CAP08_S3_FORMAL_DATASET_ID_V1}:${input.formal_run_id}:${input.record_type}:${sourceRecordId}`;
  const record: Record<string, unknown> = {
    ...input.scope,
    formal_run_id: input.formal_run_id,
    dataset_id: CAP08_S3_FORMAL_DATASET_ID_V1,
    source_record_id: sourceRecordId,
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_DATASET",
    origin_source_id: CAP08_S3_REPLAY_ORIGIN_SOURCE_ID_V1,
    source_version: "1",
    ingress_adapter_id: "canonical_replay_evidence_ingress_v1",
    ingress_adapter_version: 1,
    epistemic_class: input.epistemic_class,
    action_lifecycle_class: input.action_lifecycle_class,
    role_time: structuredClone(input.role_time),
    available_to_runtime_at: input.available_to_runtime_at,
    evidence_identity_key: evidenceIdentityKey,
    idempotency_key: semanticHashV1(evidenceIdentityKey),
    quality: { status: "PASS" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "S3_SLICE_ACCEPTANCE_ONLY"],
    source_payload: structuredClone(input.payload),
    canonical_payload: structuredClone(input.payload),
  };
  record.source_record_hash = computeCap05ReplayEvidenceSourceRecordHashV1(record);
  return record;
}

function standaloneFactIdV1(record: Record<string, unknown>): string {
  const identity = requiredStringV1(record.evidence_identity_key, "CAP08_S3_EVIDENCE_IDENTITY_REQUIRED");
  return `fact_mcft08_s3_evidence_${crypto.createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 32)}`;
}

export class Cap08S3DecisionActionProviderServiceV1 {
  private readonly decisionService: Cap05HumanDecisionServiceV1;
  private readonly approvalPlanService: Cap05ApprovalPlanBindingServiceV1;
  private readonly actionFeedbackService: Cap05ActionFeedbackNormalizationServiceV1;
  private readonly feedbackRepository: PostgresFeedbackPersistenceRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.decisionService = new Cap05HumanDecisionServiceV1(pool);
    this.approvalPlanService = new Cap05ApprovalPlanBindingServiceV1(pool);
    this.actionFeedbackService = new Cap05ActionFeedbackNormalizationServiceV1(pool);
    this.feedbackRepository = new PostgresFeedbackPersistenceRepositoryV1(pool);
  }

  private async appendStandaloneEvidenceV1(
    record: Record<string, unknown>,
  ): Promise<"INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"> {
    const factId = standaloneFactIdV1(record);
    const sourceRecordId = requiredStringV1(record.source_record_id, "CAP08_S3_SOURCE_RECORD_ID_REQUIRED");
    const sourceRecordHash = requiredStringV1(record.source_record_hash, "CAP08_S3_SOURCE_RECORD_HASH_REQUIRED");
    const occurredAt = canonicalInstantV1(record.available_to_runtime_at, "CAP08_S3_EVIDENCE_AVAILABLE_AT_INVALID");
    const recordJson = JSON.stringify({ type: record.record_type, payload: record });
    const inserted = await this.pool.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'mcft_cap08_s3_replay_evidence_v1',$3::jsonb)
       ON CONFLICT (fact_id) DO NOTHING
       RETURNING fact_id`,
      [factId, occurredAt, recordJson],
    );
    if (inserted.rows.length === 1) return "INSERTED";
    if (inserted.rows.length !== 0) throw new Error("CAP08_S3_EVIDENCE_INSERT_CARDINALITY");
    const existing = await this.pool.query(
      "SELECT source,record_json FROM facts WHERE fact_id=$1",
      [factId],
    );
    if (existing.rows.length !== 1) throw new Error("CAP08_S3_EVIDENCE_FACT_CARDINALITY");
    const payload = existing.rows[0].record_json?.payload as Record<string, unknown> | undefined;
    if (existing.rows[0].source !== "mcft_cap08_s3_replay_evidence_v1"
      || !payload
      || payload.source_record_id !== sourceRecordId
      || payload.source_record_hash !== sourceRecordHash) {
      throw new Error("CAP08_S3_EVIDENCE_IDEMPOTENCY_CONFLICT");
    }
    return "EXISTING_IDEMPOTENT_SUCCESS";
  }

  private async readUniqueDecisionV1(scope: ContinuationScopeV1): Promise<Cap05DecisionEnvelopeV1> {
    const rows = await this.pool.query(
      `SELECT decision_object_id FROM twin_decision_record_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       ORDER BY logical_time,decision_object_id LIMIT 2`,
      exactScopeValuesV1(scope),
    );
    if (rows.rows.length !== 1) throw new Error("CAP08_S3_DECISION_CARDINALITY");
    const object = await this.feedbackRepository.readCanonicalObject(rows.rows[0].decision_object_id);
    if (!object || object.object_type !== "twin_decision_record_v1") throw new Error("CAP08_S3_DECISION_CANONICAL_MISSING");
    return object;
  }

  private async readActivePlanV1(scope: ContinuationScopeV1): Promise<Cap05ApprovedPlanEvidenceV1> {
    const rows = await this.pool.query(
      `SELECT canonical_evidence FROM twin_approved_plan_binding_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND active_for_decision=true
       ORDER BY plan_effective_from,approved_plan_evidence_ref LIMIT 2`,
      exactScopeValuesV1(scope),
    );
    if (rows.rows.length !== 1) throw new Error("CAP08_S3_APPROVED_PLAN_CARDINALITY");
    return structuredClone(rows.rows[0].canonical_evidence as Cap05ApprovedPlanEvidenceV1);
  }

  async commitDecisionAfterScenario(input: {
    formal_run_id: string;
    scope: ContinuationScopeV1;
    scenario_record: Cap04ScenarioSetRecordV1;
    decided_at: string;
  }): Promise<Cap08S3DecisionCommitResultV1> {
    const decidedAt = canonicalInstantV1(input.decided_at, "CAP08_S3_DECIDED_AT_INVALID");
    const scenario = input.scenario_record.scenario_set;
    const optionRef = buildCap05ScenarioOptionMemberRefV1(scenario.object_id, CAP08_S3_SELECTED_OPTION_ID_V1);
    const option = resolveCap05ScenarioOptionMemberV1(scenario, optionRef);
    const payload = {
      actor_class: "HUMAN" as const,
      actor_ref: "human_operator_mcft_cap08_s3_v1",
      decision_cycle_key: `${input.formal_run_id}:T05`,
      scenario_set_ref: scenario.object_id,
      scenario_set_hash: scenario.determinism_hash,
      selected_option_ref: optionRef,
      selected_option_hash: option.option_hash,
      selected_option_id: CAP08_S3_SELECTED_OPTION_ID_V1,
      requested_disposition: "SELECT_OPTION" as const,
    };
    const request = buildEvidenceRecordV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      record_type: "controlled_human_decision_request_v1",
      binding_id: CAP08_S3_DECISION_REQUEST_BINDING_ID_V1,
      epistemic_class: "ASSERTED",
      action_lifecycle_class: "DECISION_REQUEST",
      role_time: { requested_at: decidedAt, ingested_at: decidedAt, available_to_runtime_at: decidedAt },
      available_to_runtime_at: decidedAt,
      payload,
    }) as unknown as DecisionRequestEvidenceV1;
    await this.appendStandaloneEvidenceV1(request as unknown as Record<string, unknown>);
    const committed = await this.decisionService.commitHumanDecision({
      scope: input.scope,
      decision_request_evidence_ref: request.source_record_id,
      decision_request_evidence_hash: request.source_record_hash,
      decided_at: decidedAt,
    });
    if (committed.object.object_type !== "twin_decision_record_v1") throw new Error("CAP08_S3_DECISION_TYPE_MISMATCH");
    return {
      service_id: CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1,
      decision_request_ref: request.source_record_id,
      decision_request_hash: request.source_record_hash,
      decision: committed.object as Cap05DecisionEnvelopeV1,
      persistence_status: committed.status,
    };
  }

  async commitApprovalPlanAtEvidencePhase(input: {
    formal_run_id: string;
    scope: ContinuationScopeV1;
    available_to_runtime_at: string;
  }): Promise<Cap08S3ApprovalPlanCommitResultV1> {
    const availableAt = canonicalInstantV1(input.available_to_runtime_at, "CAP08_S3_APPROVAL_AVAILABLE_AT_INVALID");
    const decision = await this.readUniqueDecisionV1(input.scope);
    const assertionPayload = {
      approval_semantics: "EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION" as const,
      approval_status: "APPROVED" as const,
      approver_class: "HUMAN" as const,
      approver_ref: "human_approver_mcft_cap08_s3_v1",
      decision_request_ref: decision.payload.decision_request_evidence_ref,
      decision_request_hash: decision.payload.decision_request_evidence_hash,
      selected_option_ref: decision.payload.selected_option_ref,
      selected_option_hash: decision.payload.selected_option_hash,
      geox_approval_request_created: false as const,
      geox_approval_authority_exercised: false as const,
    };
    const assertion = buildEvidenceRecordV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      record_type: "approval_assertion_evidence_v1",
      binding_id: CAP08_S3_APPROVAL_ASSERTION_BINDING_ID_V1,
      epistemic_class: "ASSERTED",
      action_lifecycle_class: "APPROVAL_ASSERTION",
      role_time: { asserted_at: availableAt, approved_at: availableAt, ingested_at: availableAt, available_to_runtime_at: availableAt },
      available_to_runtime_at: availableAt,
      payload: assertionPayload,
    }) as unknown as Cap05ApprovalAssertionEvidenceV1;
    const planPayload = {
      plan_status: "APPROVED" as const,
      active_for_decision: true,
      approval_assertion_ref: assertion.source_record_id,
      approval_assertion_hash: assertion.source_record_hash,
      decision_request_ref: decision.payload.decision_request_evidence_ref,
      decision_request_hash: decision.payload.decision_request_evidence_hash,
      selected_option_ref: decision.payload.selected_option_ref,
      selected_option_hash: decision.payload.selected_option_hash,
      scenario_amount_mm: CAP08_S3_APPROVED_AMOUNT_MM_V1,
      approved_amount_mm: CAP08_S3_APPROVED_AMOUNT_MM_V1,
      amount_difference_mm: "0.000000",
      amount_difference_reason_codes: [] as string[],
      target_scope: structuredClone(input.scope),
    };
    const plan = buildEvidenceRecordV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      record_type: "approved_irrigation_plan_snapshot_v1",
      binding_id: CAP08_S3_APPROVED_PLAN_BINDING_ID_V1,
      epistemic_class: "ASSERTED",
      action_lifecycle_class: "APPROVED_PLAN",
      role_time: {
        created_at: availableAt,
        approved_at: availableAt,
        ingested_at: availableAt,
        available_to_runtime_at: availableAt,
        plan_effective_from: "2026-06-01T07:00:00.000Z",
        plan_effective_to: "2026-06-01T09:00:00.000Z",
      },
      available_to_runtime_at: availableAt,
      payload: planPayload,
    }) as unknown as Cap05ApprovedPlanEvidenceV1;
    const committed = await this.approvalPlanService.commitApprovalPlanBinding({
      scope: input.scope,
      approval_assertion: assertion,
      approved_plan: plan,
      dispatch: { disposition: "NOT_OBSERVED", evidence_ref: null, evidence_hash: null },
    });
    return {
      service_id: CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1,
      approval_assertion: assertion,
      approved_plan: plan,
      decision_ref: committed.decision_object_id,
      decision_hash: committed.decision_hash,
      approval_assertion_status: committed.approval_assertion_status,
      approved_plan_status: committed.approved_plan_status,
    };
  }

  async materializeReceiptAtEvidencePhase(input: {
    formal_run_id: string;
    scope: ContinuationScopeV1;
    available_to_runtime_at: string;
  }): Promise<Cap08S3ReceiptMaterializationResultV1> {
    const availableAt = canonicalInstantV1(input.available_to_runtime_at, "CAP08_S3_RECEIPT_AVAILABLE_AT_INVALID");
    const plan = await this.readActivePlanV1(input.scope);
    const payload = {
      approved_plan_ref: plan.source_record_id,
      approved_plan_hash: plan.source_record_hash,
      external_dispatch_ref: null,
      external_dispatch_hash: null,
      event_id: `${input.formal_run_id}:irrigation:T07`,
      execution_status: "PARTIAL" as const,
      validation_status: "PASSED" as const,
      source_quality: "PASS" as const,
      eligible_for_state_input: true,
      actual_amount_mm: CAP08_S3_EXECUTED_AMOUNT_MM_V1,
      spatial_coverage_fraction: CAP08_S3_COVERAGE_FRACTION_V1,
      target_scope_equivalent_irrigation_mm: CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
      target_scope: structuredClone(input.scope),
      unit: "mm" as const,
    };
    const receipt = buildEvidenceRecordV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      record_type: "irrigation_execution_receipt_evidence_v1",
      binding_id: CAP08_S3_EXECUTION_RECEIPT_BINDING_ID_V1,
      epistemic_class: "OBSERVED",
      action_lifecycle_class: "EXECUTION_RECEIPT",
      role_time: {
        execution_start: "2026-06-01T07:10:00.000Z",
        execution_end: "2026-06-01T07:50:00.000Z",
        ingested_at: availableAt,
        available_to_runtime_at: availableAt,
      },
      available_to_runtime_at: availableAt,
      payload,
    }) as unknown as Cap05ExecutionReceiptEvidenceV1;
    const status = await this.appendStandaloneEvidenceV1(receipt as unknown as Record<string, unknown>);
    return {
      service_id: CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1,
      receipt,
      persistence_status: status,
    };
  }

  async commitActionFeedbackAtH(input: {
    scope: ContinuationScopeV1;
    receipt_ref: string;
    receipt_hash: string;
  }): Promise<Cap08S3ActionFeedbackCommitResultV1> {
    const committed = await this.actionFeedbackService.commitActionFeedback({
      scope: input.scope,
      receipt_evidence_ref: input.receipt_ref,
      receipt_evidence_hash: input.receipt_hash,
    });
    return {
      service_id: CAP08_S3_FORMAL_PROVIDER_SERVICE_ID_V1,
      receipt_ref: committed.receipt_evidence_ref,
      receipt_hash: committed.receipt_evidence_hash,
      action_feedback: committed.action_feedback,
      persistence_status: committed.persistence_status,
    };
  }

  async readActionFeedbackExact(input: {
    scope: ContinuationScopeV1;
  }): Promise<Cap05ActionFeedbackEnvelopeV1> {
    const rows = await this.pool.query(
      `SELECT action_feedback_object_id FROM twin_action_feedback_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       ORDER BY logical_time,as_of,action_feedback_object_id LIMIT 2`,
      exactScopeValuesV1(input.scope),
    );
    if (rows.rows.length !== 1) throw new Error("CAP08_S3_ACTION_FEEDBACK_CARDINALITY");
    const object = await this.feedbackRepository.readCanonicalObject(rows.rows[0].action_feedback_object_id);
    if (!object || object.object_type !== "twin_action_feedback_v1") throw new Error("CAP08_S3_ACTION_FEEDBACK_CANONICAL_MISSING");
    return object as Cap05ActionFeedbackEnvelopeV1;
  }
}
