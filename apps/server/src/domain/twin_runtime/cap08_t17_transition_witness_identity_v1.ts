// Purpose: derive the unique MCFT-CAP-08 S4/T17 transition identity and minimal audit witness deterministically.
// Boundary: pure identity construction only; no persistence, SQL, projection mutation, retry loop, route, scheduler, or execution authority.

import {
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "./canonical_identity_v1.js";
import {
  CAP08_S4_T17_FORMAL_OUTCOME_V1,
  CAP08_S4_T17_TRANSITION_CONTRACT_ID_V1,
  CAP08_S4_T17_TRANSITION_KIND_V1,
  CAP08_S4_T17_WITNESS_SCHEMA_VERSION_V1,
  normalizeCap08S4T17WitnessInputV1,
  type Cap08S4T17TransitionWitnessInputV1,
  type Cap08S4T17TransitionWitnessV1,
} from "./cap08_t17_transition_contracts_v1.js";

export function deriveCap08S4T17TransitionWitnessV1(
  raw: Cap08S4T17TransitionWitnessInputV1,
): Cap08S4T17TransitionWitnessV1 {
  const input = normalizeCap08S4T17WitnessInputV1(raw);
  const uniquenessKeyHash = semanticHashV1(input.uniqueness_key);
  const transitionId = deriveSemanticObjectIdV1("cap08_s4_t17_transition", {
    contract_id: CAP08_S4_T17_TRANSITION_CONTRACT_ID_V1,
    uniqueness_key_hash: uniquenessKeyHash,
  });
  const idempotencyKey = deriveSemanticObjectIdV1("cap08_s4_t17_transition_key", {
    transition_kind: CAP08_S4_T17_TRANSITION_KIND_V1,
    uniqueness_key_hash: uniquenessKeyHash,
  });
  const basis = {
    schema_version: CAP08_S4_T17_WITNESS_SCHEMA_VERSION_V1,
    contract_id: CAP08_S4_T17_TRANSITION_CONTRACT_ID_V1,
    transition_id: transitionId,
    idempotency_key: idempotencyKey,
    uniqueness_key_hash: uniquenessKeyHash,
    uniqueness_key: input.uniqueness_key,
    correction_authority: input.correction_authority,
    expected_latest_base: input.expected_latest_base,
    corrected_computation_predecessor: input.corrected_computation_predecessor,
    committed_t17: input.committed_t17,
    transition_semantics: {
      latest_before: "BASE_T16" as const,
      computation_from: "CORRECTED_T16" as const,
      persistence_cas_from: "BASE_T16" as const,
      latest_after: "T17" as const,
      outcome: CAP08_S4_T17_FORMAL_OUTCOME_V1,
    },
  };
  return {
    ...basis,
    determinism_hash: semanticHashV1(basis),
  };
}

export function cap08S4T17TransitionWitnessFactIdV1(
  witness: Pick<Cap08S4T17TransitionWitnessV1, "transition_id">,
): string {
  return `fact_${witness.transition_id}`;
}
