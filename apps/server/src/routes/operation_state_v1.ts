import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectOperationStateV1 } from "../projections/operation_state_v1";
import { projectRecommendationStateV1 } from "../projections/recommendation_state_v1";
import { projectDeviceStateV1 } from "../projections/device_state_v1";
import { normalizeReceiptEvidence } from "../services/receipt_evidence";
import { evaluateEvidence } from "../domain/acceptance/evidence_policy";
import { deriveBusinessEffect } from "../domain/agronomy/business_effect";
import { computeCostBreakdown } from "../domain/agronomy/cost_model";
import { computeEffect } from "../domain/agronomy/effect_engine";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; source: string | null; record_json: any };

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id)
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const x = v.trim();
    return x ? repairMojibakeText(x) : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function repairMojibakeText(input: string): string {
  const text = String(input ?? "");
  if (!text) return text;
  const suspicious = /[ÃÂâ][\x80-\xBF]?|å|ç|æ|ï|ð/.test(text);
  if (!suspicious) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (/[\u4e00-\u9fff]/.test(repaired)) return repaired;
  } catch {
    return text;
  }
  return text;
}

function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const x = Date.parse(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function normalizeDeviceId(v: unknown): string | null {
  const raw = toText(v);
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "dev_unknown" || normalized === "unknown") return "unknown";
  return raw;
}

type OperationMetricsSnapshot = {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
};

function metricValueFromRows(rows: any[], names: string[]): number | undefined {
  for (const row of rows) {
    const metric = String(row?.metric ?? "").trim().toLowerCase();
    if (!names.includes(metric)) continue;
    const value = Number(row?.value_num ?? NaN);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function buildMetricsSnapshot(rows: any[]): OperationMetricsSnapshot {
  const normalized = Array.isArray(rows) ? rows : [];
  const soilMoisture = metricValueFromRows(normalized, ["soil_moisture"]);
  const temperature = metricValueFromRows(normalized, ["temperature", "air_temperature", "soil_temp", "soil_temp_c"]);
  const humidity = metricValueFromRows(normalized, ["humidity", "air_humidity"]);
  const out: OperationMetricsSnapshot = {};
  if (soilMoisture !== undefined) out.soil_moisture = soilMoisture;
  if (temperature !== undefined) out.temperature = temperature;
  if (humidity !== undefined) out.humidity = humidity;
  return out;
}

function toExpectedEffect(recPayload: any): { type: "moisture_increase" | "growth_boost"; value: number } | null {
  const payload = recPayload && typeof recPayload === "object" ? recPayload : {};
  const candidate = payload.expected_effect ?? payload?.suggested_action?.parameters?.expected_effect ?? null;
  const typeRaw = String(candidate?.type ?? "").trim().toLowerCase();
  const value = Number(candidate?.value ?? NaN);
  if ((typeRaw === "moisture_increase" || typeRaw === "growth_boost") && Number.isFinite(value)) {
    return { type: typeRaw, value };
  }
  const fallbackValue = Number(payload?.suggested_action?.parameters?.expected_moisture_increase ?? NaN);
  if (Number.isFinite(fallbackValue)) return { type: "moisture_increase", value: fallbackValue };
  return null;
}

function hasExecutedReceiptStatus(statusRaw: unknown): boolean {
  const status = String(statusRaw ?? "").trim().toUpperCase();
  if (!status) return false;
  return ["DONE", "SUCCEEDED", "SUCCESS", "EXECUTED", "ACKED"].includes(status);
}

function statusLabel(s: string | null): string {
  const code = String(s ?? "").trim().toUpperCase();
  if (!code) return "待推进";
  if (code === "PENDING_ACCEPTANCE") return "待验收";
  if (code === "INVALID_EXECUTION") return "执行无效";
  if (["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED"].includes(code)) return "执行成功";
  if (["FAILED", "ERROR", "NOT_EXECUTED", "REJECTED"].includes(code)) return "执行失败";
  if (["RUNNING", "DISPATCHED", "ACKED", "APPROVED", "READY", "IN_PROGRESS"].includes(code)) return "执行中";
  if (["PENDING", "CREATED", "PROPOSED", "PENDING_APPROVAL"].includes(code)) return "待审批";
  return code;
}

type CustomerViewStatus = "PENDING_APPROVAL" | "IN_PROGRESS" | "PENDING_RECEIPT" | "PENDING_ACCEPTANCE" | "COMPLETED" | "INVALID_EXECUTION";

function resolveCustomerViewStatus(input: {
  final_status: string | null;
  has_approval: boolean;
  has_task: boolean;
  has_receipt: boolean;
  has_acceptance: boolean;
  invalid_execution: boolean;
}): CustomerViewStatus {
  if (input.invalid_execution) return "INVALID_EXECUTION";
  const finalStatus = String(input.final_status ?? "").trim().toUpperCase();
  if (!input.has_approval && !input.has_task) return "PENDING_APPROVAL";
  if (["SUCCEEDED", "SUCCESS", "DONE", "EXECUTED"].includes(finalStatus) || input.has_acceptance) return "COMPLETED";
  if (finalStatus === "PENDING_ACCEPTANCE") return "PENDING_ACCEPTANCE";
  if (input.has_receipt) return "PENDING_ACCEPTANCE";
  if (input.has_task && !input.has_receipt) return "PENDING_RECEIPT";
  return "IN_PROGRESS";
}

function customerViewByStatus(status: CustomerViewStatus): { summary: string; today_action: string; risk_level: "low" | "medium" | "high" } {
  switch (status) {
    case "PENDING_APPROVAL":
      return {
        summary: "当前建议待审批，尚未进入执行阶段",
        today_action: "下一步：等待审批",
        risk_level: "medium",
      };
    case "IN_PROGRESS":
      return {
        summary: "作业执行中，系统正在持续采集进度",
        today_action: "保持设备在线并关注执行状态",
        risk_level: "medium",
      };
    case "PENDING_RECEIPT":
      return {
        summary: "作业已下发，等待回执数据",
        today_action: "督促执行端回传回执与证据",
        risk_level: "medium",
      };
    case "PENDING_ACCEPTANCE":
      return {
        summary: "已收到执行数据，待验收确认",
        today_action: "下一步：进入验收",
        risk_level: "low",
      };
    case "COMPLETED":
      return {
        summary: "作业已完成并形成闭环",
        today_action: "继续观察效果并归档证据",
        risk_level: "low",
      };
    case "INVALID_EXECUTION":
    default:
      return {
        summary: "本次作业未被系统认定为有效执行",
        today_action: "需重新执行或补充证据",
        risk_level: "high",
      };
  }
}


function cleanJsonText(v: unknown, fallback: string): string {
  const raw = toText(v) ?? fallback;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function toEvidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanJsonText(item, ""))
    .filter((item) => item.length > 0)
    .slice(0, 50);
}

function buildInvalidExecutionReport(op: any) {
  return {
    type: "invalid_execution_report_v1",
    summary: cleanJsonText("operation execution was invalid", "operation execution was invalid"),
    root_cause: cleanJsonText(op?.failure_reason ?? op?.invalid_reason, "unknown reason"),
    risk: cleanJsonText("possible yield loss or resource waste", "possible yield loss or resource waste"),
    recommendation: cleanJsonText("rerun operation and inspect device state", "rerun operation and inspect device state"),
    evidence_refs: toEvidenceRefs(op?.evidence_refs)
  };
}

function isInvalidExecutionOperation(op: any): boolean {
  const finalStatus = String(op?.final_status ?? "").trim().toUpperCase();
  const statusLabel = String(op?.status_label ?? "").trim();
  return finalStatus === "INVALID_EXECUTION" || finalStatus.includes("INVALID") || statusLabel.includes("执行无效");
}

function mapExportJobStatusLabel(s: string | null): string {
  const code = String(s ?? "").trim().toUpperCase();
  if (!code) return "未开始";
  if (code === "DONE") return "已完成";
  if (code === "RUNNING") return "执行中";
  if (code === "QUEUED") return "排队中";
  if (code === "ERROR") return "失败";
  return code;
}

async function queryFactsForOperation(pool: Pool, tenant: TenantTriple, operationPlanId: string): Promise<FactRow[]> {
  const sql = `
    SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
    FROM facts
    WHERE (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND (
        (record_json::jsonb->>'type') = 'operation_plan_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
        OR (record_json::jsonb->>'type') = 'operation_plan_transition_v1' AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
      )
    ORDER BY occurred_at ASC, fact_id ASC
  `;
  const base = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]);
  const rows: FactRow[] = (base.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    source: typeof row.source === "string" ? row.source : null,
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
  const latestPlan = [...rows].reverse().find((x) => x.record_json?.type === "operation_plan_v1");
  const planPayload = latestPlan?.record_json?.payload ?? {};
  const approvalRequestId = toText(planPayload.approval_request_id);
  const recommendationId = toText(planPayload.recommendation_id);
  const taskId = toText(planPayload.act_task_id);
  const q = async (type: string, keyPath: string, keyValue: string): Promise<FactRow[]> => {
    const r = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = $1
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
          AND (record_json::jsonb#>>'{payload,project_id}') = $3
          AND (record_json::jsonb#>>'{payload,group_id}') = $4
          AND (record_json::jsonb#>>'{payload,${keyPath}}') = $5
        ORDER BY occurred_at ASC, fact_id ASC`,
      [type, tenant.tenant_id, tenant.project_id, tenant.group_id, keyValue]
    );
    return (r.rows ?? []).map((row: any) => ({
      fact_id: String(row.fact_id ?? ""),
      occurred_at: String(row.occurred_at ?? ""),
      source: typeof row.source === "string" ? row.source : null,
      record_json: parseRecordJson(row.record_json) ?? row.record_json
    }));
  };
  const extra: FactRow[] = [];
  if (approvalRequestId) extra.push(...await q("approval_request_v1", "request_id", approvalRequestId));
  if (approvalRequestId) extra.push(...await q("approval_decision_v1", "request_id", approvalRequestId));
  if (recommendationId) extra.push(...await q("decision_recommendation_v1", "recommendation_id", recommendationId));
  if (taskId) {
    extra.push(...await q("ao_act_task_v0", "act_task_id", taskId));
    extra.push(...await q("acceptance_result_v1", "act_task_id", taskId));
    const receiptByTask = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND ((record_json::jsonb#>>'{payload,act_task_id}') = $4 OR (record_json::jsonb#>>'{payload,task_id}') = $4)
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, taskId]
    );
    extra.push(...(receiptByTask.rows ?? []).map((row: any) => ({
      fact_id: String(row.fact_id ?? ""),
      occurred_at: String(row.occurred_at ?? ""),
      source: typeof row.source === "string" ? row.source : null,
      record_json: parseRecordJson(row.record_json) ?? row.record_json
    })));
  }
  extra.push(...await q("acceptance_result_v1", "operation_plan_id", operationPlanId));
  const all = [...rows, ...extra];
  all.sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));
  return all;
}

export function registerOperationStateV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operations/:operationPlanId/evidence-export", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operationPlanId = String((req.params as any)?.operationPlanId ?? "").trim();
    if (!operationPlanId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });

    const planQ = await pool.query(
      `SELECT record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
    );
    const planPayload = planQ.rows?.[0]?.record_json?.payload ?? {};
    const actTaskId = toText(planPayload?.act_task_id);

    const receiptQ = await pool.query(
      `SELECT 1
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}') = $2
            OR ($3::text IS NOT NULL AND ((record_json::jsonb#>>'{payload,act_task_id}') = $3 OR (record_json::jsonb#>>'{payload,task_id}') = $3))
          )
        LIMIT 1`,
      [tenant.tenant_id, operationPlanId, actTaskId]
    ).catch(() => ({ rowCount: 0 }));

    const exportFactQ = await pool.query(
      `SELECT occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'evidence_export_job_completed_v1'
          AND (record_json::jsonb#>>'{entity,tenant_id}') = $1
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}') = $2
            OR (record_json::jsonb#>'{payload,operation_plan_ids}') ? $2
            OR ($3::text IS NOT NULL AND (
              (record_json::jsonb#>>'{payload,act_task_id}') = $3
              OR (record_json::jsonb#>'{payload,act_task_ids}') ? $3
            ))
          )
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [tenant.tenant_id, operationPlanId, actTaskId]
    ).catch(() => ({ rowCount: 0, rows: [] }));

    const latestFact = exportFactQ.rows?.[0]?.record_json ?? null;
    const latestFactPayload = latestFact?.payload ?? {};
    const latestJobId = toText(latestFact?.entity?.job_id);
    const latestFactStatus = toText(latestFactPayload?.status);

    const indexQ = latestJobId
      ? await pool.query(
        `SELECT status, updated_ts_ms, artifact_path
           FROM evidence_export_job_index_v1
          WHERE tenant_id = $1 AND job_id = $2
          LIMIT 1`,
        [tenant.tenant_id, latestJobId]
      ).catch(() => ({ rowCount: 0, rows: [] }))
      : { rowCount: 0, rows: [] as any[] };
    const indexRow = indexQ.rows?.[0] ?? null;

    const latestStatusRaw = toText(indexRow?.status) ?? latestFactStatus;
    const isDone = String(latestStatusRaw ?? "").toUpperCase() === "DONE";
    const downloadUrl = latestJobId && isDone ? `/api/v1/evidence-export/jobs/${encodeURIComponent(latestJobId)}/download` : null;
    const artifactPath = toText(indexRow?.artifact_path) ?? toText(latestFactPayload?.artifact_path);
    const latestBundleName = artifactPath ? artifactPath.split("/").pop() : null;
    const latestExportedAt = indexRow?.updated_ts_ms != null
      ? new Date(Number(indexRow.updated_ts_ms)).toISOString()
      : (typeof exportFactQ.rows?.[0]?.occurred_at === "string" ? exportFactQ.rows[0].occurred_at : null);

    const missingReason = downloadUrl
      ? null
      : !actTaskId
        ? "MISSING_ACT_TASK_ID"
        : (receiptQ.rowCount ?? 0) < 1
          ? "NO_RECEIPT_FOR_OPERATION"
          : latestJobId
            ? "LATEST_JOB_NOT_DONE"
            : "NO_EXPORT_JOB_FOR_OPERATION";

    return reply.send({
      ok: true,
      item: {
        has_bundle: Boolean(downloadUrl),
        latest_job_id: latestJobId,
        latest_job_status: mapExportJobStatusLabel(latestStatusRaw),
        latest_exported_at: latestExportedAt,
        latest_bundle_name: latestBundleName,
        download_url: downloadUrl,
        jump_url: `/delivery/export-jobs?operation_plan_id=${encodeURIComponent(operationPlanId)}`,
        missing_reason: missingReason
      }
    });
  });

  app.get("/api/v1/operations", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 100) || 100, 300));

    let items = await projectOperationStateV1(pool, tenant);
    if (q.field_id) items = items.filter((x) => x.field_id === String(q.field_id));
    if (q.device_id) items = items.filter((x) => x.device_id === String(q.device_id));
    if (q.final_status) items = items.filter((x) => x.final_status === String(q.final_status));
    const mappedItems = items.slice(0, limit).map((op: any) => {
      if (isInvalidExecutionOperation(op)) {
        const reportJson = buildInvalidExecutionReport(op);
        return {
          ...op,
          report_json: reportJson
        };
      }
      return op;
    });

    items = mappedItems.map((op: any) => {
      if (!isInvalidExecutionOperation(op)) return op;
      const reportJson = op?.report_json ?? buildInvalidExecutionReport(op);
      return {
        ...op,
        report_json: {
          type: "invalid_execution_report_v1",
          summary: cleanJsonText(reportJson?.summary, "operation execution was invalid"),
          root_cause: cleanJsonText(reportJson?.root_cause, "unknown reason"),
          risk: cleanJsonText(reportJson?.risk, "possible yield loss or resource waste"),
          recommendation: cleanJsonText(reportJson?.recommendation, "rerun operation and inspect device state"),
          evidence_refs: toEvidenceRefs(reportJson?.evidence_refs)
        }
      };
    });

    return reply.send({
      ok: true,
      count: items.length,
      items,
      recommendation_states: projectRecommendationStateV1(items),
      device_states: projectDeviceStateV1(items)
    });
  });

  app.get("/api/v1/operations/:operation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operation_id = String((req.params as any)?.operation_id ?? "").trim();
    if (!operation_id) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });
    const items = await projectOperationStateV1(pool, tenant);
    const item = items.find((x) => x.operation_id === operation_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });

  app.get("/api/v1/operations/:operationPlanId/detail", async (req, reply) => {
    reply.type("application/json; charset=utf-8");
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operationPlanId = String((req.params as any)?.operationPlanId ?? "").trim();
    if (!operationPlanId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });

    const states = await projectOperationStateV1(pool, tenant);
    const state = states.find((x) => x.operation_id === operationPlanId || x.operation_plan_id === operationPlanId);
    if (!state) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const facts = await queryFactsForOperation(pool, tenant, operationPlanId);
    const latestByType = (type: string) => [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === type) ?? null;
    const rec = latestByType("decision_recommendation_v1");
    const approvalReq = latestByType("approval_request_v1");
    const approvalDecision = latestByType("approval_decision_v1");
    const plan = latestByType("operation_plan_v1");
    const task = latestByType("ao_act_task_v0");
    const receiptFact = [...facts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
    const normalizedReceipt = receiptFact ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? "")) : null;
    const acceptance = [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === "acceptance_result_v1") ?? null;
    const taskIdForBundle = toText(task?.record_json?.payload?.act_task_id ?? state.task_id ?? plan?.record_json?.payload?.act_task_id);
    const artifactQ = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='evidence_artifact_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
          AND (record_json::jsonb#>>'{payload,project_id}')=$2
          AND (record_json::jsonb#>>'{payload,group_id}')=$3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
            OR ($5::text IS NOT NULL AND (record_json::jsonb#>>'{payload,act_task_id}')=$5)
          )
        ORDER BY occurred_at ASC, fact_id ASC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId, taskIdForBundle]
    ).catch(() => ({ rows: [] as any[] }));
    const artifacts = (artifactQ.rows ?? []).map((row: any) => ({
      fact_id: String(row.fact_id ?? ""),
      occurred_at: String(row.occurred_at ?? ""),
      source: String(row.source ?? ""),
      payload: parseRecordJson(row.record_json)?.payload ?? {}
    }));
    const receiptPayload = receiptFact?.record_json?.payload ?? {};
    const receiptLogs = receiptPayload?.logs_refs;
    const logs = Array.isArray(receiptLogs) ? receiptLogs : [];
    const media = artifacts
      .filter((x: any) => {
        const kind = String(x?.payload?.kind ?? "").toLowerCase();
        return kind.includes("image") || kind.includes("video") || kind.includes("media");
      })
      .map((x: any) => x.payload);
    const metrics = Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [];
    const evidenceEvaluation = evaluateEvidence({
      artifacts: artifacts.map((x: any) => ({ kind: x?.payload?.kind ?? "artifact" })),
      logs,
      media,
      metrics,
    });
    const operationPayload = plan?.record_json?.payload ?? {};
    const recommendationPayload = rec?.record_json?.payload ?? {};
    const taskDeviceId = normalizeDeviceId(task?.record_json?.payload?.meta?.device_id ?? state.device_id ?? recommendationPayload?.device_id ?? operationPayload?.device_id);
    const recommendedDeviceId = taskDeviceId;
    const receiptDeviceId = normalizeDeviceId(normalizedReceipt?.device_id);
    const executorDeviceId = receiptDeviceId ?? taskDeviceId ?? "unknown";
    const detailDeviceId = executorDeviceId === "unknown" ? null : executorDeviceId;
    const executionStartMs = toMs(normalizedReceipt?.execution_started_at ?? task?.occurred_at ?? receiptFact?.occurred_at);
    const receiptMs = toMs(receiptFact?.occurred_at ?? normalizedReceipt?.execution_finished_at ?? normalizedReceipt?.execution_started_at);
    const afterWindowMinutes = 20;
    const afterWindowEndMs = receiptMs == null ? null : receiptMs + afterWindowMinutes * 60 * 1000;

    let beforeMetrics: OperationMetricsSnapshot = {};
    let afterMetrics: OperationMetricsSnapshot = {};
    if (detailDeviceId && executionStartMs != null) {
      const beforeTelemetryQ = await pool.query(
        `SELECT metric, value_num, ts
           FROM telemetry_index_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND metric = ANY($3::text[])
            AND ts <= to_timestamp($4::double precision / 1000.0)
          ORDER BY ts DESC
          LIMIT 20`,
        [tenant.tenant_id, detailDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temp", "soil_temp_c"], executionStartMs]
      ).catch(() => ({ rows: [] as any[] }));
      beforeMetrics = buildMetricsSnapshot(beforeTelemetryQ.rows ?? []);
    }
    if (detailDeviceId && receiptMs != null && afterWindowEndMs != null) {
      const afterTelemetryQ = await pool.query(
        `SELECT metric, value_num, ts
           FROM telemetry_index_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND metric = ANY($3::text[])
            AND ts >= to_timestamp($4::double precision / 1000.0)
            AND ts <= to_timestamp($5::double precision / 1000.0)
          ORDER BY ts ASC
          LIMIT 100`,
        [tenant.tenant_id, detailDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temp", "soil_temp_c"], receiptMs, afterWindowEndMs]
      ).catch(() => ({ rows: [] as any[] }));
      afterMetrics = buildMetricsSnapshot(afterTelemetryQ.rows ?? []);
    }
    const resolvedActionType = String(task?.record_json?.payload?.action_type ?? state.action_type ?? "").trim().toUpperCase();
    const expectedEffect =
      toExpectedEffect(recommendationPayload)
      ?? (resolvedActionType === "IRRIGATE" ? { type: "moisture_increase" as const, value: 10 } : null);
    const actualEffect = computeEffect(beforeMetrics, afterMetrics);
    const beforeMetricsForResponse = {
      ...beforeMetrics,
      soil_moisture: Number.isFinite(Number(beforeMetrics?.soil_moisture ?? NaN))
        ? Number(beforeMetrics?.soil_moisture)
        : null,
    };
    const afterMetricsForResponse = {
      ...afterMetrics,
      soil_moisture: Number.isFinite(Number(afterMetrics?.soil_moisture ?? NaN))
        ? Number(afterMetrics?.soil_moisture)
        : null,
    };

    const timeline: Array<{ id: string; kind: string; label: string; status: string | null; occurred_at: string | null; actor_label: string | null; summary: string }> = (state.timeline ?? []).map((item, idx) => ({
      id: `${item.type}_${item.ts}_${idx}`,
      kind: String(item.type ?? "UNKNOWN"),
      label: item.label || statusLabel(item.type),
      status: state.final_status,
      occurred_at: item.ts ? new Date(item.ts).toISOString() : null,
      actor_label: null,
      summary: item.label || ""
    }));
    if (approvalDecision) {
      timeline.push({
        id: `approval_decision_${approvalDecision.fact_id}`,
        kind: "APPROVAL_DECISION",
        label: "审批决策",
        status: toText(approvalDecision.record_json?.payload?.decision) ?? "",
        occurred_at: approvalDecision.occurred_at,
        actor_label: toText(approvalDecision.record_json?.payload?.decider ?? approvalDecision.record_json?.payload?.actor_label),
        summary: statusLabel(toText(approvalDecision.record_json?.payload?.decision))
      });
    }
    timeline.sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));

    const executedReceipt = hasExecutedReceiptStatus(receiptPayload?.status ?? receiptPayload?.receipt_status ?? normalizedReceipt?.receipt_status);
    const invalidExecution = Boolean(receiptFact) && executedReceipt && !evidenceEvaluation.has_formal_evidence;
    const finalStatus = invalidExecution ? "INVALID_EXECUTION" : state.final_status;
    const invalidReason = invalidExecution
      ? (evidenceEvaluation.reason === "only_sim_trace" ? "evidence_invalid" : "evidence_missing")
      : null;
    const businessEffect = deriveBusinessEffect({
      reason_codes: Array.isArray(rec?.record_json?.payload?.reason_codes) ? rec.record_json.payload.reason_codes : [],
      action_type: task?.record_json?.payload?.action_type ?? state.action_type,
      final_status: finalStatus,
    });
    const costBreakdown = computeCostBreakdown({
      water_l: normalizedReceipt?.water_l,
      electric_kwh: normalizedReceipt?.electric_kwh,
      chemical_ml: normalizedReceipt?.chemical_ml,
    });
    const customerViewStatus = resolveCustomerViewStatus({
      final_status: finalStatus,
      has_approval: Boolean(approvalReq || approvalDecision),
      has_task: Boolean(task),
      has_receipt: Boolean(normalizedReceipt),
      has_acceptance: Boolean(acceptance),
      invalid_execution: invalidExecution,
    });
    const customerView = customerViewByStatus(customerViewStatus);
    const agronomyCropCode = toText(
      state.crop_code
      ?? rec?.record_json?.payload?.crop_code
      ?? rec?.record_json?.payload?.suggested_action?.parameters?.crop_code
      ?? plan?.record_json?.payload?.crop_code
    );
    const agronomyCropStage = toText(
      state.crop_stage
      ?? rec?.record_json?.payload?.crop_stage
      ?? rec?.record_json?.payload?.suggested_action?.parameters?.crop_stage
      ?? plan?.record_json?.payload?.crop_stage
    );
    const agronomyRuleId = toText(
      rec?.record_json?.payload?.rule_id
      ?? rec?.record_json?.payload?.suggested_action?.parameters?.rule_id
    );
    const agronomyReasonCodes = Array.isArray(rec?.record_json?.payload?.reason_codes)
      ? rec.record_json.payload.reason_codes
      : [];
    const agronomyRiskIfNotExecute = toText(
      rec?.record_json?.payload?.risk_if_not_execute
      ?? rec?.record_json?.payload?.suggested_action?.parameters?.risk_if_not_execute
    );
    const acceptanceForResponse = invalidExecution ? null : acceptance;
    return reply.send({
      ok: true,
      operation: {
        operation_plan_id: operationPlanId,
        recommendation_id: toText(state.recommendation_id),
        crop_code: agronomyCropCode,
        crop_stage: agronomyCropStage,
        approval_id: toText(state.approval_id ?? state.approval_decision_id ?? state.approval_request_id),
        act_task_id: toText(state.act_task_id ?? state.task_id),
        receipt_id: toText(state.receipt_id ?? normalizedReceipt?.receipt_fact_id),
        final_status: finalStatus,
        status_label: statusLabel(finalStatus),
        invalid_reason: invalidReason,
        executor_device_id: task ? executorDeviceId : null,
        recommended_device_id: recommendedDeviceId,
        recommendation: rec ? {
          recommendation_id: toText(state.recommendation_id ?? rec?.record_json?.payload?.recommendation_id),
          title: toText(rec?.record_json?.payload?.title) ?? "系统建议",
          summary: toText(rec?.record_json?.payload?.summary ?? rec?.record_json?.payload?.reason),
          reason_codes: Array.isArray(rec?.record_json?.payload?.reason_codes) ? rec.record_json.payload.reason_codes : [],
          created_at: rec?.occurred_at ?? null
        } : null,
        approval: approvalReq || approvalDecision ? {
          approval_request_id: toText(state.approval_request_id ?? approvalReq?.record_json?.payload?.request_id),
          decision: toText(approvalDecision?.record_json?.payload?.decision),
          decision_label: statusLabel(toText(approvalDecision?.record_json?.payload?.decision)),
          actor_label: toText(approvalDecision?.record_json?.payload?.decider ?? approvalDecision?.record_json?.payload?.actor_label),
          decided_at: approvalDecision?.occurred_at ?? null
        } : null,
        task: task ? {
          task_id: toText(task?.record_json?.payload?.act_task_id ?? state.task_id),
          action_type: toText(task?.record_json?.payload?.action_type ?? state.action_type),
          device_id: executorDeviceId,
          executor_label: toText(task?.record_json?.payload?.executor_label ?? task?.record_json?.payload?.executor_id?.label),
          dispatched_at: task?.occurred_at ?? null,
          acked_at: toText(task?.record_json?.payload?.acked_at ?? task?.record_json?.payload?.ack_ts)
        } : null,
        receipt: normalizedReceipt ? {
          receipt_fact_id: normalizedReceipt.receipt_fact_id,
          receipt_type: normalizedReceipt.receipt_type,
          receipt_status: normalizedReceipt.receipt_status,
          execution_started_at: normalizedReceipt.execution_started_at,
          execution_finished_at: normalizedReceipt.execution_finished_at,
          water_l: normalizedReceipt.water_l,
          electric_kwh: normalizedReceipt.electric_kwh,
          chemical_ml: normalizedReceipt.chemical_ml,
          log_ref_count: normalizedReceipt.log_ref_count,
          constraint_violated: normalizedReceipt.constraint_violated,
          executor_label: normalizedReceipt.executor_label
        } : null,
        acceptance: acceptanceForResponse ? {
          verdict: toText(acceptanceForResponse.record_json?.payload?.verdict),
          missing_evidence: Array.isArray(acceptanceForResponse.record_json?.payload?.missing_evidence) ? acceptanceForResponse.record_json.payload.missing_evidence : [],
          generated_at: toText(acceptanceForResponse.record_json?.payload?.generated_at ?? acceptanceForResponse.record_json?.payload?.evaluated_at ?? acceptanceForResponse.occurred_at)
        } : null,
        timeline,
        evidence_bundle: {
          artifacts,
          logs,
          media,
          metrics
        },
        agronomy: {
          crop_code: agronomyCropCode,
          crop_stage: agronomyCropStage,
          rule_id: agronomyRuleId,
          reason_codes: agronomyReasonCodes,
          risk_if_not_execute: agronomyRiskIfNotExecute,
          before_metrics: beforeMetricsForResponse,
          after_metrics: afterMetricsForResponse,
          expected_effect: expectedEffect,
          actual_effect: actualEffect
        },
        business_effect: businessEffect,
        cost: {
          total: costBreakdown.total_cost,
          water: costBreakdown.water_cost,
          electric: costBreakdown.electric_cost,
          chemical: costBreakdown.chemical_cost
        },
        customer_view: customerView
      }
    });
  });
}
