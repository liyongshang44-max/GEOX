"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_CREDENTIAL_READINESS_V1_RESULT.json",
);
const ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
);
const OWNER_AUTHORITY = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
);
const PRIVATE_STORE_AUTHORITY = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json",
);

const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const EVIDENCE_LOGIN = "geox_mcft_cap09_evidence_runtime_login_v1";
const TWIN_LOGIN = "geox_mcft_cap09_twin_runtime_login_v1";
const EVIDENCE_PRIVILEGE = "geox_mcft_cap09_evidence_runtime_v1";
const TWIN_PRIVILEGE = "geox_mcft_cap09_twin_runtime_v1";
const EVIDENCE_LEASE = "external_evidence_producer_lease_v1";
const TWIN_LEASE = "twin_runtime_lease_v1";
const LEASE_TABLES = new Set([EVIDENCE_LEASE, TWIN_LEASE]);

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("RUNTIME_CREDENTIAL_READINESS_ENV_REQUIRED:" + name);
  return value;
}

function normalizedPort(url) {
  return url.port || "5432";
}

function quoteIdent(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function bool(value) {
  return value === "t" || value === "true";
}

function adminTargetUrl(raw) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("RUNTIME_CREDENTIAL_SEED_POSTGRES_URL_REQUIRED");
  }
  url.pathname = "/" + TARGET_DB;
  return url.toString();
}

function roleTargetUrl(raw, role) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("RUNTIME_CREDENTIAL_POSTGRES_URL_REQUIRED:" + role);
  }
  url.pathname = "/" + TARGET_DB;
  url.username = role;
  url.password = "";
  return url.toString();
}

function query(url, sql, password) {
  const env = { ...process.env };
  if (password !== undefined) env.PGPASSWORD = password;
  try {
    return execFileSync(
      "psql",
      ["--dbname", url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env },
    ).trim();
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error
      ? String(error.stderr || "")
      : "";
    throw new Error(
      "RUNTIME_CREDENTIAL_QUERY_FAILED:" +
      stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]").slice(-800),
    );
  }
}

function assertContract() {
  const binding = JSON.parse(fs.readFileSync(PRIVATE_STORE_AUTHORITY, "utf8"));
  const readiness = binding.credential_rematerialization_readiness_contract || {};
  assert.equal(readiness.new_current_state_verifier_required, true);
  assert.equal(readiness.historical_zero_row_provisioning_verifier_reuse_forbidden, true);
  assert.equal(readiness.operational_database_name, TARGET_DB);
  assert.equal(readiness.exact_table_count, 41);
  assert.equal(readiness.non_lease_production_state_rows_must_be_zero, true);
  assert.equal(readiness.historical_expired_evidence_lease_residue_allowed, true);
  assert.equal(readiness.historical_expired_twin_lease_residue_allowed, true);
  assert.equal(readiness.current_live_evidence_owner_count_required, 0);
  assert.equal(readiness.current_live_twin_owner_count_required, 0);
  assert.equal(readiness.existing_evidence_login_principal_must_be_preserved, true);
  assert.equal(readiness.existing_twin_login_principal_must_be_preserved, true);
  assert.equal(readiness.login_role_recreation_allowed, false);
  assert.equal(readiness.password_rotation_only, true);
  assert.equal(readiness.exact_one_privilege_membership_each_required, true);
  assert.equal(readiness.cross_plane_membership_allowed, false);
  return readiness;
}

function assertAuthorityBoundary() {
  const arm = JSON.parse(fs.readFileSync(ARM, "utf8"));
  const authority = JSON.parse(fs.readFileSync(OWNER_AUTHORITY, "utf8"));
  assert.equal(authority.target_database?.database_name, TARGET_DB);
  assert.equal(authority.target_database?.schema_acl_materialization_complete, true);

  const credentialArm = arm.armed === true && arm.runtime_credential_binding_authorized === true;
  if (arm.armed === true) {
    assert.equal(credentialArm, true, "RUNTIME_CREDENTIAL_ONLY_CREDENTIAL_BINDING_ARM_ALLOWED");
    assert.equal(arm.exact_target_database_name, TARGET_DB, "RUNTIME_CREDENTIAL_ARM_DATABASE_MISMATCH");
  } else {
    assert.equal(arm.exact_target_database_name, null, "RUNTIME_CREDENTIAL_UNARMED_TARGET_MUST_BE_NULL");
  }

  for (const key of [
    "phase4_twin_acl_materialization_authorized",
    "service_login_bootstrap_authorized",
    "runtime_process_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    assert.equal(arm[key], false, "RUNTIME_CREDENTIAL_LATER_AUTHORITY_FORBIDDEN:" + key);
  }
  if (arm.armed !== true) {
    assert.equal(arm.runtime_credential_binding_authorized, false, "RUNTIME_CREDENTIAL_UNARMED_BINDING_AUTHORITY_FALSE");
  }
  return { arm, authority, credentialArm };
}

function tableState(adminUrl) {
  const tableNames = query(
    adminUrl,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;",
  ).split(/\r?\n/).filter(Boolean);
  assert.equal(tableNames.length, 41, "RUNTIME_CREDENTIAL_EXACT_41_TABLES_REQUIRED");
  assert.equal(tableNames.includes(EVIDENCE_LEASE), true, "RUNTIME_CREDENTIAL_EVIDENCE_LEASE_TABLE_REQUIRED");
  assert.equal(tableNames.includes(TWIN_LEASE), true, "RUNTIME_CREDENTIAL_TWIN_LEASE_TABLE_REQUIRED");

  let nonLeaseRows = 0;
  const nonLeaseNonzero = [];
  for (const table of tableNames) {
    if (LEASE_TABLES.has(table)) continue;
    const count = Number(query(adminUrl, "SELECT count(*)::int FROM public." + quoteIdent(table) + ";") || "0");
    nonLeaseRows += count;
    if (count !== 0) nonLeaseNonzero.push({ table, count });
  }
  assert.equal(nonLeaseRows, 0, "RUNTIME_CREDENTIAL_NON_LEASE_PRODUCTION_STATE_MUST_BE_ZERO:" + JSON.stringify(nonLeaseNonzero));

  function leaseSummary(table) {
    const row = query(
      adminUrl,
      "SELECT count(*)::int," +
        "count(*) FILTER (WHERE expires_at > clock_timestamp())::int," +
        "count(*) FILTER (WHERE expires_at <= clock_timestamp())::int " +
        "FROM public." + quoteIdent(table) + ";",
    ).split("|").map((v) => Number(v || "0"));
    assert.equal(row.length, 3, "RUNTIME_CREDENTIAL_LEASE_SUMMARY_REQUIRED:" + table);
    assert.equal(row[1], 0, "RUNTIME_CREDENTIAL_LIVE_LEASE_OWNER_FORBIDDEN:" + table);
    assert.equal(row[2], row[0], "RUNTIME_CREDENTIAL_NON_EXPIRED_LEASE_RESIDUE_FORBIDDEN:" + table);
    return { total: row[0], live: row[1], expired: row[2] };
  }

  return {
    table_count: tableNames.length,
    non_lease_table_count: tableNames.length - LEASE_TABLES.size,
    non_lease_row_count: nonLeaseRows,
    evidence_lease: leaseSummary(EVIDENCE_LEASE),
    twin_lease: leaseSummary(TWIN_LEASE),
  };
}

function assertRole(adminUrl, role, expectedPrivilege) {
  const state = query(
    adminUrl,
    [
      "WITH target AS (",
      "  SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls",
      "    FROM pg_catalog.pg_roles WHERE rolname='" + role + "'",
      ")",
      "SELECT rolcanlogin::text,rolinherit::text,rolsuper::text,rolcreatedb::text,rolcreaterole::text,",
      "       rolreplication::text,rolbypassrls::text,",
      "       ((SELECT count(*) FROM pg_catalog.pg_database d WHERE d.datdba=target.oid)+",
      "        (SELECT count(*) FROM pg_catalog.pg_namespace n WHERE n.nspowner=target.oid)+",
      "        (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relowner=target.oid)+",
      "        (SELECT count(*) FROM pg_catalog.pg_proc p WHERE p.proowner=target.oid))::int,",
      "       ((SELECT count(*) FROM pg_catalog.pg_class object",
      "           JOIN pg_catalog.pg_namespace namespace ON namespace.oid=object.relnamespace",
      "           CROSS JOIN LATERAL pg_catalog.aclexplode(object.relacl) acl",
      "          WHERE namespace.nspname='public' AND acl.grantee=target.oid)+",
      "        (SELECT count(*) FROM pg_catalog.pg_proc routine",
      "           JOIN pg_catalog.pg_namespace namespace ON namespace.oid=routine.pronamespace",
      "           CROSS JOIN LATERAL pg_catalog.aclexplode(routine.proacl) acl",
      "          WHERE namespace.nspname='public' AND acl.grantee=target.oid)+",
      "        (SELECT count(*) FROM pg_catalog.pg_namespace namespace",
      "           CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) acl",
      "          WHERE namespace.nspname='public' AND acl.grantee=target.oid))::int",
      "  FROM target;",
    ].join("\n"),
  ).split("|");
  assert.equal(state.length, 9, "RUNTIME_CREDENTIAL_ROLE_STATE_REQUIRED:" + role);
  assert.equal(bool(state[0]), true, "RUNTIME_CREDENTIAL_LOGIN_REQUIRED:" + role);
  assert.equal(bool(state[1]), true, "RUNTIME_CREDENTIAL_INHERIT_REQUIRED:" + role);
  for (let i = 2; i <= 6; i += 1) {
    assert.equal(bool(state[i]), false, "RUNTIME_CREDENTIAL_RESTRICTED_ATTRIBUTE:" + role);
  }
  assert.equal(Number(state[7]), 0, "RUNTIME_CREDENTIAL_OBJECT_OWNERSHIP_FORBIDDEN:" + role);
  assert.equal(Number(state[8]), 0, "RUNTIME_CREDENTIAL_DIRECT_PUBLIC_ACL_FORBIDDEN:" + role);

  const membership = query(
    adminUrl,
    [
      "SELECT granted.rolname,m.admin_option::text,m.inherit_option::text,m.set_option::text",
      "  FROM pg_catalog.pg_auth_members m",
      "  JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
      "  JOIN pg_catalog.pg_roles member ON member.oid=m.member",
      " WHERE member.rolname='" + role + "'",
      " ORDER BY granted.rolname;",
    ].join("\n"),
  );
  const rows = membership ? membership.split(/\r?\n/) : [];
  assert.equal(rows.length, 1, "RUNTIME_CREDENTIAL_EXACT_ONE_MEMBERSHIP:" + role);
  const fields = rows[0].split("|");
  assert.equal(fields[0], expectedPrivilege, "RUNTIME_CREDENTIAL_PRIVILEGE_MISMATCH:" + role);
  assert.equal(bool(fields[1]), false, "RUNTIME_CREDENTIAL_ADMIN_OPTION_FORBIDDEN:" + role);
  assert.equal(bool(fields[2]), true, "RUNTIME_CREDENTIAL_MEMBERSHIP_INHERIT_REQUIRED:" + role);
  assert.equal(bool(fields[3]), false, "RUNTIME_CREDENTIAL_SET_OPTION_FORBIDDEN:" + role);
}

function assertConnectivity(url, password, role, expectedPrivilege, oppositePrivilege) {
  const row = query(
    url,
    "SELECT current_database()::text,current_user::text," +
      "pg_catalog.pg_has_role(current_user,'" + expectedPrivilege + "','USAGE')::text," +
      "pg_catalog.pg_has_role(current_user,'" + oppositePrivilege + "','USAGE')::text;",
    password,
  ).split("|");
  assert.equal(row[0], TARGET_DB, "RUNTIME_CREDENTIAL_CONNECTIVITY_DATABASE:" + role);
  assert.equal(row[1], role, "RUNTIME_CREDENTIAL_CONNECTIVITY_IDENTITY:" + role);
  assert.equal(bool(row[2]), true, "RUNTIME_CREDENTIAL_EXPECTED_PRIVILEGE:" + role);
  assert.equal(bool(row[3]), false, "RUNTIME_CREDENTIAL_OPPOSITE_PRIVILEGE_FORBIDDEN:" + role);
}

function validateBoundUrl(raw, expectedRole, expectedPassword, seed) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("RUNTIME_CREDENTIAL_POSTGRES_URL_REQUIRED:" + expectedRole);
  }
  assert.equal(decodeURIComponent(url.username), expectedRole, "RUNTIME_CREDENTIAL_LOGIN_ROLE_MISMATCH:" + expectedRole);
  assert.equal(decodeURIComponent(url.password), expectedPassword, "RUNTIME_CREDENTIAL_PASSWORD_MISMATCH:" + expectedRole);
  assert.equal(decodeURIComponent(url.pathname.replace(/^\//, "")), TARGET_DB, "RUNTIME_CREDENTIAL_DATABASE_MISMATCH:" + expectedRole);
  assert.equal(url.hostname, seed.hostname, "RUNTIME_CREDENTIAL_HOST_MISMATCH:" + expectedRole);
  assert.equal(normalizedPort(url), normalizedPort(seed), "RUNTIME_CREDENTIAL_PORT_MISMATCH:" + expectedRole);
  for (const key of ["sslmode", "channel_binding"]) {
    const expected = seed.searchParams.get(key);
    if (expected !== null) assert.equal(url.searchParams.get(key), expected, "RUNTIME_CREDENTIAL_CONNECTION_PARAMETER_MISMATCH:" + expectedRole + ":" + key);
  }
  url.password = "";
  return url.toString();
}

function main() {
  const subjectSha = requiredEnv("SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "RUNTIME_CREDENTIAL_SUBJECT_SHA_REQUIRED");
  const readiness = assertContract();
  const { arm, authority, credentialArm } = assertAuthorityBoundary();

  const seedRaw = requiredEnv("SEED_DATABASE_URL");
  const evidencePassword = requiredEnv("EVIDENCE_RUNTIME_PASSWORD_SECRET");
  const twinPassword = requiredEnv("TWIN_RUNTIME_PASSWORD_SECRET");
  const seed = new URL(seedRaw);
  const adminUrl = adminTargetUrl(seedRaw);
  const endpointMetadata = {
    protocol: seed.protocol,
    hostname: seed.hostname,
    port: normalizedPort(seed),
    sslmode: seed.searchParams.get("sslmode"),
    channel_binding: seed.searchParams.get("channel_binding"),
  };

  const counts = query(
    adminUrl,
    "SELECT current_database()::text," +
      "(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')," +
      "(SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')," +
      "(SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('" + EVIDENCE_LOGIN + "','" + TWIN_LOGIN + "'));",
  ).split("|");
  assert.equal(counts[0], TARGET_DB, "RUNTIME_CREDENTIAL_DATABASE_MISMATCH");
  assert.equal(Number(counts[1]), readiness.exact_table_count, "RUNTIME_CREDENTIAL_41_TABLES_REQUIRED");
  assert.equal(Number(counts[2]), 3, "RUNTIME_CREDENTIAL_THREE_ROUTINES_REQUIRED");
  assert.equal(Number(counts[3]), 2, "RUNTIME_CREDENTIAL_EXISTING_LOGIN_PRINCIPALS_REQUIRED");

  const state = tableState(adminUrl);
  assertRole(adminUrl, EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE);
  assertRole(adminUrl, TWIN_LOGIN, TWIN_PRIVILEGE);

  assertConnectivity(roleTargetUrl(seedRaw, EVIDENCE_LOGIN), evidencePassword, EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE, TWIN_PRIVILEGE);
  assertConnectivity(roleTargetUrl(seedRaw, TWIN_LOGIN), twinPassword, TWIN_LOGIN, TWIN_PRIVILEGE, EVIDENCE_PRIVILEGE);

  const evidenceUrlRaw = String(process.env.EVIDENCE_RUNTIME_DATABASE_URL_SECRET || "").trim();
  const twinUrlRaw = String(process.env.TWIN_RUNTIME_DATABASE_URL_SECRET || "").trim();
  const urlCount = Number(Boolean(evidenceUrlRaw)) + Number(Boolean(twinUrlRaw));
  assert.ok(urlCount === 0 || urlCount === 2, "RUNTIME_CREDENTIAL_PARTIAL_URL_SECRET_STATE_FORBIDDEN");

  if (credentialArm) {
    const ready = authority.runtime_credential_url_ready_evidence;
    assert.equal(ready?.status, "IMMUTABLE_SUCCESS_PRE_ARM", "RUNTIME_CREDENTIAL_URL_READY_EVIDENCE_REQUIRED");
    assert.equal(ready?.subject_sha, "a3278aec6c2134356d6a5de39da32760dbd43a71", "RUNTIME_CREDENTIAL_URL_READY_SUBJECT_MISMATCH");
    assert.equal(
      ready?.runtime_credential_readiness?.artifact_digest,
      "sha256:45a7109537ba10011f7dfb9a72bfc6c2b2064ae3ff6e7bf4d62e4e12fea59f69",
      "RUNTIME_CREDENTIAL_URL_READY_DIGEST_MISMATCH",
    );
    assert.equal(
      ready?.runtime_credential_readiness?.runtime_credential_pre_arm_ready,
      true,
      "RUNTIME_CREDENTIAL_URL_READY_SHAPE_REQUIRED",
    );
    assert.equal(
      ready?.runtime_credential_readiness?.runtime_database_url_secret_count,
      2,
      "RUNTIME_CREDENTIAL_URL_READY_EXACT_TWO_REQUIRED",
    );
    assert.equal(urlCount, 2, "RUNTIME_CREDENTIAL_ARM_REQUIRES_EXACT_TWO_URLS");
  }

  let evidenceUrl = null;
  let twinUrl = null;
  if (urlCount === 2) {
    evidenceUrl = validateBoundUrl(evidenceUrlRaw, EVIDENCE_LOGIN, evidencePassword, seed);
    twinUrl = validateBoundUrl(twinUrlRaw, TWIN_LOGIN, twinPassword, seed);
    assertConnectivity(evidenceUrl, evidencePassword, EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE, TWIN_PRIVILEGE);
    assertConnectivity(twinUrl, twinPassword, TWIN_LOGIN, TWIN_PRIVILEGE, EVIDENCE_PRIVILEGE);
  }

  const requireBound = String(process.env.MCFT_CAP09_REQUIRE_RUNTIME_URLS_BOUND || "").trim() === "1";
  if (requireBound) assert.equal(urlCount, 2, "RUNTIME_CREDENTIAL_EXACT_TWO_URL_SECRETS_REQUIRED");

  write({
    schema_version: "geox_mcft_cap09_production_runtime_credential_readiness_v1",
    verifier_semantics: "RESIDUE_AWARE_CURRENT_STATE_PRE_ROTATION_V1",
    status: "PASS",
    stage: credentialArm
      ? "RUNTIME_CREDENTIAL_URLS_BOUND_ARMED_RECHECK"
      : (urlCount === 2 ? "RUNTIME_CREDENTIAL_URLS_BOUND_PRE_ARM" : "SERVICE_LOGIN_COMPLETE_RUNTIME_URLS_ABSENT"),
    subject_sha: subjectSha,
    database_name: TARGET_DB,
    production_host_table_count: state.table_count,
    runtime_routine_count: Number(counts[2]),
    service_login_role_count: 2,
    bootstrap_password_secret_count: 2,
    non_lease_table_count: state.non_lease_table_count,
    non_lease_production_state_row_count: state.non_lease_row_count,
    non_lease_production_state_rows_zero: true,
    historical_zero_row_provisioning_verifier_reused: false,
    historical_expired_lease_residue_allowed: true,
    evidence_lease_total_count: state.evidence_lease.total,
    evidence_lease_live_owner_count: state.evidence_lease.live,
    evidence_lease_expired_count: state.evidence_lease.expired,
    twin_lease_total_count: state.twin_lease.total,
    twin_lease_live_owner_count: state.twin_lease.live,
    twin_lease_expired_count: state.twin_lease.expired,
    all_table_rows_zero: state.evidence_lease.total === 0 && state.twin_lease.total === 0,
    exact_database_name_match: urlCount === 2,
    exact_login_username_match: urlCount === 2,
    exact_password_pairing_match: urlCount === 2,
    exact_seed_host_port_match: urlCount === 2,
    exact_one_privilege_membership_each: true,
    cross_plane_membership: false,
    login_role_recreation: false,
    password_rotation_only: true,
    evidence_login_connectivity_proven: true,
    twin_login_connectivity_proven: true,
    evidence_runtime_url_connectivity_proven: urlCount === 2,
    twin_runtime_url_connectivity_proven: urlCount === 2,
    runtime_database_url_secret_count: urlCount,
    runtime_endpoint_metadata: endpointMetadata,
    runtime_credential_pre_arm_ready: urlCount === 2,
    credential_rematerialization_pre_rotation_ready: true,
    credential_arm_observed: credentialArm,
    runtime_credential_binding: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
}

try {
  main();
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_runtime_credential_readiness_v1",
    verifier_semantics: "RESIDUE_AWARE_CURRENT_STATE_PRE_ROTATION_V1",
    status: "FAIL",
    subject_sha: String(process.env.SUBJECT_SHA || ""),
    database_name: TARGET_DB,
    error: error instanceof Error ? error.message : String(error),
    runtime_credential_binding: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  });
  console.error(error);
  process.exitCode = 1;
}
