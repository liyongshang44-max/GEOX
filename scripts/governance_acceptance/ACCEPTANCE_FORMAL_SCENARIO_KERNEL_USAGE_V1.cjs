#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { assert } = require('../agronomy_acceptance/_common.cjs');

const target = path.resolve(__dirname, '../agronomy_acceptance/ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts');
const src = fs.readFileSync(target, 'utf8');

assert.ok(!/function\s+runId\s*\(/.test(src), 'must not define function runId');
assert.ok(!/function\s+fixture\s*\(/.test(src), 'must not define function fixture');
assert.ok(!/function\s+manifestOf\s*\(/.test(src), 'must not define function manifestOf');
assert.ok(!/function\s+snap\s*\(/.test(src), 'must not define function snap');
assert.ok(/runFormalScenarioKernelV1/.test(src), 'must use runFormalScenarioKernelV1');

console.log(JSON.stringify({ ok: true, scenario: 'FORMAL_SCENARIO_KERNEL_USAGE_V1', target }, null, 2));
