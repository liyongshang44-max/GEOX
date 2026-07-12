// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION.cjs
// Purpose: validate the governance-only MCFT-CAP-03 S8 Finalization candidate and merged-main effectiveness prerequisite.
// Boundary: no Runtime, persistence, migration, route, scheduler, web, workflow, canonical fact, model parameter, or CAP-04 authorization.

'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '68f0bc2198c0fd09bb4dcedf5b13d8507fb35902';
const BRANCH = 'mcft-cap-03-s8-finalization-v1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const RECORD_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-RECORD.json';
const CLOSURE_STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json';
const CLOSURE_DOC_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const FINAL_STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION-STATUS.json';
const FINAL_DOC_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION.md';
const VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION.cjs';
const FILES = [MAP_PATH, MATRIX_PATH, RECORD_PATH, CLOSURE_STATUS_PATH, CLOSURE_DOC_PATH, DELIVERY_PATH, FINAL_STATUS_PATH, FINAL_DOC_PATH, VERIFICATION_PATH, GATE_PATH].sort();
let pass = 0;
let fail = 0;
function check(value, message) { if (value) { pass += 1; console.log(`PASS ${message}`); } else { fail += 1; console.error(`FAIL ${message}`); } }
function git(args) { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function read(file) { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
function exact(actual, expected, label) { check(Array.isArray(actual), `${label} is array`); if (!Array.isArray(actual)) return; check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} exact`); }
function changedFiles() { const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE; const tracked = git(['diff', '--name-only', range]).split(/\r?\n/).filter(Boolean); if (MODE === 'postmerge') return tracked.sort(); const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean); return [...new Set([...tracked, ...untracked])].sort(); }

for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
const delivery = read(DELIVERY_PATH);
const closureStatus = read(CLOSURE_STATUS_PATH);
const finalStatus = read(FINAL_STATUS_PATH);
const record = read(RECORD_PATH);
const verification = read(VERIFICATION_PATH);
const matrix = read(MATRIX_PATH);
const line = matrix.capability_lines.find((item) => item.capability_line_id === 'MCFT-CAP-03');
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);
const map = fs.readFileSync(path.join(ROOT, MAP_PATH), 'utf8');
const closureDoc = fs.readFileSync(path.join(ROOT, CLOSURE_DOC_PATH), 'utf8');
const finalDoc = fs.readFileSync(path.join(ROOT, FINAL_DOC_PATH), 'utf8');

check(delivery.status === 'FINALIZATION_READY_FOR_MERGE', 'delivery Finalization ready');
check(delivery.implementation_status === 'S8_FINALIZATION_READY_FOR_MERGE', 'delivery implementation ready');
check(delivery.active_delivery_slice_id === S8, 'S8 remains active');
check(closureStatus.status === 'FINALIZATION_READY_FOR_MERGE', 'closure status Finalization ready');
check(finalStatus.status === 'FINALIZATION_READY_FOR_MERGE', 'finalization status ready');
check(finalStatus.activation_effective === true, 'S8 activation remains effective');
check(finalStatus.implementation_authorized === true, 'S8 implementation remains authorized');
check(finalStatus.closure_effective === false && closureStatus.closure_effective === false, 'Closure remains ineffective pre-effectiveness');
check(finalStatus.capability_status === 'NOT_COMPLETE' && closureStatus.capability_status === 'NOT_COMPLETE', 'capability remains incomplete');
check(s8?.status === 'FINALIZATION_READY_FOR_MERGE', 'delivery S8 Finalization ready');
check(s8?.finalization_candidate?.baseline_main_commit === BASELINE, 'S8 candidate baseline exact');
check(s8?.finalization_candidate?.branch === BRANCH, 'S8 candidate branch exact');
check(s8?.finalization_candidate?.activation_evidence?.activation_effectiveness_pr_number === 2363, 'S8 activation effectiveness PR exact');
check(s8?.finalization_candidate?.activation_evidence?.activation_effectiveness_ci_run === 'CI_4757', 'S8 activation effectiveness CI exact');
check(s8?.finalization_candidate?.activation_evidence?.activation_effectiveness_merge_commit === BASELINE, 'S8 activation effectiveness merge exact');
check(s8?.finalization_candidate?.activation_evidence?.activation_postmerge_gate === 'PASS', 'S8 activation postmerge Gate PASS');
check(/postmerge: [0-9]+ PASS, 0 FAIL/.test(s8?.finalization_candidate?.activation_evidence?.activation_postmerge_gate_summary || ''), 'S8 activation Gate summary exact');
check(Array.isArray(finalStatus.pending_completion_claims) && finalStatus.pending_completion_claims.length === 15, 'fifteen completion claims pending');
check(finalStatus.preserved_nonclaims_before_effectiveness.includes('NO_MCFT_CAP_03_COMPLETE_CLAIM'), 'temporary complete nonclaim preserved');
check(verification.status === 'PENDING_FINALIZATION_EFFECTIVENESS', 'Main Verification pending effectiveness');
check(verification.verified_on_main === false, 'Main Verification not yet effective');
check(verification.closure_effective === false && verification.capability_complete === false, 'Main Verification no premature completion');
check(verification.pending_completion_claims.length === 15 && verification.effective_completion_claims.length === 0, 'Main Verification claims pending');
check(record.status === 'FINALIZATION_READY_FOR_MERGE', 'Closure Record Finalization ready');
check(record.closure_effective === false && record.capability_complete === false, 'Closure Record no premature completion');
check(line?.status === 'FINALIZATION_READY_FOR_MERGE', 'matrix CAP-03 Finalization ready');
check(line?.active_delivery_slice_id === S8, 'matrix active S8 exact');
check(Array.isArray(line?.pending_completion_claims) && line.pending_completion_claims.length === 15, 'matrix claims pending');
check(Array.isArray(line?.completion_claims) && line.completion_claims.length === 0, 'matrix no effective claims');
check(line?.successor_authorized === false, 'matrix CAP-04 unauthorized');
check(delivery.successor_authorized === false && closureStatus.successor_authorized === false && finalStatus.successor_authorized === false && verification.successor_authorized === false, 'all CAP-04 boundaries unauthorized');
check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice authorized');
exact(s8?.exact_changed_file_boundary, FILES, 'delivery S8 implementation boundary');
exact(finalStatus.frozen_implementation_changed_file_boundary, FILES, 'finalization status implementation boundary');
exact(verification.exact_changed_file_boundary, FILES, 'Main Verification boundary');
exact(record.exact_changed_file_boundary, FILES, 'Closure Record boundary');
for (const [text, marker] of [[map, 'MCFT-CAP-03 Finalization candidate'], [closureDoc, 'S8 Finalization candidate'], [finalDoc, 'Finalization implementation candidate']]) check(text.includes(marker), `document marker: ${marker}`);

if (MODE === 'postmerge') {
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on Finalization branch`);
}
exact(changedFiles(), FILES, `${MODE} changed-file boundary`);
try { const range = MODE === 'postmerge' ? `${BASELINE}...HEAD` : BASELINE; git(['diff', '--check', range]); check(true, 'git diff --check PASS'); } catch { check(false, 'git diff --check PASS'); }
console.log(`MCFT-CAP-03 S8 Finalization ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
