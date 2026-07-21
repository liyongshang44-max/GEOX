// Purpose: build a deterministic, governed MCFT-CAP-07 local demo object bundle with production pure contracts.
// Boundary: pure/filesystem fixture reads only; no database, network, Runtime source authority, model activation, or CAP-08 authority.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanonicalReplayFileSourceV1 } from "../../apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.js";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_json_v1.js";
import { validateA0RecordSetV1, validateCanonicalObjectV1, type A0RecordSetV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { buildA0RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.js";
import { buildFrozenEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import { compileRuntimeConfigFromAuthorityArtifactsV1, type Mcft00ConfigurationMatrixArtifactV1, type Mcft00RealityArtifactV1, type Mcft00SourceMatrixArtifactV1 } from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const LOGICAL_TIME = "2026-06-01T01:00:00.000Z";
export const CREATED_AT = "2026-06-01T01:00:00.000Z";
const PRIOR_STATE_TIME = "2026-06-01T00:00:00.000Z";
const SUCCESSFUL_FORECAST_TIME = "2026-06-01T00:05:00.000Z";
const SCENARIO_TIME = "2026-06-01T00:10:00.000Z";
const RESIDUAL_TIME = "2026-06-01T00:40:00.000Z";
const CANDIDATE_TIME = "2026-06-01T02:00:00.000Z";
const EVALUATION_TIME = "2026-06-01T03:00:00.000Z";

export type JsonRecord = Record<string, unknown>;
type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{
    configuration_source_id: string;
    parameters: Record<string, { value: unknown }>;
  }>;
};
export type DemoScope = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};
export type DemoObject = JsonRecord & {
  object_id: string;
  object_type: string;
  determinism_hash: string;
  payload: JsonRecord;
};
export type DemoBundle = {
  scope: DemoScope;
  runtime_config: CanonicalObjectEnvelopeV1;
  root: A0RecordSetV1;
  prior_state: DemoObject;
  successful_forecast: DemoObject;
  scenario: DemoObject;
  residual: DemoObject;
  calibration_candidate: DemoObject;
  shadow_evaluation: DemoObject;
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function hydraulicFromAuthority(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find(
    (item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1",
  );
  if (!definition) throw new Error("SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number") throw new Error(`SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

function exactScope(value: TwinScopeKeyV1): DemoScope {
  const scope = value as Record<string, unknown>;
  const required = ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const;
  const normalized = Object.fromEntries(required.map((key) => [key, String(scope[key] || "").trim()])) as DemoScope;
  for (const key of required) if (!normalized[key]) throw new Error(`LOCAL_DEMO_SCOPE_INVALID:${key}`);
  return normalized;
}

export function member(recordSet: A0RecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const found = recordSet.members.find((candidate) => candidate.object_type === objectType);
  if (!found) throw new Error(`LOCAL_DEMO_MEMBER_MISSING:${objectType}`);
  return found;
}

function canonicalObject(input: {
  object_id: string;
  object_type: string;
  scope: DemoScope;
  logical_time: string;
  lineage_id: string;
  revision_id: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  payload: JsonRecord;
  source_refs?: string[];
  evidence_refs?: string[];
  extra?: JsonRecord;
}): DemoObject {
  const base: JsonRecord = {
    object_id: input.object_id,
    object_type: input.object_type,
    schema_version: `${input.object_type}_local_demo_v1`,
    ...input.scope,
    scope: { ...input.scope },
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: input.source_refs ?? [],
    evidence_refs: input.evidence_refs ?? [],
    runtime_config_ref: input.runtime_config_ref,
    runtime_config_hash: input.runtime_config_hash,
    idempotency_key: `local-demo:${input.object_id}`,
    limitations: ["CONTROLLED_LOCAL_DEMO_ONLY", "NOT_LIVE_FIELD_VALIDATION"],
    created_at: input.logical_time,
    payload: input.payload,
    ...(input.extra ?? {}),
  };
  const determinism_hash = computeMemberDeterminismHashV1(base);
  return { ...(base as DemoObject), determinism_hash };
}

export async function buildDemoBundle(): Promise<DemoBundle> {
  const reality = readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
  const sourceMatrix = readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const configurationMatrix = readJson<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
  const scope = exactScope(reality.semantic_payload.scope as TwinScopeKeyV1);
  const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
  });
  validateCanonicalObjectV1(runtimeConfig);
  const replaySource = new CanonicalReplayFileSourceV1(path.join(ROOT, "fixtures/mcft/water_state/replay_v1"));
  const candidates = await replaySource.loadCandidateRecords({ scope, logical_time: LOGICAL_TIME });
  const evidenceWindow = buildFrozenEvidenceWindowV1({ scope, logical_time: LOGICAL_TIME, candidate_records: candidates });
  const root = buildA0RecordSetV1({
    scope,
    logical_time: LOGICAL_TIME,
    created_at: CREATED_AT,
    runtime_config: runtimeConfig,
    evidence_window: evidenceWindow,
    hydraulic: hydraulicFromAuthority(configurationMatrix),
    soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
  });
  validateA0RecordSetV1(root);

  const lineage = member(root, "twin_runtime_lineage_v1");
  const lineageId = String(lineage.lineage_id || lineage.payload.lineage_id || "lineage-local-demo");
  const revisionId = String(lineage.revision_id || lineage.payload.initial_revision_id || "revision-local-demo");
  const runtimeConfigRef = runtimeConfig.object_id;
  const runtimeConfigHash = runtimeConfig.determinism_hash;

  const priorState = canonicalObject({
    object_id: "local-demo-prior-state-v1",
    object_type: "twin_state_estimate_v1",
    scope,
    logical_time: PRIOR_STATE_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    payload: {
      state_kind: "CONTROLLED_REPLAY_PRIOR",
      posterior: { mean: 0.214, variance: 0.0018 },
      confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
      use_eligibility: { recommendation_input_eligible: false, action_input_eligible: false },
      transition_ref: "local-demo-prior-transition-not-materialized",
      assimilation_update_ref: "local-demo-prior-assimilation-not-materialized",
      evidence_window_ref: "local-demo-prior-evidence-not-materialized",
    },
  });

  const points = Array.from({ length: 72 }, (_, index) => ({
    horizon_hour: index + 1,
    target_time: new Date(Date.parse(SUCCESSFUL_FORECAST_TIME) + (index + 1) * 3_600_000).toISOString(),
    storage_mean_mm: (64.2 - index * 0.15).toFixed(6),
    storage_variance_mm2: (1.2 + index * 0.01).toFixed(6),
    available_water_fraction: Math.max(0.2, 0.71 - index * 0.003).toFixed(6),
  }));
  const successfulForecast = canonicalObject({
    object_id: "local-demo-successful-forecast-v1",
    object_type: "twin_forecast_run_v1",
    scope,
    logical_time: SUCCESSFUL_FORECAST_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    source_refs: [priorState.object_id],
    payload: {
      status: "COMPLETED",
      point_count: 72,
      points,
      reason_codes: [],
      scenario_eligible: true,
      source_posterior_ref: priorState.object_id,
      source_posterior_hash: priorState.determinism_hash,
      forcing_window_hash: semanticHashV1({ source: "local-demo-forcing-window-v1" }),
    },
  });

  const scenario = canonicalObject({
    object_id: "local-demo-scenario-set-v1",
    object_type: "twin_scenario_set_v1",
    scope,
    logical_time: SCENARIO_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    source_refs: [successfulForecast.object_id, priorState.object_id],
    payload: {
      source_forecast_ref: successfulForecast.object_id,
      source_forecast_hash: successfulForecast.determinism_hash,
      source_posterior_ref: priorState.object_id,
      source_posterior_hash: priorState.determinism_hash,
      scenario_policy_id: "mcft-local-demo-three-option-policy-v1",
      option_count: 3,
      options: [
        { option_id: "NO_ACTION", irrigation_amount_mm: "0.000000" },
        { option_id: "IRRIGATE_NOW_15MM", irrigation_amount_mm: "15.000000" },
        { option_id: "IRRIGATE_NOW_25MM", irrigation_amount_mm: "25.000000" },
      ],
    },
  });

  const observationHash = semanticHashV1({ observation_ref: "local-demo-observation-v1", value: "0.209000" });
  const residual = canonicalObject({
    object_id: "local-demo-forecast-residual-v1",
    object_type: "twin_forecast_residual_v1",
    scope,
    logical_time: RESIDUAL_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    source_refs: [successfulForecast.object_id],
    evidence_refs: ["local-demo-observation-v1"],
    payload: {
      forecast_run_ref: successfulForecast.object_id,
      forecast_run_hash: successfulForecast.determinism_hash,
      forecast_point_ref: `${successfulForecast.object_id}:h1`,
      forecast_point_hash: semanticHashV1(points[0]),
      actual_observation_ref: "local-demo-observation-v1",
      actual_observation_hash: observationHash,
      predicted_observation_value: "0.214000",
      predicted_observation_variance: "0.001800",
      actual_observation_value: "0.209000",
      actual_observation_variance: "0.000400",
      representativeness_variance: "0.000100",
      residual_value: "-0.005000",
      normalized_residual: "-0.104257",
      assimilation_update_ref: null,
      assimilation_update_hash: null,
    },
  });

  const calibrationCandidate = canonicalObject({
    object_id: "local-demo-calibration-candidate-v1",
    object_type: "twin_calibration_candidate_v1",
    scope,
    logical_time: CANDIDATE_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    source_refs: [residual.object_id],
    payload: {
      candidate_status: "BOUNDED_PARAMETER_DELTA_CANDIDATE",
      base_config_ref: runtimeConfigRef,
      base_config_hash: runtimeConfigHash,
      parameter_key: "dynamics_parameters.drainage_coefficient_per_hour",
      base_parameter_value: "0.030000",
      candidate_parameter_value: "0.034000",
      parameter_delta: "0.004000",
      activation_status: "NOT_ACTIVE",
      eligible_for_state_input: false,
      eligible_for_runtime_config_use: false,
      eligible_for_human_activation_review: false,
    },
    extra: { context_lineage_ref: lineage.object_id, context_revision_ref: revisionId },
  });

  const shadowEvaluation = canonicalObject({
    object_id: "local-demo-shadow-evaluation-v1",
    object_type: "twin_shadow_evaluation_v1",
    scope,
    logical_time: EVALUATION_TIME,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config_ref: runtimeConfigRef,
    runtime_config_hash: runtimeConfigHash,
    source_refs: [calibrationCandidate.object_id, residual.object_id],
    payload: {
      candidate_ref: calibrationCandidate.object_id,
      candidate_hash: calibrationCandidate.determinism_hash,
      evaluation_dataset_hash: semanticHashV1({ residual_refs: [residual.object_id] }),
      evaluation_policy_hash: semanticHashV1({ policy: "local-demo-shadow-policy-v1" }),
      shadow_replay_engine_id: "mcft-cap06-paired-shadow-v1",
      calibration_metric_numeric_policy_hash: semanticHashV1({ scale: 18, rounding: "HALF_EVEN" }),
      evaluation_disposition: "INCONCLUSIVE",
      eligible_for_human_activation_review: false,
      case_results: [],
    },
  });

  return {
    scope,
    runtime_config: runtimeConfig,
    root,
    prior_state: priorState,
    successful_forecast: successfulForecast,
    scenario,
    residual,
    calibration_candidate: calibrationCandidate,
    shadow_evaluation: shadowEvaluation,
  };
}

export function factId(objectId: string): string {
  return `local_demo_mcft_cap07_${objectId}`;
}
