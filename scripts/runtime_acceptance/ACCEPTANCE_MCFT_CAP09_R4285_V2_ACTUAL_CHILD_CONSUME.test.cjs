"use strict";
/* Fixture test of actual frozen V1 child consume, without Host or physical stages. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const cp=require("node:child_process");
const canonical=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical;
const child=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const DOMAIN="GEOX_MCFT_CAP09_HOST_STAGE_R4285_V1\n";
const RUN="4285c3ce342c",NONCE="c".repeat(64),SUBJECT="a".repeat(40),ENVELOPE="f".repeat(64);
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-v2-child-compat-"));
 const run=path.join(root,"run-"+RUN);fs.mkdirSync(run);
 const consumed={schema_version:"geox_mcft_cap09_consumed_permit_r4285_v1",
  run_id:RUN,subject_sha:SUBJECT,nonce:NONCE,
  permit_envelope_sha256:ENVELOPE,status:"CONSUMED_NO_AUTOMATIC_RETRY",
  production_authorized:false};
 fs.writeFileSync(path.join(run,"CONSUMED.json"),JSON.stringify(consumed)+"\n");
 const pair=crypto.generateKeyPairSync("ed25519");
 fs.writeFileSync(path.join(run,"STAGE_R4285_PUBLIC_KEY.pem"),
  pair.publicKey.export({format:"pem",type:"spki"}));
 const script=path.join(__dirname,child.SCRIPT.CONTROLLED_DELAY),now=Date.now();
 const previous=path.join(run,"TIMING_3");fs.mkdirSync(previous);
 fs.writeFileSync(path.join(previous,"COMPLETED.json"),JSON.stringify({
  id:"TIMING_3",status:"PASS",synthetic_predecessor:true})+"\n");
 const payload={schema_version:"geox_mcft_cap09_host_stage_capability_r4285_v1",
  id:"CONTROLLED_DELAY",ordinal:4,run_id:RUN,nonce:NONCE,subject_sha:SUBJECT,
  envelope_sha256:ENVELOPE,parent_pid:process.pid,script_sha256:sha(fs.readFileSync(script)),
  previous_sha256:sha(fs.readFileSync(path.join(previous,"COMPLETED.json"))),
  issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+30000).toISOString()};
 const ticket=path.join(run,"STAGE_TICKET_R4285_CONTROLLED_DELAY.json");
 fs.writeFileSync(ticket,JSON.stringify({payload,signature_base64:crypto.sign(null,
  Buffer.from(DOMAIN+canonical(payload)),pair.privateKey).toString("base64")})+"\n");
 return {root,run,script,ticket,payload};
}
function launch(f){
 const source="const cap=require("+JSON.stringify(require.resolve("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs"))+");"+
  "cap.consumeStageCapability("+JSON.stringify({
   ticket:f.ticket,run_directory:f.run,id:"CONTROLLED_DELAY",run_id:RUN,nonce:NONCE,
   subject_sha:SUBJECT,envelope_sha256:ENVELOPE,script:f.script,
   previous_sha256:f.payload.previous_sha256})+");process.stdout.write('CHILD_CLAIMED')";
 return cp.spawnSync(process.execPath,["-e",source],{encoding:"utf8",windowsHide:true,timeout:8000});
}
test("real original child ticket consumer accepts V2-compatible wire format",()=>{
 const f=fixture();
 try{
  const first=launch(f);
  assert.equal(first.status,0,"child must accept signed wire");assert.equal(first.stdout,"CHILD_CLAIMED");
  assert(fs.existsSync(path.join(f.run,"SPENT_R4285_CONTROLLED_DELAY","CLAIMED.json")));
  const again=launch(f);assert.notEqual(again.status,0,"replay must fail after first spend");
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test("real original child refuses forged signature before SPENT",()=>{
 const f=fixture();
 try{
  const t=JSON.parse(fs.readFileSync(f.ticket,"utf8"));
  t.signature_base64=Buffer.alloc(64).toString("base64");
  fs.writeFileSync(f.ticket,JSON.stringify(t)+"\n");
  assert.notEqual(launch(f).status,0);
  assert(!fs.existsSync(path.join(f.run,"SPENT_R4285_CONTROLLED_DELAY")));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
