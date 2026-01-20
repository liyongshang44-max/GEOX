// GEOX/packages/contracts/src/schema/overlay_zod.ts
import { z } from "zod";

export const OverlaySegmentSchema = z.object({
  startTs: z.number().int().nonnegative(),
  endTs: z.number().int().nonnegative(),
  sensorId: z.string().min(1),
  metric: z.string().nullable().optional(),
  kind: z.string().min(1),
  confidence: z.enum(["low","med","high"]).nullable().optional(),
  note: z.string().nullable().optional(),
  // ✅ 与 facts.source allowlist 对齐
  source: z.enum(["device","gateway","system","human"]),
});

export type OverlaySegmentZ = z.infer<typeof OverlaySegmentSchema>;