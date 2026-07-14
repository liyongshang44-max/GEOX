// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs
// Purpose: verify the bounded S6 validation-orthogonality remediation without replacing the merged-effective S6 delivery slice or implementing S7.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime tick, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const REMEDIATION = "MCFT-CAP-05.S6.VALIDATION-ORTHOGONALITY-REMEDIATION-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
  "apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-VALIDATION-ORTHOGONALITY-REMEDIATION-STATUS.json",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts",
].sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}
function read(path) { return fs.readFileSync(path, "utf8"); }
function json(path) { return JSON.parse(read(path)); }
function changedFiles() {
  try {
    return execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
      .trim().split(/\r?\n/).filter(Boolean).sort();
  } catch {
    return null;
  }
}

const adapter = read(expectedFiles[0]);
const receipt = read(expectedFiles[1]);
const status = json(expectedFiles[2]);
const wrapper = read(expectedFiles[3]);
const s6Gate = read(expectedFiles[4]);
const acceptance = read(expectedFiles[6]);

check(status.remediation_id === REMEDIATION && status.status === "IMPLEMENTATION_CANDIDATE", "remediation candidate identity is explicit");
check(status.baseline_main_commit === "a9bf75333871ac62021679c1dac756be9e30cebe", "remediation baseline is the activated canonical main");
check(status.remediation_pr_number === 2465, "remediation PR identity is frozen");
check(status.effective_predecessor?.status === "MERGED_EFFECTIVE" && status.effective_predecessor?.runtime_pr_number === 2456, "merged-effective S6 remains the predecessor");
check(status.confirmed_contract_deviation?.task_acceptance_refs?.join(",") === "108,109,110", "task acceptance 108-110 is the remediation authority");
check(status.confirmed_contract_deviation?.severity === "MERGE_BLOCKING_FOR_S7", "deviation remains merge-blocking for S7");
check(status.s7_effect?.pr_number === 2464 && status.s7_effect?.may_merge_before_remediation_effective === false, "S7 remains blocked until remediation effectiveness");

check(receipt.includes('validationStatus !== "REJECTED"'), "Receipt normalization allows NOT_YET_VALIDATED and blocks REJECTED");
check(!receipt.includes('validationStatus === "VALIDATED" || validationStatus === "VALIDATED_WITH_LIMITATIONS"'), "Receipt normalization no longer requires completed validation");
check(adapter.includes("NOT_YET_VALIDATED_MAY_BE_STATE_INPUT_ELIGIBLE_REJECTED_FORBIDDEN_V1"), "validation orthogonality policy is explicitly named");
check(adapter.includes('return validationStatus !== "REJECTED"'), "adapter validation predicate is non-rejected rather than validated-only");
check(adapter.includes("CAP05_ACTION_FEEDBACK_VALIDATION_REJECTED"), "adapter rejects validation failure explicitly");
check(!adapter.includes("CAP05_ACTION_FEEDBACK_VALIDATION_REQUIRED"), "validated-only adapter guard is removed");

check(acceptance.includes('validation_status, "NOT_YET_VALIDATED"'), "PostgreSQL acceptance preserves NOT_YET_VALIDATED canonical status");
check(acceptance.includes('eligible_for_state_input, true'), "PostgreSQL acceptance proves pending validation remains eligible");
check(acceptance.includes("pendingResult.adapter_result") && acceptance.includes("source_validation_status, \"NOT_YET_VALIDATED\""), "PostgreSQL acceptance proves adapter consumption and trace retention");
check(acceptance.includes("pending validation remains orthogonal to trustworthy execution eligibility"), "acceptance label states the corrected contract");
check(!acceptance.includes("pending validation independently blocks State eligibility"), "incorrect S6 acceptance claim is removed");

check(s6Gate.includes('validationStatus !== \\"REJECTED\\"') || s6Gate.includes('validationStatus !== \"REJECTED\"'), "existing S6 governance gate enforces non-rejected validation semantics");
check(s6Gate.includes("pending validation remains orthogonal to trustworthy execution eligibility"), "existing S6 governance gate requires corrected PostgreSQL evidence");
check(wrapper.includes("MCFT_CAP_05_S6_VALIDATION_ORTHOGONALITY_REMEDIATION_GATE_V1"), "standard acceptance permanently invokes remediation gate");
check(wrapper.includes("ACCEPTANCE_MCFT_CAP_05_ACTION_FEEDBACK_H_DB.ts"), "standard acceptance permanently invokes S6 PostgreSQL regression");

check(status.compatibility?.existing_action_feedback_eligibility_policy_id_retained === true, "canonical H and Runtime Config policy identity is preserved");
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0, "remediation adds no object, transaction family or migration");
check(status.preserved_nonclaims?.includes("NO_REPLACEMENT_S6_IMPLEMENTATION"), "replacement-S6 nonclaim remains explicit");
check(status.preserved_nonclaims?.includes("NO_S7_EFFECTIVENESS_CLAIM") && status.preserved_nonclaims?.includes("NO_CAP_06_AUTHORIZATION"), "S7-effectiveness and CAP-06 nonclaims remain explicit");

const mode = process.argv.includes("--candidate") ? "candidate" : process.argv.includes("--postmerge") ? "postmerge" : "auto";
const changed = changedFiles();
if (mode === "candidate") {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact seven-file remediation boundary");
} else if (mode === "postmerge") {
  check(changed === null || changed.length === 0, "postmerge main has no remediation delta against origin/main");
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence after merge");
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, "auto mode recognizes remediation candidate");
} else if (changed && changed.length === 0) {
  check(true, "auto mode recognizes remediation-effective main");
} else {
  check(false, "auto mode rejects an unexpected remediation boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "remediation boundary excludes routes, web and migrations");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
