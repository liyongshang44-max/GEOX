"use strict";
// Read-only/single-output unsigned DA9 V3 budget envelope builder.
// This NEVER issues an Adoption, Retry decision, Permit or execution receipt.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const budgetV3=require("../governance_acceptance/MCFT_CAP09_DA9_PREPERMIT_SOURCE_USE_BUDGET_V3.cjs");
const scheduler=require("../runtime_acceptance/MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));}
function outside(file) {
 assert(path.isAbsolute(file),"DA9_V3_ABSOLUTE_EXTERNAL_FILE_REQUIRED");
 const root=fs.realpathSync(ROOT),real=fs.realpathSync(path.dirname(file)),rel=path.relative(root,real);
 assert(rel===".."||rel.startsWith(".."+path.sep)||path.isAbsolute(rel),"DA9_V3_SIGNED_RUNTIME_OVERWRITE_FORBIDDEN");
}
function source(kind,filename){
 outside(filename);
 const s=fs.lstatSync(filename);
 assert(s.isFile()&&!s.isSymbolicLink(),"DA9_V3_EVIDENCE_REGULAR_FILE_REQUIRED");
 const bytes=fs.readFileSync(filename);
 assert(bytes.length>0&&bytes.length<8_000_000,"DA9_V3_SOURCE_BOUNDS_INVALID");
 return {kind,path:filename,sha256:digest(bytes)};
}
function prepare({planPath,gfsPath,kbsPath,reviewPath,decisionPath,output}){
 for(const x of [planPath,gfsPath,kbsPath,reviewPath,decisionPath,output])outside(x);
 assert(!fs.existsSync(output),"DA9_V3_OUTPUT_ALREADY_EXISTS");
 const plan=readJson(planPath),review=readJson(reviewPath),decision=readJson(decisionPath);
 scheduler.validateStagePlan(plan);
 assert.equal(decision.review_contract_version,2,"DA9_V3_SIGNED_RETRY_V2_REQUIRED");
 assert.equal(decision.review_status,"APPROVED","DA9_V3_AUTHENTIC_REVIEW_DECISION_REQUIRED");
 assert.equal(decision.run_id,budgetV3.RUN,"DA9_V3_DECISION_RUN_INVALID");
 assert.equal(decision.protected_main_sha,review.subject_sha,"DA9_V3_REVIEW_SUBJECT_INVALID");
 assert.equal(decision.reviewer_id,review.reviewer_id,"DA9_V3_REVIEWER_MISMATCH");
 assert.equal(review.schema_version,"geox_mcft_cap09_engineering_stage_cap_review_v1","DA9_V3_REVIEW_SCHEMA");
 assert.equal(review.run_id,budgetV3.RUN,"DA9_V3_REVIEW_RUN_INVALID");
 assert.deepEqual(review.reviewed_stage_timeout_ms,plan.stages.map(s=>s.timeout_ms),"DA9_V3_REVIEWED_CAPS_MISMATCH");
 assert(Number.isSafeInteger(review.reviewed_safety_margin_ms)&&review.reviewed_safety_margin_ms>0,"DA9_V3_MARGIN_REQUIRED");
 assert(typeof review.review_basis==="string"&&review.review_basis.trim().length>=250&&!/【请填写|尚未批准|待实际授权操作员审查/.test(review.review_basis),"DA9_V3_OPERATOR_REAL_REVIEW_REQUIRED");
 const cap=plan.stages.reduce((sum,s)=>sum+s.timeout_ms,0),first=Date.parse(review.first_base);
 assert(Number.isFinite(first)&&new Date(first).toISOString()===review.first_base&&review.first_base.endsWith(":00:00.000Z"),"DA9_V3_FIRST_BASE_INVALID");
 assert(Date.now()+cap+review.reviewed_safety_margin_ms<first,"DA9_V3_PREPARE_FIRSTBASE_BUDGET_ALREADY_EXPIRED");
 const sources=[
  source("HISTORIC_REAL_GFS_ACQUISITION",gfsPath),
  source("HISTORIC_REAL_KBS_CONTINUITY",kbsPath),
  source("OPERATOR_REVIEWED_STAGE_CAPS",reviewPath)];
 assert.equal(sources[0].sha256,"8a89e19dc06023dcc8342b68541c67c7758d0e1ef836d63d68f285a3b29d192a","DA9_V3_GFS_HISTORICAL_ANCHOR_MISMATCH");
 assert.equal(sources[1].sha256,"d813093f0321bd56d7e0a43c1dfa66964c4f4dfe8373d665a3139123d49dd86e","DA9_V3_KBS_HISTORICAL_ANCHOR_MISMATCH");
 assert(typeof decision.review_authority_ref==="string"&&decision.review_authority_ref.length>=16,"DA9_V3_REVIEW_PROVENANCE_REQUIRED");
 const result={
  schema_version:budgetV3.CONTRACT,
  classification:budgetV3.CLASSIFICATION,scope:"TEST_ONLY",
  run_id:budgetV3.RUN,subject_sha:review.subject_sha,first_base:review.first_base,
  stage_timeout_sum_ms:cap,safety_margin_ms:review.reviewed_safety_margin_ms,
  source_use_mode:"LIVE_AT_EACH_REAL_CAPTURE_NO_PROVIDER_SLA",
  source_code_sha256:budgetV3.pinnedSourceCode(ROOT),sources,
  review_authority_ref:decision.review_authority_ref};
 const fd=fs.openSync(output,"wx",0o600);
 try{fs.writeFileSync(fd,JSON.stringify(result,null,2)+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {status:"UNSIGNED_V3_BUDGET_ENVELOPE_CREATED_NOT_ADMISSION",file:output,sha256:digest(fs.readFileSync(output)),
  stage_timeout_sum_ms:cap,safety_margin_ms:review.reviewed_safety_margin_ms,
  real_provider_calls:0,permit_signed:false,execute_authorized:false};
}
module.exports={prepare};
if(require.main===module){
 try{
  const argv=process.argv.slice(2);
  assert(argv.length===6,"USAGE: node da9-budget-v3-prepare.cjs STAGE_PLAN HIST_GFS HIST_KBS REVIEW_JSON SIGNED_RETRY_DECISION OUT_JSON");
  console.log(JSON.stringify(prepare({planPath:argv[0],gfsPath:argv[1],kbsPath:argv[2],reviewPath:argv[3],decisionPath:argv[4],output:argv[5]})));
 }catch(e){console.error("DA9_V3_BUDGET_PREPARATION_HOLD:"+e.message);process.exitCode=1;}
}
