import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

export type ManualExecutionQualityDimension = "team" | "executor";

export type ManualExecutionQualityQuery = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  dimension: ManualExecutionQualityDimension;
  field_id?: string | null;
  action_type?: string | null;
  from_ts_ms: number;
  to_ts_ms: number;
};

export type ManualExecutionQualityItem = {
  dimension: ManualExecutionQualityDimension;
  dimension_id: string;
  dimension_name: string;
  total_assignments: number;
  submitted_count: number;
  on_time_count: number;
  on_time_rate: number | null;
  first_pass_count: number;
  first_pass_rate: number | null;
  receipt_complete_count: number;
  receipt_completeness_rate: number | null;
  abnormal_count: number;
  closed_loop_count: number;
  avg_abnormal_closed_loop_ms: number | null;
  overdue_consecutive_streak: number;
  missing_receipt_rate: number | null;
  alerts: string[];
};

export type ManualExecutionQualitySnapshot = {
  generated_at_ms: number;
  query: ManualExecutionQualityQuery;
  threshold: {
    overdue_streak_n: number;
    missing_receipt_rate: number;
  };
  items: ManualExecutionQualityItem[];
  alerts: Array<{ level: "WARN" | "CRITICAL"; dimension: ManualExecutionQualityDimension; dimension_id: string; message: string }>;
};

const DEFAULT_THRESHOLD = {
  overdue_streak_n: 3,
  missing_receipt_rate: 0.2,
};

let ensurePromise: Promise<void> | null = null;

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try { return JSON.parse(v); } catch { return null; }
}

function toRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

function toMs(iso: string | null | undefined): number | null {
  const ts = Date.parse(String(iso ?? ""));
  return Number.isFinite(ts) ? ts : null;
}

function isReceiptComplete(payload: any): boolean {
  const execution = payload?.execution_time ?? payload?.execution ?? {};
  const hasWindow = Number.isFinite(Number(execution?.start_ts)) && Number.isFinite(Number(execution?.end_ts));
  const observed = payload?.observed_parameters;
  const hasObserved = !!(observed && typeof observed === "object" && Object.keys(observed).length > 0);
  const logsRefs = payload?.logs_refs;
  const hasLogs = Array.isArray(logsRefs) && logsRefs.length > 0;
  return hasWindow && hasObserved && hasLogs;
}

export async function ensureManualExecutionQualityProjectionV1(db: DbConn): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS manual_execution_quality_projection_v1 (
          tenant_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          group_id TEXT NOT NULL,
          dimension TEXT NOT NULL,
          dimension_id TEXT NOT NULL,
          dimension_name TEXT NOT NULL,
          field_id TEXT NULL,
          action_type TEXT NULL,
          from_ts_ms BIGINT NOT NULL,
          to_ts_ms BIGINT NOT NULL,
          total_assignments BIGINT NOT NULL,
          submitted_count BIGINT NOT NULL,
          on_time_count BIGINT NOT NULL,
          on_time_rate DOUBLE PRECISION NULL,
          first_pass_count BIGINT NOT NULL,
          first_pass_rate DOUBLE PRECISION NULL,
          receipt_complete_count BIGINT NOT NULL,
          receipt_completeness_rate DOUBLE PRECISION NULL,
          abnormal_count BIGINT NOT NULL,
          closed_loop_count BIGINT NOT NULL,
          avg_abnormal_closed_loop_ms BIGINT NULL,
          overdue_consecutive_streak INTEGER NOT NULL,
          missing_receipt_rate DOUBLE PRECISION NULL,
          alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, project_id, group_id, dimension, dimension_id, from_ts_ms, to_ts_ms, field_id, action_type)
        )
      `);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

export async function projectManualExecutionQualityV1(db: DbConn, query: ManualExecutionQualityQuery): Promise<ManualExecutionQualitySnapshot> {
  await ensureManualExecutionQualityProjectionV1(db);
  const assignmentQ = await db.query(
    `SELECT
      a.assignment_id,
      a.act_task_id,
      a.executor_id,
      a.status,
      a.assigned_at,
      a.arrive_deadline_ts,
      h.team_id,
      h.display_name AS executor_name,
      t.record_json AS task_record_json
    FROM work_assignment_index_v1 a
    LEFT JOIN human_executor_index_v1 h
      ON h.tenant_id = a.tenant_id
     AND h.executor_id = a.executor_id
    LEFT JOIN LATERAL (
      SELECT (f.record_json::jsonb) AS record_json
      FROM facts f
      WHERE (f.record_json::jsonb->>'type') = 'ao_act_task_v0'
        AND (f.record_json::jsonb#>>'{payload,tenant_id}') = a.tenant_id
        AND (f.record_json::jsonb#>>'{payload,project_id}') = $2
        AND (f.record_json::jsonb#>>'{payload,group_id}') = $3
        AND (f.record_json::jsonb#>>'{payload,act_task_id}') = a.act_task_id
      ORDER BY f.occurred_at DESC, f.fact_id DESC
      LIMIT 1
    ) t ON TRUE
    WHERE a.tenant_id = $1
      AND a.assigned_at >= to_timestamp($4::double precision / 1000.0)
      AND a.assigned_at <= to_timestamp($5::double precision / 1000.0)`,
    [query.tenant_id, query.project_id, query.group_id, query.from_ts_ms, query.to_ts_ms]
  );

  const assignments = (assignmentQ.rows ?? []).map((row: any) => {
    const taskPayload = parseJsonMaybe(row.task_record_json)?.payload ?? {};
    return {
      assignment_id: String(row.assignment_id ?? ""),
      act_task_id: String(row.act_task_id ?? ""),
      executor_id: String(row.executor_id ?? ""),
      status: String(row.status ?? "").toUpperCase(),
      assigned_at_ms: toMs(row.assigned_at),
      arrive_deadline_ms: toMs(row.arrive_deadline_ts),
      team_id: row.team_id ? String(row.team_id) : "UNASSIGNED_TEAM",
      executor_name: row.executor_name ? String(row.executor_name) : String(row.executor_id ?? "-"),
      field_id: taskPayload?.field_id ? String(taskPayload.field_id) : null,
      action_type: taskPayload?.action_type ? String(taskPayload.action_type).toUpperCase() : null,
    };
  }).filter((x) => {
    if (query.field_id && x.field_id !== query.field_id) return false;
    if (query.action_type && x.action_type !== String(query.action_type).toUpperCase()) return false;
    return !!x.assignment_id;
  });

  const assignmentIds = assignments.map((x) => x.assignment_id);
  const actTaskIds = Array.from(new Set(assignments.map((x) => x.act_task_id).filter(Boolean)));
  if (assignments.length < 1) {
    return { generated_at_ms: Date.now(), query, threshold: DEFAULT_THRESHOLD, items: [], alerts: [] };
  }

  const [auditQ, receiptQ, taskAssignmentCountQ] = await Promise.all([
    db.query(
      `SELECT assignment_id, status, occurred_at
       FROM work_assignment_audit_v1
       WHERE tenant_id = $1
         AND assignment_id = ANY($2::text[])
       ORDER BY occurred_at ASC`,
      [query.tenant_id, assignmentIds]
    ),
    db.query(
      `SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
          (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
          (record_json::jsonb) AS record_json
       FROM facts
       WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (record_json::jsonb#>>'{payload,project_id}') = $2
         AND (record_json::jsonb#>>'{payload,group_id}') = $3
         AND (record_json::jsonb#>>'{payload,act_task_id}') = ANY($4::text[])
       ORDER BY (record_json::jsonb#>>'{payload,act_task_id}') ASC, occurred_at DESC, fact_id DESC`,
      [query.tenant_id, query.project_id, query.group_id, actTaskIds]
    ),
    db.query(
      `SELECT act_task_id, COUNT(*)::bigint AS assignment_count
       FROM work_assignment_index_v1
       WHERE tenant_id = $1
         AND act_task_id = ANY($2::text[])
       GROUP BY act_task_id`,
      [query.tenant_id, actTaskIds]
    ),
  ]);

  const submitAtByAssignment = new Map<string, number>();
  const abnormalAtByAssignment = new Map<string, number>();
  for (const row of auditQ.rows ?? []) {
    const assignmentId = String(row.assignment_id ?? "");
    const status = String(row.status ?? "").toUpperCase();
    const occurredMs = toMs(row.occurred_at);
    if (!assignmentId || !occurredMs) continue;
    if (status === "SUBMITTED" && !submitAtByAssignment.has(assignmentId)) submitAtByAssignment.set(assignmentId, occurredMs);
    if ((status === "EXPIRED" || status === "CANCELLED") && !abnormalAtByAssignment.has(assignmentId)) abnormalAtByAssignment.set(assignmentId, occurredMs);
  }

  const receiptByTaskId = new Map<string, any>();
  for (const row of receiptQ.rows ?? []) {
    const taskId = String(row.act_task_id ?? "").trim();
    if (taskId) receiptByTaskId.set(taskId, parseJsonMaybe(row.record_json)?.payload ?? {});
  }

  const taskAssignCount = new Map<string, number>();
  for (const row of taskAssignmentCountQ.rows ?? []) taskAssignCount.set(String(row.act_task_id ?? ""), Number(row.assignment_count ?? 0));

  const groups = new Map<string, { item: ManualExecutionQualityItem; overdueFlags: Array<{ ts: number; overdue: boolean }> }>();
  const now = Date.now();
  for (const assignment of assignments) {
    const dimensionId = query.dimension === "team" ? assignment.team_id : assignment.executor_id;
    const dimensionName = query.dimension === "team" ? assignment.team_id : assignment.executor_name;
    const key = `${query.dimension}:${dimensionId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        item: {
          dimension: query.dimension,
          dimension_id: dimensionId,
          dimension_name: dimensionName,
          total_assignments: 0,
          submitted_count: 0,
          on_time_count: 0,
          on_time_rate: null,
          first_pass_count: 0,
          first_pass_rate: null,
          receipt_complete_count: 0,
          receipt_completeness_rate: null,
          abnormal_count: 0,
          closed_loop_count: 0,
          avg_abnormal_closed_loop_ms: null,
          overdue_consecutive_streak: 0,
          missing_receipt_rate: null,
          alerts: [],
        },
        overdueFlags: [],
      });
    }
    const holder = groups.get(key)!;
    const item = holder.item;
    item.total_assignments += 1;

    const submitMs = submitAtByAssignment.get(assignment.assignment_id) ?? null;
    const isSubmitted = assignment.status === "SUBMITTED" || !!submitMs;
    if (isSubmitted) item.submitted_count += 1;

    const receiptPayload = receiptByTaskId.get(assignment.act_task_id) ?? null;
    if (receiptPayload && isReceiptComplete(receiptPayload)) item.receipt_complete_count += 1;

    const assignCount = taskAssignCount.get(assignment.act_task_id) ?? 1;
    if (isSubmitted && assignCount <= 1) item.first_pass_count += 1;

    const overdue = !!(assignment.arrive_deadline_ms && submitMs && submitMs > assignment.arrive_deadline_ms)
      || assignment.status === "EXPIRED"
      || (assignment.status === "CANCELLED" && !!abnormalAtByAssignment.get(assignment.assignment_id));
    if (isSubmitted && !overdue) item.on_time_count += 1;

    if (overdue) {
      item.abnormal_count += 1;
      const anomalyTs = abnormalAtByAssignment.get(assignment.assignment_id) ?? assignment.arrive_deadline_ms ?? assignment.assigned_at_ms ?? now;
      if (submitMs && submitMs >= anomalyTs) {
        const prev = Number(item.avg_abnormal_closed_loop_ms ?? 0);
        const nextCnt = item.closed_loop_count + 1;
        item.avg_abnormal_closed_loop_ms = Math.round((prev * item.closed_loop_count + (submitMs - anomalyTs)) / nextCnt);
        item.closed_loop_count = nextCnt;
      }
    }

    holder.overdueFlags.push({ ts: assignment.assigned_at_ms ?? now, overdue });
  }

  const output: ManualExecutionQualityItem[] = [];
  const alerts: ManualExecutionQualitySnapshot["alerts"] = [];

  for (const { item, overdueFlags } of groups.values()) {
    item.on_time_rate = toRate(item.on_time_count, item.submitted_count);
    item.first_pass_rate = toRate(item.first_pass_count, item.submitted_count);
    item.receipt_completeness_rate = toRate(item.receipt_complete_count, item.total_assignments);
    const missingReceiptRate = toRate(Math.max(0, item.total_assignments - item.receipt_complete_count), item.total_assignments);
    item.missing_receipt_rate = missingReceiptRate;

    let streak = 0;
    let maxStreak = 0;
    for (const flag of overdueFlags.sort((a, b) => a.ts - b.ts)) {
      if (flag.overdue) {
        streak += 1;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }
    item.overdue_consecutive_streak = maxStreak;

    if (item.overdue_consecutive_streak >= DEFAULT_THRESHOLD.overdue_streak_n) {
      const msg = `连续逾期 ${item.overdue_consecutive_streak} 次（阈值 ${DEFAULT_THRESHOLD.overdue_streak_n}）`;
      item.alerts.push(msg);
      alerts.push({ level: "CRITICAL", dimension: item.dimension, dimension_id: item.dimension_id, message: msg });
    }
    if (Number(item.missing_receipt_rate ?? 0) > DEFAULT_THRESHOLD.missing_receipt_rate) {
      const ratio = Math.round(Number(item.missing_receipt_rate ?? 0) * 100);
      const thresholdRatio = Math.round(DEFAULT_THRESHOLD.missing_receipt_rate * 100);
      const msg = `回执缺失率 ${ratio}% 超过阈值 ${thresholdRatio}%`;
      item.alerts.push(msg);
      alerts.push({ level: "WARN", dimension: item.dimension, dimension_id: item.dimension_id, message: msg });
    }

    output.push(item);
  }

  const generatedAtMs = Date.now();
  for (const item of output) {
    await db.query(
        `INSERT INTO manual_execution_quality_projection_v1 (
          tenant_id, project_id, group_id, dimension, dimension_id, dimension_name, field_id, action_type,
          from_ts_ms, to_ts_ms, total_assignments, submitted_count, on_time_count, on_time_rate,
          first_pass_count, first_pass_rate, receipt_complete_count, receipt_completeness_rate,
          abnormal_count, closed_loop_count, avg_abnormal_closed_loop_ms, overdue_consecutive_streak,
          missing_receipt_rate, alerts, updated_ts_ms
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25)
        ON CONFLICT (tenant_id, project_id, group_id, dimension, dimension_id, from_ts_ms, to_ts_ms, field_id, action_type)
        DO UPDATE SET
          dimension_name = EXCLUDED.dimension_name,
          total_assignments = EXCLUDED.total_assignments,
          submitted_count = EXCLUDED.submitted_count,
          on_time_count = EXCLUDED.on_time_count,
          on_time_rate = EXCLUDED.on_time_rate,
          first_pass_count = EXCLUDED.first_pass_count,
          first_pass_rate = EXCLUDED.first_pass_rate,
          receipt_complete_count = EXCLUDED.receipt_complete_count,
          receipt_completeness_rate = EXCLUDED.receipt_completeness_rate,
          abnormal_count = EXCLUDED.abnormal_count,
          closed_loop_count = EXCLUDED.closed_loop_count,
          avg_abnormal_closed_loop_ms = EXCLUDED.avg_abnormal_closed_loop_ms,
          overdue_consecutive_streak = EXCLUDED.overdue_consecutive_streak,
          missing_receipt_rate = EXCLUDED.missing_receipt_rate,
          alerts = EXCLUDED.alerts,
          updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [
          query.tenant_id,
          query.project_id,
          query.group_id,
          item.dimension,
          item.dimension_id,
          item.dimension_name,
          query.field_id ?? null,
          query.action_type ?? null,
          query.from_ts_ms,
          query.to_ts_ms,
          item.total_assignments,
          item.submitted_count,
          item.on_time_count,
          item.on_time_rate,
          item.first_pass_count,
          item.first_pass_rate,
          item.receipt_complete_count,
          item.receipt_completeness_rate,
          item.abnormal_count,
          item.closed_loop_count,
          item.avg_abnormal_closed_loop_ms,
          item.overdue_consecutive_streak,
          item.missing_receipt_rate,
          JSON.stringify(item.alerts),
          generatedAtMs,
        ]
    );
  }
  await db.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [
      randomUUID(),
      "projection/manual_execution_quality_v1",
      {
        type: "manual_execution_quality_snapshot_v1",
        entity: { tenant_id: query.tenant_id },
        payload: {
          query,
          generated_at_ms: generatedAtMs,
          threshold: DEFAULT_THRESHOLD,
          items: output,
          alerts,
        },
      },
    ]
  );

  return {
    generated_at_ms: generatedAtMs,
    query,
    threshold: DEFAULT_THRESHOLD,
    items: output.sort((a, b) => b.total_assignments - a.total_assignments),
    alerts,
  };
}
