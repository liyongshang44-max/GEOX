// MCFT-CAP-09.S6 external governed Evidence ingress.
// Boundary: append-only writes to the five frozen Evidence fact types only.
// No Runtime object, projection, scheduler, route, Recommendation, Approval, AO-ACT,
// Dispatch, synthetic sensor truth, or Model Activation write is permitted.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { FORMAL_EVIDENCE_TYPES_V1, sameScopeV1 } from "./mcft_cap09_s6_formal_authority_v1.js";

const FORBIDDEN_TRUTH_MARKERS = /(?:synthetic|fixture|replay|demo|debug|simulat)/i;
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_FORMAL_EVIDENCE_INGRESS_RESULT.json");
const EVENT_FIELD: Record<string, "observed_at" | "interval_end" | "issued_at"> = {
  soil_moisture_observation_v1: "observed_at",
  observed_rainfall_v1: "interval_end",
  historical_et0_estimate_v1: "interval_end",
  future_weather_assumption_v1: "issued_at",
  future_et0_assumption_v1: "issued_at",
};
const EPISTEMIC_CLASS: Record<string, "OBSERVED" | "ESTIMATED" | "ASSUMED"> = {
  soil_moisture_observation_v1: "OBSERVED",
  observed_rainfall_v1: "OBSERVED",
  historical_et0_estimate_v1: "ESTIMATED",
  future_weather_assumption_v1: "ASSUMED",
  future_et0_assumption_v1: "ASSUMED",
};

type FormalEvidenceRecordV1 = CanonicalReplayEvidenceRecordV1 & {
  formal_eligible: true;
  is_simulated: false;
  evidence_level: "FORMAL";
  source_lane: "FORMAL_EXTERNAL_EVIDENCE";
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function json<T>(name: string): T {
  try { return JSON.parse(required(name)) as T; } catch { throw new Error(`${name}_JSON_INVALID`); }
}

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

function canonicalIso(value: unknown, code: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) throw new Error(code);
  return value;
}

function factIdV1(record: FormalEvidenceRecordV1): string {
  return `mcft_cap09_formal_evidence_${semanticHashV1({
    source_record_id: record.source_record_id,
    source_record_hash: record.source_record_hash,
  }).replace("sha256:", "").slice(0, 32)}`;
}

function validateRecordV1(record: FormalEvidenceRecordV1, scope: TwinScopeKeyV1): {
  eventTime: string;
  ingestedAt: string;
  availableAt: string;
} {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("FORMAL_EVIDENCE_OBJECT_REQUIRED");
  if (!(FORMAL_EVIDENCE_TYPES_V1 as readonly string[]).includes(record.record_type)) {
    throw new Error(`FORMAL_EVIDENCE_TYPE_FORBIDDEN:${record.record_type}`);
  }
  if (!sameScopeV1(record, scope)) throw new Error("FORMAL_EVIDENCE_SCOPE_MISMATCH");
  if (record.formal_eligible !== true || record.is_simulated !== false
    || record.evidence_level !== "FORMAL" || record.source_lane !== "FORMAL_EXTERNAL_EVIDENCE") {
    throw new Error("FORMAL_EVIDENCE_EXPLICIT_TRUST_MARKERS_REQUIRED");
  }
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED") {
    throw new Error("FORMAL_EVIDENCE_QUALITY_INELIGIBLE");
  }
  if (record.epistemic_class !== EPISTEMIC_CLASS[record.record_type]) {
    throw new Error("FORMAL_EVIDENCE_EPISTEMIC_CLASS_MISMATCH");
  }
  for (const value of [record.dataset_id, record.origin_source_kind, record.origin_source_id, ...(record.limitations ?? [])]) {
    if (typeof value !== "string" || !value || FORBIDDEN_TRUTH_MARKERS.test(value)) {
      throw new Error("FORMAL_EVIDENCE_SYNTHETIC_OR_REPLAY_MARKER_FORBIDDEN");
    }
  }
  for (const field of ["source_record_id", "source_record_hash", "binding_id", "source_unit", "canonical_unit"] as const) {
    if (typeof record[field] !== "string" || !record[field]) throw new Error(`FORMAL_EVIDENCE_${field.toUpperCase()}_REQUIRED`);
  }
  const eventField = EVENT_FIELD[record.record_type];
  const eventTime = canonicalIso(record.role_time?.[eventField], "FORMAL_EVIDENCE_ROLE_EVENT_TIME_INVALID");
  const ingestedAt = canonicalIso(record.role_time?.ingested_at, "FORMAL_EVIDENCE_INGESTED_AT_INVALID");
  const availableAt = canonicalIso(record.available_to_runtime_at, "FORMAL_EVIDENCE_AVAILABLE_AT_INVALID");
  if (Date.parse(ingestedAt) > Date.parse(availableAt)) throw new Error("FORMAL_EVIDENCE_AVAILABLE_BEFORE_INGESTION");
  const expectedHash = semanticHashV1({
    record_type: record.record_type,
    source_record_id: record.source_record_id,
    binding_id: record.binding_id,
    origin_source_id: record.origin_source_id,
    role_time: record.role_time,
    canonical_payload: record.canonical_payload,
  });
  if (record.source_record_hash !== expectedHash) throw new Error("FORMAL_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH");
  return { eventTime, ingestedAt, availableAt };
}

async function assertWriterBoundaryV1(pool: Pool): Promise<string> {
  const result = await pool.query(`SELECT current_user AS role,
    has_table_privilege(current_user,'facts','SELECT') AS facts_select,
    has_table_privilege(current_user,'facts','INSERT') AS facts_insert,
    has_table_privilege(current_user,'facts','UPDATE') AS facts_update,
    has_table_privilege(current_user,'facts','DELETE') AS facts_delete,
    (has_table_privilege(current_user,'twin_state_latest_index_v1','INSERT')
      OR has_table_privilege(current_user,'twin_state_latest_index_v1','UPDATE')
      OR has_table_privilege(current_user,'twin_state_latest_index_v1','DELETE')) AS state_write,
    (has_table_privilege(current_user,'twin_runtime_checkpoint_latest_index_v1','INSERT')
      OR has_table_privilege(current_user,'twin_runtime_checkpoint_latest_index_v1','UPDATE')
      OR has_table_privilege(current_user,'twin_runtime_checkpoint_latest_index_v1','DELETE')) AS checkpoint_write,
    (has_table_privilege(current_user,'twin_active_lineage_index_v1','INSERT')
      OR has_table_privilege(current_user,'twin_active_lineage_index_v1','UPDATE')
      OR has_table_privilege(current_user,'twin_active_lineage_index_v1','DELETE')) AS lineage_write`);
  const row = result.rows[0];
  assert(row?.facts_select === true && row?.facts_insert === true, "FORMAL_EVIDENCE_WRITER_FACTS_SELECT_INSERT_REQUIRED");
  assert(row.facts_update === false && row.facts_delete === false, "FORMAL_EVIDENCE_WRITER_FACTS_MUTATION_FORBIDDEN");
  assert(row.state_write === false && row.checkpoint_write === false && row.lineage_write === false,
    "FORMAL_EVIDENCE_WRITER_RUNTIME_AUTHORITY_FORBIDDEN");
  return String(row.role);
}

async function main(): Promise<void> {
  const databaseUrl = required("MCFT_CAP09_S6_EVIDENCE_DATABASE_URL");
  const scope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  const input = json<FormalEvidenceRecordV1 | FormalEvidenceRecordV1[]>("MCFT_CAP09_S6_FORMAL_EVIDENCE_JSON");
  const records = Array.isArray(input) ? input : [input];
  if (!records.length || records.length > 1000) throw new Error("FORMAL_EVIDENCE_BATCH_CARDINALITY_INVALID");
  const pool = new Pool({ connectionString: databaseUrl, application_name: "mcft-cap09-s6-formal-evidence-writer" });
  try {
    const role = await assertWriterBoundaryV1(pool);
    const normalized = records.map((record) => ({ record, ...validateRecordV1(record, scope) }));
    const client = await pool.connect();
    let inserted = 0;
    let idempotent = 0;
    try {
      await client.query("BEGIN");
      const databaseNow = new Date((await client.query("SELECT transaction_timestamp() AS now")).rows[0].now).getTime();
      for (const item of normalized) {
        for (const instant of [item.eventTime, item.ingestedAt, item.availableAt]) {
          if (Date.parse(instant) > databaseNow + 300_000) {
            throw new Error("FORMAL_EVIDENCE_FUTURE_DATED_AT_INGRESS");
          }
        }
        if (databaseNow - Date.parse(item.ingestedAt) > 900_000
          || databaseNow - Date.parse(item.availableAt) > 900_000) {
          throw new Error("FORMAL_EVIDENCE_INGRESS_TIME_NOT_CONTEMPORANEOUS");
        }
        const factId = factIdV1(item.record);
        const wrapper = { type: item.record.record_type, payload: item.record };
        const result = await client.query(
          `INSERT INTO facts (fact_id,occurred_at,source,record_json)
           VALUES ($1,$2::timestamptz,'mcft_cap09_formal_external_evidence_v1',$3::jsonb)
           ON CONFLICT (fact_id) DO NOTHING RETURNING fact_id`,
          [factId, item.eventTime, JSON.stringify(wrapper)],
        );
        if (result.rows.length === 1) inserted += 1;
        else {
          const existing = await client.query(
            "SELECT occurred_at,source,record_json=$2::jsonb AS payload_equal FROM facts WHERE fact_id=$1",
            [factId, JSON.stringify(wrapper)],
          );
          if (existing.rows.length !== 1
            || new Date(existing.rows[0].occurred_at).toISOString() !== item.eventTime
            || existing.rows[0].source !== "mcft_cap09_formal_external_evidence_v1"
            || existing.rows[0].payload_equal !== true) {
            throw new Error(`FORMAL_EVIDENCE_IDEMPOTENCY_CONFLICT:${factId}`);
          }
          idempotent += 1;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    write({
      schema_version: "geox_mcft_cap09_s6_formal_evidence_ingress_result_v1",
      status: "PASS",
      writer_role: role,
      record_count: records.length,
      inserted_count: inserted,
      idempotent_count: idempotent,
      record_types: [...new Set(records.map((record) => record.record_type))].sort(),
      runtime_authority_write_count: 0,
      formal_effectiveness: false,
    });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  write({
    schema_version: "geox_mcft_cap09_s6_formal_evidence_ingress_result_v1",
    status: "FAIL",
    error: String(error instanceof Error ? error.message : error),
    runtime_authority_write_count: 0,
    formal_effectiveness: false,
  });
  process.exitCode = 1;
});
