export type TelemetryMetricNameV1 =
  | "air_temperature"
  | "air_humidity"
  | "soil_moisture"
  | "light_lux"
  | "soil_ec"
  | "soil_ph"
  | "soil_temperature"
  | "canopy_temperature"
  | "soil_salinity_index"
  | "water_flow_rate"
  | "water_pressure";

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
    aliases: ["mS/cm", "ds/m"],
    min: 0,
    max: 20,
    description: "Soil electrical conductivity (salinity proxy) in dS/m",
  },
  soil_ph: {
    unit: "pH",
    aliases: ["ph", "PH"],
    min: 0,
    max: 14,
    description: "Soil acidity/alkalinity index",
  },
  soil_temperature: {
    unit: "°C",
    aliases: ["C", "celsius", "℃"],
    min: -40,
    max: 85,
    description: "Soil temperature in degrees Celsius",
  },
  canopy_temperature: {
    unit: "°C",
    aliases: ["C", "celsius", "℃"],
    min: -40,
    max: 85,
    description: "Canopy temperature in degrees Celsius",
  },
  soil_salinity_index: {
    unit: "index",
    aliases: ["ssi", "salinity_index"],
    min: 0,
    max: 100,
    description: "Normalized soil salinity index",
  },
  water_flow_rate: {
    unit: "L/min",
    aliases: ["l/min", "lpm", "LPM"],
    min: 0,
    max: 10000,
    description: "Water flow rate in liters per minute",
  },
  water_pressure: {
    unit: "kPa",
    aliases: ["kpa", "KPA", "kilopascal"],
    min: 0,
    max: 1600,
    description: "Water pressure in kilopascal",
  },
};

// Backward compatibility map: ingest accepts legacy metric keys, storage should persist canonical keys.
export const TELEMETRY_METRIC_COMPAT_ALIASES_V1: Readonly<Record<string, TelemetryMetricNameV1>> = Object.freeze({
  soil_temp: "soil_temperature",
  soil_temp_c: "soil_temperature",
  soil_ec_bulk: "soil_ec",
  soil_ec_ds_m: "soil_ec",
  air_temp: "air_temperature",
  humidity: "air_humidity",
  canopy_temp: "canopy_temperature",
  canopy_temp_c: "canopy_temperature",
  salinity_index: "soil_salinity_index",
  soil_salinity: "soil_salinity_index",
  flow_rate: "water_flow_rate",
  water_flow: "water_flow_rate",
  pressure: "water_pressure",
  pressure_kpa: "water_pressure",
  water_pressure_kpa: "water_pressure",
});

export function toCanonicalTelemetryMetricNameV1(metric: string): string {
  const normalized = metric.trim().toLowerCase().replace(/\s+/g, "_");
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
