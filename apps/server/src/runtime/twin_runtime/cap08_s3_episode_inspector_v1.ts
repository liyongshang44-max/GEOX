// Purpose: inspect the exact persisted MCFT-CAP-08.S3 Decision/Approval/Plan/Receipt/Action Feedback episode through rebuildable projections plus canonical fact readback.
// Boundary: read-only bounded inspection only; no fact append, projection repair, State/Forecast/Scenario mutation, route, scheduler, or production authority.

import type { Pool } from "pg";
import {
  CAP08_S3_APPROVED_AMOUNT_MM_V1,
  CAP08_S3_COVERAGE_FRACTION_V1,
  CAP08_S3_EXECUTED_AMOUNT_MM_V1,
  CAP08_S3_FORMAL_DATASET_ID_V1,
  CAP08_S3_SELECTED_OPTION_ID_V1,
  CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import type { Cap05ActionFeedbackEnvelopeV1, Cap05DecisionEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap05ApprovalAssertionEvidenceV1, Cap05ApprovedPlanEvidenceV1 } from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type Cap08S3EpisodeInspectionV1 = {
  schema_version: "geox_mcft_cap08_s3_episode_inspection_v1";
  disposition: "ABSENT" | "EXACT_COMPLETE";
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  decision_request_count: number;
  decision_count: number;
  approval_assertion_count: number;
  approved_plan_count: number;
  execution_receipt_count: number;
  action_feedback_count: number;
  decision: Cap05DecisionEnvelopeV1 | null;
  approval_assertion: Cap05ApprovalAssertionEvidenceV1 | null;
  approved_plan: Cap05ApprovedPlanEvidenceV1 | null;
  execution_receipt: Cap05ExecutionReceiptEvidenceV1 | null;
  action_feedback: Cap05ActionFeedbackEnvelopeV1 | null;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactScopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function parseEvidenceV1<T>(value: unknown, code: string): T {
  const payload = typeof value === "string" ? JSON.parse(value) : value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(code);
  return structuredClone(payload as T);
}

function exactScopeV1(value: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (value[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

export class Cap08S3EpisodeInspectorV1 {
  private readonly feedbackRepository: PostgresFeedbackPersistenceRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.feedbackRepository = new PostgresFeedbackPersistenceRepositoryV1(pool);
  }

  private async sourceEvidenceV1<T>(input: {
    source: string;
    type: string;
    formal_run_id: string;
    scope: TwinScopeKeyV1;
  }): Promise<T[]> {
    const rows = await this.pool.query(
      `SELECT record_json->'payload' AS payload
       FROM facts
       WHERE source=$1 AND record_json->>'type'=$2
         AND record_json->'payload'->>'formal_run_id'=$3
         AND record_json->'payload'->>'tenant_id'=$4
         AND record_json->'payload'->>'project_id'=$5
         AND record_json->'payload'->>'group_id'=$6
         AND record_json->'payload'->>'field_id'=$7
         AND record_json->'payload'->>'season_id'=$8
         AND record_json->'payload'->>'zone_id'=$9
       ORDER BY fact_id`,
      [input.source, input.type, input.formal_run_id, ...exactScopeValuesV1(input.scope)],
    );
    return rows.rows.map((row: Record<string, unknown>) => parseEvidenceV1<T>(row.payload, "CAP08_S3_EPISODE_EVIDENCE_INVALID"));
  }

  async inspect(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
  }): Promise<Cap08S3EpisodeInspectionV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S3_EPISODE_FORMAL_RUN_ID_REQUIRED");
    const decisionRequests = await this.sourceEvidenceV1<Record<string, unknown>>({
      source: "mcft_cap08_s3_replay_evidence_v1",
      type: "controlled_human_decision_request_v1",
      formal_run_id: formalRunId,
      scope: input.scope,
    });
    const approvalAssertions = await this.sourceEvidenceV1<Cap05ApprovalAssertionEvidenceV1>({
      source: "mcft_cap05_replay_evidence_v1",
      type: "approval_assertion_evidence_v1",
      formal_run_id: formalRunId,
      scope: input.scope,
    });
    const receipts = await this.sourceEvidenceV1<Cap05ExecutionReceiptEvidenceV1>({
      source: "mcft_cap08_s3_replay_evidence_v1",
      type: "irrigation_execution_receipt_evidence_v1",
      formal_run_id: formalRunId,
      scope: input.scope,
    });

    const decisionRows = await this.pool.query(
      `SELECT decision_object_id FROM twin_decision_record_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       ORDER BY logical_time,decision_object_id`,
      exactScopeValuesV1(input.scope),
    );
    const planRows = await this.pool.query(
      `SELECT canonical_evidence FROM twin_approved_plan_binding_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND active_for_decision=true
       ORDER BY plan_effective_from,approved_plan_evidence_ref`,
      exactScopeValuesV1(input.scope),
    );
    const feedbackRows = await this.pool.query(
      `SELECT action_feedback_object_id FROM twin_action_feedback_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       ORDER BY logical_time,as_of,action_feedback_object_id`,
      exactScopeValuesV1(input.scope),
    );

    const counts = {
      decision_request_count: decisionRequests.length,
      decision_count: decisionRows.rows.length,
      approval_assertion_count: approvalAssertions.length,
      approved_plan_count: planRows.rows.length,
      execution_receipt_count: receipts.length,
      action_feedback_count: feedbackRows.rows.length,
    };
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total === 0) {
      return {
        schema_version: "geox_mcft_cap08_s3_episode_inspection_v1",
        disposition: "ABSENT",
        formal_run_id: formalRunId,
        scope: structuredClone(input.scope),
        ...counts,
        decision: null,
        approval_assertion: null,
        approved_plan: null,
        execution_receipt: null,
        action_feedback: null,
      };
    }
    for (const [field, value] of Object.entries(counts)) {
      if (value !== 1) throw new Error(`CAP08_S3_EPISODE_CARDINALITY:${field}:${value}`);
    }

    const decisionObject = await this.feedbackRepository.readCanonicalObject(decisionRows.rows[0].decision_object_id);
    const feedbackObject = await this.feedbackRepository.readCanonicalObject(feedbackRows.rows[0].action_feedback_object_id);
    if (!decisionObject || decisionObject.object_type !== "twin_decision_record_v1") throw new Error("CAP08_S3_EPISODE_DECISION_CANONICAL_MISSING");
    if (!feedbackObject || feedbackObject.object_type !== "twin_action_feedback_v1") throw new Error("CAP08_S3_EPISODE_ACTION_FEEDBACK_CANONICAL_MISSING");
    const decision = decisionObject as Cap05DecisionEnvelopeV1;
    const approval = approvalAssertions[0];
    const plan = parseEvidenceV1<Cap05ApprovedPlanEvidenceV1>(planRows.rows[0].canonical_evidence, "CAP08_S3_EPISODE_PLAN_INVALID");
    const receipt = receipts[0];
    const feedback = feedbackObject as Cap05ActionFeedbackEnvelopeV1;

    for (const candidate of [decision, approval, plan, receipt, feedback] as TwinScopeKeyV1[]) {
      exactScopeV1(candidate, input.scope, "CAP08_S3_EPISODE_SCOPE_MISMATCH");
    }
    const request = decisionRequests[0];
    if (request.dataset_id !== CAP08_S3_FORMAL_DATASET_ID_V1 || request.formal_run_id !== formalRunId) {
      throw new Error("CAP08_S3_EPISODE_DECISION_SOURCE_IDENTITY_MISMATCH");
    }
    if (decision.payload.decision_request_evidence_ref !== request.source_record_id
      || decision.payload.decision_request_evidence_hash !== request.source_record_hash
      || decision.payload.selected_option_id !== CAP08_S3_SELECTED_OPTION_ID_V1) {
      throw new Error("CAP08_S3_EPISODE_DECISION_CHAIN_MISMATCH");
    }
    if (approval.canonical_payload.decision_request_ref !== decision.payload.decision_request_evidence_ref
      || approval.canonical_payload.decision_request_hash !== decision.payload.decision_request_evidence_hash
      || approval.canonical_payload.selected_option_ref !== decision.payload.selected_option_ref
      || approval.canonical_payload.selected_option_hash !== decision.payload.selected_option_hash) {
      throw new Error("CAP08_S3_EPISODE_APPROVAL_CHAIN_MISMATCH");
    }
    if (plan.canonical_payload.approval_assertion_ref !== approval.source_record_id
      || plan.canonical_payload.approval_assertion_hash !== approval.source_record_hash
      || String(plan.canonical_payload.approved_amount_mm) !== CAP08_S3_APPROVED_AMOUNT_MM_V1) {
      throw new Error("CAP08_S3_EPISODE_PLAN_CHAIN_MISMATCH");
    }
    if (receipt.canonical_payload.approved_plan_ref !== plan.source_record_id
      || receipt.canonical_payload.approved_plan_hash !== plan.source_record_hash
      || String(receipt.canonical_payload.actual_amount_mm) !== CAP08_S3_EXECUTED_AMOUNT_MM_V1
      || String(receipt.canonical_payload.spatial_coverage_fraction) !== CAP08_S3_COVERAGE_FRACTION_V1
      || String(receipt.canonical_payload.target_scope_equivalent_irrigation_mm) !== CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1) {
      throw new Error("CAP08_S3_EPISODE_RECEIPT_CHAIN_MISMATCH");
    }
    if (feedback.payload.receipt_ref !== receipt.source_record_id
      || feedback.payload.source_record_id !== receipt.source_record_id
      || feedback.payload.actual_amount_mm !== CAP08_S3_EXECUTED_AMOUNT_MM_V1
      || feedback.payload.spatial_coverage_fraction !== CAP08_S3_COVERAGE_FRACTION_V1
      || feedback.payload.target_scope_equivalent_irrigation_mm !== CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1) {
      throw new Error("CAP08_S3_EPISODE_ACTION_FEEDBACK_CHAIN_MISMATCH");
    }

    return {
      schema_version: "geox_mcft_cap08_s3_episode_inspection_v1",
      disposition: "EXACT_COMPLETE",
      formal_run_id: formalRunId,
      scope: structuredClone(input.scope),
      ...counts,
      decision,
      approval_assertion: approval,
      approved_plan: plan,
      execution_receipt: receipt,
      action_feedback: feedback,
    };
  }
}
