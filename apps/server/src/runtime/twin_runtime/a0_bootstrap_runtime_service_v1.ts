// apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts
// Purpose: orchestrate one controlled Replay A0 bootstrap by persisting immutable Runtime Config, freezing Evidence, building the nine-object record set, checking idempotency before lease, and committing atomically.
// Boundary: A0 integration only; no propagation, successful Forecast, Scenario, Recommendation, AO-ACT, routes, scheduler, restart/backfill, or wall-clock reads.

import type { SoilHydraulicBoundsV1 } from "../../domain/twin_runtime/physical_bounds_v1.js";
import type { A0RecordSetV1, CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { buildA0RecordSetV1 } from "./a0_record_set_builder_v1.js";
import { buildFrozenEvidenceWindowV1, type FrozenEvidenceWindowV1 } from "./evidence_window_builder_v1.js";
import type {
  BootstrapPersistencePortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type ExecuteA0BootstrapInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  hydraulic: SoilHydraulicBoundsV1;
  soil_hydraulic_config_ref: string;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type ExecuteA0BootstrapResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  runtime_config_status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  evidence_window: FrozenEvidenceWindowV1;
  record_set: A0RecordSetV1;
  fact_ids_by_object_id: Record<string, string>;
  next_tick_logical_time: string;
};

function nextTickFromRecordSetV1(recordSet: A0RecordSetV1): string {
  const checkpoint = recordSet.members.find((member) => member.object_type === "twin_runtime_checkpoint_v1");
  const nextTick = checkpoint?.payload.next_tick_logical_time;
  if (typeof nextTick !== "string" || !nextTick) throw new Error("NEXT_TICK_HANDOFF_REQUIRED");
  return nextTick;
}

export class A0BootstrapRuntimeServiceV1 {
  constructor(
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: BootstrapPersistencePortV1,
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
  ) {}

  async execute(input: ExecuteA0BootstrapInputV1): Promise<ExecuteA0BootstrapResultV1> {
    if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    if (!input.lease_owner) throw new Error("LEASE_OWNER_REQUIRED");
    if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) throw new Error("LEASE_DURATION_INVALID");

    const runtimeConfigCommit = await this.runtimeConfigRepository.commitRuntimeConfig(input.runtime_config);
    const candidateRecords = await this.evidenceSource.loadCandidateRecords({ scope: input.scope, logical_time: input.logical_time });
    const evidenceWindow = buildFrozenEvidenceWindowV1({
      scope: input.scope,
      logical_time: input.logical_time,
      candidate_records: candidateRecords,
    });
    const recordSet = buildA0RecordSetV1({
      scope: input.scope,
      logical_time: input.logical_time,
      created_at: input.created_at,
      runtime_config: input.runtime_config,
      evidence_window: evidenceWindow,
      hydraulic: input.hydraulic,
      soil_hydraulic_config_ref: input.soil_hydraulic_config_ref,
    });

    const existing = await this.persistence.lookupA0RecordSet(recordSet.a0_idempotency_key);
    if (existing) {
      if (existing.a0_record_set_id !== recordSet.a0_record_set_id || existing.a0_record_set_determinism_hash !== recordSet.a0_record_set_determinism_hash) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        runtime_config_status: runtimeConfigCommit.status,
        evidence_window: evidenceWindow,
        record_set: existing,
        fact_ids_by_object_id: Object.fromEntries(existing.members.map((member) => [member.object_id, `fact_${member.object_id}`])),
        next_tick_logical_time: nextTickFromRecordSetV1(existing),
      };
    }

    const lease = await this.persistence.acquireLease({
      ...input.scope,
      lease_owner: input.lease_owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    const committed = await this.persistence.commitBootstrapState({
      scope: input.scope,
      lease,
      expected: {
        active_lineage_ref: null,
        checkpoint_ref: null,
        state_ref: null,
        forecast_result_ref: null,
        successful_forecast_ref: null,
      },
      record_set: recordSet,
    });
    return {
      status: committed.status,
      runtime_config_status: runtimeConfigCommit.status,
      evidence_window: evidenceWindow,
      record_set: committed.record_set,
      fact_ids_by_object_id: committed.fact_ids_by_object_id,
      next_tick_logical_time: nextTickFromRecordSetV1(committed.record_set),
    };
  }
}
