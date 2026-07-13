// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S3_PURE_FORECAST_MATH.cjs
// Purpose: verify the exact MCFT-CAP-04 S3 pure 72-hour Forecast math boundary, S2 merged-main effectiveness, S3 activation, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, Scenario math, migration, route, scheduler, recommendation, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '4a8dab632246b05266f1d869f6c9a0a5bcf37e76';
const BRANCH = 'agent/mcft-cap-04-s3-pure-72h-forecast-math-v1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-MATH-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-72H-FORECAST-MATH-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S3_PURE_FORECAST_MATH.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_forecast_math_fixture_v1.ts',
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

const s2Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json');
const s3Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-MATH-CONTRACT.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s2 = delivery.slices.find((slice) => slice.delivery_slice_id === S2);
const s3 = delivery.slices.find((slice) => slice.delivery_slice_id === S3);
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);

check(s2Status.status === 'MERGED_EFFECTIVE', 'S2 status merged effective');
check(s2Status.effectiveness_condition_satisfied === true, 'S2 effectiveness satisfied');
check(s2Status.merge_evidence.pr_number === 2386, 'S2 PR exact');
check(s2Status.merge_evidence.exact_head_commit === '4dae60d9412ec191cec3be0b730fab216474731f', 'S2 exact head exact');
check(s2Status.merge_evidence.exact_head_ci_run === 29223459646, 'S2 exact-head CI exact');
check(s2Status.merge_evidence.merge_commit === BASELINE, 'S2 merge commit exact');
check(s2Status.merge_evidence.postmerge_probe_pr_number === 2387, 'S2 postmerge probe PR exact');
check(s2Status.merge_evidence.postmerge_workflow_run === 29223899742, 'S2 postmerge workflow exact');
check(s2Status.merge_evidence.postmerge_gate === 'PASS', 'S2 postmerge Gate PASS');

check(s3Status.status === 'IMPLEMENTATION_CANDIDATE', 'S3 status candidate exact');
check(s3Status.baseline_main_commit === BASELINE, 'S3 baseline exact');
check(s3Status.branch === BRANCH, 'S3 branch exact');
check(s3Status.runtime_source_authorized === true, 'S3 Runtime source authorized');
check(s3Status.activation_fields_status === 'FROZEN', 'S3 activation fields frozen');
check(s3Status.contracts.forecast_point_count === 72, 'S3 point count 72');
check(s3Status.contracts.standard_tick_count === 24 && s3Status.contracts.target_union_hour_count === 95, 'S3 standard range counts exact');
exactSet(s3Status.exact_changed_file_boundary, FILES, 'S3 status changed-file boundary');

check(contract.contract_id === 'MCFT_CAP_04_PURE_72H_FORECAST_MATH_V1', 'Forecast math contract ID exact');
check(contract.baseline_assumption === 'NO_NEW_IRRIGATION', 'Forecast baseline exact');
check(contract.forecast_method_id === 'ROOT_ZONE_WATER_BALANCE_72H_FIXED_POINT_V1', 'Forecast method exact');
check(contract.uncertainty_method_id === 'ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1', 'uncertainty method exact');
check(contract.interval_method_id === 'NORMAL_95_PERCENT_Z_1_96_V1', 'interval method exact');
check(contract.point_count === 72 && contract.step_hours === 1, 'contract 72 hourly points exact');
check(contract.mean_internal_scale === 6 && contract.variance_internal_scale === 12, 'fixed-point scales exact');
check(contract.mass_balance_error_required === '0.000000', 'mass balance error exact');

check(delivery.status === 'S3_IMPLEMENTATION_CANDIDATE', 'delivery status S3 candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S3, 'delivery active slice S3');
check(s2.status === 'MERGED_EFFECTIVE' && s2.effectiveness_condition_satisfied === true, 'delivery S2 merged effective');
check(s3.status === 'IMPLEMENTATION_CANDIDATE' && s3.runtime_source_authorized === true && s3.activation_fields_status === 'FROZEN', 'delivery S3 activated and frozen');
exactSet(s3.exact_changed_file_boundary, FILES, 'delivery S3 changed-file boundary');
check(s4.status === 'BLOCKED' && s4.runtime_source_authorized === false, 'S4 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S3, 'authorization active S3');
check(authorization.repository_write_scope === 'S3_PURE_FORECAST_MATH_ONLY', 'authorization write scope S3 exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S3 && cap04.next_delivery_slice_id === S4 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  'apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts': ['MCFT_CAP_04_PURE_72H_FORECAST_MATH_V1','CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION','latent_variance_reduced_by_clipping'],
  'apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts': ['NO_NEW_IRRIGATION_ASSUMPTION','CAP04_FORECAST_MASS_BALANCE_NOT_CLOSED','ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1','NORMAL_95_PERCENT_Z_1_96_V1'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts': ['95-hour Forecast target union','mass balance closes exactly'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts': ['missing posterior computation-basis variance','physical clipping cannot reduce latent variance'],
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
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S3 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S2 merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S3 governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
