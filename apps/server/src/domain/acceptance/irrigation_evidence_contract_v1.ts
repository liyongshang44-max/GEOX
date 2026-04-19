import {
  evaluateEvidence,
  inferEvidenceLevel,
  isFormalLogKind,
  type EvidenceBundle,
  type EvidenceEvaluation,
  type EvidenceLevel,
} from "./evidence_policy.js";

export const IRRIGATION_SIM_TRACE_KIND_V1 = "sim_trace";

export const IRRIGATION_EVIDENCE_CONTRACT_V1 = Object.freeze({
  formal_evidence_kinds: "follow evidence_policy infer/evaluate rules; sim_trace is debug-only",
  formal_log_kinds: "follow evidence_policy isFormalLogKind allowlist/exact kinds",
  sim_trace_is_formal_evidence: false,
  media_metrics_role: "supporting_evidence",
});

function normalizeKind(value: unknown): string {
  return String((value as any)?.kind ?? value ?? "").trim().toLowerCase();
}

export function inferIrrigationEvidenceLevel(value: unknown): EvidenceLevel {
  return inferEvidenceLevel(value);
}

export function isIrrigationFormalLogKind(kindRaw: unknown): boolean {
  return isFormalLogKind(kindRaw);
}

export function isIrrigationFormalArtifactKind(kindRaw: unknown): boolean {
  const kind = normalizeKind(kindRaw);
  if (!kind || kind === IRRIGATION_SIM_TRACE_KIND_V1) return false;
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

export function evaluateIrrigationEvidenceBundle(bundle: EvidenceBundle): EvidenceEvaluation {
  const artifacts = (Array.isArray(bundle.artifacts) ? bundle.artifacts : [])
    .filter((item) => normalizeKind(item) !== IRRIGATION_SIM_TRACE_KIND_V1);
  const logs = Array.isArray(bundle.logs) ? bundle.logs : [];
  const media = (Array.isArray(bundle.media) ? bundle.media : [])
    .filter((item) => normalizeKind(item) !== IRRIGATION_SIM_TRACE_KIND_V1);
  const metrics = Array.isArray(bundle.metrics) ? bundle.metrics : [];
  return evaluateEvidence({ artifacts, logs, media, metrics });
}

export function shouldMarkInvalidExecutionForIrrigation(input: {
  hasReceipt: boolean;
  executedReceipt: boolean;
  evidence: EvidenceEvaluation;
}): boolean {
  return input.hasReceipt && input.executedReceipt && !input.evidence.has_formal_evidence;
}

export type { EvidenceLevel };
