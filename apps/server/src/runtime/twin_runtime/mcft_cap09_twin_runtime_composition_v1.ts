// MCFT-CAP-09 Production Hosting Phase 4: production Twin Runtime composition.
//
// This module lifts the exact one-slot production wiring out of acceptance-only scripts.
// It constructs the existing canonical scheduler/evidence/next-tick/persistence/tick/runner
// graph and wraps that same runner in TwinRuntimeHostV1.
//
// Inputs are already-governed runtime authorities. This module does not read files,
// environment variables, GitHub metadata, provider endpoints, R2/S3, or Formal arm state.

import type { Pool } from "pg";

import {
  PostgresForecastScenarioRecoveryRepositoryV1,
} from "../../persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  materializeExternalFormalA18CropContextV3,
} from "./external_formal_a18_crop_context_v3.js";
import {
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  ExternalFormalV3Amendment19RunnerV1,
  type ExternalFormalV3Am19WindowManifestV1,
} from "./external_formal_v3_amendment19_runner_v1.js";
import type {
  Cap04ForecastScenarioPersistencePortV1,
} from "./forecast_scenario_persistence_ports_v1.js";
import {
  PrepareNextTickInputServiceV1,
} from "./next_tick_input_service_v1.js";
import {
  PostgresExternalFormalAmendment19EvidenceSourceV1,
} from "./postgres_external_formal_amendment19_evidence_source_v1.js";
import {
  PostgresPersistentSequentialSchedulerAdapterV1,
} from "./postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  PostgresTwinRuntimeSuccessorViabilityV1,
} from "./postgres_twin_runtime_successor_viability_v1.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1,
  PostgresTwinRuntimeDatabaseClockV1,
  TwinRuntimeHostV1,
  type TwinRuntimeHostFailureClassifierV1,
  type TwinRuntimeHostHealthPortV1,
  type TwinRuntimeHostStopPortV1,
  type TwinRuntimeHostWaitPortV1,
} from "./mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_ID_V1 =
  "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V1" as const;

export const MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_CONTRACT_V1 = {
  composition_id: MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_ID_V1,
  host_id: MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.host_id,
  scheduler: "PostgresPersistentSequentialSchedulerAdapterV1",
  scheduler_clock_mode: "SYSTEM_DATABASE_UTC",
  next_tick_repository: "PostgresNextTickRepositoryV1",
  evidence_source: "PostgresExternalFormalAmendment19EvidenceSourceV1",
  evidence_authority: "GOVERNED_POSTGRES_FACTS_ONLY",
  runtime_repository: "PostgresRuntimeRepositoryV1",
  forecast_scenario_repository: "PostgresForecastScenarioRecoveryRepositoryV1",
  persistent_tick_service:
    "ExternalFormalV3Amendment19PersistentTickServiceV1",
  one_slot_runner: "ExternalFormalV3Amendment19RunnerV1",
  successor_viability: "PostgresTwinRuntimeSuccessorViabilityV1",
  crop_context_materializer: "materializeExternalFormalA18CropContextV3",
  provider_request_allowed: false,
  raw_r2_fallback_allowed: false,
  evidence_supply_cursor_mutation_allowed: false,
  evidence_producer_lease_mutation_allowed: false,
  second_canonical_tick_path_allowed: false,
  production_container_activation: false,
  formal_v5_arm: false,
} as const;

type JsonRecordV1 = Record<string, unknown>;

export type ComposeMcftCap09TwinRuntimeInputV1 = {
  pool: Pool;
  manifest: ExternalFormalV3Am19WindowManifestV1;
  crop_authority: JsonRecordV1;
  configuration_matrix: JsonRecordV1;
  wait: TwinRuntimeHostWaitPortV1;
  health: TwinRuntimeHostHealthPortV1;
  stop: TwinRuntimeHostStopPortV1;
  failure_classifier: TwinRuntimeHostFailureClassifierV1;
};

export type McftCap09TwinRuntimeCompositionV1 = {
  composition_id: typeof MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_ID_V1;
  host: TwinRuntimeHostV1;
  runner: ExternalFormalV3Amendment19RunnerV1;
  scheduler: PostgresPersistentSequentialSchedulerAdapterV1;
  successor_viability: PostgresTwinRuntimeSuccessorViabilityV1;
  evidence_source: PostgresExternalFormalAmendment19EvidenceSourceV1;
  runtime_repository: PostgresRuntimeRepositoryV1;
  next_tick_repository: PostgresNextTickRepositoryV1;
  forecast_scenario_repository: PostgresForecastScenarioRecoveryRepositoryV1;
};

function cap04PersistencePortV1(
  repository: PostgresForecastScenarioRecoveryRepositoryV1,
): Cap04ForecastScenarioPersistencePortV1 {
  return {
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    commitARecordSet: repository.commitARecordSet.bind(repository),
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    commitScenarioSet: repository.commitScenarioSet.bind(repository),
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast:
      repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections:
      repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections:
      repository.rebuildScenarioProjections.bind(repository),
  };
}

export function composeMcftCap09TwinRuntimeV1(
  input: ComposeMcftCap09TwinRuntimeInputV1,
): McftCap09TwinRuntimeCompositionV1 {
  const runtimeRepository = new PostgresRuntimeRepositoryV1(input.pool);
  const nextTickRepository = new PostgresNextTickRepositoryV1(input.pool);
  const forecastScenarioRepository =
    new PostgresForecastScenarioRecoveryRepositoryV1(input.pool);
  const evidenceSource =
    new PostgresExternalFormalAmendment19EvidenceSourceV1(input.pool);

  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
    input.pool,
    {
      scope: input.manifest.scope,
      schedule_start_logical_time: input.manifest.o00_logical_time,
    },
    { mode: "SYSTEM_DATABASE_UTC" },
  );

  const tickService = new ExternalFormalV3Amendment19PersistentTickServiceV1(
    new PrepareNextTickInputServiceV1(nextTickRepository),
    evidenceSource,
    runtimeRepository,
    cap04PersistencePortV1(forecastScenarioRepository),
  );

  const materializer = {
    materialize(materializeInput: {
      logical_time: string;
      expected_identity_hash: string;
    }) {
      return materializeExternalFormalA18CropContextV3({
        logical_time: materializeInput.logical_time,
        expected_identity_hash: materializeInput.expected_identity_hash,
        crop_authority: input.crop_authority,
        configuration_matrix: input.configuration_matrix,
      });
    },
  };

  const runner = new ExternalFormalV3Amendment19RunnerV1(
    input.manifest,
    scheduler,
    runtimeRepository,
    materializer,
    evidenceSource,
    tickService,
  );

  const successorViability = new PostgresTwinRuntimeSuccessorViabilityV1(
    input.pool,
    {
      scope: input.manifest.scope,
      schedule_start_logical_time: input.manifest.o00_logical_time,
    },
  );

  const host = new TwinRuntimeHostV1({
    database_clock: new PostgresTwinRuntimeDatabaseClockV1(input.pool),
    one_due_slot: runner,
    successor_viability: successorViability,
    wait: input.wait,
    health: input.health,
    stop: input.stop,
    failure_classifier: input.failure_classifier,
  });

  return {
    composition_id: MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_ID_V1,
    host,
    runner,
    scheduler,
    successor_viability: successorViability,
    evidence_source: evidenceSource,
    runtime_repository: runtimeRepository,
    next_tick_repository: nextTickRepository,
    forecast_scenario_repository: forecastScenarioRepository,
  };
}
