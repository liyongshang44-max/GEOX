import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

import { appendRawSampleV1 } from "./raw_sample_fact_envelope_v1.js";
import {
  RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1,
  RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1,
  appendRawSampleRuntimeAvailabilityMarkerV1,
  rawSampleRuntimeAvailabilityFactIdV1,
} from "./raw_sample_runtime_availability_v1.js";

const databaseUrl = process.env.B04D4A_DATABASE_URL;

test("B-04d4a PostgreSQL proves committed raw row before visibility witness is persisted", {
  skip: !databaseUrl,
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl!, max: 1 });
  try {
    await pool.query(`
      DROP TABLE IF EXISTS facts;
      DROP TABLE IF EXISTS raw_samples;

      CREATE TABLE raw_samples (
        sample_id text PRIMARY KEY,
        sensor_id text NOT NULL,
        ts_ms bigint NOT NULL,
        metric text NOT NULL,
        value double precision NOT NULL,
        qc_quality text NOT NULL DEFAULT 'unknown',
        source text NOT NULL DEFAULT 'device',
        payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE facts (
        fact_id text PRIMARY KEY,
        occurred_at timestamptz NOT NULL,
        source text NOT NULL,
        record_json jsonb NOT NULL
      );
    `);

    const sampleId = "rs_b04d4a_pg_001";
    const item = await appendRawSampleV1(
      pool,
      {
        sample_id: sampleId,
        sensor_id: "dev_001",
        field_id: "fieldA",
        ts_ms: Date.parse("2026-08-27T05:00:00Z"),
        metric: "soil_moisture",
        value: 0.22,
        unit: "m3/m3",
        qc_quality: "ok",
        source: "device",
        payload: {},
      },
      { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA" },
    );
    assert.equal(item.sample_id, sampleId);

    const raw = await pool.query(
      "SELECT sample_id, created_at FROM raw_samples WHERE sample_id = $1",
      [sampleId],
    );
    assert.equal(raw.rowCount, 1);

    const markerFactId = rawSampleRuntimeAvailabilityFactIdV1(sampleId);
    const marker = await pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE fact_id = $1`,
      [markerFactId],
    );
    assert.equal(marker.rowCount, 1);

    const row = marker.rows[0];
    assert.equal(row.source, RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1);
    assert.equal(row.record_json.type, RAW_SAMPLE_RUNTIME_AVAILABILITY_FACT_TYPE_V1);
    assert.equal(row.record_json.sample_id, sampleId);
    assert.equal(row.record_json.raw_sample_fact_id, `raw_sample:${sampleId}`);
    assert.equal(row.record_json.visibility_proof, RAW_SAMPLE_RUNTIME_AVAILABILITY_PROOF_V1);
    assert.deepEqual(row.record_json.scope, {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: "fieldA",
      sensor_id: "dev_001",
    });

    const markerOccurredAt = new Date(row.occurred_at).getTime();
    const markerJsonAt = Date.parse(String(row.record_json.available_to_runtime_at));
    const rawCreatedAt = new Date(raw.rows[0].created_at).getTime();

    assert.ok(Number.isFinite(markerOccurredAt));
    assert.equal(markerJsonAt, markerOccurredAt);
    assert.ok(markerOccurredAt >= rawCreatedAt, "post-COMMIT witness cannot precede raw row creation");

    const retry = await appendRawSampleRuntimeAvailabilityMarkerV1(
      pool,
      {
        sample_id: sampleId,
        raw_sample_fact_id: `raw_sample:${sampleId}`,
        tenant_id: "tenantA",
        project_id: "projectA",
        group_id: "groupA",
        field_id: "fieldA",
        sensor_id: "dev_001",
      },
    );
    assert.equal(retry.recorded, false, "deterministic marker identity must not append a second fact");

    const markerAfterRetry = await pool.query(
      "SELECT count(*)::int AS count, min(occurred_at) AS occurred_at FROM facts WHERE fact_id = $1",
      [markerFactId],
    );
    assert.equal(markerAfterRetry.rows[0].count, 1);
    assert.equal(new Date(markerAfterRetry.rows[0].occurred_at).getTime(), markerOccurredAt);

    const rawFact = await pool.query(
      "SELECT fact_id FROM facts WHERE fact_id = $1",
      [`raw_sample:${sampleId}`],
    );
    assert.equal(rawFact.rowCount, 1, "existing raw source fact remains retained");
  } finally {
    await pool.end();
  }
});
