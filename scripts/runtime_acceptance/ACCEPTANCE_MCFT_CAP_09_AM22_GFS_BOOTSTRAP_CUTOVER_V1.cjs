#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const h=require("./MCFT_CAP_09_AM22_GFS_BOOTSTRAP_V1.cjs");
const ROOT=h.ROOT;
const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");

function fixtureStage(){
 return {
  status:"PASS",architecture_effective:true,runtime_consumption_authorized:true,
  scope:{tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_public_research",field_id:"field_kbs_mcse_t4r1",season_id:"season_2026_corn",zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1"},
  lifecycle:{domain_state:"ACTIVE",authority_status:"RESOLVED",authority_validity:"VALID",authority_mode:"GOVERNED_PERSISTENT_STATE",active_consumable_candidate:true,horizon_end_utc:"2026-11-24T03:59:59.999Z"},
  biological_stage:{resolved_biological_stage:"R6_OR_LATER_MODEL_ESTIMATE",authority_as_of:"2026-10-09T04:00:00.000Z",authority_valid_until:"2026-10-10T10:00:00.000Z",forward_stability_hours:30},
  crop_water_use_stage:"LATE",crop_model_parameter:{value:0.6},
  graduation:{graduated_at:"2026-10-09T04:02:00.000Z"},
 };
}
try{
 const stage=fixtureStage();
 const window=h.selectA0({source_now:"2026-10-09T04:05:00.000Z",budget_ms:2081804,stage});
 assert.deepEqual(window,{a0:"2026-10-09T05:00:00.000Z",o00:"2026-10-09T06:00:00.000Z",o23:"2026-10-10T05:00:00.000Z",all_25_contexts_covered:true,window_selected_for_measurement_only:true});
 const combinedPolicy=JSON.parse(read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json"));
 assert.equal(combinedPolicy.selection_policy.selected_acquisition_budget_ms,2081804);
 assert.equal(combinedPolicy.selection_policy.required_six_phase_measurement_lead_ms,h.MEASUREMENT_LEAD_MS);
 assert.equal(combinedPolicy.selection_policy.required_authority_materialization_to_owner_start_margin_ms,h.AUTHORITY_MATERIALIZATION_MARGIN_MS);
 assert.equal(combinedPolicy.selection_policy.combined_minimum_lead_ms,2081804+h.MEASUREMENT_LEAD_MS+h.AUTHORITY_MATERIALIZATION_MARGIN_MS);
 const combinedWindow=h.selectA0({source_now:"2026-10-09T04:20:00.000Z",budget_ms:combinedPolicy.selection_policy.combined_minimum_lead_ms,stage});
 assert.equal(combinedWindow.a0,"2026-10-09T06:00:00.000Z");
 assert.throws(()=>h.selectA0({source_now:"2026-10-09T04:05:00.000Z",budget_ms:599999,stage}),/AM22_GFS_BOOTSTRAP_BUDGET_TOO_SMALL/);
 const cycle="2026-10-09T00:00:00.000Z",cycleKey="20261009t000000z",targetKey="20261009t050000z";
 const base={target_logical_time:window.a0,selected_cycle:cycle,valid_from:window.a0,issued_at:cycle,raw_source_sha256:"sha256:"+"a".repeat(64),available_to_runtime_at:"2026-10-09T04:20:00.000Z",ingested_at:"2026-10-09T04:21:00.000Z",observed_database_now:"2026-10-09T04:22:00.000Z"};
 const weather={...base,fact_id:"fact_external_evidence_"+"1".repeat(64),record_type:"future_weather_assumption_v1",payload_record_type:"future_weather_assumption_v1",binding_id:"noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1",origin_source_kind:"NOAA_NCEP_NOMADS_GFS",origin_source_id:"gfs_"+cycleKey+"_pgrb2_0p25_kbs",source_record_id:"gfs_future_weather_"+cycleKey+"_"+targetKey};
 const et0={...base,fact_id:"fact_external_evidence_"+"2".repeat(64),record_type:"future_et0_assumption_v1",payload_record_type:"future_et0_assumption_v1",binding_id:"noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1",origin_source_kind:"NOAA_NCEP_NOMADS_GFS_DERIVED",origin_source_id:"gfs_"+cycleKey+"_asce_short_reference_et0_kbs",source_record_id:"gfs_future_et0_"+cycleKey+"_"+targetKey};
 const pair=h.validateGfsPairRows([weather,et0],window.a0);
 assert.equal(pair.selected_cycle,cycle);
 assert.throws(()=>h.validateGfsPairRows([weather],window.a0),/AM22_GFS_BOOTSTRAP_EXACT_PAIR_REQUIRED/);
 assert.throws(()=>h.validateGfsPairRows([weather,{...et0,raw_source_sha256:"sha256:"+"b".repeat(64)}],window.a0),/AM22_GFS_BOOTSTRAP_SAME_RAW_BUNDLE_REQUIRED/);
 assert.throws(()=>h.validateGfsPairRows([weather,{...et0,selected_cycle:"2026-10-09T06:00:00.000Z",issued_at:"2026-10-09T06:00:00.000Z"}],window.a0),/AM22_GFS_BOOTSTRAP_ET0_ORIGIN_ID_MISMATCH|AM22_GFS_BOOTSTRAP_SAME_CYCLE_REQUIRED/);
 assert.throws(()=>h.validateGfsPairRows([weather,{...weather,fact_id:"fact_external_evidence_"+"3".repeat(64)}],window.a0),/AM22_GFS_BOOTSTRAP_DUPLICATE_ROLE_FORBIDDEN|AM22_GFS_BOOTSTRAP_WEATHER_ET0_PAIR_REQUIRED/);

 const wrapper=read("apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts");
 assert.match(wrapper,/readMcftCap09OwnerCutoverAuthorityV1/);
 assert.match(wrapper,/parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1/);
 assert.match(wrapper,/runtime_mode:MCFT_CAP09_OWNER_CUTOVER_MODE_V1/);
 assert.match(wrapper,/runMcftCap09ProductionEvidenceRuntimeV1\(\{\s*runtime_start_authority:raw/);
 assert.match(wrapper,/baseRuntimeAuthority\.host_id!==ownerAuthority\.host_id/);
 assert.doesNotMatch(wrapper,/FormalV5EvidenceRuntimeHandoff/);
 assert.doesNotMatch(wrapper,/requireEffectiveAm22StartPolicyV2/);

 const packaging=read("apps/server/scripts/write_dist_entries.cjs");
 assert.match(packaging,/mcft_cap09_am22_gfs_bootstrap_evidence_owner\.js/);
 const overlay=read("docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml");
 assert.match(overlay,/mcft_cap09_am22_gfs_bootstrap_evidence_owner\.js/);
 assert.doesNotMatch(overlay,/privileged|cap_add|network_mode/);

 const runner=read("scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs");
 cp.execFileSync(process.execPath,["--check",path.join(ROOT,"scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs")],{cwd:ROOT,stdio:"pipe"});
 for(const marker of ["GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json","GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json","GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json","BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs","GEOX-MCFT-CAP-09-PRODUCTION-OWNER-CUTOVER-AUTHORITY-INSTANCE-V1","IMAGE_BUILD_AND_ATTESTATION","A0_PLANNING_AND_AUTHORITY_MATERIALIZATION","AM22_GFS_BOOTSTRAP_AUTHORITY_MATERIALIZATION_MARGIN_EXCEEDED","AM22_GFS_BOOTSTRAP_FULL_ACQUISITION_BUDGET_NOT_PRESERVED_AT_OWNER_START","--force-recreate","AM22_GFS_BOOTSTRAP_EXACT_A0_GFS_PAIR_NOT_READY_BEFORE_MEASUREMENT_LEAD","AM22_GFS_BOOTSTRAP_HOST_DATABASE_CLOCK_SKEW_EXCEEDED","rollback_required_by_owner_policy","automatic_compose_down_performed:rollbackSucceeded"])assert.ok(runner.includes(marker),marker);
 assert.ok(runner.indexOf('phase="IMAGE_BUILD_AND_ATTESTATION"')<runner.indexOf('phase="A0_PLANNING_AND_AUTHORITY_MATERIALIZATION"'));
 assert.match(runner,/formal_a0_authority_ref:BOOTSTRAP_A0_POLICY_REL/);
 assert.doesNotMatch(runner,/GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL|GEOX_MCFT_CAP09_FORMAL_RAW_S3_/);
 assert.ok(runner.includes("formal_database_credential_consumed:false"));
 assert.ok(runner.includes("formal_v5_arm:false"));
 assert.ok(runner.includes("a0_execution:false"));
 assert.ok(runner.includes("o00_started:false"));

 console.log(JSON.stringify({status:"PASS",short_a0_selection:true,combined_acquisition_measurement_lead:true,image_attestation_precedes_a0_planning:true,host_clock_authority_preserved:true,exact_gfs_pair_gate:true,owner_authority_preserved:true,owner_verification_failure_rollback_preserved:true,existing_production_evidence_runtime_reused:true,formal_credentials_consumed:false,production_executed:false,formal_v5_arm:false,a0_execution:false,o00_started:false},null,2));
}catch(error){console.error(error);process.exitCode=1;}
