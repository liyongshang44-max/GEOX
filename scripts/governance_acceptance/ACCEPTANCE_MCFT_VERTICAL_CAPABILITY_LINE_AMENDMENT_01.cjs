// scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs
// Purpose: validate MCFT vertical capability-line identifiers, bounded delivery slices, work-package partial-establishment semantics, capability nonclaims, and governance-only changed-file scope.
// Boundary: this Gate creates no Runtime source, migration, canonical object, State, Forecast, Scenario, checkpoint, public write route, or database write.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '7dbdce40a55740fbf48dbffe18f8343d17d07953';

const F = Object.freeze({
  amendment: 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-AMENDMENT-01.md',
  verticalMatrix: 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  implementationMap: 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  capabilityMatrix: 'docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json',
  master: 'docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md',
  reality: 'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json',
  self: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_VERTICAL_CAPABILITY_LINE_AMENDMENT_01.cjs',
});

const pass = [];
const fail = [];
function ok(message) { pass.push(message); console.log(`PASS: ${message}`); }
function bad(message) { fail.push(message); console.error(`FAIL: ${message}`); }
function abs(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return fs.readFileSync(abs(relativePath), 'utf8'); }
function parse(relativePath) { return JSON.parse(read(relativePath)); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function seteq(actual, expected, message) {
  const left = JSON.stringify([...(actual || [])].sort());
  const right = JSON.stringify([...expected].sort());
  left === right ? ok(message) : bad(`${message}: expected ${right}, got ${left}`);
}
function includesAll(actual, expected, message) {
  const missing = expected.filter((value) => !(actual || []).includes(value));
  missing.length ? bad(`${message}: missing ${missing.join(', ')}`) : ok(message);
}

for (const relativePath of Object.values(F)) {
  if (!fs.existsSync(abs(relativePath))) bad(`required file missing ${relativePath}`);
  else ok(`file exists ${relativePath}`);
}
if (fail.length) finish();

let vertical;
let capability;
let reality;
try {
  vertical = parse(F.verticalMatrix);
  capability = parse(F.capabilityMatrix);
  reality = parse(F.reality);
  ok('machine-readable JSON parses');
} catch (error) {
  bad(`JSON parse failed: ${error.message}`);
  finish();
}

const amendment = read(F.amendment);
const map = read(F.implementationMap);
const master = read(F.master);

const status = vertical.status;
if (!['PENDING_ACCEPTANCE', 'COMPLETE'].includes(status)) bad(`invalid amendment status ${status}`);
else ok(`amendment status ${status}`);

if (!amendment.includes(`status: ${status}`)) bad('document and matrix amendment status differ');
else ok('document and matrix amendment status aligned');

if (vertical.schema_version !== 'geox_mcft_vertical_capability_line_matrix_v1') bad('vertical matrix schema invalid');
else ok('vertical matrix schema v1');
if (vertical.amendment_id !== 'MCFT-VERTICAL-AMENDMENT-01') bad('amendment identity invalid');
else ok('amendment identity');
if (vertical.baseline?.commit !== BASE) bad('baseline commit mismatch');
else ok('baseline is MCFT-00 merge commit');

const lines = vertical.capability_lines || [];
if (lines.length !== 1) bad(`expected one capability line, got ${lines.length}`);
else ok('one capability line frozen');
const line = lines[0] || {};
if (line.capability_line_id !== 'MCFT-CAP-01' || line.display_alias !== 'MCFT-1') bad('capability-line identity mismatch');
else ok('MCFT-CAP-01 and MCFT-1 alias frozen');
if (line.status !== 'BLOCKED_BY_DT02_AMENDMENT_02') bad('capability line must remain blocked by DT02-AMENDMENT-02');
else ok('capability line blocked by DT02-AMENDMENT-02');
seteq(line.authorized_owner_work_package_ids, ['MCFT-01','MCFT-02','MCFT-03','MCFT-04','MCFT-05','MCFT-07','MCFT-08','MCFT-09'], 'authorized owner work packages');
seteq(line.excluded_owner_work_package_ids, ['MCFT-06'], 'excluded owner work package');
includesAll(line.forbidden_claims, ['hourly dynamics implemented','continuous hourly runtime implemented','successful 72-point Forecast established','Minimum Complete Field Twin complete','live field or production runtime'], 'capability-line nonclaims');

const allowedStatuses = ['NOT_STARTED','SLICE_PLANNED','PARTIALLY_ESTABLISHED','COMPLETE'];
seteq(vertical.work_package_status_catalogue, allowedStatuses, 'work-package status catalogue');
const planned = vertical.planned_status_at_mcft_cap_01_closure || {};
const expectedPlanned = {
  'MCFT-01':'COMPLETE',
  'MCFT-02':'PARTIALLY_ESTABLISHED',
  'MCFT-03':'PARTIALLY_ESTABLISHED',
  'MCFT-04':'PARTIALLY_ESTABLISHED',
  'MCFT-05':'PARTIALLY_ESTABLISHED',
  'MCFT-06':'NOT_STARTED',
  'MCFT-07':'PARTIALLY_ESTABLISHED',
  'MCFT-08':'PARTIALLY_ESTABLISHED',
  'MCFT-09':'PARTIALLY_ESTABLISHED',
};
for (const [owner, expected] of Object.entries(expectedPlanned)) {
  planned[owner] === expected ? ok(`${owner} planned status ${expected}`) : bad(`${owner} planned status expected ${expected}, got ${planned[owner]}`);
}

const slices = line.delivery_slices || [];
if (slices.length !== 6) bad(`expected six delivery slices, got ${slices.length}`);
else ok('six bounded delivery slices');
const sliceIds = slices.map((slice) => slice.delivery_slice_id);
if (new Set(sliceIds).size !== sliceIds.length || sliceIds.some((id) => !nonEmpty(id))) bad('delivery slice IDs invalid');
else ok('delivery slice IDs unique and non-empty');
const ownerIds = new Set(line.authorized_owner_work_package_ids || []);
for (const slice of slices) {
  if (!nonEmpty(slice.primary_owner_work_package_id)) bad(`${slice.delivery_slice_id} primary owner missing`);
  else if (!ownerIds.has(slice.primary_owner_work_package_id)) bad(`${slice.delivery_slice_id} primary owner unauthorized`);
  if (!Array.isArray(slice.contributing_work_package_ids) || !Array.isArray(slice.depends_on_delivery_slice_ids)) bad(`${slice.delivery_slice_id} dependency arrays missing`);
  for (const contributor of slice.contributing_work_package_ids || []) if (!ownerIds.has(contributor)) bad(`${slice.delivery_slice_id} contributor unauthorized ${contributor}`);
  for (const dependency of slice.depends_on_delivery_slice_ids || []) if (!sliceIds.includes(dependency)) bad(`${slice.delivery_slice_id} dependency missing ${dependency}`);
}
if (!fail.some((message) => message.includes('owner') || message.includes('dependency arrays') || message.includes('dependency missing'))) ok('delivery-slice ownership and dependency graph valid');

const idModel = vertical.identifier_model || {};
if (idModel.primary_owner_work_package_id_singular !== true || idModel.contributing_work_package_ids_array !== true || idModel.depends_on_delivery_slice_ids_array !== true) bad('identifier model cardinality invalid');
else ok('identifier model cardinality frozen');

for (const marker of [
  'capability_line_id',
  'owner_work_package_id',
  'delivery_slice_id',
  'primary_owner_work_package_id: MCFT-08',
  'MCFT-06 is not part of MCFT-CAP-01',
  'RUNTIME_IMPLEMENTATION_PROHIBITED',
  'NO_RUNTIME_IMPLEMENTATION',
  'DT02-AMENDMENT-02',
]) amendment.includes(marker) ? ok(`amendment marker ${marker}`) : bad(`amendment marker missing ${marker}`);

for (const marker of [
  'MCFT-VERTICAL-AMENDMENT-01 introduces vertical capability lines',
  'MCFT-CAP-01 (`MCFT-1`)',
  'MCFT-06 remains `NOT_STARTED`',
  'Initial lineage activation is not defined by this map',
  'semantic dependency order',
]) map.includes(marker) ? ok(`implementation-map marker ${marker}`) : bad(`implementation-map marker missing ${marker}`);

if (!master.includes('MCFT-00 through MCFT-18')) bad('master owner work-package catalogue missing');
else ok('master owner work-package catalogue preserved');
if (!master.includes('MCFT-01 — Canonical Replay Dataset')) bad('master MCFT-01 definition missing');
else ok('master MCFT-01 ownership preserved');

if (capability.schema_version !== 'geox_digital_twin_capability_matrix_v3') bad('capability matrix schema changed');
else ok('capability matrix schema v3 preserved');
if (capability.phase !== 'MCFT-00' || capability.current_claim !== 'MCFT_00_REALITY_BINDING_FROZEN') bad('MCFT-00 top-level claim changed');
else ok('MCFT-00 top-level claim preserved');
const amendmentRow = (capability.governance_amendments || []).find((row) => row.amendment_id === 'MCFT-VERTICAL-AMENDMENT-01');
if (!amendmentRow || amendmentRow.status !== status || amendmentRow.claim !== 'NO_RUNTIME_IMPLEMENTATION') bad('capability matrix amendment row invalid');
else ok('capability matrix amendment row');
const capabilityLineRow = (capability.capability_lines || []).find((row) => row.capability_line_id === 'MCFT-CAP-01');
if (!capabilityLineRow || capabilityLineRow.status !== 'BLOCKED_BY_DT02_AMENDMENT_02') bad('capability matrix capability-line row invalid');
else ok('capability matrix capability-line row');

const byCapability = new Map((capability.capabilities || []).map((row) => [row.capability_id, row]));
for (const id of ['DT-MATRIX-HOURLY-TICK','DT-MATRIX-PROPAGATION','DT-MATRIX-ASSIMILATION','DT-MATRIX-POSTERIOR','DT-MATRIX-CHECKPOINT','DT-MATRIX-RESTART','DT-MATRIX-LATE-REVISION','DT-MATRIX-72H-REGEN']) {
  byCapability.get(id)?.current_status === 'MISSING' ? ok(`${id} remains MISSING`) : bad(`${id} capability inflation`);
}
byCapability.get('DT-MATRIX-LIVE-PRODUCTION-FIELD-TWIN')?.current_status === 'NOT_CLAIMED' ? ok('production remains NOT_CLAIMED') : bad('production capability inflation');

if (reality.binding_id !== 'mcft_rb_bf1da664164a4fedda249bcb') bad('Reality binding ID changed');
else ok('Reality binding ID preserved');
if (reality.determinism_hash !== 'sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f') bad('Reality binding hash changed');
else ok('Reality binding hash preserved');
if (reality.semantic_payload?.compile_target?.owner_phase !== 'MCFT-02' || reality.semantic_payload?.persistence_target?.owner_phase !== 'MCFT-03') bad('MCFT-00 owner phases changed');
else ok('MCFT-00 owner phases preserved');

const authoritative = [amendment, map, read(F.verticalMatrix), read(F.capabilityMatrix)].join('\n');
for (const forbidden of [
  'hourly dynamics implemented: true',
  'successful Forecast established: true',
  'Minimum Complete Field Twin complete: true',
  'public State write endpoint',
  'automatic AO-ACT creation',
]) authoritative.includes(forbidden) ? bad(`forbidden positive claim ${forbidden}`) : ok(`forbidden positive claim absent ${forbidden}`);

try {
  cp.execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
  const output = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim();
  const changed = output ? output.split(/\r?\n/).filter(Boolean) : [];
  const allowedExact = new Set([
    F.amendment,
    F.verticalMatrix,
    F.implementationMap,
    F.capabilityMatrix,
    F.self,
  ]);
  const forbidden = changed.filter((file) => !allowedExact.has(file));
  if (!changed.length) bad('no governance changes found');
  else if (forbidden.length) bad(`forbidden changed files ${forbidden.join(', ')}`);
  else ok(`governance-only changed-file boundary ${changed.length} files`);
} catch (error) {
  bad(`changed-file boundary failed: ${error.message}`);
}

finish();

function finish() {
  console.log(`\nMCFT Vertical Capability Line Amendment 01 summary: ${pass.length} PASS, ${fail.length} FAIL`);
  if (fail.length) process.exit(1);
  if (status === 'COMPLETE') console.log('MCFT VERTICAL CAPABILITY LINE AMENDMENT 01: COMPLETE PASS');
  else console.log('MCFT VERTICAL CAPABILITY LINE AMENDMENT 01: PENDING-ACCEPTANCE PASS');
}
