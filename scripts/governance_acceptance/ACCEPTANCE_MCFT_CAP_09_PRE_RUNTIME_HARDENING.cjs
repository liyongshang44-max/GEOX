const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-RUNTIME-HARDENING-AUTHORITY-V1.json';
const A18D = 'scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_V2.ts';
const COLLECTOR = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_COLLECTOR_V2.ts';
const RUNNER = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_A18C_FORMAL_V3_PRODUCTION_RUNNER_V1.ts';
const MANIFEST = 'scripts/runtime_acceptance/mcft_cap09_a18c_formal_live_manifest_v1.ts';
const WORKFLOW = '.github/workflows/mcft-cap-09-pre-runtime-hardening.yml';
const OUT = 'acceptance-output/MCFT_CAP_09_PRE_RUNTIME_HARDENING_GOVERNANCE.json';

function read(p) { return fs.readFileSync(path.resolve(ROOT, p), 'utf8'); }
function requireText(text, token, code) { if (!text.includes(token)) throw new Error(code); }
function forbidText(text, token, code) { if (text.includes(token)) throw new Error(code); }

const authority = JSON.parse(read(AUTH));
if (authority.schema_version !== 'geox_mcft_cap09_pre_runtime_hardening_authority_v1') throw new Error('HARDENING_AUTHORITY_SCHEMA_REQUIRED');
if (authority.exact_predecessor_protected_main !== '60db8e957df91c7bcf84190354b7cc68fab36992') throw new Error('HARDENING_EXACT_PREDECESSOR_REQUIRED');
if (authority.selected_epoch?.epoch_id !== 'mcft_cap09_external_formal_window_epoch_20260817t200000z_v2') throw new Error('HARDENING_SELECTED_EPOCH_REQUIRED');
if (authority.selected_epoch?.prewindow_a0 !== '2026-08-17T19:00:00.000Z' || authority.selected_epoch?.o00 !== '2026-08-17T20:00:00.000Z' || authority.selected_epoch?.o23 !== '2026-08-18T19:00:00.000Z') throw new Error('HARDENING_EPOCH_TIMES_REQUIRED');
if (authority.a0_evidence_contract?.candidate_ingested_at_cutoff_inclusive !== '2026-08-17T19:00:00.000Z' || authority.a0_evidence_contract?.candidate_snapshot_reuse_required !== true) throw new Error('HARDENING_A0_ASOF_SNAPSHOT_REQUIRED');
if (authority.a18d_hardening?.latest_safe_start_exclusive !== '2026-08-17T19:45:00.000Z' || authority.a18d_hardening?.latest_safe_start_is_normative_temporal_authority !== false) throw new Error('HARDENING_A18D_SAFE_START_REQUIRED');
if (authority.collector_hardening?.multi_record_dataset_atomic_commit_required !== true || authority.collector_hardening?.gfs_retry_is_operational_only !== true) throw new Error('HARDENING_COLLECTOR_ATOMIC_RETRY_REQUIRED');
if (authority.production_runner?.provider_requests !== 0 || authority.production_runner?.r2_requests !== 0 || authority.production_runner?.preclaim_missing_evidence_scheduler_write_count !== 0) throw new Error('HARDENING_DB_ONLY_RUNNER_REQUIRED');
for (const key of ['provider_request_count','database_write_count','scheduler_write_count','canonical_runtime_write_count']) if (authority.qualification_nonclaims?.[key] !== 0) throw new Error(`HARDENING_QUALIFICATION_NONCLAIM_REQUIRED:${key}`);

const a18d = read(A18D);
requireText(a18d, "candidate_ingested_at_cutoff_inclusive", 'HARDENING_A18D_AUTHORITY_CUTOFF_BINDING_REQUIRED');
requireText(a18d, "(record_json#>>'{payload,role_time,ingested_at}')::timestamptz <= $8::timestamptz", 'HARDENING_A18D_SQL_ASOF_REQUIRED');
requireText(a18d, 'private frozen: CanonicalReplayEvidenceRecordV1[] | null = null', 'HARDENING_A18D_FROZEN_CACHE_REQUIRED');
requireText(a18d, 'return structuredClone(this.frozen)', 'HARDENING_A18D_FROZEN_CACHE_REUSE_REQUIRED');
requireText(a18d, 'LATEST_SAFE_START = "2026-08-17T19:45:00.000Z"', 'HARDENING_A18D_SAFE_START_CONSTANT_REQUIRED');
requireText(a18d, 'A18D_V2_EXECUTION_AT_OR_AFTER_OPERATIONAL_SAFE_START_FORBIDDEN', 'HARDENING_A18D_SAFE_START_FAIL_CLOSED_REQUIRED');

const collector = read(COLLECTOR);
requireText(collector, 'function transactionBoundPool', 'HARDENING_COLLECTOR_OUTER_TX_ADAPTER_REQUIRED');
requireText(collector, 'SAVEPOINT', 'HARDENING_COLLECTOR_SAVEPOINT_REQUIRED');
requireText(collector, 'async function appendResultsAtomically', 'HARDENING_COLLECTOR_ATOMIC_APPEND_REQUIRED');
requireText(collector, 'await client.query("BEGIN")', 'HARDENING_COLLECTOR_OUTER_BEGIN_REQUIRED');
requireText(collector, 'await client.query("COMMIT")', 'HARDENING_COLLECTOR_OUTER_COMMIT_REQUIRED');
requireText(collector, 'GFS_MAX_ATTEMPTS = 3', 'HARDENING_COLLECTOR_BOUNDED_GFS_RETRY_REQUIRED');
requireText(collector, 'EA5E3_V2_GFS_RETRY_WOULD_CROSS_T_MINUS_30', 'HARDENING_COLLECTOR_RETRY_CUTOFF_REQUIRED');
requireText(collector, 'gfs_retry_is_operational_only: true', 'HARDENING_COLLECTOR_RETRY_NONAUTHORITY_REQUIRED');
requireText(collector, 'fixed_lag_7h_normative_authority: false', 'HARDENING_COLLECTOR_NO_FIXED_LAG_REQUIRED');

const runner = read(RUNNER);
requireText(runner, 'PostgresExternalFormalEvidenceSourceV1', 'HARDENING_RUNNER_DB_EVIDENCE_SOURCE_REQUIRED');
requireText(runner, 'PostgresPersistentSequentialSchedulerAdapterV1', 'HARDENING_RUNNER_PERSISTENT_SCHEDULER_REQUIRED');
requireText(runner, 'ExternalFormalV3Amendment11PersistentTickServiceV1', 'HARDENING_RUNNER_AMENDMENT11_TICK_SERVICE_REQUIRED');
requireText(runner, 'ExternalFormalV3Amendment11RunnerV1', 'HARDENING_RUNNER_A18_RUNNER_REQUIRED');
requireText(runner, 'evidence_snapshot_time: snapshotTime', 'HARDENING_RUNNER_ACTUAL_SNAPSHOT_REQUIRED');
requireText(runner, 'provider_request_count: 0', 'HARDENING_RUNNER_PROVIDER_ZERO_REQUIRED');
requireText(runner, 'r2_request_count: 0', 'HARDENING_RUNNER_R2_ZERO_REQUIRED');
forbidText(runner, 'fetch(', 'HARDENING_RUNTIME_RUNNER_PROVIDER_FETCH_FORBIDDEN');
forbidText(runner, 'S3Compatible', 'HARDENING_RUNTIME_RUNNER_S3_FORBIDDEN');

const manifest = read(MANIFEST);
requireText(manifest, 'MCFT_CAP09_A18C_MANIFEST_HASH_V1', 'HARDENING_EXACT_MANIFEST_HASH_REQUIRED');
requireText(manifest, 'materializeExternalFormalA18CropContextV2', 'HARDENING_FULL_CROP_MATERIALIZATION_REQUIRED');
requireText(manifest, 'A18C_LIVE_PARENT_CHAIN_DRIFT', 'HARDENING_PARENT_CHAIN_VERIFICATION_REQUIRED');

const workflow = read(WORKFLOW);
requireText(workflow, "authority='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-RUNTIME-HARDENING-AUTHORITY-V1.json'", 'HARDENING_WORKFLOW_EFFECTIVE_COMMIT_AUTHORITY_REQUIRED');
requireText(workflow, 'git log --first-parent --diff-filter=A -1', 'HARDENING_WORKFLOW_FIRST_PARENT_EFFECTIVE_COMMIT_REQUIRED');
requireText(workflow, "'5,20,35 19 17 8 *'", 'HARDENING_A18D_1950_REMOVED_REQUIRED');
forbidText(workflow, "5,20,35,50 19 17 8 *", 'HARDENING_A18D_UNSAFE_1950_CRON_FORBIDDEN');
requireText(workflow, "'12,42 * 17-20 8 *'", 'HARDENING_PRODUCTION_RUNNER_SCHEDULE_REQUIRED');
requireText(workflow, 'RUN_MCFT_CAP_09_A18C_FORMAL_V3_PRODUCTION_RUNNER_V1.ts cycle', 'HARDENING_PRODUCTION_RUNNER_LIVE_INVOCATION_REQUIRED');
requireText(workflow, 'RUN_MCFT_CAP_09_EA5E3_FORMAL_V2_PROVIDER_WATERMARK_COLLECTOR_V2.ts cycle', 'HARDENING_COLLECTOR_V2_LIVE_INVOCATION_REQUIRED');
requireText(workflow, 'EXECUTE_MCFT_CAP_09_A18D_PREWINDOW_BOOTSTRAP_V2.ts execute', 'HARDENING_A18D_V2_LIVE_INVOCATION_REQUIRED');

for (const retired of [
  '.github/workflows/mcft-cap-09-a18d-prewindow-bootstrap.yml',
  '.github/workflows/mcft-cap-09-ea5e3-v2-provider-watermark-wiring.yml',
  '.github/workflows/mcft-cap-09-ea5e3-a1-prewindow-a0-soil.yml',
]) {
  if (fs.existsSync(path.resolve(ROOT, retired))) throw new Error(`HARDENING_RETIRED_LIVE_WORKFLOW_STILL_PRESENT:${retired}`);
}

const result = {
  schema_version: 'geox_mcft_cap09_pre_runtime_hardening_governance_v1',
  status: 'PASS',
  exact_predecessor_protected_main: authority.exact_predecessor_protected_main,
  selected_epoch_id: authority.selected_epoch.epoch_id,
  blocker_count: 0,
  a0_evidence_asof_and_cached: true,
  collector_multi_record_atomic_commit: true,
  collector_gfs_bounded_retry_before_t_minus_30: true,
  a18d_latest_safe_start_exclusive: authority.a18d_hardening.latest_safe_start_exclusive,
  production_formal_runner_wired: true,
  unified_exact_hardening_subject_gate: true,
  retired_pre_hardening_live_workflows: 3,
  qualification_provider_request_count: 0,
  qualification_database_write_count: 0,
  qualification_scheduler_write_count: 0,
  qualification_canonical_runtime_write_count: 0,
  formal_o00_started: false,
  formal_execution_count: '0/24',
  mcft_cap09_completed: false,
};
fs.mkdirSync(path.dirname(path.resolve(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, OUT), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
