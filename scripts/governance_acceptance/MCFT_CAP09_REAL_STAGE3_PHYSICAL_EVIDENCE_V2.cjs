"use strict";
/**
 * REAL_STAGE3_PHYSICAL_EVIDENCE_V2: immutable, scope-limited scientific/physical
 * observation and independent reviewer attestation. NOT Host admission or Permit.
 * No Provider, PG, S3, network, git mutation, or credential access in this module.
 * Never infer historical facts from postrun snapshot.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const DOMAIN = "GEOX_MCFT_CAP09_REAL_STAGE3_PHYSICAL_EVIDENCE_V2_REVIEW_ONLY\n";
const PROFILE = Object.freeze({
  run_id: "ce94f97c2cf1",
  source_sha: "f654fff21e5aa05bfa6c79e67ea34fb53b61cdfb",
  original_receipt_sha256: "90092cb6051840be9748f2ba4f99e105d6c472a17ebcb1ce3d4d0fc7767f3130",
  readonly_receipt_sha256: "8f7f6295e7febeccd69327ce88323d0e43df63947e19f36401c3a70b93a1609a",
  candidate_digest: "sha256:a615cbcd958adcb39fbb5f4e8fea9b9328b03fa70f14cdbff437842be32d981f",
  entry_path: "scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_STAGE3_REAL_FULL_PROVIDER_ONE_BASE_V1.ts",
  entry_git_blob_sha1: "95bf88e2584ea01651c30ab18907c77995941542",
  observed_at_utc: "2026-10-26T07:22:46.494Z",
  post_commit_readback_at: "2026-10-26T06:27:11.027+00:00",
  formal_visible_attested_at: "2026-10-26T06:27:11.040241+00:00"
});
const UNPROVED = Object.freeze({
  raw_content_sha256_independently_recomputed: "UNKNOWN",
  candidate_manifest_content_sha256_independently_recomputed: "UNKNOWN",
  single_fenced_transaction_historical_event_trace: "UNKNOWN",
  promotion_provider_refetch_historical_count: "UNKNOWN",
  cursor_state_immediately_before_attestation: "UNKNOWN",
  windows_runtime_source_bytes_independently_attested: "UNKNOWN",
  original_three_timing_v2_samples: "UNKNOWN"
});
const NOT_RECOVERABLE_FROM_THESE_RECEIPTS = Object.freeze([
  "single_fenced_transaction_historical_event_trace",
  "promotion_provider_refetch_historical_count",
  "cursor_state_immediately_before_attestation",
  "windows_runtime_source_bytes_independently_attested",
  "original_three_timing_v2_samples"
]);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const hex64 = s => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
const canon = value => {
  if(Array.isArray(value)) return "[" + value.map(canon).join(",") + "]";
  if(value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+canon(value[k])).join(",") + "}";
  return JSON.stringify(value);
};
function regularBytes(file, cap=1024*1024){
  assert(typeof file === "string" && path.isAbsolute(file), "V2_ABSOLUTE_FILE_REQUIRED");
  const s=fs.lstatSync(file);
  assert(s.isFile() && !s.isSymbolicLink() && s.size>0 && s.size<=cap, "V2_REGULAR_FILE_REQUIRED");
  return fs.readFileSync(file);
}
function deepExact(a,b,code){assert.deepEqual(a,b,code);}
function createScopedValidator(profile){
  assert(Object.isFrozen(profile),"V2_PROFILE_MUST_BE_IMMUTABLE");
function sourceIdentity(root){
  assert(typeof root==="string" && path.isAbsolute(root), "V2_SOURCE_ROOT_ABSOLUTE_REQUIRED");
  const file=path.join(root, profile.entry_path);
  const bytes=regularBytes(file,2*1024*1024);
  const gitBlob=crypto.createHash("sha1").update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest("hex");
  assert.equal(gitBlob,profile.entry_git_blob_sha1,"V2_WINDOWS_STAGE3_SOURCE_GIT_BLOB_CHANGED");
  return {path:profile.entry_path,git_blob_sha1:gitBlob,sha256:sha(bytes)};
}
function checkedInputs({originalFile, readonlyFile,sourceRoot}){
  const originalBytes=regularBytes(originalFile),readonlyBytes=regularBytes(readonlyFile);
  assert.equal(sha(originalBytes),profile.original_receipt_sha256,"V2_ORIGINAL_RECEIPT_REPLACED");
  assert.equal(sha(readonlyBytes),profile.readonly_receipt_sha256,"V2_READONLY_RECEIPT_REPLACED");
  const o=JSON.parse(originalBytes.toString("utf8"));
  const r=JSON.parse(readonlyBytes.toString("utf8"));
  assert.equal(o.schema_version,"geox_mcft_cap09_stage3_full_real_provider_one_base_pg_s3_v1");
  assert.equal(o.status,"PASS_WINDOWS_ONE_FULL_REAL_GFS72_KBS_S3_PG_BASE_NOT_ORIGINAL_V13_TIMING");
  assert.equal(o.run_id,profile.run_id,"V2_WRONG_RUN_ID");
  assert.equal(o.subject_sha,profile.source_sha,"V2_WRONG_SUBJECT");
  assert.equal(o.candidate_digest,profile.candidate_digest,"V2_WRONG_CANDIDATE");
  assert.equal(o.fixture_used,false,"V2_FIXTURE_MASQUERADE");
  assert.equal(o.real_provider_transport_required,true);
  assert.equal(o.gfs_72h_complete_with_actual_scientific_decoder,true);
  assert.equal(o.kbs_continuity_actual_scientific_decoder,true);
  assert.equal(o.physical_fenced_fact_count,3);
  assert.equal(o.controller_cursor_advanced,true);
  assert.equal(o.real_provider_get_count,223);
  assert.equal(o.windows_native_execution,true);
  assert.equal(o.ci_execution,false);
  assert.equal(o.real_original_six_stage_count,0);
  for(const k of ["original_v13_producer_entry_executed","original_v13_timing_v2_executed","original_aggregate_executed","formal_timing_qualified","qualified","permit_signed","permit_consumed","production_authorized"])
    assert.equal(o[k],false,"V2_FORBIDDEN_FORMAL_CLAIM:"+k);
  assert.equal(r.schema_version,"geox_mcft_cap09_ce94_readonly_postrun_consistency_v1");
  assert.equal(r.scope,"CURRENT_PHYSICAL_READONLY_SNAPSHOT_NOT_HISTORICAL_EXECUTION_ATTESTATION");
  assert.equal(r.original_receipt_sha256,profile.original_receipt_sha256);
  assert.equal(r.run_id,profile.run_id,"V2_READONLY_WRONG_RUN");
  assert.equal(r.source_sha,profile.source_sha,"V2_READONLY_WRONG_SUBJECT");
  assert.equal(r.observed_at_utc,profile.observed_at_utc,"V2_UNGROUNDED_SNAPSHOT_TIME");
  assert.equal(r.pg.status,"PASS_SNAPSHOT");
  assert.equal(r.pg.database,`mcft_cap09_requal_${profile.run_id}_positive`);
  assert.equal(r.pg.total_facts,3);assert.equal(r.pg.formal_facts,3);
  assert.equal(r.pg.direct_insert,false);assert.equal(r.pg.fenced_execute,true);
  assert.equal(r.pg.cursor_completed,true);
  assert.equal(r.pg.cursor_next_missing_base,null);
  assert.equal(r.pg.target_state,"FORMAL_VISIBLE_ATTESTED");
  assert.equal(r.pg.target_candidate_digest,profile.candidate_digest);
  assert.equal(r.pg.readback_at,profile.post_commit_readback_at,"V2_UNGROUNDED_READBACK_TIME");
  assert.equal(r.pg.attested_at,profile.formal_visible_attested_at,"V2_UNGROUNDED_ATTESTATION_TIME");
  assert(Date.parse(r.pg.readback_at)<Date.parse(r.pg.attested_at) &&
    Date.parse(r.pg.attested_at)<Date.parse(r.observed_at_utc),"V2_IMPOSSIBLE_EVENT_ORDER");
  assert.equal(r.s3.status,"PASS_CURRENT_LISTING");
  assert.equal(r.s3.bucket,`mcft-cap09-requal-${profile.run_id}`);
  assert.equal(r.s3.listed_file_count,223);
  assert.equal(r.s3.manifest_private_readback_now,true);
  assert.equal(r.s3.manifest_identity_matched,true);
  assert.equal(r.s3.manifest_raw_count,2);
  assert.equal(r.s3.manifest_expected_record_count,3);
  assert.equal(r.s3.raw_contents_rehashed,false);
  assert.equal(r.s3.manifest_contents_rehashed,false);
  assert.equal(r.s3.raw_object_checks.length,2);
  for(const x of r.s3.raw_object_checks){
    assert.equal(x.listed_once,true);assert.equal(x.bytes_equal,true);
    assert.equal(x.content_sha256_recomputed,false);
  }
  assert.equal(r.original_six_stages_executed,0);
  for(const k of ["provider_calls","sql_writes","s3_writes","docker_mutations"])
    assert.equal(r[k],0,"V2_SNAPSHOT_SIDE_EFFECTS_NOT_ZERO:"+k);
  for(const k of ["permit_signed","permit_consumed","execution_authorized"])
    assert.equal(r[k],false,"V2_SNAPSHOT_FORMAL_AUTHORITY_FORBIDDEN:"+k);
  const entry=sourceIdentity(sourceRoot);
  return {o,r,entry};
}
function build({originalFile,readonlyFile,sourceRoot}){
  const {o,r,entry}=checkedInputs({originalFile,readonlyFile,sourceRoot});
  const evidence={
    schema_version:"geox_mcft_cap09_real_stage3_physical_evidence_v2",
    kind:"REAL_STAGE3_PHYSICAL_EVIDENCE_V2",
    result:"PASS_SCOPE_LIMITED_REVIEWABLE_NOT_EXECUTION_ADMISSION",
    identity:{run_id:profile.run_id,subject_sha:profile.source_sha,candidate_digest:profile.candidate_digest},
    immutable:{original_receipt_sha256:profile.original_receipt_sha256,readonly_receipt_sha256:profile.readonly_receipt_sha256},
    tested_source:{...entry,subject_sha:profile.source_sha,windows_runtime_byte_proof:"UNKNOWN"},
    demonstrated:{
      actual_scientific_provider:true,fixture_used:false,original_provider_get_count:o.real_provider_get_count,
      gfs_72h_decoder_pass:true,kbs_continuity_decoder_pass:true,
      fenced_formal_facts_at_stage3_exit:3,cursor_advanced_at_stage3_exit:true,
      readonly_snapshot_at_utc:r.observed_at_utc,readonly_pg_total_facts:3,readonly_pg_formal_facts:3,
      readonly_pg_direct_insert_allowed:false,readonly_pg_fenced_execute_allowed:true,
      readonly_cursor_completed:true,readonly_target_state:r.pg.target_state,
      readonly_attestation_time:r.pg.attested_at,readonly_readback_time:r.pg.readback_at,
      readonly_manifest_readback:true,readonly_manifest_raw_refs:2,readonly_manifest_semantic_records:3,
      readonly_s3_list_count:223,raw_listed_size_matching:true,raw_content_sha256_recomputed:false
    },
    not_proved:{...UNPROVED},
    unrecoverable_from_attached_receipts:[...NOT_RECOVERABLE_FROM_THESE_RECEIPTS],
    limits:{historic_ce94_reexecution:false,original_six_stage_executed:0,
      formal_admission:false,permit_signed:false,permit_consumed:false,
      execution_authorized:false,production_authorized:false,
      v1_mandatory_gate_satisfied:false},
  };
  return evidence;
}
function verifyEvidence({evidenceFile,originalFile,readonlyFile,sourceRoot}){
  const bytes=regularBytes(evidenceFile);
  const parsed=JSON.parse(bytes.toString("utf8"));
  deepExact(parsed,build({originalFile,readonlyFile,sourceRoot}),"V2_EVIDENCE_NOT_BYTE_GROUNDED_OR_UNKNOWN_PROMOTED");
  return {status:"PASS_SCOPE_LIMITED_NOT_HOST_ADMISSION",evidence_sha256:sha(bytes),
    formal_admission:false,permit_signed:false,execution_authorized:false};
}
function verifyReview({attestationFile,evidenceFile,originalFile,readonlyFile,sourceRoot,trust,now=Date.now()}){
  const verified=verifyEvidence({evidenceFile,originalFile,readonlyFile,sourceRoot});
  const signed=JSON.parse(regularBytes(attestationFile).toString("utf8"));
  assert.deepEqual(Object.keys(signed).sort(),["payload","signature_base64"],"V2_ENVELOPE_FIELDS_INVALID");
  const p=signed.payload;
  assert.deepEqual(Object.keys(p).sort(),[
    "schema_version","reviewer_id","key_id","role","reviewed_run_id","reviewed_subject_sha",
    "evidence_sha256","signed_at","scope","permit_signed","execution_authorized","production_authorized"
  ].sort(),"V2_REVIEW_PAYLOAD_FIELDS_INVALID");
  assert.equal(p.schema_version,"geox_mcft_cap09_real_stage3_review_attestation_v2");
  assert.equal(p.scope,"CE94_PHYSICAL_OBSERVATIONS_ONLY_NOT_HOST_ADMISSION");
  assert.equal(p.reviewed_run_id,profile.run_id,"V2_REVIEW_WRONG_RUN");
  assert.equal(p.reviewed_subject_sha,profile.source_sha,"V2_REVIEW_WRONG_SUBJECT");
  assert.equal(p.evidence_sha256,verified.evidence_sha256,"V2_SIGNED_EVIDENCE_REPLACED");
  assert.equal(p.role,"CE94_EVIDENCE_REVIEW_ONLY","V2_PRODUCTION_REVIEWER_IMPERSONATION");
  for(const k of ["permit_signed","execution_authorized","production_authorized"])
    assert.equal(p[k],false,"V2_REVIEW_CANNOT_AUTHORIZE:"+k);
  const at=Date.parse(p.signed_at);
  assert(Number.isFinite(at) && new Date(at).toISOString()===p.signed_at && at<=now && now-at<7*86400000,
    "V2_REVIEW_TIME_INVALID_OR_STALE");
  assert(trust && Array.isArray(trust.reviewers),"V2_REVIEWER_REGISTRY_REQUIRED");
  const matches=trust.reviewers.filter(x=>x.reviewer_id===p.reviewer_id && x.key_id===p.key_id && x.role===p.role && x.revoked===false);
  assert.equal(matches.length,1,"V2_REGISTERED_REVIEW_ONLY_SIGNER_REQUIRED");
  const i=matches[0];
  assert(Date.parse(i.not_before)<=at && at<=Date.parse(i.not_after),"V2_REVIEWER_KEY_EXPIRED");
  const key=crypto.createPublicKey(i.public_key_pem);
  assert.equal(key.asymmetricKeyType,"ed25519");
  assert.equal(sha(key.export({type:"spki",format:"der"})),i.spki_sha256,"V2_REVIEWER_PUBLIC_KEY_CHANGED");
  const signature=Buffer.from(signed.signature_base64,"base64");
  assert.equal(signature.length,64,"V2_SIGNATURE_LENGTH_INVALID");
  assert.equal(signature.toString("base64"),signed.signature_base64,"V2_SIGNATURE_CANONICAL_INVALID");
  assert(crypto.verify(null,Buffer.from(DOMAIN+canon(p)),key,signature),"V2_REVIEW_SIGNATURE_INVALID");
  return {status:"PASS_SIGNED_CE94_SCOPE_LIMITED_REVIEW_ONLY",evidence_sha256:verified.evidence_sha256,
    v1_full_chain_pass:false,host_admission:false,permit_signed:false,execute_authorized:false,production_authorized:false};
}
return {build,verifyEvidence,verifyReview};
}
const production=createScopedValidator(PROFILE);
// Synthetic regression only. This cannot be passed to V1, Host or Permit,
// and is never used by the production CE94 verification functions.
function testOnlySyntheticProfile(profile){
  assert.equal(process.env.CAP09_REAL_STAGE3_V2_SYNTHETIC_TEST,"1","V2_SYNTHETIC_PROFILE_NOT_ALLOWED");
  assert.equal(profile.synthetic_only,true,"V2_TEST_PROFILE_MUST_BE_EXPLICITLY_SYNTHETIC");
  return createScopedValidator(Object.freeze({...profile}));
}
module.exports={PROFILE,DOMAIN,UNPROVED,NOT_RECOVERABLE_FROM_THESE_RECEIPTS,sha,canon,...production,testOnlySyntheticProfile};
