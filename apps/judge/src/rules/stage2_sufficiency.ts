import type { JudgeConfigV1 } from "../config";
import type { RawSample } from "../evidence";

export type SufficiencyResult =
  | { ok: true }
  | {
      ok: false;
      totalSamples: number;
      metricCounts: Record<string, number>;
      missingMetrics: string[];
      inputFactIds: string[];
    };

export function checkSufficiency(
  cfg: JudgeConfigV1,
  samples: RawSample[]
): SufficiencyResult {
  const metricCounts: Record<string, number> = {};
  for (const m of cfg.required_metrics) metricCounts[m] = 0;

  const inputFactIds: string[] = [];

  for (const s of samples) {
    // 归一化：required_metrics 是 base，而 sample.metric 可能带 depth 后缀
    const metric = String((s as any).metric ?? "");

    for (const base of cfg.required_metrics) {
      if (metric === base || metric.startsWith(base + "_")) {
        metricCounts[base] = (metricCounts[base] ?? 0) + 1;
        break;
      }
    }

    const fid = (s as any).fact_id;
    if (typeof fid === "string") inputFactIds.push(fid);
  }

  const total = samples.length;
  const missingMetrics: string[] = [];
  for (const m of cfg.required_metrics) {
    if ((metricCounts[m] ?? 0) < cfg.sufficiency.min_samples_per_required_metric) {
      missingMetrics.push(m);
    }
  }

  const ok =
    total >= cfg.sufficiency.min_total_samples &&
    missingMetrics.length === 0;

  if (ok) return { ok: true };

  return {
    ok: false,
    totalSamples: total,
    metricCounts,
    missingMetrics,
    inputFactIds: Array.from(new Set(inputFactIds)).sort(),
  };
}
