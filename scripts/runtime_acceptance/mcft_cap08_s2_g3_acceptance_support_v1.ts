// scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts
// Purpose: share exact fresh-PostgreSQL fixture, persistence adapters, source digest, mutation snapshots, and explicitly bounded authority adapters for CAP-08 acceptance.
// Boundary: destructive disposable-database acceptance support only; no production database, route, scheduler, formal candidate, Runtime authority, or product claim.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  CAP08_PHASE_ORDER_V1,
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP08_COMPLETION_AUTHORITY_KIND_V1,
  cap08CompletionAuthorityStorageRefV1,
  type InspectCap08CompletionAuthorityInputV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import { PostgresCap08S3CompletionAuthorityPairRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.js";
import { PostgresCompletionAuthorityRepositoryV1 as ProductionPostgresCompletionAuthorityRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { Cap08CompletionAuthorityServiceV1 as ProductionCap08CompletionAuthorityServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.js";
import { Cap08DeferredScenarioPersistenceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.js";
import { Cap08FrozenEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.js";
import { Cap08S1BaseRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.js";
import { Cap08S1BaseRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.js";
import { Cap08S1BaseTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_tick_service_v1.js";
import { Cap08S3OutcomeCompletionEvidenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap08S1FixtureV1, CAP08_S1_CREATED_AT_V1 } from "./mcft_cap_08_s1_fixture_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S2_G3_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S2_G3_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = String(process.env.DATABASE_URL || "");
const adminDatabaseUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || "");
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
if (!adminDatabaseUrl) throw new Error("MCFT_CAP08_ADMIN_DATABASE_URL_REQUIRED");
export const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap08|s2|g3|candidate|acceptance|test)/.test(databaseName)) {
  throw new Error("CAP08_S2_G3_FRESH_ACCEPTANCE_DATABASE_REQUIRED");
}
if (new URL(adminDatabaseUrl).pathname.replace(/^\//, "").toLowerCase() !== databaseName) {
  throw new Error("CAP08_S2_G3_ADMIN_DATABASE_MISMATCH");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB_RESULT.json");

export const runner = new Pool({ connectionString: databaseUrl, max: 4 });
export const admin = new Pool({ connectionString: adminDatabaseUrl, max: 2 });

export class PostgresCompletionAuthorityRepositoryV1
extends ProductionPostgresCompletionAuthorityRepositoryV1 {
  constructor(public readonly acceptancePool: Pool) {
    super(acceptancePool);
  }
}

function s3NegativeModeV1(): boolean {
  return process.env.MCFT_CAP08_S3_NEGATIVE_DESTRUCTIVE_ACCEPTANCE === "1";
}

async function seedS3CompletionEvidenceV1(
  pool: Pool,
  input: InspectCap08CompletionAuthorityInputV1,
): Promise<void> {
  const formalFixture = buildCap08S2FormalProviderFixtureV1();
  assert.equal(input.formal_run_id, formalFixture.formal_run_id);
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    assert.equal(input.scope[field], formalFixture.scope[field]);
  }
  const records = await formalFixture.formal_evidence_source.loadCandidateRecords({
    scope: input.scope,
    logical_time: cap08TickLogicalTimeV1(10),
  });
  const outcome = records.find((record) => record.source_record_id === "FVO-10");
  assert.ok(outcome, "CAP08_S3_NEGATIVE_FVO10_FIXTURE_REQUIRED");
  const evidence = new Cap08S3OutcomeCompletionEvidenceServiceV1(pool);
  await evidence.commitOutcomeAbsenceWitness({
    formal_run_id: input.formal_run_id,
    scope: input.scope,
  });
  await evidence.commitOutcomeFvo10({
    formal_run_id: input.formal_run_id,
    scope: input.scope,
    record: outcome,
  });
}

// Acceptance-only mode adapter: S1/S2 tests retain the original generic service.
// The S3-N21 harness selects the production atomic pair repository and seeds only
// the two completion-evidence facts that its older Tick helper did not persist.
export class Cap08CompletionAuthorityServiceV1 {
  private readonly generic: ProductionCap08CompletionAuthorityServiceV1;
  private readonly pair: PostgresCap08S3CompletionAuthorityPairRepositoryV1;

  constructor(private readonly repository: PostgresCompletionAuthorityRepositoryV1) {
    this.generic = new ProductionCap08CompletionAuthorityServiceV1(repository);
    this.pair = new PostgresCap08S3CompletionAuthorityPairRepositoryV1(
      repository.acceptancePool,
    );
  }

  async inspect(input: InspectCap08CompletionAuthorityInputV1) {
    return s3NegativeModeV1()
      ? this.pair.inspect(input)
      : this.generic.inspect(input);
  }

  async establish(input: InspectCap08CompletionAuthorityInputV1) {
    if (!s3NegativeModeV1()) return this.generic.establish(input);
    await seedS3CompletionEvidenceV1(this.repository.acceptancePool, input);
    return this.pair.establish(input);
  }

  static dispositionRequiresExecutionV1(
    disposition: "NOT_STARTED" | "RESUMABLE" | "ALREADY_COMPLETE_EXACT",
  ): boolean {
    return ProductionCap08CompletionAuthorityServiceV1
      .dispositionRequiresExecutionV1(disposition);
  }
}

export function sourceDigestV1(): string {
  const files = [
    "apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts",
  ].sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(ROOT, file)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function persistenceAdapterV1(
  runtimeRepository: PostgresRuntimeRepositoryV1,
  repository: PostgresForecastScenarioRecoveryRepositoryV1,
  order: string[],
): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtimeRepository.acquireLease.bind(runtimeRepository),
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    async commitARecordSet(input) {
      const result = await repository.commitARecordSet(input);
      order.push(`A:${input.record_set.operation_key.logical_time}`);
      return result;
    },
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    async commitScenarioSet(input) {
      const result = await repository.commitScenarioSet(input);
      order.push(`B:${input.record.scenario_set.logical_time}`);
      return result;
    },
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast: repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections: repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections: repository.rebuildScenarioProjections.bind(repository),
  };
}

export function cloneV1<T>(value: T): T {
  return structuredClone(value);
}

export function scopeValuesV1(scope: TwinScopeKeyV1): unknown[] {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
}

async function tableRowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}

export async function invariantSnapshotV1(): Promise<Record<string, unknown>> {
  const factRows = await admin.query(
    `SELECT fact_id,record_json->>'type' AS object_type,
            record_json->'payload'->>'object_id' AS object_id,
            record_json->'payload'->>'determinism_hash' AS determinism_hash
       FROM facts ORDER BY fact_id`,
  );
  return {
    facts: factRows.rows,
    authority_snapshots: await tableRowsV1("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    active_lineage: await tableRowsV1("twin_active_lineage_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    checkpoint_latest: await tableRowsV1("twin_runtime_checkpoint_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    state_latest: await tableRowsV1("twin_state_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    forecast_latest: await tableRowsV1("twin_forecast_result_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    scenario_latest: await tableRowsV1("twin_scenario_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    leases: await tableRowsV1("twin_runtime_lease_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    scenario_projection_count: Number((await admin.query("SELECT count(*)::int AS n FROM twin_scenario_set_projection_v1")).rows[0].n),
  };
}

export async function authorityRowV1(authorityRef: string): Promise<Record<string, any>> {
  const result = await admin.query(
    `SELECT authority_kind,authority_ref,determinism_hash,semantic_payload,created_at
       FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1 AND authority_ref=$2`,
    [CAP08_COMPLETION_AUTHORITY_KIND_V1, authorityRef],
  );
  assert.equal(result.rows.length, 1, "CAP08_G3_AUTHORITY_ROW_REQUIRED");
  return result.rows[0] as Record<string, any>;
}

export function writeResultV1(value: unknown): void {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export {
  assert,
  CAP08_PHASE_ORDER_V1,
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
  CAP08_COMPLETION_AUTHORITY_KIND_V1,
  cap08CompletionAuthorityStorageRefV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  Cap08S1BaseRangeServiceV1,
  Cap08S1BaseRuntimeServiceV1,
  Cap08S1BaseTickServiceV1,
  PrepareNextTickInputServiceV1,
  buildCap08S1FixtureV1,
  CAP08_S1_CREATED_AT_V1,
};
export type { InspectCap08CompletionAuthorityInputV1 };
