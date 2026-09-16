const fs = require('node:fs');
const path = require('node:path');

const TASK = 'BLINE_B5F2_SUCCESSOR_RECEIPT_CONSUMPTION_V1';
const target = path.join(
  process.cwd(),
  'scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs',
);

function pass(value) {
  return value ? 'PASS' : 'FAIL';
}

function main() {
  const source = fs.readFileSync(target, 'utf8');

  const builderStart = source.indexOf('function buildIrrigationReceiptBody(');
  const builderEnd = source.indexOf('async function executeMockValveSkill', builderStart);
  if (builderStart < 0 || builderEnd < 0) throw new Error('RECEIPT_BUILDER_ANCHOR_MISSING');
  const builder = source.slice(builderStart, builderEnd);

  const taskFactAt = source.indexOf('const taskFactQ = await pool.query');
  const receiptAt = source.indexOf('const receipt = await fetchJson(`${base}/api/v1/actions/receipt`', taskFactAt);
  if (taskFactAt < 0 || receiptAt < 0) throw new Error('SUCCESSOR_RECEIPT_ANCHOR_MISSING');
  const taskToReceipt = source.slice(taskFactAt, receiptAt + 1000);

  const checks = {
    receipt_builder_accepts_observed_parameters: pass(
      /function buildIrrigationReceiptBody\(\{[^\n]*observed_parameters/.test(builder),
    ),
    receipt_builder_uses_observed_parameters_directly: pass(
      /\n\s*observed_parameters,\s*\n/.test(builder),
    ),
    legacy_fixed_receipt_shape_removed: pass(
      !builder.includes('observed_parameters: { amount: 20, coverage_percent: 90, duration_min: 20 }'),
    ),
    successor_task_payload_captured: pass(
      taskToReceipt.includes('const taskPayload = taskFactQ.rows?.[0]?.record_json?.payload ?? {};'),
    ),
    successor_task_schema_keys_captured: pass(
      taskToReceipt.includes('const successorTaskSchemaKeys = Array.isArray(taskPayload?.parameter_schema?.keys)'),
    ),
    successor_observed_parameters_derived: pass(
      taskToReceipt.includes('const successorObservedParameters = Object.fromEntries(')
      && taskToReceipt.includes('Object.prototype.hasOwnProperty.call(taskPayload?.parameters ?? {}, name)'),
    ),
    successor_observed_parameters_required: pass(
      taskToReceipt.includes("if (Object.keys(successorObservedParameters).length === 0) throw new Error(JSON.stringify({ reason: 'SUCCESSOR_TASK_OBSERVED_PARAMETERS_EMPTY'"),
    ),
    receipt_consumes_successor_observed_parameters: pass(
      taskToReceipt.includes('observed_parameters: successorObservedParameters'),
    ),
  };

  const ok = Object.values(checks).every((value) => value === 'PASS');
  process.stdout.write(`${JSON.stringify({ ok, task: TASK, checks }, null, 2)}\n`);
  if (!ok) process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2)}\n`);
  process.exit(1);
}
