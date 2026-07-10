// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.cjs
// Purpose: gate the exact MCFT-CAP-02 pure hourly Dynamics slice, including governance-debt preflight, fixed-point math, fixtures, negative coverage, typecheck, and build.
// Boundary: governance orchestration only; no Evidence selection, database continuation write, checkpoint advancement, Runtime tick, successful Forecast, route, or scheduler.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '2be7c985210d1f34fa5249e1fae68932e801facc';
const BRANCH = 'mcft-cap-02-pure-hourly-dynamics-v1';
const SLICE = 'MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-02.CONTINUATION-CONTRACTS-CONFIG-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/domain/soil_water/additive_process_uncertainty_budget_v1.ts',
  'apps/server/src/domain/soil_water/executed_irrigation_input_v1.ts',
  'apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.ts',
  'apps/server/src/domain/soil_water/hourly_water_balance_v1.ts',
  'apps/server/src/domain/soil_water/water_mass_balance_trace_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DYNAMICS-MATH-CONTRACT.md',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-GOVERNANCE-DEBT-REGISTER.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_DYNAMICS_FIXTURES.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS_NEGATIVE.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_CONTINUATION_EVIDENCE_WINDOW_SELECTION_IMPLEMENTED',
  'NO_CONTINUATION_STATE_PERSISTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_DYNAMIC_ROOT_ZONE_GEOMETRY',
  'NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_CONTINUOUS_SCHEDULER',
  'NO_720_TICK_REPLAY_CLOSURE',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MCFT_GATE_B_CLOSURE',
  'NO_MCFT_GATE_C_CLOSURE',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
];

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

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function git(args) {
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function run(command, args, env = process.env) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function checkBoundary() {
  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, 'Dynamics slice descends from verified contracts/config merge commit');
  } catch {
    check(false, 'Dynamics slice descends from verified contracts/config merge commit');
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/src/runtime/twin_runtime/')
      || file.startsWith('apps/server/src/persistence/twin_runtime/')
      || file.startsWith('apps/server/src/projections/twin_runtime/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('.github/workflows/'),
    );
    check(forbidden.length === 0, `no forbidden integration or persistence file changed: ${forbidden.join(',')}`);
    git(['diff', '--check', `${BASELINE}...HEAD`]);
    check(true, 'git diff --check PASS');
  } catch (error) {
    check(false, `changed-file boundary and diff check available: ${error.message}`);
  }
}

function checkStatusAndDebt() {
  const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
  const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === PREDECESSOR_SLICE);
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  const debtRegister = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-GOVERNANCE-DEBT-REGISTER.json');
  const debt = debtRegister.debts?.find((candidate) => candidate.debt_id === 'MCFT-CAP-02.GOV-DEBT-001');

  check(delivery.status === (MODE === 'draft' ? 'PURE_HOURLY_DYNAMICS_IN_PROGRESS' : 'PURE_HOURLY_DYNAMICS_READY_FOR_MERGE'), `${MODE} capability status exact`);
  check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit exact');
  check(delivery.active_delivery_slice_id === SLICE, 'pure hourly Dynamics is active delivery slice');
  check(predecessor?.status === 'MERGED', 'contracts/config predecessor status MERGED');
  check(predecessor?.merge_commit === BASELINE, 'contracts/config predecessor merge commit exact');
  check(predecessor?.merged_main_acceptance?.final_gate === '63_PASS_0_FAIL', 'contracts/config merged-main Gate evidence exact');
  check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} Dynamics slice status exact`);
  check(current?.branch === BRANCH, 'Dynamics branch exact');
  check(current?.primary_owner_work_package_id === 'MCFT-06', 'Dynamics primary owner exact');
  check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), 'Dynamics dependency exact');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'Dynamics exact changed-file boundary matches Gate');
  check(debt?.status === 'REMEDIATED_IN_DYNAMICS_PREFLIGHT', 'governance debt status remediated in Dynamics preflight');
  check(debt?.remediation_deadline === 'BEFORE_FIRST_DYNAMICS_SOURCE_COMMIT', 'governance debt remediation deadline explicit');
  check(debt?.evidence?.merged_main_gate === '63_PASS_0_FAIL', 'governance debt merged-main evidence exact');
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'Evidence Window slice remains unauthorized while Dynamics is active');
  for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
}

function checkContractsAndFixtures() {
  const contract = readText('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DYNAMICS-MATH-CONTRACT.md');
  const fixtures = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_02_DYNAMICS_FIXTURES.json');
  const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_NEGATIVE_FIXTURES.json');
  check(contract.includes('DECIMAL_HALF_AWAY_FROM_ZERO_V1'), 'fixed-point rounding contract frozen');
  check(contract.includes('previous_storage\n+ gross_rainfall\n+ effective_irrigation'), 'mass-balance invariant documented');
  check(contract.includes('CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1'), 'additive uncertainty contract frozen');
  check(fixtures.scenarios?.length === 5, 'five required positive Dynamics fixture classes exist');
  check(negative.cases?.length >= 10, 'negative Dynamics fixture coverage exists');
  check(fixtures.config?.root_zone_depth_mm === '300.000000', 'fixture governed root-zone depth exact');
  check(fixtures.config?.structural_process_stddev_mm_per_hour === '0.500000', 'fixture structural uncertainty nonzero');
}

function checkSourceAnchors() {
  const fixed = readText('apps/server/src/domain/soil_water/fixed_point_water_decimal_v1.ts');
  const irrigation = readText('apps/server/src/domain/soil_water/executed_irrigation_input_v1.ts');
  const trace = readText('apps/server/src/domain/soil_water/water_mass_balance_trace_v1.ts');
  const uncertainty = readText('apps/server/src/domain/soil_water/additive_process_uncertainty_budget_v1.ts');
  const dynamics = readText('apps/server/src/domain/soil_water/hourly_water_balance_v1.ts');
  const predecessorGate = readText('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs');

  check(fixed.includes('BigInt') || fixed.includes('bigint'), 'fixed-point implementation uses BigInt');
  check(!fixed.includes('.toFixed('), 'fixed-point implementation does not use toFixed as authority');
  check(fixed.includes('divideBigIntHalfAwayFromZeroV1'), 'half-away-from-zero integer division implemented');
  check(irrigation.includes('CONFLICTING_DUPLICATE_EVIDENCE'), 'execution duplicate conflict rejection implemented');
  check(irrigation.includes('approved_amount_mm') && irrigation.includes('planned_amount_mm') && irrigation.includes('dispatched_amount_mm'), 'non-executed irrigation amount keys explicitly rejected');
  check(trace.includes('WATER_MASS_BALANCE_NOT_CLOSED'), 'exact mass-balance closure enforced');
  check(trace.includes('WATER_MASS_BALANCE_TRACE_SELF_HASH_FORBIDDEN'), 'recursive trace self-hash rejected');
  check(uncertainty.includes('UNCERTAINTY_STRUCTURAL_STDDEV_ZERO_FORBIDDEN'), 'zero structural uncertainty rejected');
  check(uncertainty.includes('CONTINUATION_SUBSEQUENT_TICK_VARIANCE_REDERIVATION_FORBIDDEN'), 'subsequent VWC variance rederivation rejected');
  check(dynamics.includes('DYNAMICS_GOVERNED_ROOT_DEPTH_MUST_BE_300MM'), 'fixed governed 300 mm control volume enforced');
  check(dynamics.includes('buildHourlyWaterBalanceConfigFromContinuationRuntimeConfigV1'), 'Dynamics config derived from continuation Runtime Config');
  check(!dynamics.includes('Postgres') && !dynamics.includes('Fastify'), 'pure Dynamics source excludes infrastructure dependencies');
  check(predecessorGate.includes("--postmerge"), 'contracts/config Gate has explicit postmerge mode');
  check(predecessorGate.includes('no additional downstream slice authorized while Dynamics is active'), 'postmerge Gate message distinguishes active Dynamics state');
}

function runTsx(relativePath, pattern, message) {
  try {
    const output = run(pnpmCommand(), ['exec', 'tsx', relativePath]);
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

function runAcceptances() {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.ts',
    /MCFT-CAP-02 dynamics: \d+ PASS, 0 FAIL/,
    'pure Dynamics positive acceptance PASS',
  );
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS_NEGATIVE.ts',
    /MCFT-CAP-02 dynamics negative: \d+ PASS, 0 FAIL/,
    'pure Dynamics negative acceptance PASS',
  );
}

function runFinalChecks() {
  if (MODE !== 'final') return;
  try {
    const output = run(process.platform === 'win32' ? 'node.exe' : 'node', [
      'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG.cjs',
      '--postmerge',
    ]);
    process.stdout.write(output);
    check(/MCFT-CAP-02 contracts-config postmerge: \d+ PASS, 0 FAIL/.test(output), 'contracts/config explicit postmerge remediation Gate PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'contracts/config explicit postmerge remediation Gate PASS');
  }

  for (const [label, args] of [
    ['server typecheck', ['--filter', '@geox/server', 'typecheck']],
    ['server build', ['--filter', '@geox/server', 'build']],
  ]) {
    try {
      const output = run(pnpmCommand(), args);
      process.stdout.write(output);
      check(true, `${label} PASS`);
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, `${label} PASS`);
    }
  }
}

checkBoundary();
checkStatusAndDebt();
checkContractsAndFixtures();
checkSourceAnchors();
runAcceptances();
runFinalChecks();

console.log(`MCFT-CAP-02 dynamics ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
