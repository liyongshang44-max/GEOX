// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.cjs
// Purpose: gate the exact MCFT-CAP-02 restart/resume and bounded-backfill slice, predecessor merged-main proof, shared execution path, split-process acceptance, PostgreSQL proof, typecheck, and build.
// Boundary: governance orchestration only; no projection repair, failure-recovery closure, scheduler, public route, Forecast success, Scenario, Recommendation, Decision, or action.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'af798ecdffd1d85e9caa9472d465433c20da9957';
const RANGE_BASELINE = '18c921c64463d6d9de5af2b4727c185970d771ef';
const RANGE_MERGE = 'ebf637fcafaee58dc1e72bc366e8591881257863';
const BRANCH = 'mcft-cap-02-restart-backfill-v1';
const SLICE = 'MCFT-CAP-02.MCFT-04.RESTART-BACKFILL-V1';
const PREDECESSOR_SLICE = 'MCFT-CAP-02.MCFT-04-08.TWENTY-FOUR-TICK-RANGE-V1';
const NEXT_SLICE = 'MCFT-CAP-02.FAILURE-RECOVERY-V1';
const MODE = process.argv.includes('--draft') ? 'draft' : 'final';

const EXACT_CHANGED_FILES = [
  'apps/server/scripts/mcft/MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts',
  'apps/server/src/adapters/twin_runtime/replay_range_intent_adapter_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/restart_resume_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_restart_backfill_fixture_v1.ts',
].sort();

const RANGE_CHANGED_FILES = [
  'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/continuation_tick_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.ts',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TWENTY-FOUR-TICK-RANGE-CONTRACT.json',
  'fixtures/mcft/water_state/expected/MCFT_CAP_02_24_TICK_EXPECTED.json',
  'fixtures/mcft/water_state/negative/MCFT_CAP_02_24_TICK_NEGATIVE_FIXTURES.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_02_twenty_four_tick_fixture_v1.ts',
].sort();

const PRESERVED_NONCLAIMS = [
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
function readText(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function readJson(relativePath) { return JSON.parse(readText(relativePath)); }
function git(args) { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function run(command, args, env = process.env) { return cp.execFileSync(command, args, { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function pnpmCommand() { return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'; }
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
function runPnpm(args, pattern, message) {
  try {
    const output = run(pnpmCommand(), args);
    process.stdout.write(output);
    check(pattern.test(output), message);
  } catch (error) {
    process.stderr.write(error.stderr || error.message);
    check(false, message);
  }
}

try {
  cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'restart/backfill slice descends from the latest verified 24-tick main head');
} catch {
  check(false, 'restart/backfill slice descends from the latest verified 24-tick main head');
}

try {
  const changed = git(['diff', '--name-only', `${BASELINE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(changed) === JSON.stringify(EXACT_CHANGED_FILES), `exact changed-file set has ${EXACT_CHANGED_FILES.length} files`);
  const forbidden = changed.filter((file) => file.startsWith('apps/web/') || file.startsWith('apps/server/src/routes/') || file.startsWith('.github/workflows/') || file.startsWith('apps/server/db/migrations/'));
  check(forbidden.length === 0, `no web, route, workflow, or migration changed: ${forbidden.join(',')}`);
  git(['diff', '--check', `${BASELINE}...HEAD`]);
  check(true, 'git diff --check PASS');
} catch (error) {
  check(false, `changed-file boundary and diff check available: ${error.message}`);
}

try {
  const historical = git(['diff', '--name-only', `${RANGE_BASELINE}...${RANGE_MERGE}`]).split(/\r?\n/).filter(Boolean).sort();
  check(JSON.stringify(historical) === JSON.stringify(RANGE_CHANGED_FILES), 'historical 24-tick changed-file set has 12 files');
  git(['diff', '--check', `${RANGE_BASELINE}...${RANGE_MERGE}`]);
  check(true, 'historical 24-tick git diff --check PASS');
  const cleanupNet = git(['diff', '--name-only', `${RANGE_MERGE}...${BASELINE}`]).split(/\r?\n/).filter(Boolean);
  check(cleanupNet.length === 0, 'post-merge cleanup commits have zero net file-tree difference');
} catch (error) {
  check(false, `historical 24-tick proof available: ${error.message}`);
}

const delivery = readJson('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-DELIVERY-SLICE-STATUS.json');
const predecessor = delivery.slices.find((slice) => slice.delivery_slice_id === PREDECESSOR_SLICE);
const current = delivery.slices.find((slice) => slice.delivery_slice_id === SLICE);
const next = delivery.slices.find((slice) => slice.delivery_slice_id === NEXT_SLICE);
check(delivery.status === (MODE === 'draft' ? 'RESTART_BACKFILL_IN_PROGRESS' : 'RESTART_BACKFILL_READY_FOR_MERGE'), `${MODE} capability status exact`);
check(delivery.latest_verified_main_commit === BASELINE, 'latest verified main commit is the post-cleanup 24-tick verification head');
check(delivery.active_delivery_slice_id === SLICE, 'restart/backfill is the active delivery slice');
check(predecessor?.status === 'MERGED', '24-tick predecessor status MERGED');
check(predecessor?.merge_commit === RANGE_MERGE, '24-tick predecessor merge commit exact');
check(predecessor?.implementation_candidate_head === 'ce655f8f7297c6822af9b84a5fe8a2097d93bb8e', '24-tick implementation candidate head exact');
check(predecessor?.merged_main_acceptance?.final_gate === '68_PASS_0_FAIL', '24-tick merged-main final Gate evidence exact');
check(predecessor?.merged_main_acceptance?.postgres_range === '8_PASS_0_FAIL', '24-tick PostgreSQL evidence exact');
check(predecessor?.merged_main_acceptance?.verified_main_commit === BASELINE, '24-tick latest verified main head exact');
check(current?.status === (MODE === 'draft' ? 'IN_PROGRESS' : 'READY_FOR_MERGE'), `${MODE} restart/backfill slice status exact`);
check(current?.branch === BRANCH, 'restart/backfill branch exact');
check(JSON.stringify(current?.depends_on_delivery_slice_ids) === JSON.stringify([PREDECESSOR_SLICE]), 'restart/backfill dependency exact');
check(JSON.stringify([...(current?.exact_changed_file_boundary || [])].sort()) === JSON.stringify(EXACT_CHANGED_FILES), 'restart/backfill exact changed-file boundary matches Gate');
check(next?.status === 'BLOCKED', 'failure-recovery remains blocked');
check(delivery.completion_claims?.includes('TWENTY_FOUR_TICK_RANGE_MERGED_MAIN_VERIFIED'), '24-tick merged-main completion claim recorded');
for (const nonclaim of PRESERVED_NONCLAIMS) check(delivery.global_preserved_nonclaims?.includes(nonclaim), `preserved nonclaim: ${nonclaim}`);
if (MODE === 'draft') {
  check(delivery.global_preserved_nonclaims?.includes('NO_RESTART_RESUME_PROOF'), 'draft retains NO_RESTART_RESUME_PROOF');
  check(delivery.global_preserved_nonclaims?.includes('NO_BOUNDED_BACKFILL_PROOF'), 'draft retains NO_BOUNDED_BACKFILL_PROOF');
} else {
  check(!delivery.global_preserved_nonclaims?.includes('NO_RESTART_RESUME_PROOF'), 'final removes NO_RESTART_RESUME_PROOF');
  check(!delivery.global_preserved_nonclaims?.includes('NO_BOUNDED_BACKFILL_PROOF'), 'final removes NO_BOUNDED_BACKFILL_PROOF');
}

const contract = readText('docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT.md');
const negative = readJson('fixtures/mcft/water_state/negative/MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE_FIXTURES.json');
check(contract.includes('GEOX-MCFT-CAP-02-RESTART-BACKFILL-CONTRACT-V1'), 'restart/backfill contract identity frozen');
check(contract.includes('process 1:\nticks 1 through 12'), 'standard first process ticks 1–12 frozen');
check(contract.includes('process 2:\nticks 13 through 24'), 'standard second process ticks 13–24 frozen');
check(contract.includes('maximum 24 ticks per invocation'), 'bounded backfill maximum 24 ticks frozen');
check(contract.includes('CHECKPOINT_PROJECTION_DIVERGENCE'), 'checkpoint projection divergence reason frozen');
check(contract.includes('LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN'), 'late-Evidence forward-backfill prohibition frozen');
check(negative.cases?.length >= 14, 'negative fixture has at least fourteen cases');
check(negative.cases?.every((item) => item.expected_no_current_tick_a2_append === true && item.expected_no_current_tick_projection_write === true), 'all negative fixtures freeze zero current-tick writes');

const restartSource = readText('apps/server/src/runtime/twin_runtime/restart_resume_service_v1.ts');
const handoffSource = readText('apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts');
const postgresSource = readText('apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts');
const rangeSource = readText('apps/server/src/runtime/twin_runtime/contiguous_continuation_range_service_v1.ts');
const adapterSource = readText('apps/server/src/adapters/twin_runtime/replay_range_intent_adapter_v1.ts');
const runnerSource = readText('apps/server/scripts/mcft/MCFT_CAP_02_HOURLY_DYNAMICS_RUNNER.ts');
const dbAcceptanceSource = readText('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts');
check((restartSource.match(/this\.rangeService\.runContiguousContinuationRangeV1\(/g) || []).length === 2, 'resume and backfill both delegate to the one verified range core');
check(!/\bfor\s*\(|\bwhile\s*\(/.test(restartSource), 'restart service contains no second tick loop');
check(restartSource.includes('BACKFILL_START_NOT_PERSISTED_NEXT_TICK'), 'backfill rejects a skipped persisted hour');
check(restartSource.includes('LATE_EVIDENCE_FORWARD_BACKFILL_FORBIDDEN'), 'backfill rejects late-Evidence revision intent');
check(restartSource.includes('CHECKPOINT_PROJECTION_DIVERGENCE_SOURCE_CODES_V1'), 'restart normalizes persisted projection divergence');
check(handoffSource.includes('async resumeFromCheckpointV1('), 'handoff service exposes restart-specific persisted validation');
check(handoffSource.includes('snapshot.last_terminal_tick'), 'restart validation requires the persisted terminal tick');
check(handoffSource.includes('last_completed_tick_ref') && handoffSource.includes('nextTime - terminalTime !== 60 * 60 * 1000'), 'restart validates checkpoint-to-terminal-tick reference and T+1 time');
check(postgresSource.includes('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'), 'PostgreSQL handoff uses one repeatable-read snapshot');
check(postgresSource.includes('lastCompletedTickRef') && postgresSource.includes('twin_runtime_tick_v1'), 'PostgreSQL handoff resolves the last terminal runtime tick');
check(rangeSource.includes('MAX_CONTIGUOUS_CONTINUATION_TICKS_V1 = 24'), 'shared range core retains the 24-tick invocation cap');
check(adapterSource.includes('REPLAY_OPERATOR_INTENT_REQUIRED') && adapterSource.includes('DATABASE_URL_REQUIRED'), 'manual intent adapter requires explicit Replay intent and database authority');
for (const mode of ['single-tick', 'range', 'resume', 'backfill']) check(adapterSource.includes(`"${mode}"`), `manual intent adapter supports ${mode}`);
check(runnerSource.includes('RestartResumeServiceV1') && runnerSource.includes('ContiguousContinuationRangeServiceV1') && runnerSource.includes('ContinuationTickServiceV1'), 'manual runner wires restart, range, and single-tick services together');
check(!runnerSource.includes('Fastify') && !runnerSource.includes('setInterval') && !runnerSource.includes('Date.now'), 'manual runner excludes route, scheduler, and implicit wall clock');
check(dbAcceptanceSource.includes('spawnSync') && dbAcceptanceSource.includes('MCFT_CAP_02_RESTART_BACKFILL_CHILD_STAGE'), 'PostgreSQL acceptance launches a distinct operating-system process for resume');
check(dbAcceptanceSource.includes('jsonb_array_elements_text(member_object_ids)') && dbAcceptanceSource.includes("identity_kind='A2_RECORD_SET'"), 'PostgreSQL A2 fact count is derived from A2 idempotency membership rather than shared object types');

runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL.ts', /MCFT-CAP-02 restart backfill: \d+ PASS, 0 FAIL/, 'restart/backfill positive acceptance PASS');
runTsx('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_NEGATIVE.ts', /MCFT-CAP-02 restart backfill negative: \d+ PASS, 0 FAIL/, 'restart/backfill negative acceptance PASS');

if (MODE === 'final') {
  const destructiveEnabled = process.env.MCFT_CAP_02_RESTART_BACKFILL_DESTRUCTIVE_ACCEPTANCE === '1';
  const databaseUrl = process.env.DATABASE_URL;
  let isolatedDatabase = false;
  if (databaseUrl) {
    try {
      const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
      isolatedDatabase = /(mcft|cap02|acceptance|test)/.test(databaseName);
    } catch {
      isolatedDatabase = false;
    }
  }
  check(destructiveEnabled && isolatedDatabase, 'final Gate requires isolated PostgreSQL restart/backfill acceptance environment');
  if (destructiveEnabled && isolatedDatabase) {
    runTsx(
      'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_RESTART_BACKFILL_DB.ts',
      /MCFT-CAP-02 restart backfill DB: \d+ PASS, 0 FAIL/,
      'restart/backfill PostgreSQL split-process acceptance PASS',
      process.env,
    );
  }
  runPnpm(['--filter', '@geox/server', 'typecheck'], /typecheck/, 'server typecheck PASS');
  runPnpm(['--filter', '@geox/server', 'build'], /build/, 'server build PASS');
}

console.log(`MCFT-CAP-02 restart backfill ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exitCode = 1;
