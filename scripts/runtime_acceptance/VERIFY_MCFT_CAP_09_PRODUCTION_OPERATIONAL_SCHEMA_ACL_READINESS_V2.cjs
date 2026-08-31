const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const OUT = path.join(
  ROOT,
  "acceptance-output/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_READINESS_V2_RESULT.json",
);
const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const ARM_PATH = path.join(
  ROOT,
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_ARM_V1.json",
);
const DB_PATH = path.join(
  ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OPERATIONAL-DATABASE-CANDIDATE-V1.json",
);
const OWNER_ROLES = [
  "geox_mcft_cap09_evidence_writer_owner_v1",
  "geox_mcft_cap09_twin_writer_owner_v1",
  "geox_mcft_cap09_forcing_writer_owner_v1",
];
const RUNTIME_AND_OWNER_ROLES = [
  "geox_mcft_cap09_evidence_runtime_v1",
  "geox_mcft_cap09_evidence_writer_owner_v1",
  "geox_mcft_cap09_forcing_writer_owner_v1",
  "geox_mcft_cap09_twin_runtime_v1",
  "geox_mcft_cap09_twin_writer_owner_v1",
];

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

function query(url, sql) {
  return execFileSync(
    "psql",
    [
      "--dbname",
      url,
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-F",
      "|",
      "-c",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function rows(url, sql) {
  const raw = query(url, sql);
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => line.split("|"));
}

function bool(value) {
  return value === "true" || value === "t";
}

function qIdent(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error("SCHEMA_ACL_READINESS_ENV_REQUIRED:" + name);
  return value;
}

function validateAuthorityFiles() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const arm = JSON.parse(fs.readFileSync(ARM_PATH, "utf8"));
  assert.equal(
    db.candidate_database_name,
    TARGET_DB,
    "SCHEMA_ACL_OPERATIONAL_DB_IDENTITY_REQUIRED",
  );
  assert.equal(
    db.provisioning && db.provisioning.run_id,
    33375907417,
    "SCHEMA_ACL_OPERATIONAL_DB_IMMUTABLE_RUN_REQUIRED",
  );
  assert.equal(
    db.provisioning && db.provisioning.artifact_id,
    9751846155,
    "SCHEMA_ACL_OPERATIONAL_DB_IMMUTABLE_ARTIFACT_REQUIRED",
  );
  assert.equal(
    db.provisioning && db.provisioning.fresh_zero_state,
    true,
    "SCHEMA_ACL_OPERATIONAL_DB_ORIGINAL_ZERO_STATE_REQUIRED",
  );
  assert.equal(arm.armed, false, "SCHEMA_ACL_READINESS_MUST_BE_UNARMED");
  assert.equal(
    arm.production_host_schema_materialization_authorized,
    false,
    "SCHEMA_ACL_SCHEMA_AUTHORITY_MUST_BE_FALSE",
  );
  assert.equal(
    arm.runtime_acl_materialization_authorized,
    false,
    "SCHEMA_ACL_RUNTIME_ACL_AUTHORITY_MUST_BE_FALSE",
  );
  for (const key of [
    "service_login_bootstrap_authorized",
    "runtime_credential_binding_authorized",
    "runtime_process_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    assert.equal(arm[key], false, "SCHEMA_ACL_LATER_AUTHORITY_FORBIDDEN:" + key);
  }
}

function currentCapabilities(url) {
  const line = query(
    url,
    [
      "SELECT",
      "  current_user::text,",
      "  (SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_catalog.pg_database WHERE datname=current_database()),",
      "  (SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname='public'),",
      "  (SELECT rolcreaterole::text FROM pg_catalog.pg_roles WHERE rolname=current_user),",
      "  (SELECT rolcreatedb::text FROM pg_catalog.pg_roles WHERE rolname=current_user),",
      "  pg_catalog.pg_has_role(current_user,'neon_superuser','SET')::text,",
      "  pg_catalog.pg_has_role(current_user,'neon_superuser','MEMBER')::text,",
      "  (SELECT rolcreaterole::text FROM pg_catalog.pg_roles WHERE rolname='neon_superuser'),",
      "  (SELECT rolcreatedb::text FROM pg_catalog.pg_roles WHERE rolname='neon_superuser'),",
      "  has_schema_privilege(current_user,'public','CREATE')::text;",
    ].join("\n"),
  );
  const values = line.split("|");
  assert.equal(values.length, 10, "SCHEMA_ACL_CAPABILITY_SHAPE_REQUIRED");
  return {
    current_user: values[0],
    database_owner: values[1],
    public_schema_owner: values[2],
    current_user_createrole: bool(values[3]),
    current_user_createdb: bool(values[4]),
    neon_superuser_set: bool(values[5]),
    neon_superuser_member: bool(values[6]),
    neon_superuser_createrole: bool(values[7]),
    neon_superuser_createdb: bool(values[8]),
    current_user_schema_create: bool(values[9]),
  };
}

function membershipState(url) {
  const effectiveSetCount = Number(
    query(
      url,
      [
        "SELECT count(*)::int",
        "  FROM pg_catalog.pg_roles owner_role",
        " WHERE owner_role.rolname IN (",
        "   'geox_mcft_cap09_evidence_writer_owner_v1',",
        "   'geox_mcft_cap09_twin_writer_owner_v1',",
        "   'geox_mcft_cap09_forcing_writer_owner_v1'",
        " )",
        "   AND pg_catalog.pg_has_role(current_user,owner_role.oid,'SET');",
      ].join("\n"),
    ) || "0",
  );
  const selfGrantCount = Number(
    query(
      url,
      [
        "SELECT count(*)::int",
        "  FROM pg_catalog.pg_auth_members m",
        "  JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
        "  JOIN pg_catalog.pg_roles member ON member.oid=m.member",
        "  JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
        " WHERE member.rolname=current_user",
        "   AND grantor.rolname=current_user",
        "   AND granted.rolname IN (",
        "     'geox_mcft_cap09_evidence_writer_owner_v1',",
        "     'geox_mcft_cap09_twin_writer_owner_v1',",
        "     'geox_mcft_cap09_forcing_writer_owner_v1'",
        "   );",
      ].join("\n"),
    ) || "0",
  );
  const membershipRows = query(
    url,
    [
      "SELECT COALESCE(string_agg(",
      "  granted.rolname || ':admin=' || m.admin_option::text ||",
      "  ':inherit=' || m.inherit_option::text ||",
      "  ':set=' || m.set_option::text ||",
      "  ':grantor=' || pg_catalog.pg_get_userbyid(m.grantor),",
      "  ';' ORDER BY granted.rolname,m.grantor",
      "),'')",
      "  FROM pg_catalog.pg_auth_members m",
      "  JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
      "  JOIN pg_catalog.pg_roles member ON member.oid=m.member",
      " WHERE member.rolname=current_user",
      "   AND granted.rolname IN (",
      "     'geox_mcft_cap09_evidence_writer_owner_v1',",
      "     'geox_mcft_cap09_twin_writer_owner_v1',",
      "     'geox_mcft_cap09_forcing_writer_owner_v1'",
      "   );",
    ].join("\n"),
  );
  return { effectiveSetCount, selfGrantCount, membershipRows };
}

function assertRoleSafety(url) {
  const roleRows = rows(
    url,
    [
      "SELECT rolname,rolcanlogin::text,rolinherit::text,rolsuper::text,",
      "       rolcreatedb::text,rolcreaterole::text,rolreplication::text,rolbypassrls::text",
      "  FROM pg_catalog.pg_roles",
      " WHERE rolname IN (",
      "   'geox_mcft_cap09_evidence_runtime_v1',",
      "   'geox_mcft_cap09_evidence_writer_owner_v1',",
      "   'geox_mcft_cap09_forcing_writer_owner_v1',",
      "   'geox_mcft_cap09_twin_runtime_v1',",
      "   'geox_mcft_cap09_twin_writer_owner_v1'",
      " )",
      " ORDER BY rolname;",
    ].join("\n"),
  );
  assert.equal(roleRows.length, 5, "SCHEMA_ACL_EXACT_FIVE_NOLOGIN_ROLES_REQUIRED");
  const expectedInherit = new Map([
    ["geox_mcft_cap09_evidence_runtime_v1", true],
    ["geox_mcft_cap09_evidence_writer_owner_v1", true],
    ["geox_mcft_cap09_forcing_writer_owner_v1", false],
    ["geox_mcft_cap09_twin_runtime_v1", false],
    ["geox_mcft_cap09_twin_writer_owner_v1", false],
  ]);
  for (const row of roleRows) {
    const name = row[0];
    assert.ok(expectedInherit.has(name), "SCHEMA_ACL_ROLE_UNEXPECTED:" + name);
    assert.equal(bool(row[1]), false, "SCHEMA_ACL_ROLE_LOGIN_FORBIDDEN:" + name);
    assert.equal(
      bool(row[2]),
      expectedInherit.get(name),
      "SCHEMA_ACL_ROLE_INHERIT_MISMATCH:" + name,
    );
    for (let index = 3; index <= 7; index += 1) {
      assert.equal(bool(row[index]), false, "SCHEMA_ACL_ROLE_RESTRICTED_ATTRIBUTE:" + name);
    }
  }
}

function assertMaterialized(url) {
  const tableNames = rows(
    url,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;",
  ).map((row) => row[0]);
  assert.equal(tableNames.length, 41, "SCHEMA_ACL_EXACT_41_TABLES_REQUIRED");

  let nonzeroTables = 0;
  for (const tableName of tableNames) {
    const count = Number(
      query(url, "SELECT count(*)::int FROM public." + qIdent(tableName) + ";") || "0",
    );
    if (count !== 0) nonzeroTables += 1;
  }
  assert.equal(nonzeroTables, 0, "SCHEMA_ACL_ALL_TABLE_ROWS_MUST_BE_ZERO");

  assertRoleSafety(url);

  const routineRows = rows(
    url,
    [
      "SELECT p.proname,owner_role.rolname,",
      "       has_function_privilege('geox_mcft_cap09_evidence_runtime_v1',p.oid,'EXECUTE')::text,",
      "       has_function_privilege('geox_mcft_cap09_twin_runtime_v1',p.oid,'EXECUTE')::text",
      "  FROM pg_catalog.pg_proc p",
      "  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace",
      "  JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner",
      " WHERE n.nspname='public'",
      " ORDER BY p.proname;",
    ].join("\n"),
  );
  assert.equal(routineRows.length, 3, "SCHEMA_ACL_EXACT_THREE_ROUTINES_REQUIRED");
  const routineExpected = new Map([
    [
      "mcft_cap09_evidence_runtime_append_fact_v1",
      ["geox_mcft_cap09_evidence_writer_owner_v1", true, false],
    ],
    [
      "mcft_cap09_twin_runtime_append_fact_v1",
      ["geox_mcft_cap09_twin_writer_owner_v1", false, true],
    ],
    [
      "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
      ["geox_mcft_cap09_forcing_writer_owner_v1", true, false],
    ],
  ]);
  for (const row of routineRows) {
    const expected = routineExpected.get(row[0]);
    assert.ok(expected, "SCHEMA_ACL_ROUTINE_UNEXPECTED:" + row[0]);
    assert.equal(row[1], expected[0], "SCHEMA_ACL_ROUTINE_OWNER_MISMATCH:" + row[0]);
    assert.equal(bool(row[2]), expected[1], "SCHEMA_ACL_EVIDENCE_EXEC_MISMATCH:" + row[0]);
    assert.equal(bool(row[3]), expected[2], "SCHEMA_ACL_TWIN_EXEC_MISMATCH:" + row[0]);
  }

  const factAcl = query(
    url,
    [
      "SELECT",
      "  has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','SELECT')::text,",
      "  has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','INSERT')::text,",
      "  has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','UPDATE')::text,",
      "  has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','DELETE')::text,",
      "  has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','SELECT')::text,",
      "  has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','INSERT')::text,",
      "  has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','UPDATE')::text,",
      "  has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','DELETE')::text;",
    ].join("\n"),
  ).split("|").map(bool);
  assert.deepEqual(
    factAcl,
    [true, false, false, false, true, false, false, false],
    "SCHEMA_ACL_DIRECT_FACTS_MATRIX_MISMATCH",
  );

  const writerSchemaCreateCount = Number(
    query(
      url,
      [
        "SELECT count(*)::int",
        "  FROM pg_catalog.pg_roles r",
        " WHERE r.rolname IN (",
        "   'geox_mcft_cap09_evidence_writer_owner_v1',",
        "   'geox_mcft_cap09_twin_writer_owner_v1',",
        "   'geox_mcft_cap09_forcing_writer_owner_v1'",
        " )",
        "   AND has_schema_privilege(r.rolname,'public','CREATE');",
      ].join("\n"),
    ) || "0",
  );
  assert.equal(
    writerSchemaCreateCount,
    0,
    "SCHEMA_ACL_WRITER_OWNER_SCHEMA_CREATE_MUST_BE_ZERO",
  );

  return {
    production_host_table_count: tableNames.length,
    all_table_rows_zero: true,
    runtime_routine_count: routineRows.length,
    runtime_routine_names: routineRows.map((row) => row[0]),
    runtime_routine_owners: Object.fromEntries(
      routineRows.map((row) => [row[0], row[1]]),
    ),
    evidence_privilege_role_safe: true,
    twin_privilege_role_safe: true,
    evidence_direct_facts_insert: false,
    twin_direct_facts_insert: false,
    evidence_writer_cross_plane_matrix_pass: true,
    twin_writer_cross_plane_matrix_pass: true,
    v13_fenced_promotion_cross_plane_matrix_pass: true,
    writer_owner_schema_create_residual_count: writerSchemaCreateCount,
  };
}

function main() {
  validateAuthorityFiles();

  const subjectSha = requiredEnv("SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "SCHEMA_ACL_READINESS_SUBJECT_REQUIRED");
  const seedRaw = requiredEnv("SEED_DATABASE_URL");
  const target = new URL(seedRaw);
  target.pathname = "/" + TARGET_DB;
  const targetUrl = target.toString();

  const tableCount = Number(
    query(
      targetUrl,
      "SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';",
    ) || "0",
  );
  const routineCount = Number(
    query(
      targetUrl,
      "SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';",
    ) || "0",
  );
  const loginCount = Number(
    query(
      targetUrl,
      "SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1');",
    ) || "0",
  );
  const memberships = membershipState(targetUrl);
  assert.equal(loginCount, 0, "SCHEMA_ACL_PRODUCTION_LOGIN_MUST_BE_ABSENT");
  assert.equal(
    memberships.effectiveSetCount,
    0,
    "SCHEMA_ACL_EFFECTIVE_WRITER_OWNER_SET_AUTHORITY_MUST_BE_ZERO",
  );
  assert.equal(
    memberships.selfGrantCount,
    0,
    "SCHEMA_ACL_TEMP_SELF_GRANT_MUST_BE_ZERO",
  );

  const capabilities = currentCapabilities(targetUrl);
  const common = {
    schema_version: "geox_mcft_cap09_production_operational_schema_acl_readiness_v2",
    status: "PASS",
    subject_sha: subjectSha,
    database_name: TARGET_DB,
    ...capabilities,
    service_login_role_count: loginCount,
    provisioning_admin_writer_owner_set_membership_residual_count:
      memberships.effectiveSetCount,
    provisioning_admin_writer_owner_effective_set_role_count:
      memberships.effectiveSetCount,
    provisioning_admin_writer_owner_self_grant_residual_count:
      memberships.selfGrantCount,
    writer_owner_management_membership_rows: memberships.membershipRows,
    schema_acl_arm: false,
    service_login_created: false,
    runtime_process_start: false,
    production_owner_activation: false,
    provider_request_count: 0,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };

  if (tableCount === 0 && routineCount === 0) {
    write({
      ...common,
      stage: "ZERO_STATE_ROLLBACK",
      target_zero_state: true,
      rollback_clean: true,
      schema_materialized: false,
      production_host_table_count: 0,
      runtime_routine_count: 0,
    });
    return;
  }

  if (tableCount === 41 && routineCount === 3) {
    const materialized = assertMaterialized(targetUrl);
    write({
      ...common,
      stage: "MATERIALIZED_41_TABLE_ZERO_ROW",
      target_zero_state: false,
      rollback_clean: false,
      schema_materialized: true,
      ...materialized,
    });
    return;
  }

  throw new Error(
    "SCHEMA_ACL_UNRECOGNIZED_DATABASE_STATE:tables=" +
      tableCount +
      ":routines=" +
      routineCount,
  );
}

try {
  main();
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_operational_schema_acl_readiness_v2",
    status: "FAIL",
    subject_sha: String(process.env.SUBJECT_SHA || ""),
    database_name: TARGET_DB,
    error: error instanceof Error ? error.message : String(error),
    service_login_created: false,
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
