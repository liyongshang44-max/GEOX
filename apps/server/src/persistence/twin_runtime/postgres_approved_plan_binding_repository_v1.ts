// apps/server/src/persistence/twin_runtime/postgres_approved_plan_binding_repository_v1.ts
// Purpose: validate and materialize the rebuildable MCFT-CAP-05 Decision → Approval Assertion → Approved Plan binding projection, including explicit supersession.
// Boundary: mutable projection persistence only; no canonical fact write, approval exercise, Plan creation, dispatch inference, State mutation, route, clock, filesystem, environment or network authority.

import type { Pool, PoolClient } from "pg";
import {
  CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1,
  CAP05_APPROVED_PLAN_RECORD_TYPE_V1,
  validateCap05ApprovedPlanBindingV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
  type Cap05ValidatedApprovedPlanBindingV1,
} from "../../domain/twin_runtime/approved_plan_binding_v1.js";
import {
  validateCap05DecisionV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  buildCap05ApprovedPlanBindingProjectionRowV1,
} from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";

export type Cap05ApprovedPlanBindingPersistenceStatusV1 =
  | "INSERTED"
  | "EXISTING_IDEMPOTENT_SUCCESS"
  | "SUPERSEDED_PREVIOUS";

export type Cap05ApprovedPlanBindingPersistenceResultV1 = {
  status: Cap05ApprovedPlanBindingPersistenceStatusV1;
  binding: Cap05ValidatedApprovedPlanBindingV1;
  plan_fact_id: string;
  assertion_fact_id: string;
};

export type Cap05ApprovedPlanBindingRecoverySummaryV1 = {
  approved_plan_facts_scanned: number;
  bindings_rebuilt: number;
  supersessions_rebuilt: number;
};

type FactRecordV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function parseFactRecordV1(factId: unknown, recordJson: unknown): FactRecordV1 {
  const parsed = typeof recordJson === "string" ? JSON.parse(recordJson) : recordJson;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_PLAN_BINDING_FACT_INVALID");
  const record = parsed as Record<string, unknown>;
  return {
    fact_id: requiredStringV1(factId, "CAP05_PLAN_BINDING_FACT_ID_REQUIRED"),
    type: requiredStringV1(record.type, "CAP05_PLAN_BINDING_FACT_TYPE_REQUIRED"),
    payload: record.payload,
  };
}

function parseDecisionV1(record: FactRecordV1): Cap05DecisionEnvelopeV1 {
  if (record.type !== "twin_decision_record_v1") throw new Error("CAP05_PLAN_BINDING_DECISION_FACT_TYPE_MISMATCH");
  const decision = record.payload as Cap05DecisionEnvelopeV1;
  validateCap05DecisionV1(decision);
  return decision;
}

function parseAssertionV1(record: FactRecordV1): Cap05ApprovalAssertionEvidenceV1 {
  if (record.type !== CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1) throw new Error("CAP05_PLAN_BINDING_ASSERTION_FACT_TYPE_MISMATCH");
  return record.payload as Cap05ApprovalAssertionEvidenceV1;
}

function parsePlanV1(record: FactRecordV1): Cap05ApprovedPlanEvidenceV1 {
  if (record.type !== CAP05_APPROVED_PLAN_RECORD_TYPE_V1) throw new Error("CAP05_PLAN_BINDING_PLAN_FACT_TYPE_MISMATCH");
  return record.payload as Cap05ApprovedPlanEvidenceV1;
}

function validatedBindingFromRowV1(value: unknown): Cap05ValidatedApprovedPlanBindingV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("CAP05_PLAN_BINDING_PROJECTION_JSON_INVALID");
  const canonical = value as Record<string, unknown>;
  const binding = canonical.validated_binding;
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) throw new Error("CAP05_PLAN_BINDING_VALIDATED_TRACE_MISSING");
  return binding as Cap05ValidatedApprovedPlanBindingV1;
}

export class PostgresApprovedPlanBindingRepositoryV1 {
  constructor(private readonly pool: Pool) {}

  private async readUniqueFactByObjectIdV1(client: PoolClient, objectId: string): Promise<FactRecordV1> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->'payload'->>'object_id'=$1
       LIMIT 2`,
      [objectId],
    );
    if (result.rows.length !== 1) throw new Error("CAP05_PLAN_BINDING_DECISION_CARDINALITY");
    return parseFactRecordV1(result.rows[0].fact_id, result.rows[0].record_json);
  }

  private async readUniqueEvidenceV1(client: PoolClient, type: string, sourceRecordId: string): Promise<FactRecordV1> {
    const result = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'=$1
         AND record_json->'payload'->>'source_record_id'=$2
       LIMIT 2`,
      [type, sourceRecordId],
    );
    if (result.rows.length !== 1) throw new Error(`CAP05_PLAN_BINDING_EVIDENCE_CARDINALITY:${type}`);
    return parseFactRecordV1(result.rows[0].fact_id, result.rows[0].record_json);
  }

  private async readCurrentActiveBindingV1(
    client: PoolClient,
    decisionRef: string,
  ): Promise<Cap05ValidatedApprovedPlanBindingV1 | null> {
    const result = await client.query(
      `SELECT canonical_evidence FROM twin_approved_plan_binding_projection_v1
       WHERE active_for_decision=true
         AND canonical_evidence->'validated_binding'->>'decision_ref'=$1
       ORDER BY plan_effective_from DESC, approved_plan_evidence_ref DESC
       LIMIT 2`,
      [decisionRef],
    );
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error("CAP05_PLAN_BINDING_MULTIPLE_ACTIVE_PLANS");
    return validatedBindingFromRowV1(result.rows[0].canonical_evidence);
  }

  private async insertValidatedBindingWithClientV1(input: {
    client: PoolClient;
    decision: Cap05DecisionEnvelopeV1;
    assertion: Cap05ApprovalAssertionEvidenceV1;
    plan: Cap05ApprovedPlanEvidenceV1;
    plan_fact_id: string;
    assertion_fact_id: string;
    as_of: string;
  }): Promise<Cap05ApprovedPlanBindingPersistenceResultV1> {
    const { client, decision, assertion, plan } = input;
    if (plan.source_record_hash !== requiredStringV1(plan.source_record_hash, "CAP05_PLAN_BINDING_PLAN_HASH_REQUIRED")) throw new Error("CAP05_PLAN_BINDING_PLAN_HASH_INVALID");
    if (assertion.source_record_hash !== requiredStringV1(assertion.source_record_hash, "CAP05_PLAN_BINDING_ASSERTION_HASH_REQUIRED")) throw new Error("CAP05_PLAN_BINDING_ASSERTION_HASH_INVALID");

    const existingResult = await client.query(
      `SELECT approved_plan_evidence_hash,canonical_evidence,source_fact_id
       FROM twin_approved_plan_binding_projection_v1
       WHERE approved_plan_evidence_ref=$1 FOR UPDATE`,
      [plan.source_record_id],
    );
    if (existingResult.rows.length > 1) throw new Error("CAP05_PLAN_BINDING_PLAN_ID_NOT_UNIQUE");
    if (existingResult.rows.length === 1) {
      const existing = validatedBindingFromRowV1(existingResult.rows[0].canonical_evidence);
      if (existingResult.rows[0].approved_plan_evidence_hash !== plan.source_record_hash
        || existing.approved_plan_hash !== plan.source_record_hash
        || existing.decision_ref !== decision.object_id
        || existing.decision_hash !== decision.determinism_hash
        || existing.approval_assertion_ref !== assertion.source_record_id
        || existing.approval_assertion_hash !== assertion.source_record_hash) {
        throw new Error("CAP05_PLAN_BINDING_IDENTITY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        binding: existing,
        plan_fact_id: existingResult.rows[0].source_fact_id,
        assertion_fact_id: input.assertion_fact_id,
      };
    }

    const previous = await this.readCurrentActiveBindingV1(client, decision.object_id);
    const binding = validateCap05ApprovedPlanBindingV1({
      decision,
      approval_assertion: assertion,
      approved_plan: plan,
      as_of: input.as_of,
      previous_active_plan: previous,
    });
    const row = buildCap05ApprovedPlanBindingProjectionRowV1(plan, input.plan_fact_id);
    row.canonical_evidence = {
      source_evidence: structuredClone(plan as unknown as Record<string, unknown>),
      approval_assertion_evidence: structuredClone(assertion as unknown as Record<string, unknown>),
      validated_binding: structuredClone(binding as unknown as Record<string, unknown>),
    };

    if (binding.supersession.status === "SUPERSEDES_ACTIVE_PLAN") {
      const deactivated = await client.query(
        `UPDATE twin_approved_plan_binding_projection_v1
         SET active_for_decision=false,
             canonical_evidence=jsonb_set(canonical_evidence,'{supersession_effective}',to_jsonb($3::text),true)
         WHERE approved_plan_evidence_ref=$1
           AND approved_plan_evidence_hash=$2
           AND active_for_decision=true`,
        [binding.supersession.supersedes_plan_ref, binding.supersession.supersedes_plan_hash, binding.approved_plan_ref],
      );
      if (deactivated.rowCount !== 1) throw new Error("CAP05_PLAN_BINDING_SUPERSESSION_CAS_CONFLICT");
    }

    await client.query(
      `INSERT INTO twin_approved_plan_binding_projection_v1
       (approved_plan_evidence_ref,approved_plan_evidence_hash,tenant_id,project_id,group_id,field_id,season_id,zone_id,
        binding_id,approval_assertion_ref,approval_assertion_hash,decision_request_ref,decision_request_hash,
        selected_option_ref,selected_option_hash,scenario_amount_mm,approved_amount_mm,plan_effective_from,plan_effective_to,
        active_for_decision,canonical_evidence,source_fact_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz,$20,$21::jsonb,$22)`,
      [
        row.approved_plan_evidence_ref,row.approved_plan_evidence_hash,row.tenant_id,row.project_id,row.group_id,row.field_id,
        row.season_id,row.zone_id,row.binding_id,row.approval_assertion_ref,row.approval_assertion_hash,row.decision_request_ref,
        row.decision_request_hash,row.selected_option_ref,row.selected_option_hash,row.scenario_amount_mm,row.approved_amount_mm,
        row.plan_effective_from,row.plan_effective_to,row.active_for_decision,JSON.stringify(row.canonical_evidence),row.source_fact_id,
      ],
    );
    return {
      status: binding.supersession.status === "SUPERSEDES_ACTIVE_PLAN" ? "SUPERSEDED_PREVIOUS" : "INSERTED",
      binding,
      plan_fact_id: input.plan_fact_id,
      assertion_fact_id: input.assertion_fact_id,
    };
  }

  async bindApprovedPlan(input: {
    decision_ref: string;
    decision_hash: string;
    approval_assertion_ref: string;
    approval_assertion_hash: string;
    approved_plan_ref: string;
    approved_plan_hash: string;
    as_of: string;
  }): Promise<Cap05ApprovedPlanBindingPersistenceResultV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const decisionRecord = await this.readUniqueFactByObjectIdV1(client, input.decision_ref);
      const decision = parseDecisionV1(decisionRecord);
      if (decision.determinism_hash !== input.decision_hash) throw new Error("CAP05_PLAN_BINDING_DECISION_HASH_MISMATCH");
      const assertionRecord = await this.readUniqueEvidenceV1(client, CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1, input.approval_assertion_ref);
      const assertion = parseAssertionV1(assertionRecord);
      if (assertion.source_record_hash !== input.approval_assertion_hash) throw new Error("CAP05_PLAN_BINDING_ASSERTION_HASH_MISMATCH");
      const planRecord = await this.readUniqueEvidenceV1(client, CAP05_APPROVED_PLAN_RECORD_TYPE_V1, input.approved_plan_ref);
      const plan = parsePlanV1(planRecord);
      if (plan.source_record_hash !== input.approved_plan_hash) throw new Error("CAP05_PLAN_BINDING_PLAN_HASH_MISMATCH");
      const result = await this.insertValidatedBindingWithClientV1({
        client,
        decision,
        assertion,
        plan,
        plan_fact_id: planRecord.fact_id,
        assertion_fact_id: assertionRecord.fact_id,
        as_of: input.as_of,
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rebuildAllBindings(): Promise<Cap05ApprovedPlanBindingRecoverySummaryV1> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const summary = await this.rebuildAllBindingsWithClientV1(client);
      await client.query("COMMIT");
      return summary;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rebuildAllBindingsWithClientV1(client: PoolClient): Promise<Cap05ApprovedPlanBindingRecoverySummaryV1> {
    await client.query("DELETE FROM twin_approved_plan_binding_projection_v1");
    const plansResult = await client.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'=$1
       ORDER BY (record_json->'payload'->'role_time'->>'plan_effective_from')::timestamptz,
                record_json->'payload'->>'source_record_id'`,
      [CAP05_APPROVED_PLAN_RECORD_TYPE_V1],
    );
    let rebuilt = 0;
    let supersessions = 0;
    for (const row of plansResult.rows) {
      const planRecord = parseFactRecordV1(row.fact_id, row.record_json);
      const plan = parsePlanV1(planRecord);
      const assertionRecord = await this.readUniqueEvidenceV1(client, CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1, plan.canonical_payload.approval_assertion_ref);
      const assertion = parseAssertionV1(assertionRecord);
      const decisionResult = await client.query(
        `SELECT fact_id,record_json FROM facts
         WHERE record_json->>'type'='twin_decision_record_v1'
           AND record_json->'payload'->'payload'->>'decision_request_evidence_ref'=$1
           AND record_json->'payload'->'payload'->>'decision_request_evidence_hash'=$2
           AND record_json->'payload'->'payload'->>'selected_option_ref'=$3
           AND record_json->'payload'->'payload'->>'selected_option_hash'=$4
         LIMIT 2`,
        [
          plan.canonical_payload.decision_request_ref,
          plan.canonical_payload.decision_request_hash,
          plan.canonical_payload.selected_option_ref,
          plan.canonical_payload.selected_option_hash,
        ],
      );
      if (decisionResult.rows.length !== 1) throw new Error("CAP05_PLAN_BINDING_REBUILD_DECISION_CARDINALITY");
      const decision = parseDecisionV1(parseFactRecordV1(decisionResult.rows[0].fact_id, decisionResult.rows[0].record_json));
      const result = await this.insertValidatedBindingWithClientV1({
        client,
        decision,
        assertion,
        plan,
        plan_fact_id: planRecord.fact_id,
        assertion_fact_id: assertionRecord.fact_id,
        as_of: plan.available_to_runtime_at,
      });
      rebuilt += 1;
      if (result.status === "SUPERSEDED_PREVIOUS") supersessions += 1;
    }
    return {
      approved_plan_facts_scanned: plansResult.rows.length,
      bindings_rebuilt: rebuilt,
      supersessions_rebuilt: supersessions,
    };
  }
}
