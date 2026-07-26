// Fresh-PostgreSQL proof for the non-candidate MCFT-CAP-08.S5 replay-dataset v2 prequalification.
// This proof may persist exactly 24 Residual roots. Candidate, Shadow, Model Activation, active Config switching, production Runtime authority, S6 and MCFT-CAP-09 remain forbidden.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { Cap04ARecordSetV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import {
  admin,
  runner,
  CAP08_S1_CREATED_AT_V1,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import {
  CAP08_S5_REPLAY_DATASET_V2_CONTRACT_DIGEST_V1,
  CAP08_S5_REPLAY_DATASET_V2_HIDDEN_PARAMETER_V1,
  CAP08_S5_REPLAY_DATASET_V2_ID_V1,
  CAP08_S5_REPLAY_DATASET_V2_OUTCOME_PROFILE_ID_V1,
  CAP08_S5_REPLAY_DATASET_V2_PROFILE_ID_V1,
  establishCap08S5ReplayDatasetV2PredecessorV1,
} from "./mcft_cap08_s5_replay_dataset_v2_prequalification_support_v1.js";
import {
  CAP08_S5_PREQUALIFICATION_ORDINARY_ASSIMILATION_ORDERS_V1,
  constructCap08S5PrequalificationWindowsV1,
  runCap08S5EligibilitySurfaceV1,
  type Cap08S5PrequalificationObligationV1,
} from "./mcft_cap08_s5_prequalification_compute_v1.js";

if (process.env.MCFT_CAP08_S5_V2_PREQUALIFICATION_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_V2_PREQUALIFICATION_DESTRUCTIVE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION_RESULT.json",
);

function exactMemberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) {
    throw new Error(`CAP08_S5_V2_PREQUALIFICATION_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  }
  return structuredClone(matches[0]);
}

async function objectTypeCountV1(type: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=$1`,
    [type],
  )).rows[0].n);
}

async function pointersV1(): Promise<Record<string, unknown[]>> {
  const rows = async (table: string): Promise<unknown[]> => (
    await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY 1`)
  ).rows.map((row) => row.row);
  return {
    state: await rows("twin_state_latest_index_v1"),
    forecast: await rows("twin_forecast_result_latest_index_v1"),
    forecast_success: await rows("twin_forecast_success_latest_index_v1"),
    checkpoint: await rows("twin_runtime_checkpoint_latest_index_v1"),
    scenario: await rows("twin_scenario_latest_index_v1"),
  };
}

async function activeConfigAuditV1(): Promise<Record<string, unknown[]>> {
  const tables = await admin.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='public' AND tablename ILIKE '%active%config%'
      ORDER BY tablename`,
  );
  const result: Record<string, unknown[]> = {};
  for (const row of tables.rows) {
    result[row.tablename] = (
      await admin.query(`SELECT to_jsonb(t) AS row FROM ${row.tablename} t ORDER BY 1`)
    ).rows.map((item) => item.row);
  }
  return result;
}

async function grantResidualPrequalificationPrivilegesV1(): Promise<void> {
  await admin.query(
    `GRANT UPDATE ON TABLE public.twin_object_idempotency_index_v1,
                           public.twin_forecast_residual_projection_v1
       TO geox_mcft_cap08_runner_v1`,
  );
}

async function main(): Promise<void> {
  const checks: Array<{ name: string; status: "PASS" }> = [];
  const pass = (name: string): void => {
    checks.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  };
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    await grantResidualPrequalificationPrivilegesV1();

    const predecessor = await establishCap08S5ReplayDatasetV2PredecessorV1(ROOT);
    assert.equal(predecessor.predecessor_result.status, "COMPLETED");
    assert.equal(predecessor.predecessor_result.range.executed_tick_count, 24);
    assert.equal(predecessor.predecessor_result.range.completion_authority_pair_write_delta, 2);
    pass("fresh replay-dataset v2 S1-S3 predecessor completed with 24 ticks");

    const s4 = await new Cap08S4AppendForwardServiceV1(
      runner,
      predecessor.evidence_source,
    ).execute({
      formal_run_id: predecessor.fixture.formal_run_id,
      scope: predecessor.fixture.scope,
      created_at: CAP08_S1_CREATED_AT_V1,
      phase_engine_source_digest: predecessor.source_digest,
    });
    assert.equal(s4.status, "COMPLETED");
    assert.equal(s4.write_delta, 7);
    assert.equal(s4.slice_acceptance_only, true);
    assert.equal(s4.final_formal_run_id, null);
    assert.equal(s4.corrected_set.forecast.object_id, s4.t17_predecessor.previous_forecast_result_ref);
    pass("v2 late Evidence append-forward completed without historical rewrite");

    const tickResults = predecessor.predecessor_result.range.tick_results;
    assert.equal(tickResults.length, 24);
    const obligations: Cap08S5PrequalificationObligationV1[] = [];
    for (let order = 1; order <= 24; order += 1) {
      const observationSourceForecast = exactMemberV1(
        tickResults[order - 1].a_record_set,
        "twin_forecast_run_v1",
      );
      const residualForecast = order === 17
        ? s4.corrected_set.forecast
        : observationSourceForecast;
      const fvoId = `FVO-${String(order).padStart(2, "0")}`;
      const observation = await predecessor.evidence_source.buildFvoFromForecastV1({
        scope: predecessor.fixture.scope,
        fvoId,
        forecast: observationSourceForecast,
      });
      const ordinaryAssimilation = (
        CAP08_S5_PREQUALIFICATION_ORDINARY_ASSIMILATION_ORDERS_V1 as readonly number[]
      ).includes(order)
        ? exactMemberV1(tickResults[order].a_record_set, "twin_assimilation_update_v1")
        : null;
      obligations.push({
        order,
        residual_id: `R-${String(order).padStart(2, "0")}`,
        forecast: residualForecast,
        observation,
        assimilation: ordinaryAssimilation,
      });
    }
    assert.equal(new Set(obligations.map((item) => item.observation.source_record_hash)).size, 24);
    assert.equal(
      obligations[16].observation.canonical_payload.source_forecast_ref,
      exactMemberV1(tickResults[16].a_record_set, "twin_forecast_run_v1").object_id,
    );
    assert.equal(obligations[16].forecast.object_id, s4.corrected_set.forecast.object_id);
    pass("24 exact obligations preserve fixed FVO identity while R-17 uses corrected Forecast");

    const pointersBefore = await pointersV1();
    const activeConfigBefore = await activeConfigAuditV1();
    const candidateBefore = await objectTypeCountV1("twin_calibration_candidate_v1");
    const shadowBefore = await objectTypeCountV1("twin_shadow_evaluation_v1");
    const activationBefore = await objectTypeCountV1("twin_model_activation_v1");
    const stateBefore = await objectTypeCountV1("twin_state_estimate_v1");
    const forecastBefore = await objectTypeCountV1("twin_forecast_run_v1");

    const first = await constructCap08S5PrequalificationWindowsV1({
      pool: runner,
      runtimeRepository: predecessor.runtime_repository,
      scope: predecessor.fixture.scope,
      obligations,
      created_at: "2026-07-26T00:00:00.000Z",
    });
    assert.equal(first.residuals.length, 24);
    assert.equal(first.residual_insert_count, 24);
    assert.equal(first.calibration.cases.length, 16);
    assert.equal(first.holdout.cases.length, 8);
    assert.equal(first.calibration.objective_case_count, 15);
    assert.equal(first.calibration.diagnostic_only_case_count, 1);
    assert.equal(first.calibration.cases[9].actual_observation_ref, "FVO-10");
    assert.equal(first.calibration.cases[9].objective_eligible, false);
    assert.equal(await objectTypeCountV1("twin_forecast_residual_v1"), 24);
    pass("24 canonical Residual roots and exact 16/8 membership persisted");

    const unfiltered = await runCap08S5EligibilitySurfaceV1({
      calibrationWindow: first.calibration,
      objectiveIneligibleObservationRefs: [],
    });
    assert.equal(unfiltered.selected_parameter_value, "0.040000");
    assert.equal(unfiltered.status, "SEARCH_BOUNDARY_HIT_INCONCLUSIVE");
    assert.equal(unfiltered.canonical_append_allowed, false);

    const eligible = await runCap08S5EligibilitySurfaceV1({
      calibrationWindow: first.calibration,
      objectiveIneligibleObservationRefs: ["FVO-10"],
    });
    assert.equal(eligible.selected_parameter_value, CAP08_S5_REPLAY_DATASET_V2_HIDDEN_PARAMETER_V1);
    assert.equal(eligible.selected_parameter_delta, "0.004000");
    assert.equal(eligible.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
    assert.equal(eligible.canonical_append_allowed, true);
    assert.equal(eligible.case_window_count, 16);
    assert.equal(eligible.objective_case_count, 15);
    assert.equal(eligible.diagnostic_only_case_count, 1);
    assert.deepEqual(eligible.objective_ineligible_observation_refs, ["FVO-10"]);
    assert.equal(eligible.excitation_summary.sensitive_case_count, 7);
    assert.deepEqual(
      eligible.excitation_summary.represented_sensitive_wetness_regimes,
      ["HIGH_EXCESS", "MID_EXCESS"],
    );
    pass("eligibility-aware 21-point surface recovers exact 0.034000 oracle");

    const second = await constructCap08S5PrequalificationWindowsV1({
      pool: runner,
      runtimeRepository: predecessor.runtime_repository,
      scope: predecessor.fixture.scope,
      obligations,
      created_at: "2026-07-26T00:00:00.000Z",
    });
    assert.equal(second.residual_insert_count, 0);
    assert.deepEqual(
      second.residuals.map((item) => [item.object_id, item.determinism_hash]),
      first.residuals.map((item) => [item.object_id, item.determinism_hash]),
    );
    const eligibleRerun = await runCap08S5EligibilitySurfaceV1({
      calibrationWindow: second.calibration,
      objectiveIneligibleObservationRefs: ["FVO-10"],
    });
    assert.equal(eligibleRerun.determinism_hash, eligible.determinism_hash);
    pass("completed prequalification rerun performs zero Residual write and reproduces surface hash");

    assert.equal(await objectTypeCountV1("twin_calibration_candidate_v1"), candidateBefore);
    assert.equal(await objectTypeCountV1("twin_shadow_evaluation_v1"), shadowBefore);
    assert.equal(await objectTypeCountV1("twin_model_activation_v1"), activationBefore);
    assert.equal(await objectTypeCountV1("twin_state_estimate_v1"), stateBefore);
    assert.equal(await objectTypeCountV1("twin_forecast_run_v1"), forecastBefore);
    assert.deepEqual(await pointersV1(), pointersBefore);
    assert.deepEqual(await activeConfigAuditV1(), activeConfigBefore);
    pass("Candidate Shadow activation active-config State and checkpoint boundaries remain unchanged");

    const semantic = {
      schema_version: "geox_mcft_cap08_s5_replay_dataset_v2_prequalification_result_v1" as const,
      status: "PASS" as const,
      action_id: "MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION" as const,
      dataset_id: CAP08_S5_REPLAY_DATASET_V2_ID_V1,
      prequalification_contract_digest: CAP08_S5_REPLAY_DATASET_V2_CONTRACT_DIGEST_V1,
      generation_profile_id: CAP08_S5_REPLAY_DATASET_V2_PROFILE_ID_V1,
      outcome_profile_id: CAP08_S5_REPLAY_DATASET_V2_OUTCOME_PROFILE_ID_V1,
      hidden_parameter_value: CAP08_S5_REPLAY_DATASET_V2_HIDDEN_PARAMETER_V1,
      formal_run_id: predecessor.fixture.formal_run_id,
      source_digest: predecessor.source_digest,
      s3_tick_count: predecessor.predecessor_result.range.executed_tick_count,
      s4_status: s4.status,
      s4_write_delta: s4.write_delta,
      residual_count: first.residuals.length,
      residual_insert_count: first.residual_insert_count,
      residual_rerun_insert_count: second.residual_insert_count,
      residual_refs: first.residuals.map((item) => item.object_id),
      residual_hashes: first.residuals.map((item) => item.determinism_hash),
      residual_set_hash: first.residual_set_hash,
      case_input_set_hash: first.case_input_set_hash,
      calibration_window_hash: first.calibration.determinism_hash,
      holdout_window_hash: first.holdout.determinism_hash,
      calibration_case_count: first.calibration.cases.length,
      holdout_case_count: first.holdout.cases.length,
      objective_case_count: eligible.objective_case_count,
      diagnostic_only_case_count: eligible.diagnostic_only_case_count,
      objective_ineligible_observation_refs: eligible.objective_ineligible_observation_refs,
      unfiltered_surface: unfiltered,
      eligibility_aware_surface: eligible,
      checks,
      candidate_append_count: 0,
      shadow_append_count: 0,
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      state_pointer_delta: 0,
      checkpoint_pointer_delta: 0,
      production_runtime_source_authorized: false,
      s5_formal_candidate_authorized: false,
      s5_effective: false,
      s6_authorized: false,
      mcft_cap_09_authorized: false,
    };
    const result = {
      ...semantic,
      semantic_digest: semanticHashV1(semantic),
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
