// PostgreSQL-backed MCFT-CAP-09.S2 Evidence ingress adapter.
// Read-only boundary: selects existing governed Replay Evidence from facts only.
// Canonical epistemic compatibility is pinned to the MCFT-00 frozen vocabulary.
// It does not ingest devices, schedule ticks, persist a cursor, expose a route,
// or commit canonical Runtime objects.

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
  repository_envelope: "FACTS_TYPE_PLUS_CANONICAL_REPLAY_PAYLOAD_V1",
  read_only_transaction: true,
  actual_observation_types: [
    "soil_moisture_observation_v1",
    "observed_rainfall_v1",
    "historical_et0_estimate_v1",
  ],
  future_forcing_types: [
    "future_weather_assumption_v1",
    "future_et0_assumption_v1",
  ],
  event_time_field_by_record_type: {
    soil_moisture_observation_v1: "observed_at",
    observed_rainfall_v1: "interval_end",
    historical_et0_estimate_v1: "interval_end",
    future_weather_assumption_v1: "issued_at",
    future_et0_assumption_v1: "issued_at",
  },
  epistemic_class_by_record_type: {
    soil_moisture_observation_v1: "OBSERVED",
    observed_rainfall_v1: "OBSERVED",
    historical_et0_estimate_v1: "ESTIMATED",
    future_weather_assumption_v1: "ASSUMED",
    future_et0_assumption_v1: "ASSUMED",
  },
  window_rule: "OPEN_START_CLOSED_END_PT1H_V1",
  semantic_lookback_seconds: 3600,
  query_inspection_lookback_seconds: 7200,
  query_forward_inspection_seconds: 3600,
  stale_after_seconds: 3600,
  expected_observation_interval_seconds: 1800,
  max_candidate_records: 1000,
  eligible_quality_statuses: ["PASS", "LIMITED"],
  boundary_fields: ["role_event_time", "ingested_at", "available_to_runtime_at"],
  future_forcing_known_at_boundary_allowed: true,
  future_evidence_leakage_allowed: false,
  duplicate_identity_policy:
    "TYPE_ORIGIN_SOURCE_ROLE_EVENT_TIME_PLUS_CANONICAL_PAYLOAD_V1",
  coverage_policy: "ACTUAL_OBSERVATION_INTERVAL_BUCKETS_ONLY_V1",
  freshness_policy: "ACTUAL_OBSERVATIONS_ONLY_V1",
  explicit_trust_fail_closed: true,
  database_write_allowed: false,
  scheduler_loop_allowed: false,
  canonical_write_allowed: false,
  production_wiring_allowed: false,
} as const;

export type DatabaseEvidenceIngressConfigV1 = typeof DATABASE_EVIDENCE_INGRESS_CONFIG_V1;

export type FrozenDatabaseShadowOnlineEvidenceV1 = FrozenShadowOnlineEvidenceV1 & {
  window_rule: "OPEN_START_CLOSED_END_PT1H_V1";
  outside_window_evidence_refs: readonly string[];
  out_of_order_evidence_refs: readonly string[];
  interval_bucket_count: number;
  covered_interval_bucket_count: number;
  actual_observation_count: number;
  eligible_future_forcing_count: number;
  candidate_limit_reached: false;
};

type EvidenceFactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  record_json: unknown;
};

type ReadOnlyPoolV1 = Pick<Pool, "connect">;
type ReadOnlyClientV1 = Pick<PoolClient, "query" | "release">;

type NormalizedEvidenceV1 = {
  fact_id: string;
  record: CanonicalReplayEvidenceRecordV1;
  candidate: ShadowOnlineEvidenceCandidateV1;
  scope: TwinScopeKeyV1;
  record_type: string;
  origin_source_id: string;
  event_time_ms: number;
  ingested_at_ms: number;
  available_at_ms: number;
  canonical_payload_hash: string;
  semantic_identity: string;
  is_actual_observation: boolean;
  is_future_forcing: boolean;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalIso(value: unknown, code: string): string {
  const raw = text(value);
  const milliseconds = Date.parse(raw);
  if (!raw || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== raw) {
    throw new Error(`${code}:${raw || "MISSING"}`);
  }
  return raw;
}

function scopeFromPayload(payload: Record<string, unknown>): TwinScopeKeyV1 {
  const scope: TwinScopeKeyV1 = {
    tenant_id: text(payload.tenant_id),
    project_id: text(payload.project_id),
    group_id: text(payload.group_id),
    field_id: text(payload.field_id),
    season_id: text(payload.season_id),
    zone_id: text(payload.zone_id),
  };
  if (!Object.values(scope).every(Boolean)) throw new Error("EVIDENCE_SIX_KEY_SCOPE_REQUIRED");
  return scope;
}

function sameScope(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return (Object.keys(right) as (keyof TwinScopeKeyV1)[]).every((key) => left[key] === right[key]);
}

function explicitTrustFailure(record: CanonicalReplayEvidenceRecordV1): boolean {
  const direct = record as CanonicalReplayEvidenceRecordV1 & {
    formal_eligible?: unknown;
    is_simulated?: unknown;
    evidence_level?: unknown;
    source_lane?: unknown;
  };
  const surfaces: Record<string, unknown>[] = [
    direct as unknown as Record<string, unknown>,
    object(record.source_payload),
    object(record.canonical_payload),
  ];
  return surfaces.some((surface) => {
    const evidenceLevel = text(surface.evidence_level).toUpperCase();
    const sourceLane = text(surface.source_lane).toUpperCase();
    return surface.formal_eligible === false
      || surface.is_simulated === true
      || evidenceLevel === "DEBUG"
      || sourceLane === "DEBUG_ONLY"
      || sourceLane === "SIMULATED_DEV_ONLY";
  });
}

function normalizeRow(
  row: EvidenceFactRowV1,
  config: DatabaseEvidenceIngressConfigV1,
): NormalizedEvidenceV1 {
  const envelope = typeof row.record_json === "string"
    ? object(JSON.parse(row.record_json))
    : object(row.record_json);
  const payload = object(envelope.payload);
  const roleTime = object(payload.role_time);
  const quality = object(payload.quality);
  const wrapperType = text(envelope.type);
  const payloadType = text(payload.record_type);
  if (!wrapperType || wrapperType !== payloadType) {
    throw new Error(`EVIDENCE_WRAPPER_RECORD_TYPE_MISMATCH:${row.fact_id}`);
  }
  const eventField = config.event_time_field_by_record_type[
    wrapperType as keyof typeof config.event_time_field_by_record_type
  ];
  if (!eventField) throw new Error(`EVIDENCE_RECORD_TYPE_NOT_ALLOWED:${wrapperType}`);

  const eventTime = canonicalIso(roleTime[eventField], "EVIDENCE_ROLE_EVENT_TIME_INVALID");
  const ingestedAt = canonicalIso(roleTime.ingested_at, "EVIDENCE_INGESTED_AT_INVALID");
  const availableAt = canonicalIso(
    payload.available_to_runtime_at,
    "EVIDENCE_AVAILABLE_TO_RUNTIME_AT_INVALID",
  );
  const evidenceRef = text(payload.source_record_id);
  const evidenceHash = text(payload.source_record_hash);
  const originSourceId = text(payload.origin_source_id);
  const bindingId = text(payload.binding_id);
  if (!evidenceRef) throw new Error(`EVIDENCE_SOURCE_RECORD_ID_REQUIRED:${row.fact_id}`);
  if (!evidenceHash) throw new Error(`EVIDENCE_SOURCE_RECORD_HASH_REQUIRED:${row.fact_id}`);
  if (!originSourceId) throw new Error(`EVIDENCE_ORIGIN_SOURCE_ID_REQUIRED:${row.fact_id}`);
  if (!bindingId) throw new Error(`EVIDENCE_BINDING_ID_REQUIRED:${row.fact_id}`);

  const isActualObservation = (config.actual_observation_types as readonly string[])
    .includes(wrapperType);
  const isFutureForcing = (config.future_forcing_types as readonly string[])
    .includes(wrapperType);
  const canonicalPayloadHash = semanticHashV1(payload.canonical_payload);
  return {
    fact_id: row.fact_id,
    record: payload as unknown as CanonicalReplayEvidenceRecordV1,
    candidate: {
      evidence_ref: evidenceRef,
      evidence_hash: evidenceHash,
      evidence_kind: wrapperType,
      // S1 froze this field name. In S2 it carries the type-aware canonical role event time.
      observed_at: eventTime,
      ingested_at: ingestedAt,
      available_to_runtime_at: availableAt,
      quality_status: text(quality.status).toUpperCase() || "UNKNOWN",
    },
    scope: scopeFromPayload(payload),
    record_type: wrapperType,
    origin_source_id: originSourceId,
    event_time_ms: Date.parse(eventTime),
    ingested_at_ms: Date.parse(ingestedAt),
    available_at_ms: Date.parse(availableAt),
    canonical_payload_hash: canonicalPayloadHash,
    semantic_identity: `${wrapperType}|${originSourceId}|${eventTime}`,
    is_actual_observation: isActualObservation,
    is_future_forcing: isFutureForcing,
  };
}

function exclusion(
  normalized: NormalizedEvidenceV1,
  reason: ShadowOnlineEvidenceExclusionReasonV1,
): ShadowOnlineEvidenceExclusionV1 {
  return { ...normalized.candidate, reason };
}

function compareCandidate(a: ShadowOnlineEvidenceCandidateV1, b: ShadowOnlineEvidenceCandidateV1): number {
  return a.observed_at.localeCompare(b.observed_at)
    || a.ingested_at.localeCompare(b.ingested_at)
    || a.evidence_kind.localeCompare(b.evidence_kind)
    || a.evidence_ref.localeCompare(b.evidence_ref)
    || a.evidence_hash.localeCompare(b.evidence_hash);
}

function compareNormalizedDeterministically(a: NormalizedEvidenceV1, b: NormalizedEvidenceV1): number {
  return a.ingested_at_ms - b.ingested_at_ms
    || a.available_at_ms - b.available_at_ms
    || a.candidate.evidence_ref.localeCompare(b.candidate.evidence_ref)
    || a.fact_id.localeCompare(b.fact_id);
}

function trustEligible(
  item: NormalizedEvidenceV1,
  config: DatabaseEvidenceIngressConfigV1,
): boolean {
  if (!(config.eligible_quality_statuses as readonly string[])
    .includes(item.candidate.quality_status)) return false;
  if (explicitTrustFailure(item.record)) return false;

  const expectedEpistemicClass = config.epistemic_class_by_record_type[
    item.record_type as keyof typeof config.epistemic_class_by_record_type
  ];
  if (!expectedEpistemicClass) return false;
  const epistemicClass = text(item.record.epistemic_class).toUpperCase();
  if (epistemicClass !== expectedEpistemicClass) return false;

  return true;
}

function intervalBucketCoverage(input: {
  eventTimes: readonly number[];
  windowStartMs: number;
  semanticLookbackSeconds: number;
  expectedIntervalSeconds: number;
}): { ratio: string; expected: number; covered: number } {
  const expected = Math.max(
    1,
    Math.ceil(input.semanticLookbackSeconds / input.expectedIntervalSeconds),
  );
  const bucketMs = input.expectedIntervalSeconds * 1000;
  const covered = new Set<number>();
  for (const eventTime of input.eventTimes) {
    if (eventTime <= input.windowStartMs) continue;
    const bucket = Math.min(
      expected - 1,
      Math.floor((eventTime - input.windowStartMs - 1) / bucketMs),
    );
    if (bucket >= 0) covered.add(bucket);
  }
  return {
    ratio: Math.min(1, covered.size / expected).toFixed(6),
    expected,
    covered: covered.size,
  };
}

export class PostgresEvidenceIngressAdapterV1 implements EvidenceIngressPortV1 {
  public constructor(
    private readonly pool: ReadOnlyPoolV1,
    private readonly config: DatabaseEvidenceIngressConfigV1 = DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  ) {}

  public async freezeEligibleEvidence(input: {
    boundary: ShadowOnlineBoundaryV1;
  }): Promise<FrozenDatabaseShadowOnlineEvidenceV1> {
    const boundaryTime = new Date(input.boundary.logical_time);
    if (!Number.isFinite(boundaryTime.getTime())) throw new Error("SHADOW_ONLINE_BOUNDARY_INVALID");
    if (input.boundary.interval_seconds !== 3600) throw new Error("SHADOW_ONLINE_INTERVAL_INVALID");

    const boundaryMs = boundaryTime.getTime();
    const windowStartMs = boundaryMs - this.config.semantic_lookback_seconds * 1000;
    const queryStart = new Date(
      boundaryMs - this.config.query_inspection_lookback_seconds * 1000,
    ).toISOString();
    const queryEnd = new Date(
      boundaryMs + this.config.query_forward_inspection_seconds * 1000,
    ).toISOString();
    const scope = input.boundary.scope;
    const client = await this.pool.connect() as ReadOnlyClientV1;

    let rows: EvidenceFactRowV1[];
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(
        `SELECT fact_id, occurred_at, record_json
           FROM facts
          WHERE record_json#>>'{payload,tenant_id}' = $1
            AND record_json#>>'{payload,project_id}' = $2
            AND record_json#>>'{payload,group_id}' = $3
            AND record_json#>>'{payload,field_id}' = $4
            AND record_json#>>'{payload,season_id}' = $5
            AND record_json#>>'{payload,zone_id}' = $6
            AND record_json->>'type' = ANY($7::text[])
            AND occurred_at > $8::timestamptz
            AND occurred_at <= $9::timestamptz
          ORDER BY occurred_at ASC, fact_id ASC
          LIMIT $10`,
        [
          scope.tenant_id,
          scope.project_id,
          scope.group_id,
          scope.field_id,
          scope.season_id,
          scope.zone_id,
          [...this.config.actual_observation_types, ...this.config.future_forcing_types],
          queryStart,
          queryEnd,
          this.config.max_candidate_records + 1,
        ],
      );
      rows = result.rows as EvidenceFactRowV1[];
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original database/read-boundary failure.
      }
      throw error;
    } finally {
      client.release();
    }

    if (rows.length > this.config.max_candidate_records) {
      throw new Error("EVIDENCE_CANDIDATE_LIMIT_REACHED");
    }

    const eligible: NormalizedEvidenceV1[] = [];
    const excluded: ShadowOnlineEvidenceExclusionV1[] = [];
    const outsideWindow = new Set<string>();

    for (const item of rows.map((row) => normalizeRow(row, this.config))) {
      let reason: ShadowOnlineEvidenceExclusionReasonV1 | null = null;
      if (!sameScope(item.scope, scope)) reason = "SCOPE_MISMATCH";
      else if (item.event_time_ms > boundaryMs) reason = "OBSERVED_AFTER_BOUNDARY";
      else if (item.event_time_ms <= windowStartMs) {
        outsideWindow.add(item.candidate.evidence_ref);
        continue;
      } else if (item.ingested_at_ms > boundaryMs) reason = "INGESTED_AFTER_BOUNDARY";
      else if (item.available_at_ms > boundaryMs) reason = "AVAILABLE_AFTER_BOUNDARY";
      else if (!trustEligible(item, this.config)) reason = "QUALITY_INELIGIBLE";

      if (reason) excluded.push(exclusion(item, reason));
      else eligible.push(item);
    }

    eligible.sort(compareNormalizedDeterministically);

    const uniqueByRef = new Map<string, NormalizedEvidenceV1>();
    for (const item of eligible) {
      const previous = uniqueByRef.get(item.candidate.evidence_ref);
      if (!previous) {
        uniqueByRef.set(item.candidate.evidence_ref, item);
        continue;
      }
      if (previous.candidate.evidence_hash !== item.candidate.evidence_hash) {
        throw new Error(`EVIDENCE_IDENTITY_CONFLICT:${item.candidate.evidence_ref}`);
      }
      excluded.push(exclusion(item, "DUPLICATE_SUPERSEDED"));
    }

    const semanticGroups = new Map<string, NormalizedEvidenceV1[]>();
    for (const item of uniqueByRef.values()) {
      const group = semanticGroups.get(item.semantic_identity) ?? [];
      group.push(item);
      semanticGroups.set(item.semantic_identity, group);
    }

    const selectedNormalized: NormalizedEvidenceV1[] = [];
    for (const [identity, group] of semanticGroups) {
      const canonicalPayloads = new Set(group.map((item) => item.canonical_payload_hash));
      if (canonicalPayloads.size > 1) {
        throw new Error(`CONFLICTING_DUPLICATE_OBSERVATION:${identity}`);
      }
      group.sort(compareNormalizedDeterministically);
      selectedNormalized.push(group[0]);
      for (const duplicate of group.slice(1)) {
        excluded.push(exclusion(duplicate, "DUPLICATE_SUPERSEDED"));
      }
    }

    const outOfOrder = new Set<string>();
    let greatestEventMs = Number.NEGATIVE_INFINITY;
    for (const item of [...selectedNormalized].sort(compareNormalizedDeterministically)) {
      if (item.event_time_ms < greatestEventMs) outOfOrder.add(item.candidate.evidence_ref);
      greatestEventMs = Math.max(greatestEventMs, item.event_time_ms);
    }

    const selected = selectedNormalized.map((item) => item.candidate).sort(compareCandidate);
    excluded.sort((a, b) => compareCandidate(a, b) || a.reason.localeCompare(b.reason));
    if (selected.some((item) => Date.parse(item.observed_at) > boundaryMs
      || Date.parse(item.ingested_at) > boundaryMs
      || Date.parse(item.available_to_runtime_at) > boundaryMs)) {
      throw new Error("FUTURE_EVIDENCE_LEAKAGE_DETECTED");
    }

    const actualObservationTimes = [...new Set(
      selectedNormalized
        .filter((item) => item.is_actual_observation)
        .map((item) => item.event_time_ms),
    )].sort((a, b) => a - b);
    const coverage = intervalBucketCoverage({
      eventTimes: actualObservationTimes,
      windowStartMs,
      semanticLookbackSeconds: this.config.semantic_lookback_seconds,
      expectedIntervalSeconds: this.config.expected_observation_interval_seconds,
    });
    const gapPoints = actualObservationTimes.length > 0
      ? [windowStartMs, ...actualObservationTimes, boundaryMs]
      : [];
    let maximumGapSeconds: number | null = actualObservationTimes.length > 0 ? 0 : null;
    if (maximumGapSeconds !== null) {
      for (let index = 1; index < gapPoints.length; index += 1) {
        maximumGapSeconds = Math.max(
          maximumGapSeconds,
          Math.round((gapPoints[index] - gapPoints[index - 1]) / 1000),
        );
      }
    }
    const freshestObservedAt = actualObservationTimes.length > 0
      ? new Date(actualObservationTimes[actualObservationTimes.length - 1]).toISOString()
      : null;
    const freshnessStatus = freshestObservedAt === null
      ? "MISSING"
      : boundaryMs - Date.parse(freshestObservedAt) > this.config.stale_after_seconds * 1000
        ? "STALE"
        : "FRESH";

    return {
      boundary: structuredClone(input.boundary),
      selected,
      excluded,
      coverage_ratio_decimal: coverage.ratio,
      maximum_gap_seconds: maximumGapSeconds,
      freshest_observed_at: freshestObservedAt,
      freshness_status: freshnessStatus,
      future_evidence_leakage: false,
      window_rule: "OPEN_START_CLOSED_END_PT1H_V1",
      outside_window_evidence_refs: [...outsideWindow].sort(),
      out_of_order_evidence_refs: [...outOfOrder].sort(),
      interval_bucket_count: coverage.expected,
      covered_interval_bucket_count: coverage.covered,
      actual_observation_count: selectedNormalized.filter((item) => item.is_actual_observation).length,
      eligible_future_forcing_count: selectedNormalized.filter((item) => item.is_future_forcing).length,
      candidate_limit_reached: false,
    };
  }
}
