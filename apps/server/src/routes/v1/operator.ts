import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";

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

function nullableText(value: unknown): string | null {
  const normalized = safeText(value);
  return normalized || null;
}

function normalizeRef(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return safeText(value) || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeRef(item);
      if (normalized) return normalized;
    }
    return null;
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const keys = ["evidence_id", "evidenceId", "evidence_ref", "evidenceRef", "bundle_id", "bundleId", "artifact_id", "artifactId", "id", "ref"];
    for (const key of keys) {
      const normalized = normalizeRef(source[key]);
      if (normalized) return normalized;
    }
    return null;
  }
  return null;
}

function normalizeRoiId(row: Row): string | null {
  return nullableText(row.roi_id ?? row.ledger_id ?? row.id ?? row.record_id);
}

function normalizeOperationId(row: Row): string | null {
  return nullableText(row.operation_id ?? row.operationId ?? row.operation_plan_id ?? row.operationPlanId ?? row.op_id);
}

function normalizeMetricName(row: Row): string | null {
  return nullableText(row.metric_name ?? row.roi_metric ?? row.metric ?? row.value_metric);
}

function normalizeValueText(row: Row): string | null {
  const rawValueText = safeText(row.value_text);
  const unit = safeText(row.unit);
  const unitOnlyPattern = /^(?:[a-zA-Z%³㎡]+|元)$/;

  if (rawValueText && !unitOnlyPattern.test(rawValueText)) return rawValueText;

  const valueCandidate = row.value ?? row.roi_value ?? row.delta_value ?? row.actual_value;
  const valueText = safeText(valueCandidate);
  if (!valueText) return null;
  if (!unit) return valueText;
  return `${valueText} ${unit}`.trim();
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

function buildTelemetryDelayText(lastTelemetryAt: string | null): string {
  if (!lastTelemetryAt) return "telemetry 待上报";
  const telemetryMs = new Date(lastTelemetryAt).getTime();
  if (!Number.isFinite(telemetryMs)) return "telemetry 待上报";
  const diffMs = Math.max(0, Date.now() - telemetryMs);
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin <= 15) return "telemetry 15 分钟内";
  if (diffMin < 60) return `telemetry 延迟 ${diffMin} 分钟`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `telemetry 延迟 ${diffHours} 小时`;
  const diffDays = Math.floor(diffHours / 24);
  return `telemetry 延迟 ${diffDays} 天`;
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
      display_name: nullableText(device.display_name ?? device.name),
      online_status: onlineStatus,
      last_heartbeat_at: heartbeat,
      last_telemetry_at: lastTelemetry,
      field_id: nullableText(fieldId),
      field_name: nullableText(fieldId ? fieldNameById.get(fieldId) : null),
      capabilities,
      credential_status: normalizeCredentialStatus(device.last_credential_status ?? credential.status),
      credential_last_issued_at: toIsoFromMs(credential.issued_ts_ms ?? credential.created_ts_ms),
      credential_last_used_at: toIsoFromMs(credential.last_used_ts_ms),
      revoke_status: "read_only",
      can_revoke: false,
      battery_percent: Number.isFinite(Number(status.battery_percent)) ? Number(status.battery_percent) : null,
      data_delay_text: buildTelemetryDelayText(lastTelemetry),
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


function jsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toIsoAny(value: unknown): string | null {
  const fromMs = toIsoFromMs(value);
  if (fromMs) return fromMs;
  const raw = text(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

async function buildFieldMemory(pool: Pool, query: { field_id?: string; operation_id?: string; memory_type?: string }): Promise<Row[]> {
  if (!(await tableExists(pool, "field_memory_v1"))) return [];
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, val?: string) => {
    const normalized = text(val);
    if (!normalized) return;
    values.push(normalized);
    where.push(`${col} = $${values.length}`);
  };
  add("field_id", query.field_id);
  add("operation_id", query.operation_id);
  add("memory_type", query.memory_type);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await pool.query(`SELECT * FROM field_memory_v1 ${whereSql} ORDER BY occurred_at DESC LIMIT 200`, values);
  return (result.rows ?? []).map((row: Row) => ({
    memory_id: safeText(row.memory_id),
    field_id: safeText(row.field_id),
    operation_id: safeText(row.operation_id),
    memory_type: safeText(row.memory_type),
    before: jsonObjectOrNull(row.before_value),
    after: jsonObjectOrNull(row.after_value ?? row.metric_value),
    delta: jsonObjectOrNull(row.delta_value),
    confidence: jsonObjectOrNull(row.confidence),
    skill_refs: [safeText(row.skill_id), safeText(row.skill_trace_ref)].filter(Boolean),
    evidence_refs: Array.isArray(row.evidence_refs) ? row.evidence_refs.map((x) => safeText(x)).filter(Boolean) : [],
    recommendation_id: safeText(row.recommendation_id),
    task_id: safeText(row.task_id),
    acceptance_id: safeText(row.acceptance_id),
    roi_id: safeText(row.roi_id),
    created_at: toIsoAny(row.created_at ?? row.occurred_at),
    updated_at: toIsoAny(row.updated_at ?? row.occurred_at),
  }));
}

function normalizeValueKind(input: unknown, baselinePresent: boolean, actualPresent: boolean, evidencePresent: boolean, confidenceLevel: string): string {
  const raw = safeText(input).toUpperCase();
  const measuredAllowed = baselinePresent && actualPresent && evidencePresent && ["HIGH", "MEDIUM"].includes(confidenceLevel);
  if (measuredAllowed) return raw === "MEASURED" ? "MEASURED" : (raw || "MEASURED");
  if (!evidencePresent) return "INSUFFICIENT_EVIDENCE";
  if (!baselinePresent || !actualPresent) return "ESTIMATED";
  return "ASSUMPTION_BASED";
}

async function buildRoiLedger(pool: Pool, query: { field_id?: string; operation_id?: string }): Promise<Row[]> {
  if (!(await tableExists(pool, "roi_ledger_v1"))) return [];
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (col: string, val?: string) => {
    const normalized = text(val);
    if (!normalized) return;
    values.push(normalized);
    where.push(`${col} = $${values.length}`);
  };
  add("field_id", query.field_id);
  add("operation_id", query.operation_id);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await pool.query(`SELECT * FROM roi_ledger_v1 ${whereSql} ORDER BY created_at DESC LIMIT 200`, values);
  return (result.rows ?? []).map((row: Row) => {
    const confidence = jsonObjectOrNull(row.confidence) ?? {};
    const confidenceLevel = safeText((confidence as Record<string, unknown>).level).toUpperCase();
    const baselinePresent = row.baseline_value !== null && row.baseline_value !== undefined;
    const actualPresent = row.actual_value !== null && row.actual_value !== undefined;
    const normalizedEvidenceRef = normalizeRef(row.evidence_ref ?? row.evidence_refs);
    const evidencePresent = Boolean(normalizedEvidenceRef);
    const valueKind = normalizeValueKind(row.value_kind ?? row.roi_type, baselinePresent, actualPresent, evidencePresent, confidenceLevel);
    return {
      roi_id: normalizeRoiId(row),
      field_id: nullableText(row.field_id),
      operation_id: normalizeOperationId(row),
      prescription_id: nullableText(row.prescription_id),
      evidence_ref: normalizedEvidenceRef,
      calculation_method: safeText(row.calculation_method ?? row.method),
      confidence: confidence,
      assumption: jsonObjectOrNull(row.assumptions),
      created_at: toIsoAny(row.created_at),
      baseline_present: baselinePresent,
      actual_present: actualPresent,
      evidence_present: evidencePresent,
      value_kind: valueKind,
      metric_name: normalizeMetricName(row),
      value_text: normalizeValueText(row),
    };
  });
}
export function registerOperatorV1FacadeRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/devices-alerts", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number; field_id?: string; device_id?: string; online_status?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const fieldIdFilter = safeText(query.field_id);
    const deviceIdFilter = safeText(query.device_id);
    const onlineStatusRaw = safeText(query.online_status).toUpperCase();
    const onlineStatusFilter = ["ONLINE", "OFFLINE", "DELAYED", "UNKNOWN"].includes(onlineStatusRaw) ? onlineStatusRaw : "";

    const { devices, alerts } = await buildDevicesAlerts(pool);
    const filteredDevices = devices.filter((device) => {
      if (fieldIdFilter && safeText(device.field_id) !== fieldIdFilter) return false;
      if (deviceIdFilter && safeText(device.device_id) !== deviceIdFilter) return false;
      if (onlineStatusFilter && safeText(device.online_status).toUpperCase() !== onlineStatusFilter) return false;
      return true;
    });
    const limitedDevices = filteredDevices.slice(0, limit);

    return reply.send({
      ...basePayload("operator_devices_alerts_api"),
      ackCloseReady: false,
      revokeVisible: false,
      total_devices: filteredDevices.length,
      returned_devices: limitedDevices.length,
      filters: {
        limit,
        fieldId: fieldIdFilter,
        deviceId: deviceIdFilter,
        onlineStatus: onlineStatusFilter,
      },
      devices: limitedDevices,
      alerts,
      message: "operator devices-alerts read-only facade",
    });
  });

  app.get("/api/v1/operator/field-memory", async (req: any, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["field_memory.read", "ao_act.index.read"]);
    if (!auth) {
      if (!reply.sent) return reply.code(403).send({ error: "FORBIDDEN", message: "当前身份无权查看运营田块记忆明细。" });
      return;
    }
    const query = (req.query ?? {}) as { field_id?: string; operation_id?: string; memory_type?: string };
    const items = await buildFieldMemory(pool, query);
    return reply.send({
      ...basePayload("operator_field_memory_api"),
      filters: {
        fieldId: safeText(query.field_id),
        operationId: safeText(query.operation_id),
        memoryType: safeText(query.memory_type),
      },
      items,
      message: "operator field-memory read-only facade",
    });
  });

  app.get("/api/v1/operator/roi-ledger", async (req: any, reply) => {
    const query = (req.query ?? {}) as { field_id?: string; operation_id?: string };
    const items = await buildRoiLedger(pool, query);
    return reply.send({
      ...basePayload("operator_roi_ledger_api"),
      filters: {
        fieldId: safeText(query.field_id),
        operationId: safeText(query.operation_id),
      },
      items,
      message: "operator roi-ledger read-only facade",
    });
  });
}
