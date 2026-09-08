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
  'skip_auto_task_issue_fact_preserved',
  text.includes("'ACCEPTANCE_FIELD_MEMORY_V1_skip_auto_task_issue'")
    && text.includes('skip_auto_task_issue\\": true')
);

pass(
  'skip_auto_task_issue_machine_assert_preserved',
  text.includes("approval skip_auto_task_issue append fact missing")
);

pass(
  'skip_aware_approval_route_used',
  text.includes('`${base}/api/v1/approvals/approve`')
);

pass(
  'approval_route_uses_approver_token',
  text.includes("token: approverToken")
);

pass(
  'approval_route_passes_request_id',
  text.includes('request_id: approval_id')
);

pass(
  'task_service_decide_route_removed_from_field_memory_child',
  !text.includes('/api/v1/approvals/${encodeURIComponent(approval_id)}/decide')
);

pass(
  'manual_task_create_preserved_after_skip_aware_approval',
  text.includes('const taskResp = await fetchJson(`${base}/api/v1/actions/task`')
    && text.includes("const taskJson = requireOk(taskResp, 'create action task')")
);

pass(
  'manual_task_execution_schema_preserved',
  text.includes("{ name: 'duration_sec', type: 'number', min: 1, max: 7200 }")
    && text.includes("{ name: 'duration_min', type: 'number', min: 1, max: 720 }")
    && text.includes("{ name: 'coverage_percent', type: 'number', min: 0, max: 100 }")
);

const ok = Object.values(checks).every((v) => v === 'PASS');
const output = {
  ok,
  task: 'BLINE_B5H1_FIELD_MEMORY_APPROVAL_ROUTE_RECON_V1',
  checks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exit(ok ? 0 : 1);
