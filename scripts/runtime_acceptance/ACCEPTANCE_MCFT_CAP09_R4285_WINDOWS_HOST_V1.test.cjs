"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const host=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V1.cjs");
const atomic=require("./MCFT_CAP09_R4285_PERMIT_ATOMIC_V1.cjs");
const approval=require("./MCFT_CAP09_R4285_EXECUTION_APPROVAL_V1.cjs");
const child=require("./MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs");
const cap=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const sha=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const base="4de4973b2b908f614fc4889022c8e0a33b577fec";
const ROOT=path.resolve(__dirname,"../..");
test("Host accepts only explicit Windows test-only flags and exact absolute input",()=>{
 const abs=path.resolve("review.json");
 assert.deepEqual(host.parse(["--preflight-only","--input",abs]),{mode:"--preflight-only",input:abs});
 assert.deepEqual(host.parse(["--execute","--input",abs]),{mode:"--execute",input:abs});
 for(const args of [[],["--execute"],["--execute","--input","relative.json"],
  ["--execute","--input",abs,"--force"],["--provision","--input",abs]])
  assert.throws(()=>host.parse(args));
});
test("Host rejects Linux, CI, Node preload, old Attempt-3 child and synthetic source",()=>{
 assert.throws(()=>host.hostOnly({},"linux"));
 for(const env of [{CI:"1"},{GITHUB_ACTIONS:"true"},{NODE_PATH:"fake"},
  {MCFT_ATTEMPT3_V2_CHILD:"1"},{MCFT_R4285_CHILD:"1"}])
  assert.throws(()=>host.hostOnly(env,"win32"));
});
test("no incomplete/ad-hoc execution input can default to approval",()=>{
 assert.throws(()=>host.checkInput({},false));
 assert.throws(()=>host.checkInput({},true));
 const baseInput=Object.fromEntries(host.INPUTS.map(x=>[x,x==="first_base"?
  "2026-12-01T00:00:00.000Z":path.resolve(x)]));
 assert.deepEqual(host.checkInput(baseInput,false),baseInput);
 assert.throws(()=>host.checkInput(baseInput,true),/R4285_HOST_INPUT_EXACT/);
 assert.throws(()=>host.checkInput({...baseInput,execution_approval_file:path.resolve("x")},false));
});
test("run and nonce remain distinct; fake Permit, Native Adoption and approval rejected",()=>{
 assert.equal(host.RUN,"4285c3ce342c");
 assert.equal(permit.RUN,host.RUN);
 assert.equal(atomic.RUN,host.RUN);
 assert.equal(approval.DOMAIN.includes("R4285_PHYSICAL_EXECUTION_APPROVAL"),true);
 assert.equal(permit.DOMAIN.includes("R4285_ISOLATED_TEST_PERMIT"),true);
 assert.notEqual(permit.DOMAIN,approval.DOMAIN);
 assert(!atomic.isPrepared({status:"R4285_ATOMIC_PREPARED_NOT_CONSUMED"}));
 assert.throws(()=>cap.initializeStageAuthority({}, {}, ""),/IN_PROCESS_CONSUMED_CAPABILITY/);
});
test("original scientific stages retain exact historical order and six artifacts",()=>{
 assert.deepEqual(scheduler.STAGES,cap.STAGES);
 assert.equal(Object.keys(child.SCRIPT).length,6);
 assert(child.SCRIPT.PRODUCER.includes("R4285"));
 assert(child.SCRIPT.TIMING_1.includes("R4285"));
 assert(child.SCRIPT.CONTROLLED_DELAY.includes("R4285"));
 assert(child.SCRIPT.AGGREGATE.includes("R4285"));
 assert(host.REQUIRED_HOST_SOURCES.includes("scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs"));
});
test("historical Attempt-3 and scientific scripts preserve identical main Git blobs",()=>{
 const historical=[
  "scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts",
  "scripts/runtime_acceptance/AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts",
  "scripts/runtime_acceptance/MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_STAGE_RECEIPTS_V1.cjs"
 ];
 for(const file of historical){
  const original=cp.execFileSync("git",["show",base+":"+file],{cwd:ROOT});
  const current=fs.readFileSync(path.join(ROOT,file));
  assert(current.equals(original),"HISTORICAL_SOURCE_DRIFT:"+file);
 }
});
test("new R4285 source is mechanically based on historical runtime, not alternate providers",()=>{
 const pairs=[
  ["MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs","MCFT_CAP09_R4285_CURRENT_BASELINE_EXECUTION_V1.cjs"],
  ["RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts","RUN_MCFT_CAP09_R4285_PRODUCER_V1.ts"],
  ["RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts","RUN_MCFT_CAP09_R4285_TIMING_V1.ts"],
  ["AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts","AGGREGATE_MCFT_CAP09_R4285_TIMING_V1.ts"],
  ["MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs","MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs"]];
 for(const [old,newer] of pairs){
  const src=fs.readFileSync(path.join(__dirname,old),"utf8");
  const dst=fs.readFileSync(path.join(__dirname,newer),"utf8");
  assert(dst.length>=src.length&&dst.includes("R4285"),"R4285_INHERITED_SCIENCE_MISSING:"+newer);
 }
});
test("Windows Host refuses unqualified invocation before touching physical resources",()=>{
 const file=path.join(__dirname,"MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
 const x=cp.spawnSync(process.execPath,[file,"--execute","--input",path.resolve("not-existing.json")],
  {encoding:"utf8",timeout:10000});
 assert.notEqual(x.status,0);
 const result=JSON.parse(x.stderr.trim());
 assert.equal(result.status,"HOLD_R4285_HOST");
 assert.equal(result.production_authorized,false);
 assert.equal(result.auto_retry,false);
});

test("expired static Resource Owner signature cannot promote stale dynamic observation",()=>{
 const now=Date.now(),start=new Date(now-5000).toISOString();
 const facts=Object.fromEntries(resource.FACT_BINDINGS.map(k=>[k,"BOUND"]));
 Object.assign(facts,{run_id:host.RUN,observed_at:start,owner_exclusive:true,production_bindings_present:false,production_authorized:false});
 const signed={...facts,readback_sha256:"a".repeat(64),issued_at:new Date(now-4000).toISOString(),expires_at:new Date(now+1000000).toISOString()};
 const readback={status:"RAW_READBACK_BYTES_MATCH_NOT_AUTHORITY",sha256:signed.readback_sha256,facts};
 assert.equal(resource.assertDynamicFreshness(signed,readback,{now}).status,"R4285_RECENT_SIGNED_RESOURCE_READBACK_NOT_A_LIVE_PROBE");
 assert.throws(()=>resource.assertDynamicFreshness(signed,readback,{now:now+121000}),/DYNAMIC_READBACK_EXPIRED/);
 assert.throws(()=>resource.assertDynamicFreshness({...signed,owner_exclusive:false},readback,{now}));
 assert.throws(()=>resource.assertDynamicFreshness(signed,{...readback,facts:{...facts,production_bindings_present:true}},{now}));
});
test("forged Stage Ticket is rejected before creating a SPENT marker or launching a stage",()=>{
 const os=require("node:os"),root=fs.mkdtempSync(path.join(os.tmpdir(),"r4285-fake-ticket-"));
 try{
  const dir=path.join(root,"run-"+host.RUN);fs.mkdirSync(dir);
  const capability=require("./MCFT_CAP09_R4285_STAGE_CAPABILITY_V1.cjs");
  const key=crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(path.join(dir,"STAGE_R4285_PUBLIC_KEY.pem"),key.publicKey.export({type:"spki",format:"pem"}));
  const receipt=Buffer.from('{"not":"valid"}');
  fs.writeFileSync(path.join(dir,"CONSUMED.json"),receipt);
  const script=path.join(root,"dummy.cjs");fs.writeFileSync(script,"// no effects\n");
  const previous_sha256=crypto.createHash("sha256").update(receipt).digest("hex");
  const p={schema_version:"geox_mcft_cap09_host_stage_capability_r4285_v1",id:"PRODUCER",
   ordinal:0,run_id:host.RUN,nonce:"d".repeat(64),subject_sha:"a".repeat(40),
   envelope_sha256:"b".repeat(64),parent_pid:process.ppid,script_sha256:sha(script),
   previous_sha256,issued_at:new Date(Date.now()-1000).toISOString(),
   expires_at:new Date(Date.now()+30000).toISOString()};
  const untrusted=crypto.generateKeyPairSync("ed25519");
  const canonical=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs").canonical;
  const signature_base64=crypto.sign(null,Buffer.from("GEOX_MCFT_CAP09_HOST_STAGE_R4285_V1\n"+canonical(p)),untrusted.privateKey).toString("base64");
  const ticket=path.join(dir,"STAGE_TICKET_R4285_PRODUCER.json");
  fs.writeFileSync(ticket,JSON.stringify({payload:p,signature_base64}));
  assert.throws(()=>capability.consumeStageCapability({
   ticket,run_directory:dir,id:"PRODUCER",run_id:host.RUN,nonce:p.nonce,
   subject_sha:p.subject_sha,envelope_sha256:p.envelope_sha256,script,previous_sha256
  }),/CAP_BAD_SIGNATURE/);
  assert.equal(fs.existsSync(path.join(dir,"SPENT_R4285_PRODUCER")),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
