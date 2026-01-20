// apps/judge/src/rules/stage6_conflict.ts
import type { JudgeConfigV1 } from "../config";
import type { RawSample } from "../evidence";
import type { ReferenceViewV1 } from "../reference/reference_builder";

/* ---------------------------------------------
 * Types (pipeline-aligned)
 * -------------------------------------------*/

export type EvidenceConflictHit = {
  conflictedMetrics: string[];
  sensorsInvolved: string[];
};

export type ReferenceConflictHit = {
  metrics: string[];
};

/* ---------------------------------------------
 * Helpers (deterministic)
 * -------------------------------------------*/

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function coverageSpan(tsSorted: number[]): number {
  if (tsSorted.length < 2) return 0;
  return tsSorted[tsSorted.length - 1] - tsSorted[0];
}

function overlapSpan(ranges: Array<[number, number]>): number {
  if (!ranges.length) return 0;
  const start = Math.max(...ranges.map((r) => r[0]));
  const end = Math.min(...ranges.map((r) => r[1]));
  return Math.max(0, end - start);
}

function getQcLabel(s: any): string | undefined {
  const q = s?.quality ?? s?.qc;
  return typeof q === "string" ? q : undefined;
}

/* ---------------------------------------------
 * Stage-6a: Evidence Conflict Detection (AII-04 §3.5)
 * - no conflict => null
 * - conflict => EvidenceConflictHit
 * -------------------------------------------*/

export function detectEvidenceConflict(
  cfg: JudgeConfigV1,
  samples: RawSample[] | null | undefined,
  metrics?: string[] | null,
  window?: { startTs: number; endTs: number }
): EvidenceConflictHit | null {
  const ss: RawSample[] = Array.isArray(samples) ? samples : [];

  const ms: string[] =
    Array.isArray(metrics) && metrics.length
      ? metrics
      : Array.isArray(cfg?.required_metrics)
        ? cfg.required_metrics
        : [];

  // Pipeline must provide window for overlap_ratio.
  if (!window || !(window.endTs > window.startTs)) return null;
  if (!ss.length || !ms.length) return null;

  const conflictedMetrics: string[] = [];
  const sensorsInvolved = new Set<string>();

  for (const metric of ms) {
    const bySensor: Record<string, { ts: number[]; values: number[]; qc: string[] }> = {};

    for (const s of ss) {
      if (!s || (s as any).metric !== metric) continue;
      const sid = String((s as any).sensorId ?? "");
      const ts = (s as any).ts;
      if (!sid || !Number.isFinite(ts)) continue;

      if (!bySensor[sid]) bySensor[sid] = { ts: [], values: [], qc: [] };
      bySensor[sid].ts.push(ts);

      const v = (s as any).value;
      if (Number.isFinite(v)) bySensor[sid].values.push(v);

      const q = getQcLabel(s);
      if (q) bySensor[sid].qc.push(q);
    }

    const sensorIds = Object.keys(bySensor).sort();
    if (sensorIds.length < 2) continue;

    const ranges: Array<[number, number]> = [];
    const medians: Record<string, number> = {};
    const usableSensors: string[] = [];

    for (const sid of sensorIds) {
      const tsSorted = bySensor[sid].ts.slice().sort((a, b) => a - b);
      if (tsSorted.length < cfg.conflict.min_points_in_overlap) continue;
      const span = coverageSpan(tsSorted);
      if (span <= 0) continue;

      const md = median(bySensor[sid].values);
      if (md == null || !Number.isFinite(md)) continue;

      medians[sid] = md;
      usableSensors.push(sid);
      ranges.push([tsSorted[0], tsSorted[tsSorted.length - 1]]);
    }

    if (usableSensors.length < 2) continue;

    // overlap_ratio check (AII-04 §3.5)
    const overlap = overlapSpan(ranges);
    const windowSpan = window.endTs - window.startTs;
    if (!(windowSpan > 0)) continue;
    const overlapRatio = overlap / windowSpan;
    if (overlapRatio < cfg.conflict.min_overlap_ratio) continue;

    // delta threshold check
    const medianValues = usableSensors.map((sid) => medians[sid]);
    const delta = Math.max(...medianValues) - Math.min(...medianValues);
    if (delta < cfg.conflict.delta_numeric_threshold) continue;

    // QC negative rule: if all usable sensors are entirely non-ok, do not declare conflict.
    const allQcBadOrSuspect = usableSensors.every((sid) => {
      const qs = bySensor[sid].qc;
      if (!qs.length) return true;
      return qs.every((q) => q !== "ok");
    });
    if (allQcBadOrSuspect) continue;

    conflictedMetrics.push(metric);
    usableSensors.forEach((sid) => sensorsInvolved.add(sid));
  }

  if (!conflictedMetrics.length) return null;
  return {
    conflictedMetrics: conflictedMetrics.sort(),
    sensorsInvolved: Array.from(sensorsInvolved).sort(),
  };
}

/* ---------------------------------------------
 * Stage-6b: Reference Conflict Detection (AII-04 §3.5)
 * - no conflict => null
 * - conflict => ReferenceConflictHit
 * -------------------------------------------*/

export function detectReferenceConflict(referenceViews?: ReferenceViewV1[] | null): ReferenceConflictHit | null {
  const rvs: ReferenceViewV1[] = Array.isArray(referenceViews) ? referenceViews : [];
  if (!rvs.length) return null;

  const metrics: string[] = [];
  for (const rv of rvs) {
    const label = rv?.comparison_summary?.conflict_hint?.label;
    if (label === "clear") metrics.push(rv.metric);
  }
  const uniq = Array.from(new Set(metrics)).sort();
  if (!uniq.length) return null;
  return { metrics: uniq };
}
