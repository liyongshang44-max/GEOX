const { assert, env, fetchJson } = require('./_common.cjs');
(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3000');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const crossTenant = env('CROSS_TENANT_ID', 'tenantB');
  const field_id = env('FIELD_ID', 'field_demo_1');
  const cross = await fetchJson(`${base}/api/v1/agronomy/inputs/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(crossTenant)}`, { token });
  assert.equal(cross.status, 404, `cross tenant should be hidden; got ${cross.status}`);
  const unapproved = await fetchJson(`${base}/api/v1/simulators/irrigation/execute`, { method: 'POST', token, body: { tenant_id, project_id: env('PROJECT_ID', 'P_DEFAULT'), group_id: env('GROUP_ID', 'G_DEFAULT'), act_task_id: 'act_not_approved_1' } });
  assert.equal(unapproved.status, 403, `unapproved dispatch must fail; got ${unapproved.status}`);
  console.log('PASS negative security acceptance');
})().catch((e) => { console.error('FAIL negative security acceptance', e.message); process.exit(1); });
