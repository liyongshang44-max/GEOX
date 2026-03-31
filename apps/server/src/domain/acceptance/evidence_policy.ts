export type EvidenceItem = { kind?: string };
export type EvidenceLevel = "DEBUG" | "FORMAL" | "STRONG";

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
};

const FORMAL_LOG_ALLOWLIST = [
  "mqtt",
  "device",
  "telemetry",
  "controller",
  "plc",
  "modbus",
  "can",
  "gateway",
  "sensor",
  "runtime",
] as const;

function toKind(value: unknown): string {
  return String((value as { kind?: string } | undefined)?.kind ?? value ?? "").trim().toLowerCase();
}

export function inferEvidenceLevel(value: unknown): EvidenceLevel {
  const kind = toKind(value);
  if (!kind || kind === "sim_trace") return "DEBUG";
  if (kind.includes("photo") || kind.includes("image")) return "STRONG";
  if (kind.includes("metric")) return "FORMAL";
  return "FORMAL";
}

export function isFormalLogKind(kindRaw: unknown): boolean {
  const kind = toKind(kindRaw);
  if (!kind || kind === "sim_trace") return false;
  return FORMAL_LOG_ALLOWLIST.some((token) => kind.includes(token));
}

/**
 * Evidence policy freeze (阶段4收口):
 * 1) sim_trace 仅算调试证据，不能用于正式验收。
 * 2) 正式证据满足其一：artifacts/media/metrics 非空，或日志为 allowlist 的非 sim_trace 类型。
 * 3) executed 回执但无正式证据 => INVALID_EXECUTION；有正式证据 => PENDING_ACCEPTANCE。
 */
export function evaluateEvidence(bundle: EvidenceBundle): EvidenceEvaluation {
  const artifacts = Array.isArray(bundle.artifacts) ? bundle.artifacts : [];
  const logs = Array.isArray(bundle.logs) ? bundle.logs : [];
  const media = Array.isArray(bundle.media) ? bundle.media : [];
  const metrics = Array.isArray(bundle.metrics) ? bundle.metrics : [];

  const levelCounts: Record<EvidenceLevel, number> = { DEBUG: 0, FORMAL: 0, STRONG: 0 };
  for (const item of artifacts) levelCounts[inferEvidenceLevel(item)] += 1;
  for (const item of media) levelCounts[inferEvidenceLevel(item)] += 1;
  for (const item of metrics) levelCounts[inferEvidenceLevel("metric")] += 1;
  for (const item of logs) levelCounts[inferEvidenceLevel(item)] += 1;

  const hasFormalLog = logs.some((log) => isFormalLogKind(log?.kind ?? log));
  const hasFormalEvidence = artifacts.length > 0 || media.length > 0 || metrics.length > 0 || hasFormalLog;
  const evidenceLevel: EvidenceLevel = levelCounts.STRONG > 0 ? "STRONG" : (hasFormalEvidence ? "FORMAL" : "DEBUG");
  if (hasFormalEvidence) {
    return { has_formal_evidence: true, has_only_sim_trace: false, reason: "formal_evidence", evidence_level: evidenceLevel, level_counts: levelCounts };
  }

  const hasAnyLogs = logs.length > 0;
  const hasOnlySimTrace =
    hasAnyLogs
    && logs.every((log) => toKind(log) === "sim_trace")
    && artifacts.length === 0
    && media.length === 0
    && metrics.length === 0;

  if (hasOnlySimTrace) {
    return { has_formal_evidence: false, has_only_sim_trace: true, reason: "only_sim_trace", evidence_level: "DEBUG", level_counts: levelCounts };
  }

  return { has_formal_evidence: false, has_only_sim_trace: false, reason: "no_evidence", evidence_level: "DEBUG", level_counts: levelCounts };
}
