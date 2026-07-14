// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs
// Purpose: verify MCFT-CAP-05 P0 current-SSOT settlement without rewriting CAP-04 historical delivery evidence.
// Boundary: governance files only; no Runtime source, migration, canonical write, route, web, AO-ACT, PostgreSQL or network mutation.

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const repoRoot = process.cwd();
const baseline = process.env.MCFT_CAP_05_P0_BASELINE || "5391a3a8f811fc166fa187d7da70342ee36ab5fa";
const postmerge = process.argv.includes("--postmerge");
const p0Slice = "MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1";
const files = {
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  matrix: "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  status: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P0-STATUS.json",
  acceptance: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P0_SETTLEMENT_SSOT.cjs",
};
const expectedChangedFiles = Object.values(files).sort();
let passCount = 0;
let failCount = 0;
function pass(label) { passCount += 1; console.log(`PASS ${label}`); }
function fail(label, detail = "") { failCount += 1; console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`); }
function assert(condition, label, detail = "") { if (condition) pass(label); else fail(label, detail); }
function read(relativePath) { return fs.readFileSync(path.join(repoRoot, relativePath), "utf8"); }
function git(args) { return childProcess.execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim(); }
function canonical(value) { return JSON.stringify(value); }
function findCapability(matrix, id) { return matrix.capability_lines.find((entry) => entry.capability_line_id === id); }

for (const relativePath of expectedChangedFiles) assert(fs.existsSync(path.join(repoRoot, relativePath)), `file exists ${relativePath}`);
const matrix = JSON.parse(read(files.matrix));
const status = JSON.parse(read(files.status));
const task = read(files.task);
const implementationMap = read(files.map);
const baselineMatrix = JSON.parse(git(["show", `${baseline}:${files.matrix}`]));
const cap04 = findCapability(matrix, "MCFT-CAP-04");
const baseCap04 = findCapability(baselineMatrix, "MCFT-CAP-04");
const cap05Entries = matrix.capability_lines.filter((entry) => entry.capability_line_id === "MCFT-CAP-05");
const cap05 = cap05Entries[0];

assert(matrix.schema_version === "geox_mcft_vertical_capability_line_matrix_v7", "matrix schema v7");
assert(matrix.baseline.branch === "main" && matrix.baseline.commit === baseline, "matrix current baseline exact");
assert(Boolean(cap04) && Boolean(baseCap04), "CAP-04 entries exist");
assert(cap04.status === "COMPLETE", "CAP-04 status COMPLETE");
assert(cap04.implementation_status === "COMPLETE", "CAP-04 implementation COMPLETE");
assert(cap04.closure_effective === true && cap04.capability_complete === true, "CAP-04 completion effective");
assert(cap04.active_delivery_slice_id === null, "CAP-04 active slice null");
assert(Array.isArray(cap04.pending_completion_claims) && cap04.pending_completion_claims.length === 0, "CAP-04 pending claims empty");
assert(cap04.next_delivery_slice_id === null && cap04.next_delivery_slice_authorized === false, "CAP-04 stale next delivery cleared");
assert(Array.isArray(cap04.next_authorized_slice_ids) && cap04.next_authorized_slice_ids.length === 0, "CAP-04 next authorized list empty");
assert(cap04.latest_effective_slice_id === "MCFT-CAP-04.FINALIZATION-MAIN-VERIFICATION-V1", "CAP-04 latest effective slice reconciled");
assert(cap04.effectiveness_condition_satisfied === true, "CAP-04 effectiveness satisfied");
assert(cap04.current_repository_baseline_commit === baseline, "CAP-04 current baseline exact");
assert(cap04.p0_reconciled_by === p0Slice, "CAP-04 P0 identity exact");
assert(canonical(cap04.delivery_slices) === canonical(baseCap04.delivery_slices), "CAP-04 historical delivery slices unchanged");

const mutableCap04Keys = new Set(["status", "implementation_status", "closure_effective", "capability_complete", "active_delivery_slice_id", "pending_completion_claims", "next_delivery_slice_id", "next_delivery_slice_authorized", "next_authorized_slice_ids", "latest_effective_slice_id", "latest_effective_delivery_slice_id", "effectiveness_condition", "effectiveness_condition_satisfied", "current_repository_baseline_commit", "current_lifecycle_authority", "current_main_verification_authority", "p0_reconciled_by", "p0_current_reconciliation"]);
function historicalView(entry) { const copy = structuredClone(entry); for (const key of mutableCap04Keys) delete copy[key]; return copy; }
assert(canonical(historicalView(cap04)) === canonical(historicalView(baseCap04)), "CAP-04 non-current historical fields unchanged");
for (const id of ["MCFT-CAP-01", "MCFT-CAP-02", "MCFT-CAP-03"]) assert(canonical(findCapability(matrix, id)) === canonical(findCapability(baselineMatrix, id)), `${id} entry unchanged`);

assert(cap05Entries.length === 1, "exactly one CAP-05 provisional entry");
assert(cap05.status === "NOT_AUTHORIZED", "CAP-05 status NOT_AUTHORIZED");
assert(cap05.design_status === "P_MINUS_1_MERGED_EFFECTIVE", "CAP-05 design status exact");
assert(cap05.implementation_status === "NOT_AUTHORIZED" && cap05.runtime_source_authorized === false, "CAP-05 implementation blocked");
assert(cap05.active_delivery_slice_id === null, "CAP-05 active slice null");
assert(cap05.predecessor_capability_line_id === "MCFT-CAP-04" && cap05.successor_capability_line_id === "MCFT-CAP-06", "CAP-05 adjacency exact");
assert(cap05.successor_authorized === false, "CAP-06 unauthorized");
assert(cap05.p_minus_1_adjudication.status === "MERGED_EFFECTIVE" && cap05.p_minus_1_adjudication.result === "REUSE_WITHOUT_AMENDMENT", "P-1 effective result exact");
assert(cap05.p_minus_1_adjudication.merged_main_gate_workflow_run === 29305092038, "P-1 Gate workflow pinned");
assert(cap05.p0.delivery_slice_id === p0Slice && cap05.p0.status === "READY_FOR_MERGE", "P0 matrix status exact");
assert(cap05.next_delivery_slice_id === "MCFT-CAP-05.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1" && cap05.next_delivery_slice_authorized === false, "S0 remains unauthorized");

assert(status.schema_version === "geox_mcft_cap_05_p0_status_v1", "P0 status schema exact");
assert(status.status === "READY_FOR_MERGE" && status.baseline_main_commit === baseline, "P0 status and baseline exact");
assert(status.p_minus_1_effectiveness.effective === true && status.p_minus_1_effectiveness.merged_main_gate === "PASS", "P-1 effectiveness recorded");
assert(status.p_minus_1_effectiveness.adjudication_result === "REUSE_WITHOUT_AMENDMENT", "P-1 adjudication recorded");
assert(status.cap_04_reconciled_current_fields.implementation_status === "COMPLETE", "P0 status CAP-04 reconciled");
assert(status.cap_05_provisional_entry.status === "NOT_AUTHORIZED", "P0 status CAP-05 unauthorized");
assert(status.runtime_source_authorized === false && status.migration_authorized === false && status.canonical_write_authorized === false, "P0 write authority blocked");
assert(status.s0_authorized === false && status.cap_06_authorized === false, "successor boundaries blocked");
assert(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expectedChangedFiles), "status exact changed-file boundary");

assert(task.includes("design_status:\nP_MINUS_1_MERGED_EFFECTIVE"), "task records P-1 effective");
assert(task.includes(`active_delivery_slice_id:\n${p0Slice}`), "task records P0 candidate");
assert(task.includes("P-1 merged-main Gate workflow:\n29305092038 SUCCESS"), "task pins P-1 Gate");
assert(task.includes("P0 status:\nREADY_FOR_MERGE"), "task records P0 readiness");
assert(implementationMap.includes("MCFT-CAP-05-P0-SETTLEMENT-START"), "implementation map P0 section exists");
assert(implementationMap.includes("P-1 merged-main Gate workflow: 29305092038 SUCCESS"), "implementation map pins P-1 Gate");
assert(implementationMap.includes("P0 status: READY_FOR_MERGE") && implementationMap.includes("S0 authorized: false"), "implementation map boundaries exact");

let changedFiles = [];
try {
  const range = postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`;
  changedFiles = git(["diff", "--name-only", range]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changedFiles) === JSON.stringify(expectedChangedFiles), "git exact changed-file boundary", JSON.stringify(changedFiles));
} catch (error) { fail("git exact changed-file boundary", error.message); }
const forbiddenPrefixes = ["apps/server/src/", "apps/server/db/migrations/", "apps/web/", "fixtures/", "scripts/runtime_acceptance/"];
for (const changed of changedFiles) assert(!forbiddenPrefixes.some((prefix) => changed.startsWith(prefix)), `no forbidden path ${changed}`);
try { git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]); pass("git diff --check"); } catch (error) { fail("git diff --check", error.message); }
console.log(`SUMMARY ${passCount} PASS, ${failCount} FAIL`);
if (failCount > 0) process.exit(1);
