import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type ReceiptLookupInput = TenantTriple & {
  task_id: string;
  receipt_id?: string | null;
};

type ReceiptRow = {
  fact_id: string;
  occurred_at: string;
  record_json: any;
};

type CreateAsExecutedInput = TenantTriple & {
  task_id: string;
  receipt_id?: string | null;
};

type AsExecutedRow = {
  as_executed_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
  prescription_id: string | null;
  field_id: string | null;
  executor: any;
  planned: any;
  executed: any;
  deviation: any;
  evidence_refs: any;
  receipt_refs: any;
  log_refs: any;
  confidence: any;
  created_at: string;
  updated_at: string;
};

function parseJsonMaybe(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function normalizeReceiptStatus(payload: any): "CONFIRMED" | "FAILED" | "INSUFFICIENT_RECEIPT" {
  const status = String(payload?.status ?? "").trim().toLowerCase();
  const hasException = payload?.exception && typeof payload.exception === "object";
  if (status === "executed") return "CONFIRMED";
  if (status === "not_executed") return "FAILED";
  if (hasException && status !== "executed") return "FAILED";
  return "INSUFFICIENT_RECEIPT";
}

function dedupeArray(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const item of values) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildEvidenceRefs(payload: any): unknown[] {
  const refs = Array.isArray(payload?.evidence_refs) ? payload.evidence_refs : [];
  const artifacts = Array.isArray(payload?.evidence_artifact_ids)
    ? payload.evidence_artifact_ids.map((id: unknown) => ({ artifact_id: id }))
    : [];
  const metas = Array.isArray(payload?.evidence_meta) ? payload.evidence_meta : [];
  return dedupeArray([...refs, ...artifacts, ...metas]);
}

function toAsExecutedPayload(params: {
  input: CreateAsExecutedInput;
  receipt: ReceiptRow;
  resolvedReceiptId: string;
}): Omit<AsExecutedRow, "as_executed_id" | "created_at" | "updated_at"> {
  const payload = params.receipt.record_json?.payload ?? {};
  const status = normalizeReceiptStatus(payload);
  const taskId = String(payload?.act_task_id ?? payload?.command_id ?? params.input.task_id ?? "").trim();

  return {
    tenant_id: params.input.tenant_id,
    project_id: params.input.project_id,
    group_id: params.input.group_id,
    task_id: taskId,
    receipt_id: params.resolvedReceiptId,
    prescription_id: payload?.prescription_id ? String(payload.prescription_id) : null,
    field_id: payload?.field_id ? String(payload.field_id) : null,
    executor: {
      type: String(payload?.executor_id?.kind ?? "unknown"),
      id: String(payload?.executor_id?.id ?? ""),
    },
    planned: {
      source: taskId ? "task" : "unknown",
      task_id: taskId || null,
    },
    executed: {
      status,
      receipt_status: payload?.status ?? null,
      started_at: payload?.execution_time?.start_ts ?? null,
      completed_at: payload?.execution_time?.end_ts ?? null,
      resource_usage: payload?.resource_usage ?? {},
      labor: payload?.labor ?? {},
      observed_parameters: payload?.observed_parameters ?? {},
      exception: payload?.exception ?? null,
    },
    deviation: {},
    evidence_refs: buildEvidenceRefs(payload),
    receipt_refs: [{ fact_id: params.receipt.fact_id }],
    log_refs: Array.isArray(payload?.logs_refs) ? payload.logs_refs : [],
    confidence: {},
  };
}

function mapAsExecutedRow(row: any): AsExecutedRow {
  return {
    as_executed_id: String(row.as_executed_id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
    task_id: String(row.task_id ?? ""),
    receipt_id: String(row.receipt_id ?? ""),
    prescription_id: row.prescription_id == null ? null : String(row.prescription_id),
    field_id: row.field_id == null ? null : String(row.field_id),
    executor: parseJsonMaybe(row.executor) ?? {},
    planned: parseJsonMaybe(row.planned) ?? {},
    executed: parseJsonMaybe(row.executed) ?? {},
    deviation: parseJsonMaybe(row.deviation) ?? {},
    evidence_refs: parseJsonMaybe(row.evidence_refs) ?? [],
    receipt_refs: parseJsonMaybe(row.receipt_refs) ?? [],
    log_refs: parseJsonMaybe(row.log_refs) ?? [],
    confidence: parseJsonMaybe(row.confidence) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function resolveReceiptFact(pool: Pool, input: ReceiptLookupInput): Promise<ReceiptRow | null> {
  const receiptId = String(input.receipt_id ?? "").trim();

  if (receiptId) {
    const q = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (
            fact_id = $4
            OR (record_json::jsonb#>>'{payload,receipt_id}') = $4
          )
        ORDER BY CASE WHEN fact_id = $4 THEN 0 ELSE 1 END, occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [input.tenant_id, input.project_id, input.group_id, receiptId]
    );
    if (q.rows?.[0]) return mapReceiptRow(q.rows[0]);
  }

  const qByTask = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          (record_json::jsonb#>>'{payload,act_task_id}') = $4
          OR (record_json::jsonb#>>'{payload,command_id}') = $4
          OR fact_id = $4
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id]
  );

  return qByTask.rows?.[0] ? mapReceiptRow(qByTask.rows[0]) : null;
}

function mapReceiptRow(row: any): ReceiptRow {
  return {
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseJsonMaybe(row.record_json) ?? {},
  };
}

async function findByUniqueKey(pool: Pool, input: {
  tenant_id: string;
  project_id: string;
  group_id: string;
  task_id: string;
  receipt_id: string;
}): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
        AND receipt_id = $5
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id, input.receipt_id]
  );
  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

export async function createAsExecutedFromReceipt(pool: Pool, input: CreateAsExecutedInput): Promise<{
  as_executed: AsExecutedRow;
  idempotent: boolean;
}> {
  const receipt = await resolveReceiptFact(pool, input);
  if (!receipt) {
    throw new Error("RECEIPT_NOT_FOUND");
  }

  const payload = receipt.record_json?.payload ?? {};
  const taskId = String(payload?.act_task_id ?? payload?.command_id ?? input.task_id ?? "").trim();
  if (!taskId) {
    throw new Error("INVALID_RECEIPT_TASK_ID");
  }

  const resolvedReceiptId = String(payload?.receipt_id ?? input.receipt_id ?? receipt.fact_id).trim() || receipt.fact_id;
  const existing = await findByUniqueKey(pool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    task_id: taskId,
    receipt_id: resolvedReceiptId,
  });
  if (existing) return { as_executed: existing, idempotent: true };

  const mapped = toAsExecutedPayload({ input: { ...input, task_id: taskId }, receipt, resolvedReceiptId });
  const asExecutedId = randomUUID();
  const inserted = await pool.query(
    `INSERT INTO as_executed_record_v1 (
      as_executed_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      task_id,
      receipt_id,
      prescription_id,
      executor,
      planned,
      executed,
      deviation,
      evidence_refs,
      receipt_refs,
      log_refs,
      confidence
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb
    )
    ON CONFLICT (tenant_id, project_id, group_id, task_id, receipt_id) DO NOTHING
    RETURNING *`,
    [
      asExecutedId,
      mapped.tenant_id,
      mapped.project_id,
      mapped.group_id,
      mapped.field_id,
      mapped.task_id,
      mapped.receipt_id,
      mapped.prescription_id,
      JSON.stringify(mapped.executor),
      JSON.stringify(mapped.planned),
      JSON.stringify(mapped.executed),
      JSON.stringify(mapped.deviation),
      JSON.stringify(mapped.evidence_refs),
      JSON.stringify(mapped.receipt_refs),
      JSON.stringify(mapped.log_refs),
      JSON.stringify(mapped.confidence),
    ]
  );

  if (inserted.rows?.[0]) {
    return {
      as_executed: mapAsExecutedRow(inserted.rows[0]),
      idempotent: false,
    };
  }

  const afterConflict = await findByUniqueKey(pool, {
    tenant_id: mapped.tenant_id,
    project_id: mapped.project_id,
    group_id: mapped.group_id,
    task_id: mapped.task_id,
    receipt_id: mapped.receipt_id,
  });
  if (!afterConflict) throw new Error("AS_EXECUTED_WRITE_FAILED");
  return { as_executed: afterConflict, idempotent: true };
}

export async function getAsExecutedById(pool: Pool, input: TenantTriple & { as_executed_id: string }): Promise<AsExecutedRow | null> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id]
  );
  return q.rows?.[0] ? mapAsExecutedRow(q.rows[0]) : null;
}

export async function listAsExecutedByTask(pool: Pool, input: TenantTriple & { task_id: string }): Promise<AsExecutedRow[]> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND task_id = $4
      ORDER BY created_at DESC, as_executed_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.task_id]
  );
  return (q.rows ?? []).map(mapAsExecutedRow);
}

export async function listAsExecutedByReceipt(pool: Pool, input: TenantTriple & { receipt_id: string }): Promise<AsExecutedRow[]> {
  const q = await pool.query(
    `SELECT *
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND receipt_id = $4
      ORDER BY created_at DESC, as_executed_id DESC`,
    [input.tenant_id, input.project_id, input.group_id, input.receipt_id]
  );
  return (q.rows ?? []).map(mapAsExecutedRow);
}
