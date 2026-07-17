// scripts/runtime_acceptance/mcft_cap_06_s5_graph_conformant_fixture_v2.ts
// Purpose: derive the append-only S5 predecessor graph-conformant controlled profile from the effective S1 numerical cases while adding a real Observation Evidence -> Assimilation -> observation posterior chain.
// Boundary: deterministic acceptance fixture only; no production database, calibration search, Candidate, Evaluation, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import {
  buildCap05ForecastPointMemberRefV1,
  buildCap05ForecastResidualV1,
  validateCap05ForecastResidualV1,
  type Cap05ForecastResidualEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ForecastPointV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
  CAP06_S1_CALIBRATION_CASE_COUNT_V1,
  CAP06_S1_CONTROLLED_TRACK_V1,
  CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
  CAP06_S1_HOLDOUT_CASE_COUNT_V1,
  CAP06_S1_OBSERVATION_VARIANCE_V1,
  CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1,
  CAP06_S1_REPOSITORY_TRACK_V1,
  CAP06_S1_TOTAL_CASE_COUNT_V1,
  buildCap06S1ControlledDatasetV1,
  type Cap06S1ControlledCaseV1,
} from "./mcft_cap_06_s1_residual_windows_fixture_v1.js";

export const CAP06_S5_GRAPH_PROFILE_ID_V2 =
  "PRESEEDED_24_H1_FORECAST_OBSERVATION_POSTERIOR_GRAPHS_V2" as const;
export const CAP06_S5_GRAPH_CORRECTION_ID_V1 =
  "MCFT-CAP-06.S5-PREDECESSOR-GRAPH-CONFORMANCE-V1" as const;

export type Cap06S5GraphObservationRecordV2 = {
  record_type: "mcft_cap06_s5_graph_observation_v2";
  source_record_id: string;
  source_record_hash: string;
  evidence_identity_key: string;
  qualification_track: typeof CAP06_S1_CONTROLLED_TRACK_V1;
  profile_id: typeof CAP06_S5_GRAPH_PROFILE_ID_V2;
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
  observed_at: string;
  available_to_runtime_at: string;
  quality_status: "PASS";
  canonical_unit: "fraction";
  canonical_value: string;
  observation_variance: typeof CAP06_S1_OBSERVATION_VARIANCE_V1;
  representativeness_variance: typeof CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1;
  hidden_parameter_key: "dynamics_parameters.drainage_coefficient_per_hour";
  hidden_parameter_value: typeof CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1;
  source_forecast_ref: string;
  source_forecast_hash: string;
  source_forecast_point_ref: string;
  source_forecast_point_hash: string;
};

export type Cap06S5GraphConformantCaseV2 = {
  case_index: number;
  source_s1_residual_ref: string;
  source_s1_residual_hash: string;
  source_state: CanonicalObjectEnvelopeV1;
  source_evidence_window: CanonicalObjectEnvelopeV1;
  source_forecast: CanonicalObjectEnvelopeV1;
  source_runtime_config: CanonicalObjectEnvelopeV1;
  forecast_point: Cap04ForecastPointV1;
  observation_record: Cap06S5GraphObservationRecordV2;
  observation_evidence_window: CanonicalObjectEnvelopeV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
  observation_posterior: CanonicalObjectEnvelopeV1;
  residual: Cap05ForecastResidualEnvelopeV1;
  base_replay_storage_mm: string;
  hidden_replay_storage_mm: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
};

export type Cap06S5GraphConformantDatasetV2 = {
  schema_version: "geox_mcft_cap_06_s5_graph_conformant_dataset_v2";
  correction_id: typeof CAP06_S5_GRAPH_CORRECTION_ID_V1;
  profile_id: typeof CAP06_S5_GRAPH_PROFILE_ID_V2;
  qualification_track: typeof CAP06_S1_CONTROLLED_TRACK_V1;
  repository_history_track: typeof CAP06_S1_REPOSITORY_TRACK_V1;
  source_s1_residual_set_hash: string;
  source_s1_case_input_set_hash: string;
  base_drainage_coefficient: typeof CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1;
  hidden_drainage_coefficient: typeof CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1;
  cases: Cap06S5GraphConformantCaseV2[];
  ordered_residual_refs: string[];
  ordered_residual_hashes: string[];
  residual_set_hash: string;
  calibration_window_refs: string[];
  calibration_window_hash: string;
  holdout_window_refs: string[];
  holdout_window_hash: string;
  case_input_set_hash: string;
  graph_assembly_set_hash: string;
  model_component_hash: string;
  effective_parameter_bundle_hash: string;
  observation_operator_hash: string;
  geometry_hash: string;
  runtime_replay_numeric_policy_hash: string;
};

type ScopeV2 = Pick<CanonicalObjectEnvelopeV1,
  "tenant_id" | "project_id" | "group_id" | "field_id" | "season_id" | "zone_id">;

function scopeV2(forecast: CanonicalObjectEnvelopeV1): ScopeV2 {
  return {
    tenant_id: forecast.tenant_id,
    project_id: forecast.project_id,
    group_id: forecast.group_id,
    field_id: forecast.field_id,
    season_id: forecast.season_id,
    zone_id: forecast.zone_id,
  };
}

function envelopeV2(input: {
  object_type: "twin_evidence_window_v1" | "twin_assimilation_update_v1" | "twin_state_estimate_v1";
  object_id?: string;
  scope: ScopeV2;
  logical_time: string;
  source_refs: string[];
  evidence_refs: string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  lineage_id: string;
  revision_id: string;
  payload: Record<string, unknown>;
  limitations: string[];
}): CanonicalObjectEnvelopeV1 {
  const sourceRefs = [...input.source_refs].sort();
  const evidenceRefs = [...input.evidence_refs].sort();
  const identity = {
    object_type: input.object_type,
    correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    scope: input.scope,
    logical_time: input.logical_time,
    source_refs: sourceRefs,
    evidence_refs: evidenceRefs,
  };
  const object: CanonicalObjectEnvelopeV1 = {
    object_id: input.object_id
      ?? deriveSemanticObjectIdV1(input.object_type.replace(/_v1$/, ""), identity),
    object_type: input.object_type,
    schema_version: "v2",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: sourceRefs,
    evidence_refs: evidenceRefs,
    runtime_config_ref: input.runtime_config_ref,
    runtime_config_hash: input.runtime_config_hash,
    idempotency_key: deriveSemanticObjectIdV1(`${input.object_type}_key`, identity),
    determinism_hash: "",
    limitations: [...input.limitations],
    created_at: input.logical_time,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    payload: structuredClone(input.payload),
  };
  object.determinism_hash = computeMemberDeterminismHashV1(
    object as unknown as Record<string, unknown>,
  );
  validateCanonicalObjectV1(object);
  return object;
}

function observationV2(
  source: Cap06S1ControlledCaseV1,
  caseIndex: number,
): Cap06S5GraphObservationRecordV2 {
  const scope = scopeV2(source.source_forecast);
  const sourceRecordId = deriveSemanticObjectIdV1("mcft_cap06_s5_graph_observation", {
    correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
    scope,
    observed_at: source.observation_record.observed_at,
    available_to_runtime_at: source.observation_record.available_to_runtime_at,
    case_index: caseIndex,
  });
  const semantic = {
    record_type: "mcft_cap06_s5_graph_observation_v2" as const,
    source_record_id: sourceRecordId,
    evidence_identity_key: `CAP06_S5_GRAPH_OBSERVATION:${sourceRecordId}`,
    qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
    profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
    ...scope,
    observed_at: source.observation_record.observed_at,
    available_to_runtime_at: source.observation_record.available_to_runtime_at,
    quality_status: "PASS" as const,
    canonical_unit: "fraction" as const,
    canonical_value: source.observation_record.canonical_value,
    observation_variance: CAP06_S1_OBSERVATION_VARIANCE_V1,
    representativeness_variance: CAP06_S1_REPRESENTATIVENESS_VARIANCE_V1,
    hidden_parameter_key: "dynamics_parameters.drainage_coefficient_per_hour" as const,
    hidden_parameter_value: CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
    source_forecast_ref: source.source_forecast.object_id,
    source_forecast_hash: source.source_forecast.determinism_hash,
    source_forecast_point_ref: buildCap05ForecastPointMemberRefV1(
      source.source_forecast.object_id,
      1,
    ),
    source_forecast_point_hash: source.forecast_point.determinism_hash,
  };
  return {
    ...semantic,
    source_record_hash: semanticHashV1(semantic),
  };
}

function observationWindowV2(input: {
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S5GraphObservationRecordV2;
}): CanonicalObjectEnvelopeV1 {
  const candidate = {
    observation_ref: input.observation.source_record_id,
    source_record_id: input.observation.source_record_id,
    source_record_hash: input.observation.source_record_hash,
    observed_at: input.observation.observed_at,
    available_to_runtime_at: input.observation.available_to_runtime_at,
    quality_status: input.observation.quality_status,
    canonical_unit: input.observation.canonical_unit,
    canonical_value: input.observation.canonical_value,
    candidate_assessment: "SELECTED",
    rejection_reasons: [],
  };
  return envelopeV2({
    object_type: "twin_evidence_window_v1",
    scope: scopeV2(input.forecast),
    logical_time: input.observation.available_to_runtime_at,
    source_refs: [input.observation.source_record_id],
    evidence_refs: [input.observation.source_record_id],
    runtime_config_ref: String(input.forecast.runtime_config_ref),
    runtime_config_hash: String(input.forecast.runtime_config_hash),
    lineage_id: String(input.forecast.lineage_id),
    revision_id: String(input.forecast.revision_id),
    payload: {
      evidence_window_contract_id: "MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2",
      frozen: true,
      observation_selection: {
        policy_id: "MCFT_CAP_06_S5_EXACT_CONTROLLED_OBSERVATION_V2",
        candidates: [candidate],
        selected_observation_ref: input.observation.source_record_id,
      },
      selected_evidence_refs: [input.observation.source_record_id],
      assimilation_applied_evidence_refs: [input.observation.source_record_id],
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
      correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    },
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_REPOSITORY_HISTORY",
      "NOT_FIELD_OBSERVATION",
      "NO_CALIBRATION_CANDIDATE",
    ],
  });
}

function posteriorIdV2(input: {
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S5GraphObservationRecordV2;
}): string {
  return deriveSemanticObjectIdV1("twin_state_estimate", {
    correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
    state_kind: "CONTROLLED_OBSERVATION_POSTERIOR",
    scope: scopeV2(input.forecast),
    observation_ref: input.observation.source_record_id,
    logical_time: input.observation.available_to_runtime_at,
  });
}

function assimilationV2(input: {
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S5GraphObservationRecordV2;
  observation_window: CanonicalObjectEnvelopeV1;
  posterior_state_ref: string;
}): CanonicalObjectEnvelopeV1 {
  return envelopeV2({
    object_type: "twin_assimilation_update_v1",
    scope: scopeV2(input.forecast),
    logical_time: input.observation.available_to_runtime_at,
    source_refs: [input.observation_window.object_id, input.observation.source_record_id],
    evidence_refs: [input.observation.source_record_id],
    runtime_config_ref: String(input.forecast.runtime_config_ref),
    runtime_config_hash: String(input.forecast.runtime_config_hash),
    lineage_id: String(input.forecast.lineage_id),
    revision_id: String(input.forecast.revision_id),
    payload: {
      status: "APPLIED",
      disposition: "ACCEPTED",
      evidence_window_ref: input.observation_window.object_id,
      evidence_window_hash: input.observation_window.determinism_hash,
      selected_observation_ref: input.observation.source_record_id,
      selected_observation_hash: input.observation.source_record_hash,
      posterior_state_ref: input.posterior_state_ref,
      applied_observation_refs: [input.observation.source_record_id],
      actual_observation: Number(input.observation.canonical_value),
      observation_variance: Number(input.observation.observation_variance),
      representativeness_variance: Number(input.observation.representativeness_variance),
      observation_operator: {
        id: "POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
        version: "1",
        h: 1,
        direct_state_equivalence: false,
      },
      model_parameter_change_applied: false,
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
      correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    },
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_RUNTIME_STATE_AUTHORITY",
      "NO_MODEL_PARAMETER_CHANGE",
      "NO_CALIBRATION_CANDIDATE",
    ],
  });
}

function posteriorV2(input: {
  object_id: string;
  forecast: CanonicalObjectEnvelopeV1;
  observation: Cap06S5GraphObservationRecordV2;
  observation_window: CanonicalObjectEnvelopeV1;
  assimilation_update: CanonicalObjectEnvelopeV1;
}): CanonicalObjectEnvelopeV1 {
  return envelopeV2({
    object_type: "twin_state_estimate_v1",
    object_id: input.object_id,
    scope: scopeV2(input.forecast),
    logical_time: input.observation.available_to_runtime_at,
    source_refs: [input.observation_window.object_id, input.assimilation_update.object_id],
    evidence_refs: [input.observation.source_record_id],
    runtime_config_ref: String(input.forecast.runtime_config_ref),
    runtime_config_hash: String(input.forecast.runtime_config_hash),
    lineage_id: String(input.forecast.lineage_id),
    revision_id: String(input.forecast.revision_id),
    payload: {
      state_kind: "CONTROLLED_OBSERVATION_POSTERIOR",
      evidence_window_ref: input.observation_window.object_id,
      evidence_window_hash: input.observation_window.determinism_hash,
      assimilation_update_ref: input.assimilation_update.object_id,
      assimilation_update_hash: input.assimilation_update.determinism_hash,
      selected_observation_ref: input.observation.source_record_id,
      selected_observation_hash: input.observation.source_record_hash,
      confidence: {
        status: "NOT_ESTABLISHED",
        reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL",
      },
      use_eligibility: {
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
      model_parameter_change_applied: false,
      qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
      profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
      correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    },
    limitations: [
      "CONTROLLED_POSITIVE_MECHANISM_TRACK_ONLY",
      "NOT_RUNTIME_STATE_AUTHORITY",
      "NO_CALIBRATED_CONFIDENCE_MODEL",
      "NO_MODEL_PARAMETER_CHANGE",
      "NO_CALIBRATION_CANDIDATE",
    ],
  });
}

function correctedCaseV2(
  source: Cap06S1ControlledCaseV1,
  caseIndex: number,
): Cap06S5GraphConformantCaseV2 {
  const observation = observationV2(source, caseIndex);
  const observationWindow = observationWindowV2({
    forecast: source.source_forecast,
    observation,
  });
  const posteriorStateRef = posteriorIdV2({
    forecast: source.source_forecast,
    observation,
  });
  const assimilation = assimilationV2({
    forecast: source.source_forecast,
    observation,
    observation_window: observationWindow,
    posterior_state_ref: posteriorStateRef,
  });
  const observationPosterior = posteriorV2({
    object_id: posteriorStateRef,
    forecast: source.source_forecast,
    observation,
    observation_window: observationWindow,
    assimilation_update: assimilation,
  });
  const configPayload = source.source_runtime_config.payload as Record<string, any>;
  const residual = buildCap05ForecastResidualV1({
    scope: scopeV2(source.source_forecast),
    forecast_run_ref: source.source_forecast.object_id,
    forecast_run_hash: source.source_forecast.determinism_hash,
    forecast_issued_at: String(source.source_forecast.payload.issued_at),
    forecast_point_ref: buildCap05ForecastPointMemberRefV1(source.source_forecast.object_id, 1),
    forecast_point: source.forecast_point,
    root_zone_geometry_ref: String(configPayload.reality_binding_ref),
    root_zone_geometry_hash: String(configPayload.reality_binding_hash),
    root_zone_depth_mm: Number(configPayload.soil_hydraulic_snapshot.root_zone_depth_mm).toFixed(6),
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    actual_observation_observed_at: observation.observed_at,
    actual_observation_quality: observation.quality_status,
    actual_observation_value: observation.canonical_value,
    actual_observation_variance: observation.observation_variance,
    representativeness_variance: observation.representativeness_variance,
    runtime_config_ref: source.source_runtime_config.object_id,
    runtime_config_hash: source.source_runtime_config.determinism_hash,
    context_lineage_ref: String(source.source_forecast.lineage_id),
    context_revision_ref: String(source.source_forecast.revision_id),
    observation_available_to_runtime_at: observation.available_to_runtime_at,
    assimilation_update_ref: assimilation.object_id,
    assimilation_update_hash: assimilation.determinism_hash,
    created_at: observation.available_to_runtime_at,
  });
  const result: Cap06S5GraphConformantCaseV2 = {
    case_index: caseIndex,
    source_s1_residual_ref: source.residual.object_id,
    source_s1_residual_hash: source.residual.determinism_hash,
    source_state: structuredClone(source.source_state),
    source_evidence_window: structuredClone(source.source_evidence_window),
    source_forecast: structuredClone(source.source_forecast),
    source_runtime_config: structuredClone(source.source_runtime_config),
    forecast_point: structuredClone(source.forecast_point),
    observation_record: observation,
    observation_evidence_window: observationWindow,
    assimilation_update: assimilation,
    observation_posterior: observationPosterior,
    residual,
    base_replay_storage_mm: source.base_replay_storage_mm,
    hidden_replay_storage_mm: source.hidden_replay_storage_mm,
    model_component_hash: source.model_component_hash,
    effective_parameter_bundle_hash: source.effective_parameter_bundle_hash,
    observation_operator_hash: source.observation_operator_hash,
    geometry_hash: source.geometry_hash,
    runtime_replay_numeric_policy_hash: source.runtime_replay_numeric_policy_hash,
  };
  validateCap06S5GraphConformantCaseV2(result);
  return result;
}

export function validateCap06S5GraphConformantCaseV2(
  item: Cap06S5GraphConformantCaseV2,
): void {
  validateCap05ForecastResidualV1(item.residual);
  validateCanonicalObjectV1(item.observation_evidence_window);
  validateCanonicalObjectV1(item.assimilation_update);
  validateCanonicalObjectV1(item.observation_posterior);
  assert.equal(item.residual.payload.actual_observation_ref, item.observation_record.source_record_id);
  assert.equal(item.residual.payload.actual_observation_hash, item.observation_record.source_record_hash);
  assert.equal(item.residual.payload.assimilation_update_ref, item.assimilation_update.object_id);
  assert.equal(item.residual.payload.assimilation_update_hash, item.assimilation_update.determinism_hash);
  assert.equal(item.assimilation_update.payload.posterior_state_ref, item.observation_posterior.object_id);
  assert.equal(item.observation_posterior.payload.assimilation_update_ref, item.assimilation_update.object_id);
  assert.equal(item.observation_posterior.payload.evidence_window_ref, item.observation_evidence_window.object_id);
  assert.equal(item.observation_evidence_window.as_of, item.observation_record.available_to_runtime_at);
  assert.equal(item.assimilation_update.logical_time, item.observation_record.available_to_runtime_at);
  assert.equal(item.observation_posterior.logical_time, item.observation_record.available_to_runtime_at);
  assert.ok(Date.parse(item.observation_record.observed_at)
    <= Date.parse(item.observation_record.available_to_runtime_at));
  assert.equal(item.assimilation_update.payload.model_parameter_change_applied, false);
  assert.equal(item.observation_posterior.payload.model_parameter_change_applied, false);
}

function uniqueV2(values: readonly string[], code: string): string {
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`${code}:${unique.length}`);
  return unique[0];
}

export async function buildCap06S5GraphConformantDatasetV2(): Promise<Cap06S5GraphConformantDatasetV2> {
  const source = await buildCap06S1ControlledDatasetV1();
  assert.equal(source.cases.length, CAP06_S1_TOTAL_CASE_COUNT_V1);
  const cases = source.cases.map((item, index) => correctedCaseV2(item, index));
  const refs = cases.map((item) => item.residual.object_id);
  const hashes = cases.map((item) => item.residual.determinism_hash);
  assert.equal(new Set(refs).size, CAP06_S1_TOTAL_CASE_COUNT_V1);
  assert.equal(refs.some((ref) => source.ordered_residual_refs.includes(ref)), false);
  const calibrationRefs = refs.slice(0, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  const holdoutRefs = refs.slice(CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  assert.equal(calibrationRefs.length, CAP06_S1_CALIBRATION_CASE_COUNT_V1);
  assert.equal(holdoutRefs.length, CAP06_S1_HOLDOUT_CASE_COUNT_V1);
  return {
    schema_version: "geox_mcft_cap_06_s5_graph_conformant_dataset_v2",
    correction_id: CAP06_S5_GRAPH_CORRECTION_ID_V1,
    profile_id: CAP06_S5_GRAPH_PROFILE_ID_V2,
    qualification_track: CAP06_S1_CONTROLLED_TRACK_V1,
    repository_history_track: CAP06_S1_REPOSITORY_TRACK_V1,
    source_s1_residual_set_hash: source.residual_set_hash,
    source_s1_case_input_set_hash: source.case_input_set_hash,
    base_drainage_coefficient: CAP06_S1_BASE_DRAINAGE_COEFFICIENT_V1,
    hidden_drainage_coefficient: CAP06_S1_HIDDEN_DRAINAGE_COEFFICIENT_V1,
    cases,
    ordered_residual_refs: refs,
    ordered_residual_hashes: hashes,
    residual_set_hash: semanticHashV1(refs.map((ref, index) => ({ ref, hash: hashes[index] }))),
    calibration_window_refs: calibrationRefs,
    calibration_window_hash: semanticHashV1(calibrationRefs),
    holdout_window_refs: holdoutRefs,
    holdout_window_hash: semanticHashV1(holdoutRefs),
    case_input_set_hash: semanticHashV1(cases.map((item) => ({
      residual_ref: item.residual.object_id,
      residual_hash: item.residual.determinism_hash,
      forecast_point_ref: item.residual.payload.forecast_point_ref,
      forecast_point_hash: item.residual.payload.forecast_point_hash,
      observation_ref: item.residual.payload.actual_observation_ref,
      observation_hash: item.residual.payload.actual_observation_hash,
    }))),
    graph_assembly_set_hash: semanticHashV1(cases.map((item) => ({
      residual_ref: item.residual.object_id,
      residual_hash: item.residual.determinism_hash,
      forecast_point_ref: item.residual.payload.forecast_point_ref,
      forecast_point_hash: item.residual.payload.forecast_point_hash,
      observation_ref: item.residual.payload.actual_observation_ref,
      observation_hash: item.residual.payload.actual_observation_hash,
      assimilation_ref: item.assimilation_update.object_id,
      assimilation_hash: item.assimilation_update.determinism_hash,
      observation_posterior_ref: item.observation_posterior.object_id,
      observation_posterior_hash: item.observation_posterior.determinism_hash,
      observation_evidence_window_ref: item.observation_evidence_window.object_id,
      observation_evidence_window_hash: item.observation_evidence_window.determinism_hash,
    }))),
    model_component_hash: uniqueV2(cases.map((item) => item.model_component_hash), "CAP06_S5_GRAPH_MODEL_COMPONENT_HETEROGENEITY"),
    effective_parameter_bundle_hash: uniqueV2(cases.map((item) => item.effective_parameter_bundle_hash), "CAP06_S5_GRAPH_PARAMETER_BUNDLE_HETEROGENEITY"),
    observation_operator_hash: uniqueV2(cases.map((item) => item.observation_operator_hash), "CAP06_S5_GRAPH_OPERATOR_HETEROGENEITY"),
    geometry_hash: uniqueV2(cases.map((item) => item.geometry_hash), "CAP06_S5_GRAPH_GEOMETRY_HETEROGENEITY"),
    runtime_replay_numeric_policy_hash: uniqueV2(cases.map((item) => item.runtime_replay_numeric_policy_hash), "CAP06_S5_GRAPH_NUMERIC_POLICY_HETEROGENEITY"),
  };
}
