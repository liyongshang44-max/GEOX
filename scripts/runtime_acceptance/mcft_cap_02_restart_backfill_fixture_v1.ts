// scripts/runtime_acceptance/mcft_cap_02_restart_backfill_fixture_v1.ts
// Purpose: assemble deterministic restart/resume and bounded-backfill acceptance services, including a serializable persistence image that can be loaded by a fresh process.
// Boundary: acceptance support only; no production route, scheduler, wall clock, Forecast success, Recommendation, Decision, or action.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import type { ContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.js";
import { ContiguousContinuationRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.js";
import { ContinuationTickServiceV1, type SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_resume_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ContinuationExpectedPointersV1,
  NextTickReadPortV1,
  PersistedNextTickSnapshotV1,
  RealityBindingRuntimeSnapshotV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildMcftCap02TwentyFourTickFixtureV1 } from "./mcft_cap_02_twenty_four_tick_fixture_v1.js";

const HOUR_MS_V1 = 60 * 60 * 1000;

function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

export function memberV1(
  recordSet: { members: CanonicalObjectEnvelopeV1[] },
  objectType: string,
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`RESTART_FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

export function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS_V1).toISOString();
}

export type RestartBackfillPersistenceImageV1 = {
  snapshot: PersistedNextTickSnapshotV1 | null;
  configs: CanonicalObjectEnvelopeV1[];
  record_sets: ContinuationRecordSetV1[];
  candidate_records: CanonicalReplayEvidenceRecordV1[];
};

export type CanonicalRecordSetSignatureV1 = {
  operation_key: ContinuationRecordSetV1["continuation_operation_key"];
  idempotency_key: string;
  record_set_id: string;
  record_set_hash: string;
  member_object_ids: string[];
  member_hashes: Record<string, string>;
};

export function recordSetSignatureV1(recordSet: ContinuationRecordSetV1): CanonicalRecordSetSignatureV1 {
  return {
    operation_key: structuredClone(recordSet.continuation_operation_key),
    idempotency_key: recordSet.continuation_idempotency_key,
    record_set_id: recordSet.continuation_record_set_id,
    record_set_hash: recordSet.continuation_record_set_determinism_hash,
    member_object_ids: recordSet.members.map((member) => member.object_id),
    member_hashes: Object.fromEntries(recordSet.members.map((member) => [member.object_id, member.determinism_hash])),
  };
}

export class RestartBackfillInMemoryRuntimeV1 implements
  NextTickReadPortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  SingleTickPersistencePortV1 {
  private snapshot: PersistedNextTickSnapshotV1 | null;
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  private readonly recordsByKey = new Map<string, ContinuationRecordSetV1>();
  private readonly recordsById = new Map<string, ContinuationRecordSetV1>();
  private fencingToken = 0n;
  readonly candidateRecords: CanonicalReplayEvidenceRecordV1[];
  readonly executedLogicalTimes: string[] = [];
  leaseAcquireCount = 0;
  commitCount = 0;

  constructor(image: RestartBackfillPersistenceImageV1) {
    this.snapshot = image.snapshot ? structuredClone(image.snapshot) : null;
    for (const config of image.configs) this.configs.set(config.object_id, structuredClone(config));
    for (const recordSet of image.record_sets) {
      this.recordsByKey.set(recordSet.continuation_idempotency_key, structuredClone(recordSet));
      this.recordsById.set(recordSet.continuation_record_set_id, structuredClone(recordSet));
    }
    this.candidateRecords = structuredClone(image.candidate_records);
  }

  replaceSnapshotForNegativeV1(snapshot: PersistedNextTickSnapshotV1 | null): void {
    this.snapshot = snapshot ? structuredClone(snapshot) : null;
  }

  exportPersistenceImageV1(): RestartBackfillPersistenceImageV1 {
    return {
      snapshot: this.snapshot ? structuredClone(this.snapshot) : null,
      configs: [...this.configs.values()].map((config) => structuredClone(config)),
      record_sets: [...this.recordsById.values()].map((recordSet) => structuredClone(recordSet)),
      candidate_records: structuredClone(this.candidateRecords),
    };
  }

  orderedRecordSetsV1(): ContinuationRecordSetV1[] {
    return [...this.recordsById.values()]
      .map((recordSet) => structuredClone(recordSet))
      .sort((left, right) => left.continuation_operation_key.logical_time.localeCompare(right.continuation_operation_key.logical_time));
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    if (!this.snapshot) return null;
    if (!sameScopeV1(this.snapshot.reality_binding.scope, scope)) return null;
    return structuredClone(this.snapshot);
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!this.snapshot || !sameScopeV1(this.snapshot.reality_binding.scope, input.scope)) {
      throw new Error("RESTART_FIXTURE_EVIDENCE_SCOPE_MISMATCH");
    }
    return structuredClone(this.candidateRecords);
  }

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    const existing = this.configs.get(config.object_id);
    if (existing) {
      if (existing.determinism_hash !== config.determinism_hash) throw new Error("RUNTIME_CONFIG_IDEMPOTENCY_CONFLICT");
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object_id: config.object_id,
        fact_id: `fact_${config.object_id}`,
      };
    }
    this.configs.set(config.object_id, structuredClone(config));
    return { status: "INSERTED", object_id: config.object_id, fact_id: `fact_${config.object_id}` };
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const config = this.configs.get(objectId);
    return config ? structuredClone(config) : null;
  }

  async acquireLease(claim: Omit<RuntimeLeaseClaimV1, "fencing_token">): Promise<RuntimeLeaseClaimV1> {
    this.leaseAcquireCount += 1;
    this.fencingToken += 1n;
    return { ...claim, fencing_token: this.fencingToken };
  }

  async lookupContinuationRecordSet(idempotencyKey: string): Promise<ContinuationRecordSetV1 | null> {
    const recordSet = this.recordsByKey.get(idempotencyKey);
    return recordSet ? structuredClone(recordSet) : null;
  }

  async commitContinuationState(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    expected: ContinuationExpectedPointersV1;
    record_set: ContinuationRecordSetV1;
    fault_injection?: (stage: string) => void;
  }): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    record_set: ContinuationRecordSetV1;
    fact_ids_by_object_id: Record<string, string>;
  }> {
    const existing = this.recordsByKey.get(input.record_set.continuation_idempotency_key);
    if (existing) {
      if (existing.continuation_record_set_determinism_hash !== input.record_set.continuation_record_set_determinism_hash) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: structuredClone(existing),
        fact_ids_by_object_id: {},
      };
    }
    if (!this.snapshot) throw new Error("PERSISTED_NEXT_TICK_STATE_NOT_FOUND");
    if (input.expected.active_lineage_ref !== this.snapshot.active_lineage_ref) throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    if (input.expected.previous_checkpoint_ref !== this.snapshot.checkpoint.object_id) throw new Error("CHECKPOINT_CAS_CONFLICT");
    if (input.expected.previous_state_ref !== this.snapshot.previous_posterior.object_id) throw new Error("STATE_LATEST_CAS_CONFLICT");
    if (input.expected.previous_forecast_result_ref !== this.snapshot.checkpoint.payload.forecast_result_ref) {
      throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    }
    if (input.expected.latest_successful_forecast_ref !== null) throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");

    validateContinuationRecordSetV1(input.record_set);
    input.fault_injection?.("before_commit");
    this.commitCount += 1;
    this.executedLogicalTimes.push(input.record_set.continuation_operation_key.logical_time);
    this.recordsByKey.set(input.record_set.continuation_idempotency_key, structuredClone(input.record_set));
    this.recordsById.set(input.record_set.continuation_record_set_id, structuredClone(input.record_set));

    const state = memberV1(input.record_set, "twin_state_estimate_v1");
    const checkpoint = memberV1(input.record_set, "twin_runtime_checkpoint_v1");
    const terminalTick = memberV1(input.record_set, "twin_runtime_tick_v1");
    const config = this.configs.get(state.runtime_config_ref ?? "");
    if (!config) throw new Error("RESTART_FIXTURE_CONTINUATION_CONFIG_NOT_FOUND");
    this.snapshot = {
      ...this.snapshot,
      checkpoint: structuredClone(checkpoint),
      previous_posterior: structuredClone(state),
      last_terminal_tick: structuredClone(terminalTick),
      runtime_config: structuredClone(config),
    };

    const factIds = Object.fromEntries(
      input.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`]),
    );
    return {
      status: "INSERTED",
      record_set: structuredClone(input.record_set),
      fact_ids_by_object_id: factIds,
    };
  }

  async readContinuationRecordSet(recordSetId: string): Promise<ContinuationRecordSetV1 | null> {
    const recordSet = this.recordsById.get(recordSetId);
    return recordSet ? structuredClone(recordSet) : null;
  }

  async rebuildContinuationProjections(): Promise<{ rebuilt_projection_count: 5 }> {
    return { rebuilt_projection_count: 5 };
  }
}

export function createRestartBackfillServicesV1(runtime: RestartBackfillInMemoryRuntimeV1) {
  const handoffService = new PrepareNextTickInputServiceV1(runtime);
  const tickService = new ContinuationTickServiceV1(
    handoffService,
    runtime,
    runtime,
    runtime,
  );
  const rangeService = new ContiguousContinuationRangeServiceV1(handoffService, tickService);
  const restartService = new RestartResumeServiceV1(handoffService, rangeService);
  return { handoffService, tickService, rangeService, restartService };
}

export async function buildMcftCap02RestartBackfillFixtureV1() {
  const base = await buildMcftCap02TwentyFourTickFixtureV1();
  const a0TerminalTick = memberV1(base.a0RecordSet, "twin_runtime_tick_v1");
  const initialSnapshot: PersistedNextTickSnapshotV1 = {
    ...structuredClone(base.initialSnapshot),
    last_terminal_tick: structuredClone(a0TerminalTick),
  };
  const initialImage: RestartBackfillPersistenceImageV1 = {
    snapshot: initialSnapshot,
    configs: [structuredClone(base.parentRuntimeConfig), structuredClone(base.continuationRuntimeConfig)],
    record_sets: [],
    candidate_records: structuredClone(base.candidateRecords),
  };
  const firstLogicalTime = base.expectedFixture.first_logical_time;
  const splitTargetLogicalTime = addHoursV1(firstLogicalTime, 11);
  const request = {
    scope: structuredClone(base.scope),
    created_at: base.expectedFixture.created_at,
    continuation_runtime_config_ref: base.continuationRuntimeConfig.object_id,
    crop_stage_context_ref: base.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: base.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: structuredClone(base.cropStageContext),
    lease_owner: "mcft-cap-02-restart-backfill-acceptance",
    lease_duration_seconds: 3600,
  };
  return {
    ...base,
    initialImage,
    firstLogicalTime,
    splitTargetLogicalTime,
    finalTargetLogicalTime: base.expectedFixture.last_logical_time,
    persistedResumeStartLogicalTime: addHoursV1(splitTargetLogicalTime, 1),
    request,
  };
}

export type RestartBackfillFixtureV1 = Awaited<ReturnType<typeof buildMcftCap02RestartBackfillFixtureV1>>;
export type RestartBackfillRealitySnapshotV1 = RealityBindingRuntimeSnapshotV1;
