// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_P0_RECONCILIATION.cjs
// Purpose: validate the MCFT-CAP-06 P0 terminal CAP-05 reconciliation and provisional CAP-06 SSOT without granting Runtime authority.
// Boundary: read-only governance validation; no database, Runtime source, migration, canonical write, route, scheduler, network, or repository mutation.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = process.env.GEOX_REPO_ROOT
  ? path.resolve(process.env.GEOX_REPO_ROOT)
  : path.resolve(__dirname, "../..");

const baseline = "79cd7814eff06ad86f86cdcb379c6f71a77f1ab8";
const postmerge = process.argv.includes("--postmerge");

const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const taskPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md";
const p1StatusPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json";
const p0StatusPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json";
const deliveryPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json";
const matrixPath = "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json";
const implementationMapPath = "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_P0_RECONCILIATION.cjs";

const task = readText(taskPath);
const p1 = readJson(p1StatusPath);
const p0 = readJson(p0StatusPath);
const delivery = readJson(deliveryPath);
const matrix = readJson(matrixPath);
const implementationMap = readText(implementationMapPath);

const results = [];
const check = (acceptanceId, condition, evidence) => {
  results.push({ acceptance_id: acceptanceId, status: condition ? "PASS" : "FAIL", evidence });
};

const cap05 = matrix.capability_lines.find((entry) => entry.capability_line_id === "MCFT-CAP-05");
const cap06 = matrix.capability_lines.find((entry) => entry.capability_line_id === "MCFT-CAP-06");

check("P0_P1_MERGED_EFFECTIVE", p0.p_minus_1_effectiveness.effective === true
  && p0.p_minus_1_effectiveness.implementation_pr_number === 2496
  && p0.p_minus_1_effectiveness.implementation_merge_commit === baseline
  && p0.p_minus_1_effectiveness.postmerge_probe_pr_number === 2497
  && p0.p_minus_1_effectiveness.postmerge_workflow_run === 29418272690
  && p0.p_minus_1_effectiveness.postmerge_probe_closed_without_merge === true, p0StatusPath);

check("P0_ADJUDICATION_OUTCOME", p1.outcome === "REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED"
  && p0.adjudication_outcome.outcome === p1.outcome
  && p0.adjudication_outcome.dt02_architecture_amendment_required === false
  && p0.adjudication_outcome.conditional_s4_required === false, `${p1StatusPath}; ${p0StatusPath}`);

check("P0_CAP05_TERMINAL", p0.cap_05_terminal_reconciliation.status === "COMPLETE"
  && p0.cap_05_terminal_reconciliation.closure_effective === true
  && p0.cap_05_terminal_reconciliation.capability_complete === true
  && p0.cap_05_terminal_reconciliation.active_delivery_slice_id === null
  && p0.cap_05_terminal_reconciliation.next_repository_action === null
  && p0.cap_05_terminal_reconciliation.reopened === false, p0StatusPath);

check("P0_CAP06_UNAUTHORIZED", p0.cap_06_provisional_state.authorization_effective === false
  && p0.cap_06_provisional_state.runtime_source_authorized === false
  && p0.cap_06_provisional_state.active_delivery_slice_id === null
  && p0.p0_authority.migration_authorized === false
  && p0.p0_authority.canonical_write_authorized === false
  && p0.p0_authority.s0_execution_authorized_before_p0_effectiveness === false, p0StatusPath);

check("P0_MATRIX_BASELINE", matrix.baseline.branch === "main"
  && matrix.baseline.commit === baseline
  && matrix.baseline.meaning.includes("MCFT-CAP-05 COMPLETE")
  && matrix.baseline.meaning.includes("MCFT-CAP-06 P-1 merged-main effective")
  && matrix.baseline.meaning.includes("P0 provisional SSOT candidate"), matrixPath);

check("P0_MATRIX_CAP05", cap05
  && cap05.status === "COMPLETE"
  && cap05.implementation_status === "COMPLETE"
  && cap05.closure_effective === true
  && cap05.capability_complete === true
  && cap05.active_delivery_slice_id === null
  && cap05.next_repository_action === null
  && cap05.successor_capability_line_id === "MCFT-CAP-06"
  && cap05.successor_authorized === false, matrixPath);

check("P0_MATRIX_CAP06", cap06
  && cap06.status === "NOT_AUTHORIZED"
  && cap06.design_status === "CONDITIONAL_FROZEN_AFTER_P_MINUS_1"
  && cap06.implementation_status === "P_MINUS_1_COMPLETE"
  && cap06.authorization_effective === false
  && cap06.runtime_source_authorized === false
  && cap06.active_delivery_slice_id === null
  && cap06.predecessor_capability_line_id === "MCFT-CAP-05"
  && cap06.successor_capability_line_id === "MCFT-CAP-07"
  && cap06.successor_authorized === false
  && cap06.p_minus_1?.status === "MERGED_EFFECTIVE"
  && cap06.p0?.status === "CANDIDATE", matrixPath);

check("P0_IMPLEMENTATION_MAP", implementationMap.includes("MCFT-CAP-06-P0-CURRENT-STATE-BEGIN")
  && implementationMap.includes("P-1 status:\nMERGED_EFFECTIVE")
  && implementationMap.includes("P0 status:\nPROVISIONAL_SSOT_CANDIDATE")
  && implementationMap.includes("runtime source authorized:\nfalse")
  && implementationMap.includes("S0 status:\nBLOCKED_PENDING_P0_MERGED_MAIN_EFFECTIVENESS")
  && implementationMap.includes("MCFT-CAP-06-P0-CURRENT-STATE-END"), implementationMapPath);

check("P0_TASK_CURRENT_STATE", task.includes("design_status:\nCONDITIONAL_FROZEN_AFTER_P_MINUS_1")
  && task.includes("implementation_status:\nP_MINUS_1_COMPLETE")
  && task.includes("dt02_architecture_amendment_status:\nNOT_REQUIRED")
  && task.includes("first_permitted_repository_action:\nnull")
  && task.includes("P-1 outcome:\nREUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED")
  && task.includes("P0 status:\nPROVISIONAL_SSOT_CANDIDATE")
  && !task.includes("implementation_status:\nP_MINUS_1_READY"), taskPath);

check("P0_DELIVERY_STATUS", delivery.status === "NOT_AUTHORIZED"
  && delivery.design_status === "CONDITIONAL_FROZEN_AFTER_P_MINUS_1"
  && delivery.implementation_status === "P_MINUS_1_COMPLETE"
  && delivery.authorization_effective === false
  && delivery.runtime_source_authorized === false
  && delivery.active_delivery_slice_id === null
  && delivery.completed_or_effective_slices.some((entry) => entry.delivery_slice_id.includes("P-1") && entry.status === "MERGED_EFFECTIVE")
  && delivery.candidate_slices.some((entry) => entry.delivery_slice_id.includes("P0") && entry.status === "CANDIDATE")
  && delivery.next_repository_action === null, deliveryPath);

check("P0_EFFECTIVENESS_NOT_SELF_CLAIMED", p0.effectiveness.effective === false
  && p0.effectiveness.condition === "P0_PR_MERGED_AND_HEAD_TO_MERGE_TREE_EQUIVALENT_AND_MERGED_MAIN_P0_GATE_PASS"
  && p0.effectiveness.next_repository_action_after_effectiveness === "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1", p0StatusPath);

const expectedFiles = [
  implementationMapPath,
  matrixPath,
  deliveryPath,
  p0StatusPath,
  taskPath,
  gatePath,
].sort();

let changedFiles = [];
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", `${baseline}..HEAD`], { cwd: repoRoot, encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
} catch (error) {
  changedFiles = [];
}

check("P0_EXACT_FILE_BOUNDARY", JSON.stringify(changedFiles) === JSON.stringify(expectedFiles), `git diff ${baseline}..HEAD`);
check("P0_NO_RUNTIME_CHANGE", changedFiles.every((file) => !file.startsWith("apps/server/src/")
  && !file.startsWith("apps/server/db/migrations/")
  && !file.startsWith("apps/web/")
  && !file.startsWith("fixtures/")), "changed file boundary");

if (postmerge) {
  check("P0_POSTMERGE_MODE", process.env.GITHUB_ACTIONS === "true" || process.env.GEOX_ALLOW_LOCAL_POSTMERGE === "1", "--postmerge execution context");
}

const failures = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  process.stdout.write(`${result.status} ${result.acceptance_id} ${result.evidence}\n`);
}
process.stdout.write(`TOTAL ${results.length} PASS ${results.length - failures.length} FAIL ${failures.length}\n`);
if (failures.length > 0) process.exitCode = 1;
