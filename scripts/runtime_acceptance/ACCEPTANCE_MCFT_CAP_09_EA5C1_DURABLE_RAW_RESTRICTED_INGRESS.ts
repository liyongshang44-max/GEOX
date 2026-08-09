import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  type RawEvidenceRetentionVerificationPortV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  PostgresExternalFormalEvidenceIngressV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const DATABASE_URL = process.env.EA5C1_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/ea5c1";
const S3_ENDPOINT = process.env.EA5C1_S3_ENDPOINT ?? "http://127.0.0.1:9000";
const S3_BUCKET = process.env.EA5C1_S3_BUCKET ?? "geox-mcft-cap09-formal-raw-v1";
const S3_ACCESS_KEY = process.env.EA5C1_S3_ACCESS_KEY ?? "minioadmin";
const S3_SECRET_KEY = process.env.EA5C1_S3_SECRET_KEY ?? "minioadmin123";

let pass = 0;
function ok(message: string): void { pass += 1; console.log(`PASS ${message}`); }
function sha256(bytes: Uint8Array): string { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
function iso(ms: number): string { return new Date(ms).toISOString(); }

const roles = [
  ["soil_moisture_observation_v1", MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "OBSERVED", "observed_at"],
  ["observed_rainfall_v1", MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1, "OBSERVED", "interval_end"],
  ["historical_et0_estimate_v1", MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1, "ESTIMATED", "interval_end"],
  ["future_weather_assumption_v1", MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1, "ASSUMED", "issued_at"],
  ["future_et0_assumption_v1", MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1, "ASSUMED", "issued_at"],
] as const;

async function factCount(pool: Pool): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS n FROM facts");
  return Number(result.rows[0].n);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
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
  let verificationCalls = 0;
  const countingVerifier: RawEvidenceRetentionVerificationPortV1 = {
    async verifyRetainedRawEvidence(input) {
      verificationCalls += 1;
      await retention.verifyRetainedRawEvidence(input);
    },
  };
  const ingress = new PostgresExternalFormalEvidenceIngressV1(pool, countingVerifier);

  const started = Date.now();
  const boundaryMs = Math.ceil((started + 1) / 3_600_000) * 3_600_000;
  const windowStartMs = boundaryMs - 3_600_000;
  const eventMs = Math.max(started - 60_000, windowStartMs + 1_000);
  const eventTime = iso(eventMs);
  const records: CanonicalReplayEvidenceRecordV1[] = [];
  const privateSentinels: string[] = [];

  for (let index = 0; index < roles.length; index += 1) {
    const [recordType, bindingId, epistemicClass, eventField] = roles[index];
    const sentinel = `EA5C1_PRIVATE_RAW_SENTINEL_${index}_${crypto.randomUUID()}`;
    privateSentinels.push(sentinel);
    const bytes = Buffer.from(`${sentinel}\n${recordType}\n`, "utf8");
    const digest = sha256(bytes);
    const retrievedAt = iso(Date.now() - 500);
    const receipt = await retention.retainRawEvidence({
      retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
      request_id: `ea5c1-request-${index}`,
      provider_id: recordType.startsWith("future_") ? "NOAA_NCEP_GFS" : "KBS_LTER",
      source_family: recordType,
      source_locator: `https://source.example.invalid/${index}`,
      final_locator: `https://source.example.invalid/${index}`,
      content_type: "application/octet-stream",
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      use_policy_ref: "GEOX-MCFT-CAP-09-AMENDMENT-05",
      raw_sha256: digest,
      raw_bytes: bytes.byteLength,
      bytes,
    });
    const ingestedAt = receipt.retained_at;
    assert.ok(Date.parse(eventTime) <= Date.parse(ingestedAt));
    assert.ok(Date.parse(ingestedAt) <= boundaryMs);

    const roleTime: Record<string, unknown> = {
      [eventField]: eventTime,
      ingested_at: ingestedAt,
    };
    if (eventField === "interval_end") roleTime.interval_start = iso(eventMs - 3_600_000);
    if (eventField === "issued_at") {
      roleTime.valid_from = iso(boundaryMs);
      roleTime.valid_to = iso(boundaryMs + 72 * 3_600_000);
    }
    const rawProvenance = {
      provider_id: recordType.startsWith("future_") ? "NOAA_NCEP_GFS" : "KBS_LTER",
      source_family: recordType,
      final_locator: `https://source.example.invalid/${index}`,
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      raw_sha256: digest,
      raw_bytes: bytes.byteLength,
      retention_ref: receipt.retention_ref,
      retained_at: receipt.retained_at,
      use_policy_ref: "GEOX-MCFT-CAP-09-AMENDMENT-05",
      decoder_id: "EA5C1_ACCEPTANCE_DECODER",
      decoder_version: "1",
      raw_payload_embedded: false,
    };
    const sourceRecordId = `ea5c1-${recordType}-${index}`;
    const record: CanonicalReplayEvidenceRecordV1 = {
      ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      dataset_id: "mcft_cap09_ea5c1_external_formal_acceptance_v1",
      source_record_id: sourceRecordId,
      source_record_hash: semanticHashV1({ source_record_id: sourceRecordId, raw_sha256: digest, retention_ref: receipt.retention_ref }),
      record_type: recordType,
      binding_id: bindingId,
      origin_source_kind: "EXTERNAL_PUBLIC_RESEARCH_DATASET",
      origin_source_id: `ea5c1-${index}`,
      epistemic_class: epistemicClass,
      available_to_runtime_at: ingestedAt,
      role_time: roleTime,
      quality: {
        status: index === 3 ? "LIMITED" : "PASS",
        raw_source_sha256: digest,
        raw_retention_ref: receipt.retention_ref,
        raw_payload_embedded: false,
      },
      source_payload: { raw_provenance: rawProvenance, source_value_summary: `private-raw-not-embedded-${index}` },
      canonical_payload: { value: index + 0.25, role: recordType },
      source_unit: "acceptance_source_unit",
      canonical_unit: "acceptance_canonical_unit",
      conversion_rule: {
        conversion_rule_id: `ea5c1-rule-${index}`,
        conversion_rule_version: "1",
        authority_ref: "GEOX-MCFT-CAP-09-AMENDMENT-05",
      },
      execution_metadata: {
        policy_id: "SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1",
        source_binding_version: 1,
        conversion_rule_version: "1",
      },
      limitations: ["EXTERNAL_PUBLIC_RESEARCH_SCOPE", "EA5C1_ACCEPTANCE_ONLY"],
    };
    records.push(record);
  }

  const inserted = [];
  for (const record of records) inserted.push(await ingress.appendCanonicalExternalEvidence(record));
  assert.equal(inserted.filter((item) => item.status === "INSERTED").length, 5);
  assert.equal(await factCount(pool), 5);
  assert.equal(verificationCalls, 5);
  ok("five authorized External Evidence families require durable S3 verification before exactly five canonical facts are appended");

  const reader = new PostgresEvidenceIngressAdapterV1(pool);
  const frozen = await reader.freezeEligibleEvidence({
    boundary: {
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      logical_time: iso(boundaryMs),
      interval_seconds: 3600,
    },
  });
  assert.equal(frozen.selected.length, 5);
  assert.equal(frozen.actual_observation_count, 3);
  assert.equal(frozen.eligible_future_forcing_count, 2);
  assert.deepEqual(new Set(frozen.selected.map((item) => item.evidence_kind)), new Set(roles.map((item) => item[0])));
  ok("existing database-only Runtime Evidence ingress reads the new canonical facts without a parallel contract");

  const retry = await ingress.appendCanonicalExternalEvidence(records[0]);
  assert.equal(retry.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(retry.canonical_fact_write_count, 0);
  assert.equal(await factCount(pool), 5);
  ok("same source identity and semantic record is idempotent with no duplicate fact write");

  const badBinding = structuredClone(records[1]);
  badBinding.binding_id = "rainfall_c8_hourly_v1";
  const callsBeforeBadBinding = verificationCalls;
  await assert.rejects(() => ingress.appendCanonicalExternalEvidence(badBinding), /EA5C1_BINDING_NOT_AUTHORIZED/);
  assert.equal(verificationCalls, callsBeforeBadBinding);
  assert.equal(await factCount(pool), 5);
  ok("unauthorized binding fails before raw-object verification or database write");

  const badScope = structuredClone(records[0]);
  badScope.field_id = "field_c8_demo";
  const callsBeforeBadScope = verificationCalls;
  await assert.rejects(() => ingress.appendCanonicalExternalEvidence(badScope), /EA5C1_EXTERNAL_SCOPE_MISMATCH:field_id/);
  assert.equal(verificationCalls, callsBeforeBadScope);
  assert.equal(await factCount(pool), 5);
  ok("scope drift to the historical C8 field fails before raw-object verification or database write");

  const forbiddenOperation = structuredClone(records[0]);
  forbiddenOperation.record_type = "irrigation_execution_evidence_v1";
  const callsBeforeOperation = verificationCalls;
  await assert.rejects(() => ingress.appendCanonicalExternalEvidence(forbiddenOperation), /EA5C1_RECORD_TYPE_NOT_AUTHORIZED/);
  assert.equal(verificationCalls, callsBeforeOperation);
  assert.equal(await factCount(pool), 5);
  ok("commercial operation evidence cannot enter the restricted External Formal Evidence writer");

  const missingRaw = structuredClone(records[0]);
  const fakeHash = `sha256:${"0".repeat(64)}`;
  (missingRaw.source_payload.raw_provenance as Record<string, unknown>).raw_sha256 = fakeHash;
  (missingRaw.source_payload.raw_provenance as Record<string, unknown>).retention_ref = `s3-private://${S3_BUCKET}/mcft-cap09-formal-raw-v1/sha256/${"0".repeat(64)}`;
  missingRaw.quality.raw_source_sha256 = fakeHash;
  missingRaw.quality.raw_retention_ref = (missingRaw.source_payload.raw_provenance as Record<string, unknown>).retention_ref;
  missingRaw.source_record_id = "ea5c1-missing-durable-object";
  missingRaw.source_record_hash = semanticHashV1({ source_record_id: missingRaw.source_record_id, raw_sha256: fakeHash });
  await assert.rejects(() => ingress.appendCanonicalExternalEvidence(missingRaw), /EA5C1_RAW_OBJECT_NOT_FOUND/);
  assert.equal(await factCount(pool), 5);
  ok("canonical append is impossible when the claimed durable raw object is absent");

  const conflicting = structuredClone(records[0]);
  conflicting.source_record_hash = semanticHashV1({ conflict: true });
  conflicting.canonical_payload = { value: 999, role: conflicting.record_type };
  await assert.rejects(() => ingress.appendCanonicalExternalEvidence(conflicting), /EA5C1_SOURCE_IDENTITY_CONFLICT/);
  assert.equal(await factCount(pool), 5);
  ok("same External source identity with different canonical semantics fails closed instead of dual-writing");

  const factText = (await pool.query("SELECT record_json::text AS body FROM facts ORDER BY fact_id")).rows.map((row) => String(row.body)).join("\n");
  for (const sentinel of privateSentinels) assert.equal(factText.includes(sentinel), false);
  assert.equal(factText.includes("s3-private://"), true);
  assert.equal(factText.includes("raw_payload_embedded\": false"), true);
  ok("raw bytes remain private object-store data; facts contain only digest/reference provenance and no raw sentinel bytes");

  const nonEvidence = await pool.query(
    `SELECT count(*)::int AS n FROM facts
      WHERE record_json->>'type' NOT IN (
        'soil_moisture_observation_v1','observed_rainfall_v1','historical_et0_estimate_v1',
        'future_weather_assumption_v1','future_et0_assumption_v1'
      )`,
  );
  assert.equal(Number(nonEvidence.rows[0].n), 0);
  ok("EA5C1 writes no Runtime Config, A0, State, Forecast, Scenario, Recommendation, Action, or scheduler facts");

  assert.equal(pass, 9);
  console.log(`MCFT-CAP-09 EA5C1 Durable Raw + Restricted Evidence Ingress: ${pass} PASS, 0 FAIL`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
