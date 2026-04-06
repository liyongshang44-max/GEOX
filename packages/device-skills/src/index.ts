export type DeviceSkillCategory = "device";
export type TriggerStage = "before_recommendation" | "before_approval" | "before_dispatch" | "before_acceptance" | "after_acceptance";

export type CapabilityResolution = {
  capability: string;
  parameters: Record<string, unknown>;
  evidence_requirements: string[];
  explain: string;
  compatibility: {
    adapters: string[];
    device_types: string[];
    protocols: string[];
  };
};

export type TelemetryInterpretation = {
  interpreted: {
    soil_moisture_pct: number | null;
    temperature_c: number | null;
    battery_pct: number | null;
    heartbeat_age_seconds: number | null;
  };
  availability: {
    status: "available" | "degraded" | "unavailable";
    reasons: string[];
  };
  explain: string;
};

export type DeviceSkillDefinition = {
  skill_id: string;
  version: string;
  display_name: string;
  category: DeviceSkillCategory;
  trigger_stage: TriggerStage;
  compatibility: {
    adapters: string[];
    device_types: string[];
    protocols: string[];
  };
  resolveCapability?: (input: { task_payload: any }) => CapabilityResolution | null;
  interpretTelemetry?: (input: { report: any; now_ms?: number }) => TelemetryInterpretation;
};

function finite(input: unknown): number | null {
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

const irrigationValveV1: DeviceSkillDefinition = {
  skill_id: "irrigation_valve_v1",
  version: "v1",
  display_name: "Irrigation valve open control",
  category: "device",
  trigger_stage: "before_dispatch",
  compatibility: {
    adapters: ["mqtt", "mqtt_downlink_once_v1", "irrigation_http_v1", "irrigation_simulator"],
    device_types: ["PUMP", "VALVE", "IRRIGATION_CONTROLLER"],
    protocols: ["mqtt", "http"]
  },
  resolveCapability: ({ task_payload }) => {
    const actionLike = String(task_payload?.action_type ?? task_payload?.task_type ?? task_payload?.meta?.task_type ?? "").trim().toLowerCase();
    const compact = actionLike.replace(/[\s_-]+/g, ".");
    if (!["irrigate", "irrigation.start", "start.irrigation", "irrigate.start"].includes(compact)) return null;

    const parameters = task_payload?.parameters && typeof task_payload.parameters === "object" ? task_payload.parameters : {};
    const duration_sec = finite((parameters as any)?.duration_sec ?? (parameters as any)?.duration_seconds ?? (parameters as any)?.duration);
    const flow_lpm = finite((parameters as any)?.flow_lpm ?? (parameters as any)?.flow_rate_lpm ?? task_payload?.meta?.flow_lpm);
    const valve_id = String((parameters as any)?.valve_id ?? task_payload?.meta?.valve_id ?? task_payload?.meta?.device_id ?? "").trim() || null;

    return {
      capability: "device.irrigation.valve.open",
      parameters: {
        valve_id,
        duration_sec,
        flow_lpm,
        mode: duration_sec != null ? "duration" : (flow_lpm != null ? "flow" : "default")
      },
      evidence_requirements: [
        "dispatch_ack",
        "valve_open_confirmation",
        duration_sec != null ? "runtime_duration_observed" : "runtime_flow_observed",
        "water_delivery_receipt"
      ],
      explain: `Open irrigation valve${valve_id ? ` ${valve_id}` : ""} with ${duration_sec != null ? `${duration_sec}s` : "configured"} duration and ${flow_lpm != null ? `${flow_lpm}L/min` : "optional"} flow.`,
      compatibility: irrigationValveV1.compatibility
    };
  }
};

const soilSensorV1: DeviceSkillDefinition = {
  skill_id: "soil_sensor_v1",
  version: "v1",
  display_name: "Soil telemetry interpretation",
  category: "device",
  trigger_stage: "before_dispatch",
  compatibility: {
    adapters: ["mqtt", "telemetry_gateway"],
    device_types: ["SENSOR"],
    protocols: ["mqtt", "lorawan", "http"]
  },
  interpretTelemetry: ({ report, now_ms }) => {
    const tsMs = finite(report?.ts_ms ?? report?.timestamp_ms ?? report?.timestamp);
    const now = now_ms ?? Date.now();
    const soil = finite(report?.soil_moisture ?? report?.soil_moisture_pct);
    const temp = finite(report?.temp ?? report?.temperature_c);
    const battery = finite(report?.battery ?? report?.battery_pct);
    const hb = finite(report?.heartbeat ?? report?.heartbeat_ts_ms ?? tsMs);
    const heartbeat_age_seconds = hb == null ? null : Math.max(0, Math.trunc((now - hb) / 1000));

    const reasons: string[] = [];
    if (soil == null) reasons.push("missing_soil_moisture");
    if (temp == null) reasons.push("missing_temperature");
    if (battery == null) reasons.push("missing_battery");
    if (heartbeat_age_seconds == null) reasons.push("missing_heartbeat");
    if (heartbeat_age_seconds != null && heartbeat_age_seconds > 1800) reasons.push("stale_heartbeat");
    if (battery != null && battery < 10) reasons.push("low_battery");

    const status = reasons.length === 0
      ? "available"
      : reasons.some((x) => ["missing_soil_moisture", "missing_temperature", "missing_heartbeat", "stale_heartbeat"].includes(x))
        ? "unavailable"
        : "degraded";

    return {
      interpreted: {
        soil_moisture_pct: soil,
        temperature_c: temp,
        battery_pct: battery,
        heartbeat_age_seconds
      },
      availability: {
        status,
        reasons
      },
      explain: status === "available"
        ? "soil_sensor_v1 telemetry is complete and fresh."
        : `soil_sensor_v1 telemetry ${status}; reasons=${reasons.join(",") || "unknown"}.`
    };
  }
};

export const deviceSkillRegistry: DeviceSkillDefinition[] = [
  irrigationValveV1,
  soilSensorV1
];

export function findDeviceSkill(skillId: string): DeviceSkillDefinition | null {
  const key = String(skillId ?? "").trim().toLowerCase();
  if (!key) return null;
  return deviceSkillRegistry.find((x) => x.skill_id.toLowerCase() === key) ?? null;
}

export function resolveTaskCapabilityViaDeviceSkills(taskPayload: any): CapabilityResolution | null {
  const hintedSkillId = String(taskPayload?.skill_id ?? taskPayload?.meta?.skill_id ?? "").trim();
  if (hintedSkillId) {
    const hintedSkill = findDeviceSkill(hintedSkillId);
    if (hintedSkill?.resolveCapability) {
      const resolved = hintedSkill.resolveCapability({ task_payload: taskPayload });
      if (resolved) return resolved;
    }
  }
  for (const skill of deviceSkillRegistry) {
    if (!skill.resolveCapability) continue;
    const resolved = skill.resolveCapability({ task_payload: taskPayload });
    if (resolved) return resolved;
  }
  return null;
}
