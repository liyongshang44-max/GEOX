// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_FOUNDATION.cjs
// Purpose: validate S1/S2/S3A closure identity, dependencies, next authorization, file boundary, domain purity, evidence, and explicit nonclaims.
// Boundary: governance/static acceptance only; no Runtime execution or database write.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '94fe516ccbf8831be05c36ede5e2732bf7e19d55';
const NEXT = 'MCFT-CAP-01.MCFT-07-08.BOOTSTRAP-STATE-MATH-V1';

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

const statusPath = path.join(ROOT, 'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json');
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

check(status.capability_line_id === 'MCFT-CAP-01', 'capability line identity');
check(status.baseline_main_commit === BASE, 'baseline identity');
check(status.status === 'IN_IMPLEMENTATION', 'capability line remains IN_IMPLEMENTATION');
check(status.slices.length === 3, 'exact foundation slice count');
check(status.slices.every((slice) => slice.status === 'COMPLETE'), 'S1 S2 S3A are COMPLETE');
check(status.slices[1].depends_on_delivery_slice_ids.includes(status.slices[0].delivery_slice_id), 'S2 depends on S1');
check(status.slices[2].depends_on_delivery_slice_ids.includes(status.slices[1].delivery_slice_id), 'S3A depends on S2');
check(JSON.stringify(status.next_authorized_slice_ids) === JSON.stringify([NEXT]), 'next authorized slice is bootstrap State math');
check(status.foundation_closure?.implementation_candidate_head === '5975f8e1f1dfa6fc4a79b26c8a300ed6bdd869d3', 'implementation candidate head recorded');
check(status.foundation_closure?.implementation_candidate_ci?.run_number === 4425, 'implementation candidate CI run recorded');
check(status.foundation_closure?.implementation_candidate_ci?.conclusion === 'success', 'implementation candidate CI success recorded');
check(status.foundation_closure?.transition_effective_condition === 'PR_2310_MERGED_AND_VERIFIED_ON_MAIN', 'completion effectiveness condition recorded');

const expectedDocStatuses = [
  'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-REPLAY-DATASET-CONTRACT.md',
  'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-CONTRACTS-CONFIG.md',
  'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-PERSISTENCE.md',
];

for (const file of expectedDocStatuses) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(text.includes('status: COMPLETE'), `${file} records COMPLETE`);
}

const domainFiles = [
  'apps/server/src/domain/twin_runtime/canonical_json_v1.ts',
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/runtime_config_v1.ts',
];

for (const file of domainFiles) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(!/Date\.now|new Date|process\.env|randomUUID|nanoid|Fastify|from ["']pg["']/.test(text), `${file} domain purity`);
}

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const forbidden = changed.filter((file) => file.startsWith('apps/web/')
    || file.startsWith('apps/server/src/routes/')
    || file.includes('GEOX-DT-02-ARCHITECTURE-AMENDMENT-02'));
  check(forbidden.length === 0, `no forbidden changed files: ${forbidden.join(',')}`);
} catch (error) {
  check(false, `git boundary check: ${error.message}`);
}

for (const nonclaim of [
  'NO_A0_RUNTIME_EXECUTION',
  'NO_BOOTSTRAP_STATE_COMMITTED',
  'NO_ACTIVE_INITIAL_LINEAGE',
  'NO_INITIAL_CHECKPOINT',
  'NO_SUCCESSFUL_FORECAST',
  'NO_PROPAGATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_MCFT_CAP_01_CLOSURE',
]) {
  check(status.nonclaims.includes(nonclaim), `nonclaim preserved: ${nonclaim}`);
}

console.log(`MCFT-CAP-01 foundation closure: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
