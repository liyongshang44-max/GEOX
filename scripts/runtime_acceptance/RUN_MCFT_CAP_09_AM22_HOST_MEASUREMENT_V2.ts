import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import {Pool} from "pg";
import {probePrewrite} from "./MCFT_CAP_09_AM22_PREWRITE_PROBE_V2.js";
import {buildMcftCap09FormalV5ManifestFromStageAuthorityV1} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";
import {PostgresRuntimeRepositoryV1} from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {PostgresGfsCanonicalTargetPairHistoryV1} from "../../apps/server/src/persistence/external_evidence/postgres_gfs_target_pair_history_v1.js";
import {PostgresExternalEvidenceFactReplayProvenanceV1} from "../../apps/server/src/persistence/external_evidence/postgres_external_evidence_fact_replay_provenance_v1.js";
import {S3CompatiblePrivateRetainedRawReaderV1} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";
import {semanticHashV1} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {buildFrozenEvidenceWindowV1} from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import {MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type {CanonicalReplayEvidenceRecordV1} from "../../apps/server/src/runtime/twin_runtime/ports.js";
const requireCjs=createRequire(import.meta.url);
const m=requireCjs("./MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs");
const {SCOPE}=requireCjs("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const {TABLES,LEGACY,fileDigest,validateReceipt}=requireCjs("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const json=(file:string)=>JSON.parse(fs.readFileSync(file,"utf8"));
const rel=(file:string)=>path.join(m.ROOT,file);
const exec=(file:string,args:string[],env=process.env)=>execFileSync(file,args,{cwd:m.ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:180000,env}).trim();
const env=(name:string)=>{assert.ok(process.env[name],"AM22_MEASUREMENT_ENV_REQUIRED:"+name);return process.env[name]!;};
const arg=(name:string)=>process.argv.slice(2).find(x=>x.startsWith(name+"="))?.slice(name.length+1);
const readPool=(url:string,name:string)=>{assert.equal(decodeURIComponent(new URL(url).pathname.slice(1)),name);return new Pool({connectionString:url,max:1,options:"-c default_transaction_read_only=on -c statement_timeout=15000",connectionTimeoutMillis:15000,query_timeout:20000});};
async function now(pool:Pool){const row=(await pool.query("SELECT clock_timestamp() AS now,current_setting('default_transaction_read_only') AS ro")).rows[0];assert.equal(row.ro,"on");return new Date(row.now).toISOString();}
async function pristine(pool:Pool){
 const tables=(await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(x=>x.table_name);assert.deepEqual(tables,TABLES);
 const counts=[];for(const table of TABLES){const n=Number((await pool.query(`SELECT count(*) AS n FROM public."${table}"`)).rows[0].n);assert.equal(n,0,"AM22_MEASUREMENT_FORMAL_STORE_NOT_PRISTINE");counts.push({table,row_count:n});}return counts;
}
async function schema(pool:Pool){
 const databases=(await pool.query("SELECT datname FROM pg_database WHERE datallowconn AND datname NOT IN ('postgres','template1')")).rows;assert.equal(databases.length,1,"AM22_MEASUREMENT_EXCLUSIVE_QUALIFICATION_CLUSTER_REQUIRED");assert.match(databases[0].datname,/^am22_measure_[a-f0-9]{12}$/);
 assert.equal(Number((await pool.query("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0].n),0,"AM22_MEASUREMENT_FRESH_ISOLATED_DATABASE_REQUIRED");
 for(const file of ["docker/postgres/init/001_schema.sql","apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql","apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql","apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql","apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql","apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql","apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql","apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql","apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql"]){await pool.query(fs.readFileSync(rel(file),"utf8"));}
 await pool.query("CREATE ROLE geox_mcft_cap09_twin_runtime_v1 NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
 await pool.query(fs.readFileSync(rel("apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql"),"utf8"));
}
async function main(){
 assert.ok(!process.env.CI&&!process.env.GITHUB_ACTIONS,"AM22_MEASUREMENT_ACTUAL_LOCAL_HOST_REQUIRED");assert.ok(process.argv.includes("--operator-authorized"));
 assert.ok(arg("--input")&&arg("--out"));const input=json(path.resolve(arg("--input")!)),out=path.resolve(arg("--out")!);
 assert.deepEqual(Object.keys(input).sort(),["a0_planning_time","image_id","stage_ref","subject_sha"].sort(),"AM22_MEASUREMENT_NO_CALLER_AUTHORITY_OR_COMMANDS");
 assert.match(input.subject_sha,/^[a-f0-9]{40}$/);assert.match(input.image_id,/^sha256:[a-f0-9]{64}$/);
 assert.ok(!path.isAbsolute(input.stage_ref)&&!input.stage_ref.includes("..")&&!input.stage_ref.includes("\\"));
 assert.ok(!fs.existsSync(out),"AM22_MEASUREMENT_DISTINCT_OUTPUT_REQUIRED");fs.mkdirSync(out,{recursive:true});
 const localUrl=m.isolatedUrl(env("GEOX_MCFT_CAP09_MEASUREMENT_DATABASE_URL"));
 const source=readPool(env("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL"),"geox_mcft_cap09_production_runtime_v1");
 const formal=readPool(env("GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL"),LEGACY.database);
 const local=new Pool({connectionString:localUrl,max:1,connectionTimeoutMillis:15000,query_timeout:20000});
 const beforeOwners=()=>exec("docker",["ps","--filter","label=com.docker.compose.project=geox-mcft-cap09-production-v1","--format","{{.ID}} {{.Image}} {{.Names}}"]);
 let preserved="",stage:any,window:any,records:CanonicalReplayEvidenceRecordV1[]=[],facts:any[]=[],built:any,sourceNow="",baseline:any;
 const binding={subject_sha:input.subject_sha,host_id:LEGACY.host,image_id:input.image_id,preparation_profile_sha256:m.profileDigest()};
 const tasks={
  EXACT_MAIN_IMAGE_OWNER_REVALIDATION:async()=>{
   exec("git",["fetch","--no-tags","origin","main"]);assert.equal(exec("git",["rev-parse","HEAD"]),input.subject_sha);assert.equal(exec("git",["rev-parse","origin/main"]),input.subject_sha);assert.equal(exec("git",["status","--porcelain"]),"");
   assert.equal(fs.readFileSync(path.join(os.homedir(),".geox/mcft-cap09/local-host-id-v1"),"utf8").trim(),LEGACY.host);
   assert.equal(exec("docker",["image","inspect","--format","{{.Id}}","geox-mcft-cap09-runtime:"+input.subject_sha]),input.image_id);
   preserved=beforeOwners();assert.equal(preserved.split(/\r?\n/).length,2,"AM22_MEASUREMENT_EXACT_TWO_PRESERVED_OWNERS_REQUIRED");
   const attestationPath=env("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH"),attestation=json(attestationPath);assert.equal(attestation.status,"PASS");
   exec(process.execPath,[rel("scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs"),"--live"],{...process.env,GEOX_DEPLOYMENT_SUBJECT_COMMIT:attestation.subject_main_sha});
   baseline=json(rel("acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json"));assert.equal(baseline.status,"PASS");
   return {status:"PASS",candidate_image_id:input.image_id,preserved_deployed_subject_sha:baseline.subject_main_sha,preserved_deployed_image_id:baseline.authorized_image_id,live_owner_proof:baseline,candidate_image_owners_activated:false};
  },
  FRESH_STAGE_AND_CAUSAL_SEED_VISIBILITY:async()=>{
   sourceNow=await now(source);stage=json(rel(input.stage_ref));window=m.stageCoverage(stage,input.a0_planning_time,sourceNow);
   const registry=json(rel(REGISTRY)),entry=registry.entries.filter((x:any)=>Date.parse(x.authority_as_of)<=Date.parse(sourceNow)&&Date.parse(x.authority_valid_until)>=Date.parse(window.o23)).sort((a:any,b:any)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of))[0];assert.ok(entry,"AM22_MEASUREMENT_STAGE_NOT_ADOPTED");assert.equal(entry.authority_ref,input.stage_ref,"AM22_MEASUREMENT_LATEST_EFFECTIVE_STAGE_REQUIRED");assert.equal(entry.authority_sha256,fileDigest(rel(input.stage_ref)));assert.equal(entry.authority_as_of,stage.biological_stage.authority_as_of);assert.equal(entry.authority_valid_until,stage.biological_stage.authority_valid_until);
   const receiptFile=path.join(os.homedir(),".geox/mcft-cap09/formal-v5/arm-retirements-v1",LEGACY.identity.slice(7)+".json"),receipt=validateReceipt(json(receiptFile));assert.equal(receipt.receipt_sha256,"sha256:fcd39ed82ad8d471a4348b52451d12547a5d4d8a51e39b156e69567a67032167");
   assert.equal(fileDigest(path.join(path.dirname(receiptFile),"audit",LEGACY.identity.slice(7),"original-arm.json")),receipt.original_arm_file_sha256);
   const history=await new PostgresGfsCanonicalTargetPairHistoryV1(source,SCOPE).readGfsTargetPairHistory({scope:SCOPE,from_target_logical_time:window.a0});
   assert.ok(!history.partial_targets.some(x=>x.target_logical_time===window.a0));const pairs=history.pairs.filter(x=>x.target_logical_time===window.a0);assert.equal(pairs.length,1,"AM22_MEASUREMENT_EXACT_A0_GFS_PAIR_NOT_READY");
   const ids=[pairs[0].weather_fact_id,pairs[0].future_et0_fact_id];
   const rows=(await source.query("SELECT fact_id,record_json FROM public.facts WHERE source=$1 AND (fact_id=ANY($2::text[]) OR record_json->>'type'='soil_moisture_observation_v1') AND record_json#>>'{payload,tenant_id}'=$3 AND record_json#>>'{payload,project_id}'=$4 AND record_json#>>'{payload,group_id}'=$5 AND record_json#>>'{payload,field_id}'=$6 AND record_json#>>'{payload,season_id}'=$7 AND record_json#>>'{payload,zone_id}'=$8 ORDER BY fact_id",["mcft_cap09_external_formal_evidence_v1",ids,...Object.values(SCOPE)])).rows;
   const causal=rows.filter(row=>{const p=row.record_json.payload;return Date.parse(p.available_to_runtime_at)<=Date.parse(sourceNow)&&Date.parse(p.role_time.ingested_at)<=Date.parse(sourceNow);});
   const frozen=buildFrozenEvidenceWindowV1({scope:SCOPE,logical_time:window.a0,candidate_records:causal.map(x=>x.record_json.payload),authorized_soil_binding_id:MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1});
   const soil=causal.filter(x=>x.record_json.payload.source_record_id===frozen.assimilation_observation.source_record_id);assert.equal(soil.length,1);
   facts=[...ids.map(id=>{const matches=causal.filter(x=>x.fact_id===id);assert.equal(matches.length,1);return matches[0];}),soil[0]];records=facts.map(x=>x.record_json.payload);
   const replay=new PostgresExternalEvidenceFactReplayProvenanceV1(source),rawReader=new S3CompatiblePrivateRetainedRawReaderV1({endpoint:env("GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT"),bucket:env("GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET"),region:env("GEOX_MCFT_CAP09_EVIDENCE_S3_REGION"),access_key_id:env("GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID"),secret_access_key:env("GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY")});
   assert.equal(env("GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET"),"geox-mcft-cap09-evidence-runtime-v1");
   const proofs=[];for(const fact of facts){const p=fact.record_json.payload;const proof=await replay.readReplayProvenance({scope:SCOPE,fact_id:fact.fact_id,record_semantic_sha256:semanticHashV1(p),record_type:p.record_type,binding_id:p.binding_id,origin_source_id:p.origin_source_id,source_record_id:p.source_record_id});const raw=await rawReader.readRetainedRawEvidence({retention_ref:proof.raw_provenance.retention_ref,retained_sha256:proof.raw_provenance.raw_sha256,retained_bytes:proof.raw_provenance.raw_bytes});assert.equal(raw.retained_at,proof.raw_provenance.retained_at);proofs.push({fact_id:fact.fact_id,record_sha256:semanticHashV1(p),raw_sha256:raw.retained_sha256,raw_bytes:raw.retained_bytes});}assert.equal(proofs[0].raw_sha256,proofs[1].raw_sha256,"AM22_MEASUREMENT_SAME_GFS_RAW_BUNDLE_REQUIRED");
   return {status:"PASS",...window,current_crop_authority_sha256:fileDigest(rel(input.stage_ref)),source_database_utc:sourceNow,exact_causal_source_proofs:proofs,provider_refetch_count:0};
  },
  MANIFEST_AND_PROMOTION_PREPARATION:async()=>{
   const epoch="am22_measure_"+new URL(localUrl).pathname.slice(-12);
   // In-memory DTO for the isolated qualification port, never a host ARM receipt.
   const arm={schema_version:"geox_mcft_cap09_formal_v5_arm_v1",status:"PASS",subject_sha:input.subject_sha,formal_database_name:LEGACY.database,arm_time_database_utc:sourceNow,epoch_id:epoch,manifest_ref:`formal-arm://mcft-cap09/formal-v5/${epoch}/${LEGACY.database}`,a0:window.a0,o00:window.o00,o23:window.o23,readiness_deadline:window.a0,arm_identity_hash:m.hash(JSON.stringify(binding)),formal_v5_arm:true,formal_v5_epoch_selected:true,formal_database_mutation:false,schema_materialization:false,a0_bootstrap:false,o00_started:false,provider_request_count:0,final_actual_24h_still_required:true,mcft_cap09_completed:false} as const;
   built=buildMcftCap09FormalV5ManifestFromStageAuthorityV1({arm,crop_authority:json(rel("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json")),configuration_matrix:json(rel("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json")),current_crop_authority:stage,biological_stage_architecture_effectiveness:json(rel("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json")),expected_subject_sha:input.subject_sha});
   assert.equal(built.bundle.persistence_bundle.runtime_configs.length,24);m.immutable(path.join(out,"isolated-manifest.json"),built.manifest);
   return {status:"PASS",context_count:25,hourly_config_count:24,manifest_sha256:fileDigest(path.join(out,"isolated-manifest.json")),source_fact_ids:facts.map(x=>x.fact_id),formal_raw_put_count:0,formal_promotion_count:0};
  },
  FORMAL_SCHEMA_ACL_AND_PRISTINE_CAS:async()=>{
   const tables=await pristine(formal);
   const factsAcl=(await formal.query("SELECT has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','SELECT') AS es,has_table_privilege('geox_mcft_cap09_evidence_runtime_v1','public.facts','INSERT') AS ei,has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','SELECT') AS ts,has_table_privilege('geox_mcft_cap09_twin_runtime_v1','public.facts','INSERT') AS ti")).rows[0];assert.deepEqual(factsAcl,{es:true,ei:false,ts:true,ti:false});
   for(const role of ["geox_mcft_cap09_evidence_runtime_v1","geox_mcft_cap09_twin_runtime_v1"])for(const permission of ["UPDATE","DELETE"]){assert.equal((await formal.query("SELECT has_table_privilege($1,'public.facts',$2) AS allowed",[role,permission])).rows[0].allowed,false);}
   for(const table of ["twin_external_formal_forcing_base_cursor_v1","twin_external_formal_forcing_base_target_v1","twin_external_formal_forcing_controller_lease_v1"])for(const role of ["geox_mcft_cap09_evidence_runtime_v1","geox_mcft_cap09_twin_runtime_v1"])for(const permission of ["SELECT","INSERT","UPDATE","DELETE"]){const allowed=(await formal.query("SELECT has_table_privilege($1,$2,$3) AS allowed",[role,"public."+table,permission])).rows[0].allowed;assert.equal(allowed,role==="geox_mcft_cap09_evidence_runtime_v1"&&permission!=="DELETE");}
   const routines=(await formal.query("SELECT p.proname,r.rolname AS owner,has_function_privilege('geox_mcft_cap09_evidence_runtime_v1',p.oid,'EXECUTE') AS evidence,has_function_privilege('geox_mcft_cap09_twin_runtime_v1',p.oid,'EXECUTE') AS twin FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' ORDER BY p.proname")).rows;
   assert.deepEqual(routines,[{proname:"mcft_cap09_twin_runtime_append_fact_v1",owner:"geox_mcft_cap09_twin_writer_owner_v1",evidence:false,twin:true},{proname:"mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",owner:"geox_mcft_cap09_forcing_writer_owner_v1",evidence:true,twin:false}]);
   await schema(local);return {status:"PASS",formal_rows:tables,formal_facts_acl:factsAcl,formal_routines:routines,isolated_schema_materialized:true,production_database_write_count:0};
  },
  EVIDENCE_HANDOFF_AND_FENCING:async()=>{
   const repo=new PostgresRuntimeRepositoryV1(local),claim={...SCOPE,lease_owner:"am22-measurement-prewrite",lease_duration_seconds:300};const first=await repo.acquireLease(claim);
   await assert.rejects(()=>repo.acquireLease({...claim,lease_owner:"conflicting-measurement-owner"}),/LEASE_HELD_BY_OTHER_OWNER/);const second=await repo.acquireLease(claim);assert.ok(second.fencing_token>first.fencing_token);
   return {status:"PASS",handoff_plan:{status:"MEASUREMENT_PLAN_NOT_AUTHORITY",scope:SCOPE,...window,current_crop_authority_sha256:fileDigest(rel(input.stage_ref)),formal_v5_arm_authorized:false,a0_authorized:false},isolated_fencing_before:String(first.fencing_token),isolated_fencing_after:String(second.fencing_token),conflicting_owner_rejected:true,production_owner_cutover_count:0};
  },
  A0_PREWRITE_PREPARATION:async()=>{
   const result=await probePrewrite(local,built.bundle.persistence_bundle,{async loadCandidateRecords(){return structuredClone(records);}},await now(formal));
   m.stageCoverage(stage,window.a0,await now(formal));
   assert.equal(beforeOwners(),preserved,"AM22_MEASUREMENT_EXISTING_OWNERS_CHANGED");await pristine(formal);
   return {...result,existing_owners_unchanged:true,formal_store_still_pristine:true};
  },
 };
 try{const trace=await m.measure(tasks,binding,out);m.immutable(path.join(out,"summary.json"),{status:"MEASURED_PENDING_EQUIVALENCE_ADJUDICATION",...binding,trace_sha256:fileDigest(path.join(out,"measurement-trace.json")),phase_count:trace.trials[0].phases.length,elapsed_ms:trace.trials[0].finished_monotonic_ms-trace.trials[0].started_monotonic_ms,production_equivalence_limitations:trace.production_equivalence_limitations,complete_production_pre_a0_qualified:false,production_authorized:false,formal_v5_arm:false,a0_execution:false});console.log(fs.readFileSync(path.join(out,"summary.json"),"utf8"));}
 finally{await Promise.allSettled([source.end(),formal.end(),local.end()]);}
}
if(process.argv.includes("--run"))main().catch(()=>{console.error("AM22_HOST_MEASUREMENT_FAILED: inspect local failed.json; no execution qualification issued");process.exitCode=1;});
