export type DeviceTemplateSkillBindingV1 = {
  skill_id: string;
  version: string;
  category: "OBSERVABILITY" | "AGRONOMY";
  trigger_stage: "before_recommendation" | "after_recommendation";
};

export type DeviceTemplateV1 = {
  template_code: string;
  capabilities: string[];
  required_observation_skills: DeviceTemplateSkillBindingV1[];
  default_inference_skills: DeviceTemplateSkillBindingV1[];
  simulator_profile: {
    profile_code: string;
  };
};

export const DEVICE_TEMPLATES_V1: Record<string, DeviceTemplateV1> = {
  soil_probe: {
    template_code: "soil_probe",
    capabilities: ["sensing", "soil"],
    required_observation_skills: [
      {
        skill_id: "sensor_quality_inference_v1",
        version: "v1",
        category: "OBSERVABILITY",
        trigger_stage: "before_recommendation",
      },
    ],
    default_inference_skills: [
      {
        skill_id: "fertility_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
    simulator_profile: {
      profile_code: "soil_probe_default_v1",
    },
  },
  ambient_node: {
    template_code: "ambient_node",
    capabilities: ["sensing", "ambient"],
    required_observation_skills: [
      {
        skill_id: "sensor_quality_inference_v1",
        version: "v1",
        category: "OBSERVABILITY",
        trigger_stage: "before_recommendation",
      },
    ],
    default_inference_skills: [
      {
        skill_id: "canopy_temperature_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
    simulator_profile: {
      profile_code: "ambient_node_default_v1",
    },
  },
  image_camera: {
    template_code: "image_camera",
    capabilities: ["sensing", "camera"],
    required_observation_skills: [
      {
        skill_id: "sensor_quality_inference_v1",
        version: "v1",
        category: "OBSERVABILITY",
        trigger_stage: "before_recommendation",
      },
    ],
    default_inference_skills: [
      {
        skill_id: "canopy_temperature_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
    simulator_profile: {
      profile_code: "image_camera_default_v1",
    },
  },
  flow_meter: {
    template_code: "flow_meter",
    capabilities: ["metering", "flow"],
    required_observation_skills: [
      {
        skill_id: "sensor_quality_inference_v1",
        version: "v1",
        category: "OBSERVABILITY",
        trigger_stage: "before_recommendation",
      },
    ],
    default_inference_skills: [
      {
        skill_id: "water_flow_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
    simulator_profile: {
      profile_code: "flow_meter_default_v1",
    },
  },
  pressure_gauge: {
    template_code: "pressure_gauge",
    capabilities: ["metering", "pressure"],
    required_observation_skills: [
      {
        skill_id: "sensor_quality_inference_v1",
        version: "v1",
        category: "OBSERVABILITY",
        trigger_stage: "before_recommendation",
      },
    ],
    default_inference_skills: [
      {
        skill_id: "water_flow_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
    simulator_profile: {
      profile_code: "pressure_gauge_default_v1",
    },
  },
};

export const DEFAULT_DEVICE_TEMPLATE_CODE_V1 = "soil_probe";

export function listDeviceTemplates(): DeviceTemplateV1[] {
  return Object.values(DEVICE_TEMPLATES_V1);
}

export function getDeviceTemplateOrThrow(template_code: string): DeviceTemplateV1 {
  const normalized = String(template_code ?? "").trim();
  const template = DEVICE_TEMPLATES_V1[normalized];
  if (!template) throw new Error(`UNKNOWN_DEVICE_TEMPLATE_CODE:${normalized || "<empty>"}`);
  return template;
}

export function resolveDeviceTemplateV1(templateCode?: string | null): DeviceTemplateV1 {
  const normalized = String(templateCode ?? DEFAULT_DEVICE_TEMPLATE_CODE_V1).trim() || DEFAULT_DEVICE_TEMPLATE_CODE_V1;
  return getDeviceTemplateOrThrow(normalized);
}
