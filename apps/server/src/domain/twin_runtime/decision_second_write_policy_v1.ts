// apps/server/src/domain/twin_runtime/decision_second_write_policy_v1.ts
// Purpose: freeze the MCFT-CAP-05 immutable Human Decision second-write policy before persistence is introduced.
// Boundary: pure compatibility check only; no database, supersession write, approval, dispatch, State mutation, clock, filesystem, or network.

import { CAP05_DECISION_SECOND_WRITE_POLICY_V1, type Cap05DecisionEnvelopeV1, validateCap05DecisionV1 } from "./feedback_canonical_contracts_v1.js";

export type Cap05DecisionSecondWriteDispositionV1 = "INSERT" | "EXISTING_IDENTICAL";

export function adjudicateCap05DecisionSecondWriteV1(
  existing: Cap05DecisionEnvelopeV1 | null,
  candidate: Cap05DecisionEnvelopeV1,
): Cap05DecisionSecondWriteDispositionV1 {
  validateCap05DecisionV1(candidate);
  if (candidate.payload.second_write_policy_id !== CAP05_DECISION_SECOND_WRITE_POLICY_V1) {
    throw new Error("CAP05_DECISION_SECOND_WRITE_POLICY_MISMATCH");
  }
  if (existing === null) return "INSERT";
  validateCap05DecisionV1(existing);
  if (existing.payload.scenario_set_ref !== candidate.payload.scenario_set_ref) {
    throw new Error("CAP05_DECISION_EXISTING_SCENARIO_IDENTITY_MISMATCH");
  }
  if (existing.object_id === candidate.object_id && existing.determinism_hash === candidate.determinism_hash) {
    return "EXISTING_IDENTICAL";
  }
  throw new Error("CAP05_DECISION_IMMUTABLE_CONFLICT");
}
