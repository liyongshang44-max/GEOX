export type TelemetryMetricNameV1 =
  | "air_temperature"
  | "air_humidity"
  | "soil_moisture"
  | "light_lux"
  | "soil_ec"
  | "soil_ph"
  | "soil_temperature";

export type TelemetryMetricSpecV1 = {
  /** Canonical metric unit used across ingest, storage and downstream fusion. */
  unit: string;
  /** Additional accepted unit aliases that are semantically equivalent. */
  aliases?: string[];
  /** Inclusive lower bound for valid numeric sensor values. */
  min: number;
  /** Inclusive upper bound for valid numeric sensor values. */
  max: number;
  /** Human-readable metric description. */
  description: string;
};

export const TELEMETRY_METRIC_CATALOG_V1: Record<TelemetryMetricNameV1, TelemetryMetricSpecV1> = {
  air_temperature: {
    unit: "°C",
    aliases: ["C", "celsius"],
    min: -40,
    max: 85,
    description: "Air temperature in degrees Celsius",
  },
  air_humidity: {
    unit: "%RH",
    aliases: ["%", "RH%"],
    min: 0,
    max: 100,
    description: "Relative air humidity percentage",
  },
  soil_moisture: {
    unit: "%VWC",
    aliases: ["%", "VWC%"],
    min: 0,
    max: 100,
    description: "Volumetric soil moisture percentage",
  },
  light_lux: {
    unit: "lux",
    min: 0,
    max: 200000,
    description: "Ambient light intensity in lux",
  },
  soil_ec: {
    unit: "dS/m",
    aliases: ["mS/cm"],
    min: 0,
    max: 20,
    description: "Soil electrical conductivity in dS/m",
  },
  soil_ph: {
    unit: "pH",
    aliases: ["ph"],
    min: 0,
    max: 14,
    description: "Soil acidity/alkalinity pH",
  },
  soil_temperature: {
    unit: "°C",
    aliases: ["C", "celsius"],
    min: -40,
    max: 85,
    description: "Soil temperature in degrees Celsius",
  },
};

export const TELEMETRY_METRIC_COMPAT_ALIASES_V1: Readonly<Record<string, TelemetryMetricNameV1>> = Object.freeze({
  soil_temp: "soil_temperature",
  soil_temp_c: "soil_temperature",
  soil_ec_bulk: "soil_ec",
  soil_ec_ds_m: "soil_ec",
});

export function toCanonicalTelemetryMetricNameV1(metric: string): string {
  const normalized = metric.trim();
  if (!normalized) return normalized;
  if (isTelemetryMetricNameV1(normalized)) return normalized;
  return TELEMETRY_METRIC_COMPAT_ALIASES_V1[normalized] ?? normalized;
}

export function isTelemetryMetricNameV1(v: unknown): v is TelemetryMetricNameV1 {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TELEMETRY_METRIC_CATALOG_V1, v);
}

export function isValidTelemetryUnitV1(metric: TelemetryMetricNameV1, unit: string): boolean {
  const s = TELEMETRY_METRIC_CATALOG_V1[metric];
  const normalized = unit.trim();
  if (!normalized) return false;
  if (normalized === s.unit) return true;
  return Array.isArray(s.aliases) ? s.aliases.includes(normalized) : false;
}
