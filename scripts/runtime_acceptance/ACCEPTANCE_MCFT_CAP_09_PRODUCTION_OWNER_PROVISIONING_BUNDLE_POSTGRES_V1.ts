import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { bootstrapMcftCap09Phase5ServicePrincipalsV1 } from "../../apps/server/src/infra/mcft_cap09_phase5_service_principal_provisioning_v1.js";

const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_BUNDLE_POSTGRES_V1_RESULT.json");
const ADMIN_ROLE="geox_mcft_cap09_provisioning_admin_acceptance_v1";
const ADMIN_PASSWORD="ephemeral-provisioning-admin-password-v1";
const WRITER_OWNER_ROLES=[
  ["geox_mcft_cap09_evidence_writer_owner_v1",true],
  ["geox_mcft_cap09_twin_writer_owner_v1",false],
  ["geox_mcft_cap09_forcing_writer_owner_v1",false],
] as const;
const SCHEMA_FILES=[
  "docker/postgres/init/001_schema.sql",
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_persistence.sql",
  "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
  "apps/server/db/migrations/2026_08_31_mcft_cap_09_production_host_projection_persistence.sql",
] as const;
const ACL_FILES=[
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_acl.sql",
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql",
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql",
  "apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql",
] as const;

async function apply(pool:Pool, files:readonly string[]){
  for(const file of files) await pool.query(fs.readFileSync(path.join(ROOT,file),"utf8"));
}

async function main(){
  if(process.env.MCFT_CAP09_OWNER_PROVISIONING_BUNDLE_DESTRUCTIVE_ACCEPTANCE!=="1"){
    throw new Error("OWNER_PROVISIONING_BUNDLE_ACCEPTANCE_FLAG_REQUIRED");
  }
  const rootUrl=String(process.env.DATABASE_URL||"").trim();
  if(!rootUrl) throw new Error("DATABASE_URL_REQUIRED");
  const parsed=new URL(rootUrl);
  const db=parsed.pathname.replace(/^\//,"");
  if(!/^[a-z_][a-z0-9_]*$/.test(db)) throw new Error("OWNER_PROVISIONING_DATABASE_NAME_INVALID");

  const rootPool=new Pool({connectionString:rootUrl,max:1});
  let pool:Pool|undefined;
  try{
    // Root is test-harness authority only. The production-equivalent path below must
    // execute as a delegated provisioning admin with no SUPERUSER capability.
    await rootPool.query("DROP SCHEMA public CASCADE");
    await rootPool.query(`
      CREATE ROLE ${ADMIN_ROLE}
        LOGIN INHERIT NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS
        PASSWORD '${ADMIN_PASSWORD}'
    `);
    await rootPool.query(`ALTER DATABASE "${db}" OWNER TO ${ADMIN_ROLE}`);
    await rootPool.query(`CREATE SCHEMA public AUTHORIZATION ${ADMIN_ROLE}`);

    const adminUrl=new URL(rootUrl);
    adminUrl.username=ADMIN_ROLE;
    adminUrl.password=ADMIN_PASSWORD;
    pool=new Pool({connectionString:adminUrl.toString(),max:1});

    const admin=(await pool.query<{
      current_user:string;
      rolsuper:boolean;
      rolcreatedb:boolean;
      rolcreaterole:boolean;
      rolreplication:boolean;
      rolbypassrls:boolean;
    }>(`
      SELECT current_user::text AS current_user,
             rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
        FROM pg_catalog.pg_roles
       WHERE rolname=current_user
    `)).rows[0]!;
    assert.equal(admin.current_user,ADMIN_ROLE);
    assert.equal(admin.rolsuper,false,"OWNER_PROVISIONING_ADMIN_MUST_BE_NOSUPERUSER");
    assert.equal(admin.rolcreatedb,true,"OWNER_PROVISIONING_ADMIN_CREATEDB_REQUIRED");
    assert.equal(admin.rolcreaterole,true,"OWNER_PROVISIONING_ADMIN_CREATEROLE_REQUIRED");
    assert.equal(admin.rolreplication,false,"OWNER_PROVISIONING_ADMIN_REPLICATION_FORBIDDEN");
    assert.equal(admin.rolbypassrls,false,"OWNER_PROVISIONING_ADMIN_BYPASSRLS_FORBIDDEN");

    await apply(pool,SCHEMA_FILES);
    const tables=Number((await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    )).rows[0]?.n);
    assert.equal(tables,41,"OWNER_PROVISIONING_EXACT_41_TABLE_HOST_SCHEMA_REQUIRED");

    // Mirror the real one-shot materializer: owner roles are safe NOLOGIN roles and
    // delegated admin receives transient SET+INHERIT membership only for the owner-sensitive migration window.
    for(const [role,inherit] of WRITER_OWNER_ROLES){
      await pool.query(
        `CREATE ROLE ${role} NOLOGIN ${inherit?"INHERIT":"NOINHERIT"} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
      const beforeSet=(await pool.query<{ok:boolean}>(
        "SELECT pg_catalog.pg_has_role(current_user,$1,'SET') AS ok",
        [role],
      )).rows[0]?.ok;
      assert.equal(beforeSet,false,`OWNER_PROVISIONING_AUTOMATIC_ADMIN_GRANT_MUST_NOT_ENABLE_SET:${role}`);
      await pool.query(`GRANT ${role} TO CURRENT_USER WITH SET TRUE`);
      await pool.query(`GRANT ${role} TO CURRENT_USER WITH INHERIT TRUE`);
      const tempGrant=(await pool.query<{inherit_option:boolean;set_option:boolean}>(
        "SELECT inherit_option,set_option FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor WHERE granted.rolname=$1 AND member.rolname=current_user AND grantor.rolname=current_user",
        [role],
      )).rows;
      assert.equal(tempGrant.length,1,`OWNER_PROVISIONING_EXACT_ONE_TEMP_SELF_GRANT_REQUIRED:${role}`);
      assert.equal(tempGrant[0]?.inherit_option,true,`OWNER_PROVISIONING_TEMP_INHERIT_REQUIRED:${role}`);
      assert.equal(tempGrant[0]?.set_option,true,`OWNER_PROVISIONING_TEMP_SET_OPTION_REQUIRED:${role}`);
      const canSet=(await pool.query<{ok:boolean}>(
        "SELECT pg_catalog.pg_has_role(current_user,$1,'SET') AS ok",
        [role],
      )).rows[0]?.ok;
      assert.equal(canSet,true,`OWNER_PROVISIONING_TEMP_SET_MEMBERSHIP_REQUIRED:${role}`);
    }

    await apply(pool,ACL_FILES);

    for(const [role] of WRITER_OWNER_ROLES){
      await pool.query(`REVOKE ${role} FROM CURRENT_USER`);
    }
    const residual=Number((await pool.query(
      `SELECT count(*)::int AS n
         FROM pg_catalog.pg_auth_members m
         JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
         JOIN pg_catalog.pg_roles member ON member.oid=m.member
        WHERE member.rolname=current_user
          AND granted.rolname=ANY($1::text[])
          AND m.set_option`,
      [WRITER_OWNER_ROLES.map(([role])=>role)],
    )).rows[0]?.n);
    assert.equal(residual,0,"OWNER_PROVISIONING_TEMP_OWNER_SET_MEMBERSHIP_MUST_BE_REVOKED");
    for(const [role] of WRITER_OWNER_ROLES){
      const canSet=(await pool.query<{ok:boolean}>(
        "SELECT pg_catalog.pg_has_role(current_user,$1,'SET') AS ok",
        [role],
      )).rows[0]?.ok;
      assert.equal(canSet,false,`OWNER_PROVISIONING_EFFECTIVE_SET_AUTHORITY_MUST_BE_ZERO:${role}`);
      const selfGrants=Number((await pool.query(
        "SELECT count(*)::int AS n FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor WHERE granted.rolname=$1 AND member.rolname=current_user AND grantor.rolname=current_user",
        [role],
      )).rows[0]?.n);
      assert.equal(selfGrants,0,`OWNER_PROVISIONING_TEMP_SELF_GRANT_MUST_BE_ZERO:${role}`);
    }
    const managementRows=(await pool.query<{
      role_name:string;admin_option:boolean;inherit_option:boolean;set_option:boolean;
    }>(
      `SELECT granted.rolname AS role_name,m.admin_option,m.inherit_option,m.set_option
         FROM pg_catalog.pg_auth_members m
         JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
         JOIN pg_catalog.pg_roles member ON member.oid=m.member
        WHERE member.rolname=current_user
          AND granted.rolname=ANY($1::text[])
        ORDER BY granted.rolname`,
      [WRITER_OWNER_ROLES.map(([role])=>role)],
    )).rows;
    assert.equal(managementRows.length,3,"OWNER_PROVISIONING_AUTOMATIC_ADMIN_RELATION_REQUIRED");
    assert.ok(
      managementRows.every(row=>row.admin_option===true&&row.inherit_option===false&&row.set_option===false),
      "OWNER_PROVISIONING_AUTOMATIC_ADMIN_RELATION_MUST_BE_MANAGEMENT_ONLY",
    );

    const routines=(await pool.query<{proname:string}>(
      "SELECT p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname",
    )).rows.map(r=>r.proname);
    assert.deepEqual(routines,[
      "mcft_cap09_evidence_runtime_append_fact_v1",
      "mcft_cap09_twin_runtime_append_fact_v1",
      "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
    ],"OWNER_PROVISIONING_EXACT_3_RUNTIME_ROUTINES_REQUIRED");

    const preLoginRoleNames=[
      "geox_mcft_cap09_evidence_runtime_v1",
      "geox_mcft_cap09_evidence_writer_owner_v1",
      "geox_mcft_cap09_forcing_writer_owner_v1",
      "geox_mcft_cap09_twin_runtime_v1",
      "geox_mcft_cap09_twin_writer_owner_v1",
    ];
    const preLoginRoles=(await pool.query<{rolname:string,rolcanlogin:boolean}>(
      "SELECT rolname,rolcanlogin FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname",
      [preLoginRoleNames],
    )).rows;
    assert.deepEqual(preLoginRoles.map(r=>r.rolname),preLoginRoleNames,"OWNER_PROVISIONING_EXACT_5_NOLOGIN_ROLES_REQUIRED");
    assert.ok(preLoginRoles.every(r=>r.rolcanlogin===false),"OWNER_PROVISIONING_PRELOGIN_ROLES_MUST_BE_NOLOGIN");

    // This acceptance-only LOGIN bootstrap does not authorize production LOGIN creation.
    // It proves the bundle remains portable when the future authority is separately granted.
    await bootstrapMcftCap09Phase5ServicePrincipalsV1({
      admin_database_url:adminUrl.toString(),
      expected_database_name:db,
      evidence_runtime_password:"ephemeral-evidence-password-v1",
      twin_runtime_password:"ephemeral-twin-password-v1",
    });

    const roles=(await pool.query<{rolname:string,rolcanlogin:boolean,rolinherit:boolean}>(
      "SELECT rolname,rolcanlogin,rolinherit FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname",
      [[
        "geox_mcft_cap09_evidence_runtime_v1",
        "geox_mcft_cap09_twin_runtime_v1",
        "geox_mcft_cap09_evidence_runtime_login_v1",
        "geox_mcft_cap09_twin_runtime_login_v1",
      ]],
    )).rows;
    assert.equal(roles.length,4);
    const by=new Map(roles.map(r=>[r.rolname,r]));
    assert.deepEqual(by.get("geox_mcft_cap09_evidence_runtime_v1"),{
      rolname:"geox_mcft_cap09_evidence_runtime_v1",rolcanlogin:false,rolinherit:true,
    });
    assert.deepEqual(by.get("geox_mcft_cap09_twin_runtime_v1"),{
      rolname:"geox_mcft_cap09_twin_runtime_v1",rolcanlogin:false,rolinherit:false,
    });
    assert.equal(by.get("geox_mcft_cap09_evidence_runtime_login_v1")?.rolcanlogin,true);
    assert.equal(by.get("geox_mcft_cap09_twin_runtime_login_v1")?.rolcanlogin,true);

    for(const [login,priv] of [
      ["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_evidence_runtime_v1"],
      ["geox_mcft_cap09_twin_runtime_login_v1","geox_mcft_cap09_twin_runtime_v1"],
    ] as const){
      const memberships=(await pool.query<{name:string}>(
        "SELECT granted.rolname AS name FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid JOIN pg_catalog.pg_roles member ON member.oid=m.member WHERE member.rolname=$1 ORDER BY granted.rolname",
        [login],
      )).rows.map(r=>r.name);
      assert.deepEqual(memberships,[priv],`OWNER_PROVISIONING_EXACT_MEMBERSHIP_REQUIRED:${login}`);
    }

    const tableNames=(await pool.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    )).rows.map(r=>r.table_name);
    let nonzero=0;
    for(const name of tableNames){
      const q='"'+name.replaceAll('"','""')+'"';
      const n=Number((await pool.query(`SELECT count(*)::int AS n FROM public.${q}`)).rows[0]?.n);
      if(n!==0) nonzero++;
    }
    assert.equal(nonzero,0,"OWNER_PROVISIONING_ALL_TABLES_MUST_REMAIN_ZERO_STATE");

    const writerOwnerSchemaCreate=(await pool.query<{rolname:string,can_create:boolean}>(
      "SELECT r.rolname,has_schema_privilege(r.rolname,'public','CREATE') AS can_create FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[]) ORDER BY r.rolname",
      [WRITER_OWNER_ROLES.map(([role])=>role)],
    )).rows;
    assert.equal(writerOwnerSchemaCreate.length,3);
    assert.ok(
      writerOwnerSchemaCreate.every((row)=>row.can_create===false),
      "OWNER_PROVISIONING_WRITER_OWNER_SCHEMA_CREATE_MUST_BE_REVOKED",
    );

    const result={
      schema_version:"geox_mcft_cap09_production_owner_provisioning_bundle_postgres_v1",
      status:"PASS",
      formal_v13_core_table_count:29,
      production_host_table_count:tables,
      runtime_routine_count:routines.length,
      runtime_routine_names:routines,
      pre_login_nologin_role_count:preLoginRoles.length,
      pre_login_nologin_role_names:preLoginRoles.map(r=>r.rolname),
      all_table_rows_zero:true,
      acl_bundle_applied:true,
      delegated_provisioning_admin:true,
      provisioning_admin_nosuperuser:true,
      provisioning_admin_createrole:true,
      provisioning_admin_createdb:true,
      provisioning_admin_writer_owner_membership_residual_count:residual,
      provisioning_admin_writer_owner_set_membership_residual_count:residual,
      provisioning_admin_writer_owner_management_membership_count:managementRows.length,
      provisioning_admin_writer_owner_management_only:true,
      provisioning_admin_writer_owner_self_grant_residual_count:0,
      evidence_privilege_role_safe:true,
      twin_privilege_role_safe:true,
      dual_login_bootstrap:true,
      exact_one_role_membership_each:true,
      writer_owner_schema_create_residual_count:0,
      runtime_process_start:false,
      production_owner_activation:false,
      provider_request_count:0,
      formal_v5_arm:false,
      a0_bootstrap:false,
      o00_started:false,
    };
    fs.mkdirSync(path.dirname(OUT),{recursive:true});
    fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");
    console.log(JSON.stringify(result,null,2));
  } finally {
    if(pool) await pool.end();
    await rootPool.end();
  }
}

main().catch(e=>{
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify({
    status:"FAIL",
    error:e instanceof Error?e.message:String(e),
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false,
  },null,2)+"\n");
  console.error(e);
  process.exitCode=1;
});
