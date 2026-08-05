// MCFT-CAP-09.S2 PostgreSQL-backed Evidence ingress adapter.
// Boundary: read-only selection of the established canonical Replay Evidence envelope in facts.
// No scheduler, route, migration, canonical write, live gateway, or production wiring is present.

import type { Pool, PoolClient } from "pg";

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  EvidenceIngressPortV1,
  FrozenShadowOnlineEvidenceV1,
  ShadowOnlineBoundaryV1,
  ShadowOnlineEvidenceCandidateV1,
  ShadowOnlineEvidenceExclusionReasonV1,
  ShadowOnlineEvidenceExclusionV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const DATABASE_EVIDENCE_INGRESS_CONFIG_V1 = {
  schema_version: "geox_mcft_cap09_database_evidence_ingress_config_v1",
  source_table: "facts",
  envelope_contract: "FACT_RECORD_JSON_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1",
  read_only: true,
  actual_record_types: [
    "soil_moisture_observation_v1",
    "observed_rainfall_v1",
    "historical_et0_estimate_v1",
  ],
  future_record_types: [
    "future_weather_assumption_v1",
    "future_et0_assumption_v1",
  ],
  unsupported_operational_record_types: [
    "raw_telemetry_v1",
    "device_observation_v1",
  ],
  semantic_window_rule: "OPEN_START_CLOSED_END_PT1H_V1",
  semantic_window_seconds: 3600,
  query_inspection_lookback_seconds: 7200,
  query_forward_inspection_seconds: 3600,
  expected_observation_interval_seconds: 1800,
  stale_after_seconds: 3600,
  max_candidate_records: 1000,
  accepted_quality_statuses: ["PASS", "LIMITED"],
  future_evidence_leakage_allowed: false,
  database_write_allowed: false,
  scheduler_loop_allowed: false,
  canonical_write_allowed: false,
  production_wiring_allowed: false,
} as const;

export type DatabaseEvidenceIngressConfigV1 = typeof DATABASE_EVIDENCE_INGRESS_CONFIG_V1;

type EvidenceFactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  ingested_at: string | Date;
  record_json: unknown;
};

type NormalizedReplayEvidenceV1 = {
  fact_id: string;
  record: CanonicalReplayEvidenceRecordV1;
  candidate: ShadowOnlineEvidenceCandidateV1;
  event_time: string;
  ingested_at: string;
  available_to_runtime_at: string;
  identity_key: string;
  canonical_payload_hash: string;
  is_future_assumption: boolean;
};

export type DatabaseEvidenceFreezeDiagnosticsV1 = {
  schema_version: "geox_mcft_cap09_database_evidence_freeze_diagnostics_v1";
  window_rule_id: "OPEN_START_CLOSED_END_PT1H_V1";
  window_start_exclusive: string;
  window_end_inclusive: string;
  queried_fact_count: number;
  unsupported_operational_type_count: number;
  outside_window_excluded_count: number;
  outside_window_evidence_refs: string[];
  interval_bucket_count: number;
  covered_interval_bucket_count: number;
  conflicting_duplicate_rejected: false;
  database_transaction_mode: "READ_ONLY";
};

const EVENT_FIELD_BY_TYPE_V1: Readonly<Record<string, string>> = {
  soil_moisture_observation_v1: "observed_at",
  observed_rainfall_v1: "interval_end",
  historical_et0_estimate_v1: "interval_end",
  future_weather_assumption_v1: "issued_at",
  future_et0_assumption_v1: "issued_at",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value: unknown, code: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(code);
  return value;
}

function requireText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function requireIso(value: unknown, code: string): string {
  const raw = requireText(value, code);
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return new Date(parsed).toISOString();
}

function exactScope(record: CanonicalReplayEvidenceRecordV1): TwinScopeKeyV1 {
  return {
    tenant_id: requireText(record.tenant_id, "REPLAY_SCOPE_TENANT_REQUIRED"),
    project_id: requireText(record.project_id, "REPLAY_SCOPE_PROJECT_REQUIRED"),
    group_id: requireText(record.group_id, "REPLAY_SCOPE_GROUP_REQUIRED"),
    field_id: requireText(record.field_id, "REPLAY_SCOPE_FIELD_REQUIRED"),
    season_id: requireText(record.season_id, "REPLAY_SCOPE_SEASON_REQUIRED"),
    zone_id: requireText(record.zone_id, "REPLAY_SCOPE_ZONE_REQUIRED"),
  };
}

function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function explicitOperationalTrustFailure(record: CanonicalReplayEvidenceRecordV1): boolean {
  const direct = record as CanonicalReplayEvidenceRecordV1 & {
    formal_eligible?: unknown;
    is_simulated?: unknown;
    evidence_level?: unknown;
    source_lane?: unknown;
  };
  const sourcePayload = isObject(record.source_payload) ? record.source_payload : {};
  const canonicalPayload = isObject(record.canonical_payload) ? record.canonical_payload : {};
  const values = [direct, sourcePayload, canonicalPayload];
  return values.some((value) => {
    const lane = String(value.source_lane ?? "").trim().toUpperCase();
    const level = String(value.evidence_level ?? "").trim().toUpperCase();
    return value.formal_eligible === false
      || value.is_simulated === true
      || lane === "SIMULATED_DEV_ONLY"
      || lane === "DEBUG_ONLY"
      || level === "DEBUG";
  });
}

function replayTrustEligible(
  item: NormalizedReplayEvidenceV1,
  config: DatabaseEvidenceIngressConfigV1,
): boolean {
  const quality = String(item.record.quality?.status ?? "").trim().toUpperCase();
  if (!(config.accepted_quality_statuses as readonly string[]).includes(quality)) return false;
  if (explicitOperationalTrustFailure(item.record)) return false;
  if (!item.is_future_assumption && String(item.record.epistemic_class).trim().toUpperCase() !== "OBSERVED") {
    return false;
  }
  return Boolean(
    item.record.source_record_id
      && item.record.source_record_hash
      && item.record.binding_id
      && item.record.origin_source_id
      && isObject(item.record.canonical_payload),
  );
}

function normalizeRow(
  row: EvidenceFactRowV1,
  config: DatabaseEvidenceIngressConfigV1,
): NormalizedReplayEvidenceV1 {
  const envelope = typeof row.record_json === "string"
    ? requireObject(JSON.parse(row.record_json), "FACT_ENVELOPE_INVALID")
    : requireObject(row.record_json, "FACT_ENVELOPE_INVALID");
  const envelopeType = requireText(envelope.type, "FACT_ENVELOPE_TYPE_REQUIRED");
  const payload = requireObject(envelope.payload, "FACT_ENVELOPE_PAYLOAD_REQUIRED") as unknown as CanonicalReplayEvidenceRecordV1;
  const recordType = requireText(payload.record_type, "REPLAY_RECORD_TYPE_REQUIRED");
  if (envelopeType !== recordType) throw new Error(`FACT_ENVELOPE_TYPE_MISMATCH:${row.fact_id}`);
  const supported = [
    ...config.actual_record_types,
    ...config.future_record_types,
  ] as readonly string[];
  if (!supported.includes(recordType)) throw new Error(`UNSUPPORTED_REPLAY_RECORD_TYPE:${recordType}`);
  exactScope(payload);
  const roleTime = requireObject(payload.role_time, "REPLAY_ROLE_TIME_REQUIRED");
  const eventField = EVENT_FIELD_BY_TYPE_V1[recordType];
  if (!eventField) throw new Error(`REPLAY_EVENT_FIELD_UNMAPPED:${recordType}`);
  const eventTime = requireIso(roleTime[eventField], `REPLAY_EVENT_TIME_REQUIRED:${recordType}`);
  const ingestedAt = requireIso(roleTime.ingested_at, "REPLAY_INGESTED_AT_REQUIRED");
  const availableAt = requireIso(payload.available_to_runtime_at, "REPLAY_AVAILABLE_AT_REQUIRED");
  const sourceRecordId = requireText(payload.source_record_id, "REPLAY_SOURCE_RECORD_ID_REQUIRED");
  const sourceRecordHash = requireText(payload.source_record_hash, "REPLAY_SOURCE_RECORD_HASH_REQUIRED");
  const originSourceId = requireText(payload.origin_source_id, "REPLAY_ORIGIN_SOURCE_ID_REQUIRED");
  const future = (config.future_record_types as readonly string[]).includes(recordType)
    || String(payload.epistemic_class).trim().toUpperCase().includes("FUTURE");
  return {
    fact_id: row.fact_id,
    record: payload,
    candidate: {
      evidence_ref: sourceRecordId,
      evidence_hash: sourceRecordHash,
      evidence_kind: recordType,
      observed_at: eventTime,
      ingested_at: ingestedAt,
      available_to_runtime_at: availableAt,
      quality_status: String(payload.quality?.status ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
    },
    event_time: eventTime,
    ingested_at: ingestedAt,
    available_to_runtime_at: availableAt,
    identity_key: [recordType, originSourceId, eventTime].join("|"),
    canonical_payload_hash: semanticHashV1(payload.canonical_payload),
    is_future_assumption: future,
  };
}

function exclusion(
  item: NormalizedReplayEvidenceV1,
  reason: ShadowOnlineEvidenceExclusionReasonV1,
): ShadowOnlineEvidenceExclusionV1 {
  return { ...item.candidate, reason };
}

function compareCandidate(
  left: ShadowOnlineEvidenceCandidateV1,
  right: ShadowOnlineEvidenceCandidateV1,
): number {
  return left.observed_at.localeCompare(right.observed_at)
    || left.ingested_at.localeCompare(right.ingested_at)
    || left.evidence_kind.localeCompare(right.evidence_kind)
    || left.evidence_ref.localeCompare(right.evidence_ref);
}

function chooseExactDuplicateWinner(
  left: NormalizedReplayEvidenceV1,
  right: NormalizedReplayEvidenceV1,
): NormalizedReplayEvidenceV1 {
  const byIngested = right.ingested_at.localeCompare(left.ingested_at);
  if (byIngested < 0) return left;
  if (byIngested > 0) return right;
  return left.candidate.evidence_ref.localeCompare(right.candidate.evidence_ref) <= 0 ? left : right;
}

function intervalCoverage(
  eventTimes: readonly number[],
  windowStartMs: number,
  intervalSeconds: number,
  expectedIntervalSeconds: number,
): { ratio: string; expected: number; covered: number } {
  const expected = Math.max(1, Math.ceil(intervalSeconds / expectedIntervalSeconds));
  const bucketMs = expectedIntervalSeconds * 1000;
  const coveredBuckets = new Set<number>();
  for (const eventTime of eventTimes) {
    if (eventTime <= windowStartMs) continue;
    const index = Math.min(expected - 1, Math.floor((eventTime - windowStartMs - 1) / bucketMs));
    if (index >= 0) coveredBuckets.add(index);
  }
  return {
    ratio: Math.min(1, coveredBuckets.size / expected).toFixed(6),
    expected,
    covered: coveredBuckets.size,
  };
}

async function selectRowsReadOnly(
  client: PoolClient,
  boundaryTime: string,
  config: DatabaseEvidenceIngressConfigV1,
): Promise<EvidenceFactRowV1[]> {
  const boundaryMs = Date.parse(boundaryTime);
  const queryStart = new Date(
    boundaryMs - config.query_inspection_lookback_seconds * 1000,
  ).toISOString();
  const queryEnd = new Date(
    boundaryMs + config.query_forward_inspection_seconds * 1000,
  ).toISOString();
  const types = [
    ...config.actual_record_types,
    ...config.future_record_types,
    ...config.unsupported_operational_record_types,
  ];
  const result = await client.query<EvidenceFactRowV1>(
    `SELECT fact_id, occurred_at, ingested_at, record_json
       FROM facts
      WHERE record_json->>'type' = ANY($1::text[])
        AND occurred_at > $2::timestamptz
        AND occurred_at <= $3::timestamptz
      ORDER BY occurred_at ASC, ingested_at ASC, fact_id ASC
      LIMIT $4`,
    [types, queryStart, queryEnd, config.max_candidate_records],
  );
  return result.rows;
}

export class PostgresEvidenceIngressAdapterV1 implements EvidenceIngressPortV1 {
  private lastDiagnostics: DatabaseEvidenceFreezeDiagnosticsV1 | null = null;

  public constructor(
    private readonly pool: Pool,
    private readonly config: DatabaseEvidenceIngressConfigV1 = DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  ) {}

  public readLastFreezeDiagnostics(): DatabaseEvidenceFreezeDiagnosticsV1 {
    if (!this.lastDiagnostics) throw new Error("DATABASE_EVIDENCE_FREEZE_DIAGNOSTICS_NOT_AVAILABLE");
    return structuredClone(this.lastDiagnostics);
  }

  public async freezeEligibleEvidence(input: {
    boundary: ShadowOnlineBoundaryV1;
  }): Promise<FrozenShadowOnlineEvidenceV1> {
    const boundaryIso = requireIso(input.boundary.logical_time, "SHADOW_ONLINE_BOUNDARY_INVALID");
    if (input.boundary.interval_seconds !== 3600) throw new Error("SHADOW_ONLINE_INTERVAL_INVALID");
    const boundaryMs = Date.parse(boundaryIso);
    const windowStartMs = boundaryMs - this.config.semantic_window_seconds * 1000;
    const windowStartIso = new Date(windowStartMs).toISOString();

    const client = await this.pool.connect();
    let rows: EvidenceFactRowV1[];
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      rows = await selectRowsReadOnly(client, boundaryIso, this.config);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const unsupportedOperationalRows = rows.filter((row) => {
      const envelope = typeof row.record_json === "string"
        ? requireObject(JSON.parse(row.record_json), "FACT_ENVELOPE_INVALID")
        : requireObject(row.record_json, "FACT_ENVELOPE_INVALID");
      return (this.config.unsupported_operational_record_types as readonly string[])
        .includes(String(envelope.type ?? ""));
    });
    const replayRows = rows.filter((row) => !unsupportedOperationalRows.includes(row));
    const excluded: ShadowOnlineEvidenceExclusionV1[] = [];
    const outsideWindow: NormalizedReplayEvidenceV1[] = [];
    const eligible: NormalizedReplayEvidenceV1[] = [];

    for (const item of replayRows.map((row) => normalizeRow(row, this.config))) {
      const eventMs = Date.parse(item.event_time);
      const ingestedMs = Date.parse(item.ingested_at);
      const availableMs = Date.parse(item.available_to_runtime_at);
      if (!sameScope(exactScope(item.record), input.boundary.scope)) {
        excluded.push(exclusion(item, "SCOPE_MISMATCH"));
      } else if (item.is_future_assumption) {
        excluded.push(exclusion(item, "FUTURE_EVIDENCE"));
      } else if (eventMs > boundaryMs) {
        excluded.push(exclusion(item, "OBSERVED_AFTER_BOUNDARY"));
      } else if (ingestedMs > boundaryMs) {
        excluded.push(exclusion(item, "INGESTED_AFTER_BOUNDARY"));
      } else if (availableMs > boundaryMs) {
        excluded.push(exclusion(item, "AVAILABLE_AFTER_BOUNDARY"));
      } else if (eventMs <= windowStartMs) {
        outsideWindow.push(item);
      } else if (!replayTrustEligible(item, this.config)) {
        excluded.push(exclusion(item, "QUALITY_INELIGIBLE"));
      } else {
        eligible.push(item);
      }
    }

    const selected: NormalizedReplayEvidenceV1[] = [];
    const groups = new Map<string, NormalizedReplayEvidenceV1[]>();
    for (const item of eligible) {
      const group = groups.get(item.identity_key) ?? [];
      group.push(item);
      groups.set(item.identity_key, group);
    }

    for (const [identity, group] of groups) {
      const semanticPayloads = new Set(group.map((item) => item.canonical_payload_hash));
      if (semanticPayloads.size > 1) {
        throw new Error(`CONFLICTING_DUPLICATE_OBSERVATION:${identity}`);
      }
      let winner = group[0];
      for (const item of group.slice(1)) winner = chooseExactDuplicateWinner(winner, item);
      selected.push(winner);
      for (const item of group) {
        if (item !== winner) excluded.push(exclusion(item, "DUPLICATE_SUPERSEDED"));
      }
    }

    const selectedCandidates = selected.map((item) => item.candidate).sort(compareCandidate);
    excluded.sort((left, right) => compareCandidate(left, right) || left.reason.localeCompare(right.reason));
    if (selectedCandidates.some((item) =>
      Date.parse(item.observed_at) > boundaryMs
      || Date.parse(item.ingested_at) > boundaryMs
      || Date.parse(item.available_to_runtime_at) > boundaryMs
    )) {
      throw new Error("FUTURE_EVIDENCE_LEAKAGE_DETECTED");
    }

    const eventTimes = [...new Set(selectedCandidates.map((item) => Date.parse(item.observed_at)))].sort((a, b) => a - b);
    const coverage = intervalCoverage(
      eventTimes,
      windowStartMs,
      this.config.semantic_window_seconds,
      this.config.expected_observation_interval_seconds,
    );
    const gapPoints = eventTimes.length ? [windowStartMs, ...eventTimes, boundaryMs] : [];
    let maximumGapSeconds: number | null = null;
    if (gapPoints.length > 1) {
      maximumGapSeconds = 0;
      for (let index = 1; index < gapPoints.length; index += 1) {
        maximumGapSeconds = Math.max(
          maximumGapSeconds,
          Math.round((gapPoints[index] - gapPoints[index - 1]) / 1000),
        );
      }
    }
    const freshestObservedAt = selectedCandidates.length
      ? selectedCandidates[selectedCandidates.length - 1].observed_at
      : null;
    const freshnessStatus = freshestObservedAt === null
      ? "MISSING"
      : boundaryMs - Date.parse(freshestObservedAt) > this.config.stale_after_seconds * 1000
        ? "STALE"
        : "FRESH";

    this.lastDiagnostics = {
      schema_version: "geox_mcft_cap09_database_evidence_freeze_diagnostics_v1",
      window_rule_id: "OPEN_START_CLOSED_END_PT1H_V1",
      window_start_exclusive: windowStartIso,
      window_end_inclusive: boundaryIso,
      queried_fact_count: rows.length,
      unsupported_operational_type_count: unsupportedOperationalRows.length,
      outside_window_excluded_count: outsideWindow.length,
      outside_window_evidence_refs: outsideWindow.map((item) => item.candidate.evidence_ref).sort(),
      interval_bucket_count: coverage.expected,
      covered_interval_bucket_count: coverage.covered,
      conflicting_duplicate_rejected: false,
      database_transaction_mode: "READ_ONLY",
    };

    return {
      boundary: structuredClone(input.boundary),
      selected: selectedCandidates,
      excluded,
      coverage_ratio_decimal: coverage.ratio,
      maximum_gap_seconds: maximumGapSeconds,
      freshest_observed_at: freshestObservedAt,
      freshness_status: freshnessStatus,
      future_evidence_leakage: false,
    };
  }
}
