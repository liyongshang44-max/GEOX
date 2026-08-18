#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const ROOT = process.cwd();
const EXACT_BASE = "da6670633ffb8ef8a9b509043138a1e5550484c3";
const GATE = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json";
const DOC = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE.md";
const PRE = "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_FORMAL_EPOCH_GRADUATION_GATE_V1.cjs";
const AM19 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING-AUTHORITY-V1.json";
const OUT = path.join(ROOT,"acceptance-output/MCFT_CAP_09_AMENDMENT_19_ACCELERATED_GRADUATION_GATE_GOVERNANCE_RESULT.json");
function text(rel){const f=path.join(ROOT,rel);if(!fs.existsSync(f))throw new Error(`AMENDMENT19_GATE_REQUIRED_FILE_MISSING:${rel}`);return fs.readFileSync(f,"utf8");}
function json(rel){return JSON.parse(text(rel));}
function yes(v,c){if(!v)throw new Error(c);}
function has(v,t,c){yes(v.includes(t),c);}
const gate=json(GATE), am19=json(AM19), doc=text(DOC), pre=text(PRE);
yes(gate.schema_version==="geox_mcft_cap09_amendment19_graduation_gate_v1","AMENDMENT19_GATE_SCHEMA_REQUIRED");
yes(gate.authority_id==="GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1","AMENDMENT19_GATE_ID_REQUIRED");
yes(gate.record_status==="CANDIDATE_NOT_EFFECTIVE_UNTIL_EXACT_HEAD_PROOF_AND_PROTECTED_MAIN_MERGE","AMENDMENT19_GATE_CANDIDATE_STATUS_REQUIRED");
yes(gate.exact_predecessor_protected_main===EXACT_BASE,"AMENDMENT19_GATE_EXACT_BASE_REQUIRED");
yes(am19.clock_authority_split.runtime_tick_waits_for_delayed_exact_kbs_pair===false,"AMENDMENT19_NO_WAIT_PREDECESSOR_REQUIRED");
yes(am19.final_formal_lane.one_real_wall_clock_o00_o23_run_still_required===true,"AMENDMENT19_REAL_24H_PREDECESSOR_REQUIRED");
const core=gate.canonical_core_binding;
yes(core.persistence_free_engineering_must_call_core_directly===true,"AMENDMENT19_GATE_DIRECT_CORE_REQUIRED");
yes(core.persistence_free_engineering_direct_state_math_imports_forbidden===true,"AMENDMENT19_GATE_DIRECT_MATH_FORBIDDEN");
yes(core.persistence_free_engineering_simplified_runner_forbidden===true,"AMENDMENT19_GATE_SIMPLIFIED_RUNNER_FORBIDDEN");
yes(core.future_production_persistent_path_must_call_same_core_symbol===true,"AMENDMENT19_GATE_PRODUCTION_SAME_CORE_REQUIRED");
yes(core.different_semantic_core_between_engineering_and_production_forbidden===true,"AMENDMENT19_GATE_DIFFERENT_CORE_FORBIDDEN");
const persistent=gate.persistent_accelerated_equivalence;
yes(persistent.allowed_clock_difference_only===true,"AMENDMENT19_GATE_ONLY_CLOCK_DIFFERENCE_REQUIRED");
yes(persistent.accelerated_clock_role==="REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY","AMENDMENT19_GATE_CLOCK_ROLE_REQUIRED");
for(const k of ["fresh_v3_schema","exact_runtime_config_chain","persistence_repositories","scheduler","lease_and_fencing","runner","health","checkpoint","lineage","canonical_record_set_builders"])yes(persistent.must_reuse_production.includes(k),`AMENDMENT19_GATE_PRODUCTION_COMPONENT_REQUIRED:${k}`);
yes(persistent.simplified_runner_forbidden===true && persistent.in_memory_repository_substitute_for_persistent_24t_forbidden===true && persistent.production_execution_graph_replacement_by_test_harness_forbidden===true,"AMENDMENT19_GATE_PERSISTENT_SUBSTITUTE_FORBIDDEN");
const scenarios=["O00_WARM_START_REAL_CAUSAL_GFS_H1","MULTI_TICK_MODE_B_ASSUMED_DEGRADED","BOUNDARY_COMPLETE_EXACT_KBS_PAIR_SWITCHES_MODE_A","PARTIAL_EXACT_PAIR_DOES_NOT_MIX_AND_MODE_B_REMAINS_WHOLE","LATE_EXACT_AFTER_TERMINAL_DOES_NOT_CHANGE_STATE_OR_CHECKPOINT_HASH","PROCESS_RESTART_CONTINUES_FROM_CHECKPOINT","MISSED_SLOT_OLDEST_FIRST_BACKFILL","SAME_SLOT_REEXECUTION_IDEMPOTENT_NO_DUPLICATE_CANONICAL_WORK","NO_ASSUMPTION_PAIR_BLOCKS_EXPLICITLY_WITHOUT_WAIT","POST_24T_STATE_FORECAST_HEALTH_LINEAGE_READBACK_CONSISTENT"];
yes(JSON.stringify(gate.required_fault_and_semantic_scenarios)===JSON.stringify(scenarios),"AMENDMENT19_GATE_SCENARIO_MATRIX_EXACT");
const modeB=gate.mode_b_epistemic_constraints;
yes(modeB.epistemic_class_remains_assumed===true && modeB.runtime_health==="DEGRADED","AMENDMENT19_GATE_MODE_B_ASSUMED_DEGRADED_REQUIRED");
for(const k of ["fake_observation","persistence_fill","source_substitution","timestamp_relabel","retroactive_state_rewrite"])yes(modeB[k]===false,`AMENDMENT19_GATE_MODE_B_FALSE_REQUIRED:${k}`);
const keys=["PERSISTENCE_FREE_24T","PERSISTENT_24T","O00_WARM_START","MODE_A","MODE_B","PARTIAL_PAIR","LATE_EXACT_NO_REWRITE","RESTART","MISSED_SLOT_BACKFILL","IDEMPOTENCY","ZERO_PROVIDER_WAIT","SCHEMA_ENV_PREFLIGHT","FULL_CHAIN_READBACK"];
const mg=gate.formal_epoch_creation_machine_gate;
yes(JSON.stringify(Object.keys(mg.required_statuses))===JSON.stringify(keys),"AMENDMENT19_GATE_STATUS_SET_EXACT");
for(const k of keys)yes(mg.required_statuses[k]==="PASS",`AMENDMENT19_GATE_STATUS_MUST_PASS:${k}`);
yes(mg.static_blocker_count_required===0 && mg.all_required_statuses_must_be_terminal_pass===true && mg.human_override_authorized===false,"AMENDMENT19_GATE_ZERO_BLOCKER_NO_OVERRIDE_REQUIRED");
yes(mg.formal_epoch_creation_authorized_by_this_implementation_unit===false,"AMENDMENT19_GATE_EPOCH_NOT_AUTHORIZED_YET");
yes(gate.final_wall_clock_graduation_test.still_required===true && gate.final_wall_clock_graduation_test.actual_utc_boundaries===24 && gate.final_wall_clock_graduation_test.accelerated_lane_is_substitute===false,"AMENDMENT19_GATE_REAL_24H_REQUIRED");
yes(gate.final_wall_clock_graduation_test.role==="GRADUATION_TEST_NOT_DEVELOPMENT_LOOP","AMENDMENT19_GATE_GRADUATION_ROLE_REQUIRED");
for(const t of ["same production-facing canonical core","production execution graph","static_blocker_count = 0","ASSUMED","DEGRADED","GRADUATION_TEST","DEVELOPMENT_LOOP","does not authorize a Formal epoch"])has(doc.toLowerCase(),t.toLowerCase(),`AMENDMENT19_GATE_DOC_TOKEN_REQUIRED:${t}`);
for(const t of ["AMENDMENT19_GRADUATION_STATUS_NOT_PASS","AMENDMENT19_GRADUATION_STATIC_BLOCKER_COUNT_NOT_ZERO","AMENDMENT19_GRADUATION_SAME_CANONICAL_CORE_REQUIRED","AMENDMENT19_GRADUATION_ACCELERATED_GRAPH_SUBSTITUTION_FORBIDDEN","AMENDMENT19_GRADUATION_PRODUCTION_GRAPH_EQUIVALENCE_REQUIRED","AMENDMENT19_GRADUATION_HUMAN_OVERRIDE_FORBIDDEN","--selftest"])has(pre,t,`AMENDMENT19_GATE_PREFLIGHT_TOKEN_REQUIRED:${t}`);
const result={schema_version:"geox_mcft_cap09_amendment19_accelerated_graduation_gate_governance_result_v1",status:"PASS",exact_predecessor_protected_main:EXACT_BASE,required_scenario_count:scenarios.length,required_machine_gate_count:keys.length,static_blocker_count_required:0,human_override_authorized:false,persistence_free_must_use_same_canonical_core:true,persistent_lane_only_clock_difference_authorized:true,final_real_wall_clock_24h_required:true,future_formal_epoch_selected:false,formal_o00_started:false,formal_effect:false};
fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
