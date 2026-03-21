#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const cmd = [
  'pnpm',
  '--filter',
  '@geox/server',
  'exec',
  'tsx',
  '--test',
  'test/program_cost_sla_efficiency_v1.test.ts'
];

const res = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('FAIL ACCEPTANCE_PROGRAM_COST_SLA_V1', { code: res.status });
  process.exit(res.status || 1);
}

console.log('PASS ACCEPTANCE_PROGRAM_COST_SLA_V1', {
  checks: [
    'resource_usage_fact_projection',
    'cost_record_fact_projection',
    'sla_evaluation_fact_projection',
    'program_efficiency_projection'
  ]
});
