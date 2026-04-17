import { buildGeoMetrics } from "./geo.js";
import type { AcceptanceRule } from "./types.js";

export const inspectionRule: AcceptanceRule = {
  task_type: "INSPECT",
  run(input) {
    const geo = buildGeoMetrics(input.telemetry);
    const minInFieldRatio = String(input.acceptance_policy_ref ?? "").toLowerCase().includes("strict") ? 0.8 : 0.6;
    const hasTrack = geo.trackPointCount > 0;
    const pass = hasTrack && geo.inFieldRatio >= minInFieldRatio;

    return {
      result: pass ? "PASSED" : (hasTrack ? "FAILED" : "INCONCLUSIVE"),
      rule_id: `acceptance_rule_v1_inspection_in_field_${Math.round(minInFieldRatio * 100)}pct`,
      score: hasTrack ? geo.inFieldRatio : undefined,
      metrics: {
        track_point_count: geo.trackPointCount,
        track_points_in_field: geo.inFieldCount,
        in_field_ratio: geo.inFieldRatio,
        in_field_ratio_min: minInFieldRatio
      }
    };
  }
};
