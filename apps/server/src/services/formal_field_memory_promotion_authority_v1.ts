import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

export type FormalFieldMemoryTenantTripleV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FormalFieldMemoryPromotionAuthorityV1 = {
  field_memory_record_fact_id: string;
  field_memory_record_id: string;
  field_memory_candidate_fact_id: string;
  field_memory_candidate_id: string;
  candidate_basis_refs: Array<{ kind: string; ref_id: string }>;
  promotion_basis_refs: Array<{ kind: string; ref_id: string }>;
};

type FactRow = {
  fact_id: string;
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
    .map((item) => record(item))
    .map((item) => ({ kind: text(item.kind), ref_id: text(item.ref_id ?? item.ref) }))
    .filter((item) => item.kind && item.ref_id);
}

function policyRefs(payload: Record<string, any>): string[] {
  const meta = record(payload.meta);
  return Array.isArray(meta.policy_refs) ? meta.policy_refs.map(text).filter(Boolean) : [];
}

function matchesAcceptanceRef(payload: Record<string, any>, acceptanceFactId: string, acceptanceId: string): boolean {
  const ref = text(payload.acceptance_result_fact_id ?? payload.acceptance_id);
  return ref === acceptanceFactId || ref === acceptanceId;
}

async function loadExactFact(
  db: DbConn,
  tenant: FormalFieldMemoryTenantTripleV1,
  type: string,
  factId: string,
): Promise<FactRow | null> {
  const q = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
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
    selected.push(item);
  }

  if (new Set(selected.map((item) => item.ref_id)).size !== selected.length) {
    throw new Error(`${prefix}_REF_REUSE_FORBIDDEN`);
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
    acceptance_fact_id: string;
    acceptance_id: string;
    operation_plan_id: string;
  },
): Promise<FormalFieldMemoryPromotionAuthorityV1> {
  const fieldMemoryRecordRef = text(input.field_memory_record_ref);
  if (!fieldMemoryRecordRef) throw new Error("FIELD_MEMORY_RECORD_REF_REQUIRED");

  const recordRow = await loadCommittedRecord(db, tenant, fieldMemoryRecordRef);
  const recordPayload = payloadOf(recordRow);

  if (text(recordPayload.record_state) !== "RECORD_COMMITTED") throw new Error("FIELD_MEMORY_RECORD_NOT_COMMITTED");
  if (text(recordPayload.operation_plan_id) !== input.operation_plan_id) throw new Error("FIELD_MEMORY_RECORD_OPERATION_MISMATCH");
  if (!matchesAcceptanceRef(recordPayload, input.acceptance_fact_id, input.acceptance_id)) throw new Error("FIELD_MEMORY_RECORD_ACCEPTANCE_MISMATCH");
  if (!policyRefs(recordPayload).includes("FIELD_MEMORY_RECORD_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_RECORD_POLICY_REF_MISSING");

  const candidateFactId = text(recordPayload.field_memory_candidate_fact_id);
  const candidateId = text(recordPayload.field_memory_candidate_id);
  if (!candidateFactId || !candidateId) throw new Error("FIELD_MEMORY_CANDIDATE_REF_MISSING");

  const candidateRow = await loadExactFact(db, tenant, "field_memory_candidate_v1", candidateFactId);
  if (!candidateRow) throw new Error("FIELD_MEMORY_CANDIDATE_NOT_FOUND");
  const candidatePayload = payloadOf(candidateRow);

  if (text(candidatePayload.field_memory_candidate_id) !== candidateId) throw new Error("FIELD_MEMORY_CANDIDATE_ID_MISMATCH");
  if (text(candidatePayload.candidate_state) !== "CANDIDATE_RECORDED") throw new Error("FIELD_MEMORY_CANDIDATE_NOT_RECORDED");
  if (text(candidatePayload.operation_plan_id) !== input.operation_plan_id) throw new Error("FIELD_MEMORY_CANDIDATE_OPERATION_MISMATCH");
  if (!matchesAcceptanceRef(candidatePayload, input.acceptance_fact_id, input.acceptance_id)) throw new Error("FIELD_MEMORY_CANDIDATE_ACCEPTANCE_MISMATCH");
  if (!policyRefs(candidatePayload).includes("FIELD_MEMORY_CANDIDATE_GATE_CONTRACT_V0")) throw new Error("FIELD_MEMORY_CANDIDATE_POLICY_REF_MISSING");

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

  const candidateIds = new Set(candidateBasis.map((item) => item.ref_id));
  if (promotionBasis.some((item) => candidateIds.has(item.ref_id))) {
    throw new Error("FIELD_MEMORY_PROMOTION_BASIS_MUST_BE_DISTINCT_FROM_CANDIDATE_BASIS");
  }

  return {
    field_memory_record_fact_id: recordRow.fact_id,
    field_memory_record_id: text(recordPayload.field_memory_record_id) || recordRow.fact_id,
    field_memory_candidate_fact_id: candidateRow.fact_id,
    field_memory_candidate_id: candidateId,
    candidate_basis_refs: candidateBasis,
    promotion_basis_refs: promotionBasis,
  };
}
