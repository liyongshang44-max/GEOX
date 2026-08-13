#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");

const subject = process.env.MCFT_EA5E2_SUBJECT_SHA || process.env.GITHUB_SHA;
if (!/^[0-9a-f]{40}$/.test(String(subject || ""))) throw new Error("EA5E2_ACTIVATION_EXACT_SUBJECT_SHA_REQUIRED");
const critical = [
  ".github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml",
  ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
  "scripts/runtime_acceptance/ASSERT_MCFT_CAP_09_EA5E2_ACTIVATION_BOUNDARY_CURRENT_MAIN.cjs",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_LIVE_WINDOW_VIABILITY.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_TIMING_BUDGET_EVIDENCE_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs",
  "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_OBSERVER.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py",
  "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py",
  "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_TARGET_CROP_CONSENSUS.cjs",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts",
  "apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.ts",
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION.cjs",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SUCCESSOR-RUNNER-QUALIFICATION-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-TIMING-BUDGET-QUALIFICATION-V1.json",
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "apps/server/src/domain/twin_runtime/canonical_identity_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.ts",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts",
  "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/fixed_lag_scheduler_adapter_v1.ts",
  "apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts",
  "apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts",
];

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
git("merge-base", "--is-ancestor", subject, "origin/main");
for (const file of critical) {
  const exact = git("rev-parse", `${subject}:${file}`);
  const current = git("rev-parse", `origin/main:${file}`);
  if (exact !== current) throw new Error(`EA5E2_ACTIVATION_SUBJECT_SUPERSEDED:${file}`);
}
console.log(JSON.stringify({ status: "PASS", subject_sha: subject, current_main_sha: git("rev-parse", "origin/main"), critical_file_count: critical.length }));
