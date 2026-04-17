import type { Pool } from "pg";
import { projectProgramPortfolioV1, type ProgramPortfolioItemV1 } from "../../projections/program_portfolio_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FactRow = { occurred_at: string; record_json: any };

type TaskWindowV1 = {
  act_task_id: string;
  operation_plan_id?: string;
  program_id?: string;
  field_id?: string;
  device_id?: string;
  start_ts: number;
  end_ts: number;
};

export type SchedulingConflictV1 = {
  kind: "DEVICE_CONFLICT" | "FIELD_CONFLICT" | "PROGRAM_INTENT_CONFLICT";
  severity: "LOW" | "MEDIUM" | "HIGH";
  target_ref: string;
  related_program_ids: string[];
  related_act_task_ids?: string[];
  reason: string;
};

function str(v: any): string {
  return String(v ?? "").trim();
}

function toMs(v: any): number {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;
  const d = Date.parse(String(v ?? ""));
  return Number.isFinite(d) ? d : 0;
}

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function overlaps(a: TaskWindowV1, b: TaskWindowV1): boolean {
  return a.start_ts <= b.end_ts && b.start_ts <= a.end_ts;
}

function uniq(xs: string[]): string[] {
  return Array.from(new Set(xs.filter(Boolean)));
}

function inferIntent(kindRaw: string): "IRRIGATE" | "PAUSE_IRRIGATION" | "OTHER" {
  const kind = kindRaw.toUpperCase();
  if (!kind) return "OTHER";
  if (kind.includes("PAUSE") || kind.includes("CHECK_DEVICE_PATH_OR_BINDING") || kind.includes("HOLD")) return "PAUSE_IRRIGATION";
  if (kind.includes("IRRIGAT") || kind.includes("WATER")) return "IRRIGATE";
  return "OTHER";
}

function detectResourceConflicts(
  kind: "DEVICE_CONFLICT" | "FIELD_CONFLICT",
  targetRef: string,
  tasks: TaskWindowV1[]
): SchedulingConflictV1[] {
  const candidates = tasks.filter((t) => (kind === "DEVICE_CONFLICT" ? t.device_id === targetRef : t.field_id === targetRef));
  const overlapTaskIds = new Set<string>();
  const overlapProgramIds = new Set<string>();

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (!overlaps(a, b)) continue;
      overlapTaskIds.add(a.act_task_id);
      overlapTaskIds.add(b.act_task_id);
      if (a.program_id) overlapProgramIds.add(a.program_id);
      if (b.program_id) overlapProgramIds.add(b.program_id);
    }
  }

  if (overlapTaskIds.size < 2) return [];
  return [{
    kind,
    severity: "HIGH",
    target_ref: targetRef,
    related_program_ids: Array.from(overlapProgramIds),
    related_act_task_ids: Array.from(overlapTaskIds),
    reason: `${targetRef} has overlapping task windows (${overlapTaskIds.size} tasks)`
  }];
}

function extractTaskWindows(rows: FactRow[]): TaskWindowV1[] {
  const tasks = rows
    .map((row) => ({ ...row, record_json: parseRecordJson(row.record_json) ?? row.record_json }))
    .filter((row) => row.record_json?.type === "ao_act_task_v0")
    .map((row) => {
      const p = row.record_json?.payload ?? {};
      const startTs = toMs(p?.time_window?.start_ts) || toMs(row.occurred_at);
      const endTs = toMs(p?.time_window?.end_ts) || startTs;
      return {
        act_task_id: str(p.act_task_id),
        operation_plan_id: str(p.operation_plan_id) || undefined,
        program_id: str(p.program_id) || undefined,
        field_id: str(p.field_id) || undefined,
        device_id: str(p?.meta?.device_id ?? p.device_id) || undefined,
        start_ts: Math.min(startTs, endTs),
        end_ts: Math.max(startTs, endTs)
      } satisfies TaskWindowV1;
    })
    .filter((x) => x.act_task_id && (x.device_id || x.field_id));

  return tasks;
}

export function detectSchedulingConflictsFromData(tasks: TaskWindowV1[], portfolio: ProgramPortfolioItemV1[]): SchedulingConflictV1[] {
  const conflicts: SchedulingConflictV1[] = [];

  const deviceIds = uniq(tasks.map((x) => x.device_id ?? ""));
  for (const deviceId of deviceIds) conflicts.push(...detectResourceConflicts("DEVICE_CONFLICT", deviceId, tasks));

  const fieldIds = uniq(tasks.map((x) => x.field_id ?? ""));
  for (const fieldId of fieldIds) conflicts.push(...detectResourceConflicts("FIELD_CONFLICT", fieldId, tasks));

  const programsByField = new Map<string, ProgramPortfolioItemV1[]>();
  for (const item of portfolio) {
    const list = programsByField.get(item.field_id) ?? [];
    list.push(item);
    programsByField.set(item.field_id, list);
  }

  for (const [fieldId, items] of programsByField.entries()) {
    const irrigate = items.filter((x) => inferIntent(x.next_action_hint?.kind ?? "") === "IRRIGATE");
    const pause = items.filter((x) => inferIntent(x.next_action_hint?.kind ?? "") === "PAUSE_IRRIGATION");
    if (!irrigate.length || !pause.length) continue;

    conflicts.push({
      kind: "PROGRAM_INTENT_CONFLICT",
      severity: "MEDIUM",
      target_ref: fieldId,
      related_program_ids: uniq([...irrigate.map((x) => x.program_id), ...pause.map((x) => x.program_id)]),
      reason: `conflicting hints on field ${fieldId}: ${uniq(items.map((x) => x.next_action_hint?.kind ?? "UNKNOWN")).join(",")}`
    });
  }

  return conflicts;
}

async function loadTaskFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT occurred_at, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({ occurred_at: String(row.occurred_at), record_json: row.record_json }));
}

export async function detectSchedulingConflictsV1(pool: Pool, tenant: TenantTriple): Promise<SchedulingConflictV1[]> {
  const [taskFacts, portfolio] = await Promise.all([
    loadTaskFacts(pool, tenant),
    projectProgramPortfolioV1(pool, tenant)
  ]);
  const tasks = extractTaskWindows(taskFacts);
  return detectSchedulingConflictsFromData(tasks, portfolio);
}
