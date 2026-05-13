import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { resolveCropContextV1 } from "../domain/crop/crop_context_v1.js";
import { resolveFieldObservabilityProfileV1 } from "../domain/field/field_observability_profile_v1.js";
import { buildCropPlanCandidatesV1 } from "../domain/crop/crop_planning_v1.js";

function pathOnly(url: string | undefined): string {
  return String(url ?? "").split("?")[0];
}

function isFieldReportPath(url: string | undefined): boolean {
  return /^\/api\/v1\/reports\/field\/[^/]+$/.test(pathOnly(url));
}

function parsePayload(payload: unknown): any | null {
  if (Buffer.isBuffer(payload)) {
    try { return JSON.parse(payload.toString("utf8")); } catch { return null; }
  }
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return null; }
  }
  if (payload && typeof payload === "object") return payload;
  return null;
}

function parseJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const out = value.trim();
    return out || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function collectCoordinates(node: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(node) || node.length === 0) return;
  if (node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
    const lng = Number(node[0]);
    const lat = Number(node[1]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) out.push([lng, lat]);
    return;
  }
  for (const child of node) collectCoordinates(child, out);
}

function centroidFromGeometry(geometry: Record<string, unknown> | null): { lat: number; lng: number } | null {
  if (!geometry) return null;
  const points: Array<[number, number]> = [];
  collectCoordinates((geometry as any).coordinates, points);
  if (!points.length) return null;
  const sum = points.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return { lat: Number((sum.lat / points.length).toFixed(6)), lng: Number((sum.lng / points.length).toFixed(6)) };
}

async function loadGeometry(pool: Pool, fieldId: string) {
  const q = await pool.query(
    `SELECT polygon_geojson_json, area_m2
       FROM field_polygon_v1
      WHERE field_id = $1
      ORDER BY updated_ts_ms DESC NULLS LAST, created_ts_ms DESC NULLS LAST
      LIMIT 1`,
    [fieldId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  const geometry = parseJson(row?.polygon_geojson_json);
  const area_m2 = num(row?.area_m2);
  return {
    geometry_id: geometry ? `geom_${fieldId}` : null,
    geometry,
    area_m2,
    area_mu: area_m2 == null ? null : Number((area_m2 / 666.6666667).toFixed(4)),
    centroid: centroidFromGeometry(geometry),
  };
}

async function latestRecommendation(pool: Pool, fieldId: string) {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='decision_recommendation_v1'
        AND (record_json::jsonb#>>'{payload,field_id}')=$1
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [fieldId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  return row ? { fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), record_json: parseJson(row.record_json) ?? row.record_json } : null;
}

async function recommendationClosed(pool: Pool, recommendationId: string): Promise<boolean> {
  const q = await pool.query(
    `SELECT fact_id
       FROM facts
      WHERE (record_json::jsonb->>'type')='operation_plan_v1'
        AND (record_json::jsonb#>>'{payload,recommendation_id}')=$1
      LIMIT 1`,
    [recommendationId],
  ).catch(() => ({ rows: [] as any[] }));
  return (q.rows?.length ?? 0) > 0;
}

function operationTypeLabel(operationType: unknown, title: unknown): string {
  const raw = String(operationType ?? title ?? "").toUpperCase();
  if (raw.includes("IRRIG") || String(title ?? "").includes("灌溉")) return "灌溉";
  if (raw.includes("FERT") || String(title ?? "").includes("施肥")) return "施肥";
  if (raw.includes("SPRAY") || String(title ?? "").includes("喷药")) return "喷药";
  if (raw.includes("INSPECT") || String(title ?? "").includes("巡检")) return "巡检";
  return text(title) ?? "作业";
}

function recentOperation(fieldReport: any) {
  const first = Array.isArray(fieldReport.recent_operations) ? fieldReport.recent_operations[0] : null;
  if (!first) return null;
  const label = operationTypeLabel(first.operation_type, first.customer_title ?? first.title);
  const accepted = String(first.acceptance_status ?? "").toUpperCase();
  return {
    operation_id: text(first.operation_id ?? first.operation_plan_id),
    operation_type: text(first.operation_type) ?? (label === "灌溉" ? "IRRIGATE" : null),
    final_status: text(first.final_status),
    accepted_at: text(first.accepted_at ?? first.generated_at),
    summary: accepted === "PASS" ? `${label}，已验收` : `${label}，${first.final_status ?? "状态待确认"}`,
  };
}

function acceptedOperationAfterRecommendation(rec: any, recent: any): boolean {
  if (!rec || !recent) return false;
  const accepted = String(recent.summary ?? "").includes("已验收") || String(recent.final_status ?? "").toUpperCase() === "SUCCESS";
  if (!accepted) return false;
  const recMs = Date.parse(String(rec.occurred_at ?? ""));
  const recentMs = Date.parse(String(recent.accepted_at ?? ""));
  return Number.isFinite(recMs) && Number.isFinite(recentMs) && recentMs >= recMs;
}

async function currentRecommendation(pool: Pool, rec: any, crop: any, recent: any) {
  if (!rec || !crop.allowed_actions?.allow_crop_specific_diagnosis) return null;
  const payload = rec.record_json?.payload ?? {};
  const recommendation_id = text(payload.recommendation_id);
  if (!recommendation_id) return null;
  if (await recommendationClosed(pool, recommendation_id)) return null;
  if (acceptedOperationAfterRecommendation(rec, recent)) return null;
  return {
    recommendation_id,
    action_type: text(payload.suggested_action?.action_type ?? payload.action_type),
    summary: text(payload.suggested_action?.summary ?? payload.summary ?? payload.action_summary),
    reason_codes: Array.isArray(payload.reason_codes) ? payload.reason_codes.map((x: unknown) => String(x)).filter(Boolean) : [],
    evidence_refs: Array.isArray(payload.evidence_refs) ? payload.evidence_refs.map((x: unknown) => String(x)).filter(Boolean) : [],
    confidence: payload.confidence ?? payload.skill_trace?.confidence?.level ?? null,
    status: text(payload.status ?? "proposed"),
    source: "decision_recommendation_v1",
  };
}

function diagnosisBasis(fieldReport: any, crop: any, rec: any) {
  const evidence_refs = Array.isArray(rec?.record_json?.payload?.evidence_refs) ? rec.record_json.payload.evidence_refs.map((x: unknown) => String(x)).filter(Boolean) : [];
  const topReasons = Array.isArray(fieldReport.explain?.top_reasons) ? fieldReport.explain.top_reasons : [];
  const status = evidence_refs.length || topReasons.length || Number(fieldReport.overview?.total_operations_count ?? 0) > 0
    ? "AVAILABLE"
    : String(fieldReport.overview?.current_risk_level ?? "").toUpperCase() === "LOW" ? "NOT_APPLICABLE" : "INSUFFICIENT";
  return {
    status,
    observations: {
      risk_level: fieldReport.overview?.current_risk_level ?? "UNKNOWN",
      open_alerts_count: fieldReport.overview?.open_alerts_count ?? 0,
      pending_acceptance_count: fieldReport.overview?.pending_acceptance_count ?? 0,
      latest_operation_at: fieldReport.overview?.latest_operation_at ?? null,
    },
    weather: null,
    crop_context: crop,
    evidence_refs,
  };
}

function tenantFromReportOrAuth(req: any): { tenant_id: string; project_id: string; group_id: string } {
  const auth = req.aoActAuth ?? req.auth ?? {};
  const query = req.query ?? {};
  return {
    tenant_id: String(query.tenant_id ?? auth.tenant_id ?? ""),
    project_id: String(query.project_id ?? auth.project_id ?? ""),
    group_id: String(query.group_id ?? auth.group_id ?? ""),
  };
}

export function registerFieldReportSemanticsHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isFieldReportPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    const fieldReport = parsed?.field_report_v1;
    const fieldId = text(fieldReport?.field?.field_id);
    if (!fieldReport || !fieldId) return payload;
    const tenant = tenantFromReportOrAuth(req as any);
    const seasonId = text(fieldReport?.crop_context?.season_id ?? fieldReport?.recent_operation?.season_id ?? (req as any).query?.season_id);
    const [geometry, rec, crop, observability] = await Promise.all([
      loadGeometry(pool, fieldId),
      latestRecommendation(pool, fieldId),
      tenant.tenant_id && tenant.project_id && tenant.group_id ? resolveCropContextV1(pool, tenant, fieldId, seasonId) : Promise.resolve(null),
      tenant.tenant_id && tenant.project_id && tenant.group_id ? resolveFieldObservabilityProfileV1(pool, tenant, fieldId) : Promise.resolve(null),
    ]);
    const cropContext = crop ?? { status: "UNKNOWN", crop_code: null, crop_stage: null, allowed_actions: { allow_crop_specific_diagnosis: false, allow_crop_specific_prescription: false, allow_crop_planning: true } };
    const fieldObservabilityProfile = observability ?? null;
    const cropPlanCandidates = fieldObservabilityProfile ? buildCropPlanCandidatesV1({ field_id: fieldId, season_id: seasonId, crop_context: cropContext as any, observability: fieldObservabilityProfile }) : [];
    const recent = recentOperation(fieldReport);
    const current = await currentRecommendation(pool, rec, cropContext, recent);
    const diagnosis = diagnosisBasis(fieldReport, cropContext, rec);
    const risk = {
      level: fieldReport.overview?.current_risk_level ?? "UNKNOWN",
      reasons: Array.isArray(fieldReport.explain?.top_reasons) ? fieldReport.explain.top_reasons : [],
      evidence_refs: diagnosis.evidence_refs,
    };
    const enriched = {
      ...fieldReport,
      field: { ...fieldReport.field, ...geometry },
      field_observability_profile: fieldObservabilityProfile,
      crop_context: cropContext,
      crop_plan_candidates: cropPlanCandidates,
      risk,
      diagnosis_basis: diagnosis,
      current_recommendation: current,
      recent_operation: recent,
      next_action: current ? {
        recommendation_id: current.recommendation_id,
        explain_human: current.summary,
        objective_text: current.reason_codes?.join("、") || null,
        action_type: current.action_type,
        priority: null,
      } : null,
    };
    return JSON.stringify({ ...parsed, field_report_v1: enriched });
  });
}
