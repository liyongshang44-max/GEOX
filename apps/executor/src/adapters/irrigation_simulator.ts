import type { Adapter, AdapterRuntimeContext, AoActTask } from "./index";

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  };
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await res.text();
  let obj: any = null;
  try { obj = text ? JSON.parse(text) : {}; } catch { obj = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}

export function createIrrigationSimulatorAdapter(ctx: AdapterRuntimeContext): Adapter {
  async function markPublished(task: AoActTask, dispatchCtx: AdapterRuntimeContext, commandId: string): Promise<void> {
    const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
    const outboxFactId = String(task.outbox_fact_id ?? "").trim();
    if (!deviceId) throw new Error("MISSING_DEVICE_ID");
    if (!outboxFactId) throw new Error("MISSING_OUTBOX_FACT_ID");
    const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/downlinks/published`, ctx.token, {
      method: "POST",
      body: JSON.stringify({
        tenant_id: task.tenant_id,
        project_id: task.project_id,
        group_id: task.group_id,
        act_task_id: task.act_task_id,
        task_id: task.act_task_id,
        command_id: commandId,
        outbox_fact_id: outboxFactId,
        device_id: deviceId,
        adapter_type: "irrigation_simulator",
        topic: task.downlink_topic ?? `/device/${deviceId}/cmd`,
        qos: Number(task.qos ?? 1),
        retain: Boolean(task.retain ?? false),
        published_ts: Date.now(),
        lease_token: dispatchCtx.lease_token ?? null,
        executor_id: dispatchCtx.executor_id ?? null,
        adapter_runtime: "irrigation_simulator_v1"
      })
    });
    if (!out?.ok) throw new Error(`PUBLISHED_WRITE_FAILED:${JSON.stringify(out)}`);
    console.log(`INFO: simulator published success act_task_id=${task.act_task_id} command_id=${commandId}`);
  }

  async function sendReceiptUplink(task: AoActTask, dispatchCtx: AdapterRuntimeContext, commandId: string): Promise<void> {
    const now = Date.now();
    const attemptNo = Math.max(1, Number(dispatchCtx.attempt_no ?? task.meta?.attempt_no ?? 1));
    const receiptCode = "ACK";
    const idempotencyKey = `${task.act_task_id}:${attemptNo}:${receiptCode}`;
    const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
    if (!deviceId) throw new Error("MISSING_DEVICE_ID");
    try {
      const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/receipts/uplink`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          task_id: task.act_task_id,
          act_task_id: task.act_task_id,
          command_id: commandId,
          device_id: deviceId,
          status: "executed",
          start_ts: now - 100,
          end_ts: now,
          meta: {
            idempotency_key: idempotencyKey,
            adapter_type: "irrigation_simulator",
            attempt_no: attemptNo,
            receipt_status: "SUCCEEDED",
            receipt_code: receiptCode,
            received_ts: now
          }
        })
      });
      if (!out?.ok) throw new Error(`RECEIPT_UPLINK_FAILED:${JSON.stringify(out)}`);
      console.log(`INFO: simulator receipt uplink success act_task_id=${task.act_task_id} idempotency_key=${idempotencyKey}`);
    } catch (error: any) {
      const msg = String(error?.message ?? error);
      if (msg.includes("http 409")) {
        console.log(`WARN: simulator receipt uplink dedupe act_task_id=${task.act_task_id} idempotency_key=${idempotencyKey}`);
        return;
      }
      console.log(`ERROR: simulator receipt uplink failed act_task_id=${task.act_task_id} error=${msg}`);
      throw error;
    }
  }

  return {
    adapter_type: "irrigation_simulator",
    supports(action_type: string): boolean {
      const normalized = String(action_type ?? "").trim().toLowerCase();
      return normalized === "irrigation.start" || normalized === "irrigate";
    },
    validate(task: AoActTask) {
      if (!task.act_task_id) return { ok: false as const, reason: "MISSING_ACT_TASK_ID" };
      return { ok: true as const };
    },
    async dispatch(task: AoActTask, dispatchCtx: AdapterRuntimeContext) {
      const out = await httpJson(`${ctx.baseUrl}/api/v1/simulators/irrigation/execute`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          task_id: task.act_task_id,
          command_id: task.command_id,
          parameters: task.parameters
        })
      });
      const commandId = String(out?.command_id ?? task.command_id).trim();
      if (!commandId) throw new Error(`INVALID_IRRIGATION_EXECUTE_RESPONSE:${JSON.stringify(out)}`);
      console.log(`INFO: simulator execute success act_task_id=${task.act_task_id} command_id=${commandId}`);
      await markPublished(task, dispatchCtx, commandId);
      await sendReceiptUplink(task, dispatchCtx, commandId);
      return {
        command_id: commandId,
        adapter_type: "irrigation_simulator",
        receipt_status: "ACKED",
        adapter_payload: out ?? null
      };
    }
  };
}
