// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_A0_RUNTIME_DB.ts
// Purpose: prove the real controlled Replay A0 Runtime service commits the S4 nine-object bootstrap transaction atomically, idempotently, and rebuildably against PostgreSQL.
// Boundary: destructive isolated acceptance database only; no propagation, successful Forecast, Scenario, Recommendation, AO-ACT, public route, scheduler, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { PostgresProjectionRebuilderV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_projection_rebuilder_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { buildA0RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import { compileRuntimeConfigFromAuthorityArtifactsV1, type Mcft00ConfigurationMatrixArtifactV1, type Mcft00RealityArtifactV1, type Mcft00SourceMatrixArtifactV1 } from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

if (process.env.MCFT_CAP_01_S4_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_01_S4_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGICAL_TIME = "2026-06-01T01:00:00.000Z";
const CREATED_AT = "2026-06-01T01:00:00.000Z";
function readJson<T>(relativePath: string): T { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T; }

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{ configuration_source_id: string; parameters: Record<string, { value: unknown }> }>;
};
function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number") throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

const reality = readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
const sourceMatrix = readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
const configurationMatrix = readJson<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
const scopeParams = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
  realityArtifact: reality,
  sourceMatrixArtifact: sourceMatrix,
  configurationMatrixArtifact: configurationMatrix,
  logical_time: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
});
const hydraulic = hydraulicFromAuthorityV1(configurationMatrix);
const evidenceSource = new CanonicalReplayFileSourceV1(path.join(ROOT, "fixtures/mcft/water_state/replay_v1"));
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const rebuilder = new PostgresProjectionRebuilderV1(pool);
const service = new A0BootstrapRuntimeServiceV1(repository, repository, evidenceSource);
const projectionTables = [
  "twin_active_lineage_index_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
] as const;

let pass = 0;
function ok(message: string): void { pass += 1; console.log(`PASS ${message}`); }

async function cleanupA0(recordSetId: string, memberObjectIds: string[]): Promise<void> {
  for (const table of projectionTables) {
    await pool.query(`DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams);
  }
  await pool.query("DELETE FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='A0_RECORD_SET' AND record_set_id=$1", [recordSetId]);
  await pool.query("DELETE FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [memberObjectIds]);
  await pool.query("DELETE FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
}

async function factCount(memberObjectIds: string[]): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [memberObjectIds]);
  return result.rows[0].count;
}

async function projectionCount(): Promise<number> {
  let count = 0;
  for (const table of projectionTables) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams);
    count += result.rows[0].count;
  }
  return count;
}

async function successfulForecastCount(): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
  return result.rows[0].count;
}

async function leaseToken(): Promise<bigint | null> {
  const result = await pool.query("SELECT fencing_token FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
  return result.rows.length ? BigInt(result.rows[0].fencing_token) : null;
}

async function main(): Promise<void> {
  try {
    await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"), "utf8"));
    const schemaCheck = await pool.query(`
      SELECT
        to_regclass('public.facts') AS facts,
        to_regclass('public.twin_runtime_lease_v1') AS runtime_lease,
        to_regclass('public.twin_object_idempotency_index_v1') AS idempotency_index,
        to_regclass('public.twin_state_latest_index_v1') AS state_latest
    `);
    assert.equal(schemaCheck.rows[0].facts, "facts");
    assert.equal(schemaCheck.rows[0].runtime_lease, "twin_runtime_lease_v1");
    assert.equal(schemaCheck.rows[0].idempotency_index, "twin_object_idempotency_index_v1");
    assert.equal(schemaCheck.rows[0].state_latest, "twin_state_latest_index_v1");
    ok("base facts schema and A0 persistence schema initialized in repository order");

    const candidates = await evidenceSource.loadCandidateRecords({ scope, logical_time: LOGICAL_TIME });
    const evidenceWindow = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: candidates });
    const recordSet = buildA0RecordSetV1({
      scope,
      logical_time: LOGICAL_TIME,
      created_at: CREATED_AT,
      runtime_config: runtimeConfig,
      evidence_window: evidenceWindow,
      hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
    });
    const memberIds = recordSet.members.map((member) => member.object_id);

    await cleanupA0(recordSet.a0_record_set_id, memberIds);
    await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1", [runtimeConfig.idempotency_key]);
    await pool.query("DELETE FROM facts WHERE record_json->'payload'->>'object_id'=$1", [runtimeConfig.object_id]);
    const configCommit = await repository.commitRuntimeConfig(runtimeConfig);
    assert.equal(configCommit.status, "INSERTED"); ok("immutable Runtime Config inserted");

    const faultStages = recordSet.members.map((member, index) => `before_fact_${index + 1}_${member.object_type}`).concat([
      "before_active_lineage_projection",
      "before_state_history_projection",
      "before_state_latest_projection",
      "before_forecast_result_projection",
      "before_checkpoint_projection",
      "before_health_projection",
      "before_idempotency_index",
      "before_commit",
    ]);
    for (const stage of faultStages) {
      await cleanupA0(recordSet.a0_record_set_id, memberIds);
      const lease = await repository.acquireLease({ ...scope, lease_owner: "mcft-cap-01-s4-db-acceptance", lease_duration_seconds: 300 });
      await assert.rejects(repository.commitBootstrapState({
        scope,
        lease,
        expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null },
        record_set: recordSet,
        fault_injection: (current) => { if (current === stage) throw new Error(`FAULT:${stage}`); },
      }), new RegExp(`FAULT:${stage}`));
      assert.equal(await factCount(memberIds), 0);
      assert.equal(await projectionCount(), 0);
      assert.equal(await successfulForecastCount(), 0);
    }
    ok(`${faultStages.length} actual S4 fault stages roll back all A0 writes`);

    await cleanupA0(recordSet.a0_record_set_id, memberIds);
    const first = await service.execute({
      scope,
      logical_time: LOGICAL_TIME,
      created_at: CREATED_AT,
      runtime_config: runtimeConfig,
      hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      lease_owner: "mcft-cap-01-s4-runtime",
      lease_duration_seconds: 300,
    });
    assert.equal(first.status, "INSERTED");
    assert.equal(first.record_set.a0_record_set_determinism_hash, recordSet.a0_record_set_determinism_hash);
    assert.equal(first.next_tick_logical_time, "2026-06-01T02:00:00.000Z");
    assert.equal(await factCount(memberIds), 9);
    assert.equal(await projectionCount(), 6);
    assert.equal(await successfulForecastCount(), 0);
    ok("real S4 service atomically commits nine canonical facts and six projections");
    ok("BLOCKED Forecast advances result latest but not successful Forecast latest");
    ok("INITIAL checkpoint exposes deterministic next-tick handoff");

    const stateLatest = await pool.query("SELECT state_object_id,lineage_id,revision_id,logical_time FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    const activeLineage = await pool.query("SELECT active_lineage_ref,activation_authority_kind,expected_previous_active_lineage FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    const forecastLatest = await pool.query("SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    const checkpointLatest = await pool.query("SELECT checkpoint_object_id,lineage_id,revision_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    assert.equal(activeLineage.rows[0].activation_authority_kind, "INITIAL_LINEAGE_DECLARATION");
    assert.equal(activeLineage.rows[0].expected_previous_active_lineage, null);
    assert.equal(stateLatest.rows[0].lineage_id, checkpointLatest.rows[0].lineage_id);
    assert.equal(stateLatest.rows[0].revision_id, checkpointLatest.rows[0].revision_id);
    assert.equal(forecastLatest.rows[0].forecast_status, "BLOCKED");
    ok("NULL_TO_INITIAL activation and shared INITIAL lineage/revision projections");

    const tokenBeforeReplay = await leaseToken();
    const second = await service.execute({
      scope,
      logical_time: LOGICAL_TIME,
      created_at: "2026-06-01T01:40:00.000Z",
      runtime_config: runtimeConfig,
      hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      lease_owner: "mcft-cap-01-s4-runtime",
      lease_duration_seconds: 300,
    });
    const tokenAfterReplay = await leaseToken();
    assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(tokenAfterReplay, tokenBeforeReplay);
    assert.equal(await factCount(memberIds), 9);
    assert.equal(await projectionCount(), 6);
    ok("same-input replay returns existing complete record set before lease acquisition");
    ok("idempotent readback adds no facts projections or fencing-token change");

    const readback = await repository.readBootstrapRecordSet(recordSet.a0_record_set_id);
    assert.ok(readback);
    assert.equal(readback.a0_record_set_determinism_hash, recordSet.a0_record_set_determinism_hash);
    assert.equal(readback.members.length, 9);
    ok("canonical A0 record set readback is complete and equivalent");

    for (const table of projectionTables) {
      await pool.query(`DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams);
    }
    assert.equal(await projectionCount(), 0);
    const rebuilt = await rebuilder.rebuildA0Projections(recordSet.a0_record_set_id);
    assert.equal(rebuilt.rebuilt_projection_count, 6);
    assert.equal(await projectionCount(), 6);
    assert.equal(await successfulForecastCount(), 0);
    ok("six projections rebuild equivalently from canonical A0 facts");
    ok("projection rebuild still leaves successful Forecast latest empty");

    console.log(`MCFT-CAP-01 S4 A0 Runtime DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
