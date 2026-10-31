"use strict";
/* R4285 independent child entrance. A child may start effects only AFTER consuming
 * its stage-specific parent Ed25519 ticket and durable SPENT_V2 marker.
 * Does not read or consume the historical Permit. No production activation.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const cap=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs");
const c=require("../cap09_adoption_v1/contract.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const SCRIPT=Object.freeze({
 PRODUCER:"RUN_MCFT_CAP09_R4285_PRODUCER_V1.ts",
 TIMING_1:"RUN_MCFT_CAP09_R4285_TIMING_V1.ts",
 TIMING_2:"RUN_MCFT_CAP09_R4285_TIMING_V1.ts",
 TIMING_3:"RUN_MCFT_CAP09_R4285_TIMING_V1.ts",
 CONTROLLED_DELAY:"MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs",
 AGGREGATE:"AGGREGATE_MCFT_CAP09_R4285_TIMING_V1.ts"
});
function must(env,key){const v=env[key];assert(typeof v==="string"&&v.length>0,"CAP09_R4285_CHILD_ENV_MISSING:"+key);return v;}
function assertChildContract(env,script){
 assert.equal(must(env,"MCFT_R4285_CHILD"),"1","CAP09_R4285_CHILD_EXPLICIT_MODE_REQUIRED");
 const stage=must(env,"MCFT_GOVERNED_RETRY_STAGE");
 assert(Object.hasOwn(SCRIPT,stage),"CAP09_R4285_CHILD_STAGE_UNKNOWN");
 assert.equal(path.resolve(script),path.resolve(__dirname,SCRIPT[stage]),"CAP09_R4285_CHILD_WRONG_SCRIPT");
 const run_id=must(env,"MCFT_GOVERNED_RETRY_RUN_ID"),nonce=must(env,"MCFT_R4285_NONCE");
 const subject_sha=must(env,"MCFT_SUBJECT_SHA");
 const envelope_sha256=must(env,"MCFT_R4285_PERMIT_ENVELOPE_SHA256");
 const previous_sha256=must(env,"MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256");
 assert(/^[0-9a-f]{12}$/.test(run_id),"CAP09_R4285_RUN_ID_INVALID");
 assert(/^[0-9a-f]{64}$/.test(nonce),"CAP09_R4285_NONCE_INVALID");
 assert(/^[0-9a-f]{40}$/.test(subject_sha),"CAP09_R4285_SUBJECT_INVALID");
 for(const h of [envelope_sha256,previous_sha256])c.hash(h);
 const root=must(env,"MCFT_R4285_LEDGER_ROOT");
 assert(path.isAbsolute(root),"CAP09_R4285_LEDGER_ROOT_NOT_ABSOLUTE");
 const run_directory=path.join(root,"run-"+run_id);
 const ticket=must(env,"MCFT_GOVERNED_RETRY_TICKET");
 assert.equal(path.resolve(ticket),path.join(run_directory,"STAGE_TICKET_R4285_"+stage+".json"),
  "CAP09_R4285_CHILD_TICKET_PATH_INVALID");
 return {stage,run_id,nonce,subject_sha,envelope_sha256,previous_sha256,
  ticket,run_directory,script:path.resolve(script)};
}
function observed(env=process.env){
 assert.equal(must(env,"MCFT_R4285_CHILD"),"1");
 const file=must(env,"MCFT_R4285_OBSERVED_FILE");
 assert(path.isAbsolute(file),"CAP09_R4285_OBSERVED_PATH");
 const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<1024*1024);
 const value=JSON.parse(fs.readFileSync(file,"utf8"));
 const expected=must(env,"MCFT_R4285_OBSERVATIONS_SHA256");c.hash(expected);
 assert.equal(c.digest(value),expected,"CAP09_R4285_SIGNED_OBSERVED_CHANGED");
 return value;
}
function childTargets(){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"CAP09_R4285_WINDOWS_ONLY");
 const data=assertChildContract(process.env,process.argv[1]);
 const e=require("./MCFT_CAP09_R4285_CURRENT_BASELINE_EXECUTION_V1.cjs");
 const targets=e.isolatedTargets({isolated_run_id:data.run_id,
  qualification_first_base:must(process.env,"MCFT_QUALIFICATION_FIRST_BASE")},process.env);
 assert.equal(path.resolve(targets.out),path.resolve(must(process.env,"MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR")));
 observed(process.env); // exact signed observation bytes, before stage claim
 const receipt=cap.consumeStageCapability({
  ticket:data.ticket,run_directory:data.run_directory,id:data.stage,run_id:data.run_id,
  nonce:data.nonce,subject_sha:data.subject_sha,envelope_sha256:data.envelope_sha256,
  script:data.script,previous_sha256:data.previous_sha256});
 assert.equal(receipt.status,"STAGE_CAPABILITY_CONSUMED_NO_RETRY");
 return targets;
}
module.exports={SCRIPT,assertChildContract,observed,childTargets};
