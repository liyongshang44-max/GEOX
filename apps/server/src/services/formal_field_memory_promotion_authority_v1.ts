import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

export type FormalFieldMemoryTenantTripleV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FormalFieldMemoryPromotionAuthorityV1 = {
  acceptance_fact_id: string;
  acceptance_payload: Record<string, any>;
  acceptance_occurred_at: string | null;
  act_task_id: string;
  field_id: string;
  field_memory_record_fact_id: string;
  field_memory_record_id: string;
  field_memory_candidate_fact_id: string;
  field_memory_candidate_id: string;
  source_chain_refs: Array<{ kind: string; ref_id: string }>;
  accounting_basis_refs: Array<{ kind: string; ref_id: string }>;
  candidate_basis_refs: Array<{ kind: string; ref_id: string }>;
  promotion_basis_refs: Array<{ kind: string; ref_id: string }>;
};

type FactRow = {
  fact_id: string;
  occurred_at?: unknown;
  record_json: any;
};

const REQUIRED_CANDIDATE_BASIS: Record<string, string> = {
  memory_relevance_review_v1: "MEMORY_RELEVANCE_SOURCE",
  agronomic_context_v1: "AGRONOMIC_CONTEXT_SOURCE",
  recurrence_context_v1: "RECURRENCE_CONTEXT_SOURCE",
  operator_review_v1: "OPERATOR_REVIEW_SOURCE",
};

const REQUIRED_PROMOTION_BASIS: Record<string, string> = {
  promotion_review_v1: "PROMOTION_REVIEW_SOURCE",
  memory_record_policy_v1: "MEMORY_RECORD_POLICY_SOURCE",
  agronomic_reviewer_approval_v1: "AGRONOMIC_APPROVAL_SOURCE",
  operator_context_ack_v1: "OPERATOR_ACK_SOURCE",
  reuse_boundary_review_v1: "REUSE_BOUNDARY_SOURCE",
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function payloadOf(row: FactRow): Record<string, any> {
  return record(record(row.record_json).payload);
}

function refs(value: unknown): Array<{ kind: string; ref_id: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { kind: "", ref_id: text(item) };
      const obj = record(item);
      return { kind: text(obj.kind), ref_id: text(obj.ref_id ?? obj.ref) };
    })
    .filter((item) => item.ref_id);
}

function objectRef(value: unknown): { kind: string; ref_id: string } | null {
  const obj = record(value);
  const ref_id = text(obj.ref_id ?? obj.ref);
  if (!ref_id) return null;
  return { kind: text(obj.kind), ref_id };
}

function policyRefs(payload: Record<string, any>): string[] {
  const meta = record(payload.meta);
  return Array.isArray(meta.policy_refs) ? meta.policy_refs.map(text).filter(Boolean) : [];
}

function requireSameOperationAndTask(
  payload: Record<string, any>,
  operationPlanId: string,
  actTaskId: string,
  prefix: string,
): void {
  if (text(payload.operation_plan_id) !== operationPlanId) throw new Error(`${prefix}_OPERATION_MISMATCH`);
  if (text(payload.act_task_id ?? payload.task_id) !== actTaskId) throw new Error(`${prefix}_TASK_MISMATCH`);
}

function requireAllowedSourceLane(payload: Record<string, any>, prefix: string): void {
  const sourceLane = text(payload.source_lane);
  if (!sourceLane) throw new Error(`${prefix}_SOURCE_LANE_MISSING`);
  if (/DEBUG|SIMULATED|DEV(?:ELOPMENT)?/i.test(sourceLane)) throw new Error(`${prefix}_SOURCE_LANE_BLOCKED`);
}

function ensureDistinct(left: Iterable<string>, right: Iterable<string>, code: string): void {
  const leftSet = new Set(Array.from(left).filter(Boolean));
  if (Array.from(right).some((item) => item && leftSet.has(item))) throw new Error(code);
}

async function loadExactFact(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  type: string,
  factId: string,
): Promise<FactRow | null> {
  const q = await db.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE fact_id = $4
        AND (record_json::jsonb->>'type') = $5
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, factId, type],
  );
  return (q.rows?.[0] as FactRow | undefined) ?? null;
}

async function requireBasisRefs(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  inputRefs: Array<{ kind: string; ref_id: string }>,
  required: Record<string, string>,
  prefix: string,
): Promise<Array<{ kind: string; ref_id: string }>> {
  const byKind = new Map<string, Array<{ kind: string; ref_id: string }>>();
  for (const item of inputRefs) {
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  }

  const selected: Array<{ kind: string; ref_id: string }> = [];
  for (const [kind, expectedClassification] of Object.entries(required)) {
    const candidates = byKind.get(kind) ?? [];
    if (candidates.length !== 1) throw new Error(`${prefix}_REF_${candidates.length === 0 ? "MISSING" : "AMBIGUOUS"}:${kind}`);
    const item = candidates[0];
    const row = await loadExactFact(db, tenant, kind, item.ref_id);
    if (!row) throw new Error(`${prefix}_FACT_NOT_FOUND:${kind}`);
    const payload = payloadOf(row);
    if (payload.formal_eligible !== true) throw new Error(`${prefix}_NOT_FORMAL_ELIGIBLE:${kind}`);
    if (text(payload.classification) !== expectedClassification) throw new Error(`${prefix}_CLASSIFICATION_MISMATCH:${kind}`);
    requireAllowedSourceLane(payload, prefix);
    selected.push(item);
  }

  if (new Set(selected.map((item) => item.ref_id)).size !== selected.length) {
    throw new Error(`${prefix}_REF_REUSE_FORBIDDEN`);
  }
  return selected;
}

async function requireAccountingBasisRefs(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  ledgerPayload: Record<string, any>,
): Promise<Array<{ kind: string; ref_id: string }>> {
  const costRefs = refs(ledgerPayload.cost_basis_refs);
  const valueRefs = refs(ledgerPayload.value_basis_refs);
  const policyRef = objectRef(ledgerPayload.accounting_policy_ref);

  if (!costRefs.length) throw new Error("FIELD_MEMORY_ROI_COST_BASIS_REF_MISSING");
  if (!valueRefs.length) throw new Error("FIELD_MEMORY_ROI_VALUE_BASIS_REF_MISSING");
  if (!policyRef) throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_POLICY_REF_MISSING");

  const selected: Array<{ kind: string; ref_id: string }> = [];
  for (const item of costRefs) {
    if (item.kind !== "roi_cost_basis_v1") throw new Error("FIELD_MEMORY_ROI_COST_BASIS_KIND_MISMATCH");
    const row = await loadExactFact(db, tenant, item.kind, item.ref_id);
    if (!row) throw new Error("FIELD_MEMORY_ROI_COST_BASIS_FACT_NOT_FOUND");
    const payload = payloadOf(row);
    if (payload.formal_eligible !== true) throw new Error("FIELD_MEMORY_ROI_COST_BASIS_NOT_FORMAL_ELIGIBLE");
    if (text(payload.classification) !== "ACCOUNTING_SOURCE") throw new Error("FIELD_MEMORY_ROI_COST_BASIS_CLASSIFICATION_MISMATCH");
    requireAllowedSourceLane(payload, "FIELD_MEMORY_ROI_COST_BASIS");
    selected.push(item);
  }
  for (const item of valueRefs) {
    if (item.kind !== "roi_value_basis_v1") throw new Error("FIELD_MEMORY_ROI_VALUE_BASIS_KIND_MISMATCH");
    const row = await loadExactFact(db, tenant, item.kind, item.ref_id);
    if (!row) throw new Error("FIELD_MEMORY_ROI_VALUE_BASIS_FACT_NOT_FOUND");
    const payload = payloadOf(row);
    if (payload.formal_eligible !== true) throw new Error("FIELD_MEMORY_ROI_VALUE_BASIS_NOT_FORMAL_ELIGIBLE");
    if (text(payload.classification) !== "ACCOUNTING_SOURCE") throw new Error("FIELD_MEMORY_ROI_VALUE_BASIS_CLASSIFICATION_MISMATCH");
    requireAllowedSourceLane(payload, "FIELD_MEMORY_ROI_VALUE_BASIS");
    selected.push(item);
  }

  if (policyRef.kind !== "roi_accounting_policy_v1") throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_POLICY_KIND_MISMATCH");
  const policyRow = await loadExactFact(db, tenant, policyRef.kind, policyRef.ref_id);
  if (!policyRow) throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_POLICY_FACT_NOT_FOUND");
  const policyPayload = payloadOf(policyRow);
  if (policyPayload.formal_eligible !== true) throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_POLICY_NOT_FORMAL_ELIGIBLE");
  if (text(policyPayload.classification) !== "POLICY_SOURCE") throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_POLICY_CLASSIFICATION_MISMATCH");
  requireAllowedSourceLane(policyPayload, "FIELD_MEMORY_ROI_ACCOUNTING_POLICY");
  selected.push(policyRef);

  if (new Set(selected.map((item) => item.ref_id)).size !== selected.length) {
    throw new Error("FIELD_MEMORY_ROI_ACCOUNTING_BASIS_REF_REUSE_FORBIDDEN");
  }
  return selected;
}

async function loadCommittedRecord(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  fieldMemoryRecordRef: string,
): Promise<FactRow> {
  const q = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'field_memory_record_v1'
        AND (fact_id = $4 OR (record_json::jsonb#>>'{payload,field_memory_record_id}') = $4)
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 2`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldMemoryRecordRef],
  );
  if (!q.rows?.length) throw new Error("FIELD_MEMORY_RECORD_NOT_FOUND");
  if (q.rows.length !== 1) throw new Error("FIELD_MEMORY_RECORD_AMBIGUOUS");
  return q.rows[0] as FactRow;
}

export async function requireFormalFieldMemoryPromotionAuthorityV1(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  input: {
    field_memory_record_ref: string;
    acceptance_id: string;
    operation_plan_id: string;
  },
): Promise<FormalFieldMemoryPromotionAuthorityV1> {
  const fieldMemoryRecordRef = text(input.field_memory_record_ref);
  if (!fieldMemoryRecordRef) throw new Error("FIELD_MEMORY_RECORD_REF_REQUIRED");

  // Exact identity flows from the already-committed P30 record backwards.
  // Route acceptance_id is only a payload consistency check; it never selects a fact.
  const recordRow = await loadCommittedRecord(db, tenant, fieldMemoryRecordRef);
  const recordPayload = payloadOf(recordRow);
  const acceptanceFactId = text(recordPayload.acceptance_result_fact_id);
  if (!acceptanceFactId) throw new Error("FIELD_MEMORY_RECORD_ACCEPTANCE_FACT_REF_MISSING");

  const acceptanceRow = await loadExactFact(db, tenant, "acceptance_result_v1", acceptanceFactId);
  if (!acceptanceRow) throw new Error("FIELD_MEMORY_ACCEPTANCE_FACT_NOT_FOUND");
  const acceptancePayload = payloadOf(acceptanceRow);
  const actTaskId = text(acceptancePayload.act_task_id ?? acceptancePayload.task_id);
  const fieldId = text(acceptancePayload.field_id);
  if (!actTaskId) throw new Error("FIELD_MEMORY_ACCEPTANCE_TASK_REF_MISSING");
  if (!fieldId) throw new Error("FIELD_MEMORY_ACCEPTANCE_FIELD_REF_MISSING");

  requireSameOperationAndTask(acceptancePayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_ACCEPTANCE");
  if (text(acceptancePayload.acceptance_id) !== input.acceptance_id) throw new Error("FIELD_MEMORY_ACCEPTANCE_ID_MISMATCH");
  if (text(acceptancePayload.field_id) !== fieldId) throw new Error("FIELD_MEMORY_ACCEPTANCE_FIELD_MISMATCH");
  if (text(acceptancePayload.verdict).toUpperCase() !== "PASS") throw new Error("FIELD_MEMORY_ACCEPTANCE_VERDICT_NOT_PASS");
  if (acceptancePayload.formal_acceptance !== true) throw new Error("FIELD_MEMORY_ACCEPTANCE_NOT_FORMAL");
  if (acceptancePayload.formal_evidence_passed !== true) throw new Error("FIELD_MEMORY_ACCEPTANCE_EVIDENCE_NOT_FORMAL");
  if (acceptancePayload.chain_validation_passed !== true) throw new Error("CHAIN_VALIDATION_NOT_PASSED");
  if (acceptancePayload.is_simulated === true) throw new Error("FIELD_MEMORY_ACCEPTANCE_SIMULATED_BLOCKED");

  if (text(recordPayload.record_state) !== "RECORD_COMMITTED") throw new Error("FIELD_MEMORY_RECORD_NOT_COMMITTED");
  requireSameOperationAndTask(recordPayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_RECORD");
  if (text(recordPayload.field_id) !== fieldId) throw new Error("FIELD_MEMORY_RECORD_FIELD_MISMATCH");
  if (text(recordPayload.acceptance_result_fact_id) !== acceptanceRow.fact_id) throw new Error("FIELD_MEMORY_RECORD_ACCEPTANCE_MISMATCH");
  if (!policyRefs(recordPayload).includes("FIELD_MEMORY_RECORD_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_RECORD_POLICY_REF_MISSING");
  if (text(recordPayload.record_scope) === "review_only_no_runtime_use") throw new Error("FIELD_MEMORY_RECORD_REVIEW_ONLY_SCOPE_BLOCKED");
  if (text(recordPayload.record_scope) !== "same_field_only") throw new Error("FIELD_MEMORY_RECORD_SCOPE_NOT_SAME_FIELD_ONLY");

  const candidateFactId = text(recordPayload.field_memory_candidate_fact_id);
  const candidateId = text(recordPayload.field_memory_candidate_id);
  if (!candidateFactId || !candidateId) throw new Error("FIELD_MEMORY_CANDIDATE_REF_MISSING");

  const candidateRow = await loadExactFact(db, tenant, "field_memory_candidate_v1", candidateFactId);
  if (!candidateRow) throw new Error("FIELD_MEMORY_CANDIDATE_NOT_FOUND");
  const candidatePayload = payloadOf(candidateRow);

  if (text(candidatePayload.field_memory_candidate_id) !== candidateId) throw new Error("FIELD_MEMORY_CANDIDATE_ID_MISMATCH");
  if (text(candidatePayload.candidate_state) !== "CANDIDATE_RECORDED") throw new Error("FIELD_MEMORY_CANDIDATE_NOT_RECORDED");
  requireSameOperationAndTask(candidatePayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_CANDIDATE");
  if (text(candidatePayload.acceptance_result_fact_id) !== acceptanceRow.fact_id) throw new Error("FIELD_MEMORY_CANDIDATE_ACCEPTANCE_MISMATCH");
  if (!policyRefs(candidatePayload).includes("FIELD_MEMORY_CANDIDATE_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_CANDIDATE_POLICY_REF_MISSING");

  const roiLedgerFactId = text(candidatePayload.roi_ledger_fact_id);
  const roiBoundaryFactId = text(candidatePayload.roi_boundary_fact_id);
  const outcomeReviewFactId = text(candidatePayload.outcome_review_fact_id);
  if (!roiLedgerFactId || !roiBoundaryFactId || !outcomeReviewFactId) throw new Error("FIELD_MEMORY_P26_P29_SOURCE_CHAIN_REF_MISSING");

  for (const [label, recordRef, candidateRef] of [
    ["ROI_LEDGER", text(recordPayload.roi_ledger_fact_id), roiLedgerFactId],
    ["ROI_BOUNDARY", text(recordPayload.roi_boundary_fact_id), roiBoundaryFactId],
    ["OUTCOME_REVIEW", text(recordPayload.outcome_review_fact_id), outcomeReviewFactId],
    ["ACCEPTANCE", text(recordPayload.acceptance_result_fact_id), acceptanceRow.fact_id],
  ] as const) {
    if (!recordRef || recordRef !== candidateRef) throw new Error(`FIELD_MEMORY_RECORD_CANDIDATE_${label}_CHAIN_MISMATCH`);
  }

  const outcomeRow = await loadExactFact(db, tenant, "outcome_review_v1", outcomeReviewFactId);
  if (!outcomeRow) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_NOT_FOUND");
  const outcomePayload = payloadOf(outcomeRow);
  requireSameOperationAndTask(outcomePayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_OUTCOME_REVIEW");
  if (text(outcomePayload.acceptance_result_fact_id) !== acceptanceRow.fact_id) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_ACCEPTANCE_MISMATCH");
  if (text(outcomePayload.review_state) !== "REVIEWED") throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_NOT_REVIEWED");
  if (text(outcomePayload.source_verdict).toUpperCase() !== "PASS") throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_SOURCE_VERDICT_NOT_PASS");
  if (outcomePayload.formal_acceptance !== true) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_ACCEPTANCE_NOT_FORMAL");
  if (outcomePayload.formal_evidence_passed !== true) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_EVIDENCE_NOT_FORMAL");
  if (!refs(outcomePayload.measurement_refs).length) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_MEASUREMENT_REFS_MISSING");
  if (!Object.keys(record(outcomePayload.comparison_basis)).length) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_COMPARISON_BASIS_MISSING");
  if (!policyRefs(outcomePayload).includes("OUTCOME_ROI_BOUNDARY_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_OUTCOME_REVIEW_POLICY_REF_MISSING");

  const roiBoundaryRow = await loadExactFact(db, tenant, "roi_boundary_v1", roiBoundaryFactId);
  if (!roiBoundaryRow) throw new Error("FIELD_MEMORY_ROI_BOUNDARY_NOT_FOUND");
  const roiBoundaryPayload = payloadOf(roiBoundaryRow);
  requireSameOperationAndTask(roiBoundaryPayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_ROI_BOUNDARY");
  if (text(roiBoundaryPayload.acceptance_result_fact_id) !== acceptanceRow.fact_id) throw new Error("FIELD_MEMORY_ROI_BOUNDARY_ACCEPTANCE_MISMATCH");
  if (text(roiBoundaryPayload.outcome_review_fact_id) !== outcomeReviewFactId) throw new Error("FIELD_MEMORY_ROI_BOUNDARY_OUTCOME_REVIEW_MISMATCH");
  if (roiBoundaryPayload.roi_review_eligible !== true) throw new Error("FIELD_MEMORY_ROI_BOUNDARY_NOT_REVIEW_ELIGIBLE");
  if (text(roiBoundaryPayload.required_future_roi_gate) !== "P28") throw new Error("FIELD_MEMORY_ROI_BOUNDARY_P28_GATE_MISSING");
  if (!policyRefs(roiBoundaryPayload).includes("ROI_BOUNDARY_PAYLOAD_SCHEMA_V0")) throw new Error("FIELD_MEMORY_ROI_BOUNDARY_POLICY_REF_MISSING");

  const roiLedgerRow = await loadExactFact(db, tenant, "roi_ledger_v1", roiLedgerFactId);
  if (!roiLedgerRow) throw new Error("FIELD_MEMORY_ROI_LEDGER_NOT_FOUND");
  const roiLedgerPayload = payloadOf(roiLedgerRow);
  requireSameOperationAndTask(roiLedgerPayload, input.operation_plan_id, actTaskId, "FIELD_MEMORY_ROI_LEDGER");
  if (text(roiLedgerPayload.acceptance_result_fact_id) !== acceptanceRow.fact_id) throw new Error("FIELD_MEMORY_ROI_LEDGER_ACCEPTANCE_MISMATCH");
  if (text(roiLedgerPayload.outcome_review_fact_id) !== outcomeReviewFactId) throw new Error("FIELD_MEMORY_ROI_LEDGER_OUTCOME_REVIEW_MISMATCH");
  if (text(roiLedgerPayload.roi_boundary_fact_id) !== roiBoundaryFactId) throw new Error("FIELD_MEMORY_ROI_LEDGER_BOUNDARY_MISMATCH");
  if (text(roiLedgerPayload.ledger_state) !== "RECORDED") throw new Error("FIELD_MEMORY_ROI_LEDGER_NOT_RECORDED");
  if (!policyRefs(roiLedgerPayload).includes("ROI_LEDGER_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_ROI_LEDGER_POLICY_REF_MISSING");

  if (text(candidatePayload.roi_ledger_id) !== text(roiLedgerPayload.roi_ledger_id)) throw new Error("FIELD_MEMORY_CANDIDATE_ROI_LEDGER_ID_MISMATCH");

  const accountingBasis = await requireAccountingBasisRefs(db, tenant, roiLedgerPayload);
  const candidateBasis = await requireBasisRefs(
    db,
    tenant,
    refs(candidatePayload.candidate_basis_refs),
    REQUIRED_CANDIDATE_BASIS,
    "FIELD_MEMORY_CANDIDATE_BASIS",
  );
  const promotionBasis = await requireBasisRefs(
    db,
    tenant,
    refs(recordPayload.promotion_basis_refs),
    REQUIRED_PROMOTION_BASIS,
    "FIELD_MEMORY_PROMOTION_BASIS",
  );

  const candidateIds = candidateBasis.map((item) => item.ref_id);
  const promotionIds = promotionBasis.map((item) => item.ref_id);
  const accountingIds = accountingBasis.map((item) => item.ref_id);
  const acceptanceEvidenceIds = refs(acceptancePayload.evidence_refs).map((item) => item.ref_id);
  const outcomeMeasurementIds = refs(outcomePayload.measurement_refs).map((item) => item.ref_id);

  ensureDistinct(candidateIds, promotionIds, "FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_CANDIDATE_BASIS");
  ensureDistinct(candidateIds, accountingIds, "FIELD_MEMORY_CANDIDATE_BASIS_MUST_BE_DISTINCT_FROM_ACCOUNTING_BASIS");
  ensureDistinct(promotionIds, accountingIds, "FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_ACCOUNTING_BASIS");
  ensureDistinct(candidateIds, acceptanceEvidenceIds, "FIELD_MEMORY_CANDIDATE_BASIS_MUST_BE_DISTINCT_FROM_ACCEPTANCE_EVIDENCE");
  ensureDistinct(candidateIds, outcomeMeasurementIds, "FIELD_MEMORY_CANDIDATE_BASIS_MUST_BE_DISTINCT_FROM_OUTCOME_MEASUREMENTS");
  ensureDistinct(promotionIds, acceptanceEvidenceIds, "FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_ACCEPTANCE_EVIDENCE");
  ensureDistinct(promotionIds, outcomeMeasurementIds, "FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_OUTCOME_MEASUREMENTS");
  ensureDistinct(accountingIds, acceptanceEvidenceIds, "FIELD_MEMORY_ACCOUNTING_BASIS_MUST_BE_DISTINCT_FROM_ACCEPTANCE_EVIDENCE");
  ensureDistinct(accountingIds, outcomeMeasurementIds, "FIELD_MEMORY_ACCOUNTING_BASIS_MUST_BE_DISTINCT_FROM_OUTCOME_MEASUREMENTS");

  const reuseBoundary = record(recordPayload.reuse_boundary);
  const reuseBoundaryRef = text(reuseBoundary.ref_id ?? reuseBoundary.ref);
  const reusePromotionRef = promotionBasis.find((item) => item.kind === "reuse_boundary_review_v1")?.ref_id ?? "";
  if (!reuseBoundaryRef || reuseBoundaryRef !== reusePromotionRef) throw new Error("FIELD_MEMORY_RECORD_REUSE_BOUNDARY_REF_MISMATCH");
  if (text(reuseBoundary.scope) !== "same_field_only") throw new Error("FIELD_MEMORY_RECORD_REUSE_BOUNDARY_SCOPE_MISMATCH");

  return {
    acceptance_fact_id: acceptanceRow.fact_id,
    acceptance_payload: acceptancePayload,
    acceptance_occurred_at: acceptanceRow.occurred_at == null ? null : String(acceptanceRow.occurred_at),
    act_task_id: actTaskId,
    field_id: fieldId,
    field_memory_record_fact_id: recordRow.fact_id,
    field_memory_record_id: text(recordPayload.field_memory_record_id) || recordRow.fact_id,
    field_memory_candidate_fact_id: candidateRow.fact_id,
    field_memory_candidate_id: candidateId,
    source_chain_refs: [
      { kind: "acceptance_result_v1", ref_id: acceptanceRow.fact_id },
      { kind: "outcome_review_v1", ref_id: outcomeRow.fact_id },
      { kind: "roi_boundary_v1", ref_id: roiBoundaryRow.fact_id },
      { kind: "roi_ledger_v1", ref_id: roiLedgerRow.fact_id },
    ],
    accounting_basis_refs: accountingBasis,
    candidate_basis_refs: candidateBasis,
    promotion_basis_refs: promotionBasis,
  };
}
