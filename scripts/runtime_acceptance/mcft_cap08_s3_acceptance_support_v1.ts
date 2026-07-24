// Purpose: provide S3-only destructive-acceptance adapters without modifying the frozen S2 G3 acceptance support.
// Boundary: disposable S3 negative database only; no production Runtime path, migration, route, scheduler, or predecessor authority change.

import assert from "node:assert/strict";
import type { Pool } from "pg";

import {
  cap08TickLogicalTimeV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import type {
  InspectCap08CompletionAuthorityInputV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.js";
import { PostgresCap08S3CompletionAuthorityPairRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s3_completion_authority_pair_repository_v1.js";
import { PostgresCompletionAuthorityRepositoryV1 as ProductionPostgresCompletionAuthorityRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 as ProductionA0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { Cap08CompletionAuthorityServiceV1 as ProductionCap08CompletionAuthorityServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.js";
import { Cap08S3OutcomeCompletionEvidenceServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_outcome_completion_evidence_service_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

import {
  CAP08_S1_CREATED_AT_V1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1 as ProductionPrepareNextTickInputServiceV1,
  admin,
  persistenceAdapterV1,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";

const S3_NEGATIVE_LEASE_OWNER_V1 = "mcft-cap08-s3-negative";

export class PostgresCompletionAuthorityRepositoryV1
extends ProductionPostgresCompletionAuthorityRepositoryV1 {
  constructor(public readonly acceptancePool: Pool) {
    super(acceptancePool);
  }
}

export class A0BootstrapRuntimeServiceV1 extends ProductionA0BootstrapRuntimeServiceV1 {
  async execute(
    input: Parameters<ProductionA0BootstrapRuntimeServiceV1["execute"]>[0],
  ): ReturnType<ProductionA0BootstrapRuntimeServiceV1["execute"]> {
    return super.execute({
      ...input,
      lease_owner: S3_NEGATIVE_LEASE_OWNER_V1,
    });
  }
}

export class PrepareNextTickInputServiceV1 extends ProductionPrepareNextTickInputServiceV1 {
  async prepareNextTickInput(
    scope: Parameters<ProductionPrepareNextTickInputServiceV1["prepareNextTickInput"]>[0],
  ): ReturnType<ProductionPrepareNextTickInputServiceV1["prepareNextTickInput"]> {
    try {
      return await super.prepareNextTickInput(scope);
    } catch (error) {
      const observed = error instanceof Error ? error.message : String(error);
      if (/^PERSISTED_OBJECT_CARDINALITY:twin_runtime_checkpoint_v1:/.test(observed)) {
        throw new Error("CHECKPOINT_PERSISTED_OBJECT_CARDINALITY");
      }
      throw error;
    }
  }
}

async function seedS3CompletionEvidenceV1(
  pool: Pool,
  input: InspectCap08CompletionAuthorityInputV1,
): Promise<void> {
  const formalFixture = buildCap08S2FormalProviderFixtureV1();
  assert.equal(input.formal_run_id, formalFixture.formal_run_id);
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
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

export class Cap08CompletionAuthorityServiceV1 {
  private readonly pair: PostgresCap08S3CompletionAuthorityPairRepositoryV1;

  constructor(private readonly repository: PostgresCompletionAuthorityRepositoryV1) {
    this.pair = new PostgresCap08S3CompletionAuthorityPairRepositoryV1(
      repository.acceptancePool,
    );
  }

  async inspect(input: InspectCap08CompletionAuthorityInputV1) {
    return this.pair.inspect(input);
  }

  async establish(input: InspectCap08CompletionAuthorityInputV1) {
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

export {
  CAP08_S1_CREATED_AT_V1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  admin,
  persistenceAdapterV1,
  runner,
};
