import {
  evaluateEvidence,
  inferEvidenceLevel,
  isFormalLogKind,
  type EvidenceBundle,
  type EvidenceEvaluation,
  type EvidenceLevel,
} from "./evidence_policy.js";

export const IRRIGATION_DEBUG_ONLY_EVIDENCE_KINDS = ["sim_trace"] as const;
export const IRRIGATION_SUPPORTING_EVIDENCE_CHANNELS = ["media", "metrics"] as const;

export const IRRIGATION_FORMAL_EVIDENCE_RULES = Object.freeze({
  formal_log: "logs must pass isFormalLogKind(...) to count as formal log evidence",
  formal_artifact: "artifact kind is a formal candidate when inferEvidenceLevel(kind) is not DEBUG and kind is not debug-only",
  supporting_channels: "media/metrics are supporting evidence only; they do not independently mark operation execution as valid",
  debug_only: "sim_trace is debug-only and never formal evidence",
});

function normalizeKind(value: unknown): string {
  return String((value as any)?.kind ?? value ?? "").trim().toLowerCase();
}

function isDebugOnlyKind(kindRaw: unknown): boolean {
  const kind = normalizeKind(kindRaw);
  return IRRIGATION_DEBUG_ONLY_EVIDENCE_KINDS.includes(kind as (typeof IRRIGATION_DEBUG_ONLY_EVIDENCE_KINDS)[number]);
}

export function inferIrrigationEvidenceLevel(value: unknown): EvidenceLevel {
  return inferEvidenceLevel(value);
}

export function isIrrigationFormalLogKind(kindRaw: unknown): boolean {
  return isFormalLogKind(kindRaw);
}

export function isIrrigationFormalArtifactKind(kindRaw: unknown): boolean {
  const kind = normalizeKind(kindRaw);
  if (!kind || isDebugOnlyKind(kind)) return false;
  return inferIrrigationEvidenceLevel({ kind }) !== "DEBUG";
}

function toEvidenceRefFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    const ref = value.trim();
    return ref || null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const ref = String(record.ref ?? record.path ?? record.url ?? "").trim();
  return ref || null;
}

export function collectIrrigationValidEvidenceRefs(input: { artifacts: Array<{ payload?: any }>; logs: unknown[] }): string[] {
  const artifactRefs = input.artifacts
    .filter((item) => isIrrigationFormalArtifactKind(item?.payload?.kind))
    .map((item) => toEvidenceRefFromValue(item?.payload))
    .filter((item): item is string => Boolean(item));

  const logRefs = input.logs
    .filter((item) => isIrrigationFormalLogKind((item as any)?.kind ?? item))
    .map((item) => toEvidenceRefFromValue(item))
    .filter((item): item is string => Boolean(item));

  return [...new Set([...artifactRefs, ...logRefs])].slice(0, 50);
}

/**
 * Irrigation evidence freeze:
 * - Formal evidence is decided by formal logs + non-debug formal artifacts.
 * - media/metrics are supporting channels only and must not independently create formal-evidence=true.
 * - debug-only kinds (e.g. sim_trace) are never formal evidence.
 */
export function evaluateIrrigationEvidenceBundle(bundle: EvidenceBundle): EvidenceEvaluation {
  const artifacts = (Array.isArray(bundle.artifacts) ? bundle.artifacts : [])
    .filter((item) => isIrrigationFormalArtifactKind(item));
  const logs = (Array.isArray(bundle.logs) ? bundle.logs : [])
    .filter((item) => isIrrigationFormalLogKind((item as any)?.kind ?? item) || isDebugOnlyKind(item));

  // Supporting channels are intentionally excluded from formal-evidence decision.
  const base = evaluateEvidence({ artifacts, logs, media: [], metrics: [] });

  if (base.has_formal_evidence) return base;

  // Preserve "only_sim_trace" reason when all observable log evidence is debug-only.
  const rawLogs = Array.isArray(bundle.logs) ? bundle.logs : [];
  const onlyDebugLogs = rawLogs.length > 0 && rawLogs.every((item) => isDebugOnlyKind((item as any)?.kind ?? item));
  if (onlyDebugLogs) {
    return {
      ...base,
      has_formal_evidence: false,
      has_only_sim_trace: true,
      reason: "only_sim_trace",
      evidence_level: "DEBUG",
    };
  }

  return {
    ...base,
    has_formal_evidence: false,
    has_only_sim_trace: false,
    reason: "no_evidence",
    evidence_level: "DEBUG",
  };
}

export function shouldMarkInvalidExecutionForIrrigation(input: {
  hasReceipt: boolean;
  executedReceipt: boolean;
  evidence: EvidenceEvaluation;
}): boolean {
  return input.hasReceipt && input.executedReceipt && !input.evidence.has_formal_evidence;
}

export type { EvidenceLevel };
