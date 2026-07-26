// Purpose: establish the exact S3 plus S4 slice predecessor and derive the frozen 24-item MCFT-CAP-08.S5 Forecast/FVO obligation ledger from returned canonical bindings.
// Boundary: acceptance support only; no Candidate Declaration, final formal run, production Runtime source, Model Activation, active Config switch, or MCFT-CAP-09 authority.

import path from "node:path";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1,
  validateCap08S5ResidualObligationsV1,
  type Cap08S5PredecessorEvidenceV1,
  type Cap08S5ResidualObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import {
  CAP08_S1_CREATED_AT_V1,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S3FormalPredecessorV1 } from "./mcft_cap08_s4_acceptance_support_v1.js";
import { buildCap08S2FormalFvoRecordV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

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

function exactMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S5_ACCEPTANCE_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return structuredClone(matches[0]);
}

function commitPhaseV1(order: number): string {
  if (order === 1 || order === 16) return "T16";
  if (order === 24) return "G00";
  return `T${String(order).padStart(2, "0")}`;
}

function ordinaryAssimilationV1(input: {
  order: number;
  tickResults: readonly { a_record_set: Cap04ARecordSetV1 }[];
}): { ref: string | null; hash: string | null } {
  if (!(CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(input.order)) {
    return { ref: null, hash: null };
  }
  const tick = input.tickResults[input.order];
  if (!tick) throw new Error(`CAP08_S5_ACCEPTANCE_ORDINARY_TICK_REQUIRED:${input.order}`);
  const assimilation = exactMemberV1(tick.a_record_set, "twin_assimilation_update_v1");
  return { ref: assimilation.object_id, hash: assimilation.determinism_hash };
}

export async function establishCap08S5SlicePredecessorV1(root = path.resolve(".")) {
  const predecessor = await establishCap08S3FormalPredecessorV1(root);
  const s4Service = new Cap08S4AppendForwardServiceV1(runner, predecessor.fixture.formal_evidence_source);
  const s4 = await s4Service.execute({
    formal_run_id: predecessor.fixture.formal_run_id,
    scope: predecessor.fixture.scope,
    created_at: CAP08_S1_CREATED_AT_V1,
    phase_engine_source_digest: predecessor.source_manifest.manifest_digest,
  });
  if (s4.status !== "COMPLETED"
    || s4.write_delta !== 7
    || s4.slice_acceptance_only !== true
    || s4.final_formal_run_id !== null
    || s4.corrected_set.forecast.object_id !== s4.t17_predecessor.previous_forecast_result_ref) {
    throw new Error("CAP08_S5_ACCEPTANCE_S4_PREDECESSOR_NOT_EXACT");
  }

  const tickResults = predecessor.predecessor_result.tick_results;
  if (tickResults.length !== 24) throw new Error(`CAP08_S5_ACCEPTANCE_TICK_RESULT_COUNT:${tickResults.length}`);
  const obligations: Cap08S5ResidualObligationV1[] = [];
  for (let order = 1; order <= 24; order += 1) {
    const fvoId = `FVO-${String(order).padStart(2, "0")}`;
    const residualId = `R-${String(order).padStart(2, "0")}`;
    const observation = buildCap08S2FormalFvoRecordV1(predecessor.fixture.scope, fvoId);
    const forecastTickIndex = order - 1;
    const sourceForecast = order === 17
      ? s4.corrected_set.forecast
      : exactMemberV1(tickResults[forecastTickIndex].a_record_set, "twin_forecast_run_v1");
    const assimilation = ordinaryAssimilationV1({ order, tickResults });
    obligations.push({
      residual_id: residualId,
      residual_order: order,
      commit_phase: commitPhaseV1(order),
      forecast_ref: sourceForecast.object_id,
      forecast_hash: sourceForecast.determinism_hash,
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
      assimilation_update_ref: assimilation.ref,
      assimilation_update_hash: assimilation.hash,
    });
  }

  return {
    predecessor,
    s4,
    predecessor_evidence: structuredClone(CAP08_S5_S4_PREDECESSOR_EVIDENCE_V1),
    obligations: validateCap08S5ResidualObligationsV1(obligations),
    slice_acceptance_only: true as const,
    final_formal_run_id: null,
  };
}
