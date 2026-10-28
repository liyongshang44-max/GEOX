"use strict";
/**
 * Read-only independent verifier of the actual Attempt-3 V2 six-stage ledger.
 * Never synthesizes stage receipt data; never signs/consumes permits.
 * Passing validates artifact continuity, NOT authorization or scientific quality.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {STAGES}=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const canonical=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical;
const D="GEOX_MCFT_CAP09_HOST_STAGE_ATTEMPT3_V2\n";
const hex40=/^[a-f0-9]{40}$/,hex64=/^[a-f0-9]{64}$/,runPattern=/^[a-f0-9]{12}$/;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const EXPECTED=Object.freeze([
 "MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json",
 "MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE1_V2_RESULT.json",
 "MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE2_V2_RESULT.json",
 "MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE3_V2_RESULT.json",
 "MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json",
 "MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"
]);
function directory(p){
 assert(typeof p==="string"&&path.isAbsolute(p),"AUDIT_ROOT_ABSOLUTE_REQUIRED");
 let current=path.resolve(p);
 for(;;){
  const st=fs.lstatSync(current);
  assert(st.isDirectory()&&!st.isSymbolicLink(),"AUDIT_DIRECTORY_SYMLINK_OR_NOT_DIRECTORY");
  const parent=path.dirname(current);if(parent===current)break;current=parent;
 }
}
function regular(p,allowEmpty=false){
 const st=fs.lstatSync(p);
 assert(st.isFile()&&!st.isSymbolicLink()&&(allowEmpty||st.size>0)&&st.size<=8*1024*1024,
  "AUDIT_FILE_NOT_REGULAR_OR_BOUNDED:"+path.basename(p));
 return fs.readFileSync(p);
}
function json(p){return JSON.parse(regular(p).toString("utf8"));}
function readStage({runDirectory,outputRoot,runId,subjectSha,consumed,previous,index,key}){
 const id=STAGES[index],receiptRoot=path.join(runDirectory,id);
 directory(receiptRoot);
 const started=path.join(receiptRoot,"STARTED.json");
 const completed=path.join(receiptRoot,"COMPLETED.json");
 const ticket=path.join(runDirectory,"STAGE_TICKET_V2_"+id+".json");
 const claim=path.join(runDirectory,"SPENT_V2_"+id,"CLAIMED.json");
 const [startBytes,endBytes,ticketBytes,claimBytes]=[started,completed,ticket,claim].map(regular);
 const beginning=JSON.parse(startBytes),ending=JSON.parse(endBytes);
 const envelope=JSON.parse(ticketBytes),spent=JSON.parse(claimBytes);
 const p=envelope.payload;
 assert.equal(p.schema_version,"geox_mcft_cap09_host_stage_capability_attempt3_v2");
 assert.equal(p.id,id);assert.equal(p.ordinal,index);assert.equal(p.run_id,runId);
 assert.equal(p.nonce,consumed.nonce);assert.equal(p.subject_sha,subjectSha);
 assert.equal(p.envelope_sha256,consumed.envelope_sha256);
 assert.equal(p.previous_sha256,previous);
 assert.equal(beginning.id,id);assert.equal(beginning.previous_sha256,previous);
 assert.equal(beginning.schema_version,"geox_mcft_cap09_stage_started_v1");
 assert.equal(ending.id,id);assert.equal(ending.schema_version,"geox_mcft_cap09_stage_completed_v1");
 assert.equal(ending.status,"PASS","AUDIT_REAL_STAGE_NOT_PASS:"+id);
 assert.equal(ending.qualification_pass,false);
 assert.equal(ending.claim_valid,true);assert.equal(ending.claim_present,true);
 assert.equal(ending.artifact_present,true);
 assert.equal(ending.started_sha256,sha(startBytes));
 assert.equal(ending.previous_sha256,previous);
 assert(sha(regular(started))===sha(startBytes));
 const cmd=beginning.command;
 assert(cmd&&Array.isArray(cmd.args)&&cmd.args.length>0,"AUDIT_STAGE_COMMAND_MISSING");
 const script=cmd.args[cmd.args.length-1];
 assert(typeof script==="string"&&path.isAbsolute(script),"AUDIT_SCRIPT_ABSOLUTE_REQUIRED");
 assert.equal(p.script_sha256,sha(regular(script)),"AUDIT_STAGE_EXECUTABLE_DRIFT:"+id);
 assert.equal(spent.schema_version,"geox_mcft_cap09_child_stage_claim_attempt3_v2");
 assert.equal(spent.id,id);assert.equal(spent.run_id,runId);assert.equal(spent.nonce,consumed.nonce);
 assert.equal(spent.parent_pid,p.parent_pid);
 assert.equal(spent.ticket_sha256,sha(ticketBytes));
 assert.equal(ending.claim_sha256,sha(claimBytes),"AUDIT_CLAIM_HASH_MISMATCH");
 assert.equal(ending.expected_child_claim,claim);
 assert.equal(ending.stdout_sha256,sha(regular(path.join(receiptRoot,"stdout.log"),true)));
 assert.equal(ending.stderr_sha256,sha(regular(path.join(receiptRoot,"stderr.log"),true)));
 const artifact=path.join(outputRoot,EXPECTED[index]);
 assert.equal(ending.expected_artifact,artifact,"AUDIT_ARTIFACT_OUTSIDE_EXPECTED_OUTPUT");
 assert.equal(ending.artifact_sha256,sha(regular(artifact)),"AUDIT_ARTIFACT_HASH_CHANGED:"+id);
 const sig=Buffer.from(envelope.signature_base64||"","base64");
 assert.equal(sig.length,64,"AUDIT_TICKET_SIGNATURE_BYTES");
 assert.equal(sig.toString("base64"),envelope.signature_base64);
 assert(crypto.verify(null,Buffer.from(D+canonical(p)),key,sig),"AUDIT_TICKET_BAD_SIGNATURE:"+id);
 const startedMs=Date.parse(beginning.started_at),finishedMs=Date.parse(ending.completed_at);
 assert(Number.isFinite(startedMs)&&Number.isFinite(finishedMs)&&finishedMs>=startedMs,
  "AUDIT_STAGE_CLOCK_ORDER:"+id);
 assert(Number.isSafeInteger(ending.elapsed_ms)&&ending.elapsed_ms>=0,
  "AUDIT_ELAPSED_INVALID:"+id);
 assert.equal(ending.exit_code,0,"AUDIT_EXIT_NONZERO:"+id);
 assert.equal(ending.timed_out,false,"AUDIT_TIMED_OUT:"+id);
 return {id,receipt_sha256:sha(endBytes),artifact_sha256:ending.artifact_sha256,
  started_at:beginning.started_at,completed_at:ending.completed_at,elapsed_ms:ending.elapsed_ms};
}
function verify({ledgerRoot,outputRoot,runId,subjectSha}){
 assert(runPattern.test(runId)&&hex40.test(subjectSha),"AUDIT_RUN_OR_SUBJECT_INVALID");
 directory(ledgerRoot);directory(outputRoot);
 const root=path.join(ledgerRoot,"run-"+runId);directory(root);
 const bytes=regular(path.join(root,"CONSUMED.json")),consumed=JSON.parse(bytes);
 assert.equal(consumed.schema_version,"geox_mcft_cap09_consumed_permit_attempt3_v2");
 assert.equal(consumed.status,"CONSUMED_NO_AUTOMATIC_RETRY");
 assert.equal(consumed.run_id,runId);assert.equal(consumed.subject_sha,subjectSha);
 assert.equal(consumed.execute_authorized,false);assert.equal(consumed.production_authorized,false);
 assert(hex64.test(consumed.nonce)&&hex64.test(consumed.envelope_sha256));
 const nonceRoot=path.join(ledgerRoot,"nonce-"+consumed.nonce);directory(nonceRoot);
 assert(bytes.equals(regular(path.join(nonceRoot,"CONSUMED.json"))),"AUDIT_DUAL_LEDGER_MISMATCH");
 const key=crypto.createPublicKey(regular(path.join(root,"STAGE_V2_PUBLIC_KEY.pem")));
 assert.equal(key.asymmetricKeyType,"ed25519","AUDIT_STAGE_KEY_NOT_ED25519");
 const results=[];let previous=sha(bytes);
 for(let i=0;i<STAGES.length;i++){
  const row=readStage({runDirectory:root,outputRoot,runId,subjectSha,consumed,previous,index:i,key});
  results.push(row);previous=row.receipt_sha256;
 }
 const report=json(path.join(root,"SIX_STAGE_AUDIT.json"));
 assert.equal(report.schema_version,"geox_mcft_cap09_six_stage_audit_v1");
 assert.equal(report.stage_count,6);assert.equal(report.status,"SIX_STAGE_EVIDENCE_SEALED_NOT_AUTHORITY");
 assert.equal(report.qualified,false);assert.equal(report.formal_v5_arm,false);
 assert.equal(report.final_receipt_sha256,previous);
 assert.deepEqual(report.stages,results.map(x=>({
  id:x.id,receipt_sha256:x.receipt_sha256,artifact_sha256:x.artifact_sha256
 })),"AUDIT_SIX_STAGE_SUMMARY_DRIFT");
 return Object.freeze({schema_version:"MCFT_CAP09_ATTEMPT3_V2_INDEPENDENT_REAL_LEDGER_READBACK_V1",
  status:"SIX_STAGE_RECEIPT_INTEGRITY_VERIFIED_NOT_SCIENTIFIC_QUALIFICATION",
  run_id:runId,subject_sha:subjectSha,stage_count:6,stages:results,
  final_receipt_sha256:previous,
  permit_signature_rechecked:false,adoption_authorized:false,
  provider_science_qualified:false,production_authorized:false});
}
function cli(args){
 const v=["--ledger-root","--output-root","--run-id","--subject-sha"];
 assert(args.length===8,"AUDIT_EXACT_FOUR_ARGUMENTS_REQUIRED");
 const obj={};
 for(let i=0;i<args.length;i+=2){
  assert(v.includes(args[i])&&!Object.hasOwn(obj,args[i]),"AUDIT_UNKNOWN_OR_DUPLICATE_FLAG");
  obj[args[i]]=args[i+1];
 }
 for(const k of v)assert(obj[k]&&typeof obj[k]==="string");
 return {ledgerRoot:obj["--ledger-root"],outputRoot:obj["--output-root"],
  runId:obj["--run-id"],subjectSha:obj["--subject-sha"]};
}
if(require.main===module){
 try{console.log(JSON.stringify(verify(cli(process.argv.slice(2)))));}
 catch(e){console.error(JSON.stringify({status:"HOLD_NO_VERIFIED_SIX_STAGE_CHAIN",
  reason:String(e.message||e).slice(0,350),permit_consumed:"UNKNOWN_READ_LEDGER",
  original_six_stage_pass_count:"UNKNOWN_REVIEW_RAW_RECEIPTS",
  production_authorized:false}));process.exitCode=1;}
}
module.exports={verify,cli,EXPECTED};
