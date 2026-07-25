import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateCap08S4LateCorrectionV1,
  type Cap08S4LateCorrectionAppliedV1,
  type Cap08S4LateCorrectionInputV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s4_late_correction_math_v1.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vectors = JSON.parse(fs.readFileSync(path.join(root, "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json"), "utf8"));

for (const vector of vectors.vectors) {
  const result = calculateCap08S4LateCorrectionV1(
    vector.input as Cap08S4LateCorrectionInputV1,
  );
  assert.equal(result.disposition, vector.expected.disposition, vector.vector_id);
  if (result.disposition === "APPLIED") {
    const applied = result as Cap08S4LateCorrectionAppliedV1;
    for (const key of [
      "innovation",
      "gain",
      "historical_delta",
      "transport_sensitivity",
      "decay",
      "current_delta",
      "mean",
      "variance",
    ] as const) {
      assert.ok(
        Math.abs(applied[key] - vector.expected[key]) <= vector.tolerance,
        `${vector.vector_id}:${key}:${applied[key]}:${vector.expected[key]}`,
      );
    }
    assert.equal(applied.step_sensitivities.length, vector.expected.step_sensitivities.length);
    applied.step_sensitivities.forEach((value, index) => {
      assert.ok(
        Math.abs(value - vector.expected.step_sensitivities[index]) <= vector.tolerance,
        `${vector.vector_id}:step_sensitivity:${index}`,
      );
    });
    const rerun = calculateCap08S4LateCorrectionV1(
      vector.input as Cap08S4LateCorrectionInputV1,
    );
    assert.deepEqual(rerun, result, `${vector.vector_id}:deterministic_rerun`);
  }
}

console.log(JSON.stringify({
  status: "PASS",
  vector_count: vectors.vectors.length,
  source: "production_cap08_s4_late_correction_math_v1",
  implementation: "FULL_POSTERIOR_TO_POSTERIOR_SENSITIVITY",
  historical_rewrite: false,
}));
