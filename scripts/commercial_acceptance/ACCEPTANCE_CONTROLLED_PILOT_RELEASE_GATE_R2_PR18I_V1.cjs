#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TENANT = process.env.TENANT_ID || 'tenantA';
const LONG = Number(process.env.CONTROLLED_PILOT_LONG_GATE_TIMEOUT_MS || 24 * 60 * 1000);

const SEED = 'node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';

const ADMIN =
  process.env.ADMIN_TOKEN ||
  process.env.TOKEN_ADMIN ||
  process.env.AO_ACT_TOKEN ||
  process.env.GEOX_AO_ACT_TOKEN ||
  'admin_token';

const APPROVER =
  process.env.TOKEN_APPROVER ||
  process.env.APPROVER_TOKEN ||
  process.env.GEOX_EXECUTOR_TOKEN ||
  'approver_token';

const env = {
  ...process.env,
  BASE_URL: BASE,
  API_BASE_URL: process.env.API_BASE_URL || BASE,
  TENANT_ID: TENANT,
  ADMIN_TOKEN: ADMIN,
  TOKEN_ADMIN: process.env.TOKEN_ADMIN || ADMIN,
  AO_ACT_TOKEN: process.env.AO_ACT_TOKEN || ADMIN,
  GEOX_AO_ACT_TOKEN: process.env.GEOX_AO_ACT_TOKEN || ADMIN,
  TOKEN: process.env.TOKEN || ADMIN,
  TOKEN_APPROVER: APPROVER,
  APPROVER_TOKEN: process.env.APPROVER_TOKEN || APPROVER,
  GEOX_EXECUTOR_TOKEN: process.env.GEOX_EXECUTOR_TOKEN || APPROVER,
};

const PHASE = process.env.CONTROLLED_PILOT_PR18I_PHASE || 'all';

const seedApply = `${SEED} --apply --tenant ${TENANT} --base-url ${BASE}`;

const c8FormalChainApply =
  `${SEED} --cleanup --apply --tenant ${TENANT} --profile c8-formal-chain` +
  ` && ${SEED} --apply --tenant ${TENANT} --profile c8-formal-chain --base-url ${BASE}`;

const c8FormalChainVerifyApi =
  `${SEED} --verify-api --tenant ${TENANT} --profile c8-formal-chain --base-url ${BASE}`;

const commonGates = [
  ['runtime_workers', 'pnpm run ci:runtime:workers'],
  ['pilot_runtime_security_baseline', 'pnpm run ci:runtime:pilot-security-baseline'],
  ['base_contract_p0', 'pnpm run ci:base-contract:p0'],
  ['formal_operation_field_binding', 'pnpm run ci:governance:formal-operation-field-binding'],
  ['c8_seed_dataset_modularity', 'pnpm run ci:governance:c8-seed-dataset-modularity'],
  ['customer_report_renderer_boundary', 'pnpm run ci:governance:customer-report-renderer-boundary'],
];

const formalChainGates = [
  ['controlled_pilot_c8_formal_chain_seed_runtime', c8FormalChainApply],
  ['c8_formal_chain_backend_p0', 'pnpm run ci:governance:c8-formal-chain-backend-p0'],
  ['controlled_pilot_c8_formal_chain_verify_api_structured_json', c8FormalChainVerifyApi],
];

const postFullReviewGates = [
  ['controlled_pilot_full_review_seed_static', 'pnpm run acceptance:controlled-pilot:full-review-seed'],
  ['controlled_pilot_full_review_seed_runtime', `${seedApply} && pnpm run acceptance:controlled-pilot:full-review-seed`],
  ['scenario_pest_disease_inspection', 'pnpm run ci:scenario:pest-disease-inspection'],
  ['scenario_formal_e2e', 'pnpm run ci:scenario:formal-e2e'],
  ['scenario_productization', 'pnpm run ci:scenario:productization'],
  ['device_anomaly_controlled_pilot', 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs'],
  ['customer_device_anomaly_report', 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs'],
  ['runtime_openapi_sales_critical', 'node scripts/governance_acceptance/ACCEPTANCE_RUNTIME_OPENAPI_SALES_CRITICAL_V1.cjs'],
  ['server_typecheck', 'pnpm --filter @geox/server typecheck'],
  ['web_typecheck', 'pnpm --filter @geox/web typecheck'],
];

function selectGates() {
  if (PHASE === 'formal-chain-preflight') {
    return [...commonGates, ...formalChainGates];
  }

  if (PHASE === 'post-full-review') {
    return [...commonGates, ...postFullReviewGates];
  }

  if (PHASE === 'all') {
    return [...commonGates, ...formalChainGates, ...postFullReviewGates];
  }

  throw new Error(`Unsupported CONTROLLED_PILOT_PR18I_PHASE: ${PHASE}`);
}

function tail(text) {
  const value = String(text || '').trim();
  return value.length > 4000 ? value.slice(value.length - 4000) : value;
}

const gates = selectGates();
const results = [];

for (const [id, command] of gates) {
  console.log(`[controlled-pilot-r2-pr18i] START ${id}`);

  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env,
    timeout: LONG,
    maxBuffer: 64 * 1024 * 1024,
  });

  const ok = result.status === 0 && !result.error;

  results.push({
    id,
    command,
    ok,
    exit_code: result.status,
    output_tail: ok
      ? ''
      : tail([result.error && result.error.message, result.stdout, result.stderr].filter(Boolean).join('\n')),
  });

  console.log(`[controlled-pilot-r2-pr18i] ${ok ? 'PASS' : 'FAIL'} ${id}`);
}

const failed = results.filter((result) => !result.ok);

const lines = [
  '# Controlled Pilot Readiness Report',
  '',
  `Status: ${failed.length ? 'FAIL' : 'PASS'}`,
  '',
  '## Phase',
  `- CONTROLLED_PILOT_PR18I_PHASE: ${PHASE}`,
  '',
  '## Required gates',
  ...results.map((result) => `- ${result.ok ? 'PASS' : 'FAIL'} ${result.id}: ${result.command}`),
  '',
  '## PR-18I formal-chain runtime contract',
  '- c8-formal-chain seed runtime is required and cannot be replaced by full-review runtime.',
  '- c8-formal-chain backend P0 is required after c8-formal-chain seed runtime.',
  '- c8-formal-chain structured verify-api is required.',
  '- full-review seed runtime remains required.',
  '- CI should run formal-chain-preflight before full-review pending facts are written.',
  '- CI should run post-full-review after frontend runtime audit artifacts are available.',
  '',
  '## Failed gate output tails',
  failed.length
    ? failed.map((result) => `### ${result.id}\n\n\`\`\`\n${result.output_tail}\n\`\`\``).join('\n\n')
    : '- none',
  '',
];

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);

console.log(JSON.stringify({
  status: failed.length ? 'FAIL' : 'PASS',
  phase: PHASE,
  required_gate_count: results.length,
  failed_gate_ids: failed.map((result) => result.id),
  formal_chain_gates: formalChainGates.map(([id]) => id),
}, null, 2));

if (failed.length) {
  process.exit(1);
}