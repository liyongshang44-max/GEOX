import type { JudgeConfigV1 } from "../config";
import type { RawSample } from "../evidence";
import { clamp01, sha256Hex, stableStringify, nowMs } from "../util";

export type EvidenceRef = { kind: "ledger_slice" | "series_query" | "qc_summary"; ref_id: string; note?: string|null; time_range?: { startTs: number; endTs: number } | null };

export type ReferenceViewV1 = {
  type: "reference_view_v1";
  schema_version: "1.0.0";
  reference_view_id: string;
  created_at_ts: number;
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  kind: "WITHIN_UNIT_HISTORY" | "WITHIN_UNIT_CONTROL_SENSOR" | "NEIGHBOR_SAME_SCALE" | "EXTERNAL_CONTEXT";
  metric: string;
  primary_series_ref: EvidenceRef;
  reference_series_ref: EvidenceRef;
  comparison_summary?: {
    overlap_ratio?: number;
    primary_sample_count?: number;
    reference_sample_count?: number;
    qc_mix_primary?: { ok_pct?: number; suspect_pct?: number; bad_pct?: number };
    qc_mix_reference?: { ok_pct?: number; suspect_pct?: number; bad_pct?: number };
    delta_hint?: { label?: "aligned" | "diverging" | "unknown"; magnitude?: number|null };
    conflict_hint?: { label?: "none" | "possible" | "clear" | "unknown"; basis_refs?: EvidenceRef[] };
  };
  notes?: string|null;
};

export function referenceNaturalKey(rv: Pick<ReferenceViewV1, "subjectRef"|"scale"|"window"|"kind"|"metric">): string {
  return `${rv.subjectRef?.projectId ?? ""}|${rv.subjectRef?.groupId ?? ""}|${rv.scale}|${rv.window.startTs}|${rv.window.endTs}|${rv.kind}|${rv.metric}`;
}

export function referenceViewIdFromKey(natural_key: string): string {
  return `rv_${sha256Hex(natural_key).slice(0, 24)}`;
}

function mean(xs: number[]): number|null {
  if (!xs.length) return null;
  let s=0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function qcMix(samples: RawSample[]): { ok_pct?: number; suspect_pct?: number; bad_pct?: number } {
  const n = samples.length;
  if (!n) return { ok_pct: 0, suspect_pct: 0, bad_pct: 0 };
  let okC=0,susC=0,badC=0;
  for (const s of samples) {
    if (s.quality === "bad") badC++;
    else if (s.quality === "suspect") susC++;
    else if (s.quality === "ok") okC++;
  }
  return { ok_pct: clamp01(okC/n), suspect_pct: clamp01(susC/n), bad_pct: clamp01(badC/n) };
}

export function buildHistoryReference(args: {
  cfg: JudgeConfigV1;
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  metric: string;
  primarySamples: RawSample[];
  referenceSamples: RawSample[];
}): ReferenceViewV1 {
  const created_at_ts = nowMs();
  const natural_key = `${args.subjectRef?.projectId ?? ""}|${args.subjectRef?.groupId ?? ""}|${args.scale}|${args.window.startTs}|${args.window.endTs}|WITHIN_UNIT_HISTORY|${args.metric}`;
  const reference_view_id = referenceViewIdFromKey(natural_key);

  const prim = args.primarySamples.filter((s) => s.metric === args.metric);
  const ref = args.referenceSamples.filter((s) => s.metric === args.metric);

  const primMean = mean(prim.map((s) => s.value).filter((v) => Number.isFinite(v)));
  const refMean = mean(ref.map((s) => s.value).filter((v) => Number.isFinite(v)));
  const magnitude = primMean != null && refMean != null ? Math.abs(primMean - refMean) : null;

  const deltaLabel: "aligned"|"diverging"|"unknown" = magnitude == null ? "unknown" : (magnitude >= args.cfg.conflict.delta_numeric_threshold ? "diverging" : "aligned");
  const conflictLabel: "none"|"possible"|"clear"|"unknown" = magnitude == null ? "unknown" : (magnitude >= args.cfg.conflict.delta_numeric_threshold ? "clear" : "none");

  const duration = args.window.endTs - args.window.startTs;
  const overlapRatio = duration > 0 ? 1 : 0;

  return {
    type: "reference_view_v1",
    schema_version: "1.0.0",
    reference_view_id,
    created_at_ts,
    subjectRef: args.subjectRef,
    scale: args.scale,
    window: args.window,
    kind: "WITHIN_UNIT_HISTORY",
    metric: args.metric,
    primary_series_ref: { kind: "ledger_slice", ref_id: `ledger:window:${args.window.startTs}-${args.window.endTs}`, time_range: { ...args.window } },
    reference_series_ref: { kind: "series_query", ref_id: `series:history:${args.window.startTs}-${args.window.endTs}:${args.metric}` },
    comparison_summary: {
      overlap_ratio: overlapRatio,
      primary_sample_count: prim.length,
      reference_sample_count: ref.length,
      qc_mix_primary: qcMix(prim),
      qc_mix_reference: qcMix(ref),
      delta_hint: { label: deltaLabel, magnitude },
      conflict_hint: { label: conflictLabel, basis_refs: [{ kind: "series_query", ref_id: `series:history:${args.metric}` }] },
    },
    notes: null,
  };
}
