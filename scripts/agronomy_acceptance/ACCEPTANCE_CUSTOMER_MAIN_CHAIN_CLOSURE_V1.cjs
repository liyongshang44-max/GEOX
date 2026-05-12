const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.TOKEN || process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const TENANT_ID = process.env.TENANT_ID || 'tenantA';
const PROJECT_ID = process.env.PROJECT_ID || 'projectA';
const GROUP_ID = process.env.GROUP_ID || 'groupA';
const FIELD_ID = process.env.FIELD_ID || 'ft_field_20260511134058';
const OPERATION_ID = process.env.OPERATION_ID || 'ft_op_ft_ui_2_skills';
const SEASON_ID = process.env.SEASON_ID || 'season_demo';
const DEVICE_ID = process.env.DEVICE_ID || 'dev_onboard_accept_001';

async function req(method, pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}
const get = (p) => req('GET', p);
const post = (p, b) => req('POST', p, b);
function fieldReportOf(p) { return p?.field_report_v1 || p || {}; }
function operationReportOf(p) { return p?.operation_report_v1 || p || {}; }
function arr(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { if (v == null) return false; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }
function hasOp(items) { return arr(items).some((x) => String(x.operation_id || x.id || x.operation_plan_id || '').trim() === OPERATION_ID); }
function hasField(items) { return arr(items).some((x) => String(x.field_id || x.id || '').trim() === FIELD_ID); }
function actionOf(rec) { return String(rec?.action_type || rec?.suggested_action?.action_type || rec?.recommendation_type || '').toUpperCase(); }
function cropSpecific(rec) { const a = actionOf(rec); return a.includes('IRRIG') || a.includes('FERT') || a.includes('SPRAY') || a.includes('CROP.HEALTH') || Boolean(rec?.crop_code) || Boolean(rec?.crop_stage); }
function recommendationTriggerBlocked(resp) {
  const error = String(resp?.json?.error || resp?.json?.error_code || '').toUpperCase();
  return resp?.status === 400 && (error === 'FORMAL_STAGE1_TRIGGER_NOT_ELIGIBLE' || error === 'NO_RECOMMENDATION_TRIGGERED');
}

(async () => {
  const session = await get('/api/v1/session/me');
  const fields = await get('/api/v1/customer/fields');
  const ops = await get('/api/v1/customer/operations');
  const fieldResp = await get(`/api/v1/reports/field/${encodeURIComponent(FIELD_ID)}`);
  const opResp = await get(`/api/v1/reports/operation/${encodeURIComponent(OPERATION_ID)}`);
  const recResp = await post('/api/v1/recommendations/generate', {
    tenant_id: TENANT_ID,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    device_id: DEVICE_ID,
    crop_code: 'corn',
    image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
  });

  const fieldReport = fieldReportOf(fieldResp.json);
  const operationReport = operationReportOf(opResp.json);
  const cropContext = fieldReport.crop_context || recResp.json?.crop_context || {};
  const currentRecommendation = fieldReport.current_recommendation ?? null;
  const recommendations = arr(recResp.json?.recommendations);
  const cropContextUnconfirmed = ['UNKNOWN', 'PRE_PLANT', 'FALLOW', 'PLANTED_UNCONFIRMED'].includes(String(cropContext.status || '').toUpperCase());
  const noRecommendationGenerated = recommendationTriggerBlocked(recResp);

  const fieldsItems = fields.json?.items || fields.json?.fields || fields.json?.data?.items || [];
  const opsItems = ops.json?.items || ops.json?.operations || ops.json?.data?.items || [];
  const statusChain = arr(operationReport.status_chain);

  const checks = {
    session_me_scope_correct: session.ok && nonEmpty(session.json?.role || session.json?.user?.role || session.json?.session?.role),
    customer_fields_contains_field: fields.ok && hasField(fieldsItems),
    customer_operations_contains_operation: ops.ok && hasOp(opsItems),
    field_report_has_geometry: fieldResp.ok && nonEmpty(fieldReport.field?.geometry) && nonEmpty(fieldReport.field?.geometry_id),
    field_report_has_crop_context: nonEmpty(fieldReport.crop_context),
    field_report_has_recent_operation: String(fieldReport.recent_operation?.operation_id || '') === OPERATION_ID,
    field_report_no_accepted_operation_as_current_recommendation: currentRecommendation === null || String(currentRecommendation.recommendation_id || '') !== String(operationReport.recommendation?.recommendation_id || ''),
    operation_report_has_recommendation: opResp.ok && nonEmpty(operationReport.recommendation),
    operation_report_has_prescription: nonEmpty(operationReport.prescription),
    operation_report_has_approval: nonEmpty(operationReport.approval),
    operation_report_has_execution: nonEmpty(operationReport.execution) && nonEmpty(operationReport.execution.act_task_id),
    operation_report_has_evidence: nonEmpty(operationReport.evidence),
    operation_report_has_acceptance: nonEmpty(operationReport.acceptance),
    operation_report_has_value_hypothesis: nonEmpty(operationReport.recommendation?.value_hypothesis),
    operation_report_has_value_projection: nonEmpty(operationReport.prescription?.value_projection),
    operation_report_has_roi_status: nonEmpty(operationReport.roi?.status),
    operation_report_status_chain_complete: statusChain.length >= 8 && statusChain.every((x) => nonEmpty(x.key) && nonEmpty(x.status)),
    old_opl_not_polluting_current_run: !String(operationReport.operation_id || operationReport.identifiers?.operation_id || '').startsWith('opl_'),
    crop_context_guard_blocks_unconfirmed_crop_specific_prescription: cropContextUnconfirmed ? (noRecommendationGenerated || (recResp.ok && !recommendations.some(cropSpecific))) : true,
  };

  const output = {
    ok: Object.values(checks).every(Boolean),
    suite: 'ACCEPTANCE_CUSTOMER_MAIN_CHAIN_CLOSURE_V1',
    field_id: FIELD_ID,
    operation_id: OPERATION_ID,
    recommendation_request_status: recResp.status,
    recommendation_error: recResp.ok ? null : recResp.json,
    recommendation_blocked_before_generation: noRecommendationGenerated,
    checks,
    summary: {
      role: session.json?.role || session.json?.user?.role || session.json?.session?.role || null,
      field_geometry_id: fieldReport.field?.geometry_id || null,
      crop_context_status: cropContext.status || null,
      recent_operation: fieldReport.recent_operation || null,
      current_recommendation: currentRecommendation,
      operation_chain_integrity: operationReport.chain_integrity || null,
      operation_roi_status: operationReport.roi?.status || null,
      status_chain_count: statusChain.length,
      crop_context_guard: recResp.json?.crop_context_guard || null,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => { console.error(err); process.exit(1); });
