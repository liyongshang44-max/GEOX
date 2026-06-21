// apps/server/src/projections/operation_plan_index_v1.ts
import type { Pool, PoolClient } from "pg";

export type OperationPlanIndexRecordV1 = {
  operation_plan_id: string; tenant_id: string; project_id: string; group_id: string;
  field_id?: string | null; zone_id?: string | null; spatial_scope_json?: unknown | null; season_id?: string | null; program_id?: string | null;
  recommendation_id?: string | null; recommendation_fact_id?: string | null; approval_request_id?: string | null; approval_decision?: string | null; approval_decision_fact_id?: string | null;
  status: string; act_task_id?: string | null; receipt_fact_id?: string | null; source_fact_id?: string | null; created_ts: number; updated_ts: number;
};

export async function ensureOperationPlanIndexV1(pool: Pool | PoolClient): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.operation_plan_index_v1 (operation_plan_id text PRIMARY KEY, tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text, zone_id text, spatial_scope_json jsonb, season_id text, program_id text, recommendation_id text, recommendation_fact_id text, approval_request_id text, approval_decision text, approval_decision_fact_id text, status text NOT NULL, act_task_id text, receipt_fact_id text, source_fact_id text, created_ts bigint NOT NULL, updated_ts bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_scope_latest ON public.operation_plan_index_v1 (tenant_id, project_id, group_id, field_id, updated_ts DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_approval_request ON public.operation_plan_index_v1 (approval_request_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_approval_decision_fact ON public.operation_plan_index_v1 (approval_decision_fact_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_recommendation ON public.operation_plan_index_v1 (recommendation_id)`);
}

export function mapOperationPlanIndexRowV1(row: any): OperationPlanIndexRecordV1 {
  return { operation_plan_id: String(row.operation_plan_id), tenant_id: String(row.tenant_id), project_id: String(row.project_id), group_id: String(row.group_id), field_id: row.field_id ?? null, zone_id: row.zone_id ?? null, spatial_scope_json: row.spatial_scope_json ?? null, season_id: row.season_id ?? null, program_id: row.program_id ?? null, recommendation_id: row.recommendation_id ?? null, recommendation_fact_id: row.recommendation_fact_id ?? null, approval_request_id: row.approval_request_id ?? null, approval_decision: row.approval_decision ?? null, approval_decision_fact_id: row.approval_decision_fact_id ?? null, status: String(row.status), act_task_id: row.act_task_id ?? null, receipt_fact_id: row.receipt_fact_id ?? null, source_fact_id: row.source_fact_id ?? null, created_ts: Number(row.created_ts), updated_ts: Number(row.updated_ts) };
}

export async function upsertOperationPlanIndexV1(pool: Pool | PoolClient, record: OperationPlanIndexRecordV1): Promise<OperationPlanIndexRecordV1> {
  await ensureOperationPlanIndexV1(pool);
  const res = await pool.query(`INSERT INTO public.operation_plan_index_v1 (operation_plan_id, tenant_id, project_id, group_id, field_id, zone_id, spatial_scope_json, season_id, program_id, recommendation_id, recommendation_fact_id, approval_request_id, approval_decision, approval_decision_fact_id, status, act_task_id, receipt_fact_id, source_fact_id, created_ts, updated_ts) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT (operation_plan_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, field_id=EXCLUDED.field_id, zone_id=EXCLUDED.zone_id, spatial_scope_json=EXCLUDED.spatial_scope_json, season_id=EXCLUDED.season_id, program_id=EXCLUDED.program_id, recommendation_id=EXCLUDED.recommendation_id, recommendation_fact_id=EXCLUDED.recommendation_fact_id, approval_request_id=EXCLUDED.approval_request_id, approval_decision=EXCLUDED.approval_decision, approval_decision_fact_id=EXCLUDED.approval_decision_fact_id, status=EXCLUDED.status, act_task_id=EXCLUDED.act_task_id, receipt_fact_id=EXCLUDED.receipt_fact_id, source_fact_id=EXCLUDED.source_fact_id, created_ts=EXCLUDED.created_ts, updated_ts=EXCLUDED.updated_ts, updated_at=now() RETURNING *`, [record.operation_plan_id, record.tenant_id, record.project_id, record.group_id, record.field_id ?? null, record.zone_id ?? null, JSON.stringify(record.spatial_scope_json ?? null), record.season_id ?? null, record.program_id ?? null, record.recommendation_id ?? null, record.recommendation_fact_id ?? null, record.approval_request_id ?? null, record.approval_decision ?? null, record.approval_decision_fact_id ?? null, record.status, record.act_task_id ?? null, record.receipt_fact_id ?? null, record.source_fact_id ?? null, record.created_ts, record.updated_ts]);
  return mapOperationPlanIndexRowV1(res.rows[0]);
}
