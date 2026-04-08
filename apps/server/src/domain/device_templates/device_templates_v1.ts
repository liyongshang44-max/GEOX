export type DeviceTemplateSkillBindingV1 = {
  skill_id: string;
  version: string;
  category: "OBSERVABILITY" | "AGRONOMY";
  trigger_stage: "before_recommendation" | "after_recommendation";
};

export type DeviceTemplateV1 = {
  template_id: string;
  required_observation_skills: DeviceTemplateSkillBindingV1[];
  default_inference_skills: DeviceTemplateSkillBindingV1[];
};

const DEVICE_TEMPLATES_V1: Record<string, DeviceTemplateV1> = {
  generic_sensor_v1: {
    template_id: "generic_sensor_v1",
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
      {
        skill_id: "canopy_temperature_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
      {
        skill_id: "water_flow_inference_v1",
        version: "v1",
        category: "AGRONOMY",
        trigger_stage: "before_recommendation",
      },
    ],
  },
};

export const DEFAULT_DEVICE_TEMPLATE_ID_V1 = "generic_sensor_v1";

export function resolveDeviceTemplateV1(templateId?: string | null): DeviceTemplateV1 {
  const normalized = String(templateId ?? DEFAULT_DEVICE_TEMPLATE_ID_V1).trim() || DEFAULT_DEVICE_TEMPLATE_ID_V1;
  return DEVICE_TEMPLATES_V1[normalized] ?? DEVICE_TEMPLATES_V1[DEFAULT_DEVICE_TEMPLATE_ID_V1];
}
