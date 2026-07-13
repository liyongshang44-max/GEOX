// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S4_PURE_SCENARIO_MATH.cjs
// Purpose: verify the exact MCFT-CAP-04 S4 pure three-Scenario math boundary, S3 merged-main effectiveness, S4 activation, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, canonical append, migration, route, scheduler, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '4a1c9fde05594c97fb949e062df77375a1a27365';
const BRANCH = 'agent/mcft-cap-04-s4-pure-three-scenario-math-v1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const S5 = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.ts',
  'apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-THREE-SCENARIO-MATH-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-MATH-CONTRACT.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S4_PURE_SCENARIO_MATH.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_scenario_math_fixture_v1.ts',
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

const s3Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json');
const s4Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-MATH-CONTRACT.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s3 = delivery.slices.find((slice) => slice.delivery_slice_id === S3);
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
const s5 = delivery.slices.find((slice) => slice.delivery_slice_id === S5);

check(s3Status.status === 'MERGED_EFFECTIVE', 'S3 status merged effective');
check(s3Status.effectiveness_condition_satisfied === true, 'S3 effectiveness satisfied');
check(s3Status.merge_evidence.pr_number === 2388, 'S3 PR exact');
check(s3Status.merge_evidence.exact_head_commit === '083a47c50130b84dbc5aad18faf5f115b437112d', 'S3 exact head exact');
check(s3Status.merge_evidence.exact_head_ci_run === 29225068719, 'S3 exact-head CI exact');
check(s3Status.merge_evidence.merge_commit === BASELINE, 'S3 merge commit exact');
check(s3Status.merge_evidence.postmerge_probe_pr_number === 2389, 'S3 postmerge probe PR exact');
check(s3Status.merge_evidence.postmerge_workflow_run === 29225560206, 'S3 postmerge workflow exact');
check(s3Status.merge_evidence.postmerge_gate === 'PASS', 'S3 postmerge Gate PASS');

check(s4Status.status === 'IMPLEMENTATION_CANDIDATE', 'S4 status candidate exact');
check(s4Status.baseline_main_commit === BASELINE, 'S4 baseline exact');
check(s4Status.branch === BRANCH, 'S4 branch exact');
check(s4Status.runtime_source_authorized === true, 'S4 Runtime source authorized');
check(s4Status.activation_fields_status === 'FROZEN', 'S4 activation fields frozen');
check(s4Status.contracts.option_count === 3 && s4Status.contracts.trajectory_point_count_per_option === 72, 'S4 option and point counts exact');
check(s4Status.contracts.standard_tick_count === 24 && s4Status.contracts.target_union_hour_count === 95, 'S4 standard range counts exact');
exactSet(s4Status.exact_changed_file_boundary, FILES, 'S4 status changed-file boundary');

check(contract.contract_id === 'MCFT_CAP_04_PURE_THREE_SCENARIO_MATH_V1', 'Scenario math contract ID exact');
check(JSON.stringify(contract.option_order) === JSON.stringify(['NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM']), 'Scenario option order exact');
check(contract.no_action_mode === 'EXACT_SOURCE_FORECAST_POINTS_DEEP_COPY', 'NO_ACTION copy mode exact');
check(contract.application_horizon === 1 && contract.scenario_assumed_irrigation_variance_mm2 === '0.000000', 'irrigation horizon and variance exact');
check(contract.stress_threshold === '0.350000' && contract.stress_comparator === 'STRICT_LESS_THAN', 'stress contract exact');
check(contract.forcing_reselection_forbidden === true && contract.fake_execution_authority_forbidden === true, 'forcing and execution boundaries exact');

check(delivery.status === 'S4_IMPLEMENTATION_CANDIDATE', 'delivery status S4 candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S4, 'delivery active slice S4');
check(s3.status === 'MERGED_EFFECTIVE' && s3.effectiveness_condition_satisfied === true, 'delivery S3 merged effective');
check(s4.status === 'IMPLEMENTATION_CANDIDATE' && s4.runtime_source_authorized === true && s4.activation_fields_status === 'FROZEN', 'delivery S4 activated and frozen');
exactSet(s4.exact_changed_file_boundary, FILES, 'delivery S4 changed-file boundary');
check(s5.status === 'BLOCKED' && s5.runtime_source_authorized === false, 'S5 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S4, 'authorization active S4');
check(authorization.repository_write_scope === 'S4_PURE_SCENARIO_MATH_ONLY', 'authorization write scope S4 exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S4 && cap04.next_delivery_slice_id === S5 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  'apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.ts': ['MCFT_CAP_04_PURE_THREE_SCENARIO_MATH_V1','SCENARIO_ACTION_COMPLIANCE_UNCERTAINTY_NOT_MODELED','CAP04_NO_ACTION_TRAJECTORY_HASH_MISMATCH'],
  'apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.ts': ['IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM','CAP04_SCENARIO_MASS_BALANCE_NOT_CLOSED','scenario_assumed_irrigation_variance_mm2'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts': ['exact canonical deep copy','95-hour target union','water balance exactly'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts': ['fake execution receipt','forcing trace','option reordering'],
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
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S4 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S3 merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S4 governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
