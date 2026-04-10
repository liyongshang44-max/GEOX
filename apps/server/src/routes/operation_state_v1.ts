import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectOperationStateV1 } from "../projections/operation_state_v1";
import { projectRecommendationStateV1 } from "../projections/recommendation_state_v1";
import { projectDeviceStateV1 } from "../projections/device_state_v1";
import { normalizeReceiptEvidence } from "../services/receipt_evidence";
import { evaluateEvidence, isFormalLogKind } from "../domain/acceptance/evidence_policy";
import { deriveBusinessEffect } from "../domain/agronomy/business_effect";
import { computeCostBreakdown } from "../domain/agronomy/cost_model";
import { buildAttributionBasis, computeEffect, ensureRulePerformanceTable, evaluateEffectVerdict, recordRulePerformance, type EffectVerdict } from "../domain/agronomy/effect_engine";
import { resolveCropStageByPriority } from "../domain/agronomy/stage_resolver";
import { appendSkillRunFact, digestJson } from "../domain/skill_registry/facts";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; source: string | null; record_json: any };
function buildInvalidAcceptanceFact(params: {
  acceptance: FactRow | null;
  invalidReason: "evidence_missing" | "evidence_invalid" | null;
  fallbackOccurredAt?: string | null;
}): FactRow {
  const payload = params.acceptance?.record_json?.payload ?? {};
  const missingEvidence = Array.isArray(payload?.missing_evidence)
    ? payload.missing_evidence.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  const explanationCodes = Array.isArray(payload?.explanation_codes)
    ? payload.explanation_codes.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  if (params.invalidReason) missingEvidence.push(params.invalidReason);
  explanationCodes.push("invalid_execution");
  return {
    fact_id: params.acceptance?.fact_id ?? `derived_invalid_acceptance_${Date.now()}`,
    occurred_at: params.acceptance?.occurred_at ?? params.fallbackOccurredAt ?? new Date().toISOString(),
    source: params.acceptance?.source ?? "api/v1/operation/state/detail",
    record_json: {
      type: "acceptance_result_v1",
      payload: {
        ...payload,
        verdict: "FAIL",
        missing_evidence: Array.from(new Set(missingEvidence)),
        explanation_codes: Array.from(new Set(explanationCodes)),
      },
    },
  };
}

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

async function hasOperationFeedbackRecorded(pool: Pool, tenant: TenantTriple, operationPlanId: string): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'rule_performance_feedback_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
     LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
  );
  return Boolean(q.rows?.length);
}

async function updateRulePerformance(params: {
  pool: Pool;
  tenant: TenantTriple;
  operationPlanId: string;
  recommendationId: string | null;
  cropCode: string;
  ruleId: string | null;
  cropStage: string;
  effectVerdict: EffectVerdict;
}): Promise<void> {
  const { pool, tenant, operationPlanId, recommendationId, cropCode, cropStage, effectVerdict } = params;
  const ruleId = String(params.ruleId ?? "").trim();
  if (!operationPlanId || !cropCode || !cropStage || !ruleId || !effectVerdict) return;
  const exists = await hasOperationFeedbackRecorded(pool, tenant, operationPlanId);
  if (exists) return;

  await recordRulePerformance({
    pool,
    ruleId,
    cropCode,
    cropStage,
    verdict: effectVerdict,
  });

  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [
      `rule_perf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      "api/v1/operation/state",
      JSON.stringify({
        type: "rule_performance_feedback_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          operation_plan_id: operationPlanId,
          recommendation_id: recommendationId,
          crop_code: cropCode,
          crop_stage: cropStage,
          rule_id: ruleId,
          effect_verdict: effectVerdict,
          recorded_at: Date.now(),
        }
      })
    ]
  );
}

async function hasSkillRunRecorded(params: {
  pool: Pool;
  tenant: TenantTriple;
  operationPlanId: string;
  triggerStage: string;
}): Promise<boolean> {
  const { pool, tenant, operationPlanId, triggerStage } = params;
  const q = await pool.query(
    `SELECT 1
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'skill_run_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          (record_json::jsonb#>>'{payload,operation_id}') = $4
          OR (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
        )
        AND (record_json::jsonb#>>'{payload,trigger_stage}') = $5
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId, triggerStage]
  );
  return Boolean(q.rows?.length);
}

async function ensureSkillRunFact(params: {
  pool: Pool;
  tenant: TenantTriple;
  operationPlanId: string;
  triggerStage: "before_recommendation" | "after_recommendation" | "before_dispatch" | "before_acceptance";
  category: "AGRONOMY" | "DEVICE" | "ACCEPTANCE";
  bindTarget: string;
  skillId: string;
  version?: string | null;
  resultStatus: "SUCCESS" | "FAILED" | "PENDING";
  errorCode?: string | null;
  fieldId?: string | null;
  deviceId?: string | null;
}): Promise<void> {
  const exists = await hasSkillRunRecorded({
    pool: params.pool,
    tenant: params.tenant,
    operationPlanId: params.operationPlanId,
    triggerStage: params.triggerStage,
  });
  if (exists) return;
  await appendSkillRunFact(params.pool, {
    tenant_id: params.tenant.tenant_id,
    project_id: params.tenant.project_id,
    group_id: params.tenant.group_id,
    skill_id: params.skillId,
    version: String(params.version ?? "v1"),
    category: params.category,
    status: "ACTIVE",
    result_status: params.resultStatus,
    lifecycle_version: 2,
    trigger_stage: params.triggerStage,
    scope_type: "PROGRAM",
    rollout_mode: "DIRECT",
    bind_target: params.bindTarget,
    operation_id: params.operationPlanId,
    operation_plan_id: params.operationPlanId,
    field_id: params.fieldId ?? null,
    device_id: params.deviceId ?? null,
    input_digest: digestJson({
      operation_plan_id: params.operationPlanId,
      trigger_stage: params.triggerStage,
      skill_id: params.skillId,
    }),
    output_digest: digestJson({
      result_status: params.resultStatus,
      error_code: params.errorCode ?? null,
    }),
    error_code: params.errorCode ?? null,
    duration_ms: 0,
  } as any);
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

function parseRuleVersion(params: { explicitVersion?: unknown; compositeRuleId?: unknown }): string | null {
  const explicit = toText(params.explicitVersion);
  if (explicit) return explicit;
  const composite = toText(params.compositeRuleId);
  if (!composite) return null;
  const match = composite.match(/_(v\d+)$/i);
  return match ? match[1].toLowerCase() : null;
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
  const temperature = metricValueFromRows(normalized, ["temperature", "air_temperature", "soil_temperature", "soil_temp", "soil_temp_c"]);
  const humidity = metricValueFromRows(normalized, ["humidity", "air_humidity"]);
  const out: OperationMetricsSnapshot = {};
  if (soilMoisture !== undefined) out.soil_moisture = soilMoisture;
  if (temperature !== undefined) out.temperature = temperature;
  if (humidity !== undefined) out.humidity = humidity;
  return out;
}

async function queryTelemetrySoilMoisture(params: {
  pool: Pool;
  tenantId: string;
  deviceId: string;
  beforeMs?: number | null;
  afterMs?: number | null;
}): Promise<number | null> {
  const { pool, tenantId, deviceId } = params;
  if (!tenantId || !deviceId) return null;
  try {
    if (Number.isFinite(Number(params.beforeMs))) {
      const q = await pool.query(
        `SELECT value_num
           FROM telemetry_index_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND metric = 'soil_moisture'
            AND ts <= to_timestamp($3::double precision / 1000.0)
          ORDER BY ts DESC
          LIMIT 1`,
        [tenantId, deviceId, Number(params.beforeMs)]
      );
      const value = Number(q.rows?.[0]?.value_num ?? NaN);
      return Number.isFinite(value) ? value : null;
    }
    if (Number.isFinite(Number(params.afterMs))) {
      const q = await pool.query(
        `SELECT value_num
           FROM telemetry_index_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND metric = 'soil_moisture'
            AND ts >= to_timestamp($3::double precision / 1000.0)
          ORDER BY ts ASC
          LIMIT 1`,
        [tenantId, deviceId, Number(params.afterMs)]
      );
      const value = Number(q.rows?.[0]?.value_num ?? NaN);
      return Number.isFinite(value) ? value : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function querySnapshotSoilMoisture(params: {
  pool: Pool;
  tenantId: string;
  deviceId: string;
  beforeMs?: number | null;
  afterMs?: number | null;
}): Promise<number | null> {
  const { pool, tenantId, deviceId } = params;
  if (!tenantId || !deviceId) return null;
  try {
    if (Number.isFinite(Number(params.beforeMs))) {
      const q = await pool.query(
        `SELECT soil_moisture_pct
           FROM agronomy_signal_snapshot_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND observed_ts_ms <= $3
          ORDER BY observed_ts_ms DESC
          LIMIT 1`,
        [tenantId, deviceId, Number(params.beforeMs)]
      );
      const value = Number(q.rows?.[0]?.soil_moisture_pct ?? NaN);
      return Number.isFinite(value) ? value : null;
    }
    if (Number.isFinite(Number(params.afterMs))) {
      const q = await pool.query(
        `SELECT soil_moisture_pct
           FROM agronomy_signal_snapshot_v1
          WHERE tenant_id = $1
            AND device_id = $2
            AND observed_ts_ms >= $3
          ORDER BY observed_ts_ms ASC
          LIMIT 1`,
        [tenantId, deviceId, Number(params.afterMs)]
      );
      const value = Number(q.rows?.[0]?.soil_moisture_pct ?? NaN);
      return Number.isFinite(value) ? value : null;
    }
  } catch {
    return null;
  }
  return null;
}

function toExpectedEffect(recPayload: any): { type: "moisture_increase" | "growth_boost"; value: number } | null {
  const payload = recPayload && typeof recPayload === "object" ? recPayload : {};
  const candidate = payload.expected_effect ?? payload?.suggested_action?.parameters?.expected_effect ?? null;
  const typeRaw = String(candidate?.type ?? payload?.suggested_action?.parameters?.expected_effect_type ?? "").trim().toLowerCase();
  const value = Number(candidate?.value ?? payload?.suggested_action?.parameters?.expected_effect_value ?? NaN);
  if ((typeRaw === "moisture_increase" || typeRaw === "growth_boost") && Number.isFinite(value)) {
    return { type: typeRaw, value };
  }
  if (typeRaw === "nutrition_boost" && Number.isFinite(value)) {
    return { type: "growth_boost", value };
  }
  const looseNumericValue = Number(candidate ?? NaN);
  if (Number.isFinite(looseNumericValue)) {
    return { type: "moisture_increase", value: looseNumericValue };
  }
  const fallbackValue = Number(payload?.suggested_action?.parameters?.expected_moisture_increase ?? NaN);
  if (Number.isFinite(fallbackValue)) return { type: "moisture_increase", value: fallbackValue };
  return null;
}

function inferExpectedEffectFromAction(actionTypeRaw: unknown): { type: "moisture_increase" | "growth_boost"; value: number } | null {
  const action = String(actionTypeRaw ?? "").trim().toUpperCase();
  if (!action) return null;
  if (action.includes("IRRIGATE") || action.includes("IRRIGATION")) return { type: "moisture_increase", value: 10 };
  if (action.includes("FERTILIZE") || action.includes("FERTILIZATION")) return { type: "growth_boost", value: 8 };
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

function mapReasonCodeToText(code: string): string {
  const key = String(code ?? "").trim().toLowerCase();
  if (!key) return "触发了系统规则条件";
  if (key.includes("moisture_low")) return "土壤湿度偏低，存在水分胁迫风险";
  if (key.includes("temp_high") || key.includes("heat")) return "温度偏高，作物存在热胁迫风险";
  if (key.includes("humidity_high")) return "湿度偏高，病害风险上升";
  if (key.includes("risk")) return "系统检测到风险升高";
  return `触发条件：${code}`;
}

function buildExplainHuman(input: {
  cropStage: string | null;
  reasonCodes: string[];
  expectedEffect?: { type?: string | null; value?: number | null } | null;
}): { summary: string; reason_text: string[] } {
  const stage = String(input.cropStage ?? "").trim() || "当前阶段";
  const reasonText = (Array.isArray(input.reasonCodes) ? input.reasonCodes : [])
    .slice(0, 5)
    .map((code) => mapReasonCodeToText(String(code)));
  const effectType = String(input.expectedEffect?.type ?? "").trim();
  const effectValue = Number(input.expectedEffect?.value ?? NaN);
  const effectText = effectType
    ? `预期将${effectType}${Number.isFinite(effectValue) ? `（目标变化 ${effectValue}）` : ""}`
    : "预期改善当前关键农学指标";
  return {
    summary: `系统基于${stage}阶段和当前风险信号触发该作业，${effectText}。`,
    reason_text: reasonText.length > 0 ? reasonText : ["系统检测到可执行的改进机会"],
  };
}

function toValueProfile(params: {
  effectVerdict: EffectVerdict;
  actualEffect?: { value?: number | null; delta?: number | null } | null;
  costTotal?: number | null;
}): {
  benefit_tier: "HIGH" | "MEDIUM" | "LOW";
  risk_change: "DOWN" | "STABLE" | "UP";
  cost_impact_tier: "LOW" | "MEDIUM" | "HIGH";
  result_direction: "IMPROVE" | "STABLE" | "DEVIATE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
} {
  const verdict = String(params.effectVerdict ?? "NO_DATA").toUpperCase() as EffectVerdict;
  const actual = Number.isFinite(Number(params.actualEffect?.delta))
    ? Number(params.actualEffect?.delta)
    : Number(params.actualEffect?.value ?? NaN);
  const cost = Number(params.costTotal ?? NaN);
  const costTier: "LOW" | "MEDIUM" | "HIGH" = !Number.isFinite(cost) || cost <= 30
    ? "LOW"
    : cost <= 100
      ? "MEDIUM"
      : "HIGH";
  if (verdict === "SUCCESS") {
    return {
      benefit_tier: "HIGH",
      risk_change: "DOWN",
      cost_impact_tier: costTier,
      result_direction: "IMPROVE",
      confidence: "HIGH",
    };
  }
  if (verdict === "PARTIAL") {
    return {
      benefit_tier: "MEDIUM",
      risk_change: Number.isFinite(actual) && actual > 0 ? "DOWN" : "STABLE",
      cost_impact_tier: costTier,
      result_direction: "STABLE",
      confidence: "MEDIUM",
    };
  }
  if (verdict === "FAILED") {
    return {
      benefit_tier: "LOW",
      risk_change: "UP",
      cost_impact_tier: costTier,
      result_direction: "DEVIATE",
      confidence: "LOW",
    };
  }
  return {
    benefit_tier: "LOW",
    risk_change: "STABLE",
    cost_impact_tier: costTier,
    result_direction: "STABLE",
    confidence: "LOW",
  };
}

type TrendValue = "UP" | "DOWN" | "FLAT" | "NO_DATA";
type NextActionSource = "RULE" | "SLA_FIX" | "MANUAL" | "FALLBACK";
type PriorityBucket = "P0" | "P1" | "P2";

function computeTrendFromSeries(values: number[]): TrendValue {
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length < 2) return "NO_DATA";
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const delta = last - first;
  if (Math.abs(delta) < 0.01) return "FLAT";
  return delta > 0 ? "UP" : "DOWN";
}

function calcPriority(params: {
  finalStatusCode: string;
  valueProfile: { risk_change: "DOWN" | "STABLE" | "UP"; confidence: "HIGH" | "MEDIUM" | "LOW" };
  hasTask: boolean;
  hasReceipt: boolean;
  hasAcceptance: boolean;
  invalidExecution: boolean;
}): {
  priority_bucket: PriorityBucket;
  priority_score: number;
  priority_components: { risk: number; value: number; confidence: number; timeliness: number };
} {
  const slaFix = params.invalidExecution || (params.hasTask && !params.hasReceipt) || (params.hasReceipt && !params.hasAcceptance);
  const highRiskHighConfidence = params.valueProfile.risk_change === "UP" && params.valueProfile.confidence === "HIGH";
  const pendingState = ["PENDING", "PENDING_APPROVAL", "APPROVED", "DISPATCHED", "ACKED", "RUNNING"].includes(params.finalStatusCode);
  const bucket: PriorityBucket = slaFix
    ? "P0"
    : highRiskHighConfidence
      ? "P0"
      : pendingState
        ? "P1"
        : "P2";
  const risk = bucket === "P0" ? 40 : bucket === "P1" ? 20 : 10;
  const value = params.valueProfile.risk_change === "UP" ? 25 : params.valueProfile.risk_change === "DOWN" ? 10 : 15;
  const confidence = params.valueProfile.confidence === "HIGH" ? 20 : params.valueProfile.confidence === "MEDIUM" ? 12 : 6;
  const timeliness = params.hasTask && !params.hasReceipt ? 15 : params.hasReceipt && !params.hasAcceptance ? 12 : 5;
  const priority_score = risk + value + confidence + timeliness;
  return {
    priority_bucket: bucket,
    priority_score,
    priority_components: { risk, value, confidence, timeliness },
  };
}

function resolveRecommendedNextAction(params: {
  operationPlanId: string;
  finalStatusCode: string;
  invalidExecution: boolean;
  hasTask: boolean;
  hasReceipt: boolean;
  hasAcceptance: boolean;
  actionType: string | null;
  hasRule: boolean;
}): { action_type: string; source: NextActionSource; reason: string; related_operation_id?: string } {
  if (params.invalidExecution) {
    return {
      action_type: "RETRY_EXECUTION",
      source: "SLA_FIX",
      reason: "该作业为 INVALID_EXECUTION，需优先修复执行并补充有效证据",
      related_operation_id: params.operationPlanId,
    };
  }
  if (params.hasTask && !params.hasReceipt) {
    return {
      action_type: "COLLECT_RECEIPT",
      source: "SLA_FIX",
      reason: "已有任务但缺少回执，需立即补回执数据",
      related_operation_id: params.operationPlanId,
    };
  }
  if (params.hasReceipt && !params.hasAcceptance) {
    return {
      action_type: "PROMOTE_ACCEPTANCE",
      source: "SLA_FIX",
      reason: "已有回执但未验收，需推动验收闭环",
      related_operation_id: params.operationPlanId,
    };
  }
  if (params.hasRule && params.actionType) {
    return {
      action_type: params.actionType,
      source: "RULE",
      reason: "根据规则链路建议继续执行当前动作",
      related_operation_id: params.operationPlanId,
    };
  }
  if (["PENDING", "PENDING_APPROVAL"].includes(params.finalStatusCode)) {
    return {
      action_type: "REVIEW_APPROVAL",
      source: "MANUAL",
      reason: "当前作业待审批，需人工确认后推进",
      related_operation_id: params.operationPlanId,
    };
  }
  return {
    action_type: "CHECK_FIELD_STATUS",
    source: "FALLBACK",
    reason: "当前无可自动匹配规则且无SLA修复项，建议先核查田块状态",
    related_operation_id: params.operationPlanId,
  };
}

function buildExecutionPlan(input: {
  operationPlanId: string;
  actionType: string | null;
  fieldId: string | null;
  deviceId: string | null;
  expectedEffect?: { type?: string | null; value?: number | null } | null;
  requiresApproval: boolean;
  dispatchedAtMs: number | null;
}): {
  action_type: string;
  target: { kind: "field" | "device"; ref: string };
  parameters: Record<string, unknown>;
  execution_mode: "AUTO" | "MANUAL";
  safe_guard: { requires_approval: boolean };
  failure_strategy: { retryable: boolean; max_retries: number; fallback_action?: string };
  time_window?: { start_ts?: number; end_ts?: number };
  idempotency_key: string;
} {
  const actionType = String(input.actionType ?? "").trim().toUpperCase() || "CHECK_FIELD_STATUS";
  const targetKind: "field" | "device" = input.deviceId ? "device" : "field";
  const targetRef = String((targetKind === "device" ? input.deviceId : input.fieldId) ?? "").trim();
  const parameters: Record<string, unknown> = {};
  if (input.expectedEffect?.type) parameters.expected_effect_type = String(input.expectedEffect.type);
  if (Number.isFinite(Number(input.expectedEffect?.value ?? NaN))) parameters.expected_effect_value = Number(input.expectedEffect?.value);
  const startTs = input.dispatchedAtMs ?? Date.now();
  return {
    action_type: actionType,
    target: { kind: targetKind, ref: targetRef },
    parameters,
    execution_mode: targetKind === "device" ? "AUTO" : "MANUAL",
    safe_guard: { requires_approval: input.requiresApproval },
    failure_strategy: {
      retryable: true,
      max_retries: 2,
      fallback_action: "CHECK_FIELD_STATUS",
    },
    time_window: { start_ts: startTs, end_ts: startTs + 60 * 60 * 1000 },
    idempotency_key: `${input.operationPlanId}_${actionType}`.replace(/[^a-zA-Z0-9_:-]/g, "_"),
  };
}

function normalizeActionTypeForCapability(actionType: string): string {
  const action = String(actionType ?? "").trim().toUpperCase();
  if (!action) return "CHECK_FIELD_STATUS";
  if (action.includes("IRRIGATE")) return "IRRIGATE";
  if (action.includes("FERTILIZE")) return "FERTILIZE";
  if (action.includes("SPRAY")) return "SPRAY";
  return action;
}

function evaluateDeviceCapabilityCheck(input: {
  actionType: string;
  executionMode: "AUTO" | "MANUAL";
  targetRef: string;
}): { supported: boolean; reason?: string } {
  const action = normalizeActionTypeForCapability(input.actionType);
  const allowlist = new Set(["IRRIGATE", "FERTILIZE", "SPRAY", "CHECK_FIELD_STATUS"]);
  if (!allowlist.has(action)) return { supported: false, reason: "ACTION_NOT_SUPPORTED" };
  if (input.executionMode === "AUTO" && !String(input.targetRef ?? "").trim()) {
    return { supported: false, reason: "MISSING_DEVICE_TARGET" };
  }
  return { supported: true };
}

function executionReadyFromState(
  finalStatusCode: string,
  hasReceipt: boolean,
  hasEvidence: boolean,
): "PENDING" | "SUCCESS" | "FAILED" {
  const status = String(finalStatusCode ?? "").toUpperCase();
  if (["FAILED", "ERROR", "INVALID_EXECUTION", "REJECTED"].includes(status)) return "FAILED";
  if (hasReceipt && hasEvidence && ["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED", "PENDING_ACCEPTANCE"].includes(status)) return "SUCCESS";
  return "PENDING";
}

function evaluateExecutionReadiness(input: {
  plan: { parameters: Record<string, unknown>; target: { ref: string }; safe_guard: { requires_approval: boolean } };
  approvalGranted: boolean;
  capability: { supported: boolean; reason?: string };
}): { execution_ready: boolean; execution_blockers: string[] } {
  const blockers: string[] = [];
  if (!input.plan.target?.ref) blockers.push("INVALID_TARGET");
  if (!input.plan.parameters || Object.keys(input.plan.parameters).length < 1) blockers.push("MISSING_PARAMETERS");
  if (input.plan.safe_guard.requires_approval && !input.approvalGranted) blockers.push("REQUIRES_APPROVAL");
  if (!input.capability.supported) blockers.push(input.capability.reason ?? "DEVICE_CAPABILITY_UNSUPPORTED");
  return {
    execution_ready: blockers.length === 0,
    execution_blockers: blockers,
  };
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

function toEvidenceRefFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    const ref = cleanJsonText(value, "");
    return ref || null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const ref = cleanJsonText(record.ref ?? record.path ?? record.url ?? "", "");
  return ref || null;
}

function collectValidEvidenceRefs(input: { artifacts: Array<{ payload?: any }>; logs: unknown[] }): string[] {
  const artifactRefs = input.artifacts
    .filter((item) => {
      const kind = String(item?.payload?.kind ?? "").trim().toLowerCase();
      return Boolean(kind) && kind !== "sim_trace";
    })
    .map((item) => toEvidenceRefFromValue(item?.payload))
    .filter((item): item is string => Boolean(item));
  const logRefs = input.logs
    .filter((item) => isFormalLogKind((item as any)?.kind ?? item))
    .map((item) => toEvidenceRefFromValue(item))
    .filter((item): item is string => Boolean(item));
  return [...new Set([...artifactRefs, ...logRefs])].slice(0, 50);
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

function buildEvidenceTimeline(state: any, approvalDecision: FactRow | null, facts: FactRow[]): Array<{ id: string; kind: string; label: string; status: string | null; occurred_at: string | null; actor_label: string | null; summary: string }> {
  const timelineFromState: Array<{ id: string; kind: string; label: string; status: string | null; occurred_at: string | null; actor_label: string | null; summary: string }> = (state?.timeline ?? []).map((item: any, idx: number) => ({
    id: `${item.type}_${item.ts}_${idx}`,
    kind: String(item.type ?? "UNKNOWN"),
    label: item.label || statusLabel(item.type),
    status: state?.final_status ?? null,
    occurred_at: item.ts ? new Date(item.ts).toISOString() : null,
    actor_label: null,
    summary: item.label || ""
  }));
  if (approvalDecision) {
    timelineFromState.push({
      id: `approval_decision_${approvalDecision.fact_id}`,
      kind: "APPROVAL_DECISION",
      label: "审批决策",
      status: toText(approvalDecision.record_json?.payload?.decision) ?? "",
      occurred_at: approvalDecision.occurred_at,
      actor_label: toText(approvalDecision.record_json?.payload?.decider ?? approvalDecision.record_json?.payload?.actor_label),
      summary: statusLabel(toText(approvalDecision.record_json?.payload?.decision))
    });
  }
  const fallbackFromFacts = facts.map((item) => ({
    id: `fact_${item.fact_id}`,
    kind: String(item.record_json?.type ?? "fact"),
    label: String(item.record_json?.type ?? "fact"),
    status: null,
    occurred_at: item.occurred_at ?? null,
    actor_label: null,
    summary: toText(item.record_json?.payload?.status ?? item.record_json?.payload?.decision ?? item.record_json?.payload?.verdict) ?? ""
  }));
  const merged = timelineFromState.length > 0 ? timelineFromState : fallbackFromFacts;
  merged.sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));
  return merged;
}

type SkillTraceEntry = { skill_id: string | null; version: string | null; run_id: string | null; result_status: string | null; error_code: string | null };
type SkillTraceStage = "sensing" | "agronomy" | "device" | "acceptance";
type SkillTraceItemV2 = { stage: SkillTraceStage; skill_id: string | null; status: string | null; explanation_codes: string[] };

function buildSkillTraceFromFacts(facts: FactRow[], operationPlanId: string): SkillTraceItemV2[] {
  const triggerStageToViewStage = (triggerStage: string): SkillTraceStage | null => {
    const normalized = triggerStage.trim().toLowerCase();
    if (normalized === "before_recommendation") return "sensing";
    if (normalized === "after_recommendation" || normalized === "before_approval") return "agronomy";
    if (normalized === "before_dispatch") return "device";
    if (normalized === "before_acceptance" || normalized === "after_acceptance") return "acceptance";
    return null;
  };
  const runs = facts.filter((row) => {
    if (String(row.record_json?.type ?? "") !== "skill_run_v1") return false;
    const payload = row.record_json?.payload ?? {};
    return toText(payload.operation_id) === operationPlanId || toText(payload.operation_plan_id) === operationPlanId;
  });
  const latestByStage = new Map<SkillTraceStage, FactRow>();
  for (const run of runs) {
    const stage = triggerStageToViewStage(String(run.record_json?.payload?.trigger_stage ?? ""));
    if (!stage) continue;
    const prev = latestByStage.get(stage);
    if (!prev || (toMs(run.occurred_at) ?? 0) >= (toMs(prev.occurred_at) ?? 0)) {
      latestByStage.set(stage, run);
    }
  }
  return (["sensing", "agronomy", "device", "acceptance"] as SkillTraceStage[]).map((stage) => {
    const payload = latestByStage.get(stage)?.record_json?.payload ?? {};
    return {
      stage,
      skill_id: toText(payload.skill_id),
      status: toText(payload.result_status),
      explanation_codes: Array.isArray(payload.explanation_codes)
        ? payload.explanation_codes.map((x: unknown) => String(x)).filter(Boolean)
        : [],
    };
  });
}

function buildLegacySkillTraceFromFacts(facts: FactRow[], operationPlanId: string, fallback?: any): {
  crop_skill: SkillTraceEntry;
  agronomy_skill: SkillTraceEntry;
  device_skill: SkillTraceEntry;
  acceptance_skill: SkillTraceEntry;
} {
  const emptyEntry = (): SkillTraceEntry => ({ skill_id: null, version: null, run_id: null, result_status: null, error_code: null });
  const toEntry = (fact: FactRow | null | undefined): SkillTraceEntry => {
    const payload = fact?.record_json?.payload ?? {};
    return {
      skill_id: toText(payload.skill_id),
      version: toText(payload.version),
      run_id: toText(payload.run_id),
      result_status: toText(payload.result_status),
      error_code: toText(payload.error_code),
    };
  };
  const runs = facts.filter((row) => {
    if (String(row.record_json?.type ?? "") !== "skill_run_v1") return false;
    const payload = row.record_json?.payload ?? {};
    return toText(payload.operation_id) === operationPlanId || toText(payload.operation_plan_id) === operationPlanId;
  });
  const latestByStage = (stages: string[]): FactRow | null => {
    const matched = runs
      .filter((row) => {
        const stage = String(row.record_json?.payload?.trigger_stage ?? "").trim().toLowerCase();
        const normalizedStage = stage === "before_approval" ? "after_recommendation" : stage;
        return stages.includes(normalizedStage);
      })
      .sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));
    return matched[matched.length - 1] ?? null;
  };
  return {
    crop_skill: toEntry(latestByStage(["before_recommendation"])) || fallback?.crop_skill || emptyEntry(),
    agronomy_skill: toEntry(latestByStage(["after_recommendation"])) || fallback?.agronomy_skill || emptyEntry(),
    device_skill: toEntry(latestByStage(["before_dispatch"])) || fallback?.device_skill || emptyEntry(),
    acceptance_skill: toEntry(latestByStage(["before_acceptance", "after_acceptance"])) || fallback?.acceptance_skill || emptyEntry(),
  };
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
    extra.push(...await q("ao_act_manual_fallback_v1", "act_task_id", taskId));
    extra.push(...await q("work_assignment_upserted_v1", "act_task_id", taskId));
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
  extra.push(...await q("action_execution_request_v1", "operation_id", operationPlanId));
  extra.push(...await q("action_execution_attempt_v1", "operation_id", operationPlanId));
  extra.push(...await q("acceptance_result_v1", "operation_plan_id", operationPlanId));
  extra.push(...await q("skill_run_v1", "operation_id", operationPlanId));
  extra.push(...await q("skill_run_v1", "operation_plan_id", operationPlanId));
  const all = [...rows, ...extra];
  all.sort((a, b) => (toMs(a.occurred_at) ?? 0) - (toMs(b.occurred_at) ?? 0));
  return all;
}

export function registerOperationStateV1Routes(app: FastifyInstance, pool: Pool): void {
  app.addHook("onReady", async () => {
    await ensureRulePerformanceTable(pool);
  });

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

  app.get("/api/v1/operations/:operation_id/evidence", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operationId = String((req.params as any)?.operation_id ?? "").trim();
    if (!operationId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });

    const states = await projectOperationStateV1(pool, tenant);
    const state = states.find((x) => x.operation_id === operationId || x.operation_plan_id === operationId);
    if (!state) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const operationPlanId = String(state.operation_plan_id ?? state.operation_id ?? operationId);
    const facts = await queryFactsForOperation(pool, tenant, operationPlanId);
    const latestByType = (type: string) => [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === type) ?? null;
    const rec = latestByType("decision_recommendation_v1");
    const approvalDecision = latestByType("approval_decision_v1");
    const plan = latestByType("operation_plan_v1");
    const task = latestByType("ao_act_task_v0");
    const receiptFact = [...facts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
    const normalizedReceipt = receiptFact ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? "")) : null;

    const recommendationPayload = rec?.record_json?.payload ?? {};
    const operationPayload = plan?.record_json?.payload ?? {};
    const recommendationPayloadWithFallback = {
      ...recommendationPayload,
      expected_effect: recommendationPayload?.expected_effect ?? operationPayload?.expected_effect ?? state.expected_effect ?? null,
      reason_codes: Array.isArray(recommendationPayload?.reason_codes)
        ? recommendationPayload.reason_codes
        : (Array.isArray(operationPayload?.reason_codes) ? operationPayload.reason_codes : (Array.isArray(state.reason_codes) ? state.reason_codes : [])),
    };
    const taskDeviceId = normalizeDeviceId(task?.record_json?.payload?.meta?.device_id ?? state.device_id ?? recommendationPayload?.device_id ?? operationPayload?.device_id);
    const receiptDeviceId = normalizeDeviceId(normalizedReceipt?.device_id);
    const detailDeviceId = receiptDeviceId ?? taskDeviceId;
    const executionStartMs = toMs(normalizedReceipt?.execution_started_at ?? task?.occurred_at ?? receiptFact?.occurred_at);
    const receiptMs = toMs(receiptFact?.occurred_at ?? normalizedReceipt?.execution_finished_at ?? normalizedReceipt?.execution_started_at);
    const operationCreatedMs = toMs(plan?.record_json?.payload?.created_ts ?? plan?.occurred_at ?? rec?.record_json?.payload?.created_ts);
    const afterWindowMinutes = 20;
    const afterWindowEndMs = receiptMs == null ? null : receiptMs + afterWindowMinutes * 60 * 1000;

    let beforeMetrics: OperationMetricsSnapshot = {
      soil_moisture: Number.isFinite(Number(state?.before_metrics?.soil_moisture ?? NaN))
        ? Number(state?.before_metrics?.soil_moisture)
        : undefined,
    };
    let afterMetrics: OperationMetricsSnapshot = {
      soil_moisture: Number.isFinite(Number(state?.after_metrics?.soil_moisture ?? NaN))
        ? Number(state?.after_metrics?.soil_moisture)
        : undefined,
    };
    if (!Number.isFinite(Number(beforeMetrics?.soil_moisture ?? NaN)) && detailDeviceId) {
      const beforeAnchorMs = executionStartMs ?? operationCreatedMs;
      const [beforeFromTelemetry, beforeFromSnapshot] = await Promise.all([
        queryTelemetrySoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, beforeMs: beforeAnchorMs }),
        querySnapshotSoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, beforeMs: beforeAnchorMs }),
      ]);
      if (Number.isFinite(Number(beforeFromTelemetry ?? NaN))) beforeMetrics.soil_moisture = Number(beforeFromTelemetry);
      else if (Number.isFinite(Number(beforeFromSnapshot ?? NaN))) beforeMetrics.soil_moisture = Number(beforeFromSnapshot);
    }
    if (!Number.isFinite(Number(afterMetrics?.soil_moisture ?? NaN)) && detailDeviceId && receiptMs != null) {
      const [afterFromTelemetry, afterFromSnapshot] = await Promise.all([
        queryTelemetrySoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, afterMs: receiptMs }),
        querySnapshotSoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, afterMs: receiptMs }),
      ]);
      if (Number.isFinite(Number(afterFromTelemetry ?? NaN))) afterMetrics.soil_moisture = Number(afterFromTelemetry);
      else if (Number.isFinite(Number(afterFromSnapshot ?? NaN))) afterMetrics.soil_moisture = Number(afterFromSnapshot);
    }
    if (detailDeviceId && receiptMs != null && afterWindowEndMs != null && !Number.isFinite(Number(afterMetrics?.soil_moisture ?? NaN))) {
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
        [tenant.tenant_id, detailDeviceId, ["soil_moisture"], receiptMs, afterWindowEndMs]
      ).catch(() => ({ rows: [] as any[] }));
      afterMetrics = { ...afterMetrics, ...buildMetricsSnapshot(afterTelemetryQ.rows ?? []) };
    }

    const resolvedActionType = String(task?.record_json?.payload?.action_type ?? state.action_type ?? "").trim().toUpperCase();
    const expectedEffect = toExpectedEffect(recommendationPayloadWithFallback) ?? inferExpectedEffectFromAction(resolvedActionType);
    const actualEffect = computeEffect(beforeMetrics, afterMetrics);
    const effectVerdict = evaluateEffectVerdict({ expectedEffect, actualEffect });
    const cropCode = toText(recommendationPayload?.crop_code ?? operationPayload?.crop_code ?? state.crop_code) ?? "unknown";
    const cropStage = resolveCropStageByPriority({
      cropCode,
      explicitStages: [
        toText(recommendationPayload?.crop_stage),
        toText(operationPayload?.crop_stage),
        toText(state.crop_stage)
      ],
      startDate: Number(recommendationPayload?.created_ts ?? operationPayload?.created_ts ?? state.last_event_ts ?? Date.now()),
      now: Date.now(),
    }) ?? "unknown";
    const ruleId = toText(
      recommendationPayload?.rule_id
      ?? operationPayload?.rule_id
      ?? recommendationPayloadWithFallback?.suggested_action?.parameters?.rule_id
      ?? recommendationPayloadWithFallback?.rule_hit?.[0]?.rule_id
      ?? recommendationPayloadWithFallback?.reason_codes?.[0]
      ?? state.rule_id
    ) ?? "unknown_rule";
    const reasonCodes = Array.isArray(recommendationPayloadWithFallback?.reason_codes) ? recommendationPayloadWithFallback.reason_codes : [];
    const timeline = buildEvidenceTimeline(state, approvalDecision, facts);

    return reply.send({
      operation_id: operationPlanId,
      crop: {
        crop_code: cropCode,
        crop_stage: cropStage
      },
      decision: {
        rule_id: ruleId,
        reason_codes: reasonCodes
      },
      before: {
        soil_moisture: Number.isFinite(Number(beforeMetrics?.soil_moisture ?? NaN)) ? Number(beforeMetrics?.soil_moisture) : null
      },
      after: {
        soil_moisture: Number.isFinite(Number(afterMetrics?.soil_moisture ?? NaN)) ? Number(afterMetrics?.soil_moisture) : null
      },
      expected_effect: {
        type: expectedEffect?.type ?? "moisture_increase",
        value: Number.isFinite(Number(expectedEffect?.value ?? NaN)) ? Number(expectedEffect?.value) : null
      },
      actual_effect: {
        value: Number.isFinite(Number(actualEffect?.value ?? NaN)) ? Number(actualEffect?.value) : null
      },
      effect_verdict: effectVerdict,
      timeline
    });
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
    if (rec) {
      await ensureSkillRunFact({
        pool,
        tenant,
        operationPlanId,
        triggerStage: "before_recommendation",
        category: "AGRONOMY",
        bindTarget: "operation_recommendation",
        skillId: toText(rec.record_json?.payload?.skill_id ?? rec.record_json?.payload?.crop_skill_id ?? state.skill_trace?.crop_skill?.skill_id) ?? "crop_skill_v1",
        version: toText(rec.record_json?.payload?.skill_version ?? state.skill_trace?.crop_skill?.version) ?? "v1",
        resultStatus: "SUCCESS",
        fieldId: toText(state.field_id),
        deviceId: toText(state.device_id),
      });
      await ensureSkillRunFact({
        pool,
        tenant,
        operationPlanId,
        triggerStage: "after_recommendation",
        category: "AGRONOMY",
        bindTarget: "operation_approval",
        skillId: toText(rec.record_json?.payload?.agronomy_skill_id ?? rec.record_json?.payload?.rule_id ?? state.skill_trace?.agronomy_skill?.skill_id) ?? "agronomy_skill_v1",
        version: toText(rec.record_json?.payload?.agronomy_skill_version ?? state.skill_trace?.agronomy_skill?.version) ?? "v1",
        resultStatus: "SUCCESS",
        fieldId: toText(state.field_id),
        deviceId: toText(state.device_id),
      });
    }
    if (task) {
      await ensureSkillRunFact({
        pool,
        tenant,
        operationPlanId,
        triggerStage: "before_dispatch",
        category: "DEVICE",
        bindTarget: "operation_dispatch",
        skillId: toText(task.record_json?.payload?.device_skill_id ?? state.skill_trace?.device_skill?.skill_id) ?? "device_dispatch_skill_v1",
        version: toText(task.record_json?.payload?.device_skill_version ?? state.skill_trace?.device_skill?.version) ?? "v1",
        resultStatus: normalizedReceipt && String(normalizedReceipt.receipt_status ?? "").toUpperCase().includes("FAIL") ? "FAILED" : "SUCCESS",
        errorCode: normalizedReceipt && String(normalizedReceipt.receipt_status ?? "").toUpperCase().includes("FAIL") ? "DEVICE_EXEC_FAILED" : null,
        fieldId: toText(state.field_id),
        deviceId: toText(state.device_id),
      });
    }
    if (acceptance || normalizedReceipt) {
      const invalidExecutionFromState = String(state?.final_status ?? "").toUpperCase() === "INVALID_EXECUTION";
      const acceptanceVerdict = String(acceptance?.record_json?.payload?.verdict ?? "").toUpperCase();
      const acceptanceResultStatus =
        invalidExecutionFromState
          ? "FAILED"
          : !acceptanceVerdict || acceptanceVerdict === "PENDING_ACCEPTANCE"
          ? "PENDING"
          : acceptanceVerdict === "PASS"
            ? "SUCCESS"
            : "FAILED";
      const acceptanceErrorCode =
        acceptanceResultStatus === "FAILED"
          ? "ACCEPTANCE_NOT_PASS"
          : null;
      await ensureSkillRunFact({
        pool,
        tenant,
        operationPlanId,
        triggerStage: "before_acceptance",
        category: "ACCEPTANCE",
        bindTarget: "operation_acceptance",
        skillId: toText(acceptance?.record_json?.payload?.acceptance_skill_id ?? state.skill_trace?.acceptance_skill?.skill_id) ?? "acceptance_skill_v1",
        version: toText(acceptance?.record_json?.payload?.acceptance_skill_version ?? state.skill_trace?.acceptance_skill?.version) ?? "v1",
        resultStatus: acceptanceResultStatus,
        errorCode: acceptanceErrorCode,
        fieldId: toText(state.field_id),
        deviceId: toText(state.device_id),
      });
    }
    const skillTraceFacts = await queryFactsForOperation(pool, tenant, operationPlanId);
    const resolvedSkillTrace = buildSkillTraceFromFacts(skillTraceFacts, operationPlanId);
    const resolvedLegacySkillTrace = buildLegacySkillTraceFromFacts(skillTraceFacts, operationPlanId, state.skill_trace);
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
    const recommendationPayloadWithFallback = {
      ...recommendationPayload,
      crop_code: recommendationPayload?.crop_code ?? operationPayload?.crop_code ?? state.crop_code ?? null,
      crop_stage: recommendationPayload?.crop_stage ?? operationPayload?.crop_stage ?? state.crop_stage ?? null,
      rule_id: recommendationPayload?.rule_id ?? operationPayload?.rule_id ?? state.rule_id ?? null,
      rule_hit: Array.isArray(recommendationPayload?.rule_hit)
        ? recommendationPayload.rule_hit
        : (Array.isArray(operationPayload?.rule_hit) ? operationPayload.rule_hit : (Array.isArray(state.rule_hit) ? state.rule_hit : [])),
      reason_codes: Array.isArray(recommendationPayload?.reason_codes)
        ? recommendationPayload.reason_codes
        : (Array.isArray(operationPayload?.reason_codes) ? operationPayload.reason_codes : (Array.isArray(state.reason_codes) ? state.reason_codes : [])),
      expected_effect: recommendationPayload?.expected_effect ?? operationPayload?.expected_effect ?? state.expected_effect ?? null,
      risk_if_not_execute: recommendationPayload?.risk_if_not_execute ?? operationPayload?.risk_if_not_execute ?? state.risk_if_not_execute ?? null,
    };
    const taskDeviceId = normalizeDeviceId(task?.record_json?.payload?.meta?.device_id ?? state.device_id ?? recommendationPayload?.device_id ?? operationPayload?.device_id);
    const recommendedDeviceId = taskDeviceId;
    const receiptDeviceId = normalizeDeviceId(normalizedReceipt?.device_id);
    const executorDeviceId = receiptDeviceId ?? taskDeviceId ?? "unknown";
    const detailDeviceId = executorDeviceId === "unknown" ? null : executorDeviceId;
    const executionStartMs = toMs(normalizedReceipt?.execution_started_at ?? task?.occurred_at ?? receiptFact?.occurred_at);
    const receiptMs = toMs(receiptFact?.occurred_at ?? normalizedReceipt?.execution_finished_at ?? normalizedReceipt?.execution_started_at);
    const operationCreatedMs = toMs(plan?.record_json?.payload?.created_ts ?? plan?.occurred_at ?? rec?.record_json?.payload?.created_ts);
    const afterWindowMinutes = 20;
    const afterWindowEndMs = receiptMs == null ? null : receiptMs + afterWindowMinutes * 60 * 1000;

    let beforeMetrics: OperationMetricsSnapshot = {
      soil_moisture: Number.isFinite(Number(state?.before_metrics?.soil_moisture ?? NaN))
        ? Number(state?.before_metrics?.soil_moisture)
        : undefined,
    };
    let afterMetrics: OperationMetricsSnapshot = {
      soil_moisture: Number.isFinite(Number(state?.after_metrics?.soil_moisture ?? NaN))
        ? Number(state?.after_metrics?.soil_moisture)
        : undefined,
    };
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
        [tenant.tenant_id, detailDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temperature", "soil_temp", "soil_temp_c"], executionStartMs]
      ).catch(() => ({ rows: [] as any[] }));
      beforeMetrics = { ...beforeMetrics, ...buildMetricsSnapshot(beforeTelemetryQ.rows ?? []) };
    }
    if (!Number.isFinite(Number(beforeMetrics?.soil_moisture ?? NaN)) && detailDeviceId) {
      const beforeAnchorMs = executionStartMs ?? operationCreatedMs;
      const [beforeFromTelemetry, beforeFromSnapshot] = await Promise.all([
        queryTelemetrySoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, beforeMs: beforeAnchorMs }),
        querySnapshotSoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, beforeMs: beforeAnchorMs }),
      ]);
      if (Number.isFinite(Number(beforeFromTelemetry ?? NaN))) beforeMetrics.soil_moisture = Number(beforeFromTelemetry);
      else if (Number.isFinite(Number(beforeFromSnapshot ?? NaN))) beforeMetrics.soil_moisture = Number(beforeFromSnapshot);
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
        [tenant.tenant_id, detailDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temperature", "soil_temp", "soil_temp_c"], receiptMs, afterWindowEndMs]
      ).catch(() => ({ rows: [] as any[] }));
      afterMetrics = { ...afterMetrics, ...buildMetricsSnapshot(afterTelemetryQ.rows ?? []) };
    }
    if (!Number.isFinite(Number(afterMetrics?.soil_moisture ?? NaN)) && detailDeviceId && receiptMs != null) {
      const [afterFromTelemetry, afterFromSnapshot] = await Promise.all([
        queryTelemetrySoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, afterMs: receiptMs }),
        querySnapshotSoilMoisture({ pool, tenantId: tenant.tenant_id, deviceId: detailDeviceId, afterMs: receiptMs }),
      ]);
      if (Number.isFinite(Number(afterFromTelemetry ?? NaN))) afterMetrics.soil_moisture = Number(afterFromTelemetry);
      else if (Number.isFinite(Number(afterFromSnapshot ?? NaN))) afterMetrics.soil_moisture = Number(afterFromSnapshot);
    }
    const resolvedActionType = String(task?.record_json?.payload?.action_type ?? state.action_type ?? "").trim().toUpperCase();
    const expectedEffect =
      toExpectedEffect(recommendationPayloadWithFallback)
      ?? inferExpectedEffectFromAction(resolvedActionType);
    const actualEffect = computeEffect(beforeMetrics, afterMetrics);
    const effectVerdict = evaluateEffectVerdict({
      expectedEffect,
      actualEffect,
    });
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

    const fallbackReasonText = [
      toText((state as any)?.manual_fallback?.reason),
      toText((state as any)?.manual_fallback?.reason_code),
      toText((state as any)?.manual_fallback?.message),
    ].filter((x) => x && x !== "-").join(" · ");
    const timeline: Array<{ id: string; kind: string; label: string; status: string | null; occurred_at: string | null; actor_label: string | null; summary: string }> = (state.timeline ?? []).map((item, idx) => {
      const kind = String(item.type ?? "UNKNOWN");
      const summary = (kind === "MANUAL_FALLBACK" || kind === "DEVICE_FAILED_TO_HUMAN") && fallbackReasonText
        ? `为何转人工：${fallbackReasonText}`
        : (item.label || "");
      return {
        id: `${item.type}_${item.ts}_${idx}`,
        kind,
        label: item.label || statusLabel(item.type),
        status: state.final_status,
        occurred_at: item.ts ? new Date(item.ts).toISOString() : null,
        actor_label: null,
        summary
      };
    });
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
      : (toText((state as any)?.invalid_reason) as "evidence_missing" | "evidence_invalid" | null) ?? null;
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
      rec?.record_json?.payload?.crop_code
      ?? plan?.record_json?.payload?.crop_code
      ?? recommendationPayloadWithFallback?.suggested_action?.parameters?.crop_code
      ?? state.crop_code
    );
    const agronomyCropStageRaw = agronomyCropCode
      ? resolveCropStageByPriority({
          cropCode: agronomyCropCode,
          explicitStages: [
            toText(rec?.record_json?.payload?.crop_stage),
            toText(plan?.record_json?.payload?.crop_stage),
            toText(recommendationPayloadWithFallback?.suggested_action?.parameters?.crop_stage),
            toText(state.crop_stage),
          ],
          startDate: Number(
            rec?.record_json?.payload?.created_ts
            ?? plan?.record_json?.payload?.created_ts
            ?? state.last_event_ts
            ?? Date.now(),
          ),
          now: Date.now(),
        })
      : null;
    const agronomyCropStage = agronomyCropStageRaw || (() => {
      if (!agronomyCropCode) return null;
      return "unknown";
    })();
    const agronomyRuleId = toText(
      rec?.record_json?.payload?.rule_id
      ?? plan?.record_json?.payload?.rule_id
      ?? recommendationPayloadWithFallback?.suggested_action?.parameters?.rule_id
      ?? recommendationPayloadWithFallback?.rule_hit?.[0]?.rule_id
      ?? recommendationPayloadWithFallback?.reason_codes?.[0]
      ?? state.rule_id
    );
    const agronomyRuleVersion = parseRuleVersion({
      explicitVersion:
        rec?.record_json?.payload?.rule_version
        ?? plan?.record_json?.payload?.rule_version
        ?? recommendationPayloadWithFallback?.suggested_action?.parameters?.rule_version
        ?? (state as Record<string, unknown>)?.rule_version,
      compositeRuleId: agronomyRuleId,
    });
    const agronomyReasonCodes = Array.isArray(recommendationPayloadWithFallback?.reason_codes)
      ? recommendationPayloadWithFallback.reason_codes
      : [];
    const agronomyRiskIfNotExecute = toText(
      recommendationPayloadWithFallback?.risk_if_not_execute
      ?? recommendationPayloadWithFallback?.suggested_action?.parameters?.risk_if_not_execute
    );
    const acceptanceForResponse = invalidExecution
      ? buildInvalidAcceptanceFact({
        acceptance,
        invalidReason,
        fallbackOccurredAt: receiptFact?.occurred_at ?? null,
      })
      : acceptance;
    const finalStatusCode = String(finalStatus ?? "").trim().toUpperCase();
    const explainHuman = buildExplainHuman({
      cropStage: agronomyCropStage,
      reasonCodes: agronomyReasonCodes,
      expectedEffect,
    });
    const valueProfile = toValueProfile({
      effectVerdict: effectVerdict as EffectVerdict,
      actualEffect,
      costTotal: costBreakdown.total_cost,
    });
    const valueAttributionV1 = {
      operation_plan_id: operationPlanId,
      expected_effect: expectedEffect,
      actual_effect: actualEffect,
      outcome: {
        effect_verdict: effectVerdict,
        final_status: finalStatusCode,
      },
      attribution_basis: buildAttributionBasis({
        expectedEffect,
        actualEffect,
        beforeMetrics: beforeMetricsForResponse,
        afterMetrics: afterMetricsForResponse,
      }),
    };
    const executionInclusion: "INCLUDED" | "EXCLUDED_NO_TASK" | "EXCLUDED_INVALID" = !task
      ? "EXCLUDED_NO_TASK"
      : invalidExecution
        ? "EXCLUDED_INVALID"
        : "INCLUDED";
    const acceptanceInclusion: "INCLUDED" | "EXCLUDED_NO_RECEIPT" = normalizedReceipt ? "INCLUDED" : "EXCLUDED_NO_RECEIPT";
    const responseTimeMs = executionStartMs != null && receiptMs != null && receiptMs >= executionStartMs
      ? receiptMs - executionStartMs
      : null;
    const acceptanceVerdict = String(acceptanceForResponse?.record_json?.payload?.verdict ?? "").trim().toUpperCase();
    const executionSuccess = executionInclusion === "INCLUDED"
      ? ["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED"].includes(finalStatusCode)
      : null;
    const acceptancePass = acceptanceInclusion === "INCLUDED"
      ? (acceptanceVerdict ? acceptanceVerdict === "PASS" : null)
      : null;
    const riskTrend = computeTrendFromSeries([
      Number(beforeMetricsForResponse?.soil_moisture ?? NaN),
      Number(afterMetricsForResponse?.soil_moisture ?? NaN),
    ]);
    const effectTrend = computeTrendFromSeries([
      Number(expectedEffect?.value ?? NaN),
      Number(actualEffect?.value ?? NaN),
    ]);
    const priority = calcPriority({
      finalStatusCode,
      valueProfile,
      hasTask: Boolean(task),
      hasReceipt: Boolean(normalizedReceipt),
      hasAcceptance: Boolean(acceptanceForResponse),
      invalidExecution,
    });
    const recommendedNextAction = resolveRecommendedNextAction({
      operationPlanId,
      finalStatusCode,
      invalidExecution,
      hasTask: Boolean(task),
      hasReceipt: Boolean(normalizedReceipt),
      hasAcceptance: Boolean(acceptanceForResponse),
      actionType: resolvedActionType || null,
      hasRule: Boolean(agronomyRuleId && agronomyRuleId !== "unknown_rule"),
    });
    const approvalDecisionCode = String(approvalDecision?.record_json?.payload?.decision ?? "").trim().toUpperCase();
    const approvalGranted = approvalDecisionCode === "APPROVE" || approvalDecisionCode === "APPROVED";
    const executionPlan = buildExecutionPlan({
      operationPlanId,
      actionType: recommendedNextAction.action_type,
      fieldId: toText(state.field_id ?? operationPayload?.field_id),
      deviceId: detailDeviceId,
      expectedEffect,
      requiresApproval: !approvalGranted && !Boolean(approvalReq),
      dispatchedAtMs: toMs(task?.occurred_at),
    });
    const capabilityCheck = evaluateDeviceCapabilityCheck({
      actionType: executionPlan.action_type,
      executionMode: executionPlan.execution_mode,
      targetRef: executionPlan.target.ref,
    });
    const retryStatsQ = await pool.query(
      `SELECT COUNT(*)::int AS cnt
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'action_execution_request_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (record_json::jsonb#>>'{payload,idempotency_key}') = $4`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, executionPlan.idempotency_key]
    ).catch(() => ({ rows: [{ cnt: 0 }] }));
    const retryCount = Number(retryStatsQ.rows?.[0]?.cnt ?? 0);
    if (executionPlan.failure_strategy.retryable && retryCount >= executionPlan.failure_strategy.max_retries) {
      executionPlan.failure_strategy.retryable = false;
      executionPlan.failure_strategy.fallback_action = executionPlan.failure_strategy.fallback_action ?? "CHECK_FIELD_STATUS";
    }
    const readiness = evaluateExecutionReadiness({
      plan: executionPlan,
      approvalGranted,
      capability: capabilityCheck,
    });
    const trendAdjustmentPolicy = {
      window: "7d" as const,
      baseline: "previous_7d" as const,
      min_samples: 2,
      hysteresis: 1,
    };
    const trendSamples = [riskTrend, effectTrend].filter((x) => x !== "NO_DATA").length;
    const priorityAdjustmentByTrend = trendSamples < trendAdjustmentPolicy.min_samples
      ? 0
      : (riskTrend === "UP" ? 2 : riskTrend === "DOWN" ? -1 : 0) + (effectTrend === "DOWN" ? 1 : effectTrend === "UP" ? -1 : 0);
    const fieldRiskAdjustment = customerView.risk_level === "high" ? 3 : customerView.risk_level === "medium" ? 1 : 0;
    const globalPriorityComponents = {
      base: priority.priority_score,
      trend_adjustment: priorityAdjustmentByTrend,
      field_risk_adjustment: fieldRiskAdjustment,
    };
    const globalPriorityScore = globalPriorityComponents.base + globalPriorityComponents.trend_adjustment + globalPriorityComponents.field_risk_adjustment;
    const evidenceRefs = collectValidEvidenceRefs({
      artifacts,
      logs,
    });
    const traceStatus: "PENDING" | "SUCCESS" | "FAILED" = executionReadyFromState(finalStatusCode, Boolean(normalizedReceipt), evidenceRefs.length > 0);
    const executionTrace = {
      execution_id: executionPlan.idempotency_key,
      task_id: toText(state.act_task_id ?? state.task_id) ?? "",
      receipt_id: toText(state.receipt_id ?? normalizedReceipt?.receipt_fact_id) ?? undefined,
      evidence_refs: evidenceRefs.length > 0 ? evidenceRefs : undefined,
      status: traceStatus,
    };
    const reportJson = invalidExecution
      ? {
        ...buildInvalidExecutionReport({
          ...state,
          failure_reason: invalidReason,
          invalid_reason: invalidReason,
        }),
        evidence_refs: evidenceRefs,
      }
      : {
        type: "operation_report_v1",
        summary: cleanJsonText("operation execution report", "operation execution report"),
        evidence_refs: evidenceRefs,
      };
    const attemptFacts = [...facts].filter((x) => {
      const t = String(x.record_json?.type ?? "");
      return t === "action_execution_attempt_v1" || t === "action_execution_request_v1";
    });
    const attemptHistory = attemptFacts
      .map((x) => {
        const payload = x.record_json?.payload ?? {};
        const attempt = payload?.attempt ?? {};
        const attemptNo = Number(attempt?.attempt_no ?? NaN);
        const timestamp = Number(attempt?.timestamp ?? toMs(x.occurred_at) ?? 0);
        return {
          attempt_no: Number.isFinite(attemptNo) ? attemptNo : 1,
          execution_key: toText(attempt?.execution_key ?? payload?.execution_key ?? payload?.execution_context?.execution_key) ?? executionPlan.idempotency_key,
          retry_of: toText(attempt?.retry_of) ?? undefined,
          timestamp: Number.isFinite(timestamp) ? timestamp : 0,
          result: ["SUCCESS", "FAILED", "PENDING"].includes(String(attempt?.result ?? "").toUpperCase())
            ? String(attempt?.result ?? "").toUpperCase()
            : "PENDING",
        };
      })
      .sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))
      .slice(0, 5);
    const latestAttemptPayload = [...attemptFacts]
      .reverse()
      .map((x) => x.record_json?.payload ?? {})
      .find((x) => x?.fallback_state || x?.execution_context) ?? {};
    const fallbackState = latestAttemptPayload?.fallback_state ?? {
      generated: false,
      executable: false,
    };
    const traceGap = {
      missing_receipt: Boolean(task) && !Boolean(normalizedReceipt),
      missing_evidence: Boolean(normalizedReceipt) && evidenceRefs.length < 1,
    };
    const shouldRecordPerformance = Boolean(normalizedReceipt) || ["SUCCESS", "SUCCEEDED", "DONE", "EXECUTED", "FAILED", "ERROR", "INVALID_EXECUTION", "PENDING_ACCEPTANCE"].includes(finalStatusCode);
    const performanceCropCode =
      agronomyCropCode
      ?? toText(recommendationPayloadWithFallback?.crop_code)
      ?? toText(recommendationPayloadWithFallback?.suggested_action?.parameters?.crop_code)
      ?? toText(plan?.record_json?.payload?.crop_code)
      ?? toText(state.crop_code)
      ?? null;
    if (shouldRecordPerformance && agronomyRuleId && performanceCropCode && effectVerdict) {
      await updateRulePerformance({
        pool,
        tenant,
        operationPlanId,
        recommendationId: toText(state.recommendation_id),
        cropCode: performanceCropCode,
        cropStage: agronomyCropStage ?? "unknown",
        ruleId: agronomyRuleId,
        effectVerdict: effectVerdict as EffectVerdict,
      });
    }

    const stableSource = toText((state as any)?.source)
      ?? toText(operationPayload?.source)
      ?? toText((plan as any)?.record_json?.payload?.source)
      ?? toText((rec as any)?.record_json?.payload?.source)
      ?? toText(recommendedNextAction?.source)
      ?? "UNKNOWN";
    const stableSkillTrace = resolvedSkillTrace ?? {
      crop_skill: null,
      agronomy_skill: null,
      device_skill: null,
      acceptance_skill: null,
    };
    const stableLegacySkillTrace = resolvedLegacySkillTrace ?? {};
    const stableFinalStatus = finalStatus ?? "PENDING";
    const stableExplainSystem = {
      rule_id: agronomyRuleId ?? null,
      rule_version: agronomyRuleVersion ?? null,
      crop_stage: agronomyCropStage ?? null,
      reason_codes: Array.isArray(agronomyReasonCodes) ? agronomyReasonCodes : [],
    };
    const stableExplainHuman = explainHuman ?? {
      reason: "暂无解释",
      expectation: "暂无解释",
      risk: "暂无解释",
    };

    return reply.send({
      ok: true,
      source: stableSource,
      skill_trace: stableSkillTrace,
      // Deprecated: keep for compatibility with older frontend versions.
      legacy_skill_trace: stableLegacySkillTrace,
      final_status: stableFinalStatus,
      operation: {
        operation_plan_id: operationPlanId,
        recommendation_id: toText(state.recommendation_id),
        crop_code: agronomyCropCode,
        crop_stage: agronomyCropStage,
        approval_id: toText(state.approval_id ?? state.approval_decision_id ?? state.approval_request_id),
        act_task_id: toText(state.act_task_id ?? state.task_id),
        receipt_id: toText(state.receipt_id ?? normalizedReceipt?.receipt_fact_id),
        source: stableSource,
        skill_trace: stableSkillTrace,
        // Deprecated: keep for compatibility with older frontend versions.
        legacy_skill_trace: stableLegacySkillTrace,
        final_status: stableFinalStatus,
        status_label: statusLabel(stableFinalStatus),
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
          explanation_codes: Array.isArray(acceptanceForResponse.record_json?.payload?.explanation_codes) ? acceptanceForResponse.record_json.payload.explanation_codes : [],
          skill_meta: {
            skill_id: toText(acceptanceForResponse.record_json?.payload?.acceptance_skill_id),
            version: toText(acceptanceForResponse.record_json?.payload?.acceptance_skill_version),
            input_digest: toText(acceptanceForResponse.record_json?.payload?.input_digest),
            output_digest: toText(acceptanceForResponse.record_json?.payload?.output_digest),
          },
          generated_at: toText(acceptanceForResponse.record_json?.payload?.generated_at ?? acceptanceForResponse.record_json?.payload?.evaluated_at ?? acceptanceForResponse.occurred_at)
        } : null,
        manual_fallback: (state as any)?.manual_fallback ?? null,
        timeline,
        evidence_bundle: {
          artifacts,
          logs,
          media,
          metrics
        },
        report_json: reportJson,
        agronomy: {
          crop_code: agronomyCropCode,
          crop_stage: agronomyCropStage,
          rule_id: agronomyRuleId,
          rule_version: agronomyRuleVersion,
          reason_codes: agronomyReasonCodes,
          risk_if_not_execute: agronomyRiskIfNotExecute,
          before_metrics: beforeMetricsForResponse,
          after_metrics: afterMetricsForResponse,
          expected_effect: expectedEffect,
          actual_effect: actualEffect,
          effect_verdict: effectVerdict
        },
        business_effect: businessEffect,
        cost: {
          total: costBreakdown.total_cost,
          water: costBreakdown.water_cost,
          electric: costBreakdown.electric_cost,
          chemical: costBreakdown.chemical_cost
        },
        customer_view: customerView
      },
      explain: {
        system: stableExplainSystem,
        human: stableExplainHuman,
      },
      value_profile: valueProfile,
      value_attribution_v1: valueAttributionV1,
      priority_bucket: priority.priority_bucket,
      priority_score: priority.priority_score,
      priority_components: priority.priority_components,
      risk_trend: riskTrend,
      effect_trend: effectTrend,
      trend_definition: {
        window: "7d",
        baseline: "previous_7d",
      },
      recommended_next_action: recommendedNextAction,
      execution_plan: executionPlan,
      execution_ready: readiness.execution_ready,
      execution_blockers: readiness.execution_blockers,
      device_capability_check: capabilityCheck,
      execution_trace: executionTrace,
      report_json: reportJson,
      attempt_history: attemptHistory,
      trace_gap: traceGap,
      fallback_state: fallbackState,
      priority_adjustment_by_trend: priorityAdjustmentByTrend,
      trend_adjustment_policy: trendAdjustmentPolicy,
      global_priority_score: globalPriorityScore,
      global_priority_components: globalPriorityComponents,
      execution_context: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
      },
      sla_snapshot: {
        execution_success: executionSuccess,
        acceptance_pass: acceptancePass,
        response_time_ms: responseTimeMs,
        sla_inclusion: {
          execution: executionInclusion,
          acceptance: acceptanceInclusion,
        },
      },
      sla_definition: {
        execution_denominator: "已进入执行阶段的 operation（存在 task 且非 invalid execution）",
        acceptance_denominator: "已回执的 operation（存在 receipt）",
        response_time_definition: "从 task.dispatched_at / execution_started_at 到 receipt.execution_finished_at（缺失则用 receipt fact occurred_at）",
      }
    });
  });
}
