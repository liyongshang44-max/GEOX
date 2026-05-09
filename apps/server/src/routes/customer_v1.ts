import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceRouteRoleAuth } from "../auth/route_role_authz.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type CustomerReportListItem = { report_id?: string | null; report_type: "OVERVIEW" | "FIELD" | "OPERATION" | "EVIDENCE_VALUE"; title: string; subtitle?: string | null; href?: string | null; field_id?: string | null; field_name?: string | null; operation_id?: string | null; operation_title?: string | null; updated_at?: string | null; status_text?: string | null; capability_status?: "AVAILABLE" | "PENDING" | "UNAVAILABLE"; };
type CustomerOperationListItem = { operation_id: string; operation_plan_id: string | null; field_id: string | null; field_name: string | null; title: string | null; customer_title: string | null; operation_type: string | null; final_status: string | null; acceptance_status: string | null; evidence_status: string | null; evidence_summary_status: string | null; updated_at: string | null; executed_at: string | null; };
type CustomerFieldListItem = { field_id: string; field_name: string | null; risk_level: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"; risk_reasons: string[]; updated_at: string | null; crop_name: string | null; stage_name: string | null; recent_operation_id: string | null; recent_operation_title: string | null; open_alerts_count: number; pending_acceptance_count: number; };

function toRiskLevel(value: unknown): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" { const v = String(value ?? "").trim().toUpperCase(); if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v; return "UNKNOWN"; }

async function queryFieldNameMap(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, string | null>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(`SELECT field_id, name FROM field_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])`, [tenant.tenant_id, fieldIds]);
  const map = new Map<string, string | null>();
  for (const row of q.rows ?? []) { const fieldId = String((row as any).field_id ?? "").trim(); if (!fieldId) continue; map.set(fieldId, String((row as any).name ?? "").trim() || null); }
  return map;
}

async function queryOpenAlertCountByField(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, number>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(`SELECT field_id, SUM(cnt)::bigint AS count FROM (SELECT e.object_id AS field_id, COUNT(*)::bigint AS cnt FROM alert_event_index_v1 e WHERE e.tenant_id = $1 AND e.status IN ('OPEN','ACKED') AND e.object_type = 'FIELD' AND e.object_id = ANY($2::text[]) GROUP BY e.object_id UNION ALL SELECT b.field_id AS field_id, COUNT(*)::bigint AS cnt FROM alert_event_index_v1 e JOIN device_binding_index_v1 b ON b.tenant_id = e.tenant_id AND b.device_id = e.object_id WHERE e.tenant_id = $1 AND e.status IN ('OPEN','ACKED') AND e.object_type = 'DEVICE' AND b.field_id = ANY($2::text[]) GROUP BY b.field_id) t GROUP BY field_id`, [tenant.tenant_id, fieldIds]).catch(() => ({ rows: [] as any[] }));
  const map = new Map<string, number>();
  for (const row of q.rows ?? []) { const fieldId = String((row as any).field_id ?? "").trim(); if (!fieldId) continue; map.set(fieldId, Number((row as any).count ?? 0)); }
  return map;
}

export function registerCustomerV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/customer/reports", async (req, reply) => {
    if (!enforceRouteRoleAuth(req, reply, "summary")) return;
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); if (!auth) return;
    const tenant: TenantTriple = { tenant_id: String(auth.tenant_id), project_id: String(auth.project_id), group_id: String(auth.group_id) };
    const generatedAt = new Date().toISOString();
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids) ? Array.from(new Set(auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean))) : [];
    const states = await projectOperationStateV1(pool, tenant);
    const scopedStates = states.filter((state) => allowedFieldIds.includes(String(state.field_id ?? "").trim()));
    const fieldIds = Array.from(new Set(scopedStates.map((state) => String(state.field_id ?? "").trim()).filter(Boolean)));
    const fieldNameById = await queryFieldNameMap(pool, tenant, fieldIds);
    const reports: CustomerReportListItem[] = [{ report_type: "OVERVIEW", title: "经营总览报告", subtitle: "基于当前客户驾驶舱可见数据生成", href: "/customer/export", updated_at: generatedAt, status_text: "可导出", capability_status: "AVAILABLE" }];
    for (const fieldId of fieldIds.slice(0, 20)) reports.push({ report_type: "FIELD", title: `${fieldNameById.get(fieldId) ?? "地块"} · 地块报告`, subtitle: "基于当前可见地块数据生成", href: `/customer/fields/${encodeURIComponent(fieldId)}`, field_id: fieldId, field_name: fieldNameById.get(fieldId) ?? null, updated_at: generatedAt, status_text: "可查看", capability_status: "AVAILABLE" });
    const operationSeen = new Set<string>();
    for (const state of scopedStates) {
      const operationId = String(state.operation_id ?? state.operation_plan_id ?? "").trim(); if (!operationId || operationSeen.has(operationId)) continue; operationSeen.add(operationId);
      const fieldId = String(state.field_id ?? "").trim() || null; const operationTitle = String(state.action_type ?? "").trim() || "作业"; const updatedTs = Number((state as any).updated_at ?? 0); const timelineTs = Math.max(...(state.timeline ?? []).map((item) => Number(item.ts ?? 0)).filter((n) => Number.isFinite(n) && n > 0), 0);
      reports.push({ report_type: "OPERATION", title: `${operationTitle} · 作业报告`, subtitle: "基于当前近期作业生成", href: `/customer/operations/${encodeURIComponent(operationId)}`, operation_id: operationId, operation_title: operationTitle, field_id: fieldId, field_name: fieldId ? (fieldNameById.get(fieldId) ?? null) : null, updated_at: updatedTs > 0 ? new Date(updatedTs).toISOString() : (timelineTs > 0 ? new Date(timelineTs).toISOString() : generatedAt), status_text: "可查看", capability_status: "AVAILABLE" });
      if (operationSeen.size >= 30) break;
    }
    reports.push({ report_type: "EVIDENCE_VALUE", title: "证据与价值报告", subtitle: "证据包生成能力待接入", href: null, updated_at: generatedAt, status_text: "待接入", capability_status: "PENDING" });
    return reply.send({ ok: true, source: "customer_reports_api", dataScope: "OFFICIAL_CUSTOMER_API", generated_at: generatedAt, reports });
  });

  app.get("/api/v1/customer/operations", async (req, reply) => {
    if (!enforceRouteRoleAuth(req, reply, "summary")) return;
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); if (!auth) return;
    const tenant: TenantTriple = { tenant_id: String(auth.tenant_id), project_id: String(auth.project_id), group_id: String(auth.group_id) };
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids) ? Array.from(new Set(auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean))) : [];
    const states = await projectOperationStateV1(pool, tenant);
    const scopedStates = states.filter((state) => allowedFieldIds.includes(String(state.field_id ?? "").trim()));
    const fieldIds = Array.from(new Set(scopedStates.map((state) => String(state.field_id ?? "").trim()).filter(Boolean)));
    const fieldNameById = await queryFieldNameMap(pool, tenant, fieldIds);
    const operations = scopedStates.map((state): CustomerOperationListItem | null => { const fieldId = String(state.field_id ?? "").trim() || null; const operationId = String(state.operation_id ?? state.operation_plan_id ?? "").trim(); if (!operationId) return null; const operationPlanId = String(state.operation_plan_id ?? "").trim() || null; const timelineTs = Math.max(...(state.timeline ?? []).map((item) => Number(item.ts ?? 0)).filter((n) => Number.isFinite(n) && n > 0), 0); const updatedTs = Number((state as any).updated_at ?? 0); const executedTs = Number((state as any).execution_finished_at ?? (state as any).execution_started_at ?? 0); const operationType = String(state.action_type ?? "").trim() || null; const finalStatus = String(state.final_status ?? "").trim() || null; const acceptanceStatus = String(state.acceptance?.status ?? "").trim() || null; const evidenceStatus = String((state as any).evidence?.status ?? "").trim() || null; const evidenceSummaryStatus = String((state as any).evidence_summary?.status ?? "").trim() || null; return { operation_id: operationId, operation_plan_id: operationPlanId, field_id: fieldId, field_name: fieldId ? (fieldNameById.get(fieldId) ?? null) : null, title: operationType ? `${operationType}作业` : null, customer_title: operationType ? `${operationType}作业` : null, operation_type: operationType, final_status: finalStatus, acceptance_status: acceptanceStatus, evidence_status: evidenceStatus, evidence_summary_status: evidenceSummaryStatus, updated_at: updatedTs > 0 ? new Date(updatedTs).toISOString() : (timelineTs > 0 ? new Date(timelineTs).toISOString() : null), executed_at: executedTs > 0 ? new Date(executedTs).toISOString() : null }; }).filter((item): item is CustomerOperationListItem => item != null).sort((a, b) => Date.parse(b.updated_at ?? "") - Date.parse(a.updated_at ?? ""));
    return reply.send({ ok: true, source: "customer_operations_api", dataScope: "OFFICIAL_CUSTOMER_API", generated_at: new Date().toISOString(), operations });
  });

  app.get("/api/v1/customer/fields", async (req, reply) => {
    if (!enforceRouteRoleAuth(req, reply, "summary")) return;
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); if (!auth) return;
    const tenant: TenantTriple = { tenant_id: String(auth.tenant_id), project_id: String(auth.project_id), group_id: String(auth.group_id) };
    const allowedFieldIds = Array.isArray(auth.allowed_field_ids) ? Array.from(new Set(auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean))) : [];
    const states = await projectOperationStateV1(pool, tenant);
    const scopedStates = states.filter((state) => allowedFieldIds.includes(String(state.field_id ?? "").trim()));
    const fieldIds = allowedFieldIds.length > 0 ? allowedFieldIds : Array.from(new Set(scopedStates.map((state) => String(state.field_id ?? "").trim()).filter(Boolean)));
    const [fieldNameById, openAlertsByField] = await Promise.all([queryFieldNameMap(pool, tenant, fieldIds), queryOpenAlertCountByField(pool, tenant, fieldIds)]);
    const byField = new Map<string, { latestTs: number; latestOperationId: string | null; pendingAcceptanceCount: number; riskLevel: string; riskReasons: string[] }>();
    for (const state of scopedStates) { const fieldId = String(state.field_id ?? "").trim(); if (!fieldId) continue; const updatedTs = Number((state as any).updated_at ?? 0); const eventTs = Number.isFinite(updatedTs) && updatedTs > 0 ? updatedTs : Math.max(...(state.timeline ?? []).map((item) => Number(item.ts ?? 0)).filter((n) => Number.isFinite(n) && n > 0), 0); const existing = byField.get(fieldId); const pending = String(state.acceptance?.status ?? "").toUpperCase() === "PENDING" ? 1 : 0; const riskLevel = String((state as any).risk?.level ?? (state as any).risk_level ?? "UNKNOWN"); const riskReasons = Array.isArray((state as any).risk?.reasons) ? (state as any).risk.reasons.map((x: unknown) => String(x ?? "").trim()).filter(Boolean) : []; if (!existing) byField.set(fieldId, { latestTs: eventTs, latestOperationId: String(state.operation_id ?? state.operation_plan_id ?? "").trim() || null, pendingAcceptanceCount: pending, riskLevel, riskReasons }); else { existing.pendingAcceptanceCount += pending; if (eventTs > existing.latestTs) { existing.latestTs = eventTs; existing.latestOperationId = String(state.operation_id ?? state.operation_plan_id ?? "").trim() || null; existing.riskLevel = riskLevel; existing.riskReasons = riskReasons; } } }
    const fields: CustomerFieldListItem[] = fieldIds.map((fieldId) => { const agg = byField.get(fieldId); return { field_id: fieldId, field_name: fieldNameById.get(fieldId) ?? null, risk_level: toRiskLevel(agg?.riskLevel), risk_reasons: agg?.riskReasons ?? [], updated_at: agg?.latestTs && agg.latestTs > 0 ? new Date(agg.latestTs).toISOString() : null, crop_name: null, stage_name: null, recent_operation_id: agg?.latestOperationId ?? null, recent_operation_title: null, open_alerts_count: Number(openAlertsByField.get(fieldId) ?? 0), pending_acceptance_count: Number(agg?.pendingAcceptanceCount ?? 0) }; });
    return reply.send({ ok: true, source: "customer_fields_api", dataScope: "OFFICIAL_CUSTOMER_API", generated_at: new Date().toISOString(), fields });
  });
}
