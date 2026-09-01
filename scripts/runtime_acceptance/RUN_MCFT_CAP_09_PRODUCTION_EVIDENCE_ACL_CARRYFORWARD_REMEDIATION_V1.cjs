#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_ARM_V1.json");
const PREF=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const matrix=(url,t)=>q(url,["SELECT","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','SELECT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','INSERT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','UPDATE')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','DELETE')::text"].join("\n")).split("|").map(b);
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
 const before=Object.fromEntries(tables.map(t=>[t,matrix(url,t)]));
 const loginBefore=q(url,"SELECT count(*)::int FROM pg_catalog.pg_roles WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')");
 const totalBefore=Number(pref.total_application_rows);

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
