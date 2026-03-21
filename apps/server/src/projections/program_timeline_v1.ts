import type { Pool } from "pg";
import { deriveProgramFeedbackV1 } from "../domain/program/program_feedback_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type ProgramTimelineEventTypeV1 =
  | "program_created"
  | "recommendation_created"
  | "operation_plan_created"
  | "task_dispatched"
  | "receipt_received"
  | "acceptance_evaluated"
  | "spatial_acceptance_updated"
  | "next_action_hint_updated";

export type ProgramTimelineEventV1 = {
  ts: number;
  type: ProgramTimelineEventTypeV1;
  fact_id?: string;
  payload: Record<string, any>;
};

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function str(v: any): string {
  return String(v ?? "").trim();
}

function toMsFromOccurred(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function eventTs(payload: any, occurred_at: string): number {
  const candidates = [payload?.created_ts, payload?.evaluated_at_ts, payload?.updated_ts, payload?.ts_ms];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return toMsFromOccurred(occurred_at);
}

function pickLatestProgramFact(rows: FactRow[], program_id: string): FactRow | undefined {
  let best: FactRow | undefined;
  for (const row of rows) {
    const p = row.record_json?.payload ?? {};
    if (str(p.program_id) !== program_id) continue;
    if (!best || toMsFromOccurred(row.occurred_at) >= toMsFromOccurred(best.occurred_at)) best = row;
  }
  return best;
}

export function projectProgramTimelineFromFacts(input: {
  program_id: string;
  rows: FactRow[];
}): ProgramTimelineEventV1[] {
  const program_id = str(input.program_id);
  const facts = input.rows.map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }));
  const programFact = pickLatestProgramFact(facts.filter((r) => r.record_json?.type === "field_program_v1"), program_id);
  if (!programFact) return [];

  const programPayload = programFact.record_json?.payload ?? {};
  const field_id = str(programPayload.field_id);
  const season_id = str(programPayload.season_id);

  const recommendationFacts = facts.filter((r) => {
    if (r.record_json?.type !== "decision_recommendation_v1") return false;
    const p = r.record_json?.payload ?? {};
    if (str(p.program_id) === program_id) return true;
    if (str(p.field_id) !== field_id) return false;
    if (season_id && str(p.season_id) && str(p.season_id) !== season_id) return false;
    return true;
  });
  const operationPlanFacts = facts.filter((r) => {
    if (r.record_json?.type !== "operation_plan_v1") return false;
    const p = r.record_json?.payload ?? {};
    if (str(p.program_id) === program_id) return true;
    const targetField = str(p.target?.ref || p.field_id);
    return targetField === field_id;
  });
  const taskFacts = facts.filter((r) => r.record_json?.type === "ao_act_task_v0" && str(r.record_json?.payload?.program_id) === program_id);
  const taskIds = new Set(taskFacts.map((r) => str(r.record_json?.payload?.act_task_id)).filter(Boolean));
  const acceptanceFacts = facts.filter((r) => {
    if (r.record_json?.type !== "acceptance_result_v1") return false;
    const p = r.record_json?.payload ?? {};
    if (str(p.program_id) === program_id) return true;
    const taskId = str(p.act_task_id);
    return !!taskId && taskIds.has(taskId);
  });
  const receiptFacts = facts.filter((r) => {
    const t = str(r.record_json?.type);
    if (t !== "ao_act_receipt_v1" && t !== "ao_act_receipt_v0") return false;
    const taskId = str(r.record_json?.payload?.act_task_id);
    return !!taskId && taskIds.has(taskId);
  });

  const events: ProgramTimelineEventV1[] = [];

  events.push({
    ts: eventTs(programPayload, programFact.occurred_at),
    type: "program_created",
    fact_id: programFact.fact_id,
    payload: { program_id, field_id, season_id, status: str(programPayload.status), crop_code: str(programPayload.crop_code) }
  });

  for (const row of recommendationFacts) {
    const p = row.record_json?.payload ?? {};
    events.push({
      ts: eventTs(p, row.occurred_at),
      type: "recommendation_created",
      fact_id: row.fact_id,
      payload: { recommendation_id: str(p.recommendation_id), recommendation_type: str(p.recommendation_type), status: str(p.status) }
    });
  }

  for (const row of operationPlanFacts) {
    const p = row.record_json?.payload ?? {};
    events.push({
      ts: eventTs(p, row.occurred_at),
      type: "operation_plan_created",
      fact_id: row.fact_id,
      payload: { operation_plan_id: str(p.operation_plan_id), status: str(p.status), recommendation_id: str(p.recommendation_id) }
    });
  }

  for (const row of taskFacts) {
    const p = row.record_json?.payload ?? {};
    events.push({
      ts: eventTs(p, row.occurred_at),
      type: "task_dispatched",
      fact_id: row.fact_id,
      payload: { act_task_id: str(p.act_task_id), operation_plan_id: str(p.operation_plan_id), action_type: str(p.action_type) }
    });
  }

  for (const row of receiptFacts) {
    const p = row.record_json?.payload ?? {};
    events.push({
      ts: eventTs(p, row.occurred_at),
      type: "receipt_received",
      fact_id: row.fact_id,
      payload: { act_task_id: str(p.act_task_id), receipt_id: str(p.receipt_id), result_status: str(p.result_status ?? p.status) }
    });
  }

  for (const row of acceptanceFacts) {
    const p = row.record_json?.payload ?? {};
    events.push({
      ts: eventTs(p, row.occurred_at),
      type: "acceptance_evaluated",
      fact_id: row.fact_id,
      payload: { result: str(p.result ?? p.verdict), score: p.score ?? null, act_task_id: str(p.act_task_id) }
    });

    const metrics = p.metrics ?? {};
    if (metrics && (metrics.in_field_ratio != null || metrics.track_point_count != null || metrics.track_points_in_field != null)) {
      events.push({
        ts: eventTs(p, row.occurred_at),
        type: "spatial_acceptance_updated",
        fact_id: row.fact_id,
        payload: {
          in_field_ratio: Number(metrics.in_field_ratio ?? NaN),
          track_point_count: Number(metrics.track_point_count ?? NaN),
          track_points_in_field: Number(metrics.track_points_in_field ?? NaN)
        }
      });
    }
  }

  const sortedAcceptancePayloads = acceptanceFacts
    .map((r) => ({ ...(r.record_json?.payload ?? {}), __ts: eventTs(r.record_json?.payload ?? {}, r.occurred_at) }))
    .sort((a, b) => Number(a.__ts) - Number(b.__ts));
  let lastHintKind = "";
  for (let i = 0; i < sortedAcceptancePayloads.length; i += 1) {
    const history = sortedAcceptancePayloads.slice(0, i + 1);
    const feedback = deriveProgramFeedbackV1({
      program: programPayload,
      acceptanceResults: history,
      trajectories: history.map((x) => x.metrics ?? {}),
      recentTasks: taskFacts.map((x) => x.record_json?.payload ?? {})
    });
    const currentKind = str(feedback.next_action_hint?.kind);
    if (currentKind && currentKind !== lastHintKind) {
      events.push({
        ts: Number(history[history.length - 1]?.__ts ?? 0),
        type: "next_action_hint_updated",
        payload: feedback.next_action_hint ?? {}
      });
      lastHintKind = currentKind;
    }
  }

  return events.sort((a, b) => a.ts - b.ts);
}

async function loadFacts(pool: Pool, tenant: TenantTriple, program_id: string): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN (
      'field_program_v1',
      'decision_recommendation_v1',
      'operation_plan_v1',
      'ao_act_task_v0',
      'ao_act_receipt_v1',
      'ao_act_receipt_v0',
      'acceptance_result_v1'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND (
        (record_json::jsonb#>>'{payload,program_id}') = $4
        OR (record_json::jsonb->>'type') IN ('decision_recommendation_v1', 'operation_plan_v1')
      )
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, program_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: str(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
}

export async function projectProgramTimelineV1(pool: Pool, tenant: TenantTriple, program_id: string): Promise<ProgramTimelineEventV1[]> {
  const rows = await loadFacts(pool, tenant, program_id);
  return projectProgramTimelineFromFacts({ program_id, rows });
}
