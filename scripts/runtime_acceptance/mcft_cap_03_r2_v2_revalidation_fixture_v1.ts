// scripts/runtime_acceptance/mcft_cap_03_r2_v2_revalidation_fixture_v1.ts
// Purpose: assemble deterministic MCFT-CAP-03 R2 V2 Runtime Config, single-tick, 24-tick range, restart/backfill, and PostgreSQL persistence fixtures over the frozen Replay evidence authority.
// Boundary: acceptance support only; no production route, scheduler, live-field claim, successful Forecast, Scenario, Recommendation, Decision, action, calibration, or model activation.

import {
  computeMemberDeterminismHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type {
  CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  computeAssimilatedContinuationRecordSetDeterminismHashV2,
  type AssimilatedContinuationRecordSetV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v2.js";
import {
  validateAssimilatedContinuationCrossReferencesV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v2.js";
import {
  compileAssimilatedContinuationRuntimeConfigV2,
  type AssimilatedContinuationRuntimeConfigPayloadV2,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.js";
import {
  AssimilatedContiguousRangeServiceV2,
  type RunAssimilatedContiguousRangeInputV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v2.js";
import {
  compileAssimilatedContinuationRuntimeConfigFromAuthorityV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v2.js";
import {
  AssimilatedContinuationTickServiceV2,
  type AssimilatedSingleTickPersistencePortV2,
  type ExecuteAssimilatedContinuationTickInputV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v2.js";
import {
  AssimilatedRestartResumeServiceV2,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v2.js";
import {
  PrepareNextTickInputServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ContinuationExpectedPointersV1,
  NextTickReadPortV1,
  PersistedNextTickSnapshotV1,
  PreparedRestartInputV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap03SingleTickIntegrationFixtureV1,
} from "./mcft_cap_03_single_tick_integration_fixture_v1.js";

export const R2_V2_FIRST_LOGICAL_TIME =
  "2026-06-02T02:00:00.000Z";
export const R2_V2_CREATED_AT =
  "2026-07-12T00:00:00.000Z";
export const R2_V2_STANDARD_TICK_COUNT = 24;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function addHoursR2V2(
  value: string,
  hours: number,
): string {
  return new Date(
    Date.parse(value) + hours * HOUR_MS,
  ).toISOString();
}

function addMinutesR2V2(
  value: string,
  minutes: number,
): string {
  return new Date(
    Date.parse(value) + minutes * MINUTE_MS,
  ).toISOString();
}

export function memberR2V2(
  recordSet: { members: CanonicalObjectEnvelopeV1[] },
  objectType: string,
): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter(
    (member) => member.object_type === objectType,
  );
  if (matches.length !== 1) {
    throw new Error(
      `R2_V2_FIXTURE_MEMBER_CARDINALITY:${objectType}`,
    );
  }
  return matches[0];
}

function sameScopeR2V2(
  left: TwinScopeKeyV1,
  right: TwinScopeKeyV1,
): boolean {
  return left.tenant_id === right.tenant_id
    && left.project_id === right.project_id
    && left.group_id === right.group_id
    && left.field_id === right.field_id
    && left.season_id === right.season_id
    && left.zone_id === right.zone_id;
}

function evidenceForLogicalTimeR2V2(
  templates: readonly CanonicalReplayEvidenceRecordV1[],
  logicalTime: string,
): CanonicalReplayEvidenceRecordV1[] {
  const suffix = logicalTime
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(".000Z", "Z");

  return templates.map((template) => {
    const record = structuredClone(template);
    const availableAt = addMinutesR2V2(logicalTime, -5);

    record.source_record_id =
      `${template.source_record_id}_${suffix}`;
    record.source_record_hash =
      `sha256:${record.source_record_id}`;
    record.available_to_runtime_at = availableAt;

    if (
      record.record_type === "observed_rainfall_v1"
      || record.record_type === "historical_et0_estimate_v1"
    ) {
      record.role_time = {
        ...record.role_time,
        interval_start: addHoursR2V2(logicalTime, -1),
        interval_end: logicalTime,
        ingested_at: availableAt,
      };
    }

    if (
      record.record_type === "soil_moisture_observation_v1"
    ) {
      record.role_time = {
        ...record.role_time,
        observed_at: addMinutesR2V2(logicalTime, -10),
        ingested_at: availableAt,
      };
    }

    return record;
  });
}

export class InMemoryR2V2Runtime
implements
  NextTickReadPortV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  AssimilatedSingleTickPersistencePortV2 {
  private snapshot: PersistedNextTickSnapshotV1;
  private readonly templates:
    CanonicalReplayEvidenceRecordV1[];
  private readonly configs =
    new Map<string, CanonicalObjectEnvelopeV1>();
  private readonly recordsByKey =
    new Map<string, AssimilatedContinuationRecordSetV2>();
  private readonly recordsById =
    new Map<string, AssimilatedContinuationRecordSetV2>();
  private fencingToken = 0n;

  leaseAcquireCount = 0;
  commitCount = 0;
  readbackCount = 0;

  constructor(input: {
    snapshot: PersistedNextTickSnapshotV1;
    configs: CanonicalObjectEnvelopeV1[];
    candidate_templates:
      CanonicalReplayEvidenceRecordV1[];
  }) {
    this.snapshot = structuredClone(input.snapshot);
    this.templates = structuredClone(
      input.candidate_templates,
    );

    for (const config of input.configs) {
      this.configs.set(
        config.object_id,
        structuredClone(config),
      );
    }
  }

  currentSnapshotR2V2(): PersistedNextTickSnapshotV1 {
    return structuredClone(this.snapshot);
  }

  async readPersistedNextTickSnapshot(
    scope: TwinScopeKeyV1,
  ): Promise<PersistedNextTickSnapshotV1 | null> {
    if (
      !sameScopeR2V2(
        this.snapshot.reality_binding.scope,
        scope,
      )
    ) {
      return null;
    }
    return structuredClone(this.snapshot);
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (
      !sameScopeR2V2(
        this.snapshot.reality_binding.scope,
        input.scope,
      )
    ) {
      throw new Error(
        "R2_V2_FIXTURE_EVIDENCE_SCOPE_MISMATCH",
      );
    }

    return evidenceForLogicalTimeR2V2(
      this.templates,
      input.logical_time,
    );
  }

  async commitRuntimeConfig(
    config: CanonicalObjectEnvelopeV1,
  ): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    const existing = this.configs.get(config.object_id);

    if (existing) {
      if (
        existing.determinism_hash
        !== config.determinism_hash
      ) {
        throw new Error(
          "R2_V2_FIXTURE_RUNTIME_CONFIG_CONFLICT",
        );
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object_id: config.object_id,
        fact_id: `fact_${config.object_id}`,
      };
    }

    this.configs.set(
      config.object_id,
      structuredClone(config),
    );

    return {
      status: "INSERTED",
      object_id: config.object_id,
      fact_id: `fact_${config.object_id}`,
    };
  }

  async readRuntimeConfig(
    objectId: string,
  ): Promise<CanonicalObjectEnvelopeV1 | null> {
    const config = this.configs.get(objectId);
    return config ? structuredClone(config) : null;
  }

  async acquireLease(
    claim: Omit<RuntimeLeaseClaimV1, "fencing_token">,
  ): Promise<RuntimeLeaseClaimV1> {
    this.leaseAcquireCount += 1;
    this.fencingToken += 1n;
    return {
      ...claim,
      fencing_token: this.fencingToken,
    };
  }

  async lookupAssimilatedContinuationRecordSet(
    idempotencyKey: string,
  ): Promise<AssimilatedContinuationRecordSetV2 | null> {
    const recordSet = this.recordsByKey.get(
      idempotencyKey,
    );
    return recordSet
      ? structuredClone(recordSet)
      : null;
  }

  async commitAssimilatedContinuationState(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    expected: ContinuationExpectedPointersV1;
    record_set: AssimilatedContinuationRecordSetV2;
    fault_injection?: (stage: string) => void;
  }): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    record_set: AssimilatedContinuationRecordSetV2;
    fact_ids_by_object_id: Record<string, string>;
  }> {
    const existing = this.recordsByKey.get(
      input.record_set.continuation_idempotency_key,
    );

    if (existing) {
      if (
        existing.continuation_record_set_determinism_hash
        !== input.record_set
          .continuation_record_set_determinism_hash
      ) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }

      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        record_set: structuredClone(existing),
        fact_ids_by_object_id: {},
      };
    }

    if (
      input.expected.active_lineage_ref
      !== this.snapshot.active_lineage_ref
    ) {
      throw new Error(
        "ACTIVE_LINEAGE_OBJECT_REF_MISMATCH",
      );
    }

    if (
      input.expected.previous_checkpoint_ref
      !== this.snapshot.checkpoint.object_id
    ) {
      throw new Error("CHECKPOINT_CAS_CONFLICT");
    }

    if (
      input.expected.previous_state_ref
      !== this.snapshot.previous_posterior.object_id
    ) {
      throw new Error("STATE_LATEST_CAS_CONFLICT");
    }

    if (
      input.expected.previous_forecast_result_ref
      !== this.snapshot.previous_forecast_result?.object_id
    ) {
      throw new Error("FORECAST_RESULT_CAS_CONFLICT");
    }

    validateAssimilatedContinuationCrossReferencesV2(
      input.record_set,
    );

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

    const state = memberR2V2(
      input.record_set,
      "twin_state_estimate_v1",
    );
    const checkpoint = memberR2V2(
      input.record_set,
      "twin_runtime_checkpoint_v1",
    );
    const forecast = memberR2V2(
      input.record_set,
      "twin_forecast_run_v1",
    );
    const tick = memberR2V2(
      input.record_set,
      "twin_runtime_tick_v1",
    );
    const config = this.configs.get(
      state.runtime_config_ref ?? "",
    );

    if (!config) {
      throw new Error(
        "R2_V2_FIXTURE_RUNTIME_CONFIG_NOT_FOUND",
      );
    }

    this.snapshot = {
      ...this.snapshot,
      checkpoint: structuredClone(checkpoint),
      previous_posterior: structuredClone(state),
      previous_forecast_result:
        structuredClone(forecast),
      last_terminal_tick: structuredClone(tick),
      runtime_config: structuredClone(config),
    };

    return {
      status: "INSERTED",
      record_set: structuredClone(input.record_set),
      fact_ids_by_object_id: Object.fromEntries(
        input.record_set.members.map((member) => [
          member.object_id,
          `fact_${member.object_id}`,
        ]),
      ),
    };
  }

  async readAssimilatedContinuationRecordSet(
    recordSetId: string,
  ): Promise<AssimilatedContinuationRecordSetV2 | null> {
    this.readbackCount += 1;
    const recordSet = this.recordsById.get(recordSetId);
    return recordSet
      ? structuredClone(recordSet)
      : null;
  }

  async rebuildAssimilatedContinuationProjections():
  Promise<{ rebuilt_projection_count: 5 }> {
    return { rebuilt_projection_count: 5 };
  }

  async resumeFromCheckpointV1(
    scope: TwinScopeKeyV1,
  ): Promise<PreparedRestartInputV1> {
    const handoff =
      await new PrepareNextTickInputServiceV1(this)
        .prepareNextTickInput(scope);

    const terminal = this.snapshot.last_terminal_tick;

    if (!terminal) {
      throw new Error(
        "PERSISTED_NEXT_TICK_STATE_NOT_FOUND",
      );
    }

    return {
      ...handoff,
      previous_terminal_tick_ref: terminal.object_id,
      previous_terminal_tick_hash:
        terminal.determinism_hash,
      previous_terminal_tick_logical_time:
        terminal.logical_time,
    };
  }
}

function configPayloadR2V2(
  config: CanonicalObjectEnvelopeV1,
): AssimilatedContinuationRuntimeConfigPayloadV2 {
  return config.payload as unknown as
    AssimilatedContinuationRuntimeConfigPayloadV2;
}

function buildConfigChainR2V2(input: {
  scope: TwinScopeKeyV1;
  first_config: CanonicalObjectEnvelopeV1;
  count: number;
}): CanonicalObjectEnvelopeV1[] {
  if (
    !Number.isInteger(input.count)
    || input.count < 1
    || input.count > R2_V2_STANDARD_TICK_COUNT
  ) {
    throw new Error(
      "R2_V2_FIXTURE_CONFIG_COUNT_INVALID",
    );
  }

  const firstConfig = structuredClone(
    input.first_config,
  );
  const authority = configPayloadR2V2(firstConfig);
  const configs = [firstConfig];
  let parentConfig = firstConfig;

  for (
    let index = 1;
    index < input.count;
    index += 1
  ) {
    const config =
      compileAssimilatedContinuationRuntimeConfigV2({
        scope: input.scope,
        logical_time: addHoursR2V2(
          R2_V2_FIRST_LOGICAL_TIME,
          index,
        ),
        created_at: R2_V2_CREATED_AT,
        parent_runtime_config_ref:
          parentConfig.object_id,
        parent_runtime_config_hash:
          parentConfig.determinism_hash,
        reality_binding_ref:
          authority.reality_binding_ref,
        reality_binding_hash:
          authority.reality_binding_hash,
        source_matrix_hash:
          authority.source_matrix_hash,
        configuration_matrix_hash:
          authority.configuration_matrix_hash,
        geometry_semantic_hash:
          authority.geometry_semantic_hash,
      });

    configs.push(config);
    parentConfig = config;
  }

  return configs;
}

export async function buildMcftCap03R2V2FixtureV1(
  configCount = R2_V2_STANDARD_TICK_COUNT,
) {
  const source =
    await buildMcftCap03SingleTickIntegrationFixtureV1();

  const firstV2Config =
    compileAssimilatedContinuationRuntimeConfigFromAuthorityV2({
      predecessor_lock: source.cap03Lock as never,
      predecessor_latest_state:
        source.predecessorState,
      parent_runtime_config:
        source.continuationRuntimeConfig,
      reality_artifact: source.reality,
      source_matrix_artifact: source.sourceMatrix,
      configuration_matrix_artifact:
        source.configurationMatrix,
      logical_time: R2_V2_FIRST_LOGICAL_TIME,
      created_at: R2_V2_CREATED_AT,
    });

  const runtimeConfigChain =
    buildConfigChainR2V2({
      scope: source.scope,
      first_config: firstV2Config,
      count: configCount,
    });

  const runtime =
    new InMemoryR2V2Runtime({
      snapshot: source.initialSnapshot,
      configs: [
        source.continuationRuntimeConfig,
        ...runtimeConfigChain,
      ],
      candidate_templates:
        source.candidateRecords,
    });

  const handoffService =
    new PrepareNextTickInputServiceV1(runtime);

  const tickService =
    new AssimilatedContinuationTickServiceV2(
      handoffService,
      runtime,
      runtime,
      runtime,
    );

  const rangeService =
    new AssimilatedContiguousRangeServiceV2(
      handoffService,
      tickService,
    );

  const restartService =
    new AssimilatedRestartResumeServiceV2(
      runtime,
      rangeService,
    );

  const runtimeConfigRefsByLogicalTime =
    Object.fromEntries(
      runtimeConfigChain.map((config) => [
        config.logical_time,
        config.object_id,
      ]),
    );

  const tickInput = (
    logicalTime = R2_V2_FIRST_LOGICAL_TIME,
  ): ExecuteAssimilatedContinuationTickInputV2 => ({
    scope: source.scope,
    logical_time: logicalTime,
    created_at: R2_V2_CREATED_AT,
    assimilated_runtime_config_ref:
      runtimeConfigRefsByLogicalTime[logicalTime],
    crop_stage_context: source.cropStageContext,
    lease_owner: "mcft-cap-03-r2-v2",
    lease_duration_seconds: 300,
  });

  const rangeInput = (
    targetLogicalTime: string,
  ): RunAssimilatedContiguousRangeInputV2 => ({
    scope: source.scope,
    to_logical_time: targetLogicalTime,
    created_at: R2_V2_CREATED_AT,
    assimilated_runtime_config_refs_by_logical_time:
      runtimeConfigRefsByLogicalTime,
    crop_stage_context: source.cropStageContext,
    lease_owner: "mcft-cap-03-r2-v2-range",
    lease_duration_seconds: 300,
  });

  return {
    source,
    firstV2Config,
    runtimeConfigChain,
    runtimeConfigRefsByLogicalTime,
    runtime,
    handoffService,
    tickService,
    rangeService,
    restartService,
    tickInput,
    rangeInput,
    firstLogicalTime: R2_V2_FIRST_LOGICAL_TIME,
    lastLogicalTime: addHoursR2V2(
      R2_V2_FIRST_LOGICAL_TIME,
      configCount - 1,
    ),
  };
}

function conflictingRecordSetR2V2(
  source: AssimilatedContinuationRecordSetV2,
): AssimilatedContinuationRecordSetV2 {
  const conflicting = structuredClone(source);
  const health = memberR2V2(
    conflicting,
    "twin_runtime_health_v1",
  );

  health.limitations = [
    ...health.limitations,
    "R2_V2_ACCEPTANCE_CONFLICTING_CONTENT",
  ];

  health.determinism_hash =
    computeMemberDeterminismHashV1(
      health as unknown as Record<string, unknown>,
    );

  conflicting.aggregate_identity_input
    .member_determinism_hashes =
      Object.fromEntries(
        conflicting.members.map((member) => [
          member.object_type,
          member.determinism_hash,
        ]),
      ) as AssimilatedContinuationRecordSetV2[
        "aggregate_identity_input"
      ]["member_determinism_hashes"];

  conflicting
    .continuation_record_set_determinism_hash =
      computeAssimilatedContinuationRecordSetDeterminismHashV2(
        conflicting.aggregate_identity_input,
      );

  return conflicting;
}

export async function
buildMcftCap03R2V2PersistenceFixtureV1() {
  const fixture =
    await buildMcftCap03R2V2FixtureV1(1);

  const result =
    await fixture.tickService.executeOneTick(
      fixture.tickInput(),
    );

  const source = fixture.source;
  const expected: ContinuationExpectedPointersV1 = {
    active_lineage_ref:
      source.cap03Lock.canonical_identity
        .active_lineage_ref,
    lineage_id:
      source.cap03Lock.canonical_identity.lineage_id,
    revision_id:
      source.cap03Lock.canonical_identity.revision_id,
    previous_checkpoint_ref:
      source.predecessorCheckpoint.object_id,
    previous_state_ref:
      source.predecessorState.object_id,
    previous_forecast_result_ref:
      source.predecessorForecast.object_id,
    latest_successful_forecast_ref: null,
  };

  return {
    ...source,
    assimilatedRuntimeConfig:
      fixture.firstV2Config,
    recordSet: result.record_set,
    conflictingRecordSet:
      conflictingRecordSetR2V2(result.record_set),
    expected,
  };
}
