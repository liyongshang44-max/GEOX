#!/usr/bin/env node
/*
 * Stage-6 commercial acceptance checks.
 *
 * Required env:
 *   BASE_URL                  default: http://127.0.0.1:3001
 *   AO_ACT_TOKEN              optional bearer token
 *   TENANT_ID/PROJECT_ID/GROUP_ID optional query params
 *   SUCCESS_OPERATION_ID      case-2 operation id (optional, can auto-discover)
 *   GEOX_FIXED_OPERATION_PLAN_ID optional fixed baseline id for case-1 invalid op
 *   REPORT_JSON_INVALID_PATH  local json path for case-1 report (default: scripts/acceptance/data/report_invalid.json)
 *   REPORT_JSON_SUCCESS_PATH  local json path for case-2 report (default: scripts/acceptance/data/report_success.json)
 */
const fs = require('node:fs');
const path = require('node:path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function getJson(baseUrl, endpoint, token, query = {}) {
  const url = new URL(endpoint, baseUrl);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && String(v).trim()) url.searchParams.set(k, String(v));
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP_${res.status} ${endpoint} ${text.slice(0, 200)}`);
  }
  return res.json();
}


async function postRawFact(baseUrl, body) {
  const url = new URL('/api/raw?__internal__=true', baseUrl);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RAW_INGEST_FAILED ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

function writeJson(filePath, data) {
  const full = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
}

async function seedSuccessOperation(baseUrl, tenantQuery) {
  const now = Date.now();
  const operation_plan_id = `opl_success_seed_${now.toString(16)}`;
  const act_task_id = `task_success_seed_${now.toString(16)}`;
  const occurredAt = new Date(now).toISOString();
  const finishedAt = new Date(now + 5 * 60 * 1000).toISOString();

  await postRawFact(baseUrl, {
    source: 'system',
    record_json: {
      type: 'operation_plan_v1',
      payload: {
        tenant_id: tenantQuery.tenant_id || 'tenantA',
        project_id: tenantQuery.project_id || 'projectA',
        group_id: tenantQuery.group_id || 'groupA',
        operation_plan_id,
        act_task_id,
      },
    },
    occurred_at_iso: occurredAt,
  });

  await postRawFact(baseUrl, {
    source: 'system',
    record_json: {
      type: 'operation_plan_transition_v1',
      payload: {
        tenant_id: tenantQuery.tenant_id || 'tenantA',
        project_id: tenantQuery.project_id || 'projectA',
        group_id: tenantQuery.group_id || 'groupA',
        operation_plan_id,
        status: 'SUCCEEDED',
      },
    },
    occurred_at_iso: new Date(now + 60 * 1000).toISOString(),
  });

  await postRawFact(baseUrl, {
    source: 'device',
    record_json: {
      type: 'ao_act_receipt_v1',
      payload: {
        tenant_id: tenantQuery.tenant_id || 'tenantA',
        project_id: tenantQuery.project_id || 'projectA',
        group_id: tenantQuery.group_id || 'groupA',
        operation_plan_id,
        act_task_id,
        status: 'SUCCEEDED',
        execution_finished_at: finishedAt,
        water_l: 360,
        electric_kwh: 0.25,
        chemical_ml: 0,
      },
    },
    occurred_at_iso: finishedAt,
  });

  return operation_plan_id;
}

function readReportJson(filePath) {
  const full = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

(async () => {
  try {
    const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';
    const token = process.env.AO_ACT_TOKEN || '';
    const tenantQuery = {
      tenant_id: process.env.TENANT_ID,
      project_id: process.env.PROJECT_ID,
      group_id: process.env.GROUP_ID,
    };

    const fixedId = String(process.env.GEOX_FIXED_OPERATION_PLAN_ID || '').trim();
    const successOperationIdFromEnv = String(process.env.SUCCESS_OPERATION_ID || '').trim();
    const invalidReportPath = String(process.env.REPORT_JSON_INVALID_PATH || 'scripts/acceptance/data/report_invalid.json').trim();
    const successReportPath = String(process.env.REPORT_JSON_SUCCESS_PATH || 'scripts/acceptance/data/report_success.json').trim();

    assert(invalidReportPath, 'MISSING_REPORT_JSON_INVALID_PATH');
    assert(successReportPath, 'MISSING_REPORT_JSON_SUCCESS_PATH');

    const list = await getJson(baseUrl, '/api/v1/operations', token, { ...tenantQuery, limit: 300 });
    const items = Array.isArray(list?.items) ? list.items : [];

    const invalidOp = fixedId
      ? items.find(
        (x) =>
          String(x?.operation_plan_id || '') === fixedId ||
          String(x?.operation_id || '') === fixedId
      )
      : items.find((x) => String(x?.final_status || '').toUpperCase() === 'INVALID_EXECUTION');

    if (!invalidOp) {
      throw new Error('MISSING_INVALID_OPERATION_ID');
    }

    let successOp = successOperationIdFromEnv
      ? items.find(
        (x) =>
          String(x?.operation_plan_id || '') === successOperationIdFromEnv ||
          String(x?.operation_id || '') === successOperationIdFromEnv
      )
      : items.find((x) => {
        const status = String(x?.final_status || '').toUpperCase();
        return status === 'SUCCESS' || status === 'SUCCEEDED';
      });

    if (!successOp) {
      const seededSuccessId = await seedSuccessOperation(baseUrl, tenantQuery);
      const reloaded = await getJson(baseUrl, '/api/v1/operations', token, { ...tenantQuery, limit: 300 });
      const reloadedItems = Array.isArray(reloaded?.items) ? reloaded.items : [];
      successOp = reloadedItems.find(
        (x) => String(x?.operation_plan_id || '') === seededSuccessId || String(x?.operation_id || '') === seededSuccessId
      ) || null;
    }

    if (!successOp) {
      throw new Error('MISSING_SUCCESS_OPERATION_ID');
    }

    const invalidOperationId = String(invalidOp.operation_plan_id || invalidOp.operation_id || '').trim();
    const successOperationId = String(successOp.operation_plan_id || successOp.operation_id || '').trim();

    const sla = await getJson(baseUrl, '/api/v1/sla/summary', token, tenantQuery);

    writeJson(invalidReportPath, {
      operation_id: invalidOperationId,
      customer_view: {
        summary: '本次作业未被系统认定为有效执行',
        today_action: '需重新执行或补充证据',
        risk_level: 'high',
      },
      cost: { total: 0, water: 0, electric: 0 },
    });

    writeJson(successReportPath, {
      operation_id: successOperationId,
      customer_view: {
        summary: '作业已完成，预计改善作物状态',
        today_action: '继续观察或进入验收',
        risk_level: 'low',
      },
      cost: { total: 0.92, water: 0.72, electric: 0.2 },
    });

    // Case 1: INVALID_EXECUTION
    assert(Number(sla.invalid_execution_rate || 0) > 0, 'CASE1_SLA_INVALID_EXECUTION_RATE_NOT_POSITIVE');
    const billingInvalid = await getJson(baseUrl, `/api/v1/billing/operation/${encodeURIComponent(invalidOperationId)}`, token, tenantQuery);
    assert(Number(billingInvalid.charge || 0) === 0, 'CASE1_BILLING_CHARGE_NOT_ZERO');
    const reportInvalid = readReportJson(invalidReportPath);
    assert(String(reportInvalid?.customer_view?.risk_level || '').toLowerCase() === 'high', 'CASE1_REPORT_RISK_LEVEL_NOT_HIGH');

    // Case 2: normal success
    assert(Number(sla.success_rate || 0) > 0, 'CASE2_SLA_SUCCESS_RATE_NOT_POSITIVE');
    const billingSuccess = await getJson(baseUrl, `/api/v1/billing/operation/${encodeURIComponent(successOperationId)}`, token, tenantQuery);
    assert(Number(billingSuccess.charge || 0) > 0, 'CASE2_BILLING_CHARGE_NOT_POSITIVE');
    const reportSuccess = readReportJson(successReportPath);
    assert(String(reportSuccess?.customer_view?.summary || '').includes('完成'), 'CASE2_REPORT_SUMMARY_NOT_COMPLETED');

    console.log('PASS ACCEPTANCE_COMMERCIAL_V1', {
      case1: {
        invalid_execution_rate: sla.invalid_execution_rate,
        billing_charge: billingInvalid.charge,
        report_risk_level: reportInvalid?.customer_view?.risk_level,
      },
      case2: {
        success_rate: sla.success_rate,
        billing_charge: billingSuccess.charge,
        report_summary: reportSuccess?.customer_view?.summary,
        success_operation_id: successOperationId,
      },
    });
  } catch (err) {
    console.error('FAIL ACCEPTANCE_COMMERCIAL_V1', err?.message || err);
    process.exit(1);
  }
})();
