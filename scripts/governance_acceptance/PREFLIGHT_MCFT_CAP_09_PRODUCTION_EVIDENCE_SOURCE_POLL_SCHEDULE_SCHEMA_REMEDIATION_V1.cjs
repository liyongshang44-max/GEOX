#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const ROOT=process.cwd(),TARGET="geox_mcft_cap09_production_runtime_v1";
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-SOURCE-POLL-SCHEDULE-SCHEMA-REMEDIATION-AUTHORITY-V1.json"),ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_POLL_SCHEDULE_SCHEMA_REMEDIATION_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_POLL_SCHEDULE_SCHEMA_REMEDIATION_PREFLIGHT_V1_RESULT.json");
const COLUMNS=["kbs_raw_hourly_poll_last_started_at","kbs_raw_hourly_poll_next_eligible_at","kbs_raw_hourly_poll_writer_owner","kbs_raw_hourly_poll_writer_fencing_token","kbs_soil_poll_last_started_at","kbs_soil_poll_next_eligible_at","kbs_soil_poll_writer_owner","kbs_soil_poll_writer_fencing_token","gfs_poll_target_logical_time","gfs_poll_attempt_count","gfs_poll_last_started_at","gfs_poll_next_eligible_at","gfs_poll_writer_owner","gfs_poll_writer_fencing_token"],CONSTRAINTS=["external_evidence_producer_lease_v1_kbs_raw_poll_all_or_none","external_evidence_producer_lease_v1_kbs_raw_poll_chronology","external_evidence_producer_lease_v1_kbs_raw_poll_fence","external_evidence_producer_lease_v1_kbs_soil_poll_all_or_none","external_evidence_producer_lease_v1_kbs_soil_poll_chronology","external_evidence_producer_lease_v1_kbs_soil_poll_fence","external_evidence_producer_lease_v1_gfs_poll_all_or_none","external_evidence_producer_lease_v1_gfs_poll_attempt_budget","external_evidence_producer_lease_v1_gfs_poll_target_hour","external_evidence_producer_lease_v1_gfs_poll_chronology","external_evidence_producer_lease_v1_gfs_poll_fence"];
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const q=(url,sql)=>cp.execFileSync("psql",[url,"-X","-v","ON_ERROR_STOP=1","-AtF","|","-c",sql],{encoding:"utf8"}).trim();
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const sqlList=a=>a.map(v=>"\'"+v.replaceAll("\'","\'\'")+"\'").join(",");
try{
 const subject=String(process.env.SUBJECT_SHA||"");assert.match(subject,/^[0-9a-f]{40}$/,"SOURCE_POLL_SCHEMA_PREFLIGHT_SUBJECT_REQUIRED");
 const seed=String(process.env.SEED_DATABASE_URL||"").trim();assert.ok(seed,"SOURCE_POLL_SCHEMA_PREFLIGHT_SEED_URL_REQUIRED");
 const authority=j(AUTH),arm=j(ARM);
 const armAuthorized=arm.production_evidence_source_poll_schedule_schema_remediation_authorized===true;
 const authorityAuthorized=authority.authorization.production_evidence_source_poll_schedule_schema_remediation_authorized===true;
 assert.equal(armAuthorized,arm.armed===true,"SOURCE_POLL_SCHEMA_ARM_AUTHORIZATION_COHERENCE_REQUIRED");
 assert.equal(authorityAuthorized,armAuthorized,"SOURCE_POLL_SCHEMA_AUTHORITY_ARM_MISMATCH");
 assert.equal(authority.target.database_name,TARGET);
 assert.equal(authority.target.expected_table_count,41);
 assert.equal(authority.target.expected_routine_count,3);
 assert.equal(authority.target.new_table_count_authorized,0);
 assert.deepEqual(authority.target.expected_schedule_columns,COLUMNS);
 assert.deepEqual(authority.target.expected_schedule_constraints,CONSTRAINTS);
 assert.equal(arm.same_workflow_fresh_preflight_required,true);
 assert.equal(arm.preflight_subject_binding,"CURRENT_WORKFLOW_SUBJECT_SHA");
 if(arm.armed===true)assert.equal(arm.exact_target_database_name,TARGET);else assert.equal(arm.exact_target_database_name,null);
 for(const k of ["runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])assert.equal(arm[k],false,"SOURCE_POLL_SCHEMA_LATER_AUTHORITY_FORBIDDEN:"+k);

 const u=new URL(seed);u.pathname="/"+TARGET;const url=u.toString();
 assert.equal(q(url,"SELECT current_database()"),TARGET,"SOURCE_POLL_SCHEMA_DATABASE_MISMATCH");
 const currentUser=q(url,"SELECT current_user");
 const owner=q(url,["SELECT owner_role.rolname","FROM pg_catalog.pg_class c","JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace","JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner","WHERE n.nspname='public' AND c.relname='external_evidence_producer_lease_v1'"].join("\n"));
 assert.equal(owner,currentUser,"SOURCE_POLL_SCHEMA_TARGET_TABLE_OWNER_MUST_BE_CURRENT_USER");
 const tableCount=Number(q(url,"SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"));
 const routineCount=Number(q(url,"SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"));
 assert.equal(tableCount,41,"SOURCE_POLL_SCHEMA_EXACT_41_TABLES_REQUIRED");
 assert.equal(routineCount,3,"SOURCE_POLL_SCHEMA_EXACT_3_ROUTINES_REQUIRED");
 const observedColumns=q(url,"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='external_evidence_producer_lease_v1' AND column_name=ANY(ARRAY["+sqlList(COLUMNS)+"]::text[]) ORDER BY column_name").split(/\r?\n/).filter(Boolean);
 const observedConstraints=q(url,"SELECT conname FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname=ANY(ARRAY["+sqlList(CONSTRAINTS)+"]::text[]) ORDER BY conname").split(/\r?\n/).filter(Boolean);
 const expectedColumns=[...COLUMNS].sort(),expectedConstraints=[...CONSTRAINTS].sort();
 const absent=observedColumns.length===0&&observedConstraints.length===0;
 const complete=JSON.stringify(observedColumns)===JSON.stringify(expectedColumns)&&JSON.stringify(observedConstraints)===JSON.stringify(expectedConstraints);
 if(!absent&&!complete)throw new Error("SOURCE_POLL_SCHEMA_PARTIAL_STATE_FORBIDDEN:columns="+observedColumns.length+":constraints="+observedConstraints.length);
 if(arm.armed===true)assert.equal(absent,true,"SOURCE_POLL_SCHEMA_ARMED_ALREADY_MATERIALIZED_FORBIDDEN");
 const leaseRows=Number(q(url,"SELECT count(*)::int FROM public.external_evidence_producer_lease_v1"));
 write({schema_version:"geox_mcft_cap09_production_evidence_source_poll_schedule_schema_remediation_preflight_v1",status:absent?"PASS_REMEDIATION_REQUIRED":"PASS_ALREADY_MATERIALIZED",subject_sha:subject,database_name:TARGET,current_user:currentUser,target_table_owner:owner,table_count:tableCount,routine_count:routineCount,lease_row_count:leaseRows,observed_schedule_columns:observedColumns,observed_schedule_constraints:observedConstraints,schedule_schema_absent:absent,schedule_schema_complete:complete,arm_observed:arm.armed===true,remediation_authorized_observed:armAuthorized,authority_authorized_observed:authorityAuthorized,database_mutation:false,row_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
}catch(e){write({status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),database_mutation:false,row_mutation:false,role_mutation:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});process.exitCode=1;}
