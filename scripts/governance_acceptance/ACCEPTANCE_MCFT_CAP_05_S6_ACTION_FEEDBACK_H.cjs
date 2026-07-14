// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs
// Purpose: verify the bounded remediation-aware S6 Receipt-to-H Action Feedback Runtime slice without activating global SSOT or granting State-tick authority.
// Boundary: static repository-shape and semantic checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
  "apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts",
  "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs",
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

const adapter = read(expectedFiles[0]);
const receipt = read(expectedFiles[1]);
const service = read(expectedFiles[2]);
const authority = read(expectedFiles[3]);
const status = json(expectedFiles[4]);
const acceptance = read(expectedFiles[6]);

check(status.delivery_slice_id === S6 && status.status === "IMPLEMENTATION_CANDIDATE", "S6 Runtime candidate identity is explicit");
check(status.baseline_main_commit === "99221bb464818f8686718fd25df123e1096b2281", "S6 baseline is the remediation-effective main commit");
check(status.s5_effectiveness?.effective === true && status.s5_effectiveness?.merged_main_gate === "PASS", "S5 merged-main effectiveness is preserved");
check(status.s5_remediation_effectiveness?.effective === true && status.s5_remediation_effectiveness?.merged_main_gate === "PASS", "S5 remediation merged-main effectiveness is prerequisite authority");
check(status.validation?.state === "PENDING_EXACT_HEAD_VALIDATION" || status.validation?.state === "EXACT_HEAD_VALIDATED", "validation lifecycle is explicit");
check(status.next_delivery_slice_id === S7 && status.next_delivery_slice_authorized === false, "S7 is named but remains unauthorized");
check(status.migration_delta === 0, "S6 creates no migration");
check(status.global_ssot_activation?.included_in_runtime_pr === false, "global SSOT activation is excluded from the Runtime PR");

check(receipt.includes("irrigation_execution_receipt_evidence_v1") && receipt.includes("CONTROLLED_REPLAY_DATASET"), "Receipt contract binds the controlled Replay Evidence type");
check(receipt.includes("assertCap05ReplayEvidenceSourceRecordHashV1"), "Receipt source-record hash is recomputed under the effective S1 policy");
check(receipt.includes("CAP05_RECEIPT_CROSS_HOUR_EXECUTION_FORBIDDEN"), "same-hour execution boundary is enforced");
check(receipt.includes("CAP05_RECEIPT_DEPTH_MM_ONLY_NO_VOLUME_CONVERSION"), "depth-mm-only policy rejects volume conversion");
check(receipt.includes("CAP05_RECEIPT_TARGET_EQUIVALENT_MISMATCH") && receipt.includes("multiplyFixedUnitsV1"), "covered amount is recomputed with fixed-point arithmetic");
check(receipt.includes("executionStatus === \"EXECUTED\"") && receipt.includes("validationStatus === \"VALIDATED\"") && receipt.includes("payload.source_quality !== \"FAIL\""), "eligibility combines independent execution, validation and quality axes");

const caller = service.match(/export type CommitCap05ActionFeedbackInputV1 = \{([\s\S]*?)\n\};/);
check(Boolean(caller), "S6 caller input type is discoverable");
if (caller) {
  const body = caller[1];
  check(body.includes("scope:") && body.includes("receipt_evidence_ref:") && body.includes("receipt_evidence_hash:"), "caller supplies only scope and Receipt identity");
  check(!body.includes("decision") && !body.includes("approved_plan") && !body.includes("actual_amount") && !body.includes("coverage") && !body.includes("runtime_config"), "caller cannot inject downstream authority");
}
check(service.includes("twin_approved_plan_binding_projection_v1") && service.includes("active_for_decision"), "service requires the exact active remediated Approved Plan");
check(service.includes("twin_decision_record_projection_v1") && service.includes("readCanonicalObject"), "service resolves the unique canonical G Decision");
check(service.includes("external_dispatch_evidence_v1") && service.includes("geox_dispatch_created"), "external Dispatch Evidence is validated without dispatch creation");
check(service.includes("buildCap05ActionFeedbackV1") && service.includes("commitCanonicalObject"), "service builds canonical H through existing persistence");
check(service.includes("logical_time_shifted: false") && service.includes("coverage_applied_by_adapter: false") && service.includes("volume_conversion_performed: false"), "no-shift, single-coverage and no-volume claims are explicit");
check(!service.includes("INSERT INTO facts") && !service.includes("recommendation") && !service.includes("model_activation"), "service creates no alternate persistence, Recommendation or activation authority");

check(adapter.includes("mapCap05ActionFeedbackQualityV1") && adapter.includes("sourceQuality === \"FAIL\" ? \"UNUSABLE\" : \"USABLE\""), "PASS/LIMITED and FAIL quality mapping is explicit");
check(adapter.includes("executed_amount_mm: payload.actual_amount_mm") && adapter.includes("coverage_fraction: payload.spatial_coverage_fraction"), "adapter preserves raw amount and coverage");
check(adapter.includes("CAP05_MULTIPLE_EXECUTION_EVENTS_FORBIDDEN_V1"), "single-event guard rejects multiple eligible events");
check(!adapter.includes("approved_amount_mm") && !adapter.includes("planned_amount_mm"), "adapter excludes approved and planned amount authority");

for (const needle of [
  "S4 canonical Human Decision predecessor is reproduced",
  "S5 remediated active Approved Plan predecessor is established",
  "exact status, time, amount, coverage and binding fields",
  "applies coverage exactly once",
  "H response-loss retry",
  "status mappings are explicit and independent",
  "forged Receipt source-record hash fails closed",
  "pending validation independently blocks State eligibility",
  "late Receipt preserves execution logical time",
  "single-event guard rejects multiple eligible execution events",
  "cross-hour execution Receipt fails closed",
  "volume unit is rejected",
  "forged covered-footprint amount fails closed",
  "exact Decision/Plan/Receipt evidence index",
  "creates no State, Forecast or Residual object",
]) check(acceptance.includes(needle), `PostgreSQL acceptance covers ${needle}`);

check(authority.includes("S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1"), "authority freezes Receipt full-record hash policy");
check(authority.includes("does not multiply coverage") && authority.includes("applies coverage exactly once"), "authority freezes one-time coverage application");
check(authority.includes("global SSOT activation: deferred"), "authority defers global SSOT activation until Runtime effectiveness");
check(status.preserved_nonclaims.includes("NO_RECEIPT_CONSUMING_STATE_TICK") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "State-tick and CAP-06 nonclaims remain explicit");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact seven-file S6 Runtime boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "S6 Runtime boundary excludes routes, web and migrations");
check(!expectedFiles.some((file) => file.includes("GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX") || file.includes("AUTHORIZATION-STATUS") || file.includes("DELIVERY-SLICE-STATUS") || file.endsWith("GEOX-MCFT-CAP-05-TASK.md")), "Runtime PR excludes global SSOT mutation");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
