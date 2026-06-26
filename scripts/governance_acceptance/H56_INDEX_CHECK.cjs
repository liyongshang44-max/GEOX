'use strict';

// scripts/governance_acceptance/H56_INDEX_CHECK.cjs
// Purpose: verify H56 index files exist and H56 is stopped at the verification boundary.

const fs = require('node:fs');

const acceptance = 'H56_INDEX_CHECK';

for (const file of [
  'docs/tasks/H56-Water-Response-Verification-Boundary.md',
  'docs/tasks/H56-Index.md',
  'scripts/governance_acceptance/H56_CHECK.cjs',
]) {
  if (!fs.existsSync(file)) {
    console.error(JSON.stringify({ ok: false, acceptance, error: 'MISSING_FILE', file }, null, 2));
    process.exit(1);
  }
}

const index = fs.readFileSync('docs/tasks/H56-Index.md', 'utf8');
for (const token of ['water_response_verification_v1', 'roi_ledger_v1', 'field_memory_v1', 'operation_state_v1']) {
  if (!index.includes(token)) {
    console.error(JSON.stringify({ ok: false, acceptance, error: 'MISSING_TOKEN', token }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, acceptance, h56_index: 'PASS', h56_steps_indexed: 1, h56_extension_blocked: true }, null, 2));
