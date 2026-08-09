// Purpose: prove the EA5D External bootstrap persistence implementation against isolated PostgreSQL.
// Boundary: CI-only qualification. No Formal Neon, public provider, scheduler, O00, recommendation,
// action, approval, AO-ACT, dispatch, or model activation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  buildExternalFormalBootstrapAuthorityBundleV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap03R2V2FixtureV1 } from "./mcft_cap_03_r2_v2_revalidation_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATABASE_URL = process.env.EA5D1_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/ea5d1";
const CREATED_AT = "2026-08-10T00:30:00.000Z";
const CROP_STAGE_AUTHORITY_TIME = "2026-08-10T00:20:00.000Z";

function externalizeSoilV1(record: CanonicalReplayEvidenceRecordV1, logicalTime: string): CanonicalReplayEvidenceRecordV1 {
  const observedAt = new Date(Date.parse(logicalTime) - 20 * 60_000).toISOString();
  const external = structuredClone(record);
  Object.assign(external, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
  external.dataset_id = "ea5d1_ci_external_bootstrap_qualification_v1";
  external.source_record_id = `ea5d1_ci_kbs_soil_${observedAt}`;
  external.source_record_hash = "sha256:ea5d1-ci-kbs-soil-exact-binding";
  external.record_type = "soil_moisture_observation_v1";
  external.binding_id = MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  external.origin_source_kind = "PUBLIC_RESEARCH_SOURCE";
  external.origin_source_id = "KBS_LTER_CURRENT_WEATHER_VARIATE_25";
  external.epistemic_class = "OBSERVED";
  external.available_to_runtime_at = new Date(Date.parse(observedAt) + 2 * 60_000).toISOString();
  external.role_time = {
    observed_at: observedAt,
    ingested_at: external.available_to_runtime_at,
  };
  external.quality = {
    ...external.quality,
    status: "PASS",
    raw_payload_embedded: false,
  };
  external.source_payload = {
    provider: "KBS_LTER",
    raw_values_embedded: false,
    source_version: "kbs-lter-current-weather-variate-25-v1",
  };
  external.canonical_payload = {
    ...external.canonical_payload,
    value: 0.25,
    quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    unit: "fraction",
    measurement_depth_mm: 100,
    spatial_support: "NEAR_SITE_POINT_SUPPORT",
    direct_field_equivalence: false,
    direct_root_zone_equivalence: false,
    root_zone_representativeness: "PARTIAL",
  };
  external.source_unit = "fraction";
  external.canonical_unit = "fraction";
  external.limitations = [
    "CI_ONLY_QUALIFICATION_VALUE_NOT_FORMAL_EVIDENCE",
    "NEAR_SITE_POINT_SUPPORT",
    "MEASUREMENT_DEPTH_100MM",
    "DIRECT_FIELD_EQUIVALENCE_FALSE",
    "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
    "ROOT_ZONE_REPRESENTATIVENESS_PARTIAL",
  ];
  return external;
}

class MemoryEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(private readonly records: readonly CanonicalReplayEvidenceRecordV1[]) {}
  async loadCandidateRecords(): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    return this.records.map((record) => structuredClone(record));
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 8 });
  try {
    await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"), "utf8"));
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"), "utf8"));

    const fixture = await buildMcftCap03R2V2FixtureV1(1);
    const bootstrapLogicalTime = fixture.firstLogicalTime;
    const sourceRecords = await fixture.runtime.loadCandidateRecords({
      scope: fixture.source.scope,
      logical_time: bootstrapLogicalTime,
    });
    const soil = sourceRecords.find((record) => record.record_type === "soil_moisture_observation_v1");
    assert.ok(soil, "EA5D1_SOIL_FIXTURE_REQUIRED");
    const externalSoil = externalizeSoilV1(soil, bootstrapLogicalTime);

    const bundle = buildExternalFormalBootstrapAuthorityBundleV1({
      bootstrap_logical_time: bootstrapLogicalTime,
      created_at: CREATED_AT,
      crop_stage_code: "MID",
      crop_stage_derivation_authority_time: CROP_STAGE_AUTHORITY_TIME,
    });
    assert.equal(bundle.runtime_configs.length, 24);
    assert.equal(bundle.bootstrap_runtime_config.payload.config_role, "A0_BOOTSTRAP");
    assert.equal(bundle.runtime_configs[0]?.payload.parent_runtime_config_ref, bundle.bootstrap_runtime_config.object_id);
    assert.equal(bundle.runtime_configs.at(-1)?.logical_time, new Date(Date.parse(bootstrapLogicalTime) + 24 * 3_600_000).toISOString());

    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const authorityRepository = new PostgresNextTickRepositoryV1(pool);
    const service = new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository: runtimeRepository,
      bootstrap_persistence: runtimeRepository,
      authority_snapshot_repository: authorityRepository,
      evidence_source: new MemoryEvidenceSourceV1([externalSoil]),
    });

    const first = await service.execute({
      bundle,
      created_at: CREATED_AT,
      lease_owner: "ea5d1-ci-bootstrap-writer",
      lease_duration_seconds: 300,
    });
    assert.equal(first.status, "INSERTED");
    assert.equal(first.runtime_config_write_count, 25);
    assert.equal(first.a0_member_write_count, 9);
    assert.equal(first.hourly_runtime_config_count, 24);
    assert.equal(first.provider_request_count, 0);
    assert.equal(first.scheduler_slot_write_count, 0);
    assert.equal(first.formal_window_started, false);

    const canonical = await pool.query(`
      SELECT record_json->>'type' AS type,
             record_json->'payload'->>'object_id' AS object_id,
             record_json->'payload'->>'determinism_hash' AS determinism_hash,
             record_json->'payload' AS object
        FROM facts
       WHERE record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
       ORDER BY record_json->>'type', record_json->'payload'->>'object_id'`,
      Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1),
    );
    assert.equal(canonical.rows.length, 34, "EA5D1_25_CONFIG_PLUS_9_A0_FACTS_REQUIRED");
    const typeCounts = new Map<string, number>();
    for (const row of canonical.rows) typeCounts.set(row.type, (typeCounts.get(row.type) ?? 0) + 1);
    assert.equal(typeCounts.get("twin_runtime_config_v1"), 25);
    assert.equal([...typeCounts.values()].reduce((sum, value) => sum + value, 0), 34);

    const configs = await pool.query(`
      SELECT record_json->'payload' AS object
        FROM facts
       WHERE record_json->>'type'='twin_runtime_config_v1'
         AND record_json->'payload'->>'tenant_id'=$1
         AND record_json->'payload'->>'project_id'=$2
         AND record_json->'payload'->>'group_id'=$3
         AND record_json->'payload'->>'field_id'=$4
         AND record_json->'payload'->>'season_id'=$5
         AND record_json->'payload'->>'zone_id'=$6
       ORDER BY (record_json->'payload'->>'logical_time')::timestamptz ASC`,
      Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1),
    );
    assert.equal(configs.rows.length, 25);
    let parent: Record<string, unknown> | null = null;
    configs.rows.forEach((row, index) => {
      const object = row.object as Record<string, unknown>;
      const payload = object.payload as Record<string, unknown>;
      assert.equal(payload.runtime_mode, "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY");
      assert.equal(payload.authority_scope_class, "EXTERNAL_PUBLIC_RESEARCH_SCOPE");
      assert.equal(payload.config_selection_mode, "EXPLICIT_REF_HASH_PIN_ONLY");
      if (index === 0) {
        assert.equal(payload.config_role, "A0_BOOTSTRAP");
        assert.equal(payload.parent_runtime_config_ref, null);
      } else {
        assert.equal(payload.config_role, "HOURLY_CAP04");
        assert.equal(payload.parent_runtime_config_ref, parent?.object_id);
        assert.equal(payload.parent_runtime_config_hash, parent?.determinism_hash);
      }
      parent = object;
    });

    const snapshot = await authorityRepository.readRealityBindingSnapshot(first.reality_binding_ref);
    assert.ok(snapshot);
    assert.equal(snapshot.determinism_hash, first.reality_binding_hash);
    assert.equal(snapshot.geometry_semantic_hash, bundle.geometry_semantic_hash);
    assert.equal(snapshot.scope.field_id, MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id);
    assert.equal(snapshot.root_zone_definition.authority_class, "MODEL_PRIOR_FROM_CAP08");
    assert.equal(snapshot.root_zone_definition.field_calibration_status, "NOT_FIELD_CALIBRATED");

    const nextTick = await authorityRepository.readPersistedNextTickSnapshot({ ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 });
    assert.ok(nextTick);
    assert.equal(nextTick.runtime_config.object_id, first.bootstrap_runtime_config_ref);
    assert.equal(nextTick.reality_binding.binding_id, first.reality_binding_ref);
    assert.equal(nextTick.checkpoint.payload.next_tick_logical_time, first.window_start_utc);
    assert.equal(nextTick.previous_posterior.runtime_config_ref, first.bootstrap_runtime_config_ref);
    assert.equal(nextTick.previous_forecast_result?.payload.status, "BLOCKED");

    const scheduler = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1) AS slot_count,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1) AS cursor_count`);
    assert.equal(scheduler.rows[0].slot_count, 0);
    assert.equal(scheduler.rows[0].cursor_count, 0);

    const serialized = JSON.stringify(canonical.rows);
    for (const forbidden of [
      "CONTROLLED_SYNTHETIC_REPLAY_PROXY",
      '"runtime_mode":"REPLAY"',
      '"field_id":"field_c8_demo"',
      "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
    ]) assert.equal(serialized.includes(forbidden), false, `EA5D1_FORBIDDEN_CANONICAL_MARKER:${forbidden}`);

    const beforeRetryFacts = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    const second = await service.execute({
      bundle,
      created_at: new Date(Date.parse(CREATED_AT) + 60_000).toISOString(),
      lease_owner: "ea5d1-ci-bootstrap-retry",
      lease_duration_seconds: 300,
    });
    assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(second.runtime_config_write_count, 0);
    assert.equal(second.a0_member_write_count, 0);
    const afterRetryFacts = Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
    assert.equal(afterRetryFacts, beforeRetryFacts);
    assert.equal(second.a0_record_set_ref, first.a0_record_set_ref);
    assert.deepEqual(second.hourly_runtime_config_refs, first.hourly_runtime_config_refs);
    assert.deepEqual(second.hourly_runtime_config_hashes, first.hourly_runtime_config_hashes);

    const result = {
      schema_version: "geox_mcft_cap09_ea5d1_external_bootstrap_persistence_result_v1",
      status: "PASS",
      ci_only_qualification: true,
      formal_neon_write_performed: false,
      exact_external_scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      reality_binding_snapshot_persisted: true,
      bootstrap_runtime_config_persisted: true,
      a0_nine_member_graph_persisted: true,
      exact_hourly_runtime_config_count: 24,
      exact_total_runtime_config_count: 25,
      exact_total_canonical_fact_count: 34,
      parent_chain_verified: true,
      external_runtime_mode_verified: true,
      replay_truth_markers_absent: true,
      first_execution_inserted: true,
      idempotent_retry_zero_canonical_writes: true,
      scheduler_slot_write_count: 0,
      provider_request_count: 0,
      formal_window_started: false,
      ea5d_complete: false,
      ea5e_authorized: false,
      formal_o00_start_authorized: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, "acceptance-output/MCFT_CAP_09_EA5D1_EXTERNAL_BOOTSTRAP_PERSISTENCE_RESULT.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
