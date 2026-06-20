#!/usr/bin/env node
const assert = require('node:assert/strict');
const BASE_URL = (process.env.THREE_SURFACE_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const routes = [
  ['/api/v1/customer/fields/FIELD_DEMO/confirmed-twin-summary', 'CUSTOMER'],
  ['/api/v1/operator/twin/fields/FIELD_DEMO', 'OPERATOR'],
  ['/api/v1/operator/twin/fields/FIELD_DEMO/scenarios', 'OPERATOR'],
  ['/api/v1/operator/twin/fields/FIELD_DEMO/evidence', 'OPERATOR'],
  ['/api/v1/operator/twin/fields/FIELD_DEMO/calibration', 'OPERATOR'],
  ['/api/v1/operator/twin/fields/FIELD_DEMO/post-irrigation', 'OPERATOR'],
  ['/api/v1/admin/dashboard', 'ADMIN'],
  ['/api/v1/admin/operations', 'ADMIN'],
  ['/api/v1/admin/evidence', 'ADMIN'],
  ['/api/v1/admin/healthz', 'ADMIN'],
];
function hasKeyDeep(value, re) {
  if (!value || typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value)) {
    if (re.test(k)) return true;
    if (hasKeyDeep(v, re)) return true;
  }
  return false;
}
(async () => {
  const results = [];
  for (const [path, surface] of routes) {
    const res = await fetch(BASE_URL + path);
    assert.notEqual(res.status, 404, `${path} must not be 404`);
    assert.notEqual(res.status, 500, `${path} must not be 500`);
    const json = await res.json().catch(() => ({}));
    assert.equal(json.surface, surface, `${path} surface`);
    assert.equal(json.writeReady, false, `${path} writeReady`);
    assert.equal(json.taskCreationReady, false, `${path} taskCreationReady`);
    assert.equal(json.dispatchReady, false, `${path} dispatchReady`);
    if (surface === 'CUSTOMER') {
      assert.equal(Boolean(json.operator_field_twin_workspace_v1 || json.operator_twin_overview_v1 || json.admin_control_plane_v1 || json.debug), false, `${path} must not expose operator/debug/admin payload`);
    }
    if (surface === 'ADMIN') assert.equal(hasKeyDeep(json, /forecast|scenario/i), false, `${path} must not expose forecast/scenario main payload keys`);
    results.push({ path, status: res.status, surface });
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
})().catch((err) => { console.error(err); process.exit(1); });
