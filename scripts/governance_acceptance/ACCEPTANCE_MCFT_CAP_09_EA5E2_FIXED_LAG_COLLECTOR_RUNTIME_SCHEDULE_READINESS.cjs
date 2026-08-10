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
const schedulePath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-FIXED-LAG-COLLECTOR-RUNTIME-SCHEDULE-V1.json';
const authorityPath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-V1.json';
const gatePath='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS.cjs';
const workflowPath='.github/workflows/mcft-cap-09-ea5e2-fixed-lag-collector-runtime-schedule-readiness.yml';
const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([schedulePath,authorityPath,gatePath,workflowPath].sort()),'EA5E2_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');

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
'apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts':'f627c89d59092621dd7a4523f09b2ce4ec78433b',
'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts':'6133dcc182a3fab145a846b1f7015a4e1fa1518b',
'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py':'ff2ad210387402a74731968e14746210fd2440dd'
};
for(const [p,s] of Object.entries(predecessors)){eq(blob(base,p),s,`EA5E2_BASE_PIN:${p}`);eq(blob('HEAD',p),s,`EA5E2_PREDECESSOR_MUTATED:${p}`)}
eq(blob('HEAD',schedulePath),'964fde5ad80dcf62a901184b0db3789858dfed85','EA5E2_SCHEDULE_BLOB_REQUIRED');
eq(blob('HEAD',authorityPath),'3d72a57e7800d7c8f0cb9e77ee30b585603166b3','EA5E2_AUTHORITY_BLOB_REQUIRED');

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
 eq(Date.parse(s.scheduler_eligibility_time),t+420*60000,`EA5E2_ELIGIBILITY_TIME:${i}`);
 eq(Date.parse(s.late_exact_hour_collector_scheduled),t+390*60000,`EA5E2_LATE_COLLECTOR_TIME:${i}`);
 eq(Date.parse(s.late_exact_hour_evidence_cutoff),t+432*60000,`EA5E2_LATE_CUTOFF_TIME:${i}`);
 eq(Date.parse(s.runtime_observer_nominal_time),t+437*60000,`EA5E2_OBSERVER_TIME:${i}`);
}
no(schedule.phase_rules.future_forcing_post_logical_time_availability_allowed,'EA5E2_POST_T_FUTURE_FORCING_FORBIDDEN');
no(schedule.phase_rules.time_relabeling_allowed,'EA5E2_TIME_RELABELING_FORBIDDEN');
no(schedule.phase_rules.source_substitution_allowed,'EA5E2_SOURCE_SUBSTITUTION_FORBIDDEN');
eq(JSON.stringify(schedule.phase_rules.pre_boundary_causal_types),JSON.stringify(['soil_moisture_observation_v1','future_weather_assumption_v1','future_et0_assumption_v1']),'EA5E2_PREBOUNDARY_TYPES_REQUIRED');
eq(JSON.stringify(schedule.phase_rules.late_exact_hour_types),JSON.stringify(['observed_rainfall_v1','historical_et0_estimate_v1']),'EA5E2_LATE_TYPES_REQUIRED');

const authority=json(authorityPath);
eq(authority.record_status,'EA5E2_FIXED_LAG_SCHEDULE_READINESS_CANDIDATE_NOT_EFFECTIVE','EA5E2_CANDIDATE_STATUS_REQUIRED');
eq(authority.base_main_sha,base,'EA5E2_AUTHORITY_BASE_REQUIRED');
eq(authority.schedule_authority.schedule_blob_sha,'964fde5ad80dcf62a901184b0db3789858dfed85','EA5E2_AUTHORITY_SCHEDULE_BLOB_REQUIRED');
for(const [k,v] of Object.entries({external_collector_canonicalizer:'5b4e5133e51dfaf447c2de52caf1a9f50c8254d3',durable_raw_retention_adapter:'dfa2c10266a5079842012426aed175851d30ca44',restricted_formal_evidence_ingress:'6f7b6450d4f671c75affc2c7aba45ed71cb518c5',external_cap04_candidate_execution_service:'f627c89d59092621dd7a4523f09b2ce4ec78433b',persistent_sequential_scheduler_adapter:'6133dcc182a3fab145a846b1f7015a4e1fa1518b',live_provider_probe:'ff2ad210387402a74731968e14746210fd2440dd'}))eq(authority.implementation_path_exact_blobs[k],v,`EA5E2_IMPLEMENTATION_BLOB:${k}`);
const rc=authority.readiness_proof_contract;
for(const k of ['real_provider_gets_required','live_kbs_reproof_required','live_gfs_72h_same_cycle_reproof_required','raw_retention_before_decode_contract_required','restricted_append_only_formal_ingress_contract_required','runtime_provider_fetch_forbidden','exact_five_binding_families_required','exact_ea5e1_config_manifest_binding_required'])yes(rc[k],`EA5E2_READINESS_REQUIRED:${k}`);
no(rc.future_forcing_post_logical_time_availability_allowed,'EA5E2_AUTHORITY_POST_T_FUTURE_FORCING_FORBIDDEN');no(rc.time_relabeling_allowed,'EA5E2_AUTHORITY_RELABEL_FORBIDDEN');no(rc.source_substitution_allowed,'EA5E2_AUTHORITY_SOURCE_SUB_FORBIDDEN');
for(const k of ['formal_database_write_count','formal_raw_object_write_count','scheduler_write_count','runtime_tick_count'])eq(rc[k],0,`EA5E2_ZERO_SIDE_EFFECT:${k}`);

const collector=read('apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts');
for(const m of ['Raw bytes MUST receive a verified private-retention receipt before any decoder is called','retain_raw','decode','canonical'])has(collector,m,'EA5E2_COLLECTOR_SEQUENCE_MISSING');
const ingress=read('apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts');
for(const m of ['append-only public.facts writer','durable raw verification','five-source'])has(ingress,m,'EA5E2_INGRESS_BOUNDARY_MISSING');
const candidate=read('apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts');
for(const m of ['buildAssimilatedContinuationEvidenceWindowV2','selectCap04FutureForcingOutcomeV1','executeCap04Pure72hForecastMathV1'])has(candidate,m,'EA5E2_EXTERNAL_RUNTIME_PATH_MISSING');
const scheduler=read('apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts');
for(const m of ['oldest-first','lease','fencing_token'])has(scheduler,m,'EA5E2_SCHEDULER_SEMANTICS_MISSING');

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
yes(effect.ea5e2_collector_runtime_schedule_readiness_effective,'EA5E2_EFFECT_REQUIRED');yes(effect.fixed_lag_schedule_frozen,'EA5E2_SCHEDULE_FREEZE_REQUIRED');yes(effect.collector_runtime_ordering_executable,'EA5E2_EXECUTABLE_ORDER_REQUIRED');yes(effect.required_ingestion_margin_frozen,'EA5E2_MARGIN_FREEZE_REQUIRED');yes(effect.ea5e3_formal_authority_v3_authorized,'EA5E2_EA5E3_AUTH_REQUIRED');
for(const k of ['ea5e3_effective','ea5e_complete','formal_o00_start_authorized','formal_window_started','mcft_cap09_completed'])no(effect[k],`EA5E2_PREMATURE_EFFECT:${k}`);eq(effect.formal_execution_count,'0/24','EA5E2_ZERO_EXECUTION_REQUIRED');
eq(authority.next_legal_successor_if_effective,'S6-EA5E3-FORMAL-AUTHORITY-V3-EFFECTIVENESS','EA5E2_NEXT_FRONTIER_REQUIRED');

fs.mkdirSync('acceptance-output',{recursive:true});
const out={schema_version:'geox_mcft_cap09_ea5e2_fixed_lag_schedule_readiness_governance_result_v1',status:'PASS',base_main_sha:base,subject_head_sha:git('rev-parse','HEAD'),exact_changed_file_count:changed.length,live_provider_reproof_pass:true,scheduler_eligibility_lag_hours:7,slot_count:24,minimum_ingestion_margin_minutes:5,formal_database_write_count:0,formal_raw_object_write_count:0,scheduler_write_count:0,runtime_tick_count:0,formal_o00_start_authorized:false,formal_window_started:false,formal_execution_count:'0/24',ea5e2_effective_after_merge:true,ea5e3_authorized_after_merge:true,ea5e3_effective:false,ea5e_complete:false,mcft_cap09_completed:false};
fs.writeFileSync('acceptance-output/MCFT_CAP_09_EA5E2_FIXED_LAG_COLLECTOR_RUNTIME_SCHEDULE_READINESS_GOVERNANCE_RESULT.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
