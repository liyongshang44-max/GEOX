"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const HOST_AUTH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json",
);
const OWNER_AUTH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
);
const ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
);
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_READINESS_V1_RESULT.json",
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function assert(value, code) {
  if (!value) throw new Error(code);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}
function nonEmpty(value, code) {
  assert(typeof value === "string" && value.trim().length > 0, code);
  return value.trim();
}
function validateIdentity(identity, expectedRole) {
  const provider = nonEmpty(identity.platform_provider, "HOST_IDENTITY_PLATFORM_PROVIDER_REQUIRED:" + expectedRole);
  const providerNormalized = provider.toLowerCase().replace(/[^a-z0-9]/g, "");
  assert(
    !["github", "githubactions", "actions", "gha", "cirunner"].includes(providerNormalized),
    "HOST_IDENTITY_GITHUB_PLATFORM_FORBIDDEN:" + expectedRole,
  );
  const project = nonEmpty(
    identity.platform_account_or_project_id,
    "HOST_IDENTITY_PLATFORM_PROJECT_REQUIRED:" + expectedRole,
  );
  const region = nonEmpty(identity.region_or_location, "HOST_IDENTITY_REGION_REQUIRED:" + expectedRole);
  const serviceId = nonEmpty(identity.service_id, "HOST_IDENTITY_SERVICE_ID_REQUIRED:" + expectedRole);
  const serviceName = nonEmpty(identity.service_name, "HOST_IDENTITY_SERVICE_NAME_REQUIRED:" + expectedRole);
  assert(
    identity.execution_class === "LONG_RUNNING_SERVICE",
    "HOST_IDENTITY_LONG_RUNNING_SERVICE_REQUIRED:" + expectedRole,
  );
  assert(identity.runtime_role === expectedRole, "HOST_IDENTITY_RUNTIME_ROLE_MISMATCH:" + expectedRole);
  return { provider, project, region, serviceId, serviceName };
}

try {
  const subjectSha = String(process.env.SUBJECT_SHA || "");
  assert(/^[0-9a-f]{40}$/.test(subjectSha), "HOST_BINDING_READINESS_SUBJECT_SHA_REQUIRED");
  const a = readJson(HOST_AUTH);
  const owner = readJson(OWNER_AUTH);
  const arm = readJson(ARM);

  assert(
    owner.runtime_credential_binding_evidence?.status === "IMMUTABLE_SUCCESS" &&
      owner.runtime_credential_binding_evidence?.runtime_credential_binding === true,
    "HOST_BINDING_READINESS_RUNTIME_CREDENTIAL_CLOSURE_REQUIRED",
  );
  assert(
    owner.runtime_credential_post_binding_readiness_evidence?.status === "IMMUTABLE_SUCCESS",
    "HOST_BINDING_READINESS_RUNTIME_CREDENTIAL_READBACK_REQUIRED",
  );
  assert(
    a.production_execution_host_class === "NON_GITHUB_LONG_RUNNING_SERVICE",
    "HOST_BINDING_READINESS_HOST_CLASS_REQUIRED",
  );
  assert(
    a.github_actions?.production_execution_host_allowed === false,
    "HOST_BINDING_READINESS_GITHUB_EXECUTION_HOST_FORBIDDEN",
  );
  assert(
    arm.armed === false &&
      arm.runtime_process_start_authorized === false &&
      arm.production_owner_activation_authorized === false &&
      arm.formal_v5_arm_authorized === false &&
      arm.a0_authorized === false &&
      arm.o00_authorized === false,
    "HOST_BINDING_READINESS_RUNTIME_EFFECT_ARM_FORBIDDEN",
  );

  const b = a.binding_state || {};
  const evidence = a.host_identity_contract?.evidence_runtime?.service_identity ?? null;
  const twin = a.host_identity_contract?.twin_runtime?.service_identity ?? null;

  const allUnbound =
    b.platform_selected === false &&
    b.evidence_host_identity_bound === false &&
    b.twin_host_identity_bound === false &&
    b.exact_two_runtime_service_identities_bound === false &&
    b.binding_authorized === false &&
    evidence === null &&
    twin === null;

  if (allUnbound) {
    write({
      schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
      status: "PASS",
      stage: "HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND",
      subject_sha: subjectSha,
      production_execution_host_class: a.production_execution_host_class,
      platform_selected: false,
      evidence_host_identity_bound: false,
      twin_host_identity_bound: false,
      exact_two_runtime_service_identities_bound: false,
      binding_authorized: false,
      runtime_process_start: false,
      production_owner_activation: false,
      provider_request_count: 0,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
    process.exit(0);
  }

  const platformAuthorizedPreIdentity =
    a.status === "RENDER_PLATFORM_AUTHORIZED_SERVICE_IDENTITIES_UNBOUND" &&
    b.platform_selected === true &&
    b.evidence_host_identity_bound === false &&
    b.twin_host_identity_bound === false &&
    b.exact_two_runtime_service_identities_bound === false &&
    b.binding_authorized === false &&
    evidence === null &&
    twin === null;
  if (platformAuthorizedPreIdentity) {
    assert(a.next_stage?.platform_selection_authorized === true && a.next_stage?.service_creation_authorized === true && a.next_stage?.host_identity_binding_authorized === true, "HOST_BINDING_READINESS_EXTERNAL_AUTHORITY_REQUIRED");
    assert(a.render_candidate_binding_contract?.workspace_owner_id === null && a.render_candidate_binding_contract?.evidence_runtime?.service_id === null && a.render_candidate_binding_contract?.twin_runtime?.service_id === null, "HOST_BINDING_READINESS_RENDER_IDENTITIES_MUST_REMAIN_UNBOUND");
    assert(a.render_candidate_binding_contract?.safe_zero_runtime_identity_provisioning_required === true && a.render_candidate_binding_contract?.safe_zero_runtime_identity_provisioning_status === "NOT_PROVEN" && a.render_candidate_binding_contract?.standard_create_service_initial_deploy_allowed === false && a.render_candidate_binding_contract?.create_then_suspend_race_allowed === false, "HOST_BINDING_READINESS_ZERO_RUNTIME_PROVISIONING_GUARD_REQUIRED");
    write({
      schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
      status: "PASS",
      stage: "RENDER_PLATFORM_AUTHORIZED_AWAITING_SAFE_SERVICE_IDENTITIES",
      subject_sha: subjectSha,
      production_execution_host_class: a.production_execution_host_class,
      platform_selected: true,
      platform_provider: "RENDER",
      region_or_location: "oregon",
      platform_selection_authorized: true,
      service_creation_authorized: true,
      host_identity_binding_authorized: true,
      evidence_host_identity_bound: false,
      twin_host_identity_bound: false,
      exact_two_runtime_service_identities_bound: false,
      binding_authorized: false,
      remaining_blockers: [
        "RENDER_WORKSPACE_OWNER_ID_NOT_BOUND",
        "RENDER_ZERO_RUNTIME_IDENTITY_PROVISIONING_PATH_NOT_PROVEN",
        "RENDER_EVIDENCE_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
        "RENDER_TWIN_BACKGROUND_WORKER_SERVICE_ID_NOT_BOUND",
        "NON_GITHUB_HOST_BINDING_NOT_COMPLETE",
      ],
      runtime_process_start: false,
      production_owner_activation: false,
      provider_request_count: 0,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
    process.exit(0);
  }

  assert(b.platform_selected === true, "HOST_BINDING_READINESS_PLATFORM_SELECTED_REQUIRED");
  assert(b.evidence_host_identity_bound === true, "HOST_BINDING_READINESS_EVIDENCE_IDENTITY_BOUND_REQUIRED");
  assert(b.twin_host_identity_bound === true, "HOST_BINDING_READINESS_TWIN_IDENTITY_BOUND_REQUIRED");
  assert(
    b.exact_two_runtime_service_identities_bound === true,
    "HOST_BINDING_READINESS_EXACT_TWO_IDENTITIES_REQUIRED",
  );
  assert(b.binding_authorized === true, "HOST_BINDING_READINESS_BINDING_AUTHORIZATION_REQUIRED");
  assert(evidence && typeof evidence === "object", "HOST_BINDING_READINESS_EVIDENCE_IDENTITY_OBJECT_REQUIRED");
  assert(twin && typeof twin === "object", "HOST_BINDING_READINESS_TWIN_IDENTITY_OBJECT_REQUIRED");

  const evidenceIdentity = validateIdentity(evidence, "EVIDENCE_RUNTIME");
  const twinIdentity = validateIdentity(twin, "TWIN_RUNTIME");

  assert(
    evidenceIdentity.serviceId !== twinIdentity.serviceId,
    "HOST_BINDING_READINESS_SERVICE_IDS_MUST_BE_DISTINCT",
  );
  assert(
    !(evidenceIdentity.provider === twinIdentity.provider &&
      evidenceIdentity.project === twinIdentity.project &&
      evidenceIdentity.serviceName === twinIdentity.serviceName),
    "HOST_BINDING_READINESS_SERVICE_IDENTITIES_MUST_BE_DISTINCT",
  );

  assert(
    a.non_effects?.deployment === false &&
      a.non_effects?.runtime_process_start === false &&
      a.non_effects?.production_owner_activation === false &&
      a.non_effects?.provider_request === false &&
      a.non_effects?.formal_v5_arm === false &&
      a.non_effects?.a0_bootstrap === false &&
      a.non_effects?.o00_started === false,
    "HOST_BINDING_READINESS_BOUND_STATE_NON_EFFECT_REQUIRED",
  );

  write({
    schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
    status: "PASS",
    stage: "EXACT_TWO_NON_GITHUB_SERVICE_IDENTITIES_BOUND_PRE_RUNTIME_START",
    subject_sha: subjectSha,
    production_execution_host_class: a.production_execution_host_class,
    platform_selected: true,
    evidence_host_identity_bound: true,
    twin_host_identity_bound: true,
    exact_two_runtime_service_identities_bound: true,
    binding_authorized: true,
    evidence_host: {
      platform_provider: evidenceIdentity.provider,
      platform_account_or_project_id: evidenceIdentity.project,
      region_or_location: evidenceIdentity.region,
      service_id: evidenceIdentity.serviceId,
      service_name: evidenceIdentity.serviceName,
      runtime_role: "EVIDENCE_RUNTIME",
    },
    twin_host: {
      platform_provider: twinIdentity.provider,
      platform_account_or_project_id: twinIdentity.project,
      region_or_location: twinIdentity.region,
      service_id: twinIdentity.serviceId,
      service_name: twinIdentity.serviceName,
      runtime_role: "TWIN_RUNTIME",
    },
    service_ids_distinct: true,
    github_actions_execution_host: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
    status: "FAIL",
    subject_sha: String(process.env.SUBJECT_SHA || ""),
    error: error instanceof Error ? error.message : String(error),
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  process.exitCode = 1;
}
