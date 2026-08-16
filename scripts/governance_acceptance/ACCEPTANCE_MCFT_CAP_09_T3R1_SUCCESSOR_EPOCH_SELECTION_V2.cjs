#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");

const BASE = "53cf1e48b7e105477e64c8b1e69afbb53e78be00";
const AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json";
const WORKFLOW = ".github/workflows/mcft-cap-09-t3r1-successor-epoch-selection-v2.yml";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_EPOCH_SELECTION_V2.cjs";
const OUTPUT = "acceptance-output/MCFT_CAP_09_T3R1_SUCCESSOR_EPOCH_SELECTION_V2_GATE_RESULT.json";
const git = (...args) => cp.execFileSync("git", args, { encoding: "utf8" }).trim();
const eq = (a,b,c) => { if (a !== b) throw new Error(`${c}: expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`); };
const yes = (v,c) => eq(v,true,c);
const no = (v,c) => eq(v,false,c);
const blob = (ref,file) => git("rev-parse", `${ref}:${file}`);

function main() {
  const base = process.env.MCFT_BASE_SHA;
  eq(base, BASE, "T3R1_SELECTION_EXACT_BASE_REQUIRED");
  const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify([AUTHORITY,WORKFLOW,GATE].sort()), "T3R1_SELECTION_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const pins = {
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-V1.json":"8b790d37dc0b9f253d168f58e8b0dac28dedc3f7",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json":"757e4b9f4fdcd631eea97fca85614a1b61ef0c4a",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-WHOLE-WINDOW-SCAN-V2.json":"33237cda6e71e5457c8af92dc852e9b84f42c353",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-T3R1-FRESH-BOOTSTRAP-EFFECTIVENESS-V1.json":"15ca30e69e18f9f41c7000d6bc1395deebac7211",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md":"a037b24757992987fc24ce8b6afac6c8eabca3ed"
  };
  for (const [file,sha] of Object.entries(pins)) {
    eq(blob(base,file),sha,`T3R1_SELECTION_BASE_PIN:${file}`);
    eq(blob("HEAD",file),sha,`T3R1_SELECTION_PREDECESSOR_MUTATED:${file}`);
  }

  const a = JSON.parse(fs.readFileSync(AUTHORITY,"utf8"));
  eq(a.schema_version,"geox_mcft_cap09_t3r1_successor_epoch_selection_authority_v2","T3R1_SELECTION_SCHEMA_REQUIRED");
  eq(a.base_protected_main_sha,BASE,"T3R1_SELECTION_BASE_BINDING_REQUIRED");
  eq(a.whole_window_scan_effectiveness.pr_number,3189,"T3R1_SELECTION_SCAN_PR_REQUIRED");
  eq(a.whole_window_scan_effectiveness.merge_commit_sha,BASE,"T3R1_SELECTION_SCAN_MERGE_REQUIRED");
  eq(a.whole_window_scan_effectiveness.merged_at_utc,"2026-08-16T07:23:27.000Z","T3R1_SELECTION_SCAN_TIME_REQUIRED");
  eq(a.whole_window_scan_effectiveness.focused_workflow_run_id,31933393595,"T3R1_SELECTION_SCAN_RUN_REQUIRED");
  eq(a.whole_window_scan_effectiveness.focused_artifact_id,9259939190,"T3R1_SELECTION_SCAN_ARTIFACT_REQUIRED");
  eq(a.whole_window_scan_effectiveness.focused_artifact_digest,"sha256:fea96c41d4690e1ddffbcdd1855642a3f31a6426743aa0cf6b260ac5d0d59014","T3R1_SELECTION_SCAN_DIGEST_REQUIRED");
  yes(a.whole_window_scan_effectiveness.current_season_successor_window_exists,"T3R1_SELECTION_CURRENT_SEASON_WINDOW_REQUIRED");

  const s = a.selection_rule;
  eq(s.minimum_lead_hours,36,"T3R1_SELECTION_36H_REQUIRED");
  eq(s.selected_o00,"2026-08-17T20:00:00.000Z","T3R1_SELECTION_O00_REQUIRED");
  eq(s.selected_o23,"2026-08-18T19:00:00.000Z","T3R1_SELECTION_O23_REQUIRED");
  eq(s.selection_effectiveness_deadline,"2026-08-16T08:00:00.000Z","T3R1_SELECTION_EFFECTIVE_DEADLINE_REQUIRED");
  eq(s.ea5e3_readiness_deadline,"2026-08-17T08:00:00.000Z","T3R1_SELECTION_EA5E3_DEADLINE_REQUIRED");
  eq(s.selected_epoch_id,"mcft_cap09_external_formal_window_epoch_20260817t200000z_v2","T3R1_SELECTION_EPOCH_ID_REQUIRED");
  yes(s.selected_from_scan_earliest_legal_candidate,"T3R1_SELECTION_EARLIEST_POLICY_REQUIRED");
  if (Date.now() >= Date.parse(s.selection_effectiveness_deadline)) throw new Error("T3R1_SELECTION_EFFECTIVENESS_DEADLINE_EXPIRED");

  const anchor = a.existing_a0_parent_anchor;
  eq(anchor.logical_time,"2026-08-15T10:00:00.000Z","T3R1_SELECTION_A0_TIME_REQUIRED");
  eq(anchor.runtime_config_ref,"external_formal_runtime_config_49959a28cfc9eb357bf18f9d","T3R1_SELECTION_A0_REF_REQUIRED");
  eq(anchor.runtime_config_hash,"sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48","T3R1_SELECTION_A0_HASH_REQUIRED");
  yes(anchor.remains_current_prewindow_state_authority,"T3R1_SELECTION_A0_AUTHORITY_REQUIRED");

  const crop = a.crop_context_derivation;
  eq(crop.site_id,"KBS_MCSE_T3R1","T3R1_SELECTION_SITE_REQUIRED");
  eq(crop.hybrid_product_code,"P0306Q","T3R1_SELECTION_HYBRID_REQUIRED");
  eq(crop.backward_stability_hours,6,"T3R1_SELECTION_BACKWARD_REQUIRED");
  eq(crop.forward_transition_guard_hours,30,"T3R1_SELECTION_FORWARD_REQUIRED");
  yes(crop.all_24_slots_conservative_consensus,"T3R1_SELECTION_24_CONSENSUS_REQUIRED");
  eq(crop.all_24_slots_stage_code,"MID","T3R1_SELECTION_ALL_MID_REQUIRED");
  eq(crop.minimum_forward_guard_clearance_hours_across_window,75,"T3R1_SELECTION_CLEARANCE_REQUIRED");
  no(crop.future_observations_used,"T3R1_SELECTION_FUTURE_OBS_FORBIDDEN");

  if (!Array.isArray(a.slot_contexts) || a.slot_contexts.length !== 24) throw new Error("T3R1_SELECTION_EXACT_24_SLOT_CONTEXTS_REQUIRED");
  const hashes = new Set();
  for (let i=0;i<24;i+=1) {
    const item = a.slot_contexts[i];
    const expectedTime = new Date(Date.parse(s.selected_o00)+i*3600000).toISOString();
    eq(item.slot_id,`O${String(i).padStart(2,"0")}`,`T3R1_SELECTION_SLOT_ID:${i}`);
    eq(item.logical_time,expectedTime,`T3R1_SELECTION_SLOT_TIME:${i}`);
    eq(item.crop_stage_code,"MID",`T3R1_SELECTION_SLOT_STAGE:${i}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(item.crop_stage_context_hash)) throw new Error(`T3R1_SELECTION_SLOT_HASH_INVALID:${i}`);
    eq(item.minimum_hours_to_next_stage_after_forward_guard,98-i,`T3R1_SELECTION_SLOT_CLEARANCE:${i}`);
    hashes.add(item.crop_stage_context_hash);
  }
  eq(hashes.size,24,"T3R1_SELECTION_DISTINCT_CONTEXT_HASHES_REQUIRED");

  for (const [key,value] of Object.entries(a.selection_side_effect_boundary)) eq(value,0,`T3R1_SELECTION_ZERO_SIDE_EFFECT:${key}`);
  const effect = a.effect_if_exact_head_proof_passes_and_candidate_merges_before_selection_deadline;
  yes(effect.successor_epoch_selection_effective,"T3R1_SELECTION_EFFECT_REQUIRED");
  yes(effect.ea5e2_operational_activation_qualified,"T3R1_SELECTION_ACTIVATION_RETAINED_REQUIRED");
  yes(effect.successor_runtime_config_builder_qualification_authorized,"T3R1_SELECTION_BUILDER_AUTH_REQUIRED");
  no(effect.successor_runtime_config_persistence_authorized,"T3R1_SELECTION_PERSISTENCE_PREMATURE");
  no(effect.ea5e3_authorized,"T3R1_SELECTION_EA5E3_PREMATURE");
  no(effect.formal_o00_start_authorized,"T3R1_SELECTION_O00_PREMATURE");
  no(effect.formal_window_started,"T3R1_SELECTION_WINDOW_PREMATURE");
  eq(effect.formal_execution_count,"0/24","T3R1_SELECTION_ZERO_OF_24_REQUIRED");
  no(effect.mcft_cap09_completed,"T3R1_SELECTION_COMPLETION_PREMATURE");
  eq(a.next_legal_successor_if_effective,"S6-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-V2","T3R1_SELECTION_NEXT_FRONTIER_REQUIRED");

  const workflow = fs.readFileSync(WORKFLOW,"utf8");
  if (workflow.includes("workflow_dispatch:")) throw new Error("T3R1_SELECTION_MANUAL_DISPATCH_FORBIDDEN");
  if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) throw new Error("T3R1_SELECTION_DATABASE_WRITE_SQL_FORBIDDEN");
  for (const marker of ["BEGIN TRANSACTION READ ONLY","T3R1_SELECTION_EFFECTIVENESS_DEADLINE_EXPIRED","31933393595","9259939190","2026-08-17T20:00:00.000Z","2026-08-17T08:00:00.000Z"]) {
    if (!workflow.includes(marker)) throw new Error(`T3R1_SELECTION_WORKFLOW_MARKER_REQUIRED:${marker}`);
  }

  const out = {
    schema_version:"geox_mcft_cap09_t3r1_successor_epoch_selection_gate_result_v2",
    status:"PASS",
    base_sha:base,
    subject_sha:git("rev-parse","HEAD"),
    selected_epoch_id:s.selected_epoch_id,
    selected_o00:s.selected_o00,
    selected_o23:s.selected_o23,
    selection_effectiveness_deadline:s.selection_effectiveness_deadline,
    ea5e3_readiness_deadline:s.ea5e3_readiness_deadline,
    slot_context_count:24,
    minimum_forward_guard_clearance_hours:75,
    successor_epoch_selection_effective_after_timely_merge:true,
    runtime_config_write_count:0,
    scheduler_write_count:0,
    ea5e3_authorized:false,
    formal_window_started:false,
    formal_execution_count:"0/24",
    mcft_cap09_completed:false
  };
  fs.mkdirSync("acceptance-output",{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(out,null,2)+"\n");
  console.log(JSON.stringify(out));
}
main();
