// scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_02.cjs
// Purpose: close DT02-AMENDMENT-02 through the amended DT-02 semantic Gate, predecessor regressions, and an exact governance-only changed-file boundary.
// Boundary: this Gate performs no Runtime, migration, canonical persistence, State, Forecast, checkpoint, or database write.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '09f03488713cde4dbd8c48914fdcb30637d19a3d';
const F = Object.freeze({
  amendment: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md',
  boundaryAddendum: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CHANGED-FILE-BOUNDARY-ADDENDUM.md',
  bootstrap: 'docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json',
  objectSet: 'docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json',
  transactionMatrix: 'docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json',
  adrRegister: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json',
  freeze: 'docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md',
  implementationMap: 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  capabilityMatrix: 'docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json',
  closure: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CLOSURE-RECORD.md',
  dt02Gate: 'scripts/governance_acceptance/ACCEPTANCE_DT_02_RUNTIME_ARCHITECTURE_FREEZE.cjs',
  self: 'scripts/governance_acceptance/ACCEPTANCE_DT_02_ARCHITECTURE_AMENDMENT_02.cjs',
  verticalGate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs',
  dt01Audit: 'scripts/governance_acceptance/AUDIT_DT_01_REPOSITORY_CAPABILITIES.cjs',
  dt01Acceptance: 'scripts/governance_acceptance/ACCEPTANCE_DT_01_EXISTING_CAPABILITY_RECONCILIATION.cjs',
  dt00Regression: 'scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs',
});

const passes = [];
const failures = [];
function pass(message) { passes.push(message); console.log(`PASS: ${message}`); }
function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function abs(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return fs.readFileSync(abs(relativePath), 'utf8'); }
function parse(relativePath) { return JSON.parse(read(relativePath)); }
function field(text, key) { return (text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim(); }
function runNode(relativePath, args = [], env = {}) {
  cp.execFileSync(process.execPath, [relativePath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {...process.env, ...env},
  });
}

for (const relativePath of Object.values(F)) {
  if (!fs.existsSync(abs(relativePath))) fail(`required file missing ${relativePath}`);
  else pass(`file exists ${relativePath}`);
}
if (failures.length) finish();

let bootstrap;
let objects;
let transactions;
let adrs;
try {
  bootstrap = parse(F.bootstrap);
  objects = parse(F.objectSet);
  transactions = parse(F.transactionMatrix);
  adrs = parse(F.adrRegister);
  pass('all Amendment 02 machine-readable contracts parse');
} catch (error) {
  fail(`machine-readable contract parse failed: ${error.message}`);
  finish();
}

const amendment = read(F.amendment);
const boundaryAddendum = read(F.boundaryAddendum);
const closure = read(F.closure);
const closureStatus = field(closure, 'status');
if (!['PENDING_ACCEPTANCE', 'COMPLETE'].includes(closureStatus)) fail(`invalid closure status ${closureStatus}`);
else pass(`closure status ${closureStatus}`);
if (!amendment.includes(`status: ${closureStatus}`)) fail('amendment and closure status mismatch');
else pass('amendment and closure status aligned');
if (!boundaryAddendum.includes(`status: ${closureStatus}`)) fail('boundary addendum status mismatch');
else pass('boundary addendum status aligned');
if (!boundaryAddendum.includes(F.dt01Acceptance) || !boundaryAddendum.includes(F.verticalGate)) fail('boundary addendum lacks exact predecessor Gate paths');
else pass('boundary addendum freezes exact predecessor Gate compatibility paths');
if (bootstrap.status !== closureStatus) fail('bootstrap machine status mismatch');
else pass('bootstrap machine status aligned');
const a02 = (adrs.amendments || []).find((row) => row.id === 'DT02-AMENDMENT-02');
if (a02?.status !== closureStatus) fail('ADR amendment status mismatch');
else pass('ADR amendment status aligned');

if (objects.objects?.length !== 21) fail('canonical object count changed');
else pass('canonical object count remains 21');
if (transactions.transaction_count !== 8) fail('transaction family count changed');
else pass('transaction family count remains 8');
if ((bootstrap.canonical_appends || []).length !== 9) fail('A0 canonical append count must be 9');
else pass('A0 canonical append count 9');
if (bootstrap.transition_contract?.BOOTSTRAP?.bootstrap_prior_ref_forbidden !== true) fail('bootstrap_prior_ref must be forbidden');
else pass('bootstrap_prior_ref forbidden');
if (bootstrap.initial_identity?.revision_run_object_created !== false) fail('INITIAL must not create revision-run object');
else pass('INITIAL creates no revision-run object');
if (bootstrap.aggregate_idempotency?.same_input_after_success_requires_null_CAS !== false) fail('idempotent replay must precede null-CAS');
else pass('idempotent replay precedes null-CAS');
if (bootstrap.canonical_initial_uniqueness?.different_existing_result !== 'INITIAL_LINEAGE_CONFLICT') fail('INITIAL conflict code missing');
else pass('INITIAL lineage conflict code');
if (bootstrap.failure_semantics?.separate_F_OPERATIONAL_ATTEMPT_HEALTH_audit_permitted !== true) fail('separate F audit permission missing');
else pass('separate F audit permitted without A0 partial success');

try {
  runNode(F.dt02Gate);
  pass('amended DT-02 semantic Gate PASS');
} catch (error) {
  fail(`amended DT-02 semantic Gate failed: ${error.message}`);
}

try {
  runNode(F.verticalGate, [], {MCFT_VERTICAL_ACCEPTANCE_SKIP_GIT_SCOPE: '1'});
  pass('MCFT vertical capability-line semantic regression PASS');
} catch (error) {
  fail(`MCFT vertical capability-line regression failed: ${error.message}`);
}

try {
  runNode(F.dt01Audit, ['--check']);
  pass('DT-01 repository audit PASS');
} catch (error) {
  fail(`DT-01 repository audit failed: ${error.message}`);
}

try {
  runNode(F.dt01Acceptance);
  pass('DT-01 acceptance PASS');
} catch (error) {
  fail(`DT-01 acceptance failed: ${error.message}`);
}

try {
  runNode(F.dt00Regression, [], {DT00_ACCEPTANCE_SKIP_GIT_SCOPE: '1'});
  pass('DT-00 semantic regression PASS');
} catch (error) {
  fail(`DT-00 semantic regression failed: ${error.message}`);
}

try {
  cp.execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], {cwd: ROOT, stdio: 'ignore'});
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], {cwd: ROOT, encoding: 'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  const allowed = new Set([
    F.amendment,
    F.boundaryAddendum,
    F.bootstrap,
    F.objectSet,
    F.transactionMatrix,
    F.adrRegister,
    F.freeze,
    F.implementationMap,
    F.capabilityMatrix,
    F.closure,
    F.dt02Gate,
    F.self,
    F.verticalGate,
    F.dt01Acceptance,
  ]);
  const forbidden = changed.filter((relativePath) => !allowed.has(relativePath));
  if (!changed.length) fail('no Amendment 02 changes found');
  else if (forbidden.length) fail(`forbidden changed files: ${forbidden.join(', ')}`);
  else pass(`Amendment 02 exact changed-file boundary: ${changed.length} files`);
} catch (error) {
  fail(`changed-file boundary failed: ${error.message}`);
}

for (const forbiddenPrefix of ['apps/server/', 'apps/web/', 'fixtures/', '.github/workflows/']) {
  const all = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], {cwd: ROOT, encoding: 'utf8'});
  all.split(/\r?\n/).some((relativePath) => relativePath.startsWith(forbiddenPrefix))
    ? fail(`forbidden scope present ${forbiddenPrefix}`)
    : pass(`forbidden scope absent ${forbiddenPrefix}`);
}

finish();

function finish() {
  console.log(`\nDT02-AMENDMENT-02 acceptance summary: ${passes.length} PASS, ${failures.length} FAIL`);
  if (failures.length) process.exit(1);
  if (closureStatus === 'COMPLETE') console.log('DT02-AMENDMENT-02: COMPLETE PASS');
  else console.log('DT02-AMENDMENT-02: PENDING-ACCEPTANCE PASS');
}
