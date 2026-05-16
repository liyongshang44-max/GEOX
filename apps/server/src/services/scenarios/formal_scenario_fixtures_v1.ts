import type { FormalScenarioRunV1 } from "./formal_scenario_manifest_v1.js";

export type FormalScenarioFixtureScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FormalScenarioFixtureV1 = FormalScenarioFixtureScopeV1 & {
  run_id: string;
  field_id: string;
  season_id: string;
  device_id: string;
  credential_id: string;
  zone_ids: string[];
};

export type FormalScenarioRawSampleFixtureV1 = FormalScenarioFixtureScopeV1 & {
  sample_id: string;
  sensor_id: string;
  field_id: string;
  ts_ms: number;
  metric: string;
  value: number;
  unit: string | null;
  qc_quality: "ok" | "suspect" | "bad" | "unknown";
  source: "device" | "gateway" | "system" | "human" | "import" | "sim";
  payload: Record<string, unknown>;
};

export type FormalScenarioDeviceStatusFixtureV1 = FormalScenarioFixtureScopeV1 & {
  field_id: string;
  device_id: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  last_telemetry_ts_ms: number;
  last_heartbeat_ts_ms: number;
  battery_percent: number;
  rssi_dbm: number;
  updated_ts_ms: number;
};

function safeIdPart(input: unknown): string {
  return String(input ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_:-]/g, "_")
    .slice(0, 80) || "x";
}

export function buildFormalScenarioFixtureV1(run: FormalScenarioRunV1): FormalScenarioFixtureV1 {
  const suffix = safeIdPart(run.run_id);
  return {
    run_id: run.run_id,
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    field_id: `field_${suffix}`,
    season_id: `season_${suffix}`,
    device_id: `dev_${suffix}`,
    credential_id: `cred_${suffix}`,
    zone_ids: [`zone_${suffix}_a`, `zone_${suffix}_b`],
  };
}

export function buildFormalIrrigationRawSamplesV1(params: {
  fixture: FormalScenarioFixtureV1;
  source?: FormalScenarioRawSampleFixtureV1["source"];
  metric?: string;
  unit?: string | null;
  value?: number;
  count?: number;
  now_ms?: number;
  sample_interval_ms?: number;
  field_id?: string;
  device_id?: string;
}): FormalScenarioRawSampleFixtureV1[] {
  const count = Math.max(1, Math.trunc(Number(params.count ?? 12)));
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();
  const intervalMs = Math.max(60_000, Math.trunc(Number(params.sample_interval_ms ?? 30 * 60 * 1000)));
  const start = nowMs - ((count - 1) * intervalMs) - 60_000;
  const source = params.source ?? "device";
  const metric = String(params.metric ?? "soil_moisture").trim() || "soil_moisture";
  const baseValue = Number.isFinite(Number(params.value)) ? Number(params.value) : 19;
  const field_id = String(params.field_id ?? params.fixture.field_id).trim();
  const device_id = String(params.device_id ?? params.fixture.device_id).trim();
  return Array.from({ length: count }, (_, idx) => {
    const ts_ms = Math.trunc(start + idx * intervalMs);
    const value = Number((baseValue + idx * 0.1).toFixed(3));
    return {
      tenant_id: params.fixture.tenant_id,
      project_id: params.fixture.project_id,
      group_id: params.fixture.group_id,
      sample_id: `rs_${safeIdPart(params.fixture.run_id)}_${source}_${safeIdPart(metric)}_${idx}`,
      sensor_id: device_id,
      field_id,
      ts_ms,
      metric,
      value,
      unit: params.unit ?? (metric.toLowerCase().includes("ec") ? "dS/m" : "%"),
      qc_quality: "ok",
      source,
      payload: {
        tenant_id: params.fixture.tenant_id,
        project_id: params.fixture.project_id,
        group_id: params.fixture.group_id,
        field_id,
        sensor_id: device_id,
        device_id,
        credential_id: params.fixture.credential_id,
        metric,
        value,
        ts_ms,
        source,
        sample_kind: "raw",
        interpolated: false,
        synthetic: false,
        formal_scenario_run_id: params.fixture.run_id,
      },
    };
  });
}

export function buildFormalIrrigationDeviceStatusFixtureV1(params: {
  fixture: FormalScenarioFixtureV1;
  status?: FormalScenarioDeviceStatusFixtureV1["status"];
  now_ms?: number;
  field_id?: string;
  device_id?: string;
}): FormalScenarioDeviceStatusFixtureV1 {
  const nowMs = Number.isFinite(params.now_ms) ? Number(params.now_ms) : Date.now();
  return {
    tenant_id: params.fixture.tenant_id,
    project_id: params.fixture.project_id,
    group_id: params.fixture.group_id,
    field_id: String(params.field_id ?? params.fixture.field_id).trim(),
    device_id: String(params.device_id ?? params.fixture.device_id).trim(),
    status: params.status ?? "ONLINE",
    last_telemetry_ts_ms: nowMs - 60_000,
    last_heartbeat_ts_ms: nowMs - 60_000,
    battery_percent: 82,
    rssi_dbm: -55,
    updated_ts_ms: nowMs,
  };
}

export function buildFormalIrrigationRecommendationRequestV1(params: {
  fixture: FormalScenarioFixtureV1;
  crop_code?: string;
}): Record<string, unknown> {
  return {
    tenant_id: params.fixture.tenant_id,
    project_id: params.fixture.project_id,
    group_id: params.fixture.group_id,
    field_id: params.fixture.field_id,
    season_id: params.fixture.season_id,
    device_id: params.fixture.device_id,
    crop_code: params.crop_code ?? "corn",
    image_recognition: {
      stress_score: 0.1,
      disease_score: 0.1,
      pest_risk_score: 0.1,
      confidence: 0.9,
    },
  };
}
