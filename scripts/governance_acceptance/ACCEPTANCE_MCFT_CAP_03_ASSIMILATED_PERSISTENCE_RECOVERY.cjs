// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY.cjs
// Purpose: enforce S3B activation, exact-file, persistence-contract, recovery, historical compatibility, and lifecycle gates in draft, final, and postmerge modes.
// Boundary: governance and isolated acceptance orchestration only; no production database mutation, Runtime tick orchestration, range execution, route, scheduler, Forecast success, Recommendation, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '293fbeff04441f12aee13945c2db24b4b9bb23b5';
const BRANCH = 'mcft-cap-03-assimilated-a2-persistence-recovery-v1';
const S3A = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1';
const S3B = 'MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1';
const S4 = 'MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1';
const POSTMERGE = process.argv.includes('--postmerge');
const DRAFT = process.argv.includes('--draft');
const RUN_DB = process.argv.includes('--db');
const MODE = POSTMERGE ? 'postmerge' : DRAFT ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY-STATUS.json',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY.md',
  'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_03_assimilated_persistence_recovery_fixture_v1.ts',
].sort();

const FORBIDDEN_PATH_PATTERNS = [
  /^apps\/server\/db\/migrations\//,
  /single_tick/i,
  /route/i,
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
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsx', relativePath], pattern, message, env);
}

for (const relativePath of EXACT_CHANGED_FILES) {
  check(fs.existsSync(path.join(ROOT, relativePath)), `${MODE} file exists: ${relativePath}`);
}

const status = readJson('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY-STATUS.json');
const delivery = readJson('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json');
const s3a = delivery.slices.find((slice) => slice.delivery_slice_id === S3A);
const s3b = delivery.slices.find((slice) => slice.delivery_slice_id === S3B);
const s4 = delivery.slices.find((slice) => slice.delivery_slice_id === S4);

const boundaryTarget = POSTMERGE ? status.merge_commit : 'HEAD';
try {
  cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, boundaryTarget], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  check(true, `${MODE} target descends from exact S3A postmerge baseline`);
} catch {
  check(false, `${MODE} target descends from exact S3A postmerge baseline`);
}

if (POSTMERGE) {
  check(typeof status.merge_commit === 'string' && status.merge_commit.length === 40, 'postmerge status records S3B merge commit');
  try {
    cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', status.merge_commit, 'HEAD'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    check(true, 'S3B merge commit is an ancestor of current main HEAD');
  } catch {
    check(false, 'S3B merge commit is an ancestor of current main HEAD');
  }
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...${boundaryTarget}`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), 'exact S3B changed-file set has 10 files');
  const forbidden = changed.filter((file) => FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(file)));
  check(forbidden.length === 0, `no migration, single-tick, route, web, or workflow file changed: ${forbidden.join(',')}`);
  git(['diff', '--check', `${BASELINE}...${boundaryTarget}`]);
  check(true, 'S3B git diff --check PASS');
} catch (error) {
  check(false, `S3B boundary available: ${error.message}`);
}

check(status.capability_line_id === 'MCFT-CAP-03', 'status capability exact');
check(status.delivery_slice_id === S3B, 'status delivery slice exact');
check(status.baseline_main_commit === BASELINE, 'status baseline exact');
check(status.branch === BRANCH, 'status branch exact');
check(status.primary_owner_work_package_id === 'MCFT-03', 'status primary owner exact');
check(JSON.stringify(status.contributing_owner_work_package_ids) === JSON.stringify(['MCFT-08']), 'status contributor exact');
check(JSON.stringify(status.depends_on_delivery_slice_ids) === JSON.stringify([S3A]), 'status dependency exact');
check(status.predecessor_effectiveness?.s3a_merged_main_gate === 'PASS_106_OF_106', 'S3A local postmerge evidence recorded');
check(status.predecessor_effectiveness?.s3a_effectiveness_condition_satisfied === true, 'S3A effectiveness condition satisfied');
check(JSON.stringify([...status.exact_changed_file_boundary].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'status exact changed-file boundary matches Gate');
check(status.successor_authorized === false, 'status does not authorize S4');

check(delivery.capability_line_id === 'MCFT-CAP-03', 'delivery capability exact');
check(delivery.design_status === 'DESIGN_FROZEN', 'CAP-03 design remains frozen');
check(delivery.authorization_effective === true, 'CAP-03 authorization remains effective');
check(delivery.active_delivery_slice_id === S3B, 'S3B is the only active delivery slice');
check(s3a?.status === 'MERGED', 'S3A delivery status MERGED');
check(s3a?.merge_commit === '66636e6e3259d6ada2e10566d984d095341040aa', 'S3A merge commit exact');
check(s3a?.merged_main_gate === 'PASS', 'S3A merged-main Gate PASS');
check(s3a?.effectiveness_condition_satisfied === true, 'S3A effectiveness recorded');
check(s3b?.baseline_main_commit === BASELINE, 'S3B delivery baseline exact');
check(s3b?.branch === BRANCH, 'S3B delivery branch exact');
check(s3b?.activation_fields_status === 'FROZEN', 'S3B activation fields frozen');
check(JSON.stringify([...(s3b?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'S3B delivery boundary exact');
check(s4?.status === 'BLOCKED', 'S4 remains blocked before S3B effectiveness');
check(s4?.branch === null && s4?.baseline_main_commit === null, 'S4 activation fields remain unset');
check(delivery.successor_capability_authorization?.authorized === false, 'MCFT-CAP-04 remains unauthorized');

if (DRAFT) {
  check(status.status === 'IN_PROGRESS', 'draft S3B status IN_PROGRESS');
  check(s3b?.status === 'IN_PROGRESS', 'draft delivery S3B IN_PROGRESS');
} else if (POSTMERGE) {
  check(status.status === 'MERGED', 'postmerge S3B status MERGED');
  check(s3b?.status === 'MERGED', 'postmerge delivery S3B MERGED');
  check(status.merged_main_gate === 'PASS', 'postmerge S3B merged-main Gate recorded');
  check(status.effectiveness_condition_satisfied === true, 'postmerge S3B effectiveness recorded');
} else {
  check(status.status === 'READY_FOR_MERGE', 'final S3B status READY_FOR_MERGE');
  check(s3b?.status === 'READY_FOR_MERGE', 'final delivery S3B READY_FOR_MERGE');
}

for (const nonclaim of [
  'NO_CAP_03_A2_TICK_COMMITTED',
  'NO_SINGLE_TICK_INTEGRATION',
  'NO_RANGE_EXECUTION',
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
  check(s3b?.preserved_nonclaims?.includes(nonclaim), `delivery preserved nonclaim: ${nonclaim}`);
}

const contract = readText('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY.md');
for (const marker of [
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
  'A_STATE_TICK_COMMIT',
  'A2_RECORD_SET',
  'EXISTING_IDEMPOTENT_SUCCESS',
  'IDEMPOTENCY_CONFLICT',
  'LOOKUP_BEFORE_LEASE',
  'zero migration',
  'five continuation projections',
  'projection divergence',
  'historical CAP-02',
  'PostgresAssimilatedRuntimeRepositoryV1',
]) {
  check(contract.toLowerCase().includes(marker.toLowerCase()), `contract document marker: ${marker}`);
}

const ports = readText('apps/server/src/runtime/twin_runtime/ports.ts');
const historicalRepository = readText('apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts');
const repository = readText('apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts');
check(ports.includes('interface AssimilatedContinuationPersistencePortV1'), 'independent CAP-03 persistence port declared');
check(repository.includes('extends PostgresRuntimeRepositoryV1'), 'CAP-03 repository inherits immutable CAP-02 repository behavior');
check(repository.includes('commitAssimilatedContinuationState'), 'CAP-03 atomic A2 commit implemented');
check(repository.includes('readAssimilatedContinuationRecordSet'), 'CAP-03 canonical readback implemented');
check(repository.includes('validateVersionedContinuationRecordSetV1'), 'readback uses versioned validator dispatch');
check(repository.includes('record_set_contract_id'), 'CAP-03 discriminator persisted in identity basis');
check(repository.includes("identity_kind='A2_RECORD_SET'"), 'existing A2 idempotency family reused');
check(repository.indexOf("identity_kind='A2_RECORD_SET'") < repository.indexOf('verifyLeaseV1(client'), 'idempotency lookup precedes lease verification');
check(repository.includes('CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT'), 'canonical uniqueness recovery retained');
check(repository.includes('STATE_LATEST_CAS_CONFLICT') && repository.includes('CHECKPOINT_CAS_CONFLICT') && repository.includes('FORECAST_RESULT_CAS_CONFLICT'), 'State, checkpoint, and Forecast CAS guards retained');
check(repository.includes('rebuildAssimilatedContinuationProjections'), 'five-projection rebuild implemented');
check(!/INSERT INTO\s+twin_forecast_success_latest_index_v1/i.test(repository), 'no successful Forecast projection write');
check(!/UPDATE\s+twin_active_lineage_index_v1/i.test(repository), 'no active lineage mutation');
check(historicalRepository.includes('commitContinuationState') && historicalRepository.includes('readContinuationRecordSet'), 'historical CAP-02 repository source remains present');

runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY.ts',
  /MCFT-CAP-03 assimilated persistence recovery: 10 PASS, 0 FAIL/,
  'S3B positive in-memory acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_NEGATIVE.ts',
  /MCFT-CAP-03 assimilated persistence recovery negative: 11 PASS, 0 FAIL/,
  'S3B negative in-memory acceptance PASS',
);

if (RUN_DB) {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_ASSIMILATED_PERSISTENCE_RECOVERY_DB.ts',
    /MCFT-CAP-03 assimilated persistence recovery DB: 15 PASS, 0 FAIL/,
    'S3B isolated PostgreSQL acceptance PASS',
    { ...process.env, MCFT_CAP_03_S3B_DESTRUCTIVE_ACCEPTANCE: '1' },
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
    check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
  } catch (error) {
    check(false, `postmerge origin/main available: ${error.message}`);
  }
} else {
  check(currentBranch === BRANCH, `${MODE} Gate runs on S3B branch`);
}

console.log(`MCFT-CAP-03 assimilated persistence recovery ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
