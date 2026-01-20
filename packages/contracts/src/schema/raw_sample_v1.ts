import { z } from "zod";

/**
 * RawSampleV1Schema
 *
 * NOTE: This is a runtime schema used by server/judge/monitor.
 * It MUST import z from zod (no globals).
 */
export const RawSampleV1Schema = z
  .object({
    ts: z.number().int().finite(), // unix ms
    sensorId: z.string().min(1),
    groupId: z.string().min(1).optional(),
    metric: z.string().min(1),
    value: z.number().finite(),
    unit: z.string().min(1).optional(),
    quality: z.enum(["unknown", "ok", "suspect", "bad"]).default("unknown"),
    // Align facts/source with observed system reality.
    source: z
      .enum(["device", "gateway", "system", "human", "import", "sim"])
      .default("device"),
  })
  .superRefine((v: any, ctx: any) => {
    if (v.metric === "soil_ec" || v.metric === "soil_ec_bulk" || v.metric === "soil_ec_ds_m") {
      const unit = v.unit ?? (v.metric === "soil_ec_ds_m" ? "dS/m" : v.unit);
      if (unit !== "dS/m") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `EC metric unit must be dS/m (got: ${v.unit ?? "undefined"})`,
          path: ["unit"],
        });
      }
    }
  });