import type { Adapter, AdapterRuntimeContext, AoActTask, Receipt } from "./index";

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

export function createMqttAdapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    async dispatch(task: AoActTask): Promise<{ command_id: string }> {
      const outbox_fact_id = String(task.outbox_fact_id ?? "").trim();
      const device_id = String(task.device_id ?? task.meta?.device_id ?? "").trim();
      const topic = String(task.downlink_topic ?? "").trim();

      if (!outbox_fact_id) {
        throw new Error(`mqtt adapter missing outbox_fact_id act_task_id=${task.act_task_id}`);
      }
      if (!device_id) {
        throw new Error(`mqtt adapter missing device_id act_task_id=${task.act_task_id}`);
      }
      if (!topic) {
        throw new Error(`mqtt adapter missing downlink_topic act_task_id=${task.act_task_id}`);
      }

      const out = await httpJson(
        `${ctx.baseUrl}/api/v1/ao-act/downlinks/published`,
        ctx.token,
        {
          method: "POST",
          body: JSON.stringify({
            tenant_id: task.tenant_id,
            project_id: task.project_id,
            group_id: task.group_id,
            act_task_id: task.act_task_id,
            command_id: task.command_id,
            outbox_fact_id,
            device_id,
            topic,
            qos: task.qos ?? 1,
            retain: task.retain ?? false,
            adapter_runtime: "mqtt_downlink_once_v1"
          })
        }
      );

      if (!out?.ok) {
        throw new Error(`mqtt publish failed: ${JSON.stringify(out)}`);
      }

      return { command_id: task.command_id };
    },

    handleReceipt(msg: unknown): Receipt {
      const payload = msg && typeof msg === "object" ? (msg as Record<string, unknown>) : {};
      return {
        command_id: String(payload.command_id ?? payload.task_id ?? ""),
        status: typeof payload.status === "string" ? payload.status : undefined,
        payload
      };
    }
  };
}