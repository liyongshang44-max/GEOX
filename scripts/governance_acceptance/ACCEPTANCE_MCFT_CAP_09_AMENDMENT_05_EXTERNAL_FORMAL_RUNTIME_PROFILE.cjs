'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'c5f10a0628aba158463e7c4d4e151ed14b60ff79';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  a1: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  site: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json',
  reality: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json',
  source: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json',
  crop: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json',
  recovery: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json',
  ea5a: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json',
  amendment: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md',
  status: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-STATUS.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_05_EXTERNAL_FORMAL_RUNTIME_PROFILE.cjs',
  workflow: '.github/workflows/mcft-cap-09-amendment-05-external-formal-runtime-profile.yml',
  bootstrapCompiler: 'apps/server/src/runtime/twin_runtime/runtime_config_compile_service_v1.ts',
  a0Builder: 'apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts',
  assimilatedConfig: 'apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v2.ts',
  observationSelector: 'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts',
  configChain: 'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.ts',
  formalRunner: 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts',
};
const PINS = {
  task:'39f6a09273c30088a7ea264cfa94ff930ea5518e',
  a1:'41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  site:'eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8',
  reality:'dedc8db6e2e3c902066ed94b0d3322a69775b7b6',
  source:'30b7910a1bd27882b80eb56041924d0f6252ae02',
  crop:'b5de9d29189cb654444b3f57d00df290eefe16d3',
  recovery:'1174940a6908e545e70d87cb65be5b3a41db33cf',
  ea5a:'f3a57413d78633685cbc5be7d94f39d9fdc5c62b',
  amendment:'7a92c17f7ba32aae52667de9c21db62bfd2ba70b',
  status:'be8a80345e004cf33d3993b0e26dcea01fc6644b',
};
const EXPECT = [F.amendment,F.status,F.gate,F.workflow].sort();
const OUT = path.join(ROOT,'acceptance-output/MCFT_CAP_09_AMENDMENT_05_EXTERNAL_FORMAL_RUNTIME_PROFILE_RESULT.json');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const blob=(ref,file)=>git('rev-parse',`${ref}:${file}`);
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');
const json=(file)=>JSON.parse(read(file));
const req=(ok,code)=>{if(!ok)throw new Error(code)};
const result={schema_version:'geox_mcft_cap09_amendment05_governance_result_v1',status:'FAIL',base_sha:BASE,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false,mcft_cap09_completed:false};

try {
  req(BASE===EXPECTED_BASE,`AM05_BASE_MAIN_DRIFT:${BASE}`);
  const changed=git('diff','--name-only',`${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result,{changed_files:changed,exact_file_count:changed.length});
  req(JSON.stringify(changed)===JSON.stringify(EXPECT),`AM05_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  for(const key of ['task','a1','site','reality','source','crop','recovery','ea5a']) req(blob(BASE,F[key])===PINS[key],`AM05_PREDECESSOR_BLOB_DRIFT:${key}`);
  req(blob('HEAD',F.amendment)===PINS.amendment,'AM05_AMENDMENT_BLOB_DRIFT');
  req(blob('HEAD',F.status)===PINS.status,'AM05_STATUS_BLOB_DRIFT');

  const task=read(F.task), a1=read(F.a1), source=json(F.source), reality=json(F.reality), recovery=json(F.recovery), ea5a=json(F.ea5a), amendment=read(F.amendment), status=json(F.status);
  req(task.includes('S6-EA5   Formal Authority V3 + Database Preflight'),'AM05_TASKBOOK_EA5_AUTHORITY_MISSING');
  req(a1.includes('EXTERNAL_SCOPE_FRESH_BOOTSTRAP_REQUIRED = YES')&&a1.includes('CROSS_SCOPE_CANONICAL_STITCHING_FORBIDDEN = YES'),'AM05_AMENDMENT01_FRESH_SCOPE_BOUNDARY_MISSING');
  req(reality.scope_origin?.fresh_external_bootstrap_required===true&&reality.scope_origin?.cross_scope_canonical_stitching_authorized===false,'AM05_EA2_REALITY_FRESH_SCOPE_DRIFT');
  req(recovery.current_authority_effect_if_merged?.live_source_qualified===true&&recovery.current_authority_effect_if_merged?.gfs_72h_full_value_pipeline_qualified===true&&recovery.current_authority_effect_if_merged?.future_et0_72h_value_execution_qualified===true,'AM05_EA4_RECOVERY_REQUIRED');
  req(ea5a.success_effect_if_merged?.fresh_formal_database_identity_qualified===true&&ea5a.success_effect_if_merged?.fresh_external_scope_preflight_qualified===true,'AM05_EA5A_PREFLIGHT_REQUIRED');
  req(ea5a.success_effect_if_merged?.external_package_formal_eligible===false&&ea5a.success_effect_if_merged?.formal_o00_start_authorized===false,'AM05_EA5A_PREMATURE_FORMAL_EFFECT');
  req(source.binding_policy?.runtime_fetches_public_providers===false&&source.binding_policy?.cross_cycle_substitution_authorized===false&&source.binding_policy?.field_equivalence_by_proximity_authorized===false,'AM05_SOURCE_BOUNDARY_WEAKENED');

  for(const token of [
    'kbs_lter_variate25_vwc_100mm_v1',
    'kbs_lter_raw_hourly_rain_mm_v1',
    'kbs_lter_asce_short_reference_et_hourly_v1',
    'noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1',
    'noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1',
    'POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1',
    'MODEL_PRIOR_FROM_CAP08',
    'SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY',
    'CONTROLLED_SYNTHETIC_REPLAY_PROXY',
    'exactly 24 effective Runtime Config pins',
    'One fixed Runtime Config ref/hash may not be reused across O00–O23',
    'Formal Window Input Manifest',
    'Runtime never fetches KBS or NOAA directly',
    'durable, private, hash-addressed retention receipt',
    'EA5E',
  ]) req(amendment.includes(token),`AM05_REQUIRED_RULING_MISSING:${token}`);

  req(status.status==='CANDIDATE_NOT_EFFECTIVE'&&status.base_main_sha===BASE&&status.amendment_blob_sha===PINS.amendment,'AM05_STATUS_AUTHORITY_DRIFT');
  req(status.repository_findings?.historical_bootstrap_compiler_replay_authority_pinned===true,'AM05_FINDING_BOOTSTRAP_COMPILER_MISSING');
  req(status.repository_findings?.historical_a0_envelope_replay_limitation_hardcoded===true&&status.repository_findings?.historical_a0_health_runtime_mode_replay_hardcoded===true,'AM05_FINDING_A0_REPLAY_MISSING');
  req(status.repository_findings?.historical_soil_binding_id_c8_20cm_hardcoded===true&&status.repository_findings?.historical_soil_operator_200mm_hardcoded===true,'AM05_FINDING_SOIL_BINDING_MISSING');
  req(status.repository_findings?.historical_cap04_24_config_chain_exists===true&&status.repository_findings?.formal_runner_currently_uses_one_fixed_runtime_config_pin===true&&status.repository_findings?.fixed_pin_cannot_legally_cover_all_24_effective_logical_times===true,'AM05_FINDING_CONFIG_CHAIN_MISSING');
  req(status.implementation_authority_if_effective?.historical_replay_contract_mutation_authorized===false&&status.implementation_authority_if_effective?.additive_external_runtime_profile_authorized===true,'AM05_ADDITIVE_ONLY_RULING_DRIFT');
  req(status.implementation_authority_if_effective?.database_write_authorized_by_this_amendment===false&&status.implementation_authority_if_effective?.formal_evidence_write_authorized_by_this_amendment===false&&status.implementation_authority_if_effective?.formal_o00_start_authorized===false,'AM05_PREMATURE_WRITE_OR_O00_AUTHORITY');

  const bootstrapCompiler=read(F.bootstrapCompiler), a0Builder=read(F.a0Builder), assimilatedConfig=read(F.assimilatedConfig), selector=read(F.observationSelector), chain=read(F.configChain), formalRunner=read(F.formalRunner);
  req(bootstrapCompiler.includes('MCFT_CAP_01_EXPECTED_AUTHORITY_V1')&&bootstrapCompiler.includes('CONTROLLED_SYNTHETIC'),'AM05_REPLAY_BOOTSTRAP_FINDING_NOT_REPRODUCED');
  req(a0Builder.includes('CONTROLLED_SYNTHETIC_REPLAY_PROXY')&&a0Builder.includes('runtime_mode: "REPLAY"'),'AM05_REPLAY_A0_FINDING_NOT_REPRODUCED');
  req(assimilatedConfig.includes('soil_obs_c8_20cm_v1')&&assimilatedConfig.includes('POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1'),'AM05_SOIL_CONFIG_FINDING_NOT_REPRODUCED');
  req(selector.includes('ASSIMILATED_CONTINUATION_OBSERVATION_BINDING_ID_V1')&&selector.includes('REJECTED_UNAUTHORIZED_BINDING'),'AM05_SOIL_SELECTOR_FINDING_NOT_REPRODUCED');
  req(chain.includes('CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1 = 24')&&chain.includes('effective_logical_time'),'AM05_EXISTING_24_CONFIG_CHAIN_NOT_REPRODUCED');
  req(
    formalRunner.includes('const template = json<ExecuteCap04SingleTickInputV1>("MCFT_CAP09_S6_CANONICAL_INPUT_JSON")') &&
    formalRunner.includes('canonical_input: { ...template, scope, logical_time: target.logical_time, created_at: now.toISOString(), lease_owner: owner, lease_duration_seconds: 300 }') &&
    !formalRunner.includes('runtime_config_by_slot') &&
    !formalRunner.includes('runtime_config_manifest'),
    'AM05_FIXED_FORMAL_INPUT_FINDING_NOT_REPRODUCED',
  );

  const bindingIds=status.formal_binding_ids_v1;
  req(new Set(Object.values(bindingIds)).size===5,'AM05_BINDING_IDS_MUST_BE_UNIQUE');
  req(status.external_soil_observation_authority?.measurement_depth_mm===100&&status.external_soil_observation_authority?.direct_state_equivalence===false&&status.external_soil_observation_authority?.root_zone_representativeness==='PARTIAL','AM05_SOIL_REPRESENTATIVENESS_DRIFT');
  req(status.next_legal_successor_if_effective==='S6-EA5B-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE-IMPLEMENTATION','AM05_SUCCESSOR_DRIFT');

  Object.assign(result,{status:'PASS',amendment_blob:blob('HEAD',F.amendment),status_blob:blob('HEAD',F.status),architecture_gap_reproduced:true,external_runtime_profile_implementation_authorized_after_effective_merge:true,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false,mcft_cap09_completed:false});
} catch(error) {
  result.error=`${error.name||'Error'}:${error.message||String(error)}`;
  process.exitCode=1;
}
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n');
if(result.status==='PASS') console.log(JSON.stringify(result)); else console.error(result.error);
