// Purpose: define the dedicated MCFT-CAP-08 S4/T17 authority-bound A1 transition persistence port.
// Boundary: interface only; no SQL, persistence implementation, generic CAP-04 CAS change, projection mutation, retry implementation, route, scheduler, qualification carrier, or execution authority.

import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type {
  Cap08S4T17CorrectionAuthorityBindingV1,
  Cap08S4T17CorrectedComputationPredecessorV1,
  Cap08S4T17ExpectedLatestBaseV1,
  Cap08S4T17TransitionWitnessV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import type {
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type Cap08S4T17TransitionFaultStageV1 =
  | "after_replay_classification"
  | "after_base_pointer_validation"
  | "after_authority_validation"
  | "after_corrected_predecessor_validation"
  | "after_t17_facts"
  | "after_record_set_guard"
  | "after_transition_witness_fact"
  | "after_transition_guard"
  | "after_state_latest"
  | "after_checkpoint_latest"
  | "after_forecast_result_latest"
  | "after_successful_forecast_latest"
  | "before_exact_readback"
  | "before_commit";

export type CommitCap08S4T17A1TransitionInputV1 = {
  scope: TwinScopeKeyV1;
  lease: RuntimeLeaseClaimV1;
  formal_run_id: string;
  expected_latest_base: Cap08S4T17ExpectedLatestBaseV1;
  corrected_computation_predecessor: Cap08S4T17CorrectedComputationPredecessorV1;
  correction_authority: Cap08S4T17CorrectionAuthorityBindingV1;
  record_set: Cap04ARecordSetV1;
  transition_witness: Cap08S4T17TransitionWitnessV1;
  fault_injection?: (stage: Cap08S4T17TransitionFaultStageV1) => void;
};

export type CommitCap08S4T17A1TransitionResultV1 =
  | {
      status: "INSERTED_ATOMIC_TRANSITION";
      record_set: Cap04ARecordSetV1;
      transition_witness: Cap08S4T17TransitionWitnessV1;
      write_delta: number;
    }
  | {
      status: "EXISTING_IDEMPOTENT_SUCCESS";
      record_set: Cap04ARecordSetV1;
      transition_witness: Cap08S4T17TransitionWitnessV1;
      write_delta: 0;
    };

export interface Cap08S4T17TransitionPersistencePortV1 {
  commitAuthorityBoundA1Transition(
    input: CommitCap08S4T17A1TransitionInputV1,
  ): Promise<CommitCap08S4T17A1TransitionResultV1>;
}
