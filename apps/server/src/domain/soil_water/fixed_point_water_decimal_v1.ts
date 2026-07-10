// apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.ts
// Purpose: provide deterministic decimal-string and BigInt fixed-point arithmetic for MCFT-CAP-02 water amounts, fractions, and variances.
// Boundary: pure arithmetic only; no Number-based computational authority, I/O, clock, environment, persistence, or mutable global state.

export const WATER_AMOUNT_SCALE_V1 = 6 as const;
export const WATER_VARIANCE_SCALE_V1 = 12 as const;
export const WATER_DECIMAL_ROUNDING_RULE_V1 = "DECIMAL_HALF_AWAY_FROM_ZERO_V1" as const;

const DECIMAL_PATTERN_V1 = /^([+-]?)(\d+)(?:\.(\d+))?$/;

function pow10V1(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 30) throw new Error("FIXED_DECIMAL_SCALE_INVALID");
  return 10n ** BigInt(scale);
}

function requireScaleV1(scale: number): void {
  pow10V1(scale);
}

export function divideBigIntHalfAwayFromZeroV1(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("FIXED_DECIMAL_DIVIDE_BY_ZERO");
  if (numerator === 0n) return 0n;
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function parseFixedDecimalV1(value: unknown, scale: number, code = "FIXED_DECIMAL_REQUIRED"): bigint {
  requireScaleV1(scale);
  if (typeof value !== "string") throw new Error(code);
  const match = DECIMAL_PATTERN_V1.exec(value);
  if (!match) throw new Error(code);
  const negative = match[1] === "-";
  const integerPart = match[2];
  const fractionPart = match[3] ?? "";
  const retainedFraction = fractionPart.slice(0, scale).padEnd(scale, "0");
  let absoluteUnits = BigInt(integerPart) * pow10V1(scale) + BigInt(retainedFraction || "0");
  if (fractionPart.length > scale) {
    const discarded = fractionPart.slice(scale);
    if (discarded[0] >= "5") absoluteUnits += 1n;
  }
  return negative ? -absoluteUnits : absoluteUnits;
}

export function formatFixedDecimalV1(units: bigint, scale: number): string {
  requireScaleV1(scale);
  const negative = units < 0n;
  const absoluteUnits = negative ? -units : units;
  const divisor = pow10V1(scale);
  const integerPart = absoluteUnits / divisor;
  const fractionPart = (absoluteUnits % divisor).toString().padStart(scale, "0");
  const prefix = negative && absoluteUnits !== 0n ? "-" : "";
  return scale === 0 ? `${prefix}${integerPart}` : `${prefix}${integerPart}.${fractionPart}`;
}

export function normalizeFixedDecimalV1(value: unknown, scale: number, code?: string): string {
  return formatFixedDecimalV1(parseFixedDecimalV1(value, scale, code), scale);
}

export function rescaleFixedUnitsV1(units: bigint, fromScale: number, toScale: number): bigint {
  requireScaleV1(fromScale);
  requireScaleV1(toScale);
  if (fromScale === toScale) return units;
  if (fromScale < toScale) return units * pow10V1(toScale - fromScale);
  return divideBigIntHalfAwayFromZeroV1(units, pow10V1(fromScale - toScale));
}

export function multiplyFixedUnitsV1(
  leftUnits: bigint,
  leftScale: number,
  rightUnits: bigint,
  rightScale: number,
  outputScale: number,
): bigint {
  return rescaleFixedUnitsV1(leftUnits * rightUnits, leftScale + rightScale, outputScale);
}

export function divideFixedUnitsV1(
  numeratorUnits: bigint,
  numeratorScale: number,
  denominatorUnits: bigint,
  denominatorScale: number,
  outputScale: number,
): bigint {
  requireScaleV1(numeratorScale);
  requireScaleV1(denominatorScale);
  requireScaleV1(outputScale);
  if (denominatorUnits === 0n) throw new Error("FIXED_DECIMAL_DIVIDE_BY_ZERO");
  const scaleExponent = denominatorScale + outputScale - numeratorScale;
  if (scaleExponent >= 0) {
    return divideBigIntHalfAwayFromZeroV1(numeratorUnits * pow10V1(scaleExponent), denominatorUnits);
  }
  return divideBigIntHalfAwayFromZeroV1(numeratorUnits, denominatorUnits * pow10V1(-scaleExponent));
}

export function squareScale6ToScale12V1(unitsScale6: bigint): bigint {
  return unitsScale6 * unitsScale6;
}

export function multiplyScale6V1(left: unknown, right: unknown): string {
  const leftUnits = parseFixedDecimalV1(left, WATER_AMOUNT_SCALE_V1);
  const rightUnits = parseFixedDecimalV1(right, WATER_AMOUNT_SCALE_V1);
  return formatFixedDecimalV1(
    multiplyFixedUnitsV1(leftUnits, WATER_AMOUNT_SCALE_V1, rightUnits, WATER_AMOUNT_SCALE_V1, WATER_AMOUNT_SCALE_V1),
    WATER_AMOUNT_SCALE_V1,
  );
}

export function clampFixedUnitsV1(value: bigint, lower: bigint, upper: bigint): bigint {
  if (lower > upper) throw new Error("FIXED_DECIMAL_CLAMP_BOUNDS_INVALID");
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}

export function requireNonNegativeFixedUnitsV1(value: bigint, code: string): bigint {
  if (value < 0n) throw new Error(code);
  return value;
}

function integerSquareRootFloorV1(value: bigint): bigint {
  if (value < 0n) throw new Error("FIXED_DECIMAL_SQRT_NEGATIVE");
  if (value < 2n) return value;
  let low = 1n;
  let high = value;
  while (low <= high) {
    const middle = (low + high) >> 1n;
    const square = middle * middle;
    if (square === value) return middle;
    if (square < value) low = middle + 1n;
    else high = middle - 1n;
  }
  return high;
}

export function sqrtScale12ToScale6V1(unitsScale12: bigint): bigint {
  requireNonNegativeFixedUnitsV1(unitsScale12, "FIXED_DECIMAL_SQRT_NEGATIVE");
  const floor = integerSquareRootFloorV1(unitsScale12);
  const lowerDistance = unitsScale12 - floor * floor;
  const upper = floor + 1n;
  const upperDistance = upper * upper - unitsScale12;
  return upperDistance <= lowerDistance ? upper : floor;
}

export function compareIsoInstantV1(left: string, right: string): number {
  if (new Date(left).toISOString() !== left || new Date(right).toISOString() !== right) {
    throw new Error("CANONICAL_ISO_INSTANT_REQUIRED");
  }
  return left < right ? -1 : left > right ? 1 : 0;
}
