// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs
// Purpose: gate the exact continuation Persistence slice, including merged-main Evidence Window proof, A2 atomic/idempotent/CAS/rebuild contracts, pure and negative acceptance, isolated PostgreSQL proof, typecheck, and build.
// Boundary: governance orchestration only; no candidate record-set construction in production, tick orchestration, range, restart, successful Forecast, route, scheduler, or capability completion claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '869593d269b5175b216ce494b55b4b121db45190';
const BRANCH = 'mcft-cap-02-continuation-persistence-v1';
const SLICE = 'MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-05.CONTINUATION-EVIDENCE-WINDOW-V1';
const NEXT_SLICE = 'MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

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

const PRESERVED_NONCLAIMS = [
  'NO_RUNTIME_TICK_ORCHESTRATION',
  'NO_A2_END_TO_END_TICK_EXECUTED',
  'NO_RESTART_RESUME_PROOF',
  'NO_BOUNDED_BACKFILL_PROOF',
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
    check(true, 'Persistence slice descends from verified Evidence Window merge commit');
  } catch {
    check(false, 'Persistence slice descends from verified Evidence Window merge commit');
  }

  try {
    const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
    check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
    const forbidden = changed.filter((file) =>
      file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/scripts/mcft/')
      || file.startsWith('.github/workflows/')
      || (file.startsWith('apps/server/db/migrations/') && file !== 'apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql'),
    );
    check(forbidden.length === 0, `no forbidden route, runner, workflow, or unrelated migration file changed: ${forbidden.join(',')}`);
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
  const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);

  check(delivery.status === (MODE === 'draft' ? 'CONTINUATION_PERSISTENCE_IN_PROGRESS' : 'CONTINUATION_PERSISTENCE_READY_FOR_MERGE'), `${MODE} capability status exact`);
  check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit exact');
  check(delivery.active_delivery_slice_id === SLICE, 'continuation Persistence is active delivery slice');
  check(predecessor?.status === 'MERGED', 'Evidence Window predecessor status MERGED');
  check(predecessor?.merge_commit === BASELINE, 'Evidence Window predecessor merge commit exact');
  check(predecessor?.merged_main_acceptance?.final_gate === '71_PASS_0_FAIL', 'Evidence Window merged-main Gate evidence exact');
  check(predecessor?.merged_main_acceptance?.positive_evidence_window === '11_PASS_0_FAIL', 'Evidence Window positive evidence exact');
  check(predecessor?.merged_main_acceptance?.negative_evidence_window === '12_PASS_0_FAIL', 'Evidence Window negative evidence exact');
  check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} Persistence slice status exact`);
  check(current?.branch === BRANCH, 'Persistence branch exact');
  check(current?.primary_owner_work_package_id === 'MCFT-03', 'Persistence primary owner exact');
  check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), 'Persistence dependency exact');
  check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'Persistence exact changed-file boundary matches Gate');
  check(next?.status === 'BLOCKED', 'single-tick integration remains blocked');
  check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice is authorized while Persistence is active');
  check(delivery.completion_claims?.includes('CONTINUATION_EVIDENCE_WINDOW_MERGED_MAIN_VERIFIED'), 'Evidence Window merged-main completion claim recorded');
  for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
}

function checkContractAndFixtures() {
  const contract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-PERSISTENCE-CONTRACT.json');
  const expected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_02_PERSISTENCE_FIXTURES.json');
  const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_PERSISTENCE_NEGATIVE_FIXTURES.json');
  check(contract.transaction?.family === 'A_STATE_TICK_COMMIT', 'A transaction family frozen');
  check(contract.transaction?.operation_variant === 'A2_BLOCKED_FORECAST', 'A2 operation variant frozen');
  check(contract.transaction?.canonical_fact_append_count === 8, 'exact eight canonical fact appends frozen');
  check(contract.transaction?.projection_write_count === 5, 'exact five continuation projection writes frozen');
  check(contract.transaction?.active_lineage_write_count === 0, 'active lineage is verify-only');
  check(contract.transaction?.successful_forecast_latest_write_count === 0, 'successful Forecast latest remains non-written');
  check(contract.idempotency?.identity_kind === 'A2_RECORD_SET', 'A2 idempotency identity kind frozen');
  check(contract.idempotency?.lookup_precedes_lease_verification === true, 'idempotency lookup precedes lease verification');
  check(contract.idempotency?.same_key_same_hash === 'EXISTING_IDEMPOTENT_SUCCESS', 'same key and hash idempotent status frozen');
  check(contract.idempotency?.same_key_different_hash === 'IDEMPOTENCY_CONFLICT', 'same key and different hash conflict frozen');
  check(contract.idempotency?.canonical_uniqueness_recovery === 'CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT', 'canonical uniqueness recovery frozen');
  check(contract.rebuild?.rebuilt_projection_count === 5, 'five-projection rebuild contract frozen');
  check(contract.database_schema?.new_table_count === 0, 'no new persistence table allowed');
  check(expected.expected?.canonical_member_count === 8, 'expected fixture has eight canonical members');
  check(expected.expected?.continuation_projection_count === 5, 'expected fixture has five continuation projections');
  check(expected.expected?.fault_injection_stage_count === 15, 'expected fixture freezes fifteen fault stages');
  check(negative.cases?.length >= 15, 'negative fixture coverage has at least fifteen cases');
}

function checkSourceAnchors() {
  const migration = readText('apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql');
  const repository = readText('apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts');
  const projections = readText('apps/server/src/projections/twin_runtime/projection_rebuilder_v1.ts');
  const ports = readText('apps/server/src/runtime/twin_runtime/ports.ts');
  const predecessorGate = readText('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.cjs');

  check(migration.includes("'A2_RECORD_SET'"), 'existing idempotency guard admits A2_RECORD_SET');
  check(!migration.includes('CREATE TABLE'), 'Persistence migration creates no parallel table');
  check(repository.includes('implements RuntimeConfigRepositoryPortV1, BootstrapPersistencePortV1, ContinuationPersistencePortV1'), 'existing repository implements continuation port');
  check(repository.includes('async commitContinuationState'), 'continuation commit method implemented');
  check(repository.includes('async readContinuationRecordSet'), 'continuation canonical readback implemented');
  check(repository.includes('async rebuildContinuationProjections'), 'continuation projection rebuild implemented');
  check(repository.includes("identity_kind='A2_RECORD_SET'"), 'A2 idempotency lookup implemented');
  check(repository.includes('CANONICAL_CONTINUATION_UNIQUENESS_CONFLICT'), 'canonical uniqueness recovery implemented');
  check(repository.includes('STALE_FENCING_TOKEN') && repository.includes('LEASE_EXPIRED'), 'fencing and expiry rejection retained');
  check(repository.includes('STATE_LATEST_CAS_CONFLICT') && repository.includes('CHECKPOINT_CAS_CONFLICT') && repository.includes('FORECAST_RESULT_CAS_CONFLICT'), 'State, checkpoint, and Forecast CAS rejection implemented');
  check(repository.includes('SUCCESSFUL_FORECAST_POINTER_UNEXPECTED'), 'successful Forecast pointer non-write verification implemented');
  check(projections.includes('buildContinuationProjectionRowsV1'), 'continuation projection mapper implemented');
  check(ports.includes('ContinuationPersistencePortV1'), 'continuation persistence port implemented');
  check(!repository.includes('Fastify') && !repository.includes('recommendation'), 'Persistence boundary excludes routes and Recommendation');
  check(predecessorGate.includes('--postmerge'), 'Evidence Window Gate has explicit postmerge mode');
  check(predecessorGate.includes('continuation Persistence is the only active delivery slice'), 'Evidence Window postmerge Gate distinguishes active Persistence state');

  const start = repository.indexOf('async commitContinuationState');
  const idempotency = repository.indexOf("identity_kind='A2_RECORD_SET'", start);
  const lease = repository.indexOf('await this.verifyLease(', start);
  const authority = repository.indexOf('await this.verifyContinuationAuthorityV1(', start);
  const uniqueness = repository.indexOf('await this.verifyContinuationCanonicalUniquenessV1(', start);
  const firstFact = repository.indexOf('INSERT INTO facts (fact_id,occurred_at,source,record_json)', start);
  check(start >= 0 && idempotency > start && lease > idempotency && authority > lease && uniqueness > authority && firstFact > uniqueness, 'A2 idempotency precedes lease, authority, uniqueness, and canonical append');
}

function runTsx(relativePath, pattern, message, env = process.env) {
  try {
    const output = run(pnpmCommand(), ['exec', 'tsx', relativePath], env);
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

function runAcceptances() {
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.ts',
    /MCFT-CAP-02 persistence: \d+ PASS, 0 FAIL/,
    'Persistence pure acceptance PASS',
  );
  runTsx(
    'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_NEGATIVE.ts',
    /MCFT-CAP-02 persistence negative: \d+ PASS, 0 FAIL/,
    'Persistence negative acceptance PASS',
  );
}

function runFinalChecks() {
  if (MODE !== 'final') return;

  try {
    const output = run(process.platform === 'win32' ? 'node.exe' : 'node', [
      'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_EVIDENCE_WINDOW.cjs',
      '--postmerge',
    ]);
    process.stdout.write(output);
    check(/MCFT-CAP-02 evidence-window postmerge: \d+ PASS, 0 FAIL/.test(output), 'Evidence Window explicit postmerge Gate PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'Evidence Window explicit postmerge Gate PASS');
  }

  const destructiveEnabled = process.env.MCFT_CAP_02_PERSISTENCE_DESTRUCTIVE_ACCEPTANCE === '1';
  const databaseUrl = process.env.DATABASE_URL;
  let isolatedDatabase = false;
  if (databaseUrl) {
    try {
      isolatedDatabase = /(mcft|cap02|acceptance|test)/.test(new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase());
    } catch {
      isolatedDatabase = false;
    }
  }
  check(destructiveEnabled && Boolean(databaseUrl) && isolatedDatabase, 'final Gate requires isolated PostgreSQL continuation persistence acceptance environment');
  if (destructiveEnabled && databaseUrl && isolatedDatabase) {
    runTsx(
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE_DB.ts',
      /MCFT-CAP-02 persistence DB: \d+ PASS, 0 FAIL/,
      'Persistence PostgreSQL acceptance PASS',
    );
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

console.log(`MCFT-CAP-02 persistence ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
