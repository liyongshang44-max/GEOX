#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const files = {
  amendment: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md",
  captureWorkflow: ".github/workflows/mcft-cap-09-rolling-preboundary-capture.yml",
  capturePlanner: "scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs",
  captureRunner: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  captureAssembler: "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
  intersectionWorkflow: ".github/workflows/mcft-cap-09-rolling-kbs-intersection.yml",
  selector: "scripts/runtime_acceptance/SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py",
  cadence: "scripts/runtime_acceptance/MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs",
  historicalPoller: "scripts/runtime_acceptance/POLL_MCFT_CAP_09_EA5E2_KBS_EXACT_T_AVAILABILITY.py",
  rehydration: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts",
  fiveFamily: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts",
  evidenceSource: "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts",
  observer: "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_ROLLING_OPERATIONAL_ACTIVATION_OBSERVER_V1.ts",
  activationWorkflow: ".github/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml",
  formalPreflight: "scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.ts",
  dependencyGraph: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.cjs",
  successor: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SUCCESSOR_RUNNER_QUALIFICATION_V3.cjs",
  successorWorkflow: ".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml",
};

function read(name) {
  const file = files[name];
  if (!fs.existsSync(file)) throw new Error(`EA5E2_FINAL_STATIC_FILE_REQUIRED:${name}:${file}`);
  return fs.readFileSync(file, "utf8");
}
function requireAll(text, markers, code) {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${code}:${marker}`);
}
function forbidAll(text, markers, code) {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${code}:${marker}`);
}

const amendment = read("amendment");
const captureWorkflow = read("captureWorkflow");
const capturePlanner = read("capturePlanner");
const captureRunner = read("captureRunner");
const captureAssembler = read("captureAssembler");
const intersectionWorkflow = read("intersectionWorkflow");
const selector = read("selector");
const cadence = read("cadence");
const historicalPoller = read("historicalPoller");
const rehydration = read("rehydration");
const fiveFamily = read("fiveFamily");
const evidenceSource = read("evidenceSource");
const observer = read("observer");
const activationWorkflow = read("activationWorkflow");
const formalPreflight = read("formalPreflight");
const dependencyGraph = read("dependencyGraph");
const successor = read("successor");
const successorWorkflow = read("successorWorkflow");

requireAll(amendment, [
  "kbs_raw_hourly_age <= 6h",
  "historical / online-freshness diagnostic",
  "Age alone MUST NOT invalidate",
  "PROVIDER_AVAILABILITY_WATERMARK_V1",
  "there is no fixed `T+432` normative cutoff",
  "actual hourly pre-boundary capture",
  "KBS daily batch detected",
  "intersect crop-legal T values",
  "oldest-first backfill",
], "EA5E2_FINAL_STATIC_AMENDMENT11_BOUNDARY_REQUIRED");

requireAll(captureWorkflow, [
  "cron: '5 * * * *'",
  "RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "MCFT_EA5E2_LIVE_PHASE: PRE_BOUNDARY_CAUSAL",
  "ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
  "MCFT_CAP09_ROLLING_PREBOUNDARY_EXACT_MAIN_DRIFT",
], "EA5E2_FINAL_STATIC_CAPTURE_WORKFLOW_REQUIRED");
forbidAll(captureWorkflow, [
  "RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "LATE_EXACT_HOUR",
  "configured_max_age_hours",
  "T+432",
], "EA5E2_FINAL_STATIC_CAPTURE_WORKFLOW_LEGACY_PATH_FORBIDDEN");

requireAll(capturePlanner, [
  "MIN_TARGET_LEAD_MINUTES = 35",
  "CANDIDATE_RETENTION_HOURS = 36",
  "provider_publication_dependency: \"NONE\"",
  "kbs_raw_hourly_dependency: \"NONE\"",
  "crop_authority_dependency: \"NONE\"",
  "evidence_deadline: target",
], "EA5E2_FINAL_STATIC_CAPTURE_PLANNER_REQUIRED");

requireAll(captureRunner, [
  "const ROLLING_PREBOUNDARY_INGRESS_DEADLINE_OFFSET_MINUTES = 0;",
  "MCFT_CAP09_ROLLING_PREBOUNDARY_RUNNER_PREBOUNDARY_ONLY",
  "soil_observation_inside_t_minus_15_to_t: true",
  "gfs_same_cycle_pair: true",
  "rehydration_manifest",
  "formal_database_write_count: 0",
  "formal_r2_write_count: 0",
], "EA5E2_FINAL_STATIC_CAPTURE_RUNNER_REQUIRED");
forbidAll(captureRunner, [
  "process.env.GITHUB_WORKFLOW === \"mcft-cap-09-rolling-preboundary-capture\" ? 0 : 5",
], "EA5E2_FINAL_STATIC_CAPTURE_RUNNER_WORKFLOW_NAME_SWITCH_FORBIDDEN");

requireAll(captureAssembler, [
  "producer_subject_sha_immutable: true",
  "producer_exact_main_capture_proof_required: true",
  "consumer_subject_may_differ_from_producer: true",
  "cross_version_rehydration_required_when_consumer_subject_differs: true",
  "raw_retention_reverification_required: true",
  "semantic_hash_reverification_required: true",
  "candidate_expires_at",
  "formal_database_write_count: 0",
  "scheduler_write_count: 0",
], "EA5E2_FINAL_STATIC_CAPTURE_ASSEMBLER_REQUIRED");

requireAll(intersectionWorkflow, [
  "status=success",
  "branch=main",
  "BUILD_MCFT_CAP_09_ROLLING_CROP_LEGALITY_V1.cjs",
  "SELECT_MCFT_CAP_09_ROLLING_KBS_INTERSECTION_V1.py select",
  "WAITING_FOR_DAILY_BATCH_INTERSECTION",
  "EXACT_CROP_LEGAL_INTERSECTION_READY",
], "EA5E2_FINAL_STATIC_INTERSECTION_WORKFLOW_REQUIRED");
requireAll(selector, [
  "expires <= now",
  "OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST",
  "len(provider_rows) != 1",
  "row_is_complete",
  "freshness_is_late_authoritative_admission_gate\": False",
], "EA5E2_FINAL_STATIC_SELECTOR_REQUIRED");

forbidAll(cadence, [
  "AUTHORITY_MAX_AGE_HOURS",
  "authority_pass =",
  "scheduler_may_dispatch",
  "remaining_authority_headroom",
], "EA5E2_FINAL_STATIC_CADENCE_6H_AUTHORITY_FORBIDDEN");
requireAll(cadence, [
  "HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS",
  "scheduler_dispatch_authority: false",
  "freshness_is_late_authoritative_admission_gate: false",
  "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
], "EA5E2_FINAL_STATIC_CADENCE_DIAGNOSTIC_REQUIRED");

requireAll(historicalPoller, [
  "QUALIFICATION_ATTEMPT_DISCOVERY_DEADLINE_OFFSET_MINUTES",
  "attempt_deadline_is_evidence_deadline\": False",
  "evidence_eligibility_has_fixed_t_plus_432_cutoff\": False",
  "freshness_is_late_authoritative_admission_gate\": False",
], "EA5E2_FINAL_STATIC_HISTORICAL_POLLER_ATTEMPT_BUDGET_REQUIRED");
forbidAll(historicalPoller, ["frozen evidence cutoff"], "EA5E2_FINAL_STATIC_HISTORICAL_POLLER_AUTHORITY_TERM_FORBIDDEN");

requireAll(rehydration, [
  "MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_EXPIRED",
  "ProducerBoundReadOnlyR2RetentionV1",
  "MCFT_CAP09_ROLLING_REHYDRATION_PRODUCER_PREFIX_MISMATCH",
  "MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH",
  "provider_refetch_count: 0",
  "private_r2_put_count: store.put_count",
  "private_r2_delete_count: store.delete_count",
], "EA5E2_FINAL_STATIC_REHYDRATION_REQUIRED");

requireAll(fiveFamily, [
  "MCFT_CAP09_FIVE_FAMILY_EXACT_MAIN_REQUIRED",
  "EXACT_REQUESTED_TARGET",
  "kbs_provider_retry_count: 0",
  "kbs_source_substitution_allowed: false",
  "private_transient_cleanup_confirmed",
  "formal_database_write_count: 0",
  "scheduler_write_count: 0",
], "EA5E2_FINAL_STATIC_FIVE_FAMILY_REQUIRED");

requireAll(evidenceSource, [
  "const availabilityCutoff = exactIntervalRole ? evidenceSnapshotTime : logicalTime;",
  "EA5E2_EXTERNAL_DB_CAUSAL_ORDER_INVALID",
  "EA5E2_EXTERNAL_DB_SOURCE_IDENTITY_CONFLICT",
  "EA5E2_EXTERNAL_DB_DUPLICATE_SOURCE_RECORD_ID",
  "EA5E2_EXTERNAL_DB_REQUIRED_FAMILY_MISSING",
  "BEGIN TRANSACTION READ ONLY",
], "EA5E2_FINAL_STATIC_DB_EVIDENCE_SOURCE_REQUIRED");

requireAll(observer, [
  "evidenceSnapshotTime = observerExecutionStartedAt",
  "EA5E2_ROLLING_ACTIVATION_TARGET_MUST_NOT_BE_FUTURE",
  "READ_ONLY_A0_HANDOFF_ONLY",
  "fixed_t_plus_432_cutoff_normative_authority: false",
  "fixed_t_plus_437_observer_normative_authority: false",
  "canonical_persistence_authorized !== false",
  "effectiveness_pending_evidence_freeze: true",
], "EA5E2_FINAL_STATIC_OBSERVER_REQUIRED");

requireAll(activationWorkflow, [
  "if: github.event_name == 'workflow_dispatch'",
  "EA5E2_ROLLING_SUCCESSOR_V3_EXACT_HEAD_QUALIFICATION_REQUIRED",
  "Re-prove exact target crop consensus as defense in depth",
  "Recheck current-main boundary immediately before DB-only observer",
  "effectiveness_pending_evidence_freeze:true",
  "ea5e2_operational_activation_qualified:false",
], "EA5E2_FINAL_STATIC_ACTIVATION_WORKFLOW_REQUIRED");

requireAll(formalPreflight, [
  "br-cold-dust-a6j6aymz",
  "br-falling-cake-a6lfsdak",
  "BEGIN TRANSACTION READ ONLY",
  "EA5E2_FORMAL_READINESS_SCHEDULER_MUST_REMAIN_UNSTARTED",
  "database_write_count: 0",
], "EA5E2_FINAL_STATIC_FORMAL_PREFLIGHT_REQUIRED");

for (const captureExecutable of [
  "scripts/runtime_acceptance/PLAN_MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.cjs",
  "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
]) {
  if (!dependencyGraph.includes(captureExecutable)) throw new Error(`EA5E2_FINAL_STATIC_DEP_GRAPH_CAPTURE_EXECUTABLE_REQUIRED:${captureExecutable}`);
  if (!successor.includes(captureExecutable)) throw new Error(`EA5E2_FINAL_STATIC_SUCCESSOR_CRITICAL_CAPTURE_EXECUTABLE_REQUIRED:${captureExecutable}`);
}
requireAll(successorWorkflow, [
  "RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts",
  "ACCEPTANCE_MCFT_CAP_09_EA5E2_ROLLING_FINAL_STATIC_AUDIT.cjs",
], "EA5E2_FINAL_STATIC_SUCCESSOR_WORKFLOW_GATE_REQUIRED");

const proof = {
  schema_version: "geox_mcft_cap09_ea5e2_rolling_final_static_audit_v1",
  status: "PASS",
  audited_surface_count: Object.keys(files).length,
  final_activation_orchestration: "ROLLING_PREBOUNDARY_BATCH_INTERSECTION",
  provider_temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  six_hour_freshness_late_admission_authority: false,
  fixed_t_plus_432_normative_authority: false,
  rolling_preboundary_deadline: "T",
  rolling_capture_executor_dependency_bound: true,
  rolling_capture_executor_exact_head_bound: true,
  candidate_expiry_rechecked_at_consumption: true,
  producer_raw_and_semantic_reverification_required: true,
  exact_kbs_target_reproved_at_consumption: true,
  crop_consensus_reproved_before_observer: true,
  formal_a0_access_read_only: true,
  scheduler_must_remain_unstarted: true,
  operational_activation_effectiveness_still_requires_evidence_freeze: true,
  provider_request_count: 0,
  database_read_count: 0,
  database_write_count: 0,
  authority_effect: false,
};
console.log(JSON.stringify(proof));
