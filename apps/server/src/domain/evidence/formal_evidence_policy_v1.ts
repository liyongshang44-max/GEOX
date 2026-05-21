export type FormalEvidenceSourceLaneV1 =
  | "FORMAL_OPERATION"
  | "SIMULATED_DEV_ONLY"
  | "DEBUG_ONLY"
  | "MANUAL_IMPORT"
  | "UNKNOWN";

export type FormalEvidenceLevelV1 = "DEBUG" | "FORMAL" | "STRONG";

export type FormalEvidenceClassificationV1 = {
  source_lane: FormalEvidenceSourceLaneV1;
  is_simulated: boolean;
  formal_eligible: boolean;
  evidence_level: FormalEvidenceLevelV1;
  blocking_reasons: string[];
};

export type FormalEvidencePolicyResultV1 = {
  formal_evidence_passed: boolean;
  formal_artifact_count: number;
  strong_artifact_count: number;
  debug_artifact_count: number;
  simulated_artifact_count: number;
  source_lanes: FormalEvidenceSourceLaneV1[];
  blocking_reasons: string[];
  classifications: FormalEvidenceClassificationV1[];
};

type EvidenceLike = Record<string, any> | string | null | undefined;

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
  "dispatch_ack",
  "valve_open_confirmation",
  "water_delivery_receipt",
] as const;

const FLIGHT_TABLE_MARKERS = [
  "flight-table",
  "flight_table",
  "flight table",
  "flight_table_dev_evidence",
  "flight-table-dev-evidence",
  "flight_table_dev",
  "ft_evidence_",
  "ft_export_",
  "ft_rel_",
] as const;

const DEV_SIM_MARKERS = [
  ...FLIGHT_TABLE_MARKERS,
  "irrigation_simulator",
  "simulated_dev_only",
  "sim_trace",
] as const;

export const SUPPORTED_EVIDENCE_ARTIFACT_KINDS_V1 = [
  "image",
  "note",
  "metric",
  "trajectory",
  "water_delivery_receipt",
  "media",
  "log",
] as const;

function asRecord(value: EvidenceLike): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function upper(value: unknown): string {
  return text(value).toUpperCase();
}

function payloadOf(value: EvidenceLike): Record<string, any> {
  const record = asRecord(value);
  const recordJson = asRecord(record.record_json);
  const payload = asRecord(record.payload);
  const nestedPayload = asRecord(recordJson.payload);
  return Object.keys(nestedPayload).length ? nestedPayload : Object.keys(payload).length ? payload : record;
}

function containsAnyMarker(value: unknown, markers: readonly string[]): boolean {
  const raw = JSON.stringify(value ?? "").toLowerCase();
  return markers.some((marker) => raw.includes(marker));
}

function isFlightTableEvidence(payload: Record<string, any>, source?: unknown): boolean {
  const sourceText = upper(payload.source ?? source);
  const devSource = upper(payload.dev_source);
  const artifactRef = lower(payload.artifact_ref ?? payload.ref ?? payload.url);
  return sourceText.startsWith("FLIGHT_TABLE_")
    || devSource.startsWith("FLIGHT_TABLE")
    || artifactRef.includes("flight-table")
    || artifactRef.includes("flight_table")
    || containsAnyMarker({ payload, source }, FLIGHT_TABLE_MARKERS);
}

function normalizeEvidenceLevel(value: unknown, kindRaw: unknown, payload?: Record<string, any>, source?: unknown): FormalEvidenceLevelV1 {
  if (payload && isFlightTableEvidence(payload, source)) return "DEBUG";
  const explicit = upper(value);
  if (explicit === "STRONG") return "STRONG";
  if (explicit === "FORMAL") return "FORMAL";
  if (explicit === "DEBUG") return "DEBUG";
  const kind = lower(kindRaw);
  if (!kind || kind === "sim_trace" || kind.includes("debug")) return "DEBUG";
  if (kind.includes("photo") || kind.includes("image") || kind.includes("trajectory")) return "STRONG";
  return "FORMAL";
}

function normalizeSourceLane(value: unknown): FormalEvidenceSourceLaneV1 | null {
  const lane = upper(value);
  if (lane === "FORMAL_OPERATION" || lane === "FORMAL_ACCEPTANCE") return "FORMAL_OPERATION";
  if (lane === "SIMULATED_DEV_ONLY" || lane === "FLIGHT_TABLE_DEV") return "SIMULATED_DEV_ONLY";
  if (lane === "DEBUG_ONLY" || lane === "DEBUG") return "DEBUG_ONLY";
  if (lane === "MANUAL_IMPORT") return "MANUAL_IMPORT";
  return null;
}

function inferSourceLane(payload: Record<string, any>, source?: unknown): FormalEvidenceSourceLaneV1 {
  if (isFlightTableEvidence(payload, source)) return "SIMULATED_DEV_ONLY";
  const explicit = normalizeSourceLane(payload.source_lane ?? payload.lane ?? payload.trust_lane);
  if (explicit) return explicit;
  if (containsAnyMarker({ payload, source }, DEV_SIM_MARKERS)) return "SIMULATED_DEV_ONLY";
  if (containsAnyMarker({ payload, source }, ["debug", "dev_source"])) return "DEBUG_ONLY";
  if (text(payload.artifact_id) || text(payload.evidence_id) || text(payload.receipt_id) || text(payload.act_task_id)) return "FORMAL_OPERATION";
  return "UNKNOWN";
}

function hasFormalLogKind(kindRaw: unknown): boolean {
  const kind = lower(kindRaw);
  if (!kind || kind === "sim_trace" || kind.includes("debug") || containsAnyMarker(kind, FLIGHT_TABLE_MARKERS)) return false;
  return FORMAL_LOG_ALLOWLIST.some((token) => kind.includes(token));
}

export function classifyEvidenceArtifactV1(value: EvidenceLike, options?: { source?: unknown; fallback_kind?: string }): FormalEvidenceClassificationV1 {
  const payload = payloadOf(value);
  const kind = text(payload.kind ?? payload.evidence_kind ?? options?.fallback_kind ?? value);
  const flightTableEvidence = isFlightTableEvidence(payload, options?.source ?? payload.source);
  const sourceLane = inferSourceLane(payload, options?.source ?? payload.source);
  const evidenceLevel = normalizeEvidenceLevel(payload.evidence_level ?? payload.level, kind, payload, options?.source ?? payload.source);
  const explicitEligible = typeof payload.formal_eligible === "boolean" ? payload.formal_eligible : null;
  const explicitSimulated = typeof payload.is_simulated === "boolean" ? payload.is_simulated : null;
  const isSimulated = flightTableEvidence
    || Boolean(explicitSimulated)
    || sourceLane === "SIMULATED_DEV_ONLY"
    || sourceLane === "DEBUG_ONLY"
    || containsAnyMarker({ payload, source: options?.source }, DEV_SIM_MARKERS);

  const blockingReasons: string[] = [];
  if (flightTableEvidence) blockingReasons.push("FLIGHT_TABLE_DEV_EVIDENCE_NOT_FORMAL");
  if (isSimulated) blockingReasons.push("SIMULATED_OR_DEV_EVIDENCE");
  if (sourceLane === "UNKNOWN") blockingReasons.push("UNKNOWN_EVIDENCE_SOURCE_LANE");
  if (evidenceLevel === "DEBUG") blockingReasons.push("DEBUG_EVIDENCE_NOT_FORMAL");
  if (explicitEligible === false) blockingReasons.push("FORMAL_ELIGIBLE_FALSE");
  if (explicitEligible === true && flightTableEvidence) blockingReasons.push("FLIGHT_TABLE_FORMAL_ELIGIBLE_FORBIDDEN");

  const formalEligible = flightTableEvidence
    ? false
    : explicitEligible === false
      ? false
      : !isSimulated && evidenceLevel !== "DEBUG" && sourceLane !== "UNKNOWN";

  return {
    source_lane: flightTableEvidence ? "SIMULATED_DEV_ONLY" : sourceLane,
    is_simulated: isSimulated,
    formal_eligible: formalEligible,
    evidence_level: flightTableEvidence ? "DEBUG" : evidenceLevel,
    blocking_reasons: Array.from(new Set(blockingReasons)),
  };
}

export function evaluateFormalEvidencePolicyV1(input: {
  artifacts?: EvidenceLike[];
  logs?: EvidenceLike[];
  media?: EvidenceLike[];
  metrics?: EvidenceLike[];
  source?: unknown;
}): FormalEvidencePolicyResultV1 {
  const classifications: FormalEvidenceClassificationV1[] = [];
  for (const artifact of Array.isArray(input.artifacts) ? input.artifacts : []) {
    classifications.push(classifyEvidenceArtifactV1(artifact, { source: input.source, fallback_kind: "artifact" }));
  }
  for (const media of Array.isArray(input.media) ? input.media : []) {
    classifications.push(classifyEvidenceArtifactV1(media, { source: input.source, fallback_kind: "media" }));
  }
  for (const metric of Array.isArray(input.metrics) ? input.metrics : []) {
    classifications.push(classifyEvidenceArtifactV1(metric, { source: input.source, fallback_kind: "metric" }));
  }
  for (const log of Array.isArray(input.logs) ? input.logs : []) {
    const kind = typeof log === "string" ? log : (payloadOf(log).kind ?? payloadOf(log).type ?? log);
    const base = classifyEvidenceArtifactV1(log, { source: input.source, fallback_kind: String(kind ?? "log") });
    const formalLog = hasFormalLogKind(kind) && !base.is_simulated && base.source_lane !== "SIMULATED_DEV_ONLY" && base.source_lane !== "DEBUG_ONLY";
    const sourceLane = formalLog && base.source_lane === "UNKNOWN" ? "FORMAL_OPERATION" : base.source_lane;
    const isSimulated = base.is_simulated || sourceLane === "SIMULATED_DEV_ONLY" || sourceLane === "DEBUG_ONLY";
    const formalEligible = base.formal_eligible || (formalLog && !isSimulated);
    classifications.push({
      ...base,
      source_lane: sourceLane,
      is_simulated: isSimulated,
      formal_eligible: formalEligible,
      blocking_reasons: formalEligible
        ? base.blocking_reasons.filter((reason) => reason !== "UNKNOWN_EVIDENCE_SOURCE_LANE")
        : Array.from(new Set([...base.blocking_reasons, formalLog ? "" : "LOG_KIND_NOT_FORMAL"].filter(Boolean))),
    });
  }

  const formal = classifications.filter((item) => item.formal_eligible);
  const blockingReasons = classifications.flatMap((item) => item.blocking_reasons);
  if (!formal.length) blockingReasons.push(classifications.length ? "NO_FORMAL_ELIGIBLE_EVIDENCE" : "NO_EVIDENCE");

  return {
    formal_evidence_passed: formal.length > 0,
    formal_artifact_count: formal.length,
    strong_artifact_count: formal.filter((item) => item.evidence_level === "STRONG").length,
    debug_artifact_count: classifications.filter((item) => item.evidence_level === "DEBUG").length,
    simulated_artifact_count: classifications.filter((item) => item.is_simulated).length,
    source_lanes: Array.from(new Set(classifications.map((item) => item.source_lane))),
    blocking_reasons: Array.from(new Set(blockingReasons)),
    classifications,
  };
}

export function evidencePolicyFromReceiptV1(receipt: any): FormalEvidencePolicyResultV1 {
  const payload = payloadOf(receipt);
  return evaluateFormalEvidencePolicyV1({
    artifacts: Array.isArray(payload.artifacts) ? payload.artifacts : Array.isArray(payload.artifact_refs) ? payload.artifact_refs : [],
    logs: Array.isArray(payload.logs_refs) ? payload.logs_refs : Array.isArray(payload.logs) ? payload.logs : [],
    media: Array.isArray(payload.media_refs) ? payload.media_refs : Array.isArray(payload.media) ? payload.media : Array.isArray(payload.photo_refs) ? payload.photo_refs : [],
    metrics: Array.isArray(payload.metrics) ? payload.metrics : Array.isArray(payload.metric_refs) ? payload.metric_refs : [],
    source: payload.source ?? payload.meta?.source ?? payload.dev_source,
  });
}
