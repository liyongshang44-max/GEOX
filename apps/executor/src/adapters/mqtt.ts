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

export function createMqttAdapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    adapter_type: "mqtt",
    supports(action_type: string): boolean {
      const a = String(action_type ?? "").trim().toLowerCase();
      return a !== "";
    },
    validate(task: AoActTask) {
      if (!String(task.outbox_fact_id ?? "").trim()) return { ok: false as const, reason: "MISSING_OUTBOX_FACT_ID" };
      if (!String(task.device_id ?? task.meta?.device_id ?? "").trim()) return { ok: false as const, reason: "MISSING_DEVICE_ID" };
      if (!String(task.downlink_topic ?? "").trim()) return { ok: false as const, reason: "MISSING_DOWNLINK_TOPIC" };
      return { ok: true as const };
    },
    async dispatch(task: AoActTask, dispatchCtx) {
      const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/downlinks/published`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          act_task_id: task.act_task_id,
          command_id: task.command_id,
          outbox_fact_id: task.outbox_fact_id,
          device_id: task.device_id ?? task.meta?.device_id,
          topic: task.downlink_topic,
          qos: task.qos ?? 1,
          retain: task.retain ?? false,
          lease_token: dispatchCtx.lease_token ?? null,
          executor_id: dispatchCtx.executor_id ?? null,
          adapter_runtime: "mqtt_downlink_once_v1"
        })
      });

      if (!out?.ok) throw new Error(`mqtt publish failed: ${JSON.stringify(out)}`);

      return {
        command_id: task.command_id,
        adapter_type: "mqtt",
        receipt_status: "ACKED",
        adapter_payload: { published_fact_id: out.published_fact_id ?? null }
      };
    }
  };
}
