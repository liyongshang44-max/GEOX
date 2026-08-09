import assert from "node:assert/strict";
import fs from "node:fs";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  createFormalDurableRawEvidenceRetentionAdapterV1,
  MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
} from "../../apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.js";
import {
  executeFormalLiveKbsSoilIngressV1,
} from "../../apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.js";

const OUT = "acceptance-output/MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS_RESULT.json";
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_24h";
const EXPECTED_FACT_SOURCE = "mcft_cap09_external_formal_evidence_v1";
const EXPECTED_RECORD_TYPE = "soil_moisture_observation_v1";
const EXPECTED_ORIGIN_SOURCE_ID = "KBS_LTER_CURRENT_WEATHER_VARIATE_25";
const EXPECTED_DECODER_ID = "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1";
const EXPECTED_DECODER_VERSION = "1";

type FactRowV1 = {
  fact_id: string;
  source: string;
  record_json: unknown;
};

type ExistingFormalSoilProofV1 = {
  fact_id: string;
  source_record_id: string;
  observed_at: string;
  available_to_runtime_at: string;
  raw_sha256: string;
  raw_bytes: number;
  retention_ref: string;
};

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function exactIso(value: unknown, code: string): string {
  const candidate = text(value, code);
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== candidate) throw new Error(code);
  return candidate;
}

function positiveSafeInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function assertExactScope(record: Record<string, unknown>): void {
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    assert.equal(record[key], expected, `EA5C2B2_SCOPE_MISMATCH:${key}`);
  }
}

function parseExistingFormalSoilFact(row: FactRowV1): ExistingFormalSoilProofV1 {
  assert.equal(row.source, EXPECTED_FACT_SOURCE, "EA5C2B2_EXISTING_FACT_SOURCE_NOT_AUTHORIZED");
  const envelope = object(row.record_json, "EA5C2B2_EXISTING_ENVELOPE_INVALID");
  assert.equal(envelope.type, EXPECTED_RECORD_TYPE, "EA5C2B2_EXISTING_ENVELOPE_TYPE_NOT_SOIL");
  const record = object(envelope.payload, "EA5C2B2_EXISTING_PAYLOAD_INVALID");
  assertExactScope(record);
  assert.equal(record.record_type, EXPECTED_RECORD_TYPE, "EA5C2B2_EXISTING_RECORD_TYPE_NOT_SOIL");
  assert.equal(record.binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "EA5C2B2_EXISTING_BINDING_MISMATCH");
  assert.equal(record.epistemic_class, "OBSERVED", "EA5C2B2_EXISTING_EPISTEMIC_MISMATCH");
  assert.equal(record.origin_source_id, EXPECTED_ORIGIN_SOURCE_ID, "EA5C2B2_EXISTING_ORIGIN_MISMATCH");
  assert.equal(record.source_unit, "fraction", "EA5C2B2_EXISTING_SOURCE_UNIT_MISMATCH");
  assert.equal(record.canonical_unit, "fraction", "EA5C2B2_EXISTING_CANONICAL_UNIT_MISMATCH");

  const roleTime = object(record.role_time, "EA5C2B2_EXISTING_ROLE_TIME_INVALID");
  const observedAt = exactIso(roleTime.observed_at, "EA5C2B2_EXISTING_OBSERVED_AT_INVALID");
  const availableAt = exactIso(record.available_to_runtime_at, "EA5C2B2_EXISTING_AVAILABLE_AT_INVALID");
  assert.ok(Date.parse(availableAt) >= Date.parse(observedAt), "EA5C2B2_EXISTING_AVAILABILITY_BEFORE_OBSERVATION");

  const quality = object(record.quality, "EA5C2B2_EXISTING_QUALITY_INVALID");
  assert.equal(quality.status, "PASS", "EA5C2B2_EXISTING_QUALITY_NOT_PASS");
  assert.equal(quality.raw_payload_embedded, false, "EA5C2B2_EXISTING_RAW_PAYLOAD_EMBEDDED");

  const sourcePayload = object(record.source_payload, "EA5C2B2_EXISTING_SOURCE_PAYLOAD_INVALID");
  assert.equal(sourcePayload.provider, "KBS_LTER", "EA5C2B2_EXISTING_PROVIDER_MISMATCH");
  assert.equal(sourcePayload.raw_values_embedded, false, "EA5C2B2_EXISTING_RAW_VALUES_EMBEDDED");
  const raw = object(sourcePayload.raw_provenance, "EA5C2B2_EXISTING_RAW_PROVENANCE_INVALID");
  const rawSha256 = text(raw.raw_sha256, "EA5C2B2_EXISTING_RAW_SHA_REQUIRED");
  assert.match(rawSha256, /^sha256:[0-9a-f]{64}$/);
  const rawBytes = positiveSafeInteger(raw.raw_bytes, "EA5C2B2_EXISTING_RAW_BYTES_INVALID");
  const retentionRef = text(raw.retention_ref, "EA5C2B2_EXISTING_RETENTION_REF_REQUIRED");
  assert.ok(retentionRef.startsWith(`s3-private://${MCFT_CAP09_FORMAL_RAW_BUCKET_V1}/mcft-cap09-formal-raw-v1/sha256/`));
  assert.equal(raw.raw_payload_embedded, false, "EA5C2B2_EXISTING_RAW_PAYLOAD_FLAG_INVALID");
  assert.equal(raw.decoder_id, EXPECTED_DECODER_ID, "EA5C2B2_EXISTING_DECODER_ID_MISMATCH");
  assert.equal(raw.decoder_version, EXPECTED_DECODER_VERSION, "EA5C2B2_EXISTING_DECODER_VERSION_MISMATCH");
  assert.equal(quality.raw_source_sha256, rawSha256, "EA5C2B2_EXISTING_QUALITY_RAW_SHA_MISMATCH");
  assert.equal(quality.raw_retention_ref, retentionRef, "EA5C2B2_EXISTING_QUALITY_RETENTION_REF_MISMATCH");

  const canonical = object(record.canonical_payload, "EA5C2B2_EXISTING_CANONICAL_PAYLOAD_INVALID");
  assert.equal(canonical.quantity_kind, "VOLUMETRIC_WATER_CONTENT", "EA5C2B2_EXISTING_QUANTITY_MISMATCH");
  assert.equal(canonical.unit, "fraction", "EA5C2B2_EXISTING_VALUE_UNIT_MISMATCH");
  assert.equal(canonical.measurement_depth_mm, 100, "EA5C2B2_EXISTING_DEPTH_MISMATCH");
  assert.equal(canonical.spatial_support, "NEAR_SITE_POINT_SUPPORT", "EA5C2B2_EXISTING_SPATIAL_SUPPORT_MISMATCH");
  assert.equal(canonical.direct_field_equivalence, false, "EA5C2B2_EXISTING_DIRECT_FIELD_EQUIVALENCE_FORBIDDEN");
  assert.equal(canonical.direct_root_zone_equivalence, false, "EA5C2B2_EXISTING_DIRECT_ROOT_ZONE_EQUIVALENCE_FORBIDDEN");
  assert.equal(canonical.root_zone_representativeness, "PARTIAL", "EA5C2B2_EXISTING_ROOT_ZONE_REPRESENTATIVENESS_MISMATCH");
  assert.equal(typeof canonical.value, "number", "EA5C2B2_EXISTING_CANONICAL_VALUE_NOT_NUMERIC");
  assert.ok(Number.isFinite(canonical.value));
  assert.ok(Number(canonical.value) >= 0 && Number(canonical.value) <= 1);

  const serialized = JSON.stringify(record);
  for (const forbidden of [
    "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
    "CONTROLLED_REPLAY",
    '"runtime_mode":"REPLAY"',
    "field_c8_demo",
    "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);

  return {
    fact_id: row.fact_id,
    source_record_id: text(record.source_record_id, "EA5C2B2_EXISTING_SOURCE_RECORD_ID_REQUIRED"),
    observed_at: observedAt,
    available_to_runtime_at: availableAt,
    raw_sha256: rawSha256,
    raw_bytes: rawBytes,
    retention_ref: retentionRef,
  };
}

function anonymousObjectUrl(endpointOrigin: string, retentionRef: string): string {
  const prefix = `s3-private://${MCFT_CAP09_FORMAL_RAW_BUCKET_V1}/`;
  if (!retentionRef.startsWith(prefix)) throw new Error("EA5C2B2_RETENTION_REF_BUCKET_MISMATCH");
  const key = retentionRef.slice(prefix.length);
  return `${endpointOrigin}/${encodeURIComponent(MCFT_CAP09_FORMAL_RAW_BUCKET_V1)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function assertAnonymousHeadDenied(endpointOrigin: string, retentionRef: string): Promise<number> {
  const response = await fetch(anonymousObjectUrl(endpointOrigin, retentionRef), {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status < 400 || response.status >= 500) {
    throw new Error(`EA5C2B2_ANONYMOUS_RAW_ACCESS_NOT_DENIED:${response.status}`);
  }
  return response.status;
}

async function loadFacts(pool: Pool): Promise<FactRowV1[]> {
  const result = await pool.query("SELECT fact_id,source,record_json FROM public.facts ORDER BY fact_id");
  return result.rows as FactRowV1[];
}

async function main(): Promise<void> {
  const databaseUrl = process.env.GEOX_MCFT_CAP09_S6_DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("EA5C2B2_FORMAL_DATABASE_URL_REQUIRED");
  const githubSha = process.env.GITHUB_SHA?.trim() || "UNKNOWN";
  const binding = createFormalDurableRawEvidenceRetentionAdapterV1(process.env);
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    const identity = await pool.query(
      "SELECT current_database() AS database_name, current_setting('server_version_num')::int AS server_version_num",
    );
    assert.equal(identity.rows.length, 1);
    assert.equal(identity.rows[0].database_name, EXPECTED_DATABASE, "EA5C2B2_FORMAL_DATABASE_IDENTITY_MISMATCH");
    assert.ok(Number(identity.rows[0].server_version_num) >= 180000, "EA5C2B2_POSTGRES_18_REQUIRED");

    const relation = await pool.query("SELECT to_regclass('public.facts')::text AS facts_relation");
    assert.equal(relation.rows[0]?.facts_relation, "facts", "EA5C2B2_FACTS_RELATION_REQUIRED");

    const before = await loadFacts(pool);
    if (before.length > 1) throw new Error(`EA5C2B2_FORMAL_DATABASE_NOT_PRISTINE_OR_SINGLE_PROOF:${before.length}`);

    let proof: ExistingFormalSoilProofV1;
    let executionMode: "FIRST_LIVE_INSERT" | "EXISTING_PROOF_REVERIFIED";
    let canonicalFactWriteCount: 0 | 1;
    let livePublicSourceFetchCount: 0 | 1;

    if (before.length === 0) {
      const inserted = await executeFormalLiveKbsSoilIngressV1({
        pool,
        retention: binding.adapter,
      });
      assert.equal(inserted.status, "INSERTED", "EA5C2B2_FIRST_FORMAL_INGRESS_MUST_INSERT");
      assert.equal(inserted.canonical_fact_write_count, 1);
      proof = {
        fact_id: inserted.fact_id,
        source_record_id: inserted.source_record_id,
        observed_at: inserted.observed_at,
        available_to_runtime_at: inserted.retrieved_at,
        raw_sha256: inserted.raw_sha256,
        raw_bytes: inserted.raw_bytes,
        retention_ref: inserted.retention_ref,
      };
      executionMode = "FIRST_LIVE_INSERT";
      canonicalFactWriteCount = 1;
      livePublicSourceFetchCount = 1;
    } else {
      proof = parseExistingFormalSoilFact(before[0]);
      executionMode = "EXISTING_PROOF_REVERIFIED";
      canonicalFactWriteCount = 0;
      livePublicSourceFetchCount = 0;
    }

    await binding.adapter.verifyRetainedRawEvidence({
      retention_ref: proof.retention_ref,
      retained_sha256: proof.raw_sha256,
      retained_bytes: proof.raw_bytes,
    });
    const anonymousHeadStatus = await assertAnonymousHeadDenied(
      binding.descriptor.endpoint_origin,
      proof.retention_ref,
    );

    const after = await loadFacts(pool);
    assert.equal(after.length, 1, "EA5C2B2_EXACTLY_ONE_FORMAL_FACT_REQUIRED");
    const persisted = parseExistingFormalSoilFact(after[0]);
    assert.equal(persisted.fact_id, proof.fact_id);
    assert.equal(persisted.source_record_id, proof.source_record_id);
    assert.equal(persisted.raw_sha256, proof.raw_sha256);
    assert.equal(persisted.raw_bytes, proof.raw_bytes);
    assert.equal(persisted.retention_ref, proof.retention_ref);

    const exactScopeCount = await pool.query(
      `SELECT count(*)::int AS count
       FROM public.facts
       WHERE record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.tenant_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.project_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.group_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id,
        MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.zone_id,
      ],
    );
    assert.equal(exactScopeCount.rows[0]?.count, 1, "EA5C2B2_EXACT_SCOPE_FACT_COUNT_MUST_BE_ONE");

    const result = {
      schema_version: "geox_mcft_cap09_ea5c2b2_formal_live_ingress_result_v1",
      status: "PASS",
      subject_head_sha: githubSha,
      execution_mode: executionMode,
      formal_database_identity: EXPECTED_DATABASE,
      formal_postgres_18_or_newer: true,
      preexisting_fact_count: before.length,
      final_fact_count: after.length,
      exact_external_scope_fact_count: 1,
      live_public_source_fetch_count: livePublicSourceFetchCount,
      canonical_fact_write_count: canonicalFactWriteCount,
      fact_id: proof.fact_id,
      source_record_id: proof.source_record_id,
      observed_at: proof.observed_at,
      available_to_runtime_at: proof.available_to_runtime_at,
      raw_sha256: proof.raw_sha256,
      raw_bytes: proof.raw_bytes,
      retention_ref: proof.retention_ref,
      formal_raw_store_binding_id: binding.descriptor.binding_id,
      formal_raw_store_binding_fingerprint_sha256: binding.descriptor.binding_fingerprint_sha256,
      formal_raw_store_bucket: binding.descriptor.bucket,
      formal_raw_store_retention_class: binding.descriptor.retention_class,
      authenticated_raw_head_reverification_passed: true,
      anonymous_raw_head_denied: true,
      anonymous_raw_head_status: anonymousHeadStatus,
      raw_payload_embedded_in_fact: false,
      public_raw_value_emission_count: 0,
      runtime_public_provider_fetch_count: 0,
      persistent_formal_24h_raw_store_bound: true,
      formal_neon_live_ingress_proved: true,
      ea5c2b_live_formal_proof_complete: true,
      ea5c_complete: false,
      ea5d_authorized: false,
      ea5e_authorized: false,
      formal_o00_start_authorized: false,
      formal_window_started: false,
      mcft_cap09_completed: false,
    };
    const publicText = JSON.stringify(result);
    assert.equal(publicText.includes('"value"'), false, "EA5C2B2_PUBLIC_RESULT_VALUE_LEAK");
    assert.equal(publicText.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"), false);
    assert.equal(publicText.includes("GEOX_MCFT_CAP09_S6_DATABASE_URL"), false);

    fs.mkdirSync("acceptance-output", { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
