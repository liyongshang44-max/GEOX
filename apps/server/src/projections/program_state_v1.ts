import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramStateProgressV1 = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type ProgramAcceptanceResultV1 = "PASSED" | "FAILED" | "INCONCLUSIVE";

export type ProgramStateV1 = {
  program_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;

  field_id: string;
  season_id: string;
  crop_code: string;
  status: string;

  current_stage: string;
  current_goal_progress: {
    water_management?: ProgramStateProgressV1;
    execution_reliability?: ProgramStateProgressV1;
    acceptance_quality?: ProgramStateProgressV1;
  };

  latest_recommendation_id?: string;
  latest_operation_plan_id?: string;
  latest_act_task_id?: string;
  latest_acceptance_result?: ProgramAcceptanceResultV1;

  acceptance_summary: {
    passed: number;
    failed: number;
    inconclusive: number;
    last_score?: number;
  };

  spatial_summary: {
    last_in_field_ratio?: number;
    last_track_point_count?: number;
    last_track_points_in_field?: number;
  };

  next_action_hint?: {
    kind: string;
    reason: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  };

  updated_at_ts: number;
};

export type ProgramStateProjectionFactRow = FactRow;

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

function toMs(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function toNum(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeAcceptanceResult(value: any): ProgramAcceptanceResultV1 | undefined {
  const raw = str(value).toUpperCase();
  if (raw === "PASSED" || raw === "PASS") return "PASSED";
  if (raw === "FAILED" || raw === "FAIL") return "FAILED";
  if (raw === "INCONCLUSIVE") return "INCONCLUSIVE";
  return undefined;
}

function progressFromRatio(ratio?: number): ProgramStateProgressV1 | undefined {
  if (ratio == null || !Number.isFinite(ratio)) return undefined;
  if (ratio >= 0.8) return "ON_TRACK";
  if (ratio >= 0.5) return "AT_RISK";
  return "OFF_TRACK";
}

function pickLatest<T extends FactRow>(rows: T[]): T | undefined {
  return rows.reduce<T | undefined>((best, row) => (!best || toMs(row.occurred_at) >= toMs(best.occurred_at) ? row : best), undefined);
}

function deriveCurrentStage(status: string, hasRecommendation: boolean, hasPlan: boolean, hasTask: boolean): string {
  const s = status.toUpperCase();
  if (["PAUSED", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(s)) return s;
  if (!hasRecommendation) return "SETUP";
  if (!hasPlan) return "PLANNING";
  if (!hasTask) return "READY_TO_EXECUTE";
  return "EXECUTING";
}

function deriveNextActionHint(input: {
  latestAcceptanceResult?: ProgramAcceptanceResultV1;
  latestRecommendationId?: string;
  latestOperationPlanId?: string;
  latestActTaskId?: string;
}): ProgramStateV1["next_action_hint"] | undefined {
  if (input.latestAcceptanceResult === "FAILED") {
    return { kind: "REVIEW_FAILURE", reason: "Latest acceptance result failed.", priority: "HIGH" };
  }
  if (!input.latestRecommendationId) {
    return { kind: "GENERATE_RECOMMENDATION", reason: "Program has no recommendation yet.", priority: "MEDIUM" };
  }
  if (!input.latestOperationPlanId) {
    return { kind: "BUILD_OPERATION_PLAN", reason: "Recommendation has not been translated into an operation plan.", priority: "MEDIUM" };
  }
  if (!input.latestActTaskId) {
    return { kind: "DISPATCH_TASK", reason: "Operation plan is present but no act task has been issued.", priority: "HIGH" };
  }
  if (input.latestAcceptanceResult === "INCONCLUSIVE") {
    return { kind: "COLLECT_EVIDENCE", reason: "Acceptance is inconclusive and needs more evidence.", priority: "MEDIUM" };
  }
  return undefined;
}

export function projectProgramStateFromFacts(rows: ProgramStateProjectionFactRow[]): ProgramStateV1[] {
  const facts = rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));
  const programs = facts.filter((r) => r.record_json?.type === "field_program_v1");
  const recommendations = facts.filter((r) => r.record_json?.type === "decision_recommendation_v1");
  const operationPlans = facts.filter((r) => r.record_json?.type === "operation_plan_v1");
  const actTasks = facts.filter((r) => r.record_json?.type === "ao_act_task_v0");
  const acceptances = facts.filter((r) => r.record_json?.type === "acceptance_result_v1");

  const latestProgramById = new Map<string, FactRow>();
  for (const row of programs) {
    const programId = str(row.record_json?.payload?.program_id);
    if (!programId) continue;
    const prev = latestProgramById.get(programId);
    if (!prev || toMs(row.occurred_at) >= toMs(prev.occurred_at)) latestProgramById.set(programId, row);
  }

  const out: ProgramStateV1[] = [];

  for (const [programId, programRow] of latestProgramById.entries()) {
    const pp = programRow.record_json?.payload ?? {};
    const fieldId = str(pp.field_id);
    const seasonId = str(pp.season_id);

    const recommendationRows = recommendations.filter((r) => {
      const p = r.record_json?.payload ?? {};
      const recProgramId = str(p.program_id);
      if (recProgramId) return recProgramId === programId;
      if (str(p.field_id) !== fieldId) return false;
      if (seasonId && str(p.season_id) && str(p.season_id) !== seasonId) return false;
      return true;
    });
    const latestRecommendation = pickLatest(recommendationRows);
    const latestRecommendationId = str(latestRecommendation?.record_json?.payload?.recommendation_id) || undefined;

    const operationPlanRows = operationPlans.filter((r) => {
      const p = r.record_json?.payload ?? {};
      const opProgramId = str(p.program_id);
      if (opProgramId) return opProgramId === programId;
      const targetField = str(p.target?.ref || p.field_id);
      if (targetField && targetField !== fieldId) return false;
      const recId = str(p.recommendation_id);
      if (latestRecommendationId && recId && recId !== latestRecommendationId) return false;
      return true;
    });
    const latestOperationPlan = pickLatest(operationPlanRows);
    const latestOperationPlanId = str(latestOperationPlan?.record_json?.payload?.operation_plan_id) || undefined;

    const actTaskRows = actTasks.filter((r) => {
      const p = r.record_json?.payload ?? {};
      const taskProgramId = str(p.program_id);
      if (taskProgramId) return taskProgramId === programId;
      const taskOperationPlanId = str(p.operation_plan_id);
      if (latestOperationPlanId && taskOperationPlanId) return taskOperationPlanId === latestOperationPlanId;
      return fieldId && str(p.field_id) === fieldId;
    });
    const latestActTask = pickLatest(actTaskRows);
    const latestActTaskId = str(latestActTask?.record_json?.payload?.act_task_id) || undefined;

    const acceptanceRows = acceptances.filter((r) => {
      const p = r.record_json?.payload ?? {};
      if (str(p.program_id) === programId) return true;
      if (latestActTaskId && str(p.act_task_id) === latestActTaskId) return true;
      return latestOperationPlanId && str(p.operation_plan_id) === latestOperationPlanId;
    });

    const latestAcceptance = pickLatest(acceptanceRows);
    const latestAcceptanceResult = normalizeAcceptanceResult(
      latestAcceptance?.record_json?.payload?.result ?? latestAcceptance?.record_json?.payload?.verdict
    );

    const acceptanceSummary = acceptanceRows.reduce(
      (acc, row) => {
        const payload = row.record_json?.payload ?? {};
        const result = normalizeAcceptanceResult(payload.result ?? payload.verdict);
        if (result === "PASSED") acc.passed += 1;
        else if (result === "FAILED") acc.failed += 1;
        else acc.inconclusive += 1;
        return acc;
      },
      { passed: 0, failed: 0, inconclusive: 0 }
    );

    const latestAcceptancePayload = latestAcceptance?.record_json?.payload ?? {};
    const acceptanceLastScore = toNum(latestAcceptancePayload.score);
    const metrics = latestAcceptancePayload.metrics ?? {};
    const inFieldRatio = toNum(metrics.in_field_ratio);
    const trackPointCount = toNum(metrics.track_point_count);
    const trackPointsInField = toNum(metrics.track_points_in_field);

    const totalAcceptance = acceptanceSummary.passed + acceptanceSummary.failed + acceptanceSummary.inconclusive;
    const executionRatio = totalAcceptance > 0 ? acceptanceSummary.passed / totalAcceptance : undefined;

    const updatedAtTs = Math.max(
      toMs(programRow.occurred_at),
      latestRecommendation ? toMs(latestRecommendation.occurred_at) : 0,
      latestOperationPlan ? toMs(latestOperationPlan.occurred_at) : 0,
      latestActTask ? toMs(latestActTask.occurred_at) : 0,
      latestAcceptance ? toMs(latestAcceptance.occurred_at) : 0
    );

    out.push({
      program_id: programId,
      tenant_id: str(pp.tenant_id),
      project_id: str(pp.project_id),
      group_id: str(pp.group_id),
      field_id: fieldId,
      season_id: seasonId,
      crop_code: str(pp.crop_code),
      status: str(pp.status),
      current_stage: deriveCurrentStage(str(pp.status), Boolean(latestRecommendationId), Boolean(latestOperationPlanId), Boolean(latestActTaskId)),
      current_goal_progress: {
        water_management: progressFromRatio(inFieldRatio),
        execution_reliability: progressFromRatio(executionRatio),
        acceptance_quality: progressFromRatio(acceptanceLastScore)
      },
      latest_recommendation_id: latestRecommendationId,
      latest_operation_plan_id: latestOperationPlanId,
      latest_act_task_id: latestActTaskId,
      latest_acceptance_result: latestAcceptanceResult,
      acceptance_summary: {
        ...acceptanceSummary,
        last_score: acceptanceLastScore
      },
      spatial_summary: {
        last_in_field_ratio: inFieldRatio,
        last_track_point_count: trackPointCount,
        last_track_points_in_field: trackPointsInField
      },
      next_action_hint: deriveNextActionHint({
        latestAcceptanceResult,
        latestRecommendationId,
        latestOperationPlanId,
        latestActTaskId
      }),
      updated_at_ts: updatedAtTs
    });
  }

  return out.sort((a, b) => b.updated_at_ts - a.updated_at_ts);
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

export async function projectProgramStateV1(pool: Pool, tenant: TenantTriple): Promise<ProgramStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectProgramStateFromFacts(facts);
}
