// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.cjs
// Purpose: enforce the exact S6 implementation boundary and its Draft, Final, isolated-PostgreSQL, and merged-main Postmerge effectiveness lifecycle.
// Boundary: governance, source-shape, and isolated acceptance orchestration only; no production Runtime mutation, route, scheduler, successful Forecast, late-Evidence revision, or successor authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const IMPLEMENTATION_BASELINE =
  '5070d350238fa3af8fcc5bab43cc14bba8e7a3c8';
const IMPLEMENTATION_BRANCH =
  'mcft-cap-03-s6-restart-backfill-recovery-v1';
const EFFECTIVENESS_BRANCH =
  'mcft-cap-03-s6-postmerge-effectiveness-v1';
const S5 =
  'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1';
const S6 =
  'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';

const DRAFT = process.argv.includes('--draft');
const POSTMERGE = process.argv.includes('--postmerge');
const RUN_DB = process.argv.includes('--db');
const MODE = POSTMERGE
  ? 'postmerge'
  : DRAFT
    ? 'draft'
    : 'final';

const STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json';
const CONTRACT_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md';
const DELIVERY_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const SERVICE_PATH =
  'apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.ts';
const GATE_PATH =
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.cjs';
const POSITIVE_PATH =
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.ts';
const NEGATIVE_PATH =
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_NEGATIVE.ts';
const DB_PATH =
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_DB.ts';
const FIXTURE_PATH =
  'scripts/runtime_acceptance/mcft_cap_03_restart_backfill_recovery_fixture_v1.ts';

const IMPLEMENTATION_FILES = [
  SERVICE_PATH,
  STATUS_PATH,
  CONTRACT_PATH,
  DELIVERY_PATH,
  GATE_PATH,
  POSITIVE_PATH,
  DB_PATH,
  NEGATIVE_PATH,
  FIXTURE_PATH,
].sort();

const EFFECTIVENESS_FILES = [
  DELIVERY_PATH,
  STATUS_PATH,
].sort();

const FORBIDDEN_PATH_PATTERNS = [
  /^apps\/server\/db\/migrations\//,
  /(?:^|\/)routes?(?:\/|\.|$)/i,
  /^apps\/web\//,
  /^\.github\/workflows\//,
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

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function git(args) {
  return cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    args,
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();
}

function sortedLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter(Boolean)
    .sort();
}

function sameArray(left, right) {
  return JSON.stringify([...left].sort())
    === JSON.stringify([...right].sort());
}

function run(command, args, message, expectedPattern, extraEnv = {}) {
  try {
    const output = cp.execFileSync(
      command,
      args,
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...extraEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    process.stdout.write(output);

    check(
      expectedPattern
        ? expectedPattern.test(output)
        : true,
      message,
    );
  } catch (error) {
    if (error.stdout) process.stdout.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    check(false, `${message}: ${error.message}`);
  }
}

function runTsx(relativePath, expectedPattern, message, extraEnv = {}) {
  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', relativePath],
    message,
    expectedPattern,
    extraEnv,
  );
}

for (const relativePath of IMPLEMENTATION_FILES) {
  check(
    fs.existsSync(absolute(relativePath)),
    `${MODE} file exists: ${relativePath}`,
  );
}

const status = readJson(STATUS_PATH);
const delivery = readJson(DELIVERY_PATH);
const contract = readText(CONTRACT_PATH);
const service = readText(SERVICE_PATH);
const fixture = readText(FIXTURE_PATH);
const positive = readText(POSITIVE_PATH);
const negative = readText(NEGATIVE_PATH);
const database = readText(DB_PATH);

const s5 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S5,
);
const s6 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S6,
);
const s7 = delivery.slices.find(
  (slice) => slice.delivery_slice_id === S7,
);

check(
  status.schema_version
    === 'geox_mcft_cap_03_restart_backfill_recovery_status_v2',
  'status schema exact',
);
check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S6, 'status delivery slice exact');
check(
  status.implementation_baseline_main_commit
    === IMPLEMENTATION_BASELINE,
  'implementation baseline exact',
);
check(status.implementation_branch === IMPLEMENTATION_BRANCH, 'implementation branch exact');
check(
  status.implementation_effectiveness_branch
    === EFFECTIVENESS_BRANCH,
  'effectiveness branch exact',
);
check(status.activation_effective === true, 'activation remains effective');
check(status.implementation_authorized === true, 'implementation remains authorized');
check(
  status.activation_effectiveness
    .effectiveness_merge_commit
      === IMPLEMENTATION_BASELINE,
  'activation effectiveness merge exact',
);
check(
  status.activation_effectiveness
    .merged_main_gate
      === 'PASS_81_OF_81',
  'activation merged-main Gate exact',
);
check(
  status.activation_effectiveness
    .effectiveness_condition_satisfied === true,
  'activation effectiveness satisfied',
);
check(
  sameArray(
    status.frozen_implementation_changed_file_boundary,
    IMPLEMENTATION_FILES,
  ),
  'status implementation boundary exact',
);
check(
  sameArray(
    status.postmerge_effectiveness_changed_file_boundary,
    EFFECTIVENESS_FILES,
  ),
  'status effectiveness boundary exact',
);

check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
check(delivery.runtime_source_authorized === true, 'Runtime source remains authorized');
check(delivery.active_delivery_slice_id === S6, 'S6 remains active delivery slice');
check(s5?.status === 'MERGED', 'S5 remains MERGED');
check(s5?.effectiveness_condition_satisfied === true, 'S5 effectiveness remains satisfied');
check(s6?.baseline_main_commit === '8190e93f3b520ce15dcbe40b2a92e759176ef9a1', 'delivery S6 activation baseline exact');
check(s6?.branch === IMPLEMENTATION_BRANCH, 'delivery S6 branch exact');
check(s6?.activation?.effective === true, 'delivery S6 activation effective');
check(
  sameArray(s6?.exact_changed_file_boundary || [], IMPLEMENTATION_FILES),
  'delivery S6 implementation boundary exact',
);
check(s7?.status === 'BLOCKED', 'S7 remains BLOCKED');
check(
  s7?.baseline_main_commit === null
    && s7?.branch === null,
  'S7 baseline and branch remain unset',
);
check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

if (POSTMERGE) {
  check(status.status === 'MERGED', 'postmerge status records S6 MERGED');
  check(status.implementation_status === 'MERGED', 'postmerge implementation status MERGED');
  check(
    status.implementation_effectiveness_condition_satisfied === true,
    'postmerge implementation effectiveness satisfied',
  );
  check(
    typeof status.implementation_merge_commit === 'string'
      && /^[0-9a-f]{40}$/.test(status.implementation_merge_commit),
    'postmerge implementation merge commit recorded',
  );
  check(status.implementation_merged_main_gate === 'PASS', 'postmerge Gate PASS recorded');
  check(delivery.status === 'RESTART_BACKFILL_RECOVERY_MERGED', 'postmerge delivery status records S6 merged');
  check(s6?.status === 'MERGED', 'postmerge delivery S6 MERGED');
  check(s6?.effectiveness_condition_satisfied === true, 'postmerge delivery effectiveness satisfied');
} else {
  check(status.status === 'ACTIVATED', `${MODE} status remains ACTIVATED`);
  check(status.implementation_status === 'AUTHORIZED', `${MODE} implementation remains AUTHORIZED`);
  check(delivery.status === 'RESTART_BACKFILL_RECOVERY_ACTIVATED', `${MODE} delivery remains S6 ACTIVATED`);
  check(s6?.status === 'ACTIVATED', `${MODE} delivery S6 remains ACTIVATED`);
}

for (const marker of [
  'class AssimilatedRestartResumeServiceV1',
  'resumeAssimilatedFromCheckpointV1',
  'runAssimilatedBoundedBackfillV1',
  'resumeFromCheckpointV1',
  'runAssimilatedContiguousRangeV1',
  'LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN',
  'CHECKPOINT_PROJECTION_DIVERGENCE',
  'ASSIMILATED_BACKFILL_START_NOT_PERSISTED_NEXT_TICK',
]) {
  check(service.includes(marker), `service marker: ${marker}`);
}

check(!/\bfor\s*\(/.test(service), 'orchestrator contains no tick loop');
check(!/\bwhile\s*\(/.test(service), 'orchestrator contains no while loop');
check(!service.includes('/persistence/'), 'orchestrator imports no persistence implementation');
check(!service.includes('commitAssimilatedContinuationState'), 'orchestrator performs no direct canonical commit');
check(!service.includes('acquireLease'), 'orchestrator performs no direct lease acquisition');
check(!service.includes('rebuildAssimilatedContinuationProjections'), 'orchestrator performs no automatic projection repair');
check(
  service.indexOf('LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN')
    < service.lastIndexOf('resumeFromCheckpointV1'),
  'late Evidence is rejected before persisted restart read',
);

for (const marker of [
  'S6_PROCESS_1_TICK_COUNT_V1 = 12',
  'S6_FRESH_PROCESS_TICK_COUNT_V1 = 12',
  'buildFreshProcessServicesV1',
  'resumeAssimilatedFromCheckpointV1',
  'runAssimilatedBoundedBackfillV1',
]) {
  check(fixture.includes(marker), `fixture marker: ${marker}`);
}

for (const marker of [
  'restartedHashes',
  'uninterruptedHashes',
  'backfillHashes',
  'ALREADY_COMPLETE',
  'rebuilt_projection_count: 5',
]) {
  check(positive.includes(marker), `positive acceptance marker: ${marker}`);
}

for (const marker of [
  'LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN',
  'SIMULATED_PRECOMMIT_PROCESS_CRASH',
  'SIMULATED_POSTCOMMIT_RESPONSE_LOSS',
  'CHECKPOINT_PROJECTION_DIVERGENCE',
  'EXISTING_IDEMPOTENT_SUCCESS',
]) {
  check(negative.includes(marker), `negative acceptance marker: ${marker}`);
}

for (const marker of [
  'ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts',
  'ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts',
  'PostgresNextTickRepositoryV1',
  'AssimilatedRestartResumeServiceV1',
  'ALREADY_COMPLETE',
]) {
  check(database.includes(marker), `database acceptance marker: ${marker}`);
}

for (const marker of [
  'process 1 commits ticks 1–12',
  'fresh service composition resumes ticks 13–24',
  'restarted and uninterrupted canonical hashes are identical',
  'bounded forward catch-up',
  'precommit process crash',
  'postcommit response loss',
  'stale fencing fails closed',
  'projection divergence prevents restart',
  'explicit canonical five-projection rebuild',
  'late Evidence is rejected before checkpoint read',
  'S7 remains blocked',
  'MCFT-CAP-04 remains unauthorized',
]) {
  check(
    contract.toLowerCase().includes(marker.toLowerCase()),
    `contract marker: ${marker}`,
  );
}

for (const nonclaim of [
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
]) {
  check(status.preserved_nonclaims.includes(nonclaim), `status preserved nonclaim: ${nonclaim}`);
  check(s6?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
}

try {
  check(
    git(['merge-base', '--is-ancestor', IMPLEMENTATION_BASELINE, 'HEAD']) === '',
    'implementation branch descends from exact activation-effectiveness baseline',
  );
} catch {
  check(false, 'implementation branch descends from exact activation-effectiveness baseline');
}

try {
  const implementationMerge = POSTMERGE
    ? status.implementation_merge_commit
    : 'HEAD';

  const changed = sortedLines(
    git([
      'diff',
      '--name-only',
      `${IMPLEMENTATION_BASELINE}...${implementationMerge}`,
    ]),
  );

  check(
    sameArray(changed, IMPLEMENTATION_FILES),
    'actual S6 implementation changed-file set is exact',
  );

  const forbidden = changed.filter((file) =>
    FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(file))
  );

  check(
    forbidden.length === 0,
    `implementation contains no migration, route, web, or workflow file: ${forbidden.join(',')}`,
  );

  git([
    'diff',
    '--check',
    `${IMPLEMENTATION_BASELINE}...${implementationMerge}`,
  ]);
  check(true, 'implementation git diff --check PASS');
} catch (error) {
  check(false, `implementation boundary available: ${error.message}`);
}

if (POSTMERGE) {
  try {
    const effectivenessChanged = sortedLines(
      git([
        'diff',
        '--name-only',
        `${status.implementation_merge_commit}...HEAD`,
      ]),
    );

    check(
      sameArray(effectivenessChanged, EFFECTIVENESS_FILES),
      'postmerge-effectiveness changed-file set is exact',
    );

    git([
      'diff',
      '--check',
      `${status.implementation_merge_commit}...HEAD`,
    ]);
    check(true, 'postmerge-effectiveness git diff --check PASS');
  } catch (error) {
    check(false, `postmerge-effectiveness boundary available: ${error.message}`);
  }

  try {
    check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
    check(
      git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']),
      'postmerge local main equals origin/main',
    );
  } catch (error) {
    check(false, `postmerge main alignment available: ${error.message}`);
  }
} else {
  try {
    check(
      git(['branch', '--show-current']) === IMPLEMENTATION_BRANCH,
      `${MODE} Gate runs on implementation branch`,
    );
  } catch (error) {
    check(false, `${MODE} branch available: ${error.message}`);
  }
}

if (!DRAFT) {
  runTsx(
    POSITIVE_PATH,
    /8 PASS, 0 FAIL/,
    `${MODE} S6 positive in-memory acceptance`,
  );

  runTsx(
    NEGATIVE_PATH,
    /9 PASS, 0 FAIL/,
    `${MODE} S6 negative and semantic acceptance`,
  );

  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@geox/server', 'typecheck'],
    `${MODE} server typecheck`,
  );
}

if (RUN_DB) {
  runTsx(
    DB_PATH,
    /6 PASS, 0 FAIL/,
    `${MODE} S6 isolated PostgreSQL acceptance`,
  );
}

console.log(
  `MCFT-CAP-03 S6 ${MODE} Gate: ${pass} PASS, ${fail} FAIL`,
);

if (fail > 0) {
  process.exitCode = 1;
}
