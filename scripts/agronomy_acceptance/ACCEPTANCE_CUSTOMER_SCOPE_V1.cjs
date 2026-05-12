const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const CLIENT_TOKEN = process.env.CLIENT_TOKEN || process.env.AO_ACT_CLIENT_TOKEN || 'set-via-env-or-external-secret-file-client';
const EXPECTED_OPERATION_ID = process.env.EXPECTED_OPERATION_ID || 'ft_op_ft_ui_2_skills';

async function getJson(url, token) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

function roleOf(me) {
  return String(me.role || (Array.isArray(me.roles) ? me.roles[0] : '') || '').toLowerCase();
}

function countOf(payload, key, fallbackKey) {
  if (typeof payload[key] === 'number') return payload[key];
  if (Array.isArray(payload[fallbackKey])) return payload[fallbackKey].length;
  return 0;
}

function hasOperation(payload, expectedId) {
  const operations = Array.isArray(payload.operations) ? payload.operations : [];
  return operations.some((op) => [op.operation_id, op.operation_plan_id].map((x) => String(x || '')).includes(expectedId));
}

(async () => {
  const adminMe = await getJson(`${BASE_URL}/api/v1/session/me`, ADMIN_TOKEN);
  const adminFields = await getJson(`${BASE_URL}/api/v1/customer/fields`, ADMIN_TOKEN);
  const adminOperations = await getJson(`${BASE_URL}/api/v1/customer/operations`, ADMIN_TOKEN);
  const clientFields = await getJson(`${BASE_URL}/api/v1/customer/fields`, CLIENT_TOKEN);
  const clientOperations = await getJson(`${BASE_URL}/api/v1/customer/operations`, CLIENT_TOKEN);

  const layoutPath = path.join(process.cwd(), 'apps/web/src/layouts/CustomerLayout.tsx');
  const layoutSource = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';

  const checks = {
    admin_session_role: adminMe.ok && roleOf(adminMe.json) === 'admin',
    admin_fields_visible: adminFields.ok && countOf(adminFields.json, 'field_count', 'fields') > 0,
    admin_fields_internal_preview_scope: adminFields.ok && adminFields.json.scope?.scope_mode === 'INTERNAL_PREVIEW' && adminFields.json.scope?.can_preview_all_fields === true,
    admin_operations_expected_visible: adminOperations.ok && hasOperation(adminOperations.json, EXPECTED_OPERATION_ID),
    admin_operations_internal_preview_scope: adminOperations.ok && adminOperations.json.scope?.scope_mode === 'INTERNAL_PREVIEW' && adminOperations.json.scope?.can_preview_all_fields === true,
    client_fields_empty: clientFields.ok && countOf(clientFields.json, 'field_count', 'fields') === 0,
    client_fields_denied_scope: clientFields.ok && clientFields.json.scope?.scope_mode === 'DENIED',
    client_operations_empty: clientOperations.ok && countOf(clientOperations.json, 'operation_count', 'operations') === 0,
    client_operations_denied_scope: clientOperations.ok && clientOperations.json.scope?.scope_mode === 'DENIED',
    frontend_account_internal_preview_copy: layoutSource.includes('内部预览') && layoutSource.includes('全域预览') && !layoutSource.includes('授权地块 {authorizedFieldsCount} 块'),
    frontend_no_authorized_fields_copy: layoutSource.includes('暂无授权地块'),
  };

  const output = {
    ok: Object.values(checks).every(Boolean),
    suite: 'ACCEPTANCE_CUSTOMER_SCOPE_V1',
    expected_operation_id: EXPECTED_OPERATION_ID,
    checks,
    admin: {
      role: roleOf(adminMe.json),
      field_count: countOf(adminFields.json, 'field_count', 'fields'),
      operation_count: countOf(adminOperations.json, 'operation_count', 'operations'),
      fields_scope: adminFields.json.scope || null,
      operations_scope: adminOperations.json.scope || null,
    },
    client: {
      field_count: countOf(clientFields.json, 'field_count', 'fields'),
      operation_count: countOf(clientOperations.json, 'operation_count', 'operations'),
      fields_scope: clientFields.json.scope || null,
      operations_scope: clientOperations.json.scope || null,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
