// scripts/runtime_acceptance/mcft_cap_04_restart_backfill_recovery_fixture_v1.ts
// Purpose: compose fresh CAP-04 service instances over one persisted in-memory authority for restart, bounded backfill and recovery acceptance.
// Boundary: acceptance support only; no production database, route, scheduler, recommendation, decision, action, calibration, model activation, or live-field claim.

import type { Cap04SingleTickPersistencePortV1, ExecuteCap04SingleTickResultV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";
import { Cap04ForecastScenarioRestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import type { ReplayEvidenceSourcePortV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.js";
import type { InMemoryCap04SingleTickRuntimeV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";
import {
  buildCap04S7RangeFixtureV1,
  type BuildCap04S7RangeFixtureOptionsV1,
  type Cap04S7RangeFixtureV1,
} from "./mcft_cap_04_twenty_four_tick_range_fixture_v1.js";

export const CAP04_S8_PROCESS_1_TARGET_LOGICAL_TIME_V1 = "2026-06-03T13:00:00.000Z";
export const CAP04_S8_FINAL_TARGET_LOGICAL_TIME_V1 = "2026-06-04T01:00:00.000Z";

export type Cap04S8ServiceCompositionV1 = {
  handoff_service: PrepareNextTickInputServiceV1;
  range_service: Cap04ForecastScenarioRangeServiceV1;
  restart_service: Cap04ForecastScenarioRestartResumeServiceV1;
};

export type Cap04S8RestartFixtureV1 = Cap04S7RangeFixtureV1 & {
  compose_fresh_services: () => Cap04S8ServiceCompositionV1;
};

function persistenceAdapterV1(runtime: InMemoryCap04SingleTickRuntimeV1): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtime.acquireLease.bind(runtime),
    lookupARecordSet: runtime.lookupARecordSet.bind(runtime),
    commitARecordSet: runtime.commitARecordSet.bind(runtime),
    readARecordSet: runtime.readARecordSet.bind(runtime),
    lookupScenarioSet: runtime.lookupScenarioSet.bind(runtime),
    commitScenarioSet: runtime.commitScenarioSet.bind(runtime),
    readScenarioSet: runtime.readScenarioSet.bind(runtime),
    readScenarioSetBySourceForecast: runtime.readScenarioSetBySourceForecast.bind(runtime),
    detectPendingScenario: async (scope) => {
      const pending = await runtime.detectPendingScenario(scope);
      if (!pending) return null;
      return pending.payload.canonical_authority_contract_id === CAP04_CANONICAL_FORECAST_AUTHORITY_CONTRACT_ID_V1
        ? pending
        : null;
    },
    rebuildForecastProjections: runtime.rebuildForecastProjections.bind(runtime),
    rebuildScenarioProjections: runtime.rebuildScenarioProjections.bind(runtime),
  };
}

export function composeCap04S8FreshServicesV1(
  runtime: InMemoryCap04SingleTickRuntimeV1,
  evidenceSource: ReplayEvidenceSourcePortV1,
): Cap04S8ServiceCompositionV1 {
  const handoff = new PrepareNextTickInputServiceV1(runtime);
  const persistence = persistenceAdapterV1(runtime);
  const inner = new Cap04ForecastScenarioSingleTickServiceV1(
    handoff,
    evidenceSource,
    runtime,
    persistence,
  );
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(
    handoff,
    runtime,
    persistence,
    inner,
  );
  const range = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier);
  return {
    handoff_service: handoff,
    range_service: range,
    restart_service: new Cap04ForecastScenarioRestartResumeServiceV1(handoff, range),
  };
}

export async function buildCap04S8RestartFixtureV1(
  options: BuildCap04S7RangeFixtureOptionsV1 = {},
): Promise<Cap04S8RestartFixtureV1> {
  const base = await buildCap04S7RangeFixtureV1(options);
  return {
    ...base,
    compose_fresh_services: () => composeCap04S8FreshServicesV1(base.runtime, base.evidence_source),
  };
}

export function cap04AHashesV1(results: readonly ExecuteCap04SingleTickResultV1[]): string[] {
  return results.map((result) => result.a_record_set.aggregate_determinism_hash);
}

export function cap04BHashesV1(results: readonly ExecuteCap04SingleTickResultV1[]): string[] {
  return results.map((result) => {
    if (!result.b_record) throw new Error("CAP04_S8_FIXTURE_SCENARIO_SET_REQUIRED");
    return result.b_record.aggregate_determinism_hash;
  });
}
