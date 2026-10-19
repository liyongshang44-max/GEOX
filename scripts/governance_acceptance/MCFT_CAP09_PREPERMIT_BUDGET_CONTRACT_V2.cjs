"use strict";
// Proposed versioned pre-Permit SAFETY envelope, NOT an empirical timing qualification.
// Intended for explicitly reviewed successor material. This is not an executable authority.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const STAGES = Object.freeze(["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
const SUBJECT = /^[a-f0-9]{40}$/;
const RUN = /^[a-f0-9]{12}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const CONTRACT = "geox_mcft_cap09_prepermit_safety_budget_v2";
const CLASSIFICATION = "REVIEWED_STAGE_CEILINGS_NOT_ACTUAL_SIX_STAGE_MEASUREMENT";
const SOURCE_TYPES = Object.freeze([
 "HISTORIC_REAL_GFS_ACQUISITION", "HISTORIC_REAL_KBS_CONTINUITY",
 "CURRENT_REAL_PROVIDER_CAUSAL_WITNESS", "OPERATOR_REVIEWED_STAGE_CAPS"
]);
function exact(obj, fields, name) {
 assert(obj && typeof obj === "object" && !Array.isArray(obj), name + "_OBJECT_REQUIRED");
 assert.deepEqual(Object.keys(obj).sort(), fields.slice().sort(), name + "_FIELDS_INVALID");
}
function epoch(iso,label) {
 assert(typeof iso === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso),label);
 const ms = Date.parse(iso); assert(Number.isFinite(ms) && new Date(ms).toISOString()===iso,label); return ms;
}
function hour(iso,label) { const ms=epoch(iso,label);assert(iso.endsWith(":00:00.000Z"),label);return ms; }
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function sourceFile(source, runtimeRoot) {
 exact(source,["kind","path","sha256"],"BUDGET_SOURCE");
 assert(SOURCE_TYPES.includes(source.kind),"BUDGET_SOURCE_KIND_INVALID");
 assert(typeof source.path==="string"&&path.isAbsolute(source.path),"BUDGET_SOURCE_ABSOLUTE_FILE_REQUIRED");
 assert(DIGEST.test(source.sha256),"BUDGET_SOURCE_HASH_INVALID");
 const s=fs.lstatSync(source.path);
 assert(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=8_000_000,"BUDGET_SOURCE_REGULAR_BOUNDED_FILE_REQUIRED");
 const real=fs.realpathSync(source.path),root=fs.realpathSync(runtimeRoot);
 const rel=path.relative(root,real);
 assert(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),"BUDGET_SOURCE_INSIDE_SIGNED_RELEASE_FORBIDDEN");
 const bytes=fs.readFileSync(source.path);
 assert.equal(sha(bytes),source.sha256,"BUDGET_SOURCE_CHANGED:"+source.kind);
 return JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,""));
}
function assessPrePermitSafetyBudgetV2({budget,stagePlan,context,sourceRoot}) {
 exact(budget,["schema_version","classification","scope","run_id","subject_sha","first_base",
   "provider_deadline_utc","stage_timeout_sum_ms","safety_margin_ms","sources","review_authority_ref"],"BUDGET_V2");
 assert.equal(budget.schema_version,CONTRACT,"BUDGET_V2_VERSION_REQUIRED");
 assert.equal(budget.classification,CLASSIFICATION,"BUDGET_V2_MUST_NOT_CLAIM_MEASUREMENT");
 assert.equal(budget.scope,"TEST_ONLY","BUDGET_V2_PRODUCTION_FORBIDDEN");
 assert(RUN.test(budget.run_id)&&SUBJECT.test(budget.subject_sha),"BUDGET_V2_IDENTITY_REQUIRED");
 assert.equal(budget.run_id,context.runId,"BUDGET_V2_RUN_MISMATCH");
 assert.equal(budget.subject_sha,context.subjectSha,"BUDGET_V2_SUBJECT_MISMATCH");
 const first=hour(budget.first_base,"BUDGET_V2_FIRST_BASE_INVALID");
 assert.equal(budget.first_base,context.firstBase,"BUDGET_V2_FIRST_BASE_MISMATCH");
 const now=epoch(context.nowUtc,"BUDGET_V2_NOW_INVALID");
 const deadline=epoch(budget.provider_deadline_utc,"BUDGET_V2_PROVIDER_DEADLINE_INVALID");
 const permit=epoch(context.permitExpiresAt,"BUDGET_V2_PERMIT_EXPIRY_INVALID");
 const adoption=epoch(context.adoptionExpiresAt,"BUDGET_V2_ADOPTION_EXPIRY_INVALID");
 assert.equal(budget.provider_deadline_utc,context.providerDeadlineUtc,"BUDGET_V2_PROVIDER_DEADLINE_NOT_SIGNED_OBSERVATION");
 assert.equal(budget.safety_margin_ms,context.safetyMarginMs,"BUDGET_V2_MARGIN_NOT_SIGNED_OBSERVATION");
 assert(Number.isSafeInteger(budget.safety_margin_ms)&&budget.safety_margin_ms>0,"BUDGET_V2_POSITIVE_MARGIN_REQUIRED");
 exact(stagePlan,["schema_version","stages"],"BUDGET_STAGE_PLAN");
 assert.equal(stagePlan.schema_version,"geox_mcft_cap09_retry_stage_plan_v2");
 assert(Array.isArray(stagePlan.stages)&&stagePlan.stages.length===6,"BUDGET_V2_SIX_STAGES_REQUIRED");
 let total=0;
 for(let i=0;i<STAGES.length;i++) {
  const stage=stagePlan.stages[i];exact(stage,["id","timeout_ms"],"BUDGET_STAGE");
  assert.equal(stage.id,STAGES[i],"BUDGET_V2_ORDER_INVALID");
  assert(Number.isSafeInteger(stage.timeout_ms)&&stage.timeout_ms>=1000&&stage.timeout_ms<=3600000,"BUDGET_V2_STAGE_CAP_INVALID");
  total+=stage.timeout_ms;
 }
 assert(Number.isSafeInteger(budget.stage_timeout_sum_ms)&&total===budget.stage_timeout_sum_ms,"BUDGET_V2_TIMEOUT_SUM_MISMATCH");
 // Upper timeout caps are not historically observed durations.
 const hardDeadline=Math.min(first,deadline,permit,adoption);
 assert(now+total+budget.safety_margin_ms<hardDeadline,"BUDGET_V2_CAUSAL_HARD_DEADLINE_INSUFFICIENT");
 assert(typeof budget.review_authority_ref==="string"&&budget.review_authority_ref.length>=16&&budget.review_authority_ref.length<=512,"BUDGET_V2_REVIEW_PROVENANCE_REQUIRED");
 assert(Array.isArray(budget.sources)&&budget.sources.length===4,"BUDGET_V2_FOUR_SOURCES_REQUIRED");
 assert.deepEqual(budget.sources.map(s=>s.kind),SOURCE_TYPES,"BUDGET_V2_SOURCE_ORDER_OR_KIND_INVALID");
 const uniq=new Set(budget.sources.map(s=>path.resolve(s.path).toLowerCase()));
 assert.equal(uniq.size,4,"BUDGET_V2_SOURCE_FILES_NOT_DISTINCT");
 assert(typeof sourceRoot==="string"&&path.isAbsolute(sourceRoot),"BUDGET_V2_RUNTIME_ROOT_REQUIRED");
 const records=budget.sources.map(s=>sourceFile(s,sourceRoot));
 const gfs=records[0];
 assert(gfs&&gfs.status==="PASS"&&gfs.provider_request_count===220&&gfs.raw_provider_object_count===220,
   "BUDGET_V2_HISTORIC_GFS_SOURCE_NOT_REAL_PASS");
 // Historical GFS and KBS do not establish future T1 freshness.
 const kbs=records[1];
 assert(kbs&&typeof kbs==="object"&&Object.keys(kbs).length>0,"BUDGET_V2_HISTORIC_KBS_EVIDENCE_INVALID");
 const live=records[2];
 exact(live,["schema_version","status","run_id","subject_sha","first_base","observed_at",
   "provider_deadline_utc","provider_causal_visibility","gfs_current_index_checked","kbs_current_continuity_checked",
   "raw_response_manifest_sha256"],"BUDGET_LIVE_WITNESS");
 assert.equal(live.schema_version,"geox_mcft_cap09_real_provider_readonly_witness_v1");
 assert.equal(live.status,"PASS","BUDGET_V2_CURRENT_PROVIDER_UNVERIFIED");
 assert.equal(live.run_id,budget.run_id);assert.equal(live.subject_sha,budget.subject_sha);
 assert.equal(live.first_base,budget.first_base);assert.equal(live.provider_deadline_utc,budget.provider_deadline_utc);
 assert.equal(live.provider_causal_visibility,true,"BUDGET_V2_PROVIDER_CAUSAL_VISIBILITY_NOT_PROVEN");
 assert.equal(live.gfs_current_index_checked,true,"BUDGET_V2_CURRENT_GFS_NOT_CHECKED");
 assert.equal(live.kbs_current_continuity_checked,true,"BUDGET_V2_CURRENT_KBS_NOT_CHECKED");
 assert(DIGEST.test(live.raw_response_manifest_sha256),"BUDGET_V2_RAW_MANIFEST_REQUIRED");
 const seen=epoch(live.observed_at,"BUDGET_V2_PROVIDER_OBSERVATION_CLOCK_INVALID");
 assert(seen<=now&&now-seen<=300000,"BUDGET_V2_PROVIDER_OBSERVATION_STALE");
 assert(seen<first,"BUDGET_V2_PROVIDER_OBSERVATION_POST_CUTOFF");
 const review=records[3];
 exact(review,["schema_version","run_id","subject_sha","first_base","reviewed_stage_timeout_ms",
   "reviewed_safety_margin_ms","reviewer_id","review_basis"],"BUDGET_CAP_REVIEW");
 assert.equal(review.schema_version,"geox_mcft_cap09_engineering_stage_cap_review_v1");
 assert.equal(review.run_id,budget.run_id);assert.equal(review.subject_sha,budget.subject_sha);
 assert.equal(review.first_base,budget.first_base);
 assert.deepEqual(review.reviewed_stage_timeout_ms,stagePlan.stages.map(s=>s.timeout_ms),"BUDGET_V2_UNREVIEWED_STAGE_TIMEOUT");
 assert.equal(review.reviewed_safety_margin_ms,budget.safety_margin_ms,"BUDGET_V2_UNREVIEWED_MARGIN");
 assert.equal(review.reviewer_id,context.authorizedReviewerId,"BUDGET_V2_REVIEWER_MUST_BE_EXISTING_SIGNER");
 assert(typeof review.review_basis==="string"&&review.review_basis.length>=100,"BUDGET_V2_EXPLICIT_ENGINEERING_CAP_RATIONALE_REQUIRED");
 return Object.freeze({status:"PREPERMIT_SAFETY_ENVELOPE_STRUCTURAL_PASS_NOT_AUTHORITY",
  stage_timeout_ceiling_sum_ms:total,safety_margin_ms:budget.safety_margin_ms,
  remaining_to_hard_deadline_ms:hardDeadline-now,bound_source_digests:budget.sources.map(s=>({kind:s.kind,sha256:s.sha256})),
  actual_six_stage_measured:false,independent_issuer_added:false,run_created:false,
  execute_authorized:false,production_authorized:false});
}
module.exports={CONTRACT,CLASSIFICATION,STAGES,SOURCE_TYPES,assessPrePermitSafetyBudgetV2};
