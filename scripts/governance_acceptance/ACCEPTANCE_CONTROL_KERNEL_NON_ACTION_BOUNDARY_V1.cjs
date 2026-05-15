#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const CONTROL_KERNEL_DIR = 'packages/control-kernel/src';
const CONTROL_VERDICT_FILE = 'packages/control-kernel/src/ruleset/types.ts';
const KERNEL_FILE = 'packages/control-kernel/src/kernel.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_CONTROL_KERNEL_NON_ACTION_BOUNDARY_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function readRel(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function stripComments(text) { return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => line.replace(/\/\/.*$/g, '')).join('\n'); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}
function getInterfaceBody(text, name) {
  const marker = `interface ${name}`;
  const start = text.indexOf(marker);
  assert(start >= 0, `${name} must exist`);
  const braceStart = text.indexOf('{', start);
  assert(braceStart >= 0, `${name} must have a body`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') depth -= 1;
    if (depth === 0) return text.slice(braceStart + 1, i);
  }
  throw new Error(`${name} body parse failed`);
}

const verdictText = readRel(CONTROL_VERDICT_FILE);
const kernelText = readRel(KERNEL_FILE);
const verdictBody = stripComments(getInterfaceBody(verdictText, 'ControlVerdictV0'));

for (const forbidden of ['recommendation','task','priority','parameters','explanation','next_action','readiness','prescription','operation_plan','act_task']) {
  assert(!verdictBody.toLowerCase().includes(forbidden), `ControlVerdictV0 must not contain ${forbidden}`);
}
for (const required of ['type:', 'schema_version:', 'verdict_id:', 'evaluated_at_ts:', 'subjectRef:', 'window:', 'action_code:', 'verdict:', 'rule_ref']) {
  assert(verdictBody.includes(required), `ControlVerdictV0 missing allowed audit field ${required}`);
}
assert(verdictText.includes('export type VerdictV0 = "ALLOW" | "DENY" | "UNDETERMINED"'), 'ControlVerdict values must stay ALLOW/DENY/UNDETERMINED only');

const kernelFiles = walk(path.join(root, CONTROL_KERNEL_DIR));
const forbiddenImportTerms = ['apps/server','routes/','control_ao_act','action_task','actions/task','recommendation','prescription','operation_plan','operation_state','customer_report','roi_ledger','field_memory','axios','pg'];
for (const file of kernelFiles) {
  const text = stripComments(read(file));
  const importLines = text.split('\n').filter((line) => /^\s*import\s/.test(line)).join('\n').toLowerCase();
  for (const term of forbiddenImportTerms) assert(!importLines.includes(term.toLowerCase()), `${rel(file)} must not import ${term}`);
  const lower = text.toLowerCase();
  for (const sideEffect of ['fetch(', 'fs.', 'writefile', 'insert into', 'update ', 'delete ']) assert(!lower.includes(sideEffect), `${rel(file)} must not perform IO/side effects via ${sideEffect}`);
}
assert(kernelText.includes('No IO. No side effects. No execution. No explanation.'), 'kernel.ts must retain explicit non-goal statement');
assert(kernelText.includes('return Object.freeze(verdicts)'), 'kernel must freeze verdict outputs');

const allAppFiles = [
  ...walk(path.join(root, 'apps/server/src')),
  ...walk(path.join(root, 'apps/web/src')),
  ...walk(path.join(root, 'packages')),
].filter((file) => !rel(file).startsWith(CONTROL_KERNEL_DIR));

function hasExplicitControlVerdictSignal(text) {
  const lower = text.toLowerCase();
  return lower.includes('controlverdict')
    || lower.includes('control_verdict')
    || lower.includes('control_verdict_v0')
    || lower.includes('evaluatecontrolv0')
    || lower.includes('@geox/control-kernel')
    || lower.includes('packages/control-kernel');
}

const allowOffenders = [];
for (const file of allAppFiles) {
  const text = stripComments(read(file));
  if (!text.includes('ALLOW')) continue;
  if (!hasExplicitControlVerdictSignal(text)) continue;
  const lower = text.toLowerCase();
  const forbiddenSinks = ['createaoacttask','create_action_task','action.task.create','/api/v1/actions/task','act_task','generate recommendation','buildrecommendation','create recommendation','prescription','next_action','nextaction','readiness','customer readiness','operator readiness'];
  for (const sink of forbiddenSinks) if (lower.includes(sink)) allowOffenders.push(`${rel(file)} contains ControlVerdict/ALLOW with ${sink}`);
}
assert(allowOffenders.length === 0, `ControlVerdict.ALLOW must not be wired directly to action sinks:\n${allowOffenders.join('\n')}`);

const evaluateUsers = allAppFiles.filter((file) => stripComments(read(file)).includes('evaluateControlV0')).map(rel);
const allowedEvaluateUsers = ['packages/control-repo-const-harness/src/ruleset_file_harness.ts'];
const unexpectedEvaluateUsers = evaluateUsers.filter((file) => !allowedEvaluateUsers.includes(file));
assert(unexpectedEvaluateUsers.length === 0, `evaluateControlV0 must not be called by app/service code yet:\n${unexpectedEvaluateUsers.join('\n')}`);

console.log('[ACCEPTANCE_CONTROL_KERNEL_NON_ACTION_BOUNDARY_V1] PASSED');
