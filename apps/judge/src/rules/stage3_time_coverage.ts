import type { JudgeConfigV1 } from "../config";
import type { RawSample } from "../evidence";

export type TimeCoverageResult =
  | { ok: true; maxGapMs: number; coverageRatio: number; expectedIntervalMs: number }
  | { ok: false; maxGapMs: number; coverageRatio: number; expectedIntervalMs: number };

// Marker window(s) that should be excluded from time-coverage requirements.
// Kept intentionally loose to avoid coupling to a specific marker type shape.
export type CoverageExclusionMarker = {
  kind?: string | null;
  ts?: number | null;
  ts_ms?: number | null;
  startTs?: number | null;
  start_ts_ms?: number | null;
  endTs?: number | null;
  end_ts_ms?: number | null;
};

const EXCLUSION_MARKER_KINDS = new Set([
  "MAINTENANCE",
  "DEVICE_OFFLINE",
  "EXCLUSION_WINDOW_ACTIVE",
]);

function clampToWindow(
  window: { startTs: number; endTs: number },
  start: number,
  end: number
): { start: number; end: number } | null {
  const s = Math.max(window.startTs, start);
  const e = Math.min(window.endTs, end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return { start: s, end: e };
}

export function computeTimeCoverage(
  cfg: JudgeConfigV1,
  window: { startTs: number; endTs: number },
  samples: RawSample[],
  // Optional: marker windows that should be excluded from coverage math.
  // Existing callers that only pass (cfg, window, samples) continue to work.
  markers: CoverageExclusionMarker[] = []
): TimeCoverageResult {
  const duration = window.endTs - window.startTs;
  if (duration <= 0) {
    return { ok: false, maxGapMs: Number.POSITIVE_INFINITY, coverageRatio: 0, expectedIntervalMs: 0 };
  }

  // Expected sampling interval (ms).
  // Config-driven to avoid hard-coding cadence assumptions.
  // Fallback keeps legacy behavior for older configs.
  const expectedIntervalMs =
    typeof (cfg as any)?.time_coverage?.expected_interval_ms === "number"
      ? Math.max(1, Number((cfg as any).time_coverage.expected_interval_ms))
      : 60_000;

  // Build excluded minute-buckets based on markers.
  const excludedBuckets = new Set<number>();
  for (const m of markers ?? []) {
    const kind = (m as any)?.kind ?? null;
    if (!kind || !EXCLUSION_MARKER_KINDS.has(String(kind))) continue;

    const start =
      (m as any)?.start_ts_ms ??
      (m as any)?.startTs ??
      (m as any)?.ts_ms ??
      (m as any)?.ts ??
      null;

    const end =
      (m as any)?.end_ts_ms ??
      (m as any)?.endTs ??
      start ??
      null;

    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const clipped = clampToWindow(window, Number(start), Number(end));
    if (!clipped) continue;

    const fromBucket = Math.floor(clipped.start / expectedIntervalMs) * expectedIntervalMs;
    const toBucket = Math.floor(clipped.end / expectedIntervalMs) * expectedIntervalMs;

    for (let b = fromBucket; b <= toBucket; b += expectedIntervalMs) {
      excludedBuckets.add(b);
    }
  }

  // Build a set of unique minute-buckets that have usable evidence
  // - Only count samples inside [startTs, endTs]
  // - Exclude "bad" if the field exists
  // - Exclude buckets that fall inside exclusion markers
  const minuteBuckets = new Set<number>();

  for (const s of samples) {
    const t = (s as any).ts; // your RawSample uses s.ts (ms)
    if (!Number.isFinite(t)) continue;
    if (t < window.startTs || t > window.endTs) continue;

    const q = (s as any).quality; // optional
    if (q === "bad") continue;

    const bucket = Math.floor(t / expectedIntervalMs) * expectedIntervalMs;
    if (excludedBuckets.has(bucket)) continue;

    minuteBuckets.add(bucket);
  }

  // Define the effective window as the count of minute buckets that are NOT excluded.
  // Note: we use an inclusive bucket range to match the rest of the function's bucket logic.
  const startBucket = Math.floor(window.startTs / expectedIntervalMs) * expectedIntervalMs;
  const endBucket = Math.floor(window.endTs / expectedIntervalMs) * expectedIntervalMs;

  let effectivePoints = 0;
  for (let b = startBucket; b <= endBucket; b += expectedIntervalMs) {
    if (!excludedBuckets.has(b)) effectivePoints++;
  }

  // If the whole window is excluded, we can't evaluate coverage meaningfully.
  if (effectivePoints === 0) {
    return { ok: false, maxGapMs: 0, coverageRatio: 1, expectedIntervalMs };
  }

  if (minuteBuckets.size === 0) {
    // No usable evidence outside excluded windows.
    const maxGapMs = effectivePoints * expectedIntervalMs;
    return { ok: false, maxGapMs, coverageRatio: 0, expectedIntervalMs };
  }

  // Density-based coverage ratio (outside excluded windows)
  const validPoints = minuteBuckets.size;
  const coverageRatio = Math.max(0, Math.min(1, validPoints / effectivePoints));

  // maxGap: compute the longest consecutive missing run OUTSIDE exclusion windows.
  // This makes "continuity" tolerant to maintenance/offline markers.
  let maxGapMs = 0;
  let currentRun = 0;

  for (let b = startBucket; b <= endBucket; b += expectedIntervalMs) {
    if (excludedBuckets.has(b)) {
      // exclusion breaks continuity; don't count missing across it
      maxGapMs = Math.max(maxGapMs, currentRun * expectedIntervalMs);
      currentRun = 0;
      continue;
    }

    if (minuteBuckets.has(b)) {
      maxGapMs = Math.max(maxGapMs, currentRun * expectedIntervalMs);
      currentRun = 0;
    } else {
      currentRun += 1;
    }
  }
  maxGapMs = Math.max(maxGapMs, currentRun * expectedIntervalMs);

  // Keep your existing config contract:
  // - max_allowed_gap_ms still acts as "continuity" guard (now excluding marker windows)
  // - min_coverage_ratio means "density ratio" over effective (non-excluded) minutes
  const ok =
    maxGapMs <= cfg.time_coverage.max_allowed_gap_ms &&
    coverageRatio >= cfg.time_coverage.min_coverage_ratio;

  return { ok, maxGapMs, coverageRatio, expectedIntervalMs };
}
