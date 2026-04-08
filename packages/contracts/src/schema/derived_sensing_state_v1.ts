import { z } from "zod";

export const DerivedSensingStateTypeV1Schema = z.enum([
  "fertility_state",
  "salinity_risk_state",
  "irrigation_need_state",
  "sensor_quality_state",
  "canopy_state",
  "water_flow_state",
  "canopy_temperature_state",
  "evapotranspiration_risk_state",
  "irrigation_effectiveness_state",
  "leak_risk_state",
]);

const FertilityStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  soil_moisture_pct: z.number().finite().optional(),
  canopy_temp_c: z.number().finite().optional(),
}).passthrough();

const SalinityRiskStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  soil_moisture_pct: z.number().finite().optional(),
  canopy_temp_c: z.number().finite().optional(),
}).passthrough();

const IrrigationNeedStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  action_hint: z.string().trim().min(1).max(120).optional(),
}).passthrough();

const SensorQualityStatePayloadSchema = z.object({
  level: z.enum(["GOOD", "DEGRADED", "INVALID", "UNKNOWN"]),
  reason: z.string().trim().min(1).max(160).optional(),
}).passthrough();

const CanopyStatePayloadSchema = z.object({
  canopy_temp_status: z.enum(["normal", "elevated", "critical", "unknown"]),
  evapotranspiration_risk: z.enum(["low", "medium", "high", "unknown"]),
  confidence: z.number().min(0).max(1).nullable().optional(),
  explanation_codes: z.array(z.string().trim().min(1)).optional(),
}).passthrough();

const WaterFlowStatePayloadSchema = z.object({
  irrigation_effectiveness: z.enum(["low", "medium", "high", "unknown"]),
  leak_risk: z.enum(["low", "medium", "high", "unknown"]),
  confidence: z.number().min(0).max(1).nullable().optional(),
  explanation_codes: z.array(z.string().trim().min(1)).optional(),
}).passthrough();

const CanopyTemperatureStatePayloadSchema = z.object({
  level: z.enum(["NORMAL", "ELEVATED", "CRITICAL", "UNKNOWN"]),
  canopy_temp_c: z.number().finite().nullable().optional(),
  ambient_temp_c: z.number().finite().nullable().optional(),
  relative_humidity_pct: z.number().finite().nullable().optional(),
}).passthrough();

const EvapotranspirationRiskStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  canopy_temp_status: z.enum(["normal", "elevated", "critical", "unknown"]).optional(),
  canopy_temp_c: z.number().finite().nullable().optional(),
  ambient_temp_c: z.number().finite().nullable().optional(),
  relative_humidity_pct: z.number().finite().nullable().optional(),
}).passthrough();

const IrrigationEffectivenessStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  inlet_flow_lpm: z.number().finite().nullable().optional(),
  outlet_flow_lpm: z.number().finite().nullable().optional(),
  pressure_drop_kpa: z.number().finite().nullable().optional(),
}).passthrough();

const LeakRiskStatePayloadSchema = z.object({
  level: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  irrigation_effectiveness: z.enum(["low", "medium", "high", "unknown"]).optional(),
  inlet_flow_lpm: z.number().finite().nullable().optional(),
  outlet_flow_lpm: z.number().finite().nullable().optional(),
  pressure_drop_kpa: z.number().finite().nullable().optional(),
}).passthrough();

export const DerivedSensingStatePayloadByTypeV1Schema = {
  fertility_state: FertilityStatePayloadSchema,
  salinity_risk_state: SalinityRiskStatePayloadSchema,
  irrigation_need_state: IrrigationNeedStatePayloadSchema,
  sensor_quality_state: SensorQualityStatePayloadSchema,
  canopy_state: CanopyStatePayloadSchema,
  water_flow_state: WaterFlowStatePayloadSchema,
  canopy_temperature_state: CanopyTemperatureStatePayloadSchema,
  evapotranspiration_risk_state: EvapotranspirationRiskStatePayloadSchema,
  irrigation_effectiveness_state: IrrigationEffectivenessStatePayloadSchema,
  leak_risk_state: LeakRiskStatePayloadSchema,
} as const;

const DerivedSensingStatePayloadSchema = z.discriminatedUnion("state_type", [
  z.object({ state_type: z.literal("fertility_state"), payload: FertilityStatePayloadSchema }),
  z.object({ state_type: z.literal("salinity_risk_state"), payload: SalinityRiskStatePayloadSchema }),
  z.object({ state_type: z.literal("irrigation_need_state"), payload: IrrigationNeedStatePayloadSchema }),
  z.object({ state_type: z.literal("sensor_quality_state"), payload: SensorQualityStatePayloadSchema }),
  z.object({ state_type: z.literal("canopy_state"), payload: CanopyStatePayloadSchema }),
  z.object({ state_type: z.literal("water_flow_state"), payload: WaterFlowStatePayloadSchema }),
  z.object({ state_type: z.literal("canopy_temperature_state"), payload: CanopyTemperatureStatePayloadSchema }),
  z.object({ state_type: z.literal("evapotranspiration_risk_state"), payload: EvapotranspirationRiskStatePayloadSchema }),
  z.object({ state_type: z.literal("irrigation_effectiveness_state"), payload: IrrigationEffectivenessStatePayloadSchema }),
  z.object({ state_type: z.literal("leak_risk_state"), payload: LeakRiskStatePayloadSchema }),
]);

export const DerivedSensingStateV1Schema = z
  .object({
    type: z.literal("derived_sensing_state_v1"),
    entity: z.object({
      tenant_id: z.string().min(1),
      project_id: z.string().min(1).nullable(),
      group_id: z.string().min(1).nullable(),
      field_id: z.string().min(1),
    }),
    payload: z.object({
      state_type: DerivedSensingStateTypeV1Schema,
      payload: z.record(z.string(), z.any()),
      confidence: z.number().min(0).max(1).nullable(),
      explanation_codes: z.array(z.string().trim().min(1)),
      source_device_ids: z.array(z.string().trim().min(1)),
      computed_at_ts_ms: z.number().int(),
    }),
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = DerivedSensingStatePayloadSchema.safeParse({
      state_type: value.payload.state_type,
      payload: value.payload.payload,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payload", "payload", ...(issue.path ?? [])],
          message: issue.message,
        });
      }
    }
  });

export type DerivedSensingStateTypeV1 = z.infer<typeof DerivedSensingStateTypeV1Schema>;
export type DerivedSensingStateV1 = z.infer<typeof DerivedSensingStateV1Schema>;
