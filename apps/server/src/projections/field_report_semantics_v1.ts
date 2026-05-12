import type { Pool } from "pg";
import type { FieldReportDetailV1 } from "./report_dashboard_v1.js";
import type { OperationReportV1 } from "./report_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type FieldGeometryV1 = {
  geometry_id: string | null;
  geometry: Record<string, unknown> | null;
  area_m2: number | null;
  area_mu: number | null;
  centroid: { lat: number; lng: number } | null;
};

type FactRow = { fact_id: string; occurred_at: string; record_json: any };

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

function parseJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
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

async function loadFieldGeometry(pool: Pool, tenant: TenantTriple, fieldId: string): Promise<FieldGeometryV1> {
  const empty = { geometry_id: null, geometry: null, area_m2: null, area_mu: null, centroid: null };
  const q = await pool.query(
    `SELECT polygon_geojson_json, area_m2
       FROM field_polygon_v1
      WHERE tenant_id = $1 AND field_id = $2
      LIMIT 1`,
    [tenant.tenant_id, fieldId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  const geometry = parseJson(row?.polygon_geojson_json);
  if (!geometry) return empty;
  const area_m2 = num(row?.area_m2);
  return {
    geometry_id: `geom_${fieldId}`,
    geometry,
    area_m2,
    area_mu: area_m2 == null ? null : Number((area_m2 / 666.6666667).toFixed(4)),
    centroid: centroidFromGeometry(geometry),
  };
}

async function loadLatestRecommendationFact(pool: Pool, tenant: TenantTriple, fieldId: string): Promise<FactRow | null> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,field_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 10`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  if (!row) return null;
  return { fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), record_json: parseJson(row.record_json) ?? row.record_json };
}

function operationTimeMs(report: OperationReportV1): number {
  const candidates = [report.acceptance?.generated_at, report.execution?.execution_finished_at, report.generated_at];
  for (const candidate of candidates) {
    const ms = Date.parse(String(candidate ?? ""));
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return 0;
}

function operationTypeFrom(report: OperationReportV1): string | null {
  const title = String(report.customer_title ?? report.operation_title ?? "");
  if (title.includes("灌溉")) return "IRRIGATE";
  if (title.includes("施肥")) return "FERTILIZE";
  if (title.includes("喷药") || title.includes("喷施")) return "SPRAY";
  if (title.includes("巡检")) return "INSPECT";
  return text((report as any).operation_type ?? (report as any).action_type);
}

function recentOperationFrom(reports: OperationReportV1[]): any | null {
  const report = [...reports].sort((a, b) => operationTimeMs(b) - operationTimeMs(a))[0] ?? null;
  if (!report) return null;
  const accepted = String(report.acceptance?.status ?? report.acceptance?.verdict ?? "").toUpperCase();
  const opType = operationTypeFrom(report);
  const opLabel = opType === "IRRIGATE" ? "灌溉" : opType === "FERTILIZE" ? "施肥" : opType === "SPRAY" ? "喷药" : opType === "INSPECT" ? "巡检" : (report.customer_title ?? report.operation_title ?? "作业");
  return {
    operation_id: report.identifiers.operation_id || report.identifiers.operation_plan_id,
    operation_type: opType,
    final_status: report.execution.final_status,
    accepted_at: report.acceptance?.generated_at ?? null,
    summary: accepted === "PASS" ? `${opLabel}，已验收` : `${opLabel}，${report.execution.final_status}`,
  };
}

function buildCurrentRecommendation(params: { latestRecommendation: FactRow | null; reports: OperationReportV1[]; cropKnown: boolean }): any | null {
  if (!params.latestRecommendation || !params.cropKnown) return null;
  const payload = params.latestRecommendation.record_json?.payload ?? {};
  const recommendationId = text(payload.recommendation_id);
  if (!recommendationId) return null;
  const linkedRecommendationIds = new Set(params.reports.map((report) => text(report.identifiers.recommendation_id)).filter(Boolean) as string[]);
  if (linkedRecommendationIds.has(recommendationId)) return null;
  const actionType = text(payload.suggested_action?.action_type ?? payload.action_type);
  return {
    recommendation_id: recommendationId,
    action_type: actionType,
    summary: text(payload.suggested_action?.summary ?? payload.summary ?? payload.action_summary),
    reason_codes: Array.isArray(payload.reason_codes) ? payload.reason_codes.map((x: unknown) => String(x)).filter(Boolean) : [],
    evidence_refs: Array.isArray(payload.evidence_refs) ? payload.evidence_refs.map((x: unknown) => String(x)).filter(Boolean) : [],
    confidence: payload.confidence ?? payload.skill_trace?.confidence?.level ?? null,
    status: text(payload.status ?? "proposed"),
    source: "decision_recommendation_v1",
  };
}

function buildCropContext(latestRecommendation: FactRow | null): any {
  const payload = latestRecommendation?.record_json?.payload ?? {};
  const cropCode = text(payload.crop_code);
  const cropStage = text(payload.crop_stage);
  const confidence = payload.confidence ?? payload.skill_trace?.confidence?.level ?? null;
  if (!cropCode && !cropStage) return { status: "UNKNOWN", crop_code: null, crop_stage: null, confidence: null, source: "not_available" };
  return { status: "AVAILABLE", crop_code: cropCode, crop_stage: cropStage, confidence, source: "decision_recommendation_v1" };
}

function buildDiagnosisBasis(report: FieldReportDetailV1, cropContext: any, latestRecommendation: FactRow | null): any {
  const observations = {
    risk_level: report.overview.current_risk_level,
    open_alerts_count: report.overview.open_alerts_count,
    pending_acceptance_count: report.overview.pending_acceptance_count,
    latest_operation_at: report.overview.latest_operation_at,
  };
  const evidenceRefs = Array.isArray(latestRecommendation?.record_json?.payload?.evidence_refs)
    ? latestRecommendation?.record_json?.payload?.evidence_refs.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  const hasBasis = evidenceRefs.length > 0 || report.explain.top_reasons.length > 0 || report.overview.total_operations_count > 0;
  return {
    status: hasBasis ? "AVAILABLE" : (report.overview.current_risk_level === "LOW" ? "NOT_APPLICABLE" : "INSUFFICIENT"),
    observations,
    weather: null,
    crop_context: cropContext,
    evidence_refs: evidenceRefs,
  };
}

export async function enrichFieldReportSemanticsV1(params: {
  pool: Pool;
  tenant: TenantTriple;
  fieldReport: FieldReportDetailV1;
  reports: OperationReportV1[];
}): Promise<FieldReportDetailV1> {
  const { pool, tenant, fieldReport, reports } = params;
  const fieldId = fieldReport.field.field_id;
  const [geometry, latestRecommendation] = await Promise.all([
    loadFieldGeometry(pool, tenant, fieldId),
    loadLatestRecommendationFact(pool, tenant, fieldId),
  ]);
  const cropContext = buildCropContext(latestRecommendation);
  const currentRecommendation = buildCurrentRecommendation({ latestRecommendation, reports, cropKnown: cropContext.status === "AVAILABLE" });
  const recentOperation = recentOperationFrom(reports);
  const diagnosisBasis = buildDiagnosisBasis(fieldReport, cropContext, latestRecommendation);
  const risk = {
    level: fieldReport.overview.current_risk_level,
    reasons: fieldReport.explain.top_reasons ?? [],
    evidence_refs: diagnosisBasis.evidence_refs ?? [],
  };

  return {
    ...fieldReport,
    field: {
      ...fieldReport.field,
      geometry_id: geometry.geometry_id,
      geometry: geometry.geometry,
      area_m2: geometry.area_m2,
      area_mu: geometry.area_mu,
      centroid: geometry.centroid,
    } as any,
    crop_context: cropContext,
    risk,
    diagnosis_basis: diagnosisBasis,
    current_recommendation: currentRecommendation,
    recent_operation: recentOperation,
    next_action: currentRecommendation ? {
      recommendation_id: currentRecommendation.recommendation_id,
      explain_human: currentRecommendation.summary,
      objective_text: currentRecommendation.reason_codes?.join("、") || null,
      action_type: currentRecommendation.action_type,
      priority: null,
    } : null,
  } as any;
}
