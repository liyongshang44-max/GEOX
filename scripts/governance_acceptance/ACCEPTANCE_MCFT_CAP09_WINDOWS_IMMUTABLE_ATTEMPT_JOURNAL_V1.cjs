"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {reserveOnce,appendImmutableReceipt}=require("../runtime_acceptance/MCFT_CAP09_WINDOWS_IMMUTABLE_ATTEMPT_JOURNAL_V1.cjs");
process.env.MCFT_CAP09_JOURNAL_SYNTHETIC_TEST="1";
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-cap09-reservation-tests-"));
let count=0;
try {
 const run="abc123def456",digest="a".repeat(64),head="b".repeat(40);
 const first=reserveOnce(tmp,run,digest,head);assert(fs.existsSync(first.file));count++;
 assert.throws(()=>reserveOnce(tmp,run,digest,head),/EEXIST/);count++;
 const receipt=appendImmutableReceipt(tmp,"STAGE_01.json",{status:"FAIL",reason:"synthetic-only"});
 assert(fs.existsSync(receipt.file)&&receipt.sha256.length===64);count++;
 assert.throws(()=>appendImmutableReceipt(tmp,"STAGE_01.json",{}),/EEXIST/);count++;
 assert.throws(()=>appendImmutableReceipt(tmp,"../STAGE_02.json",{}));count++;
 assert.throws(()=>reserveOnce(tmp,"bad",digest,head));count++;
 assert.throws(()=>reserveOnce(tmp,"abc123def457","invalid",head));count++;
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
console.log(JSON.stringify({status:"PASS",tests:count,real_provider_calls:0,production_writes:0,synthetic_only:true}));
