const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve(
  process.cwd(),
  'scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs'
);

const text = fs.readFileSync(target, 'utf8');
const checks = {};
const pass = (name, cond) => {
  checks[name] = cond ? 'PASS' : 'FAIL';
  return cond;
};

pass(
  'executor_actor_env_declared',
  text.includes("const executorActorId = env('EXECUTOR_ACTOR_ID', 'tok_executor_actor');")
);

pass(
  'receipt_builder_accepts_executor_actor_id',
  text.includes('executor_actor_id,')
);

pass(
  'canonical_executor_identity_used',
  text.includes("executor_id: { kind: 'script', id: executor_actor_id, namespace: 'executor_runtime_v1' }")
);

pass(
  'legacy_executor_identity_removed',
  !text.includes("executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' }")
);

pass(
  'receipt_call_binds_executor_actor',
  text.includes('executor_actor_id: executorActorId')
);

pass(
  'successor_auto_task_reconciliation_preserved',
  text.includes("const actTaskId = String(decideJson.act_task_id ?? '').trim();")
    && !text.includes('const taskResp = await fetchJson(`${base}/api/v1/actions/task`')
);

pass(
  'successor_receipt_schema_reconciliation_preserved',
  text.includes('const successorObservedParameters = Object.fromEntries(')
    && text.includes('observed_parameters: successorObservedParameters')
);

const ok = Object.values(checks).every((v) => v === 'PASS');
const output = {
  ok,
  task: 'BLINE_B5H3_FIELD_MEMORY_EXECUTOR_IDENTITY_RECON_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exit(ok ? 0 : 1);
