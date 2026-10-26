// Non-authorizing, preserved-raw Phase7 Candidate semantic rehydration on Windows.
// Uses the ORIGINAL Phase7 production algorithm and the FIXED pinned Python factory
// against SHA-verified LOCAL COPIES of previously retained KBS/GFS raw. No HTTP,
// DB, MinIO, Permit, Host, lease mutation, new Candidate or old-case replay.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import {
 ExternalFormalPrivateCandidateCapturePromotionV1,
 ProductionExternalFormalCandidateRehydrationDecoderFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.js";
import {
 normalizeExternalFormalExactBaseCandidateManifestV1,
 type ExternalFormalExactBaseCandidateManifestV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_candidate_manifest_store_v1.js";
import {MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";

const run="b06f28c950ce";
const oldSha="c1ed4a64b78a1a5346ac4159d98307de85ac4a6c";
const manifestHex="acb1bb7fb10b5519168e89e56cc0bafa40f156dd45736b4e08555d82050a9c16";
const expectedGfs="9e6b250ad698c20ac00174022865dfedfc3b8bed5caab7c3278e6b9c5cfcdc74";
const need=(k:string):string=>{const s=process.env[k];assert(s,"CAP09_OFFLINE_REQUIRED:"+k);return s;};
const digest=(b:Uint8Array|string):string=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
const asserted=()=>{assert.equal(process.platform,"win32");assert.equal(process.version,"v24.19.0");
 assert(!process.env.CI&&!process.env.GITHUB_ACTIONS&&!process.env.DATABASE_URL
  &&!process.env.MCFT_GOVERNED_RETRY_TICKET&&!process.env.MCFT_CAP09_ADOPTION_REQUEST,
 "CAP09_OFFLINE_FORMAL_ENV_FORBIDDEN");
 assert.equal(need("CAP09_OFFLINE_TEST_ONLY"),"1");
 assert.equal(fs.realpathSync.native(process.execPath).toLowerCase(),
  fs.realpathSync.native(need("CAP09_PINNED_NODE")).toLowerCase(),"CAP09_OFFLINE_NODE_NOT_PINNED");
 const exact=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 assert.equal(exact,need("CAP09_OFFLINE_CANDIDATE_SOURCE_SHA"),"CAP09_OFFLINE_SOURCE_CHANGED");
};
async function main(){
 asserted();
 const candidateFile=need("CAP09_OFFLINE_MANIFEST_FILE");
 const kbsPath=need("CAP09_OFFLINE_KBS_FILE"),gfsPath=need("CAP09_OFFLINE_GFS_FILE");
 const python=need("CAP09_OFFLINE_PYTHON_EXE");
 const idempotency=need("CAP09_ORIGINAL_IDEMPOTENCY_KEY");
 const outDir=need("CAP09_OFFLINE_RESULT_DIR");
 assert([candidateFile,kbsPath,gfsPath,python,outDir].every(path.isAbsolute),"CAP09_OFFLINE_ABSOLUTE_PATH_REQUIRED");
 assert(fs.existsSync(python));
 const original=fs.readFileSync(candidateFile);
 assert.equal(digest(original),"sha256:"+manifestHex,"CAP09_ORIGINAL_CANDIDATE_BYTES_CHANGED");
 const manifest=normalizeExternalFormalExactBaseCandidateManifestV1(
  JSON.parse(original.toString("utf8")) as ExternalFormalExactBaseCandidateManifestV1);
 assert.equal(manifest.subject_sha,oldSha);
 assert.equal(manifest.raw_objects.length,2);
 assert.equal(manifest.producer_run_id,"phase7-capture:"+digest(idempotency).slice(7),
  "CAP09_OFFLINE_REPLAY_IDEMPOTENCY_MISMATCH");
 assert(Date.now()<Date.parse(manifest.candidate_expires_at),
  "CAP09_ORIGINAL_CANDIDATE_EXPIRED_NO_TIME_BYPASS");
 const bucket="mcft-cap09-requal-"+run;
 const gs=manifest.raw_objects.filter(x=>x.decoder_id==="MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_V1");
 const ks=manifest.raw_objects.filter(x=>x.provider_id==="KBS_LTER");
 assert.equal(gs.length,1);assert.equal(ks.length,1);
 assert.equal(gs[0]!.retained_sha256,"sha256:"+expectedGfs);
 const localMap=new Map([[gs[0]!.retention_ref,gfsPath],[ks[0]!.retention_ref,kbsPath]]);
 for(const raw of manifest.raw_objects){
  assert(raw.retention_ref.startsWith("s3-private://"+bucket+"/mcft-cap09-formal-raw-v1/sha256/"));
  assert.equal(raw.retention_ref.split("/").at(-1),raw.retained_sha256.slice(7));
  const actual=fs.statSync(localMap.get(raw.retention_ref)!);
  assert(actual.isFile()&&actual.size===raw.retained_bytes,"CAP09_OFFLINE_RAW_BYTE_COUNT_CHANGED");
 }
 let readCount=0,forbiddenOps=0;
 const reader={
  async readRetainedRawEvidence(input:{retention_ref:string;retained_sha256:string;retained_bytes:number}){
   const raw=manifest.raw_objects.find(x=>x.retention_ref===input.retention_ref);
   assert(raw,"CAP09_OFFLINE_RAW_NOT_CANDIDATE_BOUND");
   assert.equal(input.retained_sha256,raw!.retained_sha256);
   assert.equal(input.retained_bytes,raw!.retained_bytes);
   const bytes=fs.readFileSync(localMap.get(raw!.retention_ref)!);
   assert.equal(digest(bytes),raw!.retained_sha256,"CAP09_OFFLINE_RAW_SHA_MISMATCH");
   readCount++;
   return {reader_id:MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_ID_V1,
    retention_ref:raw!.retention_ref,retained_sha256:raw!.retained_sha256,
    retained_bytes:raw!.retained_bytes,retained_at:raw!.retained_at,
    bytes:new Uint8Array(bytes),provider_refetch_count:0 as const,
    raw_store_write_count:0 as const,formal_database_write_count:0 as const};
  },
 };
 const store={ async readCandidateManifest(input:{capture_ref:string;candidate_artifact_digest:string}){
   assert.equal(input.candidate_artifact_digest,"sha256:"+manifestHex);
   assert.equal(input.capture_ref,"s3-private://"+bucket+"/mcft-cap09-formal-candidate-v1/sha256/"+manifestHex);
   return {manifest,capture_ref:input.capture_ref,candidate_artifact_digest:input.candidate_artifact_digest};
 }};
 const deny=()=>{forbiddenOps++;throw Error("CAP09_OFFLINE_FORBIDDEN_WRITE_OR_CAPTURE");};
 const service=new ExternalFormalPrivateCandidateCapturePromotionV1({
  subject_sha:oldSha,
  work_item_factory:{buildForTarget:deny} as never,
  retention:{retainRawEvidence:deny} as never,
  candidate_store:{readCandidateManifest:store.readCandidateManifest,
    writeCandidateManifest:deny} as never,
  raw_reader:reader as never,
  fenced_promotion:{promote:deny} as never,
  rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1({
   python_executable:python,
  }),
  clock:()=>new Date(),
 });
 assert.equal(Reflect.get(Reflect.get(service,"decoderFactory"),"config").python_executable,python);
 const replay=Reflect.get(service,"rehydrateCandidate") as (input:unknown)=>Promise<{
  results:Array<{record:{record_type:string;source_record_id:string};record_semantic_sha256:string}>;
 }>;
 const result=await replay.call(service,{
  base_target_t:manifest.base_target_t,
  idempotency_key:idempotency,
  capture:{base_target_t:manifest.base_target_t,producer_run_id:manifest.producer_run_id,
   candidate_artifact_digest:"sha256:"+manifestHex,
   capture_ref:"s3-private://"+bucket+"/mcft-cap09-formal-candidate-v1/sha256/"+manifestHex,
   raw_values_emitted:false,formal_database_write_count:0},
 });
 assert.equal(result.results.length,3);assert.equal(readCount,2);assert.equal(forbiddenOps,0);
 const recordTypes=result.results.map(x=>x.record.record_type).sort();
 assert.deepEqual(recordTypes,["future_et0_assumption_v1","future_weather_assumption_v1","soil_moisture_observation_v1"]);
 const receipt={schema_version:"geox_mcft_cap09_windows_preserved_local_candidate_phase7_semantic_replay_v1",
  status:"PASS_CANDIDATE_PHASE7_SEMANTIC_REHYDRATION_LOCAL_SHA_VERIFIED_ONLY",
  source_checkout_sha:need("CAP09_OFFLINE_CANDIDATE_SOURCE_SHA"),
  original_run_id:run,original_source_sha:oldSha,original_candidate_digest:"sha256:"+manifestHex,
  original_gfs_sha256:"sha256:"+expectedGfs,
  candidate_base_target_t:manifest.base_target_t,candidate_expires_at:manifest.candidate_expires_at,
  candidate_valid_at_actual_replay:true,original_phase7_algorithm_used:true,
  same_python_in_capture_and_replay_source_guarded:true,verified_raw_files:readCount,
  semantic_records:recordTypes,semantic_manifest_matched_by_original_phase7:true,
  raw_reader_type:"LOCAL_DIGEST_VERIFIED_COPY_NOT_S3_HEAD_PORT",
  provider_http_calls:0,s3_calls:0,s3_writes:0,pg_reads:0,pg_writes:0,
  producer_capture_executed:false,original_host_executed:false,
  formal_fenced_pg_verified:false,controller_cursor_advanced:false,
  original_v13_timing_qualified:false,permit_signed:false,permit_consumed:false,
  production_authorized:false,qualified:false};
 assert(!fs.existsSync(outDir),"CAP09_OFFLINE_RESULT_ALREADY_EXISTS");
 fs.mkdirSync(outDir,{recursive:false,mode:0o700});
 const out=path.join(outDir,"CANDIDATE_PHASE7_OFFLINE_SEMANTIC_V1.json");
 fs.writeFileSync(out,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
 console.log(JSON.stringify({status:receipt.status,semantic_records:recordTypes,
  candidate_digest:receipt.original_candidate_digest,
  raw_reads:readCount,public_receipt:out,receipt_sha256:digest(fs.readFileSync(out)),
  provider_calls:0,pg_writes:0,s3_writes:0,permit:false}));
}
main().catch(e=>{const msg=String(e instanceof Error?e.message:e).replace(/[\r\n]/g," ").slice(0,230);
 console.error("CAP09_PRESERVED_CANDIDATE_HOLD:"+msg);process.exitCode=3;});
