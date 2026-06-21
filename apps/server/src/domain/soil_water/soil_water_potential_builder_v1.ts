// apps/server/src/domain/soil_water/soil_water_potential_builder_v1.ts
// Purpose: build deterministic soil water potential estimate payloads from explicit sensing-window and hydraulic-profile inputs.
// Boundary: use-case assembly only; no database reads, fact writes, projections, routes, environment reads, time reads, or random values.

import { createHash } from "node:crypto";
import { estimateVanGenuchtenMatricPotentialV1 } from "./van_genuchten_v1.js";

export const SOIL_WATER_POTENTIAL_MODEL_VERSION_V1 = "van_genuchten_soil_water_potential_v1";

export type SoilWaterPotentialClassV1 =
  | "SATURATED_OR_NEAR_SATURATED"
  | "READILY_AVAILABLE"
  | "LIMITED_AVAILABLE"
  | "STRESS"
  | "UNKNOWN";

export type SoilWaterPotentialInputStatusV1 =
  | "ESTIMATED"
  | "INSUFFICIENT_PROFILE"
  | "INVALID_INPUT"
  | "BLOCKED_BY_DATA_QUALITY"
  | "UNKNOWN";

export type SoilWaterPotentialThetaUnitV1 = "m3_m3" | "percent";

export type SoilWaterPotentialSensingWindowInputV1 = {
  window_id?: string | null;
  metric?: string | null;
  quality_status?: string | null;
  summary?: Record<string, unknown> | null;
  source_fact_id?: string | null;
  evidence_refs?: string[] | null;
};

export type SoilWaterPotentialHydraulicProfileInputV1 = {
  profile_id?: string | null;
  theta_r: number;
  theta_s: number;
  alpha_per_kpa: number;
  n: number;
  m?: number | null;
  confidence_level?: "LOW" | "MEDIUM" | "HIGH" | null;
  confidence_score?: number | null;
  calibration_status?: string | null;
  source_fact_id?: string | null;
  evidence_refs?: string[] | null;
};

export type SoilWaterPotentialEstimatePayloadV1 = {
  estimate_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  layer_depth_cm: number;
  source_window_id: string | null;
  source_profile_id: string | null;
  observed_theta: number | null;
  theta_unit: SoilWaterPotentialThetaUnitV1;
  normalized_theta_m3_m3: number | null;
  matric_potential_kpa: number | null;
  matric_potential_class: SoilWaterPotentialClassV1;
  available_water_fraction: number | null;
  root_zone_weight: number;
  input_status: SoilWaterPotentialInputStatusV1;
  blocking_reasons: string[];
  hydraulic_profile_ref: string | null;
  data_quality_ref: string | null;
  evidence_refs: string[];
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

export type SoilWaterPotentialEstimateBuildInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id: string;
  layer_depth_cm: number;
  sensingWindow: SoilWaterPotentialSensingWindowInputV1 | null;
  hydraulicProfile: SoilWaterPotentialHydraulicProfileInputV1 | null;
  computed_at: string;
};

type MetricNormalizationV1 = {
  ok: boolean;
  theta_unit: SoilWaterPotentialThetaUnitV1;
  observed_theta: number | null;
  normalized_theta_m3_m3: number | null;
  blocking_reasons: string[];
};

const WATER_POTENTIAL_THRESHOLDS_V1 = {
  UNKNOWN: "matric_potential_kpa is null",
  SATURATED_OR_NEAR_SATURATED: "matric_potential_kpa >= -10",
  READILY_AVAILABLE: "-60 <= matric_potential_kpa < -10",
  LIMITED_AVAILABLE: "-200 <= matric_potential_kpa < -60",
  STRESS: "matric_potential_kpa < -200",
} as const;

const PERCENT_METRICS = new Set([
  "percent",
  "pct",
  "%",
  "volumetric_water_content_percent",
]);

const M3_M3_METRICS = new Set([
  "vwc",
  "theta",
  "volumetric_water_content",
  "soil_moisture_m3_m3",
  "m3_m3",
]);

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

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

function normalizeMetric(metric: unknown, rawValue: unknown): MetricNormalizationV1 {
  const normalizedMetric = String(metric ?? "").trim().toLowerCase();
  const observedTheta = numberOrNull(rawValue);

  if (!PERCENT_METRICS.has(normalizedMetric) && !M3_M3_METRICS.has(normalizedMetric)) {
    return {
      ok: false,
      theta_unit: "m3_m3",
      observed_theta: observedTheta,
      normalized_theta_m3_m3: null,
      blocking_reasons: ["unsupported_metric"],
    };
  }

  if (observedTheta == null) {
    return {
      ok: false,
      theta_unit: PERCENT_METRICS.has(normalizedMetric) ? "percent" : "m3_m3",
      observed_theta: null,
      normalized_theta_m3_m3: null,
      blocking_reasons: ["theta_not_finite"],
    };
  }

  if (PERCENT_METRICS.has(normalizedMetric)) {
    return {
      ok: true,
      theta_unit: "percent",
      observed_theta: observedTheta,
      normalized_theta_m3_m3: round6(observedTheta / 100),
      blocking_reasons: [],
    };
  }

  return {
    ok: true,
    theta_unit: "m3_m3",
    observed_theta: observedTheta,
    normalized_theta_m3_m3: round6(observedTheta),
    blocking_reasons: [],
  };
}

export function classifySoilWaterPotentialV1(
  matricPotentialKpa: number | null,
): SoilWaterPotentialClassV1 {
  if (matricPotentialKpa == null || !Number.isFinite(matricPotentialKpa)) return "UNKNOWN";
  if (matricPotentialKpa >= -10) return "SATURATED_OR_NEAR_SATURATED";
  if (matricPotentialKpa >= -60) return "READILY_AVAILABLE";
  if (matricPotentialKpa >= -200) return "LIMITED_AVAILABLE";
  return "STRESS";
}

function evidenceRefs(input: SoilWaterPotentialEstimateBuildInputV1): string[] {
  return [
    textOrNull(input.sensingWindow?.window_id),
    textOrNull(input.sensingWindow?.source_fact_id),
    ...(input.sensingWindow?.evidence_refs ?? []),
    textOrNull(input.hydraulicProfile?.profile_id),
    textOrNull(input.hydraulicProfile?.source_fact_id),
    ...(input.hydraulicProfile?.evidence_refs ?? []),
  ].filter((value): value is string => Boolean(value));
}

function derivedM(profile: SoilWaterPotentialHydraulicProfileInputV1 | null): number | null {
  if (!profile) return null;
  if (profile.m != null) return profile.m;
  return Number.isFinite(profile.n) ? 1 - 1 / profile.n : null;
}

function determinismHashInput(
  input: SoilWaterPotentialEstimateBuildInputV1,
  normalizedThetaM3M3: number | null,
): Record<string, unknown> {
  return {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    layer_depth_cm: input.layer_depth_cm,
    source_window_id: textOrNull(input.sensingWindow?.window_id),
    source_profile_id: textOrNull(input.hydraulicProfile?.profile_id),
    normalized_theta_m3_m3: normalizedThetaM3M3,
    theta_r: input.hydraulicProfile?.theta_r ?? null,
    theta_s: input.hydraulicProfile?.theta_s ?? null,
    alpha_per_kpa: input.hydraulicProfile?.alpha_per_kpa ?? null,
    n: input.hydraulicProfile?.n ?? null,
    m: derivedM(input.hydraulicProfile),
    model_version: SOIL_WATER_POTENTIAL_MODEL_VERSION_V1,
  };
}

function basePayload(args: {
  input: SoilWaterPotentialEstimateBuildInputV1;
  normalization: MetricNormalizationV1;
  input_status: SoilWaterPotentialInputStatusV1;
  blocking_reasons: string[];
  determinism_hash: string;
}): SoilWaterPotentialEstimatePayloadV1 {
  const { input, normalization, input_status, blocking_reasons, determinism_hash } = args;

  return {
    estimate_id: `swp_${determinism_hash.slice(0, 24)}`,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    layer_depth_cm: input.layer_depth_cm,
    source_window_id: textOrNull(input.sensingWindow?.window_id),
    source_profile_id: textOrNull(input.hydraulicProfile?.profile_id),
    observed_theta: normalization.observed_theta,
    theta_unit: normalization.theta_unit,
    normalized_theta_m3_m3: normalization.normalized_theta_m3_m3,
    matric_potential_kpa: null,
    matric_potential_class: "UNKNOWN",
    available_water_fraction: null,
    root_zone_weight: 1,
    input_status,
    blocking_reasons,
    hydraulic_profile_ref: textOrNull(input.hydraulicProfile?.profile_id),
    data_quality_ref: textOrNull(input.sensingWindow?.quality_status),
    evidence_refs: evidenceRefs(input),
    calculation_inputs: {
      source_metric: textOrNull(input.sensingWindow?.metric),
      source_value: normalization.observed_theta,
      theta_unit: normalization.theta_unit,
      normalized_theta_m3_m3: normalization.normalized_theta_m3_m3,
    },
    derivation: {
      model_version: SOIL_WATER_POTENTIAL_MODEL_VERSION_V1,
      deterministic: true,
      thresholds: WATER_POTENTIAL_THRESHOLDS_V1,
    },
    confidence: {
      level: "LOW",
      score: 0.1,
      basis: blocking_reasons.join(",") || "soil_water_potential_not_estimated_v1",
    },
    computed_at: input.computed_at,
    determinism_hash,
  };
}

export function buildSoilWaterPotentialEstimateV1(
  input: SoilWaterPotentialEstimateBuildInputV1,
): SoilWaterPotentialEstimatePayloadV1 {
  const rawMetric = input.sensingWindow?.metric;
  const rawValue = input.sensingWindow?.summary?.last_value;
  const normalization = normalizeMetric(rawMetric, rawValue);
  const determinismHash = stableSha256(
    determinismHashInput(input, normalization.normalized_theta_m3_m3),
  );

  if (!input.hydraulicProfile) {
    return basePayload({
      input,
      normalization,
      input_status: "INSUFFICIENT_PROFILE",
      blocking_reasons: ["hydraulic_profile_missing"],
      determinism_hash: determinismHash,
    });
  }

  if (!input.sensingWindow) {
    return basePayload({
      input,
      normalization,
      input_status: "INVALID_INPUT",
      blocking_reasons: ["sensing_window_missing"],
      determinism_hash: determinismHash,
    });
  }

  if (input.sensingWindow.quality_status !== "PASS") {
    return basePayload({
      input,
      normalization,
      input_status: "BLOCKED_BY_DATA_QUALITY",
      blocking_reasons: ["sensing_window_quality_not_pass"],
      determinism_hash: determinismHash,
    });
  }

  if (!normalization.ok || normalization.normalized_theta_m3_m3 == null) {
    return basePayload({
      input,
      normalization,
      input_status: "INVALID_INPUT",
      blocking_reasons: normalization.blocking_reasons,
      determinism_hash: determinismHash,
    });
  }

  const m = derivedM(input.hydraulicProfile);
  const modelResult = estimateVanGenuchtenMatricPotentialV1({
    theta: normalization.normalized_theta_m3_m3,
    theta_r: input.hydraulicProfile.theta_r,
    theta_s: input.hydraulicProfile.theta_s,
    alpha_per_kpa: input.hydraulicProfile.alpha_per_kpa,
    n: input.hydraulicProfile.n,
    m: m ?? undefined,
  });

  if (!modelResult.ok) {
    return basePayload({
      input,
      normalization,
      input_status: "INVALID_INPUT",
      blocking_reasons: modelResult.blocking_reasons,
      determinism_hash: determinismHash,
    });
  }

  return {
    ...basePayload({
      input,
      normalization,
      input_status: "ESTIMATED",
      blocking_reasons: [],
      determinism_hash: determinismHash,
    }),
    matric_potential_kpa: modelResult.matric_potential_kpa,
    matric_potential_class: classifySoilWaterPotentialV1(modelResult.matric_potential_kpa),
    available_water_fraction: modelResult.available_water_fraction,
    calculation_inputs: {
      source_metric: textOrNull(input.sensingWindow.metric),
      source_value: normalization.observed_theta,
      theta_unit: normalization.theta_unit,
      normalized_theta_m3_m3: normalization.normalized_theta_m3_m3,
      theta_r: input.hydraulicProfile.theta_r,
      theta_s: input.hydraulicProfile.theta_s,
      alpha_per_kpa: input.hydraulicProfile.alpha_per_kpa,
      n: input.hydraulicProfile.n,
      m,
    },
    derivation: {
      model_version: SOIL_WATER_POTENTIAL_MODEL_VERSION_V1,
      deterministic: true,
      effective_saturation: modelResult.effective_saturation,
      thresholds: WATER_POTENTIAL_THRESHOLDS_V1,
    },
    confidence: {
      level: input.hydraulicProfile.confidence_level ?? "LOW",
      score: numberOrNull(input.hydraulicProfile.confidence_score) ?? 0.1,
      basis: `hydraulic_profile_${String(
        input.hydraulicProfile.calibration_status ?? "unknown",
      ).toLowerCase()}_and_passed_sensing_window`,
    },
  };
}
