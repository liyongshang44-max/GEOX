// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S1_CONTRACTS_CONFIG.cjs
// Purpose: verify the exact MCFT-CAP-04 S1 contracts/config implementation boundary, S0 effectiveness and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, Forecast/Scenario execution, migration, route, scheduler or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '870bcc621e8d0495ae5acbedd534068a18d402b9';
const BRANCH = 'agent/mcft-cap-04-s1-contracts-config-v1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const S1 = 'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_member_hash_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_dispatch_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_runtime_config_service_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-SCENARIO-CONTRACTS-CONFIG-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S1_CONTRACTS_CONFIG.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_CONTRACTS_CONFIG_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_contracts_config_fixture_v1.ts',
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

const status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s0 = delivery.slices.find((slice) => slice.delivery_slice_id === S0);
const s1 = delivery.slices.find((slice) => slice.delivery_slice_id === S1);
const s2 = delivery.slices.find((slice) => slice.delivery_slice_id === S2);

check(status.status === 'IMPLEMENTATION_CANDIDATE', 'S1 status candidate exact');
check(status.baseline_main_commit === BASELINE, 'S1 baseline exact');
check(status.branch === BRANCH, 'S1 branch exact');
check(status.authorization_effective === true, 'S1 records effective authorization');
check(status.runtime_source_authorized === true, 'S1 Runtime source authorized');
check(status.s0_effectiveness.merge_commit === BASELINE, 'S0 merge exact');
check(status.s0_effectiveness.postmerge_workflow_run === 29207138083, 'S0 postmerge workflow exact');
check(status.s0_effectiveness.postmerge_gate === 'PASS', 'S0 postmerge Gate PASS');
check(status.runtime_config.chain_length === 24, 'config chain length 24');
check(status.contracts.forecast_point_count === 72, 'Forecast point count 72');
exactSet(status.exact_changed_file_boundary, FILES, 'S1 status changed-file boundary');

check(delivery.status === 'S1_IMPLEMENTATION_CANDIDATE', 'delivery status S1 candidate');
check(delivery.baseline_main_commit === BASELINE, 'delivery baseline exact');
check(delivery.branch === BRANCH, 'delivery branch exact');
check(delivery.active_delivery_slice_id === S1, 'delivery active slice S1');
check(delivery.authorization_effective === true, 'delivery authorization effective');
check(delivery.runtime_source_authorized === true, 'delivery Runtime source authorized');
check(s0.status === 'MERGED_EFFECTIVE' && s0.effectiveness_condition_satisfied === true, 'S0 merged effective');
check(s0.merge_commit === BASELINE && s0.postmerge_workflow_run === 29207138083 && s0.postmerge_gate === 'PASS', 'S0 evidence exact');
check(s1.status === 'IMPLEMENTATION_CANDIDATE', 'S1 slice candidate');
check(s1.baseline_main_commit === BASELINE && s1.branch === BRANCH, 'S1 activation identity exact');
check(s1.runtime_source_authorized === true && s1.activation_fields_status === 'FROZEN', 'S1 activation fields frozen');
exactSet(s1.exact_changed_file_boundary, FILES, 'delivery S1 changed-file boundary');
check(s2.status === 'BLOCKED' && s2.runtime_source_authorized === false, 'S2 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization status effective');
check(authorization.authorization_effective === true, 'authorization effective true');
check(authorization.runtime_source_authorized === true, 'authorization Runtime source true');
check(authorization.active_delivery_slice_id === S1, 'authorization active S1');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 in progress and design frozen');
check(cap04.authorization_effective === true && cap04.runtime_source_authorized === true, 'matrix authorization effective for S1');
check(cap04.active_delivery_slice_id === S1 && cap04.next_delivery_slice_id === S2 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  'apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts': ['MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1','MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1','MCFT_CAP_04_THREE_SCENARIO_SET_V1','NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM'],
  'apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.ts': ['FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1','JOINT_MATCHING_FORCING_CYCLE_V1','NO_CROSS_SNAPSHOT_STITCHING_V1','1.000000','0.350000'],
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_dispatch_v1.ts': ['validateVersionedContinuationRecordSetV1','UNKNOWN_RECORD_SET_CONTRACT'],
  'apps/server/src/domain/twin_runtime/forecast_scenario_member_hash_v1.ts': ['aggregate_determinism_hash'],
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
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S1 branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S0 merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S1 governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
