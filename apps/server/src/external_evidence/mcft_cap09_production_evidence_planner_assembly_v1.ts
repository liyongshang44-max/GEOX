// MCFT-CAP-09 non-activating production Evidence planner assembly.
// Builds the qualified production planning/execution object graph from explicit
// runtime-start authority plus Evidence-plane adapters. Construction performs no
// database query, provider request, raw-store I/O, timer registration, process start,
// owner activation, Formal arm, A0 bootstrap, or O00 execution.

import type { Pool } from "pg";

import type { EvidenceRuntimeCycleServiceV1 } from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type { EvidenceRuntimeScopeV1 } from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  EvidenceSourceSpecificProgressReaderV1,
} from "./mcft_cap09_evidence_source_progress_v1.js";
import type { GfsPartialPairRehydrationWorkItemFactoryV1 } from "./mcft_cap09_gfs_partial_pair_rehydration_v1.js";
import type { KbsRawHourlyPublicationCycleServiceV1 } from "./mcft_cap09_kbs_raw_hourly_publication_cycle_service_v1.js";
import {
  ProductionEvidenceHostPlannerV1,
  type ProductionEvidencePlanningClockV1,
  type ProductionEvidenceRuntimeStartAuthorityInstanceV1,
} from "./mcft_cap09_production_evidence_host_planner_v1.js";
import {
  ProductionEvidenceSourcePlanExecutorV1,
} from "./mcft_cap09_production_evidence_source_plan_executor_v1.js";
import type { ProductionEvidenceWorkItemFactoryV1 } from "./mcft_cap09_production_evidence_work_items_v1.js";
import {
  ProductionEvidenceProviderAttemptFenceFactoryV1,
} from "./mcft_cap09_production_provider_attempt_fence_v1.js";
import {
  PostgresEvidenceSourcePollScheduleV1,
} from "../persistence/external_evidence/postgres_evidence_source_poll_schedule_v1.js";
import {
  PostgresEvidenceSupplyCursorReadV1,
} from "../persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import {
  PostgresGfsRetryScheduleV1,
} from "../persistence/external_evidence/postgres_gfs_retry_schedule_v1.js";
import {
  PostgresGfsCanonicalTargetPairHistoryV1,
} from "../persistence/external_evidence/postgres_gfs_target_pair_history_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_V1" as const;

export type ProductionEvidencePlannerAssemblyExecutionDepsV1 = {
  cycle_service: Pick<EvidenceRuntimeCycleServiceV1, "executeCycle">;
  work_item_factory: Pick<
    ProductionEvidenceWorkItemFactoryV1,
    "buildKbsSoilCurrent" | "buildGfsBundle"
  >;
  gfs_partial_factory: Pick<GfsPartialPairRehydrationWorkItemFactoryV1, "buildWorkItem">;
  kbs_publication_cycle: Pick<KbsRawHourlyPublicationCycleServiceV1, "executeCycle">;
};

export type ProductionEvidencePlannerAssemblyV1 = {
  assembly_id: typeof MCFT_CAP09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_ID_V1;
  cursor_reader: PostgresEvidenceSupplyCursorReadV1;
  progress_reader: EvidenceSourceSpecificProgressReaderV1;
  source_poll_schedule: PostgresEvidenceSourcePollScheduleV1;
  gfs_retry_schedule: PostgresGfsRetryScheduleV1;
  gfs_target_pair_history: PostgresGfsCanonicalTargetPairHistoryV1;
  provider_attempt_fence_factory: ProductionEvidenceProviderAttemptFenceFactoryV1;
  source_plan_executor: ProductionEvidenceSourcePlanExecutorV1;
  host_planner: ProductionEvidenceHostPlannerV1;
  construction_database_query_count: 0;
  construction_provider_request_count: 0;
  construction_raw_store_request_count: 0;
  runtime_process_started: false;
};

function exactScopeV1(scope: EvidenceRuntimeScopeV1): EvidenceRuntimeScopeV1 {
  const keys = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
  const out = {} as EvidenceRuntimeScopeV1;
  for (const key of keys) {
    const value = scope[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_SCOPE_" + key.toUpperCase() + "_REQUIRED");
    }
    out[key] = value.trim();
  }
  return out;
}

export function assembleProductionEvidencePlannerV1(input: {
  pool: Pool;
  scope: EvidenceRuntimeScopeV1;
  runtime_start_authority: ProductionEvidenceRuntimeStartAuthorityInstanceV1;
  planning_clock: ProductionEvidencePlanningClockV1;
  execution: ProductionEvidencePlannerAssemblyExecutionDepsV1;
}): ProductionEvidencePlannerAssemblyV1 {
  const scope = exactScopeV1(input.scope);

  const cursorReader = new PostgresEvidenceSupplyCursorReadV1(input.pool, scope);
  const progressReader = new EvidenceSourceSpecificProgressReaderV1(cursorReader);
  const sourcePollSchedule = new PostgresEvidenceSourcePollScheduleV1(input.pool, scope);
  const gfsRetrySchedule = new PostgresGfsRetryScheduleV1(input.pool, scope);
  const gfsTargetPairHistory = new PostgresGfsCanonicalTargetPairHistoryV1(input.pool, scope);

  const providerAttemptFenceFactory = new ProductionEvidenceProviderAttemptFenceFactoryV1({
    source_poll_schedule: sourcePollSchedule,
    gfs_retry_schedule: gfsRetrySchedule,
    gfs_target_pair_history: gfsTargetPairHistory,
    activation_fence_time: input.runtime_start_authority.activation_fence_time,
  });

  const sourcePlanExecutor = new ProductionEvidenceSourcePlanExecutorV1({
    ...input.execution,
    runtime_start_authority_ref: input.runtime_start_authority.authority_ref,
    activation_fence_time: input.runtime_start_authority.activation_fence_time,
    provider_attempt_fence_factory: providerAttemptFenceFactory,
  });

  const hostPlanner = new ProductionEvidenceHostPlannerV1({
    scope,
    runtime_start_authority: input.runtime_start_authority,
    planning_clock: input.planning_clock,
    progress_reader: progressReader,
    source_poll_schedule: sourcePollSchedule,
    gfs_target_pair_history: gfsTargetPairHistory,
    source_plan_executor: sourcePlanExecutor,
  });

  return {
    assembly_id: MCFT_CAP09_PRODUCTION_EVIDENCE_PLANNER_ASSEMBLY_ID_V1,
    cursor_reader: cursorReader,
    progress_reader: progressReader,
    source_poll_schedule: sourcePollSchedule,
    gfs_retry_schedule: gfsRetrySchedule,
    gfs_target_pair_history: gfsTargetPairHistory,
    provider_attempt_fence_factory: providerAttemptFenceFactory,
    source_plan_executor: sourcePlanExecutor,
    host_planner: hostPlanner,
    construction_database_query_count: 0,
    construction_provider_request_count: 0,
    construction_raw_store_request_count: 0,
    runtime_process_started: false,
  };
}
