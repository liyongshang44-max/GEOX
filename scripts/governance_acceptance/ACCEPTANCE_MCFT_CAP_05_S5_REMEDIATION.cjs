// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION.cjs
// Purpose: verify the bounded S5 recovery/hash/fixed-point remediation without reopening or replacing the merged S5 delivery slice.
// Boundary: static governance and repository-shape checks only; no database mutation, Runtime execution, route, network or wall-clock authority.

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const REMEDIATION = "MCFT-CAP-05.S5.RECOVERY-HASH-FIXED-POINT-REMEDIATION-V1";
const S5 = "MCFT-CAP-05.MCFT-01-13.APPROVAL-PLAN-EVIDENCE-BINDING-V1";
const S6 = "MCFT-CAP-05.MCFT-15.ACTION-FEEDBACK-H-COMMIT-ADAPTER-V1";
const expectedFiles = [
  "apps/server/src/evidence/twin_runtime/approval_plan_evidence_contracts_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_approval_plan_recovery_repository_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.ts",
  "apps/server/src/projections/twin_runtime/feedback_persistence_projection_v1.ts",
  "apps/server/src/runtime/twin_runtime/approval_plan_binding_service_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S5-REMEDIATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_APPROVAL_PLAN_BINDING_DB.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S5_REMEDIATION_DB.ts",
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

const evidence = read(expectedFiles[0]);
const evidenceRepository = read(expectedFiles[1]);
const recoveryRepository = read(expectedFiles[2]);
const genericRecovery = read(expectedFiles[3]);
const projection = read(expectedFiles[4]);
const service = read(expectedFiles[5]);
const map = read(expectedFiles[6]);
const matrix = json(expectedFiles[7]);
const authorization = json(expectedFiles[8]);
const delivery = json(expectedFiles[9]);
const status = json(expectedFiles[10]);
const task = read(expectedFiles[11]);
const s5Acceptance = read(expectedFiles[13]);
const s3Acceptance = read(expectedFiles[14]);
const remediationAcceptance = read(expectedFiles[15]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === "MCFT-CAP-05");
const s5Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const s6Delivery = delivery.slices.find((slice) => slice.delivery_slice_id === S6);

check(status.remediation_id === REMEDIATION && status.status === "IMPLEMENTATION_CANDIDATE", "bounded remediation candidate identity is explicit");
check(status.duplicate_audit?.independent_remediation_pr_found_before_creation === false, "duplicate audit confirms no prior independent remediation PR");
check(status.duplicate_audit?.merged_s5_pr === 2451 && status.duplicate_audit?.closed_duplicate_s5_pr === 2450, "merged S5 and closed duplicate are distinguished");
check(status.s5_effectiveness?.effective === true && status.s5_effectiveness?.merged_main_gate === "PASS", "merged S5 remains the effective implementation baseline");
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0, "remediation adds no object, transaction family or migration");
check(status.successor_pr === 2456 && status.successor_authorized === false, "S6 remains blocked until remediation effectiveness");

check(evidence.includes("S1_FULL_RECORD_MINUS_HASH_AND_MATERIALIZED_LOCATION_V1"), "frozen S1 Evidence hash policy is named");
check(evidence.includes('key === "source_record_hash" || key === "materialized_file_location"'), "Evidence hash excludes only the frozen two fields");
check(evidence.includes("CAP05_REPLAY_EVIDENCE_SOURCE_RECORD_HASH_MISMATCH"), "Evidence hash mismatch fails closed");
check(evidence.includes("WATER_AMOUNT_SCALE_V1") && evidence.includes("parseFixedDecimalV1") && evidence.includes("formatFixedDecimalV1"), "S5 Evidence amount validation uses the existing fixed-point authority");
check(!evidence.includes("Number(scenarioAmount)") && !evidence.includes("Number(approvedAmount)"), "S5 amount arithmetic no longer uses Number authority");
check(evidence.includes("validateCap05ApprovalPlanDecisionBindingV1"), "one shared Decision-Assertion-Plan validator exists");
check(evidence.includes("CAP05_PLAN_SCENARIO_AMOUNT_NOT_FROM_SELECTED_OPTION"), "shared validator rechecks selected-option amount");
check(evidence.includes("CAP05_APPROVAL_PLAN_EVIDENCE_NOT_AVAILABLE_AS_OF"), "shared validator checks Evidence availability as-of");

check(evidenceRepository.includes("assertCap05ReplayEvidenceSourceRecordHashV1"), "forward Evidence append validates frozen source hash");
check(evidenceRepository.includes("INSERT INTO facts") && evidenceRepository.includes("ROLLBACK"), "existing atomic Evidence append remains intact");
check(recoveryRepository.includes("validateCap05ApprovalPlanDecisionBindingV1"), "recovery calls the same shared binding validator");
check(recoveryRepository.includes("CAP05_PLAN_RECOVERY_ASSERTION_CARDINALITY"), "recovery requires one exact Approval Assertion fact");
check(recoveryRepository.includes("CAP05_PLAN_RECOVERY_DECISION_CARDINALITY"), "recovery requires one exact canonical G Decision");
check(recoveryRepository.includes("CAP05_PLAN_RECOVERY_ACTIVE_PREDECESSOR_MUST_BE_SUPERSEDED"), "recovery rejects implicit Plan replacement");
check(recoveryRepository.includes("CAP05_PLAN_RECOVERY_SUPERSESSION_CAS_CONFLICT"), "recovery supersession uses projection CAS");
check(!recoveryRepository.includes("INSERT INTO facts") && !recoveryRepository.includes("UPDATE facts"), "remediation recovery never mutates facts");

check(genericRecovery.includes("PostgresApprovalPlanRecoveryRepositoryV1"), "generic CAP-05 recovery delegates Plan rebuild to validated remediation repository");
check(genericRecovery.includes("planRecovery.approved_plan_bindings_rebuilt"), "generic recovery reports validated Plan rebuild count");
check(!genericRecovery.includes("const planFacts = await client.query("), "blind Plan payload projection loop is removed from generic recovery");
check(projection.includes("WATER_AMOUNT_SCALE_V1") && projection.includes("parseFixedDecimalV1"), "projection formatting shares the fixed-point authority");
check(service.includes("validateCap05ApprovalPlanDecisionBindingV1"), "forward S5 service shares the remediation validator");
check(service.includes("normalizeCap05WaterAmountV1"), "forward Scenario amount comparison shares fixed-point normalization");

for (const needle of [
  "merged S5 forward path, idempotency, supersession and baseline rebuild remain green",
  "same scale-6 fixed-point authority",
  "stored source_record_hash does not match",
  "forged canonical Decision linkage",
  "scenario amount does not match the selected option",
  "invalid effective interval",
  "revalidates Approval Assertion semantics",
  "exactly one active Plan",
]) check(remediationAcceptance.includes(needle), `remediation PostgreSQL acceptance covers ${needle}`);
check(s5Acceptance.includes("computeCap05ReplayEvidenceSourceRecordHashV1"), "merged S5 acceptance rehashes legitimate mutated fixtures under the frozen policy");
check(s3Acceptance.includes("for (const evidence of [approval, plan])"), "S3 recovery regression supplies the complete Assertion-Plan graph");

check(status.validation?.repository_typecheck === "PASS", "remediation status records typecheck pass");
check(status.validation?.s5_forward_and_remediation_acceptance === "PASS", "remediation status records S5 forward and negative-recovery pass");
check(status.validation?.s3_persistence_recovery_regression === "PASS", "remediation status records S3 recovery regression pass");
check(authorization.implementation_status === "S5_REMEDIATION_CANDIDATE", "Authorization Status records remediation candidate");
check(authorization.current_blockers?.includes("S5_REMEDIATION_MERGED_MAIN_EFFECTIVENESS_PENDING"), "Authorization Status blocks successor on remediation effectiveness");
check(delivery.status === "S5_REMEDIATION_CANDIDATE", "Delivery Status records remediation candidate without activating S6");
check(s5Delivery?.status === "MERGED_EFFECTIVE", "S5 remains merged-effective while being remediated");
check(s6Delivery?.status === "BLOCKED" && s6Delivery?.runtime_source_authorized === false, "S6 remains blocked in Delivery Status");
check(cap05?.implementation_status === "S5_REMEDIATION_CANDIDATE", "global Matrix records remediation candidate");
check(cap05?.active_delivery_slice_id === S5, "global Matrix retains S5 as active effective delivery slice");
check(cap05?.next_authorized_slice_ids?.length === 0, "global Matrix grants no S6 authority");
check(task.includes("S5 remediation status:") && /S6 authorized:\s*false/s.test(task), "task records remediation and preserves S6 block");
check(map.includes("MCFT-CAP-05 S5 Recovery / Hash / Fixed-Point Remediation Candidate"), "Implementation Map records bounded remediation candidate");

if (process.argv.includes("--postmerge")) {
  check(status.effectiveness_condition_satisfied === false, "candidate status remains historical pre-effectiveness record after merge");
} else {
  const changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), "exact 16-file remediation boundary");
}

check(!expectedFiles.some((file) => file.includes("routes") || file.includes("apps/web") || file.includes("migrations")), "remediation boundary excludes routes, web and migrations");
check(status.preserved_nonclaims.includes("NO_REPLACEMENT_S5_IMPLEMENTATION") && status.preserved_nonclaims.includes("NO_CAP_06_AUTHORIZATION"), "replacement-S5 and CAP-06 nonclaims remain explicit");

console.log(`SUMMARY ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
