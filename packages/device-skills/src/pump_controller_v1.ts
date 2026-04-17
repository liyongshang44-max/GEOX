import type { DeviceSkillDefinition } from "./index.js";

function finite(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function normalizeAction(taskPayload: any): string {
  const actionLike = String(taskPayload?.action_type ?? taskPayload?.task_type ?? taskPayload?.meta?.task_type ?? "").trim().toLowerCase();
  return actionLike.replace(/[\s_-]+/g, ".");
}

const CAPABILITY_BY_ACTION: Record<string, "START_PUMP" | "STOP_PUMP" | "ADJUST_FLOW"> = {
  "pump.start": "START_PUMP",
  "start.pump": "START_PUMP",
  "start": "START_PUMP",
  "pump.stop": "STOP_PUMP",
  "stop.pump": "STOP_PUMP",
  "stop": "STOP_PUMP",
  "pump.adjust.flow": "ADJUST_FLOW",
  "adjust.flow": "ADJUST_FLOW",
  "flow.adjust": "ADJUST_FLOW",
};

export const pumpControllerV1: DeviceSkillDefinition = {
  skill_id: "pump_controller_v1",
  version: "v1",
  display_name: "Pump start/stop/flow controller",
  category: "device",
  trigger_stage: "before_dispatch",
  compatibility: {
    adapters: ["mqtt", "mqtt_downlink_once_v1", "pump_http_v1", "pump_simulator"],
    capabilities: ["START_PUMP", "STOP_PUMP", "ADJUST_FLOW"],
    protocols: ["mqtt", "http"],
    hints: { device_types: ["PUMP", "PUMP_CONTROLLER", "IRRIGATION_CONTROLLER"] }
  },
  resolveCapability: ({ task_payload }) => {
    const requested = String(task_payload?.capability ?? task_payload?.meta?.capability ?? "").trim().toUpperCase();
    const action = normalizeAction(task_payload);
    const capability = requested || CAPABILITY_BY_ACTION[action];

    if (!pumpControllerV1.compatibility.capabilities.includes(capability as any)) return null;

    const parameters = task_payload?.parameters && typeof task_payload.parameters === "object" ? task_payload.parameters : {};
    const pump_id = String((parameters as any)?.pump_id ?? task_payload?.meta?.pump_id ?? task_payload?.meta?.device_id ?? "").trim() || null;
    const flow_lpm = finite((parameters as any)?.flow_lpm ?? (parameters as any)?.flow_rate_lpm ?? (parameters as any)?.target_flow_lpm);
    const ramp_seconds = finite((parameters as any)?.ramp_seconds ?? (parameters as any)?.ramp_sec);

    return {
      capability,
      parameters: {
        task_type: capability,
        action_type: capability,
        pump_id,
        flow_lpm,
        ramp_seconds,
      },
      evidence_requirements:
        capability === "START_PUMP"
          ? ["dispatch_ack", "pump_started", "execution_receipt"]
          : capability === "STOP_PUMP"
            ? ["dispatch_ack", "pump_stopped", "execution_receipt"]
            : ["dispatch_ack", "flow_adjusted", "execution_receipt"],
      explain:
        capability === "START_PUMP"
          ? `Start pump${pump_id ? ` ${pump_id}` : ""}${flow_lpm != null ? ` at ${flow_lpm}L/min` : ""}.`
          : capability === "STOP_PUMP"
            ? `Stop pump${pump_id ? ` ${pump_id}` : ""}.`
            : `Adjust pump flow${pump_id ? ` for ${pump_id}` : ""}${flow_lpm != null ? ` to ${flow_lpm}L/min` : ""}.`,
      compatibility: {
        ...pumpControllerV1.compatibility,
        capabilities: [capability],
      },
    };
  }
};
