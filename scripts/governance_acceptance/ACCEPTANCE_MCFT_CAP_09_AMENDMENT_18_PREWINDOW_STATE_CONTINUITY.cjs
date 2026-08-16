#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (m) => { throw new Error(m); };
const eq = (a,e,c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const git = (...a) => execFileSync("git", a, { encoding:"utf8" }).trim();
const blob = (ref,p) => git("rev-parse", `${ref}:${p}`);

const base = process.env.MCFT_BASE_SHA;
eq(base,"e36a5bee68a15cd55cff8885f7e191a11109a612","AMENDMENT18_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-18-PREWINDOW-STATE-CONTINUITY-AND-FORMAL-STORE-REBASE-AUTHORITY.md";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_18_PREWINDOW_STATE_CONTINUITY.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-18-prewindow-state-continuity.yml";
const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([amendmentPath,gatePath,workflowPath].sort()),"AMENDMENT18_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json":"04665265dc00e8d325b40e4f6414abed565beafa",
  "docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md":"c6884b8057f7741539b15fe7e3d99a0908b65f59",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md":"a037b24757992987fc24ce8b6afac6c8eabca3ed",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md":"f9d664a0f58c6024f3090edbd5aee26d8d1b680a",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json":"9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-FORMAL-WINDOW-INPUT-MANIFEST-V2.json":"eda053531b2f9164466d41f19ada2a25fc3dd04a",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_persistent_tick_service_v1.ts":"d0d91e0b1f0392efe544824429461494fc9c45a7"
};
for (const [p,s] of Object.entries(predecessorPins)) {
  eq(blob(base,p),s,`AMENDMENT18_BASE_BLOB_PIN_MISMATCH:${p}`);
  eq(blob("HEAD",p),s,`AMENDMENT18_PREDECESSOR_MUTATED:${p}`);
}
eq(blob("HEAD",amendmentPath),"bc9627dc4159dcb753e4f0cb1f05d4507962d510","AMENDMENT18_CANDIDATE_BLOB_MISMATCH");

const restart = fs.readFileSync("docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md","utf8");
for (const marker of [
  "checkpoint.next_tick_logical_time",
  "terminal tick.logical_time + PT1H",
  "starting from persisted checkpoint.next_tick_logical_time",
  "contiguous only",
  "skip an hour"
]) if (!restart.includes(marker)) fail(`AMENDMENT18_RESTART_CONTRACT_MARKER_MISSING:${marker}`);

const bootstrap = JSON.parse(fs.readFileSync("docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json","utf8"));
eq(bootstrap.canonical_initial_uniqueness.projection_absence_allows_second_initial,false,"AMENDMENT18_SECOND_INITIAL_MUST_REMAIN_FORBIDDEN");
eq(bootstrap.initial_lineage_activation.expected_previous_active_lineage,null,"AMENDMENT18_INITIAL_LINEAGE_NULL_PREDECESSOR_REQUIRED");

const a06 = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md","utf8");
for (const marker of [
  "does **not** need an effective logical time exactly one hour before the rebased O00",
  "no new A0 canonical state, lineage, checkpoint, forecast, health, or bootstrap record is created by the epoch rebase",
  "initial multi-slot catch-up",
  "actual UTC O00–O23"
]) if (!a06.includes(marker)) fail(`AMENDMENT18_AMENDMENT06_MARKER_MISSING:${marker}`);

const a17 = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-17-T3R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md","utf8");
for (const marker of [
  "A T3R1 runtime activation requires a fresh bootstrap.",
  "zero-state Formal database",
  "Cross-scope canonical stitching is forbidden."
]) if (!a17.includes(marker)) fail(`AMENDMENT18_AMENDMENT17_MARKER_MISSING:${marker}`);

const service = fs.readFileSync("apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_persistent_tick_service_v1.ts","utf8");
if (!service.includes("EXTERNAL_FORMAL_V3_AM11_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK")) fail("AMENDMENT18_RUNTIME_NEXT_TICK_FAIL_CLOSED_REQUIRED");

const amendment = fs.readFileSync(amendmentPath,"utf8");
for (const marker of [
  "PREWINDOW_A0 = O00 - PT1H = 2026-08-17T19:00:00.000Z",
  "persisted checkpoint next tick   = 2026-08-15T11:00:00.000Z",
  "selected O00                     = 2026-08-17T20:00:00.000Z",
  "superseded as the canonical store for the selected O00–O23 Formal run",
  "new zero-state Formal canonical store",
  "O00 then remains an ordinary exact-PT1H continuation tick",
  "A0 checkpoint next tick         = 2026-08-17T20:00:00.000Z",
  "O00 parent ref/hash equals the new pre-window A0 Runtime Config ref/hash",
  "O00–O23 crop-context hashes equal the already effective successor epoch-selection hashes slot-for-slot",
  "post-bootstrap cutover gate",
  "57-hour pre-window scheduler/backfill execution",
  "A18A  zero-state Formal store identity + schema preflight",
  "EA5E3 remains NOT AUTHORIZED",
  "Formal execution remains 0/24"
]) if (!amendment.includes(marker)) fail(`AMENDMENT18_AUTHORITY_MARKER_MISSING:${marker}`);

for (const forbidden of [
  "checkpoint pointer rewriting is authorized",
  "second INITIAL lineage inside the populated database is authorized",
  "retroactive O00 is authorized",
  "57-hour backfill is authorized",
  "T+432 becomes authority",
  "FreshHour becomes authority"
]) if (amendment.includes(forbidden)) fail(`AMENDMENT18_FORBIDDEN_TEXT:${forbidden}`);

const out = {
  schema_version:"geox_mcft_cap09_amendment18_governance_result_v1",
  status:"PASS",
  base_main_sha:base,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  predecessor_blobs_verified_unchanged:true,
  canonical_pt1h_continuity_preserved:true,
  second_initial_in_populated_store_forbidden:true,
  historical_t3r1_store_preserved:true,
  historical_a0_formal_o00_predecessor_eligible:false,
  replacement_zero_state_formal_store_required:true,
  prewindow_a0_logical_time:"2026-08-17T19:00:00.000Z",
  selected_o00:"2026-08-17T20:00:00.000Z",
  selected_o23:"2026-08-18T19:00:00.000Z",
  ea5e3_authorized:false,
  formal_o00_started:false,
  formal_execution_count:"0/24",
  mcft_cap09_completed:false
};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_AMENDMENT18_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
