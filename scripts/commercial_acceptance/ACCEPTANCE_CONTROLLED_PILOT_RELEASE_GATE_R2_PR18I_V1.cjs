#!/usr/bin/env node
// PR18I_STATIC_REGRESSION_GUARDS_V1
const __pr18iStaticFsV1 = require("node:fs");
const __pr18iStaticPathV1 = require("node:path");

function __pr18iReadRepoFileV1(relativePath) {
  return __pr18iStaticFsV1.readFileSync(__pr18iStaticPathV1.resolve(process.cwd(), relativePath), "utf8");
}

function __pr18iAssertStaticV1(condition, message) {
  if (!condition) {
    throw new Error(`[PR18I_STATIC_REGRESSION_GUARD_FAILED] ${message}`);
  }
}

function __pr18iStaticRegressionGuardsV1() {
  const seedSource = __pr18iReadRepoFileV1("scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs");
  const gateSource = __pr18iReadRepoFileV1("scripts/commercial_acceptance/ACCEPTANCE_CONTROLLED_PILOT_RELEASE_GATE_R2_PR18I_V1.cjs");

  __pr18iAssertStaticV1(
    !/async\s+function\s+verify\s*\(\s*p\s*\)\s*\{\s*return\s*\{\s*ok\s*:\s*true[\s\S]{0,240}verify\s*:\s*true/.test(seedSource),
    "seed verify() must not be a fixed ok response",
  );

  __pr18iAssertStaticV1(
    !/async\s+function\s+cleanup\s*\(\s*p\s*,\s*doApply\s*\)\s*\{\s*return\s*\{\s*ok\s*:\s*true[\s\S]{0,260}cleanup\s*:\s*true/.test(seedSource),
    "seed cleanup() must not be a fixed ok response",
  );

  __pr18iAssertStaticV1(
    /async\s+function\s+verify\s*\(\s*p\s*\)[\s\S]*seedLifecycleCounts\s*\(\s*c\s*,\s*p\s*\)/.test(seedSource),
    "seed verify() must use DB-backed seedLifecycleCounts()",
  );

  __pr18iAssertStaticV1(
    /async\s+function\s+cleanup\s*\(\s*p\s*,\s*doApply\s*\)[\s\S]*BEGIN[\s\S]*COMMIT[\s\S]*append_only_facts_deleted\s*:\s*false/.test(seedSource),
    "seed cleanup() must execute DB cleanup transaction and preserve append-only facts",
  );

  __pr18iAssertStaticV1(
    /async\s+function\s+verifyClean\s*\(\s*p\s*\)[\s\S]*SEED_VERIFY_CLEAN_FAILED/.test(seedSource),
    "seed verifyClean() must assert DB-backed clean state",
  );

  __pr18iAssertStaticV1(
    !/async\s+function\s+deleteQuery\s*\([\s\S]*catch\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{\s*rowCount\s*:\s*0\s*\}\s*\)\s*\)/.test(seedSource),
    "deleteQuery() must not swallow SQL errors as rowCount=0",
  );

  __pr18iAssertStaticV1(
    gateSource.includes("pnpm run ci:governance:c8-formal-chain-backend-p0"),
    "PR18I release gate must include ci:governance:c8-formal-chain-backend-p0",
  );

  __pr18iAssertStaticV1(
    /--profile\s+c8-formal-chain[\s\S]*--base-url|--profile",\s*"c8-formal-chain"[\s\S]*--base-url/.test(gateSource),
    "PR18I release gate must run c8-formal-chain seed runtime",
  );

  __pr18iAssertStaticV1(
    /--verify-api[\s\S]*--profile\s+c8-formal-chain|--verify-api"[\s\S]*--profile",\s*"c8-formal-chain"/.test(gateSource),
    "PR18I release gate must run --verify-api with --profile c8-formal-chain",
  );

  __pr18iAssertStaticV1(
    gateSource.includes("CONTROLLED_PILOT_PR18I_PHASE=formal-chain-preflight"),
    "PR18I release gate must preserve formal-chain preflight phase",
  );
}

__pr18iStaticRegressionGuardsV1();

if (process.env.CONTROLLED_PILOT_PR18I_STATIC_ONLY === "1") {
  console.log("[pr18i-static-regression-guards] PASS");
  process.exit(0);
}
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
const FIXED_NOW_MS = process.env.CONTROLLED_PILOT_SEED_NOW_MS || '1710000000000';
const seedNowMsArg = `--now-ms ${FIXED_NOW_MS}`;

const seedApply = `${SEED} --apply --tenant ${TENANT} --base-url ${BASE} ${seedNowMsArg}`;

const c8FormalChainApply =
  `${SEED} --cleanup --apply --tenant ${TENANT} --profile c8-formal-chain ${seedNowMsArg}` +
  ` && ${SEED} --apply --tenant ${TENANT} --profile c8-formal-chain --base-url ${BASE} ${seedNowMsArg}`;

const c8FormalChainVerifyApi =
  `${SEED} --verify-api --tenant ${TENANT} --profile c8-formal-chain --base-url ${BASE} ${seedNowMsArg}`;

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
    return [
      ['c8_seed_dataset_modularity', 'pnpm run ci:governance:c8-seed-dataset-modularity'],
      ['customer_report_renderer_boundary', 'pnpm run ci:governance:customer-report-renderer-boundary'],
      ...formalChainGates,
    ];
  }

  if (PHASE === 'post-full-review') {
    return [
      ['controlled_pilot_full_review_seed_static', 'pnpm run acceptance:controlled-pilot:full-review-seed'],
      ['controlled_pilot_full_review_seed_runtime', `${seedApply} && pnpm run acceptance:controlled-pilot:full-review-seed`],
      ['scenario_pest_disease_inspection', 'pnpm run ci:scenario:pest-disease-inspection'],
      ['device_anomaly_controlled_pilot', 'node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs'],
      ['customer_device_anomaly_report', 'node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs'],
      ['runtime_openapi_sales_critical', 'node scripts/governance_acceptance/ACCEPTANCE_RUNTIME_OPENAPI_SALES_CRITICAL_V1.cjs'],
      ['server_typecheck', 'pnpm --filter @geox/server typecheck'],
      ['web_typecheck', 'pnpm --filter @geox/web typecheck'],
    ];
  }

  if (PHASE === 'all') {
    return [
      ['runtime_workers', 'pnpm run ci:runtime:workers'],
      ['pilot_runtime_security_baseline', 'pnpm run ci:runtime:pilot-security-baseline'],
      ['c8_seed_dataset_modularity', 'pnpm run ci:governance:c8-seed-dataset-modularity'],
      ['customer_report_renderer_boundary', 'pnpm run ci:governance:customer-report-renderer-boundary'],
      ...formalChainGates,
      ['base_contract_p0', 'pnpm run ci:base-contract:p0'],
      ['formal_operation_field_binding', 'pnpm run ci:governance:formal-operation-field-binding'],
      ...postFullReviewGates,
    ];
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
