// apps/server/src/persistence/twin_runtime/postgres_approval_plan_recovery_repository_v1.ts
// Purpose: rebuild the mutable MCFT-CAP-05 Approved Plan binding projection only after revalidating immutable Plan Evidence, Approval Assertion Evidence, canonical G Decision linkage, fixed-point amounts, availability, validity and supersession.
// Boundary: projection recovery only; no canonical fact write, approval exercise, Plan creation, dispatch inference, State mutation, route, clock, filesystem, environment or network authority.

import type { PoolClient } from "pg";
import { validateCap05DecisionV1, type Cap05DecisionEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1,
  CAP05_APPROVED_PLAN_RECORD_TYPE_V1,
  validateCap05ApprovalPlanDecisionBindingV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import { buildCap05ApprovedPlanBindingProjectionRowV1 } from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";

export type Cap05ApprovedPlanRecoverySummaryV1 = {
  approved_plan_facts_scanned: number;
  approved_plan_bindings_rebuilt: number;
  supersessions_rebuilt: number;
};

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

type ExistingActivePlanV1 = {
  approved_plan_evidence_ref: string;
  approved_plan_evidence_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function parseRecordJsonV1(factId: unknown, value: unknown): ParsedFactV1 {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_PLAN_RECOVERY_FACT_INVALID");
  const record = parsed as Record<string, unknown>;
  return {
    fact_id: requiredStringV1(factId, "CAP05_PLAN_RECOVERY_FACT_ID_REQUIRED"),
    type: requiredStringV1(record.type, "CAP05_PLAN_RECOVERY_FACT_TYPE_REQUIRED"),
    payload: record.payload,
  };
}

function parseAssertionV1(fact: ParsedFactV1): Cap05ApprovalAssertionEvidenceV1 {
  if (fact.type !== CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1) throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_TYPE_MISMATCH");
  if (!fact.payload || typeof fact.payload !== "object" || Array.isArray(fact.payload)) throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_PAYLOAD_INVALID");
  return fact.payload as Cap05ApprovalAssertionEvidenceV1;
}

function parsePlanV1(fact: ParsedFactV1): Cap05ApprovedPlanEvidenceV1 {
  if (fact.type !== CAP05_APPROVED_PLAN_RECORD_TYPE_V1) throw new Error("CAP05_PLAN_RECOVERY_PLAN_TYPE_MISMATCH");
  if (!fact.payload || typeof fact.payload !== "object" || Array.isArray(fact.payload)) throw new Error("CAP05_PLAN_RECOVERY_PLAN_PAYLOAD_INVALID");
  return fact.payload as Cap05ApprovedPlanEvidenceV1;
}

function parseDecisionV1(fact: ParsedFactV1): Cap05DecisionEnvelopeV1 {
  if (fact.type !== "twin_decision_record_v1") throw new Error("CAP05_PLAN_RECOVERY_DECISION_TYPE_MISMATCH");
  if (!fact.payload || typeof fact.payload !== "object" || Array.isArray(fact.payload)) throw new Error("CAP05_PLAN_RECOVERY_DECISION_PAYLOAD_INVALID");
  const decision = fact.payload as Cap05DecisionEnvelopeV1;
  validateCap05DecisionV1(decision);
  return decision;
}

export class PostgresApprovalPlanRecoveryRepositoryV1 {
  private async readUniqueAssertionV1(
    client: PoolClient,
    plan: Cap05ApprovedPlanEvidenceV1,
  ): Promise<{ fact_id: string; assertion: Cap05ApprovalAssertionEvidenceV1 }> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'=$1
         AND record_json->'payload'->>'source_record_id'=$2
       LIMIT 2`,
      [CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1, plan.canonical_payload.approval_assertion_ref],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_CARDINALITY");
    const fact = parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json);
    const assertion = parseAssertionV1(fact);
    if (assertion.source_record_hash !== plan.canonical_payload.approval_assertion_hash) {
      throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_HASH_MISMATCH");
    }
    return { fact_id: fact.fact_id, assertion };
  }

  private async readUniqueDecisionV1(
    client: PoolClient,
    assertion: Cap05ApprovalAssertionEvidenceV1,
  ): Promise<Cap05DecisionEnvelopeV1> {
    const payload = assertion.canonical_payload;
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'='twin_decision_record_v1'
         AND record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
         AND record_json->'payload'->'payload'->>'decision_request_evidence_ref'=$7
         AND record_json->'payload'->'payload'->>'decision_request_evidence_hash'=$8
         AND record_json->'payload'->'payload'->>'selected_option_ref'=$9
         AND record_json->'payload'->'payload'->>'selected_option_hash'=$10
       LIMIT 2`,
      [
        assertion.tenant_id,
        assertion.project_id,
        assertion.group_id,
        assertion.field_id,
        assertion.season_id,
        assertion.zone_id,
        payload.decision_request_ref,
        payload.decision_request_hash,
        payload.selected_option_ref,
        payload.selected_option_hash,
      ],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_DECISION_CARDINALITY");
    return parseDecisionV1(parseRecordJsonV1(result.rows[0].fact_id, result.rows[0].record_json));
  }

  private async readCurrentActivePlanV1(
    client: PoolClient,
    decision: Cap05DecisionEnvelopeV1,
  ): Promise<ExistingActivePlanV1 | null> {
    const result = await client.query(
      `SELECT approved_plan_evidence_ref,approved_plan_evidence_hash
       FROM twin_approved_plan_binding_projection_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
         AND decision_request_ref=$7 AND decision_request_hash=$8
         AND selected_option_ref=$9 AND selected_option_hash=$10
         AND active_for_decision=true
       LIMIT 2`,
      [
        decision.tenant_id,
        decision.project_id,
        decision.group_id,
        decision.field_id,
        decision.season_id,
        decision.zone_id,
        decision.payload.decision_request_evidence_ref,
        decision.payload.decision_request_evidence_hash,
        decision.payload.selected_option_ref,
        decision.payload.selected_option_hash,
      ],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_ACTIVE_CARDINALITY_CONFLICT");
    return result.rows[0] as ExistingActivePlanV1;
  }

  async rebuildAllBindingsWithClientV1(client: PoolClient): Promise<Cap05ApprovedPlanRecoverySummaryV1> {
    const plans = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'=$1
       ORDER BY (record_json->'payload'->'role_time'->>'plan_effective_from')::timestamptz,
                record_json->'payload'->>'source_record_id'`,
      [CAP05_APPROVED_PLAN_RECORD_TYPE_V1],
    );
    let rebuilt = 0;
    let supersessions = 0;
    for (const row of plans.rows) {
      const planFact = parseRecordJsonV1(row.fact_id, row.record_json);
      const plan = parsePlanV1(planFact);
      const { assertion } = await this.readUniqueAssertionV1(client, plan);
      const decision = await this.readUniqueDecisionV1(client, assertion);
      validateCap05ApprovalPlanDecisionBindingV1({
        decision,
        approval_assertion: assertion,
        approved_plan: plan,
        as_of: plan.available_to_runtime_at,
      });

      const currentActive = await this.readCurrentActivePlanV1(client, decision);
      const supersedesRef = plan.canonical_payload.supersedes_plan_evidence_ref ?? null;
      const supersedesHash = plan.canonical_payload.supersedes_plan_evidence_hash ?? null;
      if (Boolean(supersedesRef) !== Boolean(supersedesHash)) throw new Error("CAP05_PLAN_RECOVERY_SUPERSESSION_PAIR_REQUIRED");
      if (currentActive) {
        if (!supersedesRef || !supersedesHash) throw new Error("CAP05_PLAN_RECOVERY_ACTIVE_PREDECESSOR_MUST_BE_SUPERSEDED");
        if (currentActive.approved_plan_evidence_ref !== supersedesRef
          || currentActive.approved_plan_evidence_hash !== supersedesHash) {
          throw new Error("CAP05_PLAN_RECOVERY_SUPERSESSION_PREDECESSOR_MISMATCH");
        }
        const deactivated = await client.query(
          `UPDATE twin_approved_plan_binding_projection_v1
           SET active_for_decision=false
           WHERE approved_plan_evidence_ref=$1
             AND approved_plan_evidence_hash=$2
             AND active_for_decision=true`,
          [supersedesRef, supersedesHash],
        );
        if (deactivated.rowCount !== 1) throw new Error("CAP05_PLAN_RECOVERY_SUPERSESSION_CAS_CONFLICT");
        supersessions += 1;
      } else if (supersedesRef || supersedesHash) {
        throw new Error("CAP05_PLAN_RECOVERY_SUPERSEDED_PLAN_NOT_FOUND");
      }

      const projection = buildCap05ApprovedPlanBindingProjectionRowV1(plan, planFact.fact_id);
      await client.query(
        `INSERT INTO twin_approved_plan_binding_projection_v1
         (approved_plan_evidence_ref,approved_plan_evidence_hash,tenant_id,project_id,group_id,field_id,season_id,zone_id,
          binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,
          selected_option_ref,selected_option_hash,scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,
          active_for_decision,canonical_evidence,source_fact_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz,$20,$21::jsonb,$22)`,
        [
          projection.approved_plan_evidence_ref,
          projection.approved_plan_evidence_hash,
          projection.tenant_id,
          projection.project_id,
          projection.group_id,
          projection.field_id,
          projection.season_id,
          projection.zone_id,
          projection.binding_id,
          projection.approval_assertion_ref,
          projection.approval_assertion_hash,
          projection.decision_request_ref,
          projection.decision_request_hash,
          projection.selected_option_ref,
          projection.selected_option_hash,
          projection.scenario_amount_mm,
          projection.approved_amount_mm,
          projection.plan_effective_from,
          projection.plan_effective_to,
          projection.active_for_decision,
          JSON.stringify(projection.canonical_evidence),
          projection.source_fact_id,
        ],
      );
      rebuilt += 1;
    }
    return {
      approved_plan_facts_scanned: plans.rows.length,
      approved_plan_bindings_rebuilt: rebuilt,
      supersessions_rebuilt: supersessions,
    };
  }
}
