// Purpose: expose the exact frozen MCFT-CAP-07 S4 source-validation obligations from the committed S0 authority matrix.
// Boundary: pure read-only contract materialization from a versioned repository JSON asset; no database, route, network, filesystem-at-runtime, or write authority.

import sourceMatrixJson from "../../../../../docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json" with { type: "json" };
import type { FieldTwinSourceValidationObligationRowV1 } from "./contracts_v1.js";
import { validateSourceValidationObligationMatrixV1 } from "./source_validation_registry_v1.js";

export const MCFT_CAP_07_S4_SOURCE_NAMES_V1 = Object.freeze([
  "public.twin_state_history_projection_v1",
  "public.twin_forecast_run_projection_v1",
  "public.twin_scenario_set_projection_v1",
  "public.twin_forecast_residual_projection_v1",
  "public.twin_action_feedback_projection_v1",
  "public.twin_calibration_candidate_projection_v1",
  "public.twin_shadow_evaluation_projection_v1",
  "public.facts#record_json.type=twin_model_activation_v1",
] as const);

const sourceMatrix = validateSourceValidationObligationMatrixV1(sourceMatrixJson);

export const MCFT_CAP_07_S4_SOURCE_OBLIGATIONS_V1: readonly FieldTwinSourceValidationObligationRowV1[] = Object.freeze(
  MCFT_CAP_07_S4_SOURCE_NAMES_V1.map((sourceName) => {
    const matches = sourceMatrix.rows.filter((row) => row.source_name === sourceName);
    if (matches.length !== 1) throw new Error(`MCFT_CAP_07_S4_SOURCE_OBLIGATION_CARDINALITY_INVALID:${sourceName}:${matches.length}`);
    return matches[0];
  }),
);

export function resolveMcftCap07S4SourceObligationV1(sourceName: string): FieldTwinSourceValidationObligationRowV1 {
  const matches = MCFT_CAP_07_S4_SOURCE_OBLIGATIONS_V1.filter((row) => row.source_name === sourceName);
  if (matches.length !== 1) throw new Error(`MCFT_CAP_07_S4_SOURCE_OBLIGATION_RESOLUTION_INVALID:${sourceName}:${matches.length}`);
  return matches[0];
}
