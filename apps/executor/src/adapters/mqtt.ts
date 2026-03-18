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

function normalizeAdapterHint(task: AoActTask): string {
  const value = String(task.adapter_hint ?? task.adapter_type ?? "mqtt").trim().toLowerCase();
  if (!value) return "mqtt_downlink_once_v1";
  if (value === "mqtt") return "mqtt_downlink_once_v1";
  return value;
}

export function createMqttAdapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    async dispatch(task: AoActTask): Promise<{ command_id: string }> {
      const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/tasks/${encodeURIComponent(task.act_task_id)}/dispatch`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          command_id: task.command_id,
          adapter_hint: normalizeAdapterHint(task)
        })
      });
      if (!out?.ok) throw new Error(`mqtt dispatch failed: ${JSON.stringify(out)}`);
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
