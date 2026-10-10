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
  'receipt_execution_window_named',
  text.includes('const executionEndTs = Date.now() - 5_000;')
    && text.includes('const executionStartTs = executionEndTs - 15_000;')
);

pass(
  'duration_derived_from_execution_window',
  text.includes('const executionDurationMin = (executionEndTs - executionStartTs) / 60_000;')
);

pass(
  'receipt_execution_time_uses_named_window',
  text.includes('execution_time: { start_ts: executionStartTs, end_ts: executionEndTs },')
);

pass(
  'execution_summary_materialized',
  text.includes('execution_summary: { duration_min: executionDurationMin },')
);

pass(
  'successor_observed_parameters_preserved',
  text.includes('observed_parameters: successorObservedParameters')
    && text.includes('observed_parameters,')
);

pass(
  'canonical_executor_identity_preserved',
  text.includes("executor_id: { kind: 'script', id: executor_actor_id, namespace: 'executor_runtime_v1' }")
    && text.includes('executor_actor_id: executorActorId')
);

pass(
  'successor_auto_task_preserved',
  text.includes("const actTaskId = String(decideJson.act_task_id ?? '').trim();")
    && !text.includes('const taskResp = await fetchJson(`${base}/api/v1/actions/task`')
);

pass(
  'legacy_observed_duration_not_reintroduced',
  !text.includes('observed_parameters: {\n      duration_min')
    && !text.includes('duration_min: 20,')
);

const ok = Object.values(checks).every((v) => v === 'PASS');
process.stdout.write(`${JSON.stringify({
  ok,
  task: 'BLINE_B5H5_FIELD_MEMORY_RECEIPT_EXECUTION_SUMMARY_RECON_V1',
  checks,
}, null, 2)}\n`);
process.exit(ok ? 0 : 1);
