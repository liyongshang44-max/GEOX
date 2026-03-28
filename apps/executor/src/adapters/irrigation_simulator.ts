import type { Adapter, AoActTask } from "./index";
import type { ExecutorApi } from "../lib/executor_api";

function normalizeIrrigationAction(raw: unknown): string {
  const action = String(raw ?? "").trim().toLowerCase();
  if (!action) return "";
  if (action === "irrigate") return "irrigate";
  if (action === "irrigation.start") return "irrigate";
  if (action === "start_irrigation" || action === "start-irrigation" || action === "start irrigation") return "irrigate";
  return action;
}

export function createIrrigationSimulatorAdapter(api: ExecutorApi): Adapter {
  return {
    type: "irrigation_simulator",
    adapter_type: "irrigation_simulator",
    supports(action_type: string): boolean {
      return normalizeIrrigationAction(action_type) === "irrigate";
    },
    validate(task: AoActTask) {
      const action = normalizeIrrigationAction((task as any)?.task_type ?? task?.meta?.task_type ?? task?.action_type);
      if (action !== "irrigate") return { ok: false as const, reason: `UNSUPPORTED_ACTION:${String(task?.action_type ?? "")}` };
      return { ok: true as const };
    },

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
