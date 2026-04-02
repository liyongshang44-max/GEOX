import { buildAgronomyContext } from "./context_builder";
import { evaluateRules, pickBestRule } from "./rule_engine";
import { resolveCropStage } from "./stage_resolver";

type ProgramSource = {
  tenant_id?: unknown;
  project_id?: unknown;
  group_id?: unknown;
  field_id?: unknown;
  season_id?: unknown;
  program_id?: unknown;
  crop_code?: unknown;
  program_start_date?: unknown;
  season_start_date?: unknown;
};

type MetricsSource = {
  soil_moisture?: unknown;
  soil_moisture_pct?: unknown;
  temperature?: unknown;
  air_temperature?: unknown;
  humidity?: unknown;
  air_humidity?: unknown;
};

export type AgronomyRecommendationPayload = {
  crop_code: string;
  crop_stage: string;
  rule_id: string;
  action_type: "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";
  priority: "low" | "medium" | "high";
  reason_codes: string[];
  expected_effect: {
    type: string;
    value: number;
  };
  risk_if_not_execute: string;
  summary: string;
};

function toStringValue(v: unknown): string {
  return String(v ?? "").trim();
}

function pickProgramStartDate(program: ProgramSource): string | number | Date {
  const startDate = program.program_start_date ?? program.season_start_date;
  if (startDate instanceof Date || typeof startDate === "number") return startDate;

  const text = toStringValue(startDate);
  if (text) return text;

  return Date.now();
}

function buildSummary(payload: {
  cropCode: string;
  cropStage: string;
  actionType: string;
}): string {
  const actionMap: Record<string, string> = {
    IRRIGATE: "灌溉处理",
    FERTILIZE: "追肥处理",
    SPRAY: "喷施处理",
    INSPECT: "巡检处理",
  };
  const actionLabel = actionMap[payload.actionType] ?? "农事处理";
  return `根据当前作物阶段（${payload.cropCode} / ${payload.cropStage}）与田间指标，建议进行${actionLabel}。`;
}

export function runAgronomyEngine(input: {
  program: ProgramSource;
  currentMetrics?: MetricsSource | null;
  now?: number;
  constraints?: Record<string, unknown>;
}): AgronomyRecommendationPayload | null {
  const program = input.program ?? {};
  const cropCode = toStringValue(program.crop_code).toLowerCase();

  const cropStage = resolveCropStage({
    cropCode,
    startDate: pickProgramStartDate(program),
    now: input.now,
  });

  const context = buildAgronomyContext({
    program,
    currentMetrics: input.currentMetrics,
    now: input.now,
    cropStage,
    constraints: input.constraints,
  });

  const matchedRules = evaluateRules(context);
  const bestRule = pickBestRule(matchedRules);
  if (!bestRule) return null;

  return {
    crop_code: context.cropCode,
    crop_stage: context.cropStage,
    rule_id: bestRule.ruleId,
    action_type: bestRule.actionType,
    priority: bestRule.priority,
    reason_codes: bestRule.reasonCodes,
    expected_effect: bestRule.expectedEffect,
    risk_if_not_execute: bestRule.riskIfNotExecute,
    summary: buildSummary({
      cropCode: context.cropCode,
      cropStage: context.cropStage,
      actionType: bestRule.actionType,
    }),
  };
}
