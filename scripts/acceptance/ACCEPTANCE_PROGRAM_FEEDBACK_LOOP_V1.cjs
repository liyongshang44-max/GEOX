#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const cmd = [
  'pnpm',
  '--filter',
  '@geox/server',
  'exec',
  'tsx',
  '--test',
  'test/program_feedback_v1.test.ts',
  'test/program_state_v1.test.ts',
  'test/program_timeline_v1.test.ts'
];

const res = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('FAIL ACCEPTANCE_PROGRAM_FEEDBACK_LOOP_V1', { code: res.status });
  process.exit(res.status || 1);
}

console.log('PASS ACCEPTANCE_PROGRAM_FEEDBACK_LOOP_V1', {
  checks: [
    'program_state_projection_ready',
    'acceptance_spatial_feedback_loop',
    'next_action_hint_stable',
    'program_timeline_feedback_events'
  ]
});
