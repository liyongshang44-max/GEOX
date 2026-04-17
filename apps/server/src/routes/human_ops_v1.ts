import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { ensureHumanOpsKpiProjectionV1, refreshHumanOpsKpiProjectionV1, shouldRunLowPeakRefresh } from "../projections/human_ops_kpi_v1.js";

function toMs(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toRate(num: number, den: number): number | null {
  if (!Number.isFinite(den) || den <= 0) return null;
  return Number((num / den).toFixed(4));
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

export function startHumanOpsKpiRefreshWorker(pool: Pool): void {
  const tick = async () => {
    try {
      await ensureHumanOpsKpiProjectionV1(pool);
      if (!shouldRunLowPeakRefresh()) return;
      await refreshHumanOpsKpiProjectionV1(pool);
    } catch {
      // no-op
    }
  };
  void tick();
  setInterval(() => { void tick(); }, 60 * 60 * 1000);
}

export function registerHumanOpsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/human-ops/kpi", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanOpsKpiProjectionV1(pool);
    const q: any = (req as any).query ?? {};
    const from_ts_ms = toMs(q.from_ts_ms, Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to_ts_ms = toMs(q.to_ts_ms, Date.now());
    if (to_ts_ms <= from_ts_ms) return badRequest(reply, "INVALID_TIME_WINDOW");

    const tenant_id = String(q.tenant_id ?? auth.tenant_id ?? "").trim();
    const project_id = String(q.project_id ?? auth.project_id ?? "").trim();
    const group_id = String(q.group_id ?? auth.group_id ?? "").trim();

    const overallQ = await pool.query(
      `SELECT
         COALESCE(SUM(total_assignments), 0)::bigint AS total_assignments,
         COALESCE(SUM(submitted_count), 0)::bigint AS submitted_count,
         COALESCE(SUM(on_time_count), 0)::bigint AS on_time_count,
         COALESCE(SUM(first_pass_count), 0)::bigint AS first_pass_count,
         COALESCE(SUM(accept_duration_ms_sum), 0)::bigint AS accept_duration_ms_sum,
         COALESCE(SUM(accept_duration_count), 0)::bigint AS accept_duration_count,
         COALESCE(SUM(submit_duration_ms_sum), 0)::bigint AS submit_duration_ms_sum,
         COALESCE(SUM(submit_duration_count), 0)::bigint AS submit_duration_count
       FROM human_ops_kpi_v1
       WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
         AND bucket_granularity = 'day'
         AND team_id IS NULL
         AND date_bucket >= to_timestamp($4::double precision / 1000.0)::date
         AND date_bucket <= to_timestamp($5::double precision / 1000.0)::date`,
      [tenant_id, project_id, group_id, from_ts_ms, to_ts_ms]
    );

    const trendQ = await pool.query(
      `SELECT
         date_bucket,
         SUM(total_assignments)::bigint AS total_assignments,
         SUM(submitted_count)::bigint AS submitted_count,
         SUM(on_time_count)::bigint AS on_time_count,
         SUM(first_pass_count)::bigint AS first_pass_count
       FROM human_ops_kpi_v1
       WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
         AND bucket_granularity = 'day'
         AND team_id IS NULL
         AND date_bucket >= to_timestamp($4::double precision / 1000.0)::date
         AND date_bucket <= to_timestamp($5::double precision / 1000.0)::date
       GROUP BY date_bucket
       ORDER BY date_bucket ASC`,
      [tenant_id, project_id, group_id, from_ts_ms, to_ts_ms]
    );

    const row: any = overallQ.rows?.[0] ?? {};
    const total = Number(row.total_assignments ?? 0);
    const submitted = Number(row.submitted_count ?? 0);
    const onTime = Number(row.on_time_count ?? 0);
    const firstPass = Number(row.first_pass_count ?? 0);
    const acceptCount = Number(row.accept_duration_count ?? 0);
    const submitCount = Number(row.submit_duration_count ?? 0);

    return reply.send({
      ok: true,
      filters: { tenant_id, project_id, group_id, from_ts_ms, to_ts_ms },
      kpi: {
        on_time_rate: toRate(onTime, submitted),
        avg_accept_duration_ms: acceptCount > 0 ? Math.round(Number(row.accept_duration_ms_sum ?? 0) / acceptCount) : null,
        avg_submit_duration_ms: submitCount > 0 ? Math.round(Number(row.submit_duration_ms_sum ?? 0) / submitCount) : null,
        first_pass_rate: toRate(firstPass, submitted),
        total_assignments: total,
        submitted_count: submitted,
      },
      trend: (trendQ.rows ?? []).map((x: any) => ({
        date_bucket: String(x.date_bucket),
        total_assignments: Number(x.total_assignments ?? 0),
        submitted_count: Number(x.submitted_count ?? 0),
        on_time_rate: toRate(Number(x.on_time_count ?? 0), Number(x.submitted_count ?? 0)),
        first_pass_rate: toRate(Number(x.first_pass_count ?? 0), Number(x.submitted_count ?? 0)),
      })),
    });
  });

  app.get("/api/v1/human-ops/executor-ranking", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanOpsKpiProjectionV1(pool);
    const q: any = (req as any).query ?? {};
    const from_ts_ms = toMs(q.from_ts_ms, Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to_ts_ms = toMs(q.to_ts_ms, Date.now());
    const tenant_id = String(q.tenant_id ?? auth.tenant_id ?? "").trim();
    const project_id = String(q.project_id ?? auth.project_id ?? "").trim();
    const group_id = String(q.group_id ?? auth.group_id ?? "").trim();
    const dimension = String(q.dimension ?? "executor").toLowerCase() === "team" ? "team" : "executor";
    const limit = Math.max(1, Math.min(100, Number(q.limit ?? 20) || 20));

    const rankingQ = await pool.query(
      `SELECT
          ${dimension === "team" ? "team_id" : "executor_id"} AS dimension_id,
          COALESCE(SUM(total_assignments), 0)::bigint AS total_assignments,
          COALESCE(SUM(submitted_count), 0)::bigint AS submitted_count,
          COALESCE(SUM(on_time_count), 0)::bigint AS on_time_count,
          COALESCE(SUM(first_pass_count), 0)::bigint AS first_pass_count,
          COALESCE(SUM(accept_duration_ms_sum), 0)::bigint AS accept_duration_ms_sum,
          COALESCE(SUM(accept_duration_count), 0)::bigint AS accept_duration_count,
          COALESCE(SUM(submit_duration_ms_sum), 0)::bigint AS submit_duration_ms_sum,
          COALESCE(SUM(submit_duration_count), 0)::bigint AS submit_duration_count
       FROM human_ops_kpi_v1
       WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
         AND bucket_granularity = 'day'
         AND date_bucket >= to_timestamp($4::double precision / 1000.0)::date
         AND date_bucket <= to_timestamp($5::double precision / 1000.0)::date
         AND ${dimension === "team" ? "team_id" : "executor_id"} IS NOT NULL
       GROUP BY ${dimension === "team" ? "team_id" : "executor_id"}
       ORDER BY SUM(on_time_count)::float / NULLIF(SUM(submitted_count), 0) DESC NULLS LAST, SUM(submitted_count) DESC
       LIMIT $6`,
      [tenant_id, project_id, group_id, from_ts_ms, to_ts_ms, limit]
    );

    return reply.send({
      ok: true,
      filters: { tenant_id, project_id, group_id, from_ts_ms, to_ts_ms, dimension },
      items: (rankingQ.rows ?? []).map((x: any, idx: number) => ({
        rank: idx + 1,
        dimension,
        dimension_id: String(x.dimension_id ?? ""),
        total_assignments: Number(x.total_assignments ?? 0),
        submitted_count: Number(x.submitted_count ?? 0),
        on_time_rate: toRate(Number(x.on_time_count ?? 0), Number(x.submitted_count ?? 0)),
        first_pass_rate: toRate(Number(x.first_pass_count ?? 0), Number(x.submitted_count ?? 0)),
        avg_accept_duration_ms: Number(x.accept_duration_count ?? 0) > 0 ? Math.round(Number(x.accept_duration_ms_sum ?? 0) / Number(x.accept_duration_count ?? 1)) : null,
        avg_submit_duration_ms: Number(x.submit_duration_count ?? 0) > 0 ? Math.round(Number(x.submit_duration_ms_sum ?? 0) / Number(x.submit_duration_count ?? 1)) : null,
      })),
    });
  });

  app.get("/api/v1/human-ops/exception-analysis", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const from_ts_ms = toMs(q.from_ts_ms, Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to_ts_ms = toMs(q.to_ts_ms, Date.now());
    const tenant_id = String(q.tenant_id ?? auth.tenant_id ?? "").trim();
    const project_id = String(q.project_id ?? auth.project_id ?? "").trim();
    const group_id = String(q.group_id ?? auth.group_id ?? "").trim();
    const limit = Math.max(1, Math.min(50, Number(q.limit ?? 20) || 20));

    const exceptionQ = await pool.query(
      `WITH latest_receipt AS (
          SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
            (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
            (record_json::jsonb#>>'{payload,exception,code}') AS exception_code,
            (record_json::jsonb#>>'{payload,exception,type}') AS exception_type,
            occurred_at
          FROM facts
          WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND occurred_at >= to_timestamp($4::double precision / 1000.0)
            AND occurred_at <= to_timestamp($5::double precision / 1000.0)
          ORDER BY (record_json::jsonb#>>'{payload,act_task_id}') ASC, occurred_at DESC, fact_id DESC
       )
       SELECT
          COALESCE(NULLIF(exception_code, ''), NULLIF(exception_type, ''), 'UNKNOWN') AS exception_code,
          COUNT(*)::bigint AS count,
          MIN(act_task_id) AS sample_task_id
       FROM latest_receipt
       WHERE COALESCE(exception_code, exception_type) IS NOT NULL
       GROUP BY 1
       ORDER BY COUNT(*) DESC
       LIMIT $6`,
      [tenant_id, project_id, group_id, from_ts_ms, to_ts_ms, limit]
    );

    return reply.send({
      ok: true,
      filters: { tenant_id, project_id, group_id, from_ts_ms, to_ts_ms },
      items: (exceptionQ.rows ?? []).map((x: any) => ({
        exception_code: String(x.exception_code ?? "UNKNOWN"),
        count: Number(x.count ?? 0),
        sample_task_id: String(x.sample_task_id ?? ""),
      })),
    });
  });
}
