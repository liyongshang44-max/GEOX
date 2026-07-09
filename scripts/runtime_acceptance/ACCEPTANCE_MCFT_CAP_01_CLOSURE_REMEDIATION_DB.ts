// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION_DB.ts
// Purpose: prove PostgreSQL-backed Reality Binding snapshot persistence, next-tick input reconstruction, persisted-pointer consistency checks, and zero-write conflicting-observation rejection.
// Boundary: destructive isolated acceptance database only; no propagation, successful Forecast, Scenario, Recommendation, Decision, AO-ACT, scheduler, restart/backfill, late-Evidence revision, or production claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  realityBindingRuntimeSnapshotFromAuthorityArtifactV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceSourcePortV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

if (process.env.MCFT_CAP_01_REMEDIATION_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_01_REMEDIATION_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGICAL_TIME = "2026-06-01T01:00:00.000Z";

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{ configuration_source_id: string; parameters: Record<string, { value: unknown }> }>;
};

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const value = (name: string): number => {
    const candidate = definition.parameters[name]?.value;
    if (typeof candidate !== "number") throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return candidate;
  };
  return {
    wilting_point_fraction: value("wilting_point_fraction"),
    field_capacity_fraction: value("field_capacity_fraction"),
    saturation_fraction: value("saturation_fraction"),
    root_zone_depth_mm: value("root_zone_depth_mm"),
  };
}

const pool = new Pool({ connectionString: databaseUrl });
let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

async function cleanupV1(): Promise<void> {
  for (const table of [
    "twin_runtime_health_latest_index_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_forecast_success_latest_index_v1",
    "twin_forecast_result_latest_index_v1",
    "twin_state_latest_index_v1",
    "twin_state_history_projection_v1",
    "twin_active_lineage_index_v1",
    "twin_object_idempotency_index_v1",
    "twin_runtime_lease_v1",
    "twin_runtime_authority_snapshot_v1",
  ]) await pool.query(`DELETE FROM ${table}`);
  await pool.query("DELETE FROM facts WHERE source='system'");
}

async function a0FactCountV1(): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM facts WHERE record_json->>'type'=ANY($1::text[])`, [[
    "twin_runtime_lineage_v1",
    "twin_evidence_window_v1",
    "twin_state_transition_v1",
    "twin_assimilation_update_v1",
    "twin_state_estimate_v1",
    "twin_forecast_run_v1",
    "twin_runtime_tick_v1",
    "twin_runtime_checkpoint_v1",
    "twin_runtime_health_v1",
  ]]);
  return result.rows[0].count;
}

async function main(): Promise<void> {
  try {
    await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"), "utf8"));
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql"), "utf8"));
    await cleanupV1();
    ok("base, A0 persistence and remediation schemas initialized");

    const reality = readJsonV1<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
    const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
    const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
    const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
    const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
      realityArtifact: reality,
      sourceMatrixArtifact: sourceMatrix,
      configurationMatrixArtifact: configurationMatrix,
      logical_time: "2026-06-01T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
    });
    const realitySnapshot = realityBindingRuntimeSnapshotFromAuthorityArtifactV1(reality);
    const fileSource = new CanonicalReplayFileSourceV1(path.join(ROOT, "fixtures/mcft/water_state/replay_v1"));
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const runtimeService = new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fileSource);
    const nextTickService = new PrepareNextTickInputServiceV1(nextTickRepository);

    const firstAuthority = await nextTickRepository.commitRealityBindingSnapshot(realitySnapshot);
    const secondAuthority = await nextTickRepository.commitRealityBindingSnapshot(realitySnapshot);
    assert.equal(firstAuthority.status, "INSERTED");
    assert.equal(secondAuthority.status, "EXISTING_IDEMPOTENT_SUCCESS");
    ok("Reality Binding Runtime snapshot is immutable and idempotent");

    const execution = await runtimeService.execute({
      scope,
      logical_time: LOGICAL_TIME,
      created_at: LOGICAL_TIME,
      runtime_config: runtimeConfig,
      hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      lease_owner: "mcft-cap-01-remediation-db",
      lease_duration_seconds: 300,
    });
    assert.equal(execution.status, "INSERTED");
    assert.equal(await a0FactCountV1(), 9);
    ok("A0 commit remains nine canonical facts after remediation");

    const prepared = await nextTickService.prepareNextTickInput(scope);
    assert.equal(prepared.previous_posterior_ref, execution.record_set.members.find((member) => member.object_type === "twin_state_estimate_v1")?.object_id);
    assert.equal(prepared.previous_checkpoint_ref, execution.record_set.members.find((member) => member.object_type === "twin_runtime_checkpoint_v1")?.object_id);
    assert.equal(prepared.prior_mean, 0.192595);
    assert.equal(prepared.prior_variance, 0.002678);
    assert.equal(prepared.next_logical_tick_time, "2026-06-01T02:00:00.000Z");
    assert.equal(prepared.runtime_config_ref, runtimeConfig.object_id);
    assert.equal(prepared.reality_binding_ref, reality.binding_id);
    ok("prepareNextTickInput reconstructs all required fields from PostgreSQL");

    await pool.query("DELETE FROM twin_runtime_authority_snapshot_v1 WHERE authority_kind='REALITY_BINDING' AND authority_ref=$1", [reality.binding_id]);
    await assert.rejects(nextTickService.prepareNextTickInput(scope), /PERSISTED_REALITY_BINDING_NOT_FOUND/);
    await nextTickRepository.commitRealityBindingSnapshot(realitySnapshot);
    ok("persisted handoff fails closed when Reality Binding snapshot is missing");

    const originalLineage = prepared.lineage_id;
    await pool.query("UPDATE twin_active_lineage_index_v1 SET active_lineage_ref='foreign_lineage' WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id]);
    await assert.rejects(nextTickService.prepareNextTickInput(scope), /ACTIVE_LINEAGE_CHECKPOINT_MISMATCH/);
    await pool.query("UPDATE twin_active_lineage_index_v1 SET active_lineage_ref=$7 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, originalLineage]);
    ok("persisted handoff rejects active-lineage projection corruption");

    await cleanupV1();
    await nextTickRepository.commitRealityBindingSnapshot(realitySnapshot);
    const baseCandidates = await fileSource.loadCandidateRecords({ scope, logical_time: LOGICAL_TIME });
    const standard = baseCandidates.find((record) => record.record_type === "soil_moisture_observation_v1" && record.role_time.observed_at === "2026-06-01T00:50:00.000Z");
    assert.ok(standard);
    const conflict = structuredClone(standard) as CanonicalReplayEvidenceRecordV1;
    conflict.source_record_id = "mcft_src_db_conflicting_duplicate";
    conflict.canonical_payload = { ...conflict.canonical_payload, value: 0.233 };
    const conflictingSource: ReplayEvidenceSourcePortV1 = {
      async loadCandidateRecords() { return [...baseCandidates, conflict]; },
    };
    const conflictService = new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, conflictingSource);
    await assert.rejects(conflictService.execute({
      scope,
      logical_time: LOGICAL_TIME,
      created_at: LOGICAL_TIME,
      runtime_config: runtimeConfig,
      hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      lease_owner: "mcft-cap-01-remediation-conflict",
      lease_duration_seconds: 300,
    }), /CONFLICTING_DUPLICATE_OBSERVATION/);
    assert.equal(await a0FactCountV1(), 0);
    const projectionCount = await pool.query("SELECT (SELECT count(*) FROM twin_active_lineage_index_v1)+(SELECT count(*) FROM twin_state_latest_index_v1)+(SELECT count(*) FROM twin_runtime_checkpoint_latest_index_v1) AS count");
    assert.equal(Number(projectionCount.rows[0].count), 0);
    ok("conflicting duplicate observation produces zero canonical A0 facts and zero projections");

    console.log(`MCFT-CAP-01 closure remediation DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
