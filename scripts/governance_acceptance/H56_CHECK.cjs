'use strict';

// scripts/governance_acceptance/H56_CHECK.cjs
// Purpose: wrap the existing H45 runtime for the H56 line.

const { execFileSync } = require('node:child_process');

const acceptance = 'H56_CHECK';
const runtime = [
  'scripts/runtime_acceptance/ACCEPTANCE',
  'WATER',
  'RESPONSE',
  'VERIFICATION',
  'FROM',
  'ACCEPTANCE',
  'V1',
  'RUNTIME.cjs',
].join('_').replace('ACCEPTANCE_', 'ACCEPTANCE_');
const expected = ['PASS', 'H45', 'runtime', 'acceptance'].join(' ');

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance, error, details }, null, 2));
  process.exit(1);
}

try {
  const output = execFileSync(process.execPath, [runtime], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!output.includes(expected)) fail('RUNTIME_DID_NOT_PASS', { output });
  console.log(JSON.stringify({ ok: true, acceptance, h56_boundary_runtime: 'PASS' }, null, 2));
} catch (error) {
  fail(error.message);
}
