// MCFT-CAP-09 Formal-v5 dedicated active Twin composition.
//
// Thin H6 successor over the frozen production Twin V2 graph. It reuses the same
// scheduler, repositories, tick service, host lifecycle and structural successor
// viability. Formal-v5 adds only:
// - the V5 forcing-viability-gated runner;
// - the V5 late-stage A18 adapter (R5/R6 -> governed LATE);
// - exact subject/epoch binding for forcing viability.
//
// No provider/R2 access and no new persistence schema.

import type { Pool } from "pg";

import {
  PostgresForecastScenarioRecoveryRepositoryV1,
} from "../../persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import {
  PostgresMcftCap09TwinCanonicalFactWriterV1,
} from "../../persistence/twin_runtime/postgres_mcft_cap09_twin_canonical_fact_writer_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  materializeExternalFormalA18CropContextV5,
} from "./external_formal_a18_crop_context_v5.js";
import {
  createStaticMcftCap09CurrentCropAuthorityResolverV1,
  type McftCap09CurrentCropAuthorityResolverPortV1,
} from "./mcft_cap09_current_crop_authority_resolver_v1.js";
import {
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  type ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  ExternalFormalV5Amendment19RunnerV2,
} from "./external_formal_v5_amendment19_runner_v2.js";
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
  PostgresExternalFormalNextTickViabilityV1,
} from "./postgres_external_formal_next_tick_viability_v1.js";
import {
  PostgresPersistentSequentialSchedulerAdapterV1,
  type PersistentSequentialSchedulerClockAuthorityV1,
} from "./postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  PostgresTwinRuntimeSuccessorViabilityV1,
} from "./postgres_twin_runtime_successor_viability_v1.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1,
  PostgresTwinRuntimeDatabaseClockV1,
  TwinRuntimeHostV1,
  type TwinRuntimeDatabaseClockPortV1,
  type TwinRuntimeHostFailureClassifierV1,
  type TwinRuntimeHostHealthPortV1,
  type TwinRuntimeHostStopPortV1,
  type TwinRuntimeHostWaitPortV1,
} from "./mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_V1" as const;

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_CONTRACT_V1 = {
  composition_id: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1,
  host_id: MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.host_id,
  canonical_graph_reused_from: "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  scheduler: "PostgresPersistentSequentialSchedulerAdapterV1",
  next_tick_repository: "PostgresNextTickRepositoryV1",
  evidence_source: "PostgresExternalFormalAmendment19EvidenceSourceV1",
  runtime_repository: "PostgresRuntimeRepositoryV1",
  forecast_scenario_repository: "PostgresForecastScenarioRecoveryRepositoryV1",
  persistent_tick_service: "ExternalFormalV3Amendment19PersistentTickServiceV1",
  one_slot_runner: "ExternalFormalV5Amendment19RunnerV2",
  forcing_viability: "PostgresExternalFormalNextTickViabilityV1",
  structural_successor_viability: "PostgresTwinRuntimeSuccessorViabilityV1",
  crop_context_materializer: "materializeExternalFormalA18CropContextV5",
  database_clock_mode: "SYSTEM_DATABASE_UTC",
  provider_request_allowed: false,
  raw_r2_fallback_allowed: false,
  historical_v4_rewritten: false,
  frozen_twin_v2_rewritten: false,
  formal_v5_active: true,
} as const;

type JsonRecordV1 = Record<string, unknown>;

export type ComposeMcftCap09FormalV5TwinRuntimeInputV1 = {
  pool: Pool;
  subject_sha: string;
  manifest: ExternalFormalV4Am19WindowManifestV2;
  crop_authority: JsonRecordV1;
  configuration_matrix: JsonRecordV1;
  current_crop_authority: JsonRecordV1;
  biological_stage_architecture_effectiveness: JsonRecordV1;
  current_crop_authority_resolver?: McftCap09CurrentCropAuthorityResolverPortV1;
  wait: TwinRuntimeHostWaitPortV1;
  health: TwinRuntimeHostHealthPortV1;
  stop: TwinRuntimeHostStopPortV1;
  failure_classifier: TwinRuntimeHostFailureClassifierV1;
  database_clock?: TwinRuntimeDatabaseClockPortV1;
  scheduler_clock_authority?: PersistentSequentialSchedulerClockAuthorityV1;
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

export function composeMcftCap09FormalV5TwinRuntimeV1(
  input: ComposeMcftCap09FormalV5TwinRuntimeInputV1,
) {
  if (!/^[0-9a-f]{40}$/.test(input.subject_sha)) {
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_SUBJECT_SHA_INVALID");
  }

  const runtimeRepository = new PostgresRuntimeRepositoryV1(input.pool);
  const nextTickRepository = new PostgresNextTickRepositoryV1(input.pool);
  const forecastScenarioRepository =
    new PostgresForecastScenarioRecoveryRepositoryV1(
      input.pool,
      new PostgresMcftCap09TwinCanonicalFactWriterV1(),
    );
  const evidenceSource =
    new PostgresExternalFormalAmendment19EvidenceSourceV1(input.pool);

  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
    input.pool,
    {
      scope: input.manifest.scope,
      schedule_start_logical_time: input.manifest.o00_logical_time,
    },
    input.scheduler_clock_authority ?? { mode: "SYSTEM_DATABASE_UTC" },
  );

  const tickService = new ExternalFormalV3Amendment19PersistentTickServiceV1(
    new PrepareNextTickInputServiceV1(nextTickRepository),
    evidenceSource,
    runtimeRepository,
    cap04PersistencePortV1(forecastScenarioRepository),
  );

  const currentCropAuthorityResolver =
    input.current_crop_authority_resolver
    ?? createStaticMcftCap09CurrentCropAuthorityResolverV1(
      input.current_crop_authority,
    );

  const materializer = {
    materialize(materializeInput: {
      logical_time: string;
      expected_identity_hash: string;
    }) {
      const currentCropAuthority = currentCropAuthorityResolver.resolve({
        logical_time: materializeInput.logical_time,
      });
      return materializeExternalFormalA18CropContextV5({
        logical_time: materializeInput.logical_time,
        expected_identity_hash: materializeInput.expected_identity_hash,
        crop_authority: input.crop_authority,
        configuration_matrix: input.configuration_matrix,
        current_crop_authority: currentCropAuthority,
        biological_stage_architecture_effectiveness:
          input.biological_stage_architecture_effectiveness,
        activation_mode: "PRODUCTION_EFFECTIVE",
      });
    },
  };

  const forcingViability = new PostgresExternalFormalNextTickViabilityV1(
    input.pool,
    {
      scope: input.manifest.scope,
      epoch_id: input.manifest.epoch_id,
      subject_sha: input.subject_sha,
      o00_logical_time: input.manifest.o00_logical_time,
    },
  );

  const runner = new ExternalFormalV5Amendment19RunnerV2(
    input.manifest,
    scheduler,
    runtimeRepository,
    materializer,
    evidenceSource,
    tickService,
    forcingViability,
  );

  const structuralSuccessorViability =
    new PostgresTwinRuntimeSuccessorViabilityV1(
      input.pool,
      {
        scope: input.manifest.scope,
        schedule_start_logical_time: input.manifest.o00_logical_time,
      },
    );

  const host = new TwinRuntimeHostV1({
    database_clock:
      input.database_clock ?? new PostgresTwinRuntimeDatabaseClockV1(input.pool),
    scheduler_ownership: scheduler,
    one_due_slot: runner,
    successor_viability: structuralSuccessorViability,
    wait: input.wait,
    health: input.health,
    stop: input.stop,
    failure_classifier: input.failure_classifier,
  });

  return {
    composition_id: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1,
    host,
    runner,
    scheduler,
    forcing_viability: forcingViability,
    structural_successor_viability: structuralSuccessorViability,
    evidence_source: evidenceSource,
    runtime_repository: runtimeRepository,
    next_tick_repository: nextTickRepository,
    forecast_scenario_repository: forecastScenarioRepository,
  };
}
