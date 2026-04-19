import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0.js";
import { deriveFertilityPrecheckConstraintsV1 } from "../domain/agronomy/fertility_precheck_constraints_v1.js";
import { resolveCropStage } from "../domain/agronomy/stage_resolver.js";
import { validateRecommendationMainChainFields } from "../domain/agronomy/rule_engine.js";
import { ensureRulePerformanceTable, listRulePerformance } from "../domain/agronomy/effect_engine.js";
import { evaluateHardRuleHintsV1, getHardRuleRecommendationBlueprintV1 } from "../domain/decision_engine_v1.js";
import {
  assertFormalTriggerInputLayer,
  assertNoForbiddenTriggerFields,
  deriveFormalTriggerSignalsFromStage1Summary,
  isFormalStage1TriggerEligible,
  normalizeStage1RecommendationInput
} from "../domain/decision/stage1_action_boundary_v1.js";
import { refreshFieldReadModelsWithObservabilityV1 } from "../services/field_read_model_refresh_v1.js";
import {
  ensureDerivedSensingStateProjectionV1,
  getLatestDerivedSensingStatesByFieldV1
} from "../services/derived_sensing_state_v1.js";
import { appendSkillRunFact, digestJson } from "../domain/skill_registry/facts.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type RecommendationTypeV1 = "irrigation_recommendation_v1" | "crop_health_alert_v1";

type RecommendationExplainV1 = {
  trigger_source_fields: Array<{
    field: string;
    role: "formal_trigger" | "support_signal";
    value: string | number | boolean | null;
  }>;
  action_summary: string;
  rule_hit_summary: Array<{
    rule_id: string;
    matched: boolean;
    summary: string;
  }>;
};

type InternalDebugExplainV1 = {
  source_states: Array<{
    source: "derived_sensing_state_v1" | "field_fertility_state_v1" | "field_sensing_overview_v1";
    skill: string;
    state_ref: string;
    label: string;
    value: string | number | boolean | null;
    observed_at_ts_ms?: number | null;
  }>;
  triggered_rules: Array<{
    rule_id: string;
    matched: boolean;
    threshold: number | string | null;
    actual: number | string | null;
    basis: string;
    skill: string;
  }>;
  reasoning_path: Array<{
    node_id: string;
    node_type: "observation" | "rule" | "recommendation";
    label: string;
    detail: string;
    skill: string;
  }>;
};

type RecommendationV1 = {
  recommendation_id: string;
  snapshot_id: string;
  field_id: string;
  season_id: string;
  device_id: string;
  crop_code: string;
  crop_stage: string;
  rule_id: string;
  expected_effect?: Record<string, number> | null;
  program_id?: string | null;
  recommendation_type: RecommendationTypeV1;
  status: "proposed" | "approved" | "rejected" | "executed";
  reason_codes: string[];
  reason_details?: Array<{ code: string; action_hint: "irrigate_first" | "inspect"; source: "request_constraints" | "field_fertility_state_v1" | "field_sensing_overview_v1" | "stage1_sensing_summary_v1" | "support_path.field_fertility_state_v1" | "support_path.image_recognition" }>;
  explanation_codes?: Array<{ code: string; source: "field_sensing_overview_v1" | "field_fertility_state_v1" | "request_constraints" }>;
  explain?: RecommendationExplainV1;
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
  internal_debug_explain?: InternalDebugExplainV1;
  rank_score?: number;
  rule_performance_score?: number;
  rule_score?: number;
  rule_confidence?: "low" | "medium" | "high";
};

type HardRuleConstraintInputV1 = {
  moisture_constraint?: string | null;
  salinity_risk?: string | null;
  source: "request_constraints" | "field_fertility_state_v1";
};

type FieldSensingOverviewInputV1 = {
  observed_at_ts_ms: number | null;
  updated_ts_ms: number;
  soil_indicators_json: Array<{ metric: string; value: number | null }>;
  explanation_codes_json: string[];
};

type Stage1SummaryRecommendationInputV1 = {
  irrigation_effectiveness?: unknown;
  leak_risk?: unknown;
  canopy_temp_status?: unknown;
  evapotranspiration_risk?: unknown;
  sensor_quality_level?: unknown;
};

type RulePerformanceStats = {
  score: number;
  total_count: number;
};

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function isFeatureEnabled(envName: string, defaultEnabled: boolean): boolean {
  const raw = String(process.env[envName] ?? "").trim().toLowerCase();
  if (!raw) return defaultEnabled;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return defaultEnabled;
}

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function mapRuleToSkill(ruleId: string): { skill_id: string; version: string } {
  const normalized = String(ruleId ?? "").trim();
  if (!normalized) return { skill_id: "agronomy_rule", version: "v1" };
  const m = normalized.match(/^(.*)_(v\d+)$/i);
  if (!m) return { skill_id: normalized, version: "v1" };
  return {
    skill_id: String(m[1] ?? "").trim() || normalized,
    version: String(m[2] ?? "v1").toLowerCase(),
  };
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
  const host = String((req.headers as any).host ?? "127.0.0.1:3001");
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

function sensingMetricValue(
  overview: FieldSensingOverviewInputV1 | null | undefined,
  metrics: string[],
): number | null {
  if (!overview) return null;
  const normalized = new Set(metrics.map((x) => x.trim().toLowerCase()));
  const hit = (Array.isArray(overview.soil_indicators_json) ? overview.soil_indicators_json : [])
    .find((item) => normalized.has(String(item.metric ?? "").trim().toLowerCase()));
  const n = Number(hit?.value ?? NaN);
  return Number.isFinite(n) ? n : null;
}

function recommendationEvidenceFacts(sensingOverview: FieldSensingOverviewInputV1, imageInput: any): Array<{ key: string; value: number | null; unit: string | null; source: string }> {
  const image = (imageInput && typeof imageInput === "object") ? imageInput : {};
  const toNum = (x: any): number | null => Number.isFinite(Number(x)) ? Number(x) : null;
  const soilMoisture = sensingMetricValue(sensingOverview, ["soil_moisture_pct", "soil_moisture", "moisture_pct"]);
  const canopyTemp = sensingMetricValue(sensingOverview, ["canopy_temp_c", "canopy_temperature_c"]);
  return [
    { key: "soil_moisture_pct", value: soilMoisture, unit: "%", source: "field_sensing_overview_v1" },
    { key: "canopy_temp_c", value: canopyTemp, unit: "c", source: "field_sensing_overview_v1" },
    { key: "image_stress_score", value: toNum(image.stress_score), unit: null, source: "image_recognition" },
    { key: "image_disease_score", value: toNum(image.disease_score), unit: null, source: "image_recognition" },
    { key: "image_pest_risk_score", value: toNum(image.pest_risk_score), unit: null, source: "image_recognition" }
  ];
}

function buildRecommendationInternalDebugExplainV1(params: {
  recommendation: RecommendationV1;
  sensingOverview: FieldSensingOverviewInputV1;
  fertilityState: any;
  derivedSensingStates: any[];
}): InternalDebugExplainV1 {
  const { recommendation, sensingOverview, fertilityState, derivedSensingStates } = params;
  const source_states: InternalDebugExplainV1["source_states"] = [];
  const sensingIndicators = Array.isArray(sensingOverview?.soil_indicators_json) ? sensingOverview.soil_indicators_json : [];
  for (const indicator of sensingIndicators) {
    const metric = String(indicator?.metric ?? "").trim();
    if (!metric) continue;
    source_states.push({
      source: "field_sensing_overview_v1",
      skill: "sensing_inference_v1",
      state_ref: `field_sensing_overview_v1.soil_indicators_json.${metric}`,
      label: metric,
      value: Number.isFinite(Number(indicator?.value)) ? Number(indicator?.value) : null,
      observed_at_ts_ms: Number.isFinite(Number(sensingOverview?.observed_at_ts_ms)) ? Number(sensingOverview?.observed_at_ts_ms) : null,
    });
  }
  if (fertilityState && typeof fertilityState === "object") {
    const fertilityRefs: Array<{ key: string; label: string }> = [
      { key: "fertility_level", label: "fertility_level" },
      { key: "salinity_risk", label: "salinity_risk" },
      { key: "recommendation_bias", label: "recommendation_bias" },
    ];
    for (const ref of fertilityRefs) {
      const value = (fertilityState as any)?.[ref.key];
      if (value === undefined) continue;
      source_states.push({
        source: "field_fertility_state_v1",
        skill: "fertility_inference_v1",
        state_ref: `field_fertility_state_v1.${ref.key}`,
        label: ref.label,
        value: value == null ? null : String(value),
        observed_at_ts_ms: Number.isFinite(Number(fertilityState?.computed_at_ts_ms)) ? Number(fertilityState?.computed_at_ts_ms) : null,
      });
    }
  }
  for (const state of (Array.isArray(derivedSensingStates) ? derivedSensingStates : []).slice(0, 5)) {
    const stateType = String(state?.state_type ?? "").trim();
    if (!stateType) continue;
    source_states.push({
      source: "derived_sensing_state_v1",
      skill: String(state?.skill_id ?? "derived_sensing_state_v1"),
      state_ref: `derived_sensing_state_v1.${stateType}`,
      label: stateType,
      value: String(state?.state_value ?? state?.value ?? "-"),
      observed_at_ts_ms: Number.isFinite(Number(state?.computed_at_ts_ms)) ? Number(state?.computed_at_ts_ms) : null,
    });
  }
  const triggered_rules = (Array.isArray(recommendation.rule_hit) ? recommendation.rule_hit : []).map((hit) => ({
    rule_id: String(hit?.rule_id ?? recommendation.rule_id ?? "unknown_rule"),
    matched: Boolean(hit?.matched),
    threshold: Number.isFinite(Number(hit?.threshold)) ? Number(hit?.threshold) : (hit?.threshold ?? null),
    actual: Number.isFinite(Number(hit?.actual)) ? Number(hit?.actual) : (hit?.actual ?? null),
    basis: `rule_hit.${String(hit?.rule_id ?? recommendation.rule_id ?? "unknown_rule")}`,
    skill: mapRuleToSkill(String(hit?.rule_id ?? recommendation.rule_id ?? "")).skill_id || "agronomy_rule",
  }));
  const primaryRule = mapRuleToSkill(String(recommendation.rule_id ?? ""));
  const reasoning_path: InternalDebugExplainV1["reasoning_path"] = [
    {
      node_id: "obs",
      node_type: "observation",
      label: "输入观测状态",
      detail: `${source_states.length} 条输入状态参与本次建议推理`,
      skill: "field_read_model_refresh_v1",
    },
    {
      node_id: "rule",
      node_type: "rule",
      label: `规则命中 ${recommendation.rule_id || "-"}`,
      detail: `${triggered_rules.filter((x) => x.matched).length}/${Math.max(triggered_rules.length, 1)} 条规则命中阈值`,
      skill: primaryRule.skill_id,
    },
    {
      node_id: "action",
      node_type: "recommendation",
      label: `推荐动作 ${String(recommendation?.suggested_action?.action_type ?? "-")}`,
      detail: String(recommendation?.suggested_action?.summary ?? "建议动作已生成"),
      skill: "decision_engine_v1",
    }
  ];
  return { source_states, triggered_rules, reasoning_path };
}

function buildRecommendationExplainV1(params: { recommendation: RecommendationV1; stage1Summary: Stage1SummaryRecommendationInputV1 }): RecommendationExplainV1 {
  const { recommendation, stage1Summary } = params;
  const trigger_source_fields: RecommendationExplainV1["trigger_source_fields"] = [
    {
      field: "irrigation_effectiveness",
      role: "formal_trigger",
      value: stage1Summary.irrigation_effectiveness == null ? null : String(stage1Summary.irrigation_effectiveness),
    },
    {
      field: "leak_risk",
      role: "formal_trigger",
      value: stage1Summary.leak_risk == null ? null : String(stage1Summary.leak_risk),
    },
    {
      field: "canopy_temp_status",
      role: "support_signal",
      value: stage1Summary.canopy_temp_status == null ? null : String(stage1Summary.canopy_temp_status),
    },
    {
      field: "evapotranspiration_risk",
      role: "support_signal",
      value: stage1Summary.evapotranspiration_risk == null ? null : String(stage1Summary.evapotranspiration_risk),
    },
    {
      field: "sensor_quality_level",
      role: "support_signal",
      value: stage1Summary.sensor_quality_level == null ? null : String(stage1Summary.sensor_quality_level),
    },
  ];
  const rule_hit_summary = (Array.isArray(recommendation.rule_hit) ? recommendation.rule_hit : []).map((hit) => ({
    rule_id: String(hit?.rule_id ?? "unknown_rule"),
    matched: Boolean(hit?.matched),
    summary: `rule=${String(hit?.rule_id ?? "unknown_rule")}, matched=${Boolean(hit?.matched)}`,
  }));
  return {
    trigger_source_fields,
    action_summary: String(recommendation?.suggested_action?.summary ?? "建议动作已生成"),
    rule_hit_summary,
  };
}

function buildRecommendationsFromStage1Summary(
  body: any,
  stage1Summary: Stage1SummaryRecommendationInputV1,
  snapshotId: string,
  internalContext?: { sensingOverview?: FieldSensingOverviewInputV1 | null; fertilityState?: any | null },
  hardRuleInput?: HardRuleConstraintInputV1 | null,
): RecommendationV1[] {
  const field_id = String(body.field_id ?? "").trim();
  const season_id = String(body.season_id ?? "").trim();
  const device_id = String(body.device_id ?? "").trim();
  const crop_code = String(body.crop_code ?? "").trim();
  const program_id = String(body.program_id ?? "").trim() || null;
  if (!field_id || !season_id || !device_id || !crop_code) return [];

  const image = (body.image_recognition && typeof body.image_recognition === "object") ? body.image_recognition : {};
  const now = Date.now();

  const supportOverview = internalContext?.sensingOverview ?? null;
  const soilMoisture = Number(sensingMetricValue(supportOverview, ["soil_moisture_pct", "soil_moisture", "moisture_pct"]) ?? NaN);
  const canopyTemp = Number(sensingMetricValue(supportOverview, ["canopy_temp_c", "canopy_temperature_c"]) ?? NaN);
  const stressScore = clamp01(Number(image.stress_score ?? 0));
  const diseaseScore = clamp01(Number(image.disease_score ?? 0));
  const pestRisk = clamp01(Number(image.pest_risk_score ?? 0));
  const imageConfidence = clamp01(Number(image.confidence ?? 0.8));
  const supportSignals = {
    canopy_temp_status: String(stage1Summary.canopy_temp_status ?? "").trim().toLowerCase() || null,
    evapotranspiration_risk: String(stage1Summary.evapotranspiration_risk ?? "").trim().toLowerCase() || null,
    sensor_quality_level: String(stage1Summary.sensor_quality_level ?? "").trim().toUpperCase() || null,
  };

  const out: RecommendationV1[] = [];
  const program = (body.program && typeof body.program === "object") ? body.program : {};
  const resolvedCropStage = resolveCropStage({
    cropCode: crop_code,
    explicitStage: String(body.crop_stage ?? program.crop_stage ?? "").trim() || undefined,
    daysAfterPlanting: Number.isFinite(Number(body.days_after_planting ?? program.days_after_planting))
      ? Number(body.days_after_planting ?? program.days_after_planting)
      : undefined,
  });
  const hardRuleHints = evaluateHardRuleHintsV1({
    moisture_constraint: hardRuleInput?.moisture_constraint ?? body.moisture_constraint,
    salinity_risk: hardRuleInput?.salinity_risk ?? body.salinity_risk,
    source: hardRuleInput?.source ?? "request_constraints"
  });
  if (hardRuleHints.length > 0) {
    for (const hint of hardRuleHints) {
      const blueprint = getHardRuleRecommendationBlueprintV1(hint.action_hint);
      if (!blueprint) continue;
      out.push({
        recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
        snapshot_id: snapshotId,
        field_id,
        season_id,
        device_id,
        crop_code,
        crop_stage: resolvedCropStage,
        rule_id: blueprint.rule_id,
        expected_effect: blueprint.expected_effect,
        program_id,
        recommendation_type: blueprint.recommendation_type,
        status: "proposed",
        reason_codes: [hint.reason_code, ...blueprint.reason_codes_suffix],
        reason_details: [{ code: hint.reason_code, action_hint: hint.action_hint, source: "support_path.field_fertility_state_v1" }],
        explanation_codes: (supportOverview?.explanation_codes_json ?? []).map((code) => ({ code, source: "field_sensing_overview_v1" })),
        evidence_refs: blueprint.evidence_refs,
        rule_hit: [{ rule_id: blueprint.rule_id, matched: true, threshold: null, actual: null }],
        confidence: blueprint.confidence,
        suggested_action: blueprint.suggested_action,
        created_ts: now,
        model_version: "decision_engine_v1"
      });
    }
    return out;
  }

  // Formal trigger source is restricted to Stage-1 action boundary fields only.
  const formalIrrigationEffectiveness = String(stage1Summary.irrigation_effectiveness ?? "").trim().toLowerCase();
  const formalLeakRisk = String(stage1Summary.leak_risk ?? "").trim().toLowerCase();
  const irrigationNeed = formalIrrigationEffectiveness === "low" || formalLeakRisk === "high";
  if (irrigationNeed) {
    const moistureTerm = Number.isFinite(soilMoisture) ? clamp01((45 - soilMoisture) / 45) : 0.2;
    const heatTerm = Number.isFinite(canopyTemp) ? clamp01((canopyTemp - 28) / 12) : 0.2;
    const confidence = Number((0.45 + 0.3 * moistureTerm + 0.15 * heatTerm + 0.1 * imageConfidence).toFixed(3));
    const durationMin = Number.isFinite(soilMoisture) && soilMoisture < 25 ? 35 : 20;
    const irrigationRuleId = formalLeakRisk === "high"
      ? "irrigation_rule_leak_risk_v1"
      : "irrigation_rule_irrigation_effectiveness_v1";
    const reasonCode = formalLeakRisk === "high" ? "leak_risk_high" : "irrigation_effectiveness_low";
    out.push({
      recommendation_id: `rec_${randomUUID().replace(/-/g, "")}`,
      snapshot_id: snapshotId,
      field_id,
      season_id,
      device_id,
      crop_code,
      crop_stage: resolvedCropStage,
      rule_id: irrigationRuleId,
      expected_effect: { soil_moisture: durationMin >= 30 ? 10 : 6 },
      program_id,
      recommendation_type: "irrigation_recommendation_v1",
      status: "proposed",
      reason_codes: [reasonCode],
      reason_details: [{ code: reasonCode, action_hint: "irrigate_first", source: "stage1_sensing_summary_v1" }],
      explanation_codes: (supportOverview?.explanation_codes_json ?? []).map((code) => ({ code, source: "field_sensing_overview_v1" })),
      evidence_refs: ["field_sensing_overview_v1:soil_moisture", "field_sensing_overview_v1:canopy_temp", "image:stress_score"],
      rule_hit: [
        { rule_id: "irrigation_rule_irrigation_effectiveness_v1", matched: formalIrrigationEffectiveness === "low", threshold: 1, actual: formalIrrigationEffectiveness === "low" ? 1 : 0 },
        { rule_id: "irrigation_rule_leak_risk_v1", matched: formalLeakRisk === "high", threshold: 1, actual: formalLeakRisk === "high" ? 1 : 0 }
      ],
      confidence,
      suggested_action: {
        action_type: "irrigation.start",
        summary: `${crop_code}土壤湿度偏低（${Number.isFinite(soilMoisture) ? `${soilMoisture}%` : "未知"}），建议执行灌溉。`,
        parameters: {
          crop_code,
          duration_min: durationMin,
          water_l_per_min: 18,
          trigger: {
            formal_source: "stage1_sensing_summary_v1",
            support_path: "field_sensing_overview_v1",
            soil_moisture_pct: Number.isFinite(soilMoisture) ? soilMoisture : null,
            canopy_temp_c: Number.isFinite(canopyTemp) ? canopyTemp : null,
            image_stress_score: stressScore,
            stage1_support_signals: supportSignals,
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
      snapshot_id: snapshotId,
      field_id,
      season_id,
      device_id,
      crop_code,
      crop_stage: resolvedCropStage,
      rule_id: "crop_health_risk_rule_v1",
      expected_effect: { health_risk: -0.2 },
      program_id,
      recommendation_type: "crop_health_alert_v1",
      status: "proposed",
      reason_codes: ["image_health_risk_high"],
      reason_details: [{ code: "image_health_risk_high", action_hint: "inspect", source: "support_path.image_recognition" }],
      explanation_codes: (supportOverview?.explanation_codes_json ?? []).map((code) => ({ code, source: "field_sensing_overview_v1" })),
      evidence_refs: ["image:disease_score", "image:pest_risk_score", "image:stress_score"],
      rule_hit: [
        { rule_id: "crop_health_risk_rule_v1", matched: healthRisk >= 0.7, threshold: 0.7, actual: healthRisk }
      ],
      confidence,
      suggested_action: {
        action_type: "crop.health.alert",
        summary: `图像识别到较高${alertKind === "disease" ? "病害" : "虫害"}风险，请人工复核并安排处置。`,
        parameters: {
          formal_source: "stage1_sensing_summary_v1",
          support_path: "image_recognition",
          alert_kind: alertKind,
          risk_score: healthRisk,
          disease_score: diseaseScore,
          pest_risk_score: pestRisk,
          stress_score: stressScore,
          stage1_support_signals: supportSignals,
        }
      },
      created_ts: now,
      model_version: "decision_engine_v1"
    });
  }

  return out;
}

async function loadRuleScores(pool: Pool, cropCode: string, ruleIds: string[]): Promise<Map<string, RulePerformanceStats>> {
  if (!ruleIds.length) return new Map();
  const sql = `
    SELECT rule_id,
           CASE WHEN SUM(total_count) > 0
             THEN (SUM(success_count) + SUM(partial_count) * 0.5) / SUM(total_count)
             ELSE 0 END AS score,
           SUM(total_count) AS total_count
    FROM agronomy_rule_performance
    WHERE crop_code = $1
      AND rule_id = ANY($2::text[])
    GROUP BY rule_id
  `;
  const res = await pool.query(sql, [cropCode, ruleIds]);
  const map = new Map<string, RulePerformanceStats>();
  for (const row of (res.rows ?? [])) {
    const ruleId = String(row.rule_id ?? "").trim();
    if (!ruleId) continue;
    const score = Number(row.score ?? 0);
    const totalCount = Number(row.total_count ?? 0);
    map.set(ruleId, {
      score: Number.isFinite(score) ? score : 0,
      total_count: Number.isFinite(totalCount) ? totalCount : 0,
    });
  }
  return map;
}

function recommendationRulePerformanceScore(rec: RecommendationV1, ruleScoreMap: Map<string, RulePerformanceStats>): number {
  const matchedRules = (Array.isArray(rec.rule_hit) ? rec.rule_hit : []).filter((x) => Boolean(x?.matched) && typeof x?.rule_id === "string");
  if (!matchedRules.length) return 0;
  const values = matchedRules
    .map((x) => ruleScoreMap.get(String(x.rule_id).trim()))
    .map((stats) => (stats && stats.total_count >= 5 ? stats.score : 0))
    .filter((x) => Number.isFinite(x));
  if (!values.length) return 0;
  const avg = values.reduce((acc, x) => acc + x, 0) / values.length;
  return Number(avg.toFixed(6));
}

function recommendationRuleScoreAndConfidence(
  rec: RecommendationV1,
  ruleScoreMap: Map<string, RulePerformanceStats>,
): { rule_score: number; rule_confidence: "low" | "medium" | "high" } {
  const firstMatchedRuleId = (Array.isArray(rec.rule_hit) ? rec.rule_hit : [])
    .find((x) => Boolean(x?.matched) && typeof x?.rule_id === "string")?.rule_id;
  const stats = firstMatchedRuleId ? ruleScoreMap.get(String(firstMatchedRuleId).trim()) : undefined;
  const score = Number.isFinite(Number(stats?.score)) ? Number(stats?.score) : 0.5;
  const totalCount = Number.isFinite(Number(stats?.total_count)) ? Number(stats?.total_count) : 0;

  if (totalCount < 5) return { rule_score: Number(score.toFixed(6)), rule_confidence: "low" };
  if (score > 0.8) return { rule_score: Number(score.toFixed(6)), rule_confidence: "high" };
  if (score > 0.5) return { rule_score: Number(score.toFixed(6)), rule_confidence: "medium" };
  return { rule_score: Number(score.toFixed(6)), rule_confidence: "low" };
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

async function resolveProgramIdForRecommendation(pool: Pool, tenant: TenantTriple, rec: any): Promise<string | null> {
  const explicitProgramId = String(rec?.program_id ?? "").trim();
  if (explicitProgramId) return explicitProgramId;
  const fieldId = String(rec?.field_id ?? "").trim();
  if (!fieldId) return null;
  const seasonId = String(rec?.season_id ?? "").trim();
  const q = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'field_program_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,field_id}') = $4
        AND (
          $5::text = ''
          OR (record_json::jsonb#>>'{payload,season_id}') = $5
        )
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, fieldId, seasonId]
  );
  const payload = q.rows?.[0]?.record_json?.payload ?? null;
  const programId = String(payload?.program_id ?? "").trim();
  return programId || null;
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


async function loadLatestFactByTypeAndKey(
  pool: Pool,
  factType: string,
  keyPath: string,
  keyValue: string,
  tenant: TenantTriple
): Promise<any | null> {
  const sql = `
    SELECT fact_id, occurred_at, source, record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = $1
      AND (record_json::jsonb#>>string_to_array($2, ',')) = $3
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $4
      AND (record_json::jsonb#>>'{payload,project_id}') = $5
      AND (record_json::jsonb#>>'{payload,group_id}') = $6
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const res = await pool.query(sql, [factType, keyPath, keyValue, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!res.rows?.length) return null;
  const row: any = res.rows[0];
  return {
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    source: String(row.source),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json
  };
}

async function classifyExecutePrimaryKey(
  pool: Pool,
  tenant: TenantTriple,
  act_task_id: string
): Promise<"recommendation" | "approval_request" | "operation_plan" | "task" | "missing"> {
  if (!act_task_id) return "missing";

  const recommendationFact = await loadLatestFactByTypeAndKey(
    pool,
    "decision_recommendation_v1",
    "payload,recommendation_id",
    act_task_id,
    tenant
  );
  if (recommendationFact) return "recommendation";

  const approvalFact = await loadLatestFactByTypeAndKey(
    pool,
    "approval_request_v1",
    "payload,request_id",
    act_task_id,
    tenant
  );
  if (approvalFact) return "approval_request";

  const operationPlanFact = await loadLatestFactByTypeAndKey(
    pool,
    "operation_plan_v1",
    "payload,operation_plan_id",
    act_task_id,
    tenant
  );
  if (operationPlanFact) return "operation_plan";

  const taskFact = await loadLatestFactByTypeAndKey(
    pool,
    "ao_act_task_v0",
    "payload,act_task_id",
    act_task_id,
    tenant
  );
  if (taskFact) return "task";

  return "missing";
}

async function assertApprovedForTask(pool: Pool, tenant: TenantTriple, act_task_id: string): Promise<boolean> {
  const sql = `
    SELECT 1
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
      AND COALESCE(record_json::jsonb#>>'{payload,status}','') = 'APPROVED'
    LIMIT 1
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, act_task_id]);
  return !!res.rows?.length;
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


async function loadRecommendations(pool: Pool, tenant: TenantTriple, limit: number, fieldId?: string): Promise<any[]> {
  const normalizedFieldId = String(fieldId ?? "").trim();
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (
         $5::text = ''
         OR (record_json::jsonb#>>'{payload,field_id}') = $5
       )
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT $4`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, limit, normalizedFieldId]
  );
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json
  }));
}

function normalizeRecommendationOutput(row: any, chain?: { approval_request_id: string | null; operation_plan_id: string | null; act_task_id: string | null; receipt_fact_id: string | null; latest_status: string | null }): any {
  const payloadRaw = row?.record_json?.payload ?? {};
  const payload = payloadRaw && typeof payloadRaw === "object" ? { ...payloadRaw } : {};
  // customer-facing output must never carry internal debug or internal-only provenance payloads.
  delete (payload as any).internal_debug_explain;
  delete (payload as any).data_sources;
  const explain = payload?.explain && typeof payload.explain === "object" ? payload.explain : {};
  const normalizedExplain = {
    trigger_source_fields: Array.isArray(explain.trigger_source_fields) ? explain.trigger_source_fields : [],
    action_summary: String(explain.action_summary ?? payload?.suggested_action?.summary ?? "建议动作已生成"),
    rule_hit_summary: Array.isArray(explain.rule_hit_summary) ? explain.rule_hit_summary : [],
  };
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
    title: payload.title ?? null,
    summary: payload.summary ?? null,
    suggested_action: payload.suggested_action ?? null,
    explain: normalizedExplain,
  };
}

function msLabel(tsMs: number | null | undefined): string {
  if (!Number.isFinite(Number(tsMs))) return "-";
  const delta = Date.now() - Number(tsMs);
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))} 分钟前`;
  if (delta < 86_400_000) return `${Math.max(1, Math.floor(delta / 3_600_000))} 小时前`;
  return `${Math.max(1, Math.floor(delta / 86_400_000))} 天前`;
}

function statusTone(code: string): "success" | "info" | "warning" | "danger" {
  const c = String(code ?? "").toUpperCase();
  if (["APPROVED", "ACKED", "EXECUTED", "COMPLETED", "SUCCESS", "RECEIPTED"].includes(c)) return "success";
  if (["DISPATCHED", "PLANNED", "IN_APPROVAL"].includes(c)) return "info";
  if (["PENDING", "PROPOSED"].includes(c)) return "warning";
  return "warning";
}

function recommendationStatusLabel(code: string): string {
  const c = String(code ?? "").toUpperCase();
  if (c === "DISPATCHED") return "已下发作业执行";
  if (c === "ACKED") return "已确认";
  if (c === "APPROVED") return "已批准";
  if (c === "EXECUTED") return "已回执";
  if (c === "PENDING") return "待回执";
  if (c === "PROPOSED") return "待提交审批";
  return c || "待处理";
}

function toProgress(chain: { approval_request_id: string | null; operation_plan_id: string | null; act_task_id: string | null; receipt_fact_id: string | null; latest_status: string | null }, statusCode: string) {
  return {
    current_step: recommendationStatusLabel(statusCode),
    steps: [
      { key: "recommendation", label: "建议", done: true },
      { key: "approval", label: "审批", done: Boolean(chain.approval_request_id) },
      { key: "plan", label: "作业计划", done: Boolean(chain.operation_plan_id) },
      { key: "execution", label: "作业执行", done: Boolean(chain.act_task_id) },
      { key: "receipt", label: "执行回执", done: Boolean(chain.receipt_fact_id) }
    ]
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

function recommendationFormalTriggerEligibleForApproval(payload: any): boolean {
  const signals = payload?.data_sources?.customer_facing?.stage1_formal_trigger_signals_v1
    ?? payload?.stage1_action_trigger_input?.formal_trigger_signals
    ?? null;
  if (!signals || typeof signals !== "object") return false;
  return isFormalStage1TriggerEligible({
    irrigation_effectiveness: (signals as any).irrigation_effectiveness,
    leak_risk: (signals as any).leak_risk,
  });
}

export function registerDecisionEngineV1Routes(app: FastifyInstance, pool: Pool): void {
  app.addHook("onReady", async () => {
    await ensureRulePerformanceTable(pool);
    await ensureDerivedSensingStateProjectionV1(pool);
  });

  app.get("/api/v1/agronomy/rule-performance", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(q.tenant_id ?? auth.tenant_id),
      project_id: String(q.project_id ?? auth.project_id),
      group_id: String(q.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const limit = Math.max(1, Math.min(Number(q.limit ?? 200) || 200, 500));
    const items = await listRulePerformance({ pool, limit });
    return reply.send({ ok: true, items });
  });

  app.get("/api/v1/agronomy/rule-performance/:rule_id", async (req, reply) => {
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
    const ruleId = String(p.rule_id ?? "").trim();
    if (!ruleId) return badRequest(reply, "MISSING_RULE_ID");
    const items = await listRulePerformance({ pool, ruleId, limit: 500 });
    return reply.send({ ok: true, items });
  });

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
    const fieldId = String(q.field_id ?? "").trim();
    const limit = Math.max(1, Math.min(Number(q.limit ?? 50) || 50, 200));
    const rows = await loadRecommendations(pool, tenant, limit, fieldId);
    const items = await Promise.all(rows.map(async (row) => {
      const item = normalizeRecommendationOutput(row, await loadRecommendationChainById(pool, String(row?.record_json?.payload?.recommendation_id ?? ""), tenant));
      const field_id = String(item?.field_id ?? "").trim();
      const latest_states = field_id
        ? await getLatestDerivedSensingStatesByFieldV1(pool, { ...tenant, field_id })
        : [];
      return { ...item, latest_derived_sensing_states: latest_states };
    }));
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
    const item = normalizeRecommendationOutput(row, chain);
    const {
      internal_debug_explain: _internalDebugExplainIgnored,
      data_sources: _dataSourcesIgnored,
      ...safeItem
    } = (item ?? {}) as Record<string, any>;
    const field_id = String(item?.field_id ?? "").trim();
    const latest_states = field_id
      ? await getLatestDerivedSensingStatesByFieldV1(pool, { ...tenant, field_id })
      : [];
    return reply.send({ ok: true, item: { ...safeItem, latest_derived_sensing_states: latest_states } });
  });

  app.get("/api/v1/agronomy/recommendations/control-plane", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const q: any = (req as any).query ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(q.tenant_id ?? auth.tenant_id),
      project_id: String(q.project_id ?? auth.project_id),
      group_id: String(q.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const fieldId = String(q.field_id ?? "").trim();
    const limit = Math.max(1, Math.min(Number(q.limit ?? 50) || 50, 200));
    const fieldIdFilter = String(q.field_id ?? "").trim();
    const rows = await loadRecommendations(pool, tenant, limit);
    const normalizedAll = await Promise.all(rows.map(async (row) => {
      const item = normalizeRecommendationOutput(row, await loadRecommendationChainById(pool, String(row?.record_json?.payload?.recommendation_id ?? ""), tenant));
      const statusCode = String(item.latest_status ?? item.status ?? "PENDING").toUpperCase();
      return {
        recommendation_id: item.recommendation_id,
        title: item.title || (item.recommendation_type === "irrigation_recommendation_v1" ? "灌溉建议" : "作物健康建议"),
        status: {
          code: statusCode,
          label: recommendationStatusLabel(statusCode),
          tone: statusTone(statusCode)
        },
        progress: toProgress(item, statusCode),
        field: {
          field_id: item.field_id,
          field_name: item.field_id
        },
        program: {
          program_id: null,
          program_title: null
        },
        evidence_count: Array.isArray(item.evidence_refs) ? item.evidence_refs.length : 0,
        rule_count: Array.isArray(item.rule_hit) ? item.rule_hit.length : 0,
        confidence: item.confidence ?? null,
        pending: !item.receipt_fact_id,
        reason_summary: item?.suggested_action?.summary || "建议已生成，等待链路执行。",
        updated_ts_ms: Date.parse(String(item.occurred_at ?? "")) || Date.now(),
        updated_at_label: msLabel(Date.parse(String(item.occurred_at ?? "")) || Date.now()),
        linked_refs: {
          approval_request_id: item.approval_request_id,
          operation_plan_id: item.operation_plan_id,
          act_task_id: item.act_task_id,
          receipt_fact_id: item.receipt_fact_id
        }
      };
    }));
    const normalized = fieldIdFilter
      ? normalizedAll.filter((item) => String(item?.field?.field_id ?? "").trim() === fieldIdFilter)
      : normalizedAll;

    const summary = {
      total: normalized.length,
      pending: normalized.filter((x) => x.pending).length,
      in_approval: normalized.filter((x) => x.linked_refs.approval_request_id && !x.linked_refs.receipt_fact_id).length,
      receipted: normalized.filter((x) => x.linked_refs.receipt_fact_id).length
    };
    return reply.send({ ok: true, summary, items: normalized });
  });

  app.get("/api/v1/agronomy/recommendations/:recommendation_id/control-plane", async (req, reply) => {
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
    const item = normalizeRecommendationOutput(row, chain);
    const {
      internal_debug_explain: _internalDebugExplainIgnored,
      data_sources: _dataSourcesIgnored,
      ...safeItem
    } = (item ?? {}) as Record<string, any>;
    const updatedTs = Date.parse(String(item.occurred_at ?? "")) || Date.now();
    const statusCode = String(safeItem.latest_status ?? safeItem.status ?? "PENDING").toUpperCase();
    return reply.send({
      ok: true,
      item: {
        recommendation: {
          recommendation_id: safeItem.recommendation_id,
          title: safeItem.title || (safeItem.recommendation_type === "irrigation_recommendation_v1" ? "灌溉建议" : "作物健康建议"),
          subtitle: safeItem?.suggested_action?.summary || "建议已生成，待执行链路推进。",
          status: { code: statusCode, label: recommendationStatusLabel(statusCode), tone: statusTone(statusCode) },
          type: {
            code: safeItem.recommendation_type,
            label: safeItem.recommendation_type === "irrigation_recommendation_v1" ? "灌溉建议" : "作物健康建议"
          },
          updated_ts_ms: updatedTs,
          updated_at_label: msLabel(updatedTs)
        },
        summary: {
          confidence: safeItem.confidence ?? null,
          rule_count: Array.isArray(safeItem.rule_hit) ? safeItem.rule_hit.length : 0,
          evidence_count: Array.isArray(safeItem.evidence_refs) ? safeItem.evidence_refs.length : 0,
          processing_status: { code: statusCode, label: recommendationStatusLabel(statusCode), tone: statusTone(statusCode) }
        },
        explain: safeItem.explain ?? null,
        reasoning: {
          trigger_reason: safeItem?.suggested_action?.summary || "建议由规则与证据触发。",
          rule_hits: (Array.isArray(safeItem.rule_hit) ? safeItem.rule_hit : []).map((rule: any) => ({
            rule_id: rule.rule_id,
            label: String(rule.rule_id || "规则"),
            matched: Boolean(rule.matched),
            summary: `阈值 ${rule.threshold ?? "-"}，实际 ${rule.actual ?? "-"}。`
          })),
          evidence_refs: (Array.isArray(safeItem.evidence_refs) ? safeItem.evidence_refs : []).map((ref: string) => ({ kind: "evidence", label: ref, value: ref }))
        },
        suggested_action: {
          title: "建议动作",
          summary: safeItem?.suggested_action?.summary || "-",
          parameters: safeItem?.suggested_action?.parameters || {}
        },
        pipeline: {
          approval: { request_id: safeItem.approval_request_id, status: { code: safeItem.approval_request_id ? "APPROVED" : "PENDING", label: safeItem.approval_request_id ? "已批准" : "待审批", tone: safeItem.approval_request_id ? "success" : "warning" } },
          operation_plan: { operation_plan_id: safeItem.operation_plan_id, status: { code: safeItem.operation_plan_id ? "ACKED" : "PENDING", label: safeItem.operation_plan_id ? "已确认" : "待生成", tone: safeItem.operation_plan_id ? "info" : "warning" } },
          execution: { act_task_id: safeItem.act_task_id, status: { code: safeItem.act_task_id ? "DISPATCHED" : "PENDING", label: safeItem.act_task_id ? "已下发" : "待下发", tone: safeItem.act_task_id ? "info" : "warning" } },
          receipt: { receipt_fact_id: safeItem.receipt_fact_id, status: { code: safeItem.receipt_fact_id ? "EXECUTED" : "PENDING", label: safeItem.receipt_fact_id ? "已回执" : "待回执", tone: safeItem.receipt_fact_id ? "success" : "warning" } }
        },
        technical_details: {
          recommendation_id: safeItem.recommendation_id,
          approval_request_id: safeItem.approval_request_id,
          operation_plan_id: safeItem.operation_plan_id,
          act_task_id: safeItem.act_task_id,
          raw_type: safeItem.recommendation_type,
          raw_status: safeItem.latest_status ?? safeItem.status
        }
      }
    });
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
    const requestedDeviceId = String(body.device_id ?? "").trim();
    if (!requestedDeviceId) return badRequest(reply, "MISSING_DEVICE_ID");
    const derivedFieldId = String(body.field_id ?? "").trim();
    if (!derivedFieldId) return badRequest(reply, "MISSING_FIELD_ID");
    const refreshedReadModels = await refreshFieldReadModelsWithObservabilityV1(pool, {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: derivedFieldId
    });
    const stage1Summary = refreshedReadModels.sensing_summary_stage1.payload;
    if (!stage1Summary || typeof stage1Summary !== "object") {
      return badRequest(reply, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
    }
    assertFormalTriggerInputLayer("stage1_sensing_summary_v1");
    assertNoForbiddenTriggerFields(stage1Summary);
    const normalizedStage1RecommendationInput = normalizeStage1RecommendationInput(stage1Summary);
    const formalTriggerSignals = deriveFormalTriggerSignalsFromStage1Summary(stage1Summary);
    if (!isFormalStage1TriggerEligible(formalTriggerSignals)) {
      return badRequest(reply, "FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE");
    }
    const fertilityState = refreshedReadModels.fertility_state.payload;
    const sensingOverview = refreshedReadModels.sensing_overview.payload;
    const latestDerivedStates = await getLatestDerivedSensingStatesByFieldV1(pool, {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: derivedFieldId
    });
    if (!sensingOverview) return badRequest(reply, "FIELD_SENSING_OVERVIEW_NOT_FOUND");
    const snapshot_id = `rm_${tenant.tenant_id}_${derivedFieldId}_${sensingOverview.updated_ts_ms ?? Date.now()}`;

    if (!fertilityState || String(fertilityState.fertility_level ?? "").trim() === "") {
      req.log.warn({
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        field_id: derivedFieldId
      }, "[recommendations.generate] missing field_fertility_state_v1; precheck downgraded to neutral constraints");
    }
    const enableRecommendationPrecheck = isFeatureEnabled("GEOX_ENABLE_RECOMMENDATION_PRECHECK_V1", true);
    const hardRuleInput: HardRuleConstraintInputV1 = enableRecommendationPrecheck
      ? {
          ...deriveFertilityPrecheckConstraintsV1({
            fertilityState: fertilityState ?? {},
            baseConstraints: {
              moisture_constraint: null,
              salinity_risk: null,
            }
          }),
          source: "field_fertility_state_v1"
        }
      : {
          moisture_constraint: null,
          salinity_risk: null,
          source: "field_fertility_state_v1"
        };
    const recommendations = buildRecommendationsFromStage1Summary(
      body,
      stage1Summary,
      snapshot_id,
      { sensingOverview: sensingOverview ?? null, fertilityState: fertilityState ?? null },
      hardRuleInput
    );
    if (recommendations.length === 0) {
      return badRequest(reply, "NO_RECOMMENDATION_TRIGGERED");
    }
    const cropCode = String(body.crop_code ?? "").trim();
    const matchedRuleIds = Array.from(new Set(
      recommendations.flatMap((x) => (Array.isArray(x.rule_hit) ? x.rule_hit : []))
        .filter((x: any) => Boolean(x?.matched))
        .map((x: any) => String(x?.rule_id ?? "").trim())
        .filter(Boolean)
    ));
    const ruleScoreMap = cropCode ? await loadRuleScores(pool, cropCode, matchedRuleIds) : new Map<string, RulePerformanceStats>();
    recommendations.forEach((rec) => {
      const perfScore = recommendationRulePerformanceScore(rec, ruleScoreMap);
      const payloadStats = recommendationRuleScoreAndConfidence(rec, ruleScoreMap);
      rec.rule_performance_score = perfScore;
      rec.rule_score = payloadStats.rule_score;
      rec.rule_confidence = payloadStats.rule_confidence;
      rec.rank_score = Number((Number(rec.confidence ?? 0) * (1 + perfScore)).toFixed(6));
      rec.explain = buildRecommendationExplainV1({
        recommendation: rec,
        stage1Summary,
      });
      rec.internal_debug_explain = buildRecommendationInternalDebugExplainV1({
        recommendation: rec,
        sensingOverview,
        fertilityState: fertilityState ?? null,
        derivedSensingStates: latestDerivedStates
      });
    });
    recommendations.sort((a, b) => Number(b.rank_score ?? 0) - Number(a.rank_score ?? 0));

    const fact_ids: string[] = [];
    const resolvedRecommendations: RecommendationV1[] = [];
    for (const rec of recommendations) {
      const resolvedProgramId = await resolveProgramIdForRecommendation(pool, tenant, rec);
      const recommendationPayload = { ...rec, program_id: resolvedProgramId };
      const chainValidation = validateRecommendationMainChainFields(recommendationPayload);
      const matchedRuleHit = (Array.isArray(recommendationPayload.rule_hit) ? recommendationPayload.rule_hit : [])
        .find((item) => Boolean(item?.matched) && String(item?.rule_id ?? "").trim().length > 0);
      const primaryRuleId = String(matchedRuleHit?.rule_id ?? recommendationPayload.rule_id ?? "").trim();
      const primaryRule = mapRuleToSkill(primaryRuleId);
      const recommendationInputDigest = digestJson({
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        field_id: recommendationPayload.field_id,
        operation_plan_id: null,
        recommendation_id: recommendationPayload.recommendation_id,
        rule_id: primaryRuleId,
        rule_hit: recommendationPayload.rule_hit,
        data_sources: {
          customer_facing: {
            stage1_sensing_summary_v1: normalizedStage1RecommendationInput,
            stage1_formal_trigger_signals_v1: formalTriggerSignals,
          },
          internal_only: {
            field_sensing_overview_v1: sensingOverview,
            field_fertility_state_v1: fertilityState ?? null,
            image_recognition: body.image_recognition ?? null
          }
        }
      });
      if (!chainValidation.ok) {
        await appendSkillRunFact(pool, {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          skill_id: primaryRule.skill_id,
          version: primaryRule.version,
          category: "AGRONOMY",
          status: "ACTIVE",
          result_status: matchedRuleHit ? "FAILED" : "SKIPPED",
          trigger_stage: "before_recommendation",
          scope_type: "FIELD",
          rollout_mode: "DIRECT",
          bind_target: recommendationPayload.recommendation_id,
          operation_id: recommendationPayload.recommendation_id,
          operation_plan_id: null,
          field_id: recommendationPayload.field_id,
          device_id: recommendationPayload.device_id,
          input_digest: recommendationInputDigest,
          output_digest: digestJson({
            ok: false,
            chain_validation_error: chainValidation.error,
            field_id: recommendationPayload.field_id,
            operation_plan_id: null,
            recommendation_id: recommendationPayload.recommendation_id,
            rule_id: primaryRuleId,
          }),
          error_code: "RECOMMENDATION_CHAIN_VALIDATION_FAILED",
          duration_ms: 0,
        });
        return badRequest(reply, chainValidation.error);
      }
      const recommendation_input_fact_id = await insertFact(pool, "api/v1/recommendations/generate", {
        type: "decision_recommendation_input_facts_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          recommendation_id: recommendationPayload.recommendation_id,
          snapshot_id: recommendationPayload.snapshot_id,
          field_id: recommendationPayload.field_id,
          season_id: recommendationPayload.season_id,
          device_id: recommendationPayload.device_id,
          program_id: recommendationPayload.program_id,
          evidence_facts: recommendationEvidenceFacts(sensingOverview, body.image_recognition),
          stage1_action_trigger_input: {
            source_kind: "stage1_sensing_summary_v1",
            formal_trigger_signals: formalTriggerSignals,
            support_only_signals: normalizedStage1RecommendationInput,
          },
          created_ts: Date.now()
        }
      });
      const fact_id = await insertFact(pool, "api/v1/recommendations/generate", {
        type: "decision_recommendation_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          ...recommendationPayload,
          recommendation_input_fact_id,
          data_sources: {
            customer_facing: {
              stage1_sensing_summary_v1: normalizedStage1RecommendationInput,
              stage1_formal_trigger_signals_v1: formalTriggerSignals,
            },
            internal_only: {
              field_sensing_overview_v1: sensingOverview,
              field_fertility_state_v1: fertilityState ?? null,
              image_recognition: body.image_recognition ?? null
            }
          }
        }
      });
      await appendSkillRunFact(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        skill_id: primaryRule.skill_id,
        version: primaryRule.version,
        category: "AGRONOMY",
        status: "ACTIVE",
        result_status: matchedRuleHit ? "SUCCESS" : "SKIPPED",
        trigger_stage: "before_recommendation",
        scope_type: "FIELD",
        rollout_mode: "DIRECT",
        bind_target: recommendationPayload.recommendation_id,
        operation_id: recommendationPayload.recommendation_id,
        operation_plan_id: null,
        field_id: recommendationPayload.field_id,
        device_id: recommendationPayload.device_id,
        input_digest: recommendationInputDigest,
        output_digest: digestJson({
          ok: true,
          fact_id,
          field_id: recommendationPayload.field_id,
          operation_plan_id: null,
          recommendation_id: recommendationPayload.recommendation_id,
          rule_id: primaryRuleId,
          rank_score: recommendationPayload.rank_score ?? null,
          confidence: recommendationPayload.confidence ?? null,
        }),
        error_code: null,
        duration_ms: 0,
      });
      fact_ids.push(fact_id);
      resolvedRecommendations.push({
        ...recommendationPayload,
        internal_debug_explain: undefined,
      });
    }

    return reply.send({ ok: true, recommendations: resolvedRecommendations, fact_ids });
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
    if (!recommendationFormalTriggerEligibleForApproval(rec)) {
      return badRequest(reply, "FORMAL_TRIGGER_PROVENANCE_REQUIRED");
    }
    const resolvedProgramId = await resolveProgramIdForRecommendation(pool, tenant, rec);
    const actionType = toAoActActionType(rec);
    const aoActTarget = toAoActTarget(rec);
    const aoActParameters = toPrimitiveParameters(rec?.suggested_action?.parameters ?? {});
    if (Object.keys(aoActParameters).length === 0) {
      aoActParameters.noop = true;
    }
    const aoActParameterSchema = toAoActParameterSchema(aoActParameters);
    const adapterTypeRaw = typeof rec?.suggested_action?.adapter_type === "string" ? String(rec.suggested_action.adapter_type).trim() : "";
    const adapter_type = adapterTypeRaw || ((String(actionType).toLowerCase() === "irrigation.start" || String(actionType).toLowerCase() === "irrigate") ? "irrigation_simulator" : "mqtt");

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/approvals/request`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      program_id: resolvedProgramId,
      field_id: rec.field_id ?? null,
      season_id: rec.season_id ?? null,
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
        device_id: rec.device_id ?? null,
        program_id: resolvedProgramId,
        adapter_type
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
        program_id: resolvedProgramId,
        field_id: rec.field_id ?? null,
        season_id: rec.season_id ?? null,
        crop_code: rec.crop_code ?? rec.suggested_action?.parameters?.crop_code ?? null,
        crop_stage: rec.crop_stage ?? rec.suggested_action?.parameters?.crop_stage ?? null,
        rule_id: rec.rule_id ?? rec.rule_hit?.[0]?.rule_id ?? null,
        expected_effect: rec.expected_effect ?? rec.suggested_action?.parameters?.expected_effect ?? null,
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
        program_id: resolvedProgramId,
        field_id: rec.field_id ?? null,
        season_id: rec.season_id ?? null,
        crop_code: rec.crop_code ?? rec.suggested_action?.parameters?.crop_code ?? null,
        crop_stage: rec.crop_stage ?? rec.suggested_action?.parameters?.crop_stage ?? null,
        rule_id: rec.rule_id ?? rec.rule_hit?.[0]?.rule_id ?? null,
        expected_effect: rec.expected_effect ?? rec.suggested_action?.parameters?.expected_effect ?? null,
        recommendation_fact_id: row.fact_id,
        approval_request_id: delegated.json.request_id,
        action_type: actionType,
        adapter_type,
        target: aoActTarget,
        parameters: aoActParameters,
        status: "CREATED",
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
        status: "CREATED",
        trigger: "recommendation_submit_approval",
        approval_request_id: delegated.json.request_id,
        created_ts: Date.now()
      }
    });

    return reply.send({ ok: true, recommendation_id, approval_request_id: delegated.json.request_id, approval_fact_id: delegated.json.fact_id, mapping_fact_id, operation_plan_id, operation_plan_fact_id });
  });

  app.post("/api/v1/simulators/irrigation/execute", async (req, reply) => {
    // This endpoint is executor-only.
    // Never callable from recommendation / UI / approval flows.
    // All execution must originate from approved AO-ACT tasks.
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
    const task_id = String(body.task_id ?? "").trim();
    const bodyActTaskId = String(body.act_task_id ?? "").trim();
    if (!task_id) return badRequest(reply, "MISSING_TASK_ID");
    if (bodyActTaskId && bodyActTaskId !== task_id) return badRequest(reply, "TASK_ID_ACT_TASK_ID_MISMATCH");
    const act_task_id = task_id;
    const command_id = String(body.command_id ?? "").trim();
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== act_task_id) return badRequest(reply, "COMMAND_ID_MUST_MATCH_TASK_ID");

    const keyKind = await classifyExecutePrimaryKey(pool, tenant, act_task_id);
    if (keyKind === "recommendation") {
      return badRequest(reply, "RECOMMENDATION_ID_NOT_ALLOWED");
    }
    if (keyKind === "approval_request") {
      return badRequest(reply, "APPROVAL_REQUEST_ID_NOT_ALLOWED");
    }
    if (keyKind === "operation_plan") {
      return badRequest(reply, "OPERATION_PLAN_ID_NOT_ALLOWED");
    }
    if (keyKind === "missing") {
      return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });
    }

    const approved = await assertApprovedForTask(pool, tenant, act_task_id);
    if (!approved) return reply.status(403).send({ ok: false, error: "TASK_NOT_APPROVED" });

    const taskFact = await loadLatestFactByTypeAndKey(
      pool,
      "ao_act_task_v0",
      "payload,act_task_id",
      act_task_id,
      tenant
    );
    if (!taskFact) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });

    const taskPayload: any = taskFact.record_json?.payload ?? {};
    const operation_plan_id = String(taskPayload?.operation_plan_id ?? "").trim();
    if (!operation_plan_id) {
      return badRequest(reply, "TASK_OPERATION_PLAN_ID_MISSING");
    }

    const startTs = Date.now();
    const endTs = startTs + 5_000;
    const idempotency_key = `irrigation_sim_${randomUUID().replace(/-/g, "")}`;
    const logRef = `sim://irrigation/${act_task_id}/${startTs}`;

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/actions/receipt`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
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
        duration_min: 5
      },
      meta: {
        idempotency_key,
        command_id,
        operation_plan_id,
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
