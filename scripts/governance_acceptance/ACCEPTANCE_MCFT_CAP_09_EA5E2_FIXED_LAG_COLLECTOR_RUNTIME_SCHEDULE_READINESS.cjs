#!/usr/bin/env node
"use strict";

const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const eq=(a,b,c)=>{if(a!==b)throw new Error(`${c}: expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`)};
const yes=(v,c)=>eq(v,true,c), no=(v,c)=>eq(v,false,c);
const blob=(ref,p)=>git('rev-parse',`${ref}:${p}`);
const read=(p)=>fs.readFileSync(p,'utf8');
const json=(p)=>JSON.parse(read(p));
const has=(s,m,c)=>{if(!s.includes(m))throw new Error(`${c}:${m}`)};

const base=process.env.MCFT_BASE_SHA;
eq(base,'4fc792398bcc25243af7c63734fe59beec9b0dcc','EA5E2_EXACT_BASE_REQUIRED');
const workflowPath='.github/workflows/mcft-cap-09-ea5e2-fixed-lag-collector-runtime-schedule-readiness.yml';
const collectorPhaseWorkflowPath='.github/workflows/mcft-cap-09-ea5e2-collector-phase-orchestration.yml';
const schedulePath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json';
const authorityPath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json';
const gatePath='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS.cjs';
const continuationPath='apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts';
const assimilationPath='apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts';
const externalCandidatePath='apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts';
const fixedLagSchedulerPath='apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts';
const collectorPhaseOrchestratorPath='apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.ts';
const collectorPhaseAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_COLLECTOR_PHASE_ORCHESTRATION.ts';
const externalDbSourcePath='apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts';
const externalDbAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE.ts';
const cutoffAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_EXACT_INTERVAL_LATE_CUTOFF_SEAM.ts';
const schedulerAcceptancePath='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_SCHEDULER_SEAM.ts';
const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const expected=[workflowPath,collectorPhaseWorkflowPath,schedulePath,authorityPath,gatePath,continuationPath,assimilationPath,externalCandidatePath,fixedLagSchedulerPath,collectorPhaseOrchestratorPath,collectorPhaseAcceptancePath,externalDbSourcePath,externalDbAcceptancePath,cutoffAcceptancePath,schedulerAcceptancePath].sort();
eq(JSON.stringify(changed),JSON.stringify(expected),'EA5E2_EXACT_FIFTEEN_FILE_BOUNDARY_REQUIRED');

const predecessors={
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md':'39f6a09273c30088a7ea264cfa94ff930ea5518e',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md':'7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md':'e59e11e909bfd0a38c7298c5a6f909a6cd7afa49',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md':'c5a98ca789027e1bf051ec56bf1b7e76b98a0891',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-WINDOW-INPUT-MANIFEST-V1.json':'b47af64277330bb46a3fc1bb171dfcaaaf91abb1',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json':'788d1f969aa335ee18db9186c5ec0578ee1a960a',
'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts':'5b4e5133e51dfaf447c2de52caf1a9f50c8254d3',
'apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts':'dfa2c10266a5079842012426aed175851d30ca44',
'apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts':'6f7b6450d4f671c75affc2c7aba45ed71cb518c5',
'apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts':'b4b7448518628bcffe8eaf6a91d9967145f7647d',
'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts':'6133206095ca3a98ab5e8ae514ee4610404d2edd',
'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts':'45cca8e03cf0641f2fbf45f3b3aca044f322989c',
'apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts':'39a097a2343bd95dcc6b7621a4acc0e31772c563',
'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py':'ff2ad210387402a74731968e14746210fd2440dd'
};
for(const [p,s] of Object.entries(predecessors)){eq(blob(base,p),s,`EA5E2_BASE_PIN:${p}`);eq(blob('HEAD',p),s,`EA5E2_PREDECESSOR_MUTATED:${p}`)}

const candidateBlobs={
 [collectorPhaseWorkflowPath]:'d3e2102ef1f71b7687873c049b9c95d19bef5d69',
 [schedulePath]:'964fde5ad80dcf62a901184b0db3789858dfed85',
 [authorityPath]:'2f234cec82b77a5542ddcf4683e4b5e692ccf4f3',
 [continuationPath]:'a83437765f1c75860c5270b89446474787cde4c3',
 [assimilationPath]:'6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36',
 [externalCandidatePath]:'71df4e47b0c62b7c6f2126e33896849af56273ca',
 [fixedLagSchedulerPath]:'7525c4748c8d758ba04a198b8a6c00f1a9ffceb4',
 [collectorPhaseOrchestratorPath]:'4040983b8b5e0f1efc89c3bf6a15d038af5ae0fb',
 [collectorPhaseAcceptancePath]:'e1859170cc89a2d8fa98562b9a06833784141032',
 [externalDbSourcePath]:'e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259',
 [externalDbAcceptancePath]:'e796ae2ad265b67f38960ee80d5664cb9ba768e0',
 [cutoffAcceptancePath]:'741fffeec8d976648e78a9f1cb2c888a1b423f01',
 [schedulerAcceptancePath]:'6be7604dc29940880d02f4bfc9722a13cc2af494'
};
for(const [p,s] of Object.entries(candidateBlobs))eq(blob('HEAD',p),s,`EA5E2_CANDIDATE_BLOB:${p}`);

const schedule=json(schedulePath);
eq(schedule.schema_version,'geox_mcft_cap09_ea5e2_fixed_lag_schedule_v1','EA5E2_SCHEDULE_SCHEMA_REQUIRED');
eq(schedule.epoch_id,'mcft_cap09_external_formal_window_epoch_20260811t170000z_v1','EA5E2_EPOCH_REQUIRED');
eq(schedule.slots.length,24,'EA5E2_EXACT_24_SLOTS_REQUIRED');
eq(schedule.window_input_manifest_blob_sha,'b47af64277330bb46a3fc1bb171dfcaaaf91abb1','EA5E2_MANIFEST_BINDING_REQUIRED');
const p=schedule.schedule_profile;
eq(p.scheduler_eligibility_lag_hours,7,'EA5E2_LAG_REQUIRED');
eq(p.pre_boundary_collector_offset_minutes,-30,'EA5E2_PREBOUNDARY_OFFSET_REQUIRED');
eq(p.late_exact_hour_collector_offset_minutes,390,'EA5E2_LATE_COLLECTOR_OFFSET_REQUIRED');
eq(p.late_exact_hour_evidence_cutoff_offset_minutes,432,'EA5E2_LATE_CUTOFF_REQUIRED');
eq(p.runtime_observer_offset_minutes,437,'EA5E2_OBSERVER_OFFSET_REQUIRED');
eq(p.minimum_ingestion_margin_minutes,5,'EA5E2_MARGIN_REQUIRED');
const o00=Date.parse('2026-08-11T17:00:00.000Z');
for(let i=0;i<24;i++){
 const s=schedule.slots[i],t=o00+i*3600000;
 eq(s.slot_id,`O${String(i).padStart(2,'0')}`,`EA5E2_SLOT_ID:${i}`);
 eq(Date.parse(s.logical_time),t,`EA5E2_SLOT_TIME:${i}`);
 eq(Date.parse(s.pre_boundary_causal_collector_target),t-30*60000,`EA5E2_PREBOUNDARY_TIME:${i}`);
 eq(Date.parse(s.late_exact_hour_collector_scheduled),t+390*60000,`EA5E2_LATE_COLLECTOR_TIME:${i}`);
 eq(Date.parse(s.scheduler_eligibility_time),t+420*60000,`EA5E2_ELIGIBILITY_TIME:${i}`);
 eq(Date.parse(s.late_exact_hour_evidence_cutoff),t+432*60000,`EA5E2_LATE_CUTOFF_TIME:${i}`);
 eq(Date.parse(s.runtime_observer_nominal_time),t+437*60000,`EA5E2_OBSERVER_TIME:${i}`);
}
no(schedule.phase_rules.future_forcing_post_logical_time_availability_allowed,'EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN');
no(schedule.phase_rules.time_relabeling_allowed,'EA5E2_TIME_RELABELING_FORBIDDEN');
no(schedule.phase_rules.source_substitution_allowed,'EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN');

const authority=json(authorityPath);
eq(authority.record_status,'EA5E2_FIXED_LAG_SCHEDULE_READINESS_CANDIDATE_NOT_EFFECTIVE','EA5E2_CANDIDATE_STATUS_REQUIRED');
eq(authority.base_main_sha,base,'EA5E2_AUTHORITY_BASE_REQUIRED');
eq(authority.schedule_authority.schedule_blob_sha,'964fde5ad80dcf62a901184b0db3789858dfed85','EA5E2_AUTHORITY_SCHEDULE_BLOB_REQUIRED');
const ib=authority.implementation_path_exact_blobs;
for(const [k,v] of Object.entries({
 external_collector_canonicalizer:'5b4e5133e51dfaf447c2de52caf1a9f50c8254d3',
 durable_raw_retention_adapter:'dfa2c10266a5079842012426aed175851d30ca44',
 restricted_formal_evidence_ingress:'6f7b6450d4f671c75affc2c7aba45ed71cb518c5',
 fixed_lag_collector_phase_orchestrator:'4040983b8b5e0f1efc89c3bf6a15d038af5ae0fb',
 collector_phase_orchestration_acceptance:'e1859170cc89a2d8fa98562b9a06833784141032',
 external_formal_database_evidence_source:'e5ed3c677bf55e4eee3cbb67a52e3b6886b8f259',
 external_formal_database_evidence_source_acceptance:'e796ae2ad265b67f38960ee80d5664cb9ba768e0',
 historical_s2_database_evidence_reader_unchanged:'45cca8e03cf0641f2fbf45f3b3aca044f322989c',
 historical_s5_selected_evidence_readback_unchanged:'39a097a2343bd95dcc6b7621a4acc0e31772c563',
 external_cap04_input_authority:'b4b7448518628bcffe8eaf6a91d9967145f7647d',
 continuation_evidence_window_late_cutoff_seam:'a83437765f1c75860c5270b89446474787cde4c3',
 assimilated_continuation_cutoff_threading:'6699fb741cc0f61291f3d8c6e1e45ee0dcc79e36',
 external_cap04_candidate_execution_service:'71df4e47b0c62b7c6f2126e33896849af56273ca',
 persistent_sequential_scheduler_adapter:'6133206095ca3a98ab5e8ae514ee4610404d2edd',
 fixed_lag_scheduler_adapter:'7525c4748c8d758ba04a198b8a6c00f1a9ffceb4',
 live_provider_probe:'ff2ad210387402a74731968e14746210fd2440dd'
}))eq(ib[k],v,`EA5E2_IMPLEMENTATION_BLOB:${k}`);
const rc=authority.readiness_proof_contract;
for(const k of ['real_provider_gets_required','live_kbs_reproof_required','live_gfs_72h_same_cycle_reproof_required','raw_retention_before_decode_contract_required','restricted_append_only_formal_ingress_contract_required','runtime_provider_fetch_forbidden','runtime_database_evidence_only_required','external_formal_database_source_read_only_required','exact_five_binding_families_required','exact_ea5e1_config_manifest_binding_required','two_phase_same_slot_composition_required','whole_phase_validation_before_ingress_required','collector_phase_family_partition_required','scheduler_fixed_lag_implementation_required','scheduler_default_zero_lag_preserved','exact_interval_late_cutoff_implementation_required','non_exact_interval_evidence_cutoff_remains_logical_time'])yes(rc[k],`EA5E2_READINESS_REQUIRED:${k}`);
no(rc.historical_s2_s5_database_readers_mutated,'EA5E2_HISTORICAL_DB_READER_MUTATION_FORBIDDEN');
eq(rc.external_formal_scheduler_lag_hours,7,'EA5E2_AUTHORITY_LAG_REQUIRED');
eq(rc.exact_interval_late_cutoff_offset_minutes,432,'EA5E2_AUTHORITY_CUTOFF_REQUIRED');
eq(JSON.stringify(rc.exact_interval_late_cutoff_types),JSON.stringify(['observed_rainfall_v1','historical_et0_estimate_v1']),'EA5E2_AUTHORITY_LATE_TYPES_REQUIRED');
no(rc.future_forcing_post_logical_time_availability_allowed,'EA5E2_AUTHORITY_POST_T_FUTURE_FORCING_FORBIDDEN');no(rc.time_relabeling_allowed,'EA5E2_AUTHORITY_RELABEL_FORBIDDEN');no(rc.source_substitution_allowed,'EA5E2_AUTHORITY_SOURCE_SUB_FORBIDDEN');
for(const k of ['formal_database_write_count','formal_raw_object_write_count','scheduler_write_count','runtime_tick_count'])eq(rc[k],0,`EA5E2_ZERO_SIDE_EFFECT:${k}`);

const scheduler=read(fixedLagSchedulerPath);
for(const m of ['default_eligibility_lag_hours: 0','external_formal_eligibility_lag_hours: 7','FIXED_LAG_BOUNDARY_NOT_YET_ELIGIBLE','floorToUtcHourV1','Math.min(requestedThroughMs, eligibleThroughMs)'])has(scheduler,m,'EA5E2_FIXED_LAG_IMPLEMENTATION_MISSING');
const continuation=read(continuationPath);
for(const m of ['exact_interval_availability_cutoff_time?: string','exactIntervalRole ? input.exact_interval_availability_cutoff_time : input.logical_time','EXACT_INTERVAL_AVAILABILITY_CUTOFF_PRECEDES_LOGICAL_TIME','NOT_AVAILABLE_BY_EXACT_INTERVAL_CUTOFF'])has(continuation,m,'EA5E2_LATE_CUTOFF_IMPLEMENTATION_MISSING');
const assimilation=read(assimilationPath);has(assimilation,'exact_interval_availability_cutoff_time?: string','EA5E2_ASSIMILATION_CUTOFF_INPUT_MISSING');has(assimilation,'exact_interval_availability_cutoff_time: input.exact_interval_availability_cutoff_time','EA5E2_ASSIMILATION_CUTOFF_THREAD_MISSING');
const candidate=read(externalCandidatePath);has(candidate,'EXTERNAL_FORMAL_EXACT_INTERVAL_AVAILABILITY_CUTOFF_OFFSET_MINUTES_V1 = 432','EA5E2_EXTERNAL_CUTOFF_OFFSET_MISSING');has(candidate,'exact_interval_availability_cutoff_time: exactIntervalAvailabilityCutoffV1(logicalTime)','EA5E2_EXTERNAL_CUTOFF_BINDING_MISSING');
const collectorOrchestrator=read(collectorPhaseOrchestratorPath);
for(const m of ['collectRetainDecodeCanonicalizeExternalEvidenceV1','PRE_BOUNDARY_CAUSAL','LATE_EXACT_HOUR','Whole-phase validation is complete before the first canonical ingress call.','appendCanonicalizedExternalEvidence','EA5E2_COLLECTOR_EXACT_INTERVAL_MISMATCH','EA5E2_COLLECTOR_REQUIRED_PHASE_FAMILY_MISSING','EA5E2_COLLECTOR_RECORD_TYPE_WRONG_PHASE'])has(collectorOrchestrator,m,'EA5E2_COLLECTOR_PHASE_ORCHESTRATOR_MISSING');
const collectorAcceptance=read(collectorPhaseAcceptancePath);
for(const m of ['same_slot_key_both_phases','raw_retention_before_decode','whole_phase_validation_before_ingress','canonical_fact_write_count','EA5E2_COLLECTOR_PHASE_STARTED_BEFORE_AUTHORIZED_TARGET','EA5E2_COLLECTOR_RECORD_TYPE_WRONG_PHASE','EA5E2_COLLECTOR_REQUIRED_PHASE_FAMILY_MISSING'])has(collectorAcceptance,m,'EA5E2_COLLECTOR_PHASE_ACCEPTANCE_MISSING');
const externalDbSource=read(externalDbSourcePath);
for(const m of ['BEGIN TRANSACTION READ ONLY','MCFT_CAP09_EXTERNAL_FORMAL_EXACT_INTERVAL_CUTOFF_OFFSET_MINUTES_V1 = 432','targetExactIntervalV1','EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING','database_write_count: 0','provider_request_count: 0'])has(externalDbSource,m,'EA5E2_EXTERNAL_DB_SOURCE_MISSING');
if(/\b(?:INSERT\s+INTO|UPDATE\s+facts|DELETE\s+FROM|TRUNCATE\s+)/i.test(externalDbSource))throw new Error('EA5E2_EXTERNAL_DB_SOURCE_WRITE_SQL_FORBIDDEN');
const externalDbAcceptance=read(externalDbAcceptancePath);
for(const m of ['future_forcing_post_logical_time_excluded','non_target_exact_interval_excluded','exact_interval_cutoff_minutes','historical_s2_s5_reader_modified: false','EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING:rainfall','EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING:future_weather'])has(externalDbAcceptance,m,'EA5E2_EXTERNAL_DB_ACCEPTANCE_MISSING');
const collectorWorkflow=read(collectorPhaseWorkflowPath);
for(const m of ['ACCEPTANCE_MCFT_CAP_09_EA5E2_COLLECTOR_PHASE_ORCHESTRATION.ts','ACCEPTANCE_MCFT_CAP_09_EA5E2_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE.ts','canonical_fact_write_count','same_slot_key_both_phases','whole_phase_validation_before_ingress','raw_retention_before_decode','future_forcing_post_logical_time_excluded','historical_s2_s5_reader_modified','persist-credentials: false'])has(collectorWorkflow,m,'EA5E2_COLLECTOR_PHASE_WORKFLOW_MISSING');
if(/DATABASE_URL|POSTGRES(?:QL)?|NEON_DATABASE_URL|GEOX_MCFT_CAP09_S6_DATABASE_URL|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|R2_ACCESS_KEY/.test(collectorWorkflow))throw new Error('EA5E2_COLLECTOR_PHASE_WORKFLOW_SECRET_OR_WRITE_SURFACE_FORBIDDEN');

const livePath='acceptance-output/MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_RESULT.json';
if(!fs.existsSync(livePath))throw new Error('EA5E2_LIVE_PROVIDER_REPROOF_RESULT_REQUIRED');
const live=json(livePath);
eq(live.status,'PASS','EA5E2_LIVE_PROVIDER_PASS_REQUIRED');
eq(live.subject_sha,git('rev-parse','HEAD'),'EA5E2_LIVE_PROVIDER_EXACT_HEAD_REQUIRED');
yes(live.live_source_qualified,'EA5E2_LIVE_SOURCE_QUALIFIED_REQUIRED');yes(live.gfs_72h_full_value_pipeline_qualified,'EA5E2_GFS_72H_REQUIRED');yes(live.future_et0_72h_value_execution_qualified,'EA5E2_FUTURE_ET0_REQUIRED');
if(!(live.kbs?.rain_numeric_distinct_hours>=24)||!(live.kbs?.historical_et0_complete_distinct_hours>=24))throw new Error('EA5E2_KBS_COMPLETENESS_REQUIRED');
eq(live.future_weather?.point_count,72,'EA5E2_WEATHER_72_REQUIRED');eq(live.future_et0?.point_count,72,'EA5E2_ET0_72_REQUIRED');
for(const k of ['database_write_count','formal_evidence_write_count','public_raw_value_emission_count'])eq(live[k],0,`EA5E2_LIVE_PROBE_WRITE_FORBIDDEN:${k}`);
no(live.formal_window_started,'EA5E2_LIVE_PROBE_FORMAL_START_FORBIDDEN');no(live.mcft_cap09_completed,'EA5E2_LIVE_PROBE_COMPLETION_FORBIDDEN');

const effect=authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
for(const k of ['ea5e2_collector_runtime_schedule_readiness_effective','fixed_lag_schedule_frozen','scheduler_fixed_lag_seam_effective','exact_interval_late_cutoff_seam_effective','collector_runtime_ordering_executable','external_formal_database_evidence_read_path_executable','required_ingestion_margin_frozen','ea5e3_formal_authority_v3_authorized'])yes(effect[k],`EA5E2_EFFECT_REQUIRED:${k}`);
for(const k of ['ea5e3_effective','ea5e_complete','formal_o00_start_authorized','formal_window_started','mcft_cap09_completed'])no(effect[k],`EA5E2_PREMATURE_EFFECT:${k}`);eq(effect.formal_execution_count,'0/24','EA5E2_ZERO_EXECUTION_REQUIRED');
eq(authority.next_legal_successor_if_effective,'S6-EA5E3-FORMAL-AUTHORITY-V3-EFFECTIVENESS','EA5E2_NEXT_FRONTIER_REQUIRED');

fs.mkdirSync('acceptance-output',{recursive:true});
const out={schema_version:'geox_mcft_cap09_ea5e2_fixed_lag_schedule_readiness_governance_result_v1',status:'PASS',base_main_sha:base,subject_head_sha:git('rev-parse','HEAD'),exact_changed_file_count:changed.length,live_provider_reproof_pass:true,collector_phase_orchestration_required:true,external_formal_database_source_read_only:true,historical_s2_s5_database_readers_mutated:false,scheduler_default_lag_hours:0,scheduler_external_formal_lag_hours:7,exact_interval_late_cutoff_offset_minutes:432,slot_count:24,minimum_ingestion_margin_minutes:5,formal_database_write_count:0,formal_raw_object_write_count:0,scheduler_write_count:0,runtime_tick_count:0,formal_o00_start_authorized:false,formal_window_started:false,formal_execution_count:'0/24',ea5e2_effective_after_merge:true,ea5e3_authorized_after_merge:true,ea5e3_effective:false,ea5e_complete:false,mcft_cap09_completed:false};
fs.writeFileSync('acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));