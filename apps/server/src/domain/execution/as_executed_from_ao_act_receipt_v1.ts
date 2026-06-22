// apps/server/src/domain/execution/as_executed_from_ao_act_receipt_v1.ts

import type { Pool } from "pg";
import { createAsExecutedFromReceipt } from "./as_executed_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
export type CreateAsExecutedFromAoActReceiptV1Input = TenantTriple & {
  field_id: string;
  zone_id: string | null;
  operation_plan_id: string;
  act_task_id: string;
  receipt_id: string;
  idempotency_key?: string | null;
};

export type H42Status =
  | "AS_EXECUTED_RECORDED"
  | "REJECTED_RECEIPT_NOT_FOUND"
  | "REJECTED_RECEIPT_NOT_V1"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_OPERATION_PLAN_NOT_FOUND"
  | "REJECTED_OPERATION_PLAN_RECEIPT_MISMATCH"
  | "REJECTED_RECEIPT_NOT_H41"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type CreateAsExecutedFromAoActReceiptV1Result = {
  ok: boolean;
  status: H42Status;
  duplicate?: boolean;
  as_executed_created: boolean;
  as_applied_created: boolean;
  acceptance_created: false;
  evidence_artifact_created: false;
  roi_created: false;
  field_memory_created: false;
  no_acceptance_created: true;
  no_effect_judgement: true;
  as_executed?: unknown;
  as_applied?: unknown;
};

function text(v: unknown): string { return String(v ?? "").trim(); }
function hasItems(v: unknown): boolean { return Array.isArray(v) && v.length >= 1; }
function sameNullable(a: unknown, b: unknown): boolean { return text(a) === text(b); }

function invalidInput(input: CreateAsExecutedFromAoActReceiptV1Input): boolean {
  return !text(input.tenant_id) || !text(input.project_id) || !text(input.group_id) || !text(input.field_id)
    || !text(input.operation_plan_id) || !text(input.act_task_id) || !text(input.receipt_id);
}

function validateReceiptPayload(input: CreateAsExecutedFromAoActReceiptV1Input, factId: string, type: string, payload: any): H42Status | null {
  if (type !== "ao_act_receipt_v1") return "REJECTED_RECEIPT_NOT_V1";
  if (text(payload?.tenant_id) !== input.tenant_id || text(payload?.project_id) !== input.project_id || text(payload?.group_id) !== input.group_id
    || text(payload?.field_id) !== input.field_id || !sameNullable(payload?.zone_id, input.zone_id) || text(payload?.operation_plan_id) !== input.operation_plan_id
    || text(payload?.act_task_id) !== input.act_task_id) return "REJECTED_SCOPE_MISMATCH";
  const receiptMatches = text(payload?.ao_act_receipt_id) === input.receipt_id || factId === input.receipt_id;
  if (!receiptMatches) return "REJECTED_RECEIPT_NOT_FOUND";
  const meta = payload?.meta ?? {};
  if (meta?.source !== "AO_ACT_TASK_V0" || meta?.no_acceptance_created !== true || meta?.no_effect_judgement !== true
    || meta?.no_roi_created !== true || meta?.no_field_memory_created !== true) return "REJECTED_RECEIPT_NOT_H41";
  if (!hasItems(payload?.evidence_refs) || !hasItems(payload?.logs_refs)) return "REJECTED_RECEIPT_NOT_H41";
  return null;
}

export async function createAsExecutedFromAoActReceiptV1(pool: Pool, input: CreateAsExecutedFromAoActReceiptV1Input): Promise<CreateAsExecutedFromAoActReceiptV1Result> {
  if (invalidInput(input)) return rejected("REJECTED_INVALID_INPUT");

  const receipt = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE ((record_json::jsonb#>>'{payload,ao_act_receipt_id}') = $7 OR fact_id = $7)
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.field_id, input.zone_id, input.act_task_id, input.receipt_id],
  );
  if (!receipt.rows?.length) return rejected("REJECTED_RECEIPT_NOT_FOUND");
  const receiptRow = receipt.rows[0];
  const record = receiptRow.record_json ?? {};
  const payload = record?.payload ?? {};
  const receiptError = validateReceiptPayload(input, text(receiptRow.fact_id), text(record?.type), payload);
  if (receiptError) return rejected(receiptError);

  const index = await pool.query(
    `SELECT receipt_fact_id
       FROM operation_plan_index_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
        AND COALESCE(zone_id,'')=COALESCE($5,'') AND operation_plan_id=$6 AND act_task_id=$7
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.field_id, input.zone_id, input.operation_plan_id, input.act_task_id],
  );
  if (!index.rows?.length) return rejected("REJECTED_OPERATION_PLAN_NOT_FOUND");
  if (text(index.rows[0].receipt_fact_id) !== text(receiptRow.fact_id)) return rejected("REJECTED_OPERATION_PLAN_RECEIPT_MISMATCH");

  const result = await createAsExecutedFromReceipt(pool, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    task_id: input.act_task_id,
    receipt_id: input.receipt_id,
  });
  if (result.idempotent) return { ...base("REJECTED_DUPLICATE"), duplicate: true };
  return { ...base("AS_EXECUTED_RECORDED"), as_executed_created: true, as_applied_created: true, as_executed: result.as_executed, as_applied: result.as_applied };
}

function base(status: H42Status): CreateAsExecutedFromAoActReceiptV1Result {
  return { ok: status === "AS_EXECUTED_RECORDED", status, as_executed_created: false, as_applied_created: false, acceptance_created: false, evidence_artifact_created: false, roi_created: false, field_memory_created: false, no_acceptance_created: true, no_effect_judgement: true };
}
function rejected(status: H42Status): CreateAsExecutedFromAoActReceiptV1Result { return base(status); }
