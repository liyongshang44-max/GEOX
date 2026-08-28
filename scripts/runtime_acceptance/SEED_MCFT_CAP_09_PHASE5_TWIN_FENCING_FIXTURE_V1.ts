import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const SOURCE="mcft_cap09_external_formal_evidence_v1";
const DATASET="mcft_cap09_phase5_twin_fencing_engineering_fixture_v1";
const LIMITATIONS=["ENGINEERING_FIXTURE_ONLY","NOT_FORMAL_EXTERNAL_EVIDENCE","TWIN_FENCING_FOCUSED_QUALIFICATION_ONLY"];

function env(name:string):string {
  const v=String(process.env[name]??"").trim();
  if(!v) throw new Error("PHASE5_TWIN_FENCING_SEED_ENV_REQUIRED:"+name);
  return v;
}
function addHours(v:string,h:number):string { return new Date(Date.parse(v)+h*3600000).toISOString(); }
function addMinutes(v:string,m:number):string { return new Date(Date.parse(v)+m*60000).toISOString(); }
function canonicalHour(v:string):string {
  const c=new Date(Date.parse(v)).toISOString();
  if(c!==v||!c.endsWith(":00:00.000Z")) throw new Error("PHASE5_TWIN_FENCING_SEED_A0_INVALID");
  return c;
}
function weatherPoints(base:string,seed:number):Array<Record<string,unknown>> {
  return Array.from({length:72},(_,i)=>({
    horizon:i+1,valid_from:addHours(base,i),valid_to:addHours(base,i+1),
    precipitation_mm:i===0?Number((0.15+seed*0.003).toFixed(6)):Number((0.02+(i%4)*0.005).toFixed(6)),
  }));
}
function et0Points(base:string,seed:number):Array<Record<string,unknown>> {
  return Array.from({length:72},(_,i)=>({
    horizon:i+1,valid_from:addHours(base,i),valid_to:addHours(base,i+1),
    et0_mm_per_hour:Number((0.12+seed*0.0005+(i%3)*0.002).toFixed(6)),
  }));
}
function assumption(kind:"weather"|"et0",base:string,seed:number):CanonicalReplayEvidenceRecordV1 {
  const issuedAt=addMinutes(base,-30), availableAt=addMinutes(base,-20);
  const bindingId=kind==="weather"?MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const recordType=kind==="weather"?"future_weather_assumption_v1":"future_et0_assumption_v1";
  const sourceId=`phase5_twin_fencing_${kind}_${base}_${seed}`;
  const payload={snapshot_kind:kind==="weather"?"FUTURE_WEATHER_ASSUMPTION":"FUTURE_ET0_ASSUMPTION",points:kind==="weather"?weatherPoints(base,seed):et0Points(base,seed)};
  return {
    dataset_id:DATASET,source_record_id:sourceId,
    source_record_hash:semanticHashV1({sourceId,bindingId,issuedAt,availableAt,payload}),
    record_type:recordType,binding_id:bindingId,
    origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id:kind==="weather"?"NOAA_GFS_ENGINEERING_FIXTURE":"ASCE_ET0_FROM_GFS_ENGINEERING_FIXTURE",
    epistemic_class:"ASSUMED",...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at:availableAt,
    role_time:{issued_at:issuedAt,available_to_runtime_at:availableAt,retrieved_at:availableAt,ingested_at:availableAt,valid_from:base,valid_to:addHours(base,72)},
    quality:{status:"PASS"},source_payload:structuredClone(payload),canonical_payload:payload,
    source_unit:"mm",canonical_unit:"mm",
    conversion_rule:{rule_id:kind==="weather"?"PRECIPITATION_MM_IDENTITY_V1":"ET0_MM_PER_HOUR_IDENTITY_V1"},
    limitations:[...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function soil(a0:string):CanonicalReplayEvidenceRecordV1 {
  const observedAt=addMinutes(a0,-5), availableAt=addMinutes(a0,-4), value=0.31;
  const sourceId=`phase5_twin_fencing_soil_${a0}`;
  const canonicalPayload={quantity_kind:"VOLUMETRIC_WATER_CONTENT",unit:"fraction",value};
  return {
    dataset_id:DATASET,source_record_id:sourceId,
    source_record_hash:semanticHashV1({sourceId,observedAt,availableAt,canonicalPayload}),
    record_type:"soil_moisture_observation_v1",binding_id:MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",origin_source_id:"KBS_SOIL_ENGINEERING_FIXTURE",
    epistemic_class:"OBSERVED",...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at:availableAt,role_time:{observed_at:observedAt,ingested_at:availableAt},
    quality:{status:"PASS"},source_payload:{source_version:"engineering-v1",unit:"fraction",value},
    canonical_payload:canonicalPayload,source_unit:"fraction",canonical_unit:"fraction",
    conversion_rule:{id:"VWC_FRACTION_IDENTITY_V1",version:"1"},limitations:[...LIMITATIONS],
  } as CanonicalReplayEvidenceRecordV1;
}
function eventTime(r:CanonicalReplayEvidenceRecordV1):string {
  if(r.record_type==="soil_moisture_observation_v1") return String(r.role_time?.observed_at);
  return String(r.role_time?.issued_at);
}
async function insert(pool:Pool,r:CanonicalReplayEvidenceRecordV1):Promise<void> {
  const factId="phase5_twin_fencing_"+createHash("sha256").update(`${r.source_record_id}|${r.source_record_hash}`).digest("hex");
  const q=await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT (fact_id) DO NOTHING`,
    [factId,eventTime(r),SOURCE,JSON.stringify({type:r.record_type,payload:r})],
  );
  if(q.rowCount!==1) throw new Error("PHASE5_TWIN_FENCING_SEED_FACT_CONFLICT:"+factId);
}
async function main():Promise<void> {
  const a0=canonicalHour(env("GEOX_MCFT_CAP09_PHASE5_FOCUSED_A0"));
  const out=path.resolve(env("GEOX_MCFT_CAP09_PHASE5_FOCUSED_SEED_PROOF_OUTPUT"));
  const pool=new Pool({connectionString:env("DATABASE_URL"),max:2});
  try {
    const records:CanonicalReplayEvidenceRecordV1[]=[soil(a0)];
    for(let i=0;i<7;i++) records.push(assumption("weather",addHours(a0,i),i+1),assumption("et0",addHours(a0,i),i+1));
    for(const r of records) await insert(pool,r);
    const count=Number((await pool.query(
      "SELECT count(*)::int AS n FROM facts WHERE source=$1 AND record_json#>>'{payload,dataset_id}'=$2",
      [SOURCE,DATASET],
    )).rows[0]?.n??-1);
    if(count!==15) throw new Error("PHASE5_TWIN_FENCING_SEED_EXACT_15_REQUIRED:"+count);
    const proof={
      schema_version:"geox_mcft_cap09_phase5_twin_fencing_fixture_seed_v1",status:"PASS",a0,
      engineering_fixture_fact_count:count,soil_fact_count:1,future_weather_fact_count:7,future_et0_fact_count:7,
      fixture_disclosure:"CONTROLLED_ENGINEERING_FIXTURE_NOT_FORMAL_EXTERNAL_EVIDENCE",
      purpose:"TWIN_CONTAINER_DB_LEASE_FENCING_FOCUSED_QUALIFICATION_ONLY",
      live_evidence_claim:false,full_24t_claim:false,provider_request_count:0,
    };
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
    console.log(JSON.stringify(proof));
  } finally { await pool.end(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
