// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER.cjs
// Purpose: gate the exact MCFT-CAP-03 S3A pure assimilated A2 record-set builder slice in draft, final-premerge, and merged-main postmerge contexts.
// Boundary: governance orchestration only; no database, persistence, lease, canonical write, Runtime tick execution, migration, route, scheduler, Forecast success, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'be5a0c00ae7d29d1bd2ccffe5a4235f20d23352a';
const BRANCH = 'mcft-cap-03-assimilated-a2-record-set-builder-v1';
const S2 = 'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1';
const SLICE = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1';
const NEXT_SLICE = 'MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1';
const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--draft')
    ? 'draft'
    : 'final';

const DELIVERY_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-RECORD-SET-BUILDER-STATUS.json';
const CONTRACT_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-RECORD-SET-BUILDER.md';

const EXACT_CHANGED_FILES = [
  'apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.ts',
  'apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.ts',
  DELIVERY_PATH,
  STATUS_PATH,
  CONTRACT_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_assimilated_record_set_builder_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_CAP_03_A2_TICK_COMMITTED',
  'NO_PERSISTENCE_CHANGE',
  'NO_DATABASE_ACCESS',
  'NO_SINGLE_TICK_INTEGRATION',
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

function run(command, args) {
  return cp.execFileSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function checkFilesAndBoundary() {
  for (const file of EXACT_CHANGED_FILES) {
    check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
  }
  const status = readJson(STATUS_PATH);
  const mergeCommit = status.merge_commit || null;
  const target = MODE === 'postmerge' ? mergeCommit : 'HEAD';
  if (MODE === 'postmerge') {
    check(
      typeof mergeCommit === 'string' && /^[0-9a-f]{40}$/.test(mergeCommit),
      'postmerge status records exact S3A merge commit',
    );
  }
  if (!target) return;

  try {
    cp.execFileSync(
      process.platform === 'win32' ? 'git.exe' : 'git',
      ['merge-base', '--is-ancestor', BASELINE, target],
      { cwd: ROOT, stdio: 'ignore' },
    );
    check(true, `${MODE} target descends from exact S2 postmerge baseline`);
  } catch {
    check(false, `${MODE} target descends from exact S2 postmerge baseline`);
  }

  if (MODE === 'postmerge') {
    try {
      cp.execFileSync(
        process.platform === 'win32' ? 'git.exe' : 'git',
        ['merge-base', '--is-ancestor', target, 'HEAD'],
        { cwd: ROOT, stdio: 'ignore' },
      );
      check(true, 'S3A merge commit is an ancestor of current main HEAD');
    } catch {
      check(false, 'S3A merge commit is an ancestor of current main HEAD');
    }
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...${target}`])
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();
    check(
      JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES),
      `exact S3A changed-file set has ${EXACT_CHANGED_FILES.length} files`,
    );
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('apps/server/src/persistence/')
      || file.startsWith('fixtures/mcft/')
      || file.startsWith('.github/workflows/')
      || file.includes('/cap_02/')
      || file.endsWith('/continuation_record_set_builder_v1.ts')
      || file.endsWith('/continuation_cross_ref_validator_v1.ts')
      || file.endsWith('/continuation_tick_service_v1.ts'),
    );
    check(
      forbidden.length === 0,
      `no CAP-02, persistence, tick, migration, route, web, fixture, or workflow file changed: ${forbidden.join(',')}`,
    );
    git(['diff', '--check', `${BASELINE}...${target}`]);
    check(true, 'S3A git diff --check PASS');
  } catch (error) {
    check(false, `S3A changed-file boundary available: ${error.message}`);
  }
}

function checkStatus() {
  const delivery = readJson(DELIVERY_PATH);
  const status = readJson(STATUS_PATH);
  const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === S2);
  const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
  const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);

  check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
  check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
  check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
  check(predecessor?.status === 'MERGED', 'S2 delivery status MERGED');
  check(
    predecessor?.merge_commit === 'd3cf896cfa02e146a1729bf5b22337aafb9fa0d5',
    'S2 merge commit exact',
  );
  check(predecessor?.merged_main_gate === 'PASS', 'S2 merged-main Gate PASS');
  check(
    predecessor?.effectiveness_condition_satisfied === true,
    'S2 effectiveness condition satisfied',
  );
  check(delivery.active_delivery_slice_id === SLICE, 'S3A is the only active delivery slice');
  check(current?.branch === BRANCH, 'S3A branch exact');
  check(current?.baseline_main_commit === BASELINE, 'S3A baseline exact');
  check(current?.primary_owner_work_package_id === 'MCFT-02', 'S3A primary owner exact');
  check(
    JSON.stringify(current?.contributing_owner_work_package_ids)
      === JSON.stringify(['MCFT-07', 'MCFT-08']),
    'S3A contributors exact',
  );
  check(
    JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([S2]),
    'S3A dependency exact',
  );
  check(current?.activation_fields_status === 'FROZEN', 'S3A activation fields frozen');
  check(
    JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort())
      === JSON.stringify(EXACT_CHANGED_FILES),
    'S3A exact changed-file boundary matches Gate',
  );
  check(
    Array.isArray(delivery.next_authorized_slice_ids)
      && delivery.next_authorized_slice_ids.length === 0,
    'no parallel downstream slice authorized',
  );
  check(next?.status === 'BLOCKED', 'S3B remains blocked before S3A effectiveness');
  check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

  check(status.baseline_main_commit === BASELINE, 'S3A status baseline exact');
  check(status.branch === BRANCH, 'S3A status branch exact');
  check(
    status.predecessor_effectiveness?.s2_merged_main_gate === 'PASS_107_OF_107',
    'S2 local postmerge evidence recorded',
  );
  check(status.successor_authorized === false, 'S3A status does not authorize S3B');

  if (MODE === 'draft') {
    check(status.status === 'IN_PROGRESS', 'draft S3A status IN_PROGRESS');
    check(current?.status === 'IN_PROGRESS', 'draft delivery S3A IN_PROGRESS');
  } else if (MODE === 'final') {
    check(status.status === 'READY_FOR_MERGE', 'final S3A status READY_FOR_MERGE');
    check(current?.status === 'READY_FOR_MERGE', 'final delivery S3A READY_FOR_MERGE');
  } else {
    check(status.status === 'MERGED', 'postmerge S3A status MERGED');
    check(current?.status === 'MERGED', 'postmerge delivery S3A MERGED');
    check(
      status.effectiveness_condition_satisfied === true,
      'postmerge S3A effectiveness recorded',
    );
  }

  for (const nonclaim of PRESERVED_NONCLAIMS) {
    check(status.preserved_nonclaims?.includes(nonclaim), `status preserved nonclaim: ${nonclaim}`);
    check(current?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
  }
}

function checkContractAndSources() {
  const document = readText(CONTRACT_PATH);
  for (const marker of [
    'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
    'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1',
    'A_STATE_TICK_COMMIT',
    'A2_BLOCKED_FORECAST',
    'CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST',
    'NO_CAP_03_A2_TICK_COMMITTED',
    'NO_PERSISTENCE_CHANGE',
    'NO_DATABASE_ACCESS',
  ]) {
    check(document.includes(marker), `contract document marker: ${marker}`);
  }

  const builder = readText(
    'apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.ts',
  );
  const validator = readText(
    'apps/server/src/domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.ts',
  );
  const dispatch = readText(
    'apps/server/src/domain/twin_runtime/continuation_record_set_dispatch_v1.ts',
  );
  check(
    builder.includes('buildAssimilatedContinuationRecordSetIdentityV1'),
    'builder uses versioned CAP-03 aggregate identity',
  );
  check(
    builder.includes(
      'record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1',
    ),
    'Tick discriminator is constructed explicitly',
  );
  check(
    builder.includes('validateAssimilatedContinuationCrossReferencesV1(recordSet)'),
    'builder validates the complete graph before return',
  );
  check(
    builder.includes('roundDecimalHalfAwayFromZeroV1'),
    'builder canonicalizes published numeric payload values once',
  );
  check(
    validator.includes('validateAssimilatedContinuationRecordSetV1(recordSet)'),
    'cross-reference validator composes S1 contract validation',
  );
  check(
    validator.includes('ASSIMILATED_EVIDENCE_CONSUMED_UNION_MISMATCH'),
    'Evidence consumed-union invariant is enforced',
  );
  check(
    validator.includes('ASSIMILATED_STATE_POSTERIOR_MEAN_MISMATCH'),
    'posterior State authority is enforced',
  );
  check(
    validator.includes('ASSIMILATED_HEALTH_STATUS_DISPOSITION_MISMATCH'),
    'Health status follows assimilation disposition',
  );
  check(dispatch.includes('validateContinuationRecordSetV1'), 'historical CAP-02 dispatch remains present');
  check(
    dispatch.includes('validateAssimilatedContinuationCrossReferencesV1'),
    'CAP-03 dispatch uses the full S3A validator',
  );
  check(
    !builder.includes('pool.query') && !builder.includes('process.env'),
    'builder contains no database or environment access',
  );
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

function runAcceptanceAndToolchain() {
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER.ts',
    /MCFT-CAP-03 assimilated record-set builder: \d+ PASS, 0 FAIL/,
    'S3A positive in-memory acceptance PASS',
  );
  runTsxAcceptance(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_RECORD_SET_BUILDER_NEGATIVE.ts',
    /MCFT-CAP-03 assimilated record-set builder negative: \d+ PASS, 0 FAIL/,
    'S3A negative in-memory acceptance PASS',
  );

  if (MODE !== 'draft') {
    try {
      process.stdout.write(run(pnpmCommand(), ['--filter', '@geox/server', 'typecheck']));
      check(true, 'server typecheck PASS');
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, 'server typecheck PASS');
    }
    try {
      process.stdout.write(run(pnpmCommand(), ['--filter', '@geox/server', 'build']));
      check(true, 'server build PASS');
    } catch (error) {
      process.stderr.write(error.stderr || error.message);
      check(false, 'server build PASS');
    }
  }
}

function checkModeContext() {
  const currentBranch = git(['branch', '--show-current']);
  if (MODE === 'postmerge') {
    check(currentBranch === 'main', 'postmerge Gate runs on main');
    try {
      check(
        git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']),
        'postmerge local main equals origin/main',
      );
    } catch {
      check(false, 'postmerge local main equals origin/main');
    }
  } else {
    check(currentBranch === BRANCH, `${MODE} Gate runs on S3A branch`);
  }
}

checkFilesAndBoundary();
checkStatus();
checkContractAndSources();
runAcceptanceAndToolchain();
checkModeContext();

console.log(
  `MCFT-CAP-03 assimilated record-set builder ${MODE}: ${pass} PASS, ${fail} FAIL`,
);
if (fail) process.exitCode = 1;
