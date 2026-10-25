// Single FULL genuine Provider acquisition: KBS soil and NOAA GFS 72h
// same-cycle retained member bundle, private test-only MinIO, scientific decode.
// No PostgreSQL, governed Host, historical DA9, Permit or production identity.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {S3CompatiblePrivateRawEvidenceRetentionAdapterV1} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {ProductionEvidenceWorkItemFactoryV1} from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import type {ExternalEvidenceFileBackedTransportPortV1,ExternalEvidenceFileDecoderPortV1,VerifiedRawEvidenceProvenanceV1} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
const sha=(b:Uint8Array)=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const val=(n:string)=>{const v=process.env[n];if(!v)throw Error("FULL_PROVIDER_ENV_REQUIRED:"+n);return v;};
const why=(e:unknown)=>String(e instanceof Error?e.message:e).slice(0,260);
const SUBJECT="12dcbba6750879f0349c5730f477cb04cd23b560";
async function main(){
 assert.equal(val("MCFT_CAP09_STAGE3_FULL_REAL_S3_ACQUISITION"),"1");
 assert.equal(process.env.CI,"true");assert.equal(process.env.GITHUB_ACTIONS,"true");
 for(const k of ["DATABASE_URL","BLOCKED_DATABASE_URL","PGPASSWORD","MCFT_GOVERNED_RETRY_STAGE",
 "MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_BUNDLE",
 "MCFT_CAP09_ADOPTION_REQUEST","MCFT_CAP09_FORMAL_RAW_BUCKET"]){
  assert(!process.env[k],"FULL_PROVIDER_FORMAL_OR_DB_ENV_FORBIDDEN:"+k);
 }
 const runId=val("MCFT_CAP09_STAGE3_NEW_RUN_ID");
 assert(/^[a-f0-9]{12}$/.test(runId)&&!["da9db7129607","af64cc3aa84e"].includes(runId));
 const bucket=val("PHASE7_PRIVATE_S3_BUCKET");
 assert.equal(bucket,"mcft-cap09-requal-"+runId);
 const endpoint=val("PHASE7_PRIVATE_S3_ENDPOINT");
 const u=new URL(endpoint);
 assert(["localhost","127.0.0.1","[::1]"].includes(u.hostname)&&
  ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash);
 const dir=val("MCFT_CAP09_STAGE3_EVIDENCE_DIR");
 assert(path.isAbsolute(dir)&&!fs.existsSync(dir));fs.mkdirSync(dir,{recursive:false,mode:0o700});
 const out=path.join(dir,"STAGE3_FULL_REAL_KBS_GFS_S3_SCIENCE_V1.json");
 const target=new Date(Math.ceil((Date.now()+10*3600_000)/3600_000)*3600_000).toISOString();
 const result:Record<string,unknown>={
  schema_version:"geox_mcft_cap09_stage3_full_real_provider_s3_science_v1",
  status:"HOLD",run_id:runId,target_base:target,subject_sha:SUBJECT,
  provider_transport_real:true,fixture_provider_used:false,
  original_v13_stage_executed:false,original_v13_timing_equivalent:false,
  postgres_fenced_promotion_executed:false,aggregate_executed:false,
  qualified:false,permit_signed:false,permit_consumed:false,
  production_authorized:false,raw_values_publicly_emitted:false};
 const captureStart=Date.now();
 let phase="S3_SOURCE_VALIDATION",kbsDecode=0,gfsDecode=0,realGets=0,retained=0;
 try{
  const ret=new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({
   endpoint,bucket,region:val("PHASE7_PRIVATE_S3_REGION"),
   access_key_id:val("PHASE7_PRIVATE_S3_ACCESS_KEY_ID"),
   secret_access_key:val("PHASE7_PRIVATE_S3_SECRET_ACCESS_KEY"),
   allow_insecure_http_for_test:true});
  const actualFetch:typeof fetch=async(input,init)=>{
   const locator=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
   assert(locator.protocol==="https:"&&
    ["lter.kbs.msu.edu","nomads.ncep.noaa.gov"].includes(locator.hostname));
   realGets++;
   assert(realGets<=260,"STAGE3_REAL_GFS_MAX_260_HTTPS_GET_LIMIT");
   return fetch(input,init);
  };
  const factory=new ProductionEvidenceWorkItemFactoryV1({retention:ret,fetch_impl:actualFetch});
  const requestTime=new Date().toISOString();
  phase="REAL_KBS_SOIL_HTTPS_AND_RAW_RETENTION";
  const soil=factory.buildKbsSoilCurrent({requested_at:requestTime,request_id_prefix:"cap09s3"+runId});
  const soilResp=await soil.transport.fetchRawEvidence(soil.request);
  assert.equal(soilResp.status,200);
  const soilDigest=sha(soilResp.bytes);
  const soilKeep=await ret.retainRawEvidence({
   retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",request_id:soil.request.request_id,
   provider_id:soil.request.provider_id,source_family:soil.request.source_family,
   source_locator:soil.request.locator,final_locator:soilResp.final_locator,
   content_type:soilResp.content_type,retrieved_at:soilResp.retrieved_at,
   available_at:soilResp.available_at,use_policy_ref:soil.request.use_policy_ref,
   raw_sha256:soilDigest,raw_bytes:soilResp.bytes.length,bytes:soilResp.bytes});
  retained++;
  const soilProv:VerifiedRawEvidenceProvenanceV1={
   request_id:soil.request.request_id,provider_id:soil.request.provider_id,
   source_family:soil.request.source_family,source_locator:soil.request.locator,
   final_locator:soilResp.final_locator,content_type:soilResp.content_type,
   retrieved_at:soilResp.retrieved_at,available_at:soilResp.available_at,
   raw_sha256:soilDigest,raw_bytes:soilResp.bytes.length,
   retention_ref:soilKeep.retention_ref,retained_at:soilKeep.retained_at,
   use_policy_ref:soil.request.use_policy_ref};
  await ret.verifyRetainedRawEvidence({retention_ref:soilKeep.retention_ref,
   retained_sha256:soilKeep.retained_sha256,retained_bytes:soilKeep.retained_bytes});
  phase="REAL_KBS_SCIENTIFIC_CONTINUITY";
  const beginSoil=Date.now();
  const soilDrafts=await soil.decoder.decodeRetainedEvidence({raw_bytes:soilResp.bytes,provenance:soilProv});
  kbsDecode=Date.now()-beginSoil;
  assert.equal(soilDrafts.length,1);assert.equal(soilDrafts[0]?.quality.status,"PASS");
  result.kbs={scientific_status:"PASS",raw_s3_retained:true,actual_decoder_executed:true,
   decoded_draft_count:soilDrafts.length,scientific_decode_ms:kbsDecode,
   raw_sha256:soilDigest,raw_bytes:soilResp.bytes.length};
  phase="REAL_GFS_FULL_72H_SAME_CYCLE_DOWNLOAD_AND_MEMBER_RETENTION";
  const gr=factory.buildGfsBundle({target_logical_time:target,requested_at:new Date().toISOString(),
   request_id_prefix:"cap09s3"+runId});
  const tr=gr.transport as typeof gr.transport&ExternalEvidenceFileBackedTransportPortV1;
  assert.equal(gr.file_backed,true);
  const tGfs=Date.now(),resp=await tr.fetchRawEvidenceFile(gr.request);
  result.real_gfs_capture_ms=Date.now()-tGfs;
  assert.equal(resp.status,200);
  // Composer has already retained each source member BEFORE parsing/decoding.
  const keep=await ret.retainRawEvidenceFile({
   retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",
   request_id:gr.request.request_id,provider_id:gr.request.provider_id,
   source_family:gr.request.source_family,source_locator:gr.request.locator,
   final_locator:resp.final_locator,content_type:resp.content_type,
   retrieved_at:resp.retrieved_at,available_at:resp.available_at,
   use_policy_ref:gr.request.use_policy_ref,raw_sha256:resp.raw_sha256,
   raw_bytes:resp.raw_bytes,file_path:resp.file_path});
  retained++;
  const gfsProv:VerifiedRawEvidenceProvenanceV1={
   request_id:gr.request.request_id,provider_id:gr.request.provider_id,
   source_family:gr.request.source_family,source_locator:gr.request.locator,
   final_locator:resp.final_locator,content_type:resp.content_type,
   retrieved_at:resp.retrieved_at,available_at:resp.available_at,
   raw_sha256:resp.raw_sha256,raw_bytes:resp.raw_bytes,
   retention_ref:keep.retention_ref,retained_at:keep.retained_at,
   use_policy_ref:gr.request.use_policy_ref};
  await ret.verifyRetainedRawEvidence({retention_ref:keep.retention_ref,
   retained_sha256:keep.retained_sha256,retained_bytes:keep.retained_bytes});
  phase="REAL_GFS_SCIENTIFIC_72H_DECODE";
  const d=gr.decoder as typeof gr.decoder&ExternalEvidenceFileDecoderPortV1;
  const decodeStart=Date.now();
  const drafts=await d.decodeRetainedEvidenceFile({raw_file_path:resp.file_path,provenance:gfsProv});
  gfsDecode=Date.now()-decodeStart;
  assert.equal(drafts.length,2);
  assert.deepEqual(drafts.map(x=>x.role),["FUTURE_WEATHER_ASSUMPTION","FUTURE_ET0_ASSUMPTION"]);
  assert(drafts.every(x=>x.quality.status==="PASS"));
  result.gfs={science_status:"PASS",file_backed:true,full_72h_bundle_retained:true,
   production_decoder_executed:true,real_member_provider_request_count:
    (tr as {provider_request_count?:number}).provider_request_count??null,
   retained_full_bundle_sha256:keep.retained_sha256,raw_bundle_bytes:resp.raw_bytes,
   scientific_decode_ms:gfsDecode,actual_semantic_draft_count:drafts.length};
  await resp.cleanup();
  result.status="PASS_GENUINE_PROVIDER_FULL_72H_S3_SCIENCE_NOT_PG";
 }catch(e){result.status="HOLD_REAL_PROVIDER_FULL_S3_SCIENCE";
  result.failure_phase=phase;result.reason_code=why(e);}
 finally{
  result.real_http_get_count=realGets;result.private_retention_operations=retained;
  result.end_to_end_ms=Date.now()-captureStart;
  result.kbs_scientific_decode_ms=kbsDecode;result.gfs_scientific_decode_ms=gfsDecode;
  result.provider_capture_completed=result.status==="PASS_GENUINE_PROVIDER_FULL_72H_S3_SCIENCE_NOT_PG";
  result.pg_fenced_promotion_executed=false;result.qualified=false;
  fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log(JSON.stringify({status:result.status,failure_phase:result.failure_phase??null,
   reason_code:result.reason_code??null,private_retentions:retained,real_gets:realGets,
   receipt:out,no_permit:true}));
 }
 if(result.status!=="PASS_GENUINE_PROVIDER_FULL_72H_S3_SCIENCE_NOT_PG")process.exitCode=3;
}
main().catch(e=>{console.error("STAGE3_REAL_PROVIDER_FULL_ISOLATED_HOLD:"+why(e));process.exitCode=1});
