import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";
import { normalizeReceiptEvidence } from "../services/receipt_evidence.js";
import { evaluateEvidence, inferEvidenceLevel } from "../domain/acceptance/evidence_policy.js";
import { deriveBusinessEffect } from "../domain/agronomy/business_effect.js";
import { computeCostBreakdown } from "../domain/agronomy/cost_model.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type ReportJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
type FactRow = { fact_id: string; occurred_at: string; source: string | null; record_json: any };
type DbJob = {
  job_id: string;
  status: ReportJobStatus;
  payload: any;
  result: any;
};

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try { return JSON.parse(v); } catch { return null; }
}

function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const x = Date.parse(v);
    if (Number.isFinite(x)) return x;
  }
  return null;
}

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id),
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function escapeHtml(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}

async function ensureJobsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      job_id      TEXT PRIMARY KEY,
      job_type    TEXT NOT NULL,
      payload     JSONB NOT NULL,
      status      TEXT NOT NULL,
      result      JSONB,
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(job_type, status, created_at);`);
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
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
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
      record_json: parseRecordJson(row.record_json) ?? row.record_json,
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
      record_json: parseRecordJson(row.record_json) ?? row.record_json,
    })));
  }
  extra.push(...await q("acceptance_result_v1", "operation_plan_id", operationPlanId));
  const all = [...rows, ...extra];
  all.sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));
  return all;
}

function renderReportHtml(report: any): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>作业报告 ${escapeHtml(report.operation_id)}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5}h1{font-size:24px}h2{font-size:18px;margin-top:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;vertical-align:top}.mono{font-family:ui-monospace,monospace}</style></head><body>
<h1>GEOX 作业报告</h1>
<p><b>operation_id:</b> <span class="mono">${escapeHtml(report.operation_id)}</span></p>
<p><b>field_id:</b> ${escapeHtml(report.field_id ?? "-")} &nbsp; <b>device_id:</b> ${escapeHtml(report.device_id ?? "-")}</p>
<h2>执行结论</h2>
<table><tr><th>执行人</th><th>执行时间</th><th>最终状态</th><th>无效原因</th></tr>
<tr><td>${escapeHtml(report.execution.executor_label)}</td><td>${escapeHtml(report.execution.executed_at)}</td><td>${escapeHtml(report.execution.final_status)}</td><td>${escapeHtml(report.execution.invalid_reason ?? "-")}</td></tr></table>
<h2>证据摘要</h2>
<p>证据等级：${escapeHtml(report.evidence.evidence_level)}（STRONG:${report.evidence.level_counts.STRONG} / FORMAL:${report.evidence.level_counts.FORMAL} / DEBUG:${report.evidence.level_counts.DEBUG}）</p>
<p>正式证据：${report.evidence.formal_count}，调试证据：${report.evidence.debug_count}</p>
<ul>${report.evidence.items.map((x: any) => `<li>${escapeHtml(x.type)} / ${escapeHtml(x.kind)} / ${escapeHtml(x.level)} / ${escapeHtml(x.ref ?? "-")}</li>`).join("")}</ul>
<h2>业务影响表达</h2>
<p><b>预计效果：</b>${escapeHtml(report.business_effect.expected_impact)}</p>
<p><b>不执行风险：</b>${escapeHtml(report.business_effect.risk_if_not_execute)}</p>
<p><b>置信度：</b>${escapeHtml(report.business_effect.confidence)}</p>
<h2>作业成本</h2>
<p><b>总成本：</b>¥${Number(report.cost?.total ?? 0).toFixed(2)} &nbsp; <b>水费：</b>¥${Number(report.cost?.water ?? 0).toFixed(2)} &nbsp; <b>电费：</b>¥${Number(report.cost?.electric ?? 0).toFixed(2)}</p>
<h2>验收</h2>
<p><b>状态：</b>${escapeHtml(report.acceptance.status)} &nbsp; <b>原因：</b>${escapeHtml(report.acceptance.reason ?? "-")}</p>
<h2>客户视角结论</h2>
<p><b>结论：</b>${escapeHtml(report.customer_view?.summary ?? "-")}</p>
<p><b>建议：</b>${escapeHtml(report.customer_view?.today_action ?? "-")}</p>
<p><b>风险等级：</b>${escapeHtml(String(report.customer_view?.risk_level ?? "-").toUpperCase())}</p>
</body></html>`;
}

async function runEvidenceReportJob(pool: Pool, args: { job_id: string; operation_plan_id: string; tenant: TenantTriple }): Promise<{ artifact_path: string }> {
  const states = await projectOperationStateV1(pool, args.tenant);
  const state = states.find((x) => x.operation_id === args.operation_plan_id || x.operation_plan_id === args.operation_plan_id);
  if (!state) throw new Error("OPERATION_NOT_FOUND");

  const facts = await queryFactsForOperation(pool, args.tenant, args.operation_plan_id);
  const latestByType = (type: string) => [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === type) ?? null;
  const rec = latestByType("decision_recommendation_v1");
  const receiptFact = [...facts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
  const normalizedReceipt = receiptFact ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? "")) : null;
  const acceptance = [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === "acceptance_result_v1") ?? null;

  const receiptPayload = receiptFact?.record_json?.payload ?? {};
  const logs = Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [];
  const metrics = Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [];
  const photos = Array.isArray(receiptPayload?.photo_refs) ? receiptPayload.photo_refs : [];
  const media = photos.map((x: any) => ({ kind: "photo", ref: x }));
  const evidenceEvaluation = evaluateEvidence({ artifacts: [], logs, media, metrics });
  const finalStatus = String(state.final_status ?? "").toUpperCase() === "INVALID_EXECUTION" || !evidenceEvaluation.has_formal_evidence
    ? "INVALID_EXECUTION"
    : "SUCCEEDED";

  const reasonCodes = Array.isArray(rec?.record_json?.payload?.reason_codes) ? rec.record_json.payload.reason_codes : [];
  const businessEffect = deriveBusinessEffect({
    reason_codes: reasonCodes,
    action_type: state.action_type,
    final_status: finalStatus,
  });

  const costBreakdown = computeCostBreakdown({
    water_l: normalizedReceipt?.water_l,
    electric_kwh: normalizedReceipt?.electric_kwh,
    chemical_ml: normalizedReceipt?.chemical_ml,
  });

  const report = {
    operation_id: args.operation_plan_id,
    field_id: toText(state.field_id) ?? "-",
    device_id: toText(state.device_id) ?? undefined,
    execution: {
      executor_label: toText(normalizedReceipt?.executor_label ?? state.device_id) ?? "unknown",
      executed_at: toText(normalizedReceipt?.execution_finished_at ?? receiptFact?.occurred_at ?? new Date().toISOString()) ?? new Date().toISOString(),
      final_status: finalStatus,
      invalid_reason: finalStatus === "INVALID_EXECUTION" ? (evidenceEvaluation.reason ?? "evidence_invalid") : undefined,
    },
    evidence: {
      formal_count: photos.length + metrics.length + (evidenceEvaluation.has_only_sim_trace ? 0 : logs.length),
      debug_count: evidenceEvaluation.has_only_sim_trace ? logs.length : 0,
      evidence_level: evidenceEvaluation.evidence_level,
      level_counts: evidenceEvaluation.level_counts,
      items: [
        ...photos.map((x: any) => ({ type: "photo", kind: "photo_ref", level: inferEvidenceLevel("photo"), ref: toText(x) ?? undefined })),
        ...metrics.map((x: any) => ({ type: "metric", kind: toText(x?.name) ?? "metric", level: inferEvidenceLevel("metric"), ref: undefined })),
        ...logs.map((x: any) => ({ type: "log", kind: toText(x?.kind) ?? "log_ref", level: inferEvidenceLevel(x?.kind ?? x), ref: toText(x?.ref ?? x) ?? undefined })),
      ],
    },
    business_effect: {
      expected_impact: businessEffect.expected_impact,
      risk_if_not_execute: businessEffect.risk_if_not_execute,
      confidence: finalStatus === "INVALID_EXECUTION" ? "low" : "medium",
    },
    acceptance: {
      status: finalStatus === "INVALID_EXECUTION"
        ? "FAIL"
        : (String(acceptance?.record_json?.payload?.verdict ?? "").toUpperCase().includes("PASS") ? "PASS" : "NOT_APPLICABLE"),
      reason: finalStatus === "INVALID_EXECUTION"
        ? "执行无效，证据不满足正式验收要求"
        : toText(acceptance?.record_json?.payload?.summary ?? acceptance?.record_json?.payload?.missing_evidence),
    },
    skill_trace_summary: {
      stages: {
        crop_skill: state.skill_trace?.crop_skill ?? null,
        agronomy_skill: state.skill_trace?.agronomy_skill ?? null,
        device_skill: state.skill_trace?.device_skill ?? null,
        acceptance_skill: state.skill_trace?.acceptance_skill ?? null,
      },
      success_count: [
        state.skill_trace?.crop_skill,
        state.skill_trace?.agronomy_skill,
        state.skill_trace?.device_skill,
        state.skill_trace?.acceptance_skill,
      ].filter((x) => String(x?.result_status ?? "").toUpperCase() === "SUCCESS").length,
    },
    cost: {
      total: costBreakdown.total_cost,
      water: costBreakdown.water_cost,
      electric: costBreakdown.electric_cost,
      chemical: costBreakdown.chemical_cost,
    },
    customer_view: finalStatus === "INVALID_EXECUTION"
      ? {
        summary: "本次作业未被系统认定为有效执行",
        today_action: "需重新执行或补充证据",
        risk_level: "high",
      }
      : {
        summary: "作业已完成，预计改善作物状态",
        today_action: "继续观察或进入验收",
        risk_level: "low",
      },
  };

  const outDir = path.resolve(process.cwd(), "runtime", "evidence_reports_v1");
  fs.mkdirSync(outDir, { recursive: true });
  const json = JSON.stringify(report, null, 2);
  const html = renderReportHtml(report);
  const digest = crypto.createHash("sha256").update(json, "utf8").digest("hex").slice(0, 12);
  const artifact_path = path.join(outDir, `${args.job_id}_${digest}.html`);
  fs.writeFileSync(artifact_path, html, "utf8");
  return { artifact_path };
}

function mapDbJob(row: any): DbJob {
  return {
    job_id: String(row.job_id ?? ""),
    status: String(row.status ?? "PENDING").toUpperCase() as ReportJobStatus,
    payload: parseRecordJson(row.payload) ?? row.payload ?? {},
    result: parseRecordJson(row.result) ?? row.result ?? null,
  };
}

export async function fetchPendingEvidenceReportJobs(pool: Pool): Promise<DbJob[]> {
  await ensureJobsTable(pool);
  const q = await pool.query(
    `SELECT job_id, payload::jsonb AS payload, status, result::jsonb AS result
       FROM jobs
      WHERE job_type = 'evidence_report_v1'
        AND status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 10`
  );
  return (q.rows ?? []).map(mapDbJob);
}

export async function markEvidenceReportJobFailed(pool: Pool, job: DbJob, error: unknown): Promise<void> {
  await ensureJobsTable(pool);
  await pool.query(
    `UPDATE jobs
        SET status = 'FAILED',
            error = $2,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, String((error as any)?.message ?? error)]
  );
}

export async function runQueuedEvidenceReportJob(pool: Pool, job: DbJob): Promise<void> {
  const payload = job.payload ?? {};
  const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
  const tenant = payload.tenant as TenantTriple | undefined;
  if (!operation_plan_id || !tenant?.tenant_id || !tenant?.project_id || !tenant?.group_id) {
    throw new Error("INVALID_JOB_PAYLOAD");
  }

  await pool.query(`UPDATE jobs SET status='RUNNING', updated_at=NOW() WHERE job_id=$1`, [job.job_id]);
  const result = await runEvidenceReportJob(pool, { job_id: job.job_id, operation_plan_id, tenant });
  await pool.query(
    `UPDATE jobs
        SET status = 'DONE',
            result = $2::jsonb,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, JSON.stringify(result)]
  );
}

export function registerEvidenceReportV1Routes(app: FastifyInstance, pool: Pool): void {
  void ensureJobsTable(pool);

  app.post("/api/v1/evidence-reports", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const operationPlanId = String((req.body as any)?.operation_plan_id ?? "").trim();
    if (!operationPlanId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });

    const job_id = `evidence_report_${crypto.randomUUID().replaceAll("-", "")}`;
    const payload = { operation_plan_id: operationPlanId, tenant };
    await ensureJobsTable(pool);
    await pool.query(
      `INSERT INTO jobs (job_id, job_type, payload, status, created_at, updated_at)
       VALUES ($1, 'evidence_report_v1', $2::jsonb, 'PENDING', NOW(), NOW())`,
      [job_id, JSON.stringify(payload)]
    );

    return reply.send({ ok: true, job_id });
  });

  app.get("/api/v1/evidence-reports/:job_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const job_id = String((req.params as any)?.job_id ?? "").trim();
    await ensureJobsTable(pool);
    const q = await pool.query(`SELECT status, result::jsonb AS result, error FROM jobs WHERE job_id = $1 LIMIT 1`, [job_id]);
    const row = q.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const statusRaw = String(row.status ?? "PENDING").toUpperCase();
    const status = statusRaw === "RUNNING" ? "PENDING" : statusRaw;
    return reply.send({
      ok: true,
      status,
      download_url: status === "DONE" ? `/api/v1/evidence-reports/${encodeURIComponent(job_id)}/download` : null,
      error: toText(row.error),
    });
  });

  app.get("/api/v1/evidence-reports/:job_id/download", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const job_id = String((req.params as any)?.job_id ?? "").trim();
    await ensureJobsTable(pool);
    const q = await pool.query(`SELECT payload::jsonb AS payload, status, result::jsonb AS result FROM jobs WHERE job_id = $1 LIMIT 1`, [job_id]);
    const row = q.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const payload = parseRecordJson(row.payload) ?? row.payload ?? {};
    const tenant = payload?.tenant as TenantTriple | undefined;
    if (!tenant || !requireTenantMatchOr404(auth, tenant, reply)) return;

    const status = String(row.status ?? "").toUpperCase();
    const result = parseRecordJson(row.result) ?? row.result ?? {};
    const artifact_path = toText(result?.artifact_path);
    const operation_plan_id = toText(payload?.operation_plan_id) ?? "operation";
    if (status !== "DONE" || !artifact_path || !fs.existsSync(artifact_path)) {
      return reply.status(400).send({ ok: false, error: "REPORT_NOT_READY" });
    }

    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${operation_plan_id}_evidence_report.html"`);
    return reply.send(fs.createReadStream(artifact_path));
  });
}
