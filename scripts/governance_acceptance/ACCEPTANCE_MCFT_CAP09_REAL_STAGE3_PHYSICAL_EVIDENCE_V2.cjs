"use strict";
// Synthetic, locally generated regression only; no CE94 raw credentials/data,
// no network/Provider/PG/S3 and no Permit or Host authorization.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const v2=require("./MCFT_CAP09_REAL_STAGE3_PHYSICAL_EVIDENCE_V2.cjs");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-real-v2-synth-"));
const sha=v2.sha;
let count=0;
function checkReject(fn,pattern){let caught=false;try{fn();}catch(e){caught=true;assert.match(String(e.message),pattern);}assert(caught,"SYNTHETIC_FALSE_ACCEPTANCE");count++;}
function put(p,value){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==="string"?value:JSON.stringify(value,null,2)+"\n");return p;}
try{
  process.env.CAP09_REAL_STAGE3_V2_SYNTHETIC_TEST="1";
  const RUN="abcdef012346",SUBJECT="a".repeat(40),candidate="sha256:"+"b".repeat(64),base="2026-10-26T17:00:00.000Z";
  const sourceRoot=path.join(tmp,"source"),entryPath=v2.PROFILE.entry_path;
  const source=Buffer.from("// synthetic Stage3 entry, NEVER live original\n");
  const entryFile=path.join(sourceRoot,entryPath);put(entryFile,source.toString());
  const blob=crypto.createHash("sha1").update(Buffer.from(`blob ${source.length}\0`)).update(source).digest("hex");
  const original={schema_version:"geox_mcft_cap09_stage3_full_real_provider_one_base_pg_s3_v1",
    status:"PASS_WINDOWS_ONE_FULL_REAL_GFS72_KBS_S3_PG_BASE_NOT_ORIGINAL_V13_TIMING",run_id:RUN,subject_sha:SUBJECT,
    base_target_t:base,candidate_digest:candidate,fixture_used:false,real_provider_transport_required:true,
    gfs_72h_complete_with_actual_scientific_decoder:true,kbs_continuity_actual_scientific_decoder:true,
    physical_fenced_fact_count:3,controller_cursor_advanced:true,real_provider_get_count:223,
    windows_native_execution:true,ci_execution:false,real_original_six_stage_count:0,
    original_v13_producer_entry_executed:false,original_v13_timing_v2_executed:false,
    original_aggregate_executed:false,formal_timing_qualified:false,qualified:false,
    permit_signed:false,permit_consumed:false,production_authorized:false};
  const originalFile=put(path.join(tmp,"fake-original.json"),original);
  const r={schema_version:"geox_mcft_cap09_ce94_readonly_postrun_consistency_v1",
    scope:"CURRENT_PHYSICAL_READONLY_SNAPSHOT_NOT_HISTORICAL_EXECUTION_ATTESTATION",
    original_receipt_sha256:sha(fs.readFileSync(originalFile)),run_id:RUN,source_sha:SUBJECT,
    observed_at_utc:"2026-10-26T07:22:46.494Z",
    pg:{status:"PASS_SNAPSHOT",database:`mcft_cap09_requal_${RUN}_positive`,total_facts:3,formal_facts:3,
      direct_insert:false,fenced_execute:true,cursor_completed:true,cursor_next_missing_base:null,
      target_state:"FORMAL_VISIBLE_ATTESTED",target_candidate_digest:candidate,
      readback_at:"2026-10-26T06:27:11.027+00:00",attested_at:"2026-10-26T06:27:11.040241+00:00"},
    s3:{status:"PASS_CURRENT_LISTING",bucket:`mcft-cap09-requal-${RUN}`,listed_file_count:223,
      manifest_private_readback_now:true,manifest_identity_matched:true,manifest_raw_count:2,manifest_expected_record_count:3,
      raw_contents_rehashed:false,manifest_contents_rehashed:false,
      raw_object_checks:[{listed_once:true,bytes_equal:true,content_sha256_recomputed:false},{listed_once:true,bytes_equal:true,content_sha256_recomputed:false}]},
    original_six_stages_executed:0,provider_calls:0,sql_writes:0,s3_writes:0,docker_mutations:0,
    permit_signed:false,permit_consumed:false,execution_authorized:false};
  const readonlyFile=put(path.join(tmp,"fake-readonly.json"),r);
  const profile=Object.freeze({...v2.PROFILE,synthetic_only:true,run_id:RUN,source_sha:SUBJECT,candidate_digest:candidate,
    original_receipt_sha256:sha(fs.readFileSync(originalFile)),readonly_receipt_sha256:sha(fs.readFileSync(readonlyFile)),
    entry_git_blob_sha1:blob});
  const unit=v2.testOnlySyntheticProfile(profile);
  const files={originalFile,readonlyFile,sourceRoot};
  const evidence=unit.build(files);count++;
  assert.equal(evidence.limits.formal_admission,false);
  assert.equal(evidence.limits.execution_authorized,false);
  assert.equal(evidence.limits.original_six_stage_executed,0);
  for(const status of Object.values(evidence.not_proved))assert.equal(status,"UNKNOWN");
  const evidenceFile=put(path.join(tmp,"fake-evidence.json"),evidence);
  const result=unit.verifyEvidence({evidenceFile,...files});count++;
  assert.equal(result.status,"PASS_SCOPE_LIMITED_NOT_HOST_ADMISSION");
  // Signature test key is generated solely within ephemeral test process.
  const keyPair=crypto.generateKeyPairSync("ed25519"), signedAt="2026-10-26T08:00:00.000Z";
  const reviewer={reviewer_id:"fictional_v2_reviewer",key_id:"ephemeral_synthetic_key",role:"CE94_EVIDENCE_REVIEW_ONLY",
    revoked:false,not_before:"2026-10-25T00:00:00.000Z",not_after:"2026-10-28T00:00:00.000Z",
    spki_sha256:sha(keyPair.publicKey.export({type:"spki",format:"der"})),
    public_key_pem:keyPair.publicKey.export({type:"spki",format:"pem"})};
  const trust={reviewers:[reviewer]};
  const payload={schema_version:"geox_mcft_cap09_real_stage3_review_attestation_v2",reviewer_id:reviewer.reviewer_id,
    key_id:reviewer.key_id,role:reviewer.role,reviewed_run_id:RUN,reviewed_subject_sha:SUBJECT,
    evidence_sha256:result.evidence_sha256,signed_at:signedAt,
    scope:"CE94_PHYSICAL_OBSERVATIONS_ONLY_NOT_HOST_ADMISSION",
    permit_signed:false,execution_authorized:false,production_authorized:false};
  function sign(p){return {payload:p,signature_base64:crypto.sign(null,Buffer.from(v2.DOMAIN+v2.canon(p)),keyPair.privateKey).toString("base64")};}
  function verify(p,sig){const attestationFile=put(path.join(tmp,"candidate-attest.json"),sig??sign(p));
    return unit.verifyReview({attestationFile,evidenceFile,...files,trust,now:Date.parse("2026-10-26T08:10:00Z")});}
  const signed=sign(payload),attestationFile=put(path.join(tmp,"fake-attestation.json"),signed);
  const signedResult=unit.verifyReview({attestationFile,evidenceFile,...files,trust,now:Date.parse("2026-10-26T08:10:00Z")});
  assert.equal(signedResult.status,"PASS_SIGNED_CE94_SCOPE_LIMITED_REVIEW_ONLY");
  assert.equal(signedResult.v1_full_chain_pass,false);assert.equal(signedResult.execute_authorized,false);count++;
  function tamperEvidence(mut,match){const changed=structuredClone(evidence);mut(changed);put(evidenceFile,changed);
    checkReject(()=>unit.verifyEvidence({evidenceFile,...files}),match);put(evidenceFile,evidence);}
  tamperEvidence(e=>e.identity.run_id="000000000000",/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.identity.subject_sha="f".repeat(40),/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.immutable.original_receipt_sha256="0".repeat(64),/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.tested_source.sha256="f".repeat(64),/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.not_proved.promotion_provider_refetch_historical_count="PASS",/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.not_proved.cursor_state_immediately_before_attestation="PASS",/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.demonstrated.readonly_attestation_time="2026-10-26T06:26:00.000Z",/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.limits.production_authorized=true,/NOT_BYTE_GROUNDED/);
  tamperEvidence(e=>e.limits.execution_authorized=true,/NOT_BYTE_GROUNDED/);
  const fakeSignature={...signed,signature_base64:"A"+signed.signature_base64.slice(1)};
  put(attestationFile,fakeSignature);
  checkReject(()=>unit.verifyReview({attestationFile,evidenceFile,...files,trust,now:Date.parse("2026-10-26T08:10:00Z")}),/SIGNATURE_INVALID/);
  put(attestationFile,signed);
  function tamperPayload(change,match){const p=structuredClone(payload);change(p);put(attestationFile,sign(p));
    checkReject(()=>unit.verifyReview({attestationFile,evidenceFile,...files,trust,now:Date.parse("2026-10-26T08:10:00Z")}),match);put(attestationFile,signed);}
  tamperPayload(p=>p.role="PRODUCTION_OWNER",/PRODUCTION_REVIEWER_IMPERSONATION/);
  tamperPayload(p=>p.execution_authorized=true,/REVIEW_CANNOT_AUTHORIZE/);
  tamperPayload(p=>p.permit_signed=true,/REVIEW_CANNOT_AUTHORIZE/);
  tamperPayload(p=>p.signed_at="2026-10-27T00:00:00.000Z",/TIME_INVALID_OR_STALE/);
  tamperPayload(p=>p.reviewed_run_id="0".repeat(12),/WRONG_RUN/);
  tamperPayload(p=>p.reviewed_subject_sha="0".repeat(40),/WRONG_SUBJECT/);
  tamperPayload(p=>p.evidence_sha256="0".repeat(64),/SIGNED_EVIDENCE_REPLACED/);
  const sourceOriginal=fs.readFileSync(entryFile);
  fs.appendFileSync(entryFile,"// tampering\n");
  checkReject(()=>unit.verifyEvidence({evidenceFile,...files}),/SOURCE_GIT_BLOB_CHANGED/);
  fs.writeFileSync(entryFile,sourceOriginal);
  const badOriginal=fs.readFileSync(originalFile);
  fs.appendFileSync(originalFile," ");
  checkReject(()=>unit.verifyEvidence({evidenceFile,...files}),/ORIGINAL_RECEIPT_REPLACED/);
  fs.writeFileSync(originalFile,badOriginal);
  const badSnapshot=fs.readFileSync(readonlyFile);
  fs.appendFileSync(readonlyFile," ");
  checkReject(()=>unit.verifyEvidence({evidenceFile,...files}),/READONLY_RECEIPT_REPLACED/);
  fs.writeFileSync(readonlyFile,badSnapshot);
  checkReject(()=>v2.verifyEvidence({evidenceFile,...files}),/ORIGINAL_RECEIPT_REPLACED/);
  assert.equal(process.env.MCFT_GOVERNED_RETRY_STAGE,undefined);
  console.log(JSON.stringify({status:"PASS_SYNTHETIC_V2_SCOPE_ONLY_POSITIVE_AND_NEGATIVES",checks:count,
    original_receipts_uploaded_to_ci:false,actual_ce94_cryptographic_attestation_created:false,
    stage_executed:0,permit_signed:false,v1_gate_modified:false}));
}finally{
  delete process.env.CAP09_REAL_STAGE3_V2_SYNTHETIC_TEST;
  fs.rmSync(tmp,{recursive:true,force:true});
}
