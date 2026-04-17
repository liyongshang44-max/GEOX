import { buildGeoMetrics } from "./geo.js";
import type { AcceptanceRule } from "./types.js";

export const sprayRule: AcceptanceRule = {
  task_type: "SPRAY",
  run(input) {
    const geo = buildGeoMetrics(input.telemetry);
    const defaultCoverage = String(input.acceptance_policy_ref ?? "").toLowerCase().includes("lenient") ? 0.75 : 0.85;
    const hasTrack = geo.trackPointCount > 0;
    const verdict = !hasTrack ? "INCONCLUSIVE" : geo.inFieldRatio >= defaultCoverage ? "PASSED" : "FAILED";

    return {
      result: verdict,
      rule_id: `acceptance_rule_v1_spray_coverage_${Math.round(defaultCoverage * 100)}pct`,
      score: hasTrack ? geo.inFieldRatio : undefined,
      metrics: {
        track_point_count: geo.trackPointCount,
        track_points_in_field: geo.inFieldCount,
        in_field_ratio: geo.inFieldRatio,
        coverage_ratio: geo.inFieldRatio,
        coverage_ratio_min: defaultCoverage
      }
    };
  }
};
