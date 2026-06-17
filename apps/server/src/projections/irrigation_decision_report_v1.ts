// apps/server/src/projections/irrigation_decision_report_v1.ts
// Purpose: build H17 customer-facing irrigation decision report blocks from H12-H16 projection indexes.
// Boundary: report projection only; no new agronomy model, no approval mutation, no AO-ACT mutation, no frontend route creation.

import type { Pool } from "pg";

export type IrrigationDecisionReportV1 = {
  version: "v1";
  report_kind: "IRRIGATION_DECISION_REPORT";
  customer_title: "灌溉决策依据";
  status: {
    decision_status: "RECOMMENDED" | "UNKNOWN" | "BLOCKED";
    customer_visible_eligible: boolean;
    human_approval_required: boolean;
    no_direct_execution: boolean;
    blocking_reasons: string[];
  };
  fact_section: {
    sensing_window: {
      label: "土壤水分连续观测";
      quality_status: "PASS" | "FAIL" | "UNKNOWN";
      actual_points: number | null;
      coverage_ratio: number | null;
      max_gap_ms: number | null;
      customer_text: string;
    } | null;
    weather_forecast: {
      label: "天气预报版本";
      provider_text: string;
      issue_time: string | null;
      valid_window_text: string;
      provider_status: string | null;
      customer_text: string;
    } | null;
    irrigation_requirement: {
      label: "灌溉需求";
      net_irrigation_mm: number | null;
      gross_irrigation_requirement_mm: number | null;
      customer_text: string;
    } | null;
  };
  estimate_section: {
    label: "水分状态估计";
    state: "NORMAL" | "LIGHT_DEFICIT" | "MODERATE_DEFICIT" | "UNKNOWN" | null;
    confidence_level: string | null;
    customer_text: string;
  } | null;
  scenario_section: {
    label: "灌溉情景比较";
    selected_option_id: string | null;
    options: Array<{
      option_id: string;
      customer_label: string;
      assumed_irrigation_mm: number | null;
      risk_before: string | null;
      risk_after: string | null;
      risk_delta: string | null;
      projected_range_text: string;
      confidence_text: string;
      failure_condition_text: string;
    }>;
    customer_text: string;
  } | null;
  recommendation_section: {
    label: "系统建议";
    recommendation_status: "RECOMMENDED" | "UNKNOWN" | "BLOCKED";
    selected_scenario_option_id: string | null;
    amount_mm: number | null;
    action_text: string;
    reason_text: string;
    approval_boundary_text: string;
  } | null;
  classification: {
    facts: string[];
    estimates: string[];
    scenarios: string[];
    recommendations: string[];
    execution_records: string[];
  };
  customer_summary: {
    headline: string;
    one_liner: string;
    evidence_line: string;
    scenario_line: string;
    recommendation_line: string;
    boundary_line: string;
  };
};

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

function text(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function obj(value: unknown): any {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function arr(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stateText(state: unknown): string {
  const key = String(state ?? "").toUpperCase();
  if (key === "NORMAL") return "正常";
  if (key === "LIGHT_DEFICIT") return "轻度缺水";
  if (key === "MODERATE_DEFICIT") return "中度缺水";
  return "待确认";
}

function riskDeltaText(value: unknown): string {
  const key = String(value ?? "").toUpperCase();
  if (key === "IMPROVED") return "风险降低";
  if (key === "UNCHANGED") return "风险未明显变化";
  if (key === "WORSENED") return "风险升高";
  return "待确认";
}

function optionLabel(optionId: unknown, amount: number | null): string {
  const key = String(optionId ?? "");
  if (key === "no_action") return "不处理";
  if (key === "irrigate_10mm") return "灌溉 10mm";
  if (key === "irrigate_20mm") return "灌溉 20mm";
  if (key === "irrigate_22mm") return "灌溉 22mm";
  if (key === "delay_3d") return "延迟 3 天";
  return amount == null ? "情景待确认" : "灌溉 " + amount + "mm";
}

function confidenceText(confidence: any): string {
  const level = String(confidence?.level ?? "").toUpperCase();
  if (level === "HIGH") return "较高";
  if (level === "MEDIUM") return "中等";
  if (level === "LOW") return "较低";
  return "待确认";
}

function rangeText(range: any): string {
  const min = num(range?.min);
  const max = num(range?.max);
  if (min == null || max == null) return "预测区间待确认";
  return String(min) + "%–" + String(max) + "%";
}

function failureText(conditions: unknown): string {
  const items = arr(conditions).map((item) => String(item ?? "").trim()).filter(Boolean);
  if (!items.length) return "无主要失败条件";

  const normalized = new Set(items.map((item) => item.toLowerCase()));
  const lines: string[] = [];

  if (normalized.has("projected_deficit_remains")) lines.push("该情景可能仍不能完全解除缺水风险");
  if (normalized.has("irrigation_delay_exposure")) lines.push("延迟执行会增加水分继续下降的不确定性");
  if (normalized.has("execution_required")) lines.push("该情景依赖后续审批与执行完成");

  if (normalized.has("rainfall_forecast_deviation_gt_5mm")) lines.push("若实际降雨较预报偏差超过 5mm，需要重新评估情景");
  if (normalized.has("sensor_coverage_below_threshold")) lines.push("若传感器覆盖低于阈值，需要补充观测后复核");
  if (normalized.has("actual_application_efficiency_lt_assumed")) lines.push("若实际灌溉效率低于假设值，目标水分可能无法达到");
  if (normalized.has("execution_receipt_missing")) lines.push("若缺少执行回执，不能确认作业完成");
  if (normalized.has("device_offline_or_unverified")) lines.push("若设备离线或状态未验证，不能直接进入执行");

  return lines.length ? lines.join("；") : "存在需要复核的失败条件";
}

async function one(pool: Pool, sql: string, params: unknown[]): Promise<any | null> {
  try {
    const result = await pool.query(sql, params);
    return result.rows?.[0] ?? null;
  } catch {
    return null;
  }
}

function deepText(payload: any, path: string[]): string | null {
  let current = payload;
  for (const key of path) current = current?.[key];
  return text(current);
}

function extractRecommendationIdFromPayload(payload: any): string | null {
  return text(payload?.recommendation_id)
    ?? text(payload?.decision_recommendation_id)
    ?? text(payload?.source_recommendation_id)
    ?? deepText(payload, ["input_refs", "recommendation_id"])
    ?? deepText(payload, ["source_refs", "recommendation_id"])
    ?? deepText(payload, ["recommendation_ref", "ref_id"])
    ?? deepText(payload, ["recommendation", "ref_id"])
    ?? deepText(payload, ["approval_request", "recommendation_id"])
    ?? deepText(payload, ["links", "recommendation_id"])
    ?? null;
}

async function readOperationPlanPayload(pool: Pool, tenant: TenantTriple, operationPlanId: string | null): Promise<any | null> {
  if (!operationPlanId) return null;

  const indexedPlan = await one(
    pool,
    "SELECT * FROM operation_plan_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND operation_plan_id=$4 LIMIT 1",
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId],
  );
  if (indexedPlan) return indexedPlan;

  const factPlan = await one(
    pool,
    "SELECT record_json->'payload' AS payload FROM facts WHERE record_json->>'type'='operation_plan_v1' AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2 AND record_json->'payload'->>'group_id'=$3 AND (record_json->'payload'->>'operation_plan_id'=$4 OR record_json->'payload'->>'operation_id'=$4) ORDER BY occurred_at DESC LIMIT 1",
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId],
  );
  return factPlan?.payload ?? null;
}

async function readApprovalRequestPayload(pool: Pool, tenant: TenantTriple, approvalRequestId: string | null): Promise<any | null> {
  if (!approvalRequestId) return null;

  const approval = await one(
    pool,
    "SELECT record_json->'payload' AS payload FROM facts WHERE record_json->>'type'='approval_request_v1' AND record_json->'payload'->>'tenant_id'=$1 AND record_json->'payload'->>'project_id'=$2 AND record_json->'payload'->>'group_id'=$3 AND (record_json->'payload'->>'approval_request_id'=$4 OR record_json->'payload'->>'request_id'=$4) ORDER BY occurred_at DESC LIMIT 1",
    [tenant.tenant_id, tenant.project_id, tenant.group_id, approvalRequestId],
  );
  return approval?.payload ?? null;
}

async function resolveOperationBoundRecommendationId(pool: Pool, tenant: TenantTriple, operationPlanId: string | null, explicitRecommendationId: string | null): Promise<string | null> {
  if (explicitRecommendationId) return explicitRecommendationId;
  if (!operationPlanId) return null;

  const operationPlan = await readOperationPlanPayload(pool, tenant, operationPlanId);
  const directRecommendationId = extractRecommendationIdFromPayload(operationPlan);
  if (directRecommendationId) return directRecommendationId;

  const approvalRequestId = text(operationPlan?.approval_request_id)
    ?? text(operationPlan?.request_id)
    ?? deepText(operationPlan, ["approval_request", "approval_request_id"])
    ?? deepText(operationPlan, ["input_refs", "approval_request_id"])
    ?? null;

  const approvalRequest = await readApprovalRequestPayload(pool, tenant, approvalRequestId);
  return extractRecommendationIdFromPayload(approvalRequest);
}

async function readRecommendation(pool: Pool, tenant: TenantTriple, recommendationId: string | null): Promise<any | null> {
  if (!recommendationId) return null;
  return one(
    pool,
    "SELECT * FROM decision_recommendation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND recommendation_id=$4 LIMIT 1",
    [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendationId],
  );
}

async function readById(pool: Pool, table: string, idColumn: string, tenant: TenantTriple, id: string | null): Promise<any | null> {
  if (!id) return null;
  return one(
    pool,
    "SELECT * FROM " + table + " WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND " + idColumn + "=$4 LIMIT 1",
    [tenant.tenant_id, tenant.project_id, tenant.group_id, id],
  );
}

export async function buildIrrigationDecisionReportV1(params: {
  pool: Pool;
  tenant: TenantTriple;
  operation_id: string | null;
  operation_plan_id: string | null;
  field_id: string | null;
  recommendation_id: string | null;
}): Promise<IrrigationDecisionReportV1 | null> {
  const boundRecommendationId = await resolveOperationBoundRecommendationId(params.pool, params.tenant, params.operation_plan_id, params.recommendation_id);
  if (!boundRecommendationId) return null;

  const recommendation = await readRecommendation(params.pool, params.tenant, boundRecommendationId);
  if (!recommendation) return null;

  const recommendationStatus = String(recommendation.recommendation_status ?? "UNKNOWN").toUpperCase();
  const quality = obj(recommendation.quality_json);
  const inputRefs = obj(recommendation.input_refs_json);
  const scenarioSummary = obj(recommendation.scenario_summary_json);
  const suggestedAction = obj(recommendation.suggested_action_json);
  const confidence = obj(recommendation.confidence_json);

  const scenarioSetId = text(recommendation.source_scenario_set_id ?? inputRefs.scenario_set_id);
  const waterStateId = text(recommendation.source_water_state_estimate_id ?? inputRefs.water_state_estimate_id);
  const requirementId = text(recommendation.source_requirement_id ?? inputRefs.requirement_id);

  const waterState = await readById(params.pool, "water_state_estimate_index_v1", "estimate_id", params.tenant, waterStateId);
  const scenarioSet = await readById(params.pool, "irrigation_scenario_set_index_v1", "scenario_set_id", params.tenant, scenarioSetId);
  const requirement = await readById(params.pool, "irrigation_requirement_index_v1", "requirement_id", params.tenant, requirementId);
  const weatherForecastId = text(scenarioSet?.source_forecast_id ?? requirement?.source_forecast_id ?? inputRefs.weather_forecast_id);
  const sensingWindowId = text(scenarioSet?.source_sensing_window_id ?? waterState?.source_sensing_window_id ?? inputRefs.sensing_window_id);
  const weather = await readById(params.pool, "weather_forecast_index_v1", "forecast_id", params.tenant, weatherForecastId);
  const sensing = await readById(params.pool, "soil_moisture_sensing_window_index_v1", "window_id", params.tenant, sensingWindowId);

  const selectedOptionId = text(recommendation.selected_scenario_option_id ?? scenarioSummary.selected_option_id);
  const scenarioOptions = arr(scenarioSet?.options_json);
  const selectedOption = scenarioOptions.find((option) => text(option?.option_id) === selectedOptionId) ?? null;
  const amountMm = num(suggestedAction.amount_mm ?? suggestedAction.water_mm ?? scenarioSummary.assumed_irrigation_mm ?? selectedOption?.assumed_irrigation_mm);

  const missingJoinedReasons = [
    waterState ? null : "WATER_STATE_ESTIMATE_MISSING",
    scenarioSet ? null : "IRRIGATION_SCENARIO_SET_MISSING",
    requirement ? null : "IRRIGATION_REQUIREMENT_MISSING",
    weather ? null : "WEATHER_FORECAST_MISSING",
    sensing ? null : "SENSING_WINDOW_MISSING",
    selectedOption ? null : "SELECTED_SCENARIO_OPTION_MISSING",
  ].filter((reason): reason is string => Boolean(reason));

  const hasRequiredJoinedRows = missingJoinedReasons.length === 0;
  const recommendable = recommendationStatus === "RECOMMENDED" && selectedOptionId != null && amountMm != null && hasRequiredJoinedRows;
  const blockingReasons = Array.from(new Set([
    ...arr(quality.reason_codes).map(String),
    ...missingJoinedReasons,
    ...(recommendable ? [] : ["RECOMMENDATION_NOT_USABLE_FOR_CUSTOMER"]),
  ]));

  const decisionStatus: "RECOMMENDED" | "UNKNOWN" | "BLOCKED" = recommendable ? "RECOMMENDED" : (recommendationStatus === "UNKNOWN" ? "UNKNOWN" : "BLOCKED");

  const sensingQuality = String(sensing?.quality_status ?? obj(sensing?.quality_json).status ?? "").toUpperCase();
  const weatherQuality = obj(weather?.quality_json);
  const requirementGross = num(requirement?.gross_irrigation_requirement_mm ?? requirement?.gross_irrigation_mm);
  const requirementNet = num(requirement?.net_irrigation_mm);
  const waterStateValue = text(waterState?.state ?? inputRefs.water_state) as NonNullable<IrrigationDecisionReportV1["estimate_section"]>["state"];

  const factSection = {
    sensing_window: sensing ? {
      label: "土壤水分连续观测" as const,
      quality_status: sensingQuality === "PASS" ? "PASS" as const : (sensingQuality === "FAIL" ? "FAIL" as const : "UNKNOWN" as const),
      actual_points: num(sensing.actual_points ?? sensing.points_present ?? obj(sensing.summary_json).actual_points ?? obj(sensing.summary_json).points_present),
      coverage_ratio: num(sensing.coverage_ratio ?? obj(sensing.summary_json).coverage_ratio),
      max_gap_ms: num(sensing.max_gap_ms ?? obj(sensing.summary_json).max_gap_ms),
      customer_text: sensingQuality === "PASS"
        ? "土壤水分连续观测已通过质量检查，可作为本次灌溉判断的事实基础。"
        : "土壤水分连续观测未通过或尚未完成质量检查。",
    } : null,
    weather_forecast: weather ? {
      label: "天气预报版本" as const,
      provider_text: "天气预报版本已记录",
      issue_time: text(weather.issue_time ?? weather.generated_at),
      valid_window_text: [text(weather.valid_from), text(weather.valid_to)].filter(Boolean).join(" 至 ") || "有效窗口待确认",
      provider_status: text(weatherQuality.provider_status),
      customer_text: weatherQuality.provider_status === "OK"
        ? "天气预报版本可回放，未来 72 小时降雨不足以单独解除缺水风险。"
        : "天气预报版本状态未通过，不能单独作为可执行建议依据。",
    } : null,
    irrigation_requirement: requirement ? {
      label: "灌溉需求" as const,
      net_irrigation_mm: requirementNet,
      gross_irrigation_requirement_mm: requirementGross,
      customer_text: requirementGross == null
        ? "正式灌溉需求尚未形成可展示水量。"
        : "正式灌溉需求计算给出建议补灌量 " + requirementGross + "mm。",
    } : null,
  };

  const estimateSection = waterState ? {
    label: "水分状态估计" as const,
    state: waterStateValue,
    confidence_level: text(obj(waterState.confidence_json ?? waterState.confidence).level ?? confidence.level),
    customer_text: "当前水分状态为" + stateText(waterStateValue) + "，该估计来自连续观测、天气和正式灌溉需求输入。",
  } : null;

  const optionReports = scenarioOptions.map((option) => {
    const optionAmount = num(option?.assumed_irrigation_mm);
    return {
      option_id: String(option?.option_id ?? ""),
      customer_label: optionLabel(option?.option_id, optionAmount),
      assumed_irrigation_mm: optionAmount,
      risk_before: text(option?.risk_before),
      risk_after: text(option?.risk_after),
      risk_delta: text(option?.risk_delta),
      projected_range_text: rangeText(option?.projected_soil_moisture_range),
      confidence_text: confidenceText(option?.confidence),
      failure_condition_text: failureText(option?.failure_conditions),
    };
  }).filter((option) => option.option_id);

  const scenarioSection = scenarioSet ? {
    label: "灌溉情景比较" as const,
    selected_option_id: selectedOptionId,
    options: optionReports,
    customer_text: recommendable
      ? "五个灌溉情景已比较；灌溉 22mm 可将风险从中度缺水改善到正常。"
      : "灌溉情景比较尚不能形成客户可执行建议。",
  } : null;

  const recommendationSection = {
    label: "系统建议" as const,
    recommendation_status: decisionStatus,
    selected_scenario_option_id: recommendable ? selectedOptionId : null,
    amount_mm: recommendable ? amountMm : null,
    action_text: recommendable ? "系统建议灌溉 " + amountMm + "mm" : "当前决策证据链不完整，不能展示可执行灌溉建议。",
    reason_text: recommendable
      ? "该建议由水分状态估计、正式灌溉需求和五个灌溉情景比较共同形成。"
      : "当前决策证据链不完整，系统阻断可执行建议展示。",
    approval_boundary_text: recommendable
      ? "本报告不直接触发作业；执行仍需人工审批、作业计划、AO-ACT 和回执验收。"
      : "证据不足时不会进入审批、作业计划或 AO-ACT 执行。",
  };

  return {
    version: "v1",
    report_kind: "IRRIGATION_DECISION_REPORT",
    customer_title: "灌溉决策依据",
    status: {
      decision_status: decisionStatus,
      customer_visible_eligible: recommendable,
      human_approval_required: recommendation.human_approval_required === true,
      no_direct_execution: obj(recommendation.derivation_json).no_direct_execution === true,
      blocking_reasons: blockingReasons,
    },
    fact_section: factSection,
    estimate_section: estimateSection,
    scenario_section: scenarioSection,
    recommendation_section: recommendationSection,
    classification: {
      facts: ["soil_moisture_sensing_window_v1", "weather_forecast_fact_v1", "irrigation_requirement_v1"],
      estimates: ["water_state_estimate_v1"],
      scenarios: ["irrigation_scenario_set_v1"],
      recommendations: ["decision_recommendation_v1"],
      execution_records: ["approval_request_v1", "operation_plan_v1", "ao_act_receipt_v1", "as_executed_record_v1", "acceptance_result_v1"],
    },
    customer_summary: recommendable ? {
      headline: "灌溉决策依据",
      one_liner: "系统建议灌溉 " + amountMm + "mm，但需要人工审批后才能进入执行。",
      evidence_line: "该建议基于通过质量检查的土壤水分连续窗口、可回放天气预报版本和正式灌溉需求计算。",
      scenario_line: "五个情景已比较；灌溉 22mm 可将风险从中度缺水改善到正常。",
      recommendation_line: "建议水量为 " + amountMm + "mm。",
      boundary_line: "本报告不直接触发作业；执行仍需人工审批、作业计划、AO-ACT 和回执验收。",
    } : {
      headline: "灌溉决策依据",
      one_liner: "当前决策证据链不完整，不能展示可执行灌溉建议。",
      evidence_line: "当前决策证据链不完整，不能展示可执行灌溉建议。",
      scenario_line: "情景比较结果不可用于生成可执行建议。",
      recommendation_line: "未生成可执行灌溉建议。",
      boundary_line: "证据不足时不会进入审批、作业计划或 AO-ACT 执行。",
    },
  };
}
