// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5A_A1_A2_BUILDERS.cjs
// Purpose: verify the exact MCFT-CAP-04 S5A A1/A2 record-set-builder boundary, S4 merged-main effectiveness, S5A activation, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, persistence, migration, projection, route, scheduler, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'f0fc64d487ba6ed34d0c77178fed45e707092a07';
const BRANCH = 'agent/mcft-cap-04-s5a-a1-a2-record-set-builders-v1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const S5A = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5A_A1_A2_BUILDERS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_a1_a2_record_set_fixture_v1.ts',
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

const s4Status = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json');
const s5aStatus = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json');
const contract = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-CONTRACT.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
const s5a = delivery.slices.find((slice) => slice.delivery_slice_id === S5A);
const s5b = delivery.slices.find((slice) => slice.delivery_slice_id === S5B);

check(s4Status.status === 'MERGED_EFFECTIVE', 'S4 status merged effective');
check(s4Status.effectiveness_condition_satisfied === true, 'S4 effectiveness satisfied');
check(s4Status.merge_evidence.pr_number === 2390, 'S4 PR exact');
check(s4Status.merge_evidence.exact_head_commit === '02faa691cfa83624e28664fee7b3fbf0ed7dfd36', 'S4 exact head exact');
check(s4Status.merge_evidence.exact_head_ci_run === 29226139264, 'S4 exact-head CI exact');
check(s4Status.merge_evidence.merge_commit === BASELINE, 'S4 merge commit exact');
check(s4Status.merge_evidence.postmerge_probe_pr_number === 2391, 'S4 postmerge probe PR exact');
check(s4Status.merge_evidence.postmerge_workflow_run === 29226613070, 'S4 postmerge workflow exact');
check(s4Status.merge_evidence.postmerge_gate === 'PASS', 'S4 postmerge Gate PASS');

check(s5aStatus.status === 'IMPLEMENTATION_CANDIDATE', 'S5A status candidate exact');
check(s5aStatus.baseline_main_commit === BASELINE, 'S5A baseline exact');
check(s5aStatus.branch === BRANCH, 'S5A branch exact');
check(s5aStatus.runtime_source_authorized === true, 'S5A Runtime source authorized');
check(s5aStatus.activation_fields_status === 'FROZEN', 'S5A activation fields frozen');
check(s5aStatus.contracts.a1_member_count === 8 && s5aStatus.contracts.a2_member_count === 8, 'S5A member counts exact');
check(s5aStatus.contracts.database_access === false, 'S5A database access false');
exactSet(s5aStatus.exact_changed_file_boundary, FILES, 'S5A status changed-file boundary');

check(contract.contract_id === 'MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_V1', 'builder contract ID exact');
check(contract.a1.record_set_contract_id === 'MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1', 'A1 contract exact');
check(contract.a2.record_set_contract_id === 'MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1', 'A2 contract exact');
check(contract.a1.member_count === 8 && contract.a2.member_count === 8, 'contract member counts exact');
check(contract.shared_terminal_tick_uniqueness === true, 'shared terminal uniqueness true');
check(contract.database_access === false && contract.persistence === false, 'contract pure no-persistence boundary');

check(delivery.status === 'S5A_IMPLEMENTATION_CANDIDATE', 'delivery status S5A candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S5A, 'delivery active slice S5A');
check(s4.status === 'MERGED_EFFECTIVE' && s4.effectiveness_condition_satisfied === true, 'delivery S4 merged effective');
check(s5a.status === 'IMPLEMENTATION_CANDIDATE' && s5a.runtime_source_authorized === true && s5a.activation_fields_status === 'FROZEN', 'delivery S5A activated and frozen');
exactSet(s5a.exact_changed_file_boundary, FILES, 'delivery S5A changed-file boundary');
check(s5b.status === 'BLOCKED' && s5b.runtime_source_authorized === false, 'S5B remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S5A, 'authorization active S5A');
check(authorization.repository_write_scope === 'S5A_A1_A2_BUILDERS_ONLY', 'authorization write scope S5A exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S5A && cap04.next_delivery_slice_id === S5B && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts': [
    'buildCap04CompletedForecastRecordSetV1',
    'buildCap04BlockedForecastRecordSetV1',
    'A1_COMPLETED',
    'A2_BLOCKED_FORECAST',
    'stop_after_blocked_forecast',
    'validateCap04ARecordSetV1',
  ],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS.ts': [
    'shared cross-variant terminal tick uniqueness identity',
    '24 standard ticks produce 24 distinct valid A1 record-set candidates',
  ],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_NEGATIVE.ts': [
    'A1 builder rejects BLOCKED Forecast payload',
    'A2 builder rejects COMPLETED Forecast payload',
  ],
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
check(changed.every((file) => !file.startsWith('apps/server/src/persistence/')), 'no persistence changed');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('apps/server/src/projections/')), 'no projection changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-s5a/')), 'no diagnostic evidence committed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S5A branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S4 merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S5A governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
