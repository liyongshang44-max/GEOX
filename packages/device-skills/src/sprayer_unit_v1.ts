import type { DeviceSkillDefinition } from "./index.js";

function finite(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function toRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

const MATCH_ACTIONS = new Set([
  "spray",
  "spray.pesticide",
  "pesticide.spray",
  "start.spray",
  "sprayer.start",
]);

export const sprayerUnitV1: DeviceSkillDefinition = {
  skill_id: "sprayer_unit_v1",
  version: "v1",
  display_name: "Sprayer pesticide control",
  category: "device",
  trigger_stage: "before_dispatch",
  compatibility: {
    adapters: ["mqtt", "mqtt_downlink_once_v1", "sprayer_http_v1", "sprayer_simulator"],
    capabilities: ["SPRAY_PESTICIDE"],
    protocols: ["mqtt", "http"],
    hints: { device_types: ["SPRAYER", "PEST_CONTROLLER", "IRRIGATION_CONTROLLER"] }
  },
  resolveCapability: ({ task_payload }) => {
    const actionLike = String(task_payload?.action_type ?? task_payload?.task_type ?? task_payload?.meta?.task_type ?? "").trim().toLowerCase();
    const compact = actionLike.replace(/[\s_-]+/g, ".");
    const requestedCapability = String(task_payload?.capability ?? task_payload?.meta?.capability ?? "").trim().toUpperCase();

    if (requestedCapability !== "SPRAY_PESTICIDE" && !MATCH_ACTIONS.has(compact)) return null;

    const parameters = toRecord(task_payload?.parameters);
    const pesticide_type = String(parameters.pesticide_type ?? task_payload?.meta?.pesticide_type ?? "").trim() || null;
    const spray_duration_sec = finite(parameters.spray_duration_sec ?? parameters.duration_sec ?? parameters.duration);
    const target_volume_ml = finite(parameters.target_volume_ml ?? parameters.volume_ml);
    const nozzle_id = String(parameters.nozzle_id ?? task_payload?.meta?.nozzle_id ?? "").trim() || null;

    return {
      capability: "SPRAY_PESTICIDE",
      parameters: {
        task_type: "SPRAY_PESTICIDE",
        action_type: "SPRAY_PESTICIDE",
        pesticide_type,
        spray_duration_sec,
        target_volume_ml,
        nozzle_id,
      },
      evidence_requirements: ["dispatch_ack", "spray_started", "spray_completed", "execution_receipt"],
      explain: `Spray pesticide${pesticide_type ? ` (${pesticide_type})` : ""}${target_volume_ml != null ? ` target ${target_volume_ml}ml` : ""}.`,
      compatibility: sprayerUnitV1.compatibility,
    };
  }
};
