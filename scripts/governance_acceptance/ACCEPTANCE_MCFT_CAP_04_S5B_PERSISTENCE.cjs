// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5B_PERSISTENCE.cjs
// Purpose: verify the exact MCFT-CAP-04 S5B persistence/uniqueness/recovery boundary, S5A merged-main effectiveness, one migration, canonical facts authority, and preserved nonclaims.
// Boundary: repository governance verification only; no database mutation, Forecast math, Scenario math, orchestration, route, scheduler, or field claim.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '2c6a0834488f367eb927430a15c9590c1bf348a3';
const BRANCH = 'agent/mcft-cap-04-s5b-persistence-uniqueness-recovery-v1';
const S5A = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const S6 = 'MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1';
const TASK_SHA = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MIGRATION = 'apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--final') ? 'final' : 'draft';

const FILES = [
  MIGRATION,
  'apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
  'apps/server/src/projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts',
  'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PERSISTENCE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5B_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_persistence_fixture_v1.ts',
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

const s5aStatus = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json');
const s5bStatus = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json');
const persistence = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PERSISTENCE-MATRIX.json');
const delivery = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json');
const authorization = json('docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const s5a = delivery.slices.find((slice) => slice.delivery_slice_id === S5A);
const s5b = delivery.slices.find((slice) => slice.delivery_slice_id === S5B);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);

check(s5aStatus.status === 'MERGED_EFFECTIVE', 'S5A status merged effective');
check(s5aStatus.effectiveness_condition_satisfied === true, 'S5A effectiveness satisfied');
check(s5aStatus.merge_evidence.pr_number === 2392, 'S5A PR exact');
check(s5aStatus.merge_evidence.exact_head_commit === 'd8c9feefcf891147692bbcfb223813129578b825', 'S5A exact head exact');
check(s5aStatus.merge_evidence.exact_head_ci_run === 29227610603, 'S5A exact-head CI exact');
check(s5aStatus.merge_evidence.merge_commit === BASELINE, 'S5A merge commit exact');
check(s5aStatus.merge_evidence.postmerge_probe_pr_number === 2393, 'S5A postmerge probe PR exact');
check(s5aStatus.merge_evidence.postmerge_workflow_run === 29228386162, 'S5A postmerge workflow exact');
check(s5aStatus.merge_evidence.postmerge_gate === 'PASS', 'S5A postmerge Gate PASS');

check(s5bStatus.status === 'IMPLEMENTATION_CANDIDATE', 'S5B status candidate exact');
check(s5bStatus.baseline_main_commit === BASELINE, 'S5B baseline exact');
check(s5bStatus.branch === BRANCH, 'S5B branch exact');
check(s5bStatus.activation_fields_status === 'FROZEN', 'S5B activation fields frozen');
check(s5bStatus.runtime_source_authorized === true, 'S5B Runtime source authorized');
check(s5bStatus.contracts.additive_migration_count === 1, 'S5B additive migration count one');
check(s5bStatus.contracts.canonical_store_authority === 'public.facts', 'S5B canonical store authority exact');
check(s5bStatus.contracts.a1_member_count === 8 && s5bStatus.contracts.a2_member_count === 8 && s5bStatus.contracts.b_member_count === 1, 'S5B canonical member counts exact');
exactSet(s5bStatus.exact_changed_file_boundary, FILES, 'S5B status changed-file boundary');

check(persistence.canonical_store.authority === 'public.facts', 'persistence matrix canonical authority facts');
check(persistence.canonical_store.second_canonical_store_forbidden === true, 'second canonical store forbidden');
check(persistence.additive_migration.count === 1 && persistence.additive_migration.path === MIGRATION, 'persistence matrix migration exact');
check(persistence.transactions.A1.atomic === true && persistence.transactions.A2.atomic === true && persistence.transactions.B.atomic === true, 'A1/A2/B transactions atomic');
check(persistence.guards.cross_variant_terminal_tick_uniqueness === 'twin_terminal_tick_uniqueness_v1', 'terminal uniqueness guard exact');
check(persistence.guards.scenario_set_canonical_uniqueness === 'twin_scenario_set_uniqueness_v1', 'Scenario uniqueness guard exact');
check(persistence.projections.rebuildable === true, 'Forecast and Scenario projections rebuildable');

check(delivery.status === 'S5B_IMPLEMENTATION_CANDIDATE', 'delivery status S5B candidate');
check(delivery.baseline_main_commit === BASELINE && delivery.branch === BRANCH, 'delivery activation identity exact');
check(delivery.active_delivery_slice_id === S5B, 'delivery active slice S5B');
check(s5a.status === 'MERGED_EFFECTIVE' && s5a.effectiveness_condition_satisfied === true, 'delivery S5A merged effective');
check(s5b.status === 'IMPLEMENTATION_CANDIDATE' && s5b.runtime_source_authorized === true && s5b.activation_fields_status === 'FROZEN', 'delivery S5B activated and frozen');
exactSet(s5b.exact_changed_file_boundary, FILES, 'delivery S5B changed-file boundary');
check(s6.status === 'BLOCKED' && s6.runtime_source_authorized === false, 'S6 remains blocked');

check(authorization.status === 'AUTHORIZATION_EFFECTIVE', 'authorization remains effective');
check(authorization.active_delivery_slice_id === S5B, 'authorization active S5B');
check(authorization.repository_write_scope === 'S5B_PERSISTENCE_UNIQUENESS_RECOVERY_ONLY', 'authorization write scope S5B exact');
check(cap04.status === 'IN_PROGRESS' && cap04.design_status === 'DESIGN_FROZEN', 'matrix CAP-04 remains in progress and frozen');
check(cap04.active_delivery_slice_id === S5B && cap04.next_delivery_slice_id === S6 && cap04.next_delivery_slice_authorized === false, 'matrix delivery pointers exact');

for (const [file, markers] of Object.entries({
  [MIGRATION]: ['A1_RECORD_SET','B_SCENARIO_SET','twin_terminal_tick_uniqueness_v1','twin_scenario_set_uniqueness_v1','twin_forecast_run_projection_v1','twin_scenario_set_projection_v1'],
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts': ['commitARecordSet','commitScenarioSet','TERMINAL_TICK_VARIANT_CONFLICT','SCENARIO_SET_CANONICAL_UNIQUENESS_CONFLICT','detectPendingScenario','rebuildForecastProjections','rebuildScenarioProjections'],
  'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts': ['buildCap04ScenarioSetRecordV1','validateCap04ScenarioSetPayloadV1','deriveCap04ScenarioSetIdentityV1'],
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts': ['A1 fault injection rolls back','B fault injection rolls back','pending Scenario recovery','projections rebuild exactly'],
})) {
  const content = read(file);
  for (const marker of markers) check(content.includes(marker), `${file} marker ${marker}`);
}

const changedRange = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
const tracked = git(['diff', '--name-only', changedRange]).split(/\r?\n/).filter(Boolean);
const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const changed = [...new Set([...tracked, ...untracked])].sort();
exactSet(changed, FILES, `${MODE} changed-file boundary`);
const migrations = changed.filter((file) => file.startsWith('apps/server/db/migrations/'));
check(migrations.length === 1 && migrations[0] === MIGRATION, 'exactly one additive CAP-04 migration changed');
check(changed.filter((file) => file.startsWith('apps/server/src/persistence/')).every((file) => file === 'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts'), 'persistence implementation boundary exact');
check(changed.filter((file) => file.startsWith('apps/server/src/projections/')).every((file) => file === 'apps/server/src/projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.ts'), 'projection implementation boundary exact');
check(changed.every((file) => !file.startsWith('apps/server/src/routes/')), 'no route changed');
check(changed.every((file) => !file.startsWith('apps/web/')), 'no web changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-s5b/')), 'no diagnostic evidence committed');
check(changed.every((file) => !file.includes('S5B-WIP') && !file.includes('S5B-DIAGNOSTIC') && !file.includes('S5B-PR-NOTE') && !file.includes('S5B-README')), 'no diagnostic-only documents committed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on S5B branch`);
  check(git(['rev-parse', 'origin/main']) === BASELINE, `${MODE} origin/main equals S5A merge baseline`);
}
try { git(['diff', '--check', changedRange]); check(true, 'git diff --check PASS'); }
catch { check(false, 'git diff --check PASS'); }

console.log(`MCFT-CAP-04 S5B governance ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
