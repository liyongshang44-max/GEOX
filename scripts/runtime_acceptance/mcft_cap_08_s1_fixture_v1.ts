// scripts/runtime_acceptance/mcft_cap_08_s1_fixture_v1.ts
// Purpose: derive the S1 exact scope, B00 Config, 24-object Runtime Config chain, Reality Binding snapshot, and controlled Replay Evidence from frozen authority artifacts.
// Boundary: acceptance support only; no database, route, scheduler, final formal run, Decision, Action Feedback, Residual, Calibration, or production claim.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { compileCap04RuntimeConfigChainV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import type { Cap04RuntimeConfigPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  RealityBindingRuntimeSnapshotV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CAP08_S1_B00_LOGICAL_TIME_V1 = "2026-05-31T23:00:00.000Z";
export const CAP08_S1_CREATED_AT_V1 = "2026-07-23T00:00:00.000Z";

export type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{
    configuration_source_id: string;
    parameters: Record<string, { value: unknown }>;
  }>;
};

export type Cap08S1FixtureV1 = {
  scope: TwinScopeKeyV1;
  formal_run_id: string;
  bootstrap_runtime_config: CanonicalObjectEnvelopeV1;
  runtime_configs: CanonicalObjectEnvelopeV1[];
  runtime_config_refs_by_logical_time: Record<string, string>;
  runtime_config_hashes_by_logical_time: Record<string, string>;
  hydraulic: SoilHydraulicBoundsV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  reality_binding_snapshot: RealityBindingRuntimeSnapshotV1;
  evidence_source: ReplayEvidenceSourcePortV1;
  evidence_source_load_count: () => number;
};

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find((item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1");
  if (!definition) throw new Error("CAP08_S1_SOIL_HYDRAULIC_DEFINITION_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`CAP08_S1_SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

function evidenceV1(input: {
  scope: TwinScopeKeyV1;
  dataset_id: string;
  record_type: string;
  source_record_id: string;
  binding_id: string;
  origin_source_id: string;
  role_time: Record<string, unknown>;
  canonical_payload: Record<string, unknown>;
  source_unit: string;
  canonical_unit: string;
}): CanonicalReplayEvidenceRecordV1 {
  const semantic = {
    record_type: input.record_type,
    source_record_id: input.source_record_id,
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    role_time: input.role_time,
    canonical_payload: input.canonical_payload,
  };
  const ingestedAt = String(input.role_time.ingested_at);
  return {
    ...input.scope,
    dataset_id: input.dataset_id,
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: input.record_type,
    binding_id: input.binding_id,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: ingestedAt,
    role_time: structuredClone(input.role_time),
    quality: { status: "PASS" },
    source_payload: { ...structuredClone(input.canonical_payload), source_version: "1" },
    canonical_payload: structuredClone(input.canonical_payload),
    source_unit: input.source_unit,
    canonical_unit: input.canonical_unit,
    conversion_rule: { id: "IDENTITY_V1", version: "1" },
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "S1_SLICE_ACCEPTANCE_ONLY"],
  };
}

function b00EvidenceV1(scope: TwinScopeKeyV1): CanonicalReplayEvidenceRecordV1[] {
  const observedAt = addMinutesV1(CAP08_S1_B00_LOGICAL_TIME_V1, -10);
  const ingestedAt = addMinutesV1(CAP08_S1_B00_LOGICAL_TIME_V1, -5);
  return [evidenceV1({
    scope,
    dataset_id: "mcft_cap08_s1_b00_fixture_v1",
    record_type: "soil_moisture_observation_v1",
    source_record_id: "soil_cap08_s1_b00",
    binding_id: "soil_obs_c8_20cm_v1",
    origin_source_id: "soil_sensor_cap08_s1",
    role_time: { observed_at: observedAt, ingested_at: ingestedAt },
    canonical_payload: { value: 0.31, unit: "fraction", quantity_kind: "VOLUMETRIC_WATER_CONTENT" },
    source_unit: "fraction",
    canonical_unit: "fraction",
  })];
}

function tickEvidenceV1(scope: TwinScopeKeyV1, logicalTime: string, index: number): CanonicalReplayEvidenceRecordV1[] {
  const suffix = `T${String(index).padStart(2, "0")}`;
  const ingestedAt = addMinutesV1(logicalTime, -5);
  const issuedAt = addMinutesV1(logicalTime, -45);
  const availableAt = addMinutesV1(logicalTime, -30);
  return [
    evidenceV1({
      scope,
      dataset_id: "mcft_cap08_s1_base_range_fixture_v1",
      record_type: "observed_rainfall_v1",
      source_record_id: `rain_cap08_s1_${suffix}`,
      binding_id: "rainfall_c8_hourly_v1",
      origin_source_id: "weather_replay_cap08_s1",
      role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      canonical_payload: { value: Number((0.2 + (index % 4) * 0.1).toFixed(6)), unit: "mm" },
      source_unit: "mm",
      canonical_unit: "mm",
    }),
    evidenceV1({
      scope,
      dataset_id: "mcft_cap08_s1_base_range_fixture_v1",
      record_type: "historical_et0_estimate_v1",
      source_record_id: `et0_cap08_s1_${suffix}`,
      binding_id: "historical_et0_c8_hourly_v1",
      origin_source_id: "et0_replay_cap08_s1",
      role_time: { interval_start: addHoursV1(logicalTime, -1), interval_end: logicalTime, ingested_at: ingestedAt },
      canonical_payload: {
        value: Number((0.1 + (index % 3) * 0.01).toFixed(6)),
        unit: "mm",
        calculation_method: "FAO56_PM_REPLAY_V1",
        method_version: "1",
      },
      source_unit: "mm",
      canonical_unit: "mm",
    }),
    evidenceV1({
      scope,
      dataset_id: "mcft_cap08_s1_base_range_fixture_v1",
      record_type: "soil_moisture_observation_v1",
      source_record_id: `soil_cap08_s1_${suffix}`,
      binding_id: "soil_obs_c8_20cm_v1",
      origin_source_id: "soil_sensor_cap08_s1",
      role_time: { observed_at: addMinutesV1(logicalTime, -10), ingested_at: ingestedAt },
      canonical_payload: {
        value: Number((0.31 - index * 0.0005).toFixed(6)),
        unit: "fraction",
        quantity_kind: "VOLUMETRIC_WATER_CONTENT",
      },
      source_unit: "fraction",
      canonical_unit: "fraction",
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `weather_cap08_s1_${suffix}`,
      seed: 800 + index,
      scope_override: scope,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `future_et0_cap08_s1_${suffix}`,
      seed: 800 + index,
      scope_override: scope,
    }),
  ];
}

export function buildCap08S1FixtureV1(): Cap08S1FixtureV1 {
  const reality = readJsonV1<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
  const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
  const scope = structuredClone(reality.semantic_payload.scope) as TwinScopeKeyV1;
  const bootstrapRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: CAP08_S1_B00_LOGICAL_TIME_V1,
    created_at: CAP08_S1_CREATED_AT_V1,
  });
  const bootstrapPayload = bootstrapRuntimeConfig.payload as Record<string, unknown>;
  const runtimeConfigs = compileCap04RuntimeConfigChainV1({
    scope,
    first_effective_logical_time: CAP08_S1_RUNTIME_START_V1,
    created_at: CAP08_S1_CREATED_AT_V1,
    predecessor_runtime_config_ref: bootstrapRuntimeConfig.object_id,
    predecessor_runtime_config_hash: bootstrapRuntimeConfig.determinism_hash,
    reality_binding_ref: String(bootstrapPayload.reality_binding_ref),
    reality_binding_hash: String(bootstrapPayload.reality_binding_hash),
    source_matrix_hash: String(bootstrapPayload.source_matrix_hash),
    configuration_matrix_hash: String(bootstrapPayload.configuration_matrix_hash),
    geometry_semantic_hash: String(bootstrapPayload.geometry_semantic_hash),
  });
  const refs: Record<string, string> = {};
  const hashes: Record<string, string> = {};
  for (const config of runtimeConfigs) {
    const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
    refs[payload.effective_logical_time] = config.object_id;
    hashes[payload.effective_logical_time] = config.determinism_hash;
  }
  const firstPayload = runtimeConfigs[0].payload as unknown as Cap04RuntimeConfigPayloadV1;
  const cropStageContext: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "v1",
    dataset_id: "mcft_cap08_s1_crop_stage_v1",
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: "mcft_configuration_matrix_cap08_s1",
    configuration_matrix_hash: firstPayload.configuration_matrix_hash,
    crop_water_use_binding_ref: "crop_water_use_cap08_s1",
    crop_water_use_configuration_source_id: "crop_water_use_source_cap08_s1",
    crop_stage_mapping_source: "CONTROLLED_REPLAY_CONFIGURATION",
    timezone: "UTC",
    coverage_start: addHoursV1(CAP08_S1_RUNTIME_START_V1, -24),
    coverage_end_exclusive: addHoursV1(CAP08_S1_RUNTIME_START_V1, 120),
    crop_stage_schedule: [{
      stage_code: "CONTROLLED_STAGE_V1",
      effective_from: addHoursV1(CAP08_S1_RUNTIME_START_V1, -24),
      effective_to: addHoursV1(CAP08_S1_RUNTIME_START_V1, 120),
      kc: 1,
    }],
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED", "S1_SLICE_ACCEPTANCE_ONLY"],
    determinism_hash: firstPayload.crop_stage_context.context_hash,
  };
  let loadCount = 0;
  const evidenceSource: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      loadCount += 1;
      if (JSON.stringify(input.scope) !== JSON.stringify(scope)) throw new Error("CAP08_S1_FIXTURE_SCOPE_MISMATCH");
      if (input.logical_time === CAP08_S1_B00_LOGICAL_TIME_V1) return structuredClone(b00EvidenceV1(scope));
      const index = (Date.parse(input.logical_time) - Date.parse(CAP08_S1_RUNTIME_START_V1)) / 3_600_000;
      if (!Number.isInteger(index) || index < 0 || index >= 24) throw new Error("CAP08_S1_FIXTURE_TIME_OUT_OF_RANGE");
      return structuredClone(tickEvidenceV1(scope, input.logical_time, index));
    },
  };
  const realityBindingSnapshot: RealityBindingRuntimeSnapshotV1 = {
    binding_id: String(bootstrapPayload.reality_binding_ref),
    determinism_hash: String(bootstrapPayload.reality_binding_hash),
    geometry_semantic_hash: String(bootstrapPayload.geometry_semantic_hash),
    scope,
    root_zone_definition: structuredClone((reality.semantic_payload as Record<string, unknown>).root_zone_binding as Record<string, unknown>),
  };
  const formalRunId = `cap08_s1_${semanticHashV1({
    run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
    scope,
    dataset_id: "mcft_cap08_s1_base_range_fixture_v1",
    bootstrap_runtime_config_hash: bootstrapRuntimeConfig.determinism_hash,
    runtime_config_chain_hashes: runtimeConfigs.map((config) => config.determinism_hash),
  }).replace("sha256:", "")}`;
  return {
    scope,
    formal_run_id: formalRunId,
    bootstrap_runtime_config: bootstrapRuntimeConfig,
    runtime_configs: runtimeConfigs,
    runtime_config_refs_by_logical_time: refs,
    runtime_config_hashes_by_logical_time: hashes,
    hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
    crop_stage_context: cropStageContext,
    reality_binding_snapshot: realityBindingSnapshot,
    evidence_source: evidenceSource,
    evidence_source_load_count: () => loadCount,
  };
}
