// apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts
// Purpose: atomically append Approval Assertion and Approved Plan Replay Evidence to public.facts and maintain the rebuildable active-Plan binding projection.
// Boundary: Evidence persistence and mutable projection only; no canonical Twin object, approval exercise, Recommendation, Task, dispatch, Action Feedback, State/checkpoint, route, clock, filesystem, environment or network authority.

import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Cap05DecisionEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1,
  CAP05_APPROVED_PLAN_RECORD_TYPE_V1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
  type Cap05DispatchDispositionV1,
} from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { buildCap05ApprovedPlanBindingProjectionRowV1 } from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";

export type Cap05EvidencePersistenceStatusV1 = "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";

export type Cap05ApprovalPlanPersistenceResultV1 = {
  decision_object_id: string;
  decision_hash: string;
  approval_assertion_status: Cap05EvidencePersistenceStatusV1;
  approval_assertion_fact_id: string;
  approved_plan_status: Cap05EvidencePersistenceStatusV1;
  approved_plan_fact_id: string;
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
  superseded_plan_evidence_ref: string | null;
  dispatch_disposition: Cap05DispatchDispositionV1;
};

type ReplayEvidenceRecordV1 = Cap05ApprovalAssertionEvidenceV1 | Cap05ApprovedPlanEvidenceV1;

function evidenceFactIdV1(record: ReplayEvidenceRecordV1): string {
  const digest = crypto.createHash("sha256").update(record.evidence_identity_key, "utf8").digest("hex").slice(0, 32);
  return `fact_mcft05_evidence_${digest}`;
}

function recordJsonV1(record: ReplayEvidenceRecordV1): string {
  return JSON.stringify({ type: record.record_type, payload: record });
}

function isPgUniqueViolationV1(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

export class PostgresApprovalPlanEvidenceRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  private async appendEvidenceWithClientV1(
    client: PoolClient,
    record: ReplayEvidenceRecordV1,
  ): Promise<{ status: Cap05EvidencePersistenceStatusV1; fact_id: string }> {
    const factId = evidenceFactIdV1(record);
    const existing = await client.query(
      `SELECT source,record_json FROM facts WHERE fact_id=$1 FOR UPDATE`,
      [factId],
    );
    if (existing.rows.length > 1) throw new Error("CAP05_EVIDENCE_FACT_CARDINALITY");
    if (existing.rows.length === 1) {
      const payload = existing.rows[0].record_json?.payload as ReplayEvidenceRecordV1 | undefined;
      if (existing.rows[0].source !== "mcft_cap05_replay_evidence_v1"
        || !payload
        || payload.record_type !== record.record_type
        || payload.evidence_identity_key !== record.evidence_identity_key
        || payload.source_record_id !== record.source_record_id) {
        throw new Error("CAP05_EVIDENCE_IDENTITY_CORRUPTION");
      }
      if (payload.source_record_hash !== record.source_record_hash) throw new Error("CAP05_EVIDENCE_IDENTITY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", fact_id: factId };
    }
    await client.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
      [factId, record.available_to_runtime_at, recordJsonV1(record)],
    );
    return { status: "INSERTED", fact_id: factId };
  }

  async commitApprovalPlanBinding(input: {
    decision: Cap05DecisionEnvelopeV1;
    approval_assertion: Cap05ApprovalAssertionEvidenceV1;
    approved_plan: Cap05ApprovedPlanEvidenceV1;
    dispatch_disposition: Cap05DispatchDispositionV1;
    fault_injection?: (stage: string) => void;
  }): Promise<Cap05ApprovalPlanPersistenceResultV1> {
    const client = await this.pool.connect();
    const inject = (stage: string) => input.fault_injection?.(stage);
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cap05-plan:${input.decision.object_id}`]);
      inject("before_assertion_fact");
      const assertion = await this.appendEvidenceWithClientV1(client, input.approval_assertion);
      inject("before_plan_fact");
      const plan = await this.appendEvidenceWithClientV1(client, input.approved_plan);

      const planPayload = input.approved_plan.canonical_payload;
      const activeRows = await client.query(
        `SELECT approved_plan_evidence_ref,approved_plan_evidence_hash,active_for_decision
         FROM twin_approved_plan_binding_projection_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND decision_request_ref=$7 AND decision_request_hash=$8
           AND selected_option_ref=$9 AND selected_option_hash=$10
           AND active_for_decision=true
         FOR UPDATE`,
        [
          input.decision.tenant_id,
          input.decision.project_id,
          input.decision.group_id,
          input.decision.field_id,
          input.decision.season_id,
          input.decision.zone_id,
          input.decision.payload.decision_request_evidence_ref,
          input.decision.payload.decision_request_evidence_hash,
          input.decision.payload.selected_option_ref,
          input.decision.payload.selected_option_hash,
        ],
      );
      if (activeRows.rows.length > 1) throw new Error("CAP05_ACTIVE_PLAN_CARDINALITY_CORRUPTION");

      const supersedesRef = planPayload.supersedes_plan_evidence_ref ?? null;
      const supersedesHash = planPayload.supersedes_plan_evidence_hash ?? null;
      const existingActive = activeRows.rows[0] as {
        approved_plan_evidence_ref: string;
        approved_plan_evidence_hash: string;
        active_for_decision: boolean;
      } | undefined;

      if (existingActive && existingActive.approved_plan_evidence_ref === input.approved_plan.source_record_id) {
        if (existingActive.approved_plan_evidence_hash !== input.approved_plan.source_record_hash) {
          throw new Error("CAP05_ACTIVE_PLAN_IDENTITY_CONFLICT");
        }
      } else if (existingActive) {
        if (!supersedesRef || !supersedesHash) throw new Error("CAP05_ACTIVE_PLAN_SUPERSESSION_REQUIRED");
        if (supersedesRef !== existingActive.approved_plan_evidence_ref || supersedesHash !== existingActive.approved_plan_evidence_hash) {
          throw new Error("CAP05_ACTIVE_PLAN_SUPERSESSION_IDENTITY_MISMATCH");
        }
        await client.query(
          `UPDATE twin_approved_plan_binding_projection_v1
           SET active_for_decision=false
           WHERE approved_plan_evidence_ref=$1 AND approved_plan_evidence_hash=$2`,
          [supersedesRef, supersedesHash],
        );
      } else if (supersedesRef || supersedesHash) {
        throw new Error("CAP05_SUPERSEDED_ACTIVE_PLAN_NOT_FOUND");
      }

      inject("before_plan_projection");
      const row = buildCap05ApprovedPlanBindingProjectionRowV1(input.approved_plan, plan.fact_id);
      await client.query(
        `INSERT INTO twin_approved_plan_binding_projection_v1
         (approved_plan_evidence_ref,approved_plan_evidence_hash,tenant_id,project_id,group_id,field_id,season_id,zone_id,
          binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,
          selected_option_ref,selected_option_hash,scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,
          active_for_decision,canonical_evidence,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz,$20,$21::jsonb,$22)
         ON CONFLICT (approved_plan_evidence_ref) DO UPDATE SET
           active_for_decision=EXCLUDED.active_for_decision,
           canonical_evidence=EXCLUDED.canonical_evidence,
           source_fact_id=EXCLUDED.source_fact_id`,
        [
          row.approved_plan_evidence_ref,
          row.approved_plan_evidence_hash,
          row.tenant_id,
          row.project_id,
          row.group_id,
          row.field_id,
          row.season_id,
          row.zone_id,
          row.binding_id,
          row.approval_assertion_ref,
          row.approval_assertion_hash,
          row.decision_request_ref,
          row.decision_request_hash,
          row.selected_option_ref,
          row.selected_option_hash,
          row.scenario_amount_mm,
          row.approved_amount_mm,
          row.plan_effective_from,
          row.plan_effective_to,
          row.active_for_decision,
          JSON.stringify(row.canonical_evidence),
          row.source_fact_id,
        ],
      );
      inject("before_commit");
      await client.query("COMMIT");
      return {
        decision_object_id: input.decision.object_id,
        decision_hash: input.decision.determinism_hash,
        approval_assertion_status: assertion.status,
        approval_assertion_fact_id: assertion.fact_id,
        approved_plan_status: plan.status,
        approved_plan_fact_id: plan.fact_id,
        approved_plan_evidence_ref: input.approved_plan.source_record_id,
        approved_plan_evidence_hash: input.approved_plan.source_record_hash,
        superseded_plan_evidence_ref: supersedesRef,
        dispatch_disposition: input.dispatch_disposition,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if (isPgUniqueViolationV1(error)) throw new Error("CAP05_APPROVAL_PLAN_UNIQUENESS_CONFLICT");
      throw error;
    } finally {
      client.release();
    }
  }
}
