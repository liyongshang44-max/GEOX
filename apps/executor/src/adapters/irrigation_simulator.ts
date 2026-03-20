import type { Adapter, AoActTask } from "./index";
import type { ExecutorApi } from "../lib/executor_api";

export function createIrrigationSimulatorAdapter(api: ExecutorApi): Adapter {
  return {
    type: "irrigation_simulator",
    adapter_type: "irrigation_simulator",

    async execute(task: AoActTask) {
      if (!String(task.act_task_id ?? "").trim()) {
        return { status: "FAILED", meta: { reason: "MISSING_ACT_TASK_ID" } };
      }

      const commandId = String(task.command_id ?? task.act_task_id).trim();
      if (!commandId) return { status: "FAILED", meta: { reason: "MISSING_COMMAND_ID" } };

      const published = await api.publishDownlink(task);
      if (!published?.ok) {
        return { status: "FAILED", meta: { reason: "PUBLISHED_WRITE_FAILED", response: published ?? null } };
      }

      const out = await api.executeIrrigationSimulator(task);
      return {
        status: "SUCCEEDED",
        meta: {
          receipt_status: "ACKED",
          command_id: commandId,
          simulator_result: out ?? null
        }
      };
    }
  };
}
