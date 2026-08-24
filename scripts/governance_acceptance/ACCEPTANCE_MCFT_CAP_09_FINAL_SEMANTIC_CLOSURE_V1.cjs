#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const must = (ok, code) => { if (!ok) throw new Error(code); };
const contains = (p, token, code) => must(read(p).includes(token), code);
const excludes = (p, token, code) => must(!read(p).includes(token), code);

const paths = {
  a0: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_FORMAL_A0_BOOTSTRAP_V1.ts",
  manifest: "scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_arm_v1.ts",
  readback: "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_AMENDMENT_19_FORMAL_FINAL_V1.ts",
  successor: "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_AMENDMENT_19_PERSISTENT_24T_SUCCESSOR.ts",
  qualification: ".github/workflows/mcft-cap-09-t4r1-amendment19-persistent-24t-qualification.yml",
  provision: ".github/workflows/mcft-cap-09-t4r1-formal-store-provision.yml",
  storeAuthority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V1.json",
  rollingScheduler: ".github/workflows/mcft-cap-09-t4r1-rolling-hourly-scheduler.yml",
  rollingCapture: ".github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml",
  hourly: ".github/workflows/mcft-cap-09-amendment19-formal-hourly-evidence.yml",
  live: ".github/workflows/mcft-cap-09-amendment19-formal-live-runner.yml",
  arm: ".github/workflows/mcft-cap-09-amendment19-formal-arm.yml",
  a0Workflow: ".github/workflows/mcft-cap-09-amendment19-formal-a0-bootstrap.yml",
  finalWorkflow: ".github/workflows/mcft-cap-09-amendment19-formal-final-readback.yml",
  downstreamZero: "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_AMENDMENT_19_FORMAL_DOWNSTREAM_ZERO_V1.ts",
  completion: "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_COMPLETION_V1.cjs",
};

for (const p of Object.values(paths)) must(fs.existsSync(path.join(ROOT, p)), `MCFT_CAP09_FINAL_CLOSURE_PATH_REQUIRED:${p}`);

contains(paths.a0, "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json", "MCFT_CAP09_FINAL_CLOSURE_A0_V3_AUTHORITY_REQUIRED");
excludes(paths.a0, "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json", "MCFT_CAP09_FINAL_CLOSURE_A0_V2_AUTHORITY_FORBIDDEN");

contains(paths.successor, 'MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v11"', "MCFT_CAP09_FINAL_CLOSURE_V11_QUAL_REQUIRED");
contains(paths.successor, 'PREVIOUS_MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v10"', "MCFT_CAP09_FINAL_CLOSURE_V10_PREDECESSOR_REQUIRED");
contains(paths.provision, "geox_mcft_cap09_s6_accel24t_am19_v11", "MCFT_CAP09_FINAL_CLOSURE_V11_PROVISION_REQUIRED");
contains(paths.provision, "geox_mcft_cap09_s6_accel24t_am19_blocked_v11", "MCFT_CAP09_FINAL_CLOSURE_BLOCKED_V11_PROVISION_REQUIRED");

contains(paths.storeAuthority, '"database_name": "geox_mcft_cap09_s6_formal_t4r1_24h_v3"', "MCFT_CAP09_FINAL_CLOSURE_FORMAL_V3_AUTHORITY_REQUIRED");
contains(paths.storeAuthority, '"failed_predecessor_database": "geox_mcft_cap09_s6_formal_t4r1_24h_v2"', "MCFT_CAP09_FINAL_CLOSURE_FORMAL_V2_PREDECESSOR_REQUIRED");
contains(paths.manifest, 'MCFT_CAP09_AM19_FORMAL_DATABASE_V3 = "geox_mcft_cap09_s6_formal_t4r1_24h_v3"', "MCFT_CAP09_FINAL_CLOSURE_MANIFEST_FORMAL_V3_REQUIRED");
contains(paths.manifest, 'MCFT_CAP09_AM19_FAILED_FORMAL_DATABASE_V2 = "geox_mcft_cap09_s6_formal_t4r1_24h_v2"', "MCFT_CAP09_FINAL_CLOSURE_MANIFEST_FAILED_V2_REQUIRED");

const activeFormalPaths = [paths.arm, paths.a0Workflow, paths.hourly, paths.live, paths.finalWorkflow, paths.readback, paths.downstreamZero, paths.completion];
for (const p of activeFormalPaths) excludes(p, "geox_mcft_cap09_s6_formal_t4r1_24h_v2", `MCFT_CAP09_FINAL_CLOSURE_ACTIVE_FORMAL_V2_FORBIDDEN:${p}`);

contains(paths.rollingScheduler, "cron: '17 * * * *'", "MCFT_CAP09_FINAL_CLOSURE_HOURLY_ROLLING_SCHEDULE_REQUIRED");
contains(paths.rollingScheduler, "mcft-cap-09-t4r1-rolling-preboundary-capture.yml", "MCFT_CAP09_FINAL_CLOSURE_HOURLY_ROLLING_DISPATCH_REQUIRED");
contains(paths.rollingCapture, "gh workflow run mcft-cap-09-amendment19-formal-hourly-evidence.yml", "MCFT_CAP09_FINAL_CLOSURE_EXPLICIT_HOURLY_DISPATCH_REQUIRED");
contains(paths.rollingCapture, 'rolling_run_id="$GITHUB_RUN_ID"', "MCFT_CAP09_FINAL_CLOSURE_ROLLING_RUN_ID_FORWARD_REQUIRED");
contains(paths.hourly, "workflow_dispatch:", "MCFT_CAP09_FINAL_CLOSURE_HOURLY_WORKFLOW_DISPATCH_REQUIRED");
contains(paths.hourly, "rolling_run_id:", "MCFT_CAP09_FINAL_CLOSURE_HOURLY_ROLLING_INPUT_REQUIRED");
contains(paths.hourly, "MCFT_CAP09_T4R1_ROLLING_RUN_IDENTITY_REQUIRED", "MCFT_CAP09_FINAL_CLOSURE_ROLLING_IDENTITY_GATE_REQUIRED");
excludes(paths.hourly, "workflow_run:", "MCFT_CAP09_FINAL_CLOSURE_IMPLICIT_WORKFLOW_RUN_FORBIDDEN");
contains(paths.live, "*/5 * * * *", "MCFT_CAP09_FINAL_CLOSURE_LIVE_SUPERVISOR_SCHEDULE_REQUIRED");

contains(paths.readback, "EXACT_PROVIDER_INTERVAL_PAIR", "MCFT_CAP09_FINAL_CLOSURE_INTERVAL_PROVIDER_ENUM_REQUIRED");
contains(paths.readback, "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR", "MCFT_CAP09_FINAL_CLOSURE_ASSUMPTION_ENUM_REQUIRED");
excludes(paths.readback, '"EXACT_PROVIDER_PAIR"', "MCFT_CAP09_FINAL_CLOSURE_OLD_PROVIDER_ENUM_FORBIDDEN");
contains(paths.readback, "required_base_snapshot_count: 24", "MCFT_CAP09_FINAL_CLOSURE_24_BASES_REQUIRED");
contains(paths.readback, "required_hourly_promotions_after_a0: 23", "MCFT_CAP09_FINAL_CLOSURE_23_PROMOTIONS_REQUIRED");
contains(paths.readback, "required_terminal_ticks: 24", "MCFT_CAP09_FINAL_CLOSURE_24_TICKS_REQUIRED");

contains(paths.qualification, "fresh v11 persistent 13 of 13", "MCFT_CAP09_FINAL_CLOSURE_WORKFLOW_V11_LABEL_REQUIRED");
contains(paths.qualification, "geox_mcft_cap09_s6_accel24t_am19_v11", "MCFT_CAP09_FINAL_CLOSURE_WORKFLOW_V11_DB_REQUIRED");
excludes(paths.qualification, "p.main_database_name!=='geox_mcft_cap09_s6_accel24t_am19_v10'", "MCFT_CAP09_FINAL_CLOSURE_WORKFLOW_CURRENT_V10_FORBIDDEN");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_final_semantic_closure_acceptance_v1",
  status: "PASS",
  a0_crop_authority: "T4R1_V3",
  qualification_generation: "v11",
  qualification_predecessor: "v10",
  actual_formal_generation: "v3",
  failed_formal_predecessor: "v2",
  hourly_rolling_automated: true,
  hourly_evidence_consumes_t4_rolling: true,
  hourly_evidence_trigger_mode: "EXPLICIT_WORKFLOW_DISPATCH_WITH_ROLLING_RUN_IDENTITY_GATE",
  live_runner_autonomous_schedule: true,
  final_readback_forcing_modes: ["EXACT_PROVIDER_INTERVAL_PAIR", "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR"],
  final_readback_counts: { base_snapshots: 24, hourly_promotions_after_a0: 23, terminal_ticks: 24 },
}));
