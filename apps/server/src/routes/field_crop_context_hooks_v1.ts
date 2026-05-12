import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { resolveCropContextV1, isCropSpecificActionV1 } from "../domain/crop/crop_context_v1.js";
import { resolveFieldObservabilityProfileV1 } from "../domain/field/field_observability_profile_v1.js";
import { buildCropPlanCandidatesV1 } from "../domain/crop/crop_planning_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

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

function pathOnly(url: string | undefined): string {
  return String(url ?? "").split("?")[0];
}

function isRecommendationGeneratePath(url: string | undefined): boolean {
  return pathOnly(url) === "/api/v1/recommendations/generate";
}

function isPrescriptionFromRecommendationPath(url: string | undefined): boolean {
  const path = pathOnly(url);
  return path === "/api/v1/prescriptions/from-recommendation" || path === "/api/v1/prescriptions/variable/from-recommendation";
}

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function tenantFromAuthOrBody(req: any): TenantTriple {
  const body = req.body ?? {};
  const auth = req.aoActAuth ?? req.auth ?? {};
  return {
    tenant_id: String(body.tenant_id ?? auth.tenant_id ?? ""),
    project_id: String(body.project_id ?? auth.project_id ?? ""),
    group_id: String(body.group_id ?? auth.group_id ?? ""),
  };
}

function actionOfRecommendation(rec: any): string | null {
  return text(rec?.action_type ?? rec?.suggested_action?.action_type ?? rec?.recommendation_type);
}

function isCropSpecificRecommendation(rec: any): boolean {
  return isCropSpecificActionV1(actionOfRecommendation(rec)) || Boolean(text(rec?.crop_code)) || Boolean(text(rec?.crop_stage));
}

function pickBodyField(req: any): { tenant: TenantTriple; field_id: string | null; season_id: string | null } {
  const body = req.body ?? {};
  return { tenant: tenantFromAuthOrBody(req), field_id: text(body.field_id), season_id: text(body.season_id) };
}

async function loadRecommendationFact(pool: Pool, tenant: TenantTriple, recommendation_id: string): Promise<any | null> {
  const q = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendation_id],
  ).catch(() => ({ rows: [] as any[] }));
  return q.rows?.[0]?.record_json?.payload ?? null;
}

export function registerFieldCropContextDecisionHookV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isRecommendationGeneratePath(req.url)) return payload;
    const parsed = parsePayload(payload);
    if (!parsed || typeof parsed !== "object") return payload;
    const { tenant, field_id, season_id } = pickBodyField(req as any);
    if (!field_id || !tenant.tenant_id || !tenant.project_id || !tenant.group_id) return payload;
    const crop_context = await resolveCropContextV1(pool, tenant, field_id, season_id);
    const field_observability_profile = await resolveFieldObservabilityProfileV1(pool, tenant, field_id);
    const crop_plan_candidates = buildCropPlanCandidatesV1({ field_id, season_id, crop_context, observability: field_observability_profile });

    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const filtered = crop_context.allowed_actions.allow_crop_specific_diagnosis
      ? recommendations
      : recommendations.filter((rec: any) => !isCropSpecificRecommendation(rec));
    const blocked = recommendations.length - filtered.length;

    return JSON.stringify({
      ...parsed,
      recommendations: filtered,
      crop_context,
      field_observability_profile,
      crop_plan_candidates,
      crop_context_guard: {
        blocked_crop_specific_recommendations: blocked,
        reason: blocked > 0 ? `crop_context.status=${crop_context.status} does not allow crop specific diagnosis` : null,
      },
    });
  });
}

export function registerFieldCropContextPrescriptionGuardV1(app: FastifyInstance, pool: Pool): void {
  app.addHook("preHandler", async (req, reply) => {
    if (!isPrescriptionFromRecommendationPath(req.url)) return;
    const body: any = (req as any).body ?? {};
    const recommendation_id = text(body.recommendation_id);
    if (!recommendation_id) return;
    const tenant = tenantFromAuthOrBody(req as any);
    if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) return;
    const rec = await loadRecommendationFact(pool, tenant, recommendation_id);
    if (!rec) return;
    const field_id = text(rec.field_id);
    if (!field_id) return;
    const crop_context = await resolveCropContextV1(pool, tenant, field_id, text(rec.season_id));
    if (isCropSpecificRecommendation(rec) && !crop_context.allowed_actions.allow_crop_specific_prescription) {
      return reply.status(400).send({
        ok: false,
        error: "CROP_CONTEXT_NOT_CONFIRMED_FOR_PRESCRIPTION",
        crop_context,
        reason: `crop_context.status=${crop_context.status} does not allow crop specific prescription`,
      });
    }
  });
}
