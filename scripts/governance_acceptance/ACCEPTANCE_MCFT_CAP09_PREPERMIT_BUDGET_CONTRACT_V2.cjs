"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const b=require("./MCFT_CAP09_PREPERMIT_BUDGET_CONTRACT_V2.cjs");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-budget-v2-")),runtime=path.join(root,"release"),dir=path.join(root,"evidence");
fs.mkdirSync(runtime);fs.mkdirSync(dir);
const run="abcdef123456",subject="77cdeeefc8b27901f3cc44b4edc203d8b8f513a3",reviewer="mcft_cap09_operator_mylr1";
const first="2026-10-19T06:00:00.000Z",deadline="2026-10-19T05:30:00.000Z",now="2026-10-19T00:00:00.000Z";
const plan={schema_version:"geox_mcft_cap09_retry_stage_plan_v2",stages:b.STAGES.map(id=>({id,timeout_ms:600000}))};
const evidence=[
 {status:"PASS",provider_request_count:220,raw_provider_object_count:220},
 {status:"DYNAMIC_ADMISSION_HOLD",kbs_soil_status:"READONLY_SOIL_CONTINUITY_SNAPSHOT_PASS_NOT_ADMISSION"},
 {schema_version:"geox_mcft_cap09_real_provider_readonly_witness_v1",status:"PASS",run_id:run,subject_sha:subject,
 first_base:first,observed_at:"2026-10-18T23:58:00.000Z",provider_deadline_utc:deadline,
 provider_causal_visibility:true,gfs_current_index_checked:true,kbs_current_continuity_checked:true,
 raw_response_manifest_sha256:"a".repeat(64)},
 {schema_version:"geox_mcft_cap09_engineering_stage_cap_review_v1",run_id:run,subject_sha:subject,first_base:first,
 reviewed_stage_timeout_ms:Array(6).fill(600000),reviewed_safety_margin_ms:600000,reviewer_id:reviewer,
 review_basis:"The six stage limits are individually reviewed engineering safety upper caps and a positive reserve. They are not observed six-stage worst-case duration and do not issue execution permission."}
];
const sources=b.SOURCE_TYPES.map((kind,i)=>{const p=path.join(dir,"evidence-"+i+".json"),txt=JSON.stringify(evidence[i]);fs.writeFileSync(p,txt);return {kind,path:p,sha256:sha(txt)};});
const budget={schema_version:b.CONTRACT,classification:b.CLASSIFICATION,scope:"TEST_ONLY",run_id:run,subject_sha:subject,first_base:first,
 provider_deadline_utc:deadline,stage_timeout_sum_ms:3600000,safety_margin_ms:600000,sources,
 review_authority_ref:"EXISTING_OWNER_REVIEWED_PREPERMIT_POLICY_TEST_ONLY_NOT_SIGNED"};
const context={runId:run,subjectSha:subject,firstBase:first,nowUtc:now,providerDeadlineUtc:deadline,
 permitExpiresAt:"2026-10-19T07:00:00.000Z",adoptionExpiresAt:"2026-10-19T08:00:00.000Z",
 safetyMarginMs:600000,authorizedReviewerId:reviewer};
const validate=(bb=budget,pp=plan,cc=context)=>b.assessPrePermitSafetyBudgetV2({budget:bb,stagePlan:pp,context:cc,sourceRoot:runtime});
let count=0;const rejects=(fn,re)=>{assert.throws(fn,re);count++;};
try{
 const result=validate();assert.equal(result.status,"PREPERMIT_SAFETY_ENVELOPE_STRUCTURAL_PASS_NOT_AUTHORITY");
 assert.equal(result.execute_authorized,false);assert.equal(result.actual_six_stage_measured,false);count++;
 rejects(()=>validate({...budget,classification:"ACTUAL_MEASURED_WORST_CASE"}),/MUST_NOT_CLAIM_MEASUREMENT/);
 rejects(()=>validate({...budget,measured_worst_case_ms:9999999}),/FIELDS_INVALID/);
 rejects(()=>validate({...budget,run_id:"000000000000"}),/RUN_MISMATCH/);
 rejects(()=>validate({...budget,subject_sha:"f".repeat(40)}),/SUBJECT_MISMATCH/);
 rejects(()=>validate({...budget,stage_timeout_sum_ms:300000}),/TIMEOUT_SUM_MISMATCH/);
 rejects(()=>validate(budget,{...plan,stages:plan.stages.slice().reverse()}),/ORDER_INVALID/);
 rejects(()=>validate(budget,plan,{...context,nowUtc:"2026-10-19T05:00:00.000Z"}),/HARD_DEADLINE_INSUFFICIENT|PROVIDER_OBSERVATION_STALE/);
 rejects(()=>validate(budget,plan,{...context,adoptionExpiresAt:"2026-10-19T00:30:00.000Z"}),/HARD_DEADLINE_INSUFFICIENT/);
 rejects(()=>validate({...budget,safety_margin_ms:0},plan,{...context,safetyMarginMs:0}),/POSITIVE_MARGIN_REQUIRED/);
 rejects(()=>validate({...budget,sources:sources.map((s,i)=>i===3?{...s,sha256:"0".repeat(64)}:s)}),/SOURCE_CHANGED/);
 rejects(()=>validate({...budget,sources:sources.map((s,i)=>i===3?{...s,path:sources[2].path}:s)}),/SOURCE_FILES_NOT_DISTINCT/);
 const past=path.join(dir,"stale.json");fs.writeFileSync(past,JSON.stringify({...evidence[2],observed_at:"2026-10-18T20:00:00.000Z"}));
 rejects(()=>validate({...budget,sources:sources.map((s,i)=>i===2?{...s,path:past,sha256:sha(fs.readFileSync(past))}:s)}),/PROVIDER_OBSERVATION_STALE/);
 const fake=path.join(dir,"fake.json");fs.writeFileSync(fake,JSON.stringify({...evidence[0],provider_request_count:0}));
 rejects(()=>validate({...budget,sources:sources.map((s,i)=>i===0?{...s,path:fake,sha256:sha(fs.readFileSync(fake))}:s)}),/GFS_SOURCE_NOT_REAL_PASS/);
 const reviewerFile=path.join(dir,"wrong-review.json");fs.writeFileSync(reviewerFile,JSON.stringify({...evidence[3],reviewer_id:"different_signer"}));
 rejects(()=>validate({...budget,sources:sources.map((s,i)=>i===3?{...s,path:reviewerFile,sha256:sha(fs.readFileSync(reviewerFile))}:s)}),/REVIEWER_MUST_BE_EXISTING_SIGNER/);
 rejects(()=>validate({...budget,run_id:"da9db7129607"},plan,{...context,runId:"da9db7129607"}),/DA9_REAL_GFS_DIGEST_MISMATCH/);
 console.log(JSON.stringify({status:"PASS",checks:count,real_provider_calls:0,db_calls:0,permit_signed:false,permit_consumed:false,production_authorized:false}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
