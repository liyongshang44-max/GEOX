// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION.cjs
// Purpose: enforce the S4 single-tick activation, exact-file boundary, runtime composition, acceptance evidence, and Draft/Final/Postmerge lifecycle gates.
// Boundary: governance and isolated acceptance orchestration only; no production database mutation, range execution, restart/backfill, route, scheduler, successful Forecast, Recommendation, Decision, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '17c837c961e53a958bc94b2d6c216fa4fc23e10b';
const BRANCH = 'mcft-cap-03-single-tick-integration-v1';
const S3B = 'MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1';
const S4 = 'MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1';
const S5 = 'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1';
const POSTMERGE = process.argv.includes('--postmerge');
const DRAFT = process.argv.includes('--draft');
const RUN_DB = process.argv.includes('--db');
const MODE = POSTMERGE ? 'postmerge' : DRAFT ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.ts',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION.md',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_single_tick_integration_fixture_v1.ts',
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
    process.stderr.write(error.stderr || error.stdout || error.message);
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

for (const relativePath of EXACT_CHANGED_FILES) {
  check(fs.existsSync(path.join(ROOT, relativePath)), `${MODE} file exists: ${relativePath}`);
}

const status = readJson(
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION-STATUS.json',
);
const delivery = readJson(
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
);
const s3b = delivery.slices.find((slice) => slice.delivery_slice_id === S3B);
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);
const s5 = delivery.slices.find((slice) => slice.delivery_slice_id === S5);
const boundaryTarget = POSTMERGE ? status.merge_commit : 'HEAD';

try {
  cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    ['merge-base', '--is-ancestor', BASELINE, boundaryTarget],
    { cwd: ROOT, stdio: 'ignore' },
  );
  check(true, `${MODE} target descends from exact S3B effectiveness baseline`);
} catch {
  check(false, `${MODE} target descends from exact S3B effectiveness baseline`);
}

if (POSTMERGE) {
  check(
    typeof status.merge_commit === 'string' && status.merge_commit.length === 40,
    'postmerge status records S4 implementation merge commit',
  );
  try {
    cp.execFileSync(
      process.platform === 'win32' ? 'git.exe' : 'git',
      ['merge-base', '--is-ancestor', status.merge_commit, 'HEAD'],
      { cwd: ROOT, stdio: 'ignore' },
    );
    check(true, 'S4 implementation merge commit is an ancestor of current main HEAD');
  } catch {
    check(false, 'S4 implementation merge commit is an ancestor of current main HEAD');
  }
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...${boundaryTarget}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  check(
    JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES),
    'exact S4 changed-file set has 12 files',
  );
  const forbidden = changed.filter((file) =>
    FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(file))
  );
  check(
    forbidden.length === 0,
    `no migration, route, web, or workflow file changed: ${forbidden.join(',')}`,
  );
  git(['diff', '--check', `${BASELINE}...${boundaryTarget}`]);
  check(true, 'S4 git diff --check PASS');
} catch (error) {
  check(false, `S4 boundary available: ${error.message}`);
}

check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S4, 'status delivery slice exact');
check(status.baseline_main_commit === BASELINE, 'status baseline exact');
check(status.branch === BRANCH, 'status branch exact');
check(status.primary_owner_work_package_id === 'MCFT-04', 'status primary owner exact');
check(
  JSON.stringify(status.contributing_owner_work_package_ids)
    === JSON.stringify(['MCFT-05', 'MCFT-06', 'MCFT-07', 'MCFT-08', 'MCFT-09']),
  'status contributors exact',
);
check(
  JSON.stringify(status.depends_on_delivery_slice_ids) === JSON.stringify([S3B]),
  'status dependency exact',
);
check(
  status.predecessor_effectiveness?.s3b_implementation_merge_commit
    === '71c086b3c57d9884b0fef2820be62b41800ec77e',
  'S3B implementation merge commit recorded',
);
check(
  status.predecessor_effectiveness?.s3b_postmerge_status_commit === BASELINE,
  'S3B postmerge status commit recorded',
);
check(
  status.predecessor_effectiveness?.s3b_merged_main_gate === 'PASS_116_OF_116',
  'S3B merged-main Gate evidence recorded',
);
check(
  status.predecessor_effectiveness?.s3b_effectiveness_condition_satisfied === true,
  'S3B effectiveness condition satisfied',
);
check(
  JSON.stringify([...status.exact_changed_file_boundary].sort())
    === JSON.stringify(EXACT_CHANGED_FILES),
  'status exact changed-file boundary matches Gate',
);
check(status.successor_authorized === false, 'status does not authorize S5');

check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
check(delivery.active_delivery_slice_id === S4, 'S4 is the only active delivery slice');
check(s3b?.status === 'MERGED', 'S3B delivery status MERGED');
check(
  s3b?.merge_commit === '71c086b3c57d9884b0fef2820be62b41800ec77e',
  'S3B implementation merge commit exact',
);
check(s3b?.merged_main_gate === 'PASS', 'S3B merged-main Gate PASS');
check(s3b?.effectiveness_condition_satisfied === true, 'S3B effectiveness recorded');
check(s4?.baseline_main_commit === BASELINE, 'S4 delivery baseline exact');
check(s4?.branch === BRANCH, 'S4 delivery branch exact');
check(s4?.activation_fields_status === 'FROZEN', 'S4 activation fields frozen');
check(
  JSON.stringify([...(s4?.exact_changed_file_boundary || [])].sort())
    === JSON.stringify(EXACT_CHANGED_FILES),
  'S4 delivery boundary exact',
);
check(s5?.status === 'BLOCKED', 'S5 remains blocked before S4 effectiveness');
check(
  s5?.branch === null && s5?.baseline_main_commit === null,
  'S5 activation fields remain unset',
);
check(delivery.successor_authorized === false, 'MCFT-CAP-04 remains unauthorized');

if (DRAFT) {
  check(status.status === 'IN_PROGRESS', 'draft S4 status IN_PROGRESS');
  check(s4?.status === 'IN_PROGRESS', 'draft delivery S4 IN_PROGRESS');
  check(
    delivery.status === 'SINGLE_TICK_INTEGRATION_IN_PROGRESS',
    'draft delivery top-level status exact',
  );
} else if (POSTMERGE) {
  check(status.status === 'MERGED', 'postmerge S4 status MERGED');
  check(s4?.status === 'MERGED', 'postmerge delivery S4 MERGED');
  check(status.merged_main_gate === 'PASS', 'postmerge S4 merged-main Gate recorded');
  check(
    status.effectiveness_condition_satisfied === true,
    'postmerge S4 effectiveness recorded',
  );
} else {
  check(status.status === 'READY_FOR_MERGE', 'final S4 status READY_FOR_MERGE');
  check(s4?.status === 'READY_FOR_MERGE', 'final delivery S4 READY_FOR_MERGE');
  check(
    delivery.status === 'SINGLE_TICK_INTEGRATION_READY_FOR_MERGE',
    'final delivery top-level status exact',
  );
}

for (const nonclaim of [
  'NO_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE',
  'NO_RANGE_EXECUTION',
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
  check(s4?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
}

const contract = readText(
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-SINGLE-TICK-INTEGRATION.md',
);
for (const marker of [
  'EXACTLY_ONE_REQUESTED_NEXT_TICK',
  'previous_forecast_result_hash',
  'A_STATE_TICK_COMMIT',
  'A2_BLOCKED_FORECAST',
  'A2_RECORD_SET',
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
  'EXISTING_IDEMPOTENT_SUCCESS',
  'IDEMPOTENCY_CONFLICT',
  'checkpoint sequence = 25',
  '2026-06-02T03:00:00.000Z',
  'not a DT-02 Architecture Amendment',
  'S5 remains blocked',
]) {
  check(
    contract.toLowerCase().includes(marker.toLowerCase()),
    `contract document marker: ${marker}`,
  );
}

const ports = readText('apps/server/src/runtime/twin_runtime/ports.ts');
const nextTickRepository = readText(
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
);
const nextTickService = readText(
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
);
const service = readText(
  'apps/server/src/runtime/twin_runtime/assimilated_continuation_tick_service_v1.ts',
);

check(
  ports.includes('previous_forecast_result?: CanonicalObjectEnvelopeV1'),
  'persisted snapshot exposes additive canonical Forecast object authority',
);
check(
  ports.includes('previous_forecast_result_hash?: string'),
  'prepared handoff exposes additive Forecast hash authority',
);
check(
  nextTickRepository.includes('previousForecastResultRef')
    && nextTickRepository.includes('"twin_forecast_run_v1"')
    && nextTickRepository.includes('previous_forecast_result: previousForecastResult'),
  'PostgreSQL next-tick reader resolves the canonical predecessor Forecast result',
);
check(
  nextTickService.includes('PREVIOUS_FORECAST_RESULT_HASH_REQUIRED')
    && nextTickService.includes('previous_forecast_result_hash: previousForecastResultHash'),
  'prepared handoff validates and carries predecessor Forecast hash',
);
check(
  service.includes('class AssimilatedContinuationTickServiceV1'),
  'independent CAP-03 single-tick service implemented',
);
check(
  service.includes('lookupAssimilatedContinuationRecordSet')
    && service.includes('commitAssimilatedContinuationState')
    && service.includes('readAssimilatedContinuationRecordSet'),
  'single-tick service uses the independent assimilated persistence port',
);
check(
  service.includes('executeHourlyWaterBalanceV1')
    && service.includes('composeAssimilatedContinuationPosteriorV1')
    && service.includes('buildAssimilatedContinuationRecordSetV1'),
  'single-tick service composes Dynamics, assimilation, and the CAP-03 builder',
);

const firstLookup = service.indexOf('lookupAssimilatedContinuationRecordSet');
const configRead = service.indexOf('readRuntimeConfig');
const evidenceRead = service.indexOf('loadCandidateRecords');
const leaseAcquire = service.indexOf('acquireLease');
check(
  firstLookup >= 0
    && firstLookup < configRead
    && firstLookup < evidenceRead
    && firstLookup < leaseAcquire,
  'first idempotency lookup precedes Runtime Config, Evidence, and lease',
);
const dynamicsIndex = service.indexOf('executeHourlyWaterBalanceV1({');
const assimilationIndex = service.indexOf('composeAssimilatedContinuationPosteriorV1({');
const builderIndex = service.indexOf('buildAssimilatedContinuationRecordSetV1({');
const commitIndex = service.indexOf('commitAssimilatedContinuationState({');
const readbackIndex = service.indexOf('readAssimilatedContinuationRecordSet(');
check(
  dynamicsIndex >= 0
    && dynamicsIndex < assimilationIndex
    && assimilationIndex < builderIndex
    && builderIndex < commitIndex
    && commitIndex < readbackIndex,
  'runtime order is Dynamics then assimilation then builder then commit then readback',
);
check(
  service.includes('ASSIMILATED_REQUESTED_TICK_NOT_NEXT_PERSISTED_TICK'),
  'service requires requested logical time to equal persisted next tick',
);
check(
  service.includes('ASSIMILATED_PREDECESSOR_FORECAST_HASH_REQUIRED'),
  'service fails closed without predecessor Forecast hash',
);
check(
  !/while\s*\(|for\s*\(\s*;|setInterval|setTimeout|fastify|router\./.test(service),
  'service contains no range loop, scheduler, or route wiring',
);
check(
  !/INSERT INTO\s+twin_forecast_success_latest_index_v1/i.test(service),
  'service does not write a successful Forecast projection',
);

runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION.ts',
  /MCFT-CAP-03 single-tick integration: 10 PASS, 0 FAIL/,
  'S4 positive in-memory acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
  /MCFT-CAP-03 single-tick integration negative: 6 PASS, 0 FAIL/,
  'S4 negative in-memory acceptance PASS',
);

if (RUN_DB) {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_SINGLE_TICK_INTEGRATION_DB.ts',
    /MCFT-CAP-03 single-tick integration DB: 7 PASS, 0 FAIL/,
    'S4 isolated PostgreSQL end-to-end acceptance PASS',
    { ...process.env, MCFT_CAP_03_S4_DESTRUCTIVE_ACCEPTANCE: '1' },
  );
} else {
  check(true, 'isolated PostgreSQL acceptance not requested in this Gate invocation');
}

if (!DRAFT) {
  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@geox/server', 'typecheck'],
    /(?:Done|typecheck|tsc)/,
    'server typecheck PASS',
  );
  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@geox/server', 'build'],
    /(?:Done|build|write_dist_entries)/,
    'server build PASS',
  );
}

const currentBranch = git(['branch', '--show-current']);
if (POSTMERGE) {
  check(currentBranch === 'main', 'postmerge Gate runs on main');
  try {
    check(
      git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']),
      'postmerge local main equals origin/main',
    );
  } catch (error) {
    check(false, `postmerge origin/main available: ${error.message}`);
  }
} else {
  check(currentBranch === BRANCH, `${MODE} Gate runs on S4 branch`);
}

console.log(`MCFT-CAP-03 single-tick integration ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
