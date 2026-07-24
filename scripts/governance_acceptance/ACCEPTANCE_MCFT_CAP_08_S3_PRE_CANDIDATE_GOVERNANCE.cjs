#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const ROOT = process.cwd();
const BASE_SHA = process.env.BASE_SHA || "e8dc01b72def45c9931d70dab06f78dbc2b5a527";

const P = {
  registry: "docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json",
  boundary: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CHANGED-FILE-BOUNDARY-V1.json",
  status: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json",
  predecessor: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json",
  review: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json",
  contract: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CONTRACT-V1.json",
  identities: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-EVIDENCE-IDENTITIES-V1.json",
  workflows: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-WORKFLOW-DECLARATION-V1.json",
  governance: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-PRE-CANDIDATE-GOVERNANCE-V1.json",
  taskbook: "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md",
};

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}
function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}
function exec(command) {
  return cp.execFileSync(command[0], command.slice(1), { cwd: ROOT, encoding: "utf8" }).trim();
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function semanticDigest(obj) {
  const copy = structuredClone(obj);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash("sha256").update(stable(copy), "utf8").digest("hex")}`;
}
function exactArray(actual, expected, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

const boundary = readJson(P.boundary);
const status = readJson(P.status);
const predecessor = readJson(P.predecessor);
const review = readJson(P.review);
const contract = readJson(P.contract);
const identities = readJson(P.identities);
const workflows = readJson(P.workflows);
const governance = readJson(P.governance);
const registry = readJson(P.registry);

if (boundary.base_sha !== "e8dc01b72def45c9931d70dab06f78dbc2b5a527") fail("S3_GOVERNANCE_BASE_SHA_INVALID");
if (BASE_SHA !== boundary.base_sha) fail("S3_GOVERNANCE_WORKFLOW_BASE_SHA_MISMATCH", BASE_SHA);

const changed = exec(["git", "diff", "--name-only", `${BASE_SHA}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const expectedChanged = [...boundary.changed_files].sort();
exactArray(changed, expectedChanged, "S3_GOVERNANCE_CHANGED_FILE_BOUNDARY_MISMATCH");
if (boundary.changed_file_count !== expectedChanged.length) fail("S3_GOVERNANCE_CHANGED_FILE_COUNT_INVALID");

for (const file of changed) {
  for (const prefix of boundary.forbidden_prefixes) {
    if (file.startsWith(prefix)) fail("S3_GOVERNANCE_RUNTIME_OR_PRODUCT_SOURCE_FORBIDDEN", file);
  }
}
if (boundary.runtime_source_file_count !== 0) fail("S3_GOVERNANCE_RUNTIME_SOURCE_COUNT_NONZERO");

const taskbookBlob = exec(["git", "rev-parse", `HEAD:${P.taskbook}`]);
if (taskbookBlob !== boundary.taskbook_blob_must_remain) fail("S3_GOVERNANCE_TASKBOOK_BLOB_DRIFT", taskbookBlob);

if (status.record_status !== "PRE_REGISTERED_SUCCESSOR_STATUS_SEED") fail("S3_STATUS_RECORD_INVALID");
if (status.s3_candidate_implemented !== false) fail("S3_STATUS_CANDIDATE_MUST_REMAIN_FALSE");
if (status.implementation_authorized !== false || status.runtime_source_authorized !== false) fail("S3_STATUS_AUTHORITY_MUST_REMAIN_FALSE");
if (status.independent_review_required !== true || status.independent_review_satisfied !== false || status.independent_review_waived !== false) {
  fail("S3_STATUS_REVIEW_POLICY_INVALID");
}
if (status.focused_workflow !== "mcft-cap-08-s3-decision-action-feedback") fail("S3_STATUS_FOCUSED_WORKFLOW_INVALID");
if (status.exact_sha_status_context !== "mcft-cap-08/s3-exact-sha-attestation") fail("S3_STATUS_CONTEXT_INVALID");

if (review.independent_review_required !== true) fail("S3_REVIEW_MUST_BE_REQUIRED");
if (review.independent_review_satisfied !== false || review.independent_review_waived !== false) fail("S3_REVIEW_MUST_REMAIN_UNSATISFIED_UNWAIVED");
if (review.s2_owner_review_waiver_inherited !== false) fail("S3_REVIEW_S2_WAIVER_INHERITANCE_FORBIDDEN");
if (review.formal_candidate_creation_authorized !== false) fail("S3_REVIEW_FORMAL_CANDIDATE_AUTHORITY_FORBIDDEN");

if (predecessor.predecessor_merge_subject !== "1f37d6247a5f2e90327720c9feed4faf729d1db3") fail("S3_PREDECESSOR_SUBJECT_INVALID");
if (predecessor.predecessor_tree_sha !== "531ac3d53a05d08bbd1df39099f3721abb7095e2") fail("S3_PREDECESSOR_TREE_INVALID");
if (predecessor.predecessor_exact_sha_workflow_run !== 30034240206) fail("S3_PREDECESSOR_WORKFLOW_INVALID");
if (predecessor.predecessor_exact_sha_artifact_id !== 8574593152) fail("S3_PREDECESSOR_ARTIFACT_INVALID");
if (predecessor.predecessor_exact_sha_status !== "SUCCESS" || predecessor.readback_verified !== true) fail("S3_PREDECESSOR_READBACK_NOT_SATISFIED");
if (predecessor.predecessor_effective_status !== "S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE") fail("S3_PREDECESSOR_EFFECTIVE_STATUS_INVALID");
if (predecessor.effective_next_slice !== "S3") fail("S3_PREDECESSOR_FRONTIER_INVALID");

if (semanticDigest(contract) !== contract.semantic_digest) fail("S3_CONTRACT_DIGEST_MISMATCH");
if (semanticDigest(identities) !== identities.semantic_digest) fail("S3_IDENTITIES_DIGEST_MISMATCH");
exactArray(contract.phase_order, ["resolve","E","H","A","B","G","C","barrier"], "S3_PHASE_ORDER_DRIFT");
if (contract.phase_engine_contract_digest !== "sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466") fail("S3_PHASE_CONTRACT_DIGEST_DRIFT");
if (contract.negative_matrix.length !== 22) fail("S3_NEGATIVE_MATRIX_COUNT_INVALID");
exactArray(contract.negative_matrix.map((x) => x.case_id), Array.from({length:22}, (_,i)=>`S3-N${String(i+1).padStart(2,"0")}`), "S3_NEGATIVE_MATRIX_IDS_INVALID");
if (contract.pointer_integrity_matrix.length !== 6) fail("S3_POINTER_MATRIX_COUNT_INVALID");
if (contract.exact_cardinality.human_decision !== 1 ||
    contract.exact_cardinality.action_feedback !== 1 ||
    contract.exact_cardinality.outcome_fvo10_canonical_identity !== 1 ||
    contract.exact_cardinality.outcome_fvo_duplicate !== 0 ||
    contract.exact_cardinality.recommendation !== 0 ||
    contract.exact_cardinality.ao_act !== 0 ||
    contract.exact_cardinality.dispatch !== 0 ||
    contract.exact_cardinality.residual !== 0 ||
    contract.exact_cardinality.model_activation !== 0) {
  fail("S3_CARDINALITY_CONTRACT_INVALID");
}
if (contract.replay_values.approved_amount_mm !== "15.000000" ||
    contract.replay_values.executed_amount_mm !== "13.600000" ||
    contract.replay_values.coverage_fraction !== "0.910000" ||
    contract.replay_values.target_scope_equivalent_amount_mm !== "12.376000") {
  fail("S3_REPLAY_VALUES_INVALID");
}

const byRole = new Map(identities.identities.map((x) => [x.role, x]));
if (identities.identities.length !== 5) fail("S3_EVIDENCE_IDENTITY_COUNT_INVALID");
const receipt = byRole.get("EXECUTION_RECEIPT_EVIDENCE");
if (!receipt || receipt.observed_at !== "2026-06-01T07:00:00.000Z" ||
    receipt.available_to_runtime_at !== "2026-06-01T08:00:00.000Z" ||
    receipt.first_legal_consumption_tick !== "T08" ||
    receipt.requires_h_commit_before_a_snapshot !== true) {
  fail("S3_RECEIPT_IDENTITY_INVALID");
}
const outcome = byRole.get("OUTCOME_OBSERVATION_AND_FORECAST_VERIFICATION");
if (!outcome ||
    outcome.source_record_id !== "FVO-10" ||
    outcome.binding_id !== "soil_obs_c8_20cm_v1" ||
    outcome.observed_at !== "2026-06-01T10:00:00.000Z" ||
    outcome.available_to_runtime_at !== "2026-06-01T10:00:00.000Z" ||
    outcome.value !== "0.304500" ||
    outcome.same_identity_as_s2_fvo10 !== true ||
    outcome.visible_at_t09 !== false ||
    outcome.eligible_for_state_assimilation !== true ||
    outcome.eligible_for_forecast_evaluation !== true) {
  fail("S3_OUTCOME_FVO10_IDENTITY_INVALID");
}
if (identities.identity_rules.outcome_fvo10_identity_count !== 1 ||
    identities.identity_rules.cloned_outcome_identity_allowed !== false ||
    identities.identity_rules.t09_outcome_observed !== false ||
    identities.identity_rules.t09_outcome_available !== false) {
  fail("S3_OUTCOME_IDENTITY_RULE_INVALID");
}

const cap08 = registry.capabilities.find((x) => x.capability_line === "MCFT-CAP-08");
if (!cap08) fail("S3_REGISTRY_CAP08_MISSING");
const statusPath = P.status;
if (!cap08.authoritative_candidate_status_paths.includes(statusPath)) fail("S3_REGISTRY_STATUS_PATH_MISSING");
const rules = cap08.candidate_transition_fields.filter((x) =>
  x.status_file === statusPath && x.field_path === "s3_candidate_implemented"
);
if (rules.length !== 1) fail("S3_REGISTRY_RULE_CARDINALITY_INVALID");
const rule = rules[0];
exactArray(rule.allowed_candidate_values, [true], "S3_REGISTRY_ALLOWED_VALUE_INVALID");
if (rule.focused_workflow !== "mcft-cap-08-s3-decision-action-feedback" ||
    rule.standard_workflow !== "ci" ||
    rule.predecessor_effective_evidence_required !== true) {
  fail("S3_REGISTRY_RULE_INVALID");
}

if (workflows.governance_workflow.candidate_declaration_expected !== false ||
    workflows.candidate_workflow.present_in_governance_pr !== false ||
    workflows.exact_sha_workflow.present_in_governance_pr !== false) {
  fail("S3_WORKFLOW_DECLARATION_BOUNDARY_INVALID");
}
if (governance.candidate_declaration_present !== false ||
    governance.s3_candidate_implemented !== false ||
    governance.runtime_source_delta !== 0 ||
    governance.canonical_runtime_data_delta !== 0 ||
    governance.database_acl_delta !== 0 ||
    governance.business_schema_delta !== 0 ||
    governance.implementation_authorized !== false) {
  fail("S3_GOVERNANCE_NONCLAIM_INVALID");
}
if (governance.s3_machine_contract_digest !== contract.semantic_digest ||
    governance.s3_evidence_identity_digest !== identities.semantic_digest) {
  fail("S3_GOVERNANCE_DIGEST_BINDING_INVALID");
}

const result = {
  schema_version: "geox_mcft_cap08_s3_pre_candidate_governance_result_v1",
  status: "PASS",
  base_sha: BASE_SHA,
  changed_file_count: changed.length,
  taskbook_blob_sha: taskbookBlob,
  s2_predecessor_subject: predecessor.predecessor_merge_subject,
  s2_predecessor_artifact_id: predecessor.predecessor_exact_sha_artifact_id,
  s3_status_seed: "FALSE_PRE_REGISTERED",
  s3_registry_rule: "PRESENT_IN_CANDIDATE_TREE_FOR_POSTMERGE_TRUST",
  independent_review_required: true,
  independent_review_satisfied: false,
  independent_review_waived: false,
  s3_contract_digest: contract.semantic_digest,
  s3_evidence_identity_digest: identities.semantic_digest,
  negative_case_count: contract.negative_matrix.length,
  pointer_case_count: contract.pointer_integrity_matrix.length,
  runtime_source_delta: 0,
  canonical_runtime_data_delta: 0,
  database_acl_delta: 0,
  candidate_declaration_present: false,
  implementation_authorized: false,
};
fs.mkdirSync(path.join(ROOT, "tmp", "mcft-cap08-s3-pre-candidate-governance"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "tmp", "mcft-cap08-s3-pre-candidate-governance", "MCFT_CAP_08_S3_PRE_CANDIDATE_GOVERNANCE_RESULT.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
