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
    async dispatch(task: AoActTask) {
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
      return {
        command_id: commandId,
        adapter_type: "irrigation_simulator",
        receipt_status: "ACKED",
        adapter_payload: out ?? null
      };
    }
  };
}
