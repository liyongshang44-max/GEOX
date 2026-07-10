// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.cjs
// Purpose: gate the exact continuation Evidence Window slice, including merged-main Dynamics evidence, exact-hour contracts, fixtures, positive and negative acceptance, typecheck, and build.
// Boundary: governance orchestration only; no database continuation write, A2 commit, checkpoint advancement, Runtime tick orchestration, observation assimilation, successful Forecast, route, or scheduler.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'bc97acbd589c454b7417d6ed4567c103b655ee78';
const BRANCH = 'mcft-cap-02-continuation-evidence-window-v1';
const SLICE = 'MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-06.PURE-HOURLY-DYNAMICS-V1';
const PERSISTENCE_SLICE = 'MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-EVIDENCE-WINDOW-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_EVIDENCE_WINDOW_FIXTURES.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_CONTINUATION_EVIDENCE_WINDOW_PERSISTED',
  'NO_CONTINUATION_STATE_PERSISTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATED_CONFIDENCE_MODEL',
  'NO_MODEL_ACTIVATION',
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

function run(command, args) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    env: process.env,
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
    check(true, 'Evidence Window slice descends from verified Dynamics merge commit');
  } catch {
    check(false, 'Evidence Window slice descends from verified Dynamics merge commit');
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/src/persistence/twin_runtime/')
      || file.startsWith('apps/server/src/projections/twin_runtime/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('apps/server/scripts/mcft/')
      || file.startsWith('.github/workflows/'),
    );
    check(forbidden.length === 0, `no forbidden persistence, integration, route, runner, or workflow file changed: ${forbidden.join(',')}`);
    git(['diff', '--check', `${BASELINE}...HEAD`]);
    check(true, 'git diff --check PASS');
  } catch (error) {
    check(false, `changed-file boundary and diff check available: ${error.message}`);
  }
}

function checkStatus() {
  const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
  const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === PREDECESSOR_SLICE);
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  const persistence = delivery.slices.find((slice) => slice.delivery_slice_id === PERSISTENCE_SLICE);

  check(delivery.status === (MODE === 'draft' ? 'CONTINUATION_EVIDENCE_WINDOW_IN_PROGRESS' : 'CONTINUATION_EVIDENCE_WINDOW_READY_FOR_MERGE'), `${MODE} capability status exact`);
  check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit exact');
  check(delivery.active_delivery_slice_id === SLICE, 'continuation Evidence Window is active delivery slice');
  check(predecessor?.status === 'MERGED', 'Dynamics predecessor status MERGED');
  check(predecessor?.merge_commit === BASELINE, 'Dynamics predecessor merge commit exact');
  check(predecessor?.merged_main_acceptance?.final_gate === '66_PASS_0_FAIL', 'Dynamics merged-main Gate evidence exact');
  check(predecessor?.merged_main_acceptance?.positive_dynamics === '13_PASS_0_FAIL', 'Dynamics positive evidence exact');
  check(predecessor?.merged_main_acceptance?.negative_dynamics === '10_PASS_0_FAIL', 'Dynamics negative evidence exact');
  check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} Evidence Window slice status exact`);
  check(current?.branch === BRANCH, 'Evidence Window branch exact');
  check(current?.primary_owner_work_package_id === 'MCFT-05', 'Evidence Window primary owner exact');
  check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), 'Evidence Window dependency exact');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'Evidence Window exact changed-file boundary matches Gate');
  check(persistence?.status === 'BLOCKED', 'continuation persistence remains blocked');
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice is authorized while Evidence Window is active');
  check(delivery.completion_claims?.includes('PURE_HOURLY_DYNAMICS_MERGED_MAIN_VERIFIED'), 'Dynamics merged-main completion claim recorded');
  for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
}

function checkContractAndFixtures() {
  const contract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-EVIDENCE-WINDOW-CONTRACT.json');
  const fixture = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_02_EVIDENCE_WINDOW_FIXTURES.json');
  const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE_FIXTURES.json');
  check(contract.window?.policy_id === 'OPEN_START_CLOSED_END_PT1H_V1', 'open-start closed-end PT1H window contract frozen');
  check(contract.exact_hour_interval_policy?.policy_id === 'EXACT_INTERVAL_START_END_MATCH_V1', 'exact-hour interval policy frozen');
  check(contract.exact_hour_interval_policy?.zero_substitution_forbidden === true, 'missing rainfall or ET0 cannot be silently zero-filled');
  check(contract.duplicate_policy?.conflicting_duplicate_reason_code === 'CONFLICTING_DUPLICATE_EVIDENCE', 'conflicting duplicate failure contract frozen');
  check(contract.crop_stage_context?.context_hash === 'sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce', 'crop-stage context hash frozen');
  check(contract.crop_stage_context?.evidence_record === false, 'crop-stage context remains configuration, not Evidence');
  check(contract.role_contracts?.APPROVED_IRRIGATION_PLAN?.physical_input_forbidden === true, 'approved plan physical input forbidden');
  check(contract.role_contracts?.SOIL_MOISTURE_OBSERVATION?.innovation_computation_forbidden === true, 'soil observation innovation forbidden');
  check(fixture.expected?.rainfall_record_ref === 'rain_exact_winner', 'positive fixture freezes deterministic rainfall winner');
  check(fixture.expected?.historical_et0_record_ref === 'et0_exact', 'positive fixture freezes exact ET0 input');
  check(fixture.expected?.irrigation_execution_count === 0, 'positive base fixture distinguishes no execution event from missing sensor input');
  check(negative.cases?.length >= 12, 'negative fixture coverage has at least twelve cases');
}

function checkSourceAnchors() {
  const source = readText('apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts');
  const predecessorGate = readText('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.cjs');
  check(source.includes('MISSING_EXACT_HOURLY_RAINFALL_INTERVAL'), 'missing exact-hour rainfall fails closed');
  check(source.includes('MISSING_EXACT_HOURLY_ET0_INTERVAL'), 'missing exact-hour ET0 fails closed');
  check(source.includes('CONFLICTING_DUPLICATE_EVIDENCE'), 'semantic duplicate conflict fails closed');
  check(source.includes('INGESTED_DESC_SOURCE_RECORD_ID_ASC_V1'), 'identical duplicate winner policy implemented');
  check(source.includes('CONTEXT_ONLY_NOT_EXECUTED'), 'approved irrigation plan non-consumption implemented');
  check(source.includes('AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED'), 'future assumption non-consumption implemented');
  check(source.includes('CONFIGURATION_EFFECTIVE_INTERVAL_AT_LOGICAL_TIME_V1'), 'crop-stage resolution policy implemented');
  check(source.includes('planned_amount_mm') && source.includes('approved_amount_mm') && source.includes('dispatched_amount_mm'), 'non-executed irrigation amounts explicitly forbidden');
  check(!source.includes('Postgres') && !source.includes('Fastify') && !source.includes('process.env'), 'Evidence Window service excludes infrastructure and environment dependencies');
  check(predecessorGate.includes('--postmerge'), 'Dynamics Gate has explicit postmerge mode');
  check(predecessorGate.includes('continuation Evidence Window is the only active delivery slice'), 'Dynamics postmerge Gate distinguishes active Evidence Window state');
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
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.ts',
    /MCFT-CAP-02 evidence-window: \d+ PASS, 0 FAIL/,
    'Evidence Window positive acceptance PASS',
  );
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW_NEGATIVE.ts',
    /MCFT-CAP-02 evidence-window negative: \d+ PASS, 0 FAIL/,
    'Evidence Window negative acceptance PASS',
  );
}

function runFinalChecks() {
  if (MODE !== 'final') return;
  try {
    const output = run(process.platform === 'win32' ? 'node.exe' : 'node', [
      'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_DYNAMICS.cjs',
      '--postmerge',
    ]);
    process.stdout.write(output);
    check(/MCFT-CAP-02 dynamics postmerge: \d+ PASS, 0 FAIL/.test(output), 'Dynamics explicit postmerge Gate PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'Dynamics explicit postmerge Gate PASS');
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
checkStatus();
checkContractAndFixtures();
checkSourceAnchors();
runAcceptances();
runFinalChecks();

console.log(`MCFT-CAP-02 evidence-window ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
