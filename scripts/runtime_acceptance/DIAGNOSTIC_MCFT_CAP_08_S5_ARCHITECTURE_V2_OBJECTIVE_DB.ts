// Disposable architecture-deviation diagnostic for one CAP-08 replay-dataset v2 design.
// No Candidate, Shadow, predecessor effectiveness, Model Activation, active Config switch, final formal run, or MCFT-CAP-09 authority.

import fs from "node:fs";
import path from "node:path";

import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
  type Cap06SourceDatasetIdentityV1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import {
  asCap06ComputeWindowV1,
  buildCap08S5CaseWindowV1,
  buildCap08S5CaseWindowsV1,
} from "../../apps/server/src/domain/calibration/cap08_s5_case_builder_v1.js";
import { runCap06CalibrationGridSearchV1 } from "../../apps/server/src/domain/calibration/grid_search_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1,
  validateCap08S5ResidualObligationsV1,
  type Cap08S5ResidualObligationV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import { Cap08S5ReplayPredictionAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.js";
import {
  CAP08_S1_CREATED_AT_V1,
  admin,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import {
  CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
  CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
  CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
  establishCap08S5ArchitectureV2DiagnosticPredecessorV1,
} from "./mcft_cap08_s5_architecture_v2_diagnostic_support_v1.js";

if (process.env.MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE_1");
}

const OUT = "acceptance-output/MCFT_CAP_08_S5_ARCHITECTURE_V2_OBJECTIVE_DIAGNOSTIC.json";

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

function sourceDatasetIdentityV1(resolved: readonly Awaited<ReturnType<PostgresCap08S5ExactSourceV1["resolveExactObligation"]>>[]): Cap06SourceDatasetIdentityV1 {
  const refs = resolved.map((item) => item.residual.object_id);
  return {
    residual_set_hash: semanticHashV1(resolved.map((item) => ({ ref: item.residual.object_id, hash: item.residual.determinism_hash }))),
    case_input_set_hash: semanticHashV1(resolved.map((item) => ({
      residual_ref: item.case_source.residual_ref,
      residual_hash: item.case_source.residual_hash,
      forecast_point_ref: item.case_source.source_forecast_point_ref,
      forecast_point_hash: item.case_source.source_forecast_point_hash,
      observation_ref: item.case_source.actual_observation_ref,
      observation_hash: item.case_source.actual_observation_hash,
    }))),
    calibration_window_hash: semanticHashV1(refs.slice(0, 16)),
    holdout_window_hash: semanticHashV1(refs.slice(16)),
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
}

async function main(): Promise<void> {
  try {
    const predecessor = await establishCap08S5ArchitectureV2DiagnosticPredecessorV1(path.resolve("."));
    const s4 = await new Cap08S4AppendForwardServiceV1(
      runner,
      predecessor.diagnostic_evidence_source,
    ).execute({
      formal_run_id: predecessor.fixture.formal_run_id,
      scope: predecessor.fixture.scope,
      created_at: CAP08_S1_CREATED_AT_V1,
      phase_engine_source_digest: predecessor.diagnostic_source_digest,
    });
    if (s4.status !== "COMPLETED"
      || s4.write_delta !== 7
      || s4.corrected_set.forecast.object_id !== s4.t17_predecessor.previous_forecast_result_ref) {
      throw new Error("CAP08_S5_V2_S4_CORRECTION_NOT_EXACT");
    }

    const tickResults = predecessor.predecessor_result.range.tick_results;
    const obligations: Cap08S5ResidualObligationV1[] = [];
    for (let order = 1; order <= 24; order += 1) {
      const sourceForecast = order === 17
        ? s4.corrected_set.forecast
        : exactMemberV1(tickResults[order - 1].a_record_set, "twin_forecast_run_v1");
      const fvoId = `FVO-${String(order).padStart(2, "0")}`;
      const observation = await predecessor.diagnostic_evidence_source.buildFvoFromForecastV1({
        scope: predecessor.fixture.scope,
        fvoId,
        forecast: sourceForecast,
      });
      const ordinary = (CAP08_S5_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]).includes(order)
        ? exactMemberV1(tickResults[order].a_record_set, "twin_assimilation_update_v1")
        : null;
      obligations.push({
        residual_id: `R-${String(order).padStart(2, "0")}`,
        residual_order: order,
        commit_phase: commitPhaseV1(order),
        forecast_ref: sourceForecast.object_id,
        forecast_hash: sourceForecast.determinism_hash,
        observation: {
          fvo_id: fvoId,
          source_record_id: observation.source_record_id,
          source_record_hash: observation.source_record_hash,
          observed_at: String(observation.role_time.observed_at),
          available_to_runtime_at: observation.available_to_runtime_at,
          quality_status: observation.quality.status === "LIMITED" ? "LIMITED" : "PASS",
          canonical_value: Number(observation.canonical_payload.value).toFixed(6),
          canonical_unit: "fraction",
        },
        assimilation_update_ref: ordinary?.object_id ?? null,
        assimilation_update_hash: ordinary?.determinism_hash ?? null,
      });
    }
    const exactObligations = validateCap08S5ResidualObligationsV1(obligations);
    const source = new PostgresCap08S5ExactSourceV1(
      runner,
      new PostgresFeedbackPersistenceRepositoryV1(runner),
    );
    const resolved = [];
    for (const obligation of exactObligations) {
      resolved.push(await source.resolveExactObligation({
        scope: predecessor.fixture.scope,
        formal_run_id: predecessor.fixture.formal_run_id,
        obligation,
        created_at: "2026-07-26T00:00:00.000Z",
      }));
    }
    const identity = sourceDatasetIdentityV1(resolved);
    const calibrationResolved = resolved.slice(0, 16);
    const holdoutResolved = resolved.slice(16);
    const calibrationWindow = buildCap08S5CaseWindowV1({
      role: "CALIBRATION",
      orderedResidualRefs: calibrationResolved.map((item) => item.residual.object_id),
      loadedCases: calibrationResolved.map((item) => item.case_source),
      sourceDatasetIdentity: identity,
    });
    const holdoutWindow = buildCap08S5CaseWindowV1({
      role: "HOLDOUT",
      orderedResidualRefs: holdoutResolved.map((item) => item.residual.object_id),
      loadedCases: holdoutResolved.map((item) => item.case_source),
      sourceDatasetIdentity: identity,
    });
    const windows = buildCap08S5CaseWindowsV1({ calibration: calibrationWindow, holdout: holdoutWindow });
    const attempt = await runCap06CalibrationGridSearchV1({
      calibrationWindow: asCap06ComputeWindowV1(calibrationWindow),
      predictionPort: new Cap08S5ReplayPredictionAdapterV1(resolved),
    });
    const result = {
      schema_version: "geox_mcft_cap08_s5_architecture_v2_objective_diagnostic_v1",
      status: "DIAGNOSTIC_ONLY",
      dataset_id: CAP08_S5_ARCHITECTURE_V2_DIAGNOSTIC_DATASET_ID_V1,
      generation_profile_id: CAP08_S5_ARCHITECTURE_V2_PROFILE_ID_V1,
      hidden_parameter_value: CAP08_S5_ARCHITECTURE_V2_HIDDEN_PARAMETER_V1,
      formal_run_id: predecessor.fixture.formal_run_id,
      s3_tick_count: predecessor.predecessor_result.range.executed_tick_count,
      s4_correction_status: s4.status,
      s4_write_delta: s4.write_delta,
      residual_count: resolved.length,
      source_dataset_identity: identity,
      windows,
      attempt,
      expected_candidate_value: "0.034000",
      oracle_matches: attempt.selected_parameter_value === "0.034000",
      candidate_append_allowed: attempt.canonical_append_allowed,
      candidate_created: false,
      shadow_created: false,
      predecessor_effectiveness_claimed: false,
      s5_effective: false,
      final_formal_run_id: null,
      architecture_deviation_resolved: attempt.selected_parameter_value === "0.034000"
        && attempt.canonical_append_allowed,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
