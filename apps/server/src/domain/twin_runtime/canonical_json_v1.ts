// apps/server/src/domain/twin_runtime/canonical_json_v1.ts
// Purpose: provide production canonical JSON, explicit decimal half-away-from-zero rounding, and SHA-256 semantic hashing.
// Boundary: pure domain utility; no filesystem, database, network, environment, wall clock, random values, or global mutable state.

import { createHash } from "node:crypto";

export function roundDecimalHalfAwayFromZeroV1(value: number, decimals: number): number {
  if (!Number.isFinite(value)) throw new Error("NON_FINITE_NUMBER");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) throw new Error("INVALID_DECIMAL_SCALE");
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.floor(scaled + 0.5 + Number.EPSILON * scaled);
  const result = (value < 0 ? -1 : 1) * rounded / factor;
  return Object.is(result, -0) ? 0 : result;
}

export function canonicalJsonV1(value: unknown): string {
  if (value === undefined) throw new Error("UNDEFINED_FORBIDDEN");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("NON_FINITE_NUMBER");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1(record[key])}`).join(",")}}`;
  }
  throw new Error(`UNSUPPORTED_CANONICAL_TYPE:${typeof value}`);
}

export function semanticHashV1(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJsonV1(value), "utf8").digest("hex")}`;
}

export function omitSemanticFieldsV1<T extends Record<string, unknown>>(value: T, excluded: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) if (!excluded.includes(key)) result[key] = item;
  return result;
}
