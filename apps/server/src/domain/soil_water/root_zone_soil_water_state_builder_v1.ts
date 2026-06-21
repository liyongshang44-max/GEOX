// apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts
// Purpose: deterministically aggregate H31 layer-level soil water potential estimates into a root-zone Estimate payload.
// Boundary: pure domain builder only; no database access, fact writes, projection writes, routes, environment reads, wall-clock reads, or random values.

import { createHash } from "node:crypto";
import type {
  SoilWaterPotentialClassV1,
  SoilWaterPotentialEstimatePayloadV1,
} from "./soil_water_potential_builder_v1.js";

export const ROOT_ZONE_SOIL_WATER_STATE_MODEL_VERSION_V1 = "root_zone_soil_water_state_v1";

export type RootZoneSoilWaterPotentialClassV1 = SoilWaterPotentialClassV1 | "MIXED";

export type RootZoneSoilWaterStateInputStatusV1 =
  | "ESTIMATED"
  | "PARTIAL_ESTIMATE"
  | "INSUFFICIENT_LAYER_ESTIMATES"
  | "INVALID_INPUT"
  | "UNKNOWN";

export type RootZoneSoilWaterStatePayloadV1 = {
  state_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  root_zone_depth_cm: number;
  layer_estimate_refs: string[];
  layer_count: number;
  estimated_layer_count: number;
  blocked_layer_count: number;
  weighted_matric_potential_kpa: number | null;
  root_zone_available_water_fraction: number | null;
  root_zone_water_potential_class: RootZoneSoilWaterPotentialClassV1;
  worst_layer_class: SoilWaterPotentialClassV1;
  stress_layer_count: number;
  limited_layer_count: number;
  input_status: RootZoneSoilWaterStateInputStatusV1;
  blocking_reasons: string[];
  calculation_inputs: Record<string, unknown>;
  derivation: Record<string, unknown>;
  confidence: {
    level: "LOW" | "MEDIUM" | "HIGH";
    score: number;
    basis: string;
  };
  computed_at: string;
  determinism_hash: string;
};

export type RootZoneSoilWaterStateBuildInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  root_zone_depth_cm: number;
  layerEstimates: SoilWaterPotentialEstimatePayloadV1[];
  computed_at: string;
};

type LayerTupleV1 = {
  estimate_id: string;
  layer_depth_cm: number;
  determinism_hash: string;
};

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function stableSha256(value: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function classifyRootPotential(value: number | null): SoilWaterPotentialClassV1 {
  if (value == null || !Number.isFinite(value)) return "UNKNOWN";
  if (value >= -10) return "SATURATED_OR_NEAR_SATURATED";
  if (value >= -60) return "READILY_AVAILABLE";
  if (value >= -200) return "LIMITED_AVAILABLE";
  return "STRESS";
}

function worstClass(classes: SoilWaterPotentialClassV1[]): SoilWaterPotentialClassV1 {
  if (classes.includes("STRESS")) return "STRESS";
  if (classes.includes("LIMITED_AVAILABLE")) return "LIMITED_AVAILABLE";
  if (classes.includes("READILY_AVAILABLE")) return "READILY_AVAILABLE";
  if (classes.includes("SATURATED_OR_NEAR_SATURATED")) return "SATURATED_OR_NEAR_SATURATED";
  return "UNKNOWN";
}

function sortedLayers(
  layers: SoilWaterPotentialEstimatePayloadV1[],
): SoilWaterPotentialEstimatePayloadV1[] {
  return [...layers].sort(
    (a, b) => a.layer_depth_cm - b.layer_depth_cm || a.estimate_id.localeCompare(b.estimate_id),
  );
}

function sameScope(
  input: RootZoneSoilWaterStateBuildInputV1,
  layer: SoilWaterPotentialEstimatePayloadV1,
): boolean {
  return (
    layer.tenant_id === input.tenant_id &&
    layer.project_id === input.project_id &&
    layer.group_id === input.group_id &&
    layer.field_id === input.field_id &&
    layer.zone_id === input.zone_id
  );
}

function duplicateValues(values: Array<string | number>): Set<string | number> {
  const seen = new Set<string | number>();
  const duplicates = new Set<string | number>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return duplicates;
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].sort();
}

function layerTuples(layers: SoilWaterPotentialEstimatePayloadV1[]): LayerTupleV1[] {
  return layers.map((layer) => ({
    estimate_id: layer.estimate_id,
    layer_depth_cm: layer.layer_depth_cm,
    determinism_hash: layer.determinism_hash,
  }));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildRootZoneSoilWaterStateV1(
  input: RootZoneSoilWaterStateBuildInputV1,
): RootZoneSoilWaterStatePayloadV1 {
  const sorted = sortedLayers(input.layerEstimates ?? []);
  const depthRelevantLayers = sorted.filter(
    (layer) => isFiniteNumber(layer.layer_depth_cm) && layer.layer_depth_cm <= input.root_zone_depth_cm,
  );
  const scopeMismatchCount = depthRelevantLayers.filter((layer) => !sameScope(input, layer)).length;
  const relevant = depthRelevantLayers.filter((layer) => sameScope(input, layer));
  const scopeMismatchTuples = layerTuples(depthRelevantLayers.filter((layer) => !sameScope(input, layer)));
  const duplicateEstimateIds = duplicateValues(relevant.map((layer) => layer.estimate_id));
  const duplicateDepths = duplicateValues(relevant.map((layer) => layer.layer_depth_cm));
  const sortedLayerTuples = layerTuples(relevant);
  const hashBase = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    root_zone_depth_cm: input.root_zone_depth_cm,
    sorted_layer_tuples: sortedLayerTuples,
    excluded_scope_mismatch_tuples: scopeMismatchTuples,
    model_version: ROOT_ZONE_SOIL_WATER_STATE_MODEL_VERSION_V1,
  };
  const determinismHash = stableSha256(hashBase);
  const base = {
    state_id: `rzsws_${determinismHash.slice(0, 32)}`,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    root_zone_depth_cm: input.root_zone_depth_cm,
    layer_estimate_refs: relevant.map((layer) => layer.estimate_id),
    layer_count: depthRelevantLayers.length,
    computed_at: input.computed_at,
    determinism_hash: determinismHash,
  };

  if (!isFiniteNumber(input.root_zone_depth_cm) || input.root_zone_depth_cm <= 0) {
    return {
      ...base,
      estimated_layer_count: 0,
      blocked_layer_count: relevant.length + scopeMismatchCount,
      weighted_matric_potential_kpa: null,
      root_zone_available_water_fraction: null,
      root_zone_water_potential_class: "UNKNOWN",
      worst_layer_class: "UNKNOWN",
      stress_layer_count: 0,
      limited_layer_count: 0,
      input_status: "INVALID_INPUT",
      blocking_reasons: ["invalid_root_zone_depth_cm"],
      calculation_inputs: hashBase,
      derivation: { model_version: ROOT_ZONE_SOIL_WATER_STATE_MODEL_VERSION_V1 },
      confidence: { level: "LOW", score: 0, basis: "invalid_input" },
    };
  }

  const blockingReasons: string[] = [];
  if (scopeMismatchCount > 0) blockingReasons.push("scope_mismatch_layer_excluded");
  if (duplicateEstimateIds.size > 0) blockingReasons.push("duplicate_estimate_id");
  if (duplicateDepths.size > 0) blockingReasons.push("duplicate_layer_depth_cm");

  const valid = relevant.filter((layer) => {
    if (duplicateEstimateIds.has(layer.estimate_id)) return false;
    if (duplicateDepths.has(layer.layer_depth_cm)) return false;
    if (layer.input_status !== "ESTIMATED") return false;
    if (!isFiniteNumber(layer.matric_potential_kpa)) return false;
    if (!isFiniteNumber(layer.available_water_fraction)) return false;
    return isFiniteNumber(layer.root_zone_weight) && layer.root_zone_weight > 0;
  });
  const blockedLayerCount = depthRelevantLayers.length - valid.length;

  if (valid.length === 0) {
    return {
      ...base,
      estimated_layer_count: 0,
      blocked_layer_count: blockedLayerCount,
      weighted_matric_potential_kpa: null,
      root_zone_available_water_fraction: null,
      root_zone_water_potential_class: "UNKNOWN",
      worst_layer_class: "UNKNOWN",
      stress_layer_count: 0,
      limited_layer_count: 0,
      input_status: "INSUFFICIENT_LAYER_ESTIMATES",
      blocking_reasons: uniqueReasons([...blockingReasons, "no_valid_layer_estimates"]),
      calculation_inputs: hashBase,
      derivation: {
        model_version: ROOT_ZONE_SOIL_WATER_STATE_MODEL_VERSION_V1,
        valid_layer_count: 0,
        scope_mismatch_count: scopeMismatchCount,
      },
      confidence: { level: "LOW", score: 0.1, basis: "insufficient_layer_estimates" },
    };
  }

  const weightSum = valid.reduce((sum, layer) => sum + layer.root_zone_weight, 0);
  const weightedPotential = round6(
    valid.reduce((sum, layer) => sum + (layer.matric_potential_kpa as number) * layer.root_zone_weight, 0) /
      weightSum,
  );
  const weightedAwf = round6(
    valid.reduce((sum, layer) => sum + (layer.available_water_fraction as number) * layer.root_zone_weight, 0) /
      weightSum,
  );
  const layerClasses = valid.map((layer) => layer.matric_potential_class);
  const stressLayerCount = layerClasses.filter((value) => value === "STRESS").length;
  const limitedLayerCount = layerClasses.filter((value) => value === "LIMITED_AVAILABLE").length;
  const mixed =
    stressLayerCount > 0 &&
    layerClasses.some(
      (value) => value === "READILY_AVAILABLE" || value === "SATURATED_OR_NEAR_SATURATED",
    );
  const inputStatus = blockedLayerCount > 0 ? "PARTIAL_ESTIMATE" : "ESTIMATED";

  return {
    ...base,
    estimated_layer_count: valid.length,
    blocked_layer_count: blockedLayerCount,
    weighted_matric_potential_kpa: weightedPotential,
    root_zone_available_water_fraction: weightedAwf,
    root_zone_water_potential_class: mixed ? "MIXED" : classifyRootPotential(weightedPotential),
    worst_layer_class: worstClass(layerClasses),
    stress_layer_count: stressLayerCount,
    limited_layer_count: limitedLayerCount,
    input_status: inputStatus,
    blocking_reasons: uniqueReasons(blockingReasons),
    calculation_inputs: hashBase,
    derivation: {
      model_version: ROOT_ZONE_SOIL_WATER_STATE_MODEL_VERSION_V1,
      weight_sum: round6(weightSum),
      sorted_layer_tuples: sortedLayerTuples,
      excluded_scope_mismatch_tuples: scopeMismatchTuples,
      valid_layer_estimate_refs: valid.map((layer) => layer.estimate_id),
      scope_mismatch_count: scopeMismatchCount,
    },
    confidence: {
      level: inputStatus === "ESTIMATED" ? "HIGH" : "MEDIUM",
      score: inputStatus === "ESTIMATED" ? 0.9 : 0.55,
      basis: inputStatus === "ESTIMATED" ? "all_relevant_layers_valid" : "partial_layer_estimates",
    },
  };
}
