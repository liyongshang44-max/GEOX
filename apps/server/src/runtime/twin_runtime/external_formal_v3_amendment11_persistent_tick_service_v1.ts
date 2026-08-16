// Purpose: execute one manifest-pinned External Formal V3 tick using Amendment-11 actual-snapshot temporal semantics.
// Boundary: no scheduler claim, provider fetch, R2 access, filesystem, environment, timer loop, route, authority creation, or downstream action dispatch.
// The caller supplies an already-claimed scheduler slot, exact manifest pin, actual evidence snapshot, crop context, and observer time.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateCap04CanonicalForecastRunPayloadV1,
  type Cap04CanonicalCompletedForecastRunPayloadV1,
  type Cap04CanonicalForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_canonical_authority_v1.js";
import { CAP04_A1_OPERATION_VARIANT_V1, CAP04_A2_OPERATION_VARIANT_V1 } from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ARecordSetIdentityV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { validateCap04ARecordSetV1, validateCap04ScenarioSetRecordV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";
import {
  CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
  computeCap04ForecastMathHashV1,
  validateCap04Pure72hForecastMathResultV1,
  type Cap04Pure72hForecastMathResultV1,
} from "../../domain/twin_runtime/forecast_math_contracts_v1.js";
import type { Cap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../domain/twin_runtime/pure_three_scenario_math_v1.js";
import type { Cap04PureThreeScenarioMathResultV1 } from "../../domain/twin_runtime/scenario_math_contracts_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/external_formal_runtime_config_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "./continuation_evidence_window_service_v1.js";
import { executeExternalFormalCap04Amendment11CandidateV1 } from "./external_formal_cap04_amendment11_candidate_execution_service_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "./forecast_scenario_persistence_ports_v1.js";
import type {
  RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1,
  ShadowOnlineSlotClaimV1,
  ShadowOnlineSlotIdV1,
  TwinScopeKeyV1,
} from "./ports.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import { buildCap04ScenarioSetRecordV1 } from "./scenario_set_record_builder_v1.js";
import type { ExternalFormalDatabaseEvidenceLoadResultV1 } from "./postgres_external_formal_evidence_source_v1.js";

export const EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_V1" as const;
export const EXTERNAL_FORMAL_V3_AMENDMENT11_WATERMARK_ID_V1 = "PROVIDER_AVAILABILITY_WATERMARK_V1" as const;

export type ExternalFormalV3Amendment11ManifestSlotPinV1 = {
  manifest_ref: string;
  manifest_hash: string;
  epoch_id: string;
  slot_id: ShadowOnlineSlotIdV1;
  logical_time: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
};

export interface ExternalFormalV3Amendment11DatabaseEvidenceSourcePortV1 {
  loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
    evidence_snapshot_time: string;
  }): Promise<ExternalFormalDatabaseEvidenceLoadResultV1>;
}

export type ExecuteExternalFormalV3Amendment11PersistentTickInputV1 = {
  claim: ShadowOnlineSlotClaimV1;
  manifest_slot: ExternalFormalV3Amendment11ManifestSlotPinV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  evidence_snapshot_time: string;
  observer_started_at: string;
  lease_duration_seconds: number;
};

export type ExecuteExternalFormalV3Amendment11PersistentTickResultV1 = {
  service_id: typeof EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_ID_V1;
  provider_availability_watermark: typeof EXTERNAL_FORMAL_V3_AMENDMENT11_WATERMARK_ID_V1;
  status:
    | "INSERTED_A1_WITH_SCENARIO"
    | "INSERTED_A2_BLOCKED"
    | "EXISTING_A1_WITH_SCENARIO"
    | "EXISTING_A2_BLOCKED"
    | "RECOVERED_PENDING_SCENARIO";
  manifest_ref: string;
  manifest_hash: string;
  epoch_id: string;
  slot_id: ShadowOnlineSlotIdV1;
  logical_time: string;
  scheduler_wall_clock_observed_at: string;
  evidence_snapshot_time: string;
  observer_started_at: string;
  scheduler_to_snapshot_delay_minutes: number;
  snapshot_to_observer_delay_minutes: number;
  fixed_lag_authority_used: false;
  a_record_set: Cap04ARecordSetV1;
  b_record: Cap04ScenarioSetRecordV1 | null;
  scenario_math: Cap04PureThreeScenarioMathResultV1 | null;
  next_logical_tick_time: string;
  scheduler_claim_reused_as_runtime_lease: true;
  second_runtime_write_lease_acquired: false;
  runtime_provider_request_count: 0;
  runtime_r2_head_count: 0;
  recommendation_write_count: 0;
  approval_write_count: 0;
  action_write_count: 0;
  dispatch_write_count: 0;
  model_activation_write_count: 0;
};

type NextTickServicePortV1 = Pick<PrepareNextTickInputServiceV1, "prepareNextTickInput">;
type ScopeLikeV1 = { tenant_id: string; project_id: string; group_id: string | null; field_id: string; season_id: string | null; zone_id: string | null };

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addOneHourV1(value: string): string {
  return addMinutesV1(value, 60);
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const field of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function externalScopeV1(): TwinScopeKeyV1 {
  return { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`EXTERNAL_FORMAL_V3_AM11_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function validateManifestAndClaimV1(input: ExecuteExternalFormalV3Amendment11PersistentTickInputV1): {
  logical_time: string;
  scheduler_wall_clock_observed_at: string;
  evidence_snapshot_time: string;
  observer_started_at: string;
  scheduler_to_snapshot_delay_minutes: number;
  snapshot_to_observer_delay_minutes: number;
} {
  const scope = externalScopeV1();
  exactScopeV1(input.claim.boundary.scope, scope, "EXTERNAL_FORMAL_V3_AM11_CLAIM_SCOPE_MISMATCH");
  if (input.claim.state !== "CLAIMED") throw new Error("EXTERNAL_FORMAL_V3_AM11_CLAIM_STATE_REQUIRED");
  requiredStringV1(input.claim.lease_owner, "EXTERNAL_FORMAL_V3_AM11_LEASE_OWNER_REQUIRED");
  if (typeof input.claim.fencing_token !== "bigint" || input.claim.fencing_token <= 0n) throw new Error("EXTERNAL_FORMAL_V3_AM11_FENCING_TOKEN_REQUIRED");
  if (!Number.isInteger(input.lease_duration_seconds) || input.lease_duration_seconds <= 0) throw new Error("EXTERNAL_FORMAL_V3_AM11_LEASE_DURATION_INVALID");

  const logicalTime = canonicalHourV1(input.manifest_slot.logical_time, "EXTERNAL_FORMAL_V3_AM11_MANIFEST_LOGICAL_TIME_INVALID");
  if (input.claim.boundary.logical_time !== logicalTime) throw new Error("EXTERNAL_FORMAL_V3_AM11_CLAIM_LOGICAL_TIME_MISMATCH");
  if (input.claim.boundary.slot_id !== input.manifest_slot.slot_id) throw new Error("EXTERNAL_FORMAL_V3_AM11_CLAIM_SLOT_ID_MISMATCH");
  if (input.claim.boundary.interval_seconds !== 3600) throw new Error("EXTERNAL_FORMAL_V3_AM11_PT1H_BOUNDARY_REQUIRED");
  requiredStringV1(input.manifest_slot.manifest_ref, "EXTERNAL_FORMAL_V3_AM11_MANIFEST_REF_REQUIRED");
  requiredStringV1(input.manifest_slot.manifest_hash, "EXTERNAL_FORMAL_V3_AM11_MANIFEST_HASH_REQUIRED");
  requiredStringV1(input.manifest_slot.epoch_id, "EXTERNAL_FORMAL_V3_AM11_EPOCH_ID_REQUIRED");
  requiredStringV1(input.manifest_slot.runtime_config_ref, "EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_REF_REQUIRED");
  requiredStringV1(input.manifest_slot.runtime_config_hash, "EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_HASH_REQUIRED");
  requiredStringV1(input.manifest_slot.crop_stage_context_ref, "EXTERNAL_FORMAL_V3_AM11_CROP_CONTEXT_REF_REQUIRED");
  requiredStringV1(input.manifest_slot.crop_stage_context_hash, "EXTERNAL_FORMAL_V3_AM11_CROP_CONTEXT_HASH_REQUIRED");

  const schedulerObservedAt = canonicalIsoV1(input.claim.boundary.scheduler_wall_clock_observed_at, "EXTERNAL_FORMAL_V3_AM11_SCHEDULER_OBSERVED_AT_INVALID");
  const evidenceSnapshotTime = canonicalIsoV1(input.evidence_snapshot_time, "EXTERNAL_FORMAL_V3_AM11_EVIDENCE_SNAPSHOT_TIME_REQUIRED");
  const observerStartedAt = canonicalIsoV1(input.observer_started_at, "EXTERNAL_FORMAL_V3_AM11_OBSERVER_STARTED_AT_INVALID");
  if (Date.parse(schedulerObservedAt) < Date.parse(logicalTime)) throw new Error("EXTERNAL_FORMAL_V3_AM11_SCHEDULER_BEFORE_LOGICAL_TIME");
  if (Date.parse(evidenceSnapshotTime) < Date.parse(logicalTime)) throw new Error("EXTERNAL_FORMAL_V3_AM11_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME");
  if (Date.parse(schedulerObservedAt) > Date.parse(evidenceSnapshotTime)) throw new Error("EXTERNAL_FORMAL_V3_AM11_SNAPSHOT_BEFORE_SCHEDULER_OBSERVATION");
  if (Date.parse(evidenceSnapshotTime) > Date.parse(observerStartedAt)) throw new Error("EXTERNAL_FORMAL_V3_AM11_OBSERVER_BEFORE_EVIDENCE_SNAPSHOT");
  if (input.crop_stage_context.determinism_hash !== input.manifest_slot.crop_stage_context_hash) {
    throw new Error("EXTERNAL_FORMAL_V3_AM11_CROP_CONTEXT_HASH_MISMATCH");
  }

  return {
    logical_time: logicalTime,
    scheduler_wall_clock_observed_at: schedulerObservedAt,
    evidence_snapshot_time: evidenceSnapshotTime,
    observer_started_at: observerStartedAt,
    scheduler_to_snapshot_delay_minutes: (Date.parse(evidenceSnapshotTime) - Date.parse(schedulerObservedAt)) / 60_000,
    snapshot_to_observer_delay_minutes: (Date.parse(observerStartedAt) - Date.parse(evidenceSnapshotTime)) / 60_000,
  };
}

function runtimeLeaseFromClaimV1(input: ExecuteExternalFormalV3Amendment11PersistentTickInputV1): RuntimeLeaseClaimV1 {
  return {
    ...externalScopeV1(),
    lease_owner: input.claim.lease_owner,
    fencing_token: input.claim.fencing_token,
    lease_duration_seconds: input.lease_duration_seconds,
  };
}

function canonicalForecastMathV1(forecast: CanonicalObjectEnvelopeV1): {
  forcing_window: Cap04ForecastForcingWindowV1;
  forecast_math: Cap04Pure72hForecastMathResultV1;
} {
  const payload = forecast.payload as unknown as Cap04CanonicalForecastRunPayloadV1;
  validateCap04CanonicalForecastRunPayloadV1(payload);
  if (payload.status !== "COMPLETED") throw new Error("EXTERNAL_FORMAL_V3_AM11_SCENARIO_REQUIRES_COMPLETED_FORECAST");
  const completed = payload as Cap04CanonicalCompletedForecastRunPayloadV1;
  const withoutHash: Omit<Cap04Pure72hForecastMathResultV1, "forecast_math_hash"> = {
    schema_version: "geox_mcft_cap_04_pure_72h_forecast_math_result_v1",
    contract_id: CAP04_PURE_FORECAST_MATH_CONTRACT_ID_V1,
    forecast_payload: structuredClone(completed),
    point_traces: structuredClone(completed.point_traces),
    trajectory_hash: completed.trajectory_hash,
    aggregates: structuredClone(completed.aggregates),
    uncertainty_basis: structuredClone(completed.uncertainty_basis),
    limitations: structuredClone(completed.limitations),
  };
  const result: Cap04Pure72hForecastMathResultV1 = { ...withoutHash, forecast_math_hash: computeCap04ForecastMathHashV1(withoutHash) };
  validateCap04Pure72hForecastMathResultV1(result);
  return { forcing_window: structuredClone(completed.forcing_window_authority), forecast_math: result };
}

function expectedPointersV1(handoff: Awaited<ReturnType<NextTickServicePortV1["prepareNextTickInput"]>>) {
  return {
    active_lineage_ref: handoff.active_lineage_ref,
    lineage_id: handoff.lineage_id,
    revision_id: handoff.revision_id,
    previous_checkpoint_ref: handoff.previous_checkpoint_ref,
    previous_state_ref: handoff.previous_posterior_ref,
    previous_forecast_result_ref: handoff.previous_forecast_result_ref,
    previous_successful_forecast_ref: handoff.latest_successful_forecast_ref,
  };
}

function existingARecordSetConfigV1(recordSet: Cap04ARecordSetV1, input: ExecuteExternalFormalV3Amendment11PersistentTickInputV1): void {
  validateCap04ARecordSetV1(recordSet);
  if (recordSet.operation_key.logical_time !== input.manifest_slot.logical_time) throw new Error("EXTERNAL_FORMAL_V3_AM11_EXISTING_A_TIME_MISMATCH");
  if (recordSet.aggregate_identity_input.runtime_config_ref !== input.manifest_slot.runtime_config_ref) throw new Error("EXTERNAL_FORMAL_V3_AM11_EXISTING_A_CONFIG_REF_MISMATCH");
  if (recordSet.aggregate_identity_input.runtime_config_hash !== input.manifest_slot.runtime_config_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_EXISTING_A_CONFIG_HASH_MISMATCH");
}

export class ExternalFormalV3Amendment11PersistentTickServiceV1 {
  constructor(
    private readonly handoffService: NextTickServicePortV1,
    private readonly evidenceSource: ExternalFormalV3Amendment11DatabaseEvidenceSourcePortV1,
    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: Cap04ForecastScenarioPersistencePortV1,
  ) {}

  async executeClaimedTick(input: ExecuteExternalFormalV3Amendment11PersistentTickInputV1): Promise<ExecuteExternalFormalV3Amendment11PersistentTickResultV1> {
    const timing = validateManifestAndClaimV1(input);
    const scope = externalScopeV1();
    const handoff = await this.handoffService.prepareNextTickInput(scope);
    const a1Identity = deriveCap04ARecordSetIdentityV1({ scope, lineage_id: handoff.lineage_id, revision_id: handoff.revision_id, logical_time: timing.logical_time, operation_variant: CAP04_A1_OPERATION_VARIANT_V1 });
    const a2Identity = deriveCap04ARecordSetIdentityV1({ scope, lineage_id: handoff.lineage_id, revision_id: handoff.revision_id, logical_time: timing.logical_time, operation_variant: CAP04_A2_OPERATION_VARIANT_V1 });
    let aRecordSet = await this.persistence.lookupARecordSet(a1Identity.idempotency_key);
    aRecordSet ??= await this.persistence.lookupARecordSet(a2Identity.idempotency_key);
    const aExistedInitially = aRecordSet !== null;

    if (aRecordSet) existingARecordSetConfigV1(aRecordSet, input);
    else if (handoff.next_logical_tick_time !== timing.logical_time) throw new Error("EXTERNAL_FORMAL_V3_AM11_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK");

    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(input.manifest_slot.runtime_config_ref);
    if (!runtimeConfig) throw new Error("EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_NOT_FOUND");
    if (runtimeConfig.object_id !== input.manifest_slot.runtime_config_ref) throw new Error("EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_REF_MISMATCH");
    if (runtimeConfig.determinism_hash !== input.manifest_slot.runtime_config_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_HASH_MISMATCH");
    if (runtimeConfig.logical_time !== timing.logical_time || runtimeConfig.as_of !== timing.logical_time) throw new Error("EXTERNAL_FORMAL_V3_AM11_RUNTIME_CONFIG_TIME_MISMATCH");
    validateExternalFormalRuntimeConfigPayloadV1(runtimeConfig.payload);
    const externalRuntime = runtimeConfig.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
    const resolvedConfig = new ExternalFormalCap04ExecutionConfigResolverV1().resolveExecutionConfig(runtimeConfig);

    let insertedA = false;
    if (!aRecordSet) {
      if (externalRuntime.parent_runtime_config_ref !== handoff.previous_state_runtime_config_ref
        || externalRuntime.parent_runtime_config_hash !== handoff.previous_state_runtime_config_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_PARENT_RUNTIME_CONFIG_MISMATCH");
      if (externalRuntime.crop_stage_context_authority.context_ref !== input.manifest_slot.crop_stage_context_ref
        || externalRuntime.crop_stage_context_authority.context_hash !== input.manifest_slot.crop_stage_context_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_MANIFEST_CROP_CONTEXT_MISMATCH");
      const evidence = await this.evidenceSource.loadCandidateRecords({ scope, logical_time: timing.logical_time, evidence_snapshot_time: timing.evidence_snapshot_time });
      if (evidence.database_write_count !== 0) throw new Error("EXTERNAL_FORMAL_V3_AM11_EVIDENCE_SOURCE_WRITE_FORBIDDEN");
      if (evidence.provider_request_count !== 0) throw new Error("EXTERNAL_FORMAL_V3_AM11_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
      const candidate = executeExternalFormalCap04Amendment11CandidateV1({
        scope,
        logical_time: timing.logical_time,
        created_at: timing.observer_started_at,
        evidence_snapshot_time: timing.evidence_snapshot_time,
        handoff,
        runtime_config: runtimeConfig,
        candidate_records: evidence.records,
        crop_stage_context: input.crop_stage_context,
      });
      if (candidate.provider_request_count !== 0 || candidate.database_write_count !== 0) throw new Error("EXTERNAL_FORMAL_V3_AM11_CANDIDATE_SIDE_EFFECT_FORBIDDEN");
      const committed = await this.persistence.commitARecordSet({ scope, lease: runtimeLeaseFromClaimV1(input), expected: expectedPointersV1(handoff), record_set: candidate.record_set });
      aRecordSet = committed.record_set;
      insertedA = committed.status === "INSERTED";
      const readback = await this.persistence.readARecordSet(aRecordSet.record_set_id);
      if (!readback || readback.aggregate_determinism_hash !== aRecordSet.aggregate_determinism_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_A_READBACK_MISMATCH");
      aRecordSet = readback;
    }

    validateCap04ARecordSetV1(aRecordSet);
    const forecast = memberV1(aRecordSet, "twin_forecast_run_v1");
    const forecastPayload = forecast.payload as unknown as Cap04CanonicalForecastRunPayloadV1;
    validateCap04CanonicalForecastRunPayloadV1(forecastPayload);

    const common = {
      service_id: EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_ID_V1,
      provider_availability_watermark: EXTERNAL_FORMAL_V3_AMENDMENT11_WATERMARK_ID_V1,
      manifest_ref: input.manifest_slot.manifest_ref,
      manifest_hash: input.manifest_slot.manifest_hash,
      epoch_id: input.manifest_slot.epoch_id,
      slot_id: input.manifest_slot.slot_id,
      logical_time: timing.logical_time,
      scheduler_wall_clock_observed_at: timing.scheduler_wall_clock_observed_at,
      evidence_snapshot_time: timing.evidence_snapshot_time,
      observer_started_at: timing.observer_started_at,
      scheduler_to_snapshot_delay_minutes: timing.scheduler_to_snapshot_delay_minutes,
      snapshot_to_observer_delay_minutes: timing.snapshot_to_observer_delay_minutes,
      fixed_lag_authority_used: false as const,
      scheduler_claim_reused_as_runtime_lease: true as const,
      second_runtime_write_lease_acquired: false as const,
      runtime_provider_request_count: 0 as const,
      runtime_r2_head_count: 0 as const,
      recommendation_write_count: 0 as const,
      approval_write_count: 0 as const,
      action_write_count: 0 as const,
      dispatch_write_count: 0 as const,
      model_activation_write_count: 0 as const,
    };

    if (aRecordSet.operation_key.operation_variant === CAP04_A2_OPERATION_VARIANT_V1) {
      if (forecastPayload.status !== "BLOCKED") throw new Error("EXTERNAL_FORMAL_V3_AM11_A2_FORECAST_STATUS_MISMATCH");
      const illegalScenario = await this.persistence.readScenarioSetBySourceForecast(forecast.object_id, forecast.determinism_hash);
      if (illegalScenario !== null) throw new Error("EXTERNAL_FORMAL_V3_AM11_A2_SCENARIO_FORBIDDEN");
      const next = await this.handoffService.prepareNextTickInput(scope);
      if (next.next_logical_tick_time !== addOneHourV1(timing.logical_time)) throw new Error("EXTERNAL_FORMAL_V3_AM11_NEXT_HANDOFF_TIME_MISMATCH");
      return { ...common, status: insertedA ? "INSERTED_A2_BLOCKED" : "EXISTING_A2_BLOCKED", a_record_set: aRecordSet, b_record: null, scenario_math: null, next_logical_tick_time: next.next_logical_tick_time };
    }

    if (aRecordSet.operation_key.operation_variant !== CAP04_A1_OPERATION_VARIANT_V1 || forecastPayload.status !== "COMPLETED") throw new Error("EXTERNAL_FORMAL_V3_AM11_A1_FORECAST_STATUS_MISMATCH");
    const canonical = canonicalForecastMathV1(forecast);
    const scenarioMath = executeCap04PureThreeScenarioMathV1({
      source_forecast: { ref: forecast.object_id, hash: forecast.determinism_hash, math_result: canonical.forecast_math },
      runtime_config: { ref: runtimeConfig.object_id, hash: runtimeConfig.determinism_hash, payload: resolvedConfig.payload },
      forcing_window: canonical.forcing_window,
    });
    const scenarioCandidate = buildCap04ScenarioSetRecordV1({ source_forecast: forecast, scenario_math_result: scenarioMath, created_at: timing.observer_started_at });
    let bRecord = await this.persistence.lookupScenarioSet(scenarioCandidate.idempotency_key);
    const bExistedInitially = bRecord !== null;
    if (bRecord) {
      validateCap04ScenarioSetRecordV1(bRecord, forecast);
      if (bRecord.aggregate_determinism_hash !== scenarioCandidate.aggregate_determinism_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_SCENARIO_IDEMPOTENCY_CONFLICT");
    } else {
      const committedB = await this.persistence.commitScenarioSet({ scope, lease: runtimeLeaseFromClaimV1(input), record: scenarioCandidate });
      bRecord = committedB.record;
    }
    const bReadback = await this.persistence.readScenarioSet(bRecord.scenario_set_id);
    if (!bReadback) throw new Error("EXTERNAL_FORMAL_V3_AM11_SCENARIO_READBACK_NOT_FOUND");
    validateCap04ScenarioSetRecordV1(bReadback, forecast);
    if (bReadback.aggregate_determinism_hash !== bRecord.aggregate_determinism_hash) throw new Error("EXTERNAL_FORMAL_V3_AM11_SCENARIO_READBACK_HASH_MISMATCH");
    bRecord = bReadback;

    const next = await this.handoffService.prepareNextTickInput(scope);
    if (next.next_logical_tick_time !== addOneHourV1(timing.logical_time)) throw new Error("EXTERNAL_FORMAL_V3_AM11_NEXT_HANDOFF_TIME_MISMATCH");
    return {
      ...common,
      status: aExistedInitially ? (bExistedInitially ? "EXISTING_A1_WITH_SCENARIO" : "RECOVERED_PENDING_SCENARIO") : (insertedA ? "INSERTED_A1_WITH_SCENARIO" : "EXISTING_A1_WITH_SCENARIO"),
      a_record_set: aRecordSet,
      b_record: bRecord,
      scenario_math: scenarioMath,
      next_logical_tick_time: next.next_logical_tick_time,
    };
  }
}
