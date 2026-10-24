"use strict";
const assert=require("node:assert/strict");
const v=require("./VERIFY_MCFT_CAP09_DA9_FROZEN_SEMANTIC_SUCCESSOR_V1.cjs");
const scope=v.scope();assert.equal(scope.status,"ISOLATED_SEMANTIC_DELTA_PINNED_NOT_QCP_PASS");
assert.equal(scope.changed_frozen_paths.length,2);
assert.equal(scope.permit_issued,false);assert.equal(scope.third_attempt_authorized,false);
for(const id of v.required){const d={check_id:id,dependency_digest:"sha256:"+"0".repeat(64)};
 const r=v.verifyRegisteredEvidence({decision:d,stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head:scope.subject_sha});
 assert.equal(r.status,"FAIL","UNSIGNED_OR_WRONG_DIGEST_MUST_HOLD:"+id);
}
assert.equal(v.verifyRegisteredEvidence({decision:{check_id:"UNRELATED"},stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head:scope.subject_sha}).status,"NOT_APPLICABLE");
console.log(JSON.stringify({status:"PASS",checks:2+v.required.length,verified_six_check_entries:0,all_six_held_until_signed_exact_head_evidence:true,legacy_frozen_unmodified:true,permit_consumed:false,production_authorized:false}));
