// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_ACTIVATION.cjs
// Purpose: validate the governance-only S5 activation freeze, predecessor effectiveness, exact activation boundary, frozen implementation boundary, and preserved downstream blocks.
// Boundary: no Runtime implementation, migration, route, scheduler, web, workflow, range execution, successful Forecast, restart/backfill, CAP-03 completion, or CAP-04 authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '01f705bec9e79b528480b63fe56c6e6c4489845f';
const ACTIVATION_BRANCH = 'mcft-cap-03-s5-activation-freeze-v1';
const IMPLEMENTATION_BRANCH = 'mcft-cap-03-s5-twenty-four-observation-aware-tick-range-v1';
const S4 = 'MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1';
const S5 = 'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1';
const S6 = 'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';

const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--draft')
    ? 'draft'
    : 'final';

const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_ACTIVATION.cjs';

const EXACT_ACTIVATION_FILES = Object.freeze([
  STATUS_PATH,
  CONTRACT_PATH,
  DELIVERY_PATH,
  GATE_PATH,
].sort());

const IMPLEMENTATION_FILES = Object.freeze([
  'apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.ts',
  STATUS_PATH,
  CONTRACT_PATH,
  DELIVERY_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts',
  'scripts/runtime_acceptance/mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.ts',
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
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
const s5 = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);

check(status.schema_version === 'geox_mcft_cap_03_twenty_four_observation_aware_tick_range_status_v1', 'status schema exact');
check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S5, 'status delivery slice exact');
check(status.baseline_main_commit === BASELINE, 'status baseline exact');
check(status.activation_branch === ACTIVATION_BRANCH, 'activation branch exact');
check(status.implementation_branch === IMPLEMENTATION_BRANCH, 'implementation branch exact');
check(status.predecessor_effectiveness?.s4_implementation_merge_commit === 'f245b46013174e03ad3a6ed4aff0963973fe0c1a', 'S4 implementation merge exact');
check(status.predecessor_effectiveness?.s4_postmerge_status_commit === BASELINE, 'S4 closure commit exact');
check(status.predecessor_effectiveness?.s4_merged_main_gate === 'PASS_121_OF_121', 'S4 merged-main Gate exact');
check(status.predecessor_effectiveness?.s4_effectiveness_condition_satisfied === true, 'S4 effectiveness satisfied');

check(status.frozen_runtime_objective?.first_tick_logical_time === '2026-06-02T02:00:00.000Z', 'first tick exact');
check(status.frozen_runtime_objective?.last_tick_logical_time === '2026-06-03T01:00:00.000Z', 'last tick exact');
check(status.frozen_runtime_objective?.next_handoff_logical_time === '2026-06-03T02:00:00.000Z', 'next handoff exact');
check(status.frozen_runtime_objective?.tick_count === 24, 'tick count 24');
check(status.frozen_runtime_objective?.first_checkpoint_sequence === 25, 'first sequence 25');
check(status.frozen_runtime_objective?.last_checkpoint_sequence === 48, 'last sequence 48');
check(status.frozen_runtime_objective?.new_a2_fact_count === 192, 'A2 fact count 192');
check(status.frozen_runtime_objective?.local_state_range_count === 25, 'local State count 25');
check(status.frozen_runtime_objective?.global_active_lineage_state_count === 49, 'global State count 49');
check(status.frozen_runtime_objective?.transaction_boundary === 'ONE_A2_DATABASE_TRANSACTION_PER_TICK', 'transaction boundary exact');
check(status.frozen_runtime_objective?.failure_policy === 'STOP_ON_FIRST_FAILURE', 'failure policy exact');

check(status.implementation_boundary?.s4_single_tick_service_reuse === 'REQUIRED', 'S4 single-tick reuse required');
check(status.implementation_boundary?.cap_02_range_service_mutation === 'FORBIDDEN', 'CAP-02 range mutation forbidden');
check(status.implementation_boundary?.schema_migration === 'FORBIDDEN', 'migration forbidden');
check(status.implementation_boundary?.restart_or_backfill === 'FORBIDDEN', 'restart/backfill forbidden');
check(status.implementation_boundary?.route === 'FORBIDDEN', 'route forbidden');
check(status.implementation_boundary?.scheduler === 'FORBIDDEN', 'scheduler forbidden');
check(status.implementation_boundary?.successful_forecast === 'FORBIDDEN', 'successful Forecast forbidden');

exactArray(status.exact_activation_changed_file_boundary, EXACT_ACTIVATION_FILES, 'activation changed-file boundary');
exactArray(status.frozen_implementation_changed_file_boundary, IMPLEMENTATION_FILES, 'implementation changed-file boundary');

check(s4?.status === 'MERGED', 'S4 remains MERGED');
check(s4?.merged_main_gate === 'PASS', 'S4 merged-main Gate recorded');
check(s4?.effectiveness_condition_satisfied === true, 'S4 effectiveness recorded');
check(s5?.baseline_main_commit === BASELINE, 'delivery S5 baseline exact');
check(s5?.branch === IMPLEMENTATION_BRANCH, 'delivery S5 implementation branch exact');
check(s5?.activation_fields_status === 'FROZEN', 'delivery S5 activation fields frozen');
exactArray(s5?.exact_changed_file_boundary, IMPLEMENTATION_FILES, 'delivery S5 implementation boundary');
check(s6?.status === 'BLOCKED', 'S6 remains BLOCKED');
check(s6?.baseline_main_commit === null, 'S6 baseline remains unset');
check(s6?.branch === null, 'S6 branch remains unset');
check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

if (MODE === 'postmerge') {
  check(status.status === 'ACTIVATED', 'postmerge activation status ACTIVATED');
  check(status.activation_effective === true, 'postmerge activation effective');
  check(status.implementation_status === 'AUTHORIZED', 'postmerge implementation authorized');
  check(s5?.status === 'ACTIVATED', 'postmerge delivery S5 ACTIVATED');
  check(s5?.activation?.effective === true, 'postmerge delivery activation effective');
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
} else {
  check(status.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} activation status ready`);
  check(status.activation_effective === false, `${MODE} activation ineffective`);
  check(status.implementation_status === 'NOT_AUTHORIZED', `${MODE} implementation unauthorized`);
  check(status.implementation_authorized === false, `${MODE} implementation authorization false`);
  check(delivery.status === 'TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_ACTIVATION_READY_FOR_MERGE', `${MODE} delivery status exact`);
  check(delivery.active_delivery_slice_id === S5, `${MODE} S5 active delivery slice`);
  check(s5?.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} delivery S5 activation ready`);
  check(s5?.activation?.effective === false, `${MODE} delivery activation ineffective`);
  check(git(['branch', '--show-current']) === ACTIVATION_BRANCH, `${MODE} Gate runs on activation branch`);
}

for (const marker of [
  '24 contiguous hourly ticks',
  'checkpoint sequence: `25..48`',
  '192 new A2 canonical facts',
  'AssimilatedContinuationTickServiceV1.executeOneTick',
  'CAP-02 `ContiguousContinuationRangeServiceV1`',
  'S6 remains blocked',
  'MCFT-CAP-04 remains unauthorized',
]) {
  check(contract.includes(marker), `contract marker: ${marker}`);
}

if (MODE !== 'postmerge') {
  exactArray(changedFiles(), EXACT_ACTIVATION_FILES, 'actual activation changed-file set');
}

try {
  git(['diff', '--check']);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(`MCFT-CAP-03 S5 activation ${MODE}: ${pass} PASS, ${fail} FAIL`);

if (fail > 0) process.exit(1);
