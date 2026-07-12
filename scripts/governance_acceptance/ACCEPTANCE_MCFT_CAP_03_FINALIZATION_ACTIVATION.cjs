// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION_ACTIVATION.cjs
// Purpose: validate S8 Finalization activation after S7 Closure merged-main verification.
// Boundary: governance only; no Runtime, persistence, migration, route, scheduler, web, workflow, completion-claim activation, or CAP-04 authorization.

'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '67def7620015788fde8a126f9ac28c648b860634';
const BRANCH = 'mcft-cap-03-s8-finalization-activation-v1';
const IMPLEMENTATION_BRANCH = 'mcft-cap-03-s8-finalization-v1';
const S7 = 'MCFT-CAP-03.CLOSURE-V1';
const S8 = 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';
const MODE = process.argv.includes('--postmerge') ? 'postmerge' : process.argv.includes('--draft') ? 'draft' : 'final';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const CLOSURE_STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-CLOSURE-STATUS.json';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION-STATUS.json';
const DOC_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-FINALIZATION.md';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_FINALIZATION_ACTIVATION.cjs';
const FILES = [DELIVERY_PATH, CLOSURE_STATUS_PATH, STATUS_PATH, DOC_PATH, GATE_PATH].sort();
const EFFECTIVENESS_FILES = [DELIVERY_PATH, CLOSURE_STATUS_PATH, STATUS_PATH].sort();
let pass = 0;
let fail = 0;
function check(value, message) { if (value) { pass += 1; console.log(`PASS ${message}`); } else { fail += 1; console.error(`FAIL ${message}`); } }
function git(args) { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
function exactArray(actual, expected, label) { check(Array.isArray(actual), `${label} is array`); if (!Array.isArray(actual)) return; check(JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()), `${label} exact`); }
function changedFiles() { const tracked = git(['diff', '--name-only', BASELINE]).split(/\r?\n/).filter(Boolean); const untracked = MODE === 'postmerge' ? [] : git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean); return [...new Set([...tracked, ...untracked])].sort(); }

for (const file of FILES) check(fs.existsSync(path.join(ROOT, file)), `${MODE} file exists: ${file}`);
const delivery = readJson(DELIVERY_PATH);
const closureStatus = readJson(CLOSURE_STATUS_PATH);
const status = readJson(STATUS_PATH);
const doc = fs.readFileSync(path.join(ROOT, DOC_PATH), 'utf8');
const s7 = delivery.slices.find((slice) => slice.delivery_slice_id === S7);
const s8 = delivery.slices.find((slice) => slice.delivery_slice_id === S8);

check(status.schema_version === 'geox_mcft_cap_03_finalization_status_v1', 'finalization status schema exact');
check(status.baseline_main_commit === BASELINE, 'S8 baseline exact');
check(status.activation_branch === BRANCH, 'S8 activation branch exact');
check(status.implementation_branch === IMPLEMENTATION_BRANCH, 'S8 implementation branch exact');
check(status.predecessor_closure_evidence?.closure_pr_number === 2361, 'S7 Closure PR exact');
check(status.predecessor_closure_evidence?.closure_head_commit === '8ebe6c5ca156fd2c285e2ff1ef80c1073ff4c7d2', 'S7 Closure head exact');
check(status.predecessor_closure_evidence?.closure_ci_run === 'CI_4753', 'S7 Closure CI exact');
check(status.predecessor_closure_evidence?.closure_merge_commit === BASELINE, 'S7 Closure merge exact');
check(status.predecessor_closure_evidence?.closure_postmerge_gate === 'PASS', 'S7 Closure postmerge Gate PASS');
check(/postmerge: [0-9]+ PASS, 0 FAIL/.test(status.predecessor_closure_evidence?.closure_postmerge_gate_summary || ''), 'S7 Closure Gate summary exact');
exactArray(status.exact_activation_changed_file_boundary, FILES, 'activation boundary');
exactArray(status.activation_effectiveness_changed_file_boundary, EFFECTIVENESS_FILES, 'activation effectiveness boundary');
check(status.pending_completion_claims.length === 15, 'fifteen completion claims remain pending');
check(status.preserved_nonclaims_before_effectiveness.includes('NO_MCFT_CAP_03_COMPLETE_CLAIM'), 'temporary complete nonclaim preserved');
check(status.closure_effective === false, 'closure remains ineffective');
check(status.capability_status === 'NOT_COMPLETE', 'capability remains not complete');
check(s7?.status === 'MERGED_POSTMERGE_GATE_PASS', 'S7 merged-main Gate recorded');
check(s7?.closure_candidate?.postmerge_gate === 'PASS', 'S7 closure candidate Gate PASS recorded');
check(s8?.baseline_main_commit === BASELINE, 'delivery S8 baseline exact');
check(s8?.branch === IMPLEMENTATION_BRANCH, 'delivery S8 branch exact');
exactArray(s8?.exact_activation_changed_file_boundary, FILES, 'delivery S8 activation boundary');
exactArray(s8?.postmerge_activation_effectiveness_changed_file_boundary, EFFECTIVENESS_FILES, 'delivery S8 effectiveness boundary');
check(s8?.closure_effective === false, 'delivery S8 closure ineffective');
check(s8?.completion_claims_status === 'PENDING_FINALIZATION_EFFECTIVENESS', 'claims pending finalization effectiveness');
check(s8?.successor_authorized === false, 'delivery S8 successor unauthorized');
check(delivery.successor_authorized === false, 'delivery CAP-04 unauthorized');
check(closureStatus.successor_authorized === false, 'closure status CAP-04 unauthorized');
check(status.successor_authorized === false, 'finalization status CAP-04 unauthorized');
check(Array.isArray(delivery.next_authorized_slice_ids) && delivery.next_authorized_slice_ids.length === 0, 'no downstream slice authorized');
for (const marker of ['Postmerge Finalization', 'Closure postmerge Gate:', 'PENDING_FINALIZATION_EFFECTIVENESS', 'MCFT-CAP-04: UNAUTHORIZED']) check(doc.includes(marker), `finalization document marker: ${marker}`);

if (MODE === 'postmerge') {
  check(status.status === 'ACTIVATED', 'postmerge finalization activation status ACTIVATED');
  check(status.activation_effective === true, 'postmerge finalization activation effective');
  check(status.implementation_status === 'AUTHORIZED', 'postmerge finalization implementation authorized');
  check(status.implementation_authorized === true, 'postmerge finalization authorization true');
  check(delivery.status === 'FINALIZATION_ACTIVATED', 'postmerge delivery finalization activated');
  check(s8?.status === 'ACTIVATED', 'postmerge delivery S8 activated');
  check(s8?.activation?.effective === true, 'postmerge S8 activation effective');
  check(git(['branch', '--show-current']) === 'main', 'postmerge Gate runs on main');
  check(git(['rev-parse', 'HEAD']) === git(['rev-parse', 'origin/main']), 'postmerge main equals origin/main');
} else {
  check(status.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} finalization activation ready`);
  check(status.activation_effective === false, `${MODE} activation ineffective`);
  check(status.implementation_status === 'NOT_AUTHORIZED', `${MODE} implementation unauthorized`);
  check(status.implementation_authorized === false, `${MODE} implementation authorization false`);
  check(delivery.status === 'FINALIZATION_ACTIVATION_READY_FOR_MERGE', `${MODE} delivery state exact`);
  check(s8?.status === 'ACTIVATION_READY_FOR_MERGE', `${MODE} delivery S8 activation ready`);
  check(s8?.activation?.effective === false, `${MODE} delivery S8 activation ineffective`);
  check(git(['branch', '--show-current']) === BRANCH, `${MODE} Gate runs on activation branch`);
  exactArray(changedFiles(), FILES, `${MODE} actual changed-file boundary`);
}
try { git(['diff', '--check', BASELINE]); check(true, 'git diff --check PASS'); } catch { check(false, 'git diff --check PASS'); }
console.log(`MCFT-CAP-03 S8 Finalization activation ${MODE}: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
