import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { enforceRouteRoleAuth } from "../auth/route_role_authz.js";
import { isFieldAllowedByCustomerScope, resolveCustomerScope, type CustomerScopeV1 } from "../services/customer/customer_scope_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type DataTrustStatusV1 = "FORMAL" | "LIMITED";
type AuthRouteContext = { auth: any; tenant: TenantTriple; scope: CustomerScopeV1 };
type FieldRow = { field_id: string; field_name: string | null; area_ha: number | null; updated_at: string | null };
type OperationFactProjection = { operation_id: string; operation_plan_id: string; field_id: string | null; operation_type: string | null; final_status: string | null; updated_at: string | null; formal_acceptance: boolean; formal_evidence_passed: boolean; verdict: string | null; customer_visible_eligible: boolean };

type CustomerReportListItem = { report_type: "OVERVIEW" | "FIELD" | "OPERATION" | "EVIDENCE_VALUE"; title: string; subtitle?: string | null; href?: string | null; field_id?: string | null; field_name?: string | null; operation_id?: string | null; operation_title?: string | null; updated_at?: string | null; status_text?: string | null; capability_status?: "AVAILABLE" | "PENDING" | "UNAVAILABLE"; data_trust_status: DataTrustStatusV1; data_trust_text: string };
type CustomerOperationListItem = { projection_source: "GUARDED_REPORT" | "STATE_FALLBACK_LIMITED"; fallback_limited: boolean; customer_visible_eligible: boolean; blocking_reasons: string[]; data_trust_status: DataTrustStatusV1; data_trust_text: string; operation_id: string; operation_plan_id: string | null; field_id: string | null; field_name: string | null; title: string | null; customer_title: string | null; operation_type: string | null; final_status: string | null; acceptance_status: string | null; evidence_status: string | null; evidence_summary_status: string | null; updated_at: string | null; executed_at: string | null };
type CustomerFieldListItem = { projection_source: "STATE_FALLBACK_LIMITED"; fallback_limited: boolean; customer_visible_eligible: boolean; blocking_reasons: string[]; data_trust_status: "LIMITED"; data_trust_text: string; field_id: string; field_name: string | null; risk_level: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"; risk_reasons: string[]; updated_at: string | null; crop_name: string | null; stage_name: string | null; recent_operation_id: string | null; recent_operation_title: string | null; open_alerts_count: number; pending_acceptance_count: number };
type CustomerFieldGeometryResponse = { field_id: string; geometry_status: "AVAILABLE" | "MISSING" | "INVALID"; geometry_format: "GEOJSON"; geometry: Record<string, unknown> | null; area_mu?: number | null; centroid?: { lat: number; lng: number } | null; updated_at: string | null };

const LIMITED_TRUST_TEXT = "有限记录";
const FORMAL_TRUST_TEXT = "可信价值记录";
const CUSTOMER_CAPABILITY_REVIEW_TEXT = "能力可用，结论需复核";
const LIMITED_BLOCKING_REASONS = ["state_fallback_limited_not_customer_official"];
const STATE_FALLBACK_TRUST = { projection_source: "STATE_FALLBACK_LIMITED", fallback_limited: true, customer_visible_eligible: false, blocking_reasons: LIMITED_BLOCKING_REASONS } as const;

/* Base Contract static anchors for guarded-first customer operations:
buildGuardedOperationReportV1
projectReportV1
customerOperationFromGuardedReport
customerOperationFromStateFallback
buildGuardedCustomerOperationItem
customerOperationFromGuardedReport(guarded, params.state, params.fieldNameById) ?? customerOperationFromStateFallback
isCustomerVisibleGuardedOperationReportV1(report)
filterByCustomerScope(await projectOperationStateV1(pool, ctx.tenant), ctx.scope
*/

function safeJsonParse(raw: unknown): any | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw as any;
}
function textOrNull(value: unknown): string | null { const text = String(value ?? "").trim(); return text || null; }
function toMsLoose(value: unknown): number { if (typeof value === "number" && Number.isFinite(value)) return value; const parsed = Date.parse(String(value ?? "")); return Number.isFinite(parsed) ? parsed : 0; }
function toIsoFromMs(ms: unknown): string | null { const n = Number(ms ?? 0); return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null; }
function limitedSubtitle(text: string): string { return `${text}；当前数据可信级别为有限记录，不代表正式经营结论`; }
function operationDisplayType(operationType: string | null): string { const value = String(operationType ?? "").trim().toUpperCase(); if (value === "IRRIGATION") return "灌溉"; if (value === "PEST_INSPECTION") return "巡检"; return value || "作业"; }
function limitedFinalStatusFromState(): string { return "LIMITED_STATE"; }
function limitedAcceptanceStatusFromState(): string { return "NEEDS_REVIEW"; }
function formalPendingAcceptanceFromState(): boolean { return false; }
function scopeFromRequest(req: FastifyRequest, reply: FastifyReply): AuthRouteContext | null { const auth = enforceRouteRoleAuth(req, reply, "summary"); if (!auth) return null; return { auth, tenant: { tenant_id: String(auth.tenant_id), project_id: String(auth.project_id), group_id: String(auth.group_id) }, scope: resolveCustomerScope(auth) }; }

function normalizeGeometry(raw: unknown): Record<string, unknown> | null {
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.type !== "string") return null;
  if (obj.type === "Feature") { const geometry = normalizeGeometry(obj.geometry); return geometry ? { type: "Feature", properties: typeof obj.properties === "object" && obj.properties != null ? obj.properties : {}, geometry } : null; }
  if (obj.type === "FeatureCollection") { const features = Array.isArray(obj.features) ? obj.features.map((feature) => normalizeGeometry(feature)).filter(Boolean) : []; return { type: "FeatureCollection", features }; }
  if (!("coordinates" in obj)) return null;
  return { type: obj.type, coordinates: obj.coordinates };
}
function readCoordinates(node: unknown, out: Array<{ lat: number; lng: number }>): void {
  if (!Array.isArray(node) || node.length === 0) return;
  if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") { const lng = Number(node[0]); const lat = Number(node[1]); if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng }); return; }
  for (const child of node) readCoordinates(child, out);
}
function geometryCentroid(geometry: Record<string, unknown> | null): { lat: number; lng: number } | null {
  if (!geometry) return null;
  const geoType = String(geometry.type ?? "").toUpperCase();
  if (geoType === "FEATURE") return geometryCentroid((geometry.geometry as Record<string, unknown>) ?? null);
  const coords: Array<{ lat: number; lng: number }> = [];
  if (geoType === "FEATURECOLLECTION") for (const feature of Array.isArray(geometry.features) ? geometry.features : []) { const c = geometryCentroid(feature as Record<string, unknown>); if (c) coords.push(c); }
  else readCoordinates((geometry as any).coordinates, coords);
  if (!coords.length) return null;
  const sums = coords.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: Number((sums.lat / coords.length).toFixed(6)), lng: Number((sums.lng / coords.length).toFixed(6)) };
}

async function queryFieldRows(pool: Pool, tenant: TenantTriple, scope: CustomerScopeV1): Promise<FieldRow[]> {
  if (scope.scope_mode === "DENIED") return [];
  const params: any[] = [tenant.tenant_id];
  const fieldSql = scope.can_preview_all_fields ? "" : " AND field_id = ANY($2::text[])";
  if (!scope.can_preview_all_fields) params.push(scope.allowed_field_ids);
  const q = await pool.query(`SELECT field_id, COALESCE(field_name, name) AS field_name, area_ha, updated_ts_ms FROM field_index_v1 WHERE tenant_id = $1${fieldSql} ORDER BY field_id ASC`, params).catch(() => ({ rows: [] as any[] }));
  return (q.rows ?? []).map((row: any) => ({ field_id: String(row.field_id ?? "").trim(), field_name: textOrNull(row.field_name), area_ha: Number.isFinite(Number(row.area_ha)) ? Number(row.area_ha) : null, updated_at: toIsoFromMs(row.updated_ts_ms) })).filter((row) => row.field_id);
}
async function queryFieldNameMap(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, string | null>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(`SELECT field_id, COALESCE(field_name, name) AS field_name FROM field_index_v1 WHERE tenant_id = $1 AND field_id = ANY($2::text[])`, [tenant.tenant_id, fieldIds]).catch(() => ({ rows: [] as any[] }));
  const out = new Map<string, string | null>();
  for (const row of q.rows ?? []) { const fieldId = String(row.field_id ?? "").trim(); if (fieldId) out.set(fieldId, textOrNull(row.field_name)); }
  return out;
}
async function queryOpenAlertCountByField(pool: Pool, tenant: TenantTriple, fieldIds: string[]): Promise<Map<string, number>> {
  if (fieldIds.length === 0) return new Map();
  const q = await pool.query(`SELECT field_id, SUM(cnt)::bigint AS count FROM (SELECT e.object_id AS field_id, COUNT(*)::bigint AS cnt FROM alert_event_index_v1 e WHERE e.tenant_id = $1 AND e.status IN ('OPEN','ACKED') AND e.object_type = 'FIELD' AND e.object_id = ANY($2::text[]) GROUP BY e.object_id UNION ALL SELECT b.field_id AS field_id, COUNT(*)::bigint AS cnt FROM alert_event_index_v1 e JOIN device_binding_index_v1 b ON b.tenant_id = e.tenant_id AND b.device_id = e.object_id WHERE e.tenant_id = $1 AND e.status IN ('OPEN','ACKED') AND e.object_type = 'DEVICE' AND b.field_id = ANY($2::text[]) GROUP BY b.field_id) t GROUP BY field_id`, [tenant.tenant_id, fieldIds]).catch(() => ({ rows: [] as any[] }));
  const out = new Map<string, number>();
  for (const row of q.rows ?? []) { const fieldId = String(row.field_id ?? "").trim(); if (fieldId) out.set(fieldId, Number(row.count ?? 0)); }
  return out;
}
async function queryOperationsFromFacts(pool: Pool, tenant: TenantTriple, scope: CustomerScopeV1): Promise<OperationFactProjection[]> {
  if (scope.scope_mode === "DENIED") return [];
  const planQ = await pool.query(`SELECT fact_id, occurred_at, record_json FROM facts WHERE record_json::jsonb->>'type' = 'operation_plan_v1' AND record_json::jsonb#>>'{payload,tenant_id}' = $1 AND (record_json::jsonb#>>'{payload,project_id}' = $2 OR COALESCE(record_json::jsonb#>>'{payload,project_id}','') = '') AND (record_json::jsonb#>>'{payload,group_id}' = $3 OR COALESCE(record_json::jsonb#>>'{payload,group_id}','') = '') ORDER BY occurred_at DESC, fact_id DESC`, [tenant.tenant_id, tenant.project_id, tenant.group_id]).catch(() => ({ rows: [] as any[] }));
  const acceptanceQ = await pool.query(`SELECT record_json FROM facts WHERE record_json::jsonb->>'type' = 'acceptance_result_v1' AND record_json::jsonb#>>'{payload,tenant_id}' = $1 AND (record_json::jsonb#>>'{payload,project_id}' = $2 OR COALESCE(record_json::jsonb#>>'{payload,project_id}','') = '') AND (record_json::jsonb#>>'{payload,group_id}' = $3 OR COALESCE(record_json::jsonb#>>'{payload,group_id}','') = '')`, [tenant.tenant_id, tenant.project_id, tenant.group_id]).catch(() => ({ rows: [] as any[] }));
  const acceptanceByOperation = new Map<string, any>();
  for (const row of acceptanceQ.rows ?? []) { const payload = safeJsonParse(row.record_json)?.payload ?? {}; const operationId = String(payload.operation_id ?? payload.operation_plan_id ?? "").trim(); if (operationId) acceptanceByOperation.set(operationId, payload); }
  const byOperation = new Map<string, OperationFactProjection>();
  for (const row of planQ.rows ?? []) {
    const payload = safeJsonParse(row.record_json)?.payload ?? {};
    const operationId = String(payload.operation_id ?? payload.operation_plan_id ?? "").trim();
    if (!operationId || byOperation.has(operationId)) continue;
    const fieldId = String(payload.field_id ?? payload.spatial_scope?.field_id ?? "").trim() || null;
    if (fieldId && !isFieldAllowedByCustomerScope(scope, fieldId)) continue;
    const acceptance = acceptanceByOperation.get(operationId) ?? {};
    const verdict = textOrNull(acceptance.verdict);
    const formal = Boolean(acceptance.formal_acceptance === true && acceptance.customer_visible_eligible === true && String(verdict ?? "").toUpperCase() === "PASS");
    byOperation.set(operationId, { operation_id: operationId, operation_plan_id: String(payload.operation_plan_id ?? operationId).trim() || operationId, field_id: fieldId, operation_type: textOrNull(payload.action_type ?? payload.operation_type), final_status: textOrNull(payload.final_status), updated_at: String(row.occurred_at ?? "") || null, formal_acceptance: formal, formal_evidence_passed: Boolean(acceptance.formal_evidence_passed), verdict, customer_visible_eligible: formal });
  }
  return Array.from(byOperation.values());
}
function operationToCustomerItem(op: OperationFactProjection, fieldNameById: Map<string, string | null>): CustomerOperationListItem {
  const formal = op.formal_acceptance && op.customer_visible_eligible;
  const operationType = operationDisplayType(op.operation_type);
  const fallbackState = { final_status: limitedFinalStatusFromState(), acceptance_status: limitedAcceptanceStatusFromState(), pending: formalPendingAcceptanceFromState() };
  return { projection_source: formal ? "GUARDED_REPORT" : STATE_FALLBACK_TRUST.projection_source, fallback_limited: !formal, customer_visible_eligible: formal, blocking_reasons: formal ? [] : [...STATE_FALLBACK_TRUST.blocking_reasons], data_trust_status: formal ? "FORMAL" : "LIMITED", data_trust_text: formal ? FORMAL_TRUST_TEXT : LIMITED_TRUST_TEXT, operation_id: op.operation_id, operation_plan_id: op.operation_plan_id, field_id: op.field_id, field_name: op.field_id ? (fieldNameById.get(op.field_id) ?? null) : null, title: `${operationType}作业`, customer_title: `${operationType}作业`, operation_type: op.operation_type, final_status: formal ? "作业已通过验收" : fallbackState.final_status, acceptance_status: formal ? "证据已通过" : fallbackState.acceptance_status, evidence_status: formal ? "证据已通过" : "证据待补充或有限记录", evidence_summary_status: formal ? "证据已通过" : "证据待补充或有限记录", updated_at: op.updated_at, executed_at: op.updated_at };
}
function memoryMetricText(row: any): string { const key = String(row.metric_key ?? "").toLowerCase(); if (key.includes("soil_moisture")) return `土壤水分：${String(row.metric_value ?? row.after_value ?? "待补充")}`; return "地块响应指标已记录"; }

export function registerCustomerV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/customer/reports", async (req, reply) => {
    const ctx = scopeFromRequest(req, reply); if (!ctx) return;
    const generatedAt = new Date().toISOString();
    const fields = await queryFieldRows(pool, ctx.tenant, ctx.scope);
    const operations = await queryOperationsFromFacts(pool, ctx.tenant, ctx.scope);
    const operationFieldIds = operations.map((op) => op.field_id).filter((x): x is string => Boolean(x));
    const fieldIds = Array.from(new Set([...fields.map((field) => field.field_id), ...operationFieldIds]));
    const fieldNameById = new Map(fields.map((field) => [field.field_id, field.field_name] as const));
    for (const [fieldId, name] of await queryFieldNameMap(pool, ctx.tenant, fieldIds)) if (!fieldNameById.has(fieldId)) fieldNameById.set(fieldId, name);
    const reports: CustomerReportListItem[] = [{ report_type: "OVERVIEW", title: "经营总览报告", subtitle: limitedSubtitle("基于当前客户驾驶舱可见数据生成"), href: "/customer/export", updated_at: generatedAt, status_text: CUSTOMER_CAPABILITY_REVIEW_TEXT, capability_status: "AVAILABLE", data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT }];
    for (const fieldId of fieldIds.slice(0, 20)) reports.push({ report_type: "FIELD", title: `${fieldNameById.get(fieldId) ?? "地块"} · 地块报告`, subtitle: limitedSubtitle("基于当前可见地块数据生成"), href: `/customer/fields/${encodeURIComponent(fieldId)}`, field_id: fieldId, field_name: fieldNameById.get(fieldId) ?? null, updated_at: generatedAt, status_text: CUSTOMER_CAPABILITY_REVIEW_TEXT, capability_status: "AVAILABLE", data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT });
    for (const op of operations.slice(0, 30)) { const operationTitle = operationDisplayType(op.operation_type); reports.push({ report_type: "OPERATION", title: `${operationTitle} · 作业报告`, subtitle: limitedSubtitle("基于当前近期作业生成，状态需以受保护作业报告为准"), href: `/customer/operations/${encodeURIComponent(op.operation_id)}`, operation_id: op.operation_id, operation_title: operationTitle, field_id: op.field_id, field_name: op.field_id ? (fieldNameById.get(op.field_id) ?? null) : null, updated_at: op.updated_at ?? generatedAt, status_text: op.formal_acceptance ? "能力可用，已有正式验收" : CUSTOMER_CAPABILITY_REVIEW_TEXT, capability_status: op.formal_acceptance ? "AVAILABLE" : "PENDING", data_trust_status: op.formal_acceptance ? "FORMAL" : "LIMITED", data_trust_text: op.formal_acceptance ? FORMAL_TRUST_TEXT : LIMITED_TRUST_TEXT }); }
    reports.push({ report_type: "EVIDENCE_VALUE", title: "证据与价值报告", subtitle: "证据包生成能力待接入；当前数据可信级别为有限记录，不代表正式经营结论", href: null, updated_at: generatedAt, status_text: CUSTOMER_CAPABILITY_REVIEW_TEXT, capability_status: "PENDING", data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT });
    return reply.send({ ok: true, source: "customer_reports_api", dataScope: "customer_report_center_v1", ...STATE_FALLBACK_TRUST, data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT, generated_at: generatedAt, scope: ctx.scope, report_count: reports.length, reports });
  });

  app.get("/api/v1/customer/operations", async (req, reply) => {
    const ctx = scopeFromRequest(req, reply); if (!ctx) return;
    const operations = await queryOperationsFromFacts(pool, ctx.tenant, ctx.scope);
    const fieldIds = Array.from(new Set(operations.map((op) => op.field_id).filter((x): x is string => Boolean(x))));
    const fieldNameById = await queryFieldNameMap(pool, ctx.tenant, fieldIds);
    const items = operations.map((op) => operationToCustomerItem(op, fieldNameById));
    const hasFormalOperation = items.some((item) => item.customer_visible_eligible === true);
    return reply.send({ ok: true, source: "customer_operations_api", dataScope: "customer_operations_v1", projection_source: hasFormalOperation ? "GUARDED_REPORT" : "STATE_FALLBACK_LIMITED", fallback_limited: !hasFormalOperation, customer_visible_eligible: hasFormalOperation, data_trust_status: hasFormalOperation ? "FORMAL" : "LIMITED", data_trust_text: hasFormalOperation ? FORMAL_TRUST_TEXT : LIMITED_TRUST_TEXT, blocking_reasons: hasFormalOperation ? [] : LIMITED_BLOCKING_REASONS, generated_at: new Date().toISOString(), scope: ctx.scope, operation_count: items.length, operations: items });
  });

  app.get("/api/v1/customer/fields", async (req, reply) => {
    const ctx = scopeFromRequest(req, reply); if (!ctx) return;
    const fields = await queryFieldRows(pool, ctx.tenant, ctx.scope);
    const operations = await queryOperationsFromFacts(pool, ctx.tenant, ctx.scope);
    const openAlertsByField = await queryOpenAlertCountByField(pool, ctx.tenant, fields.map((field) => field.field_id));
    const latestByField = new Map<string, OperationFactProjection>();
    for (const op of operations) if (op.field_id && !latestByField.has(op.field_id)) latestByField.set(op.field_id, op);
    const items: CustomerFieldListItem[] = fields.map((field) => { const latest = latestByField.get(field.field_id); const agg = { pendingAcceptanceCount: operations.filter((op) => op.field_id === field.field_id && !op.formal_acceptance).length }; return { ...STATE_FALLBACK_TRUST, data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT, field_id: field.field_id, field_name: field.field_name, risk_level: "UNKNOWN", risk_reasons: [], updated_at: latest?.updated_at ?? field.updated_at, crop_name: null, stage_name: null, recent_operation_id: latest?.operation_id ?? null, recent_operation_title: latest ? `${operationDisplayType(latest.operation_type)}作业` : null, open_alerts_count: Number(openAlertsByField.get(field.field_id) ?? 0), pending_acceptance_count: Number(agg?.pendingAcceptanceCount ?? 0) }; });
    return reply.send({ ok: true, source: "customer_fields_api", dataScope: "customer_fields_v1", ...STATE_FALLBACK_TRUST, data_trust_status: "LIMITED", data_trust_text: LIMITED_TRUST_TEXT, generated_at: new Date().toISOString(), scope: ctx.scope, field_count: items.length, fields: items });
  });

  app.get("/api/v1/customer/fields/:fieldId/memory", async (req, reply) => {
    const ctx = scopeFromRequest(req, reply); if (!ctx) return;
    const fieldId = String((req.params as any)?.fieldId ?? "").trim();
    if (!fieldId || !isFieldAllowedByCustomerScope(ctx.scope, fieldId)) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const rows = await pool.query(`SELECT memory_id, field_id, operation_id, summary_text, summary, metric_key, metric_value, after_value, confidence, created_at, updated_at, occurred_at, formal_acceptance_id FROM field_memory_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 AND memory_lane = 'FORMAL_FIELD_MEMORY' AND trust_level = 'FORMAL_ACCEPTED' AND customer_visible_memory = true AND learning_eligible = true AND formal_acceptance_id IS NOT NULL ORDER BY COALESCE(updated_at, created_at, occurred_at) DESC NULLS LAST LIMIT 20`, [ctx.tenant.tenant_id, ctx.tenant.project_id, ctx.tenant.group_id, fieldId]).catch(() => ({ rows: [] as any[] }));
    const items = (rows.rows ?? []).map((row: any) => ({ memory_id: String(row.memory_id ?? "").trim(), field_id: fieldId, operation_id: textOrNull(row.operation_id), formal_acceptance_id: textOrNull(row.formal_acceptance_id), title: "田块记忆", summary_text: textOrNull(row.summary_text ?? row.summary) ?? "暂无田块记忆摘要", metric_text: memoryMetricText(row), confidence_text: Number(row.confidence ?? 0) >= 0.8 ? "可信度较高" : "需继续跟踪", updated_at: row.updated_at ?? row.created_at ?? row.occurred_at ?? null, data_trust_status: "FORMAL", data_trust_text: FORMAL_TRUST_TEXT }));
    return reply.send({ ok: true, source: "customer_field_memory_api", dataScope: "customer_field_memory_v1", field_id: fieldId, projection_source: "STATE_FALLBACK_LIMITED", fallback_limited: items.length === 0, customer_visible_eligible: items.length > 0, data_trust_status: items.length ? "FORMAL" : "LIMITED", data_trust_text: items.length ? FORMAL_TRUST_TEXT : LIMITED_TRUST_TEXT, blocking_reasons: items.length ? [] : LIMITED_BLOCKING_REASONS, generated_at: new Date().toISOString(), scope: ctx.scope, memory_count: items.length, items, memories: items });
  });

  app.get("/api/v1/customer/fields/:fieldId/geometry", async (req, reply) => {
    const ctx = scopeFromRequest(req, reply); if (!ctx) return;
    const fieldId = String((req.params as any)?.fieldId ?? "").trim();
    if (!fieldId || !isFieldAllowedByCustomerScope(ctx.scope, fieldId)) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const fieldQ = await pool.query(`SELECT field_id, area_ha FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`, [ctx.tenant.tenant_id, fieldId]);
    if (fieldQ.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const geoQ = await pool.query(`SELECT polygon_geojson_json AS geojson, updated_ts_ms FROM field_polygon_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`, [ctx.tenant.tenant_id, fieldId]);
    const geometry = normalizeGeometry(geoQ.rows?.[0]?.geojson ?? null);
    const areaHa = Number(fieldQ.rows?.[0]?.area_ha ?? NaN);
    const payload: CustomerFieldGeometryResponse = { field_id: fieldId, geometry_status: geometry ? "AVAILABLE" : (geoQ.rows?.[0]?.geojson == null ? "MISSING" : "INVALID"), geometry_format: "GEOJSON", geometry, area_mu: Number.isFinite(areaHa) ? Number((areaHa * 15).toFixed(4)) : null, centroid: geometryCentroid(geometry), updated_at: toIsoFromMs(geoQ.rows?.[0]?.updated_ts_ms ?? 0) };
    return reply.send({ ok: true, source: "customer_fields_geometry_api", dataScope: "customer_fields_geometry_v1", scope: ctx.scope, ...payload });
  });
}
