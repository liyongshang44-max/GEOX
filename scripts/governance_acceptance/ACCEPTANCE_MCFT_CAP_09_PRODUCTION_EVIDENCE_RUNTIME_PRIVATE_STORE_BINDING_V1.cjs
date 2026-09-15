#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const EXPECTED_BASE =
  "9360c2cd06961688fd192803c7006a29fc9bca4e";

const AUTH =
  "docs/digital_twin/mcft/cap_09/" +
  "GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json";

const ACCEPT =
  "scripts/governance_acceptance/" +
  "ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1.cjs";

const WORKFLOW =
  ".github/workflows/" +
  "mcft-cap-09-production-evidence-runtime-private-store-binding-v1.yml";

const RUNTIME =
  "apps/server/src/external_evidence/" +
  "mcft_cap09_evidence_runtime_process_v1.ts";

const FORMAL =
  "docs/digital_twin/mcft/cap_09/" +
  "GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json";

const OUT =
  "acceptance-output/" +
  "MCFT_CAP_09_PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1_RESULT.json";

const EXPECTED_FILES = [AUTH, ACCEPT, WORKFLOW].sort();

const EVIDENCE_SECRETS = [
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY"
];

const FORMAL_SECRETS = [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
];

function fail(code) {
  throw new Error(code);
}

function eq(actual, expected, code) {
  if (actual !== expected) {
    fail(
      code +
      ":expected=" +
      JSON.stringify(expected) +
      ":actual=" +
      JSON.stringify(actual)
    );
  }
}

function truthy(value, code) {
  eq(value, true, code);
}

function falsy(value, code) {
  eq(value, false, code);
}

function sameArray(actual, expected, code) {
  eq(
    JSON.stringify(actual),
    JSON.stringify(expected),
    code
  );
}

function git(...args) {
  return cp.execFileSync(
    "git",
    args,
    { encoding: "utf8" }
  ).trim();
}

function blob(ref, file) {
  return git("rev-parse", `${ref}:${file}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateAuthority(authority) {
  eq(
    authority.schema_version,
    "geox_mcft_cap09_production_evidence_runtime_private_store_binding_v1",
    "STORE_BINDING_SCHEMA"
  );

  eq(
    authority.authority_id,
    "GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1",
    "STORE_BINDING_AUTHORITY_ID"
  );

  eq(
    authority.base_main_sha,
    EXPECTED_BASE,
    "STORE_BINDING_BASE"
  );

  eq(
    authority.record_status,
    "NON_SECRET_BINDING_IDENTITY_DEFINED_PROVIDER_MATERIALIZATION_PENDING",
    "STORE_BINDING_RECORD_STATUS"
  );

  eq(
    authority.runtime_contract.process_ref,
    RUNTIME,
    "STORE_BINDING_RUNTIME_REF"
  );

  eq(
    authority.runtime_contract.raw_storage_authority,
    "EVIDENCE_RUNTIME_S3_CREDENTIALS_ONLY",
    "STORE_BINDING_RUNTIME_AUTHORITY"
  );

  eq(
    authority.runtime_contract.database_principal,
    "geox_mcft_cap09_evidence_runtime_login_v1",
    "STORE_BINDING_DATABASE_PRINCIPAL"
  );

  const binding = authority.binding_identity;

  eq(
    binding.provider_contract,
    "S3_COMPATIBLE_PRIVATE_OBJECT_STORE",
    "STORE_BINDING_PROVIDER_CONTRACT"
  );

  eq(
    binding.physical_provider,
    "CLOUDFLARE_R2",
    "STORE_BINDING_PROVIDER_SELECTION"
  );

  eq(
    binding.physical_provider_selection_status,
    "EXPLICIT_INFRASTRUCTURE_ADJUDICATION_NOT_YET_MATERIALIZED",
    "STORE_BINDING_PROVIDER_SELECTION_STATUS"
  );

  truthy(
    binding.same_r2_account_as_formal_raw_allowed,
    "STORE_BINDING_SAME_ACCOUNT_ALLOWED"
  );

  eq(
    binding.bucket,
    "geox-mcft-cap09-evidence-runtime-v1",
    "STORE_BINDING_BUCKET"
  );

  truthy(
    binding.bucket_identity_must_be_explicit,
    "STORE_BINDING_BUCKET_IDENTITY"
  );

  truthy(
    binding.bucket_must_be_separate_from_formal_raw,
    "STORE_BINDING_SEPARATE_BUCKET_REQUIRED"
  );

  eq(
    binding.formal_raw_bucket,
    "geox-mcft-cap09-formal-raw-v1",
    "STORE_BINDING_FORMAL_BUCKET"
  );

  falsy(
    binding.formal_raw_bucket_reuse_allowed,
    "STORE_BINDING_FORMAL_BUCKET_REUSE_FORBIDDEN"
  );

  eq(
    binding.credential_scope,
    "BUCKET_SCOPED",
    "STORE_BINDING_CREDENTIAL_SCOPE"
  );

  truthy(
    binding.credential_must_be_separate_from_formal_raw,
    "STORE_BINDING_SEPARATE_CREDENTIAL_REQUIRED"
  );

  falsy(
    binding.silent_formal_raw_credential_alias_allowed,
    "STORE_BINDING_SILENT_ALIAS_FORBIDDEN"
  );

  eq(
    binding.credential_source,
    "PROCESS_ENVIRONMENT_SECRET_BINDING",
    "STORE_BINDING_CREDENTIAL_SOURCE"
  );

  falsy(
    binding.credential_material_repository_allowed,
    "STORE_BINDING_REPOSITORY_SECRET_FORBIDDEN"
  );

  eq(
    binding.endpoint_transport,
    "HTTPS_ONLY",
    "STORE_BINDING_HTTPS_REQUIRED"
  );

  falsy(
    binding.local_or_ci_fallback_allowed,
    "STORE_BINDING_FALLBACK_FORBIDDEN"
  );

  falsy(
    binding.provider_specific_runtime_branching_required,
    "STORE_BINDING_PROVIDER_BRANCHING_FORBIDDEN"
  );

  sameArray(
    authority.required_secret_bindings,
    EVIDENCE_SECRETS,
    "STORE_BINDING_EXACT_EVIDENCE_SECRET_NAMESPACE"
  );

  sameArray(
    authority.forbidden_formal_raw_secret_aliases,
    FORMAL_SECRETS,
    "STORE_BINDING_EXACT_FORMAL_SECRET_NAMESPACE"
  );

  const overlap = authority.required_secret_bindings.filter(
    (name) => new Set(FORMAL_SECRETS).has(name)
  );

  eq(
    overlap.length,
    0,
    "STORE_BINDING_SECRET_NAMESPACE_OVERLAP"
  );

  eq(
    authority.formal_raw_separation.authority_ref,
    FORMAL,
    "STORE_BINDING_FORMAL_AUTHORITY_REF"
  );

  eq(
    authority.formal_raw_separation.bucket,
    "geox-mcft-cap09-formal-raw-v1",
    "STORE_BINDING_FORMAL_SEPARATION_BUCKET"
  );

  truthy(
    authority.formal_raw_separation.separate_bucket_identity_required,
    "STORE_BINDING_FORMAL_SEPARATE_BUCKET"
  );

  truthy(
    authority.formal_raw_separation.separate_credential_identity_required,
    "STORE_BINDING_FORMAL_SEPARATE_CREDENTIAL"
  );

  const readiness =
    authority.credential_rematerialization_readiness_contract;

  truthy(
    readiness.new_current_state_verifier_required,
    "STORE_BINDING_NEW_VERIFIER_REQUIRED"
  );

  truthy(
    readiness.historical_zero_row_provisioning_verifier_reuse_forbidden,
    "STORE_BINDING_HISTORICAL_VERIFIER_REUSE_FORBIDDEN"
  );

  eq(
    readiness.operational_database_name,
    "geox_mcft_cap09_production_runtime_v1",
    "STORE_BINDING_OPERATIONAL_DATABASE"
  );

  eq(
    readiness.exact_table_count,
    41,
    "STORE_BINDING_EXACT_TABLE_COUNT"
  );

  truthy(
    readiness.non_lease_production_state_rows_must_be_zero,
    "STORE_BINDING_NON_LEASE_ZERO_REQUIRED"
  );

  truthy(
    readiness.historical_expired_evidence_lease_residue_allowed,
    "STORE_BINDING_EVIDENCE_EXPIRED_RESIDUE_ALLOWED"
  );

  truthy(
    readiness.historical_expired_twin_lease_residue_allowed,
    "STORE_BINDING_TWIN_EXPIRED_RESIDUE_ALLOWED"
  );

  eq(
    readiness.current_live_evidence_owner_count_required,
    0,
    "STORE_BINDING_EVIDENCE_LIVE_OWNER_ZERO"
  );

  eq(
    readiness.current_live_twin_owner_count_required,
    0,
    "STORE_BINDING_TWIN_LIVE_OWNER_ZERO"
  );

  truthy(
    readiness.existing_evidence_login_principal_must_be_preserved,
    "STORE_BINDING_EVIDENCE_LOGIN_PRESERVE"
  );

  truthy(
    readiness.existing_twin_login_principal_must_be_preserved,
    "STORE_BINDING_TWIN_LOGIN_PRESERVE"
  );

  falsy(
    readiness.login_role_recreation_allowed,
    "STORE_BINDING_LOGIN_RECREATION_FORBIDDEN"
  );

  truthy(
    readiness.password_rotation_only,
    "STORE_BINDING_PASSWORD_ROTATION_ONLY"
  );

  truthy(
    readiness.exact_one_privilege_membership_each_required,
    "STORE_BINDING_EXACT_ONE_MEMBERSHIP"
  );

  falsy(
    readiness.cross_plane_membership_allowed,
    "STORE_BINDING_CROSS_PLANE_FORBIDDEN"
  );

  truthy(
    readiness.both_role_specific_urls_must_target_same_operational_database,
    "STORE_BINDING_SAME_DATABASE_REQUIRED"
  );

  sameArray(
    readiness.storage_capability_proof_required,
    [
      "AUTHENTICATED_PUT",
      "AUTHENTICATED_HEAD",
      "AUTHENTICATED_DELETE"
    ],
    "STORE_BINDING_STORAGE_PROOF_SET"
  );

  truthy(
    readiness.formal_raw_bucket_alias_forbidden,
    "STORE_BINDING_FORMAL_BUCKET_ALIAS_FORBIDDEN"
  );

  truthy(
    readiness.formal_raw_credential_alias_forbidden,
    "STORE_BINDING_FORMAL_CREDENTIAL_ALIAS_FORBIDDEN"
  );

  const effect = authority.effect_if_merged_to_protected_main;

  truthy(
    effect.production_evidence_private_store_identity_defined,
    "STORE_BINDING_IDENTITY_EFFECT"
  );

  for (const key of [
    "cloudflare_r2_bucket_created",
    "evidence_s3_credential_created",
    "local_operator_secret_materialized",
    "github_secret_materialized",
    "database_password_rotated",
    "runtime_process_start",
    "production_owner_activation",
    "formal_v5_arm",
    "a0_authorized",
    "o00_o23_started",
    "mcft_cap09_completed"
  ]) {
    falsy(
      effect[key],
      `STORE_BINDING_PREMATURE_EFFECT:${key}`
    );
  }

  const next = authority.next_stage;

  eq(
    next.stage,
    "PROVIDER_AND_CREDENTIAL_MATERIALIZATION",
    "STORE_BINDING_NEXT_STAGE"
  );

  truthy(
    next.separate_explicit_operator_authorization_required,
    "STORE_BINDING_SEPARATE_OPERATOR_AUTHORITY_REQUIRED"
  );

  falsy(
    next.cloudflare_mutation_authorized_by_this_record,
    "STORE_BINDING_CLOUDFLARE_MUTATION_FORBIDDEN"
  );

  falsy(
    next.neon_password_rotation_authorized_by_this_record,
    "STORE_BINDING_NEON_ROTATION_FORBIDDEN"
  );

  falsy(
    next.runtime_start_authorized_by_this_record,
    "STORE_BINDING_RUNTIME_START_FORBIDDEN"
  );

  truthy(
    next.qcp_registration_may_be_required_as_separate_successor,
    "STORE_BINDING_QCP_SUCCESSOR_BOUNDARY"
  );

  const serialized = JSON.stringify(authority);

  if (/https?:\/\//i.test(serialized)) {
    fail("STORE_BINDING_ENDPOINT_VALUE_MUST_NOT_BE_EMBEDDED");
  }
}

function expectRejected(name, authority, mutate) {
  const test = clone(authority);
  mutate(test);

  let rejected = false;

  try {
    validateAuthority(test);
  } catch {
    rejected = true;
  }

  if (!rejected) {
    fail(`STORE_BINDING_NEGATIVE_NOT_REJECTED:${name}`);
  }
}

function selftest() {
  const authority = readJson(AUTH);

  validateAuthority(authority);

  const cases = [];

  expectRejected(
    "formal bucket reuse",
    authority,
    (x) => {
      x.binding_identity.bucket =
        "geox-mcft-cap09-formal-raw-v1";
    }
  );
  cases.push("formal bucket reuse");

  expectRejected(
    "provider drift",
    authority,
    (x) => {
      x.binding_identity.physical_provider = "AWS_S3";
    }
  );
  cases.push("provider drift");

  expectRejected(
    "secret namespace alias",
    authority,
    (x) => {
      x.required_secret_bindings[0] =
        "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT";
    }
  );
  cases.push("secret namespace alias");

  expectRejected(
    "runtime start promotion",
    authority,
    (x) => {
      x.effect_if_merged_to_protected_main.runtime_process_start =
        true;
    }
  );
  cases.push("runtime start promotion");

  expectRejected(
    "historical zero-row verifier reuse",
    authority,
    (x) => {
      x.credential_rematerialization_readiness_contract
        .historical_zero_row_provisioning_verifier_reuse_forbidden =
        false;
    }
  );
  cases.push("historical zero-row verifier reuse");

  expectRejected(
    "expired lease residue forbidden",
    authority,
    (x) => {
      x.credential_rematerialization_readiness_contract
        .historical_expired_evidence_lease_residue_allowed =
        false;
    }
  );
  cases.push("expired lease residue forbidden");

  expectRejected(
    "login recreation",
    authority,
    (x) => {
      x.credential_rematerialization_readiness_contract
        .login_role_recreation_allowed =
        true;
    }
  );
  cases.push("login recreation");

  console.log(
    JSON.stringify(
      {
        schema_version:
          "geox_mcft_cap09_production_evidence_runtime_private_store_binding_selftest_v1",
        status: "PASS",
        positive_cases: 1,
        negative_cases: cases.length,
        negative_case_names: cases
      },
      null,
      2
    )
  );
}

if (process.argv.includes("--selftest")) {
  selftest();
  process.exit(0);
}

const base = String(process.env.MCFT_BASE_SHA || "").trim();

if (!base) {
  fail("STORE_BINDING_BASE_SHA_REQUIRED");
}

eq(
  base,
  EXPECTED_BASE,
  "STORE_BINDING_EXACT_BASE_REQUIRED"
);

const changed = git(
  "diff",
  "--name-only",
  `${base}...HEAD`
)
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

sameArray(
  changed,
  EXPECTED_FILES,
  "STORE_BINDING_EXACT_THREE_FILE_BOUNDARY"
);

/*
 * Pin the two authority surfaces we explicitly depend upon.
 * This PR defines a new binding; it must not silently alter
 * either the existing production Evidence runtime contract
 * or the existing Formal Raw store contract.
 */
eq(
  blob(base, RUNTIME),
  "0282fd0de7511cf72e836df6ac0a9a14827c9126",
  "STORE_BINDING_BASE_RUNTIME_BLOB"
);

eq(
  blob("HEAD", RUNTIME),
  "0282fd0de7511cf72e836df6ac0a9a14827c9126",
  "STORE_BINDING_RUNTIME_MUTATED"
);

eq(
  blob(base, FORMAL),
  "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  "STORE_BINDING_BASE_FORMAL_BLOB"
);

eq(
  blob("HEAD", FORMAL),
  "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  "STORE_BINDING_FORMAL_AUTHORITY_MUTATED"
);

const runtimeSource = fs.readFileSync(RUNTIME, "utf8");

for (const marker of [
  'raw_storage_authority: "EVIDENCE_RUNTIME_S3_CREDENTIALS_ONLY"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_REGION"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY"'
]) {
  if (!runtimeSource.includes(marker)) {
    fail(`STORE_BINDING_RUNTIME_MARKER_MISSING:${marker}`);
  }
}

const formal = readJson(FORMAL);

eq(
  formal.binding_contract.provider_contract,
  "S3_COMPATIBLE_PRIVATE_OBJECT_STORE",
  "STORE_BINDING_FORMAL_PROVIDER_CONTRACT"
);

eq(
  formal.binding_contract.bucket,
  "geox-mcft-cap09-formal-raw-v1",
  "STORE_BINDING_FORMAL_BUCKET_AUTHORITY"
);

sameArray(
  formal.required_secret_bindings,
  FORMAL_SECRETS,
  "STORE_BINDING_FORMAL_SECRET_CONTRACT"
);

const authority = readJson(AUTH);

validateAuthority(authority);

const result = {
  schema_version:
    "geox_mcft_cap09_production_evidence_runtime_private_store_binding_result_v1",

  status: "PASS",

  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),

  exact_changed_file_count: changed.length,

  provider_contract:
    authority.binding_identity.provider_contract,

  physical_provider:
    authority.binding_identity.physical_provider,

  evidence_runtime_bucket:
    authority.binding_identity.bucket,

  formal_raw_bucket:
    authority.binding_identity.formal_raw_bucket,

  evidence_and_formal_bucket_distinct: true,
  evidence_and_formal_credentials_distinct: true,

  credential_material_repository_bound: false,

  residue_aware_credential_verifier_contract_defined: true,

  cloudflare_mutation_performed: false,
  neon_password_rotation_performed: false,
  runtime_process_started: false,
  production_owner_activated: false,
  formal_v5_armed: false,
  a0_authorized: false,
  o00_o23_started: false,

  qcp_registration_claimed: false,
  mcft_cap09_completed: false
};

fs.mkdirSync(
  "acceptance-output",
  { recursive: true }
);

fs.writeFileSync(
  OUT,
  JSON.stringify(result, null, 2) + "\n"
);

console.log(
  JSON.stringify(result, null, 2)
);
