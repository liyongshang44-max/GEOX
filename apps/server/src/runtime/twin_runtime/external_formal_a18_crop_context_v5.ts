// Formal-v5-only successor adapter for DT02/A18 late-season stage authority.
//
// Historical Formal-v4 materialization semantics stay frozen. Formal-v5 may consume
// either of the two already-governed late biological-stage authority classes:
// R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE or R6_OR_LATER_MODEL_ESTIMATE.
// Both resolve to the same governed crop-water-use stage LATE. The adapter performs
// an explicit fail-closed admissibility check, then delegates to the frozen V4
// materializer using a validation-only normalized late-stage view. The materialized
// context, identity hash, materialization profile and runtime-config context pin
// therefore remain byte-semantic compatible with the already-qualified A18 V4
// LATE context; historical V4 callers still reject R6.

import {
  materializeExternalFormalA18CropContextV4,
  type MaterializeExternalFormalA18CropContextInputV4,
  type MaterializedExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";

export const MCFT_CAP09_FORMAL_V5_ADMISSIBLE_LATE_BIOLOGICAL_STAGES_V1 = [
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "R6_OR_LATER_MODEL_ESTIMATE",
] as const;

type FormalV5LateBiologicalStageV1 =
  (typeof MCFT_CAP09_FORMAL_V5_ADMISSIBLE_LATE_BIOLOGICAL_STAGES_V1)[number];

type JsonRecordV1 = Record<string, unknown>;

function recordV1(value: unknown, code: string): JsonRecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecordV1;
}

function admissibleLateBiologicalStageV1(
  value: unknown,
): value is FormalV5LateBiologicalStageV1 {
  return typeof value === "string"
    && (MCFT_CAP09_FORMAL_V5_ADMISSIBLE_LATE_BIOLOGICAL_STAGES_V1 as readonly string[])
      .includes(value);
}

export function materializeExternalFormalA18CropContextV5(
  input: MaterializeExternalFormalA18CropContextInputV4,
): MaterializedExternalFormalA18CropContextV4 {
  const current = recordV1(
    input.current_crop_authority,
    "EXTERNAL_FORMAL_A18_V5_CURRENT_CROP_AUTHORITY_REQUIRED",
  );
  const biological = recordV1(
    current.biological_stage,
    "EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_REQUIRED",
  );

  if (
    biological.epistemic_class !== "THERMAL_MODEL_DERIVED"
    || biological.observed_biological_stage_claimed !== false
    || !admissibleLateBiologicalStageV1(
      biological.resolved_biological_stage,
    )
  ) {
    throw new Error(
      "EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_AUTHORITY_MISMATCH",
    );
  }
  if (current.crop_water_use_stage !== "LATE") {
    throw new Error("EXTERNAL_FORMAL_A18_V5_EXACT_LATE_STAGE_REQUIRED");
  }

  // Validation-only normalization. R5 and R6 are distinct biological authority
  // states but the governed A18 water-use materialization collapses both to LATE.
  // V4 output identity/materialization never embeds the biological-stage label.
  const normalizedCurrent = structuredClone(current);
  const normalizedBiological = recordV1(
    normalizedCurrent.biological_stage,
    "EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_CLONE_REQUIRED",
  );
  normalizedBiological.resolved_biological_stage =
    "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE";

  return materializeExternalFormalA18CropContextV4({
    ...input,
    current_crop_authority: normalizedCurrent,
  });
}
