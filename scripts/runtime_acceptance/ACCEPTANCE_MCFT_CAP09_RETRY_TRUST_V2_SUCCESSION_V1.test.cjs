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
 assert.match(r.status,/HOLD/);
 assert.throws(()=>gate.verifyEffective(),/INDEPENDENT_REGISTRATION_AUTHORITY/);
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
 assert.equal(gate.candidate(old,Buffer.from(JSON.stringify(j))).authorized,false);
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
 j.issuers.push(key);j.succession.operator_successor_key_id=key.key_id;
 j.succession.registration_state="PENDING_INDEPENDENT_OWNER_AUTHORITY";
 assert.equal(gate.candidate(old,Buffer.from(JSON.stringify(j))).authorized,false);
 j.succession.owner_registration_approval={approved:true};
 assert.throws(()=>gate.candidate(old,Buffer.from(JSON.stringify(j))),/SELF_APPROVAL_FORBIDDEN/);
});
