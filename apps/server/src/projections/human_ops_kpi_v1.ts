import type { Pool, PoolClient } from "pg";

type DbConn = Pool | PoolClient;

let ensurePromise: Promise<void> | null = null;

export async function ensureHumanOpsKpiProjectionV1(db: DbConn): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS human_ops_kpi_v1 (
          tenant_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          group_id TEXT NOT NULL,
          bucket_granularity TEXT NOT NULL,
          date_bucket DATE NOT NULL,
          team_id TEXT NULL,
          executor_id TEXT NULL,
          total_assignments BIGINT NOT NULL,
          submitted_count BIGINT NOT NULL,
          on_time_count BIGINT NOT NULL,
          first_pass_count BIGINT NOT NULL,
          accept_duration_ms_sum BIGINT NOT NULL,
          accept_duration_count BIGINT NOT NULL,
          submit_duration_ms_sum BIGINT NOT NULL,
          submit_duration_count BIGINT NOT NULL,
          refreshed_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, project_id, group_id, bucket_granularity, date_bucket, team_id, executor_id)
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_human_ops_kpi_v1_tenant_bucket_team_executor ON human_ops_kpi_v1 (tenant_id, date_bucket, team_id, executor_id)`);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

export async function refreshHumanOpsKpiProjectionV1(db: DbConn): Promise<void> {
  await ensureHumanOpsKpiProjectionV1(db);
  const now = Date.now();
  await db.query("BEGIN");
  try {
    await db.query(`DELETE FROM human_ops_kpi_v1`);
    await db.query(
      `WITH task_scope AS (
         SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
            (record_json::jsonb#>>'{payload,tenant_id}') AS tenant_id,
            (record_json::jsonb#>>'{payload,project_id}') AS project_id,
            (record_json::jsonb#>>'{payload,group_id}') AS group_id,
            (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id
         FROM facts
         WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
         ORDER BY (record_json::jsonb#>>'{payload,act_task_id}') ASC, occurred_at DESC, fact_id DESC
       ),
       audit AS (
         SELECT
          tenant_id,
          assignment_id,
          MIN(CASE WHEN status = 'ASSIGNED' THEN EXTRACT(EPOCH FROM occurred_at) * 1000 END) AS assigned_ms,
          MIN(CASE WHEN status = 'ACCEPTED' THEN EXTRACT(EPOCH FROM occurred_at) * 1000 END) AS accepted_ms,
          MIN(CASE WHEN status = 'SUBMITTED' THEN EXTRACT(EPOCH FROM occurred_at) * 1000 END) AS submitted_ms
         FROM work_assignment_audit_v1
         GROUP BY tenant_id, assignment_id
       ),
       task_assign_count AS (
         SELECT tenant_id, act_task_id, COUNT(*)::bigint AS assignment_count
         FROM work_assignment_index_v1
         GROUP BY tenant_id, act_task_id
       ),
       base AS (
         SELECT
          a.tenant_id,
          COALESCE(ts.project_id, '') AS project_id,
          COALESCE(ts.group_id, '') AS group_id,
          DATE_TRUNC('day', a.assigned_at)::date AS bucket_day,
          DATE_TRUNC('week', a.assigned_at)::date AS bucket_week,
          COALESCE(h.team_id, 'UNASSIGNED_TEAM') AS team_id,
          a.executor_id,
          CASE WHEN a.status = 'SUBMITTED' THEN 1 ELSE 0 END AS submitted_count,
          CASE WHEN a.status = 'SUBMITTED' AND a.arrive_deadline_ts IS NOT NULL AND a.arrive_deadline_ts >= a.assigned_at THEN 1 ELSE 0 END AS on_time_count,
          CASE WHEN a.status = 'SUBMITTED' AND COALESCE(tac.assignment_count, 1) = 1 THEN 1 ELSE 0 END AS first_pass_count,
          CASE WHEN au.assigned_ms IS NOT NULL AND au.accepted_ms IS NOT NULL AND au.accepted_ms >= au.assigned_ms THEN (au.accepted_ms - au.assigned_ms)::bigint ELSE NULL END AS accept_duration_ms,
          CASE WHEN au.accepted_ms IS NOT NULL AND au.submitted_ms IS NOT NULL AND au.submitted_ms >= au.accepted_ms THEN (au.submitted_ms - au.accepted_ms)::bigint ELSE NULL END AS submit_duration_ms
         FROM work_assignment_index_v1 a
         LEFT JOIN audit au ON au.tenant_id = a.tenant_id AND au.assignment_id = a.assignment_id
         LEFT JOIN human_executor_index_v1 h ON h.tenant_id = a.tenant_id AND h.executor_id = a.executor_id
         LEFT JOIN task_scope ts ON ts.tenant_id = a.tenant_id AND ts.act_task_id = a.act_task_id
         LEFT JOIN task_assign_count tac ON tac.tenant_id = a.tenant_id AND tac.act_task_id = a.act_task_id
         WHERE a.assigned_at >= NOW() - INTERVAL '180 days'
       ),
       rows_union AS (
          SELECT tenant_id, project_id, group_id, 'day'::text AS bucket_granularity, bucket_day AS date_bucket, team_id, executor_id,
                 COUNT(*)::bigint AS total_assignments,
                 SUM(submitted_count)::bigint AS submitted_count,
                 SUM(on_time_count)::bigint AS on_time_count,
                 SUM(first_pass_count)::bigint AS first_pass_count,
                 COALESCE(SUM(accept_duration_ms),0)::bigint AS accept_duration_ms_sum,
                 COUNT(accept_duration_ms)::bigint AS accept_duration_count,
                 COALESCE(SUM(submit_duration_ms),0)::bigint AS submit_duration_ms_sum,
                 COUNT(submit_duration_ms)::bigint AS submit_duration_count
          FROM base GROUP BY tenant_id, project_id, group_id, bucket_day, team_id, executor_id
          UNION ALL
          SELECT tenant_id, project_id, group_id, 'day'::text AS bucket_granularity, bucket_day AS date_bucket, NULL::text AS team_id, NULL::text AS executor_id,
                 COUNT(*)::bigint AS total_assignments,
                 SUM(submitted_count)::bigint AS submitted_count,
                 SUM(on_time_count)::bigint AS on_time_count,
                 SUM(first_pass_count)::bigint AS first_pass_count,
                 COALESCE(SUM(accept_duration_ms),0)::bigint AS accept_duration_ms_sum,
                 COUNT(accept_duration_ms)::bigint AS accept_duration_count,
                 COALESCE(SUM(submit_duration_ms),0)::bigint AS submit_duration_ms_sum,
                 COUNT(submit_duration_ms)::bigint AS submit_duration_count
          FROM base GROUP BY tenant_id, project_id, group_id, bucket_day
          UNION ALL
          SELECT tenant_id, project_id, group_id, 'week'::text AS bucket_granularity, bucket_week AS date_bucket, team_id, executor_id,
                 COUNT(*)::bigint AS total_assignments,
                 SUM(submitted_count)::bigint AS submitted_count,
                 SUM(on_time_count)::bigint AS on_time_count,
                 SUM(first_pass_count)::bigint AS first_pass_count,
                 COALESCE(SUM(accept_duration_ms),0)::bigint AS accept_duration_ms_sum,
                 COUNT(accept_duration_ms)::bigint AS accept_duration_count,
                 COALESCE(SUM(submit_duration_ms),0)::bigint AS submit_duration_ms_sum,
                 COUNT(submit_duration_ms)::bigint AS submit_duration_count
          FROM base GROUP BY tenant_id, project_id, group_id, bucket_week, team_id, executor_id
          UNION ALL
          SELECT tenant_id, project_id, group_id, 'week'::text AS bucket_granularity, bucket_week AS date_bucket, NULL::text AS team_id, NULL::text AS executor_id,
                 COUNT(*)::bigint AS total_assignments,
                 SUM(submitted_count)::bigint AS submitted_count,
                 SUM(on_time_count)::bigint AS on_time_count,
                 SUM(first_pass_count)::bigint AS first_pass_count,
                 COALESCE(SUM(accept_duration_ms),0)::bigint AS accept_duration_ms_sum,
                 COUNT(accept_duration_ms)::bigint AS accept_duration_count,
                 COALESCE(SUM(submit_duration_ms),0)::bigint AS submit_duration_ms_sum,
                 COUNT(submit_duration_ms)::bigint AS submit_duration_count
          FROM base GROUP BY tenant_id, project_id, group_id, bucket_week
       )
       INSERT INTO human_ops_kpi_v1 (
         tenant_id, project_id, group_id, bucket_granularity, date_bucket, team_id, executor_id,
         total_assignments, submitted_count, on_time_count, first_pass_count,
         accept_duration_ms_sum, accept_duration_count, submit_duration_ms_sum, submit_duration_count, refreshed_ts_ms
       )
       SELECT tenant_id, project_id, group_id, bucket_granularity, date_bucket, team_id, executor_id,
              total_assignments, submitted_count, on_time_count, first_pass_count,
              accept_duration_ms_sum, accept_duration_count, submit_duration_ms_sum, submit_duration_count, $1
       FROM rows_union`,
      [now]
    );
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export function shouldRunLowPeakRefresh(now = new Date()): boolean {
  const lowPeakHours = String(process.env.GEOX_HUMAN_OPS_LOW_PEAK_HOURS ?? "2,3,4").split(",").map((v) => Number(v.trim())).filter(Number.isFinite);
  return lowPeakHours.includes(now.getUTCHours());
}
