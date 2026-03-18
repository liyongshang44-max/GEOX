import crypto from "node:crypto";
import process from "node:process";

type ReceiptStatus = "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED";

type Args = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  device_id: string;
  command_id: string;
  task_id: string;
  operation_plan_id: string;
  adapter_type: string;
  attempt_no: number;
  receipt_status: ReceiptStatus;
  receipt_code: string;
  receipt_message: string;
  ts_ms: number;
};

function parseArgs(argv: string[]): Args {
  const get = (k: string): string | undefined => {
    const idx = argv.indexOf(`--${k}`);
    if (idx === -1) return undefined;
    const v = argv[idx + 1];
    if (!v || v.startsWith("--")) return undefined;
    return v;
  };

  const baseUrl = get("baseUrl") ?? process.env.GEOX_BASE_URL ?? "http://127.0.0.1:3000";
  const token = get("token") ?? process.env.GEOX_AO_ACT_TOKEN ?? "";
  const tenant_id = get("tenant_id") ?? process.env.GEOX_TENANT_ID ?? "tenantA";
  const project_id = get("project_id") ?? process.env.GEOX_PROJECT_ID ?? "projectA";
  const group_id = get("group_id") ?? process.env.GEOX_GROUP_ID ?? "groupA";
  const device_id = get("device_id") ?? process.env.GEOX_DEVICE_ID ?? "device_uplink_001";
  const command_id = get("command_id") ?? process.env.GEOX_COMMAND_ID ?? "";
  const task_id = get("task_id") ?? process.env.GEOX_TASK_ID ?? "";
  const operation_plan_id = get("operation_plan_id") ?? process.env.GEOX_OPERATION_PLAN_ID ?? "";
  const adapter_type = get("adapter_type") ?? process.env.GEOX_ADAPTER_TYPE ?? "mqtt";
  const attempt_no = Math.max(1, Number.parseInt(get("attempt_no") ?? process.env.GEOX_ATTEMPT_NO ?? "1", 10) || 1);
  const receipt_status = String(get("receipt_status") ?? process.env.GEOX_RECEIPT_STATUS ?? "SUCCEEDED").trim().toUpperCase() as ReceiptStatus;
  const receipt_code = String(get("receipt_code") ?? process.env.GEOX_RECEIPT_CODE ?? receipt_status).trim() || receipt_status;
  const receipt_message = String(get("receipt_message") ?? process.env.GEOX_RECEIPT_MESSAGE ?? "").trim();
  const ts_ms = Number.parseInt(get("ts_ms") ?? process.env.GEOX_TS_MS ?? `${Date.now()}`, 10) || Date.now();

  if (!token) throw new Error("missing token (set --token or GEOX_AO_ACT_TOKEN)");
  if (!command_id) throw new Error("missing command_id");
  if (!task_id) throw new Error("missing task_id");
  if (!operation_plan_id) throw new Error("missing operation_plan_id");
  if (command_id !== task_id) throw new Error("command_id must equal task_id");

  return { baseUrl, token, tenant_id, project_id, group_id, device_id, command_id, task_id, operation_plan_id, adapter_type, attempt_no, receipt_status, receipt_code, receipt_message, ts_ms };
}

async function postJson(url: string, token: string, body: any): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const idempotency_key = `${args.task_id}:${args.attempt_no}:${args.receipt_code}`;

  const body = {
    tenant_id: args.tenant_id,
    project_id: args.project_id,
    group_id: args.group_id,
    task_id: args.task_id,
    act_task_id: args.task_id,
    command_id: args.command_id,
    operation_plan_id: args.operation_plan_id,
    device_id: args.device_id,
    status: args.receipt_status === "FAILED" ? "failed" : "executed",
    start_ts: Math.max(0, args.ts_ms - 20),
    end_ts: args.ts_ms,
    ts_ms: args.ts_ms,
    observed_parameters: {},
    raw_payload: {
      command_id: args.command_id,
      task_id: args.task_id,
      operation_plan_id: args.operation_plan_id,
      receipt_status: args.receipt_status,
      receipt_code: args.receipt_code,
      ts_ms: args.ts_ms
    },
    meta: {
      schema: "ao_act_receipt_v1",
      idempotency_key,
      task_id: args.task_id,
      command_id: args.command_id,
      device_id: args.device_id,
      adapter_type: args.adapter_type,
      attempt_no: args.attempt_no,
      receipt_status: args.receipt_status,
      receipt_code: args.receipt_code,
      receipt_message: args.receipt_message || null,
      received_ts: args.ts_ms,
      source: "run_mqtt_receipt_uplink_once",
      receipt_message_id: `receipt_${crypto.randomUUID().replace(/-/g, "")}`
    }
  };

  const out = await postJson(`${args.baseUrl}/api/v1/ao-act/receipts/uplink`, args.token, body);
  if (out.status === 409 && String(out.json?.error ?? "") === "DUPLICATE_RECEIPT") {
    console.log(`INFO: duplicate receipt ignored command_id=${args.command_id} task_id=${args.task_id}`);
    return;
  }
  if (out.status >= 300 || !out.json?.ok) {
    throw new Error(`receipt uplink failed status=${out.status} body=${out.text}`);
  }

  console.log(`PASS: receipt uplink command_id=${args.command_id} task_id=${args.task_id} attempt_no=${args.attempt_no} receipt_status=${args.receipt_status} ts_ms=${args.ts_ms}`);
}

main().catch((err) => {
  console.error(`FAIL: ${err?.message ?? String(err)}`);
  process.exit(1);
});
