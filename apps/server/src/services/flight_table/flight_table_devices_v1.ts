import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { ingestTelemetryV1 } from "../telemetry_ingest_service_v1.js";
import type { FlightTableRunV1 } from "./flight_table_manifest_v1.js";
import {
  getFlightTableDeviceTemplateV1,
  listFlightTableDeviceTemplatesV1,
  type FlightTableDeviceModeV1,
  type FlightTableDeviceTemplateV1,
} from "./flight_table_device_templates_v1.js";

export type FlightTableDeviceOnboardingInputV1 = {
  field_id?: string;
  template_code?: string;
  device_id?: string;
  mode?: FlightTableDeviceModeV1;
  telemetry_mode?: "fast" | "realistic";
};

export type FlightTableDeviceStepResultV1 = {
  step_key: string;
  status: "PASS" | "FAIL";
  source: "FORMAL_ROUTE_COMPAT" | "FORMAL_SERVICE" | "DEV_HELPER";
  message: string;
};

export type FlightTableDeviceSummaryV1 = {
  device_id: string;
  device_type: string;
  template_code: string;
  mode: FlightTableDeviceModeV1;
  credential_id: string;
  credential_status: string;
  masked_secret: "****";
  online_status: "ONLINE" | "OFFLINE";
  last_heartbeat: string | null;
  last_telemetry: string | null;
  field_binding: string | null;
  capabilities: string[];
  required_observation_skills: string[];
  last_telemetry_metrics: Array<{ metric: string; value: number | string | boolean | null; unit: string | null }>;
  projection_status: "READY" | "PARTIAL" | "FAIL";
  sources: string[];
  steps: FlightTableDeviceStepResultV1[];
};

export type FlightTableDevicesResponseV1 = {
  ok: true;
  field_id: string;
  devices: FlightTableDeviceSummaryV1[];
  templates: FlightTableDeviceTemplateV1[];
  verify: {
    raw_telemetry_visible: boolean;
    observation_visible: boolean;
    sensing_visible: boolean;
    source_notes: string[];
  };
};

function safeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(s)) return null;
  return s;
}

function sha256Hex(seed: string): string {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

function randomSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function isoOrNull(ts: unknown): string | null {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

async function ensureRuntimeTables(pool: Pool | PoolClient): Promise<void> {
  await pool.query(`ALTER TABLE device_index_v1 ADD COLUMN IF NOT EXISTS device_mode TEXT NOT NULL DEFAULT 'simulator'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_capability (
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_ts_ms BIGINT NOT NULL,
    PRIMARY KEY (tenant_id, device_id)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS device_credential_index_v1 (
    tenant_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    credential_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    issued_ts_ms BIGINT NOT NULL,
    revoked_ts_ms BIGINT NULL,
    created_ts_ms BIGINT NULL,
    updated_ts_ms BIGINT NULL,
    PRIMARY KEY (tenant_id, device_id, credential_id)
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

async function createDeviceProjection(conn: PoolClient, auth: AoActAuthContextV0, template: FlightTableDeviceTemplateV1, device_id: string, mode: FlightTableDeviceModeV1, now: number): Promise<void> {
  const fact_id = `devreg_${sha256Hex(`device_registered_v1|${auth.tenant_id}|${device_id}`)}`;
  const record = {
    type: "device_registered_v1",
    entity: { tenant_id: auth.tenant_id, device_id },
    payload: {
      display_name: `FT ${template.device_type} ${device_id}`,
      device_mode: mode,
      device_template: template.formal_template_code,
      source_template_code: template.template_code,
      created_ts_ms: now,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
    },
  };
  await conn.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, 'control', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, new Date(now).toISOString(), JSON.stringify(record)],
  );
  await conn.query(
    `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, device_mode, created_ts_ms, last_credential_id, last_credential_status)
     VALUES ($1, $2, $3, $4, $5, NULL, NULL)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name = EXCLUDED.display_name, device_mode = EXCLUDED.device_mode`,
    [auth.tenant_id, device_id, `FT ${template.device_type} ${device_id}`, mode, now],
  );
}

async function upsertCapabilities(conn: PoolClient, auth: AoActAuthContextV0, template: FlightTableDeviceTemplateV1, device_id: string, now: number): Promise<void> {
  const fact_id = `devcap_${sha256Hex(`ft_device_capabilities|${auth.tenant_id}|${device_id}|${template.capabilities.join(',')}`)}`;
  await conn.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, 'control', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, new Date(now).toISOString(), JSON.stringify({
      type: "device_capability_v1",
      entity: { tenant_id: auth.tenant_id, device_id },
      payload: { capabilities: template.capabilities, source: "DEV_HELPER", updated_ts_ms: now, actor_id: auth.actor_id, token_id: auth.token_id },
    })],
  );
  await conn.query(
    `INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities = EXCLUDED.capabilities, updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [auth.tenant_id, device_id, JSON.stringify(template.capabilities), now],
  );
}

async function bindDeviceToField(conn: PoolClient, auth: AoActAuthContextV0, device_id: string, field_id: string, now: number): Promise<void> {
  const fact_id = `bind_${sha256Hex(`device_bound_to_field_v1|${auth.tenant_id}|${device_id}|${field_id}`)}`;
  await conn.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, 'control', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, new Date(now).toISOString(), JSON.stringify({
      type: "device_bound_to_field_v1",
      entity: { tenant_id: auth.tenant_id, device_id, field_id },
      payload: { source: "DEV_HELPER", bound_ts_ms: now, actor_id: auth.actor_id, token_id: auth.token_id },
    })],
  );
  await conn.query(
    `INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms = EXCLUDED.bound_ts_ms`,
    [auth.tenant_id, device_id, field_id, now],
  );
}

async function issueCredential(conn: PoolClient, auth: AoActAuthContextV0, device_id: string, now: number): Promise<{ credential_id: string }> {
  const credential_id = `cred_${sha256Hex(`${auth.tenant_id}|${device_id}|${now}`).slice(0, 16)}`;
  const secret = randomSecret();
  const credential_hash = sha256Hex(secret);
  const fact_id = `devcred_${sha256Hex(`device_credential_issued_v1|${auth.tenant_id}|${device_id}|${credential_id}|${credential_hash}`)}`;
  await conn.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, 'control', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, new Date(now).toISOString(), JSON.stringify({
      type: "device_credential_issued_v1",
      entity: { tenant_id: auth.tenant_id, device_id },
      payload: { credential_id, credential_hash, status: "ACTIVE", issued_ts_ms: now, actor_id: auth.actor_id, token_id: auth.token_id },
    })],
  );
  await conn.query(
    `INSERT INTO device_credential_index_v1 (tenant_id, device_id, credential_id, credential_hash, status, issued_ts_ms, revoked_ts_ms)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NULL)
     ON CONFLICT (tenant_id, device_id, credential_id) DO UPDATE SET credential_hash = EXCLUDED.credential_hash, status = 'ACTIVE', issued_ts_ms = EXCLUDED.issued_ts_ms, revoked_ts_ms = NULL`,
    [auth.tenant_id, device_id, credential_id, credential_hash, now],
  );
  await conn.query(
    `UPDATE device_index_v1 SET last_credential_id = $3, last_credential_status = 'ACTIVE' WHERE tenant_id = $1 AND device_id = $2`,
    [auth.tenant_id, device_id, credential_id],
  );
  return { credential_id };
}

async function writeHttpHeartbeat(conn: PoolClient, auth: AoActAuthContextV0, device_id: string, now: number): Promise<void> {
  await conn.query(
    `INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1, $2, $3, $4, NULL, $5, 88, -61, 'ft-c-v1', $5)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       group_id = EXCLUDED.group_id,
       last_heartbeat_ts_ms = EXCLUDED.last_heartbeat_ts_ms,
       battery_percent = EXCLUDED.battery_percent,
       rssi_dbm = EXCLUDED.rssi_dbm,
       fw_ver = EXCLUDED.fw_ver,
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [auth.tenant_id, auth.project_id, auth.group_id, device_id, now],
  );
}

async function verifyDevice(pool: Pool, auth: AoActAuthContextV0, device_id: string): Promise<{
  credential_id: string | null;
  credential_status: string;
  field_binding: string | null;
  last_heartbeat_ts_ms: number | null;
  last_telemetry_ts_ms: number | null;
  online_status: "ONLINE" | "OFFLINE";
  capabilities: string[];
  raw_count: number;
  observation_count: number;
}> {
  const q = await pool.query(
    `SELECT d.last_credential_id, d.last_credential_status, b.field_id, s.last_heartbeat_ts_ms, s.last_telemetry_ts_ms, c.capabilities
       FROM device_index_v1 d
       LEFT JOIN device_binding_index_v1 b ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
       LEFT JOIN device_status_index_v1 s ON s.tenant_id = d.tenant_id AND s.device_id = d.device_id
       LEFT JOIN device_capability c ON c.tenant_id = d.tenant_id AND c.device_id = d.device_id
      WHERE d.tenant_id = $1 AND d.device_id = $2
      LIMIT 1`,
    [auth.tenant_id, device_id],
  );
  const row = q.rows?.[0] ?? {};
  const rawQ = await pool.query(`SELECT COUNT(*)::int AS count FROM telemetry_index_v1 WHERE tenant_id = $1 AND device_id = $2`, [auth.tenant_id, device_id]);
  const obsQ = await pool.query(`SELECT COUNT(*)::int AS count FROM device_observation_index_v1 WHERE tenant_id = $1 AND device_id = $2`, [auth.tenant_id, device_id]).catch(() => ({ rows: [{ count: 0 }] } as any));
  const heartbeat = Number(row.last_heartbeat_ts_ms ?? 0);
  return {
    credential_id: row.last_credential_id ?? null,
    credential_status: String(row.last_credential_status ?? "UNKNOWN"),
    field_binding: row.field_id ?? null,
    last_heartbeat_ts_ms: Number.isFinite(heartbeat) && heartbeat > 0 ? heartbeat : null,
    last_telemetry_ts_ms: Number.isFinite(Number(row.last_telemetry_ts_ms)) ? Number(row.last_telemetry_ts_ms) : null,
    online_status: heartbeat >= Date.now() - 15 * 60 * 1000 ? "ONLINE" : "OFFLINE",
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map((v: unknown) => String(v)) : [],
    raw_count: Number(rawQ.rows?.[0]?.count ?? 0),
    observation_count: Number(obsQ.rows?.[0]?.count ?? 0),
  };
}

export function listFlightTableDeviceTemplatesForApiV1(): FlightTableDeviceTemplateV1[] {
  return listFlightTableDeviceTemplatesV1();
}

export async function onboardFlightTableDevicesV1(
  pool: Pool,
  run: FlightTableRunV1,
  input: FlightTableDeviceOnboardingInputV1,
  auth: AoActAuthContextV0,
): Promise<FlightTableDevicesResponseV1> {
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) {
    throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  }
  const field_id = safeId(input.field_id) ?? run.manifest.field_id;
  if (!field_id) throw new Error("FLIGHT_TABLE_FIELD_NOT_FOUND");
  const template = getFlightTableDeviceTemplateV1(input.template_code ?? "soil_probe");
  const mode: FlightTableDeviceModeV1 = input.mode === "physical" ? "physical" : template.default_mode;
  const device_id = safeId(input.device_id) ?? `ft_${template.template_code}_${Date.now()}`;
  const now = Date.now();
  const steps: FlightTableDeviceStepResultV1[] = [];
  let credential_id = "";

  await ensureRuntimeTables(pool);
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await createDeviceProjection(conn, auth, template, device_id, mode, now);
    steps.push({ step_key: "create_device", status: "PASS", source: "FORMAL_ROUTE_COMPAT", message: `device_id=${device_id}` });
    await upsertCapabilities(conn, auth, template, device_id, now + 1);
    steps.push({ step_key: "capabilities", status: "PASS", source: "DEV_HELPER", message: "formal capability route currently has a narrow allowlist; full template capabilities persisted by dev helper" });
    await bindDeviceToField(conn, auth, device_id, field_id, now + 2);
    steps.push({ step_key: "field_binding", status: "PASS", source: "DEV_HELPER", message: `field_id=${field_id}` });
    credential_id = (await issueCredential(conn, auth, device_id, now + 3)).credential_id;
    steps.push({ step_key: "credential", status: "PASS", source: "FORMAL_ROUTE_COMPAT", message: `credential_id=${credential_id}; masked_secret=****` });
    await writeHttpHeartbeat(conn, auth, device_id, now + 4);
    steps.push({ step_key: "heartbeat", status: "PASS", source: "DEV_HELPER", message: "HTTP heartbeat path updates device_status_index_v1 only; MQTT heartbeat fact is not required" });
    await conn.query("COMMIT");
  } catch (err) {
    try { await conn.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    conn.release();
  }

  const telemetryMetrics = template.default_metrics;
  for (let i = 0; i < telemetryMetrics.length; i += 1) {
    const metric = telemetryMetrics[i];
    await ingestTelemetryV1(pool, {
      tenant_id: auth.tenant_id,
      device_id,
      metric: metric.metric,
      value: metric.value,
      unit: metric.unit,
      ts_ms: now + 10 + i,
    }, {
      source: input.telemetry_mode === "realistic" ? "flight_table_mqtt_compatible_ingest_v1" : "flight_table_fast_ingest_v1",
      project_id: auth.project_id,
      group_id: auth.group_id,
      field_id,
      quality_flags: ["OK"],
      confidence: 0.98,
    });
  }
  steps.push({ step_key: "telemetry", status: "PASS", source: input.telemetry_mode === "realistic" ? "FORMAL_SERVICE" : "DEV_HELPER", message: `metrics=${telemetryMetrics.map((m) => m.metric).join(',')}` });

  const verified = await verifyDevice(pool, auth, device_id);
  steps.push({ step_key: "verify_observation_sensing", status: verified.raw_count > 0 && verified.observation_count > 0 ? "PASS" : "FAIL", source: "FORMAL_SERVICE", message: `raw=${verified.raw_count}; observation=${verified.observation_count}` });

  const device: FlightTableDeviceSummaryV1 = {
    device_id,
    device_type: template.device_type,
    template_code: template.template_code,
    mode,
    credential_id: verified.credential_id ?? credential_id,
    credential_status: verified.credential_status,
    masked_secret: "****",
    online_status: verified.online_status,
    last_heartbeat: isoOrNull(verified.last_heartbeat_ts_ms),
    last_telemetry: isoOrNull(verified.last_telemetry_ts_ms),
    field_binding: verified.field_binding,
    capabilities: verified.capabilities.length ? verified.capabilities : template.capabilities,
    required_observation_skills: template.required_observation_skills,
    last_telemetry_metrics: telemetryMetrics,
    projection_status: verified.raw_count > 0 && verified.observation_count > 0 && verified.online_status === "ONLINE" ? "READY" : "PARTIAL",
    sources: Array.from(new Set(steps.map((step) => step.source))),
    steps,
  };

  return {
    ok: true,
    field_id,
    devices: [device],
    templates: listFlightTableDeviceTemplatesV1(),
    verify: {
      raw_telemetry_visible: verified.raw_count > 0,
      observation_visible: verified.observation_count > 0,
      sensing_visible: verified.observation_count > 0,
      source_notes: steps.filter((s) => s.source === "DEV_HELPER").map((s) => `${s.step_key}:DEV_HELPER`),
    },
  };
}
