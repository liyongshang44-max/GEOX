function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function toStringOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

const READ_MODEL_STATUS_LABELS: Record<string, string> = {
  NORMAL: "正常",
  OK: "正常",
  HEALTHY: "正常",
  STABLE: "正常",
  WARNING: "待处理",
  WARN: "待处理",
  RISK: "存在风险",
  ALERT: "存在风险",
  FAILED: "存在风险",
  ERROR: "存在风险",
  STALE: "数据过期",
  NO_DATA: "数据不足",
  UNKNOWN: "数据不足",
};

const EXPLANATION_CODE_LABELS: Record<string, string> = {
  SENSOR_OFFLINE: "传感器离线",
  STALE_DATA: "数据过期",
  LOW_CONFIDENCE: "低置信度",
  HIGH_SALINITY: "盐分偏高",
  LOW_MOISTURE: "土壤偏干",
  HIGH_MOISTURE: "土壤偏湿",
  HIGH_TEMPERATURE: "温度偏高",
  LOW_TEMPERATURE: "温度偏低",
  PH_OUT_OF_RANGE: "酸碱度异常",
  NEEDS_INSPECTION: "建议人工巡检",
};

const RECOMMENDATION_BIAS_LABELS: Record<string, string> = {
  irrigate_first: "优先灌溉",
  inspect: "优先巡检",
};

export function toReadableStatusLabel(status: string | null | undefined): string {
  const raw = normalizeStatus(status);
  if (!raw) return "--";
  return READ_MODEL_STATUS_LABELS[raw] ?? status ?? "--";
}

export function toReadableExplanationCodes(codes: string[]): string[] {
  return codes.map((code) => {
    const raw = normalizeStatus(code);
    return EXPLANATION_CODE_LABELS[raw] ?? String(code ?? "").trim();
  }).filter(Boolean);
}

export function toReadableRecommendationBias(bias: string | null | undefined): string {
  const key = String(bias ?? "").trim();
  if (!key) return "无偏置提示";
  return RECOMMENDATION_BIAS_LABELS[key] ?? key;
}

export function shouldShowRecommendationBiasWarning(bias: string | null | undefined): boolean {
  return Boolean(String(bias ?? "").trim());
}

function pickFact(readModel: any, key: "field_sensing_overview_v1" | "field_fertility_state_v1"): any {
  const direct = readModel?.[key];
  if (direct && typeof direct === "object") return direct;
  const inFacts = Array.isArray(readModel?.facts)
    ? readModel.facts.find((fact: any) => String(fact?.fact_type ?? fact?.type ?? "").toLowerCase() === key)
    : null;
  return inFacts?.payload ?? inFacts ?? null;
}

export type ParsedFieldReadModelV1 = {
  sensing: {
    status: string | null;
    statusLabel: string;
    explainCodes: string[];
    explainCodeLabels: string[];
    sensorQuality: string | null;
    soilMoisture: number | null;
    soilTemperature: number | null;
    soilEc: number | null;
    soilPh: number | null;
  } | null;
  fertility: {
    status: string | null;
    statusLabel: string;
    explainCodes: string[];
    explainCodeLabels: string[];
    fertilityState: string | null;
    fertilityStateLabel: string;
    salinityRisk: string | null;
    confidence: number | null;
    recommendationBias: string | null;
    recommendationBiasLabel: string;
  } | null;
};

export function parseFieldReadModelV1(rawRecommendation: any, options?: { enableLegacyFallback?: boolean }): ParsedFieldReadModelV1 {
  const readModel = rawRecommendation?.read_model ?? rawRecommendation?.sensing_summary ?? rawRecommendation?.aggregated_result ?? {};
  const sensingFact = pickFact(readModel, "field_sensing_overview_v1");
  const fertilityFact = pickFact(readModel, "field_fertility_state_v1");
  const legacySensing = readModel?.sensing_overview ?? readModel?.sensing ?? readModel;
  const legacyFertility = readModel?.fertility_state ?? readModel?.fertility ?? readModel;
  const enableLegacyFallback = Boolean(options?.enableLegacyFallback);

  const sensingPayload = sensingFact ?? (enableLegacyFallback ? legacySensing : null) ?? null;
  const fertilityPayload = fertilityFact ?? (enableLegacyFallback ? legacyFertility : null) ?? null;

  return {
    sensing: sensingPayload
      ? (() => {
        const status = toStringOrNull(sensingPayload?.status ?? sensingPayload?.state ?? sensingPayload?.status_code);
        const explainCodes = toStringArray(sensingPayload?.explain_codes ?? sensingPayload?.reason_codes ?? sensingPayload?.codes);
        return {
          status,
          statusLabel: toReadableStatusLabel(status),
          explainCodes,
          explainCodeLabels: toReadableExplanationCodes(explainCodes),
          sensorQuality: toStringOrNull(
            sensingPayload?.sensor_quality_level
            ?? sensingPayload?.sensor_quality
            ?? sensingPayload?.quality_level
            ?? sensingPayload?.quality
          ),
          soilMoisture: toNumberOrNull(sensingPayload?.soil_moisture),
          soilTemperature: toNumberOrNull(sensingPayload?.soil_temperature ?? sensingPayload?.soil_temp),
          soilEc: toNumberOrNull(sensingPayload?.soil_ec),
          soilPh: toNumberOrNull(sensingPayload?.soil_ph),
        };
      })()
      : null,
    fertility: fertilityPayload
      ? (() => {
        const status = toStringOrNull(
          fertilityPayload?.status
          ?? fertilityPayload?.state
          ?? fertilityPayload?.status_code
          ?? fertilityPayload?.level
        );
        const explainCodes = toStringArray(
          fertilityPayload?.explain_codes
          ?? fertilityPayload?.reason_codes
          ?? fertilityPayload?.codes
          ?? (fertilityPayload?.explanation ? [fertilityPayload.explanation] : [])
        );
        const fertilityState = toStringOrNull(
          fertilityPayload?.fertility_state
          ?? fertilityPayload?.fertility_level
          ?? fertilityPayload?.level
        );
        const recommendationBias = toStringOrNull(fertilityPayload?.recommendation_bias ?? readModel?.recommendation_bias);
        return {
          status,
          statusLabel: toReadableStatusLabel(status),
          explainCodes,
          explainCodeLabels: toReadableExplanationCodes(explainCodes),
          fertilityState,
          fertilityStateLabel: toReadableStatusLabel(fertilityState),
          salinityRisk: toStringOrNull(fertilityPayload?.salinity_risk),
          confidence: toNumberOrNull(
            fertilityPayload?.confidence
            ?? readModel?.confidence
            ?? rawRecommendation?.confidence
          ),
          recommendationBias,
          recommendationBiasLabel: toReadableRecommendationBias(recommendationBias),
        };
      })()
      : null,
  };
}
