#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
function buildRecoveryPlanV1(contracts){const r=contracts.s6.recovery_contract;const vectors=[
 {vector_id:'FRESH_PROCESS_RESTART',required:r.fresh_process_restart_required,expected:{completed_rerun_write_count:0,canonical_readback_exact:true}},
 {vector_id:'T11_PRECOMMIT_ROLLBACK',required:r.pre_commit_rollback_required,phase_id:'T11',expected:{failed_attempt_canonical_write_delta:0,failed_attempt_projection_write_delta:0,failed_attempt_pointer_write_delta:0,retry_success_count:1}},
 {vector_id:'T12_POSTCOMMIT_RESPONSE_LOSS',required:r.post_commit_response_loss_recovery_required,phase_id:'T12',expected:{original_commit_completed:true,response_lost:true,retry_duplicate_write_count:0,canonical_readback_exact:true}},
 {vector_id:'CONCURRENCY_FENCING',required:r.concurrency_fencing_required,expected:{winning_commit_count:1,loser_canonical_write_count:0,lease_fencing_enforced:true}},
 {vector_id:'EXTREME_POINTER_LOSS_REBUILD',required:r.extreme_pointer_loss_rebuild_required,expected:{canonical_write_delta:0,pointer_rebuild_exact:true}},
 {vector_id:'PROJECTION_LOSS_REBUILD',required:r.projection_loss_rebuild_required,expected:{canonical_write_delta:0,projection_rebuild_exact:true}},
 {vector_id:'RESPONSE_AND_POINTER_LOSS',required:r.response_and_pointer_loss_combination_required,expected:{retry_duplicate_write_count:0,pointer_rebuild_exact:true,canonical_readback_exact:true}},
 ].map(v=>({...v,execution_authorized:false,source_must_be_same_run:true}));assert.ok(vectors.every(v=>v.required));return{schema_version:'geox_mcft_cap08_s6_recovery_vector_plan_v1',vectors,silent_repair_forbidden:r.silent_repair_forbidden,database_execution_authorized:false};}
module.exports={buildRecoveryPlanV1};
