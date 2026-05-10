import crypto from "node:crypto";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { ingestTelemetryV1 } from "../telemetry_ingest_service_v1.js";
import { sanitizeFlightTableManifestV1, type FlightTableRunV1, type FlightTableStepV1 } from "./flight_table_manifest_v1.js";
import { buildFlightVerifySummaryV1 } from "./flight_table_verify_v1.js";
import {
  ensureFlightTableRunDirV1,
  flightTableRunDirV1,
  snapshotRefFromSnapshotV1,
  writeFlightTableApiSnapshotV1,
} from "./flight_table_snapshots_v1.js";
import fs from "node:fs/promises";
import path from "node:path";

export type FlightTableTelemetryScenarioKeyV1 =
  | "before_irrigation_low_moisture"
  | "during_irrigation_flow"
  | "after_irrigation_success"
  | "rainfall_interference"
  | "sensor_failure";

export type FlightTableTelemetryPublishInputV1 = {
  scenarios?: FlightTableTelemetryScenarioKeyV1[];
  mode?: "fast" | "mqtt";
  device_id?: string;
  field_id?: string;
};

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
  field_sensing_overview_v1: { visible: boolean; freshness: string | null; observed_at_ts_ms: number | null; soil_moisture: number | null; irrigation_effectiveness: string | null; sensor_quality: string | null };
  field_sensing_summary_stage1_v1: { visible: boolean; freshness: string | null; observed_at_ts_ms: number | null; summary_status: string | null };
  latest_telemetry_summary: Record<string, unknown>;
  observation_summary: Record<string, unknown>;
  sensing_projection_summary: Record<string, unknown>;
  breakpoint: string | null;
  source_notes: string[];
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

const SCENARIOS: FlightTableTelemetryScenarioKeyV1[] = [
  "before_irrigation_low_moisture",
  "during_irrigation_flow",
  "after_irrigation_success",
  "rainfall_interference",
  "sensor_failure",
];

function sha256Hex(seed: string): string {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function runFilePath(run_id: string): string {
  return path.join(flightTableRunDirV1(run_id), "run.json");
}

function safeId(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return /^[A-Za-z0-9_.:-]{1,160}$/.test(s) ? s : null;
}

function normalizeScenarioList(input: unknown): FlightTableTelemetryScenarioKeyV1[] {
  const values = Array.isArray(input) ? input : ["before_irrigation_low_moisture", "during_irrigation_flow", "after_irrigation_success"];
  const out = values.filter((v): v is FlightTableTelemetryScenarioKeyV1 => SCENARIOS.includes(v as FlightTableTelemetryScenarioKeyV1));
  return out.length ? Array.from(new Set(out)) : ["before_irrigation_low_moisture", "during_irrigation_flow", "after_irrigation_success"];
}

function fieldIdFor(run: FlightTableRunV1, input?: string | null): string {
  return safeId(input) ?? run.manifest.field_id ?? "_na_field";
}

function deviceIdFor(run: FlightTableRunV1, input?: string | null): string {
  return safeId(input) ?? run.manifest.device_ids[0] ?? `ft_sensor_${run.run_id}`;
}

function buildPoint(params: {
  scenario: FlightTableTelemetryScenarioKeyV1;
  run: FlightTableRunV1;
  auth: AoActAuthContextV0;
  device_id: string;
  field_id: string;
  metric_key: string;
  value: number | string | boolean | null;
  unit: string | null;
  ts_ms: number;
  source: FlightTableTelemetryPointV1["source"];
}): FlightTableTelemetryPointV1 {
  return {
    scenario: params.scenario,
    device_id: params.device_id,
    metric_key: params.metric_key,
    value: params.value,
    unit: params.unit,
    ts_ms: params.ts_ms,
    field_id: params.field_id,
    tenant_id: params.auth.tenant_id,
    project_id: params.auth.project_id,
    group_id: params.auth.group_id,
    source: params.source,
  };
}

export function listFlightTableTelemetryScenariosV1(): FlightTableTelemetryScenarioKeyV1[] {
  return [...SCENARIOS];
}

export function buildFlightTableTelemetryScenarioPointsV1(
  run: FlightTableRunV1,
  input: FlightTableTelemetryPublishInputV1,
  auth: AoActAuthContextV0,
): FlightTableTelemetryPointV1[] {
  const field_id = fieldIdFor(run, input.field_id);
  const device_id = deviceIdFor(run, input.device_id);
  const scenarios = normalizeScenarioList(input.scenarios);
  const baseTs = Date.now() - 3 * 60 * 1000;
  const source: FlightTableTelemetryPointV1["source"] = input.mode === "mqtt" ? "MQTT_COMPATIBLE_INGEST" : "FLIGHT_TABLE_FAST_INGEST";
  const points: FlightTableTelemetryPointV1[] = [];
  for (const scenario of scenarios) {
    if (scenario === "before_irrigation_low_moisture") {
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "soil_moisture", value: 17, unit: "%VWC", ts_ms: baseTs, source }));
    } else if (scenario === "during_irrigation_flow") {
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "water_flow_rate", value: 128, unit: "L/min", ts_ms: baseTs + 60_000, source }));
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "water_pressure", value: 320, unit: "kPa", ts_ms: baseTs + 65_000, source }));
    } else if (scenario === "after_irrigation_success") {
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "soil_moisture", value: 31, unit: "%VWC", ts_ms: baseTs + 140_000, source }));
    } else if (scenario === "rainfall_interference") {
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "air_humidity", value: 96, unit: "%RH", ts_ms: baseTs + 120_000, source }));
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "soil_moisture", value: 39, unit: "%VWC", ts_ms: baseTs + 125_000, source }));
    } else if (scenario === "sensor_failure") {
      points.push(buildPoint({ scenario, run, auth, device_id, field_id, metric_key: "soil_moisture", value: "SENSOR_FAULT", unit: "%VWC", ts_ms: baseTs + 180_000, source: "FLIGHT_TABLE_FAST_INGEST_RAW_ONLY" }));
    }
  }
  return points;
}

async function ensureRawTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS telemetry_index_v1 (
    tenant_id text NOT NULL,
    device_id text NOT NULL,
    metric text NOT NULL,
    ts timestamptz NOT NULL,
    value_num double precision NULL,
    value_text text NULL,
    fact_id text NOT NULL,
    PRIMARY KEY (tenant_id, device_id, metric, ts)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_status_index_v1 (
    tenant_id TEXT NOT NULL,
    project_id TEXT NULL,
    group_id TEXT NULL,
    device_id TEXT NOT NULL,
    last_telemetry_ts_ms BIGINT NULL,
    last_heartbeat_ts_ms BIGINT NULL,
    battery_percent INTEGER NULL,
    rssi_dbm INTEGER NULL,
    fw_ver TEXT NULL,
    updated_ts_ms BIGINT NOT NULL,
    PRIMARY KEY (tenant_id, device_id)
  )`);
}

async function insertRawOnlyTelemetryV1(pool: Pool, point: FlightTableTelemetryPointV1): Promise<{ fact_id: string }> {
  await ensureRawTables(pool);
  const telemetry_id = sha256Hex(`${point.tenant_id}|${point.device_id}|${point.metric_key}|${point.ts_ms}|raw_only`);
  const fact_id = `raw_${telemetry_id}`;
  const occurred_at_iso = new Date(point.ts_ms).toISOString();
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, occurred_at_iso, point.source, JSON.stringify({
      type: "raw_telemetry_v1",
      schema_version: 1,
      occurred_at: occurred_at_iso,
      entity: { tenant_id: point.tenant_id, device_id: point.device_id },
      payload: {
        telemetry_id,
        metric: point.metric_key,
        value: point.value,
        unit: point.unit,
        ts_ms: point.ts_ms,
        source: point.source,
        quality_flags: ["SUSPECT", "MISSING_CONTEXT"],
        flight_table_breakpoint: "raw_telemetry_without_observation",
      },
    })],
  );
  await pool.query(
    `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id)
     VALUES ($1,$2,$3,$4::timestamptz,NULL,$5,$6)
     ON CONFLICT (tenant_id, device_id, metric, ts) DO NOTHING`,
    [point.tenant_id, point.device_id, point.metric_key, occurred_at_iso, String(point.value ?? ""), fact_id],
  );
  await pool.query(
    `INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,'ft-f-raw-only',$5)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       group_id = EXCLUDED.group_id,
       last_telemetry_ts_ms = GREATEST(COALESCE(device_status_index_v1.last_telemetry_ts_ms, 0), EXCLUDED.last_telemetry_ts_ms),
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [point.tenant_id, point.project_id, point.group_id, point.device_id, point.ts_ms],
  );
  return { fact_id };
}

async function publishPoint(pool: Pool, point: FlightTableTelemetryPointV1): Promise<void> {
  if (point.source === "FLIGHT_TABLE_FAST_INGEST_RAW_ONLY") {
    await insertRawOnlyTelemetryV1(pool, point);
    return;
  }
  await ingestTelemetryV1(pool, {
    tenant_id: point.tenant_id,
    device_id: point.device_id,
    metric: point.metric_key,
    value: point.value,
    unit: point.unit,
    ts_ms: point.ts_ms,
  }, {
    source: point.source === "MQTT_COMPATIBLE_INGEST" ? "flight_table_mqtt_compatible_ingest_v1" : "FLIGHT_TABLE_FAST_INGEST",
    project_id: point.project_id,
    group_id: point.group_id,
    field_id: point.field_id,
    quality_flags: point.scenario === "rainfall_interference" ? ["SUSPECT"] : ["OK"],
    confidence: point.scenario === "rainfall_interference" ? 0.72 : 0.98,
  });
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function scalarCount(pool: Pool, sql: string, values: unknown[]): Promise<number> {
  try {
    const q = await pool.query(sql, values as any[]);
    return Number(q.rows?.[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function verifyFlightTableTelemetryV1(pool: Pool, run: FlightTableRunV1, params: { device_id: string; field_id: string }): Promise<FlightTableTelemetryVerifyV1> {
  const tenant_id = run.tenant_id;
  const device_id = params.device_id;
  const field_id = params.field_id;
  const rawCount = await scalarCount(pool,
    `SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')='raw_telemetry_v1' AND (record_json::jsonb#>>'{entity,tenant_id}')=$1 AND (record_json::jsonb#>>'{entity,device_id}')=$2`,
    [tenant_id, device_id]);
  const rawOnlyCount = await scalarCount(pool,
    `SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')='raw_telemetry_v1' AND (record_json::jsonb#>>'{entity,tenant_id}')=$1 AND (record_json::jsonb#>>'{entity,device_id}')=$2 AND (record_json::jsonb#>>'{payload,flight_table_breakpoint}')='raw_telemetry_without_observation'`,
    [tenant_id, device_id]);
  let telemetryCount = 0;
  let latestTsMs: number | null = null;
  try {
    const q = await pool.query(`SELECT COUNT(*)::int AS count, MAX(EXTRACT(EPOCH FROM ts) * 1000)::bigint AS latest_ts_ms FROM telemetry_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [tenant_id, device_id]);
    telemetryCount = Number(q.rows?.[0]?.count ?? 0);
    latestTsMs = num(q.rows?.[0]?.latest_ts_ms);
  } catch {}
  let statusLastTelemetry: number | null = null;
  try {
    const q = await pool.query(`SELECT last_telemetry_ts_ms FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id=$2 LIMIT 1`, [tenant_id, device_id]);
    statusLastTelemetry = num(q.rows?.[0]?.last_telemetry_ts_ms);
  } catch {}
  const observationFactCount = await scalarCount(pool,
    `SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')='device_observation_v1' AND (record_json::jsonb#>>'{entity,tenant_id}')=$1 AND (record_json::jsonb#>>'{entity,device_id}')=$2`,
    [tenant_id, device_id]);
  let observationIndexCount = 0;
  let latestObservedAt: number | null = null;
  try {
    const q = await pool.query(`SELECT COUNT(*)::int AS count, MAX(observed_at_ts_ms)::bigint AS latest_observed_at_ts_ms FROM device_observation_index_v1 WHERE tenant_id=$1 AND device_id=$2`, [tenant_id, device_id]);
    observationIndexCount = Number(q.rows?.[0]?.count ?? 0);
    latestObservedAt = num(q.rows?.[0]?.latest_observed_at_ts_ms);
  } catch {}
  const derivedFactCount = await scalarCount(pool,
    `SELECT COUNT(*)::int AS count FROM facts WHERE (record_json::jsonb->>'type')='derived_sensing_state_v1' AND (record_json::jsonb#>>'{entity,tenant_id}')=$1 AND (record_json::jsonb#>>'{entity,field_id}')=$2`,
    [tenant_id, field_id]);
  const derivedIndexCount = await scalarCount(pool, `SELECT COUNT(*)::int AS count FROM derived_sensing_state_index_v1 WHERE tenant_id=$1 AND field_id=$2`, [tenant_id, field_id]);
  let overview: any = null;
  try {
    const q = await pool.query(`SELECT * FROM field_sensing_overview_v1 WHERE tenant_id=$1 AND field_id=$2 LIMIT 1`, [tenant_id, field_id]);
    overview = q.rows?.[0] ?? null;
  } catch {}
  let summary: any = null;
  try {
    const q = await pool.query(`SELECT * FROM field_sensing_summary_stage1_v1 WHERE tenant_id=$1 AND field_id=$2 LIMIT 1`, [tenant_id, field_id]);
    summary = q.rows?.[0] ?? null;
  } catch {}
  const observationMissingBreakpoint = rawCount > observationIndexCount || rawOnlyCount > 0;
  return {
    raw_telemetry_v1: { visible: rawCount > 0, count: rawCount },
    telemetry_index_v1: { visible: telemetryCount > 0, count: telemetryCount, latest_ts_ms: latestTsMs },
    device_status_index_v1: {
      visible: statusLastTelemetry != null,
      last_telemetry_ts_ms: statusLastTelemetry,
      online_status: statusLastTelemetry == null ? "UNKNOWN" : statusLastTelemetry >= Date.now() - 15 * 60 * 1000 ? "ONLINE" : "OFFLINE",
    },
    device_observation_v1: { visible: observationFactCount > 0, count: observationFactCount },
    device_observation_index_v1: { visible: observationIndexCount > 0, count: observationIndexCount, latest_observed_at_ts_ms: latestObservedAt },
    derived_sensing_state_v1: { visible: derivedFactCount > 0, count: derivedFactCount },
    derived_sensing_state_index_v1: { visible: derivedIndexCount > 0, count: derivedIndexCount },
    field_sensing_overview_v1: {
      visible: Boolean(overview),
      freshness: overview?.freshness ?? null,
      observed_at_ts_ms: num(overview?.observed_at_ts_ms),
      soil_moisture: Array.isArray(overview?.soil_indicators_json) ? num(overview.soil_indicators_json.find((x: any) => x?.metric === "soil_moisture")?.value) : null,
      irrigation_effectiveness: overview?.irrigation_effectiveness ?? null,
      sensor_quality: overview?.sensor_quality ?? overview?.sensor_quality_level ?? null,
    },
    field_sensing_summary_stage1_v1: {
      visible: Boolean(summary),
      freshness: summary?.freshness ?? null,
      observed_at_ts_ms: num(summary?.observed_at_ts_ms ?? summary?.source_observed_at_ts_ms),
      summary_status: summary?.status ?? summary?.refresh_status ?? null,
    },
    latest_telemetry_summary: { metric_count: telemetryCount, latest_ts_ms: latestTsMs, device_id },
    observation_summary: { observation_fact_count: observationFactCount, observation_index_count: observationIndexCount, latest_observed_at_ts_ms: latestObservedAt },
    sensing_projection_summary: { derived_fact_count: derivedFactCount, derived_index_count: derivedIndexCount, overview_visible: Boolean(overview), summary_visible: Boolean(summary) },
    breakpoint: observationMissingBreakpoint ? "RAW_TELEMETRY_WITHOUT_OBSERVATION" : null,
    source_notes: rawOnlyCount > 0 ? ["source=FLIGHT_TABLE_FAST_INGEST_RAW_ONLY", "raw telemetry exists without observation; check observation normalization/contract boundary"] : [],
  };
}

async function writeRun(run: FlightTableRunV1): Promise<FlightTableRunV1> {
  await ensureFlightTableRunDirV1(run.run_id);
  const next: FlightTableRunV1 = { ...run, updated_at: nowIso(), manifest: sanitizeFlightTableManifestV1(run.manifest) };
  const withSummary = { ...next, verify_summary: buildFlightVerifySummaryV1(next) };
  await fs.writeFile(runFilePath(run.run_id), `${JSON.stringify(withSummary, null, 2)}\n`, "utf8");
  return withSummary;
}

function updateStep(steps: FlightTableStepV1[], key: string, status: FlightTableStepV1["status"], message: string): FlightTableStepV1[] {
  const ts = nowIso();
  return steps.map((step) => step.step_key === key ? {
    ...step,
    status,
    verify_result: status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status === "SKIPPED" ? "SKIPPED" : "PENDING",
    message,
    started_at: step.started_at ?? ts,
    finished_at: status === "PASS" || status === "FAIL" || status === "SKIPPED" ? ts : undefined,
    updated_at: ts,
  } : step);
}

export async function publishFlightTableTelemetryScenariosV1(
  pool: Pool,
  run: FlightTableRunV1,
  input: FlightTableTelemetryPublishInputV1,
  auth: AoActAuthContextV0,
): Promise<FlightTableTelemetryResponseV1> {
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  const scenarios = normalizeScenarioList(input.scenarios);
  const points = buildFlightTableTelemetryScenarioPointsV1(run, { ...input, scenarios }, auth);
  for (const point of points) await publishPoint(pool, point);
  const device_id = points[0]?.device_id ?? deviceIdFor(run, input.device_id);
  const field_id = points[0]?.field_id ?? fieldIdFor(run, input.field_id);
  const verify = await verifyFlightTableTelemetryV1(pool, run, { device_id, field_id });
  const observationReady = verify.device_observation_index_v1.visible && !verify.breakpoint;
  const sensingReady = verify.derived_sensing_state_index_v1.visible || verify.field_sensing_overview_v1.visible || verify.field_sensing_summary_stage1_v1.visible;
  const snapshot = await writeFlightTableApiSnapshotV1({
    run_id: run.run_id,
    method: "POST",
    path: `/api/v1/dev/flight-table/runs/${encodeURIComponent(run.run_id)}/telemetry/publish`,
    ok: verify.raw_telemetry_v1.visible && verify.telemetry_index_v1.visible,
    status_code: 200,
    label: "publish telemetry sensing scenarios",
    request: { scenarios, mode: input.mode ?? "fast", device_id, field_id },
    response: {
      scenarios,
      metric_count: points.length,
      last_telemetry_time: verify.telemetry_index_v1.latest_ts_ms ? new Date(verify.telemetry_index_v1.latest_ts_ms).toISOString() : null,
      observation_status: observationReady ? "READY" : verify.device_observation_index_v1.visible ? "PARTIAL" : "MISSING",
      sensing_status: sensingReady ? "READY" : "MISSING",
      breakpoint: verify.breakpoint,
      source_notes: verify.source_notes,
      latest_telemetry_summary: verify.latest_telemetry_summary,
      observation_summary: verify.observation_summary,
      sensing_projection_summary: verify.sensing_projection_summary,
    },
  });
  let steps = run.steps;
  steps = updateStep(steps, "C", verify.raw_telemetry_v1.visible && verify.telemetry_index_v1.visible && verify.device_status_index_v1.visible ? "PASS" : "FAIL", `telemetry=${verify.telemetry_index_v1.count}; last=${verify.telemetry_index_v1.latest_ts_ms ?? 'none'}; source=${Array.from(new Set(points.map((p) => p.source))).join('|')}`);
  steps = updateStep(steps, "D", observationReady && sensingReady ? "PASS" : verify.breakpoint ? "FAIL" : "FAIL", `observation=${verify.device_observation_index_v1.count}; sensing=${verify.derived_sensing_state_index_v1.count}; overview=${verify.field_sensing_overview_v1.visible}; breakpoint=${verify.breakpoint ?? 'none'}`);
  if (scenarios.includes("rainfall_interference")) {
    steps = updateStep(steps, "H", "FAIL", "rainfall_interference scenario detected; high humidity and abrupt moisture change should be treated as weather interference evidence, not learned as irrigation effect.");
  }
  const nextRun = await writeRun({
    ...run,
    current_step: verify.breakpoint ? "D" : scenarios.includes("rainfall_interference") ? "H" : "D",
    lane: scenarios.includes("rainfall_interference") ? "weather_interference" : run.lane,
    status: verify.breakpoint || scenarios.includes("rainfall_interference") ? "FAIL" : run.status,
    steps,
    manifest: {
      ...run.manifest,
      field_id: run.manifest.field_id ?? field_id,
      device_ids: Array.from(new Set([...run.manifest.device_ids, device_id])),
      api_snapshot_refs: [...run.manifest.api_snapshot_refs, snapshotRefFromSnapshotV1(snapshot)],
    },
  });
  return {
    ok: true,
    scenarios,
    points,
    metric_count: points.length,
    last_telemetry_time: verify.telemetry_index_v1.latest_ts_ms ? new Date(verify.telemetry_index_v1.latest_ts_ms).toISOString() : null,
    observation_status: observationReady ? "READY" : verify.device_observation_index_v1.visible ? "PARTIAL" : "MISSING",
    sensing_status: sensingReady ? "READY" : "MISSING",
    freshness: verify.field_sensing_overview_v1.freshness ?? verify.field_sensing_summary_stage1_v1.freshness,
    verify,
    run: nextRun,
  };
}
