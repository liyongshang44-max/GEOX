#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

const steps = [
  {
    name: 'ACCEPTANCE_PEST_DISEASE_INSPECTION_CONTRACT_V1',
    command: 'node',
    args: ['scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_CONTRACT_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_PEST_DISEASE_INSPECTION_NO_PROJECTION_WRITE_V1',
    command: 'node',
    args: ['scripts/governance_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_NO_PROJECTION_WRITE_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_PEST_DISEASE_SKILL_BOUNDARY_V1',
    command: 'node',
    args: ['scripts/governance_acceptance/ACCEPTANCE_PEST_DISEASE_SKILL_BOUNDARY_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_PEST_DISEASE_INSPECTION_API_V1',
    command: 'node',
    args: ['scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_API_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_PEST_DISEASE_AO_SENSE_BRIDGE_V1',
    command: 'node',
    args: ['scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_AO_SENSE_BRIDGE_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_FORMAL_PEST_DISEASE_INSPECTION_E2E_V1',
    command: 'node',
    args: ['scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_PEST_DISEASE_INSPECTION_E2E_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_PEST_DISEASE_INSPECTION_REPORT_PROJECTION_V1',
    command: 'node',
    args: ['scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_REPORT_PROJECTION_V1.cjs'],
  },
  {
    name: 'ACCEPTANCE_CUSTOMER_PEST_DISEASE_INSPECTION_REPORT_V1',
    command: 'node',
    args: ['scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_PEST_DISEASE_INSPECTION_REPORT_V1.cjs'],
  },
  {
    name: 'server typecheck',
    command: 'pnpm',
    args: ['--filter', '@geox/server', 'typecheck'],
  },
  {
    name: 'web typecheck',
    command: 'pnpm',
    args: ['--filter', '@geox/web', 'typecheck'],
  },
];

function runStep(step) {
  const started = Date.now();
  console.log(`\n[pest-disease-release-gate] START ${step.name}`);
  console.log(`[pest-disease-release-gate] $ ${step.command} ${step.args.join(' ')}`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const elapsedMs = Date.now() - started;
  if (result.error) {
    console.error(`[pest-disease-release-gate] ERROR ${step.name}`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[pest-disease-release-gate] FAIL ${step.name}`, { status: result.status, elapsedMs });
    process.exit(result.status ?? 1);
  }
  console.log(`[pest-disease-release-gate] PASS ${step.name}`, { elapsedMs });
}

(function main() {
  console.log('[pest-disease-release-gate] running P2-C pest disease inspection release gate');
  console.log('[pest-disease-release-gate] environment', {
    BASE_URL: process.env.BASE_URL ?? null,
    API_BASE_URL: process.env.API_BASE_URL ?? null,
    TENANT_ID: process.env.TENANT_ID ?? null,
    PROJECT_ID: process.env.PROJECT_ID ?? null,
    GROUP_ID: process.env.GROUP_ID ?? null,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN ? '<set>' : '<missing>',
  });
  for (const step of steps) runStep(step);
  console.log('\n[pest-disease-release-gate] PASS P2-C pest disease inspection release gate', {
    steps: steps.map((step) => step.name),
  });
})();
