"use strict";
const assert=require("node:assert/strict");
const {selectAuthorizationLane,rejectUnadoptedRetry}=require("../runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_DISPATCH_GUARD_V1.cjs");
let count=0;
const legacy=selectAuthorizationLane(["--operator-authorized","--preflight-only","--all"]);
assert.equal(legacy.lane,"LEGACY");assert.equal(legacy.old_authorizer_required,true);count++;
for(const cmd of [
 ["--operator-authorized","--preflight-only","--all","--governed-retry"],
 ["--operator-authorized","--execute","--all","--governed-retry"],
]) {
 const result=selectAuthorizationLane(cmd);assert.equal(result.execute_authorized,false);
 assert.equal(result.old_authorizer_required,false);
 assert.throws(()=>rejectUnadoptedRetry(cmd),/GOVERNED_RETRY_ACTIVATION_NOT_ADOPTED/);
 count++;
}
for(const cmd of [
 ["--governed-retry","--execute","--all"],
 ["--operator-authorized","--governed-retry","--governed-retry","--execute","--all"],
 ["--operator-authorized","--governed-retry","--execute","--preflight-only","--all"]
]) {assert.throws(()=>selectAuthorizationLane(cmd));count++;}
console.log(JSON.stringify({status:"PASS",tests:count,legacy_behavior_unchanged:true,governed_retry_execute_authorized:false}));
