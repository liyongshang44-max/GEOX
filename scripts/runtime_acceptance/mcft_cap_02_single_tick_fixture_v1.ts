// scripts/runtime_acceptance/mcft_cap_02_single_tick_fixture_v1.ts
// Purpose: assemble real MCFT-CAP-01 predecessor identities, frozen MCFT-CAP-02 Evidence/config fixtures, and a deterministic in-memory persistence runtime for single-tick application acceptance.
// Boundary: acceptance support only; no production route, scheduler, range, restart, backfill, Forecast success, Recommendation, or action.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { A0RecordSetV1, CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import type { ContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/continuation_record_set_identity_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
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
import type { SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.js";
import { buildMcftCap02PersistenceFixtureV1 } from "./mcft_cap_02_persistence_fixture_v1.js";

export const SINGLE_TICK_FIXTURE_ROOT_V1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SINGLE_TICK_FIXTURE_ROOT_V1, relativePath), "utf8")) as T;
}

function memberV1(recordSet: { members: CanonicalObjectEnvelopeV1[] }, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

export type SingleTickExpectedFixtureV1 = {
  schema_version: string;
  case_id: string;
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  expected: Record<string, unknown>;
};

export type EvidenceFixtureV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  candidate_records: CanonicalReplayEvidenceRecordV1[];
};

export class InMemorySingleTickRuntimeV1 implements
  NextTickReadPortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  SingleTickPersistencePortV1 {
  private snapshot: PersistedNextTickSnapshotV1;
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  private readonly recordsByKey = new Map<string, ContinuationRecordSetV1>();
  private readonly recordsById = new Map<string, ContinuationRecordSetV1>();
  private fencingToken = 0n;
  readonly candidateRecords: CanonicalReplayEvidenceRecordV1[];
  leaseAcquireCount = 0;
  commitCount = 0;

  constructor(input: {
    snapshot: PersistedNextTickSnapshotV1;
    configs: CanonicalObjectEnvelopeV1[];
    candidate_records: CanonicalReplayEvidenceRecordV1[];
  }) {
    this.snapshot = structuredClone(input.snapshot);
    for (const config of input.configs) this.configs.set(config.object_id, structuredClone(config));
    this.candidateRecords = structuredClone(input.candidate_records);
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    if (!sameScopeV1(this.snapshot.reality_binding.scope, scope)) return null;
    return structuredClone(this.snapshot);
  }

  async loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!sameScopeV1(this.snapshot.reality_binding.scope, input.scope)) throw new Error("FIXTURE_EVIDENCE_SCOPE_MISMATCH");
    return structuredClone(this.candidateRecords);
  }

  async commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; object_id: string; fact_id: string }> {
    const existing = this.configs.get(config.object_id);
    if (existing) {
      if (existing.determinism_hash !== config.determinism_hash) throw new Error("RUNTIME_CONFIG_IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", object_id: config.object_id, fact_id: `fact_${config.object_id}` };
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
    const existing = this.recordsByKey.get(idempotencyKey);
    return existing ? structuredClone(existing) : null;
  }

  async commitContinuationState(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    expected: ContinuationExpectedPointersV1;
    record_set: ContinuationRecordSetV1;
    fault_injection?: (stage: string) => void;
  }): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; record_set: ContinuationRecordSetV1; fact_ids_by_object_id: Record<string, string> }> {
    const existing = this.recordsByKey.get(input.record_set.continuation_idempotency_key);
    if (existing) {
      if (existing.continuation_record_set_determinism_hash !== input.record_set.continuation_record_set_determinism_hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record_set: structuredClone(existing), fact_ids_by_object_id: {} };
    }
    if (input.expected.active_lineage_ref !== this.snapshot.active_lineage_ref) throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    if (input.expected.previous_checkpoint_ref !== this.snapshot.checkpoint.object_id) throw new Error("CHECKPOINT_CAS_CONFLICT");
    if (input.expected.previous_state_ref !== this.snapshot.previous_posterior.object_id) throw new Error("STATE_LATEST_CAS_CONFLICT");
    if (input.expected.previous_forecast_result_ref !== this.snapshot.checkpoint.payload.forecast_result_ref) throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    if (input.expected.latest_successful_forecast_ref !== null) throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");
    validateContinuationRecordSetV1(input.record_set);
    input.fault_injection?.("before_commit");
    this.commitCount += 1;
    this.recordsByKey.set(input.record_set.continuation_idempotency_key, structuredClone(input.record_set));
    this.recordsById.set(input.record_set.continuation_record_set_id, structuredClone(input.record_set));
    const state = memberV1(input.record_set, "twin_state_estimate_v1");
    const checkpoint = memberV1(input.record_set, "twin_runtime_checkpoint_v1");
    const config = this.configs.get(state.runtime_config_ref ?? "");
    if (!config) throw new Error("FIXTURE_CONTINUATION_CONFIG_NOT_FOUND");
    this.snapshot = {
      ...this.snapshot,
      checkpoint: structuredClone(checkpoint),
      previous_posterior: structuredClone(state),
      runtime_config: structuredClone(config),
    };
    const factIds = Object.fromEntries(input.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`]));
    return { status: "INSERTED", record_set: structuredClone(input.record_set), fact_ids_by_object_id: factIds };
  }

  async readContinuationRecordSet(recordSetId: string): Promise<ContinuationRecordSetV1 | null> {
    const recordSet = this.recordsById.get(recordSetId);
    return recordSet ? structuredClone(recordSet) : null;
  }

  async rebuildContinuationProjections(): Promise<{ rebuilt_projection_count: 5 }> {
    return { rebuilt_projection_count: 5 };
  }
}

export async function buildMcftCap02SingleTickFixtureV1(): Promise<{
  lock: Record<string, unknown> & { active_lineage_object_ref: string; lineage_id: string; revision_id: string; reality_binding_ref: string; reality_binding_hash: string; geometry_semantic_hash: string };
  scope: TwinScopeKeyV1;
  parentRuntimeConfig: CanonicalObjectEnvelopeV1;
  continuationRuntimeConfig: CanonicalObjectEnvelopeV1;
  a0RecordSet: A0RecordSetV1;
  expectedFixture: SingleTickExpectedFixtureV1;
  evidenceFixture: EvidenceFixtureV1;
  cropStageContext: ContinuationCropStageConfigurationContextV1;
  realityBindingSnapshot: RealityBindingRuntimeSnapshotV1;
  initialSnapshot: PersistedNextTickSnapshotV1;
}> {
  const persistence = await buildMcftCap02PersistenceFixtureV1();
  const expectedFixture = readJsonV1<SingleTickExpectedFixtureV1>(
    "fixtures/mcft/water_state/expected/MCFT_CAP_02_SINGLE_TICK_FIXTURES.json",
  );
  const evidenceFixture = readJsonV1<EvidenceFixtureV1>(
    "fixtures/mcft/water_state/expected/MCFT_CAP_02_EVIDENCE_WINDOW_FIXTURES.json",
  );
  const cropStageContext = readJsonV1<ContinuationCropStageConfigurationContextV1>(
    "fixtures/mcft/water_state/replay_v1/configuration_context.json",
  );
  const lineage = memberV1(persistence.a0RecordSet, "twin_runtime_lineage_v1");
  const checkpoint = memberV1(persistence.a0RecordSet, "twin_runtime_checkpoint_v1");
  const state = memberV1(persistence.a0RecordSet, "twin_state_estimate_v1");
  const realityBindingSnapshot: RealityBindingRuntimeSnapshotV1 = {
    binding_id: persistence.lock.reality_binding_ref,
    determinism_hash: persistence.lock.reality_binding_hash,
    geometry_semantic_hash: persistence.lock.geometry_semantic_hash,
    scope: structuredClone(persistence.scope),
    root_zone_definition: {
      policy_id: "GOVERNED_FIXED_ROOT_ZONE_300MM_V1",
      root_zone_depth_mm: 300,
    },
  };
  const initialSnapshot: PersistedNextTickSnapshotV1 = {
    active_lineage_ref: lineage.object_id,
    active_lineage_id: lineage.lineage_id,
    checkpoint: structuredClone(checkpoint),
    previous_posterior: structuredClone(state),
    runtime_config: structuredClone(persistence.parentRuntimeConfig),
    reality_binding: realityBindingSnapshot,
  };
  return {
    lock: persistence.lock,
    scope: persistence.scope,
    parentRuntimeConfig: persistence.parentRuntimeConfig,
    continuationRuntimeConfig: persistence.continuationRuntimeConfig,
    a0RecordSet: persistence.a0RecordSet,
    expectedFixture,
    evidenceFixture,
    cropStageContext,
    realityBindingSnapshot,
    initialSnapshot,
  };
}
