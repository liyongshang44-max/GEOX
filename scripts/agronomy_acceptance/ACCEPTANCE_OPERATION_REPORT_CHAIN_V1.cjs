const { Pool } = require('pg');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const OPERATION_ID = process.env.OPERATION_ID || 'ft_op_ft_ui_2_skills';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/geox';

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

function reportOf(response) {
  return response?.operation_report_v1 || response || {};
}

function isPass(value) {
  return String(value || '').toUpperCase() === 'PASS';
}

function hasChainItem(report, key) {
  return Array.isArray(report.status_chain) && report.status_chain.some((item) => String(item?.key || '') === key);
}

async function findLegacyOperationId() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const q = await pool.query(`
      SELECT COALESCE(
        record_json::jsonb#>>'{payload,operation_id}',
        record_json::jsonb#>>'{payload,operation_plan_id}'
      ) AS operation_id
      FROM facts
      WHERE record_json::jsonb->>'type' = 'operation_plan_v1'
        AND (
          record_json::jsonb#>>'{payload,operation_id}' LIKE 'opl_%'
          OR record_json::jsonb#>>'{payload,operation_plan_id}' LIKE 'opl_%'
        )
      ORDER BY occurred_at DESC
      LIMIT 1
    `);
    return String(q.rows?.[0]?.operation_id || '').trim() || null;
  } catch {
    return null;
  } finally {
    await pool.end().catch(() => {});
  }
}

(async () => {
  const mainResp = await getJson(`/api/v1/reports/operation/${encodeURIComponent(OPERATION_ID)}`);
  const main = reportOf(mainResp.json);

  const mainChecks = {
    api_ok: mainResp.ok,
    recommendation_present: main.recommendation != null,
    prescription_present: main.prescription != null,
    approval_present: main.approval != null,
    execution_act_task_present: Boolean(main.execution?.act_task_id),
    execution_executor_device: String(main.execution?.executor?.kind || '').toLowerCase() === 'device',
    evidence_complete: String(main.evidence?.evidence_status || '').toUpperCase() === 'COMPLETE',
    acceptance_pass: isPass(main.acceptance?.verdict),
    status_chain_present: Array.isArray(main.status_chain) && main.status_chain.length >= 8,
    status_chain_has_required_links: ['diagnosis','recommendation','prescription','approval','operation_plan','execution','receipt','evidence','acceptance','roi','field_memory'].every((key) => hasChainItem(main, key)),
  };

  const legacyOperationId = process.env.LEGACY_OPERATION_ID || await findLegacyOperationId();
  let legacy = { skipped: true, operation_id: legacyOperationId || null, checks: {} };
  if (legacyOperationId) {
    const legacyResp = await getJson(`/api/v1/reports/operation/${encodeURIComponent(legacyOperationId)}`);
    const legacyReport = reportOf(legacyResp.json);
    const incomplete = Array.isArray(legacyReport.missing_links) && legacyReport.missing_links.length > 0;
    legacy = {
      skipped: false,
      operation_id: legacyOperationId,
      checks: {
        api_ok: legacyResp.ok,
        incomplete_has_legacy_integrity: !incomplete || legacyReport.chain_integrity === 'LEGACY_OR_MANUAL',
        missing_links_array: Array.isArray(legacyReport.missing_links),
        status_chain_present: Array.isArray(legacyReport.status_chain) && legacyReport.status_chain.length > 0,
      },
      chain_integrity: legacyReport.chain_integrity || null,
      missing_links: legacyReport.missing_links || [],
    };
  }

  const allMainPass = Object.values(mainChecks).every(Boolean);
  const allLegacyPass = legacy.skipped || Object.values(legacy.checks).every(Boolean);
  const output = {
    ok: allMainPass && allLegacyPass,
    suite: 'ACCEPTANCE_OPERATION_REPORT_CHAIN_V1',
    operation_id: OPERATION_ID,
    checks: mainChecks,
    summary: {
      chain_integrity: main.chain_integrity || null,
      missing_links: main.missing_links || [],
      recommendation_id: main.recommendation?.recommendation_id || null,
      prescription_id: main.prescription?.prescription_id || null,
      approval_request_id: main.approval?.approval_request_id || null,
      act_task_id: main.execution?.act_task_id || null,
      receipt_id: main.execution?.receipt_id || null,
      acceptance_id: main.acceptance?.acceptance_id || null,
    },
    legacy,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
