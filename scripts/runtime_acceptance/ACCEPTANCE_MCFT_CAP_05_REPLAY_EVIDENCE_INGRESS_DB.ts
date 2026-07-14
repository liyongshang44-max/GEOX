// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_EVIDENCE_INGRESS_DB.ts
// Purpose: prove that the S1 controlled feedback dataset can be persisted through the existing append-only facts ingress with deterministic Evidence identity, idempotent replay, conflict rejection, and exact readback.
// Boundary: destructive isolated-database acceptance only; no CAP-05 canonical Decision, Action Feedback, Forecast Residual, State, checkpoint, migration, route, web, AO-ACT, or scheduler write.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const POSITIVE_FILES = [
  "decision_requests.jsonl",
  "approval_assertions.jsonl",
  "approved_plans.jsonl",
  "external_dispatch.jsonl",
  "execution_receipts.jsonl",
  "soil_observations.jsonl",
  "rainfall_context.jsonl",
  "et0_context.jsonl",
] as const;
const SOURCE = "mcft_cap05_replay_evidence_v1";
const EXPECTED_RECORD_COUNT = 8;

type ReplayEvidenceRecordV1 = {
  dataset_id: string;
  source_record_id: string;
  source_record_hash: string;
  record_type: string;
  evidence_identity_key: string;
  idempotency_key: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  [key: string]: unknown;
};

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJsonl(filePath: string): ReplayEvidenceRecordV1[] {
  const text = fs.readFileSync(filePath, "utf8");
  assert.ok(text.endsWith("\n"), `JSONL_TRAILING_NEWLINE_REQUIRED:${filePath}`);
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ReplayEvidenceRecordV1);
}

function factId(record: ReplayEvidenceRecordV1): string {
  const digest = crypto.createHash("sha256").update(record.evidence_identity_key, "utf8").digest("hex").slice(0, 32);
  return `fact_mcft05_evidence_${digest}`;
}

function recordJson(record: ReplayEvidenceRecordV1): Record<string, unknown> {
  return { type: record.record_type, payload: record };
}

async function initialize(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
}

async function persistEvidence(client: PoolClient, record: ReplayEvidenceRecordV1): Promise<"INSERTED" | "EXISTING"> {
  const id = factId(record);
  const existing = await client.query("SELECT record_json FROM facts WHERE fact_id=$1", [id]);
  if (existing.rows.length > 1) throw new Error(`EVIDENCE_IDENTITY_CARDINALITY:${id}`);
  if (existing.rows.length === 1) {
    const payload = existing.rows[0].record_json?.payload as ReplayEvidenceRecordV1 | undefined;
    if (!payload || payload.evidence_identity_key !== record.evidence_identity_key) throw new Error(`EVIDENCE_IDENTITY_CORRUPTION:${id}`);
    if (payload.source_record_hash !== record.source_record_hash) throw new Error(`EVIDENCE_IDENTITY_CONFLICT:${record.evidence_identity_key}`);
    return "EXISTING";
  }
  await client.query(
    "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
    [id, record.available_to_runtime_at, SOURCE, JSON.stringify(recordJson(record))],
  );
  return "INSERTED";
}

async function persistBatch(pool: Pool, records: ReplayEvidenceRecordV1[]): Promise<Array<"INSERTED" | "EXISTING">> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [] as Array<"INSERTED" | "EXISTING">;
    for (const record of records) results.push(await persistEvidence(client, record));
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_05_S1_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S1_DESTRUCTIVE_ACCEPTANCE_1");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!/(mcft|cap.*05|s1|feedback|acceptance|test)/i.test(databaseName)) throw new Error(`ISOLATED_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);

  const records = POSITIVE_FILES.flatMap((file) => readJsonl(path.join(FIXTURE_ROOT, file)));
  assert.equal(records.length, EXPECTED_RECORD_COUNT, "S1_POSITIVE_RECORD_COUNT");
  assert.equal(new Set(records.map((record) => record.evidence_identity_key)).size, EXPECTED_RECORD_COUNT, "EVIDENCE_IDENTITIES_UNIQUE");
  assert.equal(new Set(records.map((record) => record.idempotency_key)).size, EXPECTED_RECORD_COUNT, "IDEMPOTENCY_KEYS_UNIQUE");
  assert.equal(records.some((record) => ["twin_decision_record_v1", "twin_action_feedback_v1", "twin_forecast_residual_v1"].includes(record.record_type)), false, "CANONICAL_C_G_H_OBJECTS_FORBIDDEN_IN_S1");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await initialize(pool);
    const first = await persistBatch(pool, records);
    assert.deepEqual(first, Array(EXPECTED_RECORD_COUNT).fill("INSERTED"), "FIRST_INGRESS_MUST_INSERT");
    console.log("PASS first Replay Evidence ingress inserted 8 facts");

    const second = await persistBatch(pool, records);
    assert.deepEqual(second, Array(EXPECTED_RECORD_COUNT).fill("EXISTING"), "SECOND_INGRESS_MUST_BE_IDEMPOTENT");
    console.log("PASS repeated Replay Evidence ingress returned existing success");

    const count = await pool.query("SELECT count(*)::int AS count FROM facts WHERE source=$1", [SOURCE]);
    assert.equal(count.rows[0].count, EXPECTED_RECORD_COUNT, "FACT_COUNT_AFTER_IDEMPOTENT_REPLAY");
    console.log("PASS append-only facts count remains 8");

    const readback = await pool.query("SELECT fact_id,occurred_at,record_json FROM facts WHERE source=$1 ORDER BY fact_id", [SOURCE]);
    assert.equal(readback.rows.length, EXPECTED_RECORD_COUNT, "READBACK_COUNT");
    for (const row of readback.rows) {
      const payload = row.record_json.payload as ReplayEvidenceRecordV1;
      const source = records.find((record) => record.evidence_identity_key === payload.evidence_identity_key);
      assert.ok(source, `READBACK_IDENTITY_NOT_FOUND:${payload.evidence_identity_key}`);
      assert.equal(payload.source_record_hash, source.source_record_hash, `READBACK_HASH_MISMATCH:${payload.source_record_id}`);
      assert.equal(new Date(row.occurred_at).toISOString(), source.available_to_runtime_at, `READBACK_AVAILABILITY_MISMATCH:${payload.source_record_id}`);
    }
    console.log("PASS exact Evidence identity, hash, and availability readback");

    const conflicting = structuredClone(records.find((record) => record.record_type === "irrigation_execution_receipt_evidence_v1"));
    assert.ok(conflicting, "RECEIPT_REQUIRED");
    conflicting.source_record_hash = "sha256:conflicting_duplicate";
    await assert.rejects(() => persistBatch(pool, [conflicting]), /EVIDENCE_IDENTITY_CONFLICT/);
    const afterConflict = await pool.query("SELECT count(*)::int AS count FROM facts WHERE source=$1", [SOURCE]);
    assert.equal(afterConflict.rows[0].count, EXPECTED_RECORD_COUNT, "CONFLICT_MUST_NOT_APPEND");
    console.log("PASS same Evidence identity with different semantic hash conflicts atomically");

    const typeCounts = await pool.query("SELECT record_json->>'type' AS type,count(*)::int AS count FROM facts WHERE source=$1 GROUP BY record_json->>'type' ORDER BY type", [SOURCE]);
    assert.equal(typeCounts.rows.length, EXPECTED_RECORD_COUNT, "ONE_RECORD_PER_S1_ROLE");
    console.log("PASS all eight S1 Replay Evidence roles persisted");
    console.log("MCFT-CAP-05 S1 PostgreSQL ingress: 7 PASS, 0 FAIL");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
