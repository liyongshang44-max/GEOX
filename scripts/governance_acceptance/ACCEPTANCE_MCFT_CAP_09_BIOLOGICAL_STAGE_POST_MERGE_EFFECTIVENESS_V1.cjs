#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const EXPECTED_BASE = "ddfdbc0ee88e7845e03eaf4b14e6077dbf645a23";
const EXPECTED_ISSUED_AT = "2026-09-03T15:23:00.000Z";
const QCP_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const EVIDENCE_REGISTRY_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json";
const CERT_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const WORKFLOW_PATH = ".github/workflows/mcft-cap-09-biological-stage-post-merge-effectiveness-v1.yml";
const SCRIPT_PATH = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_BIOLOGICAL_STAGE_POST_MERGE_EFFECTIVENESS_V1.cjs";
const GRADUATION_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-EFFECTIVENESS-GRADUATION-V1.json";
const AMENDMENT_PATH = "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03-BIOLOGICAL-STAGE-AUTHORITY.md";
const REGISTER_PATH = "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json";
const POST_MERGE_CONTROL_PLANE_WORKFLOW = ".github/workflows/mcft-cap-09-post-merge-v13-control-plane-v1.yml";
const QUALIFICATION_CONTROL_PLANE_WORKFLOW = ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml";
const POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA = "ddfdbc0ee88e7845e03eaf4b14e6077dbf645a23";
const EXPECTED_PATHS = [
  QCP_PATH,
  CERT_PATH,
  WORKFLOW_PATH,
  SCRIPT_PATH,
  POST_MERGE_CONTROL_PLANE_WORKFLOW,
  QUALIFICATION_CONTROL_PLANE_WORKFLOW,
  EVIDENCE_REGISTRY_PATH,
].sort();

function fail(code, detail) {
  throw new Error(detail ? code + ":" + detail : code);
}
function eq(actual, expected, code) {
  if (actual !== expected) fail(code, "expected=" + JSON.stringify(expected) + " actual=" + JSON.stringify(actual));
}
function git(...args) {
  return cp.execFileSync("git", args, { encoding: "utf8" }).trim();
}
function blobAt(ref, file) {
  return git("rev-parse", ref + ":" + file);
}

const base = process.env.MCFT_CAP09_POSTMERGE_BIO_STAGE_EFFECT_BASE_SHA || EXPECTED_BASE;
eq(base, EXPECTED_BASE, "POSTMERGE_BIO_STAGE_EFFECT_EXACT_BASE_REQUIRED");
eq(git("merge-base", EXPECTED_BASE, "HEAD"), EXPECTED_BASE, "POSTMERGE_BIO_STAGE_EFFECT_BASE_NOT_ANCESTOR");

const changed = git("diff", "--name-only", EXPECTED_BASE + "...HEAD")
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
eq(JSON.stringify(changed), JSON.stringify(EXPECTED_PATHS), "POSTMERGE_BIO_STAGE_EFFECT_EXACT_SEVEN_FILE_BOUNDARY_REQUIRED");

const cert = JSON.parse(fs.readFileSync(CERT_PATH, "utf8"));
eq(cert.schema_version, "geox_dt02_biological_stage_authority_effectiveness_v1", "POSTMERGE_BIO_STAGE_EFFECT_SCHEMA");
eq(cert.amendment_id, "DT02-AMENDMENT-03", "POSTMERGE_BIO_STAGE_EFFECT_AMENDMENT");
eq(cert.status, "EFFECTIVE", "POSTMERGE_BIO_STAGE_EFFECT_STATUS");
eq(cert.effective, true, "POSTMERGE_BIO_STAGE_EFFECT_EFFECTIVE");
eq(cert.protected_main_sha, EXPECTED_BASE, "POSTMERGE_BIO_STAGE_EFFECT_MAIN_SHA");
eq(cert.issued_at, EXPECTED_ISSUED_AT, "POSTMERGE_BIO_STAGE_EFFECT_ISSUED_AT");
eq(cert.authority_ceiling, "DT02_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_ONLY", "POSTMERGE_BIO_STAGE_EFFECT_CEILING");
eq(cert.amendment_path, AMENDMENT_PATH, "POSTMERGE_BIO_STAGE_EFFECT_AMENDMENT_PATH");
eq(cert.decision_register_path, REGISTER_PATH, "POSTMERGE_BIO_STAGE_EFFECT_REGISTER_PATH");
eq(cert.graduation_authority_ref, GRADUATION_PATH, "POSTMERGE_BIO_STAGE_EFFECT_GRADUATION_PATH");
eq(cert.amendment_blob_sha, blobAt(EXPECTED_BASE, AMENDMENT_PATH), "POSTMERGE_BIO_STAGE_EFFECT_AMENDMENT_BLOB");
eq(cert.decision_register_blob_sha, blobAt(EXPECTED_BASE, REGISTER_PATH), "POSTMERGE_BIO_STAGE_EFFECT_REGISTER_BLOB");
eq(cert.graduation_authority_blob_sha, blobAt(EXPECTED_BASE, GRADUATION_PATH), "POSTMERGE_BIO_STAGE_EFFECT_GRADUATION_BLOB");
for (const key of [
  "runtime_start_authorized",
  "production_owner_activation_authorized",
  "formal_v5_authorized",
  "a0_authorized",
  "o00_o23_authorized",
]) eq(cert[key], false, "POSTMERGE_BIO_STAGE_EFFECT_AUTHORITY_CEILING:" + key);

const qcp = JSON.parse(fs.readFileSync(QCP_PATH, "utf8"));
const resolver = qcp.dependency_resolvers?.BIOLOGICAL_STAGE_POST_MERGE_EFFECTIVENESS_V1;
if (!resolver) fail("POSTMERGE_BIO_STAGE_EFFECT_QCP_RESOLVER_REQUIRED");
eq(resolver.kind, "EXACT_PATH_SET", "POSTMERGE_BIO_STAGE_EFFECT_QCP_RESOLVER_KIND");
eq(
  JSON.stringify([...(resolver.paths || [])].sort()),
  JSON.stringify([CERT_PATH, WORKFLOW_PATH, SCRIPT_PATH].sort()),
  "POSTMERGE_BIO_STAGE_EFFECT_QCP_RESOLVER_PATHS",
);
const check = (qcp.checks || []).find((row) => row.check_id === "BIOLOGICAL_STAGE_POST_MERGE_EFFECTIVENESS");
if (!check) fail("POSTMERGE_BIO_STAGE_EFFECT_QCP_CHECK_REQUIRED");
eq(check.execution_workflow, WORKFLOW_PATH, "POSTMERGE_BIO_STAGE_EFFECT_QCP_WORKFLOW");
eq(check.fail_policy, "FAIL_CLOSED", "POSTMERGE_BIO_STAGE_EFFECT_QCP_FAIL_POLICY");
if (!(check.resolver_ids || []).includes("BIOLOGICAL_STAGE_POST_MERGE_EFFECTIVENESS_V1")) {
  fail("POSTMERGE_BIO_STAGE_EFFECT_QCP_RESOLVER_BINDING_REQUIRED");
}
if (!(check.applicable_stages || []).includes("SUCCESSOR_SUBJECT_PRE_MERGE")) {
  fail("POSTMERGE_BIO_STAGE_EFFECT_QCP_PREMERGE_QUALIFICATION_REQUIRED");
}
if (!(qcp.governed_successor_predecessor_shas || []).includes(POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA)) {
  fail("POSTMERGE_BIO_STAGE_EFFECT_QCP_EXACT_PREDECESSOR_REQUIRED");
}
const evidenceRegistry = JSON.parse(fs.readFileSync(EVIDENCE_REGISTRY_PATH, "utf8"));
const governedEvidenceBases = evidenceRegistry.requalification_evidence?.durable_anchors?.rules?.governed_successor_predecessors || [];
if (!governedEvidenceBases.includes(POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA)) {
  fail("POSTMERGE_BIO_STAGE_EFFECT_EVIDENCE_REGISTRY_EXACT_PREDECESSOR_REQUIRED");
}

for (const controlWorkflowPath of [POST_MERGE_CONTROL_PLANE_WORKFLOW, QUALIFICATION_CONTROL_PLANE_WORKFLOW]) {
  const controlWorkflow = fs.readFileSync(controlWorkflowPath, "utf8");
  if (!controlWorkflow.includes("POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA")) {
    fail("POSTMERGE_BIO_STAGE_EFFECT_CONTROL_PLANE_EXACT_PREDECESSOR_BINDING_REQUIRED", controlWorkflowPath);
  }
  if (!controlWorkflow.includes(POST_ADOPTION_EFFECTIVENESS_PREDECESSOR_SHA)) {
    fail("POSTMERGE_BIO_STAGE_EFFECT_CONTROL_PLANE_EXACT_PREDECESSOR_SHA_REQUIRED", controlWorkflowPath);
  }
}

const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
for (const marker of [
  "BUILD_MCFT_CAP_09_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_V1.cjs",
  "PROBE_MCFT_CAP_09_T4R1_PERSISTENT_LIFECYCLE_QUALIFICATION.mjs",
  "PROBE_MCFT_CAP_09_T4R1_THERMAL_BIOLOGICAL_STAGE_AUTHORITY_V1.py",
  "COMPOSE_MCFT_CAP_09_T4R1_CURRENT_CROP_AUTHORITY_V1.cjs",
  "BUILD_MCFT_CAP_09_EFFECTIVE_CURRENT_CROP_AUTHORITY_V1.cjs",
]) {
  if (!workflow.includes(marker)) fail("POSTMERGE_BIO_STAGE_EFFECT_WORKFLOW_MARKER_REQUIRED", marker);
}
for (const forbidden of [
  "workflow_dispatch:",
  "schedule:",
  "pull_request_target",
  "docker compose up",
  "FORMAL_DATABASE_URL",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
]) {
  if (workflow.includes(forbidden)) fail("POSTMERGE_BIO_STAGE_EFFECT_WORKFLOW_FORBIDDEN", forbidden);
}

console.log(JSON.stringify({
  status: "PASS",
  exact_base_sha: EXPECTED_BASE,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  architecture_effectiveness_certificate: CERT_PATH,
  real_effectiveness_issued: true,
  fresh_current_crop_requalification_required: true,
  runtime_started: false,
  production_owner_activated: false,
  formal_v5_armed: false,
  a0_started: false,
  o00_started: false,
}));
