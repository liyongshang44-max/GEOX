import { buildGeoMetrics } from "./geo";
import type { AcceptanceRule } from "./types";

function resolvePassRatioMin(policyRef: string | null): number {
  const ref = String(policyRef ?? "").toLowerCase();
  const m = ref.match(/(\d{2,3})pct/);
  if (!m) return 0.8;
  const pct = Number(m[1]);
  if (!Number.isFinite(pct)) return 0.8;
  return Math.max(0.1, Math.min(0.99, pct / 100));
}

export const irrigationRule: AcceptanceRule = {
  task_type: "IRRIGATE",
  run(input) {
    const geo = buildGeoMetrics(input.telemetry);
    const expected = Number(input.parameters.duration_min);
    const actual = Number(input.telemetry.duration_min);
    const passRatioMin = resolvePassRatioMin(input.acceptance_policy_ref);
    const rule_id = `acceptance_rule_v1_irrigation_duration_${Math.round(passRatioMin * 100)}pct`;
    const baseMetrics: Record<string, number> = {
      track_point_count: geo.trackPointCount,
      track_points_in_field: geo.inFieldCount,
      in_field_ratio: geo.inFieldRatio
    };

    if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(actual) || actual <= 0) {
      return {
        result: "INCONCLUSIVE",
        rule_id,
        metrics: baseMetrics
      };
    }

    const ratio = actual / expected;
    return {
      result: ratio >= passRatioMin ? "PASSED" : "FAILED",
      score: ratio,
      rule_id,
      metrics: {
        ...baseMetrics,
        actual_duration: actual,
        pass_ratio_min: passRatioMin
      }
    };
  }
};
