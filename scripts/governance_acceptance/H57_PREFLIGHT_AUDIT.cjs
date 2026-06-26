'use strict';

// scripts/governance_acceptance/H57_PREFLIGHT_AUDIT.cjs
// Purpose: verify repository facts before ROI or Field Memory planning.

const fs = require('node:fs');

const acceptance = 'H57_PREFLIGHT_AUDIT';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance, error, details }, null, 2));
  process.exit(1);
}

const requiredFiles = {
  merged_chain: [
    'docs/tasks/H54-Final-Index.md',
    'docs/tasks/H55-Acceptance-Boundary.md',
    'docs/tasks/H55-Final-Index.md',
    'docs/tasks/H56-Water-Response-Verification-Boundary.md',
    'scripts/governance_acceptance/H56_CHECK.cjs',
  ],
  roi: [
    'apps/server/src/routes/roi_ledger_v1.ts',
    'apps/server/src/domain/roi/roi_ledger_v1.ts',
    'apps/server/db/migrations/2026_04_24_roi_ledger_v1.sql',
    'scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_V1.cjs',
  ],
  field_memory: [
    'apps/server/src/routes/field_memory_v1.ts',
    'apps/server/src/services/field_memory_service.ts',
    'apps/server/db/migrations/2026_04_27_field_memory_v1.sql',
    'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs',
  ],
};

for (const [group, files] of Object.entries(requiredFiles)) {
  for (const file of files) {
    if (!fs.existsSync(file)) fail('REQUIRED_FILE_MISSING', { group, file });
  }
}

const roiRoute = fs.readFileSync('apps/server/src/routes/roi_ledger_v1.ts', 'utf8');
for (const token of [
  '/api/v1/roi-ledger/from-as-executed',
  '/api/v1/roi-ledger/formalize-from-acceptance',
  'customer_visible_value: false',
  'customer_visible_value: true',
]) {
  if (!roiRoute.includes(token)) fail('ROI_ROUTE_FACT_MISSING', { token });
}

const fieldMemoryRoute = fs.readFileSync('apps/server/src/routes/field_memory_v1.ts', 'utf8');
for (const token of ['/api/v1/field-memory']) {
  if (!fieldMemoryRoute.includes(token)) fail('FIELD_MEMORY_ROUTE_FACT_MISSING', { token });
}

console.log(JSON.stringify({
  ok: true,
  acceptance,
  h57_preflight_audit: 'PASS',
  merged_chain_audited: true,
  roi_capability_present: true,
  field_memory_capability_present: true,
  next_step_requires_plan: true,
}, null, 2));
