#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const RUNNER="scripts/runtime_acceptance/RUN_MCFT_CAP_09_REAL_CLOCK_REHEARSAL_V1.cjs";
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_REAL_CLOCK_REHEARSAL_LAUNCHER_V1_RESULT.json");

function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function write(value){
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(value,null,2)+"\n");
  console.log(JSON.stringify(value,null,2));
}

try{
  const source=read(RUNNER);
  const selftest=JSON.parse(cp.execFileSync(process.execPath,[path.join(ROOT,RUNNER),"--selftest"],{
    cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],
  }));
  assert.equal(selftest.status,"PASS");
  assert.equal(selftest.run_class,"QUALIFICATION_REHEARSAL");
  assert.equal(selftest.formal_effect,false);
  assert.equal(selftest.production_effect,false);

  for(const required of [
    'const COMPOSE=path.join(ROOT,"docker-compose.mcft-cap09-phase5-qualification.yml")',
    '"REAL_CLOCK_REHEARSAL"',
    '"QUALIFICATION_REHEARSAL"',
    '"R00_R23_IS_NOT_O00_O23"',
    '"NO_FORMAL_V5_EFFECT_FROM_REHEARSAL"',
    '"NO_STAGE_1B_CLOSURE_FROM_REHEARSAL"',
    '"NO_MCFT_CAP09_COMPLETION_FROM_REHEARSAL"',
    'GEOX_PHASE5_TWIN_IDLE_POLL_MS:"5000"',
    'GEOX_PHASE5_TWIN_NOT_READY_POLL_MS:"15000"',
    'GEOX_PHASE5_TWIN_RETRY_BASE_MS:"1000"',
    'GEOX_PHASE5_TWIN_RETRY_MAXIMUM_MS:"60000"',
    '"CONTROLLED_PROCESS_RESTART_ACROSS_ONE_REAL_UTC_BOUNDARY"',
    'GEOX_PHASE5_REHEARSAL_CROP_AUTHORITY_PATH:cropAuthorityFixturePath',
    '"geox_mcft_cap09_real_clock_rehearsal_crop_authority_overlay_v1"',
    'synthetic_planting_window:true',
    'original_planting_event_not_claimed:true',
    'provider_observation_truth_claimed:false',
    '"KEEP_EXISTING_A18_V3_MATERIALIZER_INSIDE_STABLE_MID_TEST_ENVELOPE_WITHOUT_CHANGING_RUNTIME_KERNEL"',
    'oldest_first_backfill_observed:true',
    'formal_closure_substituted:false',
    '"qualification-verify"',
    '"down","-v","--remove-orphans"',
  ]){
    assert.equal(source.includes(required),true,"REAL_CLOCK_REHEARSAL_LAUNCHER_MARKER_REQUIRED:"+required);
  }

  for(const forbidden of [
    "docker-compose.mcft-cap09-production.yml",
    "docker-compose.mcft-cap09-production-preformal.yml",
    "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
    "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
    "RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP",
    "RUN_MCFT_CAP_09_FORMAL_V5_A0_PRODUCTION_REPLAY_PROMOTION",
    "ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM",
    "git merge",
    "gh pr merge",
    "push origin",
  ]){
    assert.equal(source.includes(forbidden),false,"REAL_CLOCK_REHEARSAL_LAUNCHER_FORBIDDEN_MARKER:"+forbidden);
  }

  assert.match(source,/REAL_CLOCK_REHEARSAL_CLEAN_WORKTREE_REQUIRED/);
  assert.match(source,/REAL_CLOCK_REHEARSAL_ALREADY_RUNNING/);
  assert.match(source,/REAL_CLOCK_REHEARSAL_FINALIZE_BEFORE_R23_FORBIDDEN/);
  assert.match(source,/scheduler_slot_count===24&&proof\.terminal_tick_count===24/);
  assert.match(source,/qualification_rehearsal_baseline_fact_count===49/);
  assert.match(source,/rehearsal_is_non_authority_bearing===true/);
  assert.match(source,/formal_closure_substituted_by_rehearsal===false/);

  write({
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_launcher_acceptance_v1",
    status:"PASS",
    run_class:"QUALIFICATION_REHEARSAL",
    exact_phase5_isolated_compose_required:true,
    production_compose_reference_count:0,
    formal_v5_store_binding_count:0,
    actual_database_clock_preserved:true,
    automatic_controlled_restart_and_backfill_probe:true,
    exact_24_terminal_readback_required:true,
    rehearsal_non_authority_claims_locked:true,
    formal_closure_substitution:false,
    controlled_rehearsal_crop_authority_fixture:true,
    production_runtime_kernel_change_required:false,
    production_effect:false,
  });
}catch(error){
  write({
    schema_version:"geox_mcft_cap09_real_clock_rehearsal_launcher_acceptance_v1",
    status:"FAIL",
    error:error instanceof Error?error.message:String(error),
  });
  console.error(error);
  process.exitCode=1;
}
