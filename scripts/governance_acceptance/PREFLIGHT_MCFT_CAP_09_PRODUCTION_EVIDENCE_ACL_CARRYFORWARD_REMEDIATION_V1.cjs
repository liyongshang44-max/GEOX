#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACL-CARRYFORWARD-REMEDIATION-AUTHORITY-V1.json"),ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_ACL_CARRYFORWARD_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const b=v=>v==="t";
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
function matrix(url,table,role){
 return q(url,[
  "SELECT",
  "has_table_privilege('"+role+"','public."+table+"','SELECT')::text,",
  "has_table_privilege('"+role+"','public."+table+"','INSERT')::text,",
  "has_table_privilege('"+role+"','public."+table+"','UPDATE')::text,",
  "has_table_privilege('"+role+"','public."+table+"','DELETE')::text"
 ].join("\n")).split("|").map(b);
}
try{
 const subject=String(process.env.SUBJECT_SHA||"");
 assert.match(subject,/^[0-9a-f]{40}$/,"ACL_REMEDIATION_SUBJECT_REQUIRED");
 const seed=String(process.env.SEED_DATABASE_URL||"").trim(); assert.ok(seed,"ACL_REMEDIATION_SEED_URL_REQUIRED");
 const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 const a=j(AUTH),arm=j(ARM);
 assert.equal(a.status,"REMEDIATION_REQUIRED_NOT_AUTHORIZED");
 assert.equal(a.target.database_name,TARGET);
 assert.equal(arm.runtime_process_start_authorized,false);
 assert.equal(arm.production_owner_activation_authorized,false);
 assert.equal(arm.formal_v5_arm_authorized,false);
 assert.equal(arm.a0_authorized,false);
 assert.equal(arm.o00_authorized,false);

 const db=q(url,"SELECT current_database()");assert.equal(db,TARGET,"ACL_REMEDIATION_DATABASE_MISMATCH");
 const tableCount=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const routineCount=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"));
 assert.equal(tableCount,41,"ACL_REMEDIATION_EXACT_41_TABLES_REQUIRED");
 assert.equal(routineCount,3,"ACL_REMEDIATION_EXACT_3_ROUTINES_REQUIRED");
 const tableNames=q(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name").split(/\r?\n/).filter(Boolean);
 let totalRows=0;for(const t of tableNames)totalRows+=Number(q(url,'SELECT count(*)::int FROM public."'+t.replaceAll('"','""')+'"'));
 assert.equal(totalRows,0,"ACL_REMEDIATION_ALL_ROWS_MUST_BE_ZERO");

 const role="geox_mcft_cap09_evidence_runtime_v1";
 const phase3Tables=a.authorized_mutation_scope.tables;
 const v13Tables=a.required_preexisting_unchanged_surface.v13_coordination_tables;
 const observed={}; const missing=[]; const unsafe=[];
 for(const t of [...phase3Tables,...v13Tables]){
   const m=matrix(url,t,role); observed[t]={select:m[0],insert:m[1],update:m[2],delete:m[3]};
   if(m[3])unsafe.push(t+":DELETE");
   if(phase3Tables.includes(t)){
     for(const [i,p] of [[0,"SELECT"],[1,"INSERT"],[2,"UPDATE"]])if(!m[i])missing.push(t+":"+p);
   }else if(JSON.stringify(m)!==JSON.stringify([true,true,true,false]))unsafe.push(t+":V13_MATRIX_DRIFT");
 }
 const facts=matrix(url,"facts",role);observed.facts={select:facts[0],insert:facts[1],update:facts[2],delete:facts[3]};
 if(JSON.stringify(facts)!==JSON.stringify([true,false,false,false]))unsafe.push("facts:MATRIX_DRIFT");
 const fn=b(q(url,"SELECT has_function_privilege('geox_mcft_cap09_evidence_runtime_v1','public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)','EXECUTE')::text"));
 if(!fn)unsafe.push("phase3_append_function:EXECUTE_MISSING");

 const loginRows=q(url,[
  "SELECT member.rolname||'>'||granted.rolname",
  "FROM pg_catalog.pg_auth_members m",
  "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
  "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
  "WHERE member.rolname IN ('geox_mcft_cap09_evidence_runtime_login_v1','geox_mcft_cap09_twin_runtime_login_v1')",
  "ORDER BY member.rolname,granted.rolname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);
 assert.deepEqual(loginRows,[
  "geox_mcft_cap09_evidence_runtime_login_v1>geox_mcft_cap09_evidence_runtime_v1",
  "geox_mcft_cap09_twin_runtime_login_v1>geox_mcft_cap09_twin_runtime_v1"
 ],"ACL_REMEDIATION_LOGIN_MEMBERSHIP_DRIFT");

 const currentUser=q(url,"SELECT current_user");
 const currentRole=q(url,[
  "SELECT rolname,rolcreaterole::text,rolcreatedb::text,rolsuper::text,rolinherit::text",
  "FROM pg_catalog.pg_roles WHERE rolname=current_user"
 ].join("\n")).split("|");
 const neonCaps=q(url,[
  "SELECT",
  "pg_catalog.pg_has_role(current_user,'neon_superuser','MEMBER')::text,",
  "pg_catalog.pg_has_role(current_user,'neon_superuser','SET')::text"
 ].join("\n")).split("|").map(b);

 const writerOwnerMembershipRows=q(url,[
  "SELECT granted.rolname||'|admin='||m.admin_option::text||'|inherit='||m.inherit_option::text||'|set='||m.set_option::text||'|grantor='||pg_catalog.pg_get_userbyid(m.grantor)",
  "FROM pg_catalog.pg_auth_members m",
  "JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid",
  "JOIN pg_catalog.pg_roles member ON member.oid=m.member",
  "WHERE member.rolname=current_user",
  "AND granted.rolname IN ('geox_mcft_cap09_evidence_writer_owner_v1','geox_mcft_cap09_forcing_writer_owner_v1','geox_mcft_cap09_twin_writer_owner_v1')",
  "ORDER BY granted.rolname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);

 const objectOwners={};
 for(const t of ["facts",...phase3Tables,...v13Tables]){
  objectOwners["table:"+t]=q(url,[
   "SELECT owner_role.rolname",
   "FROM pg_catalog.pg_class c",
   "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace",
   "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner",
   "WHERE n.nspname='public' AND c.relname='"+t+"'"
  ].join("\n"));
 }
 for(const fnName of [
  "mcft_cap09_evidence_runtime_append_fact_v1",
  "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
  "mcft_cap09_twin_runtime_append_fact_v1"
 ]){
  objectOwners["function:"+fnName]=q(url,[
   "SELECT owner_role.rolname",
   "FROM pg_catalog.pg_proc p",
   "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace",
   "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner",
   "WHERE n.nspname='public' AND p.proname='"+fnName+"'"
  ].join("\n"));
 }

 const tableAclRows=q(url,[
  "SELECT c.relname||'|owner='||owner_role.rolname||'|acl='||COALESCE(c.relacl::text,'<null>')",
  "FROM pg_catalog.pg_class c",
  "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace",
  "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner",
  "WHERE n.nspname='public'",
  "AND c.relname IN ('facts','external_evidence_producer_lease_v1','external_evidence_supply_event_v1','external_evidence_supply_cursor_v1','twin_external_formal_forcing_base_cursor_v1','twin_external_formal_forcing_base_target_v1','twin_external_formal_forcing_controller_lease_v1')",
  "ORDER BY c.relname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);

 const routineAclRows=q(url,[
  "SELECT p.proname||'|owner='||owner_role.rolname||'|acl='||COALESCE(p.proacl::text,'<null>')",
  "FROM pg_catalog.pg_proc p",
  "JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace",
  "JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=p.proowner",
  "WHERE n.nspname='public'",
  "AND p.proname IN ('mcft_cap09_evidence_runtime_append_fact_v1','mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1','mcft_cap09_twin_runtime_append_fact_v1')",
  "ORDER BY p.proname"
 ].join("\n")).split(/\r?\n/).filter(Boolean);

 const ownerSetCapabilities={};
 for(const roleName of [
  "geox_mcft_cap09_evidence_writer_owner_v1",
  "geox_mcft_cap09_forcing_writer_owner_v1",
  "geox_mcft_cap09_twin_writer_owner_v1"
 ]){
  ownerSetCapabilities[roleName]={
   member:b(q(url,"SELECT pg_catalog.pg_has_role(current_user,'"+roleName+"','MEMBER')::text")),
   set:b(q(url,"SELECT pg_catalog.pg_has_role(current_user,'"+roleName+"','SET')::text"))
  };
 }

 const diagnostics=[];
 if(JSON.stringify(facts)!==JSON.stringify([true,false,false,false]))diagnostics.push("facts:MATRIX_DRIFT");
 if(!fn)diagnostics.push("phase3_append_function:EXECUTE_MISSING");
 for(const t of v13Tables){
  const m=matrix(url,t,role);
  if(JSON.stringify(m)!==JSON.stringify([true,true,true,false]))diagnostics.push(t+":V13_MATRIX_DRIFT");
 }
 for(const t of phase3Tables){
  const m=matrix(url,t,role);
  if(JSON.stringify(m)!==JSON.stringify([true,true,true,false]))diagnostics.push(t+":PHASE3_MATRIX_DRIFT");
 }

 const status=diagnostics.length?"PASS_DIAGNOSTIC_REMEDIATION_REQUIRED":"PASS_ALREADY_MATERIALIZED";

 write({
  schema_version:"geox_mcft_cap09_production_evidence_acl_carryforward_remediation_preflight_v1",
  status,subject_sha:subject,database_name:TARGET,current_user:currentUser,
  table_count:tableCount,routine_count:routineCount,total_application_rows:totalRows,
  observed_acl:observed,phase3_append_function_execute:fn,
  missing_privileges:missing,diagnostics,
  exact_login_memberships:loginRows,
  current_role:{
    rolname:currentRole[0]||null,
    rolcreaterole:b(currentRole[1]),
    rolcreatedb:b(currentRole[2]),
    rolsuper:b(currentRole[3]),
    rolinherit:b(currentRole[4])
  },
  neon_superuser_member:neonCaps[0]||false,
  neon_superuser_set:neonCaps[1]||false,
  writer_owner_memberships:writerOwnerMembershipRows,
  writer_owner_set_capabilities:ownerSetCapabilities,
  object_owners:objectOwners,
  table_acl_rows:tableAclRows,
  routine_acl_rows:routineAclRows,
  arm_observed:arm.armed===true,
  database_mutation:false,row_mutation:false,schema_mutation:false,role_mutation:false,
  runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false
 });
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),database_mutation:false,row_mutation:false,schema_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
