"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const AUTH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json",
);
const OWNER = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
);
const ROUTE = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md",
);
const ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
);
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_PREFLIGHT_V1_RESULT.json",
);

function j(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function t(file) {
  return fs.readFileSync(file, "utf8");
}
function req(value, code) {
  if (!value) throw new Error(code);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

try {
  const subjectSha = String(process.env.SUBJECT_SHA || "");
  req(/^[0-9a-f]{40}$/.test(subjectSha), "HOST_BINDING_SUBJECT_SHA_REQUIRED");

  const a = j(AUTH);
  const owner = j(OWNER);
  const route = t(ROUTE);
  const arm = j(ARM);

  req(
    owner.status === "RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND",
    "HOST_BINDING_RUNTIME_CREDENTIAL_CLOSURE_STATUS_REQUIRED",
  );
  req(
    owner.current_stage === "RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING",
    "HOST_BINDING_RUNTIME_CREDENTIAL_CLOSURE_STAGE_REQUIRED",
  );
  req(
    owner.runtime_credential_binding_evidence?.status === "IMMUTABLE_SUCCESS" &&
      owner.runtime_credential_binding_evidence?.runtime_credential_binding === true,
    "HOST_BINDING_RUNTIME_CREDENTIAL_BINDING_EVIDENCE_REQUIRED",
  );
  req(
    owner.runtime_credential_post_binding_readiness_evidence?.status === "IMMUTABLE_SUCCESS",
    "HOST_BINDING_RUNTIME_CREDENTIAL_POST_READINESS_REQUIRED",
  );

  for (const marker of [
    "GitHub Actions is not a production execution host",
    "at least two independent long-running operational roles",
    "GEOX Evidence Runtime",
    "GEOX Twin Runtime",
    "Evidence production owner count = exactly 1",
    "Twin Runtime scheduler owner count = exactly 1",
  ]) {
    req(route.includes(marker), "HOST_BINDING_FROZEN_ROUTE_MARKER_REQUIRED:" + marker);
  }

  req(
    a.schema_version === "geox_mcft_cap09_production_non_github_host_binding_authority_v1",
    "HOST_BINDING_SCHEMA_VERSION_REQUIRED",
  );
  req(
    a.authority_id === "GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1",
    "HOST_BINDING_AUTHORITY_ID_REQUIRED",
  );
  req(
    a.status === "HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND",
    "HOST_BINDING_UNBOUND_STATUS_REQUIRED",
  );
  req(
    a.predecessor_stage === "RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING" &&
      a.runtime_credential_binding_required === true,
    "HOST_BINDING_PREDECESSOR_REQUIRED",
  );
  req(
    a.production_execution_host_class === "NON_GITHUB_LONG_RUNNING_SERVICE",
    "HOST_BINDING_HOST_CLASS_REQUIRED",
  );
  req(
    a.github_actions?.production_execution_host_allowed === false,
    "HOST_BINDING_GITHUB_EXECUTION_HOST_FORBIDDEN",
  );

  const requiredFields = a.host_identity_contract?.common_required_fields;
  req(Array.isArray(requiredFields), "HOST_BINDING_REQUIRED_FIELDS_ARRAY_REQUIRED");
  for (const field of [
    "platform_provider",
    "platform_account_or_project_id",
    "region_or_location",
    "service_id",
    "service_name",
    "execution_class",
    "runtime_role",
  ]) {
    req(requiredFields.includes(field), "HOST_BINDING_REQUIRED_FIELD_MISSING:" + field);
  }
  req(
    a.host_identity_contract?.execution_class_required === "LONG_RUNNING_SERVICE",
    "HOST_BINDING_LONG_RUNNING_EXECUTION_CLASS_REQUIRED",
  );
  req(
    a.host_identity_contract?.evidence_runtime?.runtime_role === "EVIDENCE_RUNTIME" &&
      a.host_identity_contract?.twin_runtime?.runtime_role === "TWIN_RUNTIME",
    "HOST_BINDING_EXACT_RUNTIME_ROLES_REQUIRED",
  );
  req(
    a.host_identity_contract?.evidence_runtime?.service_identity === null &&
      a.host_identity_contract?.twin_runtime?.service_identity === null,
    "HOST_BINDING_SERVICE_IDENTITIES_MUST_REMAIN_UNBOUND",
  );

  const c = a.host_identity_contract?.constraints || {};
  for (const key of [
    "evidence_and_twin_service_identities_must_be_distinct",
    "github_actions_service_identity_forbidden",
    "ephemeral_ci_runner_identity_forbidden",
    "role_collapse_forbidden",
    "evidence_host_must_not_own_twin_scheduler_lease",
    "twin_host_must_not_own_evidence_producer_lease",
  ]) {
    req(c[key] === true, "HOST_BINDING_CONSTRAINT_REQUIRED:" + key);
  }

  req(
    a.canonical_runtime_roles?.evidence_runtime?.database_login_role ===
      "geox_mcft_cap09_evidence_runtime_login_v1" &&
      a.canonical_runtime_roles?.twin_runtime?.database_login_role ===
      "geox_mcft_cap09_twin_runtime_login_v1",
    "HOST_BINDING_DATABASE_LOGIN_ROLE_BOUNDARY_REQUIRED",
  );
  req(
    a.canonical_runtime_roles?.evidence_runtime?.production_database ===
      "geox_mcft_cap09_production_runtime_v1" &&
      a.canonical_runtime_roles?.twin_runtime?.production_database ===
      "geox_mcft_cap09_production_runtime_v1",
    "HOST_BINDING_PRODUCTION_DATABASE_REQUIRED",
  );

  const b = a.binding_state || {};
  for (const key of [
    "platform_selected",
    "evidence_host_identity_bound",
    "twin_host_identity_bound",
    "exact_two_runtime_service_identities_bound",
    "binding_authorized",
  ]) {
    req(b[key] === false, "HOST_BINDING_UNBOUND_STATE_REQUIRED:" + key);
  }

  req(
    a.next_stage?.stage === "BIND_REAL_NON_GITHUB_PLATFORM_SERVICE_IDENTITIES" &&
      a.next_stage?.status === "BLOCKED_ON_EXTERNAL_PLATFORM_AND_SERVICE_IDENTITIES" &&
      a.next_stage?.external_platform_selection_required === true &&
      a.next_stage?.external_service_provisioning_or_existing_identity_required === true,
    "HOST_BINDING_NEXT_STAGE_REQUIRED",
  );
  req(
    a.next_stage?.runtime_start_separate === true &&
      a.next_stage?.production_owner_activation_separate === true,
    "HOST_BINDING_EFFECT_SEPARATION_REQUIRED",
  );

  for (const key of [
    "external_host_provisioning",
    "deployment",
    "runtime_process_start",
    "production_owner_activation",
    "provider_request",
    "formal_v5_arm",
    "a0_bootstrap",
    "o00_started",
  ]) {
    req(a.non_effects?.[key] === false, "HOST_BINDING_NON_EFFECT_REQUIRED:" + key);
  }

  req(
    arm.armed === false && arm.exact_target_database_name === null,
    "HOST_BINDING_OWNER_ARM_MUST_REMAIN_FALSE",
  );
  for (const key of [
    "phase4_twin_acl_materialization_authorized",
    "service_login_bootstrap_authorized",
    "runtime_credential_binding_authorized",
    "runtime_process_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    req(arm[key] === false, "HOST_BINDING_LATER_AUTHORITY_MUST_REMAIN_FALSE:" + key);
  }

  write({
    schema_version: "geox_mcft_cap09_production_non_github_host_binding_preflight_v1",
    status: "PASS",
    stage: "NON_GITHUB_HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND",
    subject_sha: subjectSha,
    production_execution_host_class: a.production_execution_host_class,
    evidence_runtime_role: a.host_identity_contract.evidence_runtime.runtime_role,
    twin_runtime_role: a.host_identity_contract.twin_runtime.runtime_role,
    platform_selected: false,
    evidence_host_identity_bound: false,
    twin_host_identity_bound: false,
    exact_two_runtime_service_identities_bound: false,
    binding_authorized: false,
    remaining_blockers: [
      "EXTERNAL_NON_GITHUB_PLATFORM_NOT_SELECTED",
      "EVIDENCE_NON_GITHUB_SERVICE_IDENTITY_NOT_BOUND",
      "TWIN_NON_GITHUB_SERVICE_IDENTITY_NOT_BOUND",
      "NON_GITHUB_HOST_BINDING_NOT_AUTHORIZED",
    ],
    external_host_provisioning: false,
    deployment: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
} catch (error) {
  write({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    external_host_provisioning: false,
    deployment: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.exitCode = 1;
}
