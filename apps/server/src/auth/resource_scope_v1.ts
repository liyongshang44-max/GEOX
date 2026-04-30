import type { Pool } from "pg";
import type { TenantTripleV1 } from "./tenant_scope_v1.js";

type Scope = TenantTripleV1 & { field_id: string | null };

export async function getPrescriptionScopeV1(pool: Pool, input: TenantTripleV1 & { prescription_id: string }): Promise<Scope | null> {
  const r = await pool.query(
    `SELECT tenant_id, project_id, group_id, field_id FROM prescription_contract_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND prescription_id=$4 LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.prescription_id],
  );
  return (r.rows?.[0] as Scope) ?? null;
}

export async function getActionTaskScopeV1(pool: Pool, input: TenantTripleV1 & { act_task_id: string }): Promise<Scope | null> {
  const r = await pool.query(
    `SELECT tenant_id, project_id, group_id, field_id FROM ao_act_task_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND act_task_id=$4 LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.act_task_id],
  );
  return (r.rows?.[0] as Scope) ?? null;
}

export async function getAsExecutedScopeV1(pool: Pool, input: TenantTripleV1 & { as_executed_id: string }): Promise<Scope | null> {
  const r = await pool.query(
    `SELECT tenant_id, project_id, group_id, field_id FROM as_executed_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND as_executed_id=$4 LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id],
  );
  return (r.rows?.[0] as Scope) ?? null;
}

export async function getApprovalScopeV1(pool: Pool, input: TenantTripleV1 & { approval_request_id: string }): Promise<Scope | null> {
  const r = await pool.query(
    `SELECT tenant_id, project_id, group_id, field_id FROM approval_request_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND approval_request_id=$4 LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, input.approval_request_id],
  );
  return (r.rows?.[0] as Scope) ?? null;
}
