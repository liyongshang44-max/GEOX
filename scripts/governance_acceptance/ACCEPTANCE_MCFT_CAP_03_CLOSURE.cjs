// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE.cjs
// Purpose: validate the governance-only MCFT-CAP-03 S7 Closure candidate and its accumulated merged-main evidence.
// Boundary: no Runtime, persistence, migration, route, scheduler, web, workflow, canonical fact, S8 activation, completion-claim activation, or MCFT-CAP-04 authorization.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'cc719e5f2c4de4a284d3d350f5fdf73e6e0a2b82';
const BRANCH = 'mcft-cap-03-s7-closure-v1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';

const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json';
const CLOSURE_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md';
const RECORD_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-RECORD.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_CLOSURE.cjs';
const FILES = [DELIVERY_PATH, STATUS_PATH, CLOSURE_PATH, RECORD_PATH, GATE_PATH].sort();

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
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function exactArray(actual, expected, label) {
  check(Array.isArray(actual), `${label} is array`);
  if (!Array.isArray(actual)) return;
  check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} exact`);
}

function changedFiles() {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  return git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean).sort();
}

for (const file of FILES) {
  check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
}

const delivery = readJson(DELIVERY_PATH);
const status = readJson(STATUS_PATH);
const record = readJson(RECORD_PATH);
const closure = fs.readFileSync(path.join(ROOT, CLOSURE_PATH), 'utf8');
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);

check(delivery.status === 'CLOSURE_READY_FOR_MERGE', 'delivery Closure state ready');
check(delivery.implementation_status === 'S7_CLOSURE_READY_FOR_MERGE', 'delivery implementation state ready');
check(delivery.active_delivery_slice_id === S7, 'S7 remains active');
check(status.status === 'CLOSURE_READY_FOR_MERGE', 'closure status ready');
check(status.activation_effective === true, 'S7 activation effective');
check(status.implementation_authorized === true, 'S7 implementation authorized');
check(status.closure_effective === false, 'Closure remains ineffective before S8');
check(status.capability_status === 'NOT_COMPLETE', 'capability remains not complete');
check(record.schema_version === 'geox_mcft_cap_03_closure_record_v1', 'closure record schema exact');
check(record.closure_identity === 'GEOX-MCFT-CAP-03-CLOSURE-V1', 'closure record identity exact');
check(record.status === 'CLOSURE_READY_FOR_MERGE', 'closure record status ready');
check(record.closure_effective === false, 'closure record ineffective');
check(record.capability_complete === false, 'closure record capability incomplete');
check(record.baseline_main_commit === BASELINE, 'closure baseline exact');
check(record.branch === BRANCH, 'closure branch exact');

check(status.activation_pr_number === 2359, 'activation PR exact');
check(status.activation_head_commit === '93d50d28014bb4bb8f3b711c84aea2f6c2f8f17c', 'activation head exact');
check(status.activation_ci_run === 'CI_4749', 'activation CI exact');
check(status.activation_merge_commit === 'a16f635363ef8b492c600e7e2bc55c0dc5821217', 'activation merge exact');
check(status.closure_candidate?.activation_evidence?.activation_effectiveness_pr_number === 2360, 'activation effectiveness PR exact');
check(status.closure_candidate?.activation_evidence?.activation_effectiveness_head_commit === 'b9c00a52894bfde93c235fbd253d5a739eaa5093', 'activation effectiveness head exact');
check(status.closure_candidate?.activation_evidence?.activation_effectiveness_ci_run === 'CI_4751', 'activation effectiveness CI exact');
check(status.closure_candidate?.activation_evidence?.activation_effectiveness_merge_commit === BASELINE, 'activation effectiveness merge exact');
check(status.closure_candidate?.activation_evidence?.activation_postmerge_gate === 'PASS', 'activation postmerge Gate PASS');
check(/postmerge: [0-9]+ PASS, 0 FAIL/.test(status.closure_candidate?.activation_evidence?.activation_postmerge_gate_summary || ''), 'activation postmerge Gate summary exact');

exactArray(status.pending_completion_claims, record.pending_completion_claims, 'completion claims status/record');
check(status.pending_completion_claims.length === 15, 'exact fifteen pending completion claims');
exactArray(status.preserved_nonclaims, record.preserved_nonclaims, 'preserved nonclaims status/record');
check(status.preserved_nonclaims.includes('NO_MCFT_CAP_03_COMPLETE_CLAIM'), 'temporary complete nonclaim preserved');
check(status.preserved_nonclaims.includes('NO_SUCCESSFUL_FORECAST'), 'successful Forecast nonclaim preserved');
check(status.preserved_nonclaims.includes('NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'), 'Minimum Complete Field Twin nonclaim preserved');
exactArray(record.exact_changed_file_boundary, FILES, 'closure record file boundary');
exactArray(status.frozen_implementation_changed_file_boundary, FILES, 'closure status file boundary');
exactArray(s7?.exact_changed_file_boundary, FILES, 'delivery S7 file boundary');

for (const [key, value] of Object.entries(record.closure_proof || {})) {
  check(value === true, `closure proof true: ${key}`);
}
for (const [key, value] of Object.entries(record.closure_does_not_change || {})) {
  check(value === true, `closure does-not-change true: ${key}`);
}

check(s7?.status === 'CLOSURE_READY_FOR_MERGE', 'delivery S7 Closure ready');
check(s7?.closure_effective === false, 'delivery S7 Closure ineffective');
check(s7?.completion_claims_status === 'PENDING_S8_FINALIZATION', 'completion claims pending S8');
check(s7?.s8_authorized === false, 'S8 unauthorized from S7');
check(s8?.status === 'BLOCKED', 'S8 remains blocked');
check(s8?.baseline_main_commit === null, 'S8 baseline remains unset');
check(s8?.branch === null, 'S8 branch remains unset');
check(status.finalization_authorized === false, 'finalization remains unauthorized');
check(status.successor_authorized === false, 'status CAP-04 unauthorized');
check(delivery.successor_authorized === false, 'delivery CAP-04 unauthorized');
check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice implicitly authorized');

for (const marker of [
  'S7 Closure implementation candidate',
  'CLOSURE_READY_FOR_MERGE',
  'PENDING_S8_FINALIZATION',
  'MCFT-CAP-04:',
  'UNAUTHORIZED',
]) {
  check(closure.includes(marker), `closure document marker: ${marker}`);
}

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge local main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on Closure branch`);
}

exactArray(changedFiles(), FILES, `${MODE} changed-file boundary`);

try {
  const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE;
  git(['diff', '--check', range]);
  check(true, 'git diff --check PASS');
} catch {
  check(false, 'git diff --check PASS');
}

console.log(`MCFT-CAP-03 S7 Closure ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
