// Purpose: bind one S3 Receipt/H chain to the exact formal run, scope, active Decision/Plan lineage and revision, and frozen replay amounts before H commit or T09/T10 readback.
// Boundary: read-only fail-closed guard only; no fact append, projection mutation, pointer repair, State/Forecast/Scenario write, route, scheduler, clock, filesystem, environment, or production authority.

import type { Pool } from "pg";
import {
  CAP08_S3_COVERAGE_FRACTION_V1,
  CAP08_S3_EXECUTED_AMOUNT_MM_V1,
  CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
} from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import {
  validateCap05ActionFeedbackV1,
  type Cap05ActionFeedbackEnvelopeV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap05ExecutionReceiptEvidenceV1 } from "../../evidence/twin_runtime/execution_receipt_evidence_contract_v1.js";
import { PostgresImmutableDecisionActionCommitRepositoryV1 } from "../../persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type Cap08S3ReceiptEpisodeGuardResultV1 = {
  schema_version: "geox_mcft_cap08_s3_receipt_episode_guard_result_v1";
  formal_run_id: string;
  receipt_ref: string;
  receipt_hash: string;
  decision_ref: string;
  decision_hash: string;
  approved_plan_ref: string;
  approved_plan_hash: string;
  active_lineage_ref: string;
  revision_id: string;
  actual_amount_mm: typeof CAP08_S3_EXECUTED_AMOUNT_MM_V1;
  spatial_coverage_fraction: typeof CAP08_S3_COVERAGE_FRACTION_V1;
  target_scope_equivalent_irrigation_mm: typeof CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1;
  status: "PASS";
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function scopeValuesV1(scope: TwinScopeKeyV1): string[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

function assertScopeV1(expected: TwinScopeKeyV1, actual: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (expected[field] !== actual[field]) throw new Error(`${code}:${field}`);
  }
}

export class Cap08S3ReceiptEpisodeGuardV1 {
  private readonly canonical: PostgresImmutableDecisionActionCommitRepositoryV1;

  constructor(private readonly pool: Pool) {
    this.canonical = new PostgresImmutableDecisionActionCommitRepositoryV1(pool);
  }

  private async readReceiptV1(ref: string, hash: string): Promise<Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string }> {
    const result = await this.pool.query(
      `SELECT record_json->'payload' AS payload
       FROM facts
       WHERE record_json->>'type'='irrigation_execution_receipt_evidence_v1'
         AND record_json->'payload'->>'source_record_id'=$1
       LIMIT 2`,
      [ref],
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_CARDINALITY");
    const receipt = result.rows[0].payload as Cap05ExecutionReceiptEvidenceV1 & { formal_run_id?: string };
    if (!receipt || receipt.source_record_id !== ref || receipt.source_record_hash !== hash) {
      throw new Error("CAP08_S3_RECEIPT_GUARD_IDENTITY_MISMATCH");
    }
    return structuredClone(receipt);
  }

  private async receiptHashByRefV1(ref: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT record_json->'payload'->>'source_record_hash' AS source_record_hash
       FROM facts
       WHERE record_json->>'type'='irrigation_execution_receipt_evidence_v1'
         AND record_json->'payload'->>'source_record_id'=$1
       LIMIT 2`,
      [ref],
    );
    if (result.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_CARDINALITY");
    return requiredStringV1(result.rows[0].source_record_hash, "CAP08_S3_RECEIPT_GUARD_RECEIPT_HASH_REQUIRED");
  }

  private async activeContextV1(scope: TwinScopeKeyV1, expectedActiveLineageRef: string): Promise<{
    active_lineage_ref: string;
    lineage_id: string;
    revision_id: string;
  }> {
    const values = scopeValuesV1(scope);
    const [active, state] = await Promise.all([
      this.pool.query(
        `SELECT active_lineage_ref FROM twin_active_lineage_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        values,
      ),
      this.pool.query(
        `SELECT lineage_id,revision_id FROM twin_state_latest_index_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        values,
      ),
    ]);
    if (active.rows.length !== 1 || state.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_ACTIVE_CONTEXT_CARDINALITY");
    const activeLineageRef = requiredStringV1(active.rows[0].active_lineage_ref, "CAP08_S3_RECEIPT_GUARD_ACTIVE_LINEAGE_REQUIRED");
    if (activeLineageRef !== expectedActiveLineageRef) throw new Error("CAP08_S3_RECEIPT_GUARD_LINEAGE_MISMATCH");
    const lineage = await this.pool.query(
      `SELECT record_json->'payload'->>'lineage_id' AS lineage_id
       FROM facts
       WHERE record_json->>'type'='twin_runtime_lineage_v1'
         AND record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [activeLineageRef],
    );
    if (lineage.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_ACTIVE_LINEAGE_CANONICAL_CARDINALITY");
    const activeLineageId = requiredStringV1(lineage.rows[0].lineage_id, "CAP08_S3_RECEIPT_GUARD_ACTIVE_LINEAGE_ID_REQUIRED");
    const stateLineageId = requiredStringV1(state.rows[0].lineage_id, "CAP08_S3_RECEIPT_GUARD_LINEAGE_REQUIRED");
    if (stateLineageId !== activeLineageId) throw new Error("CAP08_S3_RECEIPT_GUARD_CURRENT_POINTER_CROSS_LINEAGE");
    return {
      active_lineage_ref: activeLineageRef,
      lineage_id: activeLineageId,
      revision_id: requiredStringV1(state.rows[0].revision_id, "CAP08_S3_RECEIPT_GUARD_REVISION_REQUIRED"),
    };
  }

  async validateReceipt(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    receipt_ref: string;
    receipt_hash: string;
  }): Promise<Cap08S3ReceiptEpisodeGuardResultV1> {
    const formalRunId = requiredStringV1(input.formal_run_id, "CAP08_S3_RECEIPT_GUARD_FORMAL_RUN_REQUIRED");
    const receiptRef = requiredStringV1(input.receipt_ref, "CAP08_S3_RECEIPT_GUARD_RECEIPT_REF_REQUIRED");
    const receiptHash = requiredStringV1(input.receipt_hash, "CAP08_S3_RECEIPT_GUARD_RECEIPT_HASH_REQUIRED");
    const receipt = await this.readReceiptV1(receiptRef, receiptHash);
    assertScopeV1(input.scope, receipt, "CAP08_S3_RECEIPT_GUARD_SCOPE_MISMATCH");
    assertScopeV1(input.scope, receipt.canonical_payload.target_scope, "CAP08_S3_RECEIPT_GUARD_TARGET_SCOPE_MISMATCH");
    if (receipt.formal_run_id !== formalRunId) throw new Error("CAP08_S3_RECEIPT_GUARD_FORMAL_RUN_MISMATCH");
    if (String(receipt.canonical_payload.actual_amount_mm) !== CAP08_S3_EXECUTED_AMOUNT_MM_V1) {
      throw new Error("CAP08_S3_RECEIPT_GUARD_EXECUTED_AMOUNT_MISMATCH");
    }
    if (String(receipt.canonical_payload.spatial_coverage_fraction) !== CAP08_S3_COVERAGE_FRACTION_V1) {
      throw new Error("CAP08_S3_RECEIPT_GUARD_COVERAGE_MISMATCH");
    }
    if (String(receipt.canonical_payload.target_scope_equivalent_irrigation_mm) !== CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1) {
      throw new Error("CAP08_S3_RECEIPT_GUARD_TARGET_EQUIVALENT_MISMATCH");
    }

    const plan = await this.pool.query(
      `SELECT decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash
       FROM twin_approved_plan_binding_projection_v1
       WHERE approved_plan_evidence_ref=$1 AND approved_plan_evidence_hash=$2
         AND tenant_id=$3 AND project_id=$4 AND group_id=$5 AND field_id=$6 AND season_id=$7 AND zone_id=$8
         AND active_for_decision=true
       LIMIT 2`,
      [receipt.canonical_payload.approved_plan_ref, receipt.canonical_payload.approved_plan_hash, ...scopeValuesV1(input.scope)],
    );
    if (plan.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_PLAN_CARDINALITY");
    const decisionRows = await this.pool.query(
      `SELECT decision_object_id FROM twin_decision_record_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND decision_request_evidence_ref=$7 AND decision_request_evidence_hash=$8
         AND selected_option_ref=$9 AND selected_option_hash=$10
       LIMIT 2`,
      [...scopeValuesV1(input.scope), plan.rows[0].decision_request_ref, plan.rows[0].decision_request_hash, plan.rows[0].selected_option_ref, plan.rows[0].selected_option_hash],
    );
    if (decisionRows.rows.length !== 1) throw new Error("CAP08_S3_RECEIPT_GUARD_DECISION_CARDINALITY");
    const object = await this.canonical.readCanonicalObject(decisionRows.rows[0].decision_object_id);
    if (!object || object.object_type !== "twin_decision_record_v1") throw new Error("CAP08_S3_RECEIPT_GUARD_DECISION_CANONICAL_MISSING");
    const decision = object as Cap05DecisionEnvelopeV1;
    const context = await this.activeContextV1(input.scope, decision.context_lineage_ref);
    if (decision.context_revision_ref !== context.revision_id) throw new Error("CAP08_S3_RECEIPT_GUARD_REVISION_MISMATCH");
    return {
      schema_version: "geox_mcft_cap08_s3_receipt_episode_guard_result_v1",
      formal_run_id: formalRunId,
      receipt_ref: receiptRef,
      receipt_hash: receiptHash,
      decision_ref: decision.object_id,
      decision_hash: decision.determinism_hash,
      approved_plan_ref: receipt.canonical_payload.approved_plan_ref,
      approved_plan_hash: receipt.canonical_payload.approved_plan_hash,
      active_lineage_ref: context.active_lineage_ref,
      revision_id: context.revision_id,
      actual_amount_mm: CAP08_S3_EXECUTED_AMOUNT_MM_V1,
      spatial_coverage_fraction: CAP08_S3_COVERAGE_FRACTION_V1,
      target_scope_equivalent_irrigation_mm: CAP08_S3_TARGET_SCOPE_EQUIVALENT_AMOUNT_MM_V1,
      status: "PASS",
    };
  }

  async validateActionFeedback(input: {
    formal_run_id: string;
    scope: TwinScopeKeyV1;
    action_feedback: Cap05ActionFeedbackEnvelopeV1;
  }): Promise<Cap08S3ReceiptEpisodeGuardResultV1> {
    validateCap05ActionFeedbackV1(input.action_feedback);
    assertScopeV1(input.scope, input.action_feedback, "CAP08_S3_H_GUARD_SCOPE_MISMATCH");
    const receiptRef = requiredStringV1(input.action_feedback.payload.receipt_ref, "CAP08_S3_H_GUARD_RECEIPT_REF_REQUIRED");
    const result = await this.validateReceipt({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      receipt_ref: receiptRef,
      receipt_hash: await this.receiptHashByRefV1(receiptRef),
    });
    const feedback = input.action_feedback;
    if (feedback.payload.source_record_id !== result.receipt_ref) throw new Error("CAP08_S3_H_GUARD_RECEIPT_SOURCE_MISMATCH");
    if (feedback.payload.decision_ref !== result.decision_ref || feedback.payload.decision_hash !== result.decision_hash) {
      throw new Error("CAP08_S3_H_GUARD_DECISION_MISMATCH");
    }
    if (feedback.payload.approved_plan_evidence_ref !== result.approved_plan_ref
      || feedback.payload.approved_plan_evidence_hash !== result.approved_plan_hash) {
      throw new Error("CAP08_S3_H_GUARD_PLAN_MISMATCH");
    }
    if (feedback.context_lineage_ref !== result.active_lineage_ref) throw new Error("CAP08_S3_H_GUARD_LINEAGE_MISMATCH");
    if (feedback.context_revision_ref !== result.revision_id) throw new Error("CAP08_S3_H_GUARD_REVISION_MISMATCH");
    if (feedback.payload.actual_amount_mm !== result.actual_amount_mm
      || feedback.payload.spatial_coverage_fraction !== result.spatial_coverage_fraction
      || feedback.payload.target_scope_equivalent_irrigation_mm !== result.target_scope_equivalent_irrigation_mm) {
      throw new Error("CAP08_S3_H_GUARD_AMOUNT_MISMATCH");
    }
    return result;
  }
}
