// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs
// Purpose: verify the bounded S5 Approval Assertion and Approved Plan Replay Evidence binding slice without granting GEOX approval, dispatch or downstream feedback authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1";
const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const expectedFiles = [
  "apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
  "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
  "apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-EVIDENCE.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
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
const evidenceRepository = read(expectedFiles[1]);
const recoveryRepository = read(expectedFiles[2]);
const projections = read(expectedFiles[3]);
const service = read(expectedFiles[4]);
const map = read(expectedFiles[5]);
const matrix = json(expectedFiles[6]);
const authorization = json(expectedFiles[7]);
const delivery = json(expectedFiles[8]);
const authority = read(expectedFiles[9]);
const status = json(expectedFiles[10]);
const task = read(expectedFiles[11]);
const acceptance = read(expectedFiles[13]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s4Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === "MCFT-CAP-05.MCFT-13.HUMAN-DECISION-G-COMMIT-V1");
const s5Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const s6Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S6);

check(status.delivery_slice_id === S5 && status.status === "IMPLEMENTATION_CANDIDATE", "S5 candidate status is explicit");
check(status.s4_effectiveness?.effective === true && status.s4_effectiveness?.merged_main_gate === "PASS", "S4 merged-main effectiveness is prerequisite authority");
check(status.validation?.postgresql_acceptance_workflow === 29312412661 && status.validation?.postgresql_acceptance === "PASS", "S5 PostgreSQL acceptance is recorded");
check(status.service?.public_route_created === false && status.service?.canonical_object_delta === 0 && status.service?.transaction_family_delta === 0, "S5 adds no route, canonical object or transaction family");
check(status.next_delivery_slice_id === S6 && status.next_delivery_slice_authorized === false, "S6 is named but remains unauthorized");
check(status.migration_delta === 0, "S5 creates no migration");

check(contracts.includes("approval_assertion_evidence_v1") && contracts.includes("approved_irrigation_plan_snapshot_v1"), "Assertion and Plan remain distinct Replay Evidence record types");
check(contracts.includes("CONTROLLED_REPLAY_DATASET") && contracts.includes("CAP05_REPLAY_EVIDENCE_QUALITY_PASS_REQUIRED"), "controlled Replay source and PASS quality are required");
check(contracts.includes("geox_approval_request_created: false") && contracts.includes("geox_approval_authority_exercised: false"), "GEOX approval authority is explicitly forbidden");
check(contracts.includes("amount_difference_mm") && contracts.includes("CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_REQUIRED"), "nonzero scenario-approved amount difference requires a reason");
check(contracts.includes("supersedes_plan_evidence_ref") && contracts.includes("supersedes_plan_evidence_hash"), "Plan supersession uses exact Evidence ref/hash");
check(contracts.includes("CAP05_APPROVED_PLAN_ACTIVE_REQUIRED"), "candidate Plan Evidence must declare active_for_decision true");

check(service.includes("Cap05ApprovalPlanBindingServiceV1") && service.includes("commitApprovalPlanBinding"), "S5 binding service entrypoint exists");
check(service.includes("twin_decision_record_projection_v1") && service.includes("readCanonicalObject"), "service binds to one canonical G Decision");
check(service.includes("resolveCap05ScenarioOptionMemberV1") && service.includes("CAP05_PLAN_SCENARIO_AMOUNT_NOT_FROM_SELECTED_OPTION"), "scenario amount is derived from canonical selected option");
check(service.includes("EXTERNALLY_RECORDED") && service.includes("external_dispatch_evidence_v1") && service.includes("geox_dispatch_created"), "external Dispatch Evidence is validated without creating dispatch");
check(!service.includes("INSERT INTO facts") && !service.includes("recommendation") && !service.includes("model_activation"), "service delegates persistence and creates no Recommendation or activation authority");

check(evidenceRepository.includes("INSERT INTO facts") && evidenceRepository.includes("BEGIN") && evidenceRepository.includes("ROLLBACK"), "Assertion, Plan and projection execute under one PostgreSQL transaction");
check(evidenceRepository.includes("EXISTING_IDEMPOTENT_SUCCESS") && evidenceRepository.includes("CAP05_EVIDENCE_IDENTITY_CONFLICT"), "Evidence response-loss retry and identity conflict are explicit");
check(evidenceRepository.includes("pg_advisory_xact_lock") && evidenceRepository.includes("CAP05_ACTIVE_PLAN_SUPERSESSION_REQUIRED"), "one active Plan is serialized and explicit supersession is required");
check(evidenceRepository.includes("active_for_decision=false") && evidenceRepository.includes("CAP05_PLAN_PROJECTION_IDENTITY_CONFLICT"), "supersession mutates projection only and preserves historical identity");

check(projections.includes("supersedes_plan_evidence_ref") && projections.includes("supersedes_plan_evidence_hash"), "projection recovery input preserves supersession identity");
check(recoveryRepository.includes("CAP05_PLAN_RECOVERY_SUPERSESSION_PAIR_REQUIRED") && recoveryRepository.includes("CAP05_PLAN_RECOVERY_ACTIVE_CARDINALITY_CONFLICT"), "facts-based rebuild reapplies supersession and checks final cardinality");
check(recoveryRepository.includes("SET active_for_decision=false"), "rebuild deactivates superseded projection rows");

for (const needle of [
  "S4 canonical Human Decision predecessor is reproduced",
  "separate scenario and approved amounts",
  "same Approval and Plan Evidence replay",
  "forged Assertion identity",
  "not sourced from selected canonical option",
  "without reason code",
  "wrong Plan hash",
  "without explicit supersession",
  "switches only the active projection",
  "does not reactivate it",
  "reapplies supersession",
  "creates no new canonical Twin object",
]) check(acceptance.includes(needle), `PostgreSQL acceptance covers ${needle}`);

check(authority.includes("Neither record is a canonical Twin object") && authority.includes("GEOX does not create an approval request"), "authority document preserves Evidence/canonical and approval boundaries");
check(authority.includes("scenario_amount_mm = 15.000000") && authority.includes("approved_amount_mm = 14.000000"), "authority document freezes amount separation example");
check(authority.includes("preserves the old Plan Evidence fact unchanged") && authority.includes("marks only the old projection row inactive"), "authority document records projection-only supersession");

check(cap05?.active_delivery_slice_id === S5 && cap05?.implementation_status === "S5_IMPLEMENTATION_CANDIDATE", "global Matrix activates only S5 candidate");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix does not authorize S6");
check(s4Delivery?.status === "MERGED_EFFECTIVE" && s4Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S4 effective");
check(s5Delivery?.status === "IMPLEMENTATION_CANDIDATE" && s5Delivery?.runtime_source_authorized === true, "Delivery Status records S5 candidate");
check(s6Delivery?.status === "BLOCKED" && s6Delivery?.runtime_source_authorized === false, "Delivery Status preserves S6 block");
check(delivery.active_delivery_slice_id === S5 && delivery.status === "S5_IMPLEMENTATION_CANDIDATE", "Delivery Status top-level points to S5");
check(authorization.active_delivery_slice_id === S5 && authorization.next_authorized_slice_id_after_effectiveness === S6, "Authorization status advances to S5 and names S6 successor");
check(authorization.s4_effectiveness?.effective === true, "Authorization status records S4 effectiveness");
check(task.includes(S5) && /S5 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S5 implementation candidate");
check(/S6 authorized:\s*false/s.test(task), "task preserves S6 block");
check(map.includes("MCFT-CAP-05 S5 Approval Assertion and Approved Plan Evidence Binding Candidate"), "Implementation Map records S5 candidate");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 14-file S5 boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "S5 boundary excludes routes, web and migrations");
check(status.preserved_nonclaims.includes("NO_GEOX_APPROVAL_AUTHORITY") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "approval and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
