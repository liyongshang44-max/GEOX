// Purpose: execute one complete MCFT-CAP-08.S6 final-formal S1-S5 chain in a fresh PostgreSQL database.
// Boundary: formal acceptance writer only; no production route, scheduler, active Config switch, Model Activation, or MCFT-CAP-09 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.MCFT_CAP08_S6_FINAL_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP08_S6_FINAL_DESTRUCTIVE_1");
}
const runInstanceId = String(process.env.MCFT_CAP08_S6_RUN_INSTANCE_ID || "");
if (runInstanceId !== "RUN_A" && runInstanceId !== "RUN_B") throw new Error("MCFT_CAP08_S6_RUN_INSTANCE_ID_INVALID");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${runInstanceId}_EXECUTE_RESULT.json`);

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [
    { semanticHashV1 },
    { PostgresCalibrationGovernanceRepositoryV1 },
    { PostgresFeedbackPersistenceRepositoryV1 },
    { PostgresCap08S5ExactSourceV1 },
    { Cap08S5ResidualCalibrationShadowServiceV1 },
    { Cap08S3EpisodeInspectorV1 },
    { establishCap08S6FinalFormalPredecessorV1, CAP08_S6_CONTRACT_SEMANTIC_DIGEST_V1, CAP08_S6_CREATED_AT_V1 },
    support,
  ] = await Promise.all([
    import("../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js"),
    import("../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js"),
    import("../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js"),
    import("../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js"),
    import("../../apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.js"),
    import("../../apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.js"),
    import("./mcft_cap08_s6_final_formal_support_v1.js"),
    import("./mcft_cap08_s2_g3_acceptance_support_v1.js"),
  ]);
  const { runner, admin } = support;
  const objectCount = async (type: string): Promise<number> => Number((await admin.query(
    "SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=$1",
    [type],
  )).rows[0].n);
  const exactCounts = async () => ({
    lineage: await objectCount("twin_runtime_lineage_v1"),
    ticks: await objectCount("twin_runtime_tick_v1"),
    states: await objectCount("twin_state_estimate_v1"),
    forecasts: await objectCount("twin_forecast_run_v1"),
    scenarios: await objectCount("twin_scenario_set_v1"),
    decisions: await objectCount("twin_decision_record_v1"),
    feedback: await objectCount("twin_action_feedback_v1"),
    residuals: await objectCount("twin_forecast_residual_v1"),
    candidates: await objectCount("twin_calibration_candidate_v1"),
    shadows: await objectCount("twin_shadow_evaluation_v1"),
    activations: await objectCount("twin_model_activation_v1"),
  });
  const makeService = () => new Cap08S5ResidualCalibrationShadowServiceV1(
    new PostgresCap08S5ExactSourceV1(runner, new PostgresFeedbackPersistenceRepositoryV1(runner)),
    new PostgresCalibrationGovernanceRepositoryV1(runner),
  );
  const expectFailure = async (action: () => Promise<unknown>, pattern: RegExp): Promise<void> => {
    try { await action(); } catch (error) {
      assert.match(error instanceof Error ? error.message : String(error), pattern);
      return;
    }
    throw new Error(`EXPECTED_FAILURE_NOT_RAISED:${pattern.source}`);
  };

  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const established = await establishCap08S6FinalFormalPredecessorV1(ROOT, runInstanceId);
    assert.equal(established.slice_acceptance_only, false);
    assert.equal(established.final_formal_run_id, established.fixture.formal_run_id);
    assert.equal(established.obligations.length, 24);
    assert.equal(new Set(established.obligations.map((item) => item.observation.source_record_hash)).size, 24);
    const episode = await new Cap08S3EpisodeInspectorV1(runner).inspect({
      formal_run_id: established.fixture.formal_run_id,
      scope: established.fixture.scope,
    });
    assert.equal(episode.disposition, "EXACT_COMPLETE");
    for (const field of ["decision_request_count", "decision_count", "approval_assertion_count", "approved_plan_count", "execution_receipt_count", "action_feedback_count"] as const) {
      assert.equal(episode[field], 1, `CAP08_S6_EPISODE_${field}`);
    }

    const request = {
      scope: established.fixture.scope,
      formal_run_id: established.fixture.formal_run_id,
      created_at: CAP08_S6_CREATED_AT_V1,
      predecessor: established.predecessor_evidence,
      prequalification: established.prequalification_evidence,
      obligations: established.obligations,
    };

    await expectFailure(
      () => makeService().execute({
        ...request,
        candidate_fault_injection(stage) { if (stage === "before_commit") throw new Error("S6_PRECOMMIT_CANDIDATE_ROLLBACK"); },
      }),
      /S6_PRECOMMIT_CANDIDATE_ROLLBACK/,
    );
    assert.deepEqual(await exactCounts(), {
      lineage: 1, ticks: 25, states: 25, forecasts: 25, scenarios: 24,
      decisions: 1, feedback: 1, residuals: 24, candidates: 0, shadows: 0, activations: 0,
    });

    await expectFailure(
      () => makeService().execute({
        ...request,
        shadow_fault_injection(stage) { if (stage === "before_commit") throw new Error("S6_PRECOMMIT_SHADOW_ROLLBACK"); },
      }),
      /S6_PRECOMMIT_SHADOW_ROLLBACK/,
    );
    const afterShadowRollback = await exactCounts();
    assert.equal(afterShadowRollback.residuals, 24);
    assert.equal(afterShadowRollback.candidates, 1);
    assert.equal(afterShadowRollback.shadows, 0);

    const concurrent = await Promise.all([
      makeService().execute(request),
      makeService().execute(request),
    ]);
    for (const result of concurrent) {
      assert.equal(result.residual_count, 24);
      assert.equal(result.calibration_case_count, 16);
      assert.equal(result.objective_case_count, 15);
      assert.equal(result.diagnostic_only_case_count, 1);
      assert.equal(result.holdout_case_count, 8);
      assert.equal(result.objective_attempt.selected_parameter_value, "0.034000");
      assert.deepEqual(result.diagnostic_only_observation_refs, ["FVO-10"]);
      assert.equal(result.model_activation_count, 0);
      assert.equal(result.active_runtime_config_switch_count, 0);
    }
    const completed = concurrent[0];
    assert.equal(concurrent[1].candidate.object_id, completed.candidate.object_id);
    assert.equal(concurrent[1].candidate.determinism_hash, completed.candidate.determinism_hash);
    assert.equal(concurrent[1].shadow_evaluation.object_id, completed.shadow_evaluation.object_id);
    assert.equal(concurrent[1].shadow_evaluation.determinism_hash, completed.shadow_evaluation.determinism_hash);

    const finalCounts = await exactCounts();
    assert.deepEqual(finalCounts, {
      lineage: 1, ticks: 25, states: 25, forecasts: 25, scenarios: 24,
      decisions: 1, feedback: 1, residuals: 24, candidates: 1, shadows: 1, activations: 0,
    });

    const responseLossReadback = await makeService().execute(request);
    assert.equal(responseLossReadback.residual_insert_count, 0);
    assert.equal(responseLossReadback.candidate_append_count, 0);
    assert.equal(responseLossReadback.shadow_append_count, 0);
    assert.equal(responseLossReadback.candidate.object_id, completed.candidate.object_id);
    assert.equal(responseLossReadback.shadow_evaluation.object_id, completed.shadow_evaluation.object_id);
    assert.deepEqual(await exactCounts(), finalCounts);

    const canonicalRows = (await admin.query(
      `SELECT record_json->>'type' AS object_type,
              record_json->'payload'->>'object_id' AS object_id,
              record_json->'payload'->>'determinism_hash' AS determinism_hash,
              record_json->'payload'->>'logical_time' AS logical_time
         FROM facts
        WHERE record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->'payload'->>'object_id' IS NOT NULL
        ORDER BY object_type,logical_time,object_id`,
      Object.values(established.fixture.scope),
    )).rows;
    const semanticChainDigest = semanticHashV1(canonicalRows);
    const operationalInvariant = {
      schema_version: "geox_mcft_cap08_s6_operational_invariant_v1",
      precommit_candidate_rollback: "PASS",
      precommit_shadow_rollback: "PASS",
      concurrent_invocation_count: 2,
      canonical_candidate_count: 1,
      canonical_shadow_count: 1,
      duplicate_canonical_write_count: 0,
      response_loss_rerun_write_count: 0,
      resolver_terminal_state: "COMPLETED",
      run_instance_class: "INDEPENDENT_FRESH_DATABASE",
    };
    const operationalInvariantDigest = semanticHashV1(operationalInvariant);
    const technicalLedger = [
      ["HA-01", "RUN_LOCAL_DETERMINISM_READY"], ["HA-02", "PASS"], ["HA-03", "PASS"], ["HA-04", "PASS"],
      ["HA-05", "PASS"], ["HA-06", "PASS"], ["HA-07", "PASS"], ["HA-08", "PASS"], ["HA-09", "PASS"],
      ["HA-10", "PASS"], ["HA-11", "PASS"], ["HA-12", "PASS"], ["HA-13", "PASS"], ["HA-14", "PASS"],
      ["HA-15", "PASS"], ["HA-16", "PASS"], ["HA-17", "PASS"], ["HA-18", "PASS"],
      ["HA-19", "PENDING_FRESH_PROCESS_READBACK"], ["HA-20", "PASS"], ["HA-21", "PASS"], ["HA-22", "PASS"],
      ["HA-23", "PENDING_READ_MODEL_RECOVERY"], ["HA-24", "PENDING_EXACT_MERGE_R2"],
    ].map(([item_id, status]) => ({ item_id, status }));
    const executeResult = {
      schema_version: "geox_mcft_cap08_s6_formal_execute_result_v1",
      status: "PASS",
      run_instance_id: runInstanceId,
      formal_run_id: established.fixture.formal_run_id,
      scope: established.fixture.scope,
      s6_contract_semantic_digest: CAP08_S6_CONTRACT_SEMANTIC_DIGEST_V1,
      source_digest: established.source_digest,
      semantic_chain_digest: semanticChainDigest,
      operational_invariant_digest: operationalInvariantDigest,
      operational_invariant: operationalInvariant,
      canonical_object_manifest_count: canonicalRows.length,
      counts: finalCounts,
      forecast_point_count: Number((await admin.query("SELECT count(*)::int AS n FROM twin_forecast_point_projection_v1")).rows[0].n),
      scenario_option_count: 72,
      scenario_point_count: Number((await admin.query("SELECT count(*)::int AS n FROM twin_scenario_point_projection_v1")).rows[0].n),
      fvo_count: established.obligations.length,
      calibration_case_count: completed.calibration_case_count,
      objective_case_count: completed.objective_case_count,
      diagnostic_only_case_count: completed.diagnostic_only_case_count,
      holdout_case_count: completed.holdout_case_count,
      candidate_parameter_value: completed.objective_attempt.selected_parameter_value,
      candidate_ref: completed.candidate.object_id,
      candidate_hash: completed.candidate.determinism_hash,
      shadow_ref: completed.shadow_evaluation.object_id,
      shadow_hash: completed.shadow_evaluation.determinism_hash,
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      episode_cardinality: {
        decision: episode.decision_count,
        approval_assertion: episode.approval_assertion_count,
        approved_plan: episode.approved_plan_count,
        execution_receipt: episode.execution_receipt_count,
        action_feedback: episode.action_feedback_count,
      },
      technical_hard_acceptance_ledger: technicalLedger,
      slice_acceptance_object_reuse: false,
      final_formal_run: true,
      production_runtime_source_authorized: false,
      mcft_cap_09_authorized: false,
    };
    write(executeResult);
    console.log(JSON.stringify(executeResult));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  write({ schema_version: "geox_mcft_cap08_s6_formal_execute_result_v1", status: "FAIL", run_instance_id: runInstanceId, error: error instanceof Error ? error.stack || error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
