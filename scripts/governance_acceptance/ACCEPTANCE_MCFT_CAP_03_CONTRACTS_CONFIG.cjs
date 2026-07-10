// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG.cjs
// Purpose: gate the exact MCFT-CAP-03 S1 contracts/config slice in draft, final-premerge, and merged-main postmerge contexts.
// Boundary: governance orchestration only; no observation selector, assimilation math, A2 tick, migration, route, scheduler, Forecast success, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '6389d4e566a6eb64ce96209be0e70cd8703be574';
const BRANCH = 'mcft-cap-03-assimilation-contracts-config-v1';
const SLICE = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1';
const NEXT_SLICE = 'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';

const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATION-CONTRACTS-CONFIG-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATION-CONTRACTS-CONFIG.md';

const EXACT_CHANGED_FILES = [
  'apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v1.ts',
  'apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v1.ts',
  CONTRACT_PATH,
  STATUS_PATH,
  DELIVERY_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_NEGATIVE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_DB.ts',
  'scripts/runtime_acceptance/mcft_cap_03_contracts_config_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_OBSERVATION_SELECTOR_IMPLEMENTED',
  'NO_OBSERVATION_SEMANTIC_DUPLICATE_RESOLUTION_IMPLEMENTED',
  'NO_OBSERVATION_SEMANTIC_CONTENT_HASH_IMPLEMENTED',
  'NO_ASSIMILATION_MATH_IMPLEMENTED',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  'NO_CAP_03_A2_TICK_COMMITTED',
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_72_HOUR_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_POLICY_EVALUATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATION_CANDIDATE',
  'NO_SHADOW_EVALUATION',
  'NO_MODEL_ACTIVATION',
  'NO_ACTIVE_MODEL_PARAMETER_CHANGE',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_CAP_03_COMPLETE_CLAIM',
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
    maxBuffer: 64 * 1024 * 1024,
  });
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function checkRequiredFiles() {
  for (const file of EXACT_CHANGED_FILES) check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

function checkExactBoundary() {
  const status = readJson(STATUS_PATH);
  const mergeCommit = status.merge_commit || null;
  const target = MODE === 'postmerge' ? mergeCommit : 'HEAD';
  if (MODE === 'postmerge') check(typeof mergeCommit === 'string' && /^[0-9a-f]{40}$/.test(mergeCommit), 'postmerge status records exact merge commit');
  if (!target) return;

  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, target], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, `${MODE} target descends from exact S0 merge baseline`);
  } catch {
    check(false, `${MODE} target descends from exact S0 merge baseline`);
  }

  if (MODE === 'postmerge') {
    try {
      cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', target, 'HEAD'], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      check(true, 'S1 merge commit is an ancestor of current main HEAD');
    } catch {
      check(false, 'S1 merge commit is an ancestor of current main HEAD');
    }
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...${target}`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact S1 changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('apps/server/src/domain/soil_water/')
      || file.startsWith('apps/server/src/persistence/twin_runtime/')
      || file.startsWith('fixtures/mcft/water_state/')
      || file.startsWith('.github/workflows/')
      || file.includes('/cap_02/'),
    );
    check(forbidden.length === 0, `no historical, migration, persistence, math, route, web, fixture, or workflow file changed: ${forbidden.join(',')}`);
    git(['diff', '--check', `${BASELINE}...${target}`]);
    check(true, 'S1 git diff --check PASS');
  } catch (error) {
    check(false, `S1 changed-file boundary available: ${error.message}`);
  }
}

function checkStatus() {
  const delivery = readJson(DELIVERY_PATH);
  const status = readJson(STATUS_PATH);
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);

  check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
  check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design frozen after effective S0');
  check(delivery.authorization_effective === true, 'CAP-03 authorization effective');
  check(delivery.runtime_source_authorized === true, 'S1 Runtime contract source authorized');
  check(delivery.active_delivery_slice_id === SLICE, 'S1 is the only active delivery slice');
  check(Boolean(current), 'S1 delivery declaration exists');
  check(current?.branch === BRANCH, 'S1 branch exact');
  check(current?.baseline_main_commit === BASELINE, 'S1 baseline exact');
  check(current?.primary_owner_work_package_id === 'MCFT-02', 'S1 primary owner exact');
  check(JSON.stringify(current?.contributing_owner_work_package_ids) === JSON.stringify(['MCFT-07', 'MCFT-08']), 'S1 contributors exact');
  check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify(['MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1']), 'S1 dependency exact');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'S1 exact changed-file boundary matches Gate');
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no parallel downstream slice authorized');
  check(next?.status === 'BLOCKED', 'S2 remains blocked before S1 merged-main effectiveness');
  check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

  if (MODE === 'draft') {
    check(status.status === 'IN_PROGRESS', 'draft S1 status IN_PROGRESS');
    check(current?.status === 'IN_PROGRESS', 'draft delivery S1 IN_PROGRESS');
  } else if (MODE === 'final') {
    check(status.status === 'READY_FOR_MERGE', 'final S1 status READY_FOR_MERGE');
    check(current?.status === 'READY_FOR_MERGE', 'final delivery S1 READY_FOR_MERGE');
  } else {
    check(status.status === 'MERGED', 'postmerge S1 status MERGED');
    check(current?.status === 'MERGED', 'postmerge delivery S1 MERGED');
    check(status.effectiveness_condition_satisfied === true, 'postmerge effectiveness recorded');
  }

  for (const nonclaim of PRESERVED_NONCLAIMS) {
    check(status.preserved_nonclaims?.includes(nonclaim), `status preserved nonclaim: ${nonclaim}`);
    check(current?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
  }
}

function checkContractDocument() {
  const document = readText(CONTRACT_PATH);
  for (const marker of [
    'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
    'HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION',
    'ContinuationAggregateIdentityInputV1',
    'ContinuationRecordSetV1',
    'UNKNOWN_RECORD_SET_CONTRACT',
    'VALIDATOR_DISPATCH_MISMATCH',
    'candidate_assimilation_gain',
    'applied_assimilation_gain',
    'D_MODEL_GOVERNANCE_STEP_COMMIT',
    'NO_ASSIMILATION_MATH_IMPLEMENTED',
  ]) check(document.includes(marker), `contract document marker: ${marker}`);
}

function checkSourceAnchors() {
  const contracts = readText('apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.ts');
  const identity = readText('apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_identity_v1.ts');
  const validator = readText('apps/server/src/domain/twin_runtime/assimilated_continuation_record_set_validator_v1.ts');
  const config = readText('apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.ts');
  const dispatch = readText('apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts');
  const authority = readText('apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_authority_adapter_v1.ts');
  const service = readText('apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v1.ts');

  check(contracts.includes('MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1'), 'CAP-03 discriminator implemented');
  check(contracts.includes('ASSIMILATION_STATUS_DISPOSITION_COMBINATION_INVALID'), 'legal update combinations enforced');
  check(contracts.includes('ASSIMILATION_CONSUMED_REFS_MUST_EQUAL_APPLIED_REFS'), 'applied/consumed evidence contract enforced');
  check(identity.includes('previous_forecast_result_ref'), 'aggregate identity includes predecessor Forecast result');
  check(identity.includes('record_set_contract_id'), 'aggregate identity includes discriminator');
  check(validator.includes('ASSIMILATED_AGGREGATE_HASH_MISMATCH'), 'CAP-03 aggregate validator implemented');
  check(config.includes('HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION'), 'CAP-03 config purpose implemented');
  check(config.includes('ASSIMILATED_DEFERRED_OBSERVATION_POLICY_FORBIDDEN'), 'deferred CAP-02 observation policy forbidden');
  check(config.includes('FAIL: 0'), 'FAIL quality weight frozen at zero');
  check(dispatch.includes('validateContinuationRecordSetV1'), 'historical CAP-02 validator retained in dispatch');
  check(dispatch.includes('UNKNOWN_RECORD_SET_CONTRACT'), 'unknown contract fails closed');
  check(dispatch.includes('VALIDATOR_DISPATCH_MISMATCH'), 'mismatched contract fails closed');
  check(authority.includes('predecessor_latest_state'), 'parent config authority comes from predecessor latest State');
  check(authority.includes('ASSIMILATED_STATE_PARENT_CONFIG_REF_MISMATCH'), 'latest State/config pin mismatch rejected');
  check(service.includes('commitAndVerify'), 'D transaction service verifies canonical readback');
}

function runTsxAcceptance(relativePath, summaryPattern, message) {
  try {
    const output = run(pnpmCommand(), ['-w', 'exec', 'tsx', relativePath]);
    process.stdout.write(output);
    check(summaryPattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

function runStaticAcceptance() {
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG.ts',
    /MCFT-CAP-03 contracts-config: \d+ PASS, 0 FAIL/,
    'S1 positive in-memory acceptance PASS',
  );
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_NEGATIVE.ts',
    /MCFT-CAP-03 contracts-config negative: \d+ PASS, 0 FAIL/,
    'S1 negative in-memory acceptance PASS',
  );
}

function runToolchainAndDatabase() {
  if (MODE !== 'final') return;
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

  if (process.env.MCFT_CAP_03_CONTRACTS_CONFIG_DESTRUCTIVE_ACCEPTANCE !== '1' || !process.env.DATABASE_URL) {
    check(false, 'final Gate requires isolated PostgreSQL D-transaction acceptance environment');
    return;
  }
  try {
    const output = run(
      pnpmCommand(),
      ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_CONTRACTS_CONFIG_DB.ts'],
      process.env,
    );
    process.stdout.write(output);
    check(/MCFT-CAP-03 contracts-config DB: \d+ PASS, 0 FAIL/.test(output), 'S1 PostgreSQL D-transaction acceptance PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'S1 PostgreSQL D-transaction acceptance PASS');
  }
}

function checkContext() {
  try {
    const branch = git(['branch', '--show-current']);
    if (MODE === 'postmerge') {
      check(branch === 'main', 'postmerge Gate runs on main');
      check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'refs/remotes/origin/main']), 'postmerge local main equals origin/main');
    } else {
      check(branch === BRANCH, `${MODE} Gate runs on S1 branch`);
    }
  } catch (error) {
    check(false, `Git context readable: ${error.message}`);
  }
}

checkRequiredFiles();
checkExactBoundary();
checkStatus();
checkContractDocument();
checkSourceAnchors();
runStaticAcceptance();
runToolchainAndDatabase();
checkContext();

console.log(`MCFT-CAP-03 contracts-config ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
