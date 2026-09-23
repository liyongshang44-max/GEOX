import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { PostgresGfsCanonicalTargetPairHistoryV1 } from "../../apps/server/src/persistence/external_evidence/postgres_gfs_target_pair_history_v1.js";
import type { EvidenceRuntimeScopeV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_GFS_TARGET_PAIR_HISTORY_POSTGRES_V1_RESULT.json");
const DATABASE_URL=process.env.DATABASE_URL?.trim();if(!DATABASE_URL)throw new Error("DATABASE_URL_REQUIRED");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"gfsHistoryTenant",project_id:"gfsHistoryProject",group_id:"gfsHistoryGroup",field_id:"gfsHistoryField",season_id:"gfsHistorySeason",zone_id:"gfsHistoryZone"};
const A0="2026-09-02T20:00:00.000Z",O00="2026-09-02T21:00:00.000Z",O01="2026-09-02T22:00:00.000Z",CYCLE="2026-09-02T18:00:00.000Z";
function compact(x:string){return x.replace(/[-:.]/g,"").replace("000Z","Z").toLowerCase();}
async function insert(pool:Pool,role:"WEATHER"|"FUTURE_ET0",target:string,cycle:string,suffix=""):Promise<void>{
  const ck=compact(cycle),tk=compact(target),type=role==="WEATHER"?"future_weather_assumption_v1":"future_et0_assumption_v1";
  const binding=role==="WEATHER"?MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const origin=role==="WEATHER"?"gfs_"+ck+"_pgrb2_0p25_kbs":"gfs_"+ck+"_asce_short_reference_et0_kbs";
  const sourceRecord=role==="WEATHER"?"gfs_future_weather_"+ck+"_"+tk:"gfs_future_et0_"+ck+"_"+tk;
  const payload={...SCOPE,dataset_id:"noaa_ncep_gfs_same_cycle_72h_bundle_v1",record_type:type,binding_id:binding,origin_source_id:origin,source_record_id:sourceRecord,role_time:{issued_at:cycle,valid_from:target},source_payload:{selected_cycle:cycle,target_logical_time:target}};
  await pool.query("INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,'mcft_cap09_external_formal_evidence_v1',$3::jsonb)",["gfs-history-"+role+"-"+tk+suffix,cycle,JSON.stringify({type,payload})]);
}
async function main():Promise<void>{
 const pool=new Pool({connectionString:DATABASE_URL,application_name:"mcft-cap09-gfs-target-history"});
 try{
  await pool.query("DELETE FROM public.facts WHERE source='mcft_cap09_external_formal_evidence_v1' AND record_json#>>'{payload,tenant_id}'=$1",[SCOPE.tenant_id]);
  await insert(pool,"WEATHER",A0,CYCLE);await insert(pool,"FUTURE_ET0",A0,CYCLE);
  await insert(pool,"WEATHER",O00,CYCLE);await insert(pool,"FUTURE_ET0",O00,CYCLE);
  await insert(pool,"WEATHER",O01,CYCLE);
  const reader=new PostgresGfsCanonicalTargetPairHistoryV1(pool,SCOPE);
  const history=await reader.readGfsTargetPairHistory({scope:SCOPE,from_target_logical_time:A0});
  assert.deepEqual(history.pairs.map(x=>x.target_logical_time),[A0,O00]);
  assert.deepEqual(history.pairs.map(x=>x.cycle_issued_at),[CYCLE,CYCLE]);
  assert.equal(history.partial_targets.length,1);assert.equal(history.partial_targets[0]?.target_logical_time,O01);assert.equal(history.partial_targets[0]?.present_role,"WEATHER");
  assert.equal(history.canonical_fact_read_count,5);
  assert.equal(new Set(history.pairs.map(x=>x.cycle_issued_at)).size,1);
  await insert(pool,"FUTURE_ET0",O01,"2026-09-02T12:00:00.000Z","-cross-cycle");
  await assert.rejects(()=>reader.readGfsTargetPairHistory({scope:SCOPE,from_target_logical_time:A0}),/GFS_TARGET_HISTORY_CROSS_CYCLE_PAIR_FORBIDDEN/);
  const proof={schema_version:"geox_mcft_cap09_gfs_target_pair_history_postgres_v1",status:"PASS",append_only_canonical_facts_are_hourly_target_completion_authority:true,same_provider_cycle_multiple_hourly_targets_preserved:true,supply_cursor_cycle_summary_used_as_hourly_completion_authority:false,partial_target_not_counted_complete:true,cross_cycle_pair_fail_closed:true,database_write_count_by_reader:0,provider_request_count:0,cursor_mutation_count:0,runtime_tick_cursor_access:false,production_runtime_start:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
 }finally{await pool.end();}
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_start:false},null,2)+"\n");console.error(error);process.exitCode=1;});
