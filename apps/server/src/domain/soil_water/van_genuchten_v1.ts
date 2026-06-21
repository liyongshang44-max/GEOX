// apps/server/src/domain/soil_water/van_genuchten_v1.ts
// Purpose: deterministic van Genuchten soil water-retention conversion from volumetric water content to matric potential.
// Boundary: pure model only; no time, database, fact writes, routes, or downstream action generation.

export type VanGenuchtenInputV1 = {
  theta: number;
  theta_r: number;
  theta_s: number;
  alpha_per_kpa: number;
  n: number;
  m?: number;
};

export type VanGenuchtenResultV1 = {
  ok: boolean;
  matric_potential_kpa: number | null;
  effective_saturation: number | null;
  available_water_fraction: number | null;
  input_status: "ESTIMATED" | "INVALID_INPUT";
  blocking_reasons: string[];
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function invalid(blocking_reasons: string[]): VanGenuchtenResultV1 {
  return {
    ok: false,
    matric_potential_kpa: null,
    effective_saturation: null,
    available_water_fraction: null,
    input_status: "INVALID_INPUT",
    blocking_reasons,
  };
}

export function estimateVanGenuchtenMatricPotentialV1(input: VanGenuchtenInputV1): VanGenuchtenResultV1 {
  const reasons: string[] = [];
  if (!finite(input.theta)) reasons.push("THETA_NOT_FINITE");
  if (!finite(input.theta_r)) reasons.push("THETA_R_NOT_FINITE");
  if (!finite(input.theta_s)) reasons.push("THETA_S_NOT_FINITE");
  if (finite(input.theta_r) && finite(input.theta_s) && input.theta_r >= input.theta_s) reasons.push("THETA_R_NOT_LESS_THAN_THETA_S");
  if (!finite(input.alpha_per_kpa) || input.alpha_per_kpa <= 0) reasons.push("ALPHA_PER_KPA_NOT_POSITIVE");
  if (!finite(input.n) || input.n <= 1) reasons.push("N_NOT_GREATER_THAN_ONE");

  const m = input.m == null ? (finite(input.n) ? 1 - 1 / input.n : NaN) : input.m;
  if (!finite(m) || m <= 0) reasons.push("M_NOT_POSITIVE");
  if (reasons.length) return invalid(reasons);

  if (input.theta <= input.theta_r) return invalid(["THETA_AT_OR_BELOW_RESIDUAL"]);
  if (input.theta >= input.theta_s) return invalid(["THETA_AT_OR_ABOVE_SATURATED"]);

  const effectiveSaturation = (input.theta - input.theta_r) / (input.theta_s - input.theta_r);
  if (!Number.isFinite(effectiveSaturation) || effectiveSaturation <= 0 || effectiveSaturation >= 1) {
    return invalid(["EFFECTIVE_SATURATION_OUT_OF_OPEN_INTERVAL"]);
  }

  const suctionKpa = (Math.pow(Math.pow(effectiveSaturation, -1 / m) - 1, 1 / input.n)) / input.alpha_per_kpa;
  if (!Number.isFinite(suctionKpa) || suctionKpa <= 0) return invalid(["MATRIC_POTENTIAL_NOT_FINITE"]);

  return {
    ok: true,
    matric_potential_kpa: round6(-suctionKpa),
    effective_saturation: round6(effectiveSaturation),
    available_water_fraction: round6(effectiveSaturation),
    input_status: "ESTIMATED",
    blocking_reasons: [],
  };
}
