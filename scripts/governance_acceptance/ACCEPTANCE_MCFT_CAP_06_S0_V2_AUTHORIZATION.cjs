// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_AUTHORIZATION.cjs
// Purpose: fail closed unless the MCFT-CAP-06 S0 v2 candidate preserves the exact merged-main predecessor, formal PostgreSQL proof, complete dual-Config case qualification, current-state frontier and zero Runtime/canonical-write authority boundary.

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE = "ca819ba51bdf3017dbefa96015f76bd3b66a647c";
const PROOF_COMMIT = "d3c5341707b35982df84ce63e8aef310ce304b31";
const PROOF_RUN = 29469336992;
const S0 = "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1";
const S1 = "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1";

const PATHS = Object.freeze({
  core: "apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v2.ts",
  reader: "apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v2.ts",
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  qualification: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json",
  delivery: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
  lock: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json",
  authorizationStatus: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-AUTHORIZATION-STATUS.json",
  authorization: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-AUTHORIZATION.md",
  status: "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S0-V2-STATUS.json",
  pureAcceptance: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CASE_GRAPH_QUALIFICATION_V4.ts",
  postgresOrchestrator: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_POSTGRESQL.ts",
  postgresQualifier: "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB_V2.ts",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_AUTHORIZATION.cjs",
});

const EXACT_CHANGED_FILES = Object.freeze(Object.values(PATHS).sort());
const FORBIDDEN_TEMPORARY_PATHS = Object.freeze([
  ".github/workflows/mcft-cap-06-s0-v2-materialize.yml",
  ".github/workflows/mcft-cap-06-s0-v2-postgresql-proof.yml",
  "scripts/governance_acceptance/.MATERIALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.cjs",
  "apps/server/src/domain/twin_runtime/calibration_case_graph_qualification_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_cap06_repository_history_case_graph_reader_v1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CASE_GRAPH_QUALIFICATION_V2.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_CASE_GRAPH_QUALIFICATION_V3.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB.ts",
]);

let pass = 0;
function ok(message) {
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}
function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}
function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), "utf8");
}
function json(relativePath) {
  return JSON.parse(read(relativePath));
}
function git(args) {
  const executable = process.platform === "win32" ? "git.exe" : "git";
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`GIT_FAILED:${args.join(" ")}\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
  return String(result.stdout || "").trim();
}
function exactlyOne(values, predicate, code) {
  const matches = values.filter(predicate);
  assert.equal(matches.length, 1, `${code}:${matches.length}`);
  return matches[0];
}

function run() {
  git(["merge-base", "--is-ancestor", BASELINE, "HEAD"]);
  const changed = git(["diff", "--name-only", `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, EXACT_CHANGED_FILES, "CAP06_S0_V2_EXACT_CHANGED_FILE_BOUNDARY");
  ok("candidate descends from the exact effective main baseline and has the exact 14-file boundary");

  for (const relativePath of FORBIDDEN_TEMPORARY_PATHS) {
    assert.equal(fs.existsSync(absolute(relativePath)), false, `CAP06_S0_V2_TEMPORARY_PATH_RETAINED:${relativePath}`);
  }
  ok("temporary proof, materialization and superseded single-Config sources are absent");

  const lock = json(PATHS.lock);
  assert.equal(lock.status, "READY_FOR_MERGE_CANDIDATE");
  assert.equal(lock.baseline_main_commit, BASELINE);
  assert.equal(lock.formal_proof.proof_commit, PROOF_COMMIT);
  assert.equal(lock.formal_proof.workflow_run, PROOF_RUN);
  assert.equal(lock.formal_proof.result, "PASS");
  assert.equal(lock.predecessor.checkpoint_sequence, 80);
  assert.equal(lock.predecessor.reproduced_canonical_state_fact_count, 33);
  assert.equal(lock.predecessor.next_tick_logical_time, "2026-06-04T10:00:00.000Z");
  assert.equal(lock.source_evidence_resolution.public_facts_mutated, false);
  assert.equal(lock.source_evidence_resolution.temporary_projection_persisted, false);
  ok("predecessor lock is exact checkpoint 80 with 33 State facts and zero public-facts mutation");

  assert.notEqual(
    lock.eligible_case_graph.forecast_runtime_config_ref,
    lock.eligible_case_graph.residual_runtime_config_ref,
  );
  assert.equal(lock.config_authority_semantics.config_refs_required_equal, false);
  assert.equal(lock.config_authority_semantics.each_ref_hash_graph_required_exact, true);
  assert.equal(lock.config_authority_semantics.validator_weakening, false);
  ok("Forecast-time and Residual-time Config identities remain distinct and independently exact");

  const qualification = json(PATHS.qualification);
  assert.equal(qualification.case_graph_validation_status, "PASS");
  assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.equal(qualification.eligible_residual_count, 1);
  assert.equal(qualification.excluded_cases.length, 0);
  assert.equal(qualification.required_matched_pair_count, 24);
  assert.equal(qualification.eligible_calibration_count, 0);
  assert.equal(qualification.eligible_holdout_count, 0);
  assert.deepEqual(
    Object.values(qualification.homogeneity_cardinality).filter((value) => typeof value === "number"),
    [1, 1, 1, 1, 1, 1],
  );
  assert.equal(qualification.homogeneity_cardinality.status, "PASS");
  ok("dataset qualification records one eligible exact case, no excluded case and six homogeneous authorities");

  const authorizationStatus = json(PATHS.authorizationStatus);
  assert.equal(authorizationStatus.status, "READY_FOR_MERGE_CANDIDATE");
  assert.equal(authorizationStatus.authorization_effective, false);
  assert.equal(authorizationStatus.runtime_source_authorized, false);
  assert.equal(authorizationStatus.migration_authorized, false);
  assert.equal(authorizationStatus.canonical_write_authorized, false);
  assert.equal(authorizationStatus.active_delivery_slice_id, null);
  assert.deepEqual(authorizationStatus.next_authorized_slice_ids, []);
  assert.equal(authorizationStatus.next_authorized_slice_id_after_effectiveness, S1);
  assert.equal(authorizationStatus.effectiveness_condition_satisfied, false);
  assert.equal(authorizationStatus.capability_complete, false);
  assert.equal(authorizationStatus.successor_authorized, false);
  ok("candidate authorization remains ineffective and grants no Runtime, migration, write or successor authority");

  const status = json(PATHS.status);
  assert.equal(status.implementation_generation, "S0_V2");
  assert.equal(status.implementation_status, "S0_V2_CANDIDATE");
  assert.equal(status.formal_proof.workflow_run, PROOF_RUN);
  assert.equal(status.repository_history_result.case_graph_validation_status, "PASS");
  assert.equal(status.repository_history_result.eligible_residual_count, 1);
  assert.equal(status.repository_history_result.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.deepEqual(status.next_authorized_slice_ids, []);
  assert.equal(status.next_authorized_slice_id_after_effectiveness, S1);
  ok("S0 v2 status is a proven but non-effective candidate with only S1 eligible after effectiveness");

  const delivery = json(PATHS.delivery);
  assert.equal(delivery.status, "READY_FOR_MERGE_CANDIDATE");
  assert.equal(delivery.implementation_status, "S0_V2_CANDIDATE");
  assert.equal(delivery.authorization_effective, false);
  assert.equal(delivery.runtime_source_authorized, false);
  assert.equal(delivery.active_delivery_slice_id, null);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.deepEqual(delivery.next_authorized_slice_ids, []);
  assert.equal(delivery.next_authorized_slice_id_after_s0_effectiveness, S1);
  const deliveryCandidate = exactlyOne(
    delivery.candidate_slices,
    (entry) => entry.delivery_slice_id === S0,
    "CAP06_S0_DELIVERY_CANDIDATE_CARDINALITY",
  );
  assert.equal(deliveryCandidate.proof_workflow_run, PROOF_RUN);
  assert.equal(deliveryCandidate.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  ok("delivery frontier contains exactly one non-effective S0 v2 candidate and no active slice");

  const matrix = json(PATHS.matrix);
  assert.equal(matrix.baseline.commit, BASELINE);
  const cap06 = exactlyOne(
    matrix.capability_lines,
    (entry) => entry.capability_line_id === "MCFT-CAP-06",
    "CAP06_MATRIX_ENTRY_CARDINALITY",
  );
  assert.equal(cap06.status, "READY_FOR_MERGE_CANDIDATE");
  assert.equal(cap06.implementation_status, "S0_V2_CANDIDATE");
  assert.equal(cap06.authorization_effective, false);
  assert.equal(cap06.runtime_source_authorized, false);
  assert.equal(cap06.s0.proof_workflow_run, PROOF_RUN);
  assert.equal(cap06.s0.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS");
  assert.deepEqual(cap06.s0.next_authorized_slice_ids, []);
  ok("capability matrix frontier matches the S0 v2 candidate without overstating authority");

  const map = read(PATHS.map);
  assert.equal((map.match(/<!-- MCFT-CAP-06-S0-V2-CURRENT-STATE-BEGIN -->/g) || []).length, 1);
  assert.equal((map.match(/<!-- MCFT-CAP-06-S0-V2-CURRENT-STATE-END -->/g) || []).length, 1);
  for (const token of [
    "S0 status: READY_FOR_MERGE_CANDIDATE",
    "case graph validation: PASS",
    "eligible canonical Residuals: 1",
    "dataset qualification: INSUFFICIENT_MATCHED_PAIRS",
    "runtime source authorized: false",
    "Calibration Candidate implemented: false",
    "Shadow Evaluation implemented: false",
    "capability complete: false",
  ]) assert.ok(map.includes(token), `CAP06_MAP_TOKEN_REQUIRED:${token}`);
  ok("implementation map contains one exact S0 v2 candidate frontier and explicit nonclaims");

  const core = read(PATHS.core);
  assert.ok(core.includes('import { semanticHashV1 } from "./canonical_identity_v1.js";'));
  assert.equal(core.includes("JSON.stringify(value, Object.keys"), false);
  assert.ok(core.includes("forecast_runtime_config"));
  assert.ok(core.includes("residual_runtime_config"));
  assert.ok(core.includes("eligible_cases"));
  assert.ok(core.includes("excluded_cases"));
  assert.ok(core.includes("DUPLICATE_FORECAST_TARGET_TIME"));
  assert.ok(core.includes("CAP06_CALIBRATION_CASE_COUNT_V2 = 16"));
  assert.ok(core.includes("CAP06_HOLDOUT_CASE_COUNT_V2 = 8"));
  ok("qualification core uses recursive canonical hashing, dual Configs, explicit exclusions and the frozen 16/8 split");

  const reader = read(PATHS.reader);
  assert.ok(reader.includes("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"));
  assert.ok(reader.includes("forecastConfig"));
  assert.ok(reader.includes("residualConfig"));
  assert.ok(reader.includes("base_continuation_window"));
  assert.ok(reader.includes("deriveCap04ForcingCycleKeyV1"));
  assert.ok(reader.includes("CAP06_RESIDUAL_OBSERVATION_GRAPH_MISMATCH"));
  assert.equal(reader.includes("INSERT INTO facts"), false);
  ok("PostgreSQL reader closes canonical, nested Evidence, forcing and Observation graphs in a read-only snapshot");

  const pureAcceptance = read(PATHS.pureAcceptance);
  assert.ok(pureAcceptance.includes("assert.equal(pass, 11)"));
  assert.ok(pureAcceptance.includes("distinct Forecast-time and Residual-time Config identities are legal"));
  assert.ok(pureAcceptance.includes("duplicate target times are removed from eligibility and fail closed"));
  const orchestrator = read(PATHS.postgresOrchestrator);
  assert.ok(orchestrator.includes("SUMMARY 7 PASS \\/ 0 FAIL"));
  assert.ok(orchestrator.includes("SUMMARY 6 PASS \\/ 0 FAIL"));
  assert.ok(orchestrator.includes("finally"));
  const qualifier = read(PATHS.postgresQualifier);
  assert.ok(qualifier.includes("CREATE TEMP VIEW facts AS"));
  assert.ok(qualifier.includes("SELECT * FROM public.facts"));
  assert.ok(qualifier.includes("CAP06_PUBLIC_FACTS_MUTATED"));
  assert.ok(qualifier.includes("assert.equal(pass, 6)"));
  ok("permanent pure and PostgreSQL acceptance prove exact semantics and mandatory cleanup");

  const authorizationDocument = read(PATHS.authorization);
  for (const token of [
    "authorization_effective:\nfalse",
    "runtime_source_authorized:\nfalse",
    "INSUFFICIENT_MATCHED_PAIRS",
    "No legal excluded case exists",
    S1,
    "It does not authorize Calibration Candidate, Shadow Evaluation or Model Activation.",
  ]) assert.ok(authorizationDocument.includes(token), `CAP06_AUTHORIZATION_TOKEN_REQUIRED:${token}`);
  ok("human-readable authorization record matches the machine-readable candidate and successor boundary");

  assert.equal(pass, 14);
  process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
}

run();
