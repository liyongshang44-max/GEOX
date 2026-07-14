// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTION_FEEDBACK_H.cjs
// Purpose: verify the bounded S6 Receipt-to-H Action Feedback and executed-irrigation adapter slice without granting State-tick or later Forecast/Residual authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.ts",
  "apps/server/src/evidence/twin_runtime/execution_receipt_evidence_contract_v1.ts",
  "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-ACTION-FEEDBACK-H.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S6-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
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
const receiptContract = read(expectedFiles[1]);
const service = read(expectedFiles[2]);
const map = read(expectedFiles[3]);
const matrix = json(expectedFiles[4]);
const authorization = json(expectedFiles[5]);
const delivery = json(expectedFiles[6]);
const authority = read(expectedFiles[7]);
const status = json(expectedFiles[8]);
const task = read(expectedFiles[9]);
const acceptance = read(expectedFiles[11]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s5Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1");
const s6Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S6);
const s7Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S7);

check(status.delivery_slice_id === S6 && status.status === "IMPLEMENTATION_CANDIDATE", "S6 candidate status is explicit");
check(status.s5_effectiveness?.effective === true && status.s5_effectiveness?.merged_main_gate === "PASS", "S5 merged-main effectiveness is prerequisite authority");
check(status.validation?.postgresql_acceptance_workflow === 29313657871 && status.validation?.postgresql_acceptance === "PASS", "S6 PostgreSQL acceptance is recorded");
check(status.canonical_action_feedback?.object_type === "twin_action_feedback_v1" && status.canonical_action_feedback?.transaction_family === "H_ACTION_FEEDBACK_COMMIT", "S6 uses frozen canonical H object and transaction family");
check(status.next_delivery_slice_id === S7 && status.next_delivery_slice_authorized === false, "S7 is named but remains unauthorized");
check(status.migration_delta === 0, "S6 creates no migration");

check(receiptContract.includes("irrigation_execution_receipt_evidence_v1") && receiptContract.includes("CONTROLLED_REPLAY_DATASET"), "Receipt contract binds the controlled Replay Evidence type");
check(receiptContract.includes("FULL_PARTIAL_UNKNOWN_NONE_TO_CANONICAL_EXECUTION_V1"), "execution status mapping policy is explicit");
check(receiptContract.includes("PASSED_LIMITED_FAILED_PENDING_TO_CANONICAL_VALIDATION_V1"), "validation status mapping policy is explicit");
check(receiptContract.includes("DEPTH_MM_ONLY_NO_VOLUME_CONVERSION_V1") && receiptContract.includes("CAP05_RECEIPT_DEPTH_MM_ONLY_NO_VOLUME_CONVERSION"), "depth-mm-only policy rejects volume conversion");
check(receiptContract.includes("CAP05_RECEIPT_CROSS_HOUR_EXECUTION_FORBIDDEN"), "same-hour execution boundary is enforced");
check(receiptContract.includes("CAP05_RECEIPT_TARGET_EQUIVALENT_MISMATCH") && receiptContract.includes("multiplyFixedUnitsV1"), "covered-footprint amount is recomputed by fixed-point arithmetic");
check(receiptContract.includes("executionStatus === \"EXECUTED\"") && receiptContract.includes("validationStatus === \"VALIDATED\"") && receiptContract.includes("payload.source_quality !== \"FAIL\""), "eligibility combines independent execution, validation and quality axes");

const callerInputBlock = service.match(/export type CommitCap05ActionFeedbackInputV1 = \{([\s\S]*?)\n\};/);
check(Boolean(callerInputBlock), "S6 caller input type is discoverable");
if (callerInputBlock) {
  const body = callerInputBlock[1];
  check(body.includes("scope:") && body.includes("receipt_evidence_ref:") && body.includes("receipt_evidence_hash:"), "caller supplies only scope and Receipt Evidence identity");
  check(!body.includes("decision") && !body.includes("approved_plan") && !body.includes("actual_amount") && !body.includes("coverage") && !body.includes("runtime_config"), "caller cannot inject Decision, Plan, amount, coverage or Runtime Config authority");
}

check(service.includes("Cap05ActionFeedbackNormalizationServiceV1") && service.includes("commitActionFeedback"), "S6 normalization service entrypoint exists");
check(service.includes("twin_approved_plan_binding_projection_v1") && service.includes("active_for_decision"), "service requires the exact active Approved Plan");
check(service.includes("twin_decision_record_projection_v1") && service.includes("readCanonicalObject"), "service resolves the unique canonical G Decision");
check(service.includes("external_dispatch_evidence_v1") && service.includes("EXTERNALLY_RECORDED") && service.includes("geox_dispatch_created"), "external Dispatch Evidence is validated without dispatch creation");
check(service.includes("buildCap05ActionFeedbackV1") && service.includes("commitCanonicalObject"), "service builds canonical H and delegates to existing persistence");
check(service.includes("logical_time_shifted: false") && service.includes("coverage_applied_by_adapter: false") && service.includes("volume_conversion_performed: false"), "no-shift, single-coverage and no-volume claims are explicit");
check(!service.includes("INSERT INTO facts") && !service.includes("recommendation") && !service.includes("model_activation"), "service creates no alternate persistence, Recommendation or activation authority");

check(adapter.includes("mapCap05ActionFeedbackQualityV1") && adapter.includes("sourceQuality === \"FAIL\" ? \"UNUSABLE\" : \"USABLE\""), "PASS/LIMITED and FAIL quality mapping is explicit");
check(adapter.includes("executed_amount_mm: payload.actual_amount_mm") && adapter.includes("coverage_fraction: payload.spatial_coverage_fraction"), "adapter preserves raw amount and coverage fields");
check(adapter.includes("CAP05_MULTIPLE_EXECUTION_EVENTS_FORBIDDEN_V1"), "single-event guard rejects multiple eligible events");
check(!adapter.includes("approved_amount_mm") && !adapter.includes("planned_amount_mm"), "adapter excludes approved and planned amount authority");

for (const needle of [
  "S4 canonical Human Decision predecessor is reproduced",
  "S5 active Approved Plan predecessor is established",
  "exact status, time, amount, coverage and binding fields",
  "applies coverage exactly once",
  "H response-loss retry",
  "status mappings are explicit and independent",
  "pending validation independently blocks State eligibility",
  "late Receipt preserves execution logical time",
  "single-event guard rejects multiple eligible execution events",
  "cross-hour execution Receipt fails closed",
  "volume unit is rejected",
  "forged covered-footprint amount fails closed",
  "exact Decision/Plan/Receipt evidence index",
  "creates no State, Forecast or Residual object",
]) check(acceptance.includes(needle), `PostgreSQL acceptance covers ${needle}`);

check(authority.includes("actual_amount_mm = 13.600000") && authority.includes("spatial_coverage_fraction = 0.910000") && authority.includes("target_scope_equivalent_irrigation_mm = 12.376000"), "authority document freezes standard amount and coverage values");
check(authority.includes("does not multiply coverage") && authority.includes("single authority that applies coverage exactly once"), "authority document freezes one-time coverage application");
check(authority.includes("An execution may be `EXECUTED` while validation is `NOT_YET_VALIDATED`"), "authority document records validation orthogonality");
check(authority.includes("A late Receipt does not shift logical execution time"), "authority document records late no-shift semantics");

check(cap05?.active_delivery_slice_id === S6 && cap05?.implementation_status === "S6_IMPLEMENTATION_CANDIDATE", "global Matrix activates only S6 candidate");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix does not authorize S7");
check(s5Delivery?.status === "MERGED_EFFECTIVE" && s5Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S5 effective");
check(s6Delivery?.status === "IMPLEMENTATION_CANDIDATE" && s6Delivery?.runtime_source_authorized === true, "Delivery Status records S6 candidate");
check(s7Delivery?.status === "BLOCKED" && s7Delivery?.runtime_source_authorized === false, "Delivery Status preserves S7 block");
check(delivery.active_delivery_slice_id === S6 && delivery.status === "S6_IMPLEMENTATION_CANDIDATE", "Delivery Status top-level points to S6");
check(authorization.active_delivery_slice_id === S6 && authorization.next_authorized_slice_id_after_effectiveness === S7, "Authorization status advances to S6 and names S7 successor");
check(authorization.s5_effectiveness?.effective === true, "Authorization status records S5 effectiveness");
check(task.includes(S6) && /S6 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S6 implementation candidate");
check(/S7 authorized:\s*false/s.test(task), "task preserves S7 block");
check(map.includes("MCFT-CAP-05 S6 Action Feedback H Commit and Adapter Candidate"), "Implementation Map records S6 candidate");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 12-file S6 boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "S6 boundary excludes routes, web and migrations");
check(status.preserved_nonclaims.includes("NO_RECEIPT_CONSUMING_STATE_TICK") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "State-tick and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
