import type { AoActTask, DispatchContext } from "../adapters";

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

export function createExecutorApi(ctx: DispatchContext) {
  return {
    async publishDownlink(task: AoActTask): Promise<any> {
      return httpJson(`${ctx.baseUrl}/api/v1/ao-act/downlinks/published`, ctx.token, {
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
          lease_token: task.runtime?.lease_token ?? null,
          executor_id: task.runtime?.executor_id ?? ctx.executor_id ?? null,
          adapter_runtime: `${String(task.adapter_type ?? "unknown") || "unknown"}_v1`
        })
      });
    },

    async executeIrrigationSimulator(task: AoActTask): Promise<any> {
      const simulatorToken = ctx.executor_token ?? ctx.token;
      return httpJson(`${ctx.baseUrl}/api/v1/simulators/irrigation/execute`, simulatorToken, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          act_task_id: task.act_task_id,
          task_id: task.act_task_id,
          command_id: task.command_id,
          parameters: task.parameters
        })
      });
    }
  };
}

export type ExecutorApi = ReturnType<typeof createExecutorApi>;
