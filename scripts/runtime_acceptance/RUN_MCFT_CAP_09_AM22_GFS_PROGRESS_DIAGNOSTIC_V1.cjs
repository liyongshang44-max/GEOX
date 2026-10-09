#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),readline=require("node:readline");
const {SCOPE,safeHealth,analyze}=require("./MCFT_CAP_09_AM22_GFS_PROGRESS_DIAGNOSTIC_V1.cjs");
const DATABASE="geox_mcft_cap09_production_runtime_v1";
const arg=k=>process.argv.slice(2).find(x=>x.startsWith(k+"="))?.slice(k.length+1);
async function readHealth(log){
 if(!log||!fs.existsSync(log))return {health_events:[],log_read_status:"MISSING_NOT_PROOF_OF_NO_FAILURE"};
 assert.ok(fs.statSync(log).size<=64*1024*1024,"DIAGNOSTIC_LOG_SIZE_LIMIT");
 const stream=fs.createReadStream(log),lines=readline.createInterface({input:stream,crlfDelay:Infinity});const events=[],memberEvents=[],missedEvents=[];
 try{for await(const line of lines){if(line.length>65536)continue;const e=safeHealth(line);if(e?.failure_token){const queue=e.failure_stage==="MEMBER_FETCH"?memberEvents:e.failure_token==="PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW"?missedEvents:events;queue.push(e);const limit=queue===missedEvents?3:20;if(queue.length>limit)queue.shift();}}}finally{lines.close();stream.destroy();}
 return {health_events:[...events,...memberEvents,...missedEvents],log_read_status:"READ_SANITIZED_FAILURES_ONLY"};
}
async function collect(target){
 assert.ok(process.argv.includes("--operator-authorized"),"DIAGNOSTIC_OPERATOR_FLAG_REQUIRED");
 assert.ok(!process.env.CI&&!process.env.GITHUB_ACTIONS,"DIAGNOSTIC_NO_PRODUCTION_CREDENTIALS_IN_CI");
 assert.equal(new Date(target).toISOString(),target);assert.ok(target.endsWith(":00:00.000Z"));
 const {Pool}=require("pg");assert.ok(process.env.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL,"DIAGNOSTIC_DATABASE_URL_REQUIRED");
 const pool=new Pool({connectionString:process.env.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL,max:1,connectionTimeoutMillis:10000,query_timeout:15000,options:"-c default_transaction_read_only=on -c statement_timeout=10000"});
 let client;try{
 client=await pool.connect();await client.query("BEGIN READ ONLY");
 const identity=(await client.query("SELECT current_database() AS database_name,transaction_timestamp() AS database_utc")).rows[0];
 assert.equal(identity.database_name,DATABASE,"DIAGNOSTIC_DATABASE_IDENTITY_MISMATCH");
 const values=Object.values(SCOPE),where=Object.keys(SCOPE).map((k,i)=>k+"=$"+(i+1)).join(" AND ");
 const leases=(await client.query("SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,expires_at,gfs_poll_target_logical_time,gfs_poll_attempt_count,gfs_poll_last_started_at FROM public.external_evidence_producer_lease_v1 WHERE "+where+" LIMIT 2",values)).rows.map(row=>({...row,expires_at:row.expires_at.toISOString(),gfs_poll_target_logical_time:row.gfs_poll_target_logical_time?.toISOString()??null,gfs_poll_last_started_at:row.gfs_poll_last_started_at?.toISOString()??null}));
 const payload="record_json->'payload'",scopeWhere=Object.keys(SCOPE).map((k,i)=>"("+payload+"->>'"+k+"')=$"+(i+1)).join(" AND ");
 const scopeSelect=Object.keys(SCOPE).map(k=>"("+payload+"->>'"+k+"') AS "+k).join(",");
 const facts=(await client.query("SELECT "+scopeSelect+",record_json->>'type' AS type,"+payload+"#>>'{source_payload,target_logical_time}' AS target_logical_time,"+payload+"#>>'{source_payload,selected_cycle}' AS selected_cycle,"+payload+"#>>'{quality,raw_source_sha256}' AS raw_source_sha256 FROM public.facts WHERE "+scopeWhere+" AND record_json->>'type' IN ('future_weather_assumption_v1','future_et0_assumption_v1') AND ("+payload+"#>>'{source_payload,target_logical_time}')=$7 LIMIT 1001",[...values,target])).rows;
 await client.query("COMMIT");
 return {database_utc:identity.database_utc.toISOString(),target_logical_time:target,leases,facts,...await readHealth(process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT?path.join(process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"evidence","runtime.log"):null)};
 }finally{if(client){try{await client.query("ROLLBACK");}catch{}client.release();}await pool.end();}
}
async function main(){
 const offline=arg("--input"),live=process.argv.includes("--live");assert.ok(Boolean(offline)!==live,"DIAGNOSTIC_SELECT_ONE_INPUT_MODE");
 let input;if(offline){assert.ok(fs.statSync(offline).size<=2*1024*1024,"DIAGNOSTIC_INPUT_SIZE_LIMIT");input=JSON.parse(fs.readFileSync(offline,"utf8"));}else input=await collect(arg("--target"));
 console.log(JSON.stringify(analyze(input),null,2));
}
module.exports={readHealth};
if(require.main===module)main().catch(()=>{console.error(JSON.stringify({status:"BLOCKED",reason:"DIAGNOSTIC_COLLECTION_OR_VALIDATION_FAILED",database_observation:"UNAVAILABLE_NOT_EMPTY",production_writes:0,formal_v5_arm:false,a0_execution:false}));process.exitCode=1;});
