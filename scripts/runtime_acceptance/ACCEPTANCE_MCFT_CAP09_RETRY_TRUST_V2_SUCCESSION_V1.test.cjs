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
