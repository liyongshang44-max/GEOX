#!/usr/bin/env node
const BASE = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const FIELD = String(process.env.GEOX_FIELD_ID || process.env.FIELD_ID || 'field_c8_demo');
const TENANT = String(process.env.TENANT_ID || process.env.GEOX_TENANT_ID || 'tenantA');
const PROJECT = String(process.env.PROJECT_ID || process.env.GEOX_PROJECT_ID || 'projectA');
const GROUP = String(process.env.GROUP_ID || process.env.GEOX_GROUP_ID || 'groupA');
const forbidden = ['writeFieldMemory', 'createRoiLedger', 'createAoActTask', 'dispatchNow', 'approveNow', 'submitRecommendation', 'approval mutation'];
function assert(condition, message, detail) { if (!condition) throw new Error(message + (detail ? ' ' + JSON.stringify(detail) : '')); }
async function fetchJson(path) {
  const r = await fetch(BASE + path, { headers: { accept: 'application/json' } });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error('NON_JSON_RESPONSE ' + text.slice(0, 300)); }
  assert(r.ok, 'HTTP failed', { status: r.status, body });
  return body;
}
async function main() {
  const p = new URLSearchParams({ tenant_id: TENANT, project_id: PROJECT, group_id: GROUP });
  const body = await fetchJson(`/api/v1/operator/twin/fields/${encodeURIComponent(FIELD)}/post-irrigation?${p}`);
  assert(body.ok === true, 'ok must be true');
  assert(body.source === 'operator_field_twin_post_irrigation_verification_api', 'source mismatch', body.source);
  assert(body.dataScope === 'OFFICIAL_OPERATOR_TWIN_API', 'dataScope mismatch', body.dataScope);
  for (const key of ['writeReady', 'dispatchReady', 'approvalReady', 'taskCreationReady', 'memoryWriteReady', 'roiWriteReady']) assert(body[key] === false, key + ' must be false', body[key]);
  const q = body.operator_field_twin_post_irrigation_verification_v1;
  assert(q && q.surface === 'OPERATOR', 'surface mismatch', q);
  assert(q.report_kind === 'OPERATOR_FIELD_TWIN_POST_IRRIGATION_VERIFICATION', 'report_kind mismatch', q?.report_kind);
  assert(q.pre_irrigation_state_v1, 'missing pre state');
  assert(q.post_irrigation_state_v1, 'missing post state');
  assert(q.response_delta_v1, 'missing response delta');
  assert(q.execution_evidence_v1, 'missing execution evidence');
  assert(Array.isArray(q.zone_response_matrix_v1?.rows), 'zone rows must be array');
  assert(q.verification_summary, 'missing verification summary');
  assert(Array.isArray(q.verification_gaps), 'verification_gaps must be array');
  assert(Array.isArray(q.boundary_rules), 'boundary_rules must be array');
  const text = JSON.stringify(body);
  for (const token of forbidden) assert(!text.includes(token), 'forbidden payload token ' + token);
  console.log('[operator-field-twin-post-irrigation-shape] PASS');
}
main().catch((error) => { console.error('[operator-field-twin-post-irrigation-shape] FAIL'); console.error(error && error.stack ? error.stack : error); process.exit(1); });
