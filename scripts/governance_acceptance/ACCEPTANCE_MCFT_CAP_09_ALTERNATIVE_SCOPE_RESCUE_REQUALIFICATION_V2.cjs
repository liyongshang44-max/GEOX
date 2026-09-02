#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const assert=require("node:assert/strict");
const ROOT=path.resolve(__dirname,"../..");
const AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ALTERNATIVE-SCOPE-RESCUE-REQUALIFICATION-V2.json";
const FROZEN="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ALTERNATIVE-SCOPE-RESCUE-V1.json";
const PROBE="scripts/runtime_acceptance/PROBE_MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_V1.mjs";
function readJson(p){return JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));}
function blob(p){return cp.execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();}
const a=readJson(AUTH), f=readJson(FROZEN);
assert.equal(a.schema_version,"geox_mcft_cap09_alternative_scope_rescue_requalification_v2");
assert.ok(["LIVE_SCAN_REQUIRED_READ_ONLY","SETTLED_IMMUTABLE_LIVE_SCAN"].includes(a.record_status),"ALT_SCOPE_REQUAL_STATUS_INVALID");
assert.match(a.subject_predecessor_sha,/^[0-9a-f]{40}$/);
assert.equal(blob(FROZEN),a.frozen_rescue_contract.authority_blob_sha,"ALT_SCOPE_FROZEN_AUTHORITY_BLOB_DRIFT");
assert.equal(blob(PROBE),a.frozen_rescue_contract.probe_blob_sha,"ALT_SCOPE_FROZEN_PROBE_BLOB_DRIFT");
assert.equal(f.selection_contract.locked_before_live_scan,true);
assert.equal(f.selection_contract.preferred_treatment,null);
assert.equal(f.selection_contract.preferred_field,null);
assert.equal(f.selection_contract.preferred_hybrid,null);
assert.deepEqual(f.selection_contract.eligible_treatments,["T1","T2","T3","T4","T5","T6"]);
assert.equal(f.selection_contract.required_replicate,"R1");
assert.equal(f.selection_contract.explicit_hybrid_identity_required,true);
assert.equal(f.whole_window_policy.minimum_candidate_lead_hours,48);
assert.equal(f.whole_window_policy.planning_search_horizon_hours,168);
assert.equal(f.whole_window_policy.exact_slot_count,24);
assert.equal(f.whole_window_policy.backward_stability_hours,6);
assert.equal(f.whole_window_policy.forward_transition_guard_hours,30);
for(const [k,v] of Object.entries(a.non_effects)) assert.equal(v,false,`ALT_SCOPE_NON_EFFECT_REQUIRED:${k}`);
if(a.record_status==="LIVE_SCAN_REQUIRED_READ_ONLY"){
  assert.equal(a.live_scan.authorized,true);
  assert.equal(a.live_scan.read_only,true);
  assert.equal(a.settlement,null);
}else{
  assert.equal(a.live_scan.authorized,false);
  assert.ok(a.settlement && typeof a.settlement==="object","ALT_SCOPE_SETTLEMENT_REQUIRED");
  assert.match(String(a.settlement.subject_sha||""),/^[0-9a-f]{40}$/);
  assert.ok(Number.isInteger(a.settlement.run_id) && a.settlement.run_id>0,"ALT_SCOPE_SETTLEMENT_RUN_REQUIRED");
  assert.ok(a.live_scan.allowed_terminal_results.includes(a.settlement.result),"ALT_SCOPE_SETTLEMENT_RESULT_INVALID");
}
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_ALTERNATIVE_SCOPE_RESCUE_REQUALIFICATION_V2_GOVERNANCE.json"),JSON.stringify({
 schema_version:"geox_mcft_cap09_alternative_scope_rescue_requalification_governance_v2",
 status:"PASS",record_status:a.record_status,frozen_authority_blob_sha:blob(FROZEN),frozen_probe_blob_sha:blob(PROBE),
 live_scan_required:a.record_status==="LIVE_SCAN_REQUIRED_READ_ONLY",
 database_write_count:0,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false
},null,2)+"\n");
console.log(JSON.stringify({status:"PASS",record_status:a.record_status,live_scan_required:a.record_status==="LIVE_SCAN_REQUIRED_READ_ONLY"}));
