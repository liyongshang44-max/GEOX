// apps/server/src/persistence/twin_runtime/postgres_approval_plan_validated_recovery_v1.ts
// Purpose: rebuild MCFT-CAP-05 Approved Plan binding projections from immutable facts only after revalidating Evidence integrity, canonical Decision/Scenario linkage, amount semantics, validity and explicit supersession.
// Boundary: recovery-time projection mutation only; no Evidence append, canonical Twin write, approval/dispatch exercise, route, clock, filesystem, environment or network authority.

import type { PoolClient } from "pg";
import {
  CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1,
  CAP05_APPROVED_PLAN_RECORD_TYPE_V1,
  normalizeCap05WaterAmountV1,
  validateCap05ApprovalAssertionEvidenceV1,
  validateCap05ApprovedPlanEvidenceV1,
  type Cap05ApprovalAssertionEvidenceV1,
  type Cap05ApprovedPlanEvidenceV1,
} from "../../evidence/twin_runtime/approval_plan_evidence_contracts_v1.js";
import {
  resolveCap05ScenarioOptionMemberV1,
  validateCap05DecisionV1,
  type Cap05DecisionEnvelopeV1,
} from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { ContinuationScopeV1 } from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import { buildCap05ApprovedPlanBindingProjectionRowV1 } from "../../projections/twin_runtime/feedback_persistence_projection_v1.js";

export type Cap05ValidatedPlanRecoverySummaryV1 = {
  approved_plan_facts_scanned: number;
  bindings_rebuilt: number;
  supersessions_rebuilt: number;
};

type ParsedFactV1 = {
  fact_id: string;
  type: string;
  payload: unknown;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function optionalStringV1(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function canonicalInstantV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function parseFactV1(factId: unknown, recordJson: unknown): ParsedFactV1 {
  const parsed = typeof recordJson === "string" ? JSON.parse(recordJson) : recordJson;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CAP05_PLAN_RECOVERY_FACT_INVALID");
  const record = parsed as Record<string, unknown>;
  return {
    fact_id: requiredStringV1(factId, "CAP05_PLAN_RECOVERY_FACT_ID_REQUIRED"),
    type: requiredStringV1(record.type, "CAP05_PLAN_RECOVERY_FACT_TYPE_REQUIRED"),
    payload: record.payload,
  };
}

function scopeFromPlanV1(plan: Cap05ApprovedPlanEvidenceV1): ContinuationScopeV1 {
  return {
    tenant_id: plan.tenant_id,
    project_id: plan.project_id,
    group_id: plan.group_id,
    field_id: plan.field_id,
    season_id: plan.season_id,
    zone_id: plan.zone_id,
  };
}

function assertExactScopeV1(expected: ContinuationScopeV1, actual: ContinuationScopeV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (expected[field] !== actual[field]) throw new Error(`${code}:${field}`);
  }
}

async function readEvidenceFactV1(
  client: PoolClient,
  type: string,
  sourceRecordId: string,
): Promise<ParsedFactV1> {
  const result = await client.query(
    `SELECT fact_id,record_json FROM facts
     WHERE record_json->>'type'=$1
       AND record_json->'payload'->>'source_record_id'=$2
     LIMIT 2`,
    [type, sourceRecordId],
  );
  if (result.rows.length !== 1) throw new Error(`CAP05_PLAN_RECOVERY_EVIDENCE_CARDINALITY:${type}`);
  return parseFactV1(result.rows[0].fact_id, result.rows[0].record_json);
}

async function readDecisionV1(
  client: PoolClient,
  scope: ContinuationScopeV1,
  plan: Cap05ApprovedPlanEvidenceV1,
): Promise<Cap05DecisionEnvelopeV1> {
  const payload = plan.canonical_payload;
  const projection = await client.query(
    `SELECT decision_object_id,determinism_hash FROM twin_decision_record_projection_v1
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
  if (projection.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_DECISION_PROJECTION_CARDINALITY");
  const objectId = requiredStringV1(projection.rows[0].decision_object_id, "CAP05_PLAN_RECOVERY_DECISION_ID_REQUIRED");
  const canonical = await client.query(
    `SELECT fact_id,record_json FROM facts
     WHERE record_json->>'type'='twin_decision_record_v1'
       AND record_json->'payload'->>'object_id'=$1
     LIMIT 2`,
    [objectId],
  );
  if (canonical.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_CANONICAL_DECISION_CARDINALITY");
  const parsed = parseFactV1(canonical.rows[0].fact_id, canonical.rows[0].record_json);
  const decision = parsed.payload as Cap05DecisionEnvelopeV1;
  validateCap05DecisionV1(decision);
  if (decision.determinism_hash !== projection.rows[0].determinism_hash) throw new Error("CAP05_PLAN_RECOVERY_DECISION_HASH_MISMATCH");
  return decision;
}

async function readScenarioV1(
  client: PoolClient,
  decision: Cap05DecisionEnvelopeV1,
): Promise<Cap04ScenarioSetEnvelopeV1> {
  const result = await client.query(
    `SELECT record_json FROM facts
     WHERE record_json->>'type'='twin_scenario_set_v1'
       AND record_json->'payload'->>'object_id'=$1
     LIMIT 2`,
    [decision.payload.scenario_set_ref],
  );
  if (result.rows.length !== 1) throw new Error("CAP05_PLAN_RECOVERY_SCENARIO_CARDINALITY");
  const parsed = typeof result.rows[0].record_json === "string" ? JSON.parse(result.rows[0].record_json) : result.rows[0].record_json;
  const scenario = parsed?.payload as Cap04ScenarioSetEnvelopeV1 | undefined;
  if (!scenario || scenario.object_type !== "twin_scenario_set_v1") throw new Error("CAP05_PLAN_RECOVERY_SCENARIO_INVALID");
  if (scenario.determinism_hash !== decision.payload.scenario_set_hash) throw new Error("CAP05_PLAN_RECOVERY_SCENARIO_HASH_MISMATCH");
  return scenario;
}

function assertBindingV1(input: {
  decision: Cap05DecisionEnvelopeV1;
  assertion: Cap05ApprovalAssertionEvidenceV1;
  plan: Cap05ApprovedPlanEvidenceV1;
  scenario: Cap04ScenarioSetEnvelopeV1;
}): void {
  const { decision, assertion, plan, scenario } = input;
  const assertionPayload = assertion.canonical_payload;
  const planPayload = plan.canonical_payload;
  if (assertionPayload.decision_request_ref !== decision.payload.decision_request_evidence_ref
    || assertionPayload.decision_request_hash !== decision.payload.decision_request_evidence_hash
    || assertionPayload.selected_option_ref !== decision.payload.selected_option_ref
    || assertionPayload.selected_option_hash !== decision.payload.selected_option_hash) {
    throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_DECISION_BINDING_MISMATCH");
  }
  if (planPayload.approval_assertion_ref !== assertion.source_record_id
    || planPayload.approval_assertion_hash !== assertion.source_record_hash) {
    throw new Error("CAP05_PLAN_RECOVERY_PLAN_ASSERTION_BINDING_MISMATCH");
  }
  if (planPayload.decision_request_ref !== decision.payload.decision_request_evidence_ref
    || planPayload.decision_request_hash !== decision.payload.decision_request_evidence_hash
    || planPayload.selected_option_ref !== decision.payload.selected_option_ref
    || planPayload.selected_option_hash !== decision.payload.selected_option_hash) {
    throw new Error("CAP05_PLAN_RECOVERY_PLAN_DECISION_BINDING_MISMATCH");
  }
  const option = resolveCap05ScenarioOptionMemberV1(scenario, decision.payload.selected_option_ref);
  if (option.option_hash !== decision.payload.selected_option_hash) throw new Error("CAP05_PLAN_RECOVERY_OPTION_HASH_MISMATCH");
  const selected = scenario.payload.options.find((candidate) => candidate.option_id === decision.payload.selected_option_id);
  if (!selected) throw new Error("CAP05_PLAN_RECOVERY_SELECTED_OPTION_MISSING");
  if (normalizeCap05WaterAmountV1(selected.requested_irrigation_mm, "CAP05_PLAN_RECOVERY_SCENARIO_AMOUNT_INVALID")
    !== normalizeCap05WaterAmountV1(planPayload.scenario_amount_mm, "CAP05_PLAN_RECOVERY_PLAN_SCENARIO_AMOUNT_INVALID")) {
    throw new Error("CAP05_PLAN_RECOVERY_SCENARIO_AMOUNT_MISMATCH");
  }
  const assertionAvailable = canonicalInstantV1(assertion.available_to_runtime_at, "CAP05_PLAN_RECOVERY_ASSERTION_AVAILABLE_INVALID");
  const planAvailable = canonicalInstantV1(plan.available_to_runtime_at, "CAP05_PLAN_RECOVERY_PLAN_AVAILABLE_INVALID");
  if (assertionAvailable < decision.as_of) throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_PRECEDES_DECISION");
  if (planAvailable < assertionAvailable) throw new Error("CAP05_PLAN_RECOVERY_PLAN_PRECEDES_ASSERTION");
}

export async function rebuildCap05ApprovedPlanBindingsValidatedV1(
  client: PoolClient,
): Promise<Cap05ValidatedPlanRecoverySummaryV1> {
  const plans = await client.query(
    `SELECT fact_id,record_json FROM facts
     WHERE record_json->>'type'=$1
     ORDER BY (record_json->'payload'->>'available_to_runtime_at')::timestamptz,
              record_json->'payload'->>'source_record_id'`,
    [CAP05_APPROVED_PLAN_RECORD_TYPE_V1],
  );
  const validated: Array<{ plan: Cap05ApprovedPlanEvidenceV1; fact_id: string }> = [];
  for (const row of plans.rows) {
    const parsed = parseFactV1(row.fact_id, row.record_json);
    const plan = parsed.payload as Cap05ApprovedPlanEvidenceV1;
    const scope = scopeFromPlanV1(plan);
    validateCap05ApprovedPlanEvidenceV1(plan, scope);
    const assertionFact = await readEvidenceFactV1(client, CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1, plan.canonical_payload.approval_assertion_ref);
    const assertion = assertionFact.payload as Cap05ApprovalAssertionEvidenceV1;
    if (assertion.source_record_hash !== plan.canonical_payload.approval_assertion_hash) throw new Error("CAP05_PLAN_RECOVERY_ASSERTION_HASH_MISMATCH");
    validateCap05ApprovalAssertionEvidenceV1(assertion, scope);
    assertExactScopeV1(scope, assertion, "CAP05_PLAN_RECOVERY_ASSERTION_SCOPE_MISMATCH");
    const decision = await readDecisionV1(client, scope, plan);
    const scenario = await readScenarioV1(client, decision);
    assertBindingV1({ decision, assertion, plan, scenario });
    const projection = buildCap05ApprovedPlanBindingProjectionRowV1(plan, parsed.fact_id);
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
    validated.push({ plan, fact_id: parsed.fact_id });
  }

  let supersessions = 0;
  for (const { plan } of validated) {
    const supersedesRef = optionalStringV1(plan.canonical_payload.supersedes_plan_evidence_ref);
    const supersedesHash = optionalStringV1(plan.canonical_payload.supersedes_plan_evidence_hash);
    if (Boolean(supersedesRef) !== Boolean(supersedesHash)) throw new Error("CAP05_PLAN_RECOVERY_SUPERSESSION_PAIR_REQUIRED");
    if (!supersedesRef || !supersedesHash) continue;
    if (supersedesRef === plan.source_record_id) throw new Error("CAP05_PLAN_RECOVERY_SELF_SUPERSESSION_FORBIDDEN");
    const deactivated = await client.query(
      `UPDATE twin_approved_plan_binding_projection_v1
       SET active_for_decision=false
       WHERE approved_plan_evidence_ref=$1 AND approved_plan_evidence_hash=$2 AND active_for_decision=true`,
      [supersedesRef, supersedesHash],
    );
    if (deactivated.rowCount !== 1) throw new Error("CAP05_PLAN_RECOVERY_SUPERSEDED_PLAN_NOT_FOUND");
    supersessions += 1;
  }

  const conflicts = await client.query(
    `SELECT decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash,count(*)::int AS count
     FROM twin_approved_plan_binding_projection_v1
     WHERE active_for_decision=true
     GROUP BY decision_request_ref,decision_request_hash,selected_option_ref,selected_option_hash
     HAVING count(*) > 1`,
  );
  if (conflicts.rows.length > 0) throw new Error("CAP05_PLAN_RECOVERY_ACTIVE_CARDINALITY_CONFLICT");
  return {
    approved_plan_facts_scanned: plans.rows.length,
    bindings_rebuilt: validated.length,
    supersessions_rebuilt: supersessions,
  };
}
