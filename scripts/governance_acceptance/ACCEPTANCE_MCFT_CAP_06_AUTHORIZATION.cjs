// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs
// Purpose: validate the MCFT-CAP-06 S0 authorization candidate, CAP-05 PostgreSQL predecessor lock, and structural repository-history qualification without self-claiming merged-main effectiveness.
// Boundary: read-only governance validation; no database mutation, Runtime source, migration, canonical Candidate/Evaluation write, Model Activation, route, scheduler, network, or repository mutation.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = process.env.GEOX_REPO_ROOT
  ? path.resolve(process.env.GEOX_REPO_ROOT)
  : path.resolve(__dirname, "../..");
const baseline = "a7bb8d9499560b0ef0244a1a6daeaee1eeb408bf";
const postmerge = process.argv.includes("--postmerge");

const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const mapPath = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md";
const matrixPath = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json";
const taskPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md";
const p0StatusPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json";
const authorizationPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md";
const authorizationStatusPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json";
const lockPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json";
const qualificationPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json";
const deliveryPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs";
const preflightPath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_PREDECESSOR_PREFLIGHT.ts";

const implementationMap = readText(mapPath);
const matrix = readJson(matrixPath);
const task = readText(taskPath);
const p0 = readJson(p0StatusPath);
const authorization = readText(authorizationPath);
const authorizationStatus = readJson(authorizationStatusPath);
const lock = readJson(lockPath);
const qualification = readJson(qualificationPath);
const delivery = readJson(deliveryPath);
const cap05 = matrix.capability_lines.find((entry) => entry.capability_line_id === "MCFT-CAP-05");
const cap06 = matrix.capability_lines.find((entry) => entry.capability_line_id === "MCFT-CAP-06");

const results = [];
const check = (acceptanceId, condition, evidence) => {
  results.push({ acceptance_id: acceptanceId, status: condition === true ? "PASS" : "FAIL", evidence });
};

check("S0_P0_MERGED_EFFECTIVE", p0.status === "MERGED_EFFECTIVE"
  && p0.effectiveness.effective === true
  && p0.effectiveness.implementation_pr_number === 2498
  && p0.effectiveness.exact_head_commit === "13957179a9547995e0a1443ba400d07c830579fc"
  && p0.effectiveness.merge_commit === baseline
  && p0.effectiveness.postmerge_probe_pr_number === 2499
  && p0.effectiveness.postmerge_workflow_run === 29419841209
  && p0.effectiveness.postmerge_gate === "PASS", p0StatusPath);

check("S0_CAP05_TERMINAL_GOVERNANCE", cap05
  && cap05.status === "COMPLETE"
  && cap05.implementation_status === "COMPLETE"
  && cap05.closure_effective === true
  && cap05.capability_complete === true
  && cap05.active_delivery_slice_id === null
  && cap05.next_repository_action === null, matrixPath);

check("S0_POSTGRESQL_IDENTITY", lock.status === "COMPLETE"
  && lock.identity_extraction_source === "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH"
  && lock.expected_checkpoint.checkpoint_sequence === 80
  && lock.expected_checkpoint.global_state_count === 81
  && lock.expected_checkpoint.last_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.expected_checkpoint.next_tick_logical_time === "2026-06-04T10:00:00.000Z"
  && lock.canonical_identity.checkpoint_sequence === 80
  && lock.canonical_identity.global_state_count === 81
  && lock.canonical_identity.latest_logical_time === "2026-06-04T09:00:00.000Z"
  && lock.canonical_identity.next_tick_logical_time === "2026-06-04T10:00:00.000Z", lockPath);

check("S0_CONFIG_AUTHORITY", lock.canonical_identity.config_authority_mode === "EXPLICIT_REPLAY_PIN"
  && lock.canonical_identity.state_bound_runtime_config_ref
  && lock.canonical_identity.state_bound_runtime_config_hash
  && lock.canonical_identity.active_binding_status === "NOT_ESTABLISHED"
  && lock.canonical_identity.active_binding_ref === null
  && lock.canonical_identity.active_binding_hash === null, lockPath);

check("S0_STRUCTURAL_QUALIFICATION", qualification.qualification_track === "REPOSITORY_HISTORY_QUALIFICATION_TRACK"
  && qualification.extraction_source === "ISOLATED_POSTGRESQL_CANONICAL_READ_PATH"
  && qualification.dataset_qualification_status === "INSUFFICIENT_MATCHED_PAIRS"
  && qualification.case_graph_validation_status === "PASS"
  && qualification.eligible_forecast_count === 1
  && qualification.eligible_observation_count === 1
  && qualification.eligible_matched_pair_count === 1
  && qualification.eligible_residual_count === 1
  && qualification.eligible_calibration_count === 0
  && qualification.eligible_holdout_count === 0
  && qualification.calibration_window_refs.length === 0
  && qualification.holdout_window_refs.length === 0, qualificationPath);

check("S0_NO_PARAMETER_ANALYSIS", qualification.sensitive_case_count === null
  && qualification.excited_case_count === null
  && qualification.objective_surface_status === null
  && qualification.selected_parameter === null, qualificationPath);

check("S0_AUTHORIZATION_CANDIDATE", authorizationStatus.status === "READY_FOR_MERGE"
  && authorizationStatus.implementation_status === "S0_CANDIDATE"
  && authorizationStatus.authorization_effective === false
  && authorizationStatus.runtime_source_authorized === false
  && authorizationStatus.active_delivery_slice_id === null
  && authorizationStatus.dataset_qualification_status === "INSUFFICIENT_MATCHED_PAIRS"
  && authorizationStatus.next_authorized_slice_id_after_effectiveness === "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1"
  && authorizationStatus.successor_authorized === false, authorizationStatusPath);

check("S0_AUTHORIZATION_DOCUMENT", authorization.includes("S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS")
  && authorization.includes("checkpoint_sequence: 80")
  && authorization.includes("global_state_count: 81")
  && authorization.includes("status: INSUFFICIENT_MATCHED_PAIRS")
  && authorization.includes("runtime_source_authorized:\nfalse"), authorizationPath);

check("S0_DELIVERY_STATE", delivery.status === "S0_READY_FOR_MERGE"
  && delivery.implementation_status === "S0_CANDIDATE"
  && delivery.authorization_effective === false
  && delivery.runtime_source_authorized === false
  && delivery.active_delivery_slice_id === null
  && delivery.candidate_slices.some((entry) => entry.delivery_slice_id === "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1" && entry.status === "READY_FOR_MERGE")
  && delivery.next_authorized_slice_ids.length === 0
  && delivery.next_authorized_slice_id_after_merge_and_postmerge_gate === "MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1", deliveryPath);

check("S0_MATRIX_STATE", cap06
  && cap06.status === "NOT_AUTHORIZED"
  && cap06.implementation_status === "S0_CANDIDATE"
  && cap06.authorization_status === "READY_FOR_MERGE"
  && cap06.authorization_effective === false
  && cap06.runtime_source_authorized === false
  && cap06.active_delivery_slice_id === null
  && cap06.dataset_qualification_status === "INSUFFICIENT_MATCHED_PAIRS"
  && cap06.next_delivery_slice_authorized === false
  && cap06.successor_authorized === false, matrixPath);

check("S0_TASK_STATE", task.includes("implementation_status:\nS0_CANDIDATE")
  && task.includes("first_permitted_repository_action:\nMCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1")
  && task.includes("S0 status:\nREADY_FOR_MERGE")
  && task.includes("dataset qualification status:\nINSUFFICIENT_MATCHED_PAIRS")
  && task.includes("S1 authorized:\nfalse"), taskPath);

check("S0_IMPLEMENTATION_MAP", implementationMap.includes("MCFT-CAP-06-S0-CURRENT-STATE-BEGIN")
  && implementationMap.includes("S0 status: READY_FOR_MERGE")
  && implementationMap.includes("checkpoint sequence: 80")
  && implementationMap.includes("global State count: 81")
  && implementationMap.includes("dataset qualification: INSUFFICIENT_MATCHED_PAIRS")
  && implementationMap.includes("runtime source authorized: false"), mapPath);

check("S0_NO_RUNTIME_AUTHORITY", authorizationStatus.preserved_nonclaims.includes("NO_CALIBRATION_CANDIDATE")
  && authorizationStatus.preserved_nonclaims.includes("NO_SHADOW_EVALUATION")
  && authorizationStatus.preserved_nonclaims.includes("NO_MODEL_ACTIVATION")
  && authorizationStatus.preserved_nonclaims.includes("NO_ACTIVE_CONFIG_INDEX_CREATION")
  && authorizationStatus.preserved_nonclaims.includes("NO_MCFT_CAP_07_AUTHORIZATION"), authorizationStatusPath);

const expectedFiles = [
  mapPath,
  matrixPath,
  taskPath,
  p0StatusPath,
  authorizationPath,
  authorizationStatusPath,
  lockPath,
  qualificationPath,
  deliveryPath,
  gatePath,
  preflightPath,
].sort();

let changedFiles = [];
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", `${baseline}..HEAD`], { cwd: repoRoot, encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
} catch {
  changedFiles = [];
}

check("S0_EXACT_FILE_BOUNDARY", JSON.stringify(changedFiles) === JSON.stringify(expectedFiles), `git diff ${baseline}..HEAD`);
check("S0_NO_RUNTIME_CHANGE", changedFiles.every((file) => !file.startsWith("apps/server/src/")
  && !file.startsWith("apps/server/db/migrations/")
  && !file.startsWith("apps/web/")
  && !file.startsWith("fixtures/")), "changed file boundary");

if (postmerge) {
  check("S0_POSTMERGE_MODE", process.env.GITHUB_ACTIONS === "true" || process.env.GEOX_ALLOW_LOCAL_POSTMERGE === "1", "--postmerge execution context");
}

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  process.stdout.write(`${result.status} ${result.acceptance_id} ${result.evidence}\n`);
}
process.stdout.write(`TOTAL ${results.length} PASS ${results.length - failures.length} FAIL ${failures.length}\n`);
if (failures.length > 0) process.exitCode = 1;
