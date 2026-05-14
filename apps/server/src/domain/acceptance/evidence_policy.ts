import {
  classifyEvidenceArtifactV1,
  evaluateFormalEvidencePolicyV1,
  type FormalEvidenceLevelV1,
} from "../evidence/formal_evidence_policy_v1.js";

export type EvidenceItem = { kind?: string; [key: string]: unknown } | string;
export type EvidenceLevel = FormalEvidenceLevelV1;

export type EvidenceBundle = {
  artifacts?: EvidenceItem[];
  logs?: EvidenceItem[];
  media?: EvidenceItem[];
  metrics?: EvidenceItem[];
};

export type EvidenceEvaluation = {
  has_formal_evidence: boolean;
  has_only_sim_trace: boolean;
  reason: "formal_evidence" | "only_sim_trace" | "no_evidence";
  evidence_level: EvidenceLevel;
  level_counts: Record<EvidenceLevel, number>;
  formal_evidence_count: number;
  simulated_evidence_count: number;
  blocking_reasons: string[];
};

function toKind(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { kind?: unknown; type?: unknown };
    return String(record.kind ?? record.type ?? "").trim().toLowerCase();
  }
  return String(value ?? "").trim().toLowerCase();
}

export function inferEvidenceLevel(value: unknown): EvidenceLevel {
  return classifyEvidenceArtifactV1(value as EvidenceItem, { fallback_kind: toKind(value) || "artifact" }).evidence_level;
}

export function isFormalLogKind(kindRaw: unknown): boolean {
  const result = evaluateFormalEvidencePolicyV1({ logs: [String(kindRaw ?? "")] });
  return result.formal_evidence_passed;
}

/**
 * Base-contract evidence policy:
 * 1) sim_trace / flight-table / dev artifacts are debug or simulated only.
 * 2) receipt/acceptance presence does not create formal evidence.
 * 3) Formal evidence requires at least one formal_eligible artifact/log/media/metric.
 */
export function evaluateEvidence(bundle: EvidenceBundle): EvidenceEvaluation {
  const artifacts = Array.isArray(bundle.artifacts) ? bundle.artifacts : [];
  const logs = Array.isArray(bundle.logs) ? bundle.logs : [];
  const media = Array.isArray(bundle.media) ? bundle.media : [];
  const metrics = Array.isArray(bundle.metrics) ? bundle.metrics : [];

  const formal = evaluateFormalEvidencePolicyV1({ artifacts, logs, media, metrics });
  const levelCounts: Record<EvidenceLevel, number> = { DEBUG: 0, FORMAL: 0, STRONG: 0 };
  for (const item of formal.classifications) levelCounts[item.evidence_level] += 1;

  const hasOnlySimTrace =
    logs.length > 0
    && logs.every((log) => toKind(log) === "sim_trace")
    && artifacts.length === 0
    && media.length === 0
    && metrics.length === 0;

  if (formal.formal_evidence_passed) {
    return {
      has_formal_evidence: true,
      has_only_sim_trace: false,
      reason: "formal_evidence",
      evidence_level: formal.strong_artifact_count > 0 ? "STRONG" : "FORMAL",
      level_counts: levelCounts,
      formal_evidence_count: formal.formal_artifact_count,
      simulated_evidence_count: formal.simulated_artifact_count,
      blocking_reasons: formal.blocking_reasons,
    };
  }

  if (hasOnlySimTrace) {
    return {
      has_formal_evidence: false,
      has_only_sim_trace: true,
      reason: "only_sim_trace",
      evidence_level: "DEBUG",
      level_counts: levelCounts,
      formal_evidence_count: 0,
      simulated_evidence_count: formal.simulated_artifact_count,
      blocking_reasons: formal.blocking_reasons,
    };
  }

  return {
    has_formal_evidence: false,
    has_only_sim_trace: false,
    reason: "no_evidence",
    evidence_level: "DEBUG",
    level_counts: levelCounts,
    formal_evidence_count: 0,
    simulated_evidence_count: formal.simulated_artifact_count,
    blocking_reasons: formal.blocking_reasons,
  };
}
