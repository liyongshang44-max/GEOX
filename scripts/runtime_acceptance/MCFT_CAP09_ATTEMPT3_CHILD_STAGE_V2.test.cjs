"use strict";
// No Provider, DB, S3, Permit or live stage; pure V2 child contract tests.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const c=require("../cap09_adoption_v1/contract.cjs");
const child=require("./MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs");
const crypto=require("node:crypto"),sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const temp=[];
test.after(()=>temp.forEach(p=>fs.rmSync(p,{recursive:true,force:true})));
function fake(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-v2-bridge-"));temp.push(root);
 const stage="PRODUCER",run_id="6ff9b41f6f7f";
 const env={MCFT_ATTEMPT3_V2_CHILD:"1",MCFT_GOVERNED_RETRY_STAGE:stage,
  MCFT_GOVERNED_RETRY_RUN_ID:run_id,MCFT_ATTEMPT3_V2_NONCE:"a".repeat(64),
  MCFT_SUBJECT_SHA:"b".repeat(40),MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256:"c".repeat(64),
  MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256:"d".repeat(64),MCFT_ATTEMPT3_V2_LEDGER_ROOT:root,
  MCFT_GOVERNED_RETRY_TICKET:path.join(root,"run-"+run_id,"STAGE_TICKET_V2_PRODUCER.json")};
 const script=path.join(__dirname,child.SCRIPT.PRODUCER);
 return {env,script,root};
}
test("Attempt-3 V2 targets route only the exact six real child scripts",()=>{
 const {env,script}=fake();
 assert.equal(Object.keys(child.SCRIPT).length,6);
 assert.equal(child.assertChildContract(env,script).run_id,"6ff9b41f6f7f");
 for(const e of [
 x=>x.MCFT_ATTEMPT3_V2_CHILD="0",
 x=>x.MCFT_GOVERNED_RETRY_STAGE="INVALID",
 x=>x.MCFT_GOVERNED_RETRY_STAGE="TIMING_1",
 x=>x.MCFT_ATTEMPT3_V2_NONCE="bad",
 x=>x.MCFT_SUBJECT_SHA="bad",
 x=>x.MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256="0",
 x=>x.MCFT_GOVERNED_RETRY_PREVIOUS_RECEIPT_SHA256="0",
 x=>x.MCFT_ATTEMPT3_V2_LEDGER_ROOT="relative",
 x=>x.MCFT_GOVERNED_RETRY_TICKET="/other/ticket.json"
 ]){const m={...env};e(m);assert.throws(()=>child.assertChildContract(m,script));}
});
test("signed observed document is hash-bound and cannot silently change",()=>{
 const {env,root}=fake(),doc={real_provider_response_delay_plan:{mode:"test"},real_pipeline_delay_plan:{mode:"test"}};
 const file=path.join(root,"observed.json");fs.writeFileSync(file,JSON.stringify(doc));
 env.MCFT_ATTEMPT3_V2_OBSERVED_FILE=file;env.MCFT_ATTEMPT3_V2_OBSERVATIONS_SHA256=c.digest(doc);
 assert.deepEqual(child.observed(env),doc);
 fs.writeFileSync(file,JSON.stringify({...doc,extra:true}));
 assert.throws(()=>child.observed(env),/CAP09_V2_SIGNED_OBSERVED_CHANGED/);
});
test("V2 child cannot launch as unsigned Linux/CI fixture",()=>{
 assert.throws(()=>child.childTargets(),/CAP09_V2_WINDOWS_ONLY/);
});
