import type { Pool } from "pg";
import { projectProgramStateFromFacts, type ProgramStateProjectionFactRow, type ProgramStateProgressV1, type ProgramAcceptanceResultV1 } from "./program_state_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramPortfolioPriorityV1 = "LOW" | "MEDIUM" | "HIGH";

export type ProgramPortfolioItemV1 = {
  program_id: string;
  field_id: string;
  season_id: string;
  crop_code: string;
  status: string;

  current_stage: string;
  latest_acceptance_result?: ProgramAcceptanceResultV1;
  execution_reliability?: ProgramStateProgressV1;
  water_management?: ProgramStateProgressV1;

  next_action_hint?: {
    kind: string;
    priority: ProgramPortfolioPriorityV1;
    reason: string;
  };

  pending_operation_plan_id?: string;
  pending_act_task_id?: string;

  updated_at_ts: number;
};

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function toPriority(value: string): ProgramPortfolioPriorityV1 {
  const raw = value.trim().toUpperCase();
  if (raw === "HIGH") return "HIGH";
  if (raw === "LOW") return "LOW";
  return "MEDIUM";
}

export function projectProgramPortfolioFromFacts(rows: ProgramStateProjectionFactRow[]): ProgramPortfolioItemV1[] {
  return projectProgramStateFromFacts(rows).map((item) => ({
    program_id: item.program_id,
    field_id: item.field_id,
    season_id: item.season_id,
    crop_code: item.crop_code,
    status: item.status,
    current_stage: item.current_stage,
    latest_acceptance_result: item.latest_acceptance_result,
    execution_reliability: item.current_goal_progress.execution_reliability,
    water_management: item.current_goal_progress.water_management,
    next_action_hint: item.next_action_hint
      ? {
          kind: item.next_action_hint.kind,
          priority: toPriority(item.next_action_hint.priority),
          reason: item.next_action_hint.reason
        }
      : undefined,
    pending_operation_plan_id: str(item.latest_operation_plan_id) || undefined,
    pending_act_task_id: str(item.latest_act_task_id) || undefined,
    updated_at_ts: item.updated_at_ts
  }));
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN (
      'field_program_v1',
      'decision_recommendation_v1',
      'operation_plan_v1',
      'ao_act_task_v0',
      'acceptance_result_v1'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

export async function projectProgramPortfolioV1(pool: Pool, tenant: TenantTriple): Promise<ProgramPortfolioItemV1[]> {
  const rows = await loadFacts(pool, tenant);
  return projectProgramPortfolioFromFacts(rows);
}
