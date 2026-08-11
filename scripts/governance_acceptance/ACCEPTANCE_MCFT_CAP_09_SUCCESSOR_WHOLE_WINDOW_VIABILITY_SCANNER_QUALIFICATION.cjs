#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),cp=require("node:child_process");
const BASE="6ae90765b1ec90f96d9f07895d4570bfa53382e0";
const files=[
".github/workflows/mcft-cap-09-successor-whole-window-viability-scanner-qualification.yml",
"apps/server/src/domain/twin_runtime/external_formal_successor_whole_window_viability_v1.ts",
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SUCCESSOR-WHOLE-WINDOW-VIABILITY-SCANNER-QUALIFICATION-V1.json",
"scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WHOLE_WINDOW_VIABILITY_SCANNER_QUALIFICATION.cjs",
"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WHOLE_WINDOW_VIABILITY.ts"
].sort();
const gateFile="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_SUCCESSOR_WHOLE_WINDOW_VIABILITY_SCANNER_QUALIFICATION.cjs";
const git=(...a)=>cp.execFileSync("git",a,{encoding:"utf8"}).trim();
const eq=(a,b,c)=>{if(a!==b)throw new Error(`${c}: expected=${b} actual=${a}`)};
const base=process.env.MCFT_BASE_SHA;eq(base,BASE,"SUCCESSOR_SCANNER_EXACT_BASE_REQUIRED");
const changed=git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();eq(JSON.stringify(changed),JSON.stringify(files),"SUCCESSOR_SCANNER_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");
const pins={
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json":"b5de9d29189cb654444b3f57d00df290eefe16d3",
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md":"ef1e4344e5915e2c591cf7cfc9b6c2bf27f8bc3b",
"apps/server/src/runtime/twin_runtime/external_formal_v3_persistent_tick_service_v1.ts":""
};
for(const [f,sha] of Object.entries(pins)){const actual=git("rev-parse",`${base}:${f}`);if(sha)eq(actual,sha,`SUCCESSOR_SCANNER_PREDECESSOR_PIN:${f}`);eq(git("rev-parse",`HEAD:${f}`),actual,`SUCCESSOR_SCANNER_PREDECESSOR_MUTATED:${f}`)}
const a=JSON.parse(fs.readFileSync(files[2],"utf8"));eq(a.base_protected_main_sha,BASE,"SUCCESSOR_SCANNER_AUTHORITY_BASE_REQUIRED");eq(a.independent_expected_result.latest_complete_current_season_o00,"2026-08-11T22:00:00.000Z","SUCCESSOR_SCANNER_LATEST_O00_REQUIRED");eq(a.independent_expected_result.latest_complete_current_season_o23,"2026-08-12T21:00:00.000Z","SUCCESSOR_SCANNER_LATEST_O23_REQUIRED");eq(a.independent_expected_result.latest_possible_successor_epoch_selection_effectiveness_time,"2026-08-10T10:00:00.000Z","SUCCESSOR_SCANNER_LATEST_SELECTION_TIME_REQUIRED");eq(a.independent_expected_result.result,"NO_CURRENT_SEASON_SUCCESSOR_EPOCH","SUCCESSOR_SCANNER_FAIL_CLOSED_RESULT_REQUIRED");
for(const k of ["operational_activation_qualified","successor_epoch_selected","new_crop_or_season_authority_created","runtime_config_persistence_authorized","formal_database_write_authorized","r2_write_authorized","scheduler_write_authorized","canonical_runtime_write_authorized","ea5e3_authorized","formal_window_started"]){eq(a.authority_effect[k],false,`SUCCESSOR_SCANNER_NONCLAIM_REQUIRED:${k}`)}
// Scan only candidate capability surfaces. The governance gate is intentionally excluded so deny-list literals cannot self-match.
const capabilityFiles=files.filter(f=>f!==gateFile);
const capabilityText=capabilityFiles.map(f=>fs.readFileSync(f,"utf8")).join("\n");
for(const marker of ["GEOX_MCFT_CAP09_S6_DATABASE_URL","INSERT INTO facts","UPDATE facts","DELETE FROM facts","workflow_dispatch:","aws s3","curl ","fetch("]){if(capabilityText.includes(marker))throw new Error(`SUCCESSOR_SCANNER_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${marker}`)}
const out={schema_version:"geox_mcft_cap09_successor_whole_window_viability_scanner_gate_result_v1",status:"PASS",subject_sha:git("rev-parse","HEAD"),base_sha:base,changed_files:changed,expected_result:"NO_CURRENT_SEASON_SUCCESSOR_EPOCH",database_write_count:0,r2_write_count:0,scheduler_write_count:0,canonical_runtime_write_count:0,successor_epoch_selected:false,ea5e3_authorized:false,formal_window_started:false};fs.mkdirSync("acceptance-output",{recursive:true});fs.writeFileSync("acceptance-output/MCFT_CAP_09_SUCCESSOR_WHOLE_WINDOW_VIABILITY_SCANNER_QUALIFICATION_RESULT.json",JSON.stringify(out,null,2)+"\n");console.log(JSON.stringify(out));
