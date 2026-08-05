// PostgreSQL-backed MCFT-CAP-09.S2 Evidence ingress adapter.
// Read-only boundary: this module selects existing governed facts only. It does not write,
// schedule, open a public route, synthesize sensor truth, or commit canonical Runtime objects.

import { createHash } from "node:crypto";
import type { Pool } from "pg";

import type {
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
  read_only: true,
  allowed_fact_types: [
    "telemetry_observation_v1",
    "raw_telemetry_v1",
    "weather_observation_v1",
    "soil_observation_v1",
    "field_observation_v1",
    "remote_sensing_observation_v1",
  ],
  lookback_seconds: 3600,
  forward_inspection_seconds: 3600,
  stale_after_seconds: 3600,
  expected_observation_interval_seconds: 1800,
  minimum_expected_observations: 2,
  max_candidate_records: 1000,
  quality_ineligible_statuses: ["INVALID", "REJECTED", "QUARANTINED"],
  boundary_fields: ["observed_at", "ingested_at", "available_to_runtime_at"],
  future_evidence_leakage_allowed: false,
  database_write_allowed: false,
} as const;

export type DatabaseEvidenceIngressConfigV1 = typeof DATABASE_EVIDENCE_INGRESS_CONFIG_V1;

type EvidenceFactRowV1 = {
  fact_id: string;
  occurred_at: string | Date;
  ingested_at: string | Date;
  record_json: unknown;
};

type QueryPortV1 = Pick<Pool, "query">;

type NormalizedEvidenceV1 = {
  candidate: ShadowOnlineEvidenceCandidateV1;
  scope: TwinScopeKeyV1 | null;
  future_assumption: boolean;
  identity_key: string;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function timestamp(value: unknown, fallback: string | Date): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = text(value) || new Date(fallback).toISOString();
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`EVIDENCE_TIMESTAMP_INVALID:${raw}`);
  return parsed.toISOString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function scopeFromRecord(record: Record<string, unknown>): TwinScopeKeyV1 | null {
  const payload = object(record.payload);
  const entity = object(record.entity);
  const scope = object(record.scope);
  const pick = (key: keyof TwinScopeKeyV1): string =>
    text(payload[key]) || text(entity[key]) || text(scope[key]);
  const result: TwinScopeKeyV1 = {
    tenant_id: pick("tenant_id"),
    project_id: pick("project_id"),
    group_id: pick("group_id"),
    field_id: pick("field_id"),
    season_id: pick("season_id"),
    zone_id: pick("zone_id"),
  };
  return Object.values(result).every(Boolean) ? result : null;
}

function sameScope(left: TwinScopeKeyV1 | null, right: TwinScopeKeyV1): boolean {
  return !!left && (Object.keys(right) as (keyof TwinScopeKeyV1)[]).every((key) => left[key] === right[key]);
}

function normalizeRow(row: EvidenceFactRowV1): NormalizedEvidenceV1 {
  const record = typeof row.record_json === "string" ? object(JSON.parse(row.record_json)) : object(row.record_json);
  const payload = object(record.payload);
  const quality = object(payload.quality ?? record.quality);
  const roleTime = object(payload.role_time ?? record.role_time);
  const evidenceKind = text(record.type) || "UNKNOWN_EVIDENCE";
  const observedAt = timestamp(
    payload.observed_at ?? payload.observed_at_ts_ms ?? record.observed_at ?? roleTime.observed_at,
    row.occurred_at,
  );
  const ingestedAt = timestamp(payload.ingested_at ?? record.ingested_at, row.ingested_at);
  const availableAt = timestamp(
    payload.available_to_runtime_at ?? record.available_to_runtime_at,
    ingestedAt,
  );
  const evidenceRef = text(payload.evidence_ref) || text(record.evidence_ref) || `fact:${row.fact_id}`;
  const evidenceHash =
    text(payload.evidence_hash) ||
    text(record.evidence_hash) ||
    text(record.object_hash) ||
    text(payload.source_record_hash) ||
    digest(record);
  const qualityStatus = (text(quality.status) || text(payload.quality_status) || "ELIGIBLE").toUpperCase();
  const metric = text(payload.metric) || text(payload.variable) || text(payload.observation_type);
  const sourceId = text(payload.device_id) || text(payload.source_id) || text(record.source);
  const futureAssumption =
    payload.future === true ||
    text(payload.epistemic_class).toUpperCase().includes("FUTURE") ||
    text(record.epistemic_class).toUpperCase().includes("FUTURE") ||
    evidenceKind.includes("future_");
  return {
    candidate: {
      evidence_ref: evidenceRef,
      evidence_hash: evidenceHash,
      evidence_kind: evidenceKind,
      observed_at: observedAt,
      ingested_at: ingestedAt,
      available_to_runtime_at: availableAt,
      quality_status: qualityStatus,
    },
    scope: scopeFromRecord(record),
    future_assumption: futureAssumption,
    identity_key: [evidenceKind, sourceId, metric, observedAt].join("|"),
  };
}

function exclusion(
  normalized: NormalizedEvidenceV1,
  reason: ShadowOnlineEvidenceExclusionReasonV1,
): ShadowOnlineEvidenceExclusionV1 {
  return { ...normalized.candidate, reason };
}

function compareCandidate(a: ShadowOnlineEvidenceCandidateV1, b: ShadowOnlineEvidenceCandidateV1): number {
  return (
    a.observed_at.localeCompare(b.observed_at) ||
    a.ingested_at.localeCompare(b.ingested_at) ||
    a.evidence_ref.localeCompare(b.evidence_ref)
  );
}

function decimalRatio(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0.000000";
  return Math.min(1, numerator / denominator).toFixed(6);
}

export class PostgresEvidenceIngressAdapterV1 implements EvidenceIngressPortV1 {
  public constructor(
    private readonly pool: QueryPortV1,
    private readonly config: DatabaseEvidenceIngressConfigV1 = DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  ) {}

  public async freezeEligibleEvidence(input: {
    boundary: ShadowOnlineBoundaryV1;
  }): Promise<FrozenShadowOnlineEvidenceV1> {
    const boundaryTime = new Date(input.boundary.logical_time);
    if (!Number.isFinite(boundaryTime.getTime())) throw new Error("SHADOW_ONLINE_BOUNDARY_INVALID");
    if (input.boundary.interval_seconds !== 3600) throw new Error("SHADOW_ONLINE_INTERVAL_INVALID");
    const queryStart = new Date(boundaryTime.getTime() - this.config.lookback_seconds * 1000).toISOString();
    const queryEnd = new Date(boundaryTime.getTime() + this.config.forward_inspection_seconds * 1000).toISOString();
    const scope = input.boundary.scope;
    const result = await this.pool.query<EvidenceFactRowV1>(
      `SELECT fact_id, occurred_at, ingested_at, record_json::jsonb AS record_json
         FROM facts
        WHERE COALESCE(record_json::jsonb#>>'{payload,tenant_id}', record_json::jsonb#>>'{entity,tenant_id}', record_json::jsonb#>>'{scope,tenant_id}') = $1
          AND COALESCE(record_json::jsonb#>>'{payload,project_id}', record_json::jsonb#>>'{entity,project_id}', record_json::jsonb#>>'{scope,project_id}') = $2
          AND COALESCE(record_json::jsonb#>>'{payload,group_id}', record_json::jsonb#>>'{entity,group_id}', record_json::jsonb#>>'{scope,group_id}') = $3
          AND COALESCE(record_json::jsonb#>>'{payload,field_id}', record_json::jsonb#>>'{entity,field_id}', record_json::jsonb#>>'{scope,field_id}') = $4
          AND COALESCE(record_json::jsonb#>>'{payload,season_id}', record_json::jsonb#>>'{entity,season_id}', record_json::jsonb#>>'{scope,season_id}') = $5
          AND COALESCE(record_json::jsonb#>>'{payload,zone_id}', record_json::jsonb#>>'{entity,zone_id}', record_json::jsonb#>>'{scope,zone_id}') = $6
          AND (record_json::jsonb->>'type') = ANY($7::text[])
          AND occurred_at >= $8::timestamptz
          AND occurred_at <= $9::timestamptz
        ORDER BY occurred_at ASC, ingested_at ASC, fact_id ASC
        LIMIT $10`,
      [
        scope.tenant_id,
        scope.project_id,
        scope.group_id,
        scope.field_id,
        scope.season_id,
        scope.zone_id,
        [...this.config.allowed_fact_types],
        queryStart,
        queryEnd,
        this.config.max_candidate_records,
      ],
    );

    const boundaryMs = boundaryTime.getTime();
    const normalized = result.rows.map(normalizeRow);
    const selectedByIdentity = new Map<string, NormalizedEvidenceV1>();
    const excluded: ShadowOnlineEvidenceExclusionV1[] = [];

    for (const item of normalized) {
      const observedMs = Date.parse(item.candidate.observed_at);
      const ingestedMs = Date.parse(item.candidate.ingested_at);
      const availableMs = Date.parse(item.candidate.available_to_runtime_at);
      let reason: ShadowOnlineEvidenceExclusionReasonV1 | null = null;
      if (!sameScope(item.scope, scope)) reason = "SCOPE_MISMATCH";
      else if (item.future_assumption) reason = "FUTURE_EVIDENCE";
      else if (observedMs > boundaryMs) reason = "OBSERVED_AFTER_BOUNDARY";
      else if (ingestedMs > boundaryMs) reason = "INGESTED_AFTER_BOUNDARY";
      else if (availableMs > boundaryMs) reason = "AVAILABLE_AFTER_BOUNDARY";
      else if (this.config.quality_ineligible_statuses.includes(item.candidate.quality_status as never)) {
        reason = "QUALITY_INELIGIBLE";
      }
      if (reason) {
        excluded.push(exclusion(item, reason));
        continue;
      }
      const previous = selectedByIdentity.get(item.identity_key);
      if (!previous) {
        selectedByIdentity.set(item.identity_key, item);
        continue;
      }
      const previousOrder = compareCandidate(previous.candidate, item.candidate);
      if (previousOrder <= 0) {
        excluded.push(exclusion(previous, "DUPLICATE_SUPERSEDED"));
        selectedByIdentity.set(item.identity_key, item);
      } else {
        excluded.push(exclusion(item, "DUPLICATE_SUPERSEDED"));
      }
    }

    const selected = [...selectedByIdentity.values()].map((item) => item.candidate).sort(compareCandidate);
    excluded.sort((a, b) => compareCandidate(a, b) || a.reason.localeCompare(b.reason));
    if (selected.some((item) => Date.parse(item.observed_at) > boundaryMs || Date.parse(item.ingested_at) > boundaryMs || Date.parse(item.available_to_runtime_at) > boundaryMs)) {
      throw new Error("FUTURE_EVIDENCE_LEAKAGE_DETECTED");
    }

    const observed = selected.map((item) => Date.parse(item.observed_at)).sort((a, b) => a - b);
    const windowStartMs = boundaryMs - this.config.lookback_seconds * 1000;
    const gapPoints = observed.length > 0 ? [windowStartMs, ...observed, boundaryMs] : [];
    let maximumGapSeconds: number | null = null;
    if (gapPoints.length > 1) {
      maximumGapSeconds = 0;
      for (let index = 1; index < gapPoints.length; index += 1) {
        maximumGapSeconds = Math.max(maximumGapSeconds, Math.round((gapPoints[index] - gapPoints[index - 1]) / 1000));
      }
    }
    const freshestObservedAt = selected.length > 0 ? selected[selected.length - 1].observed_at : null;
    const freshnessStatus = freshestObservedAt === null
      ? "MISSING"
      : boundaryMs - Date.parse(freshestObservedAt) > this.config.stale_after_seconds * 1000
        ? "STALE"
        : "FRESH";

    return {
      boundary: input.boundary,
      selected,
      excluded,
      coverage_ratio_decimal: decimalRatio(selected.length, this.config.minimum_expected_observations),
      maximum_gap_seconds: maximumGapSeconds,
      freshest_observed_at: freshestObservedAt,
      freshness_status: freshnessStatus,
      future_evidence_leakage: false,
    };
  }
}
