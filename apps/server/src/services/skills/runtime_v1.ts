import type { Pool } from "pg";

import { appendSkillRunFact, digestJson } from "../../domain/skill_registry/facts.js";
import { projectSkillRegistryReadV1 } from "../../projections/skill_registry_read_v1.js";

export type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export type SkillRuntimeExecuteInput = TenantTriple & {
  skill_id: string;
  version: string;
  category?: string;
  bind_target?: string;
  field_id?: string | null;
  device_id?: string | null;
  operation_id?: string | null;
  operation_plan_id?: string | null;
  input?: unknown;
};

type SkillRunReadRow = {
  fact_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  status: string | null;
  result_status: string | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
};

function normalizeRunCategory(value: unknown): "AGRONOMY" | "OPS" | "CONTROL" | "OBSERVABILITY" | "DEVICE" | "ACCEPTANCE" {
  const key = String(value ?? "OPS").trim().toUpperCase();
  if (["AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY", "DEVICE", "ACCEPTANCE"].includes(key)) return key as any;
  return "OPS";
}

async function findSkillRunByRunId(pool: Pool, tenant: TenantTriple, skillRunId: string): Promise<SkillRunReadRow | null> {
  await projectSkillRegistryReadV1(pool, tenant);
  const rowByPayload = await pool.query<SkillRunReadRow>(
    `SELECT *
       FROM skill_registry_read_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
        AND fact_type = 'skill_run_v1'
        AND payload_json->>'run_id' = $4
      ORDER BY updated_at_ts_ms DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, skillRunId],
  );
  if (rowByPayload.rows?.[0]) return rowByPayload.rows[0];

  const rowByFact = await pool.query<SkillRunReadRow>(
    `SELECT *
       FROM skill_registry_read_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
        AND fact_type = 'skill_run_v1'
        AND fact_id = $4
      ORDER BY updated_at_ts_ms DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, skillRunId],
  );
  return rowByFact.rows?.[0] ?? null;
}

export async function executeSkillRuntimeV1(pool: Pool, input: SkillRuntimeExecuteInput): Promise<{ fact_id: string; occurred_at: string; run_id: string }> {
  const payload = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    skill_id: input.skill_id,
    version: input.version,
    category: normalizeRunCategory(input.category),
    status: "ACTIVE" as const,
    result_status: "PENDING" as const,
    trigger_stage: "before_dispatch" as const,
    scope_type: "TENANT" as const,
    rollout_mode: "DIRECT" as const,
    bind_target: input.bind_target?.trim() || "runtime",
    operation_id: input.operation_id ?? null,
    operation_plan_id: input.operation_plan_id ?? null,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    input_digest: digestJson(input.input ?? {}),
    output_digest: digestJson({ status: "PENDING" }),
  };
  const appended = await appendSkillRunFact(pool, payload);
  return { fact_id: appended.fact_id, occurred_at: appended.occurred_at, run_id: appended.payload.run_id };
}

export async function cancelSkillRuntimeV1(pool: Pool, tenant: TenantTriple, skillRunId: string): Promise<{ fact_id: string; occurred_at: string; run_id: string } | null> {
  const row = await findSkillRunByRunId(pool, tenant, skillRunId);
  if (!row) return null;

  const payload = row.payload_json ?? {};
  const appended = await appendSkillRunFact(pool, {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    run_id: String(payload.run_id ?? skillRunId),
    skill_id: String(row.skill_id ?? payload.skill_id ?? "unknown_skill"),
    version: String(row.version ?? payload.version ?? "v1"),
    category: normalizeRunCategory(row.category ?? payload.category),
    status: "ACTIVE",
    result_status: "FAILED",
    trigger_stage: "before_dispatch",
    scope_type: "TENANT",
    rollout_mode: "DIRECT",
    bind_target: String(payload.bind_target ?? "runtime"),
    operation_id: payload.operation_id ?? null,
    operation_plan_id: payload.operation_plan_id ?? null,
    field_id: payload.field_id ?? null,
    device_id: payload.device_id ?? null,
    input_digest: String(row.payload_json?.input_digest ?? row.payload_json?.input_hash ?? row.payload_json?.inputDigest ?? digestJson({})),
    output_digest: digestJson({ status: "CANCELLED" }),
    error_code: "CANCELLED_BY_USER",
    duration_ms: Number.isFinite(Number(payload.duration_ms)) ? Number(payload.duration_ms) : 0,
  });

  return { fact_id: appended.fact_id, occurred_at: appended.occurred_at, run_id: appended.payload.run_id };
}

export async function getSkillRunRuntimeStatusV1(pool: Pool, tenant: TenantTriple, skillRunId: string): Promise<any | null> {
  const row = await findSkillRunByRunId(pool, tenant, skillRunId);
  if (!row) return null;
  const payload = row.payload_json ?? {};
  return {
    skill_run_id: String(payload.run_id ?? row.fact_id),
    skill_id: String(row.skill_id),
    version: String(row.version),
    status: String(row.result_status ?? row.status ?? payload.result_status ?? "FAILED").toUpperCase(),
    occurred_at: row.occurred_at,
    updated_at_ts_ms: row.updated_at_ts_ms,
  };
}

export async function getSkillRunRuntimeResultV1(pool: Pool, tenant: TenantTriple, skillRunId: string): Promise<any | null> {
  const row = await findSkillRunByRunId(pool, tenant, skillRunId);
  if (!row) return null;
  const payload = row.payload_json ?? {};
  return {
    skill_run_id: String(payload.run_id ?? row.fact_id),
    result_status: String(row.result_status ?? payload.result_status ?? "FAILED"),
    output_digest: String(row.payload_json?.output_digest ?? row.payload_json?.output_hash ?? row.payload_json?.outputDigest ?? ""),
    output: payload.output ?? null,
    error_code: payload.error_code ?? null,
    duration_ms: Number.isFinite(Number(payload.duration_ms)) ? Number(payload.duration_ms) : null,
    occurred_at: row.occurred_at,
  };
}

export async function getSkillRuntimeHealthV1(pool: Pool): Promise<any> {
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return {
    ok: dbOk,
    service: "skill_runtime_v1",
    dependencies: {
      db: { ok: dbOk, error: dbError },
      queue: { ok: true, mode: "in_process" },
    },
  };
}

export async function getSkillRunRuntimeV1(pool: Pool, tenant: TenantTriple, skillRunId: string): Promise<any | null> {
  const row = await findSkillRunByRunId(pool, tenant, skillRunId);
  if (!row) return null;
  return row;
}
