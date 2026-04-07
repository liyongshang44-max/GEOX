import { z } from "zod";

export const DeviceObservationQualityFlagV1Schema = z.enum([
  "OK",
  "SUSPECT",
  "OUTLIER",
  "MISSING_CONTEXT",
  "CALIBRATION_DUE",
]);

export const DeviceObservationV1Schema = z
  .object({
    type: z.literal("device_observation_v1"),
    schema_version: z.literal("1.0.0"),
    tenant_id: z.string().min(1),
    project_id: z.string().min(1),
    group_id: z.string().min(1),
    field_id: z.string().min(1),
    device_id: z.string().min(1),
    observed_at: z.string().datetime({ offset: true }),
    ingested_at: z.string().datetime({ offset: true }),
    metric_key: z.string().min(1),
    metric_value: z.number().finite(),
    metric_unit: z.string().min(1),
    confidence: z.number().min(0).max(1),
    quality_flags: z.array(DeviceObservationQualityFlagV1Schema),
    explanation_codes: z.array(z.string().min(1)),
  })
  .strict();

export type DeviceObservationQualityFlagV1 = z.infer<typeof DeviceObservationQualityFlagV1Schema>;
export type DeviceObservationV1 = z.infer<typeof DeviceObservationV1Schema>;
