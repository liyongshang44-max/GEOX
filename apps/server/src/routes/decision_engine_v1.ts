import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type RecommendationTypeV1 = "irrigation_recommendation_v1" | "crop_health_alert_v1";

type RecommendationV1 = {
  recommendation_id: string;
  field_id: string;
  season_id: string;
  device_id: string;
  recommendation_type: RecommendationTypeV1;
  status: "proposed" | "approved" | "rejected" | "executed";
  reason_codes: string[];
  evidence_refs: string[];
  rule_hit: Array<{ rule_id: string; matched: boolean; threshold?: number | null; actual?: number | null }>;
  confidence: number;
  suggested_action: {
    action_type: string;
    summary: string;
    parameters: Record<string, any>;
  };
  created_ts: number;
  model_version: "decision_engine_v1";
};

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function requireTenantMatchOr404(auth: AoActAuthContextV0, tenant: TenantTriple, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}


function isExecutorToken(auth: AoActAuthContextV0): boolean {
  const actor = String(auth.actor_id ?? "").toLowerCase();
  const tokenId = String(auth.token_id ?? "").toLowerCase();
  return actor.includes("executor") || tokenId.includes("executor");
}

function hasExecutorRuntimeScopes(auth: AoActAuthContextV0): boolean {
  const scopes = Array.isArray(auth.scopes) ? auth.scopes : [];
  return scopes.includes("ao_act.task.write") && scopes.includes("ao_act.receipt.write");
}

function hostBaseUrl(req: FastifyRequest): string {
  const envBase = String(process.env.GEOX_INTERNAL_BASE_URL ?? "").trim();
  if (envBase) return envBase;
  const host = String((req.headers as any).host ?? "127.0.0.1:3000");
  return `http://${host}`;
}

async function fetchJson(url: string, authz: string, body?: any): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(authz ? { authorization: authz } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  return { ok: res.ok, status: res.status, json };
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json]
  );
  return fact_id;
}

function recommendationEvidenceFacts(body: any): Array<{ key: string; value: number | null; unit: string | null; source: string }> {
  const telemetry = (body?.telemetry && typeof body.telemetry === "object") ? body.telemetry : {};
  const image = (body?.image_recognition && typeof body.image_recognition === "object") ? body.image_recognition : {};
  const toNum = (x: any): number | null => Number.isFinite(Number(x)) ? Number(x) : null;
  return [
    { key: "soil_moisture_pct", value: toNum(telemetry.soil_moisture_pct), unit: "%", source: "telemetry" },
    { key: "canopy_temp_c", value: toNum(telemetry.canopy_temp_c), unit: "c", source: "telemetry" },
    { key: "image_stress_score", value: toNum(image.stress_score), unit: null, source: "image_recognition" },
    { key: "image_disease_score", value: toNum(image.disease_score), unit: null, source: "image_recognition" },
    { key: "image_pest_risk_score", value: toNum(image.pest_risk_score), unit: null, source: "image_recognition" }
  ];
}

function buildRecommendations(body: any): RecommendationV1[] {
  const field_id = String(body.field_id ?? "").trim();
  const season_id = String(body.season_id ?? "").trim();
  const device_id = String(body.device_id ?? "").trim();
  if (!field_id || !season_id || !device_id) return [];

  const telemetry = (body.telemetry && typeof body.telemetry === "object") ? body.telemetry : {};
  const image = (body.image_recognition && typeof body.image_recognition === "object") ? body.image_recognition : {};
  const now = Date.now();

  const soilMoisture = Number(telemetry.soil_moisture_pct ?? NaN);
  const canopyTemp = Number(telemetry.canopy_temp_c ?? NaN);
  const stressScore = clamp01(Number(image.stress_score ?? 0));
  const diseaseScore = clamp01(Number(image.disease_score ?? 0));
  const pestRisk = clamp01(Number(image.pest_risk_score ?? 0));
  const imageConfidence = clamp01(Number(image.confidence ?? 0.8));

  const out: RecommendationV1[] = [];

  const irrigationNeed = (Number.isFinite(soilMoisture) && soilMoisture < 35) || (Number.isFinite(canopyTemp) && canopyTemp >= 32 && stressScore >= 0.45);
  if (irrigationNeed) {
    const moistureTerm = Number.isFinite(soilMoisture) ? clamp01((45 - soilMoisture) / 45) : 0.2;
    const heatTerm = Number.isFinite(canopyTemp) ? clamp01((canopyTemp - 28) / 12) : 0.2;
    const confidence = Number((0.45 + 0.3 * moistureTerm + 0.15 * heatTerm + 0.1 * imageConfidence).toFixed(3));
    const durationMin = Number.isFinite(soilMoisture) && soilMoisture < 25 ? 35 : 20;
    out.push({
      recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
      field_id,
      season_id,
      device_id,
      recommendation_type: "irrigation_recommendation_v1",
      status: "proposed",
      reason_codes: ["soil_moisture_low_or_heat_stress"],
      evidence_refs: ["telemetry:soil_moisture", "telemetry:canopy_temp", "image:stress_score"],
      rule_hit: [
        { rule_id: "irrigation_rule_soil_moisture_v1", matched: Number.isFinite(soilMoisture) ? soilMoisture < 35 : false, threshold: 35, actual: Number.isFinite(soilMoisture) ? soilMoisture : null },
        { rule_id: "irrigation_rule_heat_stress_v1", matched: Number.isFinite(canopyTemp) ? (canopyTemp >= 32 && stressScore >= 0.45) : false, threshold: 32, actual: Number.isFinite(canopyTemp) ? canopyTemp : null }
      ],
      confidence,
      suggested_action: {
        action_type: "irrigation.start",
        summary: `土壤湿度偏低（${Number.isFinite(soilMoisture) ? `${soilMoisture}%` : "未知"}），建议执行灌溉。`,
        parameters: {
          duration_min: durationMin,
          water_l_per_min: 18,
          trigger: {
            soil_moisture_pct: Number.isFinite(soilMoisture) ? soilMoisture : null,
            canopy_temp_c: Number.isFinite(canopyTemp) ? canopyTemp : null,
            image_stress_score: stressScore
          }
        }
      },
      created_ts: now,
      model_version: "decision_engine_v1"
    });
  }

  const healthRisk = Math.max(stressScore, diseaseScore, pestRisk);
  if (healthRisk >= 0.7) {
    const confidence = Number((0.5 + 0.45 * healthRisk + 0.05 * imageConfidence).toFixed(3));
    const alertKind = diseaseScore >= pestRisk ? "disease" : "pest";
    out.push({
      recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
      field_id,
      season_id,
      device_id,
      recommendation_type: "crop_health_alert_v1",
      status: "proposed",
      reason_codes: ["image_health_risk_high"],
      evidence_refs: ["image:disease_score", "image:pest_risk_score", "image:stress_score"],
      rule_hit: [
        { rule_id: "crop_health_risk_rule_v1", matched: healthRisk >= 0.7, threshold: 0.7, actual: healthRisk }
      ],
      confidence,
      suggested_action: {
        action_type: "crop.health.alert",
        summary: `图像识别到较高${alertKind === "disease" ? "病害" : "虫害"}风险，请人工复核并安排处置。`,
        parameters: {
          alert_kind: alertKind,
          risk_score: healthRisk,
          disease_score: diseaseScore,
          pest_risk_score: pestRisk,
          stress_score: stressScore
        }
      },
      created_ts: now,
      model_version: "decision_engine_v1"
    });
  }

  return out;
}

async function loadRecommendationById(pool: Pool, recommendation_id: string, tenant: TenantTriple): Promise<any | null> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendation_id]
  );
  if (!res.rows.length) return null;
  const row: any = res.rows[0];
  return { fact_id: String(row.fact_id), occurred_at: String(row.occurred_at), record_json: parseJsonMaybe(row.record_json) ?? row.record_json };
}

async function loadRecommendationChainById(pool: Pool, recommendation_id: string, tenant: TenantTriple): Promise<{ approval_request_id: string | null; operation_plan_id: string | null; act_task_id: string | null; receipt_fact_id: string | null; latest_status: string | null }> {
  const q = await pool.query(
    `WITH latest_link AS (
       SELECT (record_json::jsonb#>>'{payload,approval_request_id}') AS approval_request_id
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'decision_recommendation_approval_link_v1'
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (record_json::jsonb#>>'{payload,project_id}') = $2
         AND (record_json::jsonb#>>'{payload,group_id}') = $3
         AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1
     ), latest_plan AS (
       SELECT (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
              (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
              (record_json::jsonb#>>'{payload,receipt_fact_id}') AS receipt_fact_id,
              (record_json::jsonb#>>'{payload,status}') AS status
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (record_json::jsonb#>>'{payload,project_id}') = $2
         AND (record_json::jsonb#>>'{payload,group_id}') = $3
         AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1
     ), latest_transition AS (
       SELECT (record_json::jsonb#>>'{payload,status}') AS status
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'operation_plan_transition_v1'
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
         AND (record_json::jsonb#>>'{payload,project_id}') = $2
         AND (record_json::jsonb#>>'{payload,group_id}') = $3
         AND (record_json::jsonb#>>'{payload,operation_plan_id}') = (SELECT operation_plan_id FROM latest_plan)
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1
     )
     SELECT (SELECT approval_request_id FROM latest_link) AS approval_request_id,
            (SELECT operation_plan_id FROM latest_plan) AS operation_plan_id,
            (SELECT act_task_id FROM latest_plan) AS act_task_id,
            (SELECT receipt_fact_id FROM latest_plan) AS receipt_fact_id,
            coalesce((SELECT status FROM latest_transition), (SELECT status FROM latest_plan)) AS latest_status`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendation_id]
  );
  const row: any = q.rows?.[0] ?? {};
  return {
    approval_request_id: row.approval_request_id ? String(row.approval_request_id) : null,
    operation_plan_id: row.operation_plan_id ? String(row.operation_plan_id) : null,
    act_task_id: row.act_task_id ? String(row.act_task_id) : null,
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    latest_status: row.latest_status ? String(row.latest_status) : null
  };
}


async function assertApprovedForTask(pool: Pool, tenant: TenantTriple, act_task_id: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
       AND upper(coalesce((record_json::jsonb#>>'{payload,decision}'), '')) = 'APPROVE'
     LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, act_task_id]
  );
  return res.rows.length > 0;
}

async function loadTaskFactByTaskId(pool: Pool, tenant: TenantTriple, act_task_id: string): Promise<any | null> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, act_task_id]
  );
  if (!res.rows?.length) return null;
  return {
    fact_id: String(res.rows[0].fact_id),
    occurred_at: String(res.rows[0].occurred_at),
    record_json: parseJsonMaybe(res.rows[0].record_json) ?? res.rows[0].record_json
  };
}


async function loadRecommendations(pool: Pool, tenant: TenantTriple, limit: number): Promise<any[]> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT $4`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]
  );
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json
  }));
}

function normalizeRecommendationOutput(row: any, chain?: { approval_request_id: string | null; operation_plan_id: string | null; act_task_id: string | null; receipt_fact_id: string | null; latest_status: string | null }): any {
  const payload = row?.record_json?.payload ?? {};
  return {
    fact_id: row.fact_id,
    occurred_at: row.occurred_at,
    recommendation_id: payload.recommendation_id ?? null,
    approval_request_id: chain?.approval_request_id ?? null,
    operation_plan_id: chain?.operation_plan_id ?? null,
    act_task_id: chain?.act_task_id ?? null,
    receipt_fact_id: chain?.receipt_fact_id ?? null,
    latest_status: chain?.latest_status ?? payload.status ?? "proposed",
    field_id: payload.field_id ?? null,
    season_id: payload.season_id ?? null,
    device_id: payload.device_id ?? null,
    recommendation_type: payload.recommendation_type ?? null,
    status: payload.status ?? "proposed",
    reason_codes: Array.isArray(payload.reason_codes) ? payload.reason_codes : [],
    evidence_refs: Array.isArray(payload.evidence_refs) ? payload.evidence_refs : [],
    rule_hit: Array.isArray(payload.rule_hit) ? payload.rule_hit : [],
    confidence: payload.confidence ?? null,
    model_version: payload.model_version ?? null,
    suggested_action: payload.suggested_action ?? null,
  };
}

function toAoActActionType(rec: any): string {
  const recommendationType = String(rec?.recommendation_type ?? "").trim();
  if (recommendationType === "irrigation_recommendation_v1") return "IRRIGATE";
  if (recommendationType === "crop_health_alert_v1") return "SPRAY";
  return "IRRIGATE";
}

function toAoActTarget(rec: any): { kind: "field"; ref: string } {
  const fieldId = String(rec?.field_id ?? "").trim();
  if (fieldId) return { kind: "field", ref: fieldId };
  return { kind: "field", ref: "field_unknown" };
}

function toPrimitiveParameters(input: any): Record<string, number | boolean | string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof k !== "string" || !k.trim()) continue;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

function toAoActParameterSchema(parameters: Record<string, number | boolean | string>): { keys: Array<{ name: string; type: "number" | "boolean" | "enum"; enum?: string[] }> } {
  const keys = Object.keys(parameters).sort().map((name) => {
    const value = parameters[name];
    if (typeof value === "number") return { name, type: "number" as const };
    if (typeof value === "boolean") return { name, type: "boolean" as const };
    return { name, type: "enum" as const, enum: [String(value)] };
  });
  return { keys: keys.length > 0 ? keys : [{ name: "noop", type: "boolean" as const }] };
}

export function registerDecisionEngineV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/agronomy/recommendations", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(q.tenant_id ?? auth.tenant_id),
      project_id: String(q.project_id ?? auth.project_id),
      group_id: String(q.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const limit = Math.max(1, Math.min(Number(q.limit ?? 50) || 50, 200));
    const rows = await loadRecommendations(pool, tenant, limit);
    const items = await Promise.all(rows.map(async (row) => normalizeRecommendationOutput(row, await loadRecommendationChainById(pool, String(row?.record_json?.payload?.recommendation_id ?? ""), tenant))));
    return reply.send({ ok: true, items, count: rows.length });
  });

  app.get("/api/v1/agronomy/recommendations/:recommendation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const p: any = (req as any).params ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(q.tenant_id ?? auth.tenant_id),
      project_id: String(q.project_id ?? auth.project_id),
      group_id: String(q.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const recommendation_id = String(p.recommendation_id ?? "").trim();
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");
    const row = await loadRecommendationById(pool, recommendation_id, tenant);
    if (!row) return reply.status(404).send({ ok: false, error: "RECOMMENDATION_NOT_FOUND" });
    const chain = await loadRecommendationChainById(pool, recommendation_id, tenant);
    return reply.send({ ok: true, item: normalizeRecommendationOutput(row, chain) });
  });

  app.post("/api/v1/recommendations/generate", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const recommendations = buildRecommendations(body);
    if (recommendations.length === 0) {
      return badRequest(reply, "NO_RECOMMENDATION_TRIGGERED");
    }

    const fact_ids: string[] = [];
    for (const rec of recommendations) {
      const recommendation_input_fact_id = await insertFact(pool, "api/v1/recommendations/generate", {
        type: "decision_recommendation_input_facts_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          recommendation_id: rec.recommendation_id,
          field_id: rec.field_id,
          season_id: rec.season_id,
          device_id: rec.device_id,
          evidence_facts: recommendationEvidenceFacts(body),
          created_ts: Date.now()
        }
      });
      const fact_id = await insertFact(pool, "api/v1/recommendations/generate", {
        type: "decision_recommendation_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          ...rec,
          recommendation_input_fact_id,
          data_sources: {
            telemetry: body.telemetry ?? null,
            image_recognition: body.image_recognition ?? null
          }
        }
      });
      fact_ids.push(fact_id);
    }

    return reply.send({ ok: true, recommendations, fact_ids });
  });

  app.post("/api/v1/recommendations/:recommendation_id/submit-approval", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const recommendation_id = String(params.recommendation_id ?? "").trim();
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");

    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const row = await loadRecommendationById(pool, recommendation_id, tenant);
    if (!row) return reply.status(404).send({ ok: false, error: "RECOMMENDATION_NOT_FOUND" });

    const rec = row.record_json?.payload ?? {};
    const actionType = toAoActActionType(rec);
    const aoActTarget = toAoActTarget(rec);
    const aoActParameters = toPrimitiveParameters(rec?.suggested_action?.parameters ?? {});
    if (Object.keys(aoActParameters).length === 0) {
      aoActParameters.noop = true;
    }
    const aoActParameterSchema = toAoActParameterSchema(aoActParameters);

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/approval_request/v1/request`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      issuer: { kind: "human", id: auth.actor_id, namespace: "decision_engine_v1" },
      action_type: actionType,
      target: aoActTarget,
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 30 * 60 * 1000 },
      parameter_schema: aoActParameterSchema,
      parameters: aoActParameters,
      constraints: { approval_required: true },
      meta: {
        rationale: body.rationale ?? `Auto-mapped from recommendation ${recommendation_id}`,
        recommendation_id,
        recommendation_type: rec.recommendation_type ?? null,
        field_id: rec.field_id ?? null,
        season_id: rec.season_id ?? null,
        confidence: rec.confidence ?? null,
        device_id: rec.device_id ?? null
      }
    });

    if (!delegated.ok || !delegated.json?.ok) {
      return reply.status(delegated.status || 400).send({ ok: false, error: "APPROVAL_REQUEST_CREATE_FAILED", detail: delegated.json ?? null });
    }

    const mapping_fact_id = await insertFact(pool, "api/v1/recommendations/submit-approval", {
      type: "decision_recommendation_approval_link_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        recommendation_id,
        recommendation_fact_id: row.fact_id,
        approval_request_id: delegated.json.request_id,
        created_ts: Date.now()
      }
    });

    const operation_plan_id = `opl_${randomUUID().replace(/-/g, "")}`;
    const operation_plan_fact_id = await insertFact(pool, "api/v1/recommendations/submit-approval", {
      type: "operation_plan_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        operation_plan_id,
        recommendation_id,
        recommendation_fact_id: row.fact_id,
        approval_request_id: delegated.json.request_id,
        action_type: actionType,
        target: aoActTarget,
        parameters: aoActParameters,
        status: "APPROVAL_PENDING",
        created_ts: Date.now(),
        updated_ts: Date.now()
      }
    });

    await insertFact(pool, "api/v1/recommendations/submit-approval", {
      type: "operation_plan_transition_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        operation_plan_id,
        status: "APPROVAL_PENDING",
        trigger: "recommendation_submit_approval",
        approval_request_id: delegated.json.request_id,
        created_ts: Date.now()
      }
    });

    return reply.send({ ok: true, recommendation_id, approval_request_id: delegated.json.request_id, approval_fact_id: delegated.json.fact_id, mapping_fact_id, operation_plan_id, operation_plan_fact_id });
  });

  app.post("/api/v1/simulators/irrigation/execute", async (req, reply) => {
    // This endpoint is executor-only.
    // It must never be called from recommendation / approval / UI flows directly.
    // All execution must be derived from approved AO-ACT task dispatch only.
    const auth = requireAoActScopeV0(req, reply, "ao_act.receipt.write");
    if (!auth) return;
    if (!hasExecutorRuntimeScopes(auth)) {
      return reply.status(403).send({ ok: false, error: "EXECUTOR_SCOPE_REQUIRED" });
    }
    if (!isExecutorToken(auth)) {
      return reply.status(403).send({ ok: false, error: "EXECUTOR_TOKEN_REQUIRED" });
    }
    const body: any = req.body ?? {};
    if (body.recommendation_id !== undefined) {
      return badRequest(reply, "RECOMMENDATION_ID_NOT_ALLOWED");
    }
    if (body.approval_request_id !== undefined) {
      return badRequest(reply, "APPROVAL_REQUEST_ID_NOT_ALLOWED");
    }
    if (body.operation_plan_id !== undefined) {
      return badRequest(reply, "OPERATION_PLAN_ID_NOT_ALLOWED");
    }
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const act_task_id = String(body.act_task_id ?? "").trim();
    const command_id = String(body.command_id ?? act_task_id).trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== act_task_id) return badRequest(reply, "COMMAND_ID_MUST_MATCH_ACT_TASK_ID");

    const task = await loadTaskFactByTaskId(pool, tenant, act_task_id);
    if (!task) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });

    const approved = await assertApprovedForTask(pool, tenant, act_task_id);
    if (!approved) return reply.status(403).send({ ok: false, error: "TASK_NOT_APPROVED" });

    const startTs = Date.now();
    const endTs = startTs + 5_000;
    const idempotency_key = `irrigation_sim_${randomUUID().replace(/-/g, "")}`;
    const logRef = `sim://irrigation/${act_task_id}/${startTs}`;

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/receipt`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      act_task_id,
      command_id,
      executor_id: { kind: "script", id: "irrigation_simulator", namespace: "decision_engine_v1" },
      execution_time: { start_ts: startTs, end_ts: endTs },
      execution_coverage: { kind: "field", ref: String(body.field_id ?? "field_unknown") },
      resource_usage: {
        fuel_l: null,
        electric_kwh: 0.25,
        water_l: Number(body.water_l ?? 360),
        chemical_ml: null
      },
      logs_refs: [{ kind: "sim_trace", ref: logRef }],
      status: "executed",
      constraint_check: { violated: false, violations: [] },
      observed_parameters: {
        duration_s: 300,
        flow_state: "stable",
        simulated: true
      },
      meta: {
        idempotency_key,
        command_id,
        simulator: "irrigation_simulator_v1"
      }
    });
    if (!delegated.ok || !delegated.json?.ok) {
      return reply.status(delegated.status || 400).send({ ok: false, error: "RECEIPT_WRITE_FAILED", detail: delegated.json ?? null });
    }

    const evidenceDir = path.join(process.cwd(), "acceptance", "simulator_evidence");
    fs.mkdirSync(evidenceDir, { recursive: true });
    const evidenceName = `irrigation_receipt_${act_task_id}_${startTs}.json`;
    const evidencePath = path.join(evidenceDir, evidenceName);
    const evidence = {
      kind: "irrigation_execution_evidence_v1",
      tenant,
      act_task_id,
      command_id,
      receipt_fact_id: delegated.json.fact_id,
      generated_at: new Date().toISOString(),
      simulator: "irrigation_simulator_v1",
      result: "executed",
      metrics: {
        water_l: Number(body.water_l ?? 360),
        duration_s: 300
      }
    };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf-8");
    const evidence_sha256 = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");

    await insertFact(pool, "api/v1/simulators/irrigation/execute", {
      type: "irrigation_simulation_receipt_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id,
        receipt_fact_id: delegated.json.fact_id,
        evidence_path: `acceptance/simulator_evidence/${evidenceName}`,
        evidence_sha256,
        created_ts: Date.now()
      }
    });

    return reply.send({
      ok: true,
      act_task_id,
      receipt_fact_id: delegated.json.fact_id,
      evidence: {
        path: `acceptance/simulator_evidence/${evidenceName}`,
        sha256: evidence_sha256
      }
    });
  });
}
