import { z } from "zod";
import { TELEMETRY_METRIC_CATALOG_V1, isTelemetryMetricNameV1, isValidTelemetryUnitV1 } from "./telemetry_metric_catalog_v1";

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
    unit: z.string().min(1).optional(), // Required for catalogued metrics; must match canonical unit.
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

    if (isTelemetryMetricNameV1(v.metric)) {
      const metricName = v.metric as keyof typeof TELEMETRY_METRIC_CATALOG_V1;
      const spec = TELEMETRY_METRIC_CATALOG_V1[metricName];
      if (typeof v.unit !== "string" || !v.unit.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Metric ${v.metric} requires unit ${spec.unit}`,
          path: ["unit"],
        });
      } else if (!isValidTelemetryUnitV1(metricName, v.unit)) {
        const allowed = [spec.unit, ...(spec.aliases ?? [])].join("/");
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Metric ${v.metric} unit must be one of [${allowed}] (got: ${v.unit})`,
          path: ["unit"],
        });
      }
      if (typeof v.value === "number" && (v.value < spec.min || v.value > spec.max)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Metric ${v.metric} value out of range [${spec.min}, ${spec.max}] (got: ${v.value})`,
          path: ["value"],
        });
      }
    }
  });
