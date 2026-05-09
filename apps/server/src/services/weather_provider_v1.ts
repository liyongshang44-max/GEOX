export type WeatherEventType = "RAIN" | "FORECAST_RAIN" | "UNKNOWN";

export type WeatherEventV1 = {
  event_type: WeatherEventType;
  started_at: string;
  ended_at: string | null;
  rainfall_mm: number | null;
};

export type WeatherHistoryV1 = {
  source: string;
  field_id: string;
  from: string;
  to: string;
  rainfall_mm: number | null;
  confidence: number | null;
  events: WeatherEventV1[];
};

export type WeatherForecastV1 = WeatherHistoryV1;

export type WeatherProviderHistoryInput = {
  field_id: string;
  from: string;
  to: string;
  location?: WeatherLocationV1 | null;
};

export type WeatherProviderForecastInput = {
  field_id: string;
  location?: WeatherLocationV1 | null;
};

export type WeatherProviderV1 = {
  getHistory(input: WeatherProviderHistoryInput): Promise<WeatherHistoryV1>;
  getForecast(input: WeatherProviderForecastInput): Promise<WeatherForecastV1>;
};

export type WeatherLocationV1 = { latitude: number; longitude: number };

type ProviderConfig = {
  provider: string;
  apiKey: string;
  cacheTtlSeconds: number;
  defaultLocationPolicy: string;
};

type CachedValue = {
  expiresAt: number;
  payload: WeatherHistoryV1;
};

const cache = new Map<string, CachedValue>();

function resolveConfig(): ProviderConfig {
  return {
    provider: (process.env.WEATHER_PROVIDER ?? "open_meteo").trim().toLowerCase(),
    apiKey: (process.env.WEATHER_API_KEY ?? "").trim(),
    cacheTtlSeconds: Math.max(0, Number(process.env.WEATHER_CACHE_TTL_SECONDS ?? 300) || 300),
    defaultLocationPolicy: (process.env.WEATHER_DEFAULT_LOCATION_POLICY ?? "us_midwest").trim().toLowerCase(),
  };
}

function getDefaultLocation(_fieldId: string, policy: string): { latitude: number; longitude: number } {
  if (policy === "us_california") return { latitude: 36.7783, longitude: -119.4179 };
  if (policy === "us_texas") return { latitude: 31.9686, longitude: -99.9018 };
  return { latitude: 41.8781, longitude: -93.0977 };
}

function buildCacheKey(kind: string, fieldId: string, from: string, to: string): string {
  return `${kind}:${fieldId}:${from}:${to}`;
}

function getCached(key: string): WeatherHistoryV1 | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.payload;
}

function setCached(key: string, value: WeatherHistoryV1, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  cache.set(key, { payload: value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function fetchOpenMeteoRainfall(params: {
  field_id: string;
  from: string;
  to: string;
  eventType: WeatherEventType;
  config: ProviderConfig;
  location?: WeatherLocationV1 | null;
}): Promise<WeatherHistoryV1> {
  const location = params.location ?? getDefaultLocation(params.field_id, params.config.defaultLocationPolicy);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("hourly", "precipitation");
  url.searchParams.set("start_date", params.from.slice(0, 10));
  url.searchParams.set("end_date", params.to.slice(0, 10));
  url.searchParams.set("timezone", "UTC");

  const response = await fetch(url, {
    headers: params.config.apiKey ? { Authorization: `Bearer ${params.config.apiKey}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`weather provider request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    hourly?: { time?: string[]; precipitation?: number[] };
  };

  const times = data.hourly?.time ?? [];
  const precipitation = data.hourly?.precipitation ?? [];
  const events: WeatherEventV1[] = [];
  let totalRainfall = 0;

  for (let i = 0; i < Math.min(times.length, precipitation.length); i += 1) {
    const mm = Number(precipitation[i]);
    if (!Number.isFinite(mm) || mm <= 0) continue;
    totalRainfall += mm;
    events.push({
      event_type: params.eventType,
      started_at: new Date(times[i]).toISOString(),
      ended_at: new Date(new Date(times[i]).getTime() + 60 * 60 * 1000).toISOString(),
      rainfall_mm: Number(mm.toFixed(2)),
    });
  }

  return {
    source: "open_meteo_v1",
    field_id: params.field_id,
    from: params.from,
    to: params.to,
    rainfall_mm: Number(totalRainfall.toFixed(2)),
    confidence: events.length > 0 ? 0.8 : 0.6,
    events,
  };
}

function buildStubEnvelope(input: { field_id: string; from: string; to: string; source: string; event_type: WeatherEventType }): WeatherHistoryV1 {
  return {
    source: input.source,
    field_id: input.field_id,
    from: input.from,
    to: input.to,
    rainfall_mm: 0,
    confidence: 0.3,
    events: [
      {
        event_type: input.event_type,
        started_at: input.from,
        ended_at: input.to,
        rainfall_mm: 0,
      },
    ],
  };
}

export function createWeatherProviderV1(): WeatherProviderV1 {
  const config = resolveConfig();

  return {
    async getHistory(input) {
      const key = buildCacheKey("history", input.field_id, input.from, input.to);
      const cached = getCached(key);
      if (cached) return cached;

      const result = config.provider === "open_meteo"
        ? await fetchOpenMeteoRainfall({ ...input, eventType: "RAIN", config })
        : buildStubEnvelope({ ...input, source: "weather_history_stub_v1", event_type: "RAIN" });
      setCached(key, result, config.cacheTtlSeconds);
      return result;
    },
    async getForecast(input) {
      const now = new Date();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const base = { field_id: input.field_id, from: now.toISOString(), to: to.toISOString() };
      const key = buildCacheKey("forecast", base.field_id, base.from, base.to);
      const cached = getCached(key);
      if (cached) return cached;

      const result = config.provider === "open_meteo"
        ? await fetchOpenMeteoRainfall({ ...base, eventType: "FORECAST_RAIN", config })
        : buildStubEnvelope({ ...base, source: "weather_forecast_stub_v1", event_type: "FORECAST_RAIN" });
      setCached(key, result, config.cacheTtlSeconds);
      return result;
    },
  };
}

export function computeGeometryCentroidV1(geometry: unknown): WeatherLocationV1 | null {
  const points: Array<{ lat: number; lon: number }> = [];
  const collect = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") {
      const lon = Number(node[0]);
      const lat = Number(node[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
      return;
    }
    for (const child of node) collect(child);
  };

  const raw = geometry as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  if (String(raw.type ?? "").toUpperCase() === "FEATURE") {
    return computeGeometryCentroidV1(raw.geometry);
  }
  collect(raw.coordinates);
  if (points.length === 0) return null;
  const sums = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
  return { latitude: sums.lat / points.length, longitude: sums.lon / points.length };
}

export function buildUnavailableWeatherV1(input: { field_id: string; from: string; to: string; reason: string }): WeatherHistoryV1 {
  return {
    source: `weather_unavailable_v1:${input.reason}`,
    field_id: input.field_id,
    from: input.from,
    to: input.to,
    rainfall_mm: null,
    confidence: null,
    events: [],
  };
}
