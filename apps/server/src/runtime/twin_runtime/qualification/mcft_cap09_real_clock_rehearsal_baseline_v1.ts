import { createHash } from "node:crypto";
import type { Pool } from "pg";

import { semanticHashV1 } from "../../../domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../ports.js";

export const MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_ID_V1 =
  "MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_V1" as const;

const SOURCE = "mcft_cap09_external_formal_evidence_v1";
const HOUR_MS = 3_600_000;
const LIMITATIONS = [
  "QUALIFICATION_REHEARSAL_ONLY",
  "CONTROLLED_ENGINEERING_BASELINE",
  "NOT_FORMAL_EXTERNAL_EVIDENCE",
  "NOT_STAGE_1B_CLOSURE_EVIDENCE",
] as const;

type QueryPoolV1 = Pick<Pool, "query">;

function canonicalHourV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value || !canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}
function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}
function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}
function weatherPointsV1(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHoursV1(base, index),
    valid_to: addHoursV1(base, index + 1),
    precipitation_mm: Number((0.03 + ((index + seed) % 5) * 0.004).toFixed(6)),
  }));
}
function et0PointsV1(base: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHoursV1(base, index),
    valid_to: addHoursV1(base, index + 1),
    et0_mm_per_hour: Number((0.11 + ((index + seed) % 4) * 0.003).toFixed(6)),
  }));
}
function assumptionV1(input: {
  kind: "weather" | "et0";
  base: string;
  seed: number;
  chronology: string;
  dataset_id: string;
}): CanonicalReplayEvidenceRecordV1 {
  const bindingId = input.kind === "weather"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const recordType = input.kind === "weather"
    ? "future_weather_assumption_v1"
    : "future_et0_assumption_v1";
  const sourceId =
    `real_clock_rehearsal_${input.kind}_${input.base}_${input.seed}`;
  const payload = {
    snapshot_kind: input.kind === "weather"
      ? "FUTURE_WEATHER_ASSUMPTION"
      : "FUTURE_ET0_ASSUMPTION",
    points: input.kind === "weather"
      ? weatherPointsV1(input.base, input.seed)
      : et0PointsV1(input.base, input.seed),
  };
  return {
    dataset_id: input.dataset_id,
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({
      sourceId,
      bindingId,
      chronology: input.chronology,
      base: input.base,
      payload,
    }),
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: input.kind === "weather"
      ? "GFS_QUALIFICATION_REHEARSAL_BASELINE"
      : "ET0_QUALIFICATION_REHEARSAL_BASELINE",
    epistemic_class: "ASSUMED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: input.chronology,
    role_time: {
      issued_at: input.chronology,
      available_to_runtime_at: input.chronology,
      retrieved_at: input.chronology,
      ingested_at: input.chronology,
      valid_from: input.base,
      valid_to: addHoursV1(input.base, 72),
    },
    quality: { status: "PASS" },
    source_payload: structuredClone(payload),
    canonical_payload: payload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: {
      rule_id: input.kind === "weather"
        ? "PRECIPITATION_MM_IDENTITY_V1"
        : "ET0_MM_PER_HOUR_IDENTITY_V1",
      version: "1",
    },
    limitations: [...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function soilV1(input: {
  a0: string;
  chronology: string;
  dataset_id: string;
}): CanonicalReplayEvidenceRecordV1 {
  if (
    !(Date.parse(input.chronology) > Date.parse(input.a0) - HOUR_MS
      && Date.parse(input.chronology) < Date.parse(input.a0))
  ) {
    throw new Error("REAL_CLOCK_REHEARSAL_BASELINE_SOIL_CHRONOLOGY_OUTSIDE_A0_WINDOW");
  }
  const value = 0.31;
  const sourceId = `real_clock_rehearsal_soil_${input.a0}`;
  const canonicalPayload = {
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    unit: "fraction",
    value,
  };
  return {
    dataset_id: input.dataset_id,
    source_record_id: sourceId,
    source_record_hash: semanticHashV1({
      sourceId,
      chronology: input.chronology,
      canonicalPayload,
    }),
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: "SOIL_QUALIFICATION_REHEARSAL_BOOTSTRAP",
    epistemic_class: "OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at: input.chronology,
    role_time: {
      observed_at: input.chronology,
      available_to_runtime_at: input.chronology,
      retrieved_at: input.chronology,
      ingested_at: input.chronology,
    },
    quality: { status: "PASS" },
    source_payload: {
      source_version: "qualification-rehearsal-v1",
      unit: "fraction",
      value,
    },
    canonical_payload: canonicalPayload,
    source_unit: "fraction",
    canonical_unit: "fraction",
    conversion_rule: {
      id: "VWC_FRACTION_IDENTITY_V1",
      version: "1",
    },
    limitations: [...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function eventTimeV1(record: CanonicalReplayEvidenceRecordV1): string {
  return record.record_type === "soil_moisture_observation_v1"
    ? String(record.role_time?.observed_at)
    : String(record.role_time?.issued_at);
}
function factIdV1(record: CanonicalReplayEvidenceRecordV1): string {
  return "real_clock_rehearsal_" + createHash("sha256")
    .update(`${record.source_record_id}|${record.source_record_hash}`)
    .digest("hex");
}

export async function seedMcftCap09RealClockRehearsalBaselineV1(input: {
  pool: QueryPoolV1;
  a0: string;
  seeded_at: string;
}): Promise<{
  baseline_id: typeof MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_ID_V1;
  dataset_id: string;
  fact_count: 49;
  inserted_count: number;
  soil_count: 1;
  future_weather_count: 24;
  future_et0_count: 24;
  a0: string;
  r00: string;
  r23: string;
  seeded_at: string;
}> {
  const a0 = canonicalHourV1(
    input.a0,
    "REAL_CLOCK_REHEARSAL_BASELINE_A0_INVALID",
  );
  const seededAt = canonicalIsoV1(
    input.seeded_at,
    "REAL_CLOCK_REHEARSAL_BASELINE_SEEDED_AT_INVALID",
  );
  if (
    Date.parse(seededAt) <= Date.parse(a0) - HOUR_MS
    || Date.parse(seededAt) >= Date.parse(a0)
  ) {
    throw new Error("REAL_CLOCK_REHEARSAL_BASELINE_SEEDED_AT_MUST_BE_INSIDE_A0_WINDOW");
  }

  const datasetId =
    "mcft_cap09_real_clock_rehearsal_baseline_v1:" + a0;
  const records: CanonicalReplayEvidenceRecordV1[] = [
    soilV1({ a0, chronology: seededAt, dataset_id: datasetId }),
  ];
  for (let index = 0; index < 24; index += 1) {
    const base = addHoursV1(a0, index);
    records.push(
      assumptionV1({
        kind: "weather",
        base,
        seed: index + 1,
        chronology: seededAt,
        dataset_id: datasetId,
      }),
      assumptionV1({
        kind: "et0",
        base,
        seed: index + 1,
        chronology: seededAt,
        dataset_id: datasetId,
      }),
    );
  }
  if (records.length !== 49) {
    throw new Error("REAL_CLOCK_REHEARSAL_BASELINE_EXACT_49_RECORDS_REQUIRED");
  }

  let insertedCount = 0;
  for (const record of records) {
    const result = await input.pool.query(
      `INSERT INTO facts (fact_id,occurred_at,source,record_json)
       VALUES ($1,$2::timestamptz,$3,$4::jsonb)
       ON CONFLICT (fact_id) DO NOTHING`,
      [
        factIdV1(record),
        eventTimeV1(record),
        SOURCE,
        JSON.stringify({ type: record.record_type, payload: record }),
      ],
    );
    insertedCount += Number(result.rowCount ?? 0);
  }

  const rows = (await input.pool.query(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE record_json->>'type'='soil_moisture_observation_v1')::int AS soil,
       count(*) FILTER (WHERE record_json->>'type'='future_weather_assumption_v1')::int AS weather,
       count(*) FILTER (WHERE record_json->>'type'='future_et0_assumption_v1')::int AS et0,
       count(*) FILTER (
         WHERE NOT (record_json#>'{payload,limitations}') @> '["QUALIFICATION_REHEARSAL_ONLY"]'::jsonb
       )::int AS missing_rehearsal_marker
     FROM facts
     WHERE source=$1
       AND record_json#>>'{payload,dataset_id}'=$2`,
    [SOURCE, datasetId],
  )).rows[0] as {
    total: number;
    soil: number;
    weather: number;
    et0: number;
    missing_rehearsal_marker: number;
  } | undefined;

  if (
    Number(rows?.total ?? -1) !== 49
    || Number(rows?.soil ?? -1) !== 1
    || Number(rows?.weather ?? -1) !== 24
    || Number(rows?.et0 ?? -1) !== 24
    || Number(rows?.missing_rehearsal_marker ?? -1) !== 0
  ) {
    throw new Error(
      "REAL_CLOCK_REHEARSAL_BASELINE_READBACK_MISMATCH:"
      + JSON.stringify(rows ?? null),
    );
  }

  return {
    baseline_id: MCFT_CAP09_REAL_CLOCK_REHEARSAL_BASELINE_ID_V1,
    dataset_id: datasetId,
    fact_count: 49,
    inserted_count: insertedCount,
    soil_count: 1,
    future_weather_count: 24,
    future_et0_count: 24,
    a0,
    r00: addHoursV1(a0, 1),
    r23: addHoursV1(a0, 24),
    seeded_at: seededAt,
  };
}
