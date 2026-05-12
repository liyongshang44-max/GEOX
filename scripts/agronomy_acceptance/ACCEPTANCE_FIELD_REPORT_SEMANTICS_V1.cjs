const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const FIELD_ID = process.env.FIELD_ID || 'ft_field_20260511134058';
const EXPECTED_OPERATION_ID = process.env.EXPECTED_OPERATION_ID || 'ft_op_ft_ui_2_skills';

async function getJson(pathname) {
  const res = await fetch(`${BASE_URL}${pathname}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

function reportOf(payload) {
  return payload?.field_report_v1 || payload || {};
}

function nonEmpty(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizeId(value) {
  return String(value || '').trim();
}

(async () => {
  const resp = await getJson(`/api/v1/reports/field/${encodeURIComponent(FIELD_ID)}`);
  const report = reportOf(resp.json);
  const field = report.field || {};
  const recent = report.recent_operation || null;
  const current = report.current_recommendation ?? null;
  const diagnosis = report.diagnosis_basis || null;
  const crop = report.crop_context || null;

  const pagePath = path.join(process.cwd(), 'apps/web/src/views/FieldReportPage.tsx');
  const vmPath = path.join(process.cwd(), 'apps/web/src/viewmodels/fieldReportVm.ts');
  const pageSource = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
  const vmSource = fs.existsSync(vmPath) ? fs.readFileSync(vmPath, 'utf8') : '';
  const recentAccepted = /已验收/.test(String(recent?.summary || '')) || String(recent?.acceptance_status || '').toUpperCase() === 'PASS';

  const checks = {
    api_ok: resp.ok,
    field_id_matches: normalizeId(field.field_id) === FIELD_ID,
    field_geometry_present: nonEmpty(field.geometry),
    field_geometry_id_present: nonEmpty(field.geometry_id),
    diagnosis_basis_present: nonEmpty(diagnosis),
    crop_context_present: nonEmpty(crop),
    recent_operation_present: nonEmpty(recent),
    recent_operation_expected: normalizeId(recent?.operation_id) === EXPECTED_OPERATION_ID,
    frontend_has_recent_operation_copy: pageSource.includes('最近作业'),
    frontend_no_recent_as_current_link: !pageSource.includes('suggestionOperation'),
    frontend_no_default_irrigate_advice: !vmSource.includes('report.next_action?.action_type || "IRRIGATE"') && !vmSource.includes("report.next_action?.action_type || 'IRRIGATE'"),
  };

  const acceptedClosureChecks = recentAccepted ? {
    current_recommendation_null_when_completed: current === null,
    recent_operation_summary_irrigation_accepted: /灌溉/.test(String(recent?.summary || '')) && /已验收/.test(String(recent?.summary || '')),
  } : { skipped: true };

  const output = {
    ok: Object.values(checks).every(Boolean) && (acceptedClosureChecks.skipped || Object.values(acceptedClosureChecks).every(Boolean)),
    suite: 'ACCEPTANCE_FIELD_REPORT_SEMANTICS_V1',
    field_id: FIELD_ID,
    expected_operation_id: EXPECTED_OPERATION_ID,
    checks,
    accepted_closure_checks: acceptedClosureChecks,
    summary: {
      geometry_id: field.geometry_id || null,
      area_m2: field.area_m2 ?? null,
      area_mu: field.area_mu ?? null,
      current_recommendation: current,
      recent_operation: recent,
      diagnosis_status: diagnosis?.status || null,
      crop_status: crop?.status || null,
    },
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
