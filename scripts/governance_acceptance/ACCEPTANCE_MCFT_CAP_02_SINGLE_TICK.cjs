// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.cjs
// Purpose: gate the exact MCFT-CAP-02 Single-Tick Integration slice, including merged-main Persistence proof, orchestration order, eight-object candidate construction, pure/negative acceptance, isolated PostgreSQL proof, typecheck, and build.
// Boundary: governance orchestration only; no range, restart, backfill, public route, scheduler, Forecast success, Scenario, Recommendation, Decision, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '1b7ea8058b097b5f5fcc4bf1566462c381bc6d47';
const BRANCH = 'mcft-cap-02-single-tick-integration-v1';
const SLICE = 'MCFT-CAP-02.MCFT-04-06-08-09.SINGLE-TICK-INTEGRATION-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-03.CONTINUATION-PERSISTENCE-V1';
const NEXT_SLICE = 'MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_record_set_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-SINGLE-TICK-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_SINGLE_TICK_FIXTURES.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_SINGLE_TICK_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_single_tick_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
  'NO_TWENTY_FOUR_TICK_RANGE_EXECUTED',
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
  'NO_MCFT_CAP_02_COMPLETE_CLAIM',
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
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function run(command, args, env = process.env) {
  return cp.execFileSync(command, args, { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}
function nodeCommand() {
  return process.platform === 'win32' ? 'node.exe' : 'node';
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

try {
  cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'Single-Tick slice descends from verified Persistence merge commit');
} catch {
  check(false, 'Single-Tick slice descends from verified Persistence merge commit');
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
  const forbidden = changed.filter((file) =>
    file.startsWith('apps/web/')
    || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/server/scripts/mcft/')
    || file.startsWith('.github/workflows/')
    || file.startsWith('apps/server/db/migrations/'),
  );
  check(forbidden.length === 0, `no route, runner, workflow, or migration changed: ${forbidden.join(',')}`);
  git(['diff', '--check', `${BASELINE}...HEAD`]);
  check(true, 'git diff --check PASS');
} catch (error) {
  check(false, `changed-file boundary and diff check available: ${error.message}`);
}

const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === PREDECESSOR_SLICE);
const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);
check(delivery.status === (MODE === 'draft' ? 'SINGLE_TICK_INTEGRATION_IN_PROGRESS' : 'SINGLE_TICK_INTEGRATION_READY_FOR_MERGE'), `${MODE} capability status exact`);
check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit exact');
check(delivery.active_delivery_slice_id === SLICE, 'Single-Tick Integration is active delivery slice');
check(predecessor?.status === 'MERGED', 'Persistence predecessor status MERGED');
check(predecessor?.merge_commit === BASELINE, 'Persistence predecessor merge commit exact');
check(predecessor?.merged_main_acceptance?.final_gate === '86_PASS_0_FAIL', 'Persistence merged-main final Gate evidence exact');
check(predecessor?.merged_main_acceptance?.postgres_persistence === '15_PASS_0_FAIL', 'Persistence PostgreSQL evidence exact');
check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} Single-Tick slice status exact`);
check(current?.branch === BRANCH, 'Single-Tick branch exact');
check(current?.primary_owner_work_package_id === 'MCFT-04', 'Single-Tick primary owner exact');
check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), 'Single-Tick dependency exact');
check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'Single-Tick exact changed-file boundary matches Gate');
check(next?.status === 'BLOCKED', '24-tick range remains blocked');
check(delivery.completion_claims?.includes('CONTINUATION_PERSISTENCE_MERGED_MAIN_VERIFIED'), 'Persistence merged-main completion claim recorded');
for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.global_preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
if (MODE === 'draft') check(delivery.global_preserved_nonclaims?.includes('NO_A2_END_TO_END_TICK_EXECUTED'), 'draft retains no end-to-end A2 tick claim');

const contract = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-SINGLE-TICK-CONTRACT.json');
const expected = readJson('fixtures/mcft/water_state/expected/MCFT_CAP_02_SINGLE_TICK_FIXTURES.json');
const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_SINGLE_TICK_NEGATIVE_FIXTURES.json');
check(contract.standard_logical_time === '2026-06-01T02:00:00.000Z', 'standard T=02:00 single tick frozen');
check(contract.transaction_family === 'A_STATE_TICK_COMMIT', 'A transaction family frozen');
check(contract.operation_variant === 'A2_BLOCKED_FORECAST', 'A2 operation variant frozen');
check(contract.execution_cardinality === 'EXACTLY_ONE_REQUESTED_NEXT_TICK', 'single-tick cardinality frozen');
check(contract.candidate_member_types?.length === 8, 'exact eight candidate object types frozen');
check(contract.idempotency?.lookup_before_evidence_and_lease === true, 'idempotency precedes Evidence and lease');
check(contract.idempotency?.existing_success_acquires_new_lease === false, 'idempotent success does not acquire lease');
check(contract.standard_expected_state?.storage_mean_mm === '57.753012', 'standard storage mean frozen');
check(contract.standard_expected_state?.storage_variance_mm2 === '241.270014630625', 'standard storage variance frozen');
check(contract.standard_expected_checkpoint?.tick_sequence === 1, 'first continuation checkpoint sequence frozen');
check(contract.standard_expected_checkpoint?.next_tick_logical_time === '2026-06-01T03:00:00.000Z', 'next persisted tick time frozen');
check(contract.standard_expected_forecast?.status === 'BLOCKED', 'Forecast remains BLOCKED');
check(expected.expected?.member_count === 8, 'positive fixture has eight members');
check(expected.expected?.new_fact_count === 8, 'positive fixture has eight new facts');
check(expected.expected?.projection_write_count === 5, 'positive fixture has five projection writes');
check(negative.cases?.length >= 15, 'negative fixture has at least fifteen cases');

const ports = readText('apps/server/src/runtime/twin_runtime/ports.ts');
const handoff = readText('apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts');
const builder = readText('apps/server/src/runtime/twin_runtime/continuation_record_set_builder_v1.ts');
const service = readText('apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts');
const predecessorGate = readText('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs');
check(ports.includes('previous_forecast_result_ref') && ports.includes('previous_variance_basis'), 'persisted handoff exposes Forecast pointer and exact variance basis');
check(handoff.includes('DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1') && handoff.includes('CARRIED_FROM_PREVIOUS_CONTINUATION_STATE'), 'handoff distinguishes first and subsequent continuation basis');
check(handoff.includes('persistedBootstrapStorageMeanV1') && handoff.includes('root_zone_water_storage_mm'), 'first continuation preserves persisted A0 storage basis without VWC re-derivation');
check(handoff.includes('resolvePreviousCheckpointTickSequenceV1'), 'checkpoint sequence is derived from persisted checkpoint');
check(builder.includes('validateContinuationRecordSetV1(recordSet)'), 'candidate builder validates complete cross-reference graph');
check(builder.includes('twin_assimilation_update_v1') && builder.includes('status: "NOT_APPLIED"'), 'explicit NOT_APPLIED assimilation is built');
check(builder.includes('status: "BLOCKED"') && builder.includes('successful_forecast_ref: null'), 'BLOCKED Forecast candidate is built');
check(service.includes('lookupContinuationRecordSet') && service.includes('acquireLease'), 'single-tick service implements idempotency and lease path');
const lookup = service.indexOf('this.persistence.lookupContinuationRecordSet(');
const evidence = service.indexOf('this.evidenceSource.loadCandidateRecords(');
const lease = service.indexOf('this.persistence.acquireLease(');
const commit = service.indexOf('this.persistence.commitContinuationState(');
const readback = service.indexOf('this.persistence.readContinuationRecordSet(');
check(lookup >= 0 && evidence > lookup && lease > evidence && commit > lease && readback > commit, 'single-tick source order is idempotency, Evidence, lease, commit, readback');
check(!service.includes('Date.now') && !service.includes('process.env') && !service.includes('setInterval') && !service.includes('Fastify'), 'single-tick service excludes wall clock, environment, scheduler, and routes');
const executeStart = service.indexOf('async executeOneTick');
const executeBody = executeStart >= 0 ? service.slice(executeStart) : service;
const rangeLoopPattern = /for\s*\(\s*(?:let|const)\s+(?:tick|hour|logicalTime|currentTime|cursor)\b|while\s*\(/;
check(!rangeLoopPattern.test(executeBody), 'single-tick service contains no range loop');
check(predecessorGate.includes('--postmerge') && predecessorGate.includes('Persistence merge commit is an ancestor'), 'Persistence Gate has explicit historical postmerge mode');

runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK.ts',
  /MCFT-CAP-02 single-tick: \d+ PASS, 0 FAIL/,
  'Single-Tick positive acceptance PASS',
);
runTsx(
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_NEGATIVE.ts',
  /MCFT-CAP-02 single-tick negative: \d+ PASS, 0 FAIL/,
  'Single-Tick negative acceptance PASS',
);

if (MODE === 'final') {
  try {
    const output = run(nodeCommand(), ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_PERSISTENCE.cjs', '--postmerge']);
    process.stdout.write(output);
    check(/MCFT-CAP-02 persistence postmerge: \d+ PASS, 0 FAIL/.test(output), 'Persistence explicit postmerge Gate PASS');
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, 'Persistence explicit postmerge Gate PASS');
  }

  const destructiveEnabled = process.env.MCFT_CAP_02_SINGLE_TICK_DESTRUCTIVE_ACCEPTANCE === '1';
  const databaseUrl = process.env.DATABASE_URL;
  let isolatedDatabase = false;
  if (databaseUrl) {
    try {
      isolatedDatabase = /(mcft|cap02|acceptance|test)/.test(new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase());
    } catch {
      isolatedDatabase = false;
    }
  }
  check(destructiveEnabled && Boolean(databaseUrl) && isolatedDatabase, 'final Gate requires isolated PostgreSQL single-tick acceptance environment');
  if (destructiveEnabled && databaseUrl && isolatedDatabase) {
    runTsx(
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_SINGLE_TICK_DB.ts',
      /MCFT-CAP-02 single-tick DB: \d+ PASS, 0 FAIL/,
      'Single-Tick PostgreSQL acceptance PASS',
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

console.log(`MCFT-CAP-02 single-tick ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
