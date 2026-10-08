"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const cp = require("node:child_process");
const fs = require("node:fs");
const ROOT = path.resolve(__dirname, "../..");
const BASE = "a60aa6858662ce87b989ff752c50969f21ad4619";
const PATHS = [
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs",
  ".github/workflows/mcft-cap-09-arm-retirement-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-OLD-ARM-HOST-RETIREMENT-V1.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs",
  "scripts/runtime_acceptance/RETIRE_MCFT_CAP09_ARM_HOST_V1.ps1",
  "scripts/runtime_acceptance/RETIRE_MCFT_CAP_09_FORMAL_ARM_HOST_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V2.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION_V2.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ACTIVE_PRODUCTION_CUTOVER_V2.cjs",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"
];
function git(...args) { return cp.execFileSync("git", args, {cwd: ROOT, encoding: "utf8"}).trim(); }
function verifyRetirementOnlySuccessor() {
  if (git("rev-parse", "HEAD") === BASE) return null;
  assert.equal(git("merge-base", BASE, "HEAD"), BASE, "ARM_RETIREMENT_BASE_NOT_ANCESTOR");
  // QCP diagnostics write reports before invoking subsequent qualifiers.
  // Only that untracked output directory is excluded; tracked mutations and
  // all other untracked source paths still reject qualification.
  const sourceDirty = git("status", "--porcelain", "--untracked-files=normal").split(/\r?\n/).filter(x => x && x !== "?? acceptance-output/");
  assert.deepEqual(sourceDirty, [], "ARM_RETIREMENT_DIRTY_QUALIFICATION_FORBIDDEN");
  const changes = git("diff", "--name-status", BASE, "HEAD").split(/\r?\n/).filter(Boolean).map(row => { const [status, rel] = row.split("\t"); return {status, rel}; });
  const allowed = new Set(PATHS);
  for (const {status, rel} of changes) {
    assert.ok(allowed.has(rel) && ["A", "M"].includes(status), "ARM_RETIREMENT_ONLY_PATH_FORBIDDEN:" + rel);
    const mutable = rel === PATHS.find(x => x.endsWith("QUALIFICATION-CONTROL-PLANE-V1.json")) || rel.startsWith("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_") || rel === "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs";
    if (!mutable) assert.equal(status, "A", "ARM_RETIREMENT_PREEXISTING_FILE_REWRITE_FORBIDDEN:" + rel);
  }
  assert.ok(changes.some(x => x.rel.endsWith("MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs")), "ARM_RETIREMENT_GUARD_REQUIRED");
  const originalCall = 'const authorityContinuity=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity();';
  const successorCall = '// Revocation-only successors requalify unchanged consumers without carrying an old ARM.\nconst authorityContinuity=require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").verifyRetirementOnlySuccessor()\n  ?? require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity();';
  for (const rel of PATHS.filter(x => x.startsWith("scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_"))) {
    assert.equal(fs.readFileSync(path.join(ROOT, rel), "utf8"), cp.execFileSync("git", ["show", BASE + ":" + rel], {cwd: ROOT, encoding: "utf8"}).replace(originalCall, successorCall), "ARM_RETIREMENT_EXISTING_QUALIFIER_REWRITE_FORBIDDEN:" + rel);
  }
  const chainRel = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs";
  const expectedChain = cp.execFileSync("git", ["show", BASE + ":" + chainRel], {cwd: ROOT, encoding: "utf8"}).replace('function verifyFormalV5AuthorityContinuity() {', 'function verifyFormalV5AuthorityContinuity(headRef = "HEAD") {').replace('  const head = git(["rev-parse", "HEAD"]);\n  if (head === baseline', '  const head = git(["rev-parse", headRef]);\n  if (head === baseline');
  assert.equal(fs.readFileSync(path.join(ROOT, chainRel), "utf8"), expectedChain, "ARM_RETIREMENT_CHAIN_QUALIFIER_REWRITE_FORBIDDEN");
  const qcpRel = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
  const before = JSON.parse(git("show", BASE + ":" + qcpRel));
  const after = JSON.parse(fs.readFileSync(path.join(ROOT, qcpRel), "utf8"));
  assert.equal(after.checks.length, before.checks.length + 1, "ARM_RETIREMENT_EXACTLY_ONE_NEW_CHECK_REQUIRED");
  assert.deepEqual(after.checks.slice(0, before.checks.length), before.checks, "ARM_RETIREMENT_EXISTING_CHECKS_CHANGED");
  assert.deepEqual(after.dependency_resolvers.FORMAL_ARM_RETIREMENT_ONLY_V1, {kind: "EXACT_PATH_SET", paths: [...PATHS].sort()}, "ARM_RETIREMENT_EXACT_RESOLVER_REQUIRED");
  const normalized = JSON.parse(JSON.stringify(after));
  normalized.checks.pop();
  delete normalized.dependency_resolvers.FORMAL_ARM_RETIREMENT_ONLY_V1;
  assert.deepEqual(normalized, before, "ARM_RETIREMENT_EXISTING_QCP_AUTHORITY_CHANGED");
  // All code outside this exact append-only revocation set, including V1 launchers,
  // Runtime/schema/ACL/providers, is byte-identical to the qualified base.
  cp.execFileSync(process.execPath, [path.join(ROOT, "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"), "--entrypoints"], {cwd: ROOT, stdio: "pipe"});
  const historical = require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity(BASE);
  return {baseline: BASE, changedPaths: [...new Set([...historical.changedPaths, ...changes.map(x => x.rel)])], qualification_scope: "RETIREMENT_ONLY_RUNTIME_UNCHANGED", old_arm_carry_forward_authorized: false, production_runtime_start_authorized: false, a0_authorized: false, mcft_cap09_completed: false};
}
module.exports = {verifyRetirementOnlySuccessor, PATHS};
if (require.main === module) console.log(JSON.stringify(verifyRetirementOnlySuccessor(), null, 2));
