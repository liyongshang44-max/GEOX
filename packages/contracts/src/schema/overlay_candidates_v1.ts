import { z } from "zod";

export const OverlayKindV1Schema = z.enum([
  "device_fault",
  "local_anomaly",
  "drift_candidate",
  "step_candidate",
]);

export const OverlaySegmentV1Schema = z.object({
  kind: OverlayKindV1Schema,
  metric: z.string().min(1),
  startTs: z.number().finite(),
  endTs: z.number().finite(),
  confidence: z.number().min(0).max(1).optional(), // 0..1
  note: z.string().max(120).optional(), // UI-safe short note (no advice)
});

export type OverlayKindV1 = z.infer<typeof OverlayKindV1Schema>;
export type OverlaySegmentV1 = z.infer<typeof OverlaySegmentV1Schema>;
