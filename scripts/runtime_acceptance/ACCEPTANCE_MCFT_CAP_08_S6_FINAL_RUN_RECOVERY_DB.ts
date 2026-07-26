// Fresh-process recovery/readback proof for one MCFT-CAP-08.S6 formal run.
// The preceding materialization process must have completed the exact S1-S5 chain in this fresh database.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { Cap06RestartReadbackRebuildServiceV1 } from "../../apps/server/src/runtime/calibration/restart_readback_rebuild_service_v1.js";
import { Cap05RestartLateReceiptRebuildServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.js";
import { Cap08S5ResidualCalibrationShadowServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.js";
import { registerMcftFieldTwinReadRoutesV1 } from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";
import { admin, runner } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import {
  findLatestRecordSetAuthority,
  loadExistingS5Request,
  pointerSnapshot,
  rebuildLatestRuntimeAuthority,
  rebuildScenarioAuthority,
  removeRecoverablePointers,
  type PointerSnapshot,
} from "./mcft_cap08_s6_existing_recovery_support_v1.js";

if (process.env.MCFT_CAP08_S6_FINAL_RUN_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP08_S6_FINAL_RUN_DESTRUCTIVE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUN_LABEL = String(process.env.MCFT_CAP08_S6_RUN_LABEL ?? "").trim();
const OPERATIONAL_INSTANCE_ID = String(process.env.MCFT_CAP08_S6_OPERATIONAL_INSTANCE_ID ?? "").trim();
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const MATERIALIZATION_RESULT = String(process.env.MCFT_CAP08_S6_MATERIALIZATION_RESULT ?? "").trim();
if (!/^(RUN_A|RUN_B)$/.test(RUN_LABEL)) throw new Error("S6_RUN_LABEL_INVALID");
if (!OPERATIONAL_INSTANCE_ID) throw new Error("S6_OPERATIONAL_INSTANCE_ID_REQUIRED");
if (!DATABASE_URL) throw new Error("S6_DATABASE_URL_REQUIRED");
if (!MATERIALIZATION_RESULT) throw new Error("S6_MATERIALIZATION_RESULT_REQUIRED");
const OUT = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${RUN_LABEL}_RESULT.json`);

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function factCount(pool: Pool): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
}

async function typeCounts(pool: Pool): Promise<Record<string, number>> {
  const rows = await pool.query(
    `SELECT record_json->>'type' AS object_type,count(*)::int AS n
       FROM facts GROUP BY record_json->>'type' ORDER BY record_json->>'type'`,
  );
  return Object.fromEntries(rows.rows.map((row) => [String(row.object_type), Number(row.n)]));
}

async function tableCardinalitySnapshot(pool: Pool): Promise<Array<{ table: string; count: number }>> {
  const tables = (await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )).rows.map((row) => String(row.tablename));
  const output: Array<{ table: string; count: number }> = [];
  for (const table of tables) {
    const safe = `"${table.replaceAll('"', '""')}"`;
    output.push({ table, count: Number((await pool.query(`SELECT count(*)::int AS n FROM ${safe}`)).rows[0].n) });
  }
  return output;
}

async function operatorReadback(pool: Pool, scope: Record<string, string>): Promise<{
  surfaces: Array<{ endpoint: string; status: number; content_hash: string | null; response_hash: string | null }>;
  response_bodies: Record<string, Record<string, unknown>>;
  product_read_write_delta: 0;
}> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ s6: "s6-final-closure-signing-key-00000000000000000001" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s6";
  const before = await tableCardinalitySnapshot(pool);
  const app = Fastify({ logger: false });
  registerMcftFieldTwinReadRoutesV1(app, pool, {
    authorizeScope: (_request, requested) => ({
      tenant_id: requested.tenant_id,
      project_id: requested.project_id,
      group_id: requested.group_id,
      allowed_field_ids: [requested.field_id],
      principal_id: "mcft-cap-08-s6-acceptance",
    } as any),
  });
  await app.ready();
  const query = new URLSearchParams({
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  }).toString();
  const base = `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime`;
  const requests: Array<{ name: string; suffix: string }> = [
    { name: "runtime", suffix: "" },
    { name: "timeline", suffix: "/timeline?limit=10" },
    { name: "trace", suffix: "/trace" },
    { name: "states", suffix: "/states?limit=10" },
    { name: "forecasts", suffix: "/forecasts?limit=10" },
    { name: "scenarios", suffix: "/scenarios?limit=10" },
    { name: "residuals", suffix: "/residuals?limit=10" },
    { name: "action-lifecycle", suffix: "/action-lifecycle?limit=10" },
    { name: "model-governance", suffix: "/model-governance?collection_kind=CALIBRATION_CANDIDATE&limit=10" },
    { name: "health", suffix: "/health" },
  ];
  const surfaces: Array<{ endpoint: string; status: number; content_hash: string | null; response_hash: string | null }> = [];
  const responseBodies: Record<string, Record<string, unknown>> = {};
  try {
    for (const item of requests) {
      const separator = item.suffix.includes("?") ? "&" : "?";
      const response = await app.inject({ method: "GET", url: `${base}${item.suffix}${separator}${query}` });
      assert.equal(response.statusCode, 200, `S6_GET_${item.name.toUpperCase()}_${response.body}`);
      assert.equal(response.headers["cache-control"], "no-store");
      const body = response.json() as Record<string, unknown>;
      responseBodies[item.name] = body;
      const contentHash = String(response.headers["x-geox-mcft-content-hash"] ?? "") || null;
      const responseHash = String(response.headers["x-geox-mcft-response-instance-hash"] ?? "") || null;
      assert.ok(contentHash?.startsWith("sha256:"), `S6_GET_${item.name.toUpperCase()}_CONTENT_HASH`);
      assert.ok(responseHash?.startsWith("sha256:"), `S6_GET_${item.name.toUpperCase()}_RESPONSE_HASH`);
      surfaces.push({ endpoint: item.name, status: response.statusCode, content_hash: contentHash, response_hash: responseHash });
    }
    const timeline = responseBodies.timeline;
    const nextCursor = typeof timeline.next_cursor === "string" ? timeline.next_cursor : null;
    if (nextCursor) {
      const response = await app.inject({ method: "GET", url: `${base}/timeline?limit=10&cursor=${encodeURIComponent(nextCursor)}&${query}` });
      assert.equal(response.statusCode, 200, `S6_TIMELINE_SECOND_PAGE:${response.body}`);
    }
  } finally {
    await app.close();
  }
  const after = await tableCardinalitySnapshot(pool);
  assert.deepEqual(after, before, "S6_OPERATOR_GET_WRITE_DELTA");
  return { surfaces, response_bodies: responseBodies, product_read_write_delta: 0 };
}

async function main(): Promise<void> {
  const materialization = JSON.parse(fs.readFileSync(path.resolve(MATERIALIZATION_RESULT), "utf8")) as Record<string, any>;
  assert.equal(materialization.status, "PASS");
  assert.equal(materialization.residual_count, 24);
  assert.equal(materialization.calibration_case_count, 16);
  assert.equal(materialization.holdout_case_count, 8);
  assert.equal(materialization.candidate_parameter_value, "0.034000");

  const recoveryPoolA = new Pool({ connectionString: DATABASE_URL, max: 4 });
  const recoveryPoolB = new Pool({ connectionString: DATABASE_URL, max: 4 });
  try {
    const factsBeforeRestart = await factCount(admin);
    const request = await loadExistingS5Request(recoveryPoolA, materialization);
    assert.equal(request.formal_run_id, materialization.formal_run_id, "S6_FORMAL_RUN_ID_DRIFT");

    const pointersBeforeLoss = await pointerSnapshot(admin, request.scope) as PointerSnapshot;
    const latestRecordSetAuthority = await findLatestRecordSetAuthority(recoveryPoolA, pointersBeforeLoss);
    await removeRecoverablePointers(admin, request.scope);
    const factsBeforePointerRecovery = await factCount(admin);
    // Projection rebuild is an explicit external-admin disaster-recovery operation because
    // the bounded CAP-08 runner intentionally has no DELETE authority on projection tables.
    const runtimeProjectionRebuild = await rebuildLatestRuntimeAuthority(admin, latestRecordSetAuthority);
    const scenarioProjectionRebuild = await rebuildScenarioAuthority(admin, pointersBeforeLoss);
    const recoveryRequest = request;
    const serviceA = new Cap08S5ResidualCalibrationShadowServiceV1(
      new PostgresCap08S5ExactSourceV1(recoveryPoolA, new PostgresFeedbackPersistenceRepositoryV1(recoveryPoolA)),
      new PostgresCalibrationGovernanceRepositoryV1(recoveryPoolA),
    );
    const serviceB = new Cap08S5ResidualCalibrationShadowServiceV1(
      new PostgresCap08S5ExactSourceV1(recoveryPoolB, new PostgresFeedbackPersistenceRepositoryV1(recoveryPoolB)),
      new PostgresCalibrationGovernanceRepositoryV1(recoveryPoolB),
    );
    const [concurrentA, concurrentB] = await Promise.all([
      serviceA.execute(recoveryRequest),
      serviceB.execute(recoveryRequest),
    ]);
    for (const value of [concurrentA, concurrentB]) {
      assert.equal(value.residual_insert_count, 0);
      assert.equal(value.candidate_append_count, 0);
      assert.equal(value.shadow_append_count, 0);
      assert.equal(value.candidate.object_id, materialization.candidate_ref);
      assert.equal(value.candidate.determinism_hash, materialization.candidate_hash);
      assert.equal(value.shadow_evaluation.object_id, materialization.shadow_ref);
      assert.equal(value.shadow_evaluation.determinism_hash, materialization.shadow_hash);
    }
    const factsAfterPointerRecovery = await factCount(admin);
    assert.equal(factsAfterPointerRecovery, factsBeforePointerRecovery, "S6_POINTER_RECOVERY_CANONICAL_WRITE");
    assert.deepEqual(await pointerSnapshot(admin, request.scope), pointersBeforeLoss, "S6_POINTER_RECOVERY_DIVERGENCE");

    const feedbackRebuild = await new Cap05RestartLateReceiptRebuildServiceV1(recoveryPoolA)
      .rebuildSupportStateFailClosed();
    assert.equal(feedbackRebuild.canonical_fact_delta, 0);
    const governanceRebuild = await new Cap06RestartReadbackRebuildServiceV1(
      new PostgresCalibrationGovernanceRepositoryV1(recoveryPoolA),
    ).recover({
      evaluationRef: materialization.shadow_ref,
      evaluationHash: materialization.shadow_hash,
      candidateRef: materialization.candidate_ref,
      candidateHash: materialization.candidate_hash,
    });
    assert.equal(governanceRebuild.canonical_fact_append_count, 0);
    assert.equal(governanceRebuild.deterministic_second_rebuild_verified, true);

    const operator = await operatorReadback(recoveryPoolA, request.scope);
    assert.equal(operator.surfaces.length, 10);
    assert.equal(operator.product_read_write_delta, 0);
    const factsAfterRestart = await factCount(admin);
    assert.equal(factsAfterRestart, factsBeforeRestart, "S6_RESTART_CANONICAL_WRITE_DELTA");

    const counts = await typeCounts(recoveryPoolA);
    assert.equal(counts.twin_runtime_config_v1, 1);
    assert.equal(counts.twin_runtime_tick_v1, 24);
    assert.equal(counts.twin_forecast_run_v1, 24);
    assert.equal(counts.twin_scenario_set_v1, 24);
    assert.equal(counts.twin_forecast_residual_v1, 24);
    assert.equal(counts.twin_calibration_candidate_v1, 1);
    assert.equal(counts.twin_shadow_evaluation_v1, 1);
    assert.equal(counts.twin_model_activation_v1 ?? 0, 0);

    const hardAcceptance = [
      ["HA01", materialization.status === "PASS"],
      ["HA02", counts.twin_runtime_config_v1 === 1],
      ["HA03", counts.twin_runtime_tick_v1 === 24],
      ["HA04", Number(counts.twin_state_estimate_v1 ?? 0) >= 25],
      ["HA05", counts.twin_forecast_run_v1 === 24],
      ["HA06", materialization.checks.length >= 6],
      ["HA07", counts.twin_scenario_set_v1 === 24],
      ["HA08", materialization.calibration_case_count === 16],
      ["HA09", materialization.holdout_case_count === 8],
      ["HA10", materialization.residual_refs.length === 24],
      ["HA11", materialization.diagnostic_only_case_count === 1],
      ["HA12", Number(counts.twin_decision_record_v1 ?? 0) === 1],
      ["HA13", Number(counts.twin_action_feedback_v1 ?? 0) === 1],
      ["HA14", Number(counts.twin_forecast_residual_v1 ?? 0) === 24],
      ["HA15", materialization.candidate_parameter_value === "0.034000"],
      ["HA16", factsAfterPointerRecovery === factsBeforePointerRecovery],
      ["HA17", materialization.residual_count === 24],
      ["HA18", (counts.twin_model_activation_v1 ?? 0) === 0],
      ["HA19", factsAfterRestart === factsBeforeRestart],
      ["HA20", pointersBeforeLoss.twin_state_latest_index_v1.length === 1],
      ["HA21", Number(counts.decision_recommendation_v1 ?? 0) === 0],
      ["HA22", concurrentA.candidate_append_count + concurrentB.candidate_append_count === 0],
      ["HA23", operator.surfaces.every((surface) => surface.status === 200)],
      ["HA24", operator.product_read_write_delta === 0],
    ].map(([item_id, passed]) => ({ item_id, status: passed ? "PASS" : "FAIL" }));
    assert.equal(hardAcceptance.length, 24);
    assert.equal(hardAcceptance.every((item) => item.status === "PASS"), true, "S6_HARD_ACCEPTANCE_FAILURE");

    const semanticProjection = {
      formal_run_id: request.formal_run_id,
      scope: request.scope,
      type_counts: counts,
      residual_refs: materialization.residual_refs,
      residual_hashes: materialization.residual_hashes,
      candidate_ref: materialization.candidate_ref,
      candidate_hash: materialization.candidate_hash,
      shadow_ref: materialization.shadow_ref,
      shadow_hash: materialization.shadow_hash,
      candidate_parameter_value: materialization.candidate_parameter_value,
      model_activation_count: 0,
    };
    const operationalProjection = {
      pointer_loss_rebuilt: true,
      runtime_projection_rebuild: runtimeProjectionRebuild,
      scenario_projection_rebuild: scenarioProjectionRebuild,
      canonical_fact_delta: 0,
      concurrent_rerun_count: 2,
      concurrent_write_count: 0,
      feedback_rebuild: feedbackRebuild.summary,
      governance_rebuild_summary_hash: governanceRebuild.first_rebuild_summary_hash,
      operator_surface_count: operator.surfaces.length,
      product_read_write_delta: 0,
    };
    const closureProjection = {
      hard_acceptance: hardAcceptance,
      operator_content_hashes: operator.surfaces.map((surface) => ({ endpoint: surface.endpoint, content_hash: surface.content_hash })),
      exact_cardinality: { bootstrap: 1, ticks: 24, forecasts: 24, scenarios: 24, residuals: 24, calibration: 16, holdout: 8, candidate: 1, shadow: 1, activation: 0 },
      no_recommendation_ao_act_dispatch: true,
    };
    const result = {
      schema_version: "geox_mcft_cap08_s6_final_run_result_v1",
      status: "PASS",
      run_label: RUN_LABEL,
      operational_instance_id: OPERATIONAL_INSTANCE_ID,
      formal_run_id: request.formal_run_id,
      scope: request.scope,
      materialization_result_ref: MATERIALIZATION_RESULT,
      facts_before_restart: factsBeforeRestart,
      facts_after_restart: factsAfterRestart,
      type_counts: counts,
      pointer_loss_rebuilt: true,
      latest_record_set_authority: latestRecordSetAuthority,
      runtime_projection_rebuild: runtimeProjectionRebuild,
      scenario_projection_rebuild: scenarioProjectionRebuild,
      feedback_rebuild: feedbackRebuild,
      governance_rebuild: governanceRebuild,
      operator_surface_count: 10,
      operator_surfaces: operator.surfaces,
      product_read_write_delta: 0,
      hard_acceptance_item_count: 24,
      hard_acceptance: hardAcceptance,
      semantic_digest: semanticHashV1(semanticProjection),
      operational_invariant_digest: semanticHashV1(operationalProjection),
      closure_digest: semanticHashV1(closureProjection),
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      recommendation_count: 0,
      ao_act_count: 0,
      dispatch_count: 0,
      production_runtime_source_authorized: false,
      mcft_cap_09_authorized: false,
    };
    write(result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([recoveryPoolA.end(), recoveryPoolB.end(), runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  write({ schema_version: "geox_mcft_cap08_s6_final_run_result_v1", status: "FAIL", run_label: RUN_LABEL, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
