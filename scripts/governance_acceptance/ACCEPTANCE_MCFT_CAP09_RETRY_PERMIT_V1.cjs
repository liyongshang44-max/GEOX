"use strict";
const assert=require("node:assert/strict"), fs=require("node:fs"), os=require("node:os"), path=require("node:path"), crypto=require("node:crypto"), cp=require("node:child_process");
const mod=path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const {DOMAIN,canonical,sha,verifyPermit,consumePermit}=require(mod);
async function main() {
const root=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-permit-tests-"));
let tests=0;
try {
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 const now=Date.now();
 const iso=n=>new Date(n).toISOString();
 const trust={schema_version:"geox_mcft_cap09_retry_trust_v1",adopted:true,execution_enabled:false,
  host_id:"synthetic-host",operator_id:"synthetic-operator",ledger_root:root,
  issuers:[{issuer_id:"synthetic-governance",key_id:"test",role:"INDEPENDENT_RETRY_GOVERNANCE",revoked:false,
   not_before:iso(now-60000),not_after:iso(now+60000),public_key_pem:publicKey.export({type:"spki",format:"pem"}),
   spki_sha256:sha(publicKey.export({type:"spki",format:"der"}))}]};
 const payload={schema_version:"geox_mcft_cap09_signed_retry_permit_v1",issuer_id:"synthetic-governance",key_id:"test",
  nonce:"a".repeat(64),run_id:"abc123def456",parent_run_id:"72dc0304a21a",attempt_ordinal:2,subject_sha:"b".repeat(40),
  host_id:"synthetic-host",issued_at:iso(now-1000),expires_at:iso(now+30000),arm_sha256:"c".repeat(64),
  observations_sha256:"d".repeat(64),plan_sha256:"e".repeat(64),scope:"ISOLATED_QUALIFICATION_SINGLE_ATTEMPT"};
 const context={host_id:payload.host_id,head:payload.subject_sha,main:payload.subject_sha,clean:true,now:iso(now),
  arm_sha256:payload.arm_sha256,observations_sha256:payload.observations_sha256,plan_sha256:payload.plan_sha256};
 const sign=p=>({payload:p,signature_base64:crypto.sign(null,Buffer.from(DOMAIN+canonical(p)),privateKey).toString("base64")});
 const envelope=sign(payload);
 assert.equal(verifyPermit(envelope,trust,context).execute_authorized,false); tests++;
 function reject(e,t,c,re) {assert.throws(()=>verifyPermit(e,t,c),re);tests++;}
 for(const [k,v] of [["scope","PRODUCTION"],["run_id","72dc0304a21a"],["nonce","a"],["attempt_ordinal",1],["host_id","other"],
  ["subject_sha","a".repeat(40)],["issuer_id","unknown"],["arm_sha256","f".repeat(64)],["observations_sha256","f".repeat(64)],
  ["plan_sha256","f".repeat(64)],["issued_at",iso(now+1000)],["expires_at",iso(now)]]) reject(sign({...payload,[k]:v}),trust,context);
 reject({...envelope,payload:{...payload,nonce:"b".repeat(64)}},trust,context,/BAD_SIGNATURE/);
 reject(sign({...payload,execute_authorized:true}),trust,context,/UNKNOWN_OR_MISSING/);
 reject({...envelope,signature_base64:envelope.signature_base64+"\n"},trust,context,/ENCODING/);
 reject(envelope,{...trust,adopted:false},context,/NOT_ADOPTED/);
 reject(envelope,{...trust,execution_enabled:"true"},context,/FLAG_INVALID/);
 reject(envelope,{...trust,operator_id:payload.issuer_id},context,/NOT_INDEPENDENT/);
 reject(envelope,{...trust,issuers:[...trust.issuers,...trust.issuers]},context,/DUPLICATE/);
 for(const [k,v] of [["revoked",true],["role","OPERATOR"],["spki_sha256","f".repeat(64)],["not_after",iso(now)]])
  reject(envelope,{...trust,issuers:[{...trust.issuers[0],[k]:v}]},context);
 reject(envelope,trust,{...context,main:"f".repeat(40)},/MAIN_MOVED/);
 reject(envelope,trust,{...context,clean:false},/DIRTY/);
 assert.throws(()=>consumePermit({payload}),/VERIFICATION_REQUIRED/);tests++;
 const p=verifyPermit(envelope,trust,context);
 assert(Object.isFrozen(p.payload));tests++;
 const receipt=consumePermit(p); assert.equal(receipt.execute_authorized,false);tests++;
 assert.throws(()=>consumePermit(p),/VERIFICATION_REQUIRED/);tests++;
 assert.throws(()=>consumePermit(verifyPermit(envelope,trust,context)),/EEXIST/);tests++;
 assert.throws(()=>consumePermit(verifyPermit(sign({...payload,nonce:"c".repeat(64)}),trust,context)),/EEXIST/);tests++;
 assert(fs.existsSync(path.join(root,"nonce-"+"c".repeat(64))));tests++; // partial reservation is burned
 assert.throws(()=>consumePermit(verifyPermit(sign({...payload,run_id:"abc123def457"}),trust,context)),/EEXIST/);tests++;
 // Independent processes contend on the same adopted nonce: exactly one wins.
 const concurrent=sign({...payload,nonce:"d".repeat(64),run_id:"abc123def458"});
 const fixture=path.join(root,"fixture.json");fs.writeFileSync(fixture,JSON.stringify({envelope:concurrent,trust,context}));
 const program=`const fs=require('node:fs');const m=require(process.argv[1]);const f=JSON.parse(fs.readFileSync(process.argv[2]));try{m.consumePermit(m.verifyPermit(f.envelope,f.trust,f.context));process.exitCode=0}catch(e){process.exitCode=e.code==='EEXIST'?7:9}`;
 const launch=()=>new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,["-e",program,mod,fixture],{stdio:"ignore"});child.on("error",reject);child.on("exit",resolve);});
 const codes=await Promise.all([launch(),launch(),launch(),launch()]);
 assert.deepEqual(codes.sort(),[0,7,7,7]);tests++;
 const disabled=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json")));
 assert.equal(disabled.adopted,false);assert.equal(disabled.execution_enabled,false);assert.deepEqual(disabled.issuers,[]);tests++;
 console.log(JSON.stringify({status:"PASS",tests,concurrent_consumers:4,successful_consumers:1,synthetic_only:true,execute_authorized:false}));
} finally {fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
