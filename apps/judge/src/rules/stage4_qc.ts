import type { JudgeConfigV1 } from "../config";
import type { RawSample } from "../evidence";
import { clamp01 } from "../util";

export type QCMix = { ok_pct?: number; suspect_pct?: number; bad_pct?: number };

export type QCResult =
  | { ok: true; qcMix: QCMix }
  | { ok: false; qcMix: QCMix; flag: "QC_CONTAMINATION" | "SENSOR_HEALTH_DEGRADED" };

export function evaluateQC(cfg: JudgeConfigV1, samples: RawSample[]): QCResult {
  const n = samples.length;
  if (!n) return { ok: true, qcMix: { ok_pct: 0, suspect_pct: 0, bad_pct: 0 } };

  let okC=0,susC=0,badC=0;
  for (const s of samples) {
    if (s.quality === "bad") badC++;
    else if (s.quality === "suspect") susC++;
    else if (s.quality === "ok") okC++;
  }

  const badPct = clamp01(badC / n);
  const susPct = clamp01(susC / n);
  const okPct = clamp01(okC / n);
  const qcMix: QCMix = { ok_pct: okPct, suspect_pct: susPct, bad_pct: badPct };

  if (badPct >= cfg.qc.bad_pct_threshold) {
    return { ok: false, qcMix, flag: "QC_CONTAMINATION" };
  }
  if (susPct >= cfg.qc.suspect_pct_threshold) {
    return { ok: false, qcMix, flag: "SENSOR_HEALTH_DEGRADED" };
  }
  return { ok: true, qcMix };
}
