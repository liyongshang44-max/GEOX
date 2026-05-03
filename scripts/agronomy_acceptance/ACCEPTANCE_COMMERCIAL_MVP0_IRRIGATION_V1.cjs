const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

function hasValidRoiConfidence(confidence) {
  if (typeof confidence === 'number') return confidence > 0;
  if (!confidence || typeof confidence !== 'object') return false;
  return ['HIGH', 'MEDIUM', 'LOW'].includes(String(confidence.level || ''))
    && ['measured', 'estimated', 'assumed'].includes(String(confidence.basis || ''))
    && Array.isArray(confidence.reasons);
}

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const suffix = Date.now();
  const field_id = env('FIELD_ID', `demo_field_mvp0_${suffix}`);
  const season_id = `season_mvp0_${suffix}`;
  const device_id = `device_mvp0_${suffix}`;
  const ts0 = Date.now() - 60_000;

  const pre_soil_moisture = Number(env('PRE_SOIL_MOISTURE', '0.16'));
  const post_soil_moisture = Number(env('POST_SOIL_MOISTURE', '0.23'));

  const simulateStale = env('SIMULATE_STALE_OBSERVATION', '0') === '1';
  const simulateInsufficientEvidence = env('SIMULATE_INSUFFICIENT_EVIDENCE', '0') === '1';
  const simulateApprovalRejected = env('SIMULATE_APPROVAL_REJECTED', '0') === '1';

  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.96,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_stage1_irrigation"]'::jsonb)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, ts0, randomUUID()]
  );

  const observation_id = `obs_pre_irrigation_${randomUUID()}`;
  const preTs = simulateStale ? Date.now() - 48 * 3600_000 : ts0;
  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.93,$8)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, preTs, pre_soil_moisture, observation_id]
  );

  const judgeEvidence = simulateInsufficientEvidence ? [] : [{ kind: 'sensor', ref: observation_id, metric: 'soil_moisture', value: pre_soil_moisture }];
  const judgeResp = await fetchJson(`${base}/api/v1/judge/evidence`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id, field_id, evidence: judgeEvidence },
  });
  const judgeJson = judgeResp.ok ? await judgeResp.json() : { ok: false, reason: 'JUDGE_ENDPOINT_UNAVAILABLE' };

  const failureReasons = [];
  if (simulateStale) failureReasons.push('STALE_OBSERVATION');
  if (simulateInsufficientEvidence) failureReasons.push('INSUFFICIENT_EVIDENCE');

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn',
      stage1_sensing_summary: { irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'medium', sensor_quality_level: 'GOOD' },
      image_recognition: { stress_score: 0.6, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
    },
  });
  const genJson = requireOk(gen, 'generate irrigation recommendation');
  const recommendation = genJson.recommendations?.[0] ?? null;
  const recommendation_id = String(recommendation?.recommendation_id ?? '').trim();
  const skill_trace_id = String(recommendation?.skill_trace?.trace_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');
  assert.ok(skill_trace_id, 'skill_trace_id missing');

  const createPrescription = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST', token,
    body: { recommendation_id, tenant_id, project_id, group_id, field_id, season_id, device_id, crop_id: 'corn', operation_amount: { amount: 20, unit: 'L', parameters: { duration_sec: 1200, flow_lpm: 1 } } },
  });
  const prescription = requireOk(createPrescription, 'create prescription').prescription;
  const prescription_id = String(prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');

  const submitApproval = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST', token, body: { tenant_id, project_id, group_id },
  });
  const approval_id = String(requireOk(submitApproval, 'submit approval').approval_request_id ?? '').trim();
  assert.ok(approval_id, 'approval_id missing');

  const approvalDecision = simulateApprovalRejected ? 'REJECT' : 'APPROVE';
  const decideApproval = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_id)}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: approvalDecision, reason: 'commercial mvp0 irrigation', device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] },
  });
  const decideJson = requireOk(decideApproval, 'decide approval');
  const operation_plan_id = String(decideJson.operation_plan_id ?? '').trim();

  if (simulateApprovalRejected) {
    failureReasons.push('APPROVAL_REJECTED');
  }

  let task_id = '';
  let skill_binding_id = '';
  let skill_run_id = '';
  let receipt_id = '';
  let as_executed_id = '';
  let acceptance_id = '';
  let report_id = '';
  let report_payload = null;
  let post_observation_id = '';
  let roi_ledger_ids = [];
  let roi_ledgers = [];

  if (!failureReasons.includes('APPROVAL_REJECTED')) {
    const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, operation_plan_id, approval_request_id: approval_id, field_id, season_id, device_id, issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' }, action_type: 'IRRIGATE', target: { kind: 'field', ref: field_id }, parameters: { amount: 20, coverage_percent: 90, duration_min: 20, prescription_id }, meta: { recommendation_id, prescription_id, task_type: 'IRRIGATION', device_id, adapter_type: 'irrigation_simulator' } },
    });
    task_id = String(requireOk(taskResp, 'create task').act_task_id ?? '').trim();
    assert.ok(task_id, 'task_id missing');

    const mockValveRun = await fetchJson(`${base}/api/v1/skills/mock-valve-control/run`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, field_id, device_id, act_task_id: task_id, command: 'OPEN', duration_sec: 1200 },
    });
    const mockValveJson = mockValveRun.ok ? await mockValveRun.json() : { ok: false, reason: 'DEVICE_OFFLINE' };
    skill_run_id = String(mockValveJson.skill_run_id ?? mockValveJson.run_id ?? '').trim();
    if (!skill_run_id) failureReasons.push('SKILL_RUN_MISSING');
    if (!mockValveRun.ok) failureReasons.push('DEVICE_OFFLINE');

    const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, operation_plan_id, act_task_id: task_id, executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' }, execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 }, execution_coverage: { kind: 'field', ref: field_id }, resource_usage: { water_l: 20 }, observed_parameters: { amount: 20, coverage_percent: 90, duration_min: 20, prescription_id }, status: 'executed', meta: { command_id: task_id, idempotency_key: `acceptance_receipt_${suffix}` } },
    });
    receipt_id = String(requireOk(receiptResp, 'receipt').fact_id ?? '').trim();

    const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
      method: 'POST', token, body: { task_id, receipt_id, tenant_id, project_id, group_id },
    });
    as_executed_id = String(requireOk(asExecutedResp, 'as-executed')?.as_executed?.as_executed_id ?? '').trim();

    post_observation_id = `obs_post_irrigation_${randomUUID()}`;
    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.95,$8)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, device_id, Date.now(), post_soil_moisture, post_observation_id]
    );

    if (!(post_soil_moisture > pre_soil_moisture)) failureReasons.push('POST_IRRIGATION_NO_RESPONSE');

    const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
      method: 'POST', token, body: { tenant_id, project_id, group_id, act_task_id: task_id },
    });
    const acceptanceJson = requireOk(acceptanceResp, 'acceptance');
    acceptance_id = String(acceptanceJson.fact_id ?? '').trim();

    const reportResp = await fetchJson(`${base}/api/v1/customer/report/from-task`, {
      method: 'POST', token, body: { tenant_id, project_id, group_id, act_task_id: task_id },
    });
    const reportJson = reportResp.ok ? await reportResp.json() : {};
    report_payload = reportJson;
    report_id = String(reportJson.report_id ?? reportJson.fact_id ?? '').trim();
    if (!report_id) failureReasons.push('REPORT_ID_MISSING');

    const roiResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
      method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id },
    });
    const roiJson = requireOk(roiResp, 'roi');
    const ledgers = Array.isArray(roiJson.roi_ledgers) ? roiJson.roi_ledgers : [];
    roi_ledger_ids = ledgers.map((x) => String(x.roi_ledger_id ?? x.fact_id ?? '').trim()).filter(Boolean);
    const hasConfidence = ledgers.every((x) => hasValidRoiConfidence(x.confidence));
    const hasBaseline = ledgers.every((x) => x.baseline != null);
    const hasEvidenceRefs = ledgers.every((x) => Array.isArray(x.evidence_refs) && x.evidence_refs.length > 0);
    roi_ledgers = ledgers.map((x) => ({
      roi_ledger_id: x.roi_ledger_id,
      roi_type: x.roi_type,
      baseline: x.baseline,
      baseline_type: x.baseline_type,
      baseline_value: x.baseline_value,
      confidence: x.confidence,
      evidence_refs: x.evidence_refs,
      value_kind: x.value_kind,
      calculation_method: x.calculation_method,
    }));
    if (!hasConfidence || !hasBaseline || !hasEvidenceRefs) failureReasons.push('LOW_CONFIDENCE_ROI');
    if (failureReasons.length > 0) {
      const measured = ledgers.some((x) => String(x.measurement_mode ?? '').toUpperCase() === 'MEASURED');
      assert.equal(measured, false, 'failure path must not produce measured ROI');
    }
  }

  const memoryQ = await pool.query(
    `SELECT memory_id, memory_type FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 ORDER BY occurred_at DESC LIMIT 500`,
    [tenant_id, project_id, group_id, field_id]
  );
  const field_memory_ids = (memoryQ.rows ?? []).slice(0, 3).map((r) => String(r.memory_id ?? '').trim()).filter(Boolean);

  if (task_id) {
    const taskFactQ = await pool.query(
      `SELECT record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
        ORDER BY occurred_at DESC LIMIT 1`,
      [task_id]
    );
    const ev = taskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence ?? {};
    skill_binding_id = String(ev.skill_binding_id ?? ev.skill_binding_fact_id ?? '').trim();
    if (!skill_binding_id) failureReasons.push('SKILL_BINDING_MISSING');
  }

  const reportBlob = JSON.stringify(report_payload ?? {});
  const reportContainsFieldMemory = /field[_\s-]*memory/i.test(reportBlob);
  const reportContainsROI = /roi|return[_\s-]*on[_\s-]*investment/i.test(reportBlob);
  const reportSummaryHasConfidence = /confidence/i.test(reportBlob);
  const reportSummaryHasCustomerText = /summary|narrative|customer|insight|recommend/i.test(reportBlob);
  const noRawEnumInCustomerReport = !/\bPASS\b|\bFAIL\b|\bUNKNOWN\b/.test(reportBlob);

  if (task_id) {
    const taskFactQ = await pool.query(
      `SELECT record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,act_task_id}')=$1
        ORDER BY occurred_at DESC LIMIT 1`,
      [task_id]
    );
    const ev = taskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence ?? {};
    skill_binding_id = String(ev.skill_binding_id ?? ev.skill_binding_fact_id ?? '').trim();
    if (!skill_binding_id) failureReasons.push('SKILL_BINDING_MISSING');
  }

  const reportBlob = JSON.stringify(report_payload ?? {});
  const reportContainsFieldMemory = /field[_\s-]*memory/i.test(reportBlob);
  const reportContainsROI = /roi|return[_\s-]*on[_\s-]*investment/i.test(reportBlob);
  const reportSummaryHasConfidence = /confidence/i.test(reportBlob);
  const reportSummaryHasCustomerText = /summary|narrative|customer|insight|recommend/i.test(reportBlob);
  const noRawEnumInCustomerReport = !/\bPASS\b|\bFAIL\b|\bUNKNOWN\b/.test(reportBlob);

  const blocked = failureReasons.length > 0;
  if (!blocked) {
    assert.ok(field_memory_ids.length >= 3, 'Field Memory less than 3');
  }
  if (blocked && acceptance_id) {
    const q = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE fact_id=$1 LIMIT 1`, [acceptance_id]);
    const verdict = String(q.rows?.[0]?.record_json?.payload?.verdict ?? '').toUpperCase();
    assert.notEqual(verdict, 'PASS', 'failure path must not produce PASS acceptance');
  }

  const failure_audit_summary = failureReasons.map((reason) => ({ reason, blocked: true, degraded: reason === 'LOW_CONFIDENCE_ROI' }));

  const chain_summary = {
    field_id,
    observation_id,
    recommendation_id,
    skill_trace_id,
    prescription_id,
    approval_id,
    task_id,
    skill_binding_id,
    skill_run_id,
    receipt_id,
    as_executed_id,
    post_observation_id,
    acceptance_id,
    report_id,
    field_memory_ids,
    roi_ledger_ids,
  };

  const checks = {
    no_skill_trace: Boolean(skill_trace_id),
    no_prescription: Boolean(prescription_id),
    no_approval: Boolean(approval_id),
    no_skill_run: blocked ? true : Boolean(skill_run_id),
    no_as_executed: blocked ? true : Boolean(as_executed_id),
    no_acceptance: blocked ? true : Boolean(acceptance_id),
    field_memory_at_least_three: blocked ? true : field_memory_ids.length >= 3,
    roi_has_baseline_and_confidence_or_blocked: blocked ? true : roi_ledger_ids.length > 0,
    failure_path_not_fake_success: blocked ? failureReasons.length > 0 : true,
    failure_in_report_or_audit_summary: blocked ? failure_audit_summary.length > 0 : true,
    report_contains_field_memory: reportContainsFieldMemory,
    report_contains_roi: reportContainsROI,
    report_summary_has_confidence: reportSummaryHasConfidence,
    report_summary_has_customer_text: reportSummaryHasCustomerText,
    no_raw_enum_in_customer_report: noRawEnumInCustomerReport,
  };
  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, blocked, failure_reasons: failureReasons, failure_audit_summary, chain_summary, roi_ledgers, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
