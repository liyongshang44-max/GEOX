#!/usr/bin/env node
/*
 * Stage-4 evidence strict acceptance smoke
 * Verifies list/detail/dashboard consistency for a fixed object.
 */

const assert = require('node:assert/strict');

const BASE_URL = process.env.GEOX_BASE_URL || 'http://localhost:8787';
const TENANT_ID = process.env.GEOX_TENANT_ID || 'demo_tenant';
const PROJECT_ID = process.env.GEOX_PROJECT_ID || 'demo_project';
const GROUP_ID = process.env.GEOX_GROUP_ID || 'demo_group';
const TOKEN = process.env.GEOX_BEARER || '';
const FIXED_OPERATION_PLAN_ID = process.env.GEOX_FIXED_OPERATION_PLAN_ID || 'opl_c309192971774a24b8526ae568a36903';

function buildHeaders() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = `Bearer ${TOKEN}`;
  return h;
}

async function getJson(path) {
  const url = new URL(path, BASE_URL);
  const res = await fetch(url, { headers: buildHeaders() });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url.toString()} => ${text}`);
  }
  return body;
}

function q(params) {
  const sp = new URLSearchParams(params);
  return `?${sp.toString()}`;
}

(async () => {
  console.log('[evidence-strict] start fixed object check');

  const tenantQuery = {
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
  };

  const listRes = await getJson(`/api/v1/operations${q({ ...tenantQuery, limit: '300' })}`);
  const detailRes = await getJson(`/api/v1/operations/${encodeURIComponent(FIXED_OPERATION_PLAN_ID)}/detail${q(tenantQuery)}`);
  const dashboardRes = await getJson(`/api/v1/operations${q({ ...tenantQuery, limit: '300' })}`);

  const listItem = (Array.isArray(listRes.items) ? listRes.items : []).find((x) =>
    String(x.operation_plan_id || x.operation_id) === FIXED_OPERATION_PLAN_ID
  );
  assert.ok(listItem, `list item not found: ${FIXED_OPERATION_PLAN_ID}`);

  const detailOperation = detailRes.operation || detailRes.item || {};
  const dashboardItem = (Array.isArray(dashboardRes.items) ? dashboardRes.items : []).find((x) =>
    String(x.operation_plan_id || x.operation_id) === FIXED_OPERATION_PLAN_ID
  );
  assert.ok(dashboardItem, `dashboard item not found: ${FIXED_OPERATION_PLAN_ID}`);

  const listStatus = String(listItem.final_status || '').toUpperCase();
  const detailStatus = String(detailOperation.final_status || '').toUpperCase();
  const dashboardStatus = String(dashboardItem.final_status || '').toUpperCase();

  assert.equal(listStatus, 'INVALID_EXECUTION', 'list final_status must be INVALID_EXECUTION');
  assert.equal(detailStatus, 'INVALID_EXECUTION', 'detail final_status must be INVALID_EXECUTION');
  assert.equal(dashboardStatus, 'INVALID_EXECUTION', 'dashboard final_status must be INVALID_EXECUTION');

  assert.equal(String(detailOperation.status_label || ''), '执行无效', 'detail status_label must be 执行无效');
  assert.equal(detailOperation.acceptance, null, 'detail acceptance must be null');

  const evidenceBundle = detailOperation.evidence_bundle || {};
  const artifacts = Array.isArray(evidenceBundle.artifacts) ? evidenceBundle.artifacts : [];
  const media = Array.isArray(evidenceBundle.media) ? evidenceBundle.media : [];
  const logs = Array.isArray(evidenceBundle.logs) ? evidenceBundle.logs : [];

  assert.equal(artifacts.length, 0, 'artifacts should be empty');
  assert.equal(media.length, 0, 'media should be empty');
  assert.equal(logs.length > 0, true, 'logs should exist');
  assert.equal(String(logs[0]?.kind || '').toLowerCase(), 'sim_trace', 'first log kind should be sim_trace');

  console.log('[evidence-strict] PASS', {
    operation_plan_id: FIXED_OPERATION_PLAN_ID,
    listStatus,
    detailStatus,
    dashboardStatus,
    status_label: detailOperation.status_label,
    acceptance: detailOperation.acceptance,
  });
})();
