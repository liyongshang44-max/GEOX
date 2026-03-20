import type { Adapter, AdapterRuntimeContext, AoActTask } from "./index";

async function httpJson(url: string, token: string, init?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  if (init?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as any) } });
  const text = await res.text();
  let obj: any = null;
  try { obj = text ? JSON.parse(text) : {}; } catch { obj = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return obj;
}

async function loadCapabilities(ctx: AdapterRuntimeContext, task: AoActTask, device_id: string): Promise<string[] | null> {
  try {
    const out = await httpJson(`${ctx.baseUrl}/api/v1/devices/${encodeURIComponent(device_id)}/capabilities`, ctx.token, { method: "GET" });
    return Array.isArray(out?.capabilities) ? out.capabilities.map((v: unknown) => String(v ?? "").trim().toLowerCase()).filter(Boolean) : null;
  } catch {
    const taskCapabilities = Array.isArray(task.meta?.capabilities) ? task.meta.capabilities : null;
    return taskCapabilities ? taskCapabilities.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean) : null;
  }
}

export function createIrrigationRealAdapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    type: "irrigation_real",
    adapter_type: "irrigation_real",
    supports(action_type: string): boolean {
      const normalized = String(action_type ?? "").trim().toLowerCase();
      return normalized === "irrigation.start" || normalized === "irrigate";
    },
    validate(task: AoActTask) {
      if (!String(task.outbox_fact_id ?? "").trim()) return { ok: false as const, reason: "MISSING_OUTBOX_FACT_ID" };
      if (!String(task.device_id ?? task.meta?.device_id ?? "").trim()) return { ok: false as const, reason: "MISSING_DEVICE_ID" };
      return { ok: true as const };
    },
    async execute(task: AoActTask) {
      const device_id = String(task.device_id ?? task.meta?.device_id ?? "").trim();
      const capabilities = await loadCapabilities(ctx, task, device_id);
      if (capabilities && !capabilities.includes("irrigation")) {
        return { status: "FAILED", meta: { reason: `DEVICE_CAPABILITY_MISSING_IRRIGATION:${device_id}` } };
      }

      const out = await httpJson(`${ctx.baseUrl}/api/v1/ao-act/downlinks/published`, ctx.token, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: task.tenant_id,
          project_id: task.project_id,
          group_id: task.group_id,
          act_task_id: task.act_task_id,
          command_id: task.command_id,
          outbox_fact_id: task.outbox_fact_id,
          device_id,
          topic: `/device/${device_id}/cmd`,
          qos: 1,
          retain: false,
          lease_token: task.runtime?.lease_token ?? null,
          executor_id: task.runtime?.executor_id ?? ctx.executor_id ?? null,
          adapter_runtime: "irrigation_real_adapter_v1"
        })
      });

      if (!out?.ok) return { status: "FAILED", meta: { reason: `IRRIGATION_REAL_PUBLISH_FAILED:${JSON.stringify(out)}` } };
      return {
        status: "SUCCEEDED",
        meta: { receipt_status: "ACKED", published_fact_id: out.published_fact_id ?? null }
      };
    }
  };
}
