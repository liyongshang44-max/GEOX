// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S2_FUTURE_FORCING.cjs
// Purpose: verify the exact MCFT-CAP-04 S2 Future Forcing implementation boundary, S1 merged-main effectiveness, S2 activation, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, Forecast math, Scenario math, migration, route, scheduler, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '13f8bf3231cb41c809d235096ca7cfda9e201944';
const BRANCH = 'agent/mcft-cap-04-s2-future-forcing-window-v1';
const S1 = 'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.ts',
  'apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-WINDOW-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S2_FUTURE_FORCING.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_future_forcing_fixture_v1.ts',
].sort();

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const run = (exe, args) => {
  const result = cp.spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${exe} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return String(result.stdout || '').trim();
};
const git = (args) => run(process.platform === 'win32' ? 'git.exe' : 'git', args);
let pass = 0;
let fail = 0;
const check = (value, message) => {
  if (value) { pass += 1; console.log(`PASS ${message}`); }
  else { fail += 1; console.error(`FAIL ${message}`); }
};
const exactSet = (actual, expected, label) => {
  check(Array.isArray(actual), `${label} is array`);
  if (Array.isArray(actual)) check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} exact`);
};

for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `file exists: ${file}`);
const task = read('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md');
check(Buffer.byteLength(task, 'utf8') === 77603, 'complete task byte length exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA, 'complete task SHA exact');

const s1Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json');
const s2Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s1 = delivery.slices.find((slice) => slice.delivery_slice_id === S1);
const s2 = delivery.slices.find((slice) => slice.delivery_slice_id === S2);
const s3 = delivery.slices.find((slice) => slice.delivery_slice_id === S3);

check(s1Status.status === 'MERGED_EFFECTIVE', 'S1 status merged effective');
check(s1Status.effectiveness_condition_satisfied === true, 'S1 effectiveness satisfied');
check(s1Status.merge_evidence.pr_number === 2384, 'S1 PR exact');
check(s1Status.merge_evidence.exact_head_commit === '7347909b1d922dfd85f56a9967ffa5905778cb6c', 'S1 exact head exact');
check(s1Status.merge_evidence.exact_head_ci_run === 29222549931, 'S1 exact-head CI exact');
check(s1Status.merge_evidence.merge_commit === BASELINE, 'S1 merge commit exact');
check(s1Status.merge_evidence.postmerge_probe_pr_number === 2385, 'S1 postmerge probe PR exact');
check(s1Status.merge_evidence.postmerge_workflow_run === 29222992520, 'S1 postmerge workflow exact');
check(s1Status.merge_evidence.postmerge_gate === 'PASS', 'S1 postmerge Gate PASS');

check(s2Status.status === 'IMPLEMENTATION_CANDIDATE', 'S2 status candidate exact');
check(s2Status.baseline_main_commit === BASELINE, 'S2 baseline exact');
check(s2Status.branch === BRANCH, 'S2 branch exact');
check(s2Status.runtime_source_authorized === true, 'S2 Runtime source authorized');
check(s2Status.activation_fields_status === 'FROZEN', 'S2 activation fields frozen');
check(s2Status.contracts.forcing_point_count === 72, 'S2 forcing point count 72');
check(s2Status.contracts.standard_tick_count === 24 && s2Status.contracts.target_union_hour_count === 95, 'S2 standard range counts exact');
exactSet(s2Status.exact_changed_file_boundary, FILES, 'S2 status changed-file boundary');

check(contract.contract_id === 'MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1', 'Future Forcing contract ID exact');
check(contract.pair_policy_id === 'JOINT_MATCHING_FORCING_CYCLE_V1', 'pair policy exact');
check(contract.fallback_policy_id === 'NO_CROSS_SNAPSHOT_STITCHING_V1', 'fallback policy exact');
check(contract.selection_policy_id === 'FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE', 'selection policy exact');
check(contract.point_count === 72 && contract.step_hours === 1, 'contract 72 hourly points exact');
check(contract.no_future_leakage === true, 'contract no-future-leakage true');

check(delivery.status === 'S2_IMPLEMENTATION_CANDIDATE', 'delivery status S2 candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S2, 'delivery active slice S2');
check(s1.status === 'MERGED_EFFECTIVE' && s1.effectiveness_condition_satisfied === true, 'delivery S1 merged effective');
check(s2.status === 'IMPLEMENTATION_CANDIDATE' && s2.runtime_source_authorized === true && s2.activation_fields_status === 'FROZEN', 'delivery S2 activated and frozen');
exactSet(s2.exact_changed_file_boundary, FILES, 'delivery S2 changed-file boundary');
check(s3.status === 'BLOCKED' && s3.runtime_source_authorized === false, 'S3 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S2, 'authorization active S2');
check(authorization.repository_write_scope === 'S2_FUTURE_FORCING_ONLY', 'authorization write scope S2 exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S2 && cap04.next_delivery_slice_id === S3 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  'apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.ts': ['MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1','FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE','forcing_window_hash'],
  'apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.ts': ['CONFLICTING_FORCING_SNAPSHOT','CONFLICTING_FORCING_CYCLE','FORCING_AVAILABLE_AFTER_LOGICAL_TIME','CAP04_FUTURE_FORCING_BLOCK_REASON_V1'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts': ['95-hour target union','exact Replay fixture'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING_NEGATIVE.ts': ['future actual observations','cross-cycle stitching'],
})) {
  const content = read(file);
  for (const marker of markers) check(content.includes(marker), `${file} marker ${marker}`);
}

const changedRange = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', changedRange]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
exactSet(changed, FILES, `${MODE} changed-file boundary`);
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('apps/server/src/projections/')), 'no projection changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('acceptance-output/')), 'no generated acceptance evidence committed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S2 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S1 merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S2 governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
