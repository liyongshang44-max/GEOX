// apps/server/src/runtime/twin_runtime/future_forcing_outcome_classifier_v1.ts
// Purpose: classify CAP-04 Future Forcing selection into SELECTED, legally unavailable BLOCKED, or malformed/conflicting FAILED outcomes before any A1/A2 persistence decision.
// Boundary: deterministic application classification over caller-supplied Replay Evidence only; no persistence, Forecast math, Scenario math, route, scheduler, filesystem, network, environment, or wall clock.

import type {
  Cap04ForecastForcingWindowV1,
  Cap04FutureForcingSelectionTraceV1,
} from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import {
  selectCap04FutureForcingWindowV1,
  type Cap04FutureForcingSelectorInputV1,
} from "./future_forcing_selector_v1.js";

export type Cap04FutureForcingOutcomeV1 =
  | {
      status: "SELECTED";
      window: Cap04ForecastForcingWindowV1;
      trace: Cap04FutureForcingSelectionTraceV1;
    }
  | {
      status: "BLOCKED";
      reason_codes: ["NO_COMPLETE_MATCHING_FORCING_CYCLE"];
      trace: Cap04FutureForcingSelectionTraceV1;
    }
  | {
      status: "FAILED";
      reason_codes: string[];
      trace: Cap04FutureForcingSelectionTraceV1 | null;
    };

const MALFORMED_EXCLUSION_REASONS_V1 = new Set([
  "FORCING_AVAILABILITY_MISMATCH",
  "FORCING_POINTS_NOT_EXACT_72_HOURLY",
]);

function errorCodeV1(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "UNKNOWN_FUTURE_FORCING_FAILURE";
}

function malformedReasonsV1(trace: Cap04FutureForcingSelectionTraceV1): string[] {
  return Object.entries(trace.excluded_reason_counts)
    .filter(([reason, count]) => MALFORMED_EXCLUSION_REASONS_V1.has(reason) && count > 0)
    .map(([reason]) => `MALFORMED_FORCING_RECORD:${reason}`)
    .sort((left, right) => left.localeCompare(right));
}

export function selectCap04FutureForcingOutcomeV1(
  input: Cap04FutureForcingSelectorInputV1,
): Cap04FutureForcingOutcomeV1 {
  try {
    const result = selectCap04FutureForcingWindowV1(input);
    if (result.status === "SELECTED") return result;
    const malformed = malformedReasonsV1(result.trace);
    if (malformed.length > 0) {
      return {
        status: "FAILED",
        reason_codes: malformed,
        trace: result.trace,
      };
    }
    return result;
  } catch (error) {
    return {
      status: "FAILED",
      reason_codes: [errorCodeV1(error)],
      trace: null,
    };
  }
}
