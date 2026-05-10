import { apiRequestWithPolicy, withQuery } from "./client";

export type WeatherAvailabilityStatus = "ok" | "unavailable";
export type WeatherUnavailableReason = "location_unavailable" | "provider_error" | "bad_request" | "not_ready" | "unknown";
export type WeatherEventType = "RAIN" | "FORECAST_RAIN" | "UNKNOWN";

export type WeatherEvent = {
  eventType: WeatherEventType;
  startedAt: string | null;
  endedAt: string | null;
  rainfallMm: number | null;
};

export type WeatherResult = {
  status: WeatherAvailabilityStatus;
  unavailableReason: WeatherUnavailableReason | null;
  source: string;
  fieldId: string;
  from: string | null;
  to: string | null;
  rainfallMm: number | null;
  confidence: number | null;
  events: WeatherEvent[];
  explanation: string;
  raw?: unknown;
};

export type FetchWeatherHistoryInput = {
  fieldId: string;
  from: string | Date | number;
  to: string | Date | number;
};

export type FetchWeatherForecastInput = {
  fieldId: string;
};

export type OperationEnvironmentContext = {
  status: WeatherAvailabilityStatus;
  unavailableReason: WeatherUnavailableReason | null;
  operationId: string;
  fieldId: string | null;
  history: WeatherResult | null;
  forecast: WeatherResult | null;
  rainfallMayExplainSoilMoistureChange: boolean | null;
  learningWeatherInterferenceExcluded: boolean | null;
  explanation: string;
};

type AnyRecord = Record<string, any>;

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function parseUnavailableReason(value: unknown): WeatherUnavailableReason | null {
  const raw = text(value, "").toLowerCase();
  if (!raw) return null;
  if (raw.includes("location_unavailable")) return "location_unavailable";
  if (raw.includes("provider_error")) return "provider_error";
  if (raw.includes("bad_request")) return "bad_request";
  if (raw.includes("not_ready") || raw.includes("not ready")) return "not_ready";
  if (raw.includes("unavailable")) return "unknown";
  return null;
}

function toIso(value: string | Date | number, fieldName: "from" | "to"): string {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`天气查询失败：${fieldName} 必须是有效时间。`);
  }
  return date.toISOString();
}

function normalizeNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeEvent(row: unknown): WeatherEvent | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as AnyRecord;
  const eventTypeRaw = text(obj.event_type ?? obj.eventType ?? obj.type, "UNKNOWN").toUpperCase();
  const eventType: WeatherEventType = eventTypeRaw === "RAIN" || eventTypeRaw === "FORECAST_RAIN" ? eventTypeRaw : "UNKNOWN";
  return {
    eventType,
    startedAt: text(obj.started_at ?? obj.startedAt ?? obj.start, "") || null,
    endedAt: text(obj.ended_at ?? obj.endedAt ?? obj.end, "") || null,
    rainfallMm: normalizeNumber(obj.rainfall_mm ?? obj.rainfallMm ?? obj.precipitation_mm ?? obj.precipitationMm),
  };
}

function unavailableExplanation(reason: WeatherUnavailableReason | null): string {
  if (reason === "location_unavailable") return "天气数据暂不可用：地块位置不可用。";
  if (reason === "provider_error") return "天气数据暂不可用：天气服务暂时不可用。";
  if (reason === "bad_request") return "天气数据暂不可用：查询参数不完整或时间范围无效。";
  if (reason === "not_ready") return "天气数据暂不可用：后端环境上下文接口尚未 ready。";
  return "天气数据暂不可用。";
}

function okExplanation(result: { rainfallMm: number | null; events: WeatherEvent[] }): string {
  const rainfall = Number(result.rainfallMm ?? 0);
  if (rainfall > 0) return `查询时间窗内累计降雨 ${rainfall.toFixed(2)} mm，需在作业判断和学习闭环中评估天气干扰。`;
  if (result.events.length > 0) return "查询时间窗内存在降雨事件，但累计降雨量待确认。";
  return "查询时间窗内未发现明显降雨记录。";
}

function normalizeWeatherPayload(payload: unknown, fallback: { fieldId: string; from?: string | null; to?: string | null }): WeatherResult {
  const obj = payload && typeof payload === "object" ? payload as AnyRecord : {};
  const source = text(obj.source, "weather_unknown_v1");
  const explicitStatus = text(obj.status, "").toLowerCase();
  const unavailableReason = parseUnavailableReason(obj.reason ?? obj.unavailable_reason ?? obj.error ?? obj.message ?? source);
  const status: WeatherAvailabilityStatus = explicitStatus === "unavailable" || unavailableReason ? "unavailable" : "ok";
  const events = Array.isArray(obj.events)
    ? obj.events.map(normalizeEvent).filter((item): item is WeatherEvent => Boolean(item))
    : [];
  const result: WeatherResult = {
    status,
    unavailableReason: status === "unavailable" ? unavailableReason ?? "unknown" : null,
    source,
    fieldId: text(obj.field_id ?? obj.fieldId, fallback.fieldId),
    from: text(obj.from, fallback.from ?? "") || null,
    to: text(obj.to, fallback.to ?? "") || null,
    rainfallMm: normalizeNumber(obj.rainfall_mm ?? obj.rainfallMm ?? obj.precipitation_mm ?? obj.precipitationMm),
    confidence: normalizeNumber(obj.confidence),
    events,
    explanation: "",
    raw: payload,
  };
  result.explanation = result.status === "unavailable" ? unavailableExplanation(result.unavailableReason) : okExplanation(result);
  return result;
}

function normalizeErrorWeather(status: number, bodyText: string, fallback: { fieldId: string; from?: string | null; to?: string | null }): WeatherResult {
  let parsed: AnyRecord | null = null;
  try {
    const value = JSON.parse(bodyText);
    parsed = value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
  } catch {
    parsed = null;
  }
  const reason = status === 400 ? "bad_request" : parseUnavailableReason(parsed?.error ?? parsed?.message ?? bodyText) ?? "unknown";
  return {
    status: "unavailable",
    unavailableReason: reason,
    source: `weather_unavailable_v1:${reason}`,
    fieldId: fallback.fieldId,
    from: fallback.from ?? null,
    to: fallback.to ?? null,
    rainfallMm: null,
    confidence: null,
    events: [],
    explanation: unavailableExplanation(reason),
    raw: parsed ?? bodyText,
  };
}

export async function fetchWeatherHistory(input: FetchWeatherHistoryInput): Promise<WeatherResult> {
  const fieldId = text(input.fieldId, "");
  if (!fieldId) {
    return normalizeErrorWeather(400, JSON.stringify({ error: "BAD_REQUEST", message: "fieldId is required" }), { fieldId: "" });
  }
  const from = toIso(input.from, "from");
  const to = toIso(input.to, "to");
  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/weather/history", { field_id: fieldId, from, to }),
    undefined,
    { allowedStatuses: [400, 404, 422, 500, 503], silent: true, timeoutMs: 10000 },
  );
  if (!result.ok) return normalizeErrorWeather(result.status, result.bodyText, { fieldId, from, to });
  return normalizeWeatherPayload(result.data, { fieldId, from, to });
}

export async function fetchWeatherForecast(input: FetchWeatherForecastInput): Promise<WeatherResult> {
  const fieldId = text(input.fieldId, "");
  if (!fieldId) {
    return normalizeErrorWeather(400, JSON.stringify({ error: "BAD_REQUEST", message: "fieldId is required" }), { fieldId: "" });
  }
  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/weather/forecast", { field_id: fieldId }),
    undefined,
    { allowedStatuses: [400, 404, 422, 500, 503], silent: true, timeoutMs: 10000 },
  );
  if (!result.ok) return normalizeErrorWeather(result.status, result.bodyText, { fieldId });
  return normalizeWeatherPayload(result.data, { fieldId });
}

export async function fetchOperationEnvironmentContext(input: { operationId: string }): Promise<OperationEnvironmentContext> {
  const operationId = text(input.operationId, "");
  if (!operationId) {
    return {
      status: "unavailable",
      unavailableReason: "bad_request",
      operationId: "",
      fieldId: null,
      history: null,
      forecast: null,
      rainfallMayExplainSoilMoistureChange: null,
      learningWeatherInterferenceExcluded: null,
      explanation: "天气环境上下文暂不可用：operationId 不能为空。",
    };
  }

  const result = await apiRequestWithPolicy<unknown>(
    withQuery("/api/v1/weather/operation-environment-context", { operation_id: operationId }),
    undefined,
    { allowedStatuses: [400, 404, 405, 422, 501, 503], silent: true, timeoutMs: 10000 },
  );

  if (!result.ok) {
    return {
      status: "unavailable",
      unavailableReason: result.status === 400 ? "bad_request" : "not_ready",
      operationId,
      fieldId: null,
      history: null,
      forecast: null,
      rainfallMayExplainSoilMoistureChange: null,
      learningWeatherInterferenceExcluded: null,
      explanation: result.status === 400
        ? "天气环境上下文暂不可用：operation_id 参数无效。"
        : "天气环境上下文接口尚未 ready；页面应显示空态，不作为错误处理。",
    };
  }

  const payload = result.data && typeof result.data === "object" ? result.data as AnyRecord : {};
  const fieldId = text(payload.field_id ?? payload.fieldId, "") || null;
  const statusRaw = text(payload.status, "").toLowerCase();
  const unavailableReason = parseUnavailableReason(payload.reason ?? payload.unavailable_reason ?? payload.source);
  const status: WeatherAvailabilityStatus = statusRaw === "unavailable" || unavailableReason ? "unavailable" : "ok";
  return {
    status,
    unavailableReason: status === "unavailable" ? unavailableReason ?? "unknown" : null,
    operationId,
    fieldId,
    history: payload.history ? normalizeWeatherPayload(payload.history, { fieldId: fieldId ?? "" }) : null,
    forecast: payload.forecast ? normalizeWeatherPayload(payload.forecast, { fieldId: fieldId ?? "" }) : null,
    rainfallMayExplainSoilMoistureChange: typeof payload.rainfall_may_explain_soil_moisture_change === "boolean" ? payload.rainfall_may_explain_soil_moisture_change : null,
    learningWeatherInterferenceExcluded: typeof payload.learning_weather_interference_excluded === "boolean" ? payload.learning_weather_interference_excluded : null,
    explanation: text(payload.explanation, status === "unavailable" ? unavailableExplanation(unavailableReason ?? "unknown") : "天气环境上下文已接入。"),
  };
}
