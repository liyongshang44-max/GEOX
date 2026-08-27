import type { DeviceObservationServiceV1Input } from "../../server/src/services/device_observation_service_v1";

export type MqttTelemetryObservationInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string | null;
  device_id: string;
  metric: string;
  value: number | string | boolean | null;
  unit: string | null;
  ts_ms: number;
  source_fact_id: string;
  quality_flags: string[];
};

/**
 * B-04b3 MQTT -> observation boundary.
 *
 * Preserve source metric/value/unit exactly. Canonicalization and physical QC
 * belong to the shared observation/evidence runtime, not the transport adapter.
 */
export function buildMqttObservationInputV1(input: MqttTelemetryObservationInputV1): DeviceObservationServiceV1Input {
  return {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    device_id: input.device_id,
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    quality_flags: input.quality_flags,
    confidence: 1,
    observed_at_ts_ms: input.ts_ms,
    source_fact_id: input.source_fact_id,
    source_lane: "FORMAL_OPERATION",
    is_simulated: false,
    formal_eligible: true,
    evidence_level: "FORMAL",
    dev_source: "mqtt_telemetry_ingest_v1",
  };
}
