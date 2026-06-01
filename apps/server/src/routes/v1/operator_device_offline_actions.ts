import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

type OfflineAction = "ACK_DEVICE_OFFLINE" | "MARK_DEVICE_OFFLINE_FOLLOWUP" | "CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE";
type OfflineStatus = "ACKED" | "FOLLOWUP_REQUIRED" | "TASK_CANDIDATE_CREATED";

type OfflineActionResponse = {
  ok: boolean;
  device_id: string;
  action: OfflineAction;
  audit_id: string;
  status: OfflineStatus;
  message: string;
  audit_policy: "NO_FORMAL_ACCEPTANCE_NO_FIELD_MEMORY_NO_ROI_NO_AO_ACT";
  created_at: string;
};

type DeviceRow = Record<string, unknown>;

const AUDIT_POLICY = "NO_FORMAL_ACCEPTANCE_NO_FIELD_MEMORY_NO_ROI_NO_AO_ACT" as const;

function safeText(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--" || raw === "undefined" || raw === "null") return "";
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(raw)) return "";
  return raw;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newAuditId(action: OfflineAction): string {
  return `audit_device_offline_${action.toLowerCase()}_${randomUUID().replace(/-/g, "")}`;
}

function responseFor(deviceId: string, action: OfflineAction, status: OfflineStatus, message: string): OfflineActionResponse {
  return {
    ok: true,
    device_id: deviceId,
    action,
    audit_id: newAuditId(action),
    status,
    message,
    audit_policy: AUDIT_POLICY,
    created_at: nowIso(),
  };
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const result = await pool.query("SELECT to_regclass($1)::text AS table_name", [`public.${table}`]);
  return Boolean(result.rows?.[0]?.table_name);
}

async function findDevice(pool: Pool, deviceId: string): Promise<DeviceRow | null> {
  if (!deviceId) return null;
  const tables = ["device_status_index_v1", "device_index_v1"];
  for (const table of tables) {
    if (!(await tableExists(pool, table))) continue;
    const result = await pool.query(`SELECT * FROM ${table} WHERE device_id = $1 LIMIT 1`, [deviceId]);
    const row = result.rows?.[0];
    if (row) return row;
  }
  return null;
}

async function writeAuditFact(pool: Pool, auth: AoActAuthContextV0, result: OfflineActionResponse, device: DeviceRow | null): Promise<void> {
  const record = {
    type: "operator_device_offline_action_audit_v1",
    payload: {
      audit_id: result.audit_id,
      device_id: result.device_id,
      action: result.action,
      status: result.status,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      role: auth.role,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      source_lane: "OPERATOR_DEVICE_OFFLINE_ACTION",
      audit_policy: AUDIT_POLICY,
      device_snapshot: {
        device_id: safeText(device?.device_id),
        field_id: safeText(device?.field_id),
        online_status: safeText(device?.online_status ?? device?.status),
        last_heartbeat_ts_ms: device?.last_heartbeat_ts_ms ?? null,
        last_telemetry_ts_ms: device?.last_telemetry_ts_ms ?? null,
      },
      note: result.message,
      created_at: result.created_at,
    },
  };
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [randomUUID(), "api/v1/operator/device-offline/action", record]);
}

function featureBoundaryError(deviceId: string, action: OfflineAction, message: string) {
  return {
    ok: false,
    device_id: deviceId,
    action,
    status: "FEATURE_DISABLED",
    message,
    audit_policy: AUDIT_POLICY,
  };
}

async function handleOfflineAction(req: any, reply: any, pool: Pool, action: OfflineAction, status: OfflineStatus): Promise<void> {
  const auth = requireAoActAnyScopeV0(req, reply, ["operator.device_offline.write", "devices.write"]);
  const deviceId = safeText(req.params?.device_id);
  if (!auth) return;
  if (!deviceId) return reply.code(400).send(featureBoundaryError(deviceId, action, "设备定位信息缺失。"));

  const device = await findDevice(pool, deviceId);
  if (!device) {
    return reply.code(404).send({
      ok: false,
      device_id: deviceId,
      action,
      status: "DEVICE_NOT_FOUND",
      message: "操作未完成：设备不存在 / 设备明细不可用",
      audit_policy: AUDIT_POLICY,
    });
  }

  const message = action === "ACK_DEVICE_OFFLINE"
    ? "已记录设备离线确认。"
    : action === "MARK_DEVICE_OFFLINE_FOLLOWUP"
      ? "已记录设备离线需人工核查。"
      : "已记录设备离线维护任务候选；不会自动生成 AO-ACT。";
  const result = responseFor(deviceId, action, status, message);

  try {
    await writeAuditFact(pool, auth, result, device);
  } catch {
    return reply.code(503).send({
      ok: false,
      device_id: deviceId,
      action,
      status: "AUDIT_WRITE_FAILED",
      message: "审计写入失败，动作未执行。",
      audit_policy: AUDIT_POLICY,
    });
  }

  return reply.send(result);
}

export function registerOperatorDeviceOfflineActionRoutes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/operator/devices/:device_id/offline/ack", async (req: any, reply) => {
    return handleOfflineAction(req, reply, pool, "ACK_DEVICE_OFFLINE", "ACKED");
  });

  app.post("/api/v1/operator/devices/:device_id/offline/followup", async (req: any, reply) => {
    return handleOfflineAction(req, reply, pool, "MARK_DEVICE_OFFLINE_FOLLOWUP", "FOLLOWUP_REQUIRED");
  });

  app.post("/api/v1/operator/devices/:device_id/offline/inspection-task-candidate", async (req: any, reply) => {
    return handleOfflineAction(req, reply, pool, "CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE", "TASK_CANDIDATE_CREATED");
  });
}
