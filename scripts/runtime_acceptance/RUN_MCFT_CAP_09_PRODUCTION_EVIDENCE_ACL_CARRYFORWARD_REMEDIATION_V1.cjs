#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_ARM_V1.json");
const PREF=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t"||v==="true";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const matrix=(url,t)=>q(url,["SELECT","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','SELECT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','INSERT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','UPDATE')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','DELETE')::text"].join("\n")).split("|").map(b);
const owner=(url,t)=>q(url,[
 "SELECT owner_role.rolname",
 "FROM pg_catalog.pg_class c",
 "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace",
 "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner",
 "WHERE n.nspname='public' AND c.relname='"+t+"'"
].join("\n"));
const fnExec=(url,role,name)=>b(q(url,"SELECT has_function_privilege('"+role+"','public."+name+"','EXECUTE')::text"));
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/);
 const arm=j(ARM),pref=j(PREF);
 if(arm.armed!==true){
   assert.equal(arm.production_evidence_acl_carryforward_remediation_authorized,false);
   write({schema_version:"geox_mcft_cap09_production_evidence_acl_carryforward_remediation_v1",status:"SKIPPED_NOT_ARMED",subject_sha:subject,database_mutation:false,row_mutation:false,schema_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
   process.exit(0);
 }
 assert.equal(arm.exact_target_database_name,TARGET,"ACL_REMEDIATION_ARM_TARGET_REQUIRED");
 assert.equal(arm.production_evidence_acl_carryforward_remediation_authorized,true,"ACL_REMEDIATION_AUTHORITY_REQUIRED");
 assert.equal(arm.expected_preflight_subject_sha,subject,"ACL_REMEDIATION_PREFLIGHT_SUBJECT_BINDING_REQUIRED");
 for(const k of ["runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"ACL_REMEDIATION_LATER_AUTHORITY_FORBIDDEN:"+k);
 assert.equal(pref.status,"PASS_REMEDIATION_REQUIRED","ACL_REMEDIATION_REQUIRED_PREFLIGHT_REQUIRED");
 assert.equal(pref.subject_sha,subject,"ACL_REMEDIATION_PREFLIGHT_HEAD_MISMATCH");
 assert.equal(pref.database_name,TARGET);
 assert.equal(pref.total_application_rows,0);

 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed);
 const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 const tables=["external_evidence_producer_lease_v1","external_evidence_supply_event_v1","external_evidence_supply_cursor_v1"];
 const v13Tables=["twin_external_formal_forcing_base_cursor_v1","twin_external_formal_forcing_base_target_v1","twin_external_formal_forcing_controller_lease_v1"];
 const currentUser=q(url,"SELECT current_user");
 assert.equal(currentUser,pref.current_user,"ACL_REMEDIATION_CURRENT_USER_DRIFT");
 for(const t of tables)assert.equal(owner(url,t),currentUser,"ACL_REMEDIATION_TARGET_OWNER_DRIFT:"+t);

 const tableCount=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const routineCount=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"));
 assert.equal(tableCount,41,"ACL_REMEDIATION_FRESH_EXACT_41_TABLES_REQUIRED");
 assert.equal(routineCount,3,"ACL_REMEDIATION_FRESH_EXACT_3_ROUTINES_REQUIRED");
 const preTableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);
 let freshRows=0;for(const t of preTableNames)freshRows+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(freshRows,0,"ACL_REMEDIATION_FRESH_ALL_ROWS_MUST_BE_ZERO");

 assert.deepEqual(matrix(url,"facts"),[true,false,false,false],"ACL_REMEDIATION_FRESH_FACTS_MATRIX_REQUIRED");
 for(const t of v13Tables)assert.deepEqual(matrix(url,t),[true,true,true,false],"ACL_REMEDIATION_FRESH_V13_MATRIX_REQUIRED:"+t);
 assert.equal(fnExec(url,"geox_mcft_cap09_evidence_runtime_v1","mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)"),true,"ACL_REMEDIATION_FRESH_PHASE3_FUNCTION_REQUIRED");
 assert.equal(fnExec(url,"geox_mcft_cap09_twin_runtime_v1","mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)"),false,"ACL_REMEDIATION_FRESH_PHASE3_FUNCTION_TWIN_FORBIDDEN");
 assert.equal(fnExec(url,"geox_mcft_cap09_evidence_runtime_v1","mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)"),true,"ACL_REMEDIATION_FRESH_V13_FUNCTION_REQUIRED");
 assert.equal(fnExec(url,"geox_mcft_cap09_twin_runtime_v1","mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)"),false,"ACL_REMEDIATION_FRESH_V13_FUNCTION_TWIN_FORBIDDEN");
 assert.equal(fnExec(url,"geox_mcft_cap09_evidence_runtime_v1","mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)"),false,"ACL_REMEDIATION_FRESH_TWIN_FUNCTION_EVIDENCE_FORBIDDEN");
 assert.equal(fnExec(url,"geox_mcft_cap09_twin_runtime_v1","mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)"),true,"ACL_REMEDIATION_FRESH_TWIN_FUNCTION_REQUIRED");

 const exactMemberships=q(url,[
  "SELECT member.rolname||'>'||granted.rolname",
  "FROM pg_catalog.pg_auth_members m",
  "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
  "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
  "WHERE member.rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')",
  "ORDER BY member.rolname,granted.rolname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);
 assert.deepEqual(exactMemberships,[
  "geox_mcft_cap09_evidence_runtime_login_v1>geox_mcft_cap09_evidence_runtime_v1",
  "geox_mcft_cap09_twin_runtime_login_v1>geox_mcft_cap09_twin_runtime_v1"
 ],"ACL_REMEDIATION_FRESH_LOGIN_MEMBERSHIP_REQUIRED");

 const before=Object.fromEntries(tables.map(t=>[t,matrix(url,t)]));
 for(const t of tables)assert.equal(before[t][3],false,"ACL_REMEDIATION_TARGET_DELETE_PRESTATE_FORBIDDEN:"+t);
 const loginBefore=q(url,"SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')");
 const totalBefore=freshRows;

 const sql=[
  "BEGIN;",
  "GRANT SELECT, INSERT, UPDATE ON TABLE public.external_evidence_producer_lease_v1, public.external_evidence_supply_event_v1, public.external_evidence_supply_cursor_v1 TO geox_mcft_cap09_evidence_runtime_v1;",
  "REVOKE DELETE ON TABLE public.external_evidence_producer_lease_v1, public.external_evidence_supply_event_v1, public.external_evidence_supply_cursor_v1 FROM geox_mcft_cap09_evidence_runtime_v1;",
  "REVOKE INSERT, UPDATE, DELETE ON TABLE public.facts FROM geox_mcft_cap09_evidence_runtime_v1;",
  "COMMIT;"
 ].join("\n");
 q(url,sql);

 const after=Object.fromEntries(tables.map(t=>[t,matrix(url,t)]));
 for(const t of tables)assert.deepEqual(after[t],[true,true,true,false],"ACL_REMEDIATION_POST_MATRIX_REQUIRED:"+t);
 for(const t of ["twin_external_formal_forcing_base_cursor_v1","twin_external_formal_forcing_base_target_v1","twin_external_formal_forcing_controller_lease_v1"])assert.deepEqual(matrix(url,t),[true,true,true,false],"ACL_REMEDIATION_V13_MATRIX_MUST_REMAIN:"+t);
 assert.deepEqual(matrix(url,"facts"),[true,false,false,false],"ACL_REMEDIATION_FACTS_MATRIX_MUST_REMAIN");
 const fn=b(q(url,"SELECT has_function_privilege('geox_mcft_cap09_evidence_runtime_v1','public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)','EXECUTE')::text"));assert.equal(fn,true);
 const loginAfter=q(url,"SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')");
 assert.equal(loginAfter,loginBefore,"ACL_REMEDIATION_LOGIN_COUNT_MUST_NOT_CHANGE");
 const tableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);
 let totalAfter=0;for(const t of tableNames)totalAfter+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(totalAfter,totalBefore,"ACL_REMEDIATION_ROW_COUNT_MUST_NOT_CHANGE");
 write({schema_version:"geox_mcft_cap09_production_evidence_acl_carryforward_remediation_v1",status:"PASS_REMEDIATION_APPLIED",subject_sha:subject,database_name:TARGET,before_acl:before,after_acl:after,total_rows_before:totalBefore,total_rows_after:totalAfter,phase3_append_function_execute:true,login_count_unchanged:true,database_mutation:true,acl_only_mutation:true,row_mutation:false,schema_mutation:false,role_mutation:false,credential_mutation:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
