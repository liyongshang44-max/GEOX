#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const path=require("node:path");
const {REQUIRED_CHECKS,selectEvidenceBasedFormalStartCandidateV1:select}=
  require("./DESIGN_MCFT_CAP_09_EVIDENCE_BASED_FORMAL_START_SELECTOR_V1.cjs");

const ROOT=path.resolve(__dirname,"../..");
const BASE="a60aa6858662ce87b989ff752c50969f21ad4619";
const SHA="a".repeat(40),D="sha256:"+"b".repeat(64);
const NOW="2026-10-10T04:18:00.000Z";
const EXP="2026-10-10T07:00:00.000Z";
const EXPECTED_FILES=[
  ".github/workflows/mcft-cap-09-am22-evidence-based-formal-start-design.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-22-EVIDENCE-BASED-FORMAL-START-ADMISSION-CANDIDATE.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_EVIDENCE_BASED_START_PROPOSAL_V1.cjs",
  "scripts/governance_acceptance/DESIGN_MCFT_CAP_09_EVIDENCE_BASED_FORMAL_START_SELECTOR_V1.cjs",
].sort();

const FROZEN={
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-21-FORMAL-V5-EPOCH-STAGE-AUTHORITY-HANDOFF.md":"b79e52620865a36d83cdbb0d95e6cccf1fed1ad3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json":"184ac8cef0a2414b1cf73c30eb2cb1f697af7186",
  "scripts/runtime_acceptance/MCFT_CAP_09_FORMAL_V5_EPOCH_CLOCK_SELECTOR_V1.cjs":"c89c3b8f96dd2924444071986d75cd77690ac997",
  "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs":"d36bef952fc7d8361de36f8881f5f831b7e4814d",
  "apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.ts":"c6a0ac78c0bb7b9c2924cd6898a31f3e97451081",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs":"d2bb3c47bcb2665c2ff267cc77c9f65d10daabfd",
};
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function fixture(){
  const receipts=Object.fromEntries(REQUIRED_CHECKS.map(id=>[id,{
    check_id:id,status:"PASS",subject_sha:SHA,proof_digest:D,
    verified_at_database_utc:"2026-10-10T04:17:00.000Z",expires_at_database_utc:EXP,
  }]));
  return {
    database_now_utc:NOW,
    runtime_subject_sha:SHA,
    amendment_status:"SYNTHETIC_PROPOSAL_ONLY",
    epoch_selection_mode:"EVIDENCE_BASED_PROPOSAL_V1",
    explicit_new_arm_required:true,
    retire_old_arm_before_adoption:true,
    pre_arm_receipts:receipts,
    pre_a0_preparation_envelope:{
      status:"QUALIFIED",purpose:"COMPLETE_PRE_A0_PREPARATION_NOT_V13_PER_BASE_ACQUISITION",
      subject_sha:SHA,proof_digest:D,
      verified_at_database_utc:"2026-10-10T04:17:00.000Z",
      expires_at_database_utc:EXP,
      measured_worst_case_ms:600_000,safety_margin_ms:120_000,selected_budget_ms:720_000,
      workload_coverage:{
        exact_main_revalidation:true,
        fresh_stage_authority:true,
        a0_forcing_seed_capture_and_visibility:true,
        manifest_and_a0_promotion_readiness:true,
        formal_db_scope_cas:true,
        owner_handoff_and_a0_preparation:true,
      },
    },
    stage_authority:{
      status:"PASS",runtime_consumption_authorized:true,
      lifecycle_domain_state:"ACTIVE",lifecycle_authority_status:"RESOLVED",
      lifecycle_authority_validity:"VALID",crop_water_use_stage:"LATE",
      kc:0.6,biological_stage:"R6_OR_LATER_MODEL_ESTIMATE",subject_sha:SHA,
      proof_digest:D,authority_as_of:"2026-10-10T04:00:00.000Z",
      effective_at_database_utc:"2026-10-10T04:10:00.000Z",
      valid_until:"2026-10-11T10:00:00.000Z",
      lifecycle_horizon_end_utc:"2026-11-24T03:59:59.999Z",
    },
  };
}
function failCase(name,mutate,code){
  const input=fixture();mutate(input);
  assert.throws(()=>select(input),new RegExp("AM22_"+code),name);
}
const good=select(fixture());
assert.equal(good.status,"PROPOSED_NOT_AUTHORIZED");
assert.equal(good.production_activation_authorized,false);
assert.equal(good.current_formal_v5_arm_modified,false);
assert.equal(good.first_eligible_a0,"2026-10-10T05:00:00.000Z");
assert.equal(good.o00,"2026-10-10T06:00:00.000Z");
assert.equal(good.o23,"2026-10-11T05:00:00.000Z");
assert.equal(good.pre_a0_budget_ms,720000);
assert.equal(good.historical_fixed_36h_lead_used,false);
assert.equal(good.historical_o00_minus_12h_deadline_used,false);
assert.equal(good.remaining_formal_v5_24t_terminal_slots,24);

failCase("production code cannot invoke draft selector",x=>x.amendment_status="EFFECTIVE","NOT_EFFECTIVE_PRODUCTION_GUARD");
failCase("old-arm migration forbidden",x=>x.retire_old_arm_before_adoption=false,"OLD_ARM_RETIREMENT_REQUIRED");
failCase("new arm required",x=>x.explicit_new_arm_required=false,"NEW_ARM_REQUIRED");
failCase("missing H5",x=>delete x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5,"RECEIPT_MISSING_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("H5 red",x=>x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5.status="FAIL","CHECK_NOT_PASS_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("forged H5 digest",x=>x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5.proof_digest="foo","CHECK_PROOF_DIGEST_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("H5 wrong subject",x=>x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5.subject_sha="c".repeat(40),"CHECK_SUBJECT_MISMATCH_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("stale H5",x=>x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5.expires_at_database_utc="2026-10-10T04:10:00.000Z","CHECK_STALE_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("future receipt",x=>x.pre_arm_receipts.EXACT_IMAGE_DUAL_OWNER_H5.verified_at_database_utc="2026-10-10T05:00:00.000Z","CHECK_FUTURE_EXACT_IMAGE_DUAL_OWNER_H5");
failCase("wrong preparation budget purpose",x=>x.pre_a0_preparation_envelope.purpose="V13_PER_BASE_FORCING_BUDGET","PRE_A0_WRONG_BUDGET_PURPOSE");
failCase("unknown preparation budget",x=>x.pre_a0_preparation_envelope.status="UNQUALIFIED","PRE_A0_ENVELOPE_NOT_QUALIFIED");
failCase("budget margin required",x=>x.pre_a0_preparation_envelope.safety_margin_ms=0,"PRE_A0_SAFETY_MARGIN_MISSING");
failCase("insufficient measured budget",x=>x.pre_a0_preparation_envelope.selected_budget_ms=650000,"PRE_A0_BUDGET_INSUFFICIENT");
failCase("forcing seed not covered",x=>x.pre_a0_preparation_envelope.workload_coverage.a0_forcing_seed_capture_and_visibility=false,"PRE_A0_WORKLOAD_UNPROVEN_a0_forcing_seed_capture_and_visibility");
failCase("stage not yet effective",x=>x.stage_authority.effective_at_database_utc="2026-10-10T04:40:00.000Z","STAGE_NOT_YET_EFFECTIVE");
failCase("future stage observation",x=>x.stage_authority.authority_as_of="2026-10-10T05:00:00.000Z","STAGE_FUTURE_OBSERVATION_FORBIDDEN");
failCase("stage cannot cover O23",x=>x.stage_authority.valid_until="2026-10-11T04:00:00.000Z","STAGE_AUTHORITY_DOES_NOT_COVER_A0_O23");
failCase("lifecycle expires",x=>x.stage_authority.lifecycle_horizon_end_utc="2026-10-11T04:00:00.000Z","LIFECYCLE_DOES_NOT_COVER_O23");
failCase("PRE_R5 not permitted",x=>x.stage_authority.biological_stage="PRE_R5_MODEL_ESTIMATE","STAGE_NOT_QUALIFIED");
failCase("not active lifecycle",x=>x.stage_authority.lifecycle_domain_state="TERMINATED","LIFECYCLE_INVALID");
failCase("receipt stale before A0",x=>x.pre_arm_receipts.EXACT_MAIN_RUNTIME_SUBJECT.expires_at_database_utc="2026-10-10T04:59:00.000Z","PRE_ARM_RECEIPT_EXPIRES_BEFORE_A0");
failCase("absurd prep cannot fit stage window",x=>{x.pre_a0_preparation_envelope.measured_worst_case_ms=24*3_600_000;x.pre_a0_preparation_envelope.selected_budget_ms=24*3_600_000+120_000},"STAGE_AUTHORITY_DOES_NOT_COVER_A0_O23");

// Guard the live 36h arm and execution surfaces at the current predecessor.
assert.equal(git("merge-base",BASE,"HEAD"),BASE,"AM22_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(changed,EXPECTED_FILES,"AM22_PATH_BOUNDARY");
for(const [file,blob] of Object.entries(FROZEN))assert.equal(
  git("rev-parse","HEAD:"+file),blob,"AM22_LIVE_CONTRACT_BLOB_CHANGED:"+file
);
const proof={
  schema_version:"geox_mcft_cap09_am22_evidence_based_start_proposal_acceptance_v1",
  status:"PASS",
  predecessor:BASE,
  changed_path_count:changed.length,
  positive_synthetic_candidate:good,
  selected_future_a0_without_36h:true,
  tested_negative_case_count:22,
  all_frozen_arm_handoff_epoch_owner_governance_blobs_preserved:true,
  production_authorization:false,
  runtime_semantic_change:false,
  database_schema_change:false,
  production_deploy:false,
  real_a0:false,
  current_arm_validity_unchanged:true,
  mcft_cap09_completed:false,
};
process.stdout.write(JSON.stringify(proof,null,2)+"\n");
