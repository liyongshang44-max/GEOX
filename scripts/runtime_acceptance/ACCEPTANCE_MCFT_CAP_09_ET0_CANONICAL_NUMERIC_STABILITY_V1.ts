import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1,
  normalizeMcftCap09Et0CanonicalNumberV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";

function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function normalized72(delta: number) {
  return Array.from({ length: 72 }, (_, index) => {
    const base = Number((0.05 + index * 0.001).toFixed(9));
    return {
      horizon: index + 1,
      et0_mm_per_hour: normalizeMcftCap09Et0CanonicalNumberV1(base + delta),
    };
  });
}

const rule = MCFT_CAP09_ET0_CANONICAL_NUMERIC_SERIALIZATION_V1;
requireCondition(rule.decimal_places === 9, "MCFT_CAP09_ET0_NUMERIC_STABILITY_DECIMAL_PLACES_REQUIRED");
requireCondition(rule.measurement_precision_claim === false, "MCFT_CAP09_ET0_NUMERIC_STABILITY_NOT_MEASUREMENT_PRECISION_REQUIRED");

const positiveTail = normalized72(2e-13);
const negativeTail = normalized72(-2e-13);
requireCondition(
  semanticHashV1(positiveTail) === semanticHashV1(negativeTail),
  "MCFT_CAP09_ET0_NUMERIC_STABILITY_SUB_DECIMAL_TAIL_HASH_MUST_MATCH",
);

const left = normalizeMcftCap09Et0CanonicalNumberV1(0.1234567894);
const right = normalizeMcftCap09Et0CanonicalNumberV1(0.1234567906);
requireCondition(left !== right, "MCFT_CAP09_ET0_NUMERIC_STABILITY_MEANINGFUL_DELTA_MUST_SURVIVE");
requireCondition(
  semanticHashV1({ et0_mm_per_hour: left }) !== semanticHashV1({ et0_mm_per_hour: right }),
  "MCFT_CAP09_ET0_NUMERIC_STABILITY_MEANINGFUL_DELTA_HASH_MUST_DIFFER",
);

const normalizedNegativeZero = normalizeMcftCap09Et0CanonicalNumberV1(-1e-13);
requireCondition(normalizedNegativeZero === 0 && !Object.is(normalizedNegativeZero, -0), "MCFT_CAP09_ET0_NUMERIC_STABILITY_NEGATIVE_ZERO_FORBIDDEN");

console.log(JSON.stringify({
  status: "PASS",
  rule_id: rule.rule_id,
  decimal_places: rule.decimal_places,
  measurement_precision_claim: rule.measurement_precision_claim,
  seventy_two_point_tail_hash_stable: true,
  meaningful_delta_preserved: true,
  negative_zero_normalized: true,
}));
