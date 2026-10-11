#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const cp = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const BASE = "c9e027b832d1e25a20384d4853ed5564ed405fd4";
const Q = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const DOC = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-DISABLED-RETRY-IMPLEMENTATION-20261011-V1.md";
const OLD = "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_HISTORY_REPLAY_BUDGET_SUCCESSOR_V1.cjs";
const SELF = "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_DISABLED_RETRY_SUCCESSOR_V1.cjs";
const HELPER = "scripts/governance_acceptance/MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs";
const ARM = "scripts/runtime_acceptance/MCFT_CAP_09_ISOLATED_RETRY_ARM_20261011_V1.json";
const TEST = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml";
const PATHS = [Q, DOC, OLD, SELF, HELPER, ARM, TEST, WORKFLOW,
  "scripts/governance_acceptance/PREPARE_MCFT_CAP_09_CURRENT_BASELINE_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_BASELINE_PREPARATION_V1.cjs",
].sort();
const CHECK = {
  check_id: "DISABLED_RETRY_IMPLEMENTATION_20261011_ENGINEERING_ONLY",
  owner: "MCFT_CAP09_DISABLED_RETRY_IMPLEMENTATION", generation_scope: ["V13"],
  authority_refs: [DOC], resolver_ids: ["DISABLED_RETRY_IMPLEMENTATION_20261011_V1"],
  historical_evidence_policy: "IMMUTABLE_PR3689_REPLAY_AND_DISABLED_ARM_NO_ACTIVATION",
  execution_workflow: ".github/workflows/mcft-cap-09-current-baseline-entry-engineering-v1.yml",
  execution_workflow_status: "ENGINEERING_ONLY_NO_LIVE_EXECUTE",
  fail_policy: "FAIL_CLOSED_EXACT_TEN_PATHS_DEFAULT_DISABLED_RETRY_AUTHORITY",
  carry_forward_policy: "NONE", requalification_triggers: ["DISABLED_RETRY_IMPLEMENTATION_20261011_V1"],
  applicable_stages: ["SUCCESSOR_SUBJECT_PRE_MERGE", "POST_MERGE_V13_QUALIFICATION"],
  carry_forward_evidence_id: null,
  diagnostic_command: "node " + SELF,
};
const ROUTE = ' const retrySuccessor=path.join(ROOT,"' + SELF + '");\n' +
  ' if(fs.existsSync(retrySuccessor))return require("./VERIFY_MCFT_CAP_09_DISABLED_RETRY_SUCCESSOR_V1.cjs").verifySuccessor();\n';
const git = (...args) => cp.execFileSync("git", args,
  {cwd: ROOT, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024}).trim();
function verifySuccessor() {
  const head = git("rev-parse", "HEAD"), main = git("rev-parse", "origin/main");
  git("merge-base", "--is-ancestor", BASE, head);
  let stage = "SUCCESSOR_SUBJECT_PRE_MERGE";
  if (main === BASE) assert.notEqual(head, BASE, "HISTORY_CANDIDATE_REQUIRED");
  else {
    assert.equal(head, main, "HISTORY_EXACT_MAIN_REQUIRED");
    const parents = git("show", "-s", "--format=%P", main).split(" ");
    assert.equal(parents.length, 2, "HISTORY_TWO_PARENTS_REQUIRED");
    assert.equal(parents[0], BASE, "HISTORY_FIRST_PARENT_CHANGED");
    assert.equal(git("rev-parse", main + "^{tree}"), git("rev-parse", parents[1] + "^{tree}"),
      "HISTORY_MERGE_TREE_CHANGED");
    stage = "POST_MERGE_V13_QUALIFICATION";
  }
  assert.deepEqual(git("status", "--porcelain").split(/\r?\n/)
    .filter(x => x && !x.startsWith("?? acceptance-output/")), [], "HISTORY_DIRTY_SOURCE");
  const changes = git("diff", "--name-status", BASE, head).split(/\r?\n/)
    .filter(Boolean).map(x => x.split("\t"));
  assert.deepEqual(changes.map(x => x[1]).sort(), PATHS, "RETRY_EXACT_TEN_PATHS_REQUIRED");
  for (const [kind, file] of changes) assert.equal(kind, [DOC, SELF, HELPER, ARM, TEST].includes(file) ? "A" : "M");
  assert.equal(fs.readFileSync(path.join(ROOT, OLD), "utf8"),
    (git("show", BASE + ":" + OLD) + "\n").replace("function verifySuccessor() {\n", "function verifySuccessor() {\n" + ROUTE),
    "HISTORICAL_BUDGET_ASSERTIONS_CHANGED");
  const before = JSON.parse(git("show", BASE + ":" + Q));
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, Q), "utf8"));
  assert.equal(before.checks.length, 51);
  assert.equal(q.checks.length, 52);
  assert.deepEqual(q.checks.at(-1), CHECK);
  assert.deepEqual(q.dependency_resolvers.DISABLED_RETRY_IMPLEMENTATION_20261011_V1,
    {kind: "EXACT_PATH_SET", paths: PATHS});
  const stripped = structuredClone(q);
  stripped.checks.pop(); delete stripped.dependency_resolvers.DISABLED_RETRY_IMPLEMENTATION_20261011_V1;
  assert.deepEqual(stripped, before, "EXISTING_51_QCP_CHECKS_CHANGED");
  const frozen = require("../runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs")
    .frozenRuntimePaths(ROOT, q);
  assert.equal(frozen.length, 108);
  assert.equal(git("diff", "--name-only", "3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a", "HEAD", "--", ...frozen), "");
  const policy = require("./MCFT_CAP_09_ISOLATED_RETRY_AUTHORITY_POLICY_V1.cjs");
  policy.validateDisabledArm(JSON.parse(fs.readFileSync(path.join(ROOT, ARM), "utf8")));
  const tests = JSON.parse(cp.execFileSync(process.execPath, [TEST], {cwd: ROOT, encoding: "utf8", timeout: 30000}));
  assert.equal(tests.status, "PASS"); assert.equal(tests.execute_authorized, false);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-disabled-retry-"));
  const checkout = path.join(temp, "prior");
  const started = Date.now();
  let proof;
  try {
    cp.execFileSync("git", ["clone", "--shared", "--no-checkout", ROOT, checkout],
      {stdio: "ignore", timeout: 240000});
    const historicalGit = (...args) => cp.execFileSync("git", ["-C", checkout, ...args],
      {encoding: "utf8", timeout: 120000}).trim();
    historicalGit("checkout", "--detach", BASE);
    historicalGit("update-ref", "refs/remotes/origin/main", BASE);
    assert.equal(historicalGit("rev-parse", "origin/main"), BASE);
    proof = JSON.parse(cp.execFileSync(process.execPath, [OLD], {
      cwd: checkout, encoding: "utf8", timeout: 25 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    }));
    assert.equal(proof.status, "PASS", "PR3689_HISTORY_NOT_PASS");
    assert.equal(proof.head, BASE); assert.equal(proof.main, BASE);
    assert.equal(proof.history_replay, "PASS");
    assert.equal(proof.authorize_execute, false);
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
    assert.equal(git("rev-parse", "origin/main"), main, "LIVE_MAIN_REF_CHANGED");
  }
  return {status: "PASS", adjudication: "DISABLED_RETRY_IMPLEMENTATION_ENGINEERING_ONLY",
    stage, head, main, history_replay: "PASS", historical_subject: BASE,
    history_elapsed_ms: Date.now() - started, history_budget_ms: 25 * 60 * 1000,
    historical_source_unchanged: true, frozen_runtime_108_unchanged: true,
    qcp_check_count: 52, default_arm_disabled: true, activation_implemented: false, retry_authorized: false, authorize_execute: false, qualification_pass: false,
    production_recovery: false, formal_v5: false, a0: false, o00: false};
}
module.exports = {BASE, PATHS, CHECK, ROUTE, verifySuccessor};
if (require.main === module) {
  try { console.log(JSON.stringify(verifySuccessor(), null, 2)); }
  catch (e) { console.error(e.stack || String(e)); process.exitCode = 1; }
}
