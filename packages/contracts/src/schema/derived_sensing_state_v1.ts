import { z } from "zod";

export const DerivedSensingStateQualityFlagV1Schema = z.enum([
  "OK",
  "LOW_CONFIDENCE",
  "DATA_GAP",
  "STALE_INPUT",
  "MODEL_FALLBACK",
]);

export const DerivedSensingStateV1Schema = z
  .object({
    type: z.literal("derived_sensing_state_v1"),
    schema_version: z.literal("1.0.0"),
    tenant_id: z.string().min(1),
    project_id: z.string().min(1),
    group_id: z.string().min(1),
    field_id: z.string().min(1),
    device_id: z.string().min(1),
    state_key: z.string().min(1),
    state_value: z.number().finite(),
    confidence: z.number().min(0).max(1),
    quality_flags: z.array(DerivedSensingStateQualityFlagV1Schema),
    explanation_codes: z.array(z.string().min(1)),
    observed_window_start: z.string().datetime({ offset: true }),
    observed_window_end: z.string().datetime({ offset: true }),
    derived_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type DerivedSensingStateQualityFlagV1 = z.infer<typeof DerivedSensingStateQualityFlagV1Schema>;
export type DerivedSensingStateV1 = z.infer<typeof DerivedSensingStateV1Schema>;
