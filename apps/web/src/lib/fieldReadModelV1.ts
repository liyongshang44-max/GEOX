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

const SALINITY_RISK_LABELS: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  unknown: "未知",
};

function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  if (Number.isFinite(num) && num > 0) return Math.round(num);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatUpdatedAt(value: unknown): string {
  const ms = toMs(value);
  if (!ms) return "暂无更新时间";
  return new Date(ms).toLocaleString();
}

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

export function toReadableSalinityRisk(risk: string | null | undefined): string {
  const key = String(risk ?? "").trim().toLowerCase();
  if (!key) return "暂无数据";
  return SALINITY_RISK_LABELS[key] ?? key;
}

export function toReadableConfidence(confidence: number | null | undefined): string {
  if (confidence == null || !Number.isFinite(Number(confidence))) return "暂无数据";
  return `${Math.round(Number(confidence) * 100)}%`;
}

export function resolveStateTone(status: string | null | undefined): "normal" | "warning" | "stale" | "empty" {
  const raw = normalizeStatus(status);
  if (!raw || raw === "NO_DATA" || raw === "UNKNOWN") return "empty";
  if (raw === "STALE") return "stale";
  if (["WARNING", "WARN", "RISK", "ALERT", "FAILED", "ERROR"].includes(raw)) return "warning";
  return "normal";
}

export function toneCardClass(tone: "normal" | "warning" | "stale" | "empty" | null | undefined): string {
  if (tone === "stale") return "staleStateCard";
  if (tone === "empty") return "emptyStateCard";
  return "";
}

export function toneHintText(tone: "normal" | "warning" | "stale" | "empty" | null | undefined): string | null {
  if (tone === "stale") return "状态过期，请优先人工复核现场与设备连通性。";
  if (tone === "empty") return "暂无可用数据，请先检查设备回传与读模型刷新。";
  return null;
}

export function resolveFreshnessTone(
  value: string | null | undefined,
): "normal" | "warning" | "stale" | "empty" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "no_data" || raw === "unknown") return "empty";
  if (raw === "stale") return "stale";
  return "normal";
}

export function shouldShowRecommendationBiasWarning(bias: string | null | undefined): boolean {
  return Boolean(String(bias ?? "").trim());
}

function pickFact(readModel: any, key: "field_sensing_overview_v1" | "field_fertility_state_v1"): { payload: any; updatedAtMs: number | null } {
  const direct = readModel?.[key];
  if (direct && typeof direct === "object") {
    return {
      payload: direct,
      updatedAtMs: toMs((direct as any)?.updated_ts_ms ?? (direct as any)?.updated_at ?? (direct as any)?.computed_at_ts_ms),
    };
  }
  const inFacts = Array.isArray(readModel?.facts)
    ? readModel.facts.find((fact: any) => String(fact?.fact_type ?? fact?.type ?? "").toLowerCase() === key)
    : null;
  const payload = inFacts?.payload ?? inFacts ?? null;
  return {
    payload,
    updatedAtMs: toMs(inFacts?.updated_ts_ms ?? inFacts?.updated_at ?? payload?.updated_ts_ms ?? payload?.updated_at ?? payload?.computed_at_ts_ms),
  };
}

export type ParsedFieldReadModelV1 = {
  sensing: {
    status: string | null;
    statusLabel: string;
    explainCodes: string[];
    explainCodeLabels: string[];
    sourceObservationIds: string[];
    sourceDevices: string[];
    sensorQuality: string | null;
    confidence: number | null;
    updatedAtMs: number | null;
    updatedAtLabel: string;
    tone: "normal" | "warning" | "stale" | "empty";
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
    sourceObservationIds: string[];
    sourceDevices: string[];
    fertilityState: string | null;
    fertilityStateLabel: string;
    salinityRisk: string | null;
    salinityRiskLabel: string;
    confidence: number | null;
    confidenceLabel: string;
    recommendationBias: string | null;
    recommendationBiasLabel: string;
    updatedAtMs: number | null;
    updatedAtLabel: string;
    tone: "normal" | "warning" | "stale" | "empty";
  } | null;
};

export function parseFieldReadModelV1(rawRecommendation: any, options?: { enableLegacyFallback?: boolean }): ParsedFieldReadModelV1 {
  const readModel = rawRecommendation?.read_model ?? rawRecommendation?.sensing_summary ?? rawRecommendation?.aggregated_result ?? {};
  const sensingFact = pickFact(readModel, "field_sensing_overview_v1");
  const fertilityFact = pickFact(readModel, "field_fertility_state_v1");
  const legacySensing = readModel?.sensing_overview ?? readModel?.sensing ?? readModel;
  const legacyFertility = readModel?.fertility_state ?? readModel?.fertility ?? readModel;
  const enableLegacyFallback = Boolean(options?.enableLegacyFallback);

  const sensingPayload = sensingFact.payload ?? (enableLegacyFallback ? legacySensing : null) ?? null;
  const fertilityPayload = fertilityFact.payload ?? (enableLegacyFallback ? legacyFertility : null) ?? null;

  return {
    sensing: sensingPayload
      ? (() => {
        const status = toStringOrNull(sensingPayload?.status ?? sensingPayload?.state ?? sensingPayload?.status_code);
        const explainCodes = toStringArray(
          sensingPayload?.explanation_codes_json
          ?? sensingPayload?.explanation_codes
          ?? sensingPayload?.explain_codes
          ?? sensingPayload?.reason_codes
          ?? sensingPayload?.codes
        );
        const sourceObservationIds = toStringArray(
          sensingPayload?.source_observation_ids_json
          ?? sensingPayload?.source_observation_ids
        );
        const sourceDevices = toStringArray(
          sensingPayload?.source_devices_json
          ?? sensingPayload?.source_devices
          ?? sensingPayload?.source_device_ids_json
          ?? sensingPayload?.source_device_ids
          ?? sensingPayload?.device_ids
        );
        const confidence = toNumberOrNull(sensingPayload?.confidence);
        return {
          status,
          statusLabel: toReadableStatusLabel(status),
          explainCodes,
          explainCodeLabels: toReadableExplanationCodes(explainCodes),
          sourceObservationIds,
          sourceDevices,
          sensorQuality: toStringOrNull(
            sensingPayload?.sensor_quality_level
            ?? sensingPayload?.sensor_quality
            ?? sensingPayload?.quality_level
            ?? sensingPayload?.quality
          ),
          confidence,
          updatedAtMs: toMs(sensingPayload?.updated_ts_ms ?? sensingPayload?.updated_at ?? sensingPayload?.computed_at_ts_ms ?? sensingFact.updatedAtMs),
          updatedAtLabel: formatUpdatedAt(sensingPayload?.updated_ts_ms ?? sensingPayload?.updated_at ?? sensingPayload?.computed_at_ts_ms ?? sensingFact.updatedAtMs),
          tone: resolveStateTone(status),
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
          fertilityPayload?.explanation_codes_json
          ?? fertilityPayload?.explanation_codes
          ?? fertilityPayload?.explain_codes
          ?? fertilityPayload?.reason_codes
          ?? fertilityPayload?.codes
          ?? (fertilityPayload?.explanation ? [fertilityPayload.explanation] : [])
        );
        const sourceObservationIds = toStringArray(
          fertilityPayload?.source_observation_ids_json
          ?? fertilityPayload?.source_observation_ids
        );
        const sourceDevices = toStringArray(
          fertilityPayload?.source_devices_json
          ?? fertilityPayload?.source_devices
          ?? fertilityPayload?.source_device_ids_json
          ?? fertilityPayload?.source_device_ids
          ?? fertilityPayload?.device_ids
        );
        const fertilityState = toStringOrNull(
          fertilityPayload?.fertility_state
          ?? fertilityPayload?.fertility_level
          ?? fertilityPayload?.level
        );
        const recommendationBias = toStringOrNull(fertilityPayload?.recommendation_bias ?? readModel?.recommendation_bias);
        const salinityRisk = toStringOrNull(fertilityPayload?.salinity_risk);
        const confidence = toNumberOrNull(
          fertilityPayload?.confidence
          ?? readModel?.confidence
          ?? rawRecommendation?.confidence
        );
        const updatedAtRaw = fertilityPayload?.updated_ts_ms
          ?? fertilityPayload?.updated_at
          ?? fertilityPayload?.computed_at_ts_ms
          ?? fertilityFact.updatedAtMs;
        return {
          status,
          statusLabel: toReadableStatusLabel(status),
          explainCodes,
          explainCodeLabels: toReadableExplanationCodes(explainCodes),
          sourceObservationIds,
          sourceDevices,
          fertilityState,
          fertilityStateLabel: toReadableStatusLabel(fertilityState),
          salinityRisk,
          salinityRiskLabel: toReadableSalinityRisk(salinityRisk),
          confidence,
          confidenceLabel: toReadableConfidence(confidence),
          recommendationBias,
          recommendationBiasLabel: toReadableRecommendationBias(recommendationBias),
          updatedAtMs: toMs(updatedAtRaw),
          updatedAtLabel: formatUpdatedAt(updatedAtRaw),
          tone: resolveStateTone(status),
        };
      })()
      : null,
  };
}
