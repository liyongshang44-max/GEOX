import { z } from "zod";

export const RawSampleSourceV1Schema = z.enum(["device", "gateway", "system", "human", "import", "sim"]);
export const RawSampleQualityV1Schema = z.enum(["unknown", "ok", "suspect", "bad"]);
export const SeriesOverlayKindV1Schema = z.enum(["marker", "candidate", "annotation"]);
export const SeriesGapReasonV1Schema = z.enum(["no_data", "device_offline", "unknown"]);

export const RawSampleFactEnvelopeV1Schema = z.object({
  sample_id: z.string().min(1),
  sensor_id: z.string().min(1),
  group_id: z.string().min(1).nullable(),
  project_id: z.string().min(1).nullable(),
  field_id: z.string().min(1).nullable(),
  ts_ms: z.number().int().positive(),
  metric: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1).nullable(),
  qc_quality: RawSampleQualityV1Schema,
  source: RawSampleSourceV1Schema,
  payload_json: z.record(z.any()),
  fact_id: z.string().min(1),
  created_at: z.string().nullable().optional(),
  interpolated: z.literal(false),
  synthetic: z.literal(false),
}).superRefine((v, ctx) => {
  const metric = v.metric.trim().toLowerCase();
  const ecMetrics = new Set(["ec", "soil_ec", "soil_ec_ds_m", "ec_ds_m", "salinity_ec_ds_m", "soil_salinity_ec"]);
  if (ecMetrics.has(metric) && v.unit !== "dS/m") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "EC metric unit must be dS/m", path: ["unit"] });
  }
});

export const SeriesGapV1Schema = z.object({
  startTs: z.number().int().positive(),
  endTs: z.number().int().positive(),
  reason: SeriesGapReasonV1Schema,
  sensorId: z.string().min(1).nullable().optional(),
  metric: z.string().min(1).nullable().optional(),
}).refine((v) => v.endTs >= v.startTs, { message: "gap endTs must be >= startTs" });

export const SeriesOverlayV1Schema = z.object({
  overlay_id: z.string().min(1),
  startTs: z.number().int().positive(),
  endTs: z.number().int().positive(),
  sensorId: z.string().min(1).nullable(),
  groupId: z.string().min(1).nullable(),
  metric: z.string().min(1).nullable(),
  kind: SeriesOverlayKindV1Schema,
  note: z.string().nullable(),
  source: z.enum(["device", "gateway", "system", "human"]),
}).refine((v) => v.endTs >= v.startTs, { message: "overlay endTs must be >= startTs" });

export const SeriesResponseFactEnvelopeV1Schema = z.object({
  range: z.object({
    startTs: z.number().int().positive(),
    endTs: z.number().int().positive(),
    maxGapMs: z.number().int().positive(),
  }).refine((v) => v.endTs >= v.startTs, { message: "range endTs must be >= startTs" }),
  query: z.object({
    sensor_id: z.string().min(1).nullable(),
    group_id: z.string().min(1).nullable(),
    field_id: z.string().min(1).nullable(),
    metrics: z.array(z.string().min(1)),
  }),
  samples: z.array(RawSampleFactEnvelopeV1Schema),
  gaps: z.array(SeriesGapV1Schema),
  overlays: z.array(SeriesOverlayV1Schema),
}).superRefine((v, ctx) => {
  for (let i = 0; i < v.samples.length; i += 1) {
    const sample = v.samples[i];
    if (sample.interpolated !== false || sample.synthetic !== false) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SeriesResponse samples must be real raw samples only", path: ["samples", i] });
    }
  }
});

export type RawSampleFactEnvelopeV1 = z.infer<typeof RawSampleFactEnvelopeV1Schema>;
export type SeriesGapV1Contract = z.infer<typeof SeriesGapV1Schema>;
export type SeriesOverlayV1Contract = z.infer<typeof SeriesOverlayV1Schema>;
export type SeriesResponseFactEnvelopeV1 = z.infer<typeof SeriesResponseFactEnvelopeV1Schema>;
