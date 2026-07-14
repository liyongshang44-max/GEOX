// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S4_HUMAN_DECISION_G.cjs
// Purpose: verify the bounded MCFT-CAP-05 S4 Human Decision service and G transaction slice without granting Approval/Plan or later feedback authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S4 = "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1";
const S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.ts",
  "apps/server/src/runtime/twin_runtime/human_decision_service_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-HUMAN-DECISION-G.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S4-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S4_HUMAN_DECISION_G.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_HUMAN_DECISION_G_DB.ts",
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

const contracts = read(expectedFiles[0]);
const service = read(expectedFiles[1]);
const map = read(expectedFiles[2]);
const matrix = json(expectedFiles[3]);
const authorization = json(expectedFiles[4]);
const delivery = json(expectedFiles[5]);
const authority = read(expectedFiles[6]);
const status = json(expectedFiles[7]);
const task = read(expectedFiles[8]);
const acceptance = read(expectedFiles[10]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s3Delivery = delivery.slices.find((slice) => slice.delivery_slice_id.includes("PERSISTENCE-IDEMPOTENCY-RECOVERY"));
const s4Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S4);

check(status.delivery_slice_id === S4 && status.status === "IMPLEMENTATION_CANDIDATE", "S4 candidate status is explicit");
check(status.s3_effectiveness?.effective === true && status.s3_effectiveness?.merged_main_gate === "PASS", "S3 merged-main effectiveness is prerequisite authority");
check(status.validation?.postgresql_acceptance_workflow === 29310564723 && status.validation?.postgresql_acceptance === "PASS", "S4 PostgreSQL acceptance is recorded");
check(status.service?.public_route_created === false && status.service?.transaction_family === "G_HUMAN_DECISION_LINK_COMMIT", "internal service uses existing G transaction without route");
check(status.next_delivery_slice_id === S5 && status.next_delivery_slice_authorized === false, "S5 is named but remains unauthorized");
check(status.migration_delta === 0, "S4 creates no migration");

check(service.includes("Cap05HumanDecisionServiceV1") && service.includes("commitHumanDecision"), "Human Decision service entrypoint exists");
check(service.includes("PostgresForecastScenarioRecoveryRepositoryV1") && service.includes("PostgresFeedbackPersistenceRepositoryV1"), "service reuses canonical Scenario readback and S3 persistence");
check(service.includes("adjudicateCap05DecisionSecondWriteV1"), "immutable second-write policy is enforced");
check(service.includes("twin_active_lineage_index_v1") && service.includes("twin_state_latest_index_v1"), "active lineage and revision are read from current projections");
check(service.includes("twin_scenario_latest_index_v1") && service.includes("twin_forecast_success_latest_index_v1"), "current Scenario is bound to latest successful Forecast");
check(service.includes("record_json->>'type'") && service.includes("controlled_human_decision_request_v1"), "Decision request Evidence is read from facts by exact type");
check(service.includes("CONTROLLED_REPLAY_DATASET") && service.includes("actor_class") && service.includes("HUMAN"), "controlled Replay and Human actor authority are enforced");
check(service.includes("CAP05_DECISION_REQUEST_NOT_AVAILABLE_AT_DECISION_TIME"), "Evidence availability is checked against decided_at");
check(service.includes("CAP05_DECISION_REQUEST_NON_CURRENT_SCENARIO") && service.includes("CAP05_DECISION_REQUEST_OPTION_IDENTITY_MISMATCH"), "stale Scenario and forged option identity fail closed");

const callerInputBlock = service.match(/export type CommitCap05HumanDecisionInputV1 = \{([\s\S]*?)\n\};/);
check(Boolean(callerInputBlock), "caller input type is discoverable");
if (callerInputBlock) {
  const body = callerInputBlock[1];
  check(body.includes("scope:") && body.includes("decision_request_evidence_ref:") && body.includes("decision_request_evidence_hash:") && body.includes("decided_at:"), "caller supplies only scope, Evidence identity and decided_at");
  check(!body.includes("actor_ref") && !body.includes("scenario_set") && !body.includes("selected_option") && !body.includes("runtime_config"), "caller cannot inject actor, Scenario, option or Runtime Config authority");
}

check(contracts.includes("assumedIrrigationMm") && contracts.includes("CAP05_SCENARIO_MEMBER_AMOUNT_MISMATCH"), "option member identity matches frozen S1 0/15/25 amount policy");
check(contracts.includes("scenario_set_ref: scenarioSet.object_id") && contracts.includes("scenario_set_hash: scenarioSet.determinism_hash"), "option member hash includes exact Scenario ref/hash");
check(authority.includes("Hashing the entire mutable option representation is not the v1 member-identity authority"), "authority document records cross-slice hash remediation");

for (const [needle, label] of [
  ["forged Decision-request Evidence hash", "forged Evidence hash"],
  ["forged selected-option hash", "forged selected-option hash"],
  ["non-current Scenario", "non-current Scenario"],
  ["Evidence unavailable at decided_at", "Evidence unavailable at decided_at"],
  ["non-Human actor", "non-Human actor"],
  ["second Decision with different selected option", "different second Decision"],
  ["wrong Reality scope", "wrong Reality scope"],
]) check(acceptance.includes(needle), `PostgreSQL acceptance covers ${label}`);
check(acceptance.includes("downstream_facts: 0") && acceptance.includes("G commit infers no Approval, Plan, Task, Action Feedback, State or checkpoint write"), "acceptance proves no inferred downstream writes");
check(acceptance.includes("EXISTING_IDEMPOTENT_SUCCESS") && acceptance.includes("CAP05_DECISION_IMMUTABLE_CONFLICT"), "retry and immutable conflict are tested");

check(cap05?.active_delivery_slice_id === S4 && cap05?.implementation_status === "S4_IMPLEMENTATION_CANDIDATE", "global Matrix activates only S4 candidate");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix does not authorize S5");
check(s3Delivery?.status === "MERGED_EFFECTIVE" && s3Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S3 effective");
check(s4Delivery?.status === "IMPLEMENTATION_CANDIDATE" && s4Delivery?.runtime_source_authorized === true, "Delivery Status records S4 candidate");
check(delivery.active_delivery_slice_id === S4 && delivery.status === "S4_IMPLEMENTATION_CANDIDATE", "Delivery Status top-level points to S4");
check(authorization.active_delivery_slice_id === S4 && authorization.next_authorized_slice_id_after_effectiveness === S5, "Authorization status advances to S4 and names S5 successor");
check(authorization.s3_effectiveness?.effective === true, "Authorization status records S3 effectiveness");
check(task.includes(S4) && /S4 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S4 implementation candidate");
check(/S5 authorized:\s*false/s.test(task), "task preserves S5 block");
check(map.includes("MCFT-CAP-05 S4 Human Decision G Commit Candidate"), "Implementation Map records S4 candidate");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 11-file S4 boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web")), "S4 boundary excludes routes and web");
check(!service.includes("recommendation") && !service.includes("model_activation") && !service.includes("INSERT INTO facts"), "service creates no Recommendation, activation or alternate persistence path");
check(status.preserved_nonclaims.includes("NO_APPROVAL_AUTHORITY") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "Approval and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
