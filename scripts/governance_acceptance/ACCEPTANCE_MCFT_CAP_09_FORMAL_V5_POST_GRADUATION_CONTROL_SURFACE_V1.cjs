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
  const rearm=authority.formal_store.governed_materialized_zero_rearm;
  assert.equal(rearm.enabled,true);
  assert.equal(rearm.required_prior_store_phase,"SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0");
  assert.equal(rearm.required_public_base_table_count,29);
  assert.equal(rearm.required_public_routine_count,2);
  assert.equal(rearm.all_table_rows_zero_required,true);
  assert.equal(rearm.prior_arm_must_be_invalidated_by_non_authority_change,true);
  assert.equal(rearm.prior_a0_artifact_absence_required,true);
  assert.equal(rearm.prior_arm_artifact_overwrite_forbidden,true);
  assert.equal(rearm.distinct_successor_arm_artifact_required,true);
  assert.equal(rearm.database_reset_or_truncate_forbidden,true);
  assert.equal(rearm.formal_database_mutation_allowed_for_rearm,false);
  assert.equal(rearm.schema_acl_idempotent_revalidation_required_after_rearm,true);
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
  const rearmVerifierRel = authority.qualification_surface.materialized_zero_rearm_eligibility_verifier_ref;
  assert.equal(rearmVerifierRel,rearm.eligibility_verifier_ref);
  for (const rel of [workflowRel, acceptanceRel, localVerifierRel, rearmVerifierRel, authority.owner_prerequisite.live_verifier_ref]) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `FORMAL_V5_READINESS_PATH_REQUIRED:${rel}`);
  }

  const workflow = fs.readFileSync(path.join(ROOT, workflowRel), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  const pushSection = workflow.slice(workflow.indexOf("  push:"), workflow.indexOf("\n\npermissions:"));
  assert.match(pushSection, /branches:\s*\[main\]/);
  assert.doesNotMatch(pushSection, /\n\s+paths:/, "FORMAL_V5_READINESS_MAIN_PUSH_MUST_NOT_BE_PATH_FILTERED");
  assert.match(workflow, /transaction_read_only/);
  assert.match(workflow, /information_schema\.tables/);
  assert.match(workflow, /pg_catalog\.pg_proc/);
  assert.match(workflow, /FORMAL_V5_MATERIALIZED_TABLE_SET_MISMATCH/);
  assert.match(workflow, /FORMAL_V5_MATERIALIZED_ROUTINE_SET_MISMATCH/);
  assert.match(workflow, /FORMAL_V5_PRE_A0_ROWS_NONZERO/);
  assert.match(workflow, /proof\.public_base_table_count!==29/);
  assert.match(workflow, /proof\.public_routine_count!==2/);
  assert.match(workflow, /proof\.all_table_rows_zero!==true/);
  assert.match(workflow, /owner\.status==='REQUALIFY'/, "FORMAL_V5_OWNER_REQUALIFY_PENDING_STATE_REQUIRED");
  assert.match(workflow, /owner\.reason_code!=='GOVERNED_DEPENDENCY_CHANGED'/, "FORMAL_V5_OWNER_REQUALIFY_REASON_REQUIRED");
  assert.match(workflow, /owner\.status==='REQUIRED'/, "FORMAL_V5_OWNER_REQUIRED_PENDING_STATE_REQUIRED");
  assert.match(workflow, /owner\.reason_code!=='APPLICABLE_WITHOUT_CARRY_FORWARD_EVIDENCE'/, "FORMAL_V5_OWNER_REQUIRED_REASON_REQUIRED");
  assert.match(workflow, /FORMAL_V5_POST_GRADUATION_OWNER_MUST_REMAIN_PENDING/, "FORMAL_V5_OWNER_OTHER_STATE_FAIL_CLOSED_REQUIRED");
  assert.match(workflow, /mcft-cap-09-production-owner-graduation-gate\.yml/, "FORMAL_V5_OWNER_WORKFLOW_BINDING_REQUIRED");
  assert.doesNotMatch(workflow, /\bpsql\b[^\n]*(?:-c|--command)[^\n]*\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i);

  const localVerifier = fs.readFileSync(path.join(ROOT, localVerifierRel), "utf8");
  assert.match(localVerifier, /VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1\.cjs/);
  assert.match(localVerifier, /FORMAL_V5_ZERO_STATE_PROOF_SUBJECT_MISMATCH/);
  assert.match(localVerifier, /FORMAL_V5_REARM_PROOF_PRIOR_ARM_INVALIDATION_REQUIRED/);
  assert.match(localVerifier, /MATERIALIZED_ZERO_REARM/);
  assert.match(localVerifier, /FORMAL_V5_ARM_REMAINS_UNAUTHORIZED/);
  const rearmVerifier=fs.readFileSync(path.join(ROOT,rearmVerifierRel),"utf8");
  assert.match(rearmVerifier,/FORMAL_V5_REARM_LOCAL_PRODUCTION_HOST_ONLY/);
  assert.match(rearmVerifier,/SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0/);
  assert.match(rearmVerifier,/FORMAL_V5_REARM_PRIOR_ARM_NOT_INVALIDATED_BY_SEMANTIC_CHANGE/);
  assert.match(rearmVerifier,/FORMAL_V5_REARM_PRE_A0_ROWS_NONZERO/);
  assert.match(rearmVerifier,/new_arm_output_must_be_distinct:true/);
  assert.doesNotMatch(rearmVerifier,/\b(?:DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|CREATE)\s+(?:DATABASE|TABLE|SCHEMA)\b/i);

  const resolver = qcp.dependency_resolvers?.FORMAL_V5_POST_GRADUATION_CONTROL_SURFACE_V1;
  assert.ok(resolver, "FORMAL_V5_POST_GRADUATION_RESOLVER_REQUIRED");
  assert.equal(resolver.kind, "EXACT_PATH_SET");
  const resolverPaths = new Set(resolver.paths || []);
  for (const rel of [
    path.relative(ROOT, AUTHORITY_PATH).replaceAll("\\", "/"),
    workflowRel,
    acceptanceRel,
    localVerifierRel,
    rearmVerifierRel,
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
