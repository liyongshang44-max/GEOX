// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs
// Purpose: enforce the S5 implementation boundary and its Draft, Final, and merged-main Postmerge effectiveness lifecycle.
// Boundary: governance and isolated acceptance orchestration only; no production Runtime mutation, restart/backfill behavior, route, scheduler, successful Forecast, Scenario, Recommendation, Decision, action, calibration, model activation, or successor authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '01f705bec9e79b528480b63fe56c6e6c4489845f';
const IMPLEMENTATION_BRANCH =
  'mcft-cap-03-s5-twenty-four-observation-aware-tick-range-v1';
const EFFECTIVENESS_BRANCH =
  'mcft-cap-03-s5-postmerge-effectiveness-v1';
const IMPLEMENTATION_MERGE =
  'aa781f94d752337e3d06ff8b7dceb7b2e2b7c56c';
const S4 =
  'MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1';
const S5 =
  'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1';
const S6 =
  'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1';
const REVISION_ID =
  'V2_POSTGRES_VERSIONED_PREDECESSOR_VALIDATION_REMEDIATION';
const REMEDIATION_ID =
  'S5_POSTGRES_VERSIONED_PREDECESSOR_VALIDATION_V1';

const POSTMERGE = process.argv.includes('--postmerge');
const DRAFT = process.argv.includes('--draft');
const RUN_DB = process.argv.includes('--db');
const MODE = POSTMERGE ? 'postmerge' : DRAFT ? 'draft' : 'final';

const STATUS_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json';
const CONTRACT_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md';
const DELIVERY_PATH =
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const REPOSITORY_PATH =
  'apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts';
const RANGE_SERVICE_PATH =
  'apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.ts';

const IMPLEMENTATION_FILES = [
  RANGE_SERVICE_PATH,
  REPOSITORY_PATH,
  STATUS_PATH,
  CONTRACT_PATH,
  DELIVERY_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts',
  'scripts/runtime_acceptance/mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.ts',
].sort();

const EFFECTIVENESS_FILES = [
  STATUS_PATH,
  DELIVERY_PATH,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs',
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

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sortedLines(value) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .map((item) => item.replaceAll('\\', '/'))
    .sort();
}

function sameArray(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function run(command, args, pattern, message, env = process.env) {
  try {
    const output = cp.execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(
      error.stderr || error.stdout || String(error.message || error),
    );
    check(false, message);
  }
}

function runTsx(relativePath, pattern, message, env = process.env) {
  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', relativePath],
    pattern,
    message,
    env,
  );
}

for (const relativePath of new Set([
  ...IMPLEMENTATION_FILES,
  ...EFFECTIVENESS_FILES,
])) {
  check(
    fs.existsSync(path.join(ROOT, relativePath)),
    `${MODE} file exists: ${relativePath}`,
  );
}

const status = readJson(STATUS_PATH);
const delivery = readJson(DELIVERY_PATH);
const contract = readText(CONTRACT_PATH);
const repository = readText(REPOSITORY_PATH);
const rangeService = readText(RANGE_SERVICE_PATH);
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
const s5 = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const s6 = delivery.slices.find((slice) => slice.delivery_slice_id === S6);

check(
  status.schema_version
    === 'geox_mcft_cap_03_twenty_four_observation_aware_tick_range_status_v3',
  'status schema carries the S5 postmerge lifecycle revision',
);
check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S5, 'status delivery slice exact');
check(status.baseline_main_commit === BASELINE, 'status baseline exact');
check(
  status.implementation_branch === IMPLEMENTATION_BRANCH,
  'status implementation branch exact',
);
check(status.status === 'MERGED', 'status records S5 implementation MERGED');
check(
  status.implementation_status === 'MERGED',
  'status implementation state MERGED',
);
check(
  status.implementation_boundary_revision === REVISION_ID,
  'status records exact remediation boundary revision',
);
check(
  status.authorized_remediation?.remediation_id === REMEDIATION_ID,
  'status records exact remediation identifier',
);
check(
  status.authorized_remediation?.authorized_file === REPOSITORY_PATH,
  'status authorizes only the assimilated PostgreSQL repository remediation',
);
check(
  sameArray(status.frozen_implementation_changed_file_boundary, IMPLEMENTATION_FILES),
  'status frozen implementation boundary is exact',
);
check(
  sameArray(status.postmerge_effectiveness_changed_file_boundary, EFFECTIVENESS_FILES),
  'status postmerge effectiveness boundary is exact',
);
check(status.implementation_pr_number === 2342, 'status records implementation PR 2342');
check(
  status.implementation_head_commit
    === 'fb2c83d0ec04d9614aae65678e882f674d6fcfd2',
  'status records locked implementation head',
);
check(
  status.implementation_ci_run === 'CI_4708',
  'status records successful exact-head CI 4708',
);
check(
  status.implementation_merge_commit === IMPLEMENTATION_MERGE,
  'status records exact S5 implementation merge commit',
);
check(
  status.implementation_merged_main_gate === 'PASS',
  'status declares S5 merged-main Gate PASS for reproduction',
);
check(
  status.implementation_effectiveness_condition_satisfied === true,
  'status declares S5 effectiveness condition satisfied after postmerge reproduction',
);
check(status.successor_authorized === false, 'status does not authorize S6');

check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
check(
  delivery.status === 'TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_MERGED',
  'delivery top-level status records S5 merged',
);
check(
  delivery.active_delivery_slice_id === S5,
  'S5 remains the active slice until explicit S6 activation',
);
check(s4?.status === 'MERGED', 'S4 remains MERGED');
check(s5?.status === 'MERGED', 'delivery S5 records MERGED');
check(s5?.merge_commit === IMPLEMENTATION_MERGE, 'delivery S5 merge commit exact');
check(s5?.merged_main_gate === 'PASS', 'delivery S5 merged-main Gate PASS');
check(
  s5?.effectiveness_condition_satisfied === true,
  'delivery S5 effectiveness condition satisfied',
);
check(
  sameArray(s5?.exact_changed_file_boundary || [], IMPLEMENTATION_FILES),
  'delivery S5 implementation boundary is exact',
);
check(s6?.status === 'BLOCKED', 'S6 remains blocked before explicit activation');
check(
  s6?.baseline_main_commit === null
    && s6?.branch === null
    && s6?.activation_fields_status === 'TO_BE_FROZEN_AT_SLICE_ACTIVATION',
  'S6 activation fields remain unset',
);
check(
  Array.isArray(delivery.next_authorized_slice_ids)
    && delivery.next_authorized_slice_ids.length === 0,
  'no downstream slice is implicitly authorized',
);
check(
  delivery.next_authorized_slice_id_after_effectiveness === S6,
  'S6 is only the next slice eligible for explicit activation',
);
check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

try {
  cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    ['merge-base', '--is-ancestor', BASELINE, IMPLEMENTATION_MERGE],
    { cwd: ROOT, stdio: 'ignore' },
  );
  check(true, 'S5 implementation merge descends from exact S4 effectiveness baseline');
} catch {
  check(false, 'S5 implementation merge descends from exact S4 effectiveness baseline');
}

try {
  const implementationChanged = sortedLines(
    git(['diff', '--name-only', `${BASELINE}...${IMPLEMENTATION_MERGE}`]),
  );
  check(
    sameArray(implementationChanged, IMPLEMENTATION_FILES),
    'exact S5 implementation changed-file set has 10 files',
  );
  const forbidden = implementationChanged.filter((file) =>
    FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(file))
  );
  check(
    forbidden.length === 0,
    `S5 implementation contains no migration, route, web, or workflow file: ${forbidden.join(',')}`,
  );
  git(['diff', '--check', `${BASELINE}...${IMPLEMENTATION_MERGE}`]);
  check(true, 'S5 implementation git diff --check PASS');
} catch (error) {
  check(false, `S5 implementation boundary available: ${error.message}`);
}

try {
  const effectivenessChanged = sortedLines(
    git(['diff', '--name-only', `${IMPLEMENTATION_MERGE}...HEAD`]),
  );
  check(
    sameArray(effectivenessChanged, EFFECTIVENESS_FILES),
    'exact S5 postmerge-effectiveness changed-file set has 3 files',
  );
  git(['diff', '--check', `${IMPLEMENTATION_MERGE}...HEAD`]);
  check(true, 'S5 postmerge-effectiveness git diff --check PASS');
} catch (error) {
  check(false, `S5 postmerge-effectiveness boundary available: ${error.message}`);
}

if (POSTMERGE) {
  try {
    cp.execFileSync(
      process.platform === 'win32' ? 'git.exe' : 'git',
      ['merge-base', '--is-ancestor', IMPLEMENTATION_MERGE, 'HEAD'],
      { cwd: ROOT, stdio: 'ignore' },
    );
    check(true, 'S5 implementation merge is an ancestor of merged main HEAD');
  } catch {
    check(false, 'S5 implementation merge is an ancestor of merged main HEAD');
  }

  try {
    check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  } catch (error) {
    check(false, `postmerge branch available: ${error.message}`);
  }

  try {
    check(
      git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']),
      'postmerge local HEAD equals origin/main',
    );
  } catch (error) {
    check(false, `postmerge origin/main alignment available: ${error.message}`);
  }
}

for (const marker of [
  '24 contiguous',
  'checkpoint sequence: `25..48`',
  '192 new A2 canonical facts',
  'LIMITED observation downweighting',
  'no usable observation',
  'innovation outlier rejection',
  'candidate exclusion',
  'Forecast',
  'S6 remains blocked',
]) {
  check(
    contract.toLowerCase().includes(marker.toLowerCase()),
    `contract marker: ${marker}`,
  );
}

for (const marker of [
  'validateVersionedPredecessorMembersV1',
  'member_object_ids ? $1',
  'ASSIMILATED_PREDECESSOR_RECORD_SET_CONTRACT_UNKNOWN',
]) {
  check(repository.includes(marker), `repository marker: ${marker}`);
}

for (const marker of [
  'MAX_ASSIMILATED_CONTIGUOUS_TICKS_V1 = 24',
  'ALREADY_COMPLETE',
  'ASSIMILATED_RANGE_MAX_TICKS_EXCEEDED',
  'executeOneTick',
]) {
  check(rangeService.includes(marker), `range service marker: ${marker}`);
}

for (const nonclaim of [
  'NO_RESTART_BACKFILL_PROOF',
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
  check(s5?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
}

if (!DRAFT) {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts',
    /12 PASS, 0 FAIL/,
    `${MODE} S5 positive in-memory acceptance`,
  );
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts',
    /12 PASS, 0 FAIL/,
    `${MODE} S5 negative and semantic acceptance`,
  );
  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@geox/server', 'typecheck'],
    /(?:Done|success|tsc|typecheck)/i,
    `${MODE} server typecheck`,
  );
}

if (RUN_DB) {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts',
    /9 PASS, 0 FAIL/,
    `${MODE} S5 isolated PostgreSQL acceptance`,
  );
}

console.log(
  `MCFT-CAP-03 S5 ${MODE} Gate: ${pass} PASS, ${fail} FAIL`,
);

if (fail > 0) {
  process.exitCode = 1;
}
