#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const {SCOPE,analyze,safeHealth}=require("./MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs");
const {readHealth}=require("./RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs");
const input={database_utc:"2026-10-09T08:47:24.375Z",target_logical_time:"2026-10-09T07:00:00.000Z",leases:[{...SCOPE,expires_at:"2026-10-09T08:46:31.727Z",gfs_poll_target_logical_time:"2026-10-09T07:00:00.000Z",gfs_poll_attempt_count:3}],facts:[],health_events:[{failure_stage:"MEMBER_FETCH",member_kind:"GFS_PGRB2_FILTER_RESPONSE",failure_token:"MCFT_CAP09_GFS_PGRB2_F011",local_retry_ordinal:0},{failure_token:"PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW"}]};
let count=0;const test=fn=>{fn();count++;};
test(()=>{const d=analyze(input);assert.equal(d.attempt_budget_exhausted,true);assert.equal(d.owner_observation,"EXPIRED_AT_DATABASE_SAMPLE");assert.equal(d.fact_observation,"NO_TARGET_FACTS");assert.equal(d.member_fetch_failures[0].local_retry_ordinal,0);assert.equal(d.provider_publication_status,"UNKNOWN_NO_PROVIDER_INVENTORY_PROOF");assert.equal(d.six_phase_success,false);});
test(()=>assert.throws(()=>analyze({...input,leases:[{...input.leases[0],field_id:"wrong"}]}),/EXACT_SCOPE/));
test(()=>assert.throws(()=>analyze({...input,leases:[input.leases[0],input.leases[0]]}),/CARDINALITY/));
test(()=>assert.throws(()=>analyze({...input,leases:[{...input.leases[0],gfs_poll_attempt_count:4}]}),/RETRY_STATE/));
test(()=>assert.throws(()=>analyze({...input,target_logical_time:"2026-10-09T07:01:00.000Z"}),/HOUR/));
const fact={...SCOPE,type:"future_weather_assumption_v1",target_logical_time:input.target_logical_time,selected_cycle:"2026-10-09T00:00:00.000Z",raw_source_sha256:"sha256:"+"a".repeat(64)};
test(()=>assert.equal(analyze({...input,facts:[fact]}).fact_observation,"PARTIAL_TARGET_FACTS"));
test(()=>assert.equal(analyze({...input,facts:[fact,{...fact,type:"future_et0_assumption_v1"}]}).fact_observation,"PAIR_METADATA_OBSERVED_NOT_QUALIFIED"));
test(()=>assert.equal(analyze({...input,facts:[fact,{...fact,type:"future_et0_assumption_v1",raw_source_sha256:"sha256:"+"b".repeat(64)}]}).fact_observation,"PAIR_PROVENANCE_MISMATCH"));
test(()=>assert.throws(()=>analyze({...input,facts:[fact,fact]}),/DUPLICATE/));
test(()=>assert.equal(analyze({...input,facts:[{...fact,target_logical_time:"2026-09-19T15:00:00.000Z"}]}).fact_observation,"NO_TARGET_FACTS"));
test(()=>assert.equal(analyze({...input,leases:[]}).planner_attempt_observation,"NO_CLAIM_FOR_REQUESTED_TARGET_OBSERVED"));
test(()=>assert.equal(safeHealth("not json"),null));
test(()=>assert.equal(safeHealth('{"runtime_role":"TWIN_RUNTIME"}'),null));
test(()=>assert.deepEqual(safeHealth(JSON.stringify({runtime_role:"EVIDENCE_RUNTIME",error_code:"ETIMEDOUT",failure_token:"https://secret.example/token",message:"password",cause:{password:"secret"},lead:900})),{error_code:"ETIMEDOUT"}));
test(()=>assert.equal(analyze({...input,leases:[{...input.leases[0],expires_at:"2026-10-09T09:00:00.000Z"}]}).owner_observation,"LIVE_AT_ONE_DATABASE_SAMPLE_NOT_H5"));
test(()=>{const p=cp.spawnSync(process.execPath,[path.join(__dirname,"RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs"),"--live","--operator-authorized","--target="+input.target_logical_time],{env:{...process.env,CI:"true"},encoding:"utf8"});assert.equal(p.status,1);assert.equal(JSON.parse(p.stderr).database_observation,"UNAVAILABLE_NOT_EMPTY");});
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"gfs-diag-test-"));try{
 const log=path.join(dir,"runtime.log");const member=JSON.stringify({runtime_role:"EVIDENCE_RUNTIME",...input.health_events[0]});const missed=JSON.stringify({runtime_role:"EVIDENCE_RUNTIME",...input.health_events[1]});fs.writeFileSync(log,["bad",member,...Array(1500).fill(missed)].join("\n"));
 const h=await readHealth(log);assert.equal(h.health_events.filter(e=>e.failure_stage==="MEMBER_FETCH").length,1);assert.equal(h.health_events.filter(e=>e.failure_token.includes("MISSED_WINDOW")).length,3);count++;
 assert.equal((await readHealth(path.join(dir,"missing"))).log_read_status,"MISSING_NOT_PROOF_OF_NO_FAILURE");count++;
 const fixture=path.join(dir,"input.json");fs.writeFileSync(fixture,JSON.stringify(input));const p=cp.spawnSync(process.execPath,[path.join(__dirname,"RUN_MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs"),"--input="+fixture],{encoding:"utf8"});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).status,"DIAGNOSTIC_ONLY");count++;
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 console.log(JSON.stringify({status:"PASS",test_count:count,production_writes:0,production_effect:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
