// MCFT-CAP-09 G11 productionization-only Formal-v5 Twin composition.
//
// This is a thin successor of Composition V2. It intentionally reuses the same
// scheduler, persistence, evidence, tick and stage materialization components.
// The only runner change is the already-qualified V5 viability-gated wrapper.

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
  type PersistentSequentialSchedulerClockAuthorityV1,
  type TwinRuntimeSchedulerOwnershipLeaseClaimV1,
} from "./postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  PostgresTwinRuntimeSuccessorViabilityV1,
} from "./postgres_twin_runtime_successor_viability_v1.js";
import {
  PostgresExternalFormalNextTickViabilityV1,
} from "./postgres_external_formal_next_tick_viability_v1.js";
import {
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  ExternalFormalV5Amendment19RunnerV2,
} from "./external_formal_v5_amendment19_runner_v2.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  createStaticMcftCap09CurrentCropAuthorityResolverV1,
  type McftCap09CurrentCropAuthorityResolverPortV1,
} from "./mcft_cap09_current_crop_authority_resolver_v1.js";
import {
  materializeMcftCap09TwinCropContextV2,
} from "./mcft_cap09_twin_runtime_composition_v2.js";
import {
  MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1,
  PostgresTwinRuntimeDatabaseClockV1,
  TwinRuntimeHostV1,
  type TwinRuntimeDatabaseClockPortV1,
  type TwinRuntimeHostFailureClassifierV1,
  type TwinRuntimeHostHealthPortV1,
  type TwinRuntimeHostStopPortV1,
  type TwinRuntimeHostWaitPortV1,
  type TwinRuntimeOneDueSlotPortV1,
  type TwinRuntimeOneDueSlotResultV1,
} from "./mcft_cap09_twin_runtime_host_v1.js";
import type {
  ShadowOnlineSlotIdV1,
} from "./ports.js";

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_V1" as const;

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_CONTRACT_V1 = {
  composition_id: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1,
  activation_mode: "FORMAL_V5_ACTIVE",
  predecessor_composition: "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  host_id: MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.host_id,
  scheduler: "PostgresPersistentSequentialSchedulerAdapterV1",
  runtime_repository: "PostgresRuntimeRepositoryV1",
  evidence_source: "PostgresExternalFormalAmendment19EvidenceSourceV1",
  persistent_tick_service: "ExternalFormalV3Amendment19PersistentTickServiceV1",
  crop_context_materializer: "materializeMcftCap09TwinCropContextV2",
  one_slot_runner: "ExternalFormalV5Amendment19RunnerV2",
  preclaim_viability: "PostgresExternalFormalNextTickViabilityV1",
  post_terminal_runtime_viability: "PostgresTwinRuntimeSuccessorViabilityV1",
  provider_request_allowed: false,
  raw_r2_fallback_allowed: false,
  scheduler_semantics_rewritten: false,
  persistent_tick_semantics_rewritten: false,
  stage_materialization_semantics_rewritten: false,
  revision_semantics_rewritten: false,
  database_schema_changed: false,
  historical_v2_rewritten: false,
} as const;

type JsonRecordV1 = Record<string, unknown>;

export type ComposeMcftCap09FormalV5TwinRuntimeInputV1 = {
  pool: Pool;
  manifest: ExternalFormalV4Am19WindowManifestV2;
  subject_sha: string;
  epoch_id: string;
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
    throw new Error("FORMAL_V5_TWIN_COMPOSITION_SUBJECT_INVALID");
  }
  if (!input.epoch_id.trim()) {
    throw new Error("FORMAL_V5_TWIN_COMPOSITION_EPOCH_REQUIRED");
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
      return materializeMcftCap09TwinCropContextV2(
        {
          crop_authority: input.crop_authority,
          configuration_matrix: input.configuration_matrix,
          biological_stage_architecture_effectiveness:
            input.biological_stage_architecture_effectiveness,
          current_crop_authority_resolver: currentCropAuthorityResolver,
        },
        materializeInput,
      );
    },
  };

  const forcingViability = new PostgresExternalFormalNextTickViabilityV1(
    input.pool,
    {
      scope: input.manifest.scope,
      epoch_id: input.epoch_id,
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

  const successorViability = new PostgresTwinRuntimeSuccessorViabilityV1(
    input.pool,
    {
      scope: input.manifest.scope,
      schedule_start_logical_time: input.manifest.o00_logical_time,
    },
  );

  const hostRunner: TwinRuntimeOneDueSlotPortV1 = {
    async executeOneDueSlot(hostInput): Promise<TwinRuntimeOneDueSlotResultV1> {
      const result = await runner.executeOneDueSlot(hostInput);
      if (
        result.status === "NOT_READY_PRECLAIM"
        && result.reason === "NEXT_TICK_FORCING_NOT_VIABLE"
      ) {
        if (!/^O(?:0\d|1\d|2[0-3])$/.test(result.slot_id)) {
          throw new Error("FORMAL_V5_TWIN_HOST_SLOT_ID_INVALID:" + result.slot_id);
        }
        return {
          status: "NOT_READY_PRECLAIM",
          slot_id: result.slot_id as ShadowOnlineSlotIdV1,
          logical_time: result.logical_time,
          reason: result.reason,
          detail: result.detail,
          provider_request_count: 0,
          r2_request_count: 0,
        };
      }
      return result;
    },
  };

  const host = new TwinRuntimeHostV1({
    database_clock:
      input.database_clock ?? new PostgresTwinRuntimeDatabaseClockV1(input.pool),
    scheduler_ownership: scheduler,
    one_due_slot: hostRunner,
    successor_viability: successorViability,
    wait: input.wait,
    health: input.health,
    stop: input.stop,
    failure_classifier: input.failure_classifier,
  });

  return {
    composition_id: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_ID_V1,
    contract: MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_COMPOSITION_CONTRACT_V1,
    host,
    runner,
    scheduler,
    forcing_viability: forcingViability,
    successor_viability: successorViability,
    evidence_source: evidenceSource,
    runtime_repository: runtimeRepository,
    next_tick_repository: nextTickRepository,
    forecast_scenario_repository: forecastScenarioRepository,
  };
}

// ACTIVE lifecycle admission after proven A0. No slot claim, tick or authority projection
// is written here. The frozen V5 gate requires this cursor before its first claim;
// the frozen adapter's normal cursor initializer otherwise lives inside claimDueSlot.
export async function initializeMcftCap09FormalV5ActiveCursorV1(input: {
  pool: Pool;
  manifest: ExternalFormalV4Am19WindowManifestV2;
  claim: TwinRuntimeSchedulerOwnershipLeaseClaimV1;
}): Promise<"CREATED" | "EXISTING"> {
  const keys = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
  if (!keys.every(key => input.claim.scope[key] === input.manifest.scope[key])) {
    throw new Error("FORMAL_V5_ACTIVE_CURSOR_LEASE_SCOPE_MISMATCH");
  }
  const scopeValues = keys.map(key => input.manifest.scope[key]);
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    const lease = await client.query<{lease_owner: string; fencing_token: string; valid: boolean}>(`
      SELECT lease_owner, fencing_token::text, expires_at > transaction_timestamp() AS valid
        FROM public.twin_runtime_lease_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       FOR UPDATE`, scopeValues);
    if (lease.rows.length !== 1 || lease.rows[0].lease_owner !== input.claim.lease_owner
        || lease.rows[0].fencing_token !== input.claim.fencing_token.toString() || !lease.rows[0].valid) {
      throw new Error("FORMAL_V5_ACTIVE_CURSOR_CURRENT_FENCING_REQUIRED");
    }
    const readCursor = () => client.query<{schedule_start_logical_time: Date; next_slot_index: number;
      next_slot_id: string | null; next_logical_time: Date | null}>(`
      SELECT schedule_start_logical_time, next_slot_index, next_slot_id, next_logical_time
        FROM public.twin_shadow_online_scheduler_cursor_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
       FOR UPDATE`, scopeValues);
    let cursor = await readCursor();
    let status: "CREATED" | "EXISTING" = "EXISTING";
    if (cursor.rows.length === 0) {
      const slots = await client.query(`SELECT 1 FROM public.twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 LIMIT 1`, scopeValues);
      if (slots.rows.length !== 0) throw new Error("FORMAL_V5_ACTIVE_CURSOR_ORPHAN_SLOTS_FORBIDDEN");
      const inserted = await client.query(`INSERT INTO public.twin_shadow_online_scheduler_cursor_v1
        (tenant_id,project_id,group_id,field_id,season_id,zone_id,
         schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time)
        VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,0,'O00',$7::timestamptz)
        ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO NOTHING
        RETURNING next_slot_index`, [...scopeValues, input.manifest.o00_logical_time]);
      status = inserted.rows.length === 1 ? "CREATED" : "EXISTING";
      cursor = await readCursor();
    }
    const row = cursor.rows[0];
    const index = row?.next_slot_index;
    const pin = Number.isInteger(index) && index >= 0 && index < 24 ? input.manifest.slots[index] : null;
    if (cursor.rows.length !== 1 || !row || !Number.isInteger(index) || index < 0 || index > 24
        || new Date(row.schedule_start_logical_time).toISOString() !== input.manifest.o00_logical_time
        || row.next_slot_id !== (pin?.slot_id ?? null)
        || (row.next_logical_time === null ? null : new Date(row.next_logical_time).toISOString()) !== (pin?.logical_time ?? null)) {
      throw new Error("FORMAL_V5_ACTIVE_CURSOR_MANIFEST_CONFLICT");
    }
    await client.query("COMMIT");
    return status;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {client.release();}
}
