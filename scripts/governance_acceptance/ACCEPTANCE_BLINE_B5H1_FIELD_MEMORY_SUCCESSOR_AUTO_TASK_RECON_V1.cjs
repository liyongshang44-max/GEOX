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
  'task_service_decide_route_preserved',
  text.includes('/api/v1/approvals/${encodeURIComponent(approval_id)}/decide')
);

pass(
  'stale_skip_auto_task_injection_removed',
  !text.includes("'ACCEPTANCE_FIELD_MEMORY_V1_skip_auto_task_issue'")
    && !text.includes('approval skip_auto_task_issue append fact missing')
);

pass(
  'decide_auto_task_consumed',
  text.includes("const actTaskId = String(decideJson.act_task_id ?? '').trim();")
    && text.includes("assert.ok(actTaskId, 'act_task_id missing from approval decide successor auto-task');")
);

pass(
  'second_positive_task_create_removed',
  !text.includes('const taskResp = await fetchJson(`${base}/api/v1/actions/task`')
    && !text.includes("requireOk(taskResp, 'create action task')")
);

pass(
  'canonical_task_fact_type_used',
  text.includes("(record_json::jsonb ->> 'type') = 'ao_act_task_v0'")
);

pass(
  'successor_task_payload_captured',
  text.includes("const taskPayload = taskFactQ.rows?.[0]?.record_json?.payload ?? {};")
);

pass(
  'receipt_observed_parameters_derived_from_task_schema',
  text.includes('const successorTaskSchemaKeys = Array.isArray(taskPayload?.parameter_schema?.keys)')
    && text.includes('const successorObservedParameters = Object.fromEntries(')
    && text.includes("reason: 'SUCCESSOR_TASK_OBSERVED_PARAMETERS_EMPTY'")
);

pass(
  'receipt_builder_consumes_successor_observed_parameters',
  text.includes('observed_parameters: successorObservedParameters')
    && text.includes('observed_parameters,')
);

pass(
  'legacy_fixed_receipt_shape_removed',
  !text.includes('observed_parameters: {\n      amount,\n      coverage_percent,\n      duration_min,\n    }')
);

const ok = Object.values(checks).every((v) => v === 'PASS');
const output = {
  ok,
  task: 'BLINE_B5H1_FIELD_MEMORY_SUCCESSOR_AUTO_TASK_RECON_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exit(ok ? 0 : 1);
