#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk, waitForHealth } = require('./_common.cjs');

const id = (p) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 18)}`;
const q = (v) => encodeURIComponent(String(v ?? ''));
const tokenEnv = (name, fallback) => env(name, env('AO_ACT_TOKEN', fallback));

async function post(base, path, token, body) {
  return fetchJson(`${base}${path}`, { method: 'POST', token, body });
}
async function get(base, path, token) {
  return fetchJson(`${base}${path}`, { method: 'GET', token });
}

async function insertOperationPlanFact(pool, scope, operation_plan_id, field_id, inspection_id) {
  const now = Date.now();
  const record = { type: 'operation_plan_v1', schema_version: '1', payload: { ...scope, operation_plan_id, field_id, action_type: 'PEST_DISEASE_INSPECTION', scenario_type: 'FORMAL_PEST_DISEASE_INSPECTION', pest_disease_inspection_id: inspection_id, inspection_id, status: 'CREATED', created_at_ts: now } };
  await pool.query(
    `INSERT INTO facts(fact_id, occurred_at, source, record_json)
     VALUES($1,$2,'pest_disease_report_acceptance',$3::jsonb)
     ON CONFLICT(fact_id) DO NOTHING`,
    [`op_plan_${operation_plan_id}`, new Date(now).toISOString(), JSON.stringify(record)],
  );
}

function assertStaticContracts(root) {
  const reportV1 = fs.readFileSync(path.join(root, 'apps/server/src/projections/report_v1.ts'), 'utf8');
  const reportsRoute = fs.readFileSync(path.join(root, 'apps/server/src/routes/reports_v1.ts'), 'utf8');
  const projection = fs.readFileSync(path.join(root, 'apps/server/src/services/inspection/pest_disease_inspection_projection_v1.ts'), 'utf8');
  const exportBlocks = fs.readFileSync(path.join(root, 'apps/web/src/components/customer/CustomerExportBlocks.tsx'), 'utf8');
  assert.equal(reportV1.includes('OperationReportPestDiseaseInspectionV1'), true);
  assert.equal(reportV1.includes('pest_disease_inspection?: OperationReportPestDiseaseInspectionV1'), true);
  assert.equal(reportV1.includes('"FORMAL_PEST_DISEASE_INSPECTION"'), true);
  assert.equal(projection.includes('observation_evidence'), true);
  assert.equal(projection.includes('media_refs'), true);
  assert.equal(projection.includes('captured_at_ts'), true);
  assert.equal(projection.includes('geo_point'), true);
  assert.equal(projection.includes('device_profile'), true);
  assert.equal(projection.includes('scout_note'), true);
  assert.equal(projection.includes('incidence_percent'), true);
  assert.equal(projection.includes('severity_percent'), true);
  assert.equal(projection.includes('affected_area_percent'), true);
  assert.equal(reportsRoute.includes('buildPestDiseaseInspectionReportProjectionV1'), true);
  assert.equal(reportsRoute.includes('mergePestDiseaseInspectionIntoReport'), true);
  assert.equal(reportsRoute.includes('scenario_type: "FORMAL_PEST_DISEASE_INSPECTION"'), true);
  assert.equal(exportBlocks.includes('operation_report_v1.pest_disease_inspection.observation_evidence'), true);
  assert.equal(exportBlocks.includes('pdiEvidenceBasisRows'), true);
  const pestMergeStart = reportsRoute.indexOf('function mergePestDiseaseInspectionIntoReport');
  const projectReportStart = reportsRoute.indexOf('export async function projectReportV1');
  const pestBlock = pestMergeStart >= 0 && projectReportStart > pestMergeStart ? reportsRoute.slice(pestMergeStart, projectReportStart) : '';
  assert.equal(pestBlock.includes('as any'), false, 'pest/disease report merge must not use as any');
}

async function run() {
  const root = path.resolve(__dirname, '..', '..');
  assertStaticContracts(root);

  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const adminToken = tokenEnv('ADMIN_TOKEN', 'admin_token');
  const operatorToken = tokenEnv('OPERATOR_TOKEN', 'operator_token');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox') });
  const scope = { tenant_id: env('TENANT_ID', 'tenantA'), project_id: env('PROJECT_ID', 'projectA'), group_id: env('GROUP_ID', 'groupA') };
  const runId = id('pdi_report');
  const field_id = `field_${runId}`;
  const inspection_id = `inspection_${runId}`;
  const operation_plan_id = `op_${runId}`;
  const captured_at_ts = Date.now();
  const media_ref_id = `img_${runId}`;

  try {
    await waitForHealth(base);
    await insertOperationPlanFact(pool, scope, operation_plan_id, field_id, inspection_id);

    await requireOk(await post(base, '/api/v1/inspection/pest-disease/request', adminToken, { ...scope, inspection_id, field_id, trigger_source: 'MANUAL_SCOUT', requested_target: 'PEST', priority: 'HIGH', evidence_refs: [], reasons: ['report_projection_gate'] }), 'inspection request');

    const observation = await requireOk(await post(base, '/api/v1/inspection/pest-disease/observation', adminToken, {
      ...scope,
      observation_id: `obs_${runId}`,
      inspection_id,
      field_id,
      captured_at_ts,
      geo_point: { lat: 35.1, lng: -120.2 },
      device_profile: { device_id: `device_${runId}`, device_model: 'PHONE_CAMERA', device_type: 'PHONE', capabilities: ['rgb_photo'] },
      media_refs: [{ kind: 'IMAGE', ref_id: media_ref_id }],
      scout_note: 'Report projection gate formal scout note.',
      plant_part: 'LEAF',
      target_type: 'PEST',
      suspected_issue_code: 'aphid_suspected',
      pest_count: 8,
      incidence_percent: 12,
      severity_percent: 18,
      affected_area_percent: 7,
      evidence_quality: 'COMPLETE',
      evidence_refs: [],
    }), 'inspection observation');

    const assessment = await requireOk(await post(base, '/api/v1/inspection/pest-disease/assessment', adminToken, { ...scope, assessment_id: `assessment_${runId}`, inspection_id, field_id, target_type: 'PEST', suspected_issue_code: 'aphid_suspected', assessment_status: 'CONFIRMED', severity: 'MEDIUM', confidence: 'HIGH', evidence_tier: 'FORMAL', review_required: true, customer_visible_eligible: true, observation_refs: [observation.observation_id], skill_signal_refs: [], evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }], reasons: ['formal_observation_complete'] }), 'inspection assessment');

    const review = await requireOk(await post(base, '/api/v1/inspection/pest-disease/review', adminToken, { ...scope, review_id: `review_${runId}`, inspection_id, assessment_id: assessment.assessment_id, field_id, review_status: 'APPROVED', reviewer_actor_id: 'report_projection_gate', reviewed_at_ts: Date.now(), review_note: 'Approved for report projection gate.', evidence_refs: [{ kind: 'fact_id', ref_id: assessment.fact_id }] }), 'inspection review');

    const acceptance = await requireOk(await post(base, '/api/v1/inspection/pest-disease/acceptance/evaluate', operatorToken, { assessment_id: assessment.assessment_id, evidence_refs: [{ kind: 'fact_id', ref_id: observation.fact_id }, { kind: 'fact_id', ref_id: review.fact_id }], reasons: ['formal_inspection_evidence_chain_complete'] }), 'inspection acceptance');
    assert.equal(acceptance.record.verdict, 'PASS');

    const reportResp = await get(base, `/api/v1/reports/operation/${q(operation_plan_id)}?tenant_id=${q(scope.tenant_id)}&project_id=${q(scope.project_id)}&group_id=${q(scope.group_id)}`, adminToken);
    assert.equal(reportResp.ok, true, `operation report status=${reportResp.status} body=${reportResp.text}`);
    const report = reportResp.json?.operation_report_v1;
    const pdi = report?.pest_disease_inspection;
    const obs = pdi?.observation_evidence?.latest_observation;
    assert.equal(report?.formal_scenario?.scenario_type, 'FORMAL_PEST_DISEASE_INSPECTION');
    assert.equal(pdi?.inspection_id, inspection_id);
    assert.equal(pdi?.assessment_id, assessment.assessment_id);
    assert.equal(pdi?.assessment_status, 'CONFIRMED');
    assert.equal(pdi?.customer_visible_eligible, true);
    assert.equal(pdi?.observation_evidence?.total_observations >= 1, true);
    assert.equal(Array.isArray(pdi?.observation_evidence?.items), true);
    assert.equal(obs?.media_refs?.[0]?.ref_id, media_ref_id);
    assert.equal(obs?.captured_at_ts, captured_at_ts);
    assert.equal(obs?.captured_at_text, new Date(captured_at_ts).toISOString());
    assert.equal(obs?.geo_point?.lat, 35.1);
    assert.equal(obs?.geo_point?.lng, -120.2);
    assert.equal(obs?.device_profile?.device_model, 'PHONE_CAMERA');
    assert.equal(obs?.scout_note, 'Report projection gate formal scout note.');
    assert.equal(obs?.pest_count, 8);
    assert.equal(obs?.incidence_percent, 12);
    assert.equal(obs?.severity_percent, 18);
    assert.equal(obs?.affected_area_percent, 7);
    assert.equal(obs?.evidence_quality, 'COMPLETE');

    const reportText = JSON.stringify(report);
    for (const blocked of ['已喷药', '已防治', '防治完成', '喷药完成', '病虫害已解决']) {
      assert.equal(reportText.includes(blocked), false, `operation report must not claim treatment completion: ${blocked}`);
    }

    console.log('PASS acceptance pest disease inspection report projection v1', { operation_plan_id, inspection_id, assessment_id: assessment.assessment_id, inspection_acceptance_id: acceptance.inspection_acceptance_id });
  } finally {
    await pool.end().catch(() => undefined);
  }
}

run().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
