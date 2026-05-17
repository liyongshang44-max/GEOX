#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const IRRIGATION_SCRIPT = path.join(ROOT, 'scripts', 'agronomy_acceptance', 'ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.cjs');

const source = fs.readFileSync(IRRIGATION_SCRIPT, 'utf8');

const banned = [
  { name: 'function runId', pattern: /function\s+runId\s*\(/ },
  { name: 'function fixture', pattern: /function\s+fixture\s*\(/ },
  { name: 'function manifestOf', pattern: /function\s+manifestOf\s*\(/ },
  { name: 'function snap', pattern: /function\s+snap\s*\(/ },
];

const violations = [];
for (const rule of banned) {
  if (rule.pattern.test(source)) {
    violations.push({ file: path.relative(ROOT, IRRIGATION_SCRIPT).replace(/\\/g, '/'), violation: rule.name });
  }
}

if (!/runFormalScenarioKernelV1/.test(source)) {
  violations.push({
    file: path.relative(ROOT, IRRIGATION_SCRIPT).replace(/\\/g, '/'),
    violation: 'missing runFormalScenarioKernelV1 reference',
  });
}

const output = {
  ok: violations.length === 0,
  gate: 'FORMAL_SCENARIO_KERNEL_USAGE_V1',
  scanned_files: [path.relative(ROOT, IRRIGATION_SCRIPT).replace(/\\/g, '/')],
  required_reference: 'runFormalScenarioKernelV1',
  banned_local_runtime: banned.map((x) => x.name),
  violations,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.ok) process.exit(1);
