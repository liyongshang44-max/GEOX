// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts
// Purpose: prove one formal CAP-05 runner Residual is consumed through the positive execution projection, exact-ref PostgreSQL root lookup, one-snapshot canonical graph assembler, and CAP-06 case-source contract with zero writes.
// Boundary: destructive isolated-database read acceptance only; no production database, Candidate/Evaluation append, calibration/shadow execution, projection mutation, State/checkpoint mutation, active-config mutation, Model Activation, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import { Pool } from "pg";
import {
  validateCap05RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  Cap05InheritedCap04ExecutionConfigResolverV1,
} from "../../apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.js";
import {
  PostgresExactCalibrationResidualRepositoryV1,
} from "../../apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.js";
import {
  PostgresResolvedForecastObservationCaseAssemblerV1,
} from "../../apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";

if (process.env.MCFT_CAP_06_S4_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S4_DESTRUCTIVE_ACCEPTANCE_1");
}
const handoffPath = process.env.MCFT_CAP_06_S4_CAP05_HANDOFF_PATH;
if (!handoffPath) throw new Error("MCFT_CAP_06_S4_CAP05_HANDOFF_PATH_REQUIRED");
const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8")) as {
  database_url: string;
  database_name: string;
  residual_refs: string[];
  residual_hashes: string[];
  formal_runner_status: string;
  zero_write_replay_status: string;
};
if (!/(mcft|cap05|cap06|acceptance|test)/i.test(handoff.database_name)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}
assert.equal(handoff.formal_runner_status, "PASS");
assert.equal(handoff.zero_write_replay_status, "PASS");
assert.equal(handoff.residual_refs.length, 1);
assert.equal(handoff.residual_hashes.length, 1);

const pool = new Pool({ connectionString: handoff.database_url });
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

async function snapshotV1(): Promise<Record<string, number>> {
  const result = await pool.query(
    `SELECT record_json->>'type' AS object_type,count(*)::int AS count
       FROM facts
      GROUP BY record_json->>'type'
      ORDER BY record_json->>'type'`,
  );
  return Object.fromEntries(result.rows.map((row) => [String(row.object_type), Number(row.count)]));
}

async function main(): Promise<void> {
  const before = await snapshotV1();
  const executionResolver = new Cap05InheritedCap04ExecutionConfigResolverV1();
  const graphAssembler = new PostgresResolvedForecastObservationCaseAssemblerV1(
    pool,
    executionResolver,
  );
  const repository = new PostgresExactCalibrationResidualRepositoryV1(
    pool,
    graphAssembler,
  );

  assert.deepEqual(
    Object.getOwnPropertyNames(Object.getPrototypeOf(repository)).sort(),
    ["constructor", "loadExactCalibrationResiduals"],
  );
  assert.deepEqual(
    Object.getOwnPropertyNames(Object.getPrototypeOf(graphAssembler)).sort(),
    [
      "constructor",
      "resolveCaseWithClientV1",
      "resolveExactResidualCase",
      "resolveExactResidualCases",
      "resolveExactResidualGraph",
      "resolveExactResidualGraphs",
      "resolveExactResidualRefs",
      "resolveWithClientV1",
    ],
  );
  for (const forbidden of [
    "listResiduals",
    "searchResiduals",
    "latestResiduals",
    "loadResidualsAfter",
    "queryByTimeRange",
    "queryByScopeRange",
  ]) {
    assert.equal(forbidden in repository, false);
    assert.equal(forbidden in graphAssembler, false);
  }
  ok("repository and graph assembler expose exact-ref consumption surfaces only");

  const loaded = await repository.loadExactCalibrationResiduals(handoff.residual_refs);
  assert.equal(loaded.length, 1);
  const caseSource = loaded[0];
  assert.equal(caseSource.case_index, 0);
  assert.equal(caseSource.residual_ref, handoff.residual_refs[0]);
  assert.equal(caseSource.residual_hash, handoff.residual_hashes[0]);
  assert.equal(caseSource.forecast_target_time, caseSource.observation_observed_at);
  assert.ok(Date.parse(caseSource.forecast_issued_at) < Date.parse(caseSource.observation_available_to_runtime_at));
  assert.ok(Date.parse(caseSource.forecast_as_of) < Date.parse(caseSource.observation_available_to_runtime_at));
  assert.ok(Date.parse(caseSource.forecast_evidence_cutoff) <= Date.parse(caseSource.forecast_as_of));
  assert.match(caseSource.case_input_hash, /^sha256:/);
  assert.match(caseSource.model_component_hash, /^sha256:/);
  assert.match(caseSource.effective_parameter_bundle_hash, /^sha256:/);
  assert.match(caseSource.observation_operator_hash, /^sha256:/);
  assert.match(caseSource.geometry_hash, /^sha256:/);
  assert.match(caseSource.runtime_replay_numeric_policy_hash, /^sha256:/);
  assert.ok(Number(caseSource.saturation_minus_field_capacity_mm) > 0);
  assert.ok(Number(caseSource.excess_above_field_capacity_mm) > 0);
  ok("formal CAP-05 Residual resolves to one complete CAP-06 case source with dual-time and graph hashes");

  const configResult = await pool.query(
    `SELECT record_json->'payload' AS object
       FROM facts
      WHERE record_json->>'type'='twin_runtime_config_v1'
        AND record_json->'payload'->>'object_id'=$1`,
    [caseSource.source_runtime_config_ref],
  );
  assert.equal(configResult.rows.length, 1);
  const canonicalConfig = configResult.rows[0].object;
  validateCap05RuntimeConfigPayloadV1(canonicalConfig.payload);
  const resolvedConfig = executionResolver.resolveExecutionConfig(canonicalConfig);
  assert.equal(resolvedConfig.source_config_ref, canonicalConfig.object_id);
  assert.equal(resolvedConfig.source_config_hash, canonicalConfig.determinism_hash);
  assert.equal(resolvedConfig.payload.config_purpose, CAP04_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal("object_id" in resolvedConfig, false);
  assert.equal("determinism_hash" in resolvedConfig, false);
  ok("formal canonical CAP-05 Config is consumed through one non-canonical positive CAP-04 execution view");

  await assert.rejects(
    repository.loadExactCalibrationResiduals(["missing_cap06_s4_residual_ref"]),
    /CAP06_POSTGRES_EXACT_RESIDUAL_MISSING/,
  );
  await assert.rejects(
    repository.loadExactCalibrationResiduals([
      handoff.residual_refs[0],
      handoff.residual_refs[0],
    ]),
    /CAP06_POSTGRES_EXACT_RESIDUAL_REFS_DUPLICATE/,
  );
  ok("missing and duplicate exact Residual roots fail closed without fallback search");

  const observationWindowOwner = await pool.query(
    `SELECT ew.fact_id
       FROM facts residual
       JOIN facts assimilation
         ON assimilation.record_json->'payload'->>'object_id'=
            residual.record_json->'payload'->'payload'->>'assimilation_update_ref'
       JOIN facts posterior
         ON posterior.record_json->'payload'->>'object_id'=
            assimilation.record_json->'payload'->'payload'->>'posterior_state_ref'
       JOIN facts ew
         ON ew.record_json->'payload'->>'object_id'=
            posterior.record_json->'payload'->'payload'->>'evidence_window_ref'
      WHERE residual.record_json->>'type'='twin_forecast_residual_v1'
        AND residual.record_json->'payload'->>'object_id'=$1`,
    [caseSource.residual_ref],
  );
  assert.equal(observationWindowOwner.rows.length, 1);
  const duplicateEvidenceWindow = await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     SELECT fact_id||'_s4_duplicate',occurred_at,'mcft_cap06_s4_duplicate_evidence_window',record_json
       FROM facts
      WHERE fact_id=$1
     RETURNING fact_id`,
    [observationWindowOwner.rows[0].fact_id],
  );
  assert.equal(duplicateEvidenceWindow.rows.length, 1);
  await assert.rejects(
    repository.loadExactCalibrationResiduals(handoff.residual_refs),
    /CAP06_GRAPH_OBSERVATION_EVIDENCE_WINDOW_CARDINALITY:2/,
  );
  await pool.query("DELETE FROM facts WHERE fact_id=$1", [duplicateEvidenceWindow.rows[0].fact_id]);
  ok("canonical observation Evidence Window identity divergence fails closed under exact graph assembly");

  const after = await snapshotV1();
  assert.deepEqual(after, before);
  assert.equal(after.twin_calibration_candidate_v1 ?? 0, 0);
  assert.equal(after.twin_shadow_evaluation_v1 ?? 0, 0);
  assert.equal(after.twin_model_activation_v1 ?? 0, 0);
  ok("formal predecessor consumption and failure probes leave canonical history unchanged");

  console.log(`PASS_COUNT=${pass}`);
  console.log("MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB:PASS");
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
