"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const gate=require("./MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs");
const root=path.resolve(__dirname,"../..");
const old=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V1.json"));
const v2=fs.readFileSync(path.join(__dirname,"MCFT_CAP09_RETRY_TRUST_V2.json"));
const clone=x=>JSON.parse(JSON.stringify(x));
test("pending V2 cannot authorize or sign",()=>{
 const r=gate.candidate(old,v2);
 assert.equal(r.authorized,false);assert.equal(r.permit_authorized,false);
 assert.match(r.status,/(HOLD|NOT_AUTHORIZED)/);
 if(process.platform!=="win32"||process.env.CI||process.env.GITHUB_ACTIONS)
  assert.throws(()=>gate.verifyEffective(),/TRUST_V2_WINDOWS_NATIVE_ONLY/);
});
test("old Trust V1 exact issuer, frozen capability and ledger must remain",()=>{
 const j=JSON.parse(v2);j.issuers[0].not_after="2099-01-01T00:00:00.000Z";
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/OLD_ISSUER_CHANGED/);
 for(const k of ["ledger_root","adopted","execution_enabled"]){
  const z=JSON.parse(v2);z[k]=k==="ledger_root"?"C:\\unsafe":true;
  assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(z))),/FROZEN_FIELD_DRIFT/);
 }
});
test("no synthetic self-approval can activate",()=>{
 const j=JSON.parse(v2);
 j.succession.owner_registration_approval={approved:true};
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/SELF_APPROVAL_FORBIDDEN/);
});

test("synthetic successor public key still requires independent Owner approval",()=>{
 const crypto=require("node:crypto");
 const pair=crypto.generateKeyPairSync("ed25519");
 const digest=crypto.createHash("sha256").update(pair.publicKey.export({format:"der",type:"spki"})).digest("hex");
 const j=JSON.parse(v2),now=Date.now();
 const future=d=>new Date(now+d).toISOString();
 const key={issuer_id:"mcft_cap09_operator_mylr1",key_id:"mcft_cap09_operator_v2_"+digest.slice(0,16),
  role:"ACCOUNTABLE_SINGLE_OPERATOR",revoked:false,not_before:future(-1000),
  not_after:future(86400000),public_key_pem:pair.publicKey.export({format:"pem",type:"spki"}),spki_sha256:digest};
 j.issuers[2]=key;j.succession.operator_successor_key_id=key.key_id;
 j.succession.registration_state="PENDING_INDEPENDENT_OWNER_AUTHORITY";
 assert.equal(gate.candidate(old,Buffer.from(JSON.stringify(j))).authorized,false);
 j.succession.owner_registration_approval={approved:true};
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/SELF_APPROVAL_FORBIDDEN/);
});

// Exact public candidate is source-bound, but neither a registered key nor a Permit.
test("local public key is exact and remains without registration time or signature authority",()=>{
 const crypto=require("node:crypto");
 const j=JSON.parse(v2),k=j.issuers[2],r=gate.candidate(old,v2);
 assert.equal(j.issuers.length,3);
 assert.equal(k.key_id,"mcft_cap09_operator_v2_0b4811f1f4bf09ec");
 assert.equal(k.spki_sha256,"0b4811f1f4bf09ec3f633c0900b405d56a8f28e55b8d6d7819d0f2295d86e6af");
 assert.equal(crypto.createHash("sha256").update(crypto.createPublicKey(k.public_key_pem).export({type:"spki",format:"der"})).digest("hex"),k.spki_sha256);
 assert.equal(k.not_before,null);assert.equal(k.not_after,null);
 assert.equal(r.status,"TRUST_V2_PUBLIC_CANDIDATE_UNREGISTERED_NOT_AUTHORIZED");
 assert.equal(r.registered,false);assert.equal(r.authorized,false);
 assert.equal(r.permit_authorized,false);assert.equal(j.succession.owner_registration_approval,null);
 assert.equal(j.succession.trust_successor_activated,false);
});
test("partial validity, premature approval and forged public candidate fail closed",()=>{
 const base=JSON.parse(v2),mutate=(fn,reason)=>{
  const j=JSON.parse(JSON.stringify(base));fn(j);
  assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),reason);
 };
 mutate(j=>{j.issuers[2].not_before="2026-11-15T00:00:00.000Z"},/TRUST_V2_NEW_KEY_TIME/);
 mutate(j=>{j.succession.registration_state="PENDING_INDEPENDENT_OWNER_AUTHORITY"},/TRUST_V2_PUBLIC_CANDIDATE_MUST_REMAIN_PENDING/);
 mutate(j=>{j.issuers[2].spki_sha256="a".repeat(64)},/TRUST_V2_SPKI_DRIFT/);
 mutate(j=>{j.issuers[2].revoked=true},/TRUST_V2_NEW_KEY_REVOKED/);
 mutate(j=>{j.issuers[2].key_id="other"},/TRUST_V2_KEY_ID_UNBOUND/);
 mutate(j=>{j.succession.owner_registration_approval={approved:true}},/TRUST_V2_SELF_APPROVAL_FORBIDDEN/);
});
