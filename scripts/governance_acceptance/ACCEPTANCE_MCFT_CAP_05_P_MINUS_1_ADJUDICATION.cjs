// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P_MINUS_1_ADJUDICATION.cjs
// Purpose: verify the governance-only MCFT-CAP-05 P-1 adjudication package and its exact changed-file boundary.
// Boundary: static repository checks only; no Runtime execution, database, migration, canonical write, route, web, network, or wall-clock mutation.

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const repoRoot = process.cwd();
const baseline = process.env.MCFT_CAP_05_P_MINUS_1_BASELINE || "3eba797307388bd652dc5c65e91d634375e1b8c2";
const postmerge = process.argv.includes("--postmerge");

const files = {
  map: "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  task: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  adjudication: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P-1-ADJUDICATION.md",
  status: "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P-1-STATUS.json",
  acceptance: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_P_MINUS_1_ADJUDICATION.cjs",
};

const expectedChangedFiles = Object.values(files).sort();
let passCount = 0;
let failCount = 0;

function pass(label) {
  passCount += 1;
  console.log(`PASS ${label}`);
}

function fail(label, detail = "") {
  failCount += 1;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

function assert(condition, label, detail = "") {
  if (condition) pass(label);
  else fail(label, detail);
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function git(args) {
  return childProcess.execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

for (const relativePath of expectedChangedFiles) {
  assert(fs.existsSync(path.join(repoRoot, relativePath)), `file exists ${relativePath}`);
}

const task = read(files.task);
const adjudication = read(files.adjudication);
const implementationMap = read(files.map);
const status = JSON.parse(read(files.status));

assert(task.includes("完整任务线 v0.4"), "task is v0.4");
assert(task.includes("P_MINUS_1_ADJUDICATION_COMPLETE_CANDIDATE"), "task records P-1 candidate state");
assert(task.includes("REUSE_WITHOUT_AMENDMENT"), "task records adjudication result");
assert(task.includes("FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1"), "task freezes H1 Forecast projection");
assert(task.includes("Forecast Residual ≠ Assimilation Innovation by default"), "task separates Forecast Residual and Assimilation Innovation");
assert(!task.includes("ROOT_ZONE_STORAGE_TO_POINT_200MM_VWC_V1"), "withdrawn 200 mm projection absent");
assert(!task.includes("Residual.assimilation_weight_or_gain"), "Residual does not own Assimilation gain");

assert(adjudication.includes("adjudication_result:\nREUSE_WITHOUT_AMENDMENT"), "adjudication result exact");
assert(adjudication.includes("new canonical object required:\nfalse"), "no new canonical object");
assert(adjudication.includes("new transaction family required:\nfalse"), "no new transaction family");
assert(adjudication.includes("Forecast Residual versus Assimilation Innovation"), "separation adjudicated");
assert(adjudication.includes("AVAILABLE" ) || adjudication.includes("available_to_runtime_at <= target logical_time"), "logical-time cutoff adjudicated");

assert(status.adjudication_status === "COMPLETE_CANDIDATE", "status candidate complete");
assert(status.adjudication_result === "REUSE_WITHOUT_AMENDMENT", "status result exact");
assert(status.dt02_architecture_amendment_required === false, "amendment not required");
assert(status.runtime_source_authorized === false, "Runtime source unauthorized");
assert(status.migration_authorized === false, "migration unauthorized");
assert(status.canonical_write_authorized === false, "canonical write unauthorized");
assert(status.p0_authorized === false, "P0 unauthorized before effectiveness");
assert(Array.isArray(status.new_canonical_object_types) && status.new_canonical_object_types.length === 0, "zero new canonical object types");
assert(Array.isArray(status.new_transaction_families) && status.new_transaction_families.length === 0, "zero new transaction families");
assert(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(expectedChangedFiles), "status exact changed-file boundary");

assert(implementationMap.includes("MCFT-CAP-05 P-1 DT-02 object / transaction adjudication candidate"), "implementation map contains P-1 section");
assert(implementationMap.includes("adjudication result: REUSE_WITHOUT_AMENDMENT"), "implementation map result exact");
assert(implementationMap.includes("P0 authorized: false"), "implementation map preserves P0 block");

let changedFiles = [];
try {
  const range = postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`;
  changedFiles = git(["diff", "--name-only", range]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changedFiles) === JSON.stringify(expectedChangedFiles), "git exact changed-file boundary", JSON.stringify(changedFiles));
} catch (error) {
  fail("git exact changed-file boundary", error.message);
}

const forbiddenPrefixes = [
  "apps/server/src/",
  "apps/server/db/migrations/",
  "apps/web/",
  "fixtures/",
  "scripts/runtime_acceptance/",
];
for (const changed of changedFiles) {
  assert(!forbiddenPrefixes.some((prefix) => changed.startsWith(prefix)), `no forbidden path ${changed}`);
}

try {
  git(["diff", "--check", postmerge ? `${baseline}..HEAD` : `${baseline}...HEAD`]);
  pass("git diff --check");
} catch (error) {
  fail("git diff --check", error.message);
}

console.log(`SUMMARY ${passCount} PASS, ${failCount} FAIL`);
if (failCount > 0) process.exit(1);
