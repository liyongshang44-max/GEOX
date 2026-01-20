// GEOX/packages/contracts/src/schema/quality_v1.ts
import { z } from "zod";

/**
 * QualityLabelV1
 * --------------
 * Evidence quality label (neutral reliability tag).
 * NOTE: This is not a "state" and must not be used to express health/normalcy.
 */
export const QualityLabelV1 = z.enum(["unknown", "ok", "suspect", "bad"]);

export type QualityLabelV1 = z.infer<typeof QualityLabelV1>;
