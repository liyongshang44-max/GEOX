#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-WRITER-OWNER-SELF-GRANT-CLEANUP-AUTHORITY-V1.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_ARM_V1.json");
const PREF=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_PREFLIGHT_V1_RESULT.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_WRITER_OWNER_SELF_GRANT_CLEANUP_V1_RESULT.json");
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t"||v==="true";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const matrix=(url,t)=>q(url,["SELECT","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','SELECT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','INSERT')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','UPDATE')::text,","has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public."+t+"','DELETE')::text"].join("\n")).split("|").map(b);
const publicTableAcl=url=>q(url,["SELECT c.relname||'|owner='||r.rolname||'|acl='||COALESCE(c.relacl::text,'<null>')","FROM pg_catalog.pg_class c","JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace","JOIN pg_catalog.pg_roles r ON r.oid=c.relowner","WHERE n.nspname='public' AND c.relkind IN ('r','p')","ORDER BY c.relname"].join("\n")).split(/\r?\n/).filter(Boolean);
const publicRoutineAcl=url=>q(url,["SELECT p.oid::regprocedure::text||'|owner='||r.rolname||'|acl='||COALESCE(p.proacl::text,'<null>')","FROM pg_catalog.pg_proc p","JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace","JOIN pg_catalog.pg_roles r ON r.oid=p.proowner","WHERE n.nspname='public'","ORDER BY p.oid::regprocedure::text"].join("\n")).split(/\r?\n/).filter(Boolean);
const publicSchemaAcl=url=>q(url,"SELECT nspname||'|acl='||COALESCE(nspacl::text,'<null>') FROM pg_catalog.pg_namespace WHERE nspname='public'");
const serviceLoginRoles=url=>q(url,["SELECT rolname||'|login='||rolcanlogin::text||'|inherit='||rolinherit::text||'|super='||rolsuper::text||'|createdb='||rolcreatedb::text||'|createrole='||rolcreaterole::text||'|replication='||rolreplication::text||'|bypassrls='||rolbypassrls::text","FROM pg_catalog.pg_roles","WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')","ORDER BY rolname"].join("\n")).split(/\r?\n/).filter(Boolean);
const serviceLoginMemberships=url=>q(url,["SELECT member.rolname||'|privilege='||granted.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text","FROM pg_catalog.pg_auth_members m","JOIN pg_catalog.pg_roles member ON member.oid=m.member","JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid","WHERE member.rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')","ORDER BY member.rolname,granted.rolname"].join("\n")).split(/\r?\n/).filter(Boolean);
const serviceLoginOwnedObjects=url=>Number(q(url,["WITH target AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1'))","SELECT ((SELECT count(*) FROM pg_catalog.pg_database d WHERE d.datdba IN (SELECT oid FROM target))+(SELECT count(*) FROM pg_catalog.pg_namespace n WHERE n.nspowner IN (SELECT oid FROM target))+(SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relowner IN (SELECT oid FROM target))+(SELECT count(*) FROM pg_catalog.pg_proc p WHERE p.proowner IN (SELECT oid FROM target)))::int"].join("\n"))||"0");
const memberships=url=>q(url,[
 "SELECT granted.rolname||'|member='||member.rolname||'|grantor='||grantor.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text",
 "FROM pg_catalog.pg_auth_members m","JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid","JOIN pg_catalog.pg_roles member ON member.oid=m.member","JOIN pg_catalog.pg_roles grantor ON grantor.oid=m.grantor",
 "WHERE member.rolname=current_user","AND granted.rolname IN ('geox_mcft_cap09_evidence_writer_owner_v1','geox_mcft_cap09_forcing_writer_owner_v1','geox_mcft_cap09_twin_writer_owner_v1')","ORDER BY granted.rolname,grantor.rolname"
].join("\n")).split(/\r?\n/).filter(Boolean);
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/);
 const authority=JSON.parse(fs.readFileSync(AUTH,"utf8"));
 const arm=JSON.parse(fs.readFileSync(ARM,"utf8"));
 const authorityAuthorized=authority.authorization.production_writer_owner_self_grant_cleanup_authorized===true;
 assert.equal(authorityAuthorized,arm.production_writer_owner_self_grant_cleanup_authorized===true,"WRITER_OWNER_CLEANUP_AUTHORITY_ARM_AUTHORIZATION_MISMATCH");
 if(arm.armed!==true){
  assert.equal(arm.production_writer_owner_self_grant_cleanup_authorized,false);
  assert.equal(authorityAuthorized,false,"WRITER_OWNER_CLEANUP_UNARMED_AUTHORITY_MUST_BE_FALSE");
  assert.ok(["LIVE_EXACT_SELF_GRANT_PROVEN_CLEANUP_NOT_AUTHORIZED","EXACT_SELF_GRANT_CLEANUP_APPLIED"].includes(authority.status),"WRITER_OWNER_CLEANUP_UNARMED_AUTHORITY_STATUS_INVALID");
  write({schema_version:"geox_mcft_cap09_production_writer_owner_self_grant_cleanup_v1",status:"SKIPPED_NOT_ARMED",subject_sha:subject,database_mutation:false,membership_mutation:false,row_mutation:false,schema_mutation:false,table_acl_mutation:false,function_acl_mutation:false,role_attribute_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exit(0);
 }
 assert.equal(arm.exact_target_database_name,TARGET,"WRITER_OWNER_CLEANUP_ARM_TARGET_REQUIRED");
 assert.equal(arm.production_writer_owner_self_grant_cleanup_authorized,true,"WRITER_OWNER_CLEANUP_AUTHORITY_REQUIRED");
 assert.equal(authorityAuthorized,true,"WRITER_OWNER_CLEANUP_MACHINE_AUTHORITY_REQUIRED");
 assert.equal(authority.status,"EXACT_SELF_GRANT_CLEANUP_AUTHORIZED","WRITER_OWNER_CLEANUP_AUTHORITY_STATUS_REQUIRED");
 assert.equal(arm.same_workflow_fresh_preflight_required,true,"WRITER_OWNER_CLEANUP_SAME_WORKFLOW_PREFLIGHT_REQUIRED");
 assert.equal(arm.preflight_subject_binding,"CURRENT_WORKFLOW_SUBJECT_SHA","WRITER_OWNER_CLEANUP_PREFLIGHT_BINDING_MODE_REQUIRED");
 for(const k of ["production_evidence_acl_carryforward_remediation_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"WRITER_OWNER_CLEANUP_LATER_AUTHORITY_FORBIDDEN:"+k);
 const pref=JSON.parse(fs.readFileSync(PREF,"utf8"));assert.equal(pref.status,"PASS_CLEANUP_REQUIRED");assert.equal(pref.subject_sha,subject);assert.equal(pref.database_name,TARGET);assert.equal(pref.arm_observed,true,"WRITER_OWNER_CLEANUP_ARMED_PREFLIGHT_REQUIRED");assert.equal(pref.cleanup_authorized_observed,true,"WRITER_OWNER_CLEANUP_AUTHORIZED_PREFLIGHT_REQUIRED");assert.equal(pref.same_workflow_fresh_preflight_required,true,"WRITER_OWNER_CLEANUP_FRESH_PREFLIGHT_CONTRACT_REQUIRED");assert.equal(pref.preflight_subject_binding,"CURRENT_WORKFLOW_SUBJECT_SHA","WRITER_OWNER_CLEANUP_PREFLIGHT_BINDING_MISMATCH");
 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed);const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 assert.equal(q(url,"SELECT current_user"),"neondb_owner","WRITER_OWNER_CLEANUP_CURRENT_USER_DRIFT");
 const before=memberships(url);assert.deepEqual(before,pref.writer_owner_memberships,"WRITER_OWNER_CLEANUP_MEMBERSHIP_PRESTATE_DRIFT");
 const rowsBefore=Number(pref.total_application_rows);assert.equal(rowsBefore,0);
 const tableAclBefore=publicTableAcl(url),routineAclBefore=publicRoutineAcl(url),schemaAclBefore=publicSchemaAcl(url);
 const loginRolesBefore=serviceLoginRoles(url),loginMembershipsBefore=serviceLoginMemberships(url);
 assert.deepEqual(loginMembershipsBefore,pref.service_login_memberships,"WRITER_OWNER_CLEANUP_SERVICE_LOGIN_MEMBERSHIP_PRESTATE_DRIFT");
 assert.equal(loginRolesBefore.length,2,"WRITER_OWNER_CLEANUP_EXACT_TWO_LOGIN_ROLES_PRESTATE");
 assert.equal(serviceLoginOwnedObjects(url),0,"WRITER_OWNER_CLEANUP_SERVICE_LOGIN_OWNERSHIP_PRESTATE");
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
 for(const t of ["external_evidence_producer_lease_v1","external_evidence_supply_event_v1","external_evidence_supply_cursor_v1"])assert.deepEqual(matrix(url,t),[false,false,false,false],"WRITER_OWNER_CLEANUP_EXACT_NINE_MUST_REMAIN_MISSING:"+t);
 assert.deepEqual(publicTableAcl(url),tableAclBefore,"WRITER_OWNER_CLEANUP_PUBLIC_TABLE_ACL_MUST_NOT_CHANGE");
 assert.deepEqual(publicRoutineAcl(url),routineAclBefore,"WRITER_OWNER_CLEANUP_PUBLIC_FUNCTION_ACL_MUST_NOT_CHANGE");
 assert.equal(publicSchemaAcl(url),schemaAclBefore,"WRITER_OWNER_CLEANUP_PUBLIC_SCHEMA_ACL_MUST_NOT_CHANGE");
 assert.deepEqual(serviceLoginRoles(url),loginRolesBefore,"WRITER_OWNER_CLEANUP_SERVICE_LOGIN_ROLE_ATTRIBUTES_MUST_NOT_CHANGE");
 assert.deepEqual(serviceLoginMemberships(url),loginMembershipsBefore,"WRITER_OWNER_CLEANUP_SERVICE_LOGIN_MEMBERSHIPS_MUST_NOT_CHANGE");
 assert.equal(serviceLoginOwnedObjects(url),0,"WRITER_OWNER_CLEANUP_SERVICE_LOGIN_OWNERSHIP_MUST_REMAIN_ZERO");
 const tableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);let rowsAfter=0;for(const t of tableNames)rowsAfter+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(rowsAfter,rowsBefore,"WRITER_OWNER_CLEANUP_ROW_COUNT_MUST_NOT_CHANGE");
 write({schema_version:"geox_mcft_cap09_production_writer_owner_self_grant_cleanup_v1",status:"PASS_CLEANUP_APPLIED",subject_sha:subject,database_name:TARGET,before_memberships:before,after_memberships:after,total_rows_before:rowsBefore,total_rows_after:rowsAfter,public_table_acl_unchanged:true,public_function_acl_unchanged:true,public_schema_acl_unchanged:true,service_login_role_attributes_unchanged:true,service_login_memberships_unchanged:true,service_login_object_ownership_zero:true,exact_nine_privileges_still_missing:true,database_mutation:true,membership_mutation:true,exact_membership_revoke_only:true,row_mutation:false,schema_mutation:false,table_acl_mutation:false,function_acl_mutation:false,role_attribute_mutation:false,credential_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
