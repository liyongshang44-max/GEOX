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
  try {
    obj = text ? JSON.parse(text) : {};
  } catch {
    obj = { _non_json: text };
  }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}

export function createIrrigationSimulatorAdapter(ctx: AdapterRuntimeContext): Adapter {
  async function markPublished(task: AoActTask, dispatchCtx: AdapterRuntimeContext, commandId: string): Promise<void> {
    const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
    const outboxFactId = String(task.outbox_fact_id ?? "").trim();
    const topic = String(task.downlink_topic ?? task.meta?.downlink_topic ?? `/device/${deviceId}/cmd`).trim();

    if (!task.act_task_id) throw new Error("MISSING_ACT_TASK_ID");
    if (!deviceId) throw new Error("MISSING_DEVICE_ID");
    if (!outboxFactId) throw new Error("MISSING_OUTBOX_FACT_ID");
    if (!topic) throw new Error("MISSING_TOPIC");

    try {
      const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/downlinks/published`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          act_task_id: task.act_task_id,
          outbox_fact_id: outboxFactId,
          device_id: deviceId,
          topic,
          qos: Number(task.qos ?? 1),
          retain: Boolean(task.retain ?? false),
          adapter_runtime: "irrigation_simulator_v1",
          adapter_message_id: null,
          command_payload_sha256: null,
          lease_token: dispatchCtx.lease_token ?? null,
          executor_id: String(dispatchCtx.executor_id ?? "")
        })
      });

      if (!out?.ok) throw new Error(`PUBLISHED_WRITE_FAILED:${JSON.stringify(out)}`);
      console.log(`INFO: simulator published success act_task_id=${task.act_task_id} command_id=${commandId}`);
    } catch (error: any) {
      const msg = String(error?.message ?? error);

      if (msg.includes("TASK_ALREADY_HAS_RECEIPT")) {
        console.log(`WARN: simulator published skipped act_task_id=${task.act_task_id} reason=already_has_receipt`);
        return;
      }

      if (msg.includes("already_published") || msg.includes("http 409")) {
        console.log(`WARN: simulator published dedupe act_task_id=${task.act_task_id}`);
        return;
      }

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
      const commandId = String(task.command_id ?? task.act_task_id).trim();
      if (!commandId) throw new Error("MISSING_COMMAND_ID");

      // 关键：必须先 published，再 execute
      await markPublished(task, dispatchCtx, commandId);

      let out: any;
      try {
        out = await httpJson(`${ctx.baseUrl}/api/v1/simulators/irrigation/execute`, ctx.token, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: task.tenant_id,
            project_id: task.project_id,
            group_id: task.group_id,
            act_task_id: task.act_task_id,
            task_id: task.act_task_id,
            command_id: commandId,
            parameters: task.parameters
          })
        });
      } catch (error: any) {
        const msg = String(error?.message ?? error);

        if (msg.includes("TASK_ALREADY_HAS_RECEIPT")) {
          console.log(`WARN: simulator execute skipped act_task_id=${task.act_task_id} reason=already_has_receipt`);
          return {
            command_id: commandId,
            adapter_type: "irrigation_simulator",
            receipt_status: "ACKED",
            adapter_payload: { ok: true, deduped: true }
          };
        }

        throw error;
      }

      console.log(`INFO: simulator execute success act_task_id=${task.act_task_id} command_id=${commandId}`);

      // 不要再写 receipts/uplink；
      // execute 端点已经在服务端内部落 control receipt
      return {
        command_id: commandId,
        adapter_type: "irrigation_simulator",
        receipt_status: "ACKED",
        adapter_payload: out ?? null
      };
    }
  };
}