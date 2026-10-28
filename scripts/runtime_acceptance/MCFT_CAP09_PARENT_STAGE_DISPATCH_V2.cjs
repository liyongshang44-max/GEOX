"use strict";
/**
 * Parent-controlled one-stage launch with immutable child claim, timeout and
 * artifact-aware chained receipt. The caller MUST hold an in-process consumed
 * permit capability from independent governance. No synthetic activation mode.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const cap=require("./MCFT_CAP09_STAGE_CAPABILITY_V2.cjs");
const receipts=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const permits=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
async function dispatchConsumedStage(authority,step) {
 permits.assertConsumed(authority.consumed);
 assert(cap.STAGES.includes(step.id),"PARENT_UNKNOWN_STAGE");
 assert(path.isAbsolute(step.script)&&path.isAbsolute(step.cwd)&&path.isAbsolute(step.artifact),"PARENT_ABSOLUTE_PATHS_REQUIRED");
 assert(Number.isSafeInteger(step.timeout_ms)&&step.timeout_ms>0&&step.timeout_ms<=3600000,"PARENT_STAGE_TIMEOUT_INVALID");
 assert(path.isAbsolute(step.executable)&&Array.isArray(step.args)&&step.args.every(x=>typeof x==="string"),"PARENT_EXECUTABLE_REQUIRED");
 assert.equal(step.args.at(-1),step.script,"PARENT_CHILD_SCRIPT_NOT_LAST_ARGUMENT");
 assert.equal(step.previous_sha256.length,64,"PARENT_PREVIOUS_RECEIPT_SHA_REQUIRED");
 assert(step.env&&typeof step.env==="object","PARENT_CHILD_ENV_REQUIRED");
 const ticket=cap.issueStageCapability(authority,{id:step.id,script:step.script,previous_sha256:step.previous_sha256});
 const env={...step.env,MCFT_ATTEMPT3_V2_CHILD:"1",
  MCFT_GOVERNED_RETRY_TICKET:ticket.ticket,
  MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256:step.previous_sha256,
  MCFT_GOVERNED_RETRY_STAGE:step.id};
 return receipts.runRecordedStage({directory:authority.consumed.run_directory,
  cwd:step.cwd,executable:step.executable,args:step.args,timeout_ms:step.timeout_ms,
  id:step.id,previous_sha256:step.previous_sha256,expected_artifact:step.artifact,
  expected_claim:{file:path.join(authority.consumed.run_directory,"SPENT_V2_"+step.id,"CLAIMED.json"),
   id:step.id,run_id:authority.run_id,nonce:authority.nonce,
   ticket_sha256:receipts.hashFile(ticket.ticket),
   schema_version:"geox_mcft_cap09_child_stage_claim_attempt3_v2"},env});
}
module.exports={dispatchConsumedStageV2:dispatchConsumedStage};
