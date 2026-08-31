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
const SERVICE_LOGIN_OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1_RESULT.json",
);
const SERVICE_LOGIN_VERIFIER = path.join(
  ROOT,
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1.cjs",
);
const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
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
  if (!value) throw new Error("RUNTIME_CREDENTIAL_READINESS_ENV_REQUIRED:" + name);
  return value;
}

function normalizedPort(url) {
  if (url.port) return url.port;
  return "5432";
}

function sanitizedRoleUrl(raw, expectedRole, expectedPassword, seed) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("RUNTIME_CREDENTIAL_POSTGRES_URL_REQUIRED:" + expectedRole);
  }
  assert.equal(
    decodeURIComponent(url.username),
    expectedRole,
    "RUNTIME_CREDENTIAL_LOGIN_ROLE_MISMATCH:" + expectedRole,
  );
  if (decodeURIComponent(url.password) !== expectedPassword) {
    throw new Error("RUNTIME_CREDENTIAL_PASSWORD_MISMATCH:" + expectedRole);
  }
  assert.equal(
    decodeURIComponent(url.pathname.replace(/^\//, "")),
    TARGET_DB,
    "RUNTIME_CREDENTIAL_DATABASE_MISMATCH:" + expectedRole,
  );
  assert.equal(
    url.hostname,
    seed.hostname,
    "RUNTIME_CREDENTIAL_HOST_MISMATCH:" + expectedRole,
  );
  assert.equal(
    normalizedPort(url),
    normalizedPort(seed),
    "RUNTIME_CREDENTIAL_PORT_MISMATCH:" + expectedRole,
  );
  for (const key of ["sslmode", "channel_binding"]) {
    const expected = seed.searchParams.get(key);
    if (expected !== null) {
      assert.equal(
        url.searchParams.get(key),
        expected,
        "RUNTIME_CREDENTIAL_CONNECTION_PARAMETER_MISMATCH:" + expectedRole + ":" + key,
      );
    }
  }
  url.password = "";
  return url.toString();
}

function query(url, sql, password) {
  const env = { ...process.env, PGPASSWORD: password };
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
      "RUNTIME_CREDENTIAL_CONNECTIVITY_FAILED:" +
      stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]").slice(-800),
    );
  }
}

function bool(value) {
  return value === "t" || value === "true";
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

function main() {
  const subjectSha = requiredEnv("SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "RUNTIME_CREDENTIAL_SUBJECT_SHA_REQUIRED");

  const seedRaw = requiredEnv("SEED_DATABASE_URL");
  const evidencePassword = requiredEnv("EVIDENCE_RUNTIME_PASSWORD_SECRET");
  const twinPassword = requiredEnv("TWIN_RUNTIME_PASSWORD_SECRET");
  const seed = new URL(seedRaw);
  if (!["postgres:", "postgresql:"].includes(seed.protocol)) {
    throw new Error("RUNTIME_CREDENTIAL_SEED_POSTGRES_URL_REQUIRED");
  }
  const endpointMetadata = {
    protocol: seed.protocol,
    hostname: seed.hostname,
    port: normalizedPort(seed),
    sslmode: seed.searchParams.get("sslmode"),
    channel_binding: seed.searchParams.get("channel_binding"),
  };

  const childEnv = {
    ...process.env,
    EVIDENCE_RUNTIME_DATABASE_URL_SECRET: "",
    TWIN_RUNTIME_DATABASE_URL_SECRET: "",
  };
  execFileSync(
    process.execPath,
    [SERVICE_LOGIN_VERIFIER],
    { cwd: ROOT, env: childEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const login = JSON.parse(fs.readFileSync(SERVICE_LOGIN_OUT, "utf8"));
  assert.equal(login.status, "PASS", "RUNTIME_CREDENTIAL_SERVICE_LOGIN_READINESS_REQUIRED");
  assert.equal(
    login.stage,
    "SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING",
    "RUNTIME_CREDENTIAL_SERVICE_LOGIN_STAGE_REQUIRED",
  );
  assert.equal(login.service_login_role_count, 2);
  assert.equal(login.exact_one_privilege_membership_each, true);
  assert.equal(login.evidence_login_connectivity_proven, true);
  assert.equal(login.twin_login_connectivity_proven, true);
  assert.equal(login.all_table_rows_zero, true);

  const evidenceUrlRaw = String(process.env.EVIDENCE_RUNTIME_DATABASE_URL_SECRET || "").trim();
  const twinUrlRaw = String(process.env.TWIN_RUNTIME_DATABASE_URL_SECRET || "").trim();
  const urlCount = Number(Boolean(evidenceUrlRaw)) + Number(Boolean(twinUrlRaw));
  assert.ok(urlCount === 0 || urlCount === 2, "RUNTIME_CREDENTIAL_PARTIAL_URL_SECRET_STATE_FORBIDDEN");

  const requireBound = String(process.env.MCFT_CAP09_REQUIRE_RUNTIME_URLS_BOUND || "").trim() === "1";
  if (requireBound && urlCount !== 2) {
    throw new Error("RUNTIME_CREDENTIAL_EXACT_TWO_URL_SECRETS_REQUIRED");
  }

  if (urlCount === 0) {
    write({
      schema_version: "geox_mcft_cap09_production_runtime_credential_readiness_v1",
      status: "PASS",
      stage: "SERVICE_LOGIN_COMPLETE_RUNTIME_URLS_ABSENT",
      subject_sha: subjectSha,
      database_name: TARGET_DB,
      service_login_role_count: 2,
      bootstrap_password_secret_count: 2,
      runtime_database_url_secret_count: 0,
      runtime_endpoint_metadata: endpointMetadata,
      exact_one_privilege_membership_each: true,
      evidence_login_connectivity_proven: true,
      twin_login_connectivity_proven: true,
      runtime_credential_pre_arm_ready: false,
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

  const evidenceUrl = sanitizedRoleUrl(
    evidenceUrlRaw,
    EVIDENCE_LOGIN,
    evidencePassword,
    seed,
  );
  const twinUrl = sanitizedRoleUrl(
    twinUrlRaw,
    TWIN_LOGIN,
    twinPassword,
    seed,
  );
  assertConnectivity(
    evidenceUrl,
    evidencePassword,
    EVIDENCE_LOGIN,
    EVIDENCE_PRIVILEGE,
    TWIN_PRIVILEGE,
  );
  assertConnectivity(
    twinUrl,
    twinPassword,
    TWIN_LOGIN,
    TWIN_PRIVILEGE,
    EVIDENCE_PRIVILEGE,
  );

  write({
    schema_version: "geox_mcft_cap09_production_runtime_credential_readiness_v1",
    status: "PASS",
    stage: "RUNTIME_CREDENTIAL_URLS_BOUND_PRE_ARM",
    subject_sha: subjectSha,
    database_name: TARGET_DB,
    service_login_role_count: 2,
    bootstrap_password_secret_count: 2,
    runtime_database_url_secret_count: 2,
    runtime_endpoint_metadata: endpointMetadata,
    exact_database_name_match: true,
    exact_login_username_match: true,
    exact_password_pairing_match: true,
    exact_seed_host_port_match: true,
    exact_one_privilege_membership_each: true,
    evidence_runtime_url_connectivity_proven: true,
    twin_runtime_url_connectivity_proven: true,
    runtime_credential_pre_arm_ready: true,
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
