// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs
// Purpose: retain the historical continuation Persistence Gate and provide explicit postmerge predecessor proof for later MCFT-CAP-02 delivery slices.
// Boundary: governance verification only; no candidate construction, tick orchestration, range, restart, scheduler, route, Forecast success, Recommendation, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '869593d269b5175b216ce494b55b4b121db45190';
const MERGE_COMMIT = '1b7ea8058b097b5f5fcc4bf1566462c381bc6d47';
const SLICE = 'MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1';
const NEXT_SLICE = 'MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1';
const POSTMERGE = process.argv.includes('--postmerge');

const EXACT_CHANGED_FILES = [
  'apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql',
  'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts',
  'apps/server/src/projections/twin_runtime/projection_rebuilder_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PERSISTENCE-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_PERSISTENCE_FIXTURES.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_PERSISTENCE_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_persistence_fixture_v1.ts',
].sort();

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

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function runTsx(relativePath, pattern, message) {
  try {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const output = cp.execFileSync(command, ['exec', 'tsx', relativePath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

if (!POSTMERGE) {
  console.error('Persistence is merged; use --postmerge for historical predecessor verification.');
  process.exit(1);
}

try {
  cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', MERGE_COMMIT, 'HEAD'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  check(true, 'Persistence merge commit is an ancestor of current HEAD');
} catch {
  check(false, 'Persistence merge commit is an ancestor of current HEAD');
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...${MERGE_COMMIT}`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), 'historical Persistence changed-file set has 14 files');
  git(['diff', '--check', `${BASELINE}...${MERGE_COMMIT}`]);
  check(true, 'historical Persistence git diff --check PASS');
} catch (error) {
  check(false, `historical Persistence boundary available: ${error.message}`);
}

const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const persistence = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);
check(delivery.latest_verified_main_commit === MERGE_COMMIT, 'latest verified main commit is Persistence merge commit');
check(delivery.active_delivery_slice_id === NEXT_SLICE, 'active slice advanced to Single-Tick Integration');
check(delivery.status === 'SINGLE_TICK_INTEGRATION_IN_PROGRESS' || delivery.status === 'SINGLE_TICK_INTEGRATION_READY_FOR_MERGE', 'postmerge capability advanced to Single-Tick Integration');
check(persistence?.status === 'MERGED', 'Persistence status MERGED');
check(persistence?.merge_commit === MERGE_COMMIT, 'Persistence merge commit exact');
check(persistence?.merged_main_acceptance?.final_gate === '86_PASS_0_FAIL', 'Persistence merged-main final Gate evidence exact');
check(persistence?.merged_main_acceptance?.postgres_persistence === '15_PASS_0_FAIL', 'Persistence merged-main PostgreSQL evidence exact');
check(persistence?.merged_main_acceptance?.pure_persistence === '9_PASS_0_FAIL', 'Persistence positive evidence exact');
check(persistence?.merged_main_acceptance?.negative_persistence === '20_PASS_0_FAIL', 'Persistence negative evidence exact');
check(JSON.stringify([...(persistence?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'Persistence historical changed-file boundary retained');
check(next?.status === 'IN_PROGRESS' || next?.status === 'READY_FOR_MERGE', 'Single-Tick is the only active delivery slice in an allowed premerge state');
check(next?.branch === 'mcft-cap-02-single-tick-integration-v1', 'Single-Tick branch exact');
check(JSON.stringify(next?.depends_on_delivery_slice_ids) === JSON.stringify([SLICE]), 'Single-Tick dependency exact');
check(delivery.completion_claims?.includes('CONTINUATION_PERSISTENCE_MERGED_MAIN_VERIFIED'), 'Persistence merged-main completion claim recorded');
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id !== NEXT_SLICE && slice.depends_on_delivery_slice_ids?.includes(NEXT_SLICE)) {
    check(slice.status === 'BLOCKED', `${slice.delivery_slice_id} remains blocked`);
  }
}

const repository = readText('apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts');
check(repository.includes('async commitContinuationState'), 'continuation commit method retained');
check(repository.includes("identity_kind='A2_RECORD_SET'"), 'A2 idempotency guard retained');
check(repository.includes('CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT'), 'canonical uniqueness recovery retained');
check(repository.includes('STATE_LATEST_CAS_CONFLICT') && repository.includes('CHECKPOINT_CAS_CONFLICT') && repository.includes('FORECAST_RESULT_CAS_CONFLICT'), 'State, checkpoint, and Forecast CAS guards retained');

runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.ts',
  /MCFT-CAP-02 persistence: 9 PASS, 0 FAIL/,
  'Persistence pure acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_NEGATIVE.ts',
  /MCFT-CAP-02 persistence negative: 20 PASS, 0 FAIL/,
  'Persistence negative acceptance PASS',
);

console.log(`MCFT-CAP-02 persistence postmerge: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
