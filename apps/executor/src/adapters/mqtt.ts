import type { Adapter, AoActTask } from "./index";
import type { ExecutorApi } from "../lib/executor_api";

export function createMqttAdapter(api: ExecutorApi): Adapter {
  return {
    type: "mqtt",
    adapter_type: "mqtt",

    async execute(task: AoActTask) {
      if (!String(task.outbox_fact_id ?? "").trim()) {
        return { status: "FAILED", meta: { reason: "MISSING_OUTBOX_FACT_ID" } };
      }
      if (!String(task.device_id ?? task.meta?.device_id ?? "").trim()) {
        return { status: "FAILED", meta: { reason: "MISSING_DEVICE_ID" } };
      }
      if (!String(task.downlink_topic ?? "").trim()) {
        return { status: "FAILED", meta: { reason: "MISSING_DOWNLINK_TOPIC" } };
      }

      const out = await api.publishDownlink(task);
      if (!out?.ok) {
        return { status: "FAILED", meta: { reason: "PUBLISH_FAILED", response: out ?? null } };
      }

      return {
        status: "SUCCEEDED",
        meta: {
          receipt_status: "ACKED",
          published_fact_id: out.published_fact_id ?? null
        }
      };
    }
  };
}
