import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  assertMcftCap09ServicePrincipalV1,
  MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
  MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
  MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
  MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
} from "../../apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  bootstrapMcftCap09Phase5ServicePrincipalsV1,
} from "../../apps/server/src/infra/mcft_cap09_phase5_service_principal_provisioning_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_PROVISIONING_V1_RESULT.json",
);
const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const ARM_PATH = path.resolve(
  "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json",
);
const AUTHORITY_PATH = path.resolve(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json",
);

function requiredEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error("SERVICE_LOGIN_PROVISION_ENV_REQUIRED:" + name);
  return value;
}

function targetUrl(raw: string): string {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("SERVICE_LOGIN_PROVISION_POSTGRES_URL_REQUIRED");
  }
  url.pathname = "/" + TARGET_DB;
  return url.toString();
}

function roleUrl(raw: string, role: string, password: string): string {
  const url = new URL(targetUrl(raw));
  url.username = role;
  url.password = password;
  return url.toString();
}

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function allRowsZero(pool: Pool): Promise<boolean> {
  const names = (
    await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    )
  ).rows.map((row) => row.table_name);
  assert.equal(names.length, 41, "SERVICE_LOGIN_PROVISION_EXACT_41_TABLES_REQUIRED");
  for (const name of names) {
    const quoted = '"' + name.replaceAll('"', '""') + '"';
    const count = Number(
      (
        await pool.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM public." + quoted,
        )
      ).rows[0]?.n ?? -1,
    );
    if (count !== 0) return false;
  }
  return true;
}

async function roleState(pool: Pool, role: string, expectedPrivilege: string) {
  const state = (
    await pool.query<{
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      ownership_count: number;
      direct_public_acl_count: number;
    }>(
      `WITH target AS (
         SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
           FROM pg_catalog.pg_roles WHERE rolname=$1
       )
       SELECT target.rolcanlogin,target.rolinherit,target.rolsuper,target.rolcreatedb,
              target.rolcreaterole,target.rolreplication,target.rolbypassrls,
              (
                (SELECT count(*) FROM pg_catalog.pg_database d WHERE d.datdba=target.oid) +
                (SELECT count(*) FROM pg_catalog.pg_namespace n WHERE n.nspowner=target.oid) +
                (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relowner=target.oid) +
                (SELECT count(*) FROM pg_catalog.pg_proc p WHERE p.proowner=target.oid)
              )::int AS ownership_count,
              (
                (SELECT count(*) FROM pg_catalog.pg_class object
                  JOIN pg_catalog.pg_namespace namespace ON namespace.oid=object.relnamespace
                  CROSS JOIN LATERAL pg_catalog.aclexplode(object.relacl) acl
                 WHERE namespace.nspname='public' AND acl.grantee=target.oid) +
                (SELECT count(*) FROM pg_catalog.pg_proc routine
                  JOIN pg_catalog.pg_namespace namespace ON namespace.oid=routine.pronamespace
                  CROSS JOIN LATERAL pg_catalog.aclexplode(routine.proacl) acl
                 WHERE namespace.nspname='public' AND acl.grantee=target.oid) +
                (SELECT count(*) FROM pg_catalog.pg_namespace namespace
                  CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) acl
                 WHERE namespace.nspname='public' AND acl.grantee=target.oid)
              )::int AS direct_public_acl_count
         FROM target`,
      [role],
    )
  ).rows[0];
  assert.ok(state, "SERVICE_LOGIN_PROVISION_ROLE_REQUIRED:" + role);
  assert.equal(state.rolcanlogin, true, "SERVICE_LOGIN_PROVISION_LOGIN_REQUIRED:" + role);
  assert.equal(state.rolinherit, true, "SERVICE_LOGIN_PROVISION_INHERIT_REQUIRED:" + role);
  assert.equal(state.rolsuper, false, "SERVICE_LOGIN_PROVISION_SUPERUSER_FORBIDDEN:" + role);
  assert.equal(state.rolcreatedb, false, "SERVICE_LOGIN_PROVISION_CREATEDB_FORBIDDEN:" + role);
  assert.equal(state.rolcreaterole, false, "SERVICE_LOGIN_PROVISION_CREATEROLE_FORBIDDEN:" + role);
  assert.equal(state.rolreplication, false, "SERVICE_LOGIN_PROVISION_REPLICATION_FORBIDDEN:" + role);
  assert.equal(state.rolbypassrls, false, "SERVICE_LOGIN_PROVISION_BYPASSRLS_FORBIDDEN:" + role);
  assert.equal(state.ownership_count, 0, "SERVICE_LOGIN_PROVISION_OBJECT_OWNERSHIP_FORBIDDEN:" + role);
  assert.equal(state.direct_public_acl_count, 0, "SERVICE_LOGIN_PROVISION_DIRECT_PUBLIC_ACL_FORBIDDEN:" + role);

  const memberships = (
    await pool.query<{
      role_name: string;
      admin_option: boolean;
      inherit_option: boolean;
      set_option: boolean;
    }>(
      `SELECT granted.rolname AS role_name,
              membership.admin_option,
              membership.inherit_option,
              membership.set_option
         FROM pg_catalog.pg_auth_members membership
         JOIN pg_catalog.pg_roles granted ON granted.oid=membership.roleid
         JOIN pg_catalog.pg_roles member ON member.oid=membership.member
        WHERE member.rolname=$1
        ORDER BY granted.rolname`,
      [role],
    )
  ).rows;
  assert.equal(memberships.length, 1, "SERVICE_LOGIN_PROVISION_EXACT_ONE_MEMBERSHIP:" + role);
  assert.equal(memberships[0]?.role_name, expectedPrivilege, "SERVICE_LOGIN_PROVISION_PRIVILEGE_ROLE_MISMATCH:" + role);
  assert.equal(memberships[0]?.admin_option, false, "SERVICE_LOGIN_PROVISION_ADMIN_OPTION_FORBIDDEN:" + role);
  assert.equal(memberships[0]?.inherit_option, true, "SERVICE_LOGIN_PROVISION_MEMBERSHIP_INHERIT_REQUIRED:" + role);
  assert.equal(memberships[0]?.set_option, false, "SERVICE_LOGIN_PROVISION_SET_OPTION_FORBIDDEN:" + role);
  return state;
}

async function main(): Promise<void> {
  const arm = JSON.parse(fs.readFileSync(ARM_PATH, "utf8"));
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const subjectSha = requiredEnv("SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "SERVICE_LOGIN_PROVISION_SUBJECT_SHA_REQUIRED");

  assert.equal(arm.armed, true, "SERVICE_LOGIN_PROVISION_ARM_REQUIRED");
  assert.equal(arm.exact_target_database_name, TARGET_DB, "SERVICE_LOGIN_PROVISION_EXACT_DATABASE_ARM_REQUIRED");
  assert.equal(arm.service_login_bootstrap_authorized, true, "SERVICE_LOGIN_PROVISION_BOOTSTRAP_AUTHORITY_REQUIRED");
  for (const key of [
    "phase4_twin_acl_materialization_authorized",
    "runtime_credential_binding_authorized",
    "runtime_process_start_authorized",
    "production_owner_activation_authorized",
    "formal_v5_arm_authorized",
    "a0_authorized",
    "o00_authorized",
  ]) {
    assert.equal(arm[key], false, "SERVICE_LOGIN_PROVISION_LATER_AUTHORITY_FORBIDDEN:" + key);
  }

  assert.equal(authority.current_stage, "SCHEMA_ACL_COMPLETE_PRE_LOGIN");
  assert.equal(authority.target_database?.database_name, TARGET_DB);
  assert.equal(authority.target_database?.current_schema_state, "MATERIALIZED_41_TABLE_ZERO_ROW");
  assert.equal(authority.target_database?.schema_acl_materialization_complete, true);

  const seed = requiredEnv("SEED_DATABASE_URL");
  const evidencePassword = requiredEnv("EVIDENCE_RUNTIME_PASSWORD");
  const twinPassword = requiredEnv("TWIN_RUNTIME_PASSWORD");
  const adminUrl = targetUrl(seed);
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    const inventory = (
      await admin.query<{ database_name: string; tables: number; routines: number; login_roles: number }>(
        `SELECT current_database()::text AS database_name,
                (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
                (SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS routines,
                (SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN (
                  'geox_mcft_cap09_evidence_runtime_login_v1',
                  'geox_mcft_cap09_twin_runtime_login_v1'
                )) AS login_roles`,
      )
    ).rows[0];
    assert.equal(inventory?.database_name, TARGET_DB, "SERVICE_LOGIN_PROVISION_DATABASE_MISMATCH");
    assert.equal(inventory?.tables, 41, "SERVICE_LOGIN_PROVISION_41_TABLE_SCHEMA_REQUIRED");
    assert.equal(inventory?.routines, 3, "SERVICE_LOGIN_PROVISION_THREE_ROUTINES_REQUIRED");
    assert.equal(inventory?.login_roles, 0, "SERVICE_LOGIN_PROVISION_PREEXISTING_LOGIN_FORBIDDEN");
    assert.equal(await allRowsZero(admin), true, "SERVICE_LOGIN_PROVISION_PRE_ROWS_MUST_BE_ZERO");

    const bootstrap = await bootstrapMcftCap09Phase5ServicePrincipalsV1({
      admin_database_url: adminUrl,
      expected_database_name: TARGET_DB,
      evidence_runtime_password: evidencePassword,
      twin_runtime_password: twinPassword,
    });
    assert.equal(bootstrap.status, "PASS");

    await roleState(
      admin,
      MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
      MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
    );
    await roleState(
      admin,
      MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
      MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
    );
    assert.equal(await allRowsZero(admin), true, "SERVICE_LOGIN_PROVISION_POST_ROWS_MUST_BE_ZERO");

    const evidence = new Pool({
      connectionString: roleUrl(seed, MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1, evidencePassword),
      max: 1,
    });
    const twin = new Pool({
      connectionString: roleUrl(seed, MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1, twinPassword),
      max: 1,
    });
    try {
      await assertMcftCap09ServicePrincipalV1(evidence, "EVIDENCE_RUNTIME");
      await assertMcftCap09ServicePrincipalV1(twin, "TWIN_RUNTIME");
      const evidenceDb = (await evidence.query<{ db: string }>("SELECT current_database()::text AS db")).rows[0]?.db;
      const twinDb = (await twin.query<{ db: string }>("SELECT current_database()::text AS db")).rows[0]?.db;
      assert.equal(evidenceDb, TARGET_DB, "SERVICE_LOGIN_PROVISION_EVIDENCE_CONNECTIVITY_DB_MISMATCH");
      assert.equal(twinDb, TARGET_DB, "SERVICE_LOGIN_PROVISION_TWIN_CONNECTIVITY_DB_MISMATCH");
    } finally {
      await evidence.end();
      await twin.end();
    }

    write({
      schema_version: "geox_mcft_cap09_production_service_login_provisioning_v1",
      status: "PASS",
      stage: "SERVICE_LOGIN_BOOTSTRAP_COMPLETE_RUNTIME_CREDENTIAL_BINDING_NOT_AUTHORIZED",
      subject_sha: subjectSha,
      database_name: TARGET_DB,
      production_host_table_count: 41,
      runtime_routine_count: 3,
      all_table_rows_zero: true,
      evidence_login_role: MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
      twin_login_role: MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
      exact_one_privilege_membership_each: true,
      login_roles_have_no_direct_public_acl: true,
      login_roles_own_zero_database_objects: true,
      evidence_login_connectivity_proven: true,
      twin_login_connectivity_proven: true,
      runtime_database_url_binding: false,
      runtime_credential_binding: false,
      runtime_process_start: false,
      production_owner_activation: false,
      provider_request_count: 0,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    });
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  write({
    schema_version: "geox_mcft_cap09_production_service_login_provisioning_v1",
    status: "FAIL",
    stage: "SERVICE_LOGIN_BOOTSTRAP",
    subject_sha: String(process.env.SUBJECT_SHA ?? ""),
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
});
