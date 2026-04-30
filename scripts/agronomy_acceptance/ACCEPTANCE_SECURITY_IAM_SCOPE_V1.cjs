const { fetchJson, env } = require('./_common.cjs');

const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
const tenant_id = env('TENANT_ID', 'tenantA');
const project_id = env('PROJECT_ID', 'projectA');
const group_id = env('GROUP_ID', 'groupA');

function tokenRecord(token, token_id, role, scopes, revoked = false, t = tenant_id) {
  return { token, token_id, actor_id: `${token_id}_actor`, tenant_id: t, project_id, group_id, role, revoked, scopes };
}

const tokenFile = {
  version: 'ao_act_tokens_v0',
  tokens: [
    tokenRecord('admin_token', 'tok_admin', 'admin', ['recommendation.write','recommendation.read','prescription.write','prescription.read','prescription.submit_approval','approval.request','approval.decide','approval.read','action.task.create','action.task.dispatch','action.receipt.submit','action.read','judge.execution.write','judge.read','acceptance.evaluate','acceptance.read','field_memory.read','field_memory.write','roi_ledger.write','roi_ledger.read','field.zone.write','field.zone.read','security.audit.read','security.admin','ao_act.task.write','ao_act.receipt.write','ao_act.index.read']),
    tokenRecord('agronomist_token', 'tok_agronomist', 'agronomist', ['recommendation.write','recommendation.read','prescription.write','prescription.read','prescription.submit_approval','field.zone.read','field_memory.read','roi_ledger.read']),
    tokenRecord('approver_token', 'tok_approver', 'approver', ['approval.read','approval.decide','prescription.read','recommendation.read','field.zone.read']),
    tokenRecord('executor_token', 'tok_executor', 'executor', ['action.read','action.receipt.submit','field.zone.read']),
    tokenRecord('client_token', 'tok_client', 'client', ['recommendation.read','prescription.read','action.read','field_memory.read','roi_ledger.read','field.zone.read']),
    tokenRecord('revoked_token', 'tok_revoked', 'operator', ['action.read'], true),
    tokenRecord('cross_tenant_token', 'tok_cross', 'client', ['action.read'], false, 'tenantB'),
  ],
};

const isAuthDenied = (r) => ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING','AUTH_REVOKED'].includes(String(r.json?.error ?? ''));

async function req(path, token, method = 'GET', body) {
  return fetchJson(`${base}${path}`, { method, token, body });
}

(async () => {
  process.env.GEOX_TOKENS_JSON = JSON.stringify(tokenFile);
  delete process.env.GEOX_TOKENS_FILE;
  delete process.env.GEOX_TOKEN_SSOT_PATH;
  process.env.GEOX_RUNTIME_ENV = 'test';

  const checks = {};

  const rec = await req('/api/v1/recommendations/generate', 'agronomist_token', 'POST', { tenant_id, project_id, group_id, field_id: 'f_iam', season_id: 's_iam', device_id: 'd_iam', crop_code: 'corn' });
  checks.agronomist_can_generate_recommendation = !['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(rec.json?.error ?? ''));

  const agApprove = await req('/api/v1/approvals/nonexistent/decide', 'agronomist_token', 'POST', { tenant_id, project_id, group_id, decision: 'APPROVE' });
  checks.agronomist_cannot_approve = agApprove.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(agApprove.json?.error ?? ''));

  const apprApprove = await req('/api/v1/approvals/nonexistent/decide', 'approver_token', 'POST', { tenant_id, project_id, group_id, decision: 'APPROVE' });
  checks.approver_can_decide_approval = !isAuthDenied(apprApprove);

  const exPres = await req('/api/v1/prescriptions/variable/from-recommendation', 'executor_token', 'POST', { tenant_id, project_id, group_id, recommendation_id: 'missing', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: [] } });
  checks.executor_cannot_create_prescription = exPres.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(exPres.json?.error ?? ''));

  const exReceipt = await req('/api/v1/actions/receipt', 'executor_token', 'POST', { tenant_id, project_id, group_id, act_task_id: 'missing', status: 'executed' });
  checks.executor_can_submit_receipt = !isAuthDenied(exReceipt);

  const clRead = await req(`/api/v1/field-memory/summary?field_id=${encodeURIComponent('f_iam')}`, 'client_token', 'GET');
  const clWrite = await req('/api/v1/actions/task', 'client_token', 'POST', { tenant_id, project_id, group_id, operation_plan_id: 'missing' });
  checks.client_read_only = !isAuthDenied(clRead) && clWrite.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(clWrite.json?.error ?? ''));

  const revoked = await req(`/api/v1/field-memory/summary?field_id=${encodeURIComponent('f_iam')}`, 'revoked_token', 'GET');
  checks.revoked_token_denied = revoked.status === 403 && String(revoked.json?.error ?? '') === 'AUTH_REVOKED';

  const cross = await req('/api/v1/actions/task', 'cross_tenant_token', 'POST', { tenant_id, project_id, group_id, operation_plan_id: 'missing' });
  checks.cross_tenant_hidden_as_404 = cross.status === 404 && String(cross.json?.error ?? '') === 'NOT_FOUND';

  // production-source guard: use token parser path + no structured sources
  delete process.env.GEOX_TOKENS_JSON;
  delete process.env.GEOX_TOKENS_FILE;
  delete process.env.GEOX_TOKEN_SSOT_PATH;
  process.env.GEOX_RUNTIME_ENV = 'production';
  const prod = await req(`/api/v1/field-memory/summary?field_id=${encodeURIComponent('f_iam')}`, 'admin_token', 'GET');
  checks.production_example_fallback_denied = prod.status === 401 && String(prod.json?.error ?? '') === 'AUTH_PRODUCTION_TOKEN_SOURCE_INVALID';

  checks.role_scope_matrix_enforced = checks.agronomist_cannot_approve && checks.executor_cannot_create_prescription && checks.client_read_only;
  const ok = Object.values(checks).every(Boolean);
  process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
})();
