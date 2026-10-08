#!/usr/bin/env node
"use strict";

/**
 * Engineering model ONLY — NOT A FORMAL START AUTHORITY.
 *
 * This module has no IO, production imports, DB connections, network calls,
 * scheduler writes, arm mutations, side effects, or live-mode entrypoint.
 * Inputs are fixtures/claims for design qualification; a future production
 * verifier must independently prove immutable receipts before admitting A0.
 */

const crypto=require("node:crypto");
const HOUR_MS=3_600_000;
const REQUIRED_CHECKS=Object.freeze([
  "EXACT_MAIN_RUNTIME_SUBJECT",
  "EXACT_IMAGE_DUAL_OWNER_H5",
  "FENCED_OWNER_T1_T2",
  "FORMAL_STORE_SCHEMA_ACL",
  "A0_SCOPE_PRISTINE",
  "PHASE6_GITHUB_TRIGGER_ZERO",
  "G11_ACTIVE_ROUTE_QUALIFIED",
  "R6_STAGE_CONSUMER_QUALIFIED",
  "G12_G13_CLOSURE_QUALIFIED",
  "CURRENT_CROP_REGISTRY_AND_CONTINUITY",
  "EXPLICIT_OPERATOR_GO_NO_GO",
]);

function fail(code){throw new Error("AM22_"+code);}
function expect(ok,code){if(!ok)fail(code);}
function canonicalIso(value,code){
  expect(typeof value==="string",code);
  const ms=Date.parse(value);
  expect(Number.isFinite(ms)&&new Date(ms).toISOString()===value,code);
  return ms;
}
function sha(value,code){expect(typeof value==="string"&&/^[0-9a-f]{40}$/.test(value),code);return value;}
function digest(value,code){expect(typeof value==="string"&&/^sha256:[0-9a-f]{64}$/.test(value),code);return value;}
function exactHour(ms){return ms%HOUR_MS===0;}
function nextHour(ms){return Math.floor(ms/HOUR_MS)*HOUR_MS+HOUR_MS;}
function iso(ms){return new Date(ms).toISOString();}
function checkedRecord(x,code){expect(x!==null&&typeof x==="object"&&!Array.isArray(x),code);return x;}
function validReceipt(receipt,checkId,subject,now){
  const r=checkedRecord(receipt,"RECEIPT_MISSING_"+checkId);
  expect(r.check_id===checkId,"CHECK_ID_MISMATCH_"+checkId);
  expect(r.status==="PASS","CHECK_NOT_PASS_"+checkId);
  expect(sha(r.subject_sha,"CHECK_SUBJECT_SHA_"+checkId)===subject,"CHECK_SUBJECT_MISMATCH_"+checkId);
  digest(r.proof_digest,"CHECK_PROOF_DIGEST_"+checkId);
  const verified=canonicalIso(r.verified_at_database_utc,"CHECK_TIME_"+checkId);
  const expires=canonicalIso(r.expires_at_database_utc,"CHECK_EXPIRY_"+checkId);
  expect(verified<=now,"CHECK_FUTURE_"+checkId);
  expect(expires>now,"CHECK_STALE_"+checkId);
  return {verified,expires};
}
function selectEvidenceBasedFormalStartCandidateV1(input){
  const req=checkedRecord(input,"INPUT_REQUIRED");
  const now=canonicalIso(req.database_now_utc,"DATABASE_NOW_INVALID");
  const subject=sha(req.runtime_subject_sha,"SUBJECT_SHA_REQUIRED");
  expect(req.amendment_status==="SYNTHETIC_PROPOSAL_ONLY","NOT_EFFECTIVE_PRODUCTION_GUARD");
  expect(req.explicit_new_arm_required===true,"NEW_ARM_REQUIRED");
  expect(req.retire_old_arm_before_adoption===true,"OLD_ARM_RETIREMENT_REQUIRED");
  expect(req.epoch_selection_mode==="EVIDENCE_BASED_PROPOSAL_V1","MODE_REQUIRED");
  const gate=checkedRecord(req.pre_arm_receipts,"RECEIPTS_REQUIRED");
  let verifiedAt=now,expiresAt=Number.POSITIVE_INFINITY;
  for(const key of REQUIRED_CHECKS){
    const receipt=validReceipt(gate[key],key,subject,now);
    verifiedAt=Math.max(verifiedAt,receipt.verified);
    expiresAt=Math.min(expiresAt,receipt.expires);
  }
  const prep=checkedRecord(req.pre_a0_preparation_envelope,"PRE_A0_ENVELOPE_REQUIRED");
  expect(prep.status==="QUALIFIED","PRE_A0_ENVELOPE_NOT_QUALIFIED");
  expect(prep.purpose==="COMPLETE_PRE_A0_PREPARATION_NOT_V13_PER_BASE_ACQUISITION","PRE_A0_WRONG_BUDGET_PURPOSE");
  expect(prep.subject_sha===subject,"PRE_A0_BUDGET_SUBJECT_MISMATCH");
  digest(prep.proof_digest,"PRE_A0_BUDGET_PROOF_DIGEST_MISSING");
  const measured=prep.measured_worst_case_ms,margin=prep.safety_margin_ms,budget=prep.selected_budget_ms;
  expect(Number.isSafeInteger(measured)&&measured>0,"PRE_A0_MEASUREMENT_MISSING");
  expect(Number.isSafeInteger(margin)&&margin>0,"PRE_A0_SAFETY_MARGIN_MISSING");
  expect(Number.isSafeInteger(budget)&&budget>=measured+margin,"PRE_A0_BUDGET_INSUFFICIENT");
  const coverage=checkedRecord(prep.workload_coverage,"PRE_A0_WORKLOAD_COVERAGE_REQUIRED");
  for(const key of [
    "exact_main_revalidation","fresh_stage_authority",
    "a0_forcing_seed_capture_and_visibility",
    "manifest_and_a0_promotion_readiness","formal_db_scope_cas",
    "owner_handoff_and_a0_preparation",
  ])expect(coverage[key]===true,"PRE_A0_WORKLOAD_UNPROVEN_"+key);
  const budgetVerified=canonicalIso(prep.verified_at_database_utc,"PRE_A0_BUDGET_VERIFICATION_TIME");
  expect(budgetVerified<=now,"PRE_A0_BUDGET_FROM_FUTURE");
  verifiedAt=Math.max(verifiedAt,budgetVerified);
  const budgetExpires=canonicalIso(prep.expires_at_database_utc,"PRE_A0_BUDGET_EXPIRY");
  expect(budgetExpires>now,"PRE_A0_BUDGET_STALE");
  expiresAt=Math.min(expiresAt,budgetExpires);

  const stage=checkedRecord(req.stage_authority,"STAGE_AUTHORITY_REQUIRED");
  expect(stage.status==="PASS"&&stage.runtime_consumption_authorized===true,"STAGE_NOT_EFFECTIVE");
  expect(stage.lifecycle_domain_state==="ACTIVE"&&stage.lifecycle_authority_status==="RESOLVED"&&stage.lifecycle_authority_validity==="VALID","LIFECYCLE_INVALID");
  expect(stage.crop_water_use_stage==="LATE"&&stage.kc===0.6,"STAGE_MODEL_BINDING_INVALID");
  expect(["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE","R6_OR_LATER_MODEL_ESTIMATE"].includes(stage.biological_stage),"STAGE_NOT_QUALIFIED");
  expect(stage.subject_sha===subject,"STAGE_SUBJECT_MISMATCH");
  digest(stage.proof_digest,"STAGE_PROOF_DIGEST_REQUIRED");
  const stageAsOf=canonicalIso(stage.authority_as_of,"STAGE_AS_OF_INVALID");
  const stageEffective=canonicalIso(stage.effective_at_database_utc,"STAGE_EFFECTIVE_AT_INVALID");
  const stageUntil=canonicalIso(stage.valid_until,"STAGE_VALID_UNTIL_INVALID");
  const lifecycleUntil=canonicalIso(stage.lifecycle_horizon_end_utc,"LIFECYCLE_HORIZON_INVALID");
  expect(stageEffective<=now,"STAGE_NOT_YET_EFFECTIVE");
  expect(stageAsOf<=now,"STAGE_FUTURE_OBSERVATION_FORBIDDEN");
  expect(stageUntil>now,"STAGE_STALE_AT_ADMISSION");
  verifiedAt=Math.max(verifiedAt,stageEffective);

  const a0=nextHour(Math.max(now,verifiedAt)+budget);
  const o00=a0+HOUR_MS,o23=o00+23*HOUR_MS;
  expect(a0>now&&exactHour(a0),"A0_NOT_FUTURE_EXACT_UTC_HOUR");
  expect(o00>now&&exactHour(o00)&&exactHour(o23),"O00_O23_NOT_FUTURE_EXACT_HOURS");
  expect(stageAsOf<=a0&&stageUntil>=o23,"STAGE_AUTHORITY_DOES_NOT_COVER_A0_O23");
  expect(lifecycleUntil>=o23,"LIFECYCLE_DOES_NOT_COVER_O23");
  expect(expiresAt>a0,"PRE_ARM_RECEIPT_EXPIRES_BEFORE_A0");

  return Object.freeze({
    schema_version:"geox_mcft_cap09_am22_evidence_based_formal_start_candidate_v1",
    status:"PROPOSED_NOT_AUTHORIZED",
    production_activation_authorized:false,
    current_formal_v5_arm_modified:false,
    runtime_semantics_changed:false,
    runtime_subject_sha:subject,
    database_time_used:iso(now),
    first_eligible_a0:iso(a0),
    o00:iso(o00),o23:iso(o23),
    pre_a0_budget_ms:budget,
    receipt_expiry_utc:iso(expiresAt),
    stage_valid_until:iso(stageUntil),
    historical_fixed_36h_lead_used:false,
    historical_o00_minus_12h_deadline_used:false,
    exact_a0_before_o00:true,
    stage_window_covers_o23:true,
    required_fresh_a0_prewrite_revalidation:true,
    qualified_v13_base_forcing_budget_remains_independent:true,
    remaining_formal_v5_24t_terminal_slots:24,
    mcft_cap09_completed:false,
  });
}

module.exports=Object.freeze({REQUIRED_CHECKS,selectEvidenceBasedFormalStartCandidateV1});
if(require.main===module){
  process.stderr.write("AM22_DESIGN_ONLY_NOT_A_PRODUCTION_ENTRYPOINT\n");
  process.exitCode=2;
}
