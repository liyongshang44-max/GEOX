import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  requireFieldAllowedOr404V1,
  requireTenantMatchOr404V1,
  requireTenantScopeV1,
  tenantFromQueryOrAuthV1,
} from "../auth/tenant_scope_v1.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type AnyRecord = Record<string, any>;

type QueryInput = {
  tenant_id?: string;
  project_id?: string;
  group_id?: string;
  field_id?: string;
  operation_id?: string;
  memory_type?: string;
  limit?: string | number;
};

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return fallback;
  return raw;
}

function limitFromQuery(value: unknown, fallback = 100, max = 200): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(n)));
}

function msToIso(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n).toISOString();
  } catch {
    return null;
  }
}

function dateToIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = text(value, "");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 10_000_000_000) return msToIso(n);
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : raw;
}

function normalizeJson(value: unknown, fallback: any): any {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return fallback;
}

function arrayFromJson(value: unknown): any[] {
  const parsed = normalizeJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function sanitizeText(value: unknown, fallback = ""): string {
  const raw = text(value, "");
  if (!raw) return fallback;
  if (/secret|token|access[_-]?key|password|credential_payload/i.test(raw)) return "敏感凭据已隐藏";
  if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("/") || raw.includes("file://")) return "本地路径已隐藏";
  return raw.length > 128 ? `${raw.slice(0, 64)}...${raw.slice(-24)}` : raw;
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const q = await pool.query(`SELECT to_regclass($1)::text AS table_name`, [`public.${tableName}`]);
  return Boolean(q.rows?.[0]?.table_name);
}

async function selectTenantRows(pool: Pool, tableName: string, tenant_id: string, limit = 200): Promise<AnyRecord[]> {
  if (!(await tableExists(pool, tableName))) return [];
  const q = await pool.query(`SELECT * FROM ${tableName} WHERE tenant_id = $1 LIMIT $2`, [tenant_id, limit]);
  return q.rows ?? [];
}

async function fieldNameMap(pool: Pool, tenant_id: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!(await tableExists(pool, "field_index_v1"))) return map;
  const q = await pool.query(`SELECT * FROM field_index_v1 WHERE tenant_id = $1 LIMIT 500`, [tenant_id]);
  for (const row of q.rows ?? []) {
    const fieldId = text(row.field_id, "");
    const name = text(row.name ?? row.field_name, "");
    if (fieldId && name) map.set(fieldId, name);
  }
  return map;
}

function latestBy<T extends AnyRecord>(rows: T[], key: string, tsKeys: string[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const id = text(row[key], "");
    if (!id) continue;
    const old = map.get(id);
    const currentTs = Math.max(...tsKeys.map((k) => Number(row[k] ?? 0)).filter((n) => Number.isFinite(n)));
    const oldTs = old ? Math.max(...tsKeys.map((k) => Number(old[k] ?? 0)).filter((n) => Number.isFinite(n))) : -1;
    if (!old || currentTs >= oldTs) map.set(id, row);
  }
  return map;
}

function capabilitiesFrom(row: AnyRecord | undefined): string[] {
  if (!row) return [];
  const raw = row.capabilities ?? row.capabilities_json ?? row.device_capabilities;
  const parsed = normalizeJson(raw, []);
  if (Array.isArray(parsed)) return parsed.map((x) => sanitizeText(x, "")).filter(Boolean).slice(0, 12);
  const single = sanitizeText(parsed, "");
  return single ? [single] : [];
}

function normalizeDeviceStatus(statusRow: AnyRecord | undefined): "ONLINE" | "OFFLINE" | "DELAYED" | "UNKNOWN" {
  if (!statusRow) return "UNKNOWN";
  const raw = text(statusRow.connection_status ?? statusRow.online_status ?? statusRow.status, "").toUpperCase();
  if (raw.includes("ONLINE")) return "ONLINE";
  if (raw.includes("OFFLINE")) return "OFFLINE";
  if (raw.includes("DELAY") || raw.includes("STALE")) return "DELAYED";
  const lastHeartbeat = Number(statusRow.last_heartbeat_ts_ms ?? 0);
  if (Number.isFinite(lastHeartbeat) && lastHeartbeat > Date.now() - 15 * 60 * 1000) return "ONLINE";
  if (Number.isFinite(lastHeartbeat) && lastHeartbeat > 0) return "OFFLINE";
  return "UNKNOWN";
}

async function buildDevicesAlerts(pool: Pool, tenant: TenantTriple): Promise<{ devices: AnyRecord[]; alerts: AnyRecord[]; notes: string[] }> {
  const notes: string[] = [];
  const [fieldNames, deviceRows, statusRows, bindingRows, credentialRows, capabilityRows] = await Promise.all([
    fieldNameMap(pool, tenant.tenant_id),
    selectTenantRows(pool, "device_index_v1", tenant.tenant_id, 300),
    selectTenantRows(pool, "device_status_index_v1", tenant.tenant_id, 300),
    selectTenantRows(pool, "device_binding_index_v1", tenant.tenant_id, 300),
    selectTenantRows(pool, "device_credential_index_v1", tenant.tenant_id, 500),
    selectTenantRows(pool, "device_capability", tenant.tenant_id, 300),
  ]);

  const statusByDevice = latestBy(statusRows, "device_id", ["last_heartbeat_ts_ms", "last_telemetry_ts_ms"]);
  const bindingByDevice = latestBy(bindingRows, "device_id", ["bound_ts_ms", "updated_ts_ms", "created_ts_ms"]);
  const credentialByDevice = latestBy(credentialRows, "device_id", ["issued_ts_ms", "revoked_ts_ms", "last_used_ts_ms", "updated_ts_ms"]);
  const capabilitiesByDevice = latestBy(capabilityRows, "device_id", ["updated_ts_ms"]);
  const deviceIds = new Set<string>();
  for (const row of deviceRows) if (text(row.device_id, "")) deviceIds.add(text(row.device_id));
  for (const row of statusRows) if (text(row.device_id, "")) deviceIds.add(text(row.device_id));

  const devices = Array.from(deviceIds).sort().map((deviceId) => {
    const device = deviceRows.find((row) => text(row.device_id) === deviceId) ?? {};
    const status = statusByDevice.get(deviceId) ?? {};
    const binding = bindingByDevice.get(deviceId) ?? {};
    const credential = credentialByDevice.get(deviceId) ?? {};
    const capability = capabilitiesByDevice.get(deviceId);
    const fieldId = text(status.field_id ?? binding.field_id ?? device.field_id, "");
    const credentialStatus = text(device.last_credential_status ?? credential.status, "UNKNOWN").toUpperCase();
    return {
      device_id: sanitizeText(deviceId),
      display_name: sanitizeText(device.display_name ?? device.name, ""),
      online_status: normalizeDeviceStatus(status),
      last_heartbeat_at: msToIso(status.last_heartbeat_ts_ms),
      last_telemetry_at: msToIso(status.last_telemetry_ts_ms),
      field_id: sanitizeText(fieldId, ""),
      field_name: fieldId ? sanitizeText(fieldNames.get(fieldId), "") : "",
      capabilities: capabilitiesFrom(capability),
      credential_status: credentialStatus || "UNKNOWN",
      credential_last_issued_at: msToIso(credential.issued_ts_ms ?? credential.created_ts_ms),
      credential_last_used_at: msToIso(credential.last_used_ts_ms ?? credential.last_used_at),
      revoke_status: credentialStatus === "REVOKED" ? "REVOKED" : "只读或管理员可见",
      can_revoke: false,
      battery_percent: Number.isFinite(Number(status.battery_percent)) ? Number(status.battery_percent) : null,
      data_delay_text: status.last_telemetry_ts_ms ? null : "telemetry 时间待确认",
    };
  });

  const alerts = await buildOperatorAlerts(pool, tenant, fieldNames);
  if (!(await tableExists(pool, "device_index_v1"))) notes.push("device_index_v1 not ready");
  if (!(await tableExists(pool, "alert_event_index_v1"))) notes.push("alert_event_index_v1 not ready");
  return { devices, alerts, notes };
}

async function buildOperatorAlerts(pool: Pool, tenant: TenantTriple, fieldNames: Map<string, string>): Promise<AnyRecord[]> {
  if (!(await tableExists(pool, "alert_event_index_v1"))) return [];
  const eventsQ = await pool.query(`SELECT * FROM alert_event_index_v1 WHERE tenant_id = $1 ORDER BY COALESCE(raised_ts_ms, 0) DESC LIMIT 200`, [tenant.tenant_id]);
  const events = eventsQ.rows ?? [];
  const rules = await selectTenantRows(pool, "alert_rule_index_v1", tenant.tenant_id, 500);
  const notifications = await selectTenantRows(pool, "alert_notification_index_v1", tenant.tenant_id, 500);
  const actions = await selectTenantRows(pool, "alert_actions_v1", tenant.tenant_id, 500);
  const ruleById = new Map(rules.map((row) => [text(row.rule_id), row]));
  const notificationByEvent = latestBy(notifications, "event_id", ["created_ts_ms", "delivered_ts_ms"]);
  const actionByAlert = latestBy(actions, "alert_id", ["acted_at"]);
  const deviceBindings = latestBy(await selectTenantRows(pool, "device_binding_index_v1", tenant.tenant_id, 300), "device_id", ["bound_ts_ms", "updated_ts_ms"]);

  return events.map((event, index) => {
    const eventId = text(event.event_id, `alert-${index}`);
    const rule = ruleById.get(text(event.rule_id)) ?? {};
    const action = actionByAlert.get(eventId);
    const notification = notificationByEvent.get(eventId);
    const objectType = text(event.object_type, "").toUpperCase();
    const objectId = text(event.object_id, "");
    const fieldId = objectType === "FIELD" ? objectId : text(event.field_id ?? (objectType === "DEVICE" ? deviceBindings.get(objectId)?.field_id : ""), "");
    const status = text(action?.status ?? event.status, "OPEN").toUpperCase();
    return {
      alert_id: sanitizeText(eventId),
      rule_name: sanitizeText(rule.rule_name ?? rule.name ?? event.rule_id, "告警规则待确认"),
      event_text: sanitizeText(event.metric ?? event.reason ?? event.object_type ?? "告警事件待确认"),
      notification_status: sanitizeText(notification?.status, "通知状态待确认"),
      status,
      ack_status: event.acked_ts_ms || status === "ACKED" ? "已 ACK" : "未 ACK",
      close_status: event.closed_ts_ms || status === "CLOSED" ? "已关闭" : "未关闭",
      owner_name: sanitizeText(rule.owner_name ?? rule.owner, "责任人待确认"),
      field_id: sanitizeText(fieldId, ""),
      field_name: fieldId ? sanitizeText(fieldNames.get(fieldId), "") : "",
      operation_id: sanitizeText(event.operation_id ?? event.operation_plan_id, ""),
      prescription_formed: event.prescription_id ? true : null,
      overdue: false,
      created_at: msToIso(event.raised_ts_ms),
      updated_at: msToIso(action?.acted_at ?? event.closed_ts_ms ?? event.acked_ts_ms ?? event.raised_ts_ms),
      can_ack: false,
      can_close: false,
      permission_reason: "告警写操作未在 operator facade 中开放",
      audit_id: action ? `alert_action:${sanitizeText(action.alert_id)}:${sanitizeText(action.acted_at)}` : "审计来源待确认",
      status_source: "operator_devices_alerts_facade",
    };
  });
}

async function buildOperatorFieldMemory(pool: Pool, tenant: TenantTriple, query: QueryInput): Promise<AnyRecord[]> {
  if (!(await tableExists(pool, "field_memory_v1"))) return [];
  const where = ["tenant_id = $1", "project_id = $2", "group_id = $3"];
  const values: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
  const add = (column: string, value?: string) => {
    const normalized = text(value, "");
    if (!normalized) return;
    values.push(normalized);
    where.push(`${column} = $${values.length}`);
  };
  add("field_id", query.field_id);
  add("operation_id", query.operation_id);
  add("memory_type", query.memory_type);
  const limit = limitFromQuery(query.limit);
  values.push(limit);
  const q = await pool.query(
    `SELECT * FROM field_memory_v1 WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC LIMIT $${values.length}`,
    values,
  );
  return (q.rows ?? []).map((row: AnyRecord) => ({
    memory_id: sanitizeText(row.memory_id),
    field_id: sanitizeText(row.field_id, ""),
    operation_id: sanitizeText(row.operation_id, ""),
    memory_type: sanitizeText(row.memory_type, "类型待确认"),
    before: row.before_value ?? null,
    after: row.after_value ?? row.metric_value ?? null,
    delta: row.delta_value ?? null,
    confidence: row.confidence ?? null,
    skill_refs: [row.skill_id, row.skill_trace_ref].filter(Boolean).map((x) => sanitizeText(x)),
    evidence_refs: arrayFromJson(row.evidence_refs).map((x) => sanitizeText(typeof x === "object" ? x.evidence_id ?? x.id ?? x.ref : x)).filter(Boolean),
    recommendation_id: sanitizeText(row.recommendation_id, ""),
    task_id: sanitizeText(row.task_id, ""),
    acceptance_id: sanitizeText(row.acceptance_id, ""),
    roi_id: sanitizeText(row.roi_id, ""),
    created_at: dateToIso(row.occurred_at),
    updated_at: dateToIso(row.occurred_at),
    metric_key: sanitizeText(row.metric_key, ""),
    source_type: sanitizeText(row.source_type, ""),
  }));
}

async function buildOperatorRoiLedger(pool: Pool, tenant: TenantTriple, query: QueryInput): Promise<AnyRecord[]> {
  if (!(await tableExists(pool, "roi_ledger_v1"))) return [];
  const where = ["tenant_id = $1", "project_id = $2", "group_id = $3"];
  const values: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
  const add = (column: string, value?: string) => {
    const normalized = text(value, "");
    if (!normalized) return;
    values.push(normalized);
    where.push(`${column} = $${values.length}`);
  };
  add("field_id", query.field_id);
  add("operation_id", query.operation_id);
  const limit = limitFromQuery(query.limit);
  values.push(limit);
  const q = await pool.query(
    `SELECT * FROM roi_ledger_v1 WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length}`,
    values,
  );
  return (q.rows ?? []).map((row: AnyRecord) => {
    const baselinePresent = row.baseline_value !== null && row.baseline_value !== undefined;
    const evidenceRefs = arrayFromJson(row.evidence_refs);
    const confidence = normalizeJson(row.confidence, {});
    const confidencePresent = Boolean(confidence && typeof confidence === "object" && (confidence.level || confidence.basis));
    const valueKind = baselinePresent && evidenceRefs.length > 0 && confidencePresent && text(row.value_kind).toUpperCase() === "MEASURED"
      ? "MEASURED"
      : text(row.value_kind, baselinePresent ? "ESTIMATED" : "INSUFFICIENT_EVIDENCE");
    return {
      roi_id: sanitizeText(row.roi_ledger_id),
      roi_ledger_id: sanitizeText(row.roi_ledger_id),
      field_id: sanitizeText(row.field_id, ""),
      operation_id: sanitizeText(row.operation_id, ""),
      prescription_id: sanitizeText(row.prescription_id, ""),
      evidence_ref: evidenceRefs.map((x) => sanitizeText(typeof x === "object" ? x.evidence_id ?? x.id ?? x.ref : x)).filter(Boolean).join(", "),
      evidence_refs: evidenceRefs,
      calculation_method: sanitizeText(row.calculation_method, "manual_or_external_v1"),
      confidence,
      assumption: normalizeJson(row.assumptions, {}),
      assumptions: normalizeJson(row.assumptions, {}),
      created_at: dateToIso(row.created_at),
      baseline_present: baselinePresent,
      actual_present: row.actual_value !== null && row.actual_value !== undefined,
      value_kind: valueKind,
      roi_type: sanitizeText(row.roi_type, "ROI"),
      baseline_value: row.baseline_value,
      actual_value: row.actual_value,
      delta_value: row.delta_value,
      unit: sanitizeText(row.unit, ""),
    };
  });
}

function authTenant(req: any, reply: any, scopes: any[]): { auth: any; tenant: TenantTriple } | null {
  const auth = requireAoActAnyScopeV0(req, reply, scopes);
  if (!auth) return null;
  const query = (req.query ?? {}) as QueryInput;
  const tenant = tenantFromQueryOrAuthV1(query, auth);
  if (!requireTenantScopeV1(reply, tenant)) return null;
  if (!requireTenantMatchOr404V1(reply, auth, tenant)) return null;
  return { auth, tenant };
}

export function registerOperatorDiagnosticsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/devices-alerts", async (req: any, reply) => {
    const ctx = authTenant(req, reply, ["devices.read", "devices.status.read", "alerts.read", "ao_act.index.read"]);
    if (!ctx) return;
    const result = await buildDevicesAlerts(pool, ctx.tenant);
    return reply.send({
      ok: true,
      source: "operator_devices_alerts_facade",
      generated_at: new Date().toISOString(),
      devices: result.devices,
      alerts: result.alerts,
      ack_close_ready: false,
      revoke_visible: false,
      notes: result.notes,
    });
  });

  app.get("/api/v1/operator/field-memory", async (req: any, reply) => {
    const ctx = authTenant(req, reply, ["field_memory.read", "ao_act.index.read"]);
    if (!ctx) return;
    const query = (req.query ?? {}) as QueryInput;
    if (query.field_id && !requireFieldAllowedOr404V1(reply, ctx.auth, query.field_id)) return;
    const items = await buildOperatorFieldMemory(pool, ctx.tenant, query);
    return reply.send({
      ok: true,
      source: "operator_field_memory_facade",
      generated_at: new Date().toISOString(),
      items,
      filters: {
        field_id: text(query.field_id, ""),
        operation_id: text(query.operation_id, ""),
        memory_type: text(query.memory_type, ""),
      },
    });
  });

  app.get("/api/v1/operator/roi-ledger", async (req: any, reply) => {
    const ctx = authTenant(req, reply, ["roi_ledger.read", "ao_act.index.read"]);
    if (!ctx) return;
    const query = (req.query ?? {}) as QueryInput;
    if (query.field_id && !requireFieldAllowedOr404V1(reply, ctx.auth, query.field_id)) return;
    const items = await buildOperatorRoiLedger(pool, ctx.tenant, query);
    return reply.send({
      ok: true,
      source: "operator_roi_ledger_facade",
      generated_at: new Date().toISOString(),
      items,
      filters: {
        field_id: text(query.field_id, ""),
        operation_id: text(query.operation_id, ""),
      },
    });
  });
}
