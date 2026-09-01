#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_ARM_V1.json");
const PREF=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_PREFLIGHT_V1_RESULT.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1_RESULT.json");
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t"||v==="true";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const memberships=url=>q(url,[
 "SELECT granted.rolname||'|member='||member.rolname||'|grantor='||grantor.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text",
 "FROM pg_catalog.pg_auth_members m","JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid","JOIN pg_catalog.pg_roles member ON member.oid=m.member","JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
 "WHERE member.rolname=current_user","AND granted.rolname IN ('geox_mcft_cap09_evidence_writer_owner_v1','geox_mcft_cap09_forcing_writer_owner_v1','geox_mcft_cap09_twin_writer_owner_v1')","ORDER BY granted.rolname,grantor.rolname"
].join("\n")).split(/\r?\n/).filter(Boolean);
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/);
 const arm=JSON.parse(fs.readFileSync(ARM,"utf8"));
 if(arm.armed!==true){
  assert.equal(arm.production_writer_owner_self_grant_cleanup_authorized,false);
  write({schema_version:"geox_mcft_cap09_production_writer_owner_self_grant_cleanup_v1",status:"SKIPPED_NOT_ARMED",subject_sha:subject,database_mutation:false,membership_mutation:false,row_mutation:false,schema_mutation:false,table_acl_mutation:false,function_acl_mutation:false,role_attribute_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exit(0);
 }
 assert.equal(arm.exact_target_database_name,TARGET,"WRITER_OWNER_CLEANUP_ARM_TARGET_REQUIRED");
 assert.equal(arm.production_writer_owner_self_grant_cleanup_authorized,true,"WRITER_OWNER_CLEANUP_AUTHORITY_REQUIRED");
 assert.equal(arm.expected_preflight_subject_sha,subject,"WRITER_OWNER_CLEANUP_PREFLIGHT_SUBJECT_BINDING_REQUIRED");
 for(const k of ["production_evidence_acl_carryforward_remediation_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"WRITER_OWNER_CLEANUP_LATER_AUTHORITY_FORBIDDEN:"+k);
 const pref=JSON.parse(fs.readFileSync(PREF,"utf8"));assert.equal(pref.status,"PASS_CLEANUP_REQUIRED");assert.equal(pref.subject_sha,subject);assert.equal(pref.database_name,TARGET);
 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed);const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 assert.equal(q(url,"SELECT current_user"),"neondb_owner","WRITER_OWNER_CLEANUP_CURRENT_USER_DRIFT");
 const before=memberships(url);assert.deepEqual(before,pref.writer_owner_memberships,"WRITER_OWNER_CLEANUP_MEMBERSHIP_PRESTATE_DRIFT");
 const rowsBefore=Number(pref.total_application_rows);assert.equal(rowsBefore,0);
 const exactSql=[
  "BEGIN;",
  "REVOKE geox_mcft_cap09_forcing_writer_owner_v1 FROM CURRENT_USER GRANTED BY CURRENT_USER RESTRICT;",
  "DO $check$ BEGIN",
  " IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor WHERE granted.rolname='geox_mcft_cap09_forcing_writer_owner_v1' AND member.rolname=current_user AND grantor.rolname=current_user) THEN RAISE EXCEPTION 'WRITER_OWNER_CLEANUP_SELF_GRANT_RESIDUAL'; END IF;",
  " IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor WHERE member.rolname=current_user AND grantor.rolname='cloud_admin' AND granted.rolname IN ('geox_mcft_cap09_evidence_writer_owner_v1','geox_mcft_cap09_forcing_writer_owner_v1','geox_mcft_cap09_twin_writer_owner_v1') AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option) <> 3 THEN RAISE EXCEPTION 'WRITER_OWNER_CLEANUP_MANAGEMENT_GRANTS_NOT_PRESERVED'; END IF;",
  " IF pg_catalog.pg_has_role(current_user,'geox_mcft_cap09_evidence_writer_owner_v1','SET') OR pg_catalog.pg_has_role(current_user,'geox_mcft_cap09_forcing_writer_owner_v1','SET') OR pg_catalog.pg_has_role(current_user,'geox_mcft_cap09_twin_writer_owner_v1','SET') THEN RAISE EXCEPTION 'WRITER_OWNER_CLEANUP_EFFECTIVE_SET_NOT_ZERO'; END IF;",
  "END $check$;",
  "COMMIT;"
 ].join("\n");
 q(url,exactSql);
 const after=memberships(url);
 assert.deepEqual(after,[
  "geox_mcft_cap09_evidence_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false",
  "geox_mcft_cap09_forcing_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false",
  "geox_mcft_cap09_twin_writer_owner_v1|member=neondb_owner|grantor=cloud_admin|admin=true|inherit=false|set=false"
 ],"WRITER_OWNER_CLEANUP_POST_MEMBERSHIPS_REQUIRED");
 for(const r of ["geox_mcft_cap09_evidence_writer_owner_v1","geox_mcft_cap09_forcing_writer_owner_v1","geox_mcft_cap09_twin_writer_owner_v1"])assert.equal(b(q(url,"SELECT pg_catalog.pg_has_role(current_user,'"+r+"','SET')::text")),false,"WRITER_OWNER_CLEANUP_POST_SET_MUST_BE_FALSE:"+r);
 const tableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);let rowsAfter=0;for(const t of tableNames)rowsAfter+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(rowsAfter,rowsBefore,"WRITER_OWNER_CLEANUP_ROW_COUNT_MUST_NOT_CHANGE");
 write({schema_version:"geox_mcft_cap09_production_writer_owner_self_grant_cleanup_v1",status:"PASS_CLEANUP_APPLIED",subject_sha:subject,database_name:TARGET,before_memberships:before,after_memberships:after,total_rows_before:rowsBefore,total_rows_after:rowsAfter,database_mutation:true,membership_mutation:true,exact_membership_revoke_only:true,row_mutation:false,schema_mutation:false,table_acl_mutation:false,function_acl_mutation:false,role_attribute_mutation:false,credential_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
