// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs
// Purpose: verify the governance-only MCFT-CAP-04 P0 reconciliation against effective MCFT-CAP-03 authority and the complete v0.5 task.
// Boundary: no Runtime source, persistence, migration, route, scheduler, web, canonical fact, Forecast, Scenario, or CAP-04 authorization.

'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'eca0d053045db59982ad20a6e0421f72ae16f804';
const BRANCH = 'agent/mcft-cap-04-p0-ssot-v1';
const P0 = 'MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const TASK_SHA256 = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';
const MODE = process.argv.includes('--postmerge')
  ? 'postmerge'
  : process.argv.includes('--final')
    ? 'final'
    : 'draft';

const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAIN_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const R4_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';
const TASK_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs';
const FILES = [MAP_PATH, MATRIX_PATH, TASK_PATH, STATUS_PATH, GATE_PATH].sort();

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

function exactSet(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  check(
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()),
    `${label} exact`,
  );
}

function changedFiles() {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean);
  if (MODE === 'postmerge') return tracked.sort();
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

for (const file of [...FILES, MAIN_VERIFICATION_PATH, R4_VERIFICATION_PATH]) {
  check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

const matrix = readJson(MATRIX_PATH);
const implementationMap = readText(MAP_PATH);
const mainVerification = readJson(MAIN_VERIFICATION_PATH);
const r4Verification = readJson(R4_VERIFICATION_PATH);
const task = readText(TASK_PATH);
const status = readJson(STATUS_PATH);
const cap03 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-03');
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
const cap04P0 = cap04?.delivery_slices?.find((slice) => slice.delivery_slice_id === P0);

check(mainVerification.status === 'VERIFIED_ON_MAIN', 'CAP-03 Main Verification is verified on main');
check(mainVerification.verified_on_main === true, 'CAP-03 verified_on_main true');
check(mainVerification.closure_effective === true, 'CAP-03 closure effective');
check(mainVerification.capability_complete === true, 'CAP-03 capability complete');
check(mainVerification.effective_completion_claims.length === 15, 'CAP-03 has fifteen effective completion claims');
check(mainVerification.runtime_evidence.global_state_count === 49, 'CAP-03 global State count is 49');
check(mainVerification.runtime_evidence.global_continuation_state_count === 48, 'CAP-03 continuation State count is 48');
check(mainVerification.runtime_evidence.last_checkpoint_sequence === 48, 'CAP-03 checkpoint sequence is 48');
check(mainVerification.runtime_evidence.next_tick_logical_time === '2026-06-03T02:00:00.000Z', 'CAP-03 next tick exact');
check(mainVerification.runtime_evidence.latest_successful_forecast_ref === null, 'CAP-03 successful Forecast pointer remains null');

check(r4Verification.status === 'VERIFIED_ON_MAIN', 'CAP-03 R4 final verification is verified on main');
check(r4Verification.verified_on_main === true, 'CAP-03 R4 verified_on_main true');
check(r4Verification.effectiveness_condition_satisfied === true, 'CAP-03 R4 effectiveness satisfied');
check(r4Verification.task_conformance.remaining_nonconformant_count === 0, 'CAP-03 R4 has zero remaining nonconformant items');
check(r4Verification.task_conformance.remaining_unadjudicated_contract_deviation_count === 0, 'CAP-03 R4 has zero unadjudicated deviations');
check(r4Verification.active_contract_authority.active_record_set_contract_id === 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2', 'CAP-03 active V2 record-set authority exact');

check(cap03?.status === 'COMPLETE', 'Vertical Matrix CAP-03 status COMPLETE');
check(cap03?.design_status === 'DESIGN_FROZEN', 'Vertical Matrix CAP-03 design frozen');
check(cap03?.implementation_status === 'COMPLETE', 'Vertical Matrix CAP-03 implementation COMPLETE');
check(cap03?.active_delivery_slice_id === null, 'Vertical Matrix CAP-03 active slice cleared');
check(cap03?.closure_effective === true, 'Vertical Matrix CAP-03 closure effective');
check(cap03?.capability_complete === true, 'Vertical Matrix CAP-03 capability complete');
check(Array.isArray(cap03?.pending_completion_claims) && cap03.pending_completion_claims.length === 0, 'Vertical Matrix CAP-03 pending claims empty');
check(Array.isArray(cap03?.completion_claims) && cap03.completion_claims.length === 15, 'Vertical Matrix CAP-03 fifteen effective claims');
check(cap03?.successor_authorized === false, 'Vertical Matrix CAP-04 remains unauthorized from CAP-03');
check(cap03?.post_completion_remediation_verification?.status === 'VERIFIED_ON_MAIN', 'Vertical Matrix records effective CAP-03 R4 verification');

check(cap04?.status === 'NOT_AUTHORIZED', 'Vertical Matrix CAP-04 status NOT_AUTHORIZED');
check(cap04?.design_status === 'FINAL_FROZEN_CANDIDATE_V0_5', 'Vertical Matrix CAP-04 design candidate v0.5');
check(cap04?.implementation_status === 'NOT_AUTHORIZED', 'Vertical Matrix CAP-04 implementation not authorized');
check(cap04?.runtime_source_authorized === false, 'Vertical Matrix CAP-04 Runtime source not authorized');
check(cap04?.authorization_effective === false, 'Vertical Matrix CAP-04 authorization ineffective');
check(cap04?.active_delivery_slice_id === null, 'Vertical Matrix CAP-04 active slice null');
check(cap04?.predecessor_capability_line_id === 'MCFT-CAP-03', 'Vertical Matrix CAP-04 predecessor exact');
check(cap04?.successor_capability_line_id === 'MCFT-CAP-05', 'Vertical Matrix CAP-04 successor exact');
check(cap04?.successor_authorized === false, 'Vertical Matrix CAP-05 remains unauthorized');
check(Array.isArray(cap04?.pending_completion_claims) && cap04.pending_completion_claims.length === 0, 'Vertical Matrix CAP-04 pending claims empty');
check(Array.isArray(cap04?.effective_completion_claims) && cap04.effective_completion_claims.length === 0, 'Vertical Matrix CAP-04 effective claims empty');
check(cap04?.task_ref === TASK_PATH, 'Vertical Matrix CAP-04 task ref exact');
check(cap04?.next_delivery_slice_id === S0, 'Vertical Matrix CAP-04 next S0 exact');
check(cap04?.next_delivery_slice_authorized === false, 'Vertical Matrix CAP-04 S0 not authorized');
exactSet(cap04P0?.exact_changed_file_boundary, FILES, 'Vertical Matrix P0 changed-file boundary');
check(matrix.latest_governance_update === P0, 'Vertical Matrix latest governance update is P0');

for (const marker of [
  'MCFT-CAP-03 canonical completion after R4',
  'implementation_status: COMPLETE',
  'next tick: 2026-06-03T02:00:00.000Z',
  'MCFT-CAP-04 provisional state after P0',
  'status: NOT_AUTHORIZED',
  'active_delivery_slice_id: null',
  'runtime_source_authorized: false',
  S0,
  TASK_PATH,
]) check(implementationMap.includes(marker), `Implementation Map marker: ${marker}`);

check(Buffer.byteLength(task, 'utf8') === 77603, 'complete v0.5 task byte length exact');
check(task.split(/\r?\n/).length === 3724, 'complete v0.5 task line count exact');
check(crypto.createHash('sha256').update(task).digest('hex') === TASK_SHA256, 'complete v0.5 task SHA-256 exact');
for (const marker of [
  '完整任务线 v0.5 最终冻结候选',
  'FINAL_FROZEN_CANDIDATE_V0_5',
  P0,
  S0,
  'Replay Runtime Config authority is not an active-config pointer.',
  'latest_successful_forecast_ref',
  'weather_snapshot.source_record_id',
  'et0_snapshot.source_record_id',
  'envelope evidence_refs contains both selected source_record_id values',
  'S10C — Finalization Effectiveness Reconciliation',
  'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1',
  'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1',
  'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1',
]) check(task.includes(marker), `complete CAP-04 task marker: ${marker}`);

check(status.status === 'P0_RECONCILIATION_CANDIDATE', 'P0 status candidate exact');
check(status.delivery_slice_id === P0, 'P0 status slice exact');
check(status.task_ref === TASK_PATH, 'P0 status task ref exact');
check(status.task_sha256 === TASK_SHA256, 'P0 status task SHA exact');
check(status.runtime_source_authorized === false, 'P0 status Runtime source unauthorized');
check(status.cap_04_authorized === false, 'P0 status CAP-04 unauthorized');
check(status.cap_04_active_delivery_slice_id === null, 'P0 status CAP-04 active slice null');
check(status.predecessor_authority.capability_status === 'COMPLETE', 'P0 predecessor capability COMPLETE');
check(status.predecessor_authority.r4_verification_status === 'VERIFIED_ON_MAIN', 'P0 predecessor R4 verified');
check(status.persisted_runtime_handoff_expectation.checkpoint_sequence === 48, 'P0 checkpoint sequence exact');
check(status.persisted_runtime_handoff_expectation.next_tick_logical_time === '2026-06-03T02:00:00.000Z', 'P0 next tick exact');
check(status.persisted_runtime_handoff_expectation.latest_successful_forecast_ref === null, 'P0 successful Forecast pointer null');
check(status.next_delivery_slice_id === S0, 'P0 next S0 exact');
check(status.next_delivery_slice_authorized === false, 'P0 does not authorize S0');
check(status.effectiveness_condition_satisfied === false, 'P0 remains ineffective before merged-main Gate');
exactSet(status.exact_changed_file_boundary, FILES, 'P0 frozen changed-file boundary');

const changed = changedFiles();
exactSet(changed, FILES, `${MODE} changed-file boundary`);
check(changed.every((file) => !file.startsWith('apps/server/src/')), 'no Runtime source changed');
check(changed.every((file) => !file.startsWith('apps/server/db/migrations/')), 'no migration changed');
check(changed.every((file) => !file.startsWith('.github/workflows/')), 'no workflow changed');
check(changed.every((file) => !file.startsWith('.cap04-p0-materialize/')), 'no materializer residue changed');

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on P0 branch`);
}

try {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  git(['diff', '--check', range]);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(`MCFT-CAP-04 P0 predecessor SSOT ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
