// Non-authorizing live Provider transport observation. The GFS HTTP
// directory listing is NOT the complete 72h GFS member bundle or decode.
// No PG, S3, Ticket, Production Host, formal Evidence, or Permit operation.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
import {ControlledHttpsByteClientV1} from "../../apps/server/src/external_evidence/provider/https_external_evidence_transport_v1.js";
import {GfsNomadsLiveProviderV1,MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1} from "../../apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.js";
import {fetchKbsVariate25SoilRawV1,MCFT_CAP09_KBS_SOIL_ENDPOINT_V1} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";

const NOW=()=>Date.now(),hash=(x:Uint8Array)=>crypto.createHash("sha256").update(x).digest("hex");
const SUBJECT="12dcbba6750879f0349c5730f477cb04cd23b560";
const NAME="MCFT_CAP09_STAGE3_REAL_PROVIDER_READONLY_TRANSPORT_WITNESS_V1_RESULT.json";
type Event={source:string;ordinal:number;phase:string;observed_started_at:string;http_response_observed:boolean;real_network_get:boolean;elapsed_ms:number;source_bytes_sha256:string|null;source_bytes_length:number|null;reason_code:string|null;result_code:string};
function forbidden(){
 if(process.env.MCFT_CAP09_STAGE3_REAL_PROVIDER_READONLY!=="1")throw Error("PROVIDER_WITNESS_OPT_IN_REQUIRED");
 for(const n of ["DATABASE_URL","BLOCKED_DATABASE_URL","PGHOST","PGPASSWORD","MCFT_GOVERNED_RETRY_STAGE",
 "MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST",
 "MCFT_CAP09_FORMAL_RAW_BUCKET","MCFT_CAP09_FORMAL_V5_ARM","CAP09_NONAUTHORIZED_E2E_EXCLUSIVE_DESTRUCTIVE_TEST"]){
  if(process.env[n])throw Error("PROVIDER_WITNESS_FORBIDDEN_INHERITED_ENV:"+n);
 }
 assert(process.env.CI==="true"||process.platform==="win32","PROVIDER_WITNESS_CI_OR_WINDOWS_ONLY");
}
const reason=(error:unknown)=>String(error instanceof Error?error.message:error).slice(0,180).replace(/[^a-zA-Z0-9_.:-]/g,"_");
async function main(){
 forbidden();
 const dir=process.env.MCFT_CAP09_STAGE3_PROVIDER_WITNESS_DIR;
 assert(dir&&path.isAbsolute(dir)&&!dir.split(path.sep).includes(".."),"PROVIDER_WITNESS_ABSOLUTE_DIR_REQUIRED");
 assert(!fs.existsSync(dir),"PROVIDER_WITNESS_NEW_DIR_REQUIRED");
 fs.mkdirSync(dir,{recursive:false,mode:0o700});
 const values:Event[]=[];
 // Select a fully historical 6-hour cycle (18h old); never wait for future files.
 const cycle=new Date(Math.floor((NOW()-18*3600_000)/(6*3600_000))*6*3600_000).toISOString();
 const byteClient=new ControlledHttpsByteClientV1({user_agent:"GEOX-MCFT-CAP09-STAGE3-READONLY-WITNESS/1",
  max_raw_bytes:20_000_000,timeout_ms:30_000});
 const gfs=new GfsNomadsLiveProviderV1({byte_client:byteClient,
  member_retry:{max_attempts:1,max_total_retries:0,retry_base_ms:1000}});
 try{
  for(let ordinal=1;ordinal<=3;ordinal++){
   // Provider responsible-sharing: at most one NOMADS listing GET per 10 seconds.
   for(const source of ["KBS_SOIL","GFS_DIRECTORY"]){
    const started=NOW(),observed=new Date(started).toISOString();
    const event:Event={source,ordinal,phase:"RAW_TRANSPORT_ONLY",observed_started_at:observed,
      real_network_get:true,http_response_observed:false,elapsed_ms:0,
      source_bytes_sha256:null,source_bytes_length:null,reason_code:null,result_code:"HOLD"};
    try{
     let bytes:Uint8Array;
     if(source==="KBS_SOIL"){
      const r=await fetchKbsVariate25SoilRawV1({request_id:"cap09-stage3-readonly-"+ordinal,
       requested_at:observed});
      assert.equal(r.response.status,200,"KBS_REAL_RESPONSE_NOT_200");
      assert.equal(new URL(r.response.final_locator).hostname,new URL(MCFT_CAP09_KBS_SOIL_ENDPOINT_V1).hostname);
      bytes=r.response.bytes;
     }else{
      const r=await gfs.fetchDirectoryRaw(cycle);
      assert.equal(r.response.status,200,"GFS_REAL_RESPONSE_NOT_200");
      assert.equal(new URL(r.response.final_locator).hostname,new URL(MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.production_root).hostname);
      bytes=r.response.bytes;
     }
     assert(bytes.length>0&&bytes.length<=20_000_000,"PROVIDER_WITNESS_BOUNDED_NONEMPTY_RESPONSE_REQUIRED");
     event.http_response_observed=true;event.source_bytes_sha256=hash(bytes);
     event.source_bytes_length=bytes.length;event.result_code="RAW_HTTPS_RESPONSE_PASS_NOT_FULL_CAPTURE";
    }catch(e){event.reason_code=reason(e);}
    event.elapsed_ms=NOW()-started;
    values.push(event);
   }
   if(ordinal<3)await sleep(10_000);
  }
 }finally{
  const observed=values.filter(x=>x.http_response_observed);
  const receipt={schema_version:"geox_mcft_cap09_stage3_real_provider_readonly_transport_witness_v1",
   status:values.length===6&&observed.length===6?"PASS_TRANSPORT_ONLY":"HOLD_PARTIAL_OR_NO_REAL_PROVIDER_RESPONSES",
   frozen_subject_sha:SUBJECT,gfs_6h_cycle:cycle,qualified:false,
   original_producer_v2_entry_executed:false,original_timing_v2_entry_executed:false,
   gfs_72h_complete_cycle_acquired:false,gfs_member_bundle_decoded:false,
   kbs_soil_continuity_scientifically_validated:false,
   real_https_probe_events:values.length,real_https_success_events:observed.length,
   raw_transport_only:true,physical_timing_budget_qualified:false,
   provider_delay_pipeline_injected:false,controlled_delay_executed:false,
   original_v13_aggregate_executed:false,formal_v5_arm:false,
   permit_signed:false,permit_consumed:false,production_authorized:false,
   requests:values,
   no_public_provider_payload_values:true};
  const out=path.join(dir,NAME);
  fs.writeFileSync(out,JSON.stringify(receipt,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log(JSON.stringify({status:receipt.status,events:values.length,ok:observed.length,output:out,
   real_provider_transport_latency_only:true,scientific_equivalence:false,permit:false}));
 }
}
main().catch(e=>{console.error("STAGE3_REAL_PROVIDER_WITNESS_HOLD:"+reason(e));process.exitCode=1;});
