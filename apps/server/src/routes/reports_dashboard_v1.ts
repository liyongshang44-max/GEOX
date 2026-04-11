import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectCustomerDashboardAggregateV1 } from "../projections/report_dashboard_v1";
import { projectOperationStateV1 } from "../projections/operation_state_v1";
import { projectReportV1 } from "./reports_v1";

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

export function registerReportsDashboardV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/customer-dashboard/aggregate", async (req, reply) => {
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

    const aggregate = projectCustomerDashboardAggregateV1({
      reports,
      allowedFieldIds: scopedFieldIds,
      requestedFieldIds: requestedFieldIds.length > 0 ? intersectedFieldIds : undefined,
      timeRange,
      nowMs: Date.now(),
    });

    return reply.send({
      ok: true,
      ...aggregate,
    });
  });
}
