import { apiRequest } from "./client";
import type { FlightTableRunV1 } from "./flightTable";

export type FlightTableTelemetryScenarioKeyV1 =
  | "before_irrigation_low_moisture"
  | "during_irrigation_flow"
  | "after_irrigation_success"
  | "rainfall_interference"
  | "sensor_failure";

export type FlightTableTelemetryPointV1 = {
  scenario: FlightTableTelemetryScenarioKeyV1;
  device_id: string;
  metric_key: string;
  value: number | string | boolean | null;
  unit: string | null;
  ts_ms: number;
  field_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  source: "MQTT_COMPATIBLE_INGEST" | "FLIGHT_TABLE_FAST_INGEST" | "FLIGHT_TABLE_FAST_INGEST_RAW_ONLY";
};

export type FlightTableTelemetryVerifyV1 = {
  raw_telemetry_v1: { visible: boolean; count: number };
  telemetry_index_v1: { visible: boolean; count: number; latest_ts_ms: number | null };
  device_status_index_v1: { visible: boolean; last_telemetry_ts_ms: number | null; online_status: "ONLINE" | "OFFLINE" | "UNKNOWN" };
  device_observation_v1: { visible: boolean; count: number };
  device_observation_index_v1: { visible: boolean; count: number; latest_observed_at_ts_ms: number | null };
  derived_sensing_state_v1: { visible: boolean; count: number };
  derived_sensing_state_index_v1: { visible: boolean; count: number };
  field_sensing_overview_v1: {
    visible: boolean;
    freshness: string | null;
    observed_at_ts_ms: number | null;
    soil_moisture: number | null;
    irrigation_effectiveness: string | null;
    sensor_quality: string | null;
  };
  field_sensing_summary_stage1_v1: {
    visible: boolean;
    freshness: string | null;
    observed_at_ts_ms: number | null;
    summary_status: string | null;
  };
  latest_telemetry_summary: Record<string, unknown>;
  observation_summary: Record<string, unknown>;
  sensing_projection_summary: Record<string, unknown>;
  breakpoint: string | null;
  source_notes: string[];
};

export type PublishFlightTableTelemetryRequestV1 = {
  scenarios: FlightTableTelemetryScenarioKeyV1[];
  mode?: "fast" | "mqtt";
  device_id?: string;
  field_id?: string;
};

export type FlightTableTelemetryResponseV1 = {
  ok: true;
  scenarios: FlightTableTelemetryScenarioKeyV1[];
  points: FlightTableTelemetryPointV1[];
  metric_count: number;
  last_telemetry_time: string | null;
  observation_status: "READY" | "MISSING" | "PARTIAL";
  sensing_status: "READY" | "MISSING" | "PARTIAL";
  freshness: string | null;
  verify: FlightTableTelemetryVerifyV1;
  run: FlightTableRunV1;
};

export async function fetchFlightTableTelemetryScenarios(): Promise<FlightTableTelemetryScenarioKeyV1[]> {
  const res = await apiRequest<{ ok: boolean; scenarios: FlightTableTelemetryScenarioKeyV1[] }>("/api/v1/dev/flight-table/telemetry/scenarios");
  return Array.isArray(res.scenarios) ? res.scenarios : [];
}

export async function publishFlightTableTelemetry(runId: string, body: PublishFlightTableTelemetryRequestV1): Promise<FlightTableTelemetryResponseV1> {
  return apiRequest<FlightTableTelemetryResponseV1>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/telemetry/publish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyFlightTableTelemetry(runId: string, body: { device_id?: string; field_id?: string }): Promise<FlightTableTelemetryVerifyV1> {
  const res = await apiRequest<{ ok: boolean; verify: FlightTableTelemetryVerifyV1 }>(`/api/v1/dev/flight-table/runs/${encodeURIComponent(runId)}/telemetry/verify`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.verify;
}
