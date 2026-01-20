import { z } from "zod";

export const GapV1Schema = z.object({
  startTs: z.number().finite(),
  endTs: z.number().finite(),
  reason: z.enum(["no_data", "device_offline", "unknown"]).default("no_data"),
});

export type GapV1 = z.infer<typeof GapV1Schema>;
