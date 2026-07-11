// scripts/runtime_acceptance/mcft_cap_03_single_tick_integration_fixture_v1.ts
// Purpose: assemble the canonical CAP-02 final handoff, CAP-03 config/evidence, and a mutable in-memory runtime for one observation-aware S4 tick and idempotent replay acceptance.
// Boundary: acceptance support only; no production database, route, scheduler, range, restart/backfill, successful Forecast, Recommendation, Decision, or action.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import type { AssimilatedContinuationRecordSetV1 } from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type { AssimilatedSingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.js";
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
import {
  buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1,
  S3B_CREATED_AT_V1,
  S3B_LOGICAL_TIME_V1,
} from "./mcft_cap_03_assimilated_persistence_recovery_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const S4_CREATED_AT_V1 = "2026-07-11T08:30:00.000Z";
export const S4_NEXT_LOGICAL_TIME_V1 = "2026-06-02T03:00:00.000Z";

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

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
  if (matches.length !== 1) throw new Error(`S4_FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function baseEvidenceV1(input: {
  scope: TwinScopeKeyV1;
  source_record_id: string;
  source_record_hash: string;
  record_type: string;
  binding_id: string;
  origin_source_id: string;
  role_time: Record<string, unknown>;
  source_payload: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
}): CanonicalReplayEvidenceRecordV1 {
  return {
    ...input.scope,
    dataset_id: "mcft_c8_water_replay_2026_06_v1",
    source_record_id: input.source_record_id,
    source_record_hash: input.source_record_hash,
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: "2026-06-02T01:55:00.000Z",
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: structuredClone(input.source_payload),
    canonical_payload: structuredClone(input.canonical_payload),
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
  };
}

function rainfallV1(scope: TwinScopeKeyV1): CanonicalReplayEvidenceRecordV1 {
  return baseEvidenceV1({
    scope,
    source_record_id: "rain_cap03_s4_001",
    source_record_hash: "sha256:rain_cap03_s4_001",
    record_type: "observed_rainfall_v1",
    binding_id: "rainfall_c8_hourly_v1",
    origin_source_id: "weather_replay_c8_001",
    role_time: {
      interval_start: "2026-06-02T01:00:00.000Z",
      interval_end: S3B_LOGICAL_TIME_V1,
      ingested_at: "2026-06-02T01:55:00.000Z",
    },
    source_payload: { value: 0, unit: "mm" },
    canonical_payload: { value: 0, unit: "mm" },
    source_unit: "mm",
    canonical_unit: "mm",
  });
}

function et0V1(scope: TwinScopeKeyV1): CanonicalReplayEvidenceRecordV1 {
  return baseEvidenceV1({
    scope,
    source_record_id: "et0_cap03_s4_001",
    source_record_hash: "sha256:et0_cap03_s4_001",
    record_type: "historical_et0_estimate_v1",
    binding_id: "historical_et0_c8_hourly_v1",
    origin_source_id: "et0_replay_c8_001",
    role_time: {
      interval_start: "2026-06-02T01:00:00.000Z",
      interval_end: S3B_LOGICAL_TIME_V1,
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
      ingested_at: "2026-06-02T01:55:00.000Z",
    },
    source_payload: { value: 0.085, unit: "mm" },
    canonical_payload: {
      value: 0.085,
      unit: "mm",
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    source_unit: "mm",
    canonical_unit: "mm",
  });
}

export class InMemoryAssimilatedSingleTickRuntimeV1 implements
  NextTickReadPortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  AssimilatedSingleTickPersistencePortV1 {
  private snapshot: PersistedNextTickSnapshotV1;
  private candidateRecords: CanonicalReplayEvidenceRecordV1[];
  private readonly configs = new Map<string, CanonicalObjectEnvelopeV1>();
  private readonly recordsByKey = new Map<string, AssimilatedContinuationRecordSetV1>();
  private readonly recordsById = new Map<string, AssimilatedContinuationRecordSetV1>();
  private fencingToken = 0n;
  leaseAcquireCount = 0;
  commitCount = 0;
  readbackCount = 0;

  constructor(input: {
    snapshot: PersistedNextTickSnapshotV1;
    configs: CanonicalObjectEnvelopeV1[];
    candidate_records: CanonicalReplayEvidenceRecordV1[];
  }) {
    this.snapshot = structuredClone(input.snapshot);
    this.candidateRecords = structuredClone(input.candidate_records);
    for (const config of input.configs) this.configs.set(config.object_id, structuredClone(config));
  }

  currentSnapshotV1(): PersistedNextTickSnapshotV1 {
    return structuredClone(this.snapshot);
  }

  replaceSnapshotV1(snapshot: PersistedNextTickSnapshotV1): void {
    this.snapshot = structuredClone(snapshot);
  }

  replaceCandidateRecordsV1(records: CanonicalReplayEvidenceRecordV1[]): void {
    this.candidateRecords = structuredClone(records);
  }

  async readPersistedNextTickSnapshot(scope: TwinScopeKeyV1): Promise<PersistedNextTickSnapshotV1 | null> {
    if (!sameScopeV1(this.snapshot.reality_binding.scope, scope)) return null;
    return structuredClone(this.snapshot);
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (!sameScopeV1(this.snapshot.reality_binding.scope, input.scope)) {
      throw new Error("S4_FIXTURE_EVIDENCE_SCOPE_MISMATCH");
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
      if (existing.determinism_hash !== config.determinism_hash) {
        throw new Error("S4_FIXTURE_RUNTIME_CONFIG_CONFLICT");
      }
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

  async acquireLease(
    claim: Omit<RuntimeLeaseClaimV1, "fencing_token">,
  ): Promise<RuntimeLeaseClaimV1> {
    this.leaseAcquireCount += 1;
    this.fencingToken += 1n;
    return { ...claim, fencing_token: this.fencingToken };
  }

  async lookupAssimilatedContinuationRecordSet(
    idempotencyKey: string,
  ): Promise<AssimilatedContinuationRecordSetV1 | null> {
    const recordSet = this.recordsByKey.get(idempotencyKey);
    return recordSet ? structuredClone(recordSet) : null;
  }

  async commitAssimilatedContinuationState(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    expected: ContinuationExpectedPointersV1;
    record_set: AssimilatedContinuationRecordSetV1;
    fault_injection?: (stage: string) => void;
  }): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    record_set: AssimilatedContinuationRecordSetV1;
    fact_ids_by_object_id: Record<string, string>;
  }> {
    const existing = this.recordsByKey.get(input.record_set.continuation_idempotency_key);
    if (existing) {
      if (
        existing.continuation_record_set_determinism_hash
        !== input.record_set.continuation_record_set_determinism_hash
      ) throw new Error("IDEMPOTENCY_CONFLICT");
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: structuredClone(existing),
        fact_ids_by_object_id: {},
      };
    }
    if (input.expected.active_lineage_ref !== this.snapshot.active_lineage_ref) {
      throw new Error("ACTIVE_LINEAGE_OBJECT_REF_MISMATCH");
    }
    if (input.expected.lineage_id !== this.snapshot.checkpoint.lineage_id) {
      throw new Error("ACTIVE_LINEAGE_CHECKPOINT_MISMATCH");
    }
    if (input.expected.revision_id !== this.snapshot.checkpoint.revision_id) {
      throw new Error("CHECKPOINT_STATE_REVISION_MISMATCH");
    }
    if (input.expected.previous_checkpoint_ref !== this.snapshot.checkpoint.object_id) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }
    if (input.expected.previous_state_ref !== this.snapshot.previous_posterior.object_id) {
      throw new Error("STATE_LATEST_CAS_CONFLICT");
    }
    if (
      input.expected.previous_forecast_result_ref
      !== this.snapshot.previous_forecast_result?.object_id
    ) throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    if (input.expected.latest_successful_forecast_ref !== null) {
      throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");
    }
    validateAssimilatedContinuationCrossReferencesV1(input.record_set);
    input.fault_injection?.("before_commit");
    this.commitCount += 1;
    this.recordsByKey.set(
      input.record_set.continuation_idempotency_key,
      structuredClone(input.record_set),
    );
    this.recordsById.set(
      input.record_set.continuation_record_set_id,
      structuredClone(input.record_set),
    );
    const state = memberV1(input.record_set, "twin_state_estimate_v1");
    const checkpoint = memberV1(input.record_set, "twin_runtime_checkpoint_v1");
    const forecast = memberV1(input.record_set, "twin_forecast_run_v1");
    const tick = memberV1(input.record_set, "twin_runtime_tick_v1");
    const config = this.configs.get(state.runtime_config_ref ?? "");
    if (!config) throw new Error("S4_FIXTURE_ASSIMILATED_CONFIG_NOT_FOUND");
    this.snapshot = {
      ...this.snapshot,
      checkpoint: structuredClone(checkpoint),
      previous_posterior: structuredClone(state),
      previous_forecast_result: structuredClone(forecast),
      last_terminal_tick: structuredClone(tick),
      runtime_config: structuredClone(config),
    };
    return {
      status: "INSERTED",
      record_set: structuredClone(input.record_set),
      fact_ids_by_object_id: Object.fromEntries(
        input.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`]),
      ),
    };
  }

  async readAssimilatedContinuationRecordSet(
    recordSetId: string,
  ): Promise<AssimilatedContinuationRecordSetV1 | null> {
    this.readbackCount += 1;
    const recordSet = this.recordsById.get(recordSetId);
    return recordSet ? structuredClone(recordSet) : null;
  }

  async rebuildAssimilatedContinuationProjections(): Promise<{ rebuilt_projection_count: 5 }> {
    return { rebuilt_projection_count: 5 };
  }
}

export async function buildMcftCap03SingleTickIntegrationFixtureV1() {
  const source = await buildMcftCap03AssimilatedPersistenceRecoveryFixtureV1();
  const cropStageContext = readJsonV1<ContinuationCropStageConfigurationContextV1>(
    "fixtures/mcft/water_state/replay_v1/configuration_context.json",
  );
  const realityBindingSnapshot: RealityBindingRuntimeSnapshotV1 = {
    binding_id: source.handoff.reality_binding_ref,
    determinism_hash: source.handoff.reality_binding_hash,
    geometry_semantic_hash: String(source.assimilatedRuntimeConfig.payload.geometry_semantic_hash),
    scope: structuredClone(source.scope),
    root_zone_definition: {
      policy_id: "GOVERNED_FIXED_ROOT_ZONE_300MM_V1",
      root_zone_depth_mm: 300,
    },
  };
  const initialSnapshot: PersistedNextTickSnapshotV1 = {
    active_lineage_ref: source.cap03Lock.canonical_identity.active_lineage_ref,
    active_lineage_id: source.cap03Lock.canonical_identity.lineage_id,
    checkpoint: structuredClone(source.predecessorCheckpoint),
    previous_posterior: structuredClone(source.predecessorState),
    previous_forecast_result: structuredClone(source.predecessorForecast),
    runtime_config: structuredClone(source.continuationRuntimeConfig),
    reality_binding: realityBindingSnapshot,
  };
  const candidateRecords = [
    rainfallV1(source.scope),
    et0V1(source.scope),
    structuredClone(source.observation),
  ];
  const runtime = new InMemoryAssimilatedSingleTickRuntimeV1({
    snapshot: initialSnapshot,
    configs: [source.continuationRuntimeConfig, source.assimilatedRuntimeConfig],
    candidate_records: candidateRecords,
  });
  return {
    ...source,
    logicalTime: S3B_LOGICAL_TIME_V1,
    createdAt: S4_CREATED_AT_V1,
    legacyCreatedAt: S3B_CREATED_AT_V1,
    nextLogicalTime: S4_NEXT_LOGICAL_TIME_V1,
    cropStageContext,
    realityBindingSnapshot,
    initialSnapshot,
    candidateRecords,
    runtime,
  };
}
