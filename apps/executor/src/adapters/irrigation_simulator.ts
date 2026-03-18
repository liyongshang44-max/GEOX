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
  try { obj = text ? JSON.parse(text) : {}; } catch { obj = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}

export function createIrrigationSimulatorAdapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    async dispatch(task: AoActTask): Promise<{ command_id: string }> {
      const payload = {
        tenant_id: task.tenant_id,
        project_id: task.project_id,
        group_id: task.group_id,
        act_task_id: task.act_task_id,
        command_id: task.command_id,
        parameters: task.parameters
      };
      const out = await httpJson(`${ctx.baseUrl}/api/v1/simulators/irrigation/execute`, ctx.token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const commandId = String(out?.command_id ?? task.command_id).trim();
      if (!commandId) throw new Error(`invalid irrigation execute response: ${JSON.stringify(out)}`);
      return { command_id: commandId };
    },
    handleReceipt(msg: unknown): Receipt {
      const payload = msg && typeof msg === "object" ? (msg as Record<string, unknown>) : {};
      return {
        command_id: String(payload.command_id ?? payload.act_task_id ?? ""),
        status: typeof payload.status === "string" ? payload.status : undefined,
        payload
      };
    }
  };
}
