#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const AO_SENSE_RECEIPT = 'ao_sense_receipt_v1';
const AO_SENSE_TASK = 'ao_sense_task_v1';
const AO_SENSE_OWNED_FILES = new Set([
  'apps/server/src/routes/control_ao_sense.ts',
  'apps/server/src/routes/v1/sense.ts',
  'apps/server/src/routes/legacy/sense.ts',
  'apps/judge/src/ao_sense.ts',
  'packages/contracts/ao_sense_v1.schema.json',
  'packages/contracts/ao_sense_task_v1.schema.json',
  'packages/contracts/ao_sense_receipt_v1.schema.json',
]);

function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_AOSENSE_AOACT_PARTITION_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs|sql|json|md)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function filesUnder(...dirs) {
  return dirs.flatMap((d) => walk(path.join(root, d)));
}

function isAoSenseOwned(file) {
  return AO_SENSE_OWNED_FILES.has(rel(file));
}

function assertNoAoSenseReceiptInScope(label, dirs, forbiddenTerms) {
  const files = filesUnder(...dirs);
  const offenders = [];
  for (const file of files) {
    if (isAoSenseOwned(file)) continue;
    const text = read(file);
    if (!text.includes(AO_SENSE_RECEIPT)) continue;
    const lower = text.toLowerCase();
    for (const term of forbiddenTerms) {
      if (lower.includes(term.toLowerCase())) {
        offenders.push(`${rel(file)} contains ${AO_SENSE_RECEIPT} with ${term}`);
      }
    }
  }
  assert(offenders.length === 0, `${label} must not consume ${AO_SENSE_RECEIPT}:\n${offenders.join('\n')}`);
}

function assertNoAoSenseTaskInAoActTaskScope(label, dirs) {
  const files = filesUnder(...dirs);
  const offenders = [];
  for (const file of files) {
    if (isAoSenseOwned(file)) continue;
    const text = read(file);
    if (!text.includes(AO_SENSE_TASK)) continue;
    const lower = text.toLowerCase();
    if (lower.includes('act_task') || lower.includes('ao_act') || lower.includes('action.task') || lower.includes('/api/v1/actions')) {
      offenders.push(`${rel(file)} contains ${AO_SENSE_TASK} inside AO-ACT task scope`);
    }
  }
  assert(offenders.length === 0, `${label} must not expose ${AO_SENSE_TASK} as AO-ACT task:\n${offenders.join('\n')}`);
}

function assertRequiredAoSenseBoundaries() {
  const route = path.join(root, 'apps/server/src/routes/control_ao_sense.ts');
  const v1Sense = path.join(root, 'apps/server/src/routes/v1/sense.ts');
  const receiptSchema = path.join(root, 'packages/contracts/ao_sense_receipt_v1.schema.json');
  const taskSchema = path.join(root, 'packages/contracts/ao_sense_task_v1.schema.json');
  assert(fs.existsSync(route), 'AO-SENSE control route must exist');
  assert(fs.existsSync(v1Sense), 'AO-SENSE v1 route must exist');
  assert(fs.existsSync(receiptSchema), 'AO-SENSE receipt contract must exist');
  assert(fs.existsSync(taskSchema), 'AO-SENSE task contract must exist');
  assert(read(route).includes(AO_SENSE_RECEIPT), 'control_ao_sense route must write/read ao_sense_receipt_v1');
  assert(read(route).includes(AO_SENSE_TASK), 'control_ao_sense route must write/read ao_sense_task_v1');
  assert(read(v1Sense).includes('/api/v1/sense'), 'v1 sense route must keep AO-SENSE under /api/v1/sense namespace');
}

assertRequiredAoSenseBoundaries();

// 1. AO-SENSE receipt must not become as_executed proof.
assertNoAoSenseReceiptInScope(
  'as_executed partition',
  ['apps/server/src', 'packages/contracts/src'],
  ['as_executed', 'as_executed_record', 'as_applied', 'execution proof', 'execution_receipt']
);

// 2. AO-SENSE receipt must not enter acceptance.
assertNoAoSenseReceiptInScope(
  'acceptance partition',
  ['apps/server/src', 'packages/contracts/src'],
  ['acceptance', 'acceptance_result', 'acceptance.evaluate', 'judge.execution', 'final verdict']
);

// 3. AO-SENSE receipt must not generate ROI ledger.
assertNoAoSenseReceiptInScope(
  'roi ledger partition',
  ['apps/server/src', 'packages/contracts/src'],
  ['roi_ledger', 'roi ledger', 'cost_record', 'resource_usage', 'benefit']
);

// 4. AO-SENSE receipt must not generate Field Memory.
assertNoAoSenseReceiptInScope(
  'field memory partition',
  ['apps/server/src', 'packages/contracts/src'],
  ['field_memory', 'field memory', 'memory_event', 'learning memory']
);

// 5. AO-SENSE receipt must not affect operation_state.final_status.
assertNoAoSenseReceiptInScope(
  'operation state final status partition',
  ['apps/server/src', 'packages/contracts/src'],
  ['operation_state', 'final_status', 'operation_state_v1', 'customer_report_v1']
);

// 6. AO-SENSE task must not be shown or consumed as AO-ACT task.
assertNoAoSenseTaskInAoActTaskScope(
  'AO-SENSE task / AO-ACT task partition',
  ['apps/server/src/routes/v1', 'apps/server/src/routes/legacy', 'apps/server/src/projections', 'apps/web/src']
);

for (const file of AO_SENSE_OWNED_FILES) {
  assert(fs.existsSync(path.join(root, file)), `expected AO-SENSE boundary file missing: ${file}`);
}

console.log('[ACCEPTANCE_AOSENSE_AOACT_PARTITION_V1] PASSED');
