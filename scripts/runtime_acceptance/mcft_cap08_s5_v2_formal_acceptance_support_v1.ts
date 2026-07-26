// Purpose: establish exact replay-dataset v2 S1-S4 predecessor and derive the frozen 24-item MCFT-CAP-08.S5 Forecast/FVO obligation ledger.
// Boundary: fresh-PostgreSQL formal-candidate acceptance support only; no Candidate Declaration, final S6 run, production Runtime source, Model Activation, active Config switch or MCFT-CAP-09 authority.

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1,
  validateCap08S5ResidualObligationsV1,
  type Cap08S5PredecessorEvidenceV1,
  type Cap08S5ResidualObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import type { Cap08S5V2PrequalificationEvidenceV1 } from "../../apps/server/src/domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.js";
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import { CAP08_S1_CREATED_AT_V1, runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import {
  establishCap08S5ReplayDatasetV2PredecessorV1,
} from "./mcft_cap08_s5_replay_dataset_v2_prequalification_support_v1.js";

export const CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1: Cap08S5PredecessorEvidenceV1 = Object.freeze({
  effective_status: "S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE",
  effective_next_slice: "S5",
  status_context: "mcft-cap-08/s4-exact-sha-attestation",
  retention_class: "R1_180_DAYS",
  merge_subject_sha: "bda9d37519ca536d3d83d68cb3a2d4b395ff2ee9",
  candidate_head_sha: "a8c8abccbe2ab25dad5f0fa4a9653269f6c4acc4",
  candidate_tree_sha: "4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a",
  merge_tree_sha: "4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a",
  candidate_to_merge_tree_delta: 0,
  exact_sha_workflow_run_id: "30154846799",
  artifact_id: "8618701918",
  artifact_digest: "sha256:07bfabbe6ac0a108768cb6c8b83000cf28a133483bc6c59a07757ca5ba55625c",
  semantic_artifact_digest: "sha256:c3ba7d058898ed073dbc907a1a0d957903c312c955be45300cb6f62e49ea7338",
  artifact_readback_verified: true,
});

export const CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1: Cap08S5V2PrequalificationEvidenceV1 = Object.freeze({
  effective_status: "REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVE",
  status_context: "mcft-cap-08/s5-replay-dataset-v2-prequalification",
  subject_sha: "b94d299851744f589d3c3a6e35111a22c17c79d0",
  workflow_run_id: "30193754069",
  artifact_id: "8629453895",
  artifact_digest: "sha256:14441ad429a875ef5ab713cb3972a37d77f04dcdc9d14c5d810926eeb4e2fed8",
  semantic_artifact_digest: "sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55",
  database_semantic_digest: "sha256:fd19dd2638b8844adfb18f9f78bcc19bf4bcbf010485300667136aad05a53636",
  retention_level: "R1",
  readback_verified: true,
  locked_version_delete_denied: true,
  residual_count: 24,
  calibration_case_count: 16,
  holdout_case_count: 8,
  objective_case_count: 15,
  diagnostic_only_case_count: 1,
  selected_parameter_value: "0.034000",
  selected_parameter_delta: "0.004000",
  sensitive_case_count: 7,
  sensitive_wetness_regimes: ["HIGH_EXCESS", "MID_EXCESS"],
  candidate_append_count: 0,
  shadow_append_count: 0,
  s5_formal_candidate_authorized: true,
  s6_implementation_authorized: false,
});

function exactMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S5_V2_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return structuredClone(matches[0]);
}

function commitPhaseV1(order: number): string {
  if (order === 1 || order === 16) return "T16";
  if (order === 24) return "G00";
  return `T${String(order).padStart(2, "0")}`;
}

export async function establishCap08S5V2FormalPredecessorV1(root: string) {
  const predecessor = await establishCap08S5ReplayDatasetV2PredecessorV1(root);
  const s4 = await new Cap08S4AppendForwardServiceV1(
    runner,
    predecessor.evidence_source,
  ).execute({
    formal_run_id: predecessor.fixture.formal_run_id,
    scope: predecessor.fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    phase_engine_source_digest: predecessor.source_digest,
  });
  if (s4.status !== "COMPLETED"
    || s4.write_delta !== 7
    || s4.slice_acceptance_only !== true
    || s4.final_formal_run_id !== null
    || s4.corrected_set.forecast.object_id !== s4.t17_predecessor.previous_forecast_result_ref) {
    throw new Error("CAP08_S5_V2_S4_PREDECESSOR_NOT_EXACT");
  }
  const tickResults = predecessor.predecessor_result.range.tick_results;
  if (tickResults.length !== 24) throw new Error(`CAP08_S5_V2_TICK_COUNT:${tickResults.length}`);
  const obligations: Cap08S5ResidualObligationV1[] = [];
  for (let order = 1; order <= 24; order += 1) {
    const observationSourceForecast = exactMemberV1(
      tickResults[order - 1].a_record_set,
      "twin_forecast_run_v1",
    );
    const residualForecast = order === 17 ? s4.corrected_set.forecast : observationSourceForecast;
    const fvoId = `FVO-${String(order).padStart(2, "0")}`;
    const observation = await predecessor.evidence_source.buildFvoFromForecastV1({
      scope: predecessor.fixture.scope,
      fvoId,
      forecast: observationSourceForecast,
    });
    const ordinary = (CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(order)
      ? exactMemberV1(tickResults[order].a_record_set, "twin_assimilation_update_v1")
      : null;
    obligations.push({
      residual_id: `R-${String(order).padStart(2, "0")}`,
      residual_order: order,
      commit_phase: commitPhaseV1(order),
      forecast_ref: residualForecast.object_id,
      forecast_hash: residualForecast.determinism_hash,
      observation: {
        fvo_id: fvoId,
        source_record_id: observation.source_record_id,
        source_record_hash: observation.source_record_hash,
        observed_at: observation.role_time.observed_at,
        available_to_runtime_at: observation.available_to_runtime_at,
        quality_status: observation.quality.status === "LIMITED" ? "LIMITED" : "PASS",
        canonical_value: Number(observation.canonical_payload.value).toFixed(6),
        canonical_unit: "fraction",
      },
      assimilation_update_ref: ordinary?.object_id ?? null,
      assimilation_update_hash: ordinary?.determinism_hash ?? null,
    });
  }
  if (new Set(obligations.map((item) => item.observation.source_record_hash)).size !== 24) {
    throw new Error("CAP08_S5_V2_FVO_HASH_UNIQUENESS");
  }
  return {
    predecessor,
    s4,
    obligations: validateCap08S5ResidualObligationsV1(obligations),
    predecessor_evidence: structuredClone(CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1),
    prequalification_evidence: structuredClone(CAP08_S5_V2_PREQUALIFICATION_EVIDENCE_V1),
    slice_acceptance_only: true as const,
    final_formal_run_id: null,
  };
}
