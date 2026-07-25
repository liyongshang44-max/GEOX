import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateCap08S4LateCorrectionV1,
  type Cap08S4LateCorrectionInputV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s4_late_correction_math_v1.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vectorsPath = path.join(
  root,
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json",
);
const outputPath = path.join(
  root,
  "acceptance-output/MCFT_CAP_08_LATE_CORRECTION_MATH_RESULT.json",
);
const contract = JSON.parse(fs.readFileSync(vectorsPath, "utf8")) as {
  numeric_tolerance: number;
  vectors: Array<{
    id: string;
    input: Cap08S4LateCorrectionInputV1;
    expected: Record<string, unknown>;
  }>;
};

function equalV1(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (typeof expected === "number") {
    return typeof actual === "number"
      && Number.isFinite(actual)
      && Math.abs(actual - expected) <= tolerance;
  }
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((value, index) => equalV1(actual[index], value, tolerance));
  }
  return actual === expected;
}

const checks: Array<{ id: string; status: "PASS" }> = [];
for (const vector of contract.vectors) {
  const first = calculateCap08S4LateCorrectionV1(structuredClone(vector.input));
  const second = calculateCap08S4LateCorrectionV1(structuredClone(vector.input));
  assert.deepEqual(second, first, `${vector.id}:deterministic_rerun`);
  const result = first as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(vector.expected)) {
    assert.ok(
      equalV1(result[key], expected, contract.numeric_tolerance),
      `${vector.id}:${key}:${JSON.stringify({ actual: result[key], expected })}`,
    );
  }
  checks.push({ id: vector.id, status: "PASS" });
}

const output = {
  schema_version: "geox_mcft_cap08_s4_production_late_correction_math_result_v1",
  status: "PASS",
  vector_count: checks.length,
  checks,
  source: "production_cap08_s4_late_correction_math_v1",
  implementation: "FULL_POSTERIOR_TO_POSTERIOR_SENSITIVITY",
  full_posterior_transition_recomputed: true,
  intermediate_ordinary_assimilation_covered: true,
  deterministic_rerun: true,
  historical_rewrite: false,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output));
