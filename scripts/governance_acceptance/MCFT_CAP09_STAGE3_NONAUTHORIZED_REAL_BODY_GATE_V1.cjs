"use strict";
// Stage 3 evidence is not execution authority. Verify real ORIGINAL stage receipts
// against immutable historical entry blobs, reject synthetic chains, and never
// manufacture consumed Permit, stage claim, Provider, or production authority.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-NONAUTHORIZED-REAL-BODY-QUALIFICATION-V1.json";
const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/,ID=/^[a-f0-9]{12}$/;
const sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
const real=file=>{const x=fs.lstatSync(file);assert(x.isFile()&&!x.isSymbolicLink()&&x.size>0&&x.size<1024*1024,"STAGE3_EVIDENCE_NOT_REGULAR");return fs.readFileSync(file)};
function verifySource(root=ROOT){
 const c=read(path.join(root,CONTRACT));
 assert.equal(c.frozen_pr_3730_head_sha,"12dcbba6750879f0349c5730f477cb04cd23b560");
 assert.equal(c.historical_da9_attempt_run_id,"da9db7129607");
 assert.equal(c.new_permit_issuance_authorized,false);
 assert.equal(c.permit_consumption_authorized,false);
 assert.equal(c.synthetic_simulation_accepted,false);
 assert.equal(c.six_stage_original_business_bodies_verified,false);
 const expected=["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"];
 assert.deepEqual(c.stages.map(x=>x.id),expected,"SIX_REAL_BODY_STAGE_ORDER_INVALID");
 for(const item of c.stages){
  assert(SHA40.test(item.original_entry_git_blob_sha));
  const source=path.join(root,item.original_entry_script);
  const git=cp.execFileSync("git",["rev-parse","HEAD:"+item.original_entry_script],{cwd:root,encoding:"utf8"}).trim();
  const historical=cp.execFileSync("git",["rev-parse",c.frozen_pr_3730_head_sha+":"+item.original_entry_script],{cwd:root,encoding:"utf8"}).trim();
  assert.equal(historical,item.original_entry_git_blob_sha,"ORIGINAL_FROZEN_STAGE_BLOB_INVALID:"+item.id);
  assert.equal(git,historical,"CURRENT_STAGE_BODY_CHANGED:"+item.id);
  const workingBlob=cp.execFileSync("git",["hash-object","--",item.original_entry_script],{cwd:root,encoding:"utf8"}).trim();
  assert.equal(workingBlob,historical,"STAGE3_ORIGINAL_WORKTREE_ENTRY_BYTES_CHANGED:"+item.id);
 }
 return c;
}
function verifyReceipt(root,dir,opts={}){
 const c=verifySource(root);
 const result={schema_version:"geox_mcft_cap09_stage3_non_authorized_sealed_proof_review_v1",
   status:"HOLD_UNTIL_ALL_SIX_REAL_STAGE_BODIES_AND_INDEPENDENT_REVIEW",
   exact_frozen_source_sha:c.frozen_pr_3730_head_sha,stage_count:0,real_bodies_verified:[],
   permit_signed:false,permit_consumed:false,production_authorized:false,qualified:false};
 assert(path.isAbsolute(dir)&&path.relative(root,dir).startsWith(".."+path.sep),
   "STAGE3_EVIDENCE_MUST_BE_OUTSIDE_SOURCE_TREE");
 assert(!["da9db7129607","af64cc3aa84e","72dc0304a21a"].includes(opts.runId),"HISTORICAL_OR_STAGE2_RUN_REUSE_FORBIDDEN");
 assert(opts.runId===undefined||ID.test(opts.runId),"STAGE3_RUN_ID_INVALID");
 if(!fs.existsSync(dir))return {...result,reason_code:"NO_STAGE3_REAL_BODY_RECEIPTS"};
 let prev=null,runId=null,stages=[];
 for(const stage of c.stages){
  const receiptFile=path.join(dir,stage.id+".stage3.json");
  const bodyFile=path.join(dir,stage.expected_artifact_name);
  if(!fs.existsSync(receiptFile)||!fs.existsSync(bodyFile))return {...result,stage_count:stages.length,real_bodies_verified:stages,reason_code:"MISSING_REAL_STAGE_BODY:"+stage.id};
  const rec=read(receiptFile),payload=read(bodyFile);
  assert.deepEqual(Object.keys(rec).sort(),["body_file_sha256","entry_git_blob_sha","entry_script","id","permit_consumed","production_authorized","real_body_executed","run_id","schema_version","source_sha","stage_receipt_predecessor_sha256","status"].sort(),
    "STAGE3_STAGE_RECEIPT_SCHEMA_CHANGED:"+stage.id);
  assert.equal(rec.schema_version,"geox_mcft_cap09_stage3_nonauthorized_stage_entry_v1");
  assert.equal(rec.id,stage.id);
  assert.equal(rec.status,"PASS");
  assert.equal(rec.source_sha,c.frozen_pr_3730_head_sha);
  assert.equal(rec.entry_script,stage.original_entry_script);
  assert.equal(rec.entry_git_blob_sha,stage.original_entry_git_blob_sha);
  assert.equal(rec.real_body_executed,true,"STAGE3_SYNTHETIC_SIMULATION_REJECTED:"+stage.id);
  assert.equal(rec.permit_consumed,false);assert.equal(rec.production_authorized,false);
  assert(ID.test(rec.run_id)&&!["da9db7129607","af64cc3aa84e"].includes(rec.run_id));
  if(opts.runId)assert.equal(rec.run_id,opts.runId);
  if(runId!==null)assert.equal(rec.run_id,runId,"STAGE3_CROSS_RUN_RECEIPT_INVALID");else runId=rec.run_id;
  assert(SHA64.test(rec.body_file_sha256));
  assert.equal(rec.body_file_sha256,sha(real(bodyFile)),"STAGE3_REAL_BODY_BYTES_CHANGED:"+stage.id);
  assert.equal(rec.stage_receipt_predecessor_sha256,prev,"STAGE3_SEALED_CHAIN_LINK_INVALID");
  assert.equal(payload.schema_version,stage.expected_artifact_schema,"STAGE3_BODY_SCHEMA_INVALID:"+stage.id);
  assert.equal(payload.status,"PASS");assert.equal(payload.subject_sha,c.frozen_pr_3730_head_sha);
  if(stage.id==="PRODUCER"){
    assert.equal(payload.processed_base_count,3);
    assert.equal(payload.provider_supply_graph_exercised,true);
    assert.equal(payload.production_wrapper_composer_reused,false);
  }else if(stage.id.startsWith("TIMING_")){
    assert.equal(payload.sample_id,"sample"+stage.id.slice(-1));
    assert.equal(payload.measurement_only,true);
    assert.equal(payload.formal_fact_present_count,3);
    assert.equal(payload.cursor_advanced,true);
  }else if(stage.id==="CONTROLLED_DELAY"){
    assert.equal(payload.physical_delay_cases_executed,true);
    assert.equal(payload.provider_pipeline_injected,false);
    assert.equal(payload.retained_qualification_database_touched,false);
    assert.equal(payload.cases.length,6);
  }else if(stage.id==="AGGREGATE"){
    assert.equal(payload.real_sample_count,3);
    assert.equal(payload.timing_budget_frozen,false);
    assert.equal(payload.production_owner_activation,false);
  }
  for(const key of ["production_owner_activation","formal_v5_arm","o00_started","mcft_cap09_completed"]){
    if(Object.hasOwn(payload,key))assert.equal(payload[key],false,"STAGE3_PRODUCTION_EFFECT_FORBIDDEN:"+stage.id+":"+key);
  }
  prev=sha(real(receiptFile));stages.push(stage.id);
 }
 return {...result,stage_count:6,real_bodies_verified:stages,
  status:"SIX_CLAIMED_BODY_RECEIPTS_STRUCTURALLY_VALID_NOT_INDEPENDENT_EXECUTION_PROOF",
  reason_code:"STRUCTURAL_RECEIPTS_NOT_AUTHORIZATION",
  qualified:false,operator_signature_required:true,execution_process_identity_verified:false,real_provider_pipeline_delay_proven:false};
}
module.exports={verifySource,verifyReceipt,CONTRACT};
if(require.main===module){
 try{
  const dir=process.argv[2];
  if(!dir)throw Error("USAGE: node MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs /ABSOLUTE/OUTSIDE/REPO/RECEIPTS");
  const result=verifyReceipt(ROOT,path.resolve(dir));
  console.log(JSON.stringify(result,null,2));
  if(result.stage_count!==6)process.exitCode=3;
 }catch(error){console.error("STAGE3_HOLD:"+String(error.message||error));process.exitCode=1;}
}
