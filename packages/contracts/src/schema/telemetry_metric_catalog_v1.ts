export type TelemetryMetricNameV1 = "air_temperature" | "air_humidity" | "soil_moisture" | "light_lux";

export type TelemetryMetricSpecV1 = {
  unit: string;
  min: number;
  max: number;
};

export const TELEMETRY_METRIC_CATALOG_V1: Record<TelemetryMetricNameV1, TelemetryMetricSpecV1> = {
  air_temperature: { unit: "°C", min: -40, max: 85 },
  air_humidity: { unit: "%RH", min: 0, max: 100 },
  soil_moisture: { unit: "%VWC", min: 0, max: 100 },
  light_lux: { unit: "lux", min: 0, max: 200000 },
};

export function isTelemetryMetricNameV1(v: unknown): v is TelemetryMetricNameV1 {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TELEMETRY_METRIC_CATALOG_V1, v);
}
