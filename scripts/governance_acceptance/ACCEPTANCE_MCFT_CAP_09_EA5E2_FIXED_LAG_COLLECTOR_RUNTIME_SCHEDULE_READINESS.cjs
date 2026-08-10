#!/usr/bin/env node
"use strict";

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const eq=(a,b,c)=>{if(a!==b)throw new Error(`${c}: expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`)};
const yes=(v,c)=>eq(v,true,c), no=(v,c)=>eq(v,false,c);
const blob=(ref,p)=>git('rev-parse',`${ref}:${p}`);
const read=(p)=>fs.readFileSync(p,'utf8');
const json=(p)=>JSON.parse(read(p));
const has=(s,m,c)=>{if(!s.includes(m))throw new Error(`${c}:${m}`)};
const lacks=(s,m,c)=>{if(s.includes(m))throw new Error(`${c}:${m}`)};

const base=process.env.MCFT_BASE_SHA;
eq(base,'4fc792398bcc25243af7c63734fe59beec9b0dcc','EA5E2_EXACT_BASE_REQUIRED');

const workflowPath='.github/workflows/mcft-cap-09-ea5e2-fixed-lag-collector-runtime-schedule-readiness.yml';
const collectorPhaseWorkflowPath='.github/workflows/mcft-cap-09-ea5e2-collector-phase-orchestration.yml';
const liveProviderWorkflowPath='.github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml';
const canonicalizerPath='apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts';
const collectorPhaseOrchestratorPath='apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.ts';
const continuationPath='apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts';
const assimilationPath='apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts';
const externalCandidatePath='apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts';
const fixedLagSchedulerPath='apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts';
const externalDbSourcePath='apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts';
const schedulePath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json';
const authorityPath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json';
const gatePath='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS.cjs';
const collectorPhaseAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_COLLECTOR_PHASE_ORCHESTRATION.ts';
const dbToCap04AcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_DATABASE_SOURCE_TO_EXTERNAL_CAP04.ts';
const cutoffAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXACT_INTERVAL_LATE_CUTOFF_SEAM.ts';
const externalDbAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE.ts';
const schedulerAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_SCHEDULER_SEAM.ts';
const liveProviderHelperPath='scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py';
const liveProviderRunnerPath='scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_LOCAL_DB.ts';

const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const expected=[
 workflowPath,collectorPhaseWorkflowPath,liveProviderWorkflowPath,canonicalizerPath,collectorPhaseOrchestratorPath,
 continuationPath,assimilationPath,externalCandidatePath,fixedLagSchedulerPath,externalDbSourcePath,
 schedulePath,authorityPath,gatePath,collectorPhaseAcceptancePath,dbToCap04AcceptancePath,cutoffAcceptancePath,
 externalDbAcceptancePath,schedulerAcceptancePath,liveProviderHelperPath,liveProviderRunnerPath,
].sort();
eq(JSON.stringify(changed),JSON.stringify(expected),'EA5E2_EXACT_TWENTY_FILE_BOUNDARY_REQUIRED');

const immutablePredecessors={
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md':'39f6a09273c30088a7ea264cfa94ff930ea5518e',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md':'7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md':'e59e11e909bfd0a38c7298c5a6f909a6cd7afa49',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md':'c5a98ca789027e1bf051ec56bf1b7e76b98a0891',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json':'b47af64277330bb46a3fc1bb171dfcaaaf91abb1',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json':'788d1f969aa335ee18db9186c5ec0578ee1a960a',
 'apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts':'dfa2c10266a5079842012426aed175851d30ca44',
 'apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts':'1cc2726aace39524e84fda9762f86a3fc2e96408',
 'apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts':'6f7b6450d4f671c75affc2c7aba45ed71cb518c5',
 'apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts':'b4b7448518628bcffe8eaf6a91d9967145f7647d',
 'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts':'6133206095ca3a98ab5e8ae514ee4610404d2edd',
 'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts':'45cca8e03cf0641f2fbf45f3b3aca044f322989c',
 'apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts':'39a097a2343bd95dcc6b7621a4acc0e31772c563',
 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py':'ff2ad210387402a74731968e14746210fd2440dd',
};
for(const [p,s] of Object.entries(immutablePredecessors)){
 eq(blob(base,p),s,`EA5E2_BASE_PIN:${p}`);
 eq(blob('HEAD',p),s,`EA5E2_PREDECESSOR_MUTATED:${p}`);
}
eq(blob(base,canonicalizerPath),'5b4e5133e51dfaf447c2de52caf1a9f50c8254d3','EA5E2_CANONICALIZER_BASE_PIN_REQUIRED');

const candidateBlobs={
 [workflowPath]:'6cf2a25f3bf95125f0c23cc87b6bd6ee9ee487b0',
 [collectorPhaseWorkflowPath]:'a1837654fda0f39ae2c5371807d6f04f2a26ac09',
 [liveProviderWorkflowPath]:'691ef33223e868935eb938b4575dd896f4a447ab',
 [canonicalizerPath]:'3fad324baecd395b6511f5102e905127f50eda4a',
 [collectorPhaseOrchestratorPath]:'1be54411a4f283ece7a984e8a7edf974f6ad70ce',
 [continuationPath]:'a83437765f1c75860c5270b89446474787cde4c3',
 [assimilationPath]:'6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36',
 [externalCandidatePath]:'71df4e47b0c62b7c6f2126e33896849af56273ca',
 [fixedLagSchedulerPath]:'7525c4748c8d758ba04a198b8a6c00f1a9ffceb4',
 [externalDbSourcePath]:'e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259',
 [schedulePath]:'964fde5ad80dcf62a901184b0db3789858dfed85',
 [authorityPath]:'5af48ec6a72dfc1e3b09849a3935c724b36199df',
 [collectorPhaseAcceptancePath]:'e1859170cc89a2d8fa98562b9a06833784141032',
 [dbToCap04AcceptancePath]:'5d468312bc2905a54bcb1f477a5df7ca6c335631',
 [cutoffAcceptancePath]:'741fffeec8d976648e78a9f1cb2c888a1b423f01',
 [externalDbAcceptancePath]:'e796ae2ad265b67f38960ee80d5664cb9ba768e0',
 [schedulerAcceptancePath]:'6be7604dc29940880d02f4bfc9722a13cc2af494',
 [liveProviderHelperPath]:'150c3ae271d5572ea31133ce27b0fcccbf27c512',
 [liveProviderRunnerPath]:'0e8125b4796e11469265d3353a267847117ecb3e',
};
for(const [p,s] of Object.entries(candidateBlobs)) eq(blob('HEAD',p),s,`EA5E2_CANDIDATE_BLOB:${p}`);

const schedule=json(schedulePath);
eq(schedule.schema_version,'geox_mcft_cap09_ea5e2_fixed_lag_schedule_v1','EA5E2_SCHEDULE_SCHEMA_REQUIRED');
eq(schedule.epoch_id,'mcft_cap09_external_formal_window_epoch_20260811t170000z_v1','EA5E2_EPOCH_REQUIRED');
eq(schedule.slots.length,24,'EA5E2_EXACT_24_SLOTS_REQUIRED');
eq(schedule.window_input_manifest_blob_sha,'b47af64277330bb46a3fc1bb171dfcaaaf91abb1','EA5E2_MANIFEST_BINDING_REQUIRED');
const profile=schedule.schedule_profile;
eq(profile.scheduler_eligibility_lag_hours,7,'EA5E2_LAG_REQUIRED');
eq(profile.pre_boundary_collector_offset_minutes,-30,'EA5E2_PREBOUNDARY_OFFSET_REQUIRED');
eq(profile.late_exact_hour_collector_offset_minutes,390,'EA5E2_LATE_COLLECTOR_OFFSET_REQUIRED');
eq(profile.late_exact_hour_evidence_cutoff_offset_minutes,432,'EA5E2_LATE_CUTOFF_REQUIRED');
eq(profile.runtime_observer_offset_minutes,437,'EA5E2_OBSERVER_OFFSET_REQUIRED');
eq(profile.minimum_ingestion_margin_minutes,5,'EA5E2_MARGIN_REQUIRED');
const o00=Date.parse('2026-08-11T17:00:00.000Z');
for(let i=0;i<24;i++){
 const slot=schedule.slots[i],t=o00+i*3600000;
 eq(slot.slot_id,`O${String(i).padStart(2,'0')}`,`EA5E2_SLOT_ID:${i}`);
 eq(Date.parse(slot.logical_time),t,`EA5E2_SLOT_TIME:${i}`);
 eq(Date.parse(slot.pre_boundary_causal_collector_target),t-30*60000,`EA5E2_PRE_TIME:${i}`);
 eq(Date.parse(slot.late_exact_hour_collector_scheduled),t+390*60000,`EA5E2_LATE_TIME:${i}`);
 eq(Date.parse(slot.scheduler_eligibility_time),t+420*60000,`EA5E2_ELIGIBILITY:${i}`);
 eq(Date.parse(slot.late_exact_hour_evidence_cutoff),t+432*60000,`EA5E2_CUTOFF:${i}`);
 eq(Date.parse(slot.runtime_observer_nominal_time),t+437*60000,`EA5E2_OBSERVER:${i}`);
}
no(schedule.phase_rules.future_forcing_post_logical_time_availability_allowed,'EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN');
no(schedule.phase_rules.time_relabeling_allowed,'EA5E2_TIME_RELABELING_FORBIDDEN');
no(schedule.phase_rules.source_substitution_allowed,'EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN');

const authority=json(authorityPath);
eq(authority.record_status,'EA5E2_FIXED_LAG_SCHEDULE_READINESS_CANDIDATE_NOT_EFFECTIVE','EA5E2_CANDIDATE_STATUS_REQUIRED');
eq(authority.base_main_sha,base,'EA5E2_AUTHORITY_BASE_REQUIRED');
eq(authority.schedule_authority.schedule_blob_sha,'964fde5ad80dcf62a901184b0db3789858dfed85','EA5E2_AUTHORITY_SCHEDULE_BLOB_REQUIRED');
const ib=authority.implementation_path_exact_blobs;
for(const [key,value] of Object.entries({
 external_collector_canonicalizer:'3fad324baecd395b6511f5102e905127f50eda4a',
 durable_raw_retention_adapter:'dfa2c10266a5079842012426aed175851d30ca44',
 restricted_formal_evidence_ingress:'6f7b6450d4f671c75affc2c7aba45ed71cb518c5',
 fixed_lag_collector_phase_orchestrator:'1be54411a4f283ece7a984e8a7edf974f6ad70ce',
 provider_specific_raw_first_helper:'150c3ae271d5572ea31133ce27b0fcccbf27c512',
 isolated_live_provider_phase_runner:'0e8125b4796e11469265d3353a267847117ecb3e',
 collector_phase_static_workflow:'a1837654fda0f39ae2c5371807d6f04f2a26ac09',
 real_provider_two_phase_readiness_workflow:'691ef33223e868935eb938b4575dd896f4a447ab',
 external_formal_database_evidence_source:'e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259',
 historical_s2_database_evidence_reader_unchanged:'45cca8e03cf0641f2fbf45f3b3aca044f322989c',
 historical_s5_selected_evidence_readback_unchanged:'39a097a2343bd95dcc6b7621a4acc0e31772c563',
 external_cap04_input_authority:'b4b7448518628bcffe8eaf6a91d9967145f7647d',
 continuation_evidence_window_late_cutoff_seam:'a83437765f1c75860c5270b89446474787cde4c3',
 assimilated_continuation_cutoff_threading:'6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36',
 external_cap04_candidate_execution_service:'71df4e47b0c62b7c6f2126e33896849af56273ca',
 persistent_sequential_scheduler_adapter:'6133206095ca3a98ab5e8ae514ee4610404d2edd',
 fixed_lag_scheduler_adapter:'7525c4748c8d758ba04a198b8a6c00f1a9ffceb4',
 live_provider_probe:'ff2ad210387402a74731968e14746210fd2440dd',
})) eq(ib[key],value,`EA5E2_IMPLEMENTATION_BLOB:${key}`);

const rc=authority.readiness_proof_contract;
for(const key of [
 'real_provider_gets_required','provider_specific_same_t_two_phase_live_path_required','live_kbs_reproof_required',
 'live_gfs_72h_same_cycle_reproof_required','raw_retention_before_decode_contract_required',
 'actual_s3_compatible_retention_adapter_required','restricted_append_only_formal_ingress_contract_required',
 'actual_postgres_restricted_ingress_adapter_required','runtime_provider_fetch_forbidden','runtime_database_evidence_only_required',
 'external_formal_database_source_read_only_required','database_source_to_external_cap04_candidate_path_required',
 'exact_five_binding_families_required','exact_ea5e1_config_manifest_binding_required','two_phase_same_slot_composition_required',
 'whole_phase_validation_before_ingress_required','collector_phase_family_partition_required',
 'pre_boundary_soil_must_be_inside_t_minus_15m_to_t','future_weather_and_et0_same_gfs_cycle_required',
 'exact_late_kbs_target_row_required','minimum_ingestion_margin_fail_closed','isolated_readiness_database_localhost_only',
 'isolated_readiness_private_s3_localhost_only','formal_resource_credentials_forbidden_in_provider_readiness',
 'scheduler_fixed_lag_implementation_required','scheduler_default_zero_lag_preserved','exact_interval_late_cutoff_implementation_required',
 'delayed_database_evidence_must_reach_completed_a1_candidate','non_exact_interval_evidence_cutoff_remains_logical_time',
]) yes(rc[key],`EA5E2_READINESS_REQUIRED:${key}`);
no(rc.historical_s2_s5_database_readers_mutated,'EA5E2_HISTORICAL_DB_READER_MUTATION_FORBIDDEN');
no(rc.canonical_persistence_authorized_in_ea5e2,'EA5E2_CANONICAL_PERSISTENCE_FORBIDDEN');
no(rc.future_forcing_post_logical_time_availability_allowed,'EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN_AUTHORITY');
no(rc.time_relabeling_allowed,'EA5E2_TIME_RELABELING_FORBIDDEN_AUTHORITY');
no(rc.source_substitution_allowed,'EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN_AUTHORITY');
eq(rc.minimum_ingestion_margin_minutes,5,'EA5E2_AUTHORITY_MARGIN_REQUIRED');
eq(rc.external_formal_scheduler_lag_hours,7,'EA5E2_AUTHORITY_LAG_REQUIRED');
eq(rc.exact_interval_late_cutoff_offset_minutes,432,'EA5E2_AUTHORITY_CUTOFF_REQUIRED');
eq(rc.runtime_observer_offset_minutes,437,'EA5E2_AUTHORITY_OBSERVER_REQUIRED');
eq(rc.completed_a1_candidate_forecast_point_count,72,'EA5E2_A1_72H_REQUIRED');
for(const key of ['formal_database_write_count','formal_raw_object_write_count','scheduler_write_count','runtime_tick_count']) eq(rc[key],0,`EA5E2_ZERO_SIDE_EFFECT:${key}`);

const canonicalizer=read(canonicalizerPath);
has(canonicalizer,'collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1','EA5E2_REAL_COMPLETION_CLOCK_API_REQUIRED');
has(canonicalizer,'EA3_CANONICALIZED_BEFORE_RAW_RETENTION','EA5E2_RETENTION_BEFORE_COMPLETION_REQUIRED');
const orchestrator=read(collectorPhaseOrchestratorPath);
has(orchestrator,'ingestCanonicalizedPhase','EA5E2_COMPLETED_PROVIDER_PHASE_ENTRY_REQUIRED');
has(orchestrator,'EA5E2_COLLECTOR_CANONICALIZED_BEFORE_RAW_RETENTION','EA5E2_PHASE_RETENTION_BARRIER_REQUIRED');
has(orchestrator,'Whole-phase validation is complete before the first canonical ingress call.','EA5E2_WHOLE_PHASE_BEFORE_INGRESS_REQUIRED');
const helper=read(liveProviderHelperPath);
for(const marker of ['precheck-kbs','fetch-gfs','decode-gfs','decode-kbs-late','ea4.decode_pgrb2','ea4.decode_sflux','ea4.scalar_eto','ea4.AUTH["kbs"]["elevation_m"]']) has(helper,marker,'EA5E2_PROVIDER_HELPER_REQUIRED');
const runner=read(liveProviderRunnerPath);
for(const marker of ['EA5E2_READINESS_DATABASE_MUST_BE_LOCALHOST','EA5E2_READINESS_S3_MUST_BE_LOCAL_HTTP','S3CompatiblePrivateRawEvidenceRetentionAdapterV1','PostgresExternalFormalEvidenceIngressV1','PostgresExternalFormalEvidenceSourceV1','SOIL_WINDOW_MINUTES = 15','MIN_INGRESS_MARGIN_MINUTES = 5','EA5E2_PREBOUNDARY_MINIMUM_INGRESS_MARGIN_LOST','EA5E2_LATE_MINIMUM_INGRESS_MARGIN_LOST']) has(runner,marker,'EA5E2_ISOLATED_LIVE_RUNNER_REQUIRED');

const longWorkflow=read(liveProviderWorkflowPath);
for(const marker of ['postgres:18','minio/minio:latest','minio/mc:latest','READINESS_DB_URL: postgres://postgres:postgres@127.0.0.1:55433/ea5e2_readiness','READINESS_S3_ENDPOINT: http://127.0.0.1:9100','EA5E3_HARD_DEADLINE_UTC','minimum_post_proof_ea5e3_margin_minutes:60','Wait only until T plus 2h45m','Wait only until T plus 5h30m','retention-days: 1','retention-days: 90','private_retention_before_decode:true','formal_writes:0']) has(longWorkflow,marker,'EA5E2_LIVE_WORKFLOW_REQUIRED');
for(const forbidden of ['GEOX_MCFT_CAP09_S6_DATABASE_URL','GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','CLOUDFLARE_R2','secrets.']) lacks(longWorkflow,forbidden,'EA5E2_LIVE_WORKFLOW_FORMAL_SECRET_FORBIDDEN');

const mainWorkflow=read(workflowPath);
has(mainWorkflow,'Exact-head live KBS and GFS readiness reproof','EA5E2_EXACT_HEAD_SOURCE_REPROOF_REQUIRED');
has(mainWorkflow,'EA5E2_READINESS_DEADLINE_ALREADY_PASSED','EA5E2_DEADLINE_FAIL_CLOSED_REQUIRED');
const focusedWorkflow=read(collectorPhaseWorkflowPath);
for(const marker of ['Syntax-check raw-first live provider helpers','Typecheck isolated live provider phase runner','Prove same-slot two-phase collector composition','Prove External Formal DB-only delayed Evidence source','Prove DB-only Evidence feeds External CAP04 candidate']) has(focusedWorkflow,marker,'EA5E2_FOCUSED_STATIC_PROOF_REQUIRED');

const effect=authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.real_provider_two_phase_collector_readiness_effective,'EA5E2_REAL_PROVIDER_EFFECT_REQUIRED');
yes(effect.ea5e3_formal_authority_v3_authorized,'EA5E2_EA5E3_AUTHORIZATION_REQUIRED');
no(effect.ea5e3_effective,'EA5E2_PREMATURE_EA5E3_EFFECT_FORBIDDEN');
no(effect.formal_o00_start_authorized,'EA5E2_PREMATURE_O00_AUTH_FORBIDDEN');
no(effect.formal_window_started,'EA5E2_PREMATURE_WINDOW_START_FORBIDDEN');
no(effect.mcft_cap09_completed,'EA5E2_PREMATURE_COMPLETION_FORBIDDEN');

const result={
 schema_version:'geox_mcft_cap09_ea5e2_fixed_lag_collector_runtime_schedule_readiness_governance_v2',
 status:'PASS',
 base_sha:base,
 exact_file_count:changed.length,
 exact_twenty_file_boundary:true,
 exact_24_slot_schedule:true,
 provider_specific_same_t_two_phase_live_path_required:true,
 actual_s3_retention_adapter_bound:true,
 actual_postgres_restricted_ingress_bound:true,
 isolated_local_readiness_resources_only:true,
 minimum_ingestion_margin_minutes:5,
 pre_boundary_soil_window_minutes:15,
 scheduler_lag_hours:7,
 exact_interval_late_cutoff_minutes:432,
 runtime_observer_offset_minutes:437,
 formal_database_write_count:0,
 formal_raw_object_write_count:0,
 scheduler_write_count:0,
 runtime_tick_count:0,
 ea5e2_candidate_not_effective:true,
 ea5e3_effective:false,
 formal_o00_start_authorized:false,
 formal_window_started:false,
 mcft_cap09_completed:false,
};
const out='acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json';
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
