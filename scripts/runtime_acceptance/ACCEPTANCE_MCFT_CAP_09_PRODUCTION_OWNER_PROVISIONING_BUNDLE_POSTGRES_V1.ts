import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { bootstrapMcftCap09Phase5ServicePrincipalsV1 } from "../../apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.js";

const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_BUNDLE_POSTGRES_V1_RESULT.json");
const SCHEMA_FILES=[
  "docker/postgres/init/001_schema.sql",
  "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
  "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
] as const;
const ACL_FILES=[
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase3_evidence_runtime_acl.sql",
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql",
  "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql",
  "apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql",
] as const;

async function apply(pool:Pool, files:readonly string[]){
  for(const f of files) await pool.query(fs.readFileSync(path.join(ROOT,f),"utf8"));
}
async function main(){
  if(process.env.MCFT_CAP09_OWNER_PROVISIONING_BUNDLE_DESTRUCTIVE_ACCEPTANCE!=="1") throw new Error("OWNER_PROVISIONING_BUNDLE_ACCEPTANCE_FLAG_REQUIRED");
  const url=String(process.env.DATABASE_URL||"").trim();
  if(!url) throw new Error("DATABASE_URL_REQUIRED");
  const u=new URL(url);
  const db=u.pathname.replace(/^\//,"");
  const pool=new Pool({connectionString:url,max:1});
  try{
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await apply(pool,SCHEMA_FILES);
    const tables=Number((await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0]?.n);
    assert.equal(tables,29,"OWNER_PROVISIONING_EXACT_29_TABLE_SCHEMA_REQUIRED");
    await apply(pool,ACL_FILES);
    await bootstrapMcftCap09Phase5ServicePrincipalsV1({
      admin_database_url:url,
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
    assert.deepEqual(by.get("geox_mcft_cap09_evidence_runtime_v1"),{rolname:"geox_mcft_cap09_evidence_runtime_v1",rolcanlogin:false,rolinherit:true});
    assert.deepEqual(by.get("geox_mcft_cap09_twin_runtime_v1"),{rolname:"geox_mcft_cap09_twin_runtime_v1",rolcanlogin:false,rolinherit:false});
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
    const tableNames=(await pool.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r=>r.table_name);
    let nonzero=0;
    for(const name of tableNames){
      const q='"'+name.replaceAll('"','""')+'"';
      const n=Number((await pool.query(`SELECT count(*)::int AS n FROM public.${q}`)).rows[0]?.n);
      if(n!==0)nonzero++;
    }
    assert.equal(nonzero,0,"OWNER_PROVISIONING_ALL_TABLES_MUST_REMAIN_ZERO_STATE");
    const result={
      schema_version:"geox_mcft_cap09_production_owner_provisioning_bundle_postgres_v1",
      status:"PASS",
      schema_table_count:tables,
      all_table_rows_zero:true,
      acl_bundle_applied:true,
      evidence_privilege_role_safe:true,
      twin_privilege_role_safe:true,
      dual_login_bootstrap:true,
      exact_one_role_membership_each:true,
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
  } finally { await pool.end(); }
}
main().catch(e=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false},null,2)+"\n");console.error(e);process.exitCode=1;});
