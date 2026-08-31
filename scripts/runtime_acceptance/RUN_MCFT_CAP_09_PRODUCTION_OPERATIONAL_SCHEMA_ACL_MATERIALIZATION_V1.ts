import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_MATERIALIZATION_V1_RESULT.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_ARM_V1.json");
const TARGET_DB="geox_mcft_cap09_production_runtime_v1";
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

function write(v:unknown){
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");
  console.log(JSON.stringify(v,null,2));
}
async function apply(pool:Pool,files:readonly string[]){
  for(const f of files) await pool.query(fs.readFileSync(path.join(ROOT,f),"utf8"));
}
async function main(){
  const arm=JSON.parse(fs.readFileSync(ARM,"utf8"));
  const subject=String(process.env.MCFT_SUBJECT_SHA||"");
  if(!/^[0-9a-f]{40}$/.test(subject)) throw new Error("OP_SCHEMA_ACL_SUBJECT_REQUIRED");
  if(arm.schema_version!=="geox_mcft_cap09_production_operational_schema_acl_arm_v1"||arm.database_name!==TARGET_DB) throw new Error("OP_SCHEMA_ACL_ARM_IDENTITY_REQUIRED");

  if(arm.armed!==true){
    for(const k of ["production_host_schema_materialization_authorized","runtime_acl_materialization_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) {
      assert.equal(arm[k],false,"OP_SCHEMA_ACL_UNARMED_EFFECT:"+k);
    }
    write({
      schema_version:"geox_mcft_cap09_production_operational_schema_acl_materialization_v1",
      status:"SKIPPED_NOT_ARMED",
      subject_sha:subject,
      database_name:TARGET_DB,
      schema_migration_performed:false,
      service_login_created:false,
      runtime_process_start:false,
      production_owner_activation:false,
      provider_request_count:0,
      formal_v5_arm:false,
      a0_bootstrap:false,
      o00_started:false
    });
    return;
  }

  assert.equal(arm.production_host_schema_materialization_authorized,true);
  assert.equal(arm.runtime_acl_materialization_authorized,true);
  for(const k of ["service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) {
    assert.equal(arm[k],false,"OP_SCHEMA_ACL_LATER_EFFECT:"+k);
  }

  const url=String(process.env.DATABASE_URL||"").trim();
  if(!url) throw new Error("OP_SCHEMA_ACL_DATABASE_URL_REQUIRED");
  const pool=new Pool({connectionString:url,max:1});
  try{
    const db=(await pool.query<{name:string}>("SELECT current_database()::text AS name")).rows[0]?.name;
    assert.equal(db,TARGET_DB,"OP_SCHEMA_ACL_DATABASE_IDENTITY_MISMATCH");
    const before=(await pool.query<{tables:number,routines:number}>(
      "SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,(SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS routines"
    )).rows[0]!;
    assert.equal(before.tables,0,"OP_SCHEMA_ACL_TARGET_TABLES_MUST_BE_ZERO");
    assert.equal(before.routines,0,"OP_SCHEMA_ACL_TARGET_ROUTINES_MUST_BE_ZERO");

    await pool.query("BEGIN");
    try{
      await apply(pool,SCHEMA_FILES);
      await apply(pool,ACL_FILES);
      await pool.query("COMMIT");
    }catch(e){
      await pool.query("ROLLBACK");
      throw e;
    }

    const tables=Number((await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0]?.n);
    assert.equal(tables,41,"OP_SCHEMA_ACL_EXACT_41_TABLES_REQUIRED");

    const tableNames=(await pool.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r=>r.table_name);
    let nonzero=0;
    for(const name of tableNames){
      const q='"'+name.replaceAll('"','""')+'"';
      const n=Number((await pool.query("SELECT count(*)::int AS n FROM public."+q)).rows[0]?.n);
      if(n!==0) nonzero++;
    }
    assert.equal(nonzero,0,"OP_SCHEMA_ACL_ALL_TABLES_MUST_REMAIN_ZERO");

    const roles=(await pool.query<{rolname:string,rolcanlogin:boolean,rolinherit:boolean}>(
      "SELECT rolname,rolcanlogin,rolinherit FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname",
      [[
        "geox_mcft_cap09_evidence_runtime_v1",
        "geox_mcft_cap09_twin_runtime_v1",
        "geox_mcft_cap09_evidence_runtime_login_v1",
        "geox_mcft_cap09_twin_runtime_login_v1"
      ]]
    )).rows;
    const by=new Map(roles.map(r=>[r.rolname,r]));
    assert.deepEqual(by.get("geox_mcft_cap09_evidence_runtime_v1"),{rolname:"geox_mcft_cap09_evidence_runtime_v1",rolcanlogin:false,rolinherit:true});
    assert.deepEqual(by.get("geox_mcft_cap09_twin_runtime_v1"),{rolname:"geox_mcft_cap09_twin_runtime_v1",rolcanlogin:false,rolinherit:false});
    assert.equal(by.has("geox_mcft_cap09_evidence_runtime_login_v1"),false,"OP_SCHEMA_ACL_EVIDENCE_LOGIN_MUST_NOT_EXIST");
    assert.equal(by.has("geox_mcft_cap09_twin_runtime_login_v1"),false,"OP_SCHEMA_ACL_TWIN_LOGIN_MUST_NOT_EXIST");

    const facts=(await pool.query<{evidence_insert:boolean,twin_insert:boolean}>(
      "SELECT has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','INSERT') AS evidence_insert,has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','INSERT') AS twin_insert"
    )).rows[0]!;
    assert.equal(facts.evidence_insert,false);
    assert.equal(facts.twin_insert,false);

    const fn=(await pool.query<{proname:string,evidence_exec:boolean,twin_exec:boolean}>(
      "SELECT p.proname,has_function_privilege('geox_mcft_cap09_evidence_runtime_v1',p.oid,'EXECUTE') AS evidence_exec,has_function_privilege('geox_mcft_cap09_twin_runtime_v1',p.oid,'EXECUTE') AS twin_exec FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1::text[]) ORDER BY p.proname",
      [[
        "mcft_cap09_evidence_runtime_append_fact_v1",
        "mcft_cap09_twin_runtime_append_fact_v1",
        "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1"
      ]]
    )).rows;
    assert.equal(fn.length,3);
    const f=new Map(fn.map(r=>[r.proname,r]));
    assert.deepEqual([f.get("mcft_cap09_evidence_runtime_append_fact_v1")?.evidence_exec,f.get("mcft_cap09_evidence_runtime_append_fact_v1")?.twin_exec],[true,false]);
    assert.deepEqual([f.get("mcft_cap09_twin_runtime_append_fact_v1")?.evidence_exec,f.get("mcft_cap09_twin_runtime_append_fact_v1")?.twin_exec],[false,true]);
    assert.deepEqual([f.get("mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1")?.evidence_exec,f.get("mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1")?.twin_exec],[true,false]);

    write({
      schema_version:"geox_mcft_cap09_production_operational_schema_acl_materialization_v1",
      status:"PASS",
      subject_sha:subject,
      database_name:TARGET_DB,
      production_host_table_count:tables,
      all_table_rows_zero:true,
      evidence_privilege_role_safe:true,
      twin_privilege_role_safe:true,
      evidence_direct_facts_insert:false,
      twin_direct_facts_insert:false,
      evidence_writer_cross_plane_matrix_pass:true,
      twin_writer_cross_plane_matrix_pass:true,
      v13_fenced_promotion_cross_plane_matrix_pass:true,
      service_login_created:false,
      schema_migration_performed:true,
      runtime_process_start:false,
      production_owner_activation:false,
      provider_request_count:0,
      formal_v5_arm:false,
      a0_bootstrap:false,
      o00_started:false
    });
  }finally{
    await pool.end();
  }
}
main().catch(e=>{
  write({
    status:"FAIL",
    error:e instanceof Error?e.message:String(e),
    schema_migration_performed:false,
    service_login_created:false,
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  });
  console.error(e);
  process.exitCode=1;
});
