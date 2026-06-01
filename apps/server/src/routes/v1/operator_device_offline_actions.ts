import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

type OfflineAction = "ACK_DEVICE_OFFLINE" | "MARK_DEVICE_OFFLINE_FOLLOWUP" | "CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE";
type OfflineStatus = "ACKED" | "FOLLOWUP_REQUIRED" | "TASK_CANDIDATE_CREATED";
type DeviceRow = Record<string, unknown>;

const AUDIT_POLICY = "NO_FORMAL_ACCEPTANCE_NO_FIELD_MEMORY_NO_ROI_NO_AO_ACT" as const;
const OFFLINE_POLICY_SCOPE = "operator.device_offline.write";

function safeText(value: unknown): string {
  const raw = String(value ?? "").trim();
  return !raw || raw === "--" || raw === "undefined" || raw === "null" ? "" : raw;
}

function nowIso(): string {
  return new Date().toISOString();
}

function auditId(): string {
  return `audit_device_offline_${randomUUID().replace(/-/g, "")}`;
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query("SELECT to_regclass($1)::text AS table_name", [`public.${table}`]);
  return Boolean(result.rows?.[0]?.table_name);
}

async function findDevice(pool: Pool, deviceId: string): Promise<DeviceRow | null> {
  if (!deviceId) return null;
  for (const table of ["device_status_index_v1", "device_index_v1"]) {
    if (!(await tableExists(pool, table))) continue;
    const result = await pool.query(`SELECT * FROM ${table} WHERE device_id = $1 LIMIT 1`, [deviceId]);
    if (result.rows?.[0]) return result.rows[0] as DeviceRow;
  }
  return null;
}

async function writeAuditFact(pool: Pool, auth: AoActAuthContextV0, payload: Record<string, unknown>): Promise<void> {
  const record = {
    type: "operator_device_offline_action_audit_v1",
    payload: {
      ...payload,
      actor_id: auth.actor_id,
      role: auth.role,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      policy_scope: OFFLINE_POLICY_SCOPE,
      audit_policy: AUDIT_POLICY,
      source_lane: "OPERATOR_DEVICE_OFFLINE_ACTION",
    },
  };
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [randomUUID(), "api/v1/operator/device-offline/action", record]);
}

function featureBoundaryError(deviceId: string, action: OfflineAction, message: string) {
  return { ok: false, device_id: deviceId, action, status: "FEATURE_DISABLED", message, audit_policy: AUDIT_POLICY };
}

async function handleOfflineAction(req: any, reply: any, pool: Pool, action: OfflineAction, status: OfflineStatus): Promise<any> {
  const auth = requireAoActAnyScopeV0(req, reply, [OFFLINE_POLICY_SCOPE as any, "devices.write"]);
  if (!auth) return;
  const deviceId = safeText(req.params?.device_id);
  if (!deviceId) return reply.code(400).send(featureBoundaryError(deviceId, action, "设备定位信息缺失。"));

  const device = await findDevice(pool, deviceId);
  if (!device) {
    return reply.code(404).send({ ok: false, device_id: deviceId, action, status: "DEVICE_NOT_FOUND", message: "操作未完成：设备不存在 / 设备明细不可用", audit_policy: AUDIT_POLICY });
  }

  const audit_id = auditId();
  const message = action === "ACK_DEVICE_OFFLINE"
    ? "已记录设备离线确认。"
    : action === "MARK_DEVICE_OFFLINE_FOLLOWUP"
      ? "已记录设备离线需人工核查。"
      : "已记录设备离线维护任务候选；不会自动生成 AO-ACT。";
  const response = { ok: true, device_id: deviceId, action, audit_id, status, message, audit_policy: AUDIT_POLICY, created_at: nowIso() };

  try {
    await writeAuditFact(pool, auth, {
      ...response,
      device_snapshot: {
        device_id: safeText(device["device_id"]),
        field_id: safeText(device["field_id"]),
        online_status: safeText(device["online_status"] ?? device["status"]),
      },
    });
  } catch {
    return reply.code(503).send({ ok: false, device_id: deviceId, action, status: "AUDIT_WRITE_FAILED", message: "审计写入失败，动作未执行。", audit_policy: AUDIT_POLICY });
  }

  return reply.send(response);
}

export function registerOperatorDeviceOfflineActionRoutes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/operator/devices/:device_id/offline/ack", async (req: any, reply) => handleOfflineAction(req, reply, pool, "ACK_DEVICE_OFFLINE", "ACKED"));
  app.post("/api/v1/operator/devices/:device_id/offline/followup", async (req: any, reply) => handleOfflineAction(req, reply, pool, "MARK_DEVICE_OFFLINE_FOLLOWUP", "FOLLOWUP_REQUIRED"));
  app.post("/api/v1/operator/devices/:device_id/offline/inspection-task-candidate", async (req: any, reply) => handleOfflineAction(req, reply, pool, "CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE", "TASK_CANDIDATE_CREATED"));
}
