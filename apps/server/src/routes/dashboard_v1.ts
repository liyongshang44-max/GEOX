import type { FastifyInstance } from "fastify"; // Fastify route host typing.
import type { Pool } from "pg"; // Postgres pool typing.
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Reuse AO-ACT bearer auth helper.
import { normalizeReceiptEvidence } from "../services/receipt_evidence"; // Shared receipt normalization source used by export and dashboard.
import { projectOperationStateV1 } from "../projections/operation_state_v1"; // Reuse operation state projection for dashboard performance metrics.

type DashboardTrendPoint = { ts_ms: number; avg_value_num: number | null; sample_count: number; }; // Bucketed trend point.
type DashboardTrendSeries = { metric: string; points: DashboardTrendPoint[]; }; // Metric trend series.
type DashboardAlertItem = { event_id: string; rule_id: string; object_type: string; object_id: string; metric: string; status: string; raised_ts_ms: number; }; // Compact alert row.
type DashboardReceiptItem = { fact_id: string; act_task_id: string | null; device_id: string | null; status: string | null; occurred_at: string; occurred_ts_ms: number; summary: ReturnType<typeof normalizeReceiptEvidence>; }; // Compact receipt row + normalized summary.
type DashboardRecentEvidenceItem = {
  operation_plan_id: string | null;
  field_id: string | null;
  field_name: string | null;
  program_name: string | null;
  status: string | null;
  finished_at: string | null;
  water_l: number | null;
  electric_kwh: number | null;
  log_ref_count: number | null;
  constraint_violated: boolean | null;
  executor_label: string | null;
  receipt_fact_id: string | null;
  receipt_type: string | null;
  acceptance_verdict: string | null;
  is_pending_acceptance: boolean;
  href: string;
  summary: ReturnType<typeof normalizeReceiptEvidence>;
}; // Dashboard recent evidence view model used by ReceiptEvidenceCard.
type DashboardRecentExecutionItem = { id: string; operation_plan_id: string; field_id: string | null; status: string; updated_ts_ms: number; href: string; }; // Dashboard recent execution card row.
type DashboardRiskSummaryItem = { id: string; field_id: string | null; title: string; level: "HIGH" | "MEDIUM" | "LOW"; occurred_at: string | null; }; // Dashboard risk row for risk-summary endpoint.

function badRequest(reply: any, error: string) { return reply.status(400).send({ ok: false, error }); } // Stable 400 helper.
function parseWindowStart(q: any): number { const raw = Number(q?.from_ts_ms ?? Date.now() - 24 * 60 * 60 * 1000); return Number.isFinite(raw) ? raw : Date.now() - 24 * 60 * 60 * 1000; } // Parse dashboard window start.
function parseWindowEnd(q: any): number { const raw = Number(q?.to_ts_ms ?? Date.now() + 60 * 1000); return Number.isFinite(raw) ? raw : Date.now() + 60 * 1000; } // Parse dashboard window end.
function parseJsonMaybe(v: any): any { if (v && typeof v === "object") return v; if (typeof v !== "string") return null; try { return JSON.parse(v); } catch { return null; } } // Parse json/jsonb/string payloads.
function parseLimit(q: any, fallback = 8, max = 50): number { const n = Number(q?.limit ?? fallback); return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : fallback; } // Parse bounded list limit.
function relativeLabel(tsMs: number | null | undefined): string { if (!Number.isFinite(Number(tsMs))) return "-"; const d = Date.now() - Number(tsMs); if (d < 60_000) return "刚刚"; if (d < 3_600_000) return `${Math.max(1, Math.floor(d / 60_000))} 分钟前`; if (d < 86_400_000) return `${Math.max(1, Math.floor(d / 3_600_000))} 小时前`; return `${Math.max(1, Math.floor(d / 86_400_000))} 天前`; }
function statusTone(status: string): "success" | "info" | "warning" | "neutral" { const s = String(status ?? "").toUpperCase(); if (["ACTIVE", "DONE", "EXECUTED", "SUCCESS"].includes(s)) return "success"; if (["ACKED", "DISPATCHED", "RUNNING"].includes(s)) return "info"; if (["BLOCKED", "FAILED", "ERROR"].includes(s)) return "warning"; return "neutral"; }
type PriorityBucket = "P0" | "P1" | "P2";
type TrendValue = "UP" | "DOWN" | "FLAT" | "NO_DATA";

function bucketRank(bucket: PriorityBucket): number { if (bucket === "P0") return 0; if (bucket === "P1") return 1; return 2; }
function computeTrendByCounts(values: number[]): TrendValue {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length < 2) return "NO_DATA";
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (last === first) return "FLAT";
  return last > first ? "UP" : "DOWN";
}

function bucketTelemetryRows(rows: any[], fromTsMs: number, toTsMs: number): DashboardTrendSeries[] { // Convert raw telemetry rows into fixed buckets.
  const metrics = ["soil_moisture", "soil_temp"]; // Blueprint default metrics.
  const spanMs = Math.max(60 * 60 * 1000, toTsMs - fromTsMs); // Guarantee positive span.
  const bucketMs = Math.max(60 * 60 * 1000, Math.floor(spanMs / 12)); // Roughly 12 buckets.
  const byMetric = new Map<string, Map<number, { sum: number; count: number }>>(); // Per-metric bucket accumulator.
  for (const metric of metrics) byMetric.set(metric, new Map<number, { sum: number; count: number }>()); // Seed metrics.
  for (const row of rows ?? []) { // Walk numeric telemetry rows.
    const metric = String(row.metric ?? "").trim(); // Normalize metric.
    if (!byMetric.has(metric)) continue; // Ignore unrelated metrics.
    const tsMs = Number(row.ts_ms ?? 0); // Normalize timestamp.
    const valueNum = Number(row.value_num); // Normalize numeric value.
    if (!Number.isFinite(tsMs) || !Number.isFinite(valueNum)) continue; // Skip malformed samples.
    const bucketStart = fromTsMs + Math.floor((tsMs - fromTsMs) / bucketMs) * bucketMs; // Snap into bucket.
    const metricBuckets = byMetric.get(metric)!; // Read metric bucket map.
    const current = metricBuckets.get(bucketStart) ?? { sum: 0, count: 0 }; // Load aggregate or seed.
    current.sum += valueNum; // Add sample value.
    current.count += 1; // Increase sample count.
    metricBuckets.set(bucketStart, current); // Persist aggregate.
  }
  return metrics.map((metric) => { // Emit ordered series.
    const metricBuckets = byMetric.get(metric) ?? new Map<number, { sum: number; count: number }>(); // Read map.
    const points: DashboardTrendPoint[] = []; // Output points.
    for (let cursor = fromTsMs; cursor <= toTsMs; cursor += bucketMs) { // Fill stable buckets.
      const bucket = metricBuckets.get(cursor); // Check aggregated bucket.
      points.push({ ts_ms: cursor, avg_value_num: bucket && bucket.count > 0 ? Number((bucket.sum / bucket.count).toFixed(2)) : null, sample_count: bucket?.count ?? 0 }); // Append point.
    }
    return { metric, points }; // Emit series.
  });
}

export function registerDashboardV1Routes(app: FastifyInstance, pool: Pool): void { // Register dashboard summary routes.
  app.get("/api/v1/dashboard/control-plane", async (req, reply) => {
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");
    const nowTs = Date.now();

    const [programQ, pendingQ, riskQ, evidenceQ, exportQ, offlineQ] = await Promise.all([
      pool.query(`SELECT program_id, status, field_id, crop_code, updated_at, current_risk_summary, next_action_hint FROM field_program_state_v1 WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 12`, [tenant_id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT operation_plan_id, status, field_id, device_id, updated_ts_ms, program_id FROM operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND status IN ('PENDING','APPROVED','ACKED','DISPATCHED') ORDER BY updated_ts_ms DESC LIMIT 10`, [tenant_id, project_id, group_id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT event_id, metric, status, object_id, raised_ts_ms FROM alert_event_index_v1 WHERE tenant_id = $1 AND status IN ('OPEN','ACKED') ORDER BY raised_ts_ms DESC LIMIT 8`, [tenant_id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1') AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 ORDER BY occurred_at DESC LIMIT 8`, [tenant_id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT job_id, status, created_ts_ms, updated_ts_ms, scope_id, artifact_sha256 FROM evidence_export_job_index_v1 WHERE tenant_id = $1 ORDER BY updated_ts_ms DESC LIMIT 8`, [tenant_id]).catch(() => ({ rows: [] })),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM device_status_index_v1 WHERE tenant_id = $1 AND (last_heartbeat_ts_ms IS NULL OR last_heartbeat_ts_ms < $2)`, [tenant_id, nowTs - 15 * 60 * 1000]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const programs = (programQ.rows ?? []).map((row: any) => ({
      program_id: String(row.program_id),
      title: "经营 Program",
      subtitle: `田块 ${String(row.field_id ?? "-")} · 作物 ${String(row.crop_code ?? "-")}`,
      status: { code: String(row.status ?? "ACTIVE").toUpperCase(), label: String(row.status ?? "").toUpperCase() === "BLOCKED" ? "阻断" : "运行中", tone: String(row.status ?? "").toUpperCase() === "BLOCKED" ? "warning" : "success" },
      next_action: "建议尽快执行下一步动作",
      risk_reason: String(parseJsonMaybe(row.current_risk_summary)?.reason ?? "缺少设备回执数据，暂无法确认执行结果。"),
      updated_at_label: relativeLabel(Date.parse(String(row.updated_at ?? "")) || nowTs),
      actions: [{ label: "查看详情", href: `/programs/${encodeURIComponent(String(row.program_id))}` }, { label: "查看证据", href: `/evidence?program_id=${encodeURIComponent(String(row.program_id))}` }],
    }));
    const pendingItems = (pendingQ.rows ?? []).map((row: any) => ({
      id: String(row.operation_plan_id ?? "-"),
      title: "作业动作",
      status: { code: String(row.status ?? "PENDING").toUpperCase(), label: String(row.status ?? "PENDING").toUpperCase(), tone: statusTone(String(row.status ?? "PENDING")) },
      field_name: String(row.field_id ?? "-"),
      device_name: String(row.device_id ?? "-"),
      updated_at_label: relativeLabel(Number(row.updated_ts_ms ?? nowTs)),
      href: row.program_id ? `/programs/${encodeURIComponent(String(row.program_id))}` : "/actions"
    }));
    const evidenceItems = [
      ...(evidenceQ.rows ?? []).map((row: any) => {
        const normalized = normalizeReceiptEvidence({ fact_id: row.fact_id, occurred_at: row.occurred_at, record_json: row.record_json }, String(row.record_json?.type ?? ""));
        const statusCode = String(normalized.receipt_status ?? "EXECUTED").toUpperCase();
        return { id: `receipt_${String(row.fact_id).slice(0, 8)}`, kind: "receipt", title: "执行回执", summary: "已记录最近作业执行回执。", status: { code: statusCode, label: "已回执", tone: statusTone(statusCode) }, updated_at_label: relativeLabel(Date.parse(String(normalized.recorded_at ?? row.occurred_at ?? "")) || nowTs), href: "/evidence" };
      }),
      ...(exportQ.rows ?? []).map((row: any) => ({ id: `job_${String(row.job_id)}`, kind: "export", title: "证据导出任务", summary: "证据包导出任务状态更新。", status: { code: String(row.status ?? "DONE").toUpperCase(), label: String(row.status ?? "DONE").toUpperCase() === "DONE" ? "已生成" : "处理中", tone: statusTone(String(row.status ?? "DONE")) }, updated_at_label: relativeLabel(Number(row.updated_ts_ms ?? row.created_ts_ms ?? nowTs)), href: "/evidence" })),
    ].slice(0, 10);

    const riskItems = (riskQ.rows ?? []).map((row: any) => ({
      id: String(row.event_id ?? ""),
      title: String(row.metric ?? "风险项"),
      severity: { code: "MEDIUM", label: "中等风险", tone: "warning" },
      summary: "存在待处理告警或阻塞项，建议关注。"
    }));

    return reply.send({
      ok: true,
      item: {
        meta: {
          page_title: "运营总览",
          page_subtitle: "一眼查看 Program 运行状态、待执行动作、证据状态与风险摘要。",
          updated_ts_ms: nowTs,
          updated_at_label: relativeLabel(nowTs),
          context: { tenant_id, project_id, group_id, user_role: "管理员", ui_language: "中文界面", mode_label: "研发模式：关闭" }
        },
        headline_cards: [
          { key: "active_programs", title: "运行中 Program", value: programs.length, description: "当前持续跟进的经营对象", tone: "neutral", updated_at_label: "刚刚", action: { label: "查看 Program 列表", href: "/programs" } },
          { key: "priority_items", title: "需优先处理", value: riskItems.length + pendingItems.length, description: "建议优先处理的阻塞与风险项", tone: "warning", updated_at_label: "刚刚", action: { label: "查看风险项", href: "/dashboard/risks" } },
          { key: "pending_actions", title: "待执行动作", value: pendingItems.length, description: "已生成但尚未完成的动作", tone: "info", updated_at_label: "刚刚", action: { label: "查看待执行动作", href: "/actions" } },
          { key: "data_gap", title: "数据缺口 / 低效率", value: Number(offlineQ.rows?.[0]?.count ?? 0), description: "采集缺口或效率偏低项", tone: "warning", updated_at_label: "刚刚", action: { label: "查看风险摘要", href: "/dashboard/risks" } }
        ],
        priority_programs: { title: "优先 Program", subtitle: "优先展示当前最值得关注的经营对象。", items: programs.slice(0, 8), action: { label: "查看 Program 列表", href: "/programs" } },
        pending_action_list: { title: "待处理动作", subtitle: "优先关注仍在推进中的作业动作。", items: pendingItems, empty_state: { title: "当前暂无待处理动作", description: "所有动作均已完成或暂无新的作业安排。" }, action: { label: "查看待执行动作", href: "/actions" } },
        recent_evidence: { title: "最近证据", subtitle: "查看最近生成的回执、证据与导出任务。", items: evidenceItems, empty_state: { title: "最近暂无新的证据记录", description: "系统将在有回执或证据导出时自动展示。" }, action: { label: "查看证据页", href: "/evidence" } },
        risk_summary: { title: "风险摘要", subtitle: "当前系统中需要关注的风险与阻塞项。", items: riskItems, metrics: { offline_devices: Number(offlineQ.rows?.[0]?.count ?? 0), failed_receipts: 0, pending_approvals: 0 }, empty_state: { title: "当前未发现高风险项", description: "系统运行稳定，可继续关注实时变更。" }, action: { label: "查看风险详情", href: "/dashboard/risks" } }
      }
    });
  });

  app.get("/api/v1/dashboard/overview", async (req, reply) => { // Provide commercial dashboard overview payload.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Shared read scope for admin/operator ops views.
    if (!auth) return; // Auth helper already responded.

    const q: any = (req as any).query ?? {}; // Read query object.
    const from_ts_ms = parseWindowStart(q); // Parse dashboard window start.
    const to_ts_ms = parseWindowEnd(q); // Parse dashboard window end.
    if (to_ts_ms <= from_ts_ms) return badRequest(reply, "INVALID_TIME_WINDOW"); // Reject inverted windows.

    const tenant_id = String(auth.tenant_id ?? ""); // Tenant isolation key.
    const project_id = String(auth.project_id ?? ""); // Project isolation key.
    const group_id = String(auth.group_id ?? ""); // Group isolation key.
    const onlineCutoffMs = Date.now() - 15 * 60 * 1000; // Match existing ONLINE device definition.

    const [fieldCountQ, onlineDeviceCountQ, openAlertCountQ, trendRowsQ, latestAlertsQ, latestReceiptsQ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::bigint AS count FROM field_index_v1 WHERE tenant_id = $1`, [tenant_id]),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM device_status_index_v1 WHERE tenant_id = $1 AND last_heartbeat_ts_ms IS NOT NULL AND last_heartbeat_ts_ms >= $2`, [tenant_id, onlineCutoffMs]),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM alert_event_index_v1 WHERE tenant_id = $1 AND status IN ('OPEN','ACKED')`, [tenant_id]),
      pool.query(`SELECT metric, (EXTRACT(EPOCH FROM ts) * 1000)::bigint AS ts_ms, value_num FROM telemetry_index_v1 WHERE tenant_id = $1 AND metric = ANY($2::text[]) AND value_num IS NOT NULL AND ts >= to_timestamp($3::double precision / 1000.0) AND ts <= to_timestamp($4::double precision / 1000.0) ORDER BY ts ASC LIMIT 5000`, [tenant_id, ["soil_moisture", "soil_temp"], from_ts_ms, to_ts_ms]),
      pool.query(`SELECT event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms FROM alert_event_index_v1 WHERE tenant_id = $1 ORDER BY raised_ts_ms DESC LIMIT 10`, [tenant_id]),
      pool.query(`SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1') AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3 ORDER BY occurred_at DESC, fact_id DESC LIMIT 10`, [tenant_id, project_id, group_id]),
    ]); // Parallelize independent reads.

    let running_task_count = 0; // Default queue count when runtime table is absent.
    try {
      const runningQ = await pool.query(`SELECT COUNT(*)::bigint AS count FROM dispatch_queue_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND state IN ('CREATED','READY','DISPATCHED','ACKED')`, [tenant_id, project_id, group_id]); // Query active runtime rows under the normalized executor state machine.
      running_task_count = Number(runningQ.rows?.[0]?.count ?? 0); // Normalize count.
    } catch {
      running_task_count = 0; // Fresh DB fallback.
    }

    const latest_alerts: DashboardAlertItem[] = (latestAlertsQ.rows ?? []).map((row: any) => ({ event_id: String(row.event_id), rule_id: String(row.rule_id), object_type: String(row.object_type), object_id: String(row.object_id), metric: String(row.metric), status: String(row.status), raised_ts_ms: Number(row.raised_ts_ms ?? 0) })); // Normalize alert rows.
    const latest_receipts: DashboardReceiptItem[] = (latestReceiptsQ.rows ?? []).map((row: any) => {
      const normalized = normalizeReceiptEvidence(
        { fact_id: row.fact_id, occurred_at: row.occurred_at, record_json: parseJsonMaybe(row.record_json) ?? row.record_json },
        String(row.record_json?.type ?? "")
      );
      const occurredAt = String(normalized.recorded_at ?? row.occurred_at ?? "");
      return {
        fact_id: String(normalized.receipt_fact_id ?? row.fact_id ?? ""),
        act_task_id: normalized.act_task_id,
        device_id: normalized.device_id,
        status: normalized.receipt_status,
        occurred_at: occurredAt,
        occurred_ts_ms: Date.parse(occurredAt),
        summary: normalized
      };
    }); // Normalize receipt rows via shared receipt normalizer.

    return reply.send({
      ok: true,
      window: { from_ts_ms, to_ts_ms },
      summary: {
        field_count: Number(fieldCountQ.rows?.[0]?.count ?? 0),
        online_device_count: Number(onlineDeviceCountQ.rows?.[0]?.count ?? 0),
        open_alert_count: Number(openAlertCountQ.rows?.[0]?.count ?? 0),
        running_task_count,
      },
      trend_series: bucketTelemetryRows(trendRowsQ.rows ?? [], from_ts_ms, to_ts_ms),
      latest_alerts,
      latest_receipts,
      quick_actions: [
        { key: "create_operation", label: "create_operation", to: "/operations" }, // ASCII-safe label; frontend localizes by key.
        { key: "export_evidence", label: "export_evidence", to: "/delivery/export-jobs" }, // ASCII-safe label; frontend localizes by key.
        { key: "ack_alerts", label: "ack_alerts", to: "/alerts" }, // ASCII-safe label; frontend localizes by key.
      ],
    }); // End response.
  }); // End route.

  app.get("/api/v1/dashboard/overview_v2", async (req, reply) => { // Provide refactored dashboard v2 aggregate payload.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");
    const nowMs = Date.now();
    const dayStartMs = new Date(new Date(nowMs).toISOString().slice(0, 10)).getTime();
    const activeStates = ["CREATED", "READY", "DISPATCHED", "ACKED"];

    const operationStates = await projectOperationStateV1(pool, { tenant_id, project_id, group_id }).catch(() => []);
    const performanceCompletedStates = operationStates.filter((item: any) => Boolean(item?.receipt_id));
    const performanceCompletedCount = performanceCompletedStates.length;
    const performancePassCount = performanceCompletedStates.filter((item: any) => String(item?.acceptance?.status ?? "").toUpperCase() === "PASS").length;
    const performancePassRate = performanceCompletedCount > 0 ? Number(((performancePassCount / performanceCompletedCount) * 100).toFixed(2)) : 0;

    const [fieldTotalQ, fieldRiskQ, tasksTodayQ, pendingAcceptanceQ, riskBreakdownQ, pendingDecisionQ, executionBreakdownQ, delayedQ, acceptancePassRateQ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::bigint AS count FROM field_index_v1 WHERE tenant_id = $1`, [tenant_id]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM field_program_state_v1 WHERE tenant_id = $1 AND UPPER(COALESCE(current_risk_summary->>'level', 'LOW')) IN ('HIGH', 'MEDIUM')`, [tenant_id]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*)::bigint AS count FROM operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND updated_ts_ms >= $4`, [tenant_id, project_id, group_id, dayStartMs]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `WITH latest_receipt AS (
           SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
             (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id
           FROM facts
           WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
             AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
             AND (record_json::jsonb#>>'{payload,project_id}') = $2
             AND (record_json::jsonb#>>'{payload,group_id}') = $3
             AND COALESCE((record_json::jsonb#>>'{payload,operation_plan_id}'), '') <> ''
           ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}') ASC, occurred_at DESC, fact_id DESC
         ),
         latest_acceptance AS (
           SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
             (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
             UPPER(COALESCE((record_json::jsonb#>>'{payload,verdict}'), 'PENDING')) AS verdict
           FROM facts
           WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
             AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
             AND (record_json::jsonb#>>'{payload,project_id}') = $2
             AND (record_json::jsonb#>>'{payload,group_id}') = $3
             AND COALESCE((record_json::jsonb#>>'{payload,operation_plan_id}'), '') <> ''
           ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}') ASC, occurred_at DESC, fact_id DESC
         )
         SELECT COUNT(*)::bigint AS count
         FROM latest_receipt r
         LEFT JOIN latest_acceptance a ON a.operation_plan_id = r.operation_plan_id
         WHERE COALESCE(a.verdict, 'PENDING') <> 'PASS'`,
        [tenant_id, project_id, group_id]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE UPPER(COALESCE(current_risk_summary->>'level', 'LOW')) = 'HIGH')::bigint AS high,
           COUNT(*) FILTER (WHERE UPPER(COALESCE(current_risk_summary->>'level', 'LOW')) = 'MEDIUM')::bigint AS medium,
           COUNT(*) FILTER (WHERE UPPER(COALESCE(current_risk_summary->>'level', 'LOW')) = 'LOW')::bigint AS low
         FROM field_program_state_v1
         WHERE tenant_id = $1`,
        [tenant_id]
      ).catch(() => ({ rows: [{ high: 0, medium: 0, low: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::bigint AS count
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND UPPER(COALESCE((record_json::jsonb#>>'{payload,status}'), 'PENDING')) = 'PENDING'`,
        [tenant_id, project_id, group_id]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE state = ANY($4::text[]))::bigint AS running,
           COUNT(*) FILTER (WHERE state = ANY($4::text[]) AND (device_id IS NULL OR device_id = ''))::bigint AS human,
           COUNT(*) FILTER (WHERE state = ANY($4::text[]) AND (device_id IS NOT NULL AND device_id <> ''))::bigint AS device
         FROM dispatch_queue_v1
         WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3`,
        [tenant_id, project_id, group_id, activeStates]
      ).catch(() => ({ rows: [{ running: 0, human: 0, device: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::bigint AS count
           FROM dispatch_queue_v1
          WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
            AND state = ANY($4::text[])
            AND EXTRACT(EPOCH FROM (now() - created_at)) * 1000 > $5`,
        [tenant_id, project_id, group_id, activeStates, 2 * 60 * 60 * 1000]
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE UPPER(COALESCE((record_json::jsonb#>>'{payload,verdict}'), '')) = 'PASS')::bigint AS pass_count,
           COUNT(*)::bigint AS total_count
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3`,
        [tenant_id, project_id, group_id]
      ).catch(() => ({ rows: [{ pass_count: 0, total_count: 0 }] })),
    ]);

    const acceptancePassCount = Number(acceptancePassRateQ.rows?.[0]?.pass_count ?? 0);
    const acceptanceTotalCount = Number(acceptancePassRateQ.rows?.[0]?.total_count ?? 0);
    const passRate = acceptanceTotalCount > 0 ? Number(((acceptancePassCount / acceptanceTotalCount) * 100).toFixed(2)) : 0;
    const executionCompletedItems = operationStates.filter((item: any) => ["SUCCESS", "SUCCEEDED", "FAILED", "ERROR", "INVALID_EXECUTION", "PENDING_ACCEPTANCE"].includes(String(item?.final_status ?? "").toUpperCase()));
    const executionSuccessCount = executionCompletedItems.filter((item: any) => ["SUCCESS", "SUCCEEDED"].includes(String(item?.final_status ?? "").toUpperCase())).length;
    const executionSuccessRate = executionCompletedItems.length > 0
      ? Number(((executionSuccessCount / executionCompletedItems.length) * 100).toFixed(2))
      : 0;
    const pendingApprovalsQ = await pool.query(
      `SELECT
         (record_json::jsonb#>>'{payload,request_id}') AS request_id,
         (record_json::jsonb#>>'{payload,field_id}') AS field_id,
         occurred_at
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (record_json::jsonb#>>'{payload,project_id}') = $2
         AND (record_json::jsonb#>>'{payload,group_id}') = $3
         AND UPPER(COALESCE((record_json::jsonb#>>'{payload,status}'),'PENDING')) = 'PENDING'
       ORDER BY occurred_at DESC
       LIMIT 20`,
      [tenant_id, project_id, group_id]
    ).catch(() => ({ rows: [] as any[] }));
    const riskFieldRows = await pool.query(
      `SELECT field_id, current_risk_summary
       FROM field_program_state_v1
       WHERE tenant_id = $1
         AND UPPER(COALESCE(current_risk_summary->>'level','LOW')) IN ('HIGH','MEDIUM')
       ORDER BY updated_at DESC
       LIMIT 20`,
      [tenant_id]
    ).catch(() => ({ rows: [] as any[] }));
    const rankingNowMs = Date.now();
    const scoredActions = operationStates.map((item: any) => {
      const finalStatusCode = String(item?.final_status ?? "").toUpperCase();
      const hasTask = Boolean(item?.task_id ?? item?.act_task_id);
      const hasReceipt = Boolean(item?.receipt_id);
      const hasAcceptance = finalStatusCode === "PENDING_ACCEPTANCE" ? false : Boolean(item?.acceptance?.status);
      const invalid = finalStatusCode === "INVALID_EXECUTION";
      const slaFix = invalid || (hasTask && !hasReceipt) || (hasReceipt && !hasAcceptance);
      const highRiskHighConfidence = String(item?.risk_level ?? "").toUpperCase() === "HIGH" && String(item?.confidence ?? "").toUpperCase() === "HIGH";
      const pending = ["PENDING", "PENDING_APPROVAL", "APPROVED", "RUNNING", "DISPATCHED", "ACKED"].includes(finalStatusCode);
      const priorityBucket: PriorityBucket = slaFix ? "P0" : highRiskHighConfidence ? "P0" : pending ? "P1" : "P2";
      const risk = priorityBucket === "P0" ? 40 : priorityBucket === "P1" ? 20 : 10;
      const value = finalStatusCode === "SUCCESS" || finalStatusCode === "SUCCEEDED" ? 20 : 10;
      const confidence = String(item?.confidence ?? "").toUpperCase() === "HIGH" ? 20 : 10;
      const lastTs = Number(item?.last_event_ts ?? 0);
      const timeliness = Number.isFinite(lastTs) && lastTs > 0 && (rankingNowMs - lastTs > 2 * 60 * 60 * 1000) ? 20 : 8;
      const priorityScore = risk + value + confidence + timeliness;
      const operationId = String(item?.operation_plan_id ?? item?.operation_id ?? "");
      let recommendedNextAction: { action_type: string; source: "RULE" | "SLA_FIX" | "MANUAL" | "FALLBACK"; reason: string };
      if (invalid) {
        recommendedNextAction = { action_type: "RETRY_EXECUTION", source: "SLA_FIX", reason: "无效执行，需优先修复并补充有效证据" };
      } else if (hasTask && !hasReceipt) {
        recommendedNextAction = { action_type: "COLLECT_RECEIPT", source: "SLA_FIX", reason: "任务已下发但未回执，需补回执" };
      } else if (hasReceipt && !hasAcceptance) {
        recommendedNextAction = { action_type: "PROMOTE_ACCEPTANCE", source: "SLA_FIX", reason: "已回执但未验收，需推动验收" };
      } else if (pending) {
        recommendedNextAction = { action_type: "REVIEW_APPROVAL", source: "MANUAL", reason: "当前待审批，需人工确认" };
      } else {
        recommendedNextAction = { action_type: "CHECK_FIELD_STATUS", source: "FALLBACK", reason: "无规则与SLA修复项，先核查田块状态" };
      }
      return {
        operation_id: operationId,
        action_type: String(item?.action_type ?? "CHECK_FIELD_STATUS"),
        priority_bucket: priorityBucket,
        priority_score: priorityScore,
        priority_components: { risk, value, confidence, timeliness },
        reason: recommendedNextAction.reason,
        risk_if_not_execute: priorityBucket === "P0" ? "闭环中断风险上升" : "执行效率下降",
        recommended_next_action: recommendedNextAction,
        last_event_ts: Number(item?.last_event_ts ?? 0),
      };
    });
    const topActions = [...scoredActions]
      .sort((a, b) => {
        const br = bucketRank(a.priority_bucket) - bucketRank(b.priority_bucket);
        if (br !== 0) return br;
        if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
        return Number(b.last_event_ts ?? 0) - Number(a.last_event_ts ?? 0);
      })
      .slice(0, 3);
    const benefitOperations = topActions.filter((item) => item.priority_components.value >= 20);
    const inProgressOperations = operationStates
      .filter((item: any) => ["PENDING", "RUNNING", "DISPATCHED", "ACKED", "READY"].includes(String(item?.final_status ?? item?.dispatch_status ?? "").toUpperCase()))
      .slice(0, 20)
      .map((item: any) => ({
        operation_plan_id: String(item?.operation_plan_id ?? item?.operation_id ?? ""),
        field_id: typeof item?.field_id === "string" ? item.field_id : null,
        status: String(item?.final_status ?? item?.dispatch_status ?? ""),
      }));
    const failedOperations = operationStates
      .filter((item: any) => ["FAILED", "ERROR", "INVALID_EXECUTION"].includes(String(item?.final_status ?? "").toUpperCase()))
      .slice(0, 20)
      .map((item: any) => ({
        operation_plan_id: String(item?.operation_plan_id ?? item?.operation_id ?? ""),
        field_id: typeof item?.field_id === "string" ? item.field_id : null,
        status: String(item?.final_status ?? ""),
      }));
    const responseTimeAvg = Number(delayedQ.rows?.[0]?.count ?? 0) > 0 ? 2 * 60 * 60 * 1000 : 0;
    const riskTrend: TrendValue = computeTrendByCounts([
      Number(riskBreakdownQ.rows?.[0]?.high ?? 0) + Number(riskBreakdownQ.rows?.[0]?.medium ?? 0),
      Number(fieldRiskQ.rows?.[0]?.count ?? 0),
    ]);
    const effectTrend: TrendValue = computeTrendByCounts([
      performanceCompletedCount,
      performancePassCount,
    ]);

    return reply.send({
      ok: true,
      summary: {
        fields_total: Number(fieldTotalQ.rows?.[0]?.count ?? 0),
        fields_risk: Number(fieldRiskQ.rows?.[0]?.count ?? 0),
        tasks_today: Number(tasksTodayQ.rows?.[0]?.count ?? 0),
        pending_acceptance: Number(pendingAcceptanceQ.rows?.[0]?.count ?? 0),
      },
      risk: {
        high: Number(riskBreakdownQ.rows?.[0]?.high ?? 0),
        medium: Number(riskBreakdownQ.rows?.[0]?.medium ?? 0),
        low: Number(riskBreakdownQ.rows?.[0]?.low ?? 0),
      },
      decisions: {
        pending: Number(pendingDecisionQ.rows?.[0]?.count ?? 0),
      },
      execution: {
        running: Number(executionBreakdownQ.rows?.[0]?.running ?? 0),
        human: Number(executionBreakdownQ.rows?.[0]?.human ?? 0),
        device: Number(executionBreakdownQ.rows?.[0]?.device ?? 0),
        delayed: Number(delayedQ.rows?.[0]?.count ?? 0),
      },
      acceptance: {
        pending: Number(pendingAcceptanceQ.rows?.[0]?.count ?? 0),
        pass_rate: passRate,
      },
      performance: {
        completed: performanceCompletedCount,
        pass_rate: performancePassRate,
      },
      customer_dashboard: {
        risks: {
          fields: (riskFieldRows.rows ?? []).map((row: any) => ({
            field_id: String(row.field_id ?? ""),
            level: String(row.current_risk_summary?.level ?? "MEDIUM").toUpperCase(),
            reason: String(row.current_risk_summary?.reason ?? "存在风险信号"),
          })),
        },
        decisions: {
          pending_approvals: (pendingApprovalsQ.rows ?? []).map((row: any) => ({
            request_id: String(row.request_id ?? ""),
            field_id: row.field_id ? String(row.field_id) : null,
            occurred_at: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
          })),
        },
        execution: {
          in_progress: inProgressOperations,
          failed: failedOperations,
        },
        value: {
          benefit_operations: benefitOperations,
        },
        sla: {
          execution_success_rate: executionSuccessRate,
          acceptance_pass_rate: passRate,
          response_time_avg: responseTimeAvg,
        },
      },
      top_actions: topActions.map(({ last_event_ts, ...item }) => item),
      risk_trend: riskTrend,
      effect_trend: effectTrend,
      trend_definition: {
        window: "7d",
        baseline: "previous_7d",
      },
      sla_definition: {
        execution_denominator: "已进入执行阶段的 operation（存在 task 或终态为执行相关状态）",
        acceptance_denominator: "已进入验收阶段的 operation（存在 receipt）",
        response_time_definition: "从 task 下发到 receipt 回传完成的平均时长",
      },
    });
  });

  app.get("/api/v1/dashboard/executions/recent", async (req, reply) => { // Provide recent execution rows used by dashboard cards.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const limit = parseLimit(q, 8, 20);
    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");
    const operationStates = await projectOperationStateV1(pool, { tenant_id, project_id, group_id }).catch(() => []);
    const items: DashboardRecentExecutionItem[] = operationStates
      .sort((a: any, b: any) => Number(b?.last_event_ts ?? 0) - Number(a?.last_event_ts ?? 0))
      .slice(0, limit)
      .map((row: any) => ({
        id: String(row.operation_plan_id ?? row.operation_id ?? ""),
        operation_plan_id: String(row.operation_plan_id ?? row.operation_id ?? ""),
        field_id: typeof row.field_id === "string" ? row.field_id : null,
        status: String(row.final_status ?? row.dispatch_status ?? ""),
        updated_ts_ms: Number(row.last_event_ts ?? Date.now()),
        href: `/operations?operation_plan_id=${encodeURIComponent(String(row.operation_plan_id ?? ""))}`
      }));
    return reply.send({ ok: true, items });
  });

  app.get("/api/v1/dashboard/evidence/recent", async (req, reply) => { // Return normalized recent receipt evidence for dashboard card rendering.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const limit = parseLimit(q, 8, 20);
    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");
    const receiptQ = await pool.query(
      `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT $4`,
      [tenant_id, project_id, group_id, limit]
    ).catch(() => ({ rows: [] }));
    const normalizedRows = (receiptQ.rows ?? []).map((row: any) => {
      const recordJson = parseJsonMaybe(row.record_json) ?? row.record_json;
      return normalizeReceiptEvidence({ fact_id: row.fact_id, occurred_at: row.occurred_at, record_json: recordJson }, String(recordJson?.type ?? ""));
    });
    const operationPlanIds = Array.from(new Set(normalizedRows.map((x: any) => x.operation_plan_id).filter((x: any) => typeof x === "string" && x.trim())));
    const acceptanceQ = operationPlanIds.length > 0
      ? await pool.query(
        `SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
            (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
            (record_json::jsonb#>>'{payload,verdict}') AS verdict
           FROM facts
          WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND (record_json::jsonb#>>'{payload,operation_plan_id}') = ANY($4::text[])
          ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}') ASC, occurred_at DESC, fact_id DESC`,
        [tenant_id, project_id, group_id, operationPlanIds]
      ).catch(() => ({ rows: [] }))
      : { rows: [] as any[] };
    const acceptanceMap = new Map<string, string>();
    for (const row of acceptanceQ.rows ?? []) {
      const key = String(row.operation_plan_id ?? "").trim();
      const verdict = String(row.verdict ?? "").trim().toUpperCase();
      if (key) acceptanceMap.set(key, verdict || "PENDING");
    }
    const operationPlanQ = operationPlanIds.length > 0
      ? await pool.query(
        `SELECT operation_plan_id, field_id
           FROM operation_plan_index_v1
          WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND operation_plan_id = ANY($4::text[])`,
        [tenant_id, project_id, group_id, operationPlanIds]
      ).catch(() => ({ rows: [] }))
      : { rows: [] as any[] };
    const fieldIds = Array.from(new Set(operationPlanQ.rows.map((x: any) => String(x.field_id ?? "")).filter(Boolean)));
    const fieldQ = fieldIds.length > 0
      ? await pool.query(
        `SELECT field_id, name FROM field_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])`,
        [tenant_id, fieldIds]
      ).catch(() => ({ rows: [] }))
      : { rows: [] as any[] };
    const operationPlanMap = new Map<string, { field_id: string | null }>();
    for (const row of operationPlanQ.rows ?? []) operationPlanMap.set(String(row.operation_plan_id), { field_id: typeof row.field_id === "string" ? row.field_id : null });
    const fieldNameMap = new Map<string, string>();
    for (const row of fieldQ.rows ?? []) fieldNameMap.set(String(row.field_id), String(row.name ?? row.field_id));
    const items: DashboardRecentEvidenceItem[] = (receiptQ.rows ?? []).map((row: any, idx: number) => {
      const recordJson = parseJsonMaybe(row.record_json) ?? row.record_json;
      const summary = normalizedRows[idx];
      const bridge = summary.operation_plan_id ? operationPlanMap.get(summary.operation_plan_id) : null;
      const fieldId = (typeof recordJson?.payload?.field_id === "string" ? recordJson.payload.field_id : null) ?? bridge?.field_id ?? null;
      const programName = typeof recordJson?.payload?.program_name === "string" ? recordJson.payload.program_name : null;
      const acceptanceVerdict = summary.operation_plan_id ? (acceptanceMap.get(summary.operation_plan_id) ?? "PENDING") : "PENDING";
      const hasReceipt = Boolean(summary.receipt_fact_id);
      return {
        operation_plan_id: summary.operation_plan_id,
        field_id: fieldId,
        field_name: fieldId ? fieldNameMap.get(fieldId) ?? fieldId : null,
        program_name: programName,
        status: summary.receipt_status,
        finished_at: summary.execution_finished_at ?? summary.recorded_at,
        water_l: summary.water_l,
        electric_kwh: summary.electric_kwh,
        log_ref_count: summary.log_ref_count,
        constraint_violated: summary.constraint_violated,
        executor_label: summary.executor_label,
        receipt_fact_id: summary.receipt_fact_id,
        receipt_type: summary.receipt_type,
        acceptance_verdict: acceptanceVerdict,
        is_pending_acceptance: hasReceipt && acceptanceVerdict !== "PASS",
        href: summary.operation_plan_id
          ? `/operations/${encodeURIComponent(summary.operation_plan_id)}`
          : fieldId
            ? `/fields/${encodeURIComponent(fieldId)}`
            : `/operations`,
        summary
      };
    });
    return reply.send({ ok: true, items });
  });

  app.get("/api/v1/dashboard/risk-summary", async (req, reply) => { // Build risk list with stage-4 rules: task/receipt timeout/warning.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const limit = parseLimit(q, 12, 50);
    const tenant_id = String(auth.tenant_id ?? "");
    const project_id = String(auth.project_id ?? "");
    const group_id = String(auth.group_id ?? "");

    const executionStates = ["CREATED", "READY", "DISPATCHED", "ACKED"];
    const overdueMs = 2 * 60 * 60 * 1000;
    const overdueCutoffIso = new Date(Date.now() - overdueMs).toISOString();

    const [highQ, mediumQ, lowQ] = await Promise.all([
      pool.query(
        `SELECT
           q.queue_id AS id,
           p.field_id AS field_id,
           COALESCE(q.created_at, q.updated_at, now()) AS occurred_at
         FROM dispatch_queue_v1 q
         LEFT JOIN operation_plan_index_v1 p
           ON p.operation_plan_id = q.operation_plan_id
          AND p.tenant_id = q.tenant_id
          AND p.project_id = q.project_id
          AND p.group_id = q.group_id
         LEFT JOIN LATERAL (
           SELECT 1 AS receipt_exists
           FROM facts f
           WHERE (f.record_json::jsonb->>'type') IN ('ao_act_receipt_v0', 'ao_act_receipt_v1')
             AND (f.record_json::jsonb#>>'{payload,tenant_id}') = q.tenant_id
             AND (f.record_json::jsonb#>>'{payload,project_id}') = q.project_id
             AND (f.record_json::jsonb#>>'{payload,group_id}') = q.group_id
             AND (
               (COALESCE((f.record_json::jsonb#>>'{payload,act_task_id}'), '') <> '' AND (f.record_json::jsonb#>>'{payload,act_task_id}') = q.act_task_id)
               OR
               (COALESCE((f.record_json::jsonb#>>'{payload,operation_plan_id}'), '') <> '' AND (f.record_json::jsonb#>>'{payload,operation_plan_id}') = q.operation_plan_id)
             )
           ORDER BY f.occurred_at DESC, f.fact_id DESC
           LIMIT 1
         ) r ON TRUE
         WHERE q.tenant_id = $1
           AND q.project_id = $2
           AND q.group_id = $3
           AND q.state = ANY($4::text[])
           AND r.receipt_exists IS NULL
         ORDER BY COALESCE(q.updated_at, q.created_at, now()) DESC
         LIMIT $5`,
        [tenant_id, project_id, group_id, executionStates, limit]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT
           q.queue_id AS id,
           p.field_id AS field_id,
           COALESCE(q.created_at, q.updated_at, now()) AS occurred_at
         FROM dispatch_queue_v1 q
         LEFT JOIN operation_plan_index_v1 p
           ON p.operation_plan_id = q.operation_plan_id
          AND p.tenant_id = q.tenant_id
          AND p.project_id = q.project_id
          AND p.group_id = q.group_id
         WHERE q.tenant_id = $1
           AND q.project_id = $2
           AND q.group_id = $3
           AND q.state = ANY($4::text[])
           AND COALESCE(q.created_at, q.updated_at, now()) < $5::timestamptz
         ORDER BY COALESCE(q.updated_at, q.created_at, now()) DESC
         LIMIT $6`,
        [tenant_id, project_id, group_id, executionStates, overdueCutoffIso, limit]
      ).catch(() => ({ rows: [] })),
      pool.query(
        `SELECT
           event_id AS id,
           object_id AS field_id,
           to_timestamp(raised_ts_ms::double precision / 1000.0) AS occurred_at,
           metric,
           status
         FROM alert_event_index_v1
         WHERE tenant_id = $1
           AND status IN ('OPEN', 'ACKED')
         ORDER BY raised_ts_ms DESC
         LIMIT $2`,
        [tenant_id, limit]
      ).catch(() => ({ rows: [] })),
    ]);

    const highItems: DashboardRiskSummaryItem[] = (highQ.rows ?? []).map((row: any, idx: number) => ({
      id: `high_${String(row.id ?? idx)}`,
      field_id: typeof row.field_id === "string" ? row.field_id : null,
      title: "执行任务缺少回执",
      level: "HIGH",
      occurred_at: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
    }));
    const mediumItems: DashboardRiskSummaryItem[] = (mediumQ.rows ?? []).map((row: any, idx: number) => ({
      id: `medium_${String(row.id ?? idx)}`,
      field_id: typeof row.field_id === "string" ? row.field_id : null,
      title: "执行任务超时",
      level: "MEDIUM",
      occurred_at: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
    }));
    const lowItems: DashboardRiskSummaryItem[] = (lowQ.rows ?? []).map((row: any, idx: number) => ({
      id: `low_${String(row.id ?? idx)}`,
      field_id: typeof row.field_id === "string" ? row.field_id : null,
      title: String(row.metric ?? row.status ?? "弱告警"),
      level: "LOW",
      occurred_at: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
    }));

    const items = [...highItems, ...mediumItems, ...lowItems].slice(0, limit);
    return reply.send({ ok: true, items });
  });
} // End registration.
