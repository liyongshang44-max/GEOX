#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-KBS-BASELINE-POINTER-SCHEMA-REMEDIATION-AUTHORITY-V1.json"),ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_ARM_V1.json");
const PREF=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_KBS_BASELINE_POINTER_SCHEMA_REMEDIATION_V1_RESULT.json");
const MIG=path.join(ROOT,"apps/server/db/migrations/2026_09_01_mcft_cap_09_kbs_publication_baseline_pointer.sql");
const COLUMNS=["kbs_raw_hourly_baseline_ref","kbs_raw_hourly_baseline_digest","kbs_raw_hourly_baseline_manifest_bytes","kbs_raw_hourly_baseline_latest_event_time","kbs_raw_hourly_baseline_stored_at","kbs_raw_hourly_baseline_writer_owner","kbs_raw_hourly_baseline_writer_fencing_token","kbs_raw_hourly_baseline_advanced_at"],CONSTRAINTS=["external_evidence_producer_lease_v1_kbs_baseline_all_or_none","external_evidence_producer_lease_v1_kbs_baseline_digest","external_evidence_producer_lease_v1_kbs_baseline_ref","external_evidence_producer_lease_v1_kbs_baseline_bytes","external_evidence_producer_lease_v1_kbs_baseline_latest_hour","external_evidence_producer_lease_v1_kbs_baseline_writer_fence","external_evidence_producer_lease_v1_kbs_baseline_chronology"];
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const sqlList=a=>a.map(v=>"'"+v.replaceAll("'","''")+"'").join(",");
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/,"KBS_POINTER_SCHEMA_RUNNER_SUBJECT_REQUIRED");
 const authority=j(AUTH),arm=j(ARM),pref=j(PREF);
 const armAuthorized=arm.production_kbs_baseline_pointer_schema_remediation_authorized===true;
 const authorityAuthorized=authority.authorization.production_kbs_baseline_pointer_schema_remediation_authorized===true;
 assert.equal(armAuthorized,arm.armed===true,"KBS_POINTER_SCHEMA_RUNNER_ARM_COHERENCE_REQUIRED");
 assert.equal(authorityAuthorized,armAuthorized,"KBS_POINTER_SCHEMA_RUNNER_AUTHORITY_ARM_MISMATCH");
 if(arm.armed!==true){
  assert.equal(armAuthorized,false);assert.equal(authority.status,"READY_NOT_AUTHORIZED");
  write({schema_version:"geox_mcft_cap09_production_kbs_baseline_pointer_schema_remediation_v1",status:"SKIPPED_NOT_ARMED",subject_sha:subject,database_mutation:false,row_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exit(0);
 }
 assert.equal(authority.status,"AUTHORIZED","KBS_POINTER_SCHEMA_AUTHORITY_STATUS_REQUIRED");
 assert.equal(arm.exact_target_database_name,TARGET);
 assert.equal(pref.status,"PASS_REMEDIATION_REQUIRED","KBS_POINTER_SCHEMA_FRESH_PREFLIGHT_REQUIRED");
 assert.equal(pref.subject_sha,subject,"KBS_POINTER_SCHEMA_PREFLIGHT_SUBJECT_MISMATCH");
 assert.equal(pref.database_name,TARGET);assert.equal(pref.table_count,41);assert.equal(pref.pointer_schema_absent,true);
 for(const k of ["runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"KBS_POINTER_SCHEMA_RUNNER_LATER_AUTHORITY_FORBIDDEN:"+k);

 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed,"KBS_POINTER_SCHEMA_RUNNER_SEED_URL_REQUIRED");
 const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 const beforeTables=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const beforeRows=Number(q(url,"SELECT count(*)::int FROM public.external_evidence_producer_lease_v1"));
 const beforeRoles=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_roles"));
 assert.equal(beforeTables,41);
 cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-f",MIG],{stdio:"inherit"});
 const afterTables=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const afterRows=Number(q(url,"SELECT count(*)::int FROM public.external_evidence_producer_lease_v1"));
 const afterRoles=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_roles"));
 const columns=q(url,"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='external_evidence_producer_lease_v1' AND column_name=ANY(ARRAY["+sqlList(COLUMNS)+"]::text[]) ORDER BY column_name").split(/\r?\n/).filter(Boolean);
 const constraints=q(url,"SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname=ANY(ARRAY["+sqlList(CONSTRAINTS)+"]::text[]) ORDER BY conname").split(/\r?\n/).filter(Boolean);
 assert.equal(afterTables,41,"KBS_POINTER_SCHEMA_TABLE_COUNT_CHANGED");assert.equal(afterRows,beforeRows,"KBS_POINTER_SCHEMA_ROW_COUNT_CHANGED");assert.equal(afterRoles,beforeRoles,"KBS_POINTER_SCHEMA_ROLE_COUNT_CHANGED");
 assert.deepEqual(columns,[...COLUMNS].sort(),"KBS_POINTER_SCHEMA_COLUMNS_NOT_EXACT");assert.deepEqual(constraints,[...CONSTRAINTS].sort(),"KBS_POINTER_SCHEMA_CONSTRAINTS_NOT_EXACT");
 write({schema_version:"geox_mcft_cap09_production_kbs_baseline_pointer_schema_remediation_v1",status:"PASS_REMEDIATION_APPLIED",subject_sha:subject,database_name:TARGET,table_count_before:beforeTables,table_count_after:afterTables,lease_row_count_before:beforeRows,lease_row_count_after:afterRows,role_count_before:beforeRoles,role_count_after:afterRoles,pointer_columns:columns,pointer_constraints:constraints,database_mutation:true,schema_mutation:true,row_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
