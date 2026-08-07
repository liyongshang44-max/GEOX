// MCFT-CAP-09.S6 formal authority construction and validation helpers.
// Boundary: deterministic construction from checked-in MCFT-00/CAP-08 authorities only;
// no fixture Evidence, database writes, wall-clock reads, routes, or action authority.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SoilHydraulicBoundsV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1,
  compileCap04RuntimeConfigChainV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  realityBindingRuntimeSnapshotFromAuthorityArtifactV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { RealityBindingRuntimeSnapshotV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOUR_MS = 3_600_000;

export const CAP08_EFFECTIVE_SUBJECT_SHA_V1 = "67bd71560268046a7fa9a9433ee074ad3999cb71";
export const CAP08_EXACT_SHA_WORKFLOW_RUN_V1 = 30908130962;
export const CAP08_EXACT_SHA_ARTIFACT_V1 = 8891897316;
export const CAP08_SEMANTIC_ARTIFACT_DIGEST_V1 = "sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9";
export const FORMAL_EVIDENCE_TYPES_V1 = [
  "soil_moisture_observation_v1",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
] as const;

type ConfigurationMatrixExtendedV1 = Mcft00ConfigurationMatrixArtifactV1 & {
  configuration_source_definitions: Array<{
    configuration_source_id: string;
    parameters: Record<string, { value: unknown }>;
  }>;
};

function readJsonV1<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

export function canonicalHourV1(value: string, code = "FORMAL_CANONICAL_HOUR_REQUIRED"): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)
    || milliseconds % HOUR_MS !== 0
    || new Date(milliseconds).toISOString() !== value) throw new Error(code);
  return value;
}

export function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(canonicalHourV1(value)) + hours * HOUR_MS).toISOString();
}

export function sameScopeV1(left: TwinScopeKeyV1, right: TwinScopeKeyV1): boolean {
  return (Object.keys(right) as (keyof TwinScopeKeyV1)[]).every((key) => left[key] === right[key]);
}

function hydraulicFromAuthorityV1(matrix: ConfigurationMatrixExtendedV1): SoilHydraulicBoundsV1 {
  const definition = matrix.configuration_source_definitions.find(
    (item) => item.configuration_source_id === "mcft_soil_hydraulic_config_c8_v1",
  );
  if (!definition) throw new Error("FORMAL_SOIL_HYDRAULIC_AUTHORITY_NOT_FOUND");
  const numberValue = (name: string): number => {
    const value = definition.parameters[name]?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`FORMAL_SOIL_HYDRAULIC_PARAMETER_INVALID:${name}`);
    }
    return value;
  };
  return {
    wilting_point_fraction: numberValue("wilting_point_fraction"),
    field_capacity_fraction: numberValue("field_capacity_fraction"),
    saturation_fraction: numberValue("saturation_fraction"),
    root_zone_depth_mm: numberValue("root_zone_depth_mm"),
  };
}

export type FormalAuthorityBundleV1 = {
  scope: TwinScopeKeyV1;
  window_start_utc: string;
  bootstrap_logical_time: string;
  authority_created_at: string;
  reality_binding_snapshot: RealityBindingRuntimeSnapshotV1;
  bootstrap_runtime_config: CanonicalObjectEnvelopeV1;
  runtime_configs: CanonicalObjectEnvelopeV1[];
  hydraulic: SoilHydraulicBoundsV1;
  soil_hydraulic_config_ref: "mcft_soil_hydraulic_config_c8_v1";
  cap08_authority: {
    effective_subject_sha: typeof CAP08_EFFECTIVE_SUBJECT_SHA_V1;
    exact_sha_workflow_run: typeof CAP08_EXACT_SHA_WORKFLOW_RUN_V1;
    exact_sha_artifact: typeof CAP08_EXACT_SHA_ARTIFACT_V1;
    semantic_artifact_digest: typeof CAP08_SEMANTIC_ARTIFACT_DIGEST_V1;
  };
};

function buildAuthorityStructureV1(windowStartUtc: string): FormalAuthorityBundleV1 {
  const start = canonicalHourV1(windowStartUtc, "FORMAL_WINDOW_START_CANONICAL_HOUR_REQUIRED");
  const bootstrapLogicalTime = addHoursV1(start, -1);
  const reality = readJsonV1<Mcft00RealityArtifactV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json",
  );
  const sourceMatrix = readJsonV1<Mcft00SourceMatrixArtifactV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json",
  );
  const configurationMatrix = readJsonV1<ConfigurationMatrixExtendedV1>(
    "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  );
  const scope = structuredClone(reality.semantic_payload.scope) as TwinScopeKeyV1;
  const bootstrapRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
    realityArtifact: reality,
    sourceMatrixArtifact: sourceMatrix,
    configurationMatrixArtifact: configurationMatrix,
    logical_time: bootstrapLogicalTime,
    created_at: bootstrapLogicalTime,
  });
  const bootstrapPayload = bootstrapRuntimeConfig.payload as Record<string, unknown>;
  const runtimeConfigs = compileCap04RuntimeConfigChainV1({
    scope,
    first_effective_logical_time: start,
    created_at: bootstrapLogicalTime,
    predecessor_runtime_config_ref: bootstrapRuntimeConfig.object_id,
    predecessor_runtime_config_hash: bootstrapRuntimeConfig.determinism_hash,
    reality_binding_ref: String(bootstrapPayload.reality_binding_ref),
    reality_binding_hash: String(bootstrapPayload.reality_binding_hash),
    source_matrix_hash: String(bootstrapPayload.source_matrix_hash),
    configuration_matrix_hash: String(bootstrapPayload.configuration_matrix_hash),
    geometry_semantic_hash: String(bootstrapPayload.geometry_semantic_hash),
  });
  if (runtimeConfigs.length !== CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1) {
    throw new Error("FORMAL_EXACT_24_RUNTIME_CONFIG_CHAIN_REQUIRED");
  }
  return {
    scope,
    window_start_utc: start,
    bootstrap_logical_time: bootstrapLogicalTime,
    authority_created_at: bootstrapLogicalTime,
    reality_binding_snapshot: realityBindingRuntimeSnapshotFromAuthorityArtifactV1(reality),
    bootstrap_runtime_config: bootstrapRuntimeConfig,
    runtime_configs: runtimeConfigs,
    hydraulic: hydraulicFromAuthorityV1(configurationMatrix),
    soil_hydraulic_config_ref: "mcft_soil_hydraulic_config_c8_v1",
    cap08_authority: {
      effective_subject_sha: CAP08_EFFECTIVE_SUBJECT_SHA_V1,
      exact_sha_workflow_run: CAP08_EXACT_SHA_WORKFLOW_RUN_V1,
      exact_sha_artifact: CAP08_EXACT_SHA_ARTIFACT_V1,
      semantic_artifact_digest: CAP08_SEMANTIC_ARTIFACT_DIGEST_V1,
    },
  };
}

export function buildFormalAuthorityBundleV1(windowStartUtc: string): FormalAuthorityBundleV1 {
  const bundle = buildAuthorityStructureV1(windowStartUtc);
  const context = readJsonV1<{
    coverage_start: string;
    coverage_end_exclusive: string;
    crop_stage_schedule: Array<{ effective_from: string; effective_to: string }>;
    limitations: string[];
  }>("fixtures/mcft/water_state/replay_v1/configuration_context.json");
  if (context.limitations.some((item) => /synthetic|fixture|replay/i.test(item))) {
    throw new Error("FORMAL_GOVERNED_NON_SYNTHETIC_CROP_STAGE_CONTEXT_REQUIRED");
  }
  const first = Date.parse(bundle.window_start_utc);
  const last = Date.parse(addHoursV1(bundle.window_start_utc, 23));
  const coverageStart = Date.parse(canonicalHourV1(context.coverage_start, "FORMAL_CROP_STAGE_COVERAGE_START_INVALID"));
  const coverageEnd = Date.parse(canonicalHourV1(context.coverage_end_exclusive, "FORMAL_CROP_STAGE_COVERAGE_END_INVALID"));
  if (first < coverageStart || last >= coverageEnd) {
    throw new Error("FORMAL_24_HOUR_WINDOW_OUTSIDE_GOVERNED_CROP_STAGE_CONTEXT");
  }
  for (let index = 0; index < 24; index += 1) {
    const logicalTime = Date.parse(addHoursV1(bundle.window_start_utc, index));
    const matches = context.crop_stage_schedule.filter(
      (stage) => logicalTime >= Date.parse(stage.effective_from) && logicalTime < Date.parse(stage.effective_to),
    );
    if (matches.length !== 1) throw new Error("FORMAL_CROP_STAGE_CONTEXT_EXACT_STAGE_REQUIRED");
  }
  return bundle;
}

// Simulation-only source substitution may reuse the unchanged canonical Runtime
// configuration contract. It confers no Formal authority or field validity.
export function buildSimulationSourceSubstitutionAuthoritySeedV1(
  windowStartUtc: string,
): FormalAuthorityBundleV1 {
  return buildAuthorityStructureV1(windowStartUtc);
}
