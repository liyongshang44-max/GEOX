#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");

const subject = process.env.MCFT_EA5E2_SUBJECT_SHA || process.env.GITHUB_SHA;
if (!/^[0-9a-f]{40}$/.test(String(subject || ""))) throw new Error("EA5E2_ROLLING_ACTIVATION_EXACT_SUBJECT_SHA_REQUIRED");

const critical = [
  ".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml",
  ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
  ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml",
  ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml",
  "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ROLLING_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4_BINDING.cjs",
  "scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs",
  "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
  "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs",
  "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTED-A0-AUTHORITY-V1.json",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts",
].sort();

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }

git("merge-base", "--is-ancestor", subject, "origin/main");
for (const file of critical) {
  const exact = git("rev-parse", `${subject}:${file}`);
  const current = git("rev-parse", `origin/main:${file}`);
  if (exact !== current) throw new Error(`EA5E2_ROLLING_ACTIVATION_SUBJECT_SUPERSEDED:${file}`);
}
console.log(JSON.stringify({
  status: "PASS",
  subject_sha: subject,
  current_main_sha: git("rev-parse", "origin/main"),
  critical_file_count: critical.length,
  final_activation_orchestration: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
  future_t_long_wait_activation_authority: false,
  fixed_t_plus_432_normative_authority: false,
  six_hour_freshness_late_admission_authority: false,
}));