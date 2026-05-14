#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}
function assertOrdered(text, needles, label) {
  let cursor = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, cursor + 1);
    if (next < 0) throw new Error(`${label}: missing ordered token ${needle}`);
    cursor = next;
  }
}

const taskBuilder = read('apps/server/src/domain/prescription/variable_action_task_v1.ts');
const migration = read('apps/server/db/migrations/2026_05_14_variable_task_no_auto_acked_v1.sql');
const dynamicAcceptance = read('scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_ACTION_TASK_V1.cjs');
const control = read('apps/server/src/routes/control_ao_act.ts');

for (const token of [
  'READY_TO_DISPATCH',
  'NOT_DISPATCHED',
  'ACK_REQUIRED',
  'TASK_CREATED_READY_TO_DISPATCH_NOT_ACKED',
  'dispatch_ack_required',
  'task_creation_is_not_ack',
  'default_parameter_sources',
  'parameter_source',
  'formal prescription',
]) {
  assertIncludes(taskBuilder, token, `variable action task payload ${token}`);
}

for (const token of [
  'geox_variable_task_no_auto_acked_v1',
  'BEFORE INSERT ON facts',
  "operation_plan_v1",
  "operation_plan_transition_v1",
  "VARIABLE_ACTION_TASK_CREATED",
  'READY_TO_DISPATCH',
  'ACK_REQUIRED',
  'NOT_DISPATCHED',
  "'{payload,status}'",
  "'{payload,to_status}'",
  "'{payload,dispatch_status}'",
  "'{payload,ack_status}'",
]) {
  assertIncludes(migration, token, `db no-auto-ack guard ${token}`);
}

assertOrdered(
  migration,
  [
    "record_type = 'operation_plan_v1'",
    "'{payload,status}'",
    "'ACKED'",
    "'{payload,status}'",
    "'\"READY_TO_DISPATCH\"'::jsonb",
    "'{payload,dispatch_status}'",
    "'\"NOT_DISPATCHED\"'::jsonb",
    "'{payload,ack_status}'",
    "'\"ACK_REQUIRED\"'::jsonb",
  ],
  'operation plan ACKED must be rewritten to READY_TO_DISPATCH and require executor ack'
);

assertOrdered(
  migration,
  [
    "record_type = 'operation_plan_transition_v1'",
    "VARIABLE_ACTION_TASK_CREATED",
    "'{payload,to_status}'",
    "'ACKED'",
    "'{payload,to_status}'",
    "'\"READY_TO_DISPATCH\"'::jsonb",
    "'{payload,ack_source_required}'",
  ],
  'operation plan transition ACKED must be rewritten to READY_TO_DISPATCH'
);

for (const check of [
  'task_ready_to_dispatch_not_acked',
  'task_default_parameter_sources_declared',
  'operation_plan_not_auto_acked',
  'operation_plan_transition_not_auto_acked',
  'dispatch_ack_not_synthesized',
]) {
  assertIncludes(dynamicAcceptance, check, `dynamic acceptance ${check}`);
}

assertIncludes(control, 'ensureVariableOperationPlanV1', 'route still has variable operation plan creation path under DB guard');
assertIncludes(control, 'from-variable-prescription', 'variable prescription route exists');

console.log('[VARIABLE_TASK_NOT_AUTO_ACKED_V1] PASSED');
console.log('[VARIABLE_TASK_NOT_AUTO_ACKED_V1] Checked variable task payload status, DB no-auto-ACK guard, and dynamic acceptance assertions.');
