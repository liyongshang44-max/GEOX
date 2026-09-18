"use strict";

const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const crypto=require("node:crypto");

const ROOT=path.resolve(__dirname,"../..");
const CONTROL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-ACTUAL-ARM-CONTROL-V1.json";
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const AM06="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md";

function req(ok,code){if(!ok)throw new Error(code);}
function readJson(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function sha256(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}
function iso(ms){return new Date(ms).toISOString();}
function ceilHour(ms){const h=3_600_000;return Math.ceil(ms/h)*h;}
function nonEffects(){return {
  production_runtime_restart:false,
  production_owner_mutation:false,
  formal_database_mutation:false,
  formal_v5_arm:false,
  formal_v5_epoch_selected:false,
  a0_bootstrap:false,
  o00_started:false,
  provider_request_count:0,
  mcft_cap09_completed:false,
};}

function adjudicateWindow(input){
  const leadHours=input.minimum_lead_hours;
  const slotCount=input.slot_count;
  const authorityAsOfMs=Date.parse(input.authority_as_of);
  const selectionMs=Date.parse(input.selection_time);
  const validUntilMs=Date.parse(input.authority_valid_until);
  req(Number.isInteger(leadHours)&&leadHours===36,"FORMAL_V5_AMENDMENT06_36H_LEAD_REQUIRED");
  req(Number.isInteger(slotCount)&&slotCount===24,"FORMAL_V5_EXACT_24_SLOTS_REQUIRED");
  req(Number.isFinite(authorityAsOfMs)&&Number.isFinite(selectionMs)&&Number.isFinite(validUntilMs),"FORMAL_V5_TIME_INVALID");
  req(authorityAsOfMs<=selectionMs,"FORMAL_V5_FUTURE_STAGE_AUTHORITY_FORBIDDEN");
  const o00Ms=ceilHour(selectionMs+leadHours*3_600_000);
  const o23Ms=o00Ms+(slotCount-1)*3_600_000;
  const forwardHours=Number(input.forward_stability_hours);
  req(Number.isFinite(forwardHours)&&forwardHours>0,"FORMAL_V5_FORWARD_STABILITY_INVALID");
  const coverageEndMs=authorityAsOfMs+forwardHours*3_600_000;
  const minimumStructuralHours=leadHours+(slotCount-1);
  const blockers=[];
  if(forwardHours<minimumStructuralHours)blockers.push("FORMAL_V5_STAGE_AUTHORITY_STRUCTURAL_FORWARD_COVERAGE_LT_59H");
  if(o23Ms>coverageEndMs)blockers.push("FORMAL_V5_STAGE_AUTHORITY_WHOLE_WINDOW_COVERAGE_INSUFFICIENT");
  if(o23Ms>validUntilMs)blockers.push("FORMAL_V5_STAGE_AUTHORITY_VALIDITY_EXPIRES_BEFORE_O23");
  return {
    status:blockers.length?"BLOCKED":"PASS",
    selection_time:iso(selectionMs),
    candidate_o00:iso(o00Ms),
    candidate_o23:iso(o23Ms),
    minimum_lead_hours:leadHours,
    slot_count:slotCount,
    minimum_structural_forward_coverage_hours:minimumStructuralHours,
    authority_as_of:iso(authorityAsOfMs),
    authority_valid_until:iso(validUntilMs),
    forward_stability_hours:forwardHours,
    coverage_end:iso(coverageEndMs),
    blockers,
  };
}

function selftest(){
  const base={
    minimum_lead_hours:36,
    slot_count:24,
    authority_as_of:"2026-09-18T17:00:00.000Z",
    selection_time:"2026-09-18T17:00:00.000Z",
    authority_valid_until:"2026-09-22T00:00:00.000Z",
  };
  const blocked=adjudicateWindow({...base,forward_stability_hours:30});
  req(blocked.status==="BLOCKED","SELFTEST_30H_MUST_BLOCK");
  req(blocked.blockers.includes("FORMAL_V5_STAGE_AUTHORITY_STRUCTURAL_FORWARD_COVERAGE_LT_59H"),"SELFTEST_59H_FLOOR_REQUIRED");
  const pass=adjudicateWindow({...base,forward_stability_hours:72});
  req(pass.status==="PASS","SELFTEST_72H_SHOULD_PASS");
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_actual_arm_preflight_selftest_v1",
    status:"PASS",
    thirty_hour_authority_fail_closed:true,
    fifty_nine_hour_structural_floor_proven:true,
    seventy_two_hour_fixture_admitted:true,
    ...nonEffects(),
  },null,2)+"\n");
}

function current(){
  req(!process.env.GITHUB_ACTIONS&&!process.env.CI,"FORMAL_V5_ACTUAL_ARM_LOCAL_HOST_ONLY");
  req(process.argv.includes("--operator-authorized"),"FORMAL_V5_SEPARATE_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD");
  const main=git("rev-parse","origin/main");
  req(head===main,"FORMAL_V5_ACTUAL_ARM_HEAD_MUST_EQUAL_PROTECTED_MAIN");
  req(git("status","--porcelain")==="","FORMAL_V5_ACTUAL_ARM_WORKTREE_MUST_BE_CLEAN");

  const control=readJson(CONTROL);
  req(control.schema_version==="geox_mcft_cap09_formal_v5_actual_arm_control_v1","FORMAL_V5_ACTUAL_ARM_CONTROL_SCHEMA_REQUIRED");
  req(control.execution_boundary?.github_actions_actual_arm_forbidden===true,"FORMAL_V5_GITHUB_ACTUAL_ARM_FORBIDDEN");
  req(control.temporal_contract?.minimum_epoch_selection_lead_hours===36,"FORMAL_V5_CONTROL_36H_LEAD_REQUIRED");
  req(control.temporal_contract?.slot_count===24,"FORMAL_V5_CONTROL_24_SLOTS_REQUIRED");

  const am06=fs.readFileSync(path.join(ROOT,AM06),"utf8");
  for(const marker of [
    "Amendment-06 effectiveness time + 36 hours",
    "for **every** slot O00–O23",
    "every frozen FAO-56 maize variant",
  ]) req(am06.includes(marker),"FORMAL_V5_AMENDMENT06_MARKER_MISSING:"+marker);

  const registry=readJson(REGISTRY);
  req(registry.status==="ACTIVE","FORMAL_V5_CURRENT_CROP_REGISTRY_ACTIVE_REQUIRED");
  req(registry.selection_policy==="LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW","FORMAL_V5_CURRENT_CROP_SELECTION_POLICY_REQUIRED");
  req(registry.candidate_artifacts_admissible===false,"FORMAL_V5_CANDIDATE_CROP_AUTHORITY_FORBIDDEN");
  const nowMs=Date.now();
  const eligible=(registry.entries||[]).filter(row=>{
    const a=Date.parse(row.authority_as_of),v=Date.parse(row.authority_valid_until);
    return Number.isFinite(a)&&Number.isFinite(v)&&a<=nowMs&&nowMs<=v;
  }).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
  req(eligible.length>0,"NO_CURRENT_EFFECTIVE_CROP_AUTHORITY_AT_FORMAL_V5_SELECTION_TIME");
  const entry=eligible[0];
  const rel=entry.authority_ref;
  const bytes=fs.readFileSync(path.join(ROOT,rel));
  req(sha256(bytes)===entry.authority_sha256,"FORMAL_V5_CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH");
  const authority=JSON.parse(bytes.toString("utf8"));
  req(authority.status==="PASS"&&authority.architecture_effective===true&&authority.runtime_consumption_authorized===true,"FORMAL_V5_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE");
  const biological=authority.biological_stage||{};
  req(biological.epistemic_class==="THERMAL_MODEL_DERIVED","FORMAL_V5_THERMAL_STAGE_AUTHORITY_REQUIRED");
  req(biological.observed_biological_stage_claimed===false,"FORMAL_V5_OBSERVED_STAGE_PROMOTION_FORBIDDEN");

  const result=adjudicateWindow({
    minimum_lead_hours:36,
    slot_count:24,
    authority_as_of:biological.authority_as_of,
    selection_time:new Date(nowMs).toISOString(),
    authority_valid_until:biological.authority_valid_until,
    forward_stability_hours:biological.forward_stability_hours,
  });
  const proof={
    schema_version:"geox_mcft_cap09_formal_v5_actual_arm_preflight_v1",
    status:result.status,
    deployment_subject_sha:head,
    selected_current_crop_authority_ref:rel,
    selected_current_crop_authority_sha256:entry.authority_sha256,
    crop_water_use_stage:authority.crop_water_use_stage,
    biological_stage:biological.resolved_biological_stage,
    temporal_adjudication:result,
    formal_v5_arm_ready_from_this_preflight:result.status==="PASS",
    blocker_class:result.status==="BLOCKED"?"NO_CURRENT_LEGAL_FORMAL_V5_EPOCH_AUTHORITY":null,
    ...nonEffects(),
  };
  process.stdout.write(JSON.stringify(proof,null,2)+"\n");
  if(result.status!=="PASS")process.exitCode=2;
}

if(process.argv.includes("--selftest"))selftest();
else current();
