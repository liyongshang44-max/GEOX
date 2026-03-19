import type { Adapter, AdapterRuntimeContext, AoActTask } from "./index";

async function postJson(url: string, token: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _non_json: text }; }
  if (!res.ok) throw new Error(`http ${res.status}: ${text}`);
  return json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDeviceCommandUrl(ctx: AdapterRuntimeContext, task: AoActTask, deviceId: string): string {
  const mockUrl = String(task.meta?.mock_http_url ?? process.env.GEOX_IRRIGATION_HTTP_MOCK_URL ?? "").trim();
  if (mockUrl) return `${mockUrl.replace(/\/$/, "")}/device/${encodeURIComponent(deviceId)}/irrigate`;
  return `${ctx.baseUrl}/device/${encodeURIComponent(deviceId)}/irrigate`;
}

export function createIrrigationHttpV1Adapter(ctx: AdapterRuntimeContext): Adapter {
  return {
    adapter_type: "irrigation_http_v1",
    supports(action_type: string): boolean {
      return ["irrigation.start", "irrigate"].includes(String(action_type ?? "").trim().toLowerCase());
    },
    validate(task: AoActTask) {
      if (!String(task.device_id ?? task.meta?.device_id ?? "").trim()) return { ok: false as const, reason: "MISSING_DEVICE_ID" };
      if (!String(task.operation_plan_id ?? task.meta?.operation_plan_id ?? "").trim()) return { ok: false as const, reason: "MISSING_OPERATION_PLAN_ID" };
      return { ok: true as const };
    },
    async dispatch(task: AoActTask) {
      const deviceId = String(task.device_id ?? task.meta?.device_id ?? "").trim();
      const simulateTimeout = Boolean(task.meta?.simulate_timeout);
      const simulateRetry = Number(task.meta?.simulate_retry_count ?? 0);
      const dispatchUrl = resolveDeviceCommandUrl(ctx, task, deviceId);
      let lastErr: any = null;

      for (let i = 0; i <= Math.max(0, simulateRetry); i += 1) {
        try {
          if (simulateTimeout) await sleep(1500);
          const sentAt = Date.now();
          const out = await postJson(dispatchUrl, ctx.token, {
            command_id: task.command_id,
            task_id: task.act_task_id,
            operation_plan_id: task.operation_plan_id,
            parameters: task.parameters,
            attempt_index: i,
            context: {
              tenant_id: task.tenant_id,
              project_id: task.project_id,
              group_id: task.group_id,
              recommendation_id: String(task.meta?.recommendation_id ?? "") || null,
              approval_request_id: String(task.meta?.approval_request_id ?? "") || null
            }
          });
          const statusRaw = String(out?.status ?? "ACK").toUpperCase();
          if (statusRaw === "FAIL") {
            return {
              command_id: task.command_id,
              adapter_type: "irrigation_http_v1",
              receipt_status: "FAILED",
              receipt_code: String(out?.code ?? "DEVICE_REJECT"),
              receipt_message: String(out?.message ?? "device rejected"),
              adapter_payload: { ...out, dispatch_url: dispatchUrl, dispatched_at_ts: sentAt, last_receipt_ts: sentAt, fault_flags: ["DEVICE_REJECT"] }
            };
          }
          return {
            command_id: task.command_id,
            adapter_type: "irrigation_http_v1",
            receipt_status: "ACKED",
            receipt_code: String(out?.code ?? "ACK"),
            receipt_message: String(out?.message ?? "accepted"),
            adapter_payload: { ...out, dispatch_url: dispatchUrl, dispatched_at_ts: sentAt, last_receipt_ts: sentAt, fault_flags: [] }
          };
        } catch (err) {
          lastErr = err;
        }
      }

      return {
        command_id: task.command_id,
        adapter_type: "irrigation_http_v1",
        receipt_status: "FAILED",
        receipt_code: "HTTP_ERROR",
        receipt_message: String(lastErr?.message ?? lastErr ?? "unknown error"),
        adapter_payload: { dispatch_url: dispatchUrl, fault_flags: ["HTTP_ERROR"] }
      };
    }
  };
}
