"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const g=require("./SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs");
test("bounded purpose-only signing schemas never include Permit",()=>{
 assert.deepEqual(Object.keys(g.PURPOSES).sort(),["adoption","lineage","owner"]);
 for(const [k,v] of Object.entries(g.PURPOSES)){
  assert(!/PERMIT_V[0-9]/.test(v.domain));
  assert(["APPROVE_BOUNDED_INVENTORY_AS_EXHAUSTIVE_AND_ADJUDICATE_ORDINAL_ONLY","APPROVE_R4285_LINEAGE_NOT_ADOPTION_OR_PERMIT","APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT"].includes(v.decision));
 }
 assert.throws(()=>g.validate({},"permit",{},"a".repeat(40)),/PURPOSE_NOT_ALLOWED/);
});
test("no unsigned arbitrary payload is accepted",()=>{
 for(const p of ["owner","lineage","adoption"])assert.throws(()=>
  g.validate({schema_version:"FAKE",production_authorized:true},p,{issuers:[]},"a".repeat(40)),
  /EXACT_FIELDS/);
});
