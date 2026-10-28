"use strict";
// Synthetic tests of the Attempt-3 child stage boundary. No Permit signing,
// real Provider, actual Windows execution, DB or S3 access.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const cap=require("./MCFT_CAP09_STAGE_CAPABILITY_V2.cjs");
const atom=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
const {canonical}=require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs");
const digest=x=>crypto.createHash("sha256").update(x).digest("hex");
const domain="GEOX_MCFT_CAP09_HOST_STAGE_ATTEMPT3_V2\n";
const fixtures=[];
test.after(()=>{for(const t of fixtures)fs.rmSync(t,{recursive:true,force:true});});
function fixture(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-v2-stage-"));fixtures.push(tmp);
 const run=path.join(tmp,"run-6ff9b41f6f7f"),nonce=path.join(tmp,"nonce-"+"a".repeat(64));
 fs.mkdirSync(run);fs.mkdirSync(nonce);
 const id="PRODUCER",run_id="6ff9b41f6f7f",n="a".repeat(64);
 const subject_sha="b".repeat(40),envelope_sha256="c".repeat(64);
 const consumed={schema_version:"geox_mcft_cap09_consumed_permit_attempt3_v2",
  run_id,subject_sha,nonce:n,envelope_sha256,adoption_digest:"d".repeat(64),
  resources_sha256:"e".repeat(64),consumed_at:new Date().toISOString(),
  status:"CONSUMED_NO_AUTOMATIC_RETRY",execute_authorized:false,production_authorized:false};
 const bytes=Buffer.from(JSON.stringify(consumed)+"\n");
 fs.writeFileSync(path.join(run,"CONSUMED.json"),bytes);
 fs.writeFileSync(path.join(nonce,"CONSUMED.json"),bytes);
 const script=path.join(tmp,"test-child.js");fs.writeFileSync(script,"// non-executed fixture\n");
 const pair=crypto.generateKeyPairSync("ed25519");
 fs.writeFileSync(path.join(run,"STAGE_V2_PUBLIC_KEY.pem"),pair.publicKey.export({type:"spki",format:"pem"}));
 const previous_sha256=digest(bytes);
 const payload={schema_version:"geox_mcft_cap09_host_stage_capability_attempt3_v2",id,ordinal:0,
  run_id,nonce:n,subject_sha,envelope_sha256,parent_pid:process.ppid,
  script_sha256:digest(fs.readFileSync(script)),previous_sha256,
  issued_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};
 const ticket=path.join(run,"STAGE_TICKET_V2_PRODUCER.json");
 const sign=()=>crypto.sign(null,Buffer.from(domain+canonical(payload)),pair.privateKey).toString("base64");
 function save(signature=sign()){fs.writeFileSync(ticket,JSON.stringify({payload,signature_base64:signature})+"\n");}
 save();
 const args={ticket,run_directory:run,id,run_id,nonce:n,subject_sha,envelope_sha256,script,previous_sha256};
 return {tmp,run,nonce,consumed,payload,args,ticket,pair,save};
}
test("V2 independent ticket has separate domain and cannot initialize from unsigned fake consumed object",()=>{
 assert.deepEqual(cap.STAGES,["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
 assert.equal(typeof cap.issueStageCapability,"function");
 assert.throws(()=>cap.initializeStageAuthority({},{}),/A3_V2_ATOMIC_CONSUMPTION_REQUIRED/);
 assert.throws(()=>atom.assertConsumed({}),/A3_V2_ATOMIC_CONSUMPTION_REQUIRED/);
});
test("V2 stage ticket must match source, run, nonce, parent and chain; first claim succeeds once",()=>{
 const f=fixture();
 const claim=cap.consumeStageCapability(f.args);
 assert.equal(claim.status,"STAGE_CAPABILITY_CONSUMED_NO_RETRY");
 assert.equal(claim.id,"PRODUCER");
 const p=JSON.parse(fs.readFileSync(claim.claim_file,"utf8"));
 assert.equal(p.schema_version,"geox_mcft_cap09_child_stage_claim_attempt3_v2");
 assert.equal(p.ticket_sha256,digest(fs.readFileSync(f.ticket)));
 assert.throws(()=>cap.consumeStageCapability(f.args),/EEXIST/);
});
test("V2 refuses tampered ticket signature, changed subject, altered child and wrong parent",()=>{
 const tamper=[
 f=>{const x=JSON.parse(fs.readFileSync(f.ticket,"utf8"));x.signature_base64=Buffer.alloc(64).toString("base64");fs.writeFileSync(f.ticket,JSON.stringify(x));},
 f=>{f.args.subject_sha="f".repeat(40);},
 f=>{fs.writeFileSync(f.args.script,"// changed\n");},
 f=>{const x=JSON.parse(fs.readFileSync(f.ticket,"utf8"));x.payload.parent_pid=9999;fs.writeFileSync(f.ticket,JSON.stringify(x));},
 f=>{f.args.previous_sha256="f".repeat(64);},
 f=>{f.args.nonce="e".repeat(64);},
 f=>{f.args.id="TIMING_1";},
 f=>{f.payload.expires_at=new Date(Date.now()-1).toISOString();f.save();},
 f=>{f.payload.schema_version="geox_mcft_cap09_host_stage_capability_v1";f.save();},
 f=>{fs.rmSync(path.join(f.run,"CONSUMED.json"));},
 f=>{const x={...f.consumed,status:"NOT_CONSUMED"};fs.writeFileSync(path.join(f.run,"CONSUMED.json"),JSON.stringify(x));}
 ];
 for(const change of tamper){const f=fixture();change(f);assert.throws(()=>cap.consumeStageCapability(f.args));}
 assert.equal(tamper.length,11);
});
test("V2 stage cannot skip missing predecessor or turn v1 consumption into V2",()=>{
 const f=fixture();const q=JSON.parse(fs.readFileSync(path.join(f.run,"CONSUMED.json"),"utf8"));
 q.schema_version="geox_mcft_cap09_consumed_permit_v1";
 fs.writeFileSync(path.join(f.run,"CONSUMED.json"),JSON.stringify(q));
 assert.throws(()=>cap.consumeStageCapability(f.args),/CAP_PREVIOUS_RECEIPT_CHANGED|CAP_V2_NOT_ATOMIC_PERMIT/);
 const f2=fixture();
 f2.args.id="TIMING_1";
 assert.throws(()=>cap.consumeStageCapability(f2.args));
});
