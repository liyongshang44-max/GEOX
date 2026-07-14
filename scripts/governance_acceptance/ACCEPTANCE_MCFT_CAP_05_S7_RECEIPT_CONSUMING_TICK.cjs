// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK.cjs
// Purpose: verify the bounded S7 canonical-H receipt-consuming A1 tick without granting range, restart, residual, outcome-trace or successor authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1";
const expectedFiles = [
  "apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.ts",
  "apps/server/src/runtime/twin_runtime/action_feedback_tick_selector_v1.ts",
  "apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S7-RECEIPT-CONSUMING-TICK.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S7-STATUS.json",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_RECEIPT_CONSUMING_TICK_DB.ts",
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

const source = read(expectedFiles[0]);
const selector = read(expectedFiles[1]);
const service = read(expectedFiles[2]);
const authority = read(expectedFiles[3]);
const status = json(expectedFiles[4]);
const wrapper = read(expectedFiles[5]);
const integration = read(expectedFiles[7]);
const database = read(expectedFiles[8]);
const authorization = json("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json");

check(status.delivery_slice_id === S7 && status.status === "IMPLEMENTATION_CANDIDATE", "S7 candidate identity is explicit");
check(status.baseline_main_commit === "a9bf75333871ac62021679c1dac756be9e30cebe", "S7 baseline is the activated canonical main");
check(status.authorization?.activation_pr_number === 2463 && status.authorization?.runtime_source_authorized === true, "S7 explicit activation is prerequisite authority");
check(status.s6_effectiveness?.effective === true, "S6 merged-effective predecessor is frozen");
check(status.canonical_object_type_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0, "S7 creates no object type, transaction family or migration");
check(status.global_ssot_settlement_included === false, "Runtime PR defers global SSOT settlement");
check(authorization.implementation_status === "S7_AUTHORIZED_NOT_STARTED" && authorization.active_delivery_slice_id === S7, "baseline Authorization Status explicitly authorizes S7");

for (const token of [
  "AVAILABLE_TO_RUNTIME_AT_LE_TARGET_LOGICAL_TIME_V1",
  "NO_SHIFT_NO_AUTOMATIC_HISTORY_REWRITE_V1",
  "OPEN_START_CLOSED_END_PT1H_V1",
  "EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1",
  "NOT_ESTABLISHED",
  "COVERED_FOOTPRINT_AVERAGE_DEPTH_MM_V1",
  "ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1",
]) check(selector.includes(token), `selector freezes policy ${token}`);
check(selector.includes("validateCap05ActionFeedbackV1") && selector.includes("adaptCap05ActionFeedbackToExecutedIrrigationV1"), "selector validates canonical H and reuses the S6 adapter");
check(selector.includes("CAP05_RECEIPT_TICK_CONFLICTING_DUPLICATE") && selector.includes("CAP05_MULTIPLE_ACTION_FEEDBACK_EVENTS_FOR_TICK"), "selector fails closed on conflicting duplicates and multiple distinct events");
check(selector.includes("EXCLUDED_FUTURE") && selector.includes("EXCLUDED_LATE") && selector.includes("EXCLUDED_INELIGIBLE"), "selector preserves explicit excluded-feedback dispositions");
check(selector.includes("semantic_digest"), "selector emits deterministic trace digest");

check(service.includes("Cap04ForecastScenarioSingleTickServiceV1"), "S7 composes the existing CAP-04 A1 service");
check(service.includes("CAP05_RECEIPT_TICK_LEGACY_AND_ACTION_FEEDBACK_CONFLICT"), "S7 rejects simultaneous legacy execution Evidence and canonical H");
check(service.includes("CAP05_RECEIPT_TICK_ACTION_FEEDBACK_REQUIRED"), "receipt-consuming tick requires one selected H object");
check(service.includes("validateCap05ReceiptConsumingRuntimePoliciesV1"), "S7 requires explicit CAP-05 Runtime Config policies");
check(service.includes("coverage_applied_by_adapter: false") && service.includes("volume_conversion_performed: false"), "adapter applies neither coverage nor volume conversion");
check(service.includes("source_record_id: feedback.object_id") && service.includes("source_record_hash: feedback.determinism_hash"), "Evidence Window adapter preserves exact H ref/hash authority");
check(!service.includes("executeHourlyWaterBalanceV1") && !service.includes("executeCap04Pure72hForecastMathV1"), "S7 does not fork Dynamics or Forecast math");
check(!service.includes("INSERT INTO facts") && !service.includes("UPDATE facts"), "S7 composition does not create an alternate persistence path");

check(source.includes("JOIN facts f ON f.fact_id = p.source_fact_id"), "PostgreSQL source reads projection pointers through canonical facts");
check(source.includes("validateCap05ActionFeedbackV1") && source.includes("exactProjectionMatchV1"), "PostgreSQL source validates canonical H and projection identity");
check(!source.includes("INSERT INTO") && !source.includes("UPDATE ") && !source.includes("DELETE FROM"), "PostgreSQL source is read-only");

for (const needle of [
  "normal eight-member A1",
  "selects the exact canonical H object",
  "records evidence_cutoff_time",
  "applies 13.600000 x 0.910000 exactly once",
  "successful 72-hour Forecast",
  "three ordered 72-point Scenario trajectories",
  "zero Replay Evidence or Action Feedback reselection",
  "identical Action Feedback duplicates collapse deterministically",
  "conflicting duplicate Action Feedback fails closed",
  "multiple distinct execution events",
  "late Action Feedback is excluded",
  "future Action Feedback is never consumed",
  "Runtime Config policies are not pinned",
]) check(integration.includes(needle), `in-memory acceptance covers ${needle}`);
check(integration.includes("assert.equal(pass, 15)"), "in-memory acceptance freezes 15 PASS cardinality");

for (const needle of [
  "S6 predecessor creates",
  "three exact canonical H objects",
  "chooses the eligible current-window H",
  "pending-validation and late H",
  "zero canonical or projection writes",
  "exact Reality scope",
]) check(database.includes(needle), `PostgreSQL acceptance covers ${needle}`);
check(database.includes("assert.equal(pass, 5)"), "PostgreSQL acceptance freezes 5 PASS cardinality");

check(authority.includes("normal CAP-04 A1") || authority.includes("unchanged CAP-04 A1"), "authority document freezes A1 reuse");
check(authority.includes("Forecast points = 72") && authority.includes("Scenario option count = 3"), "authority document freezes Forecast and Scenario cardinality");
check(authority.includes("global SSOT settlement: deferred"), "authority document defers SSOT settlement");
check(wrapper.includes("MCFT_CAP_05_S7_RECEIPT_CONSUMING_TICK_GATE_V1"), "standard acceptance permanently invokes S7 validation");
check(status.preserved_nonclaims.includes("NO_FORECAST_RESIDUAL_COMMIT") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "Residual and CAP-06 nonclaims remain explicit");

const changed = (() => {
  try {
    return execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
      .trim().split(/\r?\n/).filter(Boolean).sort();
  } catch {
    return null;
  }
})();
const mode = process.argv.includes("--candidate") ? "candidate" : process.argv.includes("--postmerge") ? "postmerge" : "auto";
if (mode === "candidate") {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact nine-file S7 Runtime boundary");
} else if (mode === "postmerge") {
  check(changed === null || changed.length === 0, "postmerge main has no S7 delta against origin/main");
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness evidence");
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, "auto mode recognizes exact S7 candidate boundary");
} else if (changed && changed.length === 0) {
  check(true, "auto mode recognizes merged-main S7 Runtime");
} else {
  check(true, "auto mode enforces static S7 invariants on a later branch");
}

check(!expectedFiles.some((file) => file.includes("migrations") || file.includes("routes") || file.startsWith("apps/web/")), "S7 boundary excludes migrations, routes and web");
check(!expectedFiles.some((file) => file.includes("GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX") || file.includes("AUTHORIZATION-STATUS") || file.includes("DELIVERY-SLICE-STATUS") || file.endsWith("GEOX-MCFT-CAP-05-TASK.md")), "Runtime PR excludes global SSOT mutation");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
