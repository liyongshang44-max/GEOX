// Database provisioning for a NEW disposable CI-only PostgreSQL instance.
// Refuse any existing public table. No DROP, DELETE, TRUNCATE, Permit or production Host.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {Pool} from "pg";
const req=(k:string)=>{const v=process.env[k];if(!v)throw Error("STAGE3_NEW_PG_ENV:"+k);return v;};
const migrations=[
 "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
 "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
 "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
 "apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql"];
async function main(){
 assert.equal(process.platform,"win32","STAGE3_WINDOWS_NATIVE_ONLY");
 assert.equal(process.version,"v24.19.0","STAGE3_WINDOWS_NODE24_REQUIRED");
 assert(!process.env.CI&&!process.env.GITHUB_ACTIONS,"STAGE3_WINDOWS_NOT_CI_SPOOFED");
 const actual=fs.realpathSync.native(process.execPath).toLowerCase();
 const pinned=fs.realpathSync.native(req("MCFT_CAP09_WINDOWS_PINNED_NODE")).toLowerCase();
 assert.equal(actual,pinned,"STAGE3_WINDOWS_ACTUAL_NODE_BINARY_MISMATCH");
 assert.equal(req("MCFT_CAP09_WINDOWS_NEW_TEST_PG_BOOTSTRAP"),"1");
 for(const n of ["MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_TICKET",
  "MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST","MCFT_CAP09_FORMAL_RAW_BUCKET",
  "BLOCKED_DATABASE_URL","GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL"]){
  assert(!process.env[n],"STAGE3_PG_FORMAL_ENV_FORBIDDEN:"+n);
 }
 const id=req("MCFT_CAP09_STAGE3_NEW_RUN_ID");
 assert(/^[a-f0-9]{12}$/.test(id)&&id!=="da9db7129607");
 const dbName="mcft_cap09_requal_"+id+"_positive";
 const url=new URL(req("DATABASE_URL"));
 assert(["127.0.0.1","localhost","[::1]"].includes(url.hostname));
 assert(["postgres:","postgresql:"].includes(url.protocol)&&
   decodeURIComponent(url.pathname.slice(1))===dbName&&!url.search&&!url.hash);
 assert.equal(url.username,"postgres");
 const password=req("CAP09_E2E_PG_ROLE_PASSWORD");
 assert(/^[-_a-zA-Z0-9]{16,96}$/.test(password));
 const admin=new Pool({connectionString:url.toString()});
 try{
  const current=(await admin.query("SELECT current_database() AS db,current_user AS role")).rows[0];
  assert.equal(current?.db,dbName);assert.equal(current?.role,"postgres");
  const n=Number((await admin.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0]?.n);
  assert.equal(n,0,"STAGE3_PG_NOT_A_NEW_DATABASE");
  await admin.query(fs.readFileSync(path.resolve("docker/postgres/init/001_schema.sql"),"utf8"));
  for(const f of migrations){
   if(f.includes("fenced_promotion_acl")){
    await admin.query("DO $evidence$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_mcft_cap09_evidence_runtime_v1') THEN CREATE ROLE geox_mcft_cap09_evidence_runtime_v1 NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF; END $evidence$");
   }
   await admin.query(fs.readFileSync(path.resolve(f),"utf8"));
  }
  const role="cap09_non_auth_e2e_"+id;
  await admin.query("CREATE ROLE "+role+" LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '"+password+"'");
  await admin.query("GRANT geox_mcft_cap09_evidence_runtime_v1 TO "+role);
  const restrictedUrl=new URL(url.toString());
  restrictedUrl.username=role;restrictedUrl.password=password;
  const restricted=new Pool({connectionString:restrictedUrl.toString()});
  try{
   const acl=(await restricted.query("SELECT current_user::text AS role,has_table_privilege(current_user,'public.facts','INSERT') AS can_insert,has_function_privilege(current_user,'public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)','EXECUTE') AS can_execute")).rows[0];
   assert.equal(acl?.role,role);assert.equal(acl?.can_insert,false);
   assert.equal(acl?.can_execute,true);
   console.log(JSON.stringify({status:"PASS_FRESH_ISOLATED_PG_SCHEMA_AND_EVIDENCE_ROLE",
     database:dbName,role,exact_table_count:(await restricted.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0]?.n,
     direct_facts_insert:false,fenced_execute:true,permit:false}));
  }finally{await restricted.end();}
 }finally{await admin.end();}
}
main().catch(e=>{console.error("STAGE3_FRESH_PG_BOOTSTRAP_HOLD:"+String(e instanceof Error?e.message:e));process.exitCode=1;});
