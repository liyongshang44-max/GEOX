#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'docs/audit/CONTROLLED_PILOT_READINESS_REPORT.md');
const LONG = Number(process.env.CONTROLLED_PILOT_LONG_GATE_TIMEOUT_MS || 24 * 60 * 1000);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ADMIN_ACCEPTANCE_TOKEN = process.env.ADMIN_TOKEN || process.env.TOKEN_ADMIN || process.env.AO_ACT_TOKEN || process.env.GEOX_AO_ACT_TOKEN || 'admin_token';
const APPROVER_ACCEPTANCE_TOKEN = process.env.TOKEN_APPROVER || process.env.APPROVER_TOKEN || 'approver_token';
const env = {
  ...process.env,
  BASE_URL: BASE,
  API_BASE_URL: process.env.API_BASE_URL || BASE,
  TENANT_ID: process.env.TENANT_ID || 'tenantA',
  PROJECT_ID: process.env.PROJECT_ID || 'projectA',
  GROUP_ID: process.env.GROUP_ID || 'groupA',
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
  ['controlled_pilot_full_review_seed_static', 'pnpm run acceptance:controlled-pilot:full-review-seed'],
  ['controlled_pilot_full_review_seed_runtime', 'node scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs --cleanup --apply --tenant tenantA && CONTROLLED_PILOT_FULL_REVIEW_RUNTIME=1 node scripts/governance_acceptance/ACCEPTANCE_CONTROLLED_PILOT_FULL_REVIEW_SEED_V1.cjs'],
  ['scenario_pest_disease_inspection', 'pnpm run ci:scenario:pest-disease-inspection'],
  ['scenario_formal_e2e', 'pnpm run ci:scenario:formal-e2e'],
  ['scenario_productization', 'pnpm run ci:scenario:productization'],
  ['device_anomaly_controlled_pilot', 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs'],
  ['customer_device_anomaly_report', 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs'],
  ['runtime_openapi_sales_critical', 'node scripts/governance_acceptance/ACCEPTANCE_RUNTIME_OPENAPI_SALES_CRITICAL_V1.cjs'],
  ['server_typecheck', 'pnpm --filter @geox/server typecheck'],
  ['web_typecheck', 'pnpm --filter @geox/web typecheck'],
];
function tail(s) { s = String(s || '').trim(); return s.length > 4000 ? s.slice(s.length - 4000) : s; }
const results = [];
for (const [id, command] of gates) {
  console.log(`[controlled-pilot-r2] START ${id}`);
  const r = spawnSync(command, { cwd: ROOT, shell: true, encoding: 'utf8', env, timeout: LONG, maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0 && !r.error;
  results.push({ id, command, ok, exit_code: r.status, output_tail: ok ? '' : tail([r.error && r.error.message, r.stdout, r.stderr].filter(Boolean).join('\n')) });
  console.log(`[controlled-pilot-r2] ${ok ? 'PASS' : 'FAIL'} ${id}`);
}
const failed = results.filter((r) => !r.ok);
const lines = ['# Controlled Pilot Readiness Report', '', `Status: ${failed.length ? 'FAIL' : 'PASS'}`, '', '## Required gates', ...results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} ${r.id}: ${r.command}`), '', '## Failed gate output tails', failed.length ? failed.map((r) => `### ${r.id}\n\n\`\`\`\n${r.output_tail}\n\`\`\``).join('\n\n') : '- none', ''];
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ status: failed.length ? 'FAIL' : 'PASS', required_gate_count: results.length, failed_gate_ids: failed.map((r) => r.id) }, null, 2));
if (failed.length) process.exit(1);
