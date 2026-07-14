// scripts/runtime_acceptance/mcft_cap_05_s8_forecast_residual_fixture_v1.ts
// Purpose: assemble a deterministic post-receipt Forecast, one real CAP-04 outcome tick at T+1, and bounded in-memory C Forecast Residual source/persistence ports for MCFT-CAP-05 S8 acceptance.
// Boundary: acceptance fixture only; no production database, route, scheduler, range, restart/backfill, Recommendation, AO-ACT, calibration, model activation, causal attribution or CAP-06 authority.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  buildCap05ActionFeedbackV1,
  CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
  CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
  CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
  type Cap05ActionFeedbackEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
  CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  compileCap04RuntimeConfigV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type {
  Cap05PersistedObjectV1,
  Cap05PersistenceResultV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import {
  CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
  CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
} from "../../apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import {
  Cap05ForecastResidualOutcomeTickServiceV1,
  type Cap05ForecastResidualHistoricalSourcePortV1,
  type Cap05ForecastResidualPersistencePortV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.js";
import type { Cap05HistoricalForecastResidualCandidateV1 } from "../../apps/server/src/runtime/twin_runtime/historical_forecast_residual_selector_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import {
  Cap05ReceiptConsumingForecastScenarioTickServiceV1,
  type Cap05ActionFeedbackSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";
import {
  CAP04_S6_LOGICAL_TIME_V1,
  InMemoryCap04SingleTickRuntimeV1,
  buildCap04S6SingleTickFixtureV1,
} from "./mcft_cap_04_single_tick_fixture_v1.js";

export const CAP05_S8_POST_RECEIPT_TIME_V1 = CAP04_S6_LOGICAL_TIME_V1;
export const CAP05_S8_OUTCOME_TIME_V1 = addHoursV1(CAP05_S8_POST_RECEIPT_TIME_V1, 1);
export const CAP05_S8_OUTCOME_CREATED_AT_V1 = addMinutesV1(CAP05_S8_OUTCOME_TIME_V1, 5);

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function addHoursV1(value: string, hours: number): string {
  return addMinutesV1(value, hours * 60);
}

function exactScopeFromEnvelopeV1(value: CanonicalObjectEnvelopeV1): TwinScopeKeyV1 {
  if (!value.group_id || !value.season_id || !value.zone_id) throw new Error("CAP05_S8_FIXTURE_SCOPE_REQUIRED");
  return {
    tenant_id: value.tenant_id,
    project_id: value.project_id,
    group_id: value.group_id,
    field_id: value.field_id,
    season_id: value.season_id,
    zone_id: value.zone_id,
  };
}

function memberV1(result: ExecuteCap04SingleTickResultV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = result.a_record_set.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP05_S8_FIXTURE_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

export function applyCap05S8RuntimePoliciesV1(
  source: CanonicalObjectEnvelopeV1,
): CanonicalObjectEnvelopeV1 {
  const config = structuredClone(source);
  const sourcePayload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  config.payload = {
    ...config.payload,
    action_feedback_state_input_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    action_feedback_quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    evidence_cutoff_policy_id: CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
    late_receipt_policy_id: CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
    execution_interval_policy_id: CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
    multiple_execution_event_policy_id: CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
    spatial_overlap_policy_id: CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
    actual_amount_semantics_policy_id: CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
    effective_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    volume_to_depth_policy_id: CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
    action_feedback_adapter_policy_id: CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
    forecast_residual_matching_policy_id: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
    forecast_point_member_ref_policy_id: CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
    forecast_observation_projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    forecast_observation_projection_version: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
    forecast_residual_normalization_policy_id: CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  };
  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    logical_time: config.logical_time,
    parent_runtime_config_ref: sourcePayload.parent_runtime_config_ref,
    parent_runtime_config_hash: sourcePayload.parent_runtime_config_hash,
    payload: config.payload,
  };
  config.object_id = deriveSemanticObjectIdV1("cap05_s8_runtime_config", identityBasis);
  config.idempotency_key = deriveSemanticObjectIdV1("cap05_s8_runtime_config_key", identityBasis);
  config.determinism_hash = "";
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}

function buildPostReceiptActionFeedbackV1(input: {
  config: CanonicalObjectEnvelopeV1;
  scope: TwinScopeKeyV1;
  context_lineage_ref: string;
  context_revision_ref: string;
}): Cap05ActionFeedbackEnvelopeV1 {
  const executionStart = addMinutesV1(CAP05_S8_POST_RECEIPT_TIME_V1, -30);
  const executionEnd = addMinutesV1(CAP05_S8_POST_RECEIPT_TIME_V1, -10);
  const availableAt = addMinutesV1(CAP05_S8_POST_RECEIPT_TIME_V1, -5);
  return buildCap05ActionFeedbackV1({
    scope: input.scope,
    decision_ref: "twin_decision_record_cap05_s8_fixture",
    decision_hash: "sha256:decision-cap05-s8-fixture",
    approved_plan_evidence_ref: "approved_plan_cap05_s8_fixture",
    approved_plan_evidence_hash: "sha256:approved-plan-cap05-s8-fixture",
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: "receipt_cap05_s8_post_receipt",
    dispatch_disposition: "NOT_OBSERVED",
    event_id: "irrigation_event_cap05_s8_post_receipt",
    source_record_id: "receipt_source_cap05_s8_post_receipt",
    binding_id: "irrigation_binding_cap05_s8",
    origin_source_id: "controlled_irrigation_executor_cap05_s8",
    execution_status: "PARTIALLY_EXECUTED",
    validation_status: "NOT_YET_VALIDATED",
    source_quality: "PASS",
    eligible_for_state_input: true,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: executionStart,
    execution_end: executionEnd,
    ingested_at: availableAt,
    available_to_runtime_at: availableAt,
    runtime_config_ref: input.config.object_id,
    runtime_config_hash: input.config.determinism_hash,
    context_lineage_ref: input.context_lineage_ref,
    context_revision_ref: input.context_revision_ref,
    created_at: availableAt,
  });
}

class InMemoryActionFeedbackSourceV1 implements Cap05ActionFeedbackSourcePortV1 {
  load_count = 0;

  constructor(private readonly values: readonly Cap05ActionFeedbackEnvelopeV1[]) {}

  async loadActionFeedbackCandidates(): Promise<readonly Cap05ActionFeedbackEnvelopeV1[]> {
    this.load_count += 1;
    return structuredClone(this.values);
  }
}

function replayRecordV1(input: {
  scope: TwinScopeKeyV1;
  record_type: "observed_rainfall_v1" | "historical_et0_estimate_v1" | "soil_moisture_observation_v1";
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  role_time: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
}): CanonicalReplayEvidenceRecordV1 {
  const sourcePayload = {
    ...structuredClone(input.canonical_payload),
    source_version: "1",
    unit: input.source_unit,
  };
  const semantic = {
    scope: input.scope,
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    role_time: input.role_time,
    canonical_payload: input.canonical_payload,
  };
  return {
    ...input.scope,
    dataset_id: "mcft_cap05_s8_outcome_fixture_v1",
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: String(input.role_time.ingested_at),
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: sourcePayload,
    canonical_payload: structuredClone(input.canonical_payload),
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
  };
}

function outcomeEvidenceV1(input: {
  scope: TwinScopeKeyV1;
  observation_value: number;
}): CanonicalReplayEvidenceRecordV1[] {
  const ingestedAt = CAP05_S8_OUTCOME_TIME_V1;
  const rainfall = replayRecordV1({
    scope: input.scope,
    record_type: "observed_rainfall_v1",
    source_record_id: "rain_cap05_s8_outcome",
    binding_id: "rainfall_c8_hourly_v1",
    origin_source_id: "weather_replay_cap05_s8",
    role_time: {
      interval_start: CAP05_S8_POST_RECEIPT_TIME_V1,
      interval_end: CAP05_S8_OUTCOME_TIME_V1,
      ingested_at: ingestedAt,
    },
    canonical_payload: { value: 0.6, unit: "mm" },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const et0 = replayRecordV1({
    scope: input.scope,
    record_type: "historical_et0_estimate_v1",
    source_record_id: "et0_cap05_s8_outcome",
    binding_id: "historical_et0_c8_hourly_v1",
    origin_source_id: "et0_replay_cap05_s8",
    role_time: {
      interval_start: CAP05_S8_POST_RECEIPT_TIME_V1,
      interval_end: CAP05_S8_OUTCOME_TIME_V1,
      ingested_at: ingestedAt,
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    canonical_payload: {
      value: 0.12,
      unit: "mm",
      calculation_method: "FAO56_PM_REPLAY_V1",
      method_version: "1",
    },
    source_unit: "mm",
    canonical_unit: "mm",
  });
  const observation = replayRecordV1({
    scope: input.scope,
    record_type: "soil_moisture_observation_v1",
    source_record_id: "soil_cap05_s8_outcome_exact_target",
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_id: "soil_sensor_cap05_s8",
    role_time: {
      observed_at: CAP05_S8_OUTCOME_TIME_V1,
      ingested_at: ingestedAt,
    },
    canonical_payload: {
      value: input.observation_value,
      unit: "fraction",
      quantity_kind: "VOLUMETRIC_WATER_CONTENT",
    },
    source_unit: "fraction",
    canonical_unit: "fraction",
  });
  const issuedAt = addMinutesV1(CAP05_S8_OUTCOME_TIME_V1, -40);
  const availableAt = addMinutesV1(CAP05_S8_OUTCOME_TIME_V1, -30);
  const weather = buildCap04FutureForcingSnapshotV1({
    kind: "weather",
    logical_time: CAP05_S8_OUTCOME_TIME_V1,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: "weather_cap05_s8_outcome_selected",
    seed: 8,
    scope_override: input.scope,
  });
  const futureEt0 = buildCap04FutureForcingSnapshotV1({
    kind: "et0",
    logical_time: CAP05_S8_OUTCOME_TIME_V1,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    source_record_id: "future_et0_cap05_s8_outcome_selected",
    seed: 8,
    scope_override: input.scope,
  });
  return [rainfall, et0, observation, weather, futureEt0];
}

class FixedEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  load_count = 0;

  constructor(private readonly values: readonly CanonicalReplayEvidenceRecordV1[]) {}

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    if (input.logical_time !== CAP05_S8_OUTCOME_TIME_V1) throw new Error("CAP05_S8_FIXTURE_OUTCOME_TIME_MISMATCH");
    this.load_count += 1;
    return structuredClone(this.values);
  }
}

export class InMemoryHistoricalForecastSourceV1 implements Cap05ForecastResidualHistoricalSourcePortV1 {
  load_count = 0;

  constructor(private readonly values: readonly Cap05HistoricalForecastResidualCandidateV1[]) {}

  replace(values: readonly Cap05HistoricalForecastResidualCandidateV1[]): void {
    this.values = structuredClone(values);
  }

  async loadHistoricalForecastCandidates(): Promise<readonly Cap05HistoricalForecastResidualCandidateV1[]> {
    this.load_count += 1;
    return structuredClone(this.values);
  }
}

export class InMemoryForecastResidualPersistenceV1 implements Cap05ForecastResidualPersistencePortV1 {
  private readonly byId = new Map<string, Cap05ForecastResidualEnvelopeV1>();
  private readonly byKey = new Map<string, Cap05ForecastResidualEnvelopeV1>();
  commit_count = 0;
  read_count = 0;

  async lookupByIdempotencyKey(idempotencyKey: string): Promise<Cap05PersistedObjectV1 | null> {
    const value = this.byKey.get(idempotencyKey);
    return value ? structuredClone(value) : null;
  }

  async commitCanonicalObject(input: {
    object: Cap05ForecastResidualEnvelopeV1;
  }): Promise<Cap05PersistenceResultV1> {
    validateCap05ForecastResidualV1(input.object);
    const existing = this.byKey.get(input.object.idempotency_key);
    if (existing) {
      if (existing.object_id !== input.object.object_id
        || existing.determinism_hash !== input.object.determinism_hash) {
        throw new Error("CAP05_S8_FIXTURE_RESIDUAL_IDEMPOTENCY_CONFLICT");
      }
      return {
        status: "EXISTING_IDEMPOTENT_SUCCESS",
        object: structuredClone(existing),
        fact_id: `fact_${existing.object_id}`,
      };
    }
    this.commit_count += 1;
    this.byId.set(input.object.object_id, structuredClone(input.object));
    this.byKey.set(input.object.idempotency_key, structuredClone(input.object));
    return {
      status: "INSERTED",
      object: structuredClone(input.object),
      fact_id: `fact_${input.object.object_id}`,
    };
  }

  async readCanonicalObject(objectId: string): Promise<Cap05PersistedObjectV1 | null> {
    this.read_count += 1;
    const value = this.byId.get(objectId);
    return value ? structuredClone(value) : null;
  }
}

export type Cap05S8ForecastResidualFixtureV1 = {
  runtime: InMemoryCap04SingleTickRuntimeV1;
  scope: TwinScopeKeyV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  post_receipt_config: CanonicalObjectEnvelopeV1;
  outcome_config: CanonicalObjectEnvelopeV1;
  action_feedback: Cap05ActionFeedbackEnvelopeV1;
  post_receipt_tick: ExecuteCap04SingleTickResultV1;
  historical_forecast: CanonicalObjectEnvelopeV1;
  historical_source: InMemoryHistoricalForecastSourceV1;
  residual_persistence: InMemoryForecastResidualPersistenceV1;
  outcome_evidence_source: FixedEvidenceSourceV1;
  outcome_tick_service: Cap04ForecastScenarioSingleTickServiceV1;
  service: Cap05ForecastResidualOutcomeTickServiceV1;
  input: ExecuteCap04SingleTickInputV1;
  observation_record: CanonicalReplayEvidenceRecordV1;
};

export async function buildCap05S8ForecastResidualFixtureV1(): Promise<Cap05S8ForecastResidualFixtureV1> {
  const base = buildCap04S6SingleTickFixtureV1();
  const scope = exactScopeFromEnvelopeV1(base.runtime_config);
  const predecessor = base.runtime.currentSnapshotV1();
  const postReceiptConfig = applyCap05S8RuntimePoliciesV1(base.runtime_config);
  await base.runtime.commitRuntimeConfig(postReceiptConfig);
  const feedback = buildPostReceiptActionFeedbackV1({
    config: postReceiptConfig,
    scope,
    context_lineage_ref: predecessor.active_lineage_ref,
    context_revision_ref: String(predecessor.previous_posterior.revision_id),
  });
  const actionFeedbackSource = new InMemoryActionFeedbackSourceV1([feedback]);
  const receiptService = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
    new PrepareNextTickInputServiceV1(base.runtime),
    base.runtime,
    actionFeedbackSource,
    base.runtime,
    base.runtime,
  );
  const postReceiptInput: ExecuteCap04SingleTickInputV1 = {
    ...base.input,
    runtime_config_ref: postReceiptConfig.object_id,
    runtime_config_hash: postReceiptConfig.determinism_hash,
  };
  const postReceiptTick = await receiptService.executeOneTick(postReceiptInput);
  const historicalForecast = memberV1(postReceiptTick, "twin_forecast_run_v1");
  const sourceEvidence = memberV1(postReceiptTick, "twin_evidence_window_v1");
  if (!Array.isArray(sourceEvidence.payload.consumed_evidence_refs)
    || !sourceEvidence.payload.consumed_evidence_refs.includes(feedback.object_id)) {
    throw new Error("CAP05_S8_FIXTURE_SOURCE_FORECAST_DID_NOT_CONSUME_ACTION_FEEDBACK");
  }
  if (historicalForecast.payload.status !== "COMPLETED"
    || !Array.isArray(historicalForecast.payload.points)
    || historicalForecast.payload.points.length !== 72) {
    throw new Error("CAP05_S8_FIXTURE_POST_RECEIPT_FORECAST_REQUIRED");
  }

  const postReceiptPayload = postReceiptConfig.payload as unknown as Cap04RuntimeConfigPayloadV1;
  const outcomeBaseConfig = compileCap04RuntimeConfigV1({
    scope,
    effective_logical_time: CAP05_S8_OUTCOME_TIME_V1,
    created_at: CAP05_S8_OUTCOME_TIME_V1,
    parent_runtime_config_ref: postReceiptConfig.object_id,
    parent_runtime_config_hash: postReceiptConfig.determinism_hash,
    reality_binding_ref: postReceiptPayload.reality_binding_ref,
    reality_binding_hash: postReceiptPayload.reality_binding_hash,
    source_matrix_hash: postReceiptPayload.source_matrix_hash,
    configuration_matrix_hash: postReceiptPayload.configuration_matrix_hash,
    geometry_semantic_hash: postReceiptPayload.geometry_semantic_hash,
  });
  const outcomeConfig = applyCap05S8RuntimePoliciesV1(outcomeBaseConfig);
  await base.runtime.commitRuntimeConfig(outcomeConfig);

  const horizonOne = (historicalForecast.payload.points as Array<Record<string, unknown>>)
    .find((point) => point.horizon_hour === 1);
  if (!horizonOne) throw new Error("CAP05_S8_FIXTURE_HORIZON_ONE_REQUIRED");
  const rootZoneDepth = postReceiptPayload.soil_hydraulic_snapshot.root_zone_depth_mm;
  const predictedVwc = Number(horizonOne.storage_mean_mm) / rootZoneDepth;
  const observationValue = Number(Math.min(
    postReceiptPayload.soil_hydraulic_snapshot.saturation_fraction - 0.001,
    predictedVwc + 0.001,
  ).toFixed(6));
  const outcomeRecords = outcomeEvidenceV1({ scope, observation_value: observationValue });
  const observationRecord = outcomeRecords.find((record) => record.record_type === "soil_moisture_observation_v1");
  if (!observationRecord) throw new Error("CAP05_S8_FIXTURE_OUTCOME_OBSERVATION_REQUIRED");
  const outcomeEvidenceSource = new FixedEvidenceSourceV1(outcomeRecords);
  const outcomeTickService = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(base.runtime),
    outcomeEvidenceSource,
    base.runtime,
    base.runtime,
  );
  const historicalSource = new InMemoryHistoricalForecastSourceV1([{
    forecast: structuredClone(historicalForecast),
    source_posterior_action_feedback_refs: [feedback.object_id],
  }]);
  const residualPersistence = new InMemoryForecastResidualPersistenceV1();
  const service = new Cap05ForecastResidualOutcomeTickServiceV1(
    outcomeTickService,
    base.runtime,
    historicalSource,
    residualPersistence,
  );
  const input: ExecuteCap04SingleTickInputV1 = {
    ...postReceiptInput,
    logical_time: CAP05_S8_OUTCOME_TIME_V1,
    created_at: CAP05_S8_OUTCOME_CREATED_AT_V1,
    runtime_config_ref: outcomeConfig.object_id,
    runtime_config_hash: outcomeConfig.determinism_hash,
  };
  return {
    runtime: base.runtime,
    scope,
    crop_stage_context: base.crop_stage_context,
    post_receipt_config: postReceiptConfig,
    outcome_config: outcomeConfig,
    action_feedback: feedback,
    post_receipt_tick: postReceiptTick,
    historical_forecast: historicalForecast,
    historical_source: historicalSource,
    residual_persistence: residualPersistence,
    outcome_evidence_source: outcomeEvidenceSource,
    outcome_tick_service: outcomeTickService,
    service,
    input,
    observation_record: observationRecord,
  };
}

export function memberFromCap05S8TickV1(
  result: ExecuteCap04SingleTickResultV1,
  objectType: string,
): CanonicalObjectEnvelopeV1 {
  return memberV1(result, objectType);
}
