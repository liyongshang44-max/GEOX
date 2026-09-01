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
const HOST_ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json",
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
  const hostArm = j(HOST_ARM);

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
  const workspaceBoundPreIdentity =
    a.status === "RENDER_WORKSPACE_BOUND_SERVICE_IDENTITIES_UNBOUND";
  const platformAuthorizedPreIdentity =
    a.status === "RENDER_PLATFORM_AUTHORIZED_SERVICE_IDENTITIES_UNBOUND" ||
    workspaceBoundPreIdentity;
  const expectedZeroRuntimeProvisioningStatus =
    workspaceBoundPreIdentity ? "PROVEN_UNAVAILABLE_ON_RENDER_API_V1" : "NOT_PROVEN";
  req(
    a.status === "HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND" || platformAuthorizedPreIdentity,
    "HOST_BINDING_AUTHORITY_STATUS_REQUIRED",
  );
  const checkpoint = a.pre_platform_checkpoint_evidence;
  req(
    checkpoint?.status === "IMMUTABLE_SUCCESS_UNBOUND" &&
      checkpoint?.subject_sha === "776c6a6b9765abd608e8f469729451784c24c868",
    "HOST_BINDING_PRE_PLATFORM_CHECKPOINT_REQUIRED",
  );
  req(
    checkpoint?.host_binding_readiness?.run_id === 33424840577 &&
      checkpoint?.host_binding_readiness?.job_id === 99595800927 &&
      checkpoint?.host_binding_readiness?.artifact_id === 9770470060 &&
      checkpoint?.host_binding_readiness?.artifact_digest ===
        "sha256:8dac5bb17b540357cd3d0e0570d09d5e08b762575f46538633285a40823d3d5d",
    "HOST_BINDING_READINESS_CHECKPOINT_IDENTITY_MISMATCH",
  );
  req(
    checkpoint?.host_binding_readiness?.stage === "HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND" &&
      checkpoint?.host_binding_readiness?.platform_selected === false &&
      checkpoint?.host_binding_readiness?.evidence_host_identity_bound === false &&
      checkpoint?.host_binding_readiness?.twin_host_identity_bound === false &&
      checkpoint?.host_binding_readiness?.exact_two_runtime_service_identities_bound === false &&
      checkpoint?.host_binding_readiness?.binding_authorized === false,
    "HOST_BINDING_READINESS_CHECKPOINT_SHAPE_MISMATCH",
  );
  req(
    checkpoint?.owner_provisioning_readiness?.run_id === 33424840821 &&
      checkpoint?.owner_provisioning_readiness?.job_id === 99595802577 &&
      checkpoint?.owner_provisioning_readiness?.artifact_id === 9770513889 &&
      checkpoint?.owner_provisioning_readiness?.artifact_digest ===
        "sha256:5cac056bc45d7caae7c7edb57358c78605844d2b75cabcb610d8d68e72f80d3a" &&
      checkpoint?.owner_provisioning_readiness?.status === "PASS_NON_GITHUB_HOST_BINDING_FRONTIER",
    "HOST_BINDING_OWNER_CHECKPOINT_IDENTITY_MISMATCH",
  );
  req(
    Array.isArray(checkpoint?.owner_provisioning_readiness?.remaining_provisioning_blockers) &&
      checkpoint.owner_provisioning_readiness.remaining_provisioning_blockers.length === 4 &&
      checkpoint.owner_provisioning_readiness.remaining_provisioning_blockers.includes("EXTERNAL_NON_GITHUB_PLATFORM_NOT_SELECTED") &&
      checkpoint.owner_provisioning_readiness.remaining_provisioning_blockers.includes("EVIDENCE_NON_GITHUB_SERVICE_IDENTITY_NOT_BOUND") &&
      checkpoint.owner_provisioning_readiness.remaining_provisioning_blockers.includes("TWIN_NON_GITHUB_SERVICE_IDENTITY_NOT_BOUND") &&
      checkpoint.owner_provisioning_readiness.remaining_provisioning_blockers.includes("NON_GITHUB_HOST_BINDING_NOT_AUTHORIZED"),
    "HOST_BINDING_OWNER_CHECKPOINT_BLOCKERS_MISMATCH",
  );
  req(
    checkpoint?.post_merge_v13_control_plane?.run_id === 33424840808 &&
      checkpoint?.post_merge_v13_control_plane?.artifact_id === 9770641030 &&
      checkpoint?.post_merge_v13_control_plane?.artifact_digest ===
        "sha256:a138206e91680f0bdb6197d31151f705c26b8af494b675013ef5528a34b5a9a5" &&
      checkpoint?.post_merge_v13_control_plane?.conclusion === "success" &&
      checkpoint?.post_merge_v13_control_plane?.blocker_count === 1 &&
      checkpoint?.post_merge_v13_control_plane?.only_blocker === "EXACT_ONE_PRODUCTION_OWNER" &&
      checkpoint?.post_merge_v13_control_plane?.producer_driven_qualification_status === "PASS" &&
      checkpoint?.post_merge_v13_control_plane?.end_to_end_evidence_supply_deadline_status === "PASS",
    "HOST_BINDING_POST_MERGE_CHECKPOINT_MISMATCH",
  );
  req(
    checkpoint?.qualification_control_plane?.run_id === 33424840454 &&
      checkpoint?.qualification_control_plane?.artifact_id === 9770726672 &&
      checkpoint?.qualification_control_plane?.artifact_digest ===
        "sha256:9c8d760f176b6f5bf002f7cc26493f32e62315ccb2332d39e2340121d1103a2f" &&
      checkpoint?.qualification_control_plane?.conclusion === "EXPECTED_FAILURE_OWNER_UNCLOSED" &&
      checkpoint?.qualification_control_plane?.unknown_changed_path_count === 0 &&
      checkpoint?.qualification_control_plane?.authority_error_count === 0 &&
      checkpoint?.qualification_control_plane?.blocker_count === 1 &&
      checkpoint?.qualification_control_plane?.only_blocker === "EXACT_ONE_PRODUCTION_OWNER",
    "HOST_BINDING_QCP_CHECKPOINT_MISMATCH",
  );
  req(
    checkpoint?.ci?.run_id === 33424840590 &&
      checkpoint?.ci?.build_test_job_id === 99595801142 &&
      checkpoint?.ci?.build_test_conclusion === "success" &&
      checkpoint?.ci?.acceptance_job_id === 99598179824 &&
      checkpoint?.ci?.acceptance_conclusion === "success",
    "HOST_BINDING_CI_CHECKPOINT_MISMATCH",
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
    req(
      checkpoint?.non_effects?.[key] === false,
      "HOST_BINDING_CHECKPOINT_NON_EFFECT_REQUIRED:" + key,
    );
  }
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
  if (platformAuthorizedPreIdentity) {
    req(b.platform_selected === true, "HOST_BINDING_RENDER_PLATFORM_SELECTED_REQUIRED");
    for (const key of [
      "evidence_host_identity_bound",
      "twin_host_identity_bound",
      "exact_two_runtime_service_identities_bound",
      "binding_authorized",
    ]) req(b[key] === false, "HOST_BINDING_PRE_IDENTITY_STATE_REQUIRED:" + key);
  } else {
    for (const key of [
      "platform_selected",
      "evidence_host_identity_bound",
      "twin_host_identity_bound",
      "exact_two_runtime_service_identities_bound",
      "binding_authorized",
    ]) req(b[key] === false, "HOST_BINDING_UNBOUND_STATE_REQUIRED:" + key);
  }

  req(
    a.next_stage?.stage === "BIND_REAL_NON_GITHUB_PLATFORM_SERVICE_IDENTITIES" &&
      a.next_stage?.external_service_provisioning_or_existing_identity_required === true,
    "HOST_BINDING_NEXT_STAGE_REQUIRED",
  );
  if (platformAuthorizedPreIdentity) {
    req(
      a.next_stage?.status ===
        (workspaceBoundPreIdentity
          ? "RENDER_WORKSPACE_BOUND_BLOCKED_ON_RUNTIME_START_BOUNDARY"
          : "RENDER_PLATFORM_AUTHORIZED_AWAITING_SAFE_SERVICE_IDENTITY_PROVISIONING") &&
        a.next_stage?.external_platform_selection_required === false &&
        a.next_stage?.safe_zero_runtime_identity_provisioning_required === true &&
        a.next_stage?.safe_zero_runtime_identity_provisioning_status === expectedZeroRuntimeProvisioningStatus &&
        a.next_stage?.standard_render_create_service_initial_deploy_allowed === false &&
        a.next_stage?.create_then_suspend_race_allowed === false,
      "HOST_BINDING_AUTHORIZED_PRE_IDENTITY_NEXT_STAGE_REQUIRED",
    );
  } else {
    req(
      a.next_stage?.status === "BLOCKED_ON_EXTERNAL_PLATFORM_AND_SERVICE_IDENTITIES" &&
        a.next_stage?.external_platform_selection_required === true,
      "HOST_BINDING_UNAUTHORIZED_NEXT_STAGE_REQUIRED",
    );
  }
  req(
    a.platform_evaluation?.recommended_candidate?.platform_provider === "RENDER" &&
      a.platform_evaluation?.recommended_candidate?.service_class === "BACKGROUND_WORKER" &&
      a.platform_evaluation?.recommended_candidate?.preferred_region === "OREGON_USA" &&
      a.platform_evaluation?.recommended_candidate?.cost_bearing_external_resource === true &&
      a.platform_evaluation?.recommended_candidate?.user_or_external_account_authority_required_before_selection === true,
    "HOST_BINDING_PLATFORM_RECOMMENDATION_BOUNDARY_REQUIRED",
  );
  if (platformAuthorizedPreIdentity) {
    req(
      a.platform_evaluation?.status === "SELECTED_AUTHORIZED" &&
        a.platform_evaluation?.platform_selected === true &&
        a.platform_evaluation?.selected_candidate?.platform_provider === "RENDER" &&
        a.platform_evaluation?.selected_candidate?.service_class === "BACKGROUND_WORKER" &&
        a.platform_evaluation?.selected_candidate?.preferred_region === "OREGON_USA" &&
        a.platform_evaluation?.selected_candidate?.selection_authorized === true &&
        a.platform_evaluation?.selected_candidate?.service_creation_authorized === true &&
        a.platform_evaluation?.selected_candidate?.host_identity_binding_authorized === true &&
        a.platform_evaluation?.selected_candidate?.runtime_start_authorized === false,
      "HOST_BINDING_RENDER_SELECTION_AUTHORITY_REQUIRED",
    );
  } else {
    req(
      a.platform_evaluation?.status === "RECOMMENDED_CANDIDATE_NOT_SELECTED" &&
        a.platform_evaluation?.platform_selected === false,
      "HOST_BINDING_RENDER_SELECTION_MUST_REMAIN_UNAUTHORIZED",
    );
  }
  const render = a.render_candidate_binding_contract;
  req(
    (render?.status === "CANDIDATE_SCHEMA_DEFINED_NOT_AUTHORIZED" ||
      render?.status === "AUTHORIZED_FOR_IDENTITY_PROVISIONING_UNBOUND" ||
      render?.status === "WORKSPACE_BOUND_AUTHORIZED_FOR_IDENTITY_PROVISIONING") &&
      render?.platform_provider === "RENDER" &&
      render?.workspace_owner_id === (workspaceBoundPreIdentity ? "tea-dab2cfvavr4c73ejavog" : null) &&
      render?.region === "oregon" &&
      render?.service_type === "background_worker" &&
      render?.blueprint_type === "worker" &&
      render?.runtime === "docker",
    "HOST_BINDING_RENDER_CANDIDATE_SCHEMA_REQUIRED",
  );
  req(
    render?.evidence_runtime?.service_name === "geox-mcft-cap09-evidence-runtime-v1" &&
      render?.evidence_runtime?.service_id === null &&
      render?.evidence_runtime?.runtime_role === "EVIDENCE_RUNTIME" &&
      render?.twin_runtime?.service_name === "geox-mcft-cap09-twin-runtime-v1" &&
      render?.twin_runtime?.service_id === null &&
      render?.twin_runtime?.runtime_role === "TWIN_RUNTIME",
    "HOST_BINDING_RENDER_SERVICE_IDENTITY_CANDIDATES_REQUIRED",
  );
  req(render?.service_creation_not_authorized === !platformAuthorizedPreIdentity, "HOST_BINDING_RENDER_SERVICE_CREATION_AUTHORITY_MISMATCH");
  for (const key of [
    "deployment_configuration_not_authorized",
    "runtime_secret_injection_not_authorized",
    "runtime_start_not_authorized",
    "production_owner_activation_not_authorized",
  ]) req(render?.[key] === true, "HOST_BINDING_RENDER_EFFECT_AUTHORITY_MUST_REMAIN_FALSE:" + key);
  if (platformAuthorizedPreIdentity) {
    req(
      render?.safe_zero_runtime_identity_provisioning_required === true &&
        render?.safe_zero_runtime_identity_provisioning_status === expectedZeroRuntimeProvisioningStatus &&
        render?.standard_create_service_initial_deploy_allowed === false &&
        render?.create_then_suspend_race_allowed === false,
      "HOST_BINDING_RENDER_ZERO_RUNTIME_PROVISIONING_GUARD_REQUIRED",
    );
  }
  req(
    a.next_stage?.recommended_platform_candidate === "RENDER_BACKGROUND_WORKER" &&
      a.next_stage?.recommended_region === "OREGON_USA" &&
      a.next_stage?.platform_selection_status === (platformAuthorizedPreIdentity ? "AUTHORIZED_SELECTED" : "RECOMMENDED_NOT_AUTHORIZED") &&
      a.next_stage?.render_candidate_binding_schema_defined === true &&
      a.next_stage?.render_workspace_owner_id_status === (workspaceBoundPreIdentity ? "BOUND" : "UNBOUND") &&
      a.next_stage?.render_workspace_owner_id === (workspaceBoundPreIdentity ? "tea-dab2cfvavr4c73ejavog" : undefined) &&
      a.next_stage?.render_evidence_service_id_status === "UNBOUND" &&
      a.next_stage?.render_twin_service_id_status === "UNBOUND",
    "HOST_BINDING_RENDER_NEXT_STAGE_BOUNDARY_REQUIRED",
  );
  req(
    a.next_stage?.platform_selection_authorized === platformAuthorizedPreIdentity &&
      a.next_stage?.service_creation_authorized === platformAuthorizedPreIdentity &&
      a.next_stage?.host_identity_binding_authorized === platformAuthorizedPreIdentity,
    "HOST_BINDING_EXTERNAL_AUTHORITY_PROJECTION_REQUIRED",
  );
  req(
    a.next_stage?.runtime_start_separate === true &&
      a.next_stage?.production_owner_activation_separate === true,
    "HOST_BINDING_EFFECT_SEPARATION_REQUIRED",
  );
  req(
    a.host_binding_arm_ref === "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json" &&
      a.host_binding_arm_status === "UNARMED" &&
      a.next_stage?.host_binding_arm_ref === a.host_binding_arm_ref &&
      a.next_stage?.host_binding_arm_status === "UNARMED",
    "HOST_BINDING_SEPARATE_ARM_REFERENCE_REQUIRED",
  );
  req(
    hostArm.schema_version === "geox_mcft_cap09_production_non_github_host_binding_arm_v1" &&
      hostArm.armed === false &&
      hostArm.platform_selection_authorized === platformAuthorizedPreIdentity &&
      hostArm.platform_provider === (platformAuthorizedPreIdentity ? "RENDER" : null) &&
      hostArm.platform_account_or_project_id === (workspaceBoundPreIdentity ? "tea-dab2cfvavr4c73ejavog" : null) &&
      hostArm.region_or_location === (platformAuthorizedPreIdentity ? "oregon" : null) &&
      hostArm.evidence_service_id === null &&
      hostArm.evidence_service_name === (platformAuthorizedPreIdentity ? "geox-mcft-cap09-evidence-runtime-v1" : null) &&
      hostArm.twin_service_id === null &&
      hostArm.twin_service_name === (platformAuthorizedPreIdentity ? "geox-mcft-cap09-twin-runtime-v1" : null) &&
      hostArm.service_creation_authorized === platformAuthorizedPreIdentity &&
      hostArm.host_identity_binding_authorized === platformAuthorizedPreIdentity &&
      hostArm.runtime_secret_injection_authorized === false &&
      hostArm.deployment_authorized === false &&
      hostArm.runtime_process_start_authorized === false &&
      hostArm.production_owner_activation_authorized === false &&
      hostArm.formal_v5_arm_authorized === false &&
      hostArm.a0_authorized === false &&
      hostArm.o00_authorized === false,
    "HOST_BINDING_SEPARATE_ARM_AUTHORITY_STATE_REQUIRED",
  );
  if (platformAuthorizedPreIdentity) {
    req(hostArm.safe_zero_runtime_identity_provisioning_required === true, "HOST_BINDING_ARM_ZERO_RUNTIME_PROVISIONING_GUARD_REQUIRED");
    if (workspaceBoundPreIdentity) {
      req(hostArm.provider_zero_runtime_identity_provisioning_status === "PROVEN_UNAVAILABLE_ON_RENDER_API_V1" &&
        hostArm.service_creation_execution_blocked_by_runtime_start_boundary === true,
        "HOST_BINDING_RENDER_RUNTIME_START_BOUNDARY_BLOCK_REQUIRED");
      req(a.provider_semantic_evidence?.background_worker_create_contract?.num_instances_minimum === 1 &&
        a.provider_semantic_evidence?.background_worker_create_contract?.zero_instance_create_allowed === false &&
        a.provider_semantic_evidence?.suspend_contract?.service_id_required_before_suspend === true &&
        a.provider_semantic_evidence?.create_then_suspend_satisfies_zero_runtime_boundary === false,
        "HOST_BINDING_RENDER_PROVIDER_SEMANTIC_EVIDENCE_REQUIRED");
    }
  }

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
    stage: workspaceBoundPreIdentity
      ? "RENDER_WORKSPACE_BOUND_BLOCKED_ON_ZERO_RUNTIME_SERVICE_CREATION"
      : platformAuthorizedPreIdentity
        ? "RENDER_PLATFORM_AUTHORIZED_SERVICE_IDENTITIES_UNBOUND"
        : "NON_GITHUB_HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND",
    subject_sha: subjectSha,
    production_execution_host_class: a.production_execution_host_class,
    evidence_runtime_role: a.host_identity_contract.evidence_runtime.runtime_role,
    twin_runtime_role: a.host_identity_contract.twin_runtime.runtime_role,
    platform_selected: platformAuthorizedPreIdentity,
    workspace_owner_id_bound: workspaceBoundPreIdentity,
    platform_account_or_project_id: workspaceBoundPreIdentity ? "tea-dab2cfvavr4c73ejavog" : null,
    platform_selection_authorized: platformAuthorizedPreIdentity,
    service_creation_authorized: platformAuthorizedPreIdentity,
    host_identity_binding_authorized: platformAuthorizedPreIdentity,
    evidence_host_identity_bound: false,
    twin_host_identity_bound: false,
    exact_two_runtime_service_identities_bound: false,
    binding_authorized: false,
    pre_platform_checkpoint_evidence_bound: true,
    remaining_blockers: workspaceBoundPreIdentity ? [
      "RENDER_ZERO_RUNTIME_IDENTITY_PROVISIONING_UNAVAILABLE_WITHOUT_RUNTIME_START",
      "RENDER_EVIDENCE_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
      "RENDER_TWIN_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
      "NON_GITHUB_HOST_BINDING_NOT_COMPLETE",
    ] : platformAuthorizedPreIdentity ? [
      "RENDER_WORKSPACE_OWNER_ID_NOT_BOUND",
      "RENDER_ZERO_RUNTIME_IDENTITY_PROVISIONING_PATH_NOT_PROVEN",
      "RENDER_EVIDENCE_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
      "RENDER_TWIN_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
      "NON_GITHUB_HOST_BINDING_NOT_COMPLETE",
    ] : [
      "RENDER_PLATFORM_SELECTION_NOT_AUTHORIZED",
      "RENDER_WORKSPACE_OWNER_ID_NOT_BOUND",
      "RENDER_EVIDENCE_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
      "RENDER_TWIN_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
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
