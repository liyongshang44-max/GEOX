import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const DATA_SCOPE = "OFFICIAL_OPERATOR_API";

type Row = Record<string, unknown>;

function basePayload(source: string) {
  return {
    source,
    dataScope: DATA_SCOPE,
    generated_at: new Date().toISOString(),
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function safeText(value: unknown): string {
  const valueText = text(value);
  if (!valueText) return "";
  if (/token|secret|access[_-]?key|credential_payload|password|private\s*key/i.test(valueText)) return "";
  return valueText;
}

function toIsoFromMs(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

function normalizeCredentialStatus(value: unknown): "ACTIVE" | "REVOKED" | "UNKNOWN" {
  const raw = text(value).toUpperCase();
  if (raw.includes("ACTIVE")) return "ACTIVE";
  if (raw.includes("REVOKED")) return "REVOKED";
  return "UNKNOWN";
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query("SELECT to_regclass($1)::text AS table_name", [`public.${table}`]);
  return Boolean(result.rows?.[0]?.table_name);
}

async function readTenantRows(pool: Pool, table: string, limit = 300): Promise<Row[]> {
  if (!(await tableExists(pool, table))) return [];
  const result = await pool.query(`SELECT * FROM ${table} LIMIT $1`, [limit]);
  return result.rows ?? [];
}

function latestBy(rows: Row[], idKey: string, tsKeys: string[]): Map<string, Row> {
  const byId = new Map<string, Row>();
  for (const row of rows) {
    const id = text(row[idKey]);
    if (!id) continue;
    const prev = byId.get(id);
    const rowTs = Math.max(...tsKeys.map((key) => Number(row[key] ?? 0)));
    const prevTs = prev ? Math.max(...tsKeys.map((key) => Number(prev[key] ?? 0))) : -1;
    if (!prev || rowTs >= prevTs) byId.set(id, row);
  }
  return byId;
}

async function buildDevicesAlerts(pool: Pool): Promise<{ devices: Row[]; alerts: Row[] }> {
  const [
    deviceRows,
    statusRows,
    bindingRows,
    capabilityRows,
    credentialRows,
    fieldRows,
    alertEventRows,
    alertRuleRows,
    notificationRows,
    actionRows,
  ] = await Promise.all([
    readTenantRows(pool, "device_index_v1"),
    readTenantRows(pool, "device_status_index_v1"),
    readTenantRows(pool, "device_binding_index_v1"),
    readTenantRows(pool, "device_capability"),
    readTenantRows(pool, "device_credential_index_v1"),
    readTenantRows(pool, "field_index_v1", 500),
    readTenantRows(pool, "alert_event_index_v1"),
    readTenantRows(pool, "alert_rule_index_v1", 500),
    readTenantRows(pool, "alert_notification_index_v1", 500),
    readTenantRows(pool, "alert_actions_v1", 500),
  ]);

  const fieldNameById = new Map(fieldRows.map((x) => [text(x.field_id), safeText(x.name ?? x.field_name)]));
  const statusByDevice = latestBy(statusRows, "device_id", ["last_heartbeat_ts_ms", "last_telemetry_ts_ms"]);
  const bindingByDevice = latestBy(bindingRows, "device_id", ["bound_ts_ms", "updated_ts_ms", "created_ts_ms"]);
  const capabilityByDevice = latestBy(capabilityRows, "device_id", ["updated_ts_ms", "created_ts_ms"]);
  const credentialByDevice = latestBy(credentialRows, "device_id", ["issued_ts_ms", "last_used_ts_ms", "updated_ts_ms"]);

  const deviceIds = new Set<string>();
  for (const row of deviceRows) if (text(row.device_id)) deviceIds.add(text(row.device_id));
  for (const row of statusRows) if (text(row.device_id)) deviceIds.add(text(row.device_id));

  const devices = [...deviceIds].sort().map((deviceId) => {
    const device = deviceRows.find((row) => text(row.device_id) === deviceId) ?? {};
    const status = statusByDevice.get(deviceId) ?? {};
    const binding = bindingByDevice.get(deviceId) ?? {};
    const credential = credentialByDevice.get(deviceId) ?? {};
    const capability = capabilityByDevice.get(deviceId) ?? {};
    const fieldId = safeText(status.field_id ?? binding.field_id ?? device.field_id);
    const heartbeat = toIsoFromMs(status.last_heartbeat_ts_ms);
    const lastTelemetry = toIsoFromMs(status.last_telemetry_ts_ms);
    const capabilitiesRaw = capability.capabilities ?? capability.capabilities_json ?? [];
    const capabilities = Array.isArray(capabilitiesRaw)
      ? capabilitiesRaw.map((item) => safeText(item)).filter(Boolean)
      : [];

    const onlineStatus = heartbeat ? (Date.now() - Number(status.last_heartbeat_ts_ms) < 15 * 60 * 1000 ? "ONLINE" : "OFFLINE") : "UNKNOWN";

    return {
      device_id: safeText(deviceId),
      display_name: safeText(device.display_name ?? device.name),
      online_status: onlineStatus,
      last_heartbeat_at: heartbeat,
      last_telemetry_at: lastTelemetry,
      field_id: fieldId,
      field_name: fieldId ? safeText(fieldNameById.get(fieldId)) : "",
      capabilities,
      credential_status: normalizeCredentialStatus(device.last_credential_status ?? credential.status),
      credential_last_issued_at: toIsoFromMs(credential.issued_ts_ms ?? credential.created_ts_ms),
      credential_last_used_at: toIsoFromMs(credential.last_used_ts_ms),
      revoke_status: "read_only",
      can_revoke: false,
      battery_percent: Number.isFinite(Number(status.battery_percent)) ? Number(status.battery_percent) : null,
      data_delay_text: lastTelemetry ? "telemetry 已上报" : "telemetry 待上报",
    };
  });

  const ruleById = new Map(alertRuleRows.map((row) => [text(row.rule_id), row]));
  const notifyByEvent = latestBy(notificationRows, "event_id", ["created_ts_ms", "delivered_ts_ms", "updated_ts_ms"]);
  const actionByAlert = latestBy(actionRows, "alert_id", ["acted_at", "updated_ts_ms"]);
  const alerts = alertEventRows.map((event, idx) => {
    const alertId = safeText(event.event_id ?? `alert_${idx}`);
    const rule = ruleById.get(text(event.rule_id)) ?? {};
    const action = actionByAlert.get(alertId) ?? {};
    const notify = notifyByEvent.get(alertId) ?? {};
    const status = safeText(action.status ?? event.status).toUpperCase() || "OPEN";
    const fieldId = safeText(event.field_id);
    return {
      alert_id: alertId,
      rule_name: safeText(rule.rule_name ?? rule.name ?? event.rule_id),
      event_text: safeText(event.reason ?? event.metric ?? event.object_type),
      notification_status: safeText(notify.status) || "UNKNOWN",
      status,
      ack_status: event.acked_ts_ms || status === "ACKED" ? "已 ACK" : "未 ACK",
      close_status: event.closed_ts_ms || status === "CLOSED" ? "已关闭" : "未关闭",
      owner_name: safeText(rule.owner_name ?? rule.owner),
      field_id: fieldId,
      field_name: fieldId ? safeText(fieldNameById.get(fieldId)) : "",
      operation_id: safeText(event.operation_id ?? event.operation_plan_id),
      prescription_formed: Boolean(event.prescription_id),
      overdue: false,
      created_at: toIsoFromMs(event.raised_ts_ms),
      updated_at: toIsoFromMs(action.acted_at ?? event.closed_ts_ms ?? event.acked_ts_ms ?? event.raised_ts_ms),
      can_ack: false,
      can_close: false,
      permission_reason: "写操作未开放",
      audit_id: null,
      status_source: "alert_event_projection",
    };
  });

  return { devices, alerts };
}

export function registerOperatorV1FacadeRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/devices-alerts", async (_req, reply) => {
    const { devices, alerts } = await buildDevicesAlerts(pool);
    return reply.send({
      ...basePayload("operator_devices_alerts_api"),
      ackCloseReady: false,
      revokeVisible: false,
      devices,
      alerts,
      message: "operator devices-alerts read-only facade",
    });
  });

  app.get("/api/v1/operator/field-memory", async (_req, reply) => reply.send({ ...basePayload("operator_field_memory_api"), items: [] }));

  app.get("/api/v1/operator/roi-ledger", async (_req, reply) => reply.send({ ...basePayload("operator_roi_ledger_api"), items: [] }));
}
