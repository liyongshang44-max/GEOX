import { z } from "zod";
import { OverlaySegmentV1 } from "./overlay_v1";

/**
 * ExplainOverlayV1
 * ----------------
 * P4 Explainability payload.
 * This does NOT assert causality or recommendations.
 * It only describes: what rule emitted the overlay, and what evidence window was used.
 */
export const ExplainOverlayV1 = z.object({
  overlay: OverlaySegmentV1,
  rule_id: z.string(),              // stable identifier of rule implementation
  rule_version: z.string(),         // semantic version for rule behavior
  emitted_at: z.string(),           // ISO timestamp
  evidence: z.object({
    sensor_id: z.string().optional(),
    group_id: z.string().optional(),
    metric: z.string(),
    start_ts: z.number(),           // ms epoch
    end_ts: z.number(),             // ms epoch
    sample_count: z.number().int().nonnegative(),
    suspect_count: z.number().int().nonnegative(),
    bad_count: z.number().int().nonnegative(),
    gap_count: z.number().int().nonnegative(),
  }),
  notes: z.array(z.string()).default([]), // neutral boundary notes (no advice)
});

export type ExplainOverlayV1 = z.infer<typeof ExplainOverlayV1>;
