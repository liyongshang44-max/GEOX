import type { Adapter, AdapterRuntimeContext, AoActTask } from "./index";
import type { ExecutorApi } from "../lib/executor_api";

const DEBUG_PREFIX = "[executor-smoke-debug]";

function normalizeIrrigationAction(raw: unknown): string {
  const action = String(raw ?? "").trim().toLowerCase();
  if (!action) return "";
  if (action === "irrigate") return "irrigate";
  if (action === "irrigation.start") return "irrigate";
  if (action === "start_irrigation" || action === "start-irrigation" || action === "start irrigation") return "irrigate";
  return action;
}

export function createIrrigationSimulatorAdapter(ctx: AdapterRuntimeContext, api: ExecutorApi): Adapter {
  async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function appendFertilizeReceipt(ctx: AdapterRuntimeContext, task: AoActTask): Promise<void> {
    const startTs = Date.now();
    const endTs = startTs + 1000;
    const operationPlanId = String(task.operation_plan_id ?? task.meta?.operation_plan_id ?? "").trim();
    const commandId = String(task.command_id ?? task.act_task_id).trim();
    if (!operationPlanId) throw new Error("MISSING_OPERATION_PLAN_ID");
    if (!commandId) throw new Error("MISSING_COMMAND_ID");

    const response = await fetch(`${ctx.baseUrl}/api/v1/ao-act/receipts`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.token}`
      },
      body: JSON.stringify({
        tenant_id: task.tenant_id,
        project_id: task.project_id,
        group_id: task.group_id,
        task_id: task.act_task_id,
        act_task_id: task.act_task_id,
        command_id: commandId,
        operation_plan_id: operationPlanId,
        status: "executed",
        executor_id: {
          kind: "device",
          id: "dev_onboard_accept_001",
          namespace: "default"
        },
        execution_time: { start_ts: startTs, end_ts: endTs },
        execution_coverage: { kind: "field", ref: "field_c8_demo" },
        resource_usage: { chemical_ml: 120 },
        logs_refs: [{ kind: "sim_trace", ref: `sim://fertilize/${task.act_task_id}/${startTs}` }],
        constraint_check: { violated: false, violations: [] },
        observed_parameters: {
          task_type: "FERTILIZE",
          chemical_ml: 120,
          water_l: 0,
          electric_kwh: 0
        },
        meta: {
          schema: "ao_act_receipt_v1",
          adapter_type: "irrigation_simulator",
          task_type: "FERTILIZE",
          idempotency_key: `fertilize:${task.act_task_id}:120`
        }
      })
    });
    const responseBody = await response.text();
    console.log(
      `${DEBUG_PREFIX} ${JSON.stringify({
        event: "simulator_append_fertilize_receipt",
        act_task_id: task.act_task_id,
        operation_plan_id: operationPlanId,
        response: {
          status: response.status,
          body: responseBody
        }
      })}`
    );

    if (!response.ok) {
      throw new Error(`FERTILIZE_RECEIPT_WRITE_FAILED:http ${response.status}: ${responseBody}`);
    }
  }

  return {
    type: "irrigation_simulator",
    adapter_type: "irrigation_simulator",
    supports(action_type: string): boolean {
      const t = String(action_type ?? "").trim().toUpperCase();
      return normalizeIrrigationAction(action_type) === "irrigate" || t === "FERTILIZE";
    },
    validate(task: AoActTask) {
      const taskType = String((task as any)?.task_type ?? task?.meta?.task_type ?? task?.action_type ?? "").trim().toUpperCase();
      if (taskType === "FERTILIZE") return { ok: true as const };
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
      const taskType = String(task.task_type ?? task.meta?.task_type ?? task.action_type ?? "").trim().toUpperCase();
      if (taskType === "FERTILIZE") {
        await sleep(1000);
        await appendFertilizeReceipt(ctx, task);
        console.log(
          `${DEBUG_PREFIX} ${JSON.stringify({
            event: "simulator_execute",
            act_task_id: task.act_task_id,
            operation_plan_id: task.operation_plan_id ?? task.meta?.operation_plan_id ?? null,
            response: {
              status: 200,
              body: "FERTILIZE_SIMULATED"
            }
          })}`
        );
        return {
          status: "SUCCEEDED",
          meta: {
            receipt_status: "ACKED",
            command_id: commandId,
            result: {
              chemical_ml: 120,
              water_l: 0,
              electric_kwh: 0
            }
          }
        };
      }

      const published = await api.publishDownlink(task);
      if (!published?.ok) {
        return { status: "FAILED", meta: { reason: "PUBLISHED_WRITE_FAILED", response: published ?? null } };
      }

      const out = await api.executeIrrigationSimulator(task);
      console.log(
        `${DEBUG_PREFIX} ${JSON.stringify({
          event: "simulator_execute",
          act_task_id: task.act_task_id,
          operation_plan_id: task.operation_plan_id ?? task.meta?.operation_plan_id ?? null,
          response: {
            status: out?.status ?? 200,
            body: out ?? null
          }
        })}`
      );
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
