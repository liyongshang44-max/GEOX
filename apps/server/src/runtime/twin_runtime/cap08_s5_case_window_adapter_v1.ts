// Purpose: adapt the CAP-08 formal 24-Tick case profile to the mature CAP-06 case-window contract while preserving exact non-positive excess physical inputs.
// Boundary: pure deterministic validation only; no prediction, persistence, Candidate/Shadow append, Runtime mutation, route or scheduler.

import { parseFixedDecimalV1 } from "../../domain/soil_water/fixed_point_water_decimal_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { Cap06SourceDatasetIdentityV1 } from "../../domain/calibration/contracts_v1.js";
import {
  buildCap06CaseWindowV1,
  type Cap06BuiltCaseWindowV1,
  type Cap06CaseBuilderSourceV1,
  type Cap06CaseWindowRoleV1,
} from "../../domain/calibration/case_builder_v1.js";

export const CAP08_S5_NON_POSITIVE_EXCESS_COMPATIBILITY_POLICY_V1 =
  "NON_POSITIVE_EXCESS_PRESERVED_AND_CLASSIFIED_LOW_EXCESS_FOR_SHARED_ENGINE_V1" as const;

function excessUnits(value: string): bigint {
  return parseFixedDecimalV1(value, 6, "CAP08_S5_EXCESS_ABOVE_FIELD_CAPACITY_REQUIRED");
}

export function buildCap08S5CaseWindowV1(input: {
  role: Cap06CaseWindowRoleV1;
  orderedResidualRefs: readonly string[];
  loadedCases: readonly Cap06CaseBuilderSourceV1[];
  sourceDatasetIdentity: Cap06SourceDatasetIdentityV1;
}): Cap06BuiltCaseWindowV1 {
  const exactByRef = new Map<string, Cap06CaseBuilderSourceV1>();
  const compatibilityCases = input.loadedCases.map((source) => {
    const exact = structuredClone(source);
    const units = excessUnits(exact.excess_above_field_capacity_mm);
    exactByRef.set(exact.residual_ref, exact);
    return units <= 0n
      ? { ...structuredClone(exact), excess_above_field_capacity_mm: "0.000001" }
      : structuredClone(exact);
  });

  const shared = buildCap06CaseWindowV1({
    role: input.role,
    orderedResidualRefs: input.orderedResidualRefs,
    loadedCases: compatibilityCases,
    sourceDatasetIdentity: input.sourceDatasetIdentity,
  });
  const cases = shared.cases.map((caseItem) => {
    const exact = exactByRef.get(caseItem.residual_ref);
    if (!exact) throw new Error(`CAP08_S5_EXACT_CASE_REQUIRED:${caseItem.residual_ref}`);
    const nonPositive = excessUnits(exact.excess_above_field_capacity_mm) <= 0n;
    return {
      ...caseItem,
      excess_above_field_capacity_mm: exact.excess_above_field_capacity_mm,
      wetness_regime: nonPositive ? "LOW_EXCESS" as const : caseItem.wetness_regime,
    };
  });
  const { determinism_hash: _sharedHash, ...sharedSemantic } = shared;
  const semantic = {
    ...sharedSemantic,
    cases,
  };
  return {
    ...semantic,
    determinism_hash: semanticHashV1(semantic),
  };
}
