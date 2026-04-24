import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceRouteRoleAuth } from "../auth/route_role_authz.js";
import { projectCustomerDashboardAggregateFromStatesV1, projectFieldPortfolioSummaryV1 } from "../projections/report_dashboard_v1.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";
import { projectReportV1 } from "./reports_v1.js";

type TimeRange = "7d" | "30d" | "season";

type ScopedOperationRow = {
  operation_id: string;
  field_id: string;
};

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

const DASHBOARD_REPORT_CONCURRENCY_LIMIT = 12;
const DEVICE_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

function normalizeFieldIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function parseRequestedFieldIds(query: any): string[] {
  return Array.from(new Set([
    ...normalizeFieldIds(query?.field_ids),
    ...normalizeFieldIds(query?.["field_ids[]"]),
  ]));
}

function parseTimeRange(raw: unknown): TimeRange | null {
  const value = String(raw ?? "season").trim();
  if (value === "7d" || value === "30d" || value === "season") return value;
  return null;
}

async function mapWithConcurrencyLimit<TInput, TOutput>(
  items: TInput[],
  limit: number,
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function runOneWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => runOneWorker()));
  return results;
}

async function queryScopedOperations(
  pool: Pool,
  tenant: TenantTriple,
  scopedFieldIds?: string[]
): Promise<ScopedOperationRow[]> {
  const params: any[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
  const fieldScopeSql = scopedFieldIds && scopedFieldIds.length > 0
    ? ` AND field_id = ANY($4::text[])`
    : "";

  if (scopedFieldIds && scopedFieldIds.length > 0) params.push(scopedFieldIds);

  const q = await pool.query(
    `SELECT COALESCE(operation_id, operation_plan_id) AS operation_id, field_id
       FROM operation_plan_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3${fieldScopeSql}`,
    params
  );

  const dedup = new Map<string, ScopedOperationRow>();
  for (const row of q.rows ?? []) {
    const operationId = String((row as any).operation_id ?? "").trim();
    const fieldId = String((row as any).field_id ?? "").trim();
    if (!operationId || !fieldId) continue;
    if (!dedup.has(operationId)) dedup.set(operationId, { operation_id: operationId, field_id: fieldId });
  }
  return [...dedup.values()];
}

async function queryFieldNameMap(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, string | null>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(
    `SELECT field_id, name
       FROM field_index_v1
      WHERE tenant_id = $1
        AND field_id = ANY($2::text[])`,
    [tenant.tenant_id, fieldIds],
  );
  const map = new Map<string, string | null>();
  for (const row of q.rows ?? []) {
    const fieldId = String((row as any).field_id ?? "").trim();
    if (!fieldId) continue;
    const name = String((row as any).name ?? "").trim();
    map.set(fieldId, name || null);
  }
  return map;
}

async function queryOpenAlertCountByField(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, number>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(
    `SELECT field_id, SUM(cnt)::bigint AS count
       FROM (
         SELECT e.object_id AS field_id, COUNT(*)::bigint AS cnt
           FROM alert_event_index_v1 e
          WHERE e.tenant_id = $1
            AND e.status IN ('OPEN','ACKED')
            AND e.object_type = 'FIELD'
            AND e.object_id = ANY($2::text[])
          GROUP BY e.object_id
         UNION ALL
         SELECT b.field_id AS field_id, COUNT(*)::bigint AS cnt
           FROM alert_event_index_v1 e
           JOIN device_binding_index_v1 b
             ON b.tenant_id = e.tenant_id
            AND b.device_id = e.object_id
          WHERE e.tenant_id = $1
            AND e.status IN ('OPEN','ACKED')
            AND e.object_type = 'DEVICE'
            AND b.field_id = ANY($2::text[])
          GROUP BY b.field_id
       ) t
      GROUP BY field_id`,
    [tenant.tenant_id, fieldIds],
  ).catch(() => ({ rows: [] as any[] }));
  const map = new Map<string, number>();
  for (const row of q.rows ?? []) {
    const fieldId = String((row as any).field_id ?? "").trim();
    if (!fieldId) continue;
    map.set(fieldId, Number((row as any).count ?? 0));
  }
  return map;
}

async function queryPendingActionsSummary(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<{
  total_open_alerts: number;
  unassigned_alerts: number;
  in_progress_alerts: number;
  sla_breached_alerts: number;
  closed_today_alerts: number;
}> {
  if (fieldIds.length === 0) {
    return { total_open_alerts: 0, unassigned_alerts: 0, in_progress_alerts: 0, sla_breached_alerts: 0, closed_today_alerts: 0 };
  }
  const nowMs = Date.now();
  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  const startTodayMs = startToday.getTime();
  const q = await pool.query(
    `WITH scoped_alerts AS (
       SELECT e.alert_id
         FROM alert_event_index_v1 e
        WHERE e.tenant_id = $1
          AND e.status IN ('OPEN','ACKED')
          AND (
            (e.object_type = 'FIELD' AND e.object_id = ANY($2::text[]))
            OR
            (e.object_type = 'DEVICE' AND e.object_id IN (
              SELECT device_id FROM device_binding_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])
            ))
          )
     )
     SELECT
       COUNT(*)::bigint AS total_open_alerts,
       SUM(CASE WHEN COALESCE(w.status, 'OPEN') = 'OPEN' THEN 1 ELSE 0 END)::bigint AS unassigned_alerts,
       SUM(CASE WHEN COALESCE(w.status, 'OPEN') IN ('IN_PROGRESS','ASSIGNED','ACKED') THEN 1 ELSE 0 END)::bigint AS in_progress_alerts,
       SUM(CASE WHEN w.sla_due_at IS NOT NULL AND w.sla_due_at < $3 THEN 1 ELSE 0 END)::bigint AS sla_breached_alerts,
       SUM(CASE WHEN COALESCE(w.status, 'OPEN') = 'CLOSED' AND w.updated_at >= $4 THEN 1 ELSE 0 END)::bigint AS closed_today_alerts
      FROM scoped_alerts s
      LEFT JOIN alert_workflow_v1 w
        ON w.tenant_id = $1
       AND w.alert_id = s.alert_id`,
    [tenant.tenant_id, fieldIds, nowMs, startTodayMs],
  ).catch(() => ({ rows: [{}] as any[] }));
  const row: any = q.rows?.[0] ?? {};
  return {
    total_open_alerts: Number(row.total_open_alerts ?? 0),
    unassigned_alerts: Number(row.unassigned_alerts ?? 0),
    in_progress_alerts: Number(row.in_progress_alerts ?? 0),
    sla_breached_alerts: Number(row.sla_breached_alerts ?? 0),
    closed_today_alerts: Number(row.closed_today_alerts ?? 0),
  };
}

async function queryDeviceSummary(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<{
  offline_fields: number;
  total_devices: number;
  offline_devices: number;
}> {
  if (fieldIds.length === 0) return { offline_fields: 0, total_devices: 0, offline_devices: 0 };
  const q = await pool.query(
    `SELECT COALESCE(d.field_id, b.field_id) AS field_id, d.device_id, d.last_heartbeat_ts_ms
       FROM device_status_index_v1 d
       LEFT JOIN device_binding_index_v1 b
         ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
      WHERE d.tenant_id = $1
        AND COALESCE(d.field_id, b.field_id) = ANY($2::text[])`,
    [tenant.tenant_id, fieldIds],
  ).catch(() => ({ rows: [] as any[] }));

  const cutoff = Date.now() - DEVICE_OFFLINE_THRESHOLD_MS;
  const offlineFieldSet = new Set<string>();
  let totalDevices = 0;
  let offlineDevices = 0;
  for (const row of q.rows ?? []) {
    const fieldId = String((row as any).field_id ?? "").trim();
    if (!fieldId) continue;
    totalDevices += 1;
    const heartbeatMs = Number((row as any).last_heartbeat_ts_ms ?? 0);
    const offline = !(Number.isFinite(heartbeatMs) && heartbeatMs > 0 && heartbeatMs >= cutoff);
    if (offline) {
      offlineDevices += 1;
      offlineFieldSet.add(fieldId);
    }
  }

  return {
    offline_fields: offlineFieldSet.size,
    total_devices: totalDevices,
    offline_devices: offlineDevices,
  };
}

export function registerReportsDashboardV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/customer-dashboard/field-portfolio-summary", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const q: any = (req as any).query ?? {};
    const timeRange = parseTimeRange(q.time_range);
    if (!timeRange) return reply.status(400).send({ ok: false, error: "INVALID_TIME_RANGE" });

    const tenant: TenantTriple = {
      tenant_id: String(auth.tenant_id),
      project_id: String(auth.project_id),
      group_id: String(auth.group_id),
    };

    const requestedFieldIds = parseRequestedFieldIds(q);
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids)
      ? Array.from(new Set(auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean)))
      : [];

    const intersectedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((fieldId) => allowedFieldIds.includes(fieldId))
      : allowedFieldIds;

    const scopedFieldIds = requestedFieldIds.length > 0
      ? intersectedFieldIds
      : allowedFieldIds;

    const scopedOperations = (requestedFieldIds.length > 0 && intersectedFieldIds.length === 0)
      ? []
      : await queryScopedOperations(pool, tenant, scopedFieldIds);

    const states = await projectOperationStateV1(pool, tenant);
    const stateByOperationId = new Map<string, (typeof states)[number]>();
    for (const state of states) {
      const opId = String(state.operation_id ?? "").trim();
      const planId = String(state.operation_plan_id ?? "").trim();
      if (opId && !stateByOperationId.has(opId)) stateByOperationId.set(opId, state);
      if (planId && !stateByOperationId.has(planId)) stateByOperationId.set(planId, state);
    }

    const reports = (await mapWithConcurrencyLimit(
      scopedOperations,
      DASHBOARD_REPORT_CONCURRENCY_LIMIT,
      async (operation) => {
        const state = stateByOperationId.get(operation.operation_id);
        if (!state) return null;
        if (scopedFieldIds.length > 0 && !scopedFieldIds.includes(String(state.field_id ?? "").trim())) return null;
        return projectReportV1({ pool, tenant, operationState: state });
      }
    )).filter((report): report is NonNullable<typeof report> => Boolean(report));

    const summary = projectFieldPortfolioSummaryV1(reports);

    return reply.send({
      ok: true,
      summary,
    });
  });

  app.get("/api/v1/reports/customer-dashboard/aggregate", async (req, reply) => {
    if (!enforceRouteRoleAuth(req, reply, "summary")) return;
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const q: any = (req as any).query ?? {};
    const timeRange = parseTimeRange(q.time_range);
    if (!timeRange) return reply.status(400).send({ ok: false, error: "INVALID_TIME_RANGE" });

    const tenant: TenantTriple = {
      tenant_id: String(auth.tenant_id),
      project_id: String(auth.project_id),
      group_id: String(auth.group_id),
    };

    const requestedFieldIds = parseRequestedFieldIds(q);
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids)
      ? Array.from(new Set(auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean)))
      : [];

    const scopedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((fieldId) => allowedFieldIds.includes(fieldId))
      : allowedFieldIds;

    const states = await projectOperationStateV1(pool, tenant);
    const scopedStates = states.filter((state) => {
      const fieldId = String(state.field_id ?? "").trim();
      if (!fieldId) return false;
      if (scopedFieldIds.length > 0 && !scopedFieldIds.includes(fieldId)) return false;
      return true;
    });
    const aggregateFieldIds = scopedFieldIds.length > 0
      ? scopedFieldIds
      : Array.from(new Set(scopedStates.map((state) => String(state.field_id ?? "").trim()).filter(Boolean)));

    const [fieldNameById, openAlertsByField, pendingActionsSummary, deviceSummary] = await Promise.all([
      queryFieldNameMap(pool, tenant, aggregateFieldIds),
      queryOpenAlertCountByField(pool, tenant, aggregateFieldIds),
      queryPendingActionsSummary(pool, tenant, aggregateFieldIds),
      queryDeviceSummary(pool, tenant, aggregateFieldIds),
    ]);

    const aggregate = projectCustomerDashboardAggregateFromStatesV1({
      states: scopedStates,
      field_ids: aggregateFieldIds,
      field_name_by_id: fieldNameById,
      open_alerts_by_field: openAlertsByField,
      pending_actions_summary: pendingActionsSummary,
      device_summary: deviceSummary,
    });

    return reply.send({
      ok: true,
      aggregate,
    });
  });
}
