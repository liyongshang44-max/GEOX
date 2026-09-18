#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const AUTHORITY_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-POST-GRADUATION-CONTROL-SURFACE-V1.json");
const QCP_PATH = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const authority = readJson(AUTHORITY_PATH);
  const qcp = readJson(QCP_PATH);

  assert.equal(authority.status, "AUTHORIZED_FOR_POST_GRADUATION_READINESS_QUALIFICATION_ONLY");
  assert.equal(authority.stage, "POST_GRADUATION_FORMAL_V5_ACTIVATION");
  assert.equal(authority.qcp_check_id, "FORMAL_V5_ACTIVATION");
  assert.equal(authority.formal_store.database_name, "geox_mcft_cap09_s6_formal_t4r1_24h_v5");
  assert.equal(authority.formal_store.required_role, "FRESH_FORMAL_STORE_ONLY");
  assert.equal(authority.formal_store.required_pre_arm_state, "ZERO_STATE_PRE_ARM");
  assert.equal(authority.formal_store.required_public_base_table_count, 0);
  assert.equal(authority.formal_store.required_public_routine_count, 0);
  assert.equal(authority.formal_store.failed_predecessor_reuse_forbidden, true);
  assert.equal(authority.formal_store.failed_predecessor_clone_forbidden, true);
  assert.equal(authority.owner_prerequisite.exact_one_live_fenced_owner_per_runtime_role_required_at_arm_readiness, true);
  assert.equal(authority.owner_prerequisite.historical_owner_evidence_substitute_forbidden, true);
  assert.equal(authority.owner_prerequisite.github_runner_as_live_owner_authority_forbidden, true);
  assert.equal(authority.owner_prerequisite.local_production_host_reverification_required, true);
  assert.equal(authority.qualification_surface.formal_store_probe_mode, "READ_ONLY");
  assert.equal(authority.qualification_surface.zero_state_proof_must_bind_exact_subject, true);
  assert.equal(authority.qualification_surface.zero_state_proof_must_be_revalidated_for_actual_arm, true);

  for (const [key, value] of Object.entries(authority.authorization_ceiling)) {
    assert.equal(value, false, `FORMAL_V5_READINESS_AUTHORIZATION_CEILING_MUST_REMAIN_FALSE:${key}`);
  }
  for (const [key, value] of Object.entries(authority.non_effects)) {
    assert.equal(value, false, `FORMAL_V5_READINESS_NON_EFFECT_MUST_REMAIN_FALSE:${key}`);
  }

  const workflowRel = authority.qualification_surface.workflow_ref;
  const acceptanceRel = authority.qualification_surface.static_acceptance_ref;
  const localVerifierRel = authority.qualification_surface.local_arm_readiness_verifier_ref;
  for (const rel of [workflowRel, acceptanceRel, localVerifierRel, authority.owner_prerequisite.live_verifier_ref]) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `FORMAL_V5_READINESS_PATH_REQUIRED:${rel}`);
  }

  const workflow = fs.readFileSync(path.join(ROOT, workflowRel), "utf8");
  assert.match(workflow, /transaction_read_only/);
  assert.match(workflow, /information_schema\.tables/);
  assert.match(workflow, /pg_catalog\.pg_proc/);
  assert.match(workflow, /FORMAL_V5_PUBLIC_BASE_TABLE_COUNT_NONZERO/);
  assert.match(workflow, /FORMAL_V5_PUBLIC_ROUTINE_COUNT_NONZERO/);
  assert.doesNotMatch(workflow, /\bpsql\b[^\n]*(?:-c|--command)[^\n]*\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i);

  const localVerifier = fs.readFileSync(path.join(ROOT, localVerifierRel), "utf8");
  assert.match(localVerifier, /VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1\.cjs/);
  assert.match(localVerifier, /--attest-image/);
  assert.match(localVerifier, /GEOX_DEPLOYMENT_SUBJECT_COMMIT/);
  assert.match(localVerifier, /GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH/);
  assert.match(localVerifier, /FORMAL_V5_ZERO_STATE_PROOF_SUBJECT_MISMATCH/);
  assert.match(localVerifier, /FORMAL_V5_ARM_REMAINS_UNAUTHORIZED/);

  const resolver = qcp.dependency_resolvers?.FORMAL_V5_POST_GRADUATION_CONTROL_SURFACE_V1;
  assert.ok(resolver, "FORMAL_V5_POST_GRADUATION_RESOLVER_REQUIRED");
  assert.equal(resolver.kind, "EXACT_PATH_SET");
  const resolverPaths = new Set(resolver.paths || []);
  for (const rel of [
    path.relative(ROOT, AUTHORITY_PATH).replaceAll("\\", "/"),
    workflowRel,
    acceptanceRel,
    localVerifierRel,
    authority.owner_prerequisite.live_verifier_ref,
  ]) {
    assert.equal(resolverPaths.has(rel), true, `FORMAL_V5_POST_GRADUATION_RESOLVER_PATH_REQUIRED:${rel}`);
  }

  const check = qcp.checks.find((row) => row.check_id === "FORMAL_V5_ACTIVATION");
  assert.ok(check, "FORMAL_V5_ACTIVATION_CHECK_REQUIRED");
  assert.equal(check.execution_workflow_status, "NOT_IMPLEMENTED_AT_FROZEN_SUBJECT");
  assert.equal(check.execution_workflow, null);
  assert.equal(
    check.execution_workflows_by_stage?.POST_GRADUATION_FORMAL_V5_ACTIVATION,
    workflowRel,
    "FORMAL_V5_POST_GRADUATION_STAGE_WORKFLOW_REQUIRED",
  );
  assert.equal(
    check.execution_workflow_status_by_stage?.POST_GRADUATION_FORMAL_V5_ACTIVATION,
    "IMPLEMENTED_POST_GRADUATION_READINESS",
    "FORMAL_V5_POST_GRADUATION_STAGE_STATUS_REQUIRED",
  );
  for (const resolverId of [
    "V13_RUNTIME_SEMANTIC_CLOSURE",
    "PRODUCTION_OWNER_GRADUATION_CLOSURE",
    "FORMAL_V5_POST_GRADUATION_CONTROL_SURFACE_V1",
  ]) {
    assert.equal(check.resolver_ids.includes(resolverId), true, `FORMAL_V5_RESOLVER_REQUIRED:${resolverId}`);
    assert.equal(check.requalification_triggers.includes(resolverId), true, `FORMAL_V5_REQUALIFICATION_TRIGGER_REQUIRED:${resolverId}`);
  }
  assert.equal(check.carry_forward_policy, "NONE");
  assert.equal(check.carry_forward_evidence_id, null);
  assert.equal(check.fail_policy, "FAIL_CLOSED_UNTIL_POST_GRADUATION_READINESS_AND_SEPARATE_OPERATOR_ARM_AUTHORIZATION");

  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_formal_v5_post_graduation_control_surface_acceptance_v1",
    status: "PASS",
    formal_v5_arm: false,
    formal_database_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
  }, null, 2));
}

main();
