import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

const ROOT=process.cwd();
const TARGET_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const DEFAULT_ARM=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","arm-v1.json");
const DEFAULT_OUT=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","schema-acl-v1.json");
const CANONICAL_FACTS_SCHEMA="docker/postgres/init/001_schema.sql";
const SCHEMA_FILES=[
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
  "apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql",
  "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
  "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
] as const;
const TWIN_WRITER_ACL="apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql";
const FORCING_WRITER_ACL="apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql";
const EXPECTED_NEW_RELATIONS=[
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
] as const;
const OWNER_ROLES=[
  "geox_mcft_cap09_twin_writer_owner_v1",
  "geox_mcft_cap09_forcing_writer_owner_v1",
] as const;
const EXPECTED_PUBLIC_TABLES=[
  "facts",
  "twin_action_feedback_cycle_projection_v1",
  "twin_action_feedback_evidence_index_v1",
  "twin_action_feedback_projection_v1",
  "twin_active_lineage_index_v1",
  "twin_approved_plan_binding_projection_v1",
  "twin_decision_record_projection_v1",
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
  "twin_forecast_point_projection_v1",
  "twin_forecast_residual_projection_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_run_projection_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_object_idempotency_index_v1",
  "twin_runtime_authority_snapshot_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
  "twin_runtime_lease_v1",
  "twin_scenario_latest_index_v1",
  "twin_scenario_point_projection_v1",
  "twin_scenario_set_projection_v1",
  "twin_scenario_set_uniqueness_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_state_history_projection_v1",
  "twin_state_latest_index_v1",
  "twin_terminal_tick_uniqueness_v1",
] as const;

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function requiredEnv(name:string):string{
  const value=String(process.env[name]??"").trim();
  if(!value)throw new Error("FORMAL_V5_SCHEMA_ACL_ENV_REQUIRED:"+name);
  return value;
}
function write(file:string,value:unknown):void{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");
  console.log(JSON.stringify(value,null,2));
}
async function apply(pool:Pool,files:readonly string[]):Promise<void>{
  for(const file of files)await pool.query(fs.readFileSync(path.join(ROOT,file),"utf8"));
}
function canonicalFactsSchemaSql():string{
  const source=fs.readFileSync(path.join(ROOT,CANONICAL_FACTS_SCHEMA),"utf8");
  const match=/^(CREATE TABLE IF NOT EXISTS facts[\s\S]*?CREATE INDEX IF NOT EXISTS facts_record_json_idx[\s\S]*?;\s*)/.exec(source);
  assert.ok(match?.[1],"FORMAL_V5_SCHEMA_ACL_CANONICAL_FACTS_DDL_REQUIRED");
  const sql=match[1];
  assert.equal((sql.match(/\bCREATE\s+TABLE\b/gi)??[]).length,1,"FORMAL_V5_SCHEMA_ACL_FACTS_ONLY_DDL_REQUIRED");
  return sql;
}
async function publicTables(pool:Pool):Promise<string[]>{
  return (await pool.query<{table_name:string}>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  )).rows.map((row)=>row.table_name);
}
async function publicRoutineCount(pool:Pool):Promise<number>{
  return Number((await pool.query<{n:number}>(
    "SELECT count(*)::int AS n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"
  )).rows[0]?.n??-1);
}
async function totalRows(pool:Pool,tables:readonly string[]):Promise<number>{
  let total=0;
  for(const name of tables){
    const q='"'+name.replaceAll('"','""')+'"';
    total+=Number((await pool.query<{n:number}>("SELECT count(*)::int AS n FROM public."+q)).rows[0]?.n??-1);
  }
  return total;
}
async function exactDatabase(pool:Pool):Promise<void>{
  const db=String((await pool.query<{name:string}>("SELECT current_database()::text AS name")).rows[0]?.name??"");
  assert.equal(db,TARGET_DB,"FORMAL_V5_SCHEMA_ACL_DATABASE_IDENTITY_MISMATCH");
}
async function assertClusterRuntimeIdentities(pool:Pool):Promise<void>{
  const rows=(await pool.query<{
    rolname:string;rolcanlogin:boolean;rolsuper:boolean;rolcreatedb:boolean;rolcreaterole:boolean;rolreplication:boolean;rolbypassrls:boolean;
  }>(
    "SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname",
    [["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1"]],
  )).rows;
  assert.equal(rows.length,2,"FORMAL_V5_SCHEMA_ACL_EXACT_TWO_EXISTING_RUNTIME_LOGINS_REQUIRED");
  for(const row of rows){
    assert.equal(row.rolcanlogin,true,"FORMAL_V5_SCHEMA_ACL_RUNTIME_LOGIN_REQUIRED:"+row.rolname);
    assert.equal(row.rolsuper,false,"FORMAL_V5_SCHEMA_ACL_RUNTIME_SUPERUSER_FORBIDDEN:"+row.rolname);
    assert.equal(row.rolcreatedb,false,"FORMAL_V5_SCHEMA_ACL_RUNTIME_CREATEDB_FORBIDDEN:"+row.rolname);
    assert.equal(row.rolcreaterole,false,"FORMAL_V5_SCHEMA_ACL_RUNTIME_CREATEROLE_FORBIDDEN:"+row.rolname);
    assert.equal(row.rolreplication,false,"FORMAL_V5_SCHEMA_ACL_RUNTIME_REPLICATION_FORBIDDEN:"+row.rolname);
    assert.equal(row.rolbypassrls,false,"FORMAL_V5_SCHEMA_ACL_RUNTIME_BYPASSRLS_FORBIDDEN:"+row.rolname);
  }
  const memberships=(await pool.query<{member:string;granted:string}>(
    `SELECT member.rolname AS member,granted.rolname AS granted
       FROM pg_catalog.pg_auth_members m
       JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
       JOIN pg_catalog.pg_roles member ON member.oid=m.member
      WHERE member.rolname=ANY($1::text[])
        AND granted.rolname IN ('geox_mcft_cap09_evidence_runtime_v1','geox_mcft_cap09_twin_runtime_v1')
      ORDER BY member.rolname,granted.rolname`,
    [["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1"]],
  )).rows;
  assert.deepEqual(memberships,[
    {member:"geox_mcft_cap09_evidence_runtime_login_v1",granted:"geox_mcft_cap09_evidence_runtime_v1"},
    {member:"geox_mcft_cap09_twin_runtime_login_v1",granted:"geox_mcft_cap09_twin_runtime_v1"},
  ],"FORMAL_V5_SCHEMA_ACL_RUNTIME_MEMBERSHIP_MATRIX_REQUIRED");
}
async function createPrivilegeRoles(pool:Pool):Promise<void>{
  await pool.query(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_evidence_runtime_v1') THEN
        CREATE ROLE geox_mcft_cap09_evidence_runtime_v1
          NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_twin_runtime_v1') THEN
        CREATE ROLE geox_mcft_cap09_twin_runtime_v1
          NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_twin_writer_owner_v1') THEN
        CREATE ROLE geox_mcft_cap09_twin_writer_owner_v1
          NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_forcing_writer_owner_v1') THEN
        CREATE ROLE geox_mcft_cap09_forcing_writer_owner_v1
          NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $roles$;
  `);
  for(const role of OWNER_ROLES){
    const canSet=(await pool.query<{ok:boolean}>("SELECT pg_catalog.pg_has_role(current_user,$1,'SET') AS ok",[role])).rows[0]?.ok;
    assert.equal(canSet,false,"FORMAL_V5_SCHEMA_ACL_PREEXISTING_WRITER_OWNER_SET_FORBIDDEN:"+role);
    await pool.query("GRANT "+role+" TO CURRENT_USER WITH SET TRUE");
  }
}
async function applyFormalRuntimeAcl(pool:Pool):Promise<void>{
  await pool.query(`
    REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
    REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_twin_runtime_v1;
    GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_evidence_runtime_v1;
    GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_twin_runtime_v1;

    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
    GRANT SELECT ON TABLE public.facts TO geox_mcft_cap09_evidence_runtime_v1;
    GRANT SELECT,INSERT,UPDATE ON TABLE
      public.twin_external_formal_forcing_base_cursor_v1,
      public.twin_external_formal_forcing_base_target_v1,
      public.twin_external_formal_forcing_controller_lease_v1
    TO geox_mcft_cap09_evidence_runtime_v1;

    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_twin_runtime_v1;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_twin_runtime_v1;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_twin_runtime_v1;
    GRANT SELECT ON TABLE public.facts TO geox_mcft_cap09_twin_runtime_v1;
    GRANT SELECT,INSERT,UPDATE ON TABLE
      public.twin_runtime_lease_v1,
      public.twin_shadow_online_scheduler_cursor_v1,
      public.twin_shadow_online_scheduler_slot_v1,
      public.twin_object_idempotency_index_v1,
      public.twin_active_lineage_index_v1,
      public.twin_state_history_projection_v1,
      public.twin_state_latest_index_v1,
      public.twin_forecast_result_latest_index_v1,
      public.twin_forecast_success_latest_index_v1,
      public.twin_runtime_checkpoint_latest_index_v1,
      public.twin_runtime_health_latest_index_v1,
      public.twin_runtime_authority_snapshot_v1,
      public.twin_terminal_tick_uniqueness_v1,
      public.twin_scenario_set_uniqueness_v1
    TO geox_mcft_cap09_twin_runtime_v1;
    GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
      public.twin_forecast_run_projection_v1,
      public.twin_forecast_point_projection_v1,
      public.twin_scenario_set_projection_v1,
      public.twin_scenario_point_projection_v1,
      public.twin_scenario_latest_index_v1
    TO geox_mcft_cap09_twin_runtime_v1;
    REVOKE ALL PRIVILEGES ON TABLE
      public.twin_external_formal_forcing_base_cursor_v1,
      public.twin_external_formal_forcing_base_target_v1,
      public.twin_external_formal_forcing_controller_lease_v1
    FROM geox_mcft_cap09_twin_runtime_v1;
  `);
}
async function revokeTemporaryOwnerMembership(pool:Pool):Promise<void>{
  for(const role of OWNER_ROLES)await pool.query("REVOKE "+role+" FROM CURRENT_USER");
  const residual=Number((await pool.query<{n:number}>(
    `SELECT count(*)::int AS n
       FROM pg_catalog.pg_auth_members m
       JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
       JOIN pg_catalog.pg_roles member ON member.oid=m.member
      WHERE member.rolname=current_user
        AND granted.rolname=ANY($1::text[])`,
    [[...OWNER_ROLES]],
  )).rows[0]?.n??-1);
  assert.equal(residual,0,"FORMAL_V5_SCHEMA_ACL_TEMP_OWNER_MEMBERSHIP_RESIDUAL");
}
async function assertFinalAcl(pool:Pool):Promise<Record<string,unknown>>{
  const facts=(await pool.query<{
    es:boolean;ei:boolean;eu:boolean;ed:boolean;ts:boolean;ti:boolean;tu:boolean;td:boolean;
  }>(`
    SELECT
      has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','SELECT') AS es,
      has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','INSERT') AS ei,
      has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','UPDATE') AS eu,
      has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','DELETE') AS ed,
      has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','SELECT') AS ts,
      has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','INSERT') AS ti,
      has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','UPDATE') AS tu,
      has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','DELETE') AS td
  `)).rows[0]!;
  assert.deepEqual(facts,{es:true,ei:false,eu:false,ed:false,ts:true,ti:false,tu:false,td:false},"FORMAL_V5_SCHEMA_ACL_FACTS_MATRIX_MISMATCH");

  for(const table of EXPECTED_NEW_RELATIONS){
    const r=(await pool.query<{es:boolean,ei:boolean,eu:boolean,ed:boolean,ts:boolean,ti:boolean,tu:boolean,td:boolean}>(
      `SELECT
        has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.${table}','SELECT') AS es,
        has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.${table}','INSERT') AS ei,
        has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.${table}','UPDATE') AS eu,
        has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.${table}','DELETE') AS ed,
        has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.${table}','SELECT') AS ts,
        has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.${table}','INSERT') AS ti,
        has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.${table}','UPDATE') AS tu,
        has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.${table}','DELETE') AS td`
    )).rows[0]!;
    assert.deepEqual(r,{es:true,ei:true,eu:true,ed:false,ts:false,ti:false,tu:false,td:false},"FORMAL_V5_SCHEMA_ACL_FORCING_MATRIX_MISMATCH:"+table);
  }
  const routines=(await pool.query<{proname:string;owner:string;evidence_exec:boolean;twin_exec:boolean}>(
    `SELECT p.proname,owner.rolname AS owner,
      has_function_privilege('geox_mcft_cap09_evidence_runtime_v1',p.oid,'EXECUTE') AS evidence_exec,
      has_function_privilege('geox_mcft_cap09_twin_runtime_v1',p.oid,'EXECUTE') AS twin_exec
     FROM pg_catalog.pg_proc p
     JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
     WHERE n.nspname='public'
       AND p.proname=ANY($1::text[])
     ORDER BY p.proname`,
    [[
      "mcft_cap09_twin_runtime_append_fact_v1",
      "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
    ]],
  )).rows;
  assert.equal(routines.length,2,"FORMAL_V5_SCHEMA_ACL_EXACT_TWO_RUNTIME_WRITERS_REQUIRED");
  const by=new Map(routines.map((row)=>[row.proname,row]));
  assert.equal(by.get("mcft_cap09_twin_runtime_append_fact_v1")?.owner,"geox_mcft_cap09_twin_writer_owner_v1");
  assert.deepEqual(
    [by.get("mcft_cap09_twin_runtime_append_fact_v1")?.evidence_exec,by.get("mcft_cap09_twin_runtime_append_fact_v1")?.twin_exec],
    [false,true],
  );
  assert.equal(by.get("mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1")?.owner,"geox_mcft_cap09_forcing_writer_owner_v1");
  assert.deepEqual(
    [by.get("mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1")?.evidence_exec,by.get("mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1")?.twin_exec],
    [true,false],
  );
  return {runtime_routine_count:routines.length,runtime_routines:routines};
}

async function main():Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI)throw new Error("FORMAL_V5_SCHEMA_ACL_LOCAL_NON_GITHUB_HOST_ONLY");
  if(!process.argv.includes("--operator-authorized"))throw new Error("FORMAL_V5_SCHEMA_ACL_OPERATOR_AUTHORIZATION_REQUIRED");
  const subject=execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
  execFileSync("git",["fetch","--no-tags","origin","main"],{cwd:ROOT,stdio:"ignore"});
  const originMain=execFileSync("git",["rev-parse","origin/main"],{cwd:ROOT,encoding:"utf8"}).trim();
  assert.equal(subject,originMain,"FORMAL_V5_SCHEMA_ACL_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(execFileSync("git",["status","--porcelain"],{cwd:ROOT,encoding:"utf8"}).trim(),"","FORMAL_V5_SCHEMA_ACL_WORKTREE_MUST_BE_CLEAN");

  const armPath=path.resolve(arg("--arm")||DEFAULT_ARM);
  if(!fs.existsSync(armPath))throw new Error("FORMAL_V5_SCHEMA_ACL_ARM_REQUIRED");
  const arm=JSON.parse(fs.readFileSync(armPath,"utf8"));
  assert.equal(arm.schema_version,"geox_mcft_cap09_formal_v5_arm_v1");
  assert.equal(arm.status,"PASS");
  assert.equal(arm.subject_sha,subject);
  assert.equal(arm.formal_database_name,TARGET_DB);
  assert.equal(arm.formal_v5_arm,true);
  assert.equal(arm.formal_database_mutation,false);
  assert.equal(arm.schema_materialization,false);
  assert.equal(arm.a0_bootstrap,false);
  assert.equal(arm.o00_started,false);

  const url=requiredEnv("GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL");
  const pool=new Pool({connectionString:url,max:1});
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  try{
    await exactDatabase(pool);
    await assertClusterRuntimeIdentities(pool);
    const beforeTables=await publicTables(pool);
    const beforeRoutines=await publicRoutineCount(pool);

    if(beforeTables.length===29){
      assert.deepEqual(beforeTables,[...EXPECTED_PUBLIC_TABLES],"FORMAL_V5_SCHEMA_ACL_MATERIALIZED_TABLE_SET_MISMATCH");
      assert.equal(beforeRoutines,2,"FORMAL_V5_SCHEMA_ACL_MATERIALIZED_ROUTINE_COUNT_MISMATCH");
      assert.equal(await totalRows(pool,beforeTables),0,"FORMAL_V5_SCHEMA_ACL_PRE_A0_ROWS_MUST_BE_ZERO");
      const acl=await assertFinalAcl(pool);
      write(out,{
        schema_version:"geox_mcft_cap09_formal_v5_schema_acl_materialization_v1",
        status:"PASS_ALREADY_MATERIALIZED_IDEMPOTENT",
        subject_sha:subject,database_name:TARGET_DB,
        public_table_count:29,public_routine_count:2,all_table_rows_zero:true,
        public_tables:[...EXPECTED_PUBLIC_TABLES],canonical_facts_schema_ref:CANONICAL_FACTS_SCHEMA,
        schema_materialization_performed:false,acl_materialization_performed:false,
        ...acl,formal_v5_arm:true,a0_bootstrap:false,o00_started:false,provider_request_count:0,
      });
      return;
    }
    assert.equal(beforeTables.length,0,"FORMAL_V5_SCHEMA_ACL_PARTIAL_TABLE_STATE_FORBIDDEN");
    assert.equal(beforeRoutines,0,"FORMAL_V5_SCHEMA_ACL_PARTIAL_ROUTINE_STATE_FORBIDDEN");

    await pool.query("BEGIN");
    try{
      await createPrivilegeRoles(pool);
      await pool.query(canonicalFactsSchemaSql());
      await apply(pool,SCHEMA_FILES);
      const midTables=await publicTables(pool);
      assert.equal(midTables.length,29,"FORMAL_V5_SCHEMA_ACL_EXACT_29_TABLES_REQUIRED");
      assert.deepEqual(midTables,[...EXPECTED_PUBLIC_TABLES],"FORMAL_V5_SCHEMA_ACL_EXACT_29_TABLE_SET_REQUIRED");
      const newRelations=midTables.filter((name)=>EXPECTED_NEW_RELATIONS.includes(name as typeof EXPECTED_NEW_RELATIONS[number]));
      assert.deepEqual(newRelations.sort(),[...EXPECTED_NEW_RELATIONS].sort(),"FORMAL_V5_SCHEMA_ACL_V13_RELATIONS_REQUIRED");
      assert.equal(await totalRows(pool,midTables),0,"FORMAL_V5_SCHEMA_ACL_SCHEMA_MATERIALIZATION_MUST_REMAIN_ZERO_ROW");

      await applyFormalRuntimeAcl(pool);
      await pool.query(fs.readFileSync(path.join(ROOT,TWIN_WRITER_ACL),"utf8"));
      await pool.query(fs.readFileSync(path.join(ROOT,FORCING_WRITER_ACL),"utf8"));
      await revokeTemporaryOwnerMembership(pool);
      await assertFinalAcl(pool);
      await pool.query("COMMIT");
    }catch(error){
      await pool.query("ROLLBACK");
      const rollbackTables=await publicTables(pool);
      const rollbackRoutines=await publicRoutineCount(pool);
      assert.equal(rollbackTables.length,0,"FORMAL_V5_SCHEMA_ACL_ROLLBACK_TABLES_MUST_BE_ZERO");
      assert.equal(rollbackRoutines,0,"FORMAL_V5_SCHEMA_ACL_ROLLBACK_ROUTINES_MUST_BE_ZERO");
      throw error;
    }

    const afterTables=await publicTables(pool);
    const afterRoutines=await publicRoutineCount(pool);
    assert.equal(afterTables.length,29);
    assert.deepEqual(afterTables,[...EXPECTED_PUBLIC_TABLES],"FORMAL_V5_SCHEMA_ACL_POST_MATERIALIZATION_TABLE_SET_MISMATCH");
    assert.equal(afterRoutines,2);
    assert.equal(await totalRows(pool,afterTables),0,"FORMAL_V5_SCHEMA_ACL_POST_MATERIALIZATION_ROWS_MUST_BE_ZERO");
    const acl=await assertFinalAcl(pool);
    write(out,{
      schema_version:"geox_mcft_cap09_formal_v5_schema_acl_materialization_v1",
      status:"PASS",
      subject_sha:subject,database_name:TARGET_DB,
      public_table_count:29,public_routine_count:2,all_table_rows_zero:true,
      public_tables:[...EXPECTED_PUBLIC_TABLES],canonical_facts_schema_ref:CANONICAL_FACTS_SCHEMA,
      schema_files:[...SCHEMA_FILES],
      twin_writer_acl_ref:TWIN_WRITER_ACL,
      forcing_writer_acl_ref:FORCING_WRITER_ACL,
      schema_materialization_performed:true,acl_materialization_performed:true,
      ...acl,formal_v5_arm:true,a0_bootstrap:false,o00_started:false,provider_request_count:0,
    });
  }finally{
    await pool.end();
  }
}
main().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
