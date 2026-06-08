#!/usr/bin/env node
'use strict';

// scripts/commercial_acceptance/ACCEPTANCE_CONTROLLED_PILOT_RELEASE_GATE_R2_V1.cjs
// Purpose: run the controlled pilot commercial release gates, including structured JSON verify-api checks for the C8 formal chain.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');
const LONG = Number(process.env.CONTROLLED_PILOT_LONG_GATE_TIMEOUT_MS || 24 * 60 * 1000);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ADMIN_ACCEPTANCE_TOKEN = process.env.ADMIN_TOKEN || process.env.TOKEN_ADMIN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || 'admin_token';
const APPROVER_ACCEPTANCE_TOKEN = process.env.TOKEN_APPROVER || process.env.APPROVER_TOKEN || 'approver_token';
const TENANT_ID = process.env.TENANT_ID || 'tenantA';
const PROJECT_ID = process.env.PROJECT_ID || 'projectA';
const GROUP_ID = process.env.GROUP_ID || 'groupA';
const SEED = 'node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';

const env = {
  ...process.env,
  BASE_URL: BASE,
  API_BASE_URL: process.env.API_BASE_URL || BASE,
  CONTROLLED_PILOT_VERIFY_API_BASE: process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.API_BASE_URL || BASE,
  TENANT_ID,
  PROJECT_ID,
  GROUP_ID,
  ADMIN_TOKEN: ADMIN_ACCEPTANCE_TOKEN,
  TOKEN_ADMIN: process.env.TOKEN_ADMIN || ADMIN_ACCEPTANCE_TOKEN,
  AO_ACT_TOKEN: process.env.AO_ACT_TOKEN || ADMIN_ACCEPTANCE_TOKEN,
  GEOX_AO_ACT_TOKEN: process.env.GEOX_AO_ACT_TOKEN || ADMIN_ACCEPTANCE_TOKEN,
  TOKEN: process.env.TOKEN || ADMIN_ACCEPTANCE_TOKEN,
  TOKEN_APPROVER: APPROVER_ACCEPTANCE_TOKEN,
  APPROVER_TOKEN: process.env.APPROVER_TOKEN || APPROVER_ACCEPTANCE_TOKEN,
  GEOX_EXECUTOR_TOKEN: process.env.GEOX_EXECUTOR_TOKEN || APPROVER_ACCEPTANCE_TOKEN,
};

const gates = [
  ['runtime_workers', 'pnpm run ci:runtime:workers'],
  ['pilot_runtime_security_baseline', 'pnpm run ci:runtime:pilot-security-baseline'],
  ['base_contract_p0', 'pnpm run ci:base-contract:p0'],
  ['formal_operation_field_binding', 'pnpm run ci:governance:formal-operation-field-binding'],
  ['c8_seed_dataset_modularity', 'pnpm run ci:governance:c8-seed-dataset-modularity'],
  ['customer_report_renderer_boundary', 'pnpm run ci:governance:customer-report-renderer-boundary'],
  ['web_customer_facing_boundary', 'pnpm --filter @geox/web run lint:customer-facing-boundary'],
  ['web_customer_export_same_source', 'pnpm --filter @geox/web run check:customer-export-same-source'],
  ['web_no_raw_enum_customer', 'pnpm --filter @geox/web run check:no-raw-enum-customer'],
  ['frontend_c8_customer_report_api_source', 'pnpm run ci:frontend:c8-customer-report-api-source'],
  ['controlled_pilot_full_review_seed_static', 'pnpm run acceptance:controlled-pilot:full-review-seed'],
  ['controlled_pilot_full_review_seed_runtime', `${SEED} --cleanup --apply --tenant ${TENANT_ID} && ${SEED} --apply --tenant ${TENANT_ID} --base-url ${BASE} && CONTROLLED_PILOT_FULL_REVIEW_RUNTIME=1 node scripts/governance_acceptance/ACCEPTANCE_CONTROLLED_PILOT_FULL_REVIEW_SEED_V1.cjs`],
  ['controlled_pilot_full_review_verify_api_structured_json', `${SEED} --verify-api --tenant ${TENANT_ID} --base-url ${BASE}`],
  ['controlled_pilot_c8_formal_chain_seed_runtime', `${SEED} --cleanup --apply --tenant ${TENANT_ID} --profile c8-formal-chain && ${SEED} --apply --tenant ${TENANT_ID} --profile c8-formal-chain --base-url ${BASE}`],
  ['controlled_pilot_c8_formal_chain_verify_api_structured_json', `${SEED} --verify-api --tenant ${TENANT_ID} --profile c8-formal-chain --base-url ${BASE}`],
  ['scenario_pest_disease_inspection', 'pnpm run ci:scenario:pest-disease-inspection'],
  ['scenario_formal_e2e', 'pnpm run ci:scenario:formal-e2e'],
  ['scenario_productization', 'pnpm run ci:scenario:productization'],
  ['device_anomaly_controlled_pilot', 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs'],
  ['customer_device_anomaly_report', 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs'],
  ['runtime_openapi_sales_critical', 'node scripts/governance_acceptance/ACCEPTANCE_RUNTIME_OPENAPI_SALES_CRITICAL_V1.cjs'],
  ['server_typecheck', 'pnpm --filter @geox/server typecheck'],
  ['web_typecheck', 'pnpm --filter @geox/web typecheck'],
];

function tail(s) {
  const text = String(s || '').trim();
  return text.length > 4000 ? text.slice(text.length - 4000) : text;
}

const results = [];
for (const [id, command] of gates) {
  console.log(`[controlled-pilot-r2] START ${id}`);
  const r = spawnSync(command, { cwd: ROOT, shell: true, encoding: 'utf8', env, timeout: LONG, maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0 && !r.error;
  results.push({ id, command, ok, exit_code: r.status, output_tail: ok ? '' : tail([r.error && r.error.message, r.stdout, r.stderr].filter(Boolean).join('\n')) });
  console.log(`[controlled-pilot-r2] ${ok ? 'PASS' : 'FAIL'} ${id}`);
}

const failed = results.filter((r) => !r.ok);
const lines = [
  '# Controlled Pilot Readiness Report',
  '',
  `Status: ${failed.length ? 'FAIL' : 'PASS'}`,
  '',
  '## Required gates',
  ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.command}`),
  '',
  '## Structured verify-api contract',
  '- Required endpoint: GET /api/v1/reports/operation/op_plan_c8_irrigation_formal_001',
  '- Required endpoint: GET /api/v1/reports/field/field_c8_demo',
  '- Required endpoint: GET /api/v1/as-executed/by-task/act_c8_irrigation_formal_001',
  '- Required endpoint: GET /api/v1/customer/fields/field_c8_demo/memory',
  '- Required profiles: default full-review and c8-formal-chain.',
  '- Required mode: JSON parse plus field-level assertions, not raw string includes checks.',
  '',
  '## PR-18J seed and customer renderer contract',
  '- Required gate: ci:governance:c8-seed-dataset-modularity',
  '- Required gate: ci:governance:customer-report-renderer-boundary',
  '- Required web check: lint:customer-facing-boundary',
  '- Required web check: check:customer-export-same-source',
  '- Required web check: check:no-raw-enum-customer',
  '- Required VM/source check: ci:frontend:c8-customer-report-api-source',
  '',
  '## Failed gate output tails',
  failed.length ? failed.map((r) => `### ${r.id}\n\n\`\`\`\n${r.output_tail}\n\`\`\``).join('\n\n') : '- none',
  '',
];
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);
console.log(JSON.stringify({
  status: failed.length ? 'FAIL' : 'PASS',
  required_gate_count: results.length,
  failed_gate_ids: failed.map((r) => r.id),
  structured_verify_api_gates: ['controlled_pilot_full_review_verify_api_structured_json', 'controlled_pilot_c8_formal_chain_verify_api_structured_json'],
  pr18j_contract_gates: ['c8_seed_dataset_modularity', 'customer_report_renderer_boundary', 'web_customer_facing_boundary', 'web_customer_export_same_source', 'web_no_raw_enum_customer', 'frontend_c8_customer_report_api_source'],
}, null, 2));
if (failed.length) process.exit(1);
