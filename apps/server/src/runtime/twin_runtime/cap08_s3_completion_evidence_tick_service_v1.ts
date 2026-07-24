// Purpose: wrap the frozen MCFT-CAP-08.S3 Tick service and persist T09/T10 completion Evidence only after the underlying Tick has proven its exact A-phase semantics.
// Boundary: additive completion-evidence persistence only; no change to phase ordering, State/Forecast/Scenario math, G/H semantics, route, scheduler, or production authority.

import type { CanonicalReplayEvidenceRecordV1 } from "./ports.js";
import {
  Cap08S3FormalTickServiceV1,
  type ExecuteCap08S3FormalTickInputV1,
  type ExecuteCap08S3FormalTickResultV1,
} from "./cap08_s3_formal_tick_service_v1.js";
import {
  Cap08S3OutcomeCompletionEvidenceServiceV1,
  type Cap08S3PersistedOutcomeEvidenceV1,
} from "./cap08_s3_outcome_completion_evidence_service_v1.js";
import type { Cap08S3OutcomeAbsenceWitnessV1 } from "../../domain/twin_runtime/cap08_s3_completion_tuple_v1.js";
import { CAP08_S3_OUTCOME_FVO_ID_V1 } from "../../domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";

export type ExecuteCap08S3CompletionEvidenceTickResultV1 = ExecuteCap08S3FormalTickResultV1 & {
  outcome_absence_witness: Cap08S3OutcomeAbsenceWitnessV1 | null;
  persisted_outcome_fvo10_record: Cap08S3PersistedOutcomeEvidenceV1 | null;
  completion_evidence_persistence_status:
    | "NOT_DUE"
    | "INSERTED"
    | "EXISTING_IDEMPOTENT_SUCCESS";
};

function exactT09AResultV1(result: ExecuteCap08S3FormalTickResultV1): void {
  const window = result.a_provider_result.evidence_window;
  const assimilation = result.a_provider_result.assimilation;
  if (!window || !assimilation) throw new Error("CAP08_S3_T09_COMPLETION_A_RESULT_REQUIRED");
  if (result.outcome_fvo10_record !== null
    || window.observation_selection.selected_observation_ref !== null
    || window.assimilation_applied_evidence_refs.length !== 0
    || assimilation.selected_observation_ref !== null
    || assimilation.applied_observation_refs.length !== 0) {
    throw new Error("CAP08_S3_T09_COMPLETION_ABSENCE_NOT_PROVEN");
  }
}

function exactT10AResultV1(
  result: ExecuteCap08S3FormalTickResultV1,
): CanonicalReplayEvidenceRecordV1 {
  const outcome = result.outcome_fvo10_record;
  const window = result.a_provider_result.evidence_window;
  const assimilation = result.a_provider_result.assimilation;
  if (!outcome || !window || !assimilation) throw new Error("CAP08_S3_T10_COMPLETION_A_RESULT_REQUIRED");
  if (outcome.source_record_id !== CAP08_S3_OUTCOME_FVO_ID_V1
    || window.observation_selection.selected_observation_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
    || JSON.stringify(window.assimilation_applied_evidence_refs) !== JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1])
    || assimilation.selected_observation_ref !== CAP08_S3_OUTCOME_FVO_ID_V1
    || JSON.stringify(assimilation.applied_observation_refs) !== JSON.stringify([CAP08_S3_OUTCOME_FVO_ID_V1])) {
    throw new Error("CAP08_S3_T10_COMPLETION_ASSIMILATION_NOT_PROVEN");
  }
  return outcome;
}

export class Cap08S3CompletionEvidenceTickServiceV1 {
  constructor(
    private readonly inner: Cap08S3FormalTickServiceV1,
    private readonly evidence: Cap08S3OutcomeCompletionEvidenceServiceV1,
  ) {}

  async executeOneTick(
    input: ExecuteCap08S3FormalTickInputV1,
  ): Promise<ExecuteCap08S3CompletionEvidenceTickResultV1> {
    const result = await this.inner.executeOneTick(input);
    if (result.phase_plan.tick_id === "T09") {
      exactT09AResultV1(result);
      const committed = await this.evidence.commitOutcomeAbsenceWitness({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
      });
      return {
        ...result,
        status: committed.status === "INSERTED" ? "INSERTED" : result.status,
        outcome_absence_witness: committed.evidence,
        persisted_outcome_fvo10_record: null,
        completion_evidence_persistence_status: committed.status,
      };
    }
    if (result.phase_plan.tick_id === "T10") {
      const outcome = exactT10AResultV1(result);
      const committed = await this.evidence.commitOutcomeFvo10({
        formal_run_id: input.formal_run_id,
        scope: input.scope,
        record: outcome,
      });
      return {
        ...result,
        status: committed.status === "INSERTED" ? "INSERTED" : result.status,
        outcome_absence_witness: null,
        outcome_fvo10_record: committed.evidence,
        persisted_outcome_fvo10_record: committed.evidence,
        completion_evidence_persistence_status: committed.status,
      };
    }
    return {
      ...result,
      outcome_absence_witness: null,
      persisted_outcome_fvo10_record: null,
      completion_evidence_persistence_status: "NOT_DUE",
    };
  }
}
