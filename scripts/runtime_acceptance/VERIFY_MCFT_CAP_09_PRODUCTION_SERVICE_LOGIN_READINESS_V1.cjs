"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1_RESULT.json",
);
const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const OWNER_ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
);
const SCHEMA_ARM = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_ARM_V1.json",
);
const AUTHORITY = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
);
const EVIDENCE_LOGIN = "geox_mcft_cap09_evidence_runtime_login_v1";
const TWIN_LOGIN = "geox_mcft_cap09_twin_runtime_login_v1";
const EVIDENCE_PRIVILEGE = "geox_mcft_cap09_evidence_runtime_v1";
const TWIN_PRIVILEGE = "geox_mcft_cap09_twin_runtime_v1";

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("SERVICE_LOGIN_READINESS_ENV_REQUIRED:" + name);
  return value;
}

function targetUrl(raw, role) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("SERVICE_LOGIN_READINESS_POSTGRES_URL_REQUIRED");
  }
  url.pathname = "/" + TARGET_DB;
  if (role) {
    url.username = role;
    url.password = "";
  }
  return url.toString();
}

function query(url, sql, password) {
  const env = { ...process.env };
  if (password !== undefined) env.PGPASSWORD = password;
  return execFileSync(
    "psql",
    ["--dbname", url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-F", "|", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env },
  ).trim();
}

function bool(value) {
  return value === "t" || value === "true";
}

function qIdent(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function assertAuthorityUnarmed() {
  const arm = JSON.parse(fs.readFileSync(OWNER_ARM, "utf8"));
  const schemaArm = JSON.parse(fs.readFileSync(SCHEMA_ARM, "utf8"));
  const authority = JSON.parse(fs.readFileSync(AUTHORITY, "utf8"));

  assert.equal(arm.armed, false, "SERVICE_LOGIN_READINESS_OWNER_ARM_MUST_BE_FALSE");
  assert.equal(arm.exact_target_database_name, null, "SERVICE_LOGIN_READINESS_OWNER_TARGET_MUST_BE_NULL");
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
    assert.equal(arm[key], false, "SERVICE_LOGIN_READINESS_OWNER_AUTHORITY_MUST_BE_FALSE:" + key);
  }
  assert.equal(schemaArm.armed, false, "SERVICE_LOGIN_READINESS_SCHEMA_ARM_MUST_BE_FALSE");
  assert.equal(authority.target_database?.database_name, TARGET_DB);
  assert.equal(authority.target_database?.current_schema_state, "MATERIALIZED_41_TABLE_ZERO_ROW");
  assert.equal(authority.target_database?.schema_acl_materialization_complete, true);
}

function exactZeroRows(adminUrl) {
  const tableNames = query(
    adminUrl,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;",
  ).split(/\r?\n/).filter(Boolean);
  assert.equal(tableNames.length, 41, "SERVICE_LOGIN_READINESS_EXACT_41_TABLES_REQUIRED");
  for (const table of tableNames) {
    const count = Number(query(adminUrl, "SELECT count(*)::int FROM public." + qIdent(table) + ";") || "0");
    assert.equal(count, 0, "SERVICE_LOGIN_READINESS_NONZERO_TABLE:" + table);
  }
}

function assertRole(adminUrl, role, expectedPrivilege) {
  const state = query(
    adminUrl,
    [
      "WITH target AS (",
      "  SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls",
      "    FROM pg_catalog.pg_roles WHERE rolname=" + "'" + role + "'",
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
  assert.equal(state.length, 9, "SERVICE_LOGIN_READINESS_ROLE_STATE_REQUIRED:" + role);
  assert.equal(bool(state[0]), true, "SERVICE_LOGIN_READINESS_LOGIN_REQUIRED:" + role);
  assert.equal(bool(state[1]), true, "SERVICE_LOGIN_READINESS_INHERIT_REQUIRED:" + role);
  for (let i = 2; i <= 6; i += 1) {
    assert.equal(bool(state[i]), false, "SERVICE_LOGIN_READINESS_RESTRICTED_ATTRIBUTE:" + role);
  }
  assert.equal(Number(state[7]), 0, "SERVICE_LOGIN_READINESS_OBJECT_OWNERSHIP_FORBIDDEN:" + role);
  assert.equal(Number(state[8]), 0, "SERVICE_LOGIN_READINESS_DIRECT_PUBLIC_ACL_FORBIDDEN:" + role);

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
  assert.equal(rows.length, 1, "SERVICE_LOGIN_READINESS_EXACT_ONE_MEMBERSHIP:" + role);
  const fields = rows[0].split("|");
  assert.equal(fields[0], expectedPrivilege, "SERVICE_LOGIN_READINESS_PRIVILEGE_MISMATCH:" + role);
  assert.equal(bool(fields[1]), false, "SERVICE_LOGIN_READINESS_ADMIN_OPTION_FORBIDDEN:" + role);
  assert.equal(bool(fields[2]), true, "SERVICE_LOGIN_READINESS_MEMBERSHIP_INHERIT_REQUIRED:" + role);
  assert.equal(bool(fields[3]), false, "SERVICE_LOGIN_READINESS_SET_OPTION_FORBIDDEN:" + role);
}

function assertConnectivity(seed, role, password, expectedPrivilege, oppositePrivilege) {
  const line = query(
    targetUrl(seed, role),
    [
      "SELECT current_database()::text,current_user::text,",
      "       pg_catalog.pg_has_role(current_user,'" + expectedPrivilege + "','USAGE')::text,",
      "       pg_catalog.pg_has_role(current_user,'" + oppositePrivilege + "','USAGE')::text;",
    ].join("\n"),
    password,
  ).split("|");
  assert.equal(line[0], TARGET_DB, "SERVICE_LOGIN_READINESS_CONNECTIVITY_DATABASE:" + role);
  assert.equal(line[1], role, "SERVICE_LOGIN_READINESS_CONNECTIVITY_IDENTITY:" + role);
  assert.equal(bool(line[2]), true, "SERVICE_LOGIN_READINESS_EXPECTED_PRIVILEGE:" + role);
  assert.equal(bool(line[3]), false, "SERVICE_LOGIN_READINESS_OPPOSITE_PRIVILEGE_FORBIDDEN:" + role);
}

function main() {
  assertAuthorityUnarmed();
  const subjectSha = requiredEnv("SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "SERVICE_LOGIN_READINESS_SUBJECT_SHA_REQUIRED");
  const seed = requiredEnv("SEED_DATABASE_URL");
  const adminUrl = targetUrl(seed);

  const counts = query(
    adminUrl,
    [
      "SELECT current_database()::text,",
      "       (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),",
      "       (SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),",
      "       (SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('" + EVIDENCE_LOGIN + "','" + TWIN_LOGIN + "'));",
    ].join("\n"),
  ).split("|");
  assert.equal(counts[0], TARGET_DB, "SERVICE_LOGIN_READINESS_DATABASE_MISMATCH");
  assert.equal(Number(counts[1]), 41, "SERVICE_LOGIN_READINESS_41_TABLES_REQUIRED");
  assert.equal(Number(counts[2]), 3, "SERVICE_LOGIN_READINESS_THREE_ROUTINES_REQUIRED");
  exactZeroRows(adminUrl);

  const secrets = {
    evidence_runtime_database_url: Boolean(String(process.env.EVIDENCE_RUNTIME_DATABASE_URL_SECRET || "").trim()),
    evidence_runtime_password: Boolean(String(process.env.EVIDENCE_RUNTIME_PASSWORD_SECRET || "").trim()),
    twin_runtime_database_url: Boolean(String(process.env.TWIN_RUNTIME_DATABASE_URL_SECRET || "").trim()),
    twin_runtime_password: Boolean(String(process.env.TWIN_RUNTIME_PASSWORD_SECRET || "").trim()),
  };
  const loginCount = Number(counts[3]);

  if (loginCount === 0) {
    assert.equal(Object.values(secrets).some(Boolean), false, "SERVICE_LOGIN_READINESS_PRELOGIN_SECRET_FORBIDDEN");
    write({
      schema_version: "geox_mcft_cap09_production_service_login_readiness_v1",
      status: "PASS",
      stage: "PRE_LOGIN_ZERO_STATE",
      subject_sha: subjectSha,
      database_name: TARGET_DB,
      production_host_table_count: 41,
      runtime_routine_count: 3,
      all_table_rows_zero: true,
      service_login_role_count: 0,
      credential_secret_state: secrets,
      runtime_database_url_binding: false,
      runtime_credential_binding: false,
      runtime_process_start: false,
      production_owner_activation: false,
      provider_request_count: 0,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
    return;
  }

  assert.equal(loginCount, 2, "SERVICE_LOGIN_READINESS_PARTIAL_LOGIN_STATE_FORBIDDEN");
  assert.equal(secrets.evidence_runtime_password, true, "SERVICE_LOGIN_READINESS_EVIDENCE_PASSWORD_REQUIRED");
  assert.equal(secrets.twin_runtime_password, true, "SERVICE_LOGIN_READINESS_TWIN_PASSWORD_REQUIRED");
  assert.equal(secrets.evidence_runtime_database_url, false, "SERVICE_LOGIN_READINESS_EVIDENCE_URL_MUST_WAIT_FOR_7F");
  assert.equal(secrets.twin_runtime_database_url, false, "SERVICE_LOGIN_READINESS_TWIN_URL_MUST_WAIT_FOR_7F");

  assertRole(adminUrl, EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE);
  assertRole(adminUrl, TWIN_LOGIN, TWIN_PRIVILEGE);
  assertConnectivity(
    seed,
    EVIDENCE_LOGIN,
    requiredEnv("EVIDENCE_RUNTIME_PASSWORD_SECRET"),
    EVIDENCE_PRIVILEGE,
    TWIN_PRIVILEGE,
  );
  assertConnectivity(
    seed,
    TWIN_LOGIN,
    requiredEnv("TWIN_RUNTIME_PASSWORD_SECRET"),
    TWIN_PRIVILEGE,
    EVIDENCE_PRIVILEGE,
  );

  write({
    schema_version: "geox_mcft_cap09_production_service_login_readiness_v1",
    status: "PASS",
    stage: "SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING",
    subject_sha: subjectSha,
    database_name: TARGET_DB,
    production_host_table_count: 41,
    runtime_routine_count: 3,
    all_table_rows_zero: true,
    service_login_role_count: 2,
    exact_one_privilege_membership_each: true,
    login_roles_have_no_direct_public_acl: true,
    login_roles_own_zero_database_objects: true,
    evidence_login_connectivity_proven: true,
    twin_login_connectivity_proven: true,
    credential_secret_state: secrets,
    runtime_database_url_binding: false,
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
    schema_version: "geox_mcft_cap09_production_service_login_readiness_v1",
    status: "FAIL",
    subject_sha: String(process.env.SUBJECT_SHA || ""),
    database_name: TARGET_DB,
    error: error instanceof Error ? error.message : String(error),
    runtime_database_url_binding: false,
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
