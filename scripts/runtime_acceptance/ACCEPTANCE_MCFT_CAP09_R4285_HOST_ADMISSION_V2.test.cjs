"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const v2host=require("./MCFT_CAP09_R4285_HOST_ADMISSION_V2.cjs");
test("V2 Host exports a read-only admission boundary only",()=>{
 const exports=Object.keys(v2host);
 assert.deepEqual(exports.sort(),["noUnsafeEnvironment","verifyDynamicReadOnly"].sort());
 assert(!exports.some(k=>/^(execute|consume|sign|issue|preflight)$/i.test(k)));
});
test("forged stable identity never reaches Windows PG/S3 or ordinary V1 preflight",async()=>{
 await assert.rejects(v2host.verifyDynamicReadOnly({stable:{status:"PASS"},intent:{status:"PASS"},ctx:{}}),
  /V2_STABLE_NOT_VERIFIED/);
});
test("V2 no-permit and no-Owner inputs fail closed before resource checks",async()=>{
 await assert.rejects(v2host.verifyDynamicReadOnly({}),/STABLE_INPUT_REQUIRED/);
});
