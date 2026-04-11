import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectCustomerDashboardAggregateV1 } from "../projections/report_dashboard_v1";
import type { OperationReportV1 } from "../projections/report_v1";

type TimeRange = "7d" | "30d" | "season";

type ReportReadModelRow = {
  operation_plan_id: string;
  operation_id: string;
  field_id: string;
  final_status: string;
  updated_ts_ms: number;
};

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

function toIsoFromMs(ms: number): string | null {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function mapReadModelRowToReport(row: ReportReadModelRow, auth: { tenant_id: string; project_id: string }): OperationReportV1 {
  const finishedAt = toIsoFromMs(row.updated_ts_ms);
  const executionSuccess = ["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED"].includes(String(row.final_status ?? "").toUpperCase());
  return {
    type: "operation_report_v1",
    version: "v1",
    generated_at: finishedAt ?? new Date().toISOString(),
    identifiers: {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: row.field_id,
      operation_plan_id: row.operation_plan_id,
      operation_id: row.operation_id,
      recommendation_id: null,
      act_task_id: null,
      receipt_id: null,
    },
    execution: {
      final_status: row.final_status,
      invalid_execution: false,
      invalid_reason: null,
      dispatched_at: null,
      execution_started_at: finishedAt,
      execution_finished_at: finishedAt,
      response_time_ms: null,
    },
    acceptance: {
      status: "NOT_AVAILABLE",
      verdict: null,
      missing_evidence: false,
      missing_items: [],
      generated_at: null,
    },
    evidence: {
      artifacts_count: 0,
      logs_count: 0,
      media_count: 0,
      metrics_count: 0,
      receipt_present: false,
      acceptance_present: false,
    },
    cost: {
      actual_total: 0,
      actual_water_cost: 0,
      actual_electric_cost: 0,
      actual_chemical_cost: 0,
      estimated_total: 0,
      estimated_water_cost: 0,
      estimated_chemical_cost: 0,
      estimated_device_cost: 0,
      estimated_labor_cost: 0,
      action_type: "IRRIGATE",
      action_resolution: "UNKNOWN_FALLBACK",
      cost_quality: "ESTIMATED_ONLY",
      cost_notes: [],
      requested_action_type: null,
      currency: "CNY",
    },
    sla: {
      dispatch_latency_quality: "MISSING_DATA",
      execution_duration_quality: "MISSING_DATA",
      acceptance_latency_quality: "MISSING_DATA",
      execution_success: executionSuccess,
      acceptance_pass: false,
      response_time_ms: null,
      invalid_reasons: [],
      pending_acceptance_elapsed_ms: null,
      pending_acceptance_over_30m: false,
    },
    risk: {
      level: executionSuccess ? "LOW" : "MEDIUM",
      reasons: executionSuccess ? [] : ["execution_not_success"],
    },
  };
}

export function registerReportsDashboardV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/customer-dashboard/aggregate", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const q: any = (req as any).query ?? {};
    const timeRange = parseTimeRange(q.time_range);
    if (!timeRange) return reply.status(400).send({ ok: false, error: "INVALID_TIME_RANGE" });

    const requestedFieldIds = parseRequestedFieldIds(q);
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids)
      ? auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];

    const intersectedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((fieldId) => allowedFieldIds.includes(fieldId))
      : [];

    const reportRowsQ = await pool.query(
      `SELECT
         operation_plan_id,
         COALESCE(operation_id, operation_plan_id) AS operation_id,
         field_id,
         status AS final_status,
         updated_ts_ms
       FROM operation_plan_index_v1
       WHERE tenant_id = $1
         AND project_id = $2
         AND group_id = $3`,
      [auth.tenant_id, auth.project_id, auth.group_id]
    );

    const rows: ReportReadModelRow[] = (reportRowsQ.rows ?? [])
      .map((row: any) => ({
        operation_plan_id: String(row.operation_plan_id ?? "").trim(),
        operation_id: String(row.operation_id ?? row.operation_plan_id ?? "").trim(),
        field_id: String(row.field_id ?? "").trim(),
        final_status: String(row.final_status ?? "PENDING").trim() || "PENDING",
        updated_ts_ms: Number(row.updated_ts_ms ?? Date.now()),
      }))
      .filter((row) => row.operation_plan_id && row.operation_id && row.field_id);

    const reports = rows.map((row) => mapReadModelRowToReport(row, auth));

    const fullScopeFieldIds = allowedFieldIds.length > 0
      ? allowedFieldIds
      : Array.from(new Set(rows.map((row) => row.field_id)));
    const effectiveRequestedFieldIds = requestedFieldIds.length > 0
      ? (intersectedFieldIds.length > 0 ? intersectedFieldIds : fullScopeFieldIds)
      : undefined;

    const aggregate = projectCustomerDashboardAggregateV1({
      reports,
      allowedFieldIds: fullScopeFieldIds,
      requestedFieldIds: effectiveRequestedFieldIds,
      timeRange,
      nowMs: Date.now(),
    });

    return reply.send({
      ok: true,
      aggregate,
    });
  });
}
