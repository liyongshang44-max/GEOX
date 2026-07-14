// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs
// Purpose: verify the bounded MCFT-CAP-05 S5 Decision → Approval Assertion → Approved Plan binding slice without granting approval, dispatch or Action Feedback authority.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1";
const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const expectedFiles = [
  "apps/server/src/domain/twin_runtime/approved_plan_binding_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_approved_plan_binding_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
  "apps/server/src/runtime/twin_runtime/approved_plan_binding_service_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PERSISTENCE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-APPROVAL-PLAN-BINDING.md",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_APPROVAL_PLAN_BINDING.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
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

const contract = read(expectedFiles[0]);
const planRepository = read(expectedFiles[1]);
const genericRepository = read(expectedFiles[2]);
const service = read(expectedFiles[3]);
const map = read(expectedFiles[4]);
const matrix = json(expectedFiles[5]);
const authorization = json(expectedFiles[6]);
const delivery = json(expectedFiles[7]);
const persistence = json(expectedFiles[8]);
const authority = read(expectedFiles[9]);
const status = json(expectedFiles[10]);
const task = read(expectedFiles[11]);
const acceptance = read(expectedFiles[13]);
const s3Regression = read(expectedFiles[14]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s4Delivery = delivery.slices.find((slice) => slice.delivery_slice_id.includes("HUMAN-DECISION-G-COMMIT"));
const s5Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S5);

check(status.delivery_slice_id === S5 && status.status === "IMPLEMENTATION_CANDIDATE", "S5 candidate status is explicit");
check(status.s4_effectiveness?.effective === true && status.s4_effectiveness?.merged_main_gate === "PASS", "S4 merged-main effectiveness is prerequisite authority");
check(status.validation?.recovery_integration_workflow === 29312506965, "S5 integration workflow is recorded");
check(status.validation?.s5_postgresql_acceptance === "PASS" && status.validation?.s3_recovery_regression === "PASS", "S5 PostgreSQL proof and S3 recovery regression pass");
check(status.next_delivery_slice_id === S6 && status.next_delivery_slice_authorized === false, "S6 is named but remains unauthorized");
check(status.migration_delta === 0, "S5 creates no migration");
check(status.acceptance_results?.canonical_twin_fact_delta === 0, "S5 creates no canonical Twin fact");

check(contract.includes("CAP05_APPROVAL_ASSERTION_RECORD_TYPE_V1") && contract.includes("CAP05_APPROVED_PLAN_RECORD_TYPE_V1"), "Assertion and Plan Evidence contracts are distinct");
check(contract.includes("CAP05_ASSERTION_PLAN_EVIDENCE_MUST_BE_DISTINCT"), "Assertion and Plan cannot share one Evidence identity");
check(contract.includes("geox_approval_authority_exercised: false") && contract.includes("geox_approval_request_created: false"), "GEOX approval authority remains false");
check(contract.includes("CAP05_GEOX_APPROVAL_AUTHORITY_FORBIDDEN"), "forbidden GEOX approval assertion fails closed");
for (const token of [
  "CAP05_ASSERTION_DECISION_REQUEST_HASH_MISMATCH",
  "CAP05_ASSERTION_OPTION_HASH_MISMATCH",
  "CAP05_PLAN_ASSERTION_HASH_MISMATCH",
  "CAP05_PLAN_DECISION_REQUEST_HASH_MISMATCH",
  "CAP05_PLAN_OPTION_HASH_MISMATCH",
]) check(contract.includes(token), `exact linkage guard ${token} exists`);
check(contract.includes("approvedUnits - scenarioUnits") && contract.includes("CAP05_PLAN_AMOUNT_DIFFERENCE_MISMATCH"), "approved-versus-Scenario amount difference is exact");
check(contract.includes("CAP05_PLAN_APPROVED_AMOUNT_OUT_OF_RANGE") && contract.includes("CAP05_PLAN_AMOUNT_DIFFERENCE_REASON_REQUIRED"), "approved amount bounds and reason codes are enforced");
check(contract.includes("CAP05_PLAN_VALIDITY_WINDOW_INVALID") && contract.includes("CAP05_PLAN_EVIDENCE_NOT_AVAILABLE_AS_OF"), "validity and availability are enforced");
check(contract.includes("CAP05_PLAN_DISPATCH_DISPOSITION_V1 = \"NOT_OBSERVED\""), "dispatch absence disposition is explicit");
check(contract.includes("CAP05_PLAN_ACTIVE_PREDECESSOR_MUST_BE_SUPERSEDED") && contract.includes("CAP05_PLAN_SUPERSESSION_PREDECESSOR_MISMATCH"), "implicit and forged supersession fail closed");

check(planRepository.includes("twin_approved_plan_binding_projection_v1"), "S5 reuses the existing Plan binding projection");
check(planRepository.includes("UPDATE twin_approved_plan_binding_projection_v1") && planRepository.includes("active_for_decision=false"), "supersession deactivates projection state with CAS");
check(planRepository.includes("rebuildAllBindingsWithClientV1"), "validated Plan binding recovery entrypoint exists");
check(!planRepository.includes("INSERT INTO facts") && !planRepository.includes("UPDATE facts"), "Plan binding repository never writes canonical facts");
check(planRepository.includes("validated_binding") && planRepository.includes("approval_assertion_evidence"), "projection stores validated trace and supporting Assertion Evidence");
check(genericRepository.includes("PostgresApprovedPlanBindingRepositoryV1") && genericRepository.includes("planRecovery.bindings_rebuilt"), "generic CAP-05 recovery delegates Plan reconstruction to S5 validator");
check(genericRepository.includes("validatedBinding.approval_assertion_ref"), "feedback-cycle recovery consumes validated binding trace");

const inputBlock = service.match(/export type BindCap05ApprovedPlanInputV1 = \{([\s\S]*?)\n\};/);
check(Boolean(inputBlock), "S5 caller input type is discoverable");
if (inputBlock) {
  const body = inputBlock[1];
  for (const field of ["decision_ref", "decision_hash", "approval_assertion_ref", "approval_assertion_hash", "approved_plan_ref", "approved_plan_hash", "as_of"]) {
    check(body.includes(`${field}:`), `caller supplies exact ${field}`);
  }
  check(!body.includes("validated_binding") && !body.includes("approved_amount_mm") && !body.includes("active_for_decision"), "caller cannot inject validated binding semantics");
}
check(!service.includes("INSERT INTO facts") && !service.includes("recommendation") && !service.includes("model_activation"), "S5 service creates no canonical fact, Recommendation or activation path");

for (const token of [
  "missing Approval Assertion",
  "Plan → Assertion hash mismatch",
  "non-approved Assertion",
  "wrong Plan Reality scope",
  "amount difference must be exact",
  "invalid Plan validity window",
  "inactive Plan Snapshot",
  "explicit Plan ref/hash supersession",
  "forged supersession predecessor hash",
  "projection deletion rebuilds validated bindings",
]) check(acceptance.includes(token), `PostgreSQL acceptance covers ${token}`);
check(acceptance.includes("canonicalBefore") && acceptance.includes("canonicalTwinCount"), "acceptance proves canonical Twin count is unchanged");
check(s3Regression.includes("for (const evidence of [approval, plan])"), "S3 recovery regression supplies Assertion and Plan Evidence");

check(persistence.approved_plan_binding?.validator === "validateCap05ApprovedPlanBindingV1", "Persistence Matrix names S5 Plan validator");
check(persistence.approved_plan_binding?.explicit_supersession_required === true, "Persistence Matrix freezes explicit supersession");
check(persistence.recovery?.approved_plan_binding_entrypoint === "PostgresApprovedPlanBindingRepositoryV1.rebuildAllBindingsWithClientV1", "Persistence Matrix records validated Plan recovery");

check(cap05?.active_delivery_slice_id === S5 && cap05?.implementation_status === "S5_IMPLEMENTATION_CANDIDATE", "global Matrix activates only S5 candidate");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix does not authorize S6");
check(s4Delivery?.status === "MERGED_EFFECTIVE" && s4Delivery?.effectiveness_condition_satisfied === true, "Delivery Status settles S4 effective");
check(s5Delivery?.status === "IMPLEMENTATION_CANDIDATE" && s5Delivery?.runtime_source_authorized === true, "Delivery Status records S5 candidate");
check(delivery.active_delivery_slice_id === S5 && delivery.status === "S5_IMPLEMENTATION_CANDIDATE", "Delivery Status top-level points to S5");
check(authorization.active_delivery_slice_id === S5 && authorization.next_authorized_slice_id_after_effectiveness === S6, "Authorization status advances to S5 and names S6 successor");
check(authorization.s4_effectiveness?.effective === true, "Authorization status records S4 effectiveness");
check(task.includes(S5) && /S5 status:\s*IMPLEMENTATION_CANDIDATE/s.test(task), "task records S5 implementation candidate");
check(/S6 authorized:\s*false/s.test(task), "task preserves S6 block");
check(map.includes("MCFT-CAP-05 S5 Approval and Plan Evidence Binding Candidate"), "Implementation Map records S5 candidate");
check(authority.includes("Hashing") === false && authority.includes("projection is neither canonical approval history nor approval authority"), "authority document preserves projection and approval boundary");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 15-file S5 boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "S5 boundary excludes routes, web and migrations");
check(status.preserved_nonclaims.includes("NO_GEOX_APPROVAL_AUTHORITY") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "Approval and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
