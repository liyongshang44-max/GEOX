#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_PREFLIGHT_V1_RESULT.json");
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t"||v==="true";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const matrix=(url,t)=>q(url,["SELECT","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','SELECT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','INSERT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','UPDATE')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','DELETE')::text"].join("\n")).split("|").map(b);
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/,"WRITER_OWNER_CLEANUP_SUBJECT_REQUIRED");
 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed,"WRITER_OWNER_CLEANUP_SEED_URL_REQUIRED");
 const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 const arm=JSON.parse(fs.readFileSync(ARM,"utf8"));
 const cleanupAuthorized=arm.production_writer_owner_self_grant_cleanup_authorized===true;
 assert.equal(cleanupAuthorized,arm.armed===true,"WRITER_OWNER_CLEANUP_ARM_AUTHORIZATION_COHERENCE_REQUIRED");
 assert.equal(arm.same_workflow_fresh_preflight_required,true,"WRITER_OWNER_CLEANUP_SAME_WORKFLOW_PREFLIGHT_REQUIRED");
 assert.equal(arm.preflight_subject_binding,"CURRENT_WORKFLOW_SUBJECT_SHA","WRITER_OWNER_CLEANUP_PREFLIGHT_BINDING_MODE_REQUIRED");
 if(arm.armed===true)assert.equal(arm.exact_target_database_name,TARGET,"WRITER_OWNER_CLEANUP_ARM_TARGET_REQUIRED");
 else assert.equal(arm.exact_target_database_name,null,"WRITER_OWNER_CLEANUP_UNARMED_TARGET_MUST_BE_NULL");
 for(const k of ["production_evidence_acl_carryforward_remediation_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"WRITER_OWNER_CLEANUP_LATER_AUTHORITY_MUST_BE_FALSE:"+k);
 assert.equal(q(url,"SELECT current_database()"),TARGET,"WRITER_OWNER_CLEANUP_DATABASE_MISMATCH");
 const currentUser=q(url,"SELECT current_user");assert.equal(currentUser,"neondb_owner","WRITER_OWNER_CLEANUP_CURRENT_USER_MUST_BE_NEONDB_OWNER");
 const tableCount=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const routineCount=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"));
 assert.equal(tableCount,41,"WRITER_OWNER_CLEANUP_EXACT_41_TABLES_REQUIRED");assert.equal(routineCount,3,"WRITER_OWNER_CLEANUP_EXACT_3_ROUTINES_REQUIRED");
 const tableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);
 let totalRows=0;for(const t of tableNames)totalRows+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(totalRows,0,"WRITER_OWNER_CLEANUP_ALL_ROWS_MUST_BE_ZERO");
 const membershipRows=q(url,[
  "SELECT granted.rolname||'|member='||member.rolname||'|grantor='||grantor.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text",
  "FROM pg_catalog.pg_auth_members m",
  "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
  "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
  "JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
  "WHERE member.rolname=current_user",
  "AND granted.rolname IN ('geox_mcft_cap09_evidence_writer_owner_v1','geox_mcft_cap09_forcing_writer_owner_v1','geox_mcft_cap09_twin_writer_owner_v1')",
  "ORDER BY granted.rolname,grantor.rolname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);
 assert.deepEqual(membershipRows,[
  "geox_mcft_cap09_evidence_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false",
  "geox_mcft_cap09_forcing_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false",
  "geox_mcft_cap09_forcing_writer_owner_v1|member=neondb_owner|grantor=neondb_owner|admin=false|inherit=true|set=true",
  "geox_mcft_cap09_twin_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false"
 ],"WRITER_OWNER_CLEANUP_EXACT_LIVE_MEMBERSHIP_PRESTATE_REQUIRED");
 const caps={};
 for(const r of ["geox_mcft_cap09_evidence_writer_owner_v1","geox_mcft_cap09_forcing_writer_owner_v1","geox_mcft_cap09_twin_writer_owner_v1"])caps[r]=b(q(url,"SELECT pg_catalog.pg_has_role(current_user,'"+r+"','SET')::text"));
 assert.deepEqual(caps,{geox_mcft_cap09_evidence_writer_owner_v1:false,geox_mcft_cap09_forcing_writer_owner_v1:true,geox_mcft_cap09_twin_writer_owner_v1:false},"WRITER_OWNER_CLEANUP_EFFECTIVE_SET_PRESTATE_REQUIRED");
 const targetTables=["external_evidence_producer_lease_v1","external_evidence_supply_event_v1","external_evidence_supply_cursor_v1"];
 const missing=[];for(const t of targetTables){const m=matrix(url,t);for(const [i,p] of [[0,"SELECT"],[1,"INSERT"],[2,"UPDATE"]])if(!m[i])missing.push(t+":"+p);assert.equal(m[3],false,"WRITER_OWNER_CLEANUP_DELETE_FORBIDDEN:"+t);}
 assert.deepEqual(missing,[
  "external_evidence_producer_lease_v1:SELECT","external_evidence_producer_lease_v1:INSERT","external_evidence_producer_lease_v1:UPDATE",
  "external_evidence_supply_event_v1:SELECT","external_evidence_supply_event_v1:INSERT","external_evidence_supply_event_v1:UPDATE",
  "external_evidence_supply_cursor_v1:SELECT","external_evidence_supply_cursor_v1:INSERT","external_evidence_supply_cursor_v1:UPDATE"
 ],"WRITER_OWNER_CLEANUP_EXACT_NINE_ACL_PRESTATE_REQUIRED");
 write({schema_version:"geox_mcft_cap09_production_writer_owner_self_grant_cleanup_preflight_v1",status:"PASS_CLEANUP_REQUIRED",subject_sha:subject,database_name:TARGET,current_user:currentUser,table_count:tableCount,routine_count:routineCount,total_application_rows:totalRows,writer_owner_memberships:membershipRows,writer_owner_effective_set:caps,exact_nine_missing_privileges:missing,arm_observed:arm.armed===true,cleanup_authorized_observed:cleanupAuthorized,same_workflow_fresh_preflight_required:arm.same_workflow_fresh_preflight_required===true,preflight_subject_binding:arm.preflight_subject_binding,database_mutation:false,row_mutation:false,schema_mutation:false,table_acl_mutation:false,function_acl_mutation:false,role_attribute_mutation:false,membership_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),database_mutation:false,membership_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
