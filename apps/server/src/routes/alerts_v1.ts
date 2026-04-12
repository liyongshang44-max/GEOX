// GEOX/apps/server/src/routes/alerts_v1.ts
//
// Sprint C1 + Sprint A1: Alerts API (rules + events) and offline / immediate evaluation helpers.
//
// Notes:
// - Rule/event writes emit append-only facts and update projection tables.
// - The offline alert worker raises events based on device_status_index_v1 freshness and DEVICE_OFFLINE rules.
// - Sprint A1 adds list filters, rule disable, and immediate threshold evaluation against latest telemetry for DEVICE rules.
// - Tenant isolation uses AoActAuthContextV0 (tenant_id from token is authoritative).

import crypto from "node:crypto"; // Node crypto for deterministic hashes and stable event ids.
import { randomUUID } from "node:crypto"; // UUID helper for rule_id and fact_id generation.
import type { FastifyInstance } from "fastify"; // Fastify instance type.
import type { Pool, PoolClient } from "pg"; // Postgres pool / transaction client types.

import { dispatchAlertNotifications } from "../alerts/notification_dispatcher_v1"; // Dispatch alert notifications through configured adapters.
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Scope auth helper.
import type { AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Auth context.
import { enforceFieldScopeOrDeny, hasFieldAccess } from "../auth/route_role_authz"; // Role + field scope helpers.
import { projectAlertListV1, type AlertActionOverrideV1, type AlertListOperationInputV1 } from "../projections/alert_list_v1"; // Unified alert list projection.
import { AlertSeverity, AlertStatus } from "../projections/alert_v1";
import type { AlertStatus as ProjectedAlertStatus } from "../projections/alert_v1"; // Alert model.
import { projectOperationStateV1 } from "../projections/operation_state_v1"; // Operation state projection.
import { projectReportV1 as projectOperationReportV1 } from "./reports_v1"; // Operation report projection used by alert list.
import type { TelemetryHealthInput } from "../domain/alert_engine";
import { getOperationWorkflowV1, upsertAlertWorkflowV1, upsertOperationWorkflowV1 } from "./alert_workflow_v1";

type RuleStatus = "ACTIVE" | "DISABLED"; // Rule lifecycle.
type EventStatus = "OPEN" | "ACKED" | "CLOSED"; // Event lifecycle.
type NotificationStatus = "PENDING" | "DELIVERED" | "FAILED"; // Notification lifecycle with delivery attempts.

type LatestTelemetrySnapshot = { // Latest telemetry snapshot used for threshold evaluation.
  ts_ms: number; // Telemetry timestamp in ms.
  value_num: number | null; // Numeric value when present.
  value_text: string | null; // Text value when present.
  fact_id: string; // Source fact identifier.
} | null; // Snapshot may be absent.

function isNonEmptyString(v: any): v is string { // Helper: validate non-empty string.
  return typeof v === "string" && v.trim().length > 0; // Return true if string has content.
} // End helper.

function normalizeId(v: any): string | null { // Helper: normalize ids.
  if (!isNonEmptyString(v)) return null; // Missing => null.
  const s = String(v).trim(); // Trim.
  if (s.length < 1 || s.length > 128) return null; // Length bound.
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null; // Safe charset.
  return s; // Normalized.
} // End helper.

function sha256Hex(s: string): string { // Helper: sha256 hex digest.
  return crypto.createHash("sha256").update(s, "utf8").digest("hex"); // Hash + hex.
} // End helper.

function badRequest(reply: any, error: string) { // Helper: 400 response.
  return reply.status(400).send({ ok: false, error }); // Standard envelope.
} // End helper.

function notFound(reply: any) { // Helper: 404 response.
  return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Non-enumerable response.
} // End helper.

function clampInt(v: any, def: number, min: number, max: number): number { // Helper: clamp integer inputs.
  const n = (typeof v === "number" && Number.isFinite(v)) ? Math.trunc(v) : Number(String(v ?? "")); // Parse as number.
  if (!Number.isFinite(n)) return def; // Fallback.
  return Math.max(min, Math.min(max, Math.trunc(n))); // Clamp.
} // End helper.

function normalizeOperator(op: any): string | null { // Helper: normalize operator code.
  const s = String(op ?? "").trim().toUpperCase(); // Normalize to upper.
  if (["LT", "GT", "LTE", "GTE", "EQ"].includes(s)) return s; // Allowlist.
  return null; // Invalid.
} // End helper.

function normalizeObjectType(t: any): string | null { // Helper: normalize object type.
  const s = String(t ?? "").trim().toUpperCase(); // Normalize.
  if (s === "DEVICE" || s === "FIELD") return s; // Allowlist.
  return null; // Invalid.
} // End helper.

function normalizeRuleStatus(s: any): RuleStatus | null { // Helper: normalize rule status.
  const t = String(s ?? "").trim().toUpperCase(); // Normalize.
  if (t === "ACTIVE" || t === "DISABLED") return t as RuleStatus; // Allow.
  return null; // Invalid.
} // End helper.

function normalizeAlertSeverity(s: any): AlertSeverity | null { // Helper: normalize projected alert severity.
  const t = String(s ?? "").trim().toUpperCase();
  if (t === "LOW" || t === "MEDIUM" || t === "HIGH" || t === "CRITICAL") return t as AlertSeverity;
  return null;
}

function normalizeProjectedAlertStatus(s: any): ProjectedAlertStatus | null { // Helper: normalize projected alert status.
  const t = String(s ?? "").trim().toUpperCase();
  if (t === "OPEN" || t === "ACKED" || t === "CLOSED") return t as ProjectedAlertStatus;
  return null;
}

function normalizeProjectedAlertObjectType(s: any): "OPERATION" | "DEVICE" | "FIELD" | "SYSTEM" | null { // Helper: normalize projected alert object type.
  const t = String(s ?? "").trim().toUpperCase();
  if (t === "OPERATION" || t === "DEVICE" || t === "FIELD" || t === "SYSTEM") return t;
  return null;
}

function normalizeCsvList(v: any): string[] { // Normalize CSV/array query values into distinct list.
  const raw: string[] = Array.isArray(v) ? v.map((x) => String(x ?? "")) : [String(v ?? "")];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of raw) {
    for (const token of chunk.split(",")) {
      const item = token.trim();
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function enforceAlertActionRoleOrDeny(auth: AoActAuthContextV0, reply: any): boolean { // Role gate for ack/resolve.
  if (auth.role === "operator" || auth.role === "admin") return true;
  reply.status(403).send({ ok: false, error: "AUTH_ROLE_DENIED" });
  return false;
}

async function listOperationInputsForAlertProjection(pool: Pool, auth: AoActAuthContextV0): Promise<AlertListOperationInputV1[]> { // Build operation inputs in tenant/project/group scope.
  const states = await projectOperationStateV1(pool, {
    tenant_id: auth.tenant_id,
    project_id: auth.project_id,
    group_id: auth.group_id,
  });
  const scoped = states.filter((x) => hasFieldAccess(auth, String(x.field_id ?? "")));
  const reports = await Promise.all(scoped.map((state) => projectOperationReportV1({
    pool,
    tenant: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
    operationState: state,
  })));
  return reports.map((report) => ({
    operation_plan_id: String(report.identifiers.operation_plan_id ?? report.identifiers.operation_id ?? ""),
    operation_state: {
      operation_id: report.identifiers.operation_id,
      operation_plan_id: report.identifiers.operation_plan_id,
      tenant_id: report.identifiers.tenant_id,
      project_id: report.identifiers.project_id,
      group_id: report.identifiers.group_id,
      field_id: report.identifiers.field_id,
      device_id: report.identifiers.device_id,
      action_type: report.execution.action_type,
      status: report.execution.status,
      final_status: report.execution.final_status,
      acceptance: report.acceptance,
      timeline: report.timeline,
    },
    evidence_bundle: report.evidence_bundle ?? {},
    acceptance: report.acceptance ?? null,
    receipt: report.receipt ?? null,
    cost: report.cost ?? {},
    generated_at: report.generated_at,
  }));
}

async function listTelemetryHealthInputsForAlertProjection(pool: Pool, auth: AoActAuthContextV0): Promise<TelemetryHealthInput[]> { // Build telemetry-health inputs for alert projection.
  const q = await pool.query(
    `SELECT d.device_id,
            COALESCE(d.field_id, b.field_id) AS field_id,
            d.last_heartbeat_ts_ms,
            d.last_telemetry_ts_ms,
            d.battery_percent
       FROM device_status_index_v1 d
       LEFT JOIN device_binding_index_v1 b
         ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
      WHERE d.tenant_id = $1`,
    [auth.tenant_id]
  );
  const nowMs = Date.now();
  const out: TelemetryHealthInput[] = [];
  for (const row of q.rows ?? []) {
    const field_id = isNonEmptyString(row.field_id) ? String(row.field_id) : null;
    if (field_id && !hasFieldAccess(auth, field_id)) continue;
    const lastHeartbeat = Number(row.last_heartbeat_ts_ms ?? 0);
    const lastTelemetry = Number(row.last_telemetry_ts_ms ?? 0);
    const batteryPercent = Number(row.battery_percent ?? 100);
    out.push({
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      device_id: String(row.device_id ?? ""),
      field_id,
      heartbeat_lag_ms: Number.isFinite(lastHeartbeat) && lastHeartbeat > 0 ? Math.max(0, nowMs - lastHeartbeat) : null,
      telemetry_lag_ms: Number.isFinite(lastTelemetry) && lastTelemetry > 0 ? Math.max(0, nowMs - lastTelemetry) : null,
      packet_loss_ratio: null,
      parser_error_ratio: null,
      low_battery: Number.isFinite(batteryPercent) ? batteryPercent < 20 : null,
    });
  }
  return out;
}

async function listAlertActionOverrides(pool: Pool, auth: AoActAuthContextV0): Promise<AlertActionOverrideV1[]> { // Load last action per alert.
  const q = await pool.query(
    `SELECT DISTINCT ON (alert_id) alert_id, status
       FROM alert_actions_v1
      WHERE tenant_id = $1
      ORDER BY alert_id, acted_at DESC`,
    [auth.tenant_id]
  );
  return (q.rows ?? [])
    .map((row: any) => ({
      alert_id: String(row.alert_id ?? ""),
      status: normalizeProjectedAlertStatus(row.status),
    }))
    .filter((x: any): x is AlertActionOverrideV1 => Boolean(x.alert_id && x.status));
}

async function listDeviceFieldMap(pool: Pool, tenant_id: string): Promise<Map<string, string>> { // Resolve device->field bindings for filtering/authorization.
  const q = await pool.query(
    `SELECT d.device_id, COALESCE(d.field_id, b.field_id) AS field_id
       FROM device_status_index_v1 d
       LEFT JOIN device_binding_index_v1 b
         ON b.tenant_id = d.tenant_id AND b.device_id = d.device_id
      WHERE d.tenant_id = $1`,
    [tenant_id]
  );
  const map = new Map<string, string>();
  for (const row of q.rows ?? []) {
    const did = String(row.device_id ?? "").trim();
    const fid = String(row.field_id ?? "").trim();
    if (did && fid) map.set(did, fid);
  }
  return map;
}

function normalizeNotificationChannel(v: any): string | null { // Helper: normalize notification channel.
  const s = String(v ?? "").trim().toUpperCase(); // Normalize.
  if (["INAPP", "WEBHOOK", "EMAIL", "SMS", "WECHAT", "DINGTALK"].includes(s)) return s; // Commercial v1.1 allowlist keeps storage generic while channels remain delivery placeholders.
  return null; // Invalid.
} // End helper.

function normalizeNotificationChannels(v: any): string[] { // Helper: normalize notification channel arrays.
  if (!Array.isArray(v)) return []; // Missing => empty.
  const out: string[] = []; // Output list.
  const seen = new Set<string>(); // Deduplicate.
  for (const item of v) { // Walk input values.
    const normalized = normalizeNotificationChannel(item); // Normalize one value.
    if (!normalized || seen.has(normalized)) continue; // Skip invalid/duplicate items.
    seen.add(normalized); // Remember.
    out.push(normalized); // Append.
  } // End loop.
  return out; // Return normalized list.
} // End helper.

function nowIso(ms: number): string { // Helper: ISO timestamp from ms.
  return new Date(ms).toISOString(); // Convert.
} // End helper.

type NotificationDispatchResult = { // Dispatch result for one notification record.
  status: NotificationStatus;
  delivered_ts_ms: number | null;
  error: string | null;
  provider_response: Record<string, any> | null;
};

function readEnv(name: string): string | null { // Read optional environment variable.
  const v = process.env[name];
  if (!isNonEmptyString(v)) return null;
  return String(v).trim();
}

async function postJson(url: string, body: Record<string, any>): Promise<Record<string, any>> { // Minimal JSON POST helper.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

async function sendSmsViaTwilio(payload: Record<string, any>): Promise<Record<string, any>> { // Send SMS via Twilio REST helper.
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const from = readEnv("TWILIO_FROM_NUMBER");
  const to = readEnv("ALERT_SMS_TO");
  if (!accountSid || !authToken || !from || !to) {
    throw new Error("TWILIO_ENV_MISSING");
  }
  const mod: any = await (new Function("return import(\"twilio\")")() as Promise<any>);
  const twilioFactory = mod?.default ?? mod;
  const client = twilioFactory(accountSid, authToken);
  const message = await client.messages.create({
    body: `鍛婅瑙﹀彂: rule=${payload.rule_id} object=${payload.object_id} metric=${payload.metric}`,
    from,
    to,
  });
  return { sid: String(message?.sid ?? ""), status: String(message?.status ?? "") };
}

async function dispatchAlertNotification(channel: string, payload: Record<string, any>, now_ms: number): Promise<NotificationDispatchResult> { // Dispatch one channel message.
  try {
    if (channel === "INAPP") {
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: { mode: "inapp" } };
    }
    if (channel === "WEBHOOK") {
      const url = readEnv("ALERT_WEBHOOK_URL");
      if (!url) throw new Error("ALERT_WEBHOOK_URL_MISSING");
      const response = await postJson(url, payload);
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: response };
    }
    if (channel === "EMAIL") {
      const url = readEnv("ALERT_EMAIL_WEBHOOK_URL");
      const to = readEnv("ALERT_EMAIL_TO");
      if (!url || !to) throw new Error("ALERT_EMAIL_CONFIG_MISSING");
      const response = await postJson(url, { to, subject: `鍛婅閫氱煡 ${payload.rule_id}`, text: JSON.stringify(payload) });
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: response };
    }
    if (channel === "WECHAT") {
      const url = readEnv("ALERT_WECHAT_WEBHOOK_URL");
      if (!url) throw new Error("ALERT_WECHAT_WEBHOOK_URL_MISSING");
      const response = await postJson(url, { msgtype: "text", text: { content: `鍛婅閫氱煡
rule=${payload.rule_id}
object=${payload.object_id}
metric=${payload.metric}` } });
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: response };
    }
    if (channel === "DINGTALK") {
      const url = readEnv("ALERT_DINGTALK_WEBHOOK_URL");
      if (!url) throw new Error("ALERT_DINGTALK_WEBHOOK_URL_MISSING");
      const response = await postJson(url, { msgtype: "text", text: { content: `鍛婅閫氱煡
rule=${payload.rule_id}
object=${payload.object_id}
metric=${payload.metric}` } });
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: response };
    }
    if (channel === "SMS") {
      const response = await sendSmsViaTwilio(payload);
      return { status: "DELIVERED", delivered_ts_ms: now_ms, error: null, provider_response: response };
    }
    throw new Error("CHANNEL_NOT_SUPPORTED");
  } catch (e: any) {
    return { status: "FAILED", delivered_ts_ms: null, error: String(e?.message ?? e), provider_response: null };
  }
}

function compareWithOperator(operator: string, actual: number, threshold: number): boolean { // Compare numeric value with alert operator.
  if (operator === "LT") return actual < threshold; // Less-than rule.
  if (operator === "GT") return actual > threshold; // Greater-than rule.
  if (operator === "LTE") return actual <= threshold; // Less-or-equal rule.
  if (operator === "GTE") return actual >= threshold; // Greater-or-equal rule.
  if (operator === "EQ") return actual === threshold; // Equal rule.
  return false; // Unknown operator => safe false.
} // End helper.

async function fetchLatestTelemetrySnapshot(pool: Pool | PoolClient, tenant_id: string, device_id: string, metric: string): Promise<LatestTelemetrySnapshot> { // Load latest telemetry from projection or facts fallback.
  const idxQ = await pool.query( // Prefer projection table for fast lookup.
    `SELECT EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms, value_num, value_text, fact_id
       FROM telemetry_index_v1
      WHERE tenant_id = $1 AND device_id = $2 AND metric = $3
      ORDER BY ts DESC
      LIMIT 1`,
    [tenant_id, device_id, metric]
  ); // End projection query.
  if ((idxQ.rowCount ?? 0) > 0) { // Projection hit.
    const row: any = idxQ.rows[0]; // Read first row.
    return { // Return normalized snapshot.
      ts_ms: Number(row.ts_ms ?? 0), // Convert timestamp to number.
      value_num: typeof row.value_num === "number" ? row.value_num : null, // Keep numeric value when present.
      value_text: isNonEmptyString(row.value_text) ? String(row.value_text) : null, // Keep text value when present.
      fact_id: String(row.fact_id ?? ""), // Fact id.
    }; // End snapshot.
  } // End projection branch.

  const factsQ = await pool.query( // Fallback to append-only facts for compatibility with acceptance injection.
    `SELECT fact_id,
            COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, 0) AS ts_ms,
            NULLIF(record_json::jsonb #>> '{payload,metric}', '') AS metric,
            NULLIF(record_json::jsonb #>> '{payload,value}', '') AS raw_value_text
       FROM facts
      WHERE (record_json::jsonb ->> 'type') = 'raw_telemetry_v1'
        AND (record_json::jsonb #>> '{entity,tenant_id}') = $1
        AND (record_json::jsonb #>> '{entity,device_id}') = $2
        AND (record_json::jsonb #>> '{payload,metric}') = $3
      ORDER BY COALESCE((record_json::jsonb #>> '{payload,ts_ms}')::bigint, 0) DESC, occurred_at DESC
      LIMIT 1`,
    [tenant_id, device_id, metric]
  ); // End facts query.
  if (factsQ.rowCount === 0) return null; // No telemetry available.
  const row: any = factsQ.rows[0]; // Read latest fact row.
  const rawValueText = isNonEmptyString(row.raw_value_text) ? String(row.raw_value_text) : null; // Keep raw payload value as text.
  const parsedValueNum = rawValueText != null && Number.isFinite(Number(rawValueText)) ? Number(rawValueText) : null; // Parse numeric strings in Node for maximum compatibility.
  return { // Return normalized snapshot.
    ts_ms: Number(row.ts_ms ?? 0), // Telemetry timestamp.
    value_num: parsedValueNum, // Numeric value parsed in application layer.
    value_text: rawValueText, // Preserve original text value.
    fact_id: String(row.fact_id ?? ""), // Fact id.
  }; // End snapshot.
} // End helper.

async function ensureAlertsV1Schema(pool: Pool): Promise<void> { // Ensure alert rule/event schemas are forward-compatible.
  await pool.query(`ALTER TABLE alert_rule_index_v1 ADD COLUMN IF NOT EXISTS notify_channels_json TEXT;`); // Rule notification channels.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_notification_index_v1 (
      tenant_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      detail_json TEXT NULL,
      created_ts_ms BIGINT NOT NULL,
      delivered_ts_ms BIGINT NULL,
      error TEXT NULL,
      PRIMARY KEY (tenant_id, notification_id)
    );
  `); // Notification projection table.
  await pool.query(`CREATE INDEX IF NOT EXISTS alert_notification_index_v1_lookup_idx ON alert_notification_index_v1 (tenant_id, event_id, rule_id, channel, created_ts_ms DESC);`); // Query support.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_actions_v1 (
      tenant_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      status TEXT NOT NULL,
      acted_by TEXT NOT NULL,
      acted_at BIGINT NOT NULL,
      note TEXT NULL,
      PRIMARY KEY (tenant_id, alert_id, acted_at)
    );
  `); // Persist explicit user actions for projected alerts.
  await pool.query(`CREATE INDEX IF NOT EXISTS alert_actions_v1_lookup_idx ON alert_actions_v1 (tenant_id, alert_id, acted_at DESC);`); // Last action lookup.
} // End helper.

async function insertNotificationRecordsForEvent(clientConn: PoolClient, params: { // Insert minimal notification records for an event.
  tenant_id: string;
  event_id: string;
  rule_id: string;
  object_type: string;
  object_id: string;
  metric: string;
  now_ms: number;
  last_value: Record<string, any>;
}): Promise<void> {
  const ruleQ = await clientConn.query(
    `SELECT notify_channels_json FROM alert_rule_index_v1 WHERE tenant_id = $1 AND rule_id = $2 LIMIT 1`,
    [params.tenant_id, params.rule_id]
  );
  if (ruleQ.rowCount === 0) return;
  let channelsRaw: any[] = [];
  try {
    const parsed = JSON.parse(String(ruleQ.rows[0]?.notify_channels_json ?? "[]"));
    channelsRaw = Array.isArray(parsed) ? parsed : [];
  } catch {
    channelsRaw = [];
  }
  for (const channelEntry of channelsRaw) {
    const channel = typeof channelEntry === "string" ? channelEntry : String(channelEntry?.type ?? "").trim().toLowerCase();
    if (!channel) continue;
    const notification_id = `alnot_${randomUUID()}`;
    const fact_id = `alnot_${randomUUID()}`;
    const detail = { channel, object_type: params.object_type, object_id: params.object_id, metric: params.metric, last_value: params.last_value, status: "PENDING" };
    const record = {
      type: "alert_notification_recorded_v1",
      entity: { tenant_id: params.tenant_id, notification_id, event_id: params.event_id, rule_id: params.rule_id },
      payload: { channel, status: "PENDING", created_ts_ms: params.now_ms, detail },
    };
    await clientConn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, $2::timestamptz, $3, $4)`,
      [fact_id, nowIso(params.now_ms), "system", JSON.stringify(record)]
    );
    await clientConn.query(
      `INSERT INTO alert_notification_index_v1
        (tenant_id, notification_id, event_id, rule_id, channel, status, detail_json, created_ts_ms, delivered_ts_ms, error)
       VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,NULL,NULL)
       ON CONFLICT (tenant_id, notification_id) DO NOTHING`,
      [params.tenant_id, notification_id, params.event_id, params.rule_id, channel, JSON.stringify(detail), params.now_ms]
    );
  }
} // End helper.

async function dispatchPendingNotifications(pool: Pool, limit: number = 50): Promise<void> { // Best-effort dispatcher for pending notifications.
  const q = await pool.query(
    `SELECT tenant_id, notification_id, event_id, rule_id, channel, detail_json, created_ts_ms
       FROM alert_notification_index_v1
      WHERE status = 'PENDING'
      ORDER BY created_ts_ms ASC
      LIMIT $1`,
    [limit]
  );
  for (const row of q.rows ?? []) {
    const now_ms = Date.now();
    let detail: Record<string, any> = {};
    try { detail = JSON.parse(String(row.detail_json ?? "{}")); } catch { detail = {}; }
    const payload = {
      tenant_id: String(row.tenant_id),
      notification_id: String(row.notification_id),
      event_id: String(row.event_id),
      rule_id: String(row.rule_id),
      channel: String(row.channel),
      ...detail,
    };
    const result = await dispatchAlertNotification(String(row.channel), payload, now_ms);
    const fact_id = `alnot_dispatch_${randomUUID()}`;
    const record = {
      type: "alert_notification_dispatched_v1",
      entity: { tenant_id: String(row.tenant_id), notification_id: String(row.notification_id), event_id: String(row.event_id), rule_id: String(row.rule_id) },
      payload: {
        channel: String(row.channel),
        status: result.status,
        delivered_ts_ms: result.delivered_ts_ms,
        error: result.error,
        provider_response: result.provider_response,
      },
    };
    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");
      await clientConn.query(
        `UPDATE alert_notification_index_v1
            SET status = $4, delivered_ts_ms = $5, error = $6,
                detail_json = COALESCE(detail_json, '{}')::jsonb || $7::jsonb
          WHERE tenant_id = $1 AND notification_id = $2 AND status = 'PENDING' AND channel = $3`,
        [String(row.tenant_id), String(row.notification_id), String(row.channel), result.status, result.delivered_ts_ms, result.error, JSON.stringify({ provider_response: result.provider_response })]
      );
      await clientConn.query(
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "system", JSON.stringify(record)]
      );
      await clientConn.query("COMMIT");
    } catch {
      try { await clientConn.query("ROLLBACK"); } catch {}
    } finally {
      clientConn.release();
    }
  }
}

async function insertAlertEventIfMissing(clientConn: PoolClient, params: { // Insert OPEN event if the same rule/object has no OPEN/ACKED event.
  tenant_id: string; // Tenant id.
  rule_id: string; // Rule id.
  object_type: string; // Object type.
  object_id: string; // Object id.
  metric: string; // Metric name.
  now_ms: number; // Event time.
  last_value: Record<string, any>; // Trigger snapshot.
  source: string; // Worker or immediate source marker.
  event_id?: string; // Optional caller-provided event id for idempotent replay paths.
}): Promise<{ inserted: boolean; event_id: string | null }> { // Return insertion result.
  const openQ = await clientConn.query( // Guard against duplicate open events.
    `SELECT 1
       FROM alert_event_index_v1
      WHERE tenant_id = $1 AND rule_id = $2 AND object_id = $3
        AND status IN ('OPEN','ACKED')
      LIMIT 1`,
    [params.tenant_id, params.rule_id, params.object_id]
  ); // End query.
  if ((openQ.rowCount ?? 0) > 0) return { inserted: false, event_id: null }; // Existing open event => no-op.

  const event_id = `alev_${randomUUID()}`; // Use unique event ids to avoid same-minute collisions with previously closed events.
  const fact_id = `alev_raise_${randomUUID()}`; // Fact id for raised event.
  const record = { // Fact record.
    type: "alert_event_raised_v1", // Fact type.
    entity: { tenant_id: params.tenant_id, event_id, rule_id: params.rule_id }, // Entity envelope.
    payload: { // Payload.
      object_type: params.object_type, // Object type.
      object_id: params.object_id, // Object id.
      metric: params.metric, // Metric.
      raised_ts_ms: params.now_ms, // Raised time.
      last_value: params.last_value, // Trigger snapshot.
      source: params.source, // Source marker.
    }, // End payload.
  }; // End record.

  await clientConn.query( // Insert fact for audit.
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, $3, $4)`,
    [fact_id, nowIso(params.now_ms), params.source === "worker" ? "system" : "control", JSON.stringify(record)]
  ); // End insert.

  const resolved_event_id = params.event_id ?? event_id; // Use caller-supplied or generated event id.
  await clientConn.query( // Insert projection row; deterministic id keeps operation idempotent.
    `INSERT INTO alert_event_index_v1
      (tenant_id, event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms, last_value_json)
     VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,NULL,NULL,$8)
     ON CONFLICT (tenant_id, event_id) DO NOTHING`,
    [params.tenant_id, resolved_event_id, params.rule_id, params.object_type, params.object_id, params.metric, params.now_ms, JSON.stringify(params.last_value)]
  ); // End insert.

  await insertNotificationRecordsForEvent(clientConn, { // Record minimal notifications for configured channels.
    tenant_id: params.tenant_id,
    event_id: resolved_event_id,
    rule_id: params.rule_id,
    object_type: params.object_type,
    object_id: params.object_id,
    metric: params.metric,
    now_ms: params.now_ms,
    last_value: params.last_value,
  });

  return { inserted: true, event_id: resolved_event_id }; // Report inserted event.
} // End helper.

async function maybeRaiseImmediateMetricEvent(clientConn: PoolClient, params: { // Evaluate latest telemetry immediately after rule creation/update.
  tenant_id: string; // Tenant id.
  rule_id: string; // Rule id.
  object_type: string; // Object type.
  object_id: string; // Object id.
  metric: string; // Metric name.
  operator: string; // Rule operator.
  threshold_num: number | null; // Numeric threshold.
  now_ms: number; // Evaluation time.
}): Promise<{ inserted: boolean; event_id: string | null }> { // Return evaluation result.
  if (params.object_type !== "DEVICE") return { inserted: false, event_id: null }; // Only DEVICE telemetry is supported in A1.
  if (params.metric === "DEVICE_OFFLINE") return { inserted: false, event_id: null }; // Offline is handled by worker.
  if (typeof params.threshold_num !== "number" || !Number.isFinite(params.threshold_num)) return { inserted: false, event_id: null }; // Need numeric threshold.

  const latest = await fetchLatestTelemetrySnapshot(clientConn, params.tenant_id, params.object_id, params.metric); // Load latest telemetry.
  if (!latest) return { inserted: false, event_id: null }; // No telemetry => no event.
  if (typeof latest.value_num !== "number" || !Number.isFinite(latest.value_num)) return { inserted: false, event_id: null }; // Only numeric comparisons in A1.

  const breached = compareWithOperator(params.operator, latest.value_num, params.threshold_num); // Compare threshold.
  if (!breached) return { inserted: false, event_id: null }; // Rule not breached.

  return insertAlertEventIfMissing(clientConn, { // Create OPEN event when breached.
    tenant_id: params.tenant_id, // Tenant id.
    rule_id: params.rule_id, // Rule id.
    object_type: params.object_type, // Object type.
    object_id: params.object_id, // Device id.
    metric: params.metric, // Metric name.
    now_ms: params.now_ms, // Event time.
    last_value: { ts_ms: latest.ts_ms, value_num: latest.value_num, value_text: latest.value_text, fact_id: latest.fact_id, threshold_num: params.threshold_num, operator: params.operator }, // Snapshot.
    source: "immediate", // Immediate evaluation marker.
  }); // End insert.
} // End helper.

export function registerAlertsV1Routes(app: FastifyInstance, pool: Pool) { // Register alert endpoints.
  app.addHook("onReady", async () => { await ensureAlertsV1Schema(pool); }); // Ensure forward-compatible alert schema before serving.

  app.get("/api/v1/alerts", async (req, reply) => { // Canonical v1 alert list endpoint.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.read");
    if (!auth) return;

    const query: any = (req.query as any) ?? {};
    const fieldIds = normalizeCsvList(query.field_ids ?? query["field_ids[]"]);
    const severity = normalizeCsvList(query.severity ?? query["severity[]"])
      .map((item) => normalizeAlertSeverity(item))
      .filter((item): item is AlertSeverity => Boolean(item));
    const status = normalizeCsvList(query.status ?? query["status[]"])
      .map((item) => normalizeProjectedAlertStatus(item))
      .filter((item): item is ProjectedAlertStatus => Boolean(item));
    const category = normalizeCsvList(query.category ?? query["category[]"]).map((item) => String(item).trim().toUpperCase()).filter(Boolean);
    const object_type = normalizeProjectedAlertObjectType(query.object_type);
    const object_id = normalizeId(query.object_id);

    if (fieldIds.length > 0) {
      const allAllowed = fieldIds.every((fid) => enforceFieldScopeOrDeny(auth, fid, reply, { asNotFound: true }));
      if (!allAllowed) return;
    }

    const [operations, telemetry_health, action_overrides, deviceFieldMap] = await Promise.all([
      listOperationInputsForAlertProjection(pool, auth),
      listTelemetryHealthInputsForAlertProjection(pool, auth),
      listAlertActionOverrides(pool, auth),
      listDeviceFieldMap(pool, auth.tenant_id),
    ]);
    const items = projectAlertListV1({
      scope: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operations,
      telemetry_health,
      action_overrides,
      filter: {
        field_ids: fieldIds,
        object_type,
        object_id,
        severity,
        status,
        category,
        device_field_map: deviceFieldMap,
      },
      nowMs: Date.now(),
    });
    return reply.send({ ok: true, items });
  });

  app.get("/api/v1/alerts/summary", async (req, reply) => { // Summary endpoint grouped by severity/status/category.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.read");
    if (!auth) return;
    const query: any = (req.query as any) ?? {};
    const fieldIds = normalizeCsvList(query.field_ids ?? query["field_ids[]"]);
    const severity = normalizeAlertSeverity(query.severity);
    const status = normalizeProjectedAlertStatus(query.status);
    const category = isNonEmptyString(query.category) ? String(query.category).trim().toUpperCase() : null;
    if (fieldIds.length > 0) {
      const allAllowed = fieldIds.every((fid) => enforceFieldScopeOrDeny(auth, fid, reply, { asNotFound: true }));
      if (!allAllowed) return;
    }

    const [operations, telemetry_health, action_overrides, deviceFieldMap] = await Promise.all([
      listOperationInputsForAlertProjection(pool, auth),
      listTelemetryHealthInputsForAlertProjection(pool, auth),
      listAlertActionOverrides(pool, auth),
      listDeviceFieldMap(pool, auth.tenant_id),
    ]);
    let items = projectAlertListV1({
      scope: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operations,
      telemetry_health,
      action_overrides,
      nowMs: Date.now(),
    });

    if (fieldIds.length > 0) {
      const set = new Set(fieldIds);
      items = items.filter((item) => {
        if (item.object_type === "FIELD") return set.has(String(item.object_id ?? ""));
        if (item.object_type === "DEVICE") return set.has(String(deviceFieldMap.get(String(item.object_id ?? "")) ?? ""));
        return false;
      });
    }
    if (severity) items = items.filter((item) => item.severity === severity);
    if (status) items = items.filter((item) => item.status === status);
    if (category) items = items.filter((item) => String(item.category ?? "").toUpperCase() === category);

    const by_severity: Record<keyof typeof AlertSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const by_status: Record<keyof typeof AlertStatus, number> = {
      OPEN: 0,
      ACKED: 0,
      CLOSED: 0,
    };
    const by_category: Record<string, number> = {};
    for (const item of items) {
      by_severity[item.severity] = (by_severity[item.severity] ?? 0) + 1;
      by_status[item.status] = (by_status[item.status] ?? 0) + 1;
      const category = String(item.category ?? "");
      by_category[category] = (by_category[category] ?? 0) + 1;
    }
    return reply.send({ ok: true, total: items.length, by_severity, by_status, by_category });
  });

  app.post("/api/v1/alerts/:alert_id/ack", async (req, reply) => { // Canonical v1 ack action on projected alert.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write");
    if (!auth) return;
    if (!enforceAlertActionRoleOrDeny(auth, reply)) return;

    const alert_id = normalizeId((req.params as any)?.alert_id);
    if (!alert_id) return notFound(reply);
    const note = isNonEmptyString((req.body as any)?.note) ? String((req.body as any).note).trim().slice(0, 1000) : null;

    const [operations, telemetry_health, action_overrides, deviceFieldMap] = await Promise.all([
      listOperationInputsForAlertProjection(pool, auth),
      listTelemetryHealthInputsForAlertProjection(pool, auth),
      listAlertActionOverrides(pool, auth),
      listDeviceFieldMap(pool, auth.tenant_id),
    ]);
    const items: AlertV1[] = projectAlertListV1({
      scope: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operations,
      telemetry_health,
      action_overrides,
      nowMs: Date.now(),
    });
    const target = items.find((item) => item.alert_id === alert_id) ?? null;
    if (!target) return notFound(reply);
    const scopedFieldId = target.object_type === "FIELD"
      ? target.object_id
      : (target.object_type === "DEVICE" ? (deviceFieldMap.get(target.object_id) ?? null) : null);
    if (scopedFieldId && !enforceFieldScopeOrDeny(auth, scopedFieldId, reply, { asNotFound: true })) return;

    const acted_at = Date.now();
    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");
      await clientConn.query(
        `INSERT INTO alert_actions_v1 (tenant_id, alert_id, status, acted_by, acted_at, note)
         VALUES ($1,$2,'ACKED',$3,$4,$5)`,
        [auth.tenant_id, alert_id, auth.actor_id, acted_at, note]
      );
      const workflowResult = await upsertAlertWorkflowV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        alert_id,
        status: "ACKED",
        acked_at: acted_at,
        updated_at: acted_at,
        updated_by: auth.actor_id,
        last_note: note,
        allow_cross_step: true,
      });
      if (!workflowResult.ok) {
        await clientConn.query("ROLLBACK");
        return reply.status(409).send({ ok: false, error: workflowResult.error, detail: workflowResult.detail ?? null });
      }
      await clientConn.query("COMMIT");
      return reply.send({ ok: true, alert_id, status: "ACKED", acted_at });
    } catch (e: any) {
      await clientConn.query("ROLLBACK");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }
  });

  app.post("/api/v1/alerts/:alert_id/resolve", async (req, reply) => { // Canonical v1 resolve action on projected alert.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write");
    if (!auth) return;
    if (!enforceAlertActionRoleOrDeny(auth, reply)) return;

    const alert_id = normalizeId((req.params as any)?.alert_id);
    if (!alert_id) return notFound(reply);
    const body: any = (req.body as any) ?? {};
    const note = isNonEmptyString(body?.note) ? String(body.note).trim().slice(0, 1000) : null;
    const linkedOperationId = normalizeId(body?.linked_operation_id ?? body?.operation_id);
    const reqAssigneeActorId = normalizeId(body?.assignee_actor_id);
    const reqAssigneeName = isNonEmptyString(body?.assignee_name) ? String(body.assignee_name).trim().slice(0, 200) : null;

    const [operations, telemetry_health, action_overrides, deviceFieldMap] = await Promise.all([
      listOperationInputsForAlertProjection(pool, auth),
      listTelemetryHealthInputsForAlertProjection(pool, auth),
      listAlertActionOverrides(pool, auth),
      listDeviceFieldMap(pool, auth.tenant_id),
    ]);
    const items: AlertV1[] = projectAlertListV1({
      scope: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operations,
      telemetry_health,
      action_overrides,
      nowMs: Date.now(),
    });
    const target = items.find((item) => item.alert_id === alert_id) ?? null;
    if (!target) return notFound(reply);
    const scopedFieldId = target.object_type === "FIELD"
      ? target.object_id
      : (target.object_type === "DEVICE" ? (deviceFieldMap.get(target.object_id) ?? null) : null);
    if (scopedFieldId && !enforceFieldScopeOrDeny(auth, scopedFieldId, reply, { asNotFound: true })) return;

    const acted_at = Date.now();
    const clientConn = await pool.connect();
    try {
      await clientConn.query("BEGIN");
      await clientConn.query(
        `INSERT INTO alert_actions_v1 (tenant_id, alert_id, status, acted_by, acted_at, note)
         VALUES ($1,$2,'CLOSED',$3,$4,$5)`,
        [auth.tenant_id, alert_id, auth.actor_id, acted_at, note]
      );
      let workflowAssigneeActorId: string | null = reqAssigneeActorId;
      let workflowAssigneeName: string | null = reqAssigneeName;
      let workflowNote: string | null = note;
      if (linkedOperationId) {
        const existingOperationWorkflow = await getOperationWorkflowV1(clientConn, {
          tenant_id: auth.tenant_id,
          operation_id: linkedOperationId,
        });
        const operationOwnerActorId = reqAssigneeActorId ?? existingOperationWorkflow?.owner_actor_id ?? null;
        const operationOwnerName = reqAssigneeName ?? existingOperationWorkflow?.owner_name ?? null;
        const operationLastNote = note ?? existingOperationWorkflow?.last_note ?? null;
        await upsertOperationWorkflowV1(clientConn, {
          tenant_id: auth.tenant_id,
          project_id: auth.project_id,
          group_id: auth.group_id,
          operation_id: linkedOperationId,
          owner_actor_id: operationOwnerActorId,
          owner_name: operationOwnerName,
          last_note: operationLastNote,
          updated_by: auth.actor_id,
          updated_at: acted_at,
        });
        workflowAssigneeActorId = operationOwnerActorId;
        workflowAssigneeName = operationOwnerName;
        workflowNote = operationLastNote;
      }
      const workflowResult = await upsertAlertWorkflowV1(clientConn, {
        tenant_id: auth.tenant_id,
        project_id: auth.project_id,
        group_id: auth.group_id,
        alert_id,
        status: "CLOSED",
        resolved_at: acted_at,
        updated_at: acted_at,
        updated_by: auth.actor_id,
        assignee_actor_id: workflowAssigneeActorId,
        assignee_name: workflowAssigneeName,
        last_note: workflowNote,
        allow_cross_step: true,
      });
      if (!workflowResult.ok) {
        await clientConn.query("ROLLBACK");
        return reply.status(409).send({ ok: false, error: workflowResult.error, detail: workflowResult.detail ?? null });
      }
      await clientConn.query("COMMIT");
      return reply.send({ ok: true, alert_id, status: "CLOSED", acted_at });
    } catch (e: any) {
      await clientConn.query("ROLLBACK");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) });
    } finally {
      clientConn.release();
    }
  });

  // DEPRECATED: Use GET /api/v1/alerts instead.
  app.get("/api/v1/alerts/events", async (req, reply) => { // Legacy list event route kept for compatibility.
    reply.header("Deprecation", "true");
    reply.header("Sunset", "Fri, 31 Jul 2026 00:00:00 GMT");
    reply.header("Link", "</api/v1/alerts>; rel=\"successor-version\"");
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.read");
    if (!auth) return;
    const query: any = (req.query as any) ?? {};
    const status = normalizeProjectedAlertStatus(query.status);
    const [operations, telemetry_health, action_overrides] = await Promise.all([
      listOperationInputsForAlertProjection(pool, auth),
      listTelemetryHealthInputsForAlertProjection(pool, auth),
      listAlertActionOverrides(pool, auth),
    ]);
    let items: AlertV1[] = projectAlertListV1({
      scope: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id },
      operations,
      telemetry_health,
      action_overrides,
      nowMs: Date.now(),
    });
    if (status) items = items.filter((item) => item.status === status);
    if (isNonEmptyString(query.object_id)) items = items.filter((item) => String(item.object_id ?? "") === String(query.object_id).trim());
    return reply.send({ ok: true, events: items });
  });
  app.post("/api/v1/alerts/rules", async (req, reply) => { // Create an alert rule.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write"); // Require alerts.write.
    if (!auth) return; // Auth responded.

    const body: any = (req as any).body ?? {}; // Parse body.

    const object_type = normalizeObjectType(body.object_type); // DEVICE|FIELD.
    if (!object_type) return badRequest(reply, "MISSING_OR_INVALID:object_type"); // Validate.

    const object_id = normalizeId(body.object_id); // Object id.
    if (!object_id) return badRequest(reply, "MISSING_OR_INVALID:object_id"); // Validate.

    const metric_candidate = (body.metric ?? body.rule_type) as any; // Prefer metric, fallback to legacy rule_type.
    const metric = isNonEmptyString(metric_candidate) ? String(metric_candidate).trim().slice(0, 128) : null; // Metric name.
    if (!metric) return badRequest(reply, "MISSING_OR_INVALID:metric"); // Validate.

    const operator = normalizeOperator(body.operator) ?? (metric === "DEVICE_OFFLINE" ? "GTE" : null); // Operator code.
    if (!operator) return badRequest(reply, "MISSING_OR_INVALID:operator"); // Validate.

    const status: RuleStatus = (normalizeRuleStatus(body.status) ?? "ACTIVE") as RuleStatus; // Default ACTIVE.
    const notify_channels = normalizeNotificationChannels(body.notify_channels); // Minimal notification config.
    const window_sec = body.window_sec == null ? null : clampInt(body.window_sec, 0, 0, 24 * 3600); // Optional window.
    const threshold_num = (typeof body.threshold_num === "number" && Number.isFinite(body.threshold_num)) ? body.threshold_num : null; // Numeric threshold.
    let threshold_ms = (typeof body.threshold_ms === "number" && Number.isFinite(body.threshold_ms)) ? Math.trunc(body.threshold_ms) : null; // Millisecond threshold.
    const offline_after_sec = (typeof body.offline_after_sec === "number" && Number.isFinite(body.offline_after_sec)) ? Math.trunc(body.offline_after_sec) : null; // Legacy seconds.
    if (threshold_ms == null && metric === "DEVICE_OFFLINE" && offline_after_sec != null) threshold_ms = Math.max(0, offline_after_sec) * 1000; // Legacy mapping.

    if (metric === "DEVICE_OFFLINE") { // Offline rule branch.
      if (threshold_ms == null || threshold_ms < 60_000) return badRequest(reply, "MISSING_OR_INVALID:threshold_ms"); // Require >=1min.
    } else { // Threshold rule branch.
      if (threshold_num == null) return badRequest(reply, "MISSING_OR_INVALID:threshold_num"); // Require numeric threshold.
    } // End validation.

    if (object_type === "DEVICE") { // Device rule validation.
      const devQ = await pool.query( // Check device exists.
        `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2`,
        [auth.tenant_id, object_id]
      ); // End query.
      if (devQ.rowCount === 0) return notFound(reply); // Device missing => 404.
    } // End device check.
    if (object_type === "FIELD") { // Field rule validation.
      const fieldQ = await pool.query( // Check field exists.
        `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2`,
        [auth.tenant_id, object_id]
      ); // End query.
      if (fieldQ.rowCount === 0) return notFound(reply); // Field missing => 404.
    } // End field check.

    const now_ms = Date.now(); // Server time.
    const rule_id = normalizeId(body.rule_id) ?? `rule_${randomUUID()}`; // Allow client-specified id for idempotency.
    const fact_id = `alrule_${randomUUID()}`; // Unique fact id.

    const record = { // Fact record.
      type: "alert_rule_created_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, rule_id }, // Entity envelope.
      payload: { // Payload.
        status, // Rule status.
        object_type, // Target object type.
        object_id, // Target object id.
        metric, // Metric.
        operator, // Operator.
        threshold_num, // Threshold number.
        threshold_ms, // Threshold ms.
        window_sec, // Optional evaluation window.
        notify_channels, // Minimal notification channels.
        created_ts_ms: now_ms, // Creation time.
        updated_ts_ms: now_ms, // Update time.
        actor_id: auth.actor_id, // Audit actor.
        token_id: auth.token_id, // Audit token.
      }, // End payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Transaction.
      await clientConn.query("BEGIN"); // Begin.

      await clientConn.query( // Insert fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query( // Upsert rule projection.
        `INSERT INTO alert_rule_index_v1
          (tenant_id, rule_id, status, object_type, object_id, metric, operator, threshold_num, threshold_ms, window_sec, notify_channels_json, created_ts_ms, updated_ts_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
         ON CONFLICT (tenant_id, rule_id) DO UPDATE SET
           status = EXCLUDED.status,
           object_type = EXCLUDED.object_type,
           object_id = EXCLUDED.object_id,
           metric = EXCLUDED.metric,
           operator = EXCLUDED.operator,
           threshold_num = EXCLUDED.threshold_num,
           threshold_ms = EXCLUDED.threshold_ms,
           window_sec = EXCLUDED.window_sec,
           notify_channels_json = EXCLUDED.notify_channels_json,
           updated_ts_ms = EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, rule_id, status, object_type, object_id, metric, operator, threshold_num, threshold_ms, window_sec, JSON.stringify(notify_channels), now_ms]
      ); // End upsert.

      let immediate_event_id: string | null = null; // Track auto-raised event id for response.
      if (status === "ACTIVE") { // Only active rules can raise events.
        const immediate = await maybeRaiseImmediateMetricEvent(clientConn, { // Evaluate current latest telemetry once.
          tenant_id: auth.tenant_id, // Tenant id.
          rule_id, // Rule id.
          object_type, // Object type.
          object_id, // Object id.
          metric, // Metric.
          operator, // Operator.
          threshold_num, // Numeric threshold.
          now_ms, // Evaluation time.
        }); // End evaluation.
        immediate_event_id = immediate.event_id; // Save event id when inserted.
      } // End active branch.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true, rule_id, immediate_event_id }); // Return rule id and optional immediate event.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Rollback.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // 500.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  }); // End POST /api/v1/alerts/rules.

  app.get("/api/v1/alerts/rules", async (req, reply) => { // List rules for tenant.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.read"); // Require alerts.read.
    if (!auth) return; // Auth responded.

    const query: any = (req.query as any) ?? {}; // Read query object.
    const statusFilter = normalizeRuleStatus(query.status); // Optional status filter.
    const objectTypeFilter = normalizeObjectType(query.object_type); // Optional object type filter.
    const objectIdFilter = normalizeId(query.object_id); // Optional object id filter.
    const metricFilter = isNonEmptyString(query.metric) ? String(query.metric).trim().slice(0, 128) : null; // Optional metric filter.

    const q = await pool.query( // Query rules with optional filters.
      `SELECT rule_id, status, object_type, object_id, metric, operator, threshold_num, threshold_ms, window_sec, notify_channels_json, created_ts_ms, updated_ts_ms
         FROM alert_rule_index_v1
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR status = $2)
          AND ($3::text IS NULL OR object_type = $3)
          AND ($4::text IS NULL OR object_id = $4)
          AND ($5::text IS NULL OR metric = $5)
        ORDER BY updated_ts_ms DESC
        LIMIT 500`,
      [auth.tenant_id, statusFilter, objectTypeFilter, objectIdFilter, metricFilter]
    ); // End query.

    return reply.send({ ok: true, rules: q.rows }); // Return list.
  }); // End GET rules.

  app.post("/api/v1/alerts/rules/:rule_id/disable", async (req, reply) => { // Disable an alert rule.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write"); // Require alerts.write.
    if (!auth) return; // Auth responded.

    const rule_id = normalizeId((req.params as any)?.rule_id); // Parse rule id.
    if (!rule_id) return notFound(reply); // Invalid => 404.

    const now_ms = Date.now(); // Server time.
    const fact_id = `alrule_disable_${randomUUID()}`; // Fact id.
    const record = { // Fact record.
      type: "alert_rule_disabled_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, rule_id }, // Entity.
      payload: { status: "DISABLED", updated_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Transaction.
      await clientConn.query("BEGIN"); // Begin.

      const upd = await clientConn.query( // Update rule status within tenant.
        `UPDATE alert_rule_index_v1
            SET status = 'DISABLED',
                updated_ts_ms = $3
          WHERE tenant_id = $1 AND rule_id = $2`,
        [auth.tenant_id, rule_id, now_ms]
      ); // End update.
      if (upd.rowCount === 0) { // Missing rule.
        await clientConn.query("ROLLBACK"); // Rollback.
        return notFound(reply); // Hide non-owned rules.
      } // End guard.

      await clientConn.query( // Insert audit fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true, rule_id, status: "DISABLED" }); // Return disabled result.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Rollback.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // 500.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  }); // End disable route.

  app.get("/api/v1/alerts/notifications", async (req, reply) => { // List notification records for tenant.
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.read"); // Require alerts.read.
    if (!auth) return;

    const query: any = (req.query as any) ?? {};
    const eventIdFilter = normalizeId(query.event_id);
    const ruleIdFilter = normalizeId(query.rule_id);
    const channelFilter = normalizeNotificationChannel(query.channel);

    const q = await pool.query(
      `SELECT notification_id, event_id, rule_id, channel, status, detail_json, created_ts_ms, delivered_ts_ms, error
         FROM alert_notification_index_v1
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR event_id = $2)
          AND ($3::text IS NULL OR rule_id = $3)
          AND ($4::text IS NULL OR channel = $4)
        ORDER BY created_ts_ms DESC
        LIMIT 1000`,
      [auth.tenant_id, eventIdFilter, ruleIdFilter, channelFilter]
    );

    return reply.send({ ok: true, notifications: q.rows });
  }); // End GET notifications.

  app.post("/api/v1/alerts/events/:event_id/ack", async (req, reply) => { // Acknowledge an alert event.
    reply.header("Deprecation", "true");
    reply.header("Sunset", "Fri, 31 Jul 2026 00:00:00 GMT");
    reply.header("Link", "</api/v1/alerts/:alert_id/ack>; rel=\"successor-version\"");
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write"); // Require alerts.write.
    if (!auth) return; // Auth responded.
    if (!enforceAlertActionRoleOrDeny(auth, reply)) return;

    const event_id = normalizeId((req.params as any)?.event_id); // Parse event id.
    if (!event_id) return notFound(reply); // Invalid => 404.

    const now_ms = Date.now(); // Server time.
    const fact_id = `alev_ack_${randomUUID()}`; // Fact id.
    const record = { // Fact record.
      type: "alert_event_acknowledged_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, event_id }, // Entity.
      payload: { acked_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.

      const upd = await clientConn.query( // Update projection (only if exists in tenant).
        `UPDATE alert_event_index_v1
            SET status = 'ACKED',
                acked_ts_ms = COALESCE(acked_ts_ms, $3)
          WHERE tenant_id = $1 AND event_id = $2
            AND status IN ('OPEN','ACKED')`,
        [auth.tenant_id, event_id, now_ms]
      ); // End update.
      if (upd.rowCount === 0) { // Not found or closed.
        await clientConn.query("ROLLBACK"); // Rollback.
        return notFound(reply); // Return 404 to avoid leaking state outside tenant.
      } // End guard.

      await clientConn.query( // Insert fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true }); // Ack ok.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Rollback.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // 500.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  }); // End ACK.

  app.post("/api/v1/alerts/events/:event_id/close", async (req, reply) => { // Close an alert event.
    reply.header("Deprecation", "true");
    reply.header("Sunset", "Fri, 31 Jul 2026 00:00:00 GMT");
    reply.header("Link", "</api/v1/alerts/:alert_id/resolve>; rel=\"successor-version\"");
    const auth: AoActAuthContextV0 | null = requireAoActScopeV0(req, reply, "alerts.write"); // Require alerts.write.
    if (!auth) return; // Auth responded.
    if (!enforceAlertActionRoleOrDeny(auth, reply)) return;

    const event_id = normalizeId((req.params as any)?.event_id); // Parse event id.
    if (!event_id) return notFound(reply); // Invalid => 404.

    const now_ms = Date.now(); // Server time.
    const fact_id = `alev_close_${randomUUID()}`; // Fact id.
    const record = { // Fact record.
      type: "alert_event_closed_v1", // Fact type.
      entity: { tenant_id: auth.tenant_id, event_id }, // Entity.
      payload: { closed_ts_ms: now_ms, actor_id: auth.actor_id, token_id: auth.token_id }, // Payload.
    }; // End record.

    const clientConn = await pool.connect(); // Acquire connection.
    try { // Tx.
      await clientConn.query("BEGIN"); // Begin.

      const upd = await clientConn.query( // Update projection.
        `UPDATE alert_event_index_v1
            SET status = 'CLOSED',
                closed_ts_ms = COALESCE(closed_ts_ms, $3)
          WHERE tenant_id = $1 AND event_id = $2
            AND status IN ('OPEN','ACKED')`,
        [auth.tenant_id, event_id, now_ms]
      ); // End update.
      if (upd.rowCount === 0) { // Not found or already closed.
        await clientConn.query("ROLLBACK"); // Rollback.
        return notFound(reply); // 404.
      } // End guard.

      await clientConn.query( // Insert fact.
        `INSERT INTO facts (fact_id, occurred_at, source, record_json)
         VALUES ($1, $2::timestamptz, $3, $4)`,
        [fact_id, nowIso(now_ms), "control", JSON.stringify(record)]
      ); // End insert.

      await clientConn.query("COMMIT"); // Commit.
      return reply.send({ ok: true }); // Close ok.
    } catch (e: any) { // Error.
      await clientConn.query("ROLLBACK"); // Rollback.
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR", detail: String(e?.message ?? e) }); // 500.
    } finally { // Release.
      clientConn.release(); // Release.
    } // End tx.
  }); // End CLOSE.
} // End registerAlertsV1Routes.

type AlertNotificationWorkerOptions = {
  interval_ms: number;
};

export function startAlertNotificationWorker(pool: Pool, opts?: Partial<AlertNotificationWorkerOptions>) {
  const interval_ms = opts?.interval_ms ?? 15_000;
  const tick = async (): Promise<void> => {
    try { await dispatchPendingNotifications(pool, 100); } catch { /* swallow */ }
  };
  const handle = setInterval(() => { void tick(); }, interval_ms);
  (handle as any).unref?.();
}

type OfflineWorkerOptions = { // Options for offline worker.
  interval_ms: number; // Polling interval.
  default_offline_after_ms: number; // Default threshold when rule missing threshold_ms.
}; // End options.

export function startOfflineAlertWorker(pool: Pool, opts?: Partial<OfflineWorkerOptions>) { // Start background worker in server process.
  const interval_ms = opts?.interval_ms ?? 60_000; // Default: 60s.
  const default_offline_after_ms = opts?.default_offline_after_ms ?? 15 * 60 * 1000; // Default: 15 min.

  async function tick(): Promise<void> { // One worker tick.
    const now_ms = Date.now(); // Current time in ms.

    const rulesQ = await pool.query( // Load all ACTIVE DEVICE_OFFLINE rules.
      `SELECT tenant_id, rule_id, object_id AS device_id, COALESCE(threshold_ms, $1::bigint) AS offline_after_ms
         FROM alert_rule_index_v1
        WHERE status = 'ACTIVE'
          AND object_type = 'DEVICE'
          AND metric = 'DEVICE_OFFLINE'`,
      [default_offline_after_ms]
    ); // End rule query.

    for (const r of rulesQ.rows) { // Process each rule.
      const tenant_id: string = r.tenant_id; // Tenant.
      const device_id: string = r.device_id; // Device.
      const rule_id: string = r.rule_id; // Rule.
      const offline_after_ms: number = Number(r.offline_after_ms); // Threshold.

      const stQ = await pool.query( // Load device status row.
        `SELECT last_heartbeat_ts_ms
           FROM device_status_index_v1
          WHERE tenant_id = $1 AND device_id = $2`,
        [tenant_id, device_id]
      ); // End query.
      if (stQ.rowCount === 0) continue; // No status => skip.
      const last_hb = stQ.rows[0]?.last_heartbeat_ts_ms; // Last heartbeat.
      if (typeof last_hb !== "number") continue; // Unknown => skip.
      if ((now_ms - last_hb) <= offline_after_ms) continue; // Not offline enough => skip.

      const clientConn = await pool.connect(); // Acquire connection for atomic insert/upsert.
      try { // Tx.
        await clientConn.query("BEGIN"); // Begin.
        await insertAlertEventIfMissing(clientConn, { // Insert OPEN event if missing.
          tenant_id, // Tenant id.
          rule_id, // Rule id.
          object_type: "DEVICE", // Object type.
          object_id: device_id, // Device id.
          metric: "DEVICE_OFFLINE", // Metric.
          now_ms, // Event time.
          last_value: { last_heartbeat_ts_ms: last_hb, offline_after_ms }, // Snapshot.
          source: "worker", // Worker source.
        }); // End insert.
        await clientConn.query("COMMIT"); // Commit.
      } catch { // Ignore worker errors.
        await clientConn.query("ROLLBACK"); // Rollback.
      } finally { // Release.
        clientConn.release(); // Release.
      } // End tx.
    } // End for rules.
  } // End tick.

  const handle = setInterval(() => { tick().catch(() => void 0); }, interval_ms); // Schedule tick; swallow errors.
  (handle as any).unref?.(); // Allow process to exit if this is the only active timer.
} // End startOfflineAlertWorker.
