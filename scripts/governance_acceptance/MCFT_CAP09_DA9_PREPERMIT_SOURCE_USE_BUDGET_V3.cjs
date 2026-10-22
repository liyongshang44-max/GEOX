"use strict";
// Official V3 pre-Permit source-at-use budget verifier.
// Does NOT fabricate a future Provider SLA. No network, keys or stage effects.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const CONTRACT="geox_mcft_cap09_prepermit_source_use_budget_v3";
const CLASSIFICATION="REVIEWED_STAGE_CEILINGS_NOT_ACTUAL_SIX_STAGE_MEASUREMENT";
const RUN="da9db7129607";
const STAGES=["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"];
const SHA=/^[a-f0-9]{64}$/,SUBJECT=/^[a-f0-9]{40}$/;
const SOURCE_TYPES=["HISTORIC_REAL_GFS_ACQUISITION","HISTORIC_REAL_KBS_CONTINUITY","OPERATOR_REVIEWED_STAGE_CAPS"];
const EXPECTED={
  HISTORIC_REAL_GFS_ACQUISITION:"8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a",
  HISTORIC_REAL_KBS_CONTINUITY:"d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e"
};
const CODE_PATHS=[
 "apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.ts",
 "apps/server/src/external_evidence/provider/gfs_nomads_live_provider_v1.ts",
 "apps/server/src/external_evidence/provider/gfs_nomads_raw_bundle_composer_v1.ts",
 "apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts"
];
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function exact(o,fields,tag){
  assert(o&&typeof o==="object"&&!Array.isArray(o),tag+"_OBJECT_REQUIRED");
  assert.deepEqual(Object.keys(o).sort(),[...fields].sort(),tag+"_FIELDS_INVALID");
}
function epoch(value,tag){
  assert(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),tag+"_FORMAT");
  const n=Date.parse(value);
  assert(Number.isFinite(n)&&new Date(n).toISOString()===value,tag+"_INVALID");
  return n;
}
function safeFile(filename,releaseRoot,tag){
  assert(typeof filename==="string"&&path.isAbsolute(filename),tag+"_ABSOLUTE_REQUIRED");
  const info=fs.lstatSync(filename);
  assert(info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<=8_000_000,tag+"_REGULAR_REQUIRED");
  const r=fs.realpathSync(releaseRoot),f=fs.realpathSync(filename),rel=path.relative(r,f);
  assert(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),tag+"_MUST_BE_OUTSIDE_SIGNED_RELEASE");
  return fs.readFileSync(filename);
}
function pinnedSourceCode(sourceRoot){
  assert(typeof sourceRoot==="string"&&path.isAbsolute(sourceRoot),"V3_SOURCE_ROOT_REQUIRED");
  const hashes={};
  for(const relative of CODE_PATHS){
    const target=path.join(sourceRoot,relative),st=fs.lstatSync(target);
    assert(st.isFile()&&!st.isSymbolicLink(),"V3_CANONICAL_SOURCE_MISSING:"+relative);
    const bytes=fs.readFileSync(target);
    assert(bytes.length>0,"V3_CANONICAL_SOURCE_EMPTY:"+relative);
    hashes[relative]=sha(bytes);
  }
  const soil=fs.readFileSync(path.join(sourceRoot,CODE_PATHS[0]),"utf8");
  const phase7=fs.readFileSync(path.join(sourceRoot,CODE_PATHS[3]),"utf8");
  const gfs=fs.readFileSync(path.join(sourceRoot,CODE_PATHS[1]),"utf8");
  assert(/LATEST_MAX_AGE_MINUTES\s*=\s*30\b/.test(soil),"V3_SOIL_30MIN_DECODER_SEMANTICS_REQUIRED");
  assert(/latestMs/.test(soil)&&/LATEST_MAX_AGE_MINUTES/.test(soil)&&/uniqueContinuityPointsV1/.test(soil),"V3_SOIL_CONTINUITY_DECODER_REQUIRED");
  assert(/CAPTURE_FAMILIES[^\n]*\[\s*"KBS_SOIL"\s*,\s*"GFS_BUNDLE"\s*\]/.test(phase7),"V3_EXACT_PRODUCER_SOURCE_SET_REQUIRED");
  assert(/CAPTURE_COMPLETED_AT_OR_AFTER_BASE/.test(phase7),"V3_BEFORE_BASE_CAPTURE_REQUIRED");
  assert(/same_exact_cycle_required:\s*true/.test(gfs)&&/future_file_waiting_forbidden:\s*true/.test(gfs),"V3_GFS_CAUSAL_CYCLE_REQUIRED");
  assert(/max_lead:\s*120/.test(gfs)&&/point_count:\s*72/.test(gfs),"V3_GFS_72H_MEMBER_AUTHORITY_REQUIRED");
  return hashes;
}
function evaluate({budget,stagePlan,context,sourceRoot}){
  exact(budget,["schema_version","classification","scope","run_id","subject_sha","first_base","stage_timeout_sum_ms","safety_margin_ms","source_use_mode","source_code_sha256","sources","review_authority_ref"],"V3_BUDGET");
  assert.equal(budget.schema_version,CONTRACT,"V3_BUDGET_VERSION");
  assert.equal(budget.classification,CLASSIFICATION,"V3_BUDGET_CLASSIFICATION");
  assert.equal(budget.scope,"TEST_ONLY","V3_PRODUCTION_FORBIDDEN");
  assert.equal(budget.run_id,RUN,"V3_DA9_ONLY");
  assert(SUBJECT.test(budget.subject_sha),"V3_SUBJECT_REQUIRED");
  assert.equal(budget.run_id,context.runId,"V3_RUN_MISMATCH");
  assert.equal(budget.subject_sha,context.subjectSha,"V3_SUBJECT_MISMATCH");
  assert.equal(budget.first_base,context.firstBase,"V3_FIRST_BASE_MISMATCH");
  assert.equal(budget.source_use_mode,"LIVE_AT_EACH_REAL_CAPTURE_NO_PROVIDER_SLA","V3_SOURCE_USE_MODE_REQUIRED");
  assert(!Object.hasOwn(budget,"provider_deadline_utc"),"V3_EXTERNAL_DEADLINE_FORBIDDEN");
  assert(!Object.hasOwn(context,"providerDeadlineUtc"),"V3_EXTERNAL_DEADLINE_CONTEXT_FORBIDDEN");
  const now=epoch(context.nowUtc,"V3_NOW"),t1=epoch(budget.first_base,"V3_FIRST_BASE");
  const permit=epoch(context.permitExpiresAt,"V3_PROPOSED_OR_SIGNED_PERMIT_EXPIRY");
  const adoption=epoch(context.adoptionExpiresAt,"V3_VERIFIED_ADOPTION_EXPIRY");
  assert(budget.first_base.endsWith(":00:00.000Z"),"V3_FIRST_BASE_HOUR_REQUIRED");
  assert(t1>now&&permit>now&&adoption>now,"V3_FUTURE_EXPIRY_REQUIRED");
  assert(permit<=adoption,"V3_PERMIT_OUTLIVES_ADOPTION");
  exact(stagePlan,["schema_version","stages"],"V3_STAGE_PLAN");
  assert.equal(stagePlan.schema_version,"geox_mcft_cap09_retry_stage_plan_v2","V3_STAGE_PLAN_VERSION");
  assert(Array.isArray(stagePlan.stages)&&stagePlan.stages.length===6,"V3_STAGE_COUNT");
  const sum=stagePlan.stages.reduce((n,row,i)=>{
    exact(row,["id","timeout_ms"],"V3_STAGE");
    assert.equal(row.id,STAGES[i],"V3_STAGE_ORDER");
    assert(Number.isSafeInteger(row.timeout_ms)&&row.timeout_ms>=1000&&row.timeout_ms<=3600000,"V3_STAGE_CAP_INVALID");
    return n+row.timeout_ms;
  },0);
  assert(Number.isSafeInteger(budget.stage_timeout_sum_ms)&&budget.stage_timeout_sum_ms===sum,"V3_SIGNED_STAGE_CAP_SUM_MISMATCH");
  assert.equal(budget.safety_margin_ms,context.safetyMarginMs,"V3_SIGNED_MARGIN_MISMATCH");
  assert(Number.isSafeInteger(budget.safety_margin_ms)&&budget.safety_margin_ms>0,"V3_POSITIVE_MARGIN_REQUIRED");
  assert(now+sum+budget.safety_margin_ms<Math.min(t1,permit,adoption),"V3_HARD_DEADLINE_CAPACITY_INSUFFICIENT");
  const sourceHashes=pinnedSourceCode(sourceRoot);
  exact(budget.source_code_sha256,CODE_PATHS,"V3_SOURCE_CODE_HASH_SET");
  for(const p of CODE_PATHS)assert.equal(budget.source_code_sha256[p],sourceHashes[p],"V3_FROZEN_SCIENTIFIC_SOURCE_CHANGED:"+p);
  assert(typeof budget.review_authority_ref==="string"&&budget.review_authority_ref.length>=16&&budget.review_authority_ref.length<=512,"V3_REVIEW_AUTHORITY_REQUIRED");
  assert(Array.isArray(budget.sources)&&budget.sources.length===3,"V3_THREE_SOURCE_EVIDENCE_REQUIRED");
  assert.deepEqual(budget.sources.map(s=>s.kind),SOURCE_TYPES,"V3_SOURCE_ORDER_INVALID");
  const filepaths=new Set(),records=[];
  for(const e of budget.sources){
    exact(e,["kind","path","sha256"],"V3_SOURCE");
    assert(SHA.test(e.sha256),"V3_SOURCE_HASH_REQUIRED");
    const normal=path.resolve(e.path).toLowerCase();
    assert(!filepaths.has(normal),"V3_DUPLICATE_SOURCE_FILE");
    filepaths.add(normal);
    if(EXPECTED[e.kind])assert.equal(e.sha256,EXPECTED[e.kind],"V3_DA9_HISTORICAL_SOURCE_DIGEST_CHANGED");
    const bytes=safeFile(e.path,sourceRoot,"V3_SOURCE");
    assert.equal(sha(bytes),e.sha256,"V3_SOURCE_BYTES_CHANGED:"+e.kind);
    records.push(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,"")));
  }
  assert(records[0].status==="PASS"&&records[0].provider_request_count===220&&records[0].raw_provider_object_count===220,"V3_HISTORIC_GFS_SOURCE_INVALID");
  assert(records[1]&&typeof records[1]==="object","V3_HISTORIC_KBS_SOURCE_INVALID");
  const review=records[2];
  exact(review,["schema_version","run_id","subject_sha","first_base","reviewed_stage_timeout_ms","reviewed_safety_margin_ms","reviewer_id","review_basis"],"V3_REVIEW");
  assert.equal(review.schema_version,"geox_mcft_cap09_engineering_stage_cap_review_v1","V3_REVIEW_VERSION");
  assert.equal(review.run_id,budget.run_id,"V3_REVIEW_RUN_MISMATCH");
  assert.equal(review.subject_sha,budget.subject_sha,"V3_REVIEW_SUBJECT_MISMATCH");
  assert.equal(review.first_base,budget.first_base,"V3_REVIEW_FIRST_BASE_MISMATCH");
  assert.deepEqual(review.reviewed_stage_timeout_ms,stagePlan.stages.map(s=>s.timeout_ms),"V3_REVIEW_CAPS_CHANGED");
  assert.equal(review.reviewed_safety_margin_ms,budget.safety_margin_ms,"V3_REVIEW_MARGIN_CHANGED");
  assert.equal(review.reviewer_id,context.authorizedReviewerId,"V3_REVIEW_NOT_REGISTERED_SIGNER");
  assert(typeof review.review_basis==="string"&&review.review_basis.trim().length>=250&&!/【请填写|尚未批准|待实际授权操作员审查|【由实际授权操作员填写/.test(review.review_basis),"V3_REVIEW_ACTUAL_RATIONALE_REQUIRED");
  return Object.freeze({status:"V3_PREPERMIT_SIGNED_SOURCE_USE_POLICY_STRUCTURAL_PASS_NOT_PROVIDER_SLA",
    stage_timeout_ceiling_sum_ms:sum,safety_margin_ms:budget.safety_margin_ms,
    signed_material_source_code_digest_set:sourceHashes,source_capture_at_use_required:true,
    initial_provider_availability_guaranteed:false,scientific_source_decoding_preexecution_claimed:false,
    actual_six_stage_measured:false,execute_authorized:false,production_authorized:false});
}
module.exports={CONTRACT,CLASSIFICATION,RUN,STAGES,CODE_PATHS,SOURCE_TYPES,pinnedSourceCode,evaluate};
