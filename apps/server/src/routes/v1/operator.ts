import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";

const DATA_SCOPE = "OFFICIAL_OPERATOR_API";

type Row = Record<string, unknown>;

type WorkbenchQueue =
  | "APPROVAL_PENDING"
  | "DISPATCH_PENDING"
  | "EXECUTION_EXCEPTION"
  | "ACCEPTANCE_PENDING"
  | "EVIDENCE_INSUFFICIENT"
  | "ACCEPTANCE_FAILED"
  | "DEVICE_OFFLINE"
  | "ALERT_OVERDUE";

function normalizePriority(value: unknown): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const raw = safeText(value).toUpperCase();
  if (raw === "LOW" || raw === "MEDIUM" || raw === "HIGH" || raw === "CRITICAL") return raw;
  return "MEDIUM";
}

function asIsoOrNow(value: unknown): string {
  return toIsoAny(value) ?? new Date().toISOString();
}

async function buildOperatorWorkbench(pool: Pool, limit: number): Promise<Row[]> {
  const [
    approvalRows,
    approvalRowsV1,
    operationRows,
    deviceStatusRows,
    alertRows,
  ] = await Promise.all([
    readTenantRows(pool, "approval_request", limit),
    readTenantRows(pool, "approval_requests_v1", limit),
    readTenantRows(pool, "operation_state_v1", limit),
    readTenantRows(pool, "device_status_index_v1", limit),
    readTenantRows(pool, "alert_event_index_v1", limit),
  ]);

  const items: Row[] = [];
  const pushItem = (id: string, queue: WorkbenchQueue, title: string, description: string, updatedAt: unknown, operationId?: string) => {
    items.push({
      id,
      queue,
      title,
      description,
      field_name: null,
      operation_name: nullableText(operationId),
      priority: "MEDIUM",
      updated_at: asIsoOrNow(updatedAt),
      action_href: queue === "APPROVAL_PENDING" ? "/operator/approvals" : "/operator/workbench",
      related_href: operationId ? `/customer/operations/${operationId}` : null,
    });
  };

  for (const row of [...approvalRows, ...approvalRowsV1]) {
    const status = safeText(row.status ?? row.approval_status).toUpperCase();
    if (!["PENDING", "OPEN", "WAITING"].some((x) => status.includes(x))) continue;
    const id = safeText(row.request_id ?? row.approval_request_id ?? row.id);
    if (!id) continue;
    const opId = safeText(row.operation_id ?? row.operation_plan_id);
    pushItem(`approval_${id}`, "APPROVAL_PENDING", "待审批事项", "建议或处方等待审批。", row.updated_at ?? row.created_at ?? row.requested_at, opId);
  }

  for (const row of operationRows) {
    const status = safeText(row.final_status).toUpperCase();
    const opId = safeText(row.operation_id ?? row.operation_plan_id ?? row.id);
    const updatedAt = row.updated_at ?? row.updated_ts_ms ?? row.created_at;
    if (status === "PENDING_ACCEPTANCE") pushItem(`acceptance_${opId || items.length}`, "ACCEPTANCE_PENDING", "待验收作业", "作业已执行，等待验收。", updatedAt, opId);
    if (status === "INVALID_EXECUTION") pushItem(`execution_${opId || items.length}`, "EXECUTION_EXCEPTION", "执行异常", "作业执行结果异常，需运营介入。", updatedAt, opId);
  }

  for (const row of deviceStatusRows) {
    const deviceId = safeText(row.device_id);
    if (!deviceId) continue;
    const lastHeartbeatMs = Number(row.last_heartbeat_ts_ms ?? 0);
    if (!Number.isFinite(lastHeartbeatMs) || lastHeartbeatMs <= 0) continue;
    if (Date.now() - lastHeartbeatMs <= 15 * 60 * 1000) continue;
    items.push({
      id: `device_offline_${deviceId}`,
      queue: "DEVICE_OFFLINE",
      title: "设备离线",
      description: "设备心跳超时，请排查在线状态。",
      field_name: null,
      operation_name: null,
      priority: normalizePriority(row.priority),
      updated_at: asIsoOrNow(lastHeartbeatMs),
      action_href: "/operator/devices-alerts",
      related_href: null,
    });
  }

  for (const row of alertRows) {
    const alertId = safeText(row.event_id ?? row.alert_id ?? row.id);
    if (!alertId) continue;
    const status = safeText(row.status).toUpperCase();
    if (status && status.includes("CLOSED")) continue;
    const overdue = Boolean(row.overdue) || (Number(row.raised_ts_ms ?? 0) > 0 && Date.now() - Number(row.raised_ts_ms) > 24 * 60 * 60 * 1000);
    if (!overdue) continue;
    items.push({
      id: `alert_overdue_${alertId}`,
      queue: "ALERT_OVERDUE",
      title: "告警超时未处理",
      description: "存在超时未处理告警。",
      field_name: null,
      operation_name: nullableText(row.operation_id ?? row.operation_plan_id),
      priority: normalizePriority(row.severity),
      updated_at: asIsoOrNow(row.updated_at ?? row.raised_ts_ms),
      action_href: "/operator/devices-alerts",
      related_href: null,
    });
  }

  return items
    .sort((a, b) => new Date(String(b.updated_at ?? 0)).getTime() - new Date(String(a.updated_at ?? 0)).getTime())
    .slice(0, limit);
}


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

function parseObjectLike(value: unknown, scalarKey: string): Record<string, unknown> | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && !Array.isArray(value)) return sanitizeStructured(value) as Record<string, unknown>;
  if (typeof value === "string") {
    const normalized = safeText(value);
    if (!normalized) return null;
    try {
      const parsed = JSON.parse(normalized);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return sanitizeStructured(parsed) as Record<string, unknown>;
    } catch {
      // not JSON object, fallback to scalar wrapper
    }
    return { [scalarKey]: normalized };
  }
  const normalizedScalar = safeText(value);
  if (!normalizedScalar) return null;
  return { [scalarKey]: normalizedScalar };
}

function normalizeRefList(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.map((item) => normalizeRef(item)).filter((x): x is string => Boolean(x));
  const normalized = normalizeRef(value);
  return normalized ? [normalized] : [];
}

function sanitizeStructured(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return safeText(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeStructured(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|access[_-]?key|credential_payload|password|private\s*key/i.test(k)) continue;
      output[k] = sanitizeStructured(v);
    }
    return output;
  }
  return value;
}




type DispatchStatus =
  | "TASK_CREATED"
  | "DISPATCH_PENDING"
  | "DISPATCHED"
  | "ACKED"
  | "RECEIPT_PENDING"
  | "EXECUTION_FAILED"
  | "RECEIPT_RECEIVED"
  | "UNKNOWN";

function normalizeExecutionMode(value: unknown): "HUMAN" | "DEVICE" | "UNKNOWN" {
  const raw = safeText(value).toUpperCase();
  if (raw.includes("HUMAN") || raw.includes("MANUAL")) return "HUMAN";
  if (raw.includes("DEVICE") || raw.includes("AUTO")) return "DEVICE";
  return "UNKNOWN";
}

function normalizeDispatchStatus(task: Row, receipt: Row | null): DispatchStatus {
  const raw = safeText(task.status ?? task.task_status ?? task.dispatch_status ?? task.state ?? task.final_status).toUpperCase();
  const receiptStatus = safeText(receipt?.status ?? receipt?.result ?? receipt?.execution_status).toUpperCase();
  if (receipt && ["FAILED", "FAIL", "ERROR"].some((x) => receiptStatus.includes(x))) return "EXECUTION_FAILED";
  if (receipt) return "RECEIPT_RECEIVED";
  if (["FAILED", "FAIL", "ERROR"].some((x) => raw.includes(x))) return "EXECUTION_FAILED";
  if (raw.includes("ACK")) return "ACKED";
  if (raw.includes("DISPATCHED") || raw.includes("ISSUED") || raw.includes("SENT")) return "DISPATCHED";
  if (raw.includes("PENDING") && raw.includes("DISPATCH")) return "DISPATCH_PENDING";
  if (raw.includes("CREATED") || raw.includes("NEW")) return "TASK_CREATED";
  if (raw.includes("RECEIPT") && raw.includes("PENDING")) return "RECEIPT_PENDING";
  return "UNKNOWN";
}

async function readMultiRows(pool: Pool, tables: string[], limit = 300): Promise<Row[]> {
  const chunks = await Promise.all(tables.map((t) => readTenantRows(pool, t, limit)));
  return chunks.flat();
}

async function buildOperatorDispatch(pool: Pool, limit: number): Promise<Row[]> {
  const [taskRows, receiptRows, operationRows] = await Promise.all([
    readMultiRows(pool, ["act_task", "action_task_index_v1", "act_task_index_v1"], limit),
    readMultiRows(pool, ["receipt", "receipt_index_v1", "execution_receipt", "action_receipt_index_v1"], limit),
    readTenantRows(pool, "operation_state_v1", limit),
  ]);

  const opById = new Map(operationRows.map((row) => [safeText(row.operation_id ?? row.operation_plan_id ?? row.id), row]));
  const receiptByTask = new Map<string, Row>();
  for (const row of receiptRows) {
    const taskId = safeText(row.task_id ?? row.act_task_id ?? row.action_task_id);
    if (taskId && !receiptByTask.has(taskId)) receiptByTask.set(taskId, row);
  }

  const items: Row[] = [];
  for (const task of taskRows) {
    const taskId = safeText(task.task_id ?? task.act_task_id ?? task.action_task_id ?? task.id);
    if (!taskId) continue;
    const operationId = safeText(task.operation_id ?? task.operation_plan_id ?? task.op_id);
    const op = opById.get(operationId) ?? {};
    const receipt = receiptByTask.get(taskId) ?? null;
    const status = normalizeDispatchStatus(task, receipt);
    const receiptId = safeText(receipt?.receipt_id ?? receipt?.id);
    items.push({
      task_id: taskId,
      receipt_id: receiptId || null,
      operation_id: operationId || null,
      field_name: nullableText(task.field_name ?? op.field_name),
      operation_name: nullableText(task.operation_name ?? op.operation_name),
      status,
      execution_mode: normalizeExecutionMode(task.execution_mode ?? task.executor_type ?? task.mode),
      task_created_at: toIsoAny(task.created_at ?? task.created_ts_ms),
      dispatched_at: toIsoAny(task.dispatched_at ?? task.dispatch_ts_ms ?? task.updated_at),
      acked_at: toIsoAny(task.acked_at ?? task.ack_ts_ms),
      receipt_received_at: toIsoAny(receipt?.received_at ?? receipt?.created_at ?? receipt?.created_ts_ms),
      executor_text: nullableText(task.executor_text ?? task.executor_id ?? task.device_id ?? task.actor_id),
      failure_reason: nullableText(receipt?.failure_reason ?? task.failure_reason ?? receipt?.error_message),
      task_href: operationId ? `/customer/operations/${operationId}` : null,
      receipt_href: receiptId ? `/api/v1/receipts/${receiptId}` : null,
    });
  }

  return items
    .sort((a, b) => new Date(String(b.dispatched_at ?? b.task_created_at ?? 0)).getTime() - new Date(String(a.dispatched_at ?? a.task_created_at ?? 0)).getTime())
    .slice(0, limit);
}



type AcceptanceStatus = "PENDING" | "EVIDENCE_INSUFFICIENT" | "FAILED" | "REVIEW_REQUIRED" | "PASSED" | "UNKNOWN";

function normalizeAcceptanceStatus(acceptance: Row | null, operation: Row): AcceptanceStatus {
  const verdict = safeText(acceptance?.verdict ?? acceptance?.acceptance_verdict).toUpperCase();
  const raw = safeText(acceptance?.status ?? acceptance?.acceptance_status ?? operation.final_status ?? operation.acceptance_status).toUpperCase();
  const missingEvidence = Boolean(acceptance?.missing_evidence) || raw.includes("EVIDENCE_INSUFFICIENT") || raw.includes("INSUFFICIENT_EVIDENCE");
  if (missingEvidence) return "EVIDENCE_INSUFFICIENT";
  if (verdict.includes("PASS") || raw.includes("PASS")) return "PASSED";
  if (verdict.includes("FAIL") || raw.includes("FAIL") || raw.includes("INVALID_EXECUTION")) return "FAILED";
  if (raw.includes("REVIEW")) return "REVIEW_REQUIRED";
  if (raw.includes("PENDING_ACCEPTANCE") || raw.includes("PENDING")) return "PENDING";
  return "UNKNOWN";
}

async function buildOperatorAcceptance(pool: Pool, limit: number): Promise<Row[]> {
  const [operationRows, acceptanceRows, acceptanceResultRows, evidenceRows] = await Promise.all([
    readTenantRows(pool, "operation_state_v1", limit),
    readMultiRows(pool, ["acceptance", "acceptance_index_v1"], limit),
    readMultiRows(pool, ["acceptance_result", "acceptance_result_v1"], limit),
    readMultiRows(pool, ["evidence_summary", "evidence_bundle_summary_v1"], limit),
  ]);

  const acceptanceByOperation = new Map<string, Row>();
  for (const row of [...acceptanceRows, ...acceptanceResultRows]) {
    const operationId = safeText(row.operation_id ?? row.operation_plan_id ?? row.op_id ?? row.task_id);
    if (!operationId || acceptanceByOperation.has(operationId)) continue;
    acceptanceByOperation.set(operationId, row);
  }
  const evidenceByOperation = new Map<string, Row>();
  for (const row of evidenceRows) {
    const operationId = safeText(row.operation_id ?? row.operation_plan_id ?? row.op_id);
    if (operationId && !evidenceByOperation.has(operationId)) evidenceByOperation.set(operationId, row);
  }

  const items = operationRows.map((op) => {
    const operationId = safeText(op.operation_id ?? op.operation_plan_id ?? op.id);
    const acceptance = acceptanceByOperation.get(operationId) ?? null;
    const evidence = evidenceByOperation.get(operationId) ?? null;
    const acceptanceStatus = normalizeAcceptanceStatus(acceptance, op);
    const evidenceInsufficient = acceptanceStatus === "EVIDENCE_INSUFFICIENT" || Boolean(evidence?.insufficient) || Number(evidence?.evidence_count ?? 1) <= 0;
    return {
      operation_id: operationId || null,
      acceptance_id: nullableText(acceptance?.acceptance_id ?? acceptance?.id),
      field_name: nullableText(op.field_name),
      operation_name: nullableText(op.operation_name),
      acceptance_status: acceptanceStatus,
      operation_state_status: nullableText(op.final_status ?? op.status),
      evidence_insufficient: evidenceInsufficient,
      failure_reason: nullableText(acceptance?.failure_reason ?? op.failure_reason),
      review_reason: nullableText(acceptance?.review_reason),
      acceptance_verdict: nullableText(acceptance?.verdict ?? acceptance?.acceptance_verdict),
      generated_at: toIsoAny(acceptance?.generated_at ?? acceptance?.created_at ?? op.created_at),
      updated_at: toIsoAny(acceptance?.updated_at ?? op.updated_at ?? op.updated_ts_ms),
      can_evaluate: false,
      can_request_review: false,
      permission_reason: "验收写操作未接入，当前只读。",
    };
  });

  return items
    .sort((a, b) => new Date(String(b.updated_at ?? b.generated_at ?? 0)).getTime() - new Date(String(a.updated_at ?? a.generated_at ?? 0)).getTime())
    .slice(0, limit);
}



type EvidenceJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "UNKNOWN";
type EvidenceStorageMode = "OBJECT_STORE" | "LOCAL" | "INLINE" | "NOT_READY" | "UNKNOWN";
type EvidenceScopeStatus = "READY" | "NOT_READY" | "UNKNOWN";

function normalizeEvidenceStatus(value: unknown): EvidenceJobStatus {
  const raw = safeText(value).toUpperCase();
  if (["PENDING", "QUEUED"].some((x) => raw.includes(x))) return "PENDING";
  if (["RUNNING", "PROCESSING"].some((x) => raw.includes(x))) return "RUNNING";
  if (["DONE", "SUCCESS", "COMPLETED"].some((x) => raw.includes(x))) return "DONE";
  if (["FAILED", "ERROR"].some((x) => raw.includes(x))) return "FAILED";
  return "UNKNOWN";
}

function normalizeStorageMode(value: unknown): EvidenceStorageMode {
  const raw = safeText(value).toUpperCase();
  if (raw.includes("OBJECT") || raw.includes("S3") || raw.includes("OSS")) return "OBJECT_STORE";
  if (raw.includes("LOCAL")) return "LOCAL";
  if (raw.includes("INLINE")) return "INLINE";
  if (raw.includes("NOT_READY")) return "NOT_READY";
  return "UNKNOWN";
}

function normalizeScopeStatus(value: unknown): EvidenceScopeStatus {
  const raw = safeText(value).toUpperCase();
  if (raw.includes("READY")) return raw.includes("NOT") ? "NOT_READY" : "READY";
  return "UNKNOWN";
}

function sanitizeArtifact(value: unknown): string | null {
  const v = safeText(value);
  if (!v) return null;
  if (v.startsWith("/") || /^[a-zA-Z]:\\/.test(v)) return "local_path_redacted";
  return v.replace(/https?:\/\/[^\s]+/gi, "redacted_link");
}

async function buildOperatorEvidence(pool: Pool, limit: number): Promise<Row[]> {
  const [exportRows, bundleRows, summaryRows, operationRows] = await Promise.all([
    readMultiRows(pool, ["evidence_export_job", "evidence_export_jobs", "evidence_export_job_v1"], limit),
    readMultiRows(pool, ["evidence_bundle", "evidence_manifest", "evidence_bundle_v1"], limit),
    readMultiRows(pool, ["operation_evidence_summary", "evidence_summary", "evidence_bundle_summary_v1"], limit),
    readTenantRows(pool, "operation_state_v1", limit),
  ]);

  const opById = new Map(operationRows.map((x) => [safeText(x.operation_id ?? x.operation_plan_id ?? x.id), x]));
  const summaryByOp = new Map(summaryRows.map((x) => [safeText(x.operation_id ?? x.operation_plan_id ?? x.scope_id), x]));
  const bundleByOp = new Map(bundleRows.map((x) => [safeText(x.operation_id ?? x.operation_plan_id ?? x.scope_id), x]));

  const items = exportRows.map((job, idx) => {
    const operationId = safeText(job.operation_id ?? job.operation_plan_id ?? job.scope_id);
    const summary = summaryByOp.get(operationId) ?? {};
    const bundle = bundleByOp.get(operationId) ?? {};
    const op = opById.get(operationId) ?? {};
    const status = normalizeEvidenceStatus(job.status ?? job.job_status);
    const storageMode = normalizeStorageMode(job.storage_mode ?? job.artifact_mode ?? bundle.storage_mode);
    return {
      job_id: safeText(job.job_id ?? job.id ?? `job_${idx}`),
      operation_id: operationId || null,
      scope_type: safeText(job.scope_type ?? "operation").toLowerCase() || "operation",
      scope_id: nullableText(job.scope_id ?? operationId),
      scope_status: normalizeScopeStatus(job.scope_status ?? summary.scope_status ?? (op.operation_id ? "READY" : "UNKNOWN")),
      status,
      manifest: nullableText(job.manifest ?? bundle.manifest ?? summary.manifest),
      sha256: nullableText(job.sha256 ?? bundle.sha256 ?? summary.sha256),
      artifact: sanitizeArtifact(job.artifact ?? job.artifact_key ?? bundle.artifact_key),
      format: nullableText(job.format ?? job.export_format ?? "zip"),
      storage_mode: storageMode,
      download_status: status === "DONE" ? "可由后端授权下载" : "尚不可下载",
      created_at: toIsoAny(job.created_at ?? job.created_ts_ms),
      completed_at: toIsoAny(job.completed_at ?? job.finished_at ?? job.updated_at),
      failure_reason: nullableText(job.failure_reason ?? job.error_message),
    };
  });

  return items.slice(0, limit);
}

function buildReadonlyFacadePayload(source: string, message: string) {
  return {
    ...basePayload(source),
    writeReady: false,
    exportReady: false,
    items: [],
    message,
  };
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
    before: parseObjectLike(row.before_value, "value"),
    after: parseObjectLike(row.after_value ?? row.metric_value, "value"),
    delta: parseObjectLike(row.delta_value, "value"),
    confidence: parseObjectLike(row.confidence, "level"),
    skill_refs: [...new Set([...normalizeRefList(row.skill_refs), ...normalizeRefList([row.skill_id, row.skill_trace_ref])])],
    evidence_refs: normalizeRefList(row.evidence_refs),
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

  app.get("/api/v1/operator/workbench", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number; tenant_id?: string; project_id?: string; group_id?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const items = await buildOperatorWorkbench(pool, limit);
    return reply.send({
      ...basePayload("operator_workbench_api"),
      items,
      filters: {
        tenant_id: safeText(query.tenant_id),
        project_id: safeText(query.project_id),
        group_id: safeText(query.group_id),
        limit,
      },
      writeReady: false,
      exportReady: false,
      message: "operator workbench read-only facade",
    });
  });

  app.get("/api/v1/operator/dispatch", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number; tenant_id?: string; project_id?: string; group_id?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const items = await buildOperatorDispatch(pool, limit);
    return reply.send({
      ...basePayload("operator_dispatch_api"),
      writeReady: false,
      items,
      filters: {
        tenant_id: safeText(query.tenant_id),
        project_id: safeText(query.project_id),
        group_id: safeText(query.group_id),
        limit,
      },
      message: "operator dispatch read-only facade",
    });
  });

  app.get("/api/v1/operator/acceptance", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number; tenant_id?: string; project_id?: string; group_id?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const items = await buildOperatorAcceptance(pool, limit);
    return reply.send({
      ...basePayload("operator_acceptance_api"),
      writeReady: false,
      items,
      filters: {
        tenant_id: safeText(query.tenant_id),
        project_id: safeText(query.project_id),
        group_id: safeText(query.group_id),
        limit,
      },
      message: "operator acceptance read-only facade",
    });
  });

  app.get("/api/v1/operator/evidence", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number; tenant_id?: string; project_id?: string; group_id?: string };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const items = await buildOperatorEvidence(pool, limit);
    return reply.send({
      ...basePayload("operator_evidence_api"),
      exportReady: false,
      items,
      filters: {
        tenant_id: safeText(query.tenant_id),
        project_id: safeText(query.project_id),
        group_id: safeText(query.group_id),
        limit,
      },
      message: "operator evidence read-only facade",
    });
  });

  app.get("/api/v1/evidence/export-jobs", async (req: any, reply) => {
    const query = (req.query ?? {}) as { limit?: string | number };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(300, Math.max(1, Math.floor(parsedLimit))) : 100;
    const items = await buildOperatorEvidence(pool, limit);
    return reply.send({
      ...basePayload("operator_evidence_export_jobs_api"),
      exportReady: false,
      items,
      message: "operator evidence export-jobs read-only facade",
    });
  });

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
