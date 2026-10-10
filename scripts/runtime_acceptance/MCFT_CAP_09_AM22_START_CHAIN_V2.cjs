"use strict";
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const {LEGACY,TABLES,digest,fileDigest,assertArmNotRetired}=require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const {verifyCandidateFiles}=require("./VERIFY_MCFT_CAP_09_AM22_START_CANDIDATE_V2.cjs");
const {validateQualifiedEnvelope}=require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const {loadExecutionQualification}=require("./MCFT_CAP_09_AM22_EXECUTION_QUALIFICATION_V2.cjs");
const ROOT=path.resolve(__dirname,"../..");
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json";
const req=(ok,code)=>{if(!ok)throw new Error("AM22_CHAIN_"+code);};
const json=file=>JSON.parse(fs.readFileSync(file,"utf8"));
function effectivePolicy(){
 const p=json(path.join(ROOT,POLICY));
 req(p.schema_version==="geox_mcft_cap09_am22_effective_start_authority_v2"&&p.status==="EFFECTIVE_ON_PROTECTED_MAIN","EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED");
 for(const key of ["production_start_authorized","formal_v5_arm_authorized","a0_authorized","complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified"])req(p[key]===true,"EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED");
 req(p.mcft_cap09_completed===false,"PREMATURE_COMPLETION_FORBIDDEN");
 return p;
}
function immutable(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const bytes=JSON.stringify(value,null,2)+"\n";
 if(fs.existsSync(file)){req(fs.readFileSync(file,"utf8")===bytes,"IMMUTABLE_ARTIFACT_CONFLICT");return;}
 fs.writeFileSync(file,bytes,{flag:"wx",mode:0o600});
}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();}
function exactMain(subject){
 git("fetch","--no-tags","origin","main");
 req(git("rev-parse","HEAD")===subject&&git("rev-parse","origin/main")===subject,"EXACT_CURRENT_MAIN_REQUIRED");
 req(git("status","--porcelain")==="","CLEAN_WORKTREE_REQUIRED");
}
function readOnlyStore(){
 const url=process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL;
 req(Boolean(url),"FORMAL_DATABASE_URL_REQUIRED");
 req(decodeURIComponent(new URL(url).pathname.slice(1))===LEGACY.database,"FORMAL_DATABASE_IDENTITY_REQUIRED");
 const sql="BEGIN READ ONLY; SELECT current_database(),current_setting('transaction_read_only'),clock_timestamp(); SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name; SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname; COMMIT;";
 let lines;
 try{lines=cp.execFileSync("psql",["-X","-qAt","-F","|","-v","ON_ERROR_STOP=1","-c",sql],{cwd:ROOT,encoding:"utf8",timeout:30000,stdio:["ignore","pipe","pipe"],env:{...process.env,PGDATABASE:url,PGCONNECT_TIMEOUT:"10",PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=15000"}}).trim().split(/\r?\n/);}catch{throw new Error("AM22_CHAIN_READ_ONLY_STORE_QUERY_FAILED");}
 const [db,ro,now]=lines.shift().split("|");
 req(db===LEGACY.database&&ro==="on","READ_ONLY_FORMAL_DATABASE_REQUIRED");
 const routines=["mcft_cap09_twin_runtime_append_fact_v1","mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1"].sort();
 req(JSON.stringify(lines.slice(0,29))===JSON.stringify(TABLES)&&JSON.stringify(lines.slice(29))===JSON.stringify(routines),"EXACT_MATERIALIZED_SCHEMA_REQUIRED");
 const rowSql="BEGIN READ ONLY; "+TABLES.map(t=>`SELECT '${t}',count(*)::bigint FROM public."${t}";`).join(" ")+" COMMIT;";
 let counts;
 try{counts=cp.execFileSync("psql",["-X","-qAt","-F","|","-v","ON_ERROR_STOP=1","-c",rowSql],{cwd:ROOT,encoding:"utf8",timeout:30000,stdio:["ignore","pipe","pipe"],env:{...process.env,PGDATABASE:url,PGCONNECT_TIMEOUT:"10",PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=15000"}}).trim().split(/\r?\n/).map(x=>{const [table_name,n]=x.split("|");return {table_name,row_count:Number(n)};});}catch{throw new Error("AM22_CHAIN_READ_ONLY_ROW_QUERY_FAILED");}
 req(counts.length===29&&counts.every(x=>x.row_count===0),"WHOLE_FORMAL_STORE_ZERO_REQUIRED");
 return {database_now_utc:new Date(now).toISOString(),formal_database_name:db,transaction_read_only:true,public_base_table_count:29,public_routine_count:2,all_table_rows_zero:true,formal_tables:counts};
}
function databaseNow(){
 const url=process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL;
 req(Boolean(url)&&decodeURIComponent(new URL(url).pathname.slice(1))===LEGACY.database,"FORMAL_DATABASE_URL_REQUIRED");
 try{return new Date(cp.execFileSync("psql",["-X","-qAt","-v","ON_ERROR_STOP=1","-c","SELECT clock_timestamp();"],{cwd:ROOT,encoding:"utf8",timeout:15000,stdio:["ignore","pipe","pipe"],env:{...process.env,PGDATABASE:url,PGCONNECT_TIMEOUT:"10",PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=10000"}}).trim()).toISOString();}catch{throw new Error("AM22_CHAIN_DATABASE_CLOCK_READ_FAILED");}
}
function candidate(input,now){
 const policy=loadExecutionQualification(effectivePolicy(),input,now);
 const result=verifyCandidateFiles({...input,policy,database_now_utc:now});
 exactMain(result.subject_sha);
 const image=cp.execFileSync("docker",["image","inspect","--format","{{.Id}}",`geox-mcft-cap09-runtime:${result.subject_sha}`],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
 req(image===result.image_id,"QUALIFIED_IMMUTABLE_IMAGE_REQUIRED");
 return result;
}
function fixedWindow(arm,input,now,mode){
 const policy=loadExecutionQualification(effectivePolicy(),input,now);
 assertArmNotRetired(arm,input.retirement_directory);
 const {arm_identity_hash,...body}=arm;
 req(digest(body)===arm_identity_hash,"ARM_IMMUTABLE_IDENTITY_MISMATCH");
 req(arm.arm_issuer==="AM22_V2"&&arm.subject_sha===input.binding.subject_sha&&policy.qualified_subject_sha===arm.subject_sha&&policy.qualified_image_id===input.binding.image_id&&policy.qualified_host_id===input.binding.host_id,"ARM_EXECUTION_BINDING_MISMATCH");
 req(arm.current_crop_authority_sha256===policy.approved_current_crop_authority_sha256&&fileDigest(input.current_crop_authority_file)===arm.current_crop_authority_sha256,"CURRENT_STAGE_BYTES_CHANGED");
 req(fileDigest(input.qualified_envelope_file)===policy.qualified_envelope_sha256,"PREPARATION_ENVELOPE_BYTES_CHANGED");
 const stage=json(input.current_crop_authority_file),envelope=json(input.qualified_envelope_file);
 const frozenCandidate=verifyCandidateFiles({...input,policy,database_now_utc:arm.clock_selection_database_utc});
 req(frozenCandidate.clock.a0===arm.a0&&frozenCandidate.clock.o00===arm.o00&&frozenCandidate.clock.o23===arm.o23,"CANDIDATE_CLOCK_CHANGED");
 validateQualifiedEnvelope(envelope,input.binding,Date.parse(now));
 req(stage.architecture_effective===true&&stage.runtime_consumption_authorized===true&&Date.parse(stage.graduation?.graduated_at)<=Date.parse(now),"EFFECTIVE_STAGE_REQUIRED");
 req(Date.parse(stage.biological_stage?.authority_as_of)<=Date.parse(now)&&Date.parse(stage.biological_stage?.authority_valid_until)>=Date.parse(arm.o23)&&Date.parse(stage.lifecycle?.horizon_end_utc)>=Date.parse(arm.o23),"FULL_24T_STAGE_COVERAGE_REQUIRED");
 req(Date.parse(arm.o00)-Date.parse(arm.a0)===3600000&&Date.parse(arm.o23)-Date.parse(arm.o00)===23*3600000,"FIXED_24T_CLOCK_INVALID");
 req(Date.parse(now)>=Date.parse(arm.arm_time_database_utc),"DATABASE_CLOCK_REGRESSION");
 if(mode==="PREPARE")req(Date.parse(now)<Date.parse(arm.a0),"PREPARATION_DEADLINE_MISSED");
 else req(mode==="A0"&&Date.parse(now)>=Date.parse(arm.a0)&&Date.parse(now)+900000<Date.parse(arm.o00),"A0_EXECUTION_WINDOW_REQUIRED");
 exactMain(arm.subject_sha);
 return {status:"PASS",arm_identity_hash,checked_at_database_utc:now,mode};
}
function buildArm(c,store,handoff,h5,now){
 req(h5.status==="PASS"&&h5.deployment_subject_sha===c.subject_sha&&h5.formal_v5_arm_ready===true&&h5.exact_one_live_fenced_owner_per_runtime_role_reverified===true,"FRESH_H5_REQUIRED");
 req(handoff.schema_version==="geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2"&&handoff.deployment_subject_sha===c.subject_sha&&handoff.formal_a0_logical_time===c.clock.a0&&handoff.formal_o00_logical_time===c.clock.o00&&handoff.formal_o23_logical_time===c.clock.o23,"V2_HANDOFF_CLOCK_MISMATCH");
 req(store.transaction_read_only===true&&store.formal_database_name===LEGACY.database&&store.all_table_rows_zero===true&&store.public_base_table_count===29&&store.public_routine_count===2,"FRESH_PRISTINE_STORE_REQUIRED");
 req(Date.parse(now)>=Date.parse(handoff.activation_fence_time)&&Math.floor(Date.parse(now)/3600000)===Math.floor(Date.parse(handoff.activation_fence_time)/3600000)&&Date.parse(now)<Date.parse(c.clock.a0),"SAME_UTC_HOUR_CUTOVER_ARM_REQUIRED");
 const body={schema_version:"geox_mcft_cap09_formal_v5_arm_v1",status:"PASS",arm_issuer:"AM22_V2",runtime_dto_compatibility:"FROZEN_V1_ARM_DTO_WITH_EXPLICIT_V2_ISSUER",subject_sha:c.subject_sha,formal_database_name:LEGACY.database,arm_time_database_utc:now,clock_selection_database_utc:c.clock.database_now_utc,epoch_id:c.epoch_id,manifest_ref:`formal-arm://mcft-cap09/formal-v5/${c.epoch_id}/${LEGACY.database}`,a0:c.clock.a0,o00:c.clock.o00,o23:c.clock.o23,readiness_deadline:c.clock.a0,current_crop_authority_sha256:c.current_crop_authority_sha256,qualified_envelope_sha256:c.qualified_envelope_sha256,retirement_receipt_sha256:c.retirement_receipt_sha256,handoff_sha256:digest(handoff),h5_sha256:digest(h5),fixed_36_hour_lead_used:false,formal_v5_arm:true,formal_v5_epoch_selected:true,formal_database_mutation:false,schema_materialization:false,a0_bootstrap:false,o00_started:false,provider_request_count:0,final_actual_24h_still_required:true,mcft_cap09_completed:false};
 const arm={...body,arm_identity_hash:digest(body)};assertArmNotRetired(arm);return arm;
}
function verifyOwnerBinding(owner,binding){
 req(owner.status==="PASS"&&owner.subject_main_sha===binding.subject_sha&&owner.actual_host_id===binding.host_id&&owner.authorized_image_id===binding.image_id&&Array.isArray(owner.blockers)&&owner.blockers.length===0,"LIVE_OWNER_EXECUTION_BINDING_MISMATCH");
 for(const role of ["evidence_runtime","twin_runtime_scheduler"]){
  req(owner[role]?.renewal?.status==="PASS"&&owner[role].renewal.same_effective_owner===true&&owner[role].renewal.same_container_instance===true&&owner[role].renewal.same_image_id===true,"LIVE_OWNER_RENEWAL_REQUIRED");
  for(const t of ["t1","t2"])req(owner[role][t]?.status==="PASS"&&owner[role][t].container_running===true&&owner[role][t].container_image_id===binding.image_id&&owner[role][t].expected_host_id===binding.host_id,"LIVE_OWNER_CONTAINER_IMAGE_REQUIRED");
 }
 return owner;
}
module.exports={ROOT,POLICY,req,json,effectivePolicy,immutable,exactMain,readOnlyStore,databaseNow,candidate,fixedWindow,buildArm,verifyOwnerBinding};
