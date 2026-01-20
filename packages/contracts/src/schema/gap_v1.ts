// GEOX/packages/contracts/src/schema/gap_v1.ts
import { z } from "zod";

export const GapSegmentSchema = z.object({
  startTs: z.number().int().nonnegative(),
  endTs: z.number().int().nonnegative(),
  sensorId: z.string().min(1),
  metric: z.string().min(1),
  reason: z.enum(["no_data","device_offline","unknown"]).default("unknown"),
});

export type GapSegment = z.infer<typeof GapSegmentSchema>;
