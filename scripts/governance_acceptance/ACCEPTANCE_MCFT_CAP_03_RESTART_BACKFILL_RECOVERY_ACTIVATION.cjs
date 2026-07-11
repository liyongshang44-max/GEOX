// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_ACTIVATION.cjs
// Purpose: validate the governance-only S6 activation freeze, S5 merged-main effectiveness, exact activation boundary, frozen implementation boundary, and preserved downstream blocks.
// Boundary: no Runtime implementation, migration, route, scheduler, web, workflow, restart/backfill execution, successful Forecast, late-Evidence revision, CAP-03 completion, or CAP-04 authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '8190e93f3b520ce15dcbe40b2a92e759176ef9a1';
const ACTIVATION_BRANCH = 'mcft-cap-03-s6-activation-freeze-v1';
const IMPLEMENTATION_BRANCH = 'mcft-cap-03-s6-restart-backfill-recovery-v1';
const S5 = 'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1';
const S6 = 'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';

const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--draft')
    ? 'draft'
    : 'final';

const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_ACTIVATION.cjs';

const EXACT_ACTIVATION_FILES = Object.freeze([
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_ACTIVATION.cjs',
].sort());

const IMPLEMENTATION_FILES = Object.freeze([
  'apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.ts',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_restart_backfill_recovery_fixture_v1.ts',
].sort());

let pass = 0;
let fail = 0;

function check(value, message) {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function git(args) {
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exactArray(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  check(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} exact`,
  );
}

function changedFiles() {
  const tracked = git(['diff', '--name-only', BASELINE])
    .split(/\r?\n/)
    .filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

for (const file of EXACT_ACTIVATION_FILES) {
  check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

const status = readJson(STATUS_PATH);
const delivery = readJson(DELIVERY_PATH);
const contract = readText(CONTRACT_PATH);
const s5 = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);

check(status.schema_version === 'geox_mcft_cap_03_restart_backfill_recovery_status_v1', 'status schema exact');
check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S6, 'status delivery slice exact');
check(status.baseline_main_commit === BASELINE, 'status baseline exact');
check(status.activation_branch === ACTIVATION_BRANCH, 'activation branch exact');
check(status.implementation_branch === IMPLEMENTATION_BRANCH, 'implementation branch exact');
check(status.predecessor_effectiveness?.s5_activation_merge_commit === '53178b33cc87dfab6b83f5305f222c1366b024e1', 'S5 activation merge exact');
check(status.predecessor_effectiveness?.s5_implementation_merge_commit === 'aa781f94d752337e3d06ff8b7dceb7b2e2b7c56c', 'S5 implementation merge exact');
check(status.predecessor_effectiveness?.s5_postmerge_effectiveness_merge_commit === BASELINE, 'S5 postmerge effectiveness merge exact');
check(status.predecessor_effectiveness?.s5_exact_head_ci === 'CI_4712_SUCCESS', 'S5 exact-head CI exact');
check(status.predecessor_effectiveness?.s5_merged_main_gate === 'PASS_110_OF_110', 'S5 merged-main Gate exact');
check(status.predecessor_effectiveness?.s5_isolated_postgresql === 'PASS_9_OF_9', 'S5 PostgreSQL acceptance exact');
check(status.predecessor_effectiveness?.s5_effectiveness_condition_satisfied === true, 'S5 effectiveness satisfied');

check(status.frozen_runtime_objective?.process_1_tick_count === 12, 'process 1 tick count 12');
check(status.frozen_runtime_objective?.fresh_process_tick_count === 12, 'fresh process tick count 12');
check(status.frozen_runtime_objective?.total_tick_count === 24, 'total tick count 24');
check(status.frozen_runtime_objective?.process_1_last_tick_logical_time === '2026-06-02T13:00:00.000Z', 'process 1 terminal tick exact');
check(status.frozen_runtime_objective?.fresh_process_first_tick_logical_time === '2026-06-02T14:00:00.000Z', 'fresh process first tick exact');
check(status.frozen_runtime_objective?.last_tick_logical_time === '2026-06-03T01:00:00.000Z', 'final tick exact');
check(status.frozen_runtime_objective?.next_handoff_logical_time === '2026-06-03T02:00:00.000Z', 'next handoff exact');
check(status.frozen_runtime_objective?.uninterrupted_and_restarted_hashes === 'MUST_BE_IDENTICAL_FOR_ALL_24_A2_RECORD_SETS', 'restart hash equivalence frozen');
check(status.frozen_runtime_objective?.bounded_forward_backfill === 'MUST_MATCH_UNINTERRUPTED_CANONICAL_HASHES', 'bounded forward backfill equivalence frozen');
check(status.frozen_runtime_objective?.late_evidence_policy === 'NO_RECOMPUTE_NO_REVISION', 'late Evidence no-recompute boundary frozen');

check(status.failure_recovery_objective?.precommit_process_crash === 'ROLLBACK_NO_PARTIAL_FACTS_NO_PROJECTION_ADVANCE', 'precommit crash rollback frozen');
check(status.failure_recovery_objective?.postcommit_response_loss === 'IDEMPOTENT_CANONICAL_SUCCESS_WITHOUT_DUPLICATE_FACTS', 'postcommit response-loss idempotency frozen');
check(status.failure_recovery_objective?.stale_fencing === 'FAIL_CLOSED', 'stale fencing fail-closed frozen');
check(status.failure_recovery_objective?.cas_conflict === 'FAIL_CLOSED', 'CAS conflict fail-closed frozen');
check(status.failure_recovery_objective?.projection_divergence === 'FAIL_CLOSED_UNTIL_EXPLICIT_CANONICAL_REBUILD', 'projection divergence fail-closed frozen');
check(status.failure_recovery_objective?.canonical_rebuild === 'EXPLICIT_FIVE_PROJECTION_REBUILD_FROM_CANONICAL_A2_RECORD_SET', 'canonical rebuild frozen');

check(status.implementation_boundary?.thin_assimilated_restart_resume_orchestrator === 'AUTHORIZED_AFTER_ACTIVATION_EFFECTIVE', 'thin assimilated restart orchestrator boundary exact');
check(status.implementation_boundary?.assimilated_contiguous_range_service_v1_reuse === 'REQUIRED', 'S5 range service reuse required');
check(status.implementation_boundary?.postgres_assimilated_runtime_repository_v1_reuse === 'REQUIRED', 'S3B repository reuse required');
check(status.implementation_boundary?.new_tick_loop === 'FORBIDDEN', 'second tick loop forbidden');
check(status.implementation_boundary?.direct_persistence_from_orchestrator === 'FORBIDDEN', 'direct persistence forbidden');
check(status.implementation_boundary?.automatic_projection_repair === 'FORBIDDEN', 'automatic projection repair forbidden');
check(status.implementation_boundary?.cap_02_runtime_mutation === 'FORBIDDEN', 'CAP-02 Runtime mutation forbidden');
check(status.implementation_boundary?.schema_migration === 'FORBIDDEN', 'migration forbidden');
check(status.implementation_boundary?.route === 'FORBIDDEN', 'route forbidden');
check(status.implementation_boundary?.scheduler === 'FORBIDDEN', 'scheduler forbidden');
check(status.implementation_boundary?.successful_forecast === 'FORBIDDEN', 'successful Forecast forbidden');
check(status.implementation_boundary?.late_evidence_revision === 'FORBIDDEN', 'late Evidence revision forbidden');

exactArray(status.exact_activation_changed_file_boundary, EXACT_ACTIVATION_FILES, 'activation changed-file boundary');
exactArray(status.frozen_implementation_changed_file_boundary, IMPLEMENTATION_FILES, 'implementation changed-file boundary');

check(s5?.status === 'MERGED', 'S5 remains MERGED');
check(s5?.merged_main_gate === 'PASS', 'S5 merged-main Gate recorded');
check(s5?.effectiveness_condition_satisfied === true, 'S5 effectiveness recorded');
check(s6?.baseline_main_commit === BASELINE, 'delivery S6 baseline exact');
check(s6?.branch === IMPLEMENTATION_BRANCH, 'delivery S6 implementation branch exact');
check(s6?.activation_fields_status === 'FROZEN', 'delivery S6 activation fields frozen');
exactArray(s6?.exact_changed_file_boundary, IMPLEMENTATION_FILES, 'delivery S6 implementation boundary');
check(s7?.status === 'BLOCKED', 'S7 remains BLOCKED');
check(s7?.baseline_main_commit === null, 'S7 baseline remains unset');
check(s7?.branch === null, 'S7 branch remains unset');
check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

if (MODE === 'postmerge') {
  check(status.status === 'ACTIVATED', 'postmerge activation status ACTIVATED');
  check(status.activation_effective === true, 'postmerge activation effective');
  check(status.implementation_status === 'AUTHORIZED', 'postmerge implementation authorized');
  check(s6?.status === 'ACTIVATED', 'postmerge delivery S6 ACTIVATED');
  check(s6?.activation?.effective === true, 'postmerge delivery activation effective');
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
} else {
  check(status.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} activation status ready`);
  check(status.activation_effective === false, `${MODE} activation ineffective`);
  check(status.implementation_status === 'NOT_AUTHORIZED', `${MODE} implementation unauthorized`);
  check(status.implementation_authorized === false, `${MODE} implementation authorization false`);
  check(delivery.status === 'RESTART_BACKFILL_RECOVERY_ACTIVATION_READY_FOR_MERGE', `${MODE} delivery status exact`);
  check(delivery.active_delivery_slice_id === S6, `${MODE} S6 active delivery slice`);
  check(s6?.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} delivery S6 activation ready`);
  check(s6?.activation?.effective === false, `${MODE} delivery activation ineffective`);
  check(git(['branch', '--show-current']) === ACTIVATION_BRANCH, `${MODE} Gate runs on activation branch`);
}

for (const marker of [
  'process 1 commits ticks 1–12',
  'fresh process resumes ticks 13–24',
  'restarted and uninterrupted canonical hashes must be identical',
  'bounded forward backfill',
  'precommit process crash',
  'postcommit response loss',
  'stale fencing fails closed',
  'projection divergence fails closed',
  'explicit canonical five-projection rebuild',
  'late Evidence does not trigger recomputation or revision',
  'S7 remains blocked',
  'MCFT-CAP-04 remains unauthorized',
]) {
  check(contract.includes(marker), `contract marker: ${marker}`);
}

if (MODE !== 'postmerge') {
  exactArray(changedFiles(), EXACT_ACTIVATION_FILES, 'actual activation changed-file set');
}

try {
  git(['diff', '--check', BASELINE]);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(`MCFT-CAP-03 S6 activation ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
