export type TelemetryMetricNameV1 = "air_temperature" | "air_humidity" | "soil_moisture" | "light_lux";

export type TelemetryMetricSpecV1 = {
  /** Canonical metric unit used across ingest, storage and downstream fusion. */
  unit: string;
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
    min: -40,
    max: 85,
    description: "Air temperature in degrees Celsius",
  },
  air_humidity: {
    unit: "%",
    min: 0,
    max: 100,
    description: "Relative air humidity percentage",
  },
  soil_moisture: {
    unit: "%",
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
};

export function isTelemetryMetricNameV1(v: unknown): v is TelemetryMetricNameV1 {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TELEMETRY_METRIC_CATALOG_V1, v);
}
