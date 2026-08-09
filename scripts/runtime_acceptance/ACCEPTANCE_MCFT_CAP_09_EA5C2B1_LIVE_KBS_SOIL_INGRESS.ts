import assert from "node:assert/strict";
import fs from "node:fs";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  executeFormalLiveKbsSoilIngressV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";

const OUT = "acceptance-output/MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_RESULT.json";
const DATABASE_URL = process.env.EA5C2B1_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/ea5c2b1";
const S3_ENDPOINT = process.env.EA5C2B1_S3_ENDPOINT ?? "http://127.0.0.1:9000";
const S3_BUCKET = process.env.EA5C2B1_S3_BUCKET ?? "geox-mcft-cap09-formal-raw-v1";
const S3_ACCESS_KEY = process.env.EA5C2B1_S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.EA5C2B1_S3_SECRET_KEY ?? "minioadmin123";

function object(value: unknown): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facts (
        fact_id TEXT PRIMARY KEY,
        occurred_at TIMESTAMPTZ NOT NULL,
        source TEXT NOT NULL,
        record_json JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS facts_occurred_at_idx ON facts (occurred_at DESC);
      CREATE INDEX IF NOT EXISTS facts_record_json_idx ON facts USING GIN (record_json);
    `);
    await pool.query("TRUNCATE facts");

    const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
      endpoint: S3_ENDPOINT,
      bucket: S3_BUCKET,
      region: "us-east-1",
      access_key_id: S3_ACCESS_KEY,
      secret_access_key: S3_SECRET_KEY,
      allow_insecure_http_for_test: true,
    });

    const proof = await executeFormalLiveKbsSoilIngressV1({ pool, retention });
    assert.equal(proof.status, "INSERTED");
    assert.equal(proof.canonical_fact_write_count, 1);
    assert.equal(proof.record_type, "soil_moisture_observation_v1");
    assert.equal(proof.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
    assert.equal(proof.raw_value_emitted, false);
    assert.equal(proof.runtime_public_provider_fetch_count, 0);
    assert.match(proof.raw_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.ok(proof.raw_bytes > 0);
    assert.ok(proof.retention_ref.startsWith(`s3-private://${S3_BUCKET}/mcft-cap09-formal-raw-v1/sha256/`));

    await retention.verifyRetainedRawEvidence({
      retention_ref: proof.retention_ref,
      retained_sha256: proof.raw_sha256,
      retained_bytes: proof.raw_bytes,
    });

    const facts = await pool.query(
      "SELECT fact_id,source,record_json FROM facts ORDER BY fact_id",
    );
    assert.equal(facts.rows.length, 1);
    assert.equal(facts.rows[0].fact_id, proof.fact_id);
    assert.equal(facts.rows[0].source, "mcft_cap09_external_formal_evidence_v1");
    const envelope = object(facts.rows[0].record_json);
    assert.equal(envelope.type, "soil_moisture_observation_v1");
    const record = object(envelope.payload);
    for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
      assert.equal(record[key], expected);
    }
    assert.equal(record.record_type, "soil_moisture_observation_v1");
    assert.equal(record.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
    assert.equal(record.epistemic_class, "OBSERVED");
    assert.equal(record.origin_source_id, "KBS_LTER_CURRENT_WEATHER_VARIATE_25");
    assert.equal(record.source_unit, "fraction");
    assert.equal(record.canonical_unit, "fraction");
    assert.equal(object(record.quality).status, "PASS");
    const sourcePayload = object(record.source_payload);
    assert.equal(sourcePayload.unit, "fraction");
    assert.equal(sourcePayload.source_version, "KBS_CURRENT_WEATHER_VARIATE_25_V1");
    const raw = object(sourcePayload.raw_provenance);
    assert.equal(raw.retention_ref, proof.retention_ref);
    assert.equal(raw.raw_sha256, proof.raw_sha256);
    assert.equal(raw.raw_bytes, proof.raw_bytes);
    assert.equal(raw.raw_payload_embedded, false);
    const canonical = object(record.canonical_payload);
    assert.equal(canonical.quantity_kind, "VOLUMETRIC_WATER_CONTENT");
    assert.equal(canonical.unit, "fraction");
    assert.equal(canonical.measurement_depth_mm, 100);
    assert.equal(canonical.spatial_support, "NEAR_SITE_POINT_SUPPORT");
    assert.equal(canonical.direct_field_equivalence, false);
    assert.equal(canonical.direct_root_zone_equivalence, false);
    assert.equal(canonical.root_zone_representativeness, "PARTIAL");
    assert.equal(typeof canonical.value, "number");
    assert.ok(Number.isFinite(canonical.value));
    assert.ok(Number(canonical.value) >= 0 && Number(canonical.value) <= 1);

    const canonicalText = JSON.stringify(record);
    for (const marker of [
      "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
      "CONTROLLED_REPLAY",
      '"runtime_mode":"REPLAY"',
      "field_c8_demo",
      "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    ]) assert.equal(canonicalText.includes(marker), false, marker);

    const publicResult = {
      schema_version: "geox_mcft_cap09_ea5c2b1_live_kbs_soil_ingress_result_v1",
      status: "PASS",
      live_public_source_fetch_proved: true,
      ea3_retention_before_decode_pipeline_used: true,
      live_kbs_soil_continuity_and_value_range_passed: true,
      private_raw_retention_reverified_before_fact_ingress: true,
      restricted_ea5c1_facts_ingress_used: true,
      exact_external_scope_fact_count: 1,
      fact_id: proof.fact_id,
      source_record_id: proof.source_record_id,
      observed_at: proof.observed_at,
      retrieved_at: proof.retrieved_at,
      raw_sha256: proof.raw_sha256,
      raw_bytes: proof.raw_bytes,
      retention_ref: proof.retention_ref,
      public_raw_value_emission_count: 0,
      raw_payload_embedded_in_fact: false,
      runtime_public_provider_fetch_count: 0,
      ci_minio_is_formal_24h_durable_store: false,
      formal_neon_write_performed: false,
      persistent_formal_24h_raw_store_bound: false,
      ea5c2b_live_formal_proof_complete: false,
      ea5c_complete: false,
      ea5d_authorized: false,
      ea5e_authorized: false,
      formal_o00_start_authorized: false,
      mcft_cap09_completed: false,
    };
    const serialized = JSON.stringify(publicResult);
    assert.equal(serialized.includes('"value"'), false);
    assert.equal(serialized.includes("raw_json_body"), false);
    fs.mkdirSync("acceptance-output", { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(publicResult, null, 2) + "\n");
    console.log(JSON.stringify(publicResult, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
