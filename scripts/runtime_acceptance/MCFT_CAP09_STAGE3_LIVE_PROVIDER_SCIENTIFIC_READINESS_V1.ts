// Scientific real Provider readiness before allocating a fresh disposable PG/S3.
// Real KBS retained-byte decoder + production GFS same-cycle directory validator.
// Does not fetch all 72h forecast members; fail closed on that distinct gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";
import {fetchKbsVariate25SoilRawV1,KbsVariate25SoilEvidenceDecoderV1} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";
import {ControlledHttpsByteClientV1} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {GfsNomadsLiveProviderV1,parseGfsDirectoryInventoryV1} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";

const SHA=crypto.createHash;
const hash=(b:Uint8Array)=>SHA("sha256").update(b).digest("hex");
const required=(n:string)=>{const v=process.env[n];if(!v)throw Error("STAGE3_PROVIDER_ENV_MISSING:"+n);return v};
function reason(error:unknown){return String(error instanceof Error?error.message:error).slice(0,320).replace(/[\r\n]/g," ")}
function safeEnv(){
 assert.equal(required("MCFT_CAP09_STAGE3_FULL_PROVIDER_SCIENCE_PREFLIGHT"),"1");
 assert.equal(process.env.CI,"true","STAGE3_GITHUB_ONLY_READONLY_PROVIDER_PREFLIGHT");
 for(const key of ["DATABASE_URL","BLOCKED_DATABASE_URL","PGHOST","PGPASSWORD","MCFT_CAP09_FORMAL_RAW_BUCKET","MCFT_CAP09_ADOPTION_REQUEST","MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_BUNDLE","MCFT_GOVERNED_RETRY_TICKET","CAP09_NONAUTHORIZED_E2E_EXCLUSIVE_DESTRUCTIVE_TEST"]){
  assert(!process.env[key],"STAGE3_SCIENCE_PREFLIGHT_STORAGE_OR_AUTH_ENV_FORBIDDEN:"+key);
 }
 const out=path.resolve(required("MCFT_CAP09_STAGE3_PREFLIGHT_OUTPUT"));
 assert(!fs.existsSync(out),"STAGE3_SCIENCE_PREFLIGHT_OUTPUT_EXISTS");
 const parent=path.dirname(out);
 assert(fs.existsSync(parent)&&fs.lstatSync(parent).isDirectory(),"STAGE3_PREFLIGHT_OUTDIR_MISSING");
 return out;
}
async function main(){
 const out=safeEnv();
 const at=Date.now();
 const base=new Date(Math.ceil((at+4*3600_000)/3600_000)*3600_000).toISOString();
 const result:{
   schema_version:string;status:string;base_target_t:string;subject_sha:string;
   kbs:Record<string,unknown>;gfs:Record<string,unknown>;
   real_gfs_full_72h_members_retained:boolean;full_s3_pg_timed_capture_completed:boolean;
   permit_signed:boolean;permit_consumed:boolean;production_authorized:boolean;qualified:boolean;
 }={schema_version:"geox_mcft_cap09_stage3_live_science_readiness_v1",
    status:"HOLD_PENDING_BOTH_SCIENTIFIC_PROOFS",base_target_t:base,
    subject_sha:"12dcbba6750879f0349c5730f477cb04cd23b560",kbs:{},gfs:{},
    real_gfs_full_72h_members_retained:false,full_s3_pg_timed_capture_completed:false,
    permit_signed:false,permit_consumed:false,production_authorized:false,qualified:false};
 try{
  const begin=performance.now(),now=new Date().toISOString();
  const {request,response}=await fetchKbsVariate25SoilRawV1({
   request_id:"cap09-stage3-live-science-readonly",requested_at:now
  });
  assert.equal(response.status,200);
  const decoder=new KbsVariate25SoilEvidenceDecoderV1();
  const decoded=await decoder.decodeRetainedEvidence({
   raw_bytes:response.bytes,
   provenance:{request_id:request.request_id,provider_id:request.provider_id,
    source_family:request.source_family,source_locator:request.locator,
    final_locator:response.final_locator,content_type:response.content_type,
    retrieved_at:response.retrieved_at,available_at:response.available_at,
    raw_sha256:hash(response.bytes),raw_bytes:response.bytes.length,
    retention_ref:"READONLY_PREFLIGHT_NO_STORAGE",retained_at:response.retrieved_at,
    use_policy_ref:request.use_policy_ref}
  });
  assert.equal(decoded.length,1);
  const draft=decoded[0];
  assert(draft&&draft.quality.status==="PASS");
  result.kbs={status:"PASS_SCIENTIFIC_CONTINUITY_METADATA_ONLY",real_https:true,
   actual_production_decoder_used:true,elapsed_ms:Math.ceil(performance.now()-begin),
   raw_bytes:response.bytes.length,raw_sha256:hash(response.bytes),
   observed_at:String(draft.role_time.observed_at),continuity_window_hours:draft.quality.continuity_window_hours,
   distinct_point_count:draft.quality.distinct_point_count,
   distinct_hour_bucket_count:draft.quality.distinct_hour_bucket_count,
   maximum_gap_minutes:draft.quality.maximum_gap_minutes,
   retrieved_at:response.retrieved_at,available_to_runtime_at:draft.available_to_runtime_at};
 }catch(e){result.kbs={status:"HOLD",reason_code:reason(e)};}
 try{
  const start=performance.now();
  const bytes=new ControlledHttpsByteClientV1({user_agent:"GEOX-CAP09-REAL-SCIENCE-READINESS/1",
   max_raw_bytes:20_000_000,timeout_ms:30_000});
  const live=new GfsNomadsLiveProviderV1({byte_client:bytes,member_retry:{max_attempts:1,max_total_retries:0,retry_base_ms:1000}});
  const chosen=await live.selectLatestCompleteCycle(base,async raw=>{
    return parseGfsDirectoryInventoryV1(raw.response.bytes);
  });
  const startLead=chosen.lead_start,endLead=chosen.lead_end;
  assert(endLead-startLead>=71,"STAGE3_GFS_72H_FORECAST_LEAD_SPAN_UNAVAILABLE");
  result.gfs={status:"PASS_REAL_COMPLETE_CYCLE_DIRECTORY_INVENTORY_ONLY",
   real_https:true,actual_product_cycle_selection_used:true,
   elapsed_ms:Math.ceil(performance.now()-start),selected_cycle:chosen.cycle,
   lead_start:startLead,lead_end:endLead,support_lead:chosen.support_lead,
   eligible_72h_member_window:true,
   selection_directory_sha256:chosen.directory_sha256,
   rejected_cycle_count:chosen.rejected_cycles.length,
   forecast_members_fetched:0,source_raw_retained:false};
 }catch(e){result.gfs={status:"HOLD",reason_code:reason(e)};}
 result.status=result.kbs.status==="PASS_SCIENTIFIC_CONTINUITY_METADATA_ONLY"&&
  result.gfs.status==="PASS_REAL_COMPLETE_CYCLE_DIRECTORY_INVENTORY_ONLY"
  ?"PASS_READONLY_SCIENCE_READINESS_NOT_FULL_CAPTURE":"HOLD_PROVIDER_SCIENTIFIC_READINESS";
 fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({status:result.status,output:out,kbs:result.kbs,gfs:result.gfs,
  raw_values_exposed:false,full_pipeline_completed:false,permit:false}));
}
main().catch(e=>{console.error("STAGE3_REAL_SCIENCE_PREFLIGHT_HOLD:"+reason(e));process.exitCode=1});
