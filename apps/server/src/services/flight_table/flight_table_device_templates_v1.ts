export type FlightTableDeviceModeV1 = "simulator" | "physical";

export type FlightTableDeviceTemplateV1 = {
  template_code: "soil_probe" | "ambient_node" | "canopy_sensor" | "flow_meter" | "irrigation_controller" | "camera_node";
  formal_template_code: string;
  device_type: string;
  capabilities: string[];
  required_observation_skills: string[];
  default_metrics: Array<{ metric: string; value: number | string | boolean; unit: string | null }>;
  default_mode: FlightTableDeviceModeV1;
};

export const FLIGHT_TABLE_DEVICE_TEMPLATES_V1: Record<string, FlightTableDeviceTemplateV1> = {
  soil_probe: {
    template_code: "soil_probe",
    formal_template_code: "soil_probe",
    device_type: "soil_probe",
    capabilities: ["sensing", "soil", "soil_moisture", "soil_temperature"],
    required_observation_skills: ["sensor_quality_inference_v1"],
    default_metrics: [
      { metric: "soil_moisture", value: 21.8, unit: "%" },
      { metric: "soil_temperature", value: 18.6, unit: "c" },
    ],
    default_mode: "simulator",
  },
  ambient_node: {
    template_code: "ambient_node",
    formal_template_code: "ambient_node",
    device_type: "ambient_node",
    capabilities: ["sensing", "ambient", "air_temperature", "humidity"],
    required_observation_skills: ["sensor_quality_inference_v1"],
    default_metrics: [
      { metric: "air_temperature", value: 27.2, unit: "c" },
      { metric: "humidity", value: 62, unit: "%" },
    ],
    default_mode: "simulator",
  },
  canopy_sensor: {
    template_code: "canopy_sensor",
    formal_template_code: "ambient_node",
    device_type: "canopy_sensor",
    capabilities: ["sensing", "canopy", "canopy_temperature", "ndvi"],
    required_observation_skills: ["sensor_quality_inference_v1", "canopy_temperature_inference_v1"],
    default_metrics: [
      { metric: "canopy_temperature", value: 30.1, unit: "c" },
      { metric: "ndvi", value: 0.74, unit: null },
    ],
    default_mode: "simulator",
  },
  flow_meter: {
    template_code: "flow_meter",
    formal_template_code: "flow_meter",
    device_type: "flow_meter",
    capabilities: ["metering", "flow", "water_volume"],
    required_observation_skills: ["sensor_quality_inference_v1", "water_flow_inference_v1"],
    default_metrics: [
      { metric: "flow_lpm", value: 46.5, unit: "lpm" },
      { metric: "water_volume_l", value: 1200, unit: "l" },
    ],
    default_mode: "simulator",
  },
  irrigation_controller: {
    template_code: "irrigation_controller",
    formal_template_code: "flow_meter",
    device_type: "irrigation_controller",
    capabilities: ["irrigation", "valve", "pump", "control"],
    required_observation_skills: ["sensor_quality_inference_v1"],
    default_metrics: [
      { metric: "valve_state", value: "open", unit: null },
      { metric: "pump_pressure_kpa", value: 220, unit: "kpa" },
    ],
    default_mode: "simulator",
  },
  camera_node: {
    template_code: "camera_node",
    formal_template_code: "image_camera",
    device_type: "camera_node",
    capabilities: ["sensing", "camera", "image_capture"],
    required_observation_skills: ["sensor_quality_inference_v1"],
    default_metrics: [
      { metric: "image_capture_count", value: 1, unit: "count" },
      { metric: "canopy_cover_pct", value: 68, unit: "%" },
    ],
    default_mode: "simulator",
  },
};

export function listFlightTableDeviceTemplatesV1(): FlightTableDeviceTemplateV1[] {
  return Object.values(FLIGHT_TABLE_DEVICE_TEMPLATES_V1);
}

export function getFlightTableDeviceTemplateV1(template_code: string): FlightTableDeviceTemplateV1 {
  const normalized = String(template_code ?? "").trim();
  const template = FLIGHT_TABLE_DEVICE_TEMPLATES_V1[normalized];
  if (!template) throw new Error("FLIGHT_TABLE_UNKNOWN_DEVICE_TEMPLATE");
  return template;
}
