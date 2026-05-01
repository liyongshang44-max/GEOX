const { fetchJson, env } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');

const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
const tenant_id = env('TENANT_ID', 'tenantA');
const project_id = env('PROJECT_ID', 'projectA');
const group_id = env('GROUP_ID', 'groupA');
const isAuthDenied = (r) => ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING','AUTH_REVOKED'].includes(String(r.json?.error ?? ''));
async function req(path, token, method = 'GET', body) { return fetchJson(`${base}${path}`, { method, token, body }); }

(async () => {
  try { await assertSecurityAcceptanceTokensLoaded(base); } catch (err) {
    console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2));
    process.exit(1);
  }
  const checks = {};
  const rec = await req('/api/v1/recommendations/generate', 'agronomist_token', 'POST', { tenant_id, project_id, group_id, field_id: 'f_iam', season_id: 's_iam', device_id: 'd_iam', crop_code: 'corn' });
  checks.agronomist_can_generate_recommendation = !['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(rec.json?.error ?? ''));
  const reqCreate = await req('/api/v1/approvals/request', 'admin_token', 'POST', {
    tenant_id, project_id, group_id,
    issuer: { kind: 'human', id: 'tok_admin_actor', namespace: 'iam_scope_acceptance' },
    action_type: 'IRRIGATE',
    target: { kind: 'field', ref: 'f_iam' },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 60000 },
    parameter_schema: { keys: [{ name: 'amount', type: 'number' }] },
    parameters: { amount: 1 },
    constraints: { approval_required: true },
    meta: { skip_auto_task_issue: true },
  });
  const request_id = String(
    reqCreate.json?.request_id ??
    reqCreate.json?.approval_request_id ??
    reqCreate.json?.payload?.request_id ??
    ''
  );
  const agApprove = await req('/api/v1/approvals/approve', 'agronomist_token', 'POST', { tenant_id, project_id, group_id, request_id });
  checks.agronomist_cannot_approve = agApprove.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','ROLE_APPROVER_REQUIRED'].includes(String(agApprove.json?.error ?? ''));
  const apprApprove = await req('/api/v1/approvals/approve', 'approver_token', 'POST', { tenant_id, project_id, group_id, request_id });
  checks.approver_can_decide_approval =
    reqCreate.ok === true &&
    reqCreate.json?.ok === true &&
    Boolean(request_id) &&
    apprApprove.ok === true &&
    apprApprove.json?.ok === true;
  const exPres = await req('/api/v1/prescriptions/variable/from-recommendation', 'executor_token', 'POST', { tenant_id, project_id, group_id, recommendation_id: 'missing', variable_plan: { mode: 'VARIABLE_BY_ZONE', zone_rates: [] } });
  checks.executor_cannot_create_prescription = exPres.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(exPres.json?.error ?? ''));
  const exReceipt = await req('/api/v1/actions/receipt', 'executor_token', 'POST', { tenant_id, project_id, group_id, act_task_id: 'missing', status: 'executed' });
  checks.executor_can_submit_receipt = !isAuthDenied(exReceipt);
  const clRead = await req(`/api/v1/field-memory/summary?field_id=${encodeURIComponent('f_iam')}`, 'client_token', 'GET');
  const clWrite = await req('/api/v1/actions/task', 'client_token', 'POST', { tenant_id, project_id, group_id, operation_plan_id: 'missing' });
  checks.client_read_only = !isAuthDenied(clRead) && clWrite.status === 403 && ['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED'].includes(String(clWrite.json?.error ?? ''));
  const revoked = await req(`/api/v1/field-memory/summary?field_id=${encodeURIComponent('f_iam')}`, 'revoked_token', 'GET');
  checks.revoked_token_denied = revoked.status === 403 && String(revoked.json?.error ?? '') === 'AUTH_REVOKED';
  const cross = await req(`/api/v1/field-memory/summary?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&field_id=${encodeURIComponent('f_iam')}`, 'cross_tenant_token', 'GET');
  checks.cross_tenant_hidden_as_404 = cross.status === 404 && String(cross.json?.error ?? '') === 'NOT_FOUND';
  checks.role_scope_matrix_enforced = checks.agronomist_cannot_approve && checks.executor_cannot_create_prescription && checks.client_read_only;
  const ok = Object.values(checks).every(Boolean);
  process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
})();
