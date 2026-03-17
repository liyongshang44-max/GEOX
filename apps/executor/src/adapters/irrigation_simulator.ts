import type { ActuatorAdapter, AdapterRuntimeContext, AoActTask, DispatchResult } from "./index";

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

export function createIrrigationSimulatorAdapter(ctx: AdapterRuntimeContext): ActuatorAdapter {
  return {
    adapter_type: "irrigation_simulator",
    supports(actionType: string): boolean {
      return actionType === "IRRIGATE" || actionType === "irrigation.start";
    },
    async dispatch(task: AoActTask): Promise<DispatchResult> {
      try {
        const payload = {
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          act_task_id: task.act_task_id,
          parameters: task.parameters
        };
        const out = await httpJson(`${ctx.baseUrl}/api/v1/simulators/irrigation/execute`, ctx.token, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        return {
          adapter_type: "irrigation_simulator",
          ok: true,
          receipt_fact_id: out?.receipt_fact_id ? String(out.receipt_fact_id) : undefined,
          detail: out
        };
      } catch (error: any) {
        return {
          adapter_type: "irrigation_simulator",
          ok: false,
          error: error?.message ?? String(error)
        };
      }
    }
  };
}
