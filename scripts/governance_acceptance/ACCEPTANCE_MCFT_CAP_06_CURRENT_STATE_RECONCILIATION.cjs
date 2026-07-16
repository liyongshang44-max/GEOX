// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_CURRENT_STATE_RECONCILIATION.cjs
// Purpose: fail closed unless the MCFT-CAP-06 current-state frontier matches merged repository facts and preserves the no-Runtime boundary.

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const BASELINE = "1e66ea7efc842b8e547bccc40521d520b4370e69";
const S0 = "MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1";
const FILES = [
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_CURRENT_STATE_RECONCILIATION.cjs"
].sort();

function run(args) {
  return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}
function text(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

cp.execFileSync("git", ["merge-base", "--is-ancestor", BASELINE, "HEAD"], { cwd: ROOT });
const tracked = run(["diff", "--name-only", BASELINE]).split(/\r?\n/).filter(Boolean);
const untracked = run(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
assert.deepEqual(changed, FILES, `CURRENT_STATE_FILE_BOUNDARY:${changed.join(",")}`);
assert.equal(fs.existsSync(path.join(ROOT, ".github/workflows/mcft-cap-06-current-state-reconcile.yml")), false);

const p1 = readJson("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json");
assert.equal(p1.status, "MERGED_EFFECTIVE");
assert.equal(p1.effectiveness.effective, true);
assert.equal(p1.effectiveness.merge_commit, "79cd7814eff06ad86f86cdcb379c6f71a77f1ab8");
assert.equal(p1.effectiveness.postmerge_gate, "PASS");

const p0 = readJson("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json");
assert.equal(p0.status, "MERGED_EFFECTIVE");
assert.equal(p0.effectiveness.effective, true);
assert.equal(p0.effectiveness.merge_commit, "a7bb8d9499560b0ef0244a1a6daeaee1eeb408bf");
assert.equal(p0.cap_06_provisional_state.predecessor_eligibility, "RESTORED");
assert.equal(p0.cap_06_provisional_state.s0_qualification_authorized, true);
assert.equal(p0.cap_06_provisional_state.s0_status, "AUTHORIZED_NOT_STARTED");
assert.equal(p0.cap_06_provisional_state.runtime_source_authorized, false);

const predecessor = readJson("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-STATUS.json");
assert.equal(predecessor.post_closure_conformance_status, "POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION_EFFECTIVE");
assert.equal(predecessor.formal_postgresql_runner_regression.status, "PASS_MERGED_MAIN");
assert.equal(predecessor.successor_predecessor_eligibility, "RESTORED");
assert.equal(predecessor.cap_06_s0_resume_authorized, true);
assert.equal(predecessor.cap_06_runtime_authority, false);

const delivery = readJson("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json");
assert.equal(delivery.status, "GOVERNANCE_AUTHORIZED");
assert.equal(delivery.authorization_effective, false);
assert.equal(delivery.runtime_source_authorized, false);
assert.equal(delivery.active_delivery_slice_id, null);
assert.equal(delivery.s0_qualification_authorized, true);
assert.equal(delivery.authorized_not_started_slices.length, 1);
assert.equal(delivery.authorized_not_started_slices[0].delivery_slice_id, S0);
assert.equal(delivery.candidate_slices.length, 0);
assert.equal(delivery.superseded_candidates[0].pull_request, 2500);
assert.equal(delivery.superseded_candidates[0].status, "CLOSED_NOT_MERGED");

const record = readJson("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json");
assert.equal(record.status, "READY_FOR_MERGE");
assert.equal(record.reconciliation_effective, false);
assert.equal(record.current_state.p_minus_1, "MERGED_EFFECTIVE");
assert.equal(record.current_state.p0, "MERGED_EFFECTIVE");
assert.equal(record.current_state.cap_05_predecessor_eligibility, "RESTORED");
assert.equal(record.current_state.s0_qualification_authorized, true);
assert.equal(record.current_state.s0, "AUTHORIZED_NOT_STARTED");
assert.equal(record.current_state.capability_line_authorization_effective, false);
assert.equal(record.current_state.runtime_source_authorized, false);
assert.equal(record.current_state.active_delivery_slice_id, null);
assert.equal(record.current_state.candidate_runtime_implemented, false);
assert.equal(record.current_state.shadow_evaluation_runtime_implemented, false);
assert.equal(record.current_state.capability_complete, false);
assert.equal(record.next_repository_action, S0);

const matrix = readJson("docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json");
assert.equal(matrix.baseline.commit, BASELINE);
const cap06 = matrix.capability_lines.find((item) => item.capability_line_id === "MCFT-CAP-06");
assert.ok(cap06);
assert.equal(cap06.status, "GOVERNANCE_AUTHORIZED");
assert.equal(cap06.p_minus_1.status, "MERGED_EFFECTIVE");
assert.equal(cap06.p0.status, "MERGED_EFFECTIVE");
assert.equal(cap06.p0.effective, true);
assert.equal(cap06.s0.status, "AUTHORIZED_NOT_STARTED");
assert.equal(cap06.authorization_effective, false);
assert.equal(cap06.runtime_source_authorized, false);
assert.equal(cap06.active_delivery_slice_id, null);
assert.equal(cap06.successor_authorized, false);

const task = text("docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md");
assert.match(task, /P0_MERGED_EFFECTIVE_S0_AUTHORIZED_NOT_STARTED/);
assert.match(task, /s0_qualification_authorized:\ntrue/);
assert.match(task, /runtime_source_authorized:\nfalse/);
const map = text("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md");
assert.match(map, /P0 status:\nMERGED_EFFECTIVE/);
assert.match(map, /S0 status:\nAUTHORIZED_NOT_STARTED/);
assert.match(map, /runtime source authorized:\nfalse/);

console.log("PASS MCFT-CAP-06 current-state reconciliation Gate");
