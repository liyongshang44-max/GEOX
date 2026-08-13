// MCFT-CAP-09 S6-EA5E2 / Amendment-11: External-only read-only database Evidence source.
// Boundary: reads canonical External Formal Evidence from facts only. It does not fetch providers,
// select Runtime Config, claim scheduler work, mutate Replay semantics, or write DB/R2/canonical Runtime.
// Soil and both Future Forcing families remain causally frozen at logical T. Only the exact-hour
// Rainfall/Historical ET0 pair may use the actual execution evidence snapshot time.

import type { Pool, PoolClient } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "./ports.js";

export const MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_V1" as const;
export const MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_LOOKBACK_HOURS_V1 = 36 as const;

const ALLOWED_RECORD_TYPES_V1 = [
  "soil_moisture_observation_v1",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;

type AllowedRecordTypeV1 = typeof ALLOWED_RECORD_TYPES_V1[number];
type EvidenceAuthorityV1 = {
  binding_id: string;
  epistemic_class: "OBSERVED" | "ESTIMATED" | "ASSUMED";
  event_time_field: "observed_at" | "interval_end" | "issued_at";
  family: "soil" | "rainfall" | "historical_et0" | "future_weather" | "future_et0";
};

const AUTHORITY_BY_RECORD_TYPE_V1: Readonly<Record<AllowedRecordTypeV1, EvidenceAuthorityV1>> = {
  soil_moisture_observation_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    event_time_field: "observed_at",
    family: "soil",
  },
  observed_rainfall_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
    epistemic_class: "OBSERVED",
    event_time_field: "interval_end",
    family: "rainfall",
  },
  historical_et0_estimate_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
    epistemic_class: "ESTIMATED",
    event_time_field: "interval_end",
    family: "historical_et0",
  },
  future_weather_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
    family: "future_weather",
  },
  future_et0_assumption_v1: {
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
    epistemic_class: "ASSUMED",
    event_time_field: "issued_at",
    family: "future_et0",
  },
};

export type ExternalFormalDatabaseEvidenceLoadResultV1 = {
  source_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_ID_V1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  evidence_snapshot_time: string;
  /** @deprecated Amendment-11: transport compatibility only; value equals evidence_snapshot_time. */
  exact_interval_availability_cutoff_time: string;
  records: readonly CanonicalReplayEvidenceRecordV1[];
  selected_record_count: number;
  family_cardinality: {
    soil: number;
    rainfall: number;
    historical_et0: number;
    future_weather: number;
    future_et0: number;
  };
  excluded_after_causal_cutoff_count: number;
  excluded_non_target_exact_interval_count: number;
  database_read_transaction_count: 1;
  database_write_count: 0;
  provider_request_count: 0;
};

type EvidenceFactRowV1 = { fact_id: string; occurred_at: string | Date; record_json: unknown };
type ReadOnlyPoolV1 = Pick<Pool, "connect">;
type ReadOnlyClientV1 = Pick<PoolClient, "query" | "release">;

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function objectV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function scopeFromRecordV1(record: CanonicalReplayEvidenceRecordV1): TwinScopeKeyV1 {
  return {
    tenant_id: record.tenant_id,
    project_id: record.project_id,
    group_id: record.group_id,
    field_id: record.field_id,
    season_id: record.season_id,
    zone_id: record.zone_id,
  };
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function parseRowV1(row: EvidenceFactRowV1): CanonicalReplayEvidenceRecordV1 {
  const envelope = typeof row.record_json === "string"
    ? objectV1(JSON.parse(row.record_json), "EA5E2_EXTERNAL_DB_ENVELOPE_INVALID")
    : objectV1(row.record_json, "EA5E2_EXTERNAL_DB_ENVELOPE_INVALID");
  const wrapperType = requiredTextV1(envelope.type, "EA5E2_EXTERNAL_DB_WRAPPER_TYPE_REQUIRED");
  const payload = objectV1(envelope.payload, "EA5E2_EXTERNAL_DB_PAYLOAD_REQUIRED") as unknown as CanonicalReplayEvidenceRecordV1;
  if (payload.record_type !== wrapperType) throw new Error(`EA5E2_EXTERNAL_DB_WRAPPER_TYPE_MISMATCH:${row.fact_id}`);
  if (!(ALLOWED_RECORD_TYPES_V1 as readonly string[]).includes(payload.record_type)) {
    throw new Error(`EA5E2_EXTERNAL_DB_RECORD_TYPE_NOT_ALLOWED:${payload.record_type}`);
  }
  return structuredClone(payload);
}

function authorityForV1(record: CanonicalReplayEvidenceRecordV1): EvidenceAuthorityV1 {
  return AUTHORITY_BY_RECORD_TYPE_V1[record.record_type as AllowedRecordTypeV1];
}

function eventTimeV1(record: CanonicalReplayEvidenceRecordV1, authority: EvidenceAuthorityV1): string {
  return canonicalIsoV1(record.role_time?.[authority.event_time_field], `EA5E2_EXTERNAL_DB_EVENT_TIME_INVALID:${record.record_type}`);
}

function validateStaticAuthorityV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): EvidenceAuthorityV1 {
  exactScopeV1(scopeFromRecordV1(record), scope, `EA5E2_EXTERNAL_DB_SCOPE_MISMATCH:${record.record_type}`);
  const authority = authorityForV1(record);
  if (!authority) throw new Error(`EA5E2_EXTERNAL_DB_RECORD_TYPE_NOT_ALLOWED:${record.record_type}`);
  if (record.binding_id !== authority.binding_id) throw new Error(`EA5E2_EXTERNAL_DB_BINDING_MISMATCH:${record.record_type}`);
  if (record.epistemic_class !== authority.epistemic_class) throw new Error(`EA5E2_EXTERNAL_DB_EPISTEMIC_MISMATCH:${record.record_type}`);
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED") {
    throw new Error(`EA5E2_EXTERNAL_DB_QUALITY_NOT_ELIGIBLE:${record.record_type}`);
  }
  requiredTextV1(record.source_record_id, `EA5E2_EXTERNAL_DB_SOURCE_RECORD_ID_REQUIRED:${record.record_type}`);
  requiredTextV1(record.source_record_hash, `EA5E2_EXTERNAL_DB_SOURCE_RECORD_HASH_REQUIRED:${record.record_type}`);
  return authority;
}

function targetExactIntervalV1(record: CanonicalReplayEvidenceRecordV1, logicalTime: string): boolean {
  const start = canonicalIsoV1(record.role_time?.interval_start, `EA5E2_EXTERNAL_DB_INTERVAL_START_INVALID:${record.record_type}`);
  const end = canonicalIsoV1(record.role_time?.interval_end, `EA5E2_EXTERNAL_DB_INTERVAL_END_INVALID:${record.record_type}`);
  return start === addMinutesV1(logicalTime, -60) && end === logicalTime;
}

function recordSortV1(left: CanonicalReplayEvidenceRecordV1, right: CanonicalReplayEvidenceRecordV1): number {
  return left.record_type.localeCompare(right.record_type)
    || String(left.source_record_id).localeCompare(String(right.source_record_id))
    || String(left.source_record_hash).localeCompare(String(right.source_record_hash));
}

export class PostgresExternalFormalEvidenceSourceV1 {
  constructor(
    private readonly pool: ReadOnlyPoolV1,
    private readonly maxCandidateRecords = 1000,
  ) {
    if (!Number.isSafeInteger(maxCandidateRecords) || maxCandidateRecords < 5) {
      throw new Error("EA5E2_EXTERNAL_DB_MAX_CANDIDATES_INVALID");
    }
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
    evidence_snapshot_time?: string;
    /** @deprecated Amendment-11: accepted only as a transport alias for evidence_snapshot_time. */
    exact_interval_availability_cutoff_time?: string;
  }): Promise<ExternalFormalDatabaseEvidenceLoadResultV1> {
    const logicalTime = canonicalHourV1(input.logical_time, "EA5E2_EXTERNAL_DB_LOGICAL_TIME_INVALID");
    exactScopeV1(input.scope, { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 }, "EA5E2_EXTERNAL_DB_FORMAL_SCOPE_REQUIRED");

    const snapshotInput = input.evidence_snapshot_time ?? input.exact_interval_availability_cutoff_time;
    const evidenceSnapshotTime = canonicalIsoV1(snapshotInput, "EA5E2_EXTERNAL_DB_EVIDENCE_SNAPSHOT_TIME_REQUIRED");
    if (input.evidence_snapshot_time !== undefined && input.exact_interval_availability_cutoff_time !== undefined) {
      const legacy = canonicalIsoV1(input.exact_interval_availability_cutoff_time, "EA5E2_EXTERNAL_DB_LEGACY_CUTOFF_INVALID");
      if (legacy !== evidenceSnapshotTime) throw new Error("EA5E2_EXTERNAL_DB_EVIDENCE_SNAPSHOT_ALIAS_MISMATCH");
    }
    if (Date.parse(evidenceSnapshotTime) < Date.parse(logicalTime)) {
      throw new Error("EA5E2_EXTERNAL_DB_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME");
    }

    const queryStart = addMinutesV1(logicalTime, -MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_LOOKBACK_HOURS_V1 * 60);
    const client = await this.pool.connect() as ReadOnlyClientV1;
    let rows: EvidenceFactRowV1[];
    try {
      await client.query("BEGIN TRANSACTION READ ONLY");
      const result = await client.query(
        `SELECT fact_id,occurred_at,record_json
           FROM facts
          WHERE record_json#>>'{payload,tenant_id}'=$1
            AND record_json#>>'{payload,project_id}'=$2
            AND record_json#>>'{payload,group_id}'=$3
            AND record_json#>>'{payload,field_id}'=$4
            AND record_json#>>'{payload,season_id}'=$5
            AND record_json#>>'{payload,zone_id}'=$6
            AND record_json->>'type'=ANY($7::text[])
            AND occurred_at>$8::timestamptz
            AND occurred_at<=$9::timestamptz
          ORDER BY occurred_at ASC,fact_id ASC
          LIMIT $10`,
        [
          input.scope.tenant_id,
          input.scope.project_id,
          input.scope.group_id,
          input.scope.field_id,
          input.scope.season_id,
          input.scope.zone_id,
          [...ALLOWED_RECORD_TYPES_V1],
          queryStart,
          logicalTime,
          this.maxCandidateRecords + 1,
        ],
      );
      rows = result.rows as EvidenceFactRowV1[];
      await client.query("COMMIT");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original read failure */ }
      throw error;
    } finally {
      client.release();
    }

    if (rows.length > this.maxCandidateRecords) throw new Error("EA5E2_EXTERNAL_DB_CANDIDATE_LIMIT_REACHED");

    const selected: CanonicalReplayEvidenceRecordV1[] = [];
    const identities = new Map<string, string>();
    let excludedAfterCutoff = 0;
    let excludedNonTargetExactInterval = 0;

    for (const row of rows) {
      const record = parseRowV1(row);
      const authority = validateStaticAuthorityV1(record, input.scope);
      const eventTime = eventTimeV1(record, authority);
      if (Date.parse(eventTime) > Date.parse(logicalTime)) {
        throw new Error(`EA5E2_EXTERNAL_DB_FUTURE_EVENT_FORBIDDEN:${record.record_type}`);
      }
      const ingestedAt = canonicalIsoV1(record.role_time?.ingested_at, `EA5E2_EXTERNAL_DB_INGESTED_AT_INVALID:${record.record_type}`);
      const availableAt = canonicalIsoV1(record.available_to_runtime_at, `EA5E2_EXTERNAL_DB_AVAILABLE_AT_INVALID:${record.record_type}`);
      if (Date.parse(eventTime) > Date.parse(availableAt) || Date.parse(availableAt) > Date.parse(ingestedAt)) {
        throw new Error(`EA5E2_EXTERNAL_DB_CAUSAL_ORDER_INVALID:${record.record_type}`);
      }

      const exactIntervalRole = record.record_type === "observed_rainfall_v1"
        || record.record_type === "historical_et0_estimate_v1";
      if (exactIntervalRole && !targetExactIntervalV1(record, logicalTime)) {
        excludedNonTargetExactInterval += 1;
        continue;
      }

      // Amendment-11 role-specific availability watermark:
      // pre-boundary causal families remain <= T; only delayed exact interval families use the actual snapshot.
      const availabilityCutoff = exactIntervalRole ? evidenceSnapshotTime : logicalTime;
      if (Date.parse(availableAt) > Date.parse(availabilityCutoff)
        || Date.parse(ingestedAt) > Date.parse(availabilityCutoff)) {
        excludedAfterCutoff += 1;
        continue;
      }

      const previousHash = identities.get(record.source_record_id);
      if (previousHash !== undefined) {
        if (previousHash !== record.source_record_hash) {
          throw new Error(`EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT:${record.source_record_id}`);
        }
        throw new Error(`EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID:${record.source_record_id}`);
      }
      identities.set(record.source_record_id, record.source_record_hash);
      selected.push(record);
    }

    selected.sort(recordSortV1);
    const family = { soil: 0, rainfall: 0, historical_et0: 0, future_weather: 0, future_et0: 0 };
    for (const record of selected) family[authorityForV1(record).family] += 1;
    for (const key of ["soil", "rainfall", "historical_et0", "future_weather", "future_et0"] as const) {
      if (family[key] < 1) throw new Error(`EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING:${key}`);
    }

    return {
      source_id: MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_ID_V1,
      scope: structuredClone(input.scope),
      logical_time: logicalTime,
      evidence_snapshot_time: evidenceSnapshotTime,
      exact_interval_availability_cutoff_time: evidenceSnapshotTime,
      records: selected.map((record) => structuredClone(record)),
      selected_record_count: selected.length,
      family_cardinality: family,
      excluded_after_causal_cutoff_count: excludedAfterCutoff,
      excluded_non_target_exact_interval_count: excludedNonTargetExactInterval,
      database_read_transaction_count: 1,
      database_write_count: 0,
      provider_request_count: 0,
    };
  }
}
