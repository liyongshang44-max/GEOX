"use strict";
/* Synthetic-only V4 source contract. No live GitHub, credentials, signing or Permit. */
const test=require("node:test"),assert=require("node:assert/strict");
const native=require("./MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs");
test("V4 QCP74 requires newly owned check PASS",()=>{
 const base="a".repeat(40),head="b".repeat(40),check="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1";
 const prev="CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1";
 const names=Array.from({length:72},(_,i)=>"OLD_"+i).concat(prev,check);
 const def={checks:names.map(check_id=>({check_id}))};
 const rows=names.map((check_id,i)=>i===73?{check_id,status:"PASS"}:{check_id,status:"NOT_APPLICABLE",reason_code:"HISTORIC_SOURCE_NOT_REISSUED"});
 const raw={status:"PASS",head_sha:head,base_sha:base,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",
  counts:{total_checks:74,pass:1,not_applicable:73,fail:0,unknown:0,forbidden:0,
   authority_errors:0,unknown_changed_paths:0,blocker_count:0},blockers:[],results:rows};
 assert.equal(native.checkQcp74(raw,def,head,base).checks,74);
 const fake={...raw,results:rows.map(x=>x.check_id===check?{...x,status:"NOT_APPLICABLE",reason_code:"NO"}:x),
   counts:{...raw.counts,pass:0,not_applicable:74}};
 assert.throws(()=>native.checkQcp74(fake,def,head,base),/NEW_CHECK_REQUIRED/);
});
test("V4 requires independent trust governance authority input",()=>{
 assert(native.INPUT_FIELDS.includes("trust_successor_authority_file"));
 const bad=Object.fromEntries(native.INPUT_FIELDS.map(k=>[k,k.endsWith("_sha256")?"a".repeat(64):"/tmp/test"]));
 delete bad.trust_successor_authority_file;
 assert.throws(()=>native.checkInput(bad));
});
test("V4 refuses check-only qualification from synthetic JS object",()=>{
 assert.equal(native.isNativeVerified({status:"NATIVE_R4285_QCP74_ADOPTION_V5_VERIFIED_NOT_PERMIT"}),false);
});
