const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const FIELD_ID = process.env.FIELD_ID || 'ft_field_20260511134058';
const SEASON_ID = process.env.SEASON_ID || 'season_demo';
const DEVICE_ID = process.env.DEVICE_ID || 'dev_onboard_accept_001';

async function request(method, pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

function reportOf(payload) { return payload?.field_report_v1 || payload || {}; }
function arr(v) { return Array.isArray(v) ? v : []; }
function nonEmpty(v) { if (v == null) return false; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }
function actionOf(rec) { return String(rec?.action_type || rec?.suggested_action?.action_type || rec?.recommendation_type || '').toUpperCase(); }
function cropSpecific(rec) { const a = actionOf(rec); return a.includes('IRRIG') || a.includes('FERT') || a.includes('SPRAY') || a.includes('CROP.HEALTH') || Boolean(rec?.crop_code) || Boolean(rec?.crop_stage); }

(async () => {
  const fieldResp = await request('GET', `/api/v1/reports/field/${encodeURIComponent(FIELD_ID)}`);
  const fieldReport = reportOf(fieldResp.json);
  const cropContext = fieldReport.crop_context || {};
  const observability = fieldReport.field_observability_profile || {};
  const candidates = arr(fieldReport.crop_plan_candidates);
  const allowPrescription = Boolean(cropContext.allowed_actions?.allow_crop_specific_prescription);

  const recommendationResp = await request('POST', '/api/v1/recommendations/generate', {
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    device_id: DEVICE_ID,
    crop_code: 'corn',
    image_recognition: { stress_score: 0.55, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
  });
  const recommendations = arr(recommendationResp.json?.recommendations);
  const hasCropSpecificRecommendation = recommendations.some(cropSpecific);

  const checks = {
    field_report_ok: fieldResp.ok,
    crop_context_present: nonEmpty(cropContext),
    crop_context_has_status: nonEmpty(cropContext.status),
    observability_profile_present: nonEmpty(observability),
    allowed_actions_present: nonEmpty(cropContext.allowed_actions),
    recommendation_api_ok: recommendationResp.ok,
    decision_response_has_crop_context: nonEmpty(recommendationResp.json?.crop_context),
    decision_response_has_observability: nonEmpty(recommendationResp.json?.field_observability_profile),
  };

  const unknownOrPrePlant = ['UNKNOWN', 'PRE_PLANT', 'FALLOW'].includes(String(cropContext.status || '').toUpperCase());
  const unconfirmed = String(cropContext.status || '').toUpperCase() === 'PLANTED_UNCONFIRMED';
  const confirmedCorn = String(cropContext.status || '').toUpperCase() === 'PLANTED_CONFIRMED' && String(cropContext.crop_code || '').toLowerCase() === 'corn';

  const semanticChecks = unknownOrPrePlant ? {
    crop_specific_recommendations_blocked: !hasCropSpecificRecommendation,
    crop_plan_candidates_returned: candidates.length > 0 || arr(recommendationResp.json?.crop_plan_candidates).length > 0,
    crop_specific_prescription_not_allowed: allowPrescription === false,
  } : unconfirmed ? {
    crop_specific_prescription_not_allowed: allowPrescription === false,
    diagnosis_guard_visible: recommendationResp.json?.crop_context?.allowed_actions?.allow_crop_specific_prescription === false,
  } : confirmedCorn ? {
    planted_confirmed_corn: true,
    crop_stage_present: nonEmpty(cropContext.crop_stage),
    crop_specific_prescription_allowed: allowPrescription === true,
  } : { status_recognized: nonEmpty(cropContext.status) };

  const migrationPath = path.join(process.cwd(), 'apps/server/db/migrations/20260512_field_crop_context_v1.sql');
  const migrationText = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
  const staticChecks = {
    migration_has_crop_context_table: /CREATE TABLE IF NOT EXISTS crop_context_v1/i.test(migrationText),
    migration_has_crop_plan_candidate_table: /CREATE TABLE IF NOT EXISTS crop_plan_candidate_v1/i.test(migrationText),
    migration_has_season_result_table: /CREATE TABLE IF NOT EXISTS season_result_v1/i.test(migrationText),
  };

  const output = {
    ok: Object.values(checks).every(Boolean) && Object.values(semanticChecks).every(Boolean) && Object.values(staticChecks).every(Boolean),
    suite: 'ACCEPTANCE_FIELD_CROP_CONTEXT_V1',
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    checks,
    semantic_checks: semanticChecks,
    static_checks: staticChecks,
    summary: {
      crop_context: cropContext,
      observability_status: observability.status || null,
      crop_plan_candidate_count: candidates.length,
      recommendation_count_after_guard: recommendations.length,
      guard: recommendationResp.json?.crop_context_guard || null,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => { console.error(err); process.exit(1); });
