import { inferFertilityFromObservationAggregateV1 } from "./fertility_inference_core_v1";

export type DeviceSkillCategory = "device" | "sensing_inference";
export type TriggerStage = "before_recommendation" | "before_approval" | "before_dispatch" | "before_acceptance" | "after_acceptance";
export type FertilityLevel = "low" | "medium" | "high" | "unknown";
export type SalinityRiskLevel = "low" | "medium" | "high" | "unknown";
export type RecommendationBias = "fertilize" | "wait" | "irrigate_first" | "inspect";

export type FertilityInferenceResult = {
  fertility_level: FertilityLevel;
  recommendation_bias: RecommendationBias;
  salinity_risk: SalinityRiskLevel;
  confidence: number;
  explanation_codes: string[];
};

export type DerivedSensingState = {
  source: "device_observation_v1";
  derived_sensing_state_v1: FertilityInferenceResult;
  source_skill_id: string;
  source_skill_version: string;
};

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

export type CapabilityResolutionFailure = {
  code: "CAPABILITY_NOT_RESOLVED";
  message: string;
  reasons: string[];
};

export type CapabilityResolutionResult =
  | { ok: true; resolution: CapabilityResolution }
  | { ok: false; error: CapabilityResolutionFailure };

export type CapabilityCompatibilityCheckResult =
  | { ok: true; normalized_adapter: string; normalized_device_type: string }
  | {
      ok: false;
      error: {
        code: "CAPABILITY_COMPATIBILITY_MISMATCH";
        message: string;
        reasons: string[];
        compatibility: CapabilityResolution["compatibility"];
        normalized_adapter: string;
        normalized_device_type: string;
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
  inferSensing?: (input: { device_observation_v1: any; now_ms?: number }) => DerivedSensingState | null;
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

function extractObservationList(deviceObservation: any): any[] {
  if (Array.isArray(deviceObservation)) return deviceObservation;
  if (Array.isArray(deviceObservation?.observations)) return deviceObservation.observations;
  if (Array.isArray(deviceObservation?.sources)) return deviceObservation.sources;
  if (deviceObservation && typeof deviceObservation === "object") return [deviceObservation];
  return [];
}

function firstFiniteFromObservation(observation: any, keys: string[]): number | null {
  for (const key of keys) {
    const n = finite(observation?.[key]);
    if (n != null) return n;
  }
  return null;
}

const fertilityInferenceV1: DeviceSkillDefinition = {
  skill_id: "fertility_inference_v1",
  version: "v1",
  display_name: "Perception inference skill for fertility state",
  category: "sensing_inference",
  trigger_stage: "before_recommendation",
  compatibility: {
    adapters: ["mqtt", "http", "telemetry_gateway", "edge_aggregator"],
    device_types: ["SENSOR", "GATEWAY", "EDGE_NODE", "IRRIGATION_CONTROLLER"],
    protocols: ["mqtt", "http", "lorawan", "coap"]
  },
  inferSensing: ({ device_observation_v1 }) => {
    const observations = extractObservationList(device_observation_v1);
    if (observations.length === 0) {
      return {
        source: "device_observation_v1",
        source_skill_id: "fertility_inference_v1",
        source_skill_version: "v1",
        derived_sensing_state_v1: {
          fertility_level: "unknown",
          recommendation_bias: "inspect",
          salinity_risk: "unknown",
          confidence: 0.2,
          explanation_codes: ["no_device_observation"]
        }
      };
    }

    const soilMoistureSeries = observations
      .map((x) => firstFiniteFromObservation(x, ["soil_moisture_pct", "soil_moisture", "moisture_pct"]))
      .filter((x): x is number => x != null);
    const ecSeries = observations
      .map((x) => firstFiniteFromObservation(x, ["ec_ds_m", "ec", "soil_ec_ds_m", "salinity_ec_ds_m"]))
      .filter((x): x is number => x != null);
    const canopyTempSeries = observations
      .map((x) => firstFiniteFromObservation(x, ["canopy_temp_c", "canopy_temp", "temperature_c", "temp_c"]))
      .filter((x): x is number => x != null);

    const moisture = soilMoistureSeries.length ? soilMoistureSeries[soilMoistureSeries.length - 1] : null;
    const ec = ecSeries.length ? ecSeries[ecSeries.length - 1] : null;
    const canopyTemp = canopyTempSeries.length ? canopyTempSeries[canopyTempSeries.length - 1] : null;

    const inferred = inferFertilityFromObservationAggregateV1({
      soil_moisture_pct: moisture,
      ec_ds_m: ec,
      canopy_temp_c: canopyTemp,
      observation_count: observations.length,
    });

    return {
      source: "device_observation_v1",
      source_skill_id: "fertility_inference_v1",
      source_skill_version: "v1",
      derived_sensing_state_v1: {
        fertility_level: inferred.fertility_level,
        recommendation_bias: inferred.recommendation_bias,
        salinity_risk: inferred.salinity_risk,
        confidence: inferred.confidence,
        explanation_codes: observations.length > 1
          ? Array.from(new Set([...inferred.explanation_codes, "MULTISOURCE_AGGREGATED"]))
          : inferred.explanation_codes
      }
    };
  }
};

export const deviceSkillRegistry: DeviceSkillDefinition[] = [
  irrigationValveV1,
  soilSensorV1,
  fertilityInferenceV1
];

export function inferDerivedSensingStateViaDeviceSkills(input: {
  device_observation_v1: any;
  hinted_skill_id?: string | null;
  now_ms?: number;
}): DerivedSensingState | null {
  const hintedSkillId = String(input.hinted_skill_id ?? "").trim();
  if (hintedSkillId) {
    const hintedSkill = findDeviceSkill(hintedSkillId);
    if (hintedSkill?.inferSensing) {
      const derived = hintedSkill.inferSensing({
        device_observation_v1: input.device_observation_v1,
        now_ms: input.now_ms
      });
      if (derived) return derived;
    }
  }

  for (const skill of deviceSkillRegistry) {
    if (!skill.inferSensing) continue;
    const derived = skill.inferSensing({
      device_observation_v1: input.device_observation_v1,
      now_ms: input.now_ms
    });
    if (derived) return derived;
  }

  return null;
}

export function validateDeviceSkillCompatibilityMatrix(skills: DeviceSkillDefinition[] = deviceSkillRegistry): {
  ok: true;
} | {
  ok: false;
  errors: Array<{ skill_id: string; code: string; message: string }>;
} {
  const errors: Array<{ skill_id: string; code: string; message: string }> = [];
  for (const skill of skills) {
    const adapters = Array.isArray(skill.compatibility?.adapters) ? skill.compatibility.adapters : [];
    const deviceTypes = Array.isArray(skill.compatibility?.device_types) ? skill.compatibility.device_types : [];
    if (adapters.length === 0) {
      errors.push({ skill_id: skill.skill_id, code: "MISSING_COMPATIBLE_ADAPTERS", message: "Skill compatibility.adapters must not be empty." });
    }
    if (deviceTypes.length === 0) {
      errors.push({ skill_id: skill.skill_id, code: "MISSING_COMPATIBLE_DEVICE_TYPES", message: "Skill compatibility.device_types must not be empty." });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

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

export function resolveTaskCapabilityViaDeviceSkillsResult(taskPayload: any): CapabilityResolutionResult {
  const resolved = resolveTaskCapabilityViaDeviceSkills(taskPayload);
  if (resolved) return { ok: true, resolution: resolved };
  return {
    ok: false,
    error: {
      code: "CAPABILITY_NOT_RESOLVED",
      message: "No device skill matched the task payload.",
      reasons: [
        "no_skill_capability_match",
        "provide skill_id or a supported action/task type",
      ],
    },
  };
}

function normalizeAdapterType(adapterType: unknown): string {
  const normalized = String(adapterType ?? "").trim().toLowerCase();
  if (normalized === "mqtt_downlink_once_v1") return "mqtt";
  return normalized;
}

function normalizeDeviceType(deviceType: unknown): string {
  return String(deviceType ?? "").trim().toUpperCase();
}

export function checkCapabilityCompatibilityMatrix(input: {
  capability: CapabilityResolution;
  adapter_type: string | null | undefined;
  device_type: string | null | undefined;
}): CapabilityCompatibilityCheckResult {
  const normalized_adapter = normalizeAdapterType(input.adapter_type);
  const normalized_device_type = normalizeDeviceType(input.device_type);
  const allowedAdapters = (input.capability.compatibility?.adapters ?? []).map((x) => normalizeAdapterType(x));
  const allowedDeviceTypes = (input.capability.compatibility?.device_types ?? []).map((x) => normalizeDeviceType(x));
  const reasons: string[] = [];
  if (!normalized_adapter) reasons.push("missing_adapter_type");
  if (!normalized_device_type) reasons.push("missing_device_type");
  if (normalized_adapter && allowedAdapters.length > 0 && !allowedAdapters.includes(normalized_adapter)) {
    reasons.push("adapter_not_compatible");
  }
  if (normalized_device_type && allowedDeviceTypes.length > 0 && !allowedDeviceTypes.includes(normalized_device_type)) {
    reasons.push("device_type_not_compatible");
  }
  if (reasons.length === 0) return { ok: true, normalized_adapter, normalized_device_type };
  return {
    ok: false,
    error: {
      code: "CAPABILITY_COMPATIBILITY_MISMATCH",
      message: "Skill compatibility matrix check failed.",
      reasons,
      compatibility: input.capability.compatibility,
      normalized_adapter,
      normalized_device_type,
    },
  };
}

export * from "./fertility_inference_core_v1";
