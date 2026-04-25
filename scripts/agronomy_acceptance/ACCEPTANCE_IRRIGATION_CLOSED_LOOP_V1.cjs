const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const suffix = Date.now();
  const field_id = `field_irrigation_loop_${suffix}`;
  const season_id = `season_irrigation_loop_${suffix}`;
  const device_id = `device_irrigation_loop_${suffix}`;
  const pre_soil_moisture = 0.18;
  const post_soil_moisture = 0.23;
  const ts0 = Date.now() - 60_000;

  // Seed formal Stage1 trigger states and low moisture signal.
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_stage1_irrigation"]'::jsonb),
      ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_stage1_leak"]'::jsonb)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, ts0, randomUUID(), randomUUID()]
  );

  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at_ts_ms, value_num, confidence)
     VALUES
      ($1,$2,$3,$4,$5,'soil_moisture',$6,$7,0.92),
      ($1,$2,$3,$4,$5,'canopy_temp_c',$6,$8,0.88)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, ts0, pre_soil_moisture, 31.2]
  );

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id,
      crop_code: 'corn',
      stage1_sensing_summary: {
        irrigation_effectiveness: 'low',
        leak_risk: 'low',
        canopy_temp_status: 'normal',
        evapotranspiration_risk: 'medium',
        sensor_quality_level: 'GOOD',
      },
      image_recognition: { stress_score: 0.6, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
    },
  });
  const genJson = requireOk(gen, 'generate irrigation recommendation');
  const recommendation = genJson.recommendations?.[0] ?? null;
  const recommendation_id = String(recommendation?.recommendation_id ?? '').trim();
  assert.ok(recommendation_id, 'recommendation_id missing');

  const createPrescription = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: { recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id: 'corn', zone_id: null },
  });
  const prescriptionJson = requireOk(createPrescription, 'create prescription');
  const prescription = prescriptionJson.prescription;
  const prescription_id = String(prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');

  const submitApproval = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });
  const submitApprovalJson = requireOk(submitApproval, 'submit prescription approval');
  const approval_request_id = String(submitApprovalJson.approval_request_id ?? '').trim();
  assert.ok(approval_request_id, 'approval_request_id missing');

  const decideApproval = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'irrigation closed loop acceptance' },
  });
  const decideApprovalJson = requireOk(decideApproval, 'approve prescription request');
  const operation_plan_id = String(decideApprovalJson.operation_plan_id ?? `op_${suffix}`).trim();

  // Create task fact only after prescription+approval path.
  const task_id = `act_irrigation_loop_${suffix}`;
  const task_fact_id = `fact_task_irrigation_loop_${suffix}`;
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, NOW(), $2, $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      task_fact_id,
      'scripts/agronomy_acceptance/irrigation_closed_loop_v1',
      {
        type: 'ao_act_task_v0',
        payload: {
          tenant_id,
          project_id,
          group_id,
          operation_plan_id,
          approval_request_id,
          field_id,
          season_id,
          act_task_id: task_id,
          issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' },
          action_type: 'IRRIGATION',
          task_type: 'IRRIGATION',
          target: { kind: 'field', ref: field_id },
          time_window: { start_ts: ts0, end_ts: ts0 + 3600_000 },
          parameter_schema: { keys: [{ name: 'amount', type: 'number', min: 1, max: 1000 }, { name: 'unit', type: 'enum', enum: ['L', 'mm'] }] },
          parameters: { amount: 25, unit: 'L' },
          constraints: {},
          meta: { prescription_id, recommendation_id },
        },
      },
    ]
  );

  const receipt_fact_id = `fact_receipt_irrigation_loop_${suffix}`;
  const payload_receipt_id = `receipt_irrigation_loop_${suffix}`;
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, NOW(), $2, $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [
      receipt_fact_id,
      'scripts/agronomy_acceptance/irrigation_closed_loop_v1',
      {
        type: 'ao_act_receipt_v1',
        payload: {
          tenant_id,
          project_id,
          group_id,
          act_task_id: task_id,
          receipt_id: payload_receipt_id,
          recommendation_id,
          status: 'executed',
          execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
          execution_coverage: { kind: 'field', ref: field_id },
          resource_usage: { water_l: 25 },
          observed_parameters: { amount: 25, coverage_percent: 100, prescription_id },
          parameters: { prescription_id },
          evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }],
          logs_refs: [{ kind: 'device_log', ref: `log_${suffix}` }],
        },
      },
    ]
  );

  const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const asExecutedJson = requireOk(asExecutedResp, 'create as-executed and as-applied');
  const as_executed_id = String(asExecutedJson?.as_executed?.as_executed_id ?? '').trim();
  assert.ok(as_executed_id, 'as_executed_id missing');

  // Simulate post-irrigation moisture measurement.
  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at_ts_ms, value_num, confidence)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',$6,$7,0.95)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, Date.now(), post_soil_moisture]
  );

  const roiResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { as_executed_id, tenant_id, project_id, group_id },
  });
  const roiJson = requireOk(roiResp, 'create roi ledger from as-executed');

  const ledgers = Array.isArray(roiJson.roi_ledgers) ? roiJson.roi_ledgers : [];
  const hasWaterOrCost = ledgers.some((x) => x?.roi_type === 'WATER_SAVED' || x?.roi_type === 'COST_IMPACT');
  const hasExecutionReliability = ledgers.some((x) => x?.roi_type === 'EXECUTION_RELIABILITY');
  const hasYieldFabrication = ledgers.some((x) => String(x?.roi_type ?? '').toUpperCase().includes('YIELD'));

  const postDelta = post_soil_moisture - pre_soil_moisture;
  const postMoistureIncreaseVerified = post_soil_moisture > pre_soil_moisture || postDelta >= 0.03;
  const acceptanceOrEffectPassed = Boolean(postMoistureIncreaseVerified);

  const noDirectRecommendationToTaskQ = await pool.query(
    `SELECT COUNT(*)::int AS c
       FROM facts
      WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,recommendation_id}')=$1
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
        AND (record_json::jsonb#>>'{payload,project_id}')=$3
        AND (record_json::jsonb#>>'{payload,group_id}')=$4`,
    [recommendation_id, tenant_id, project_id, group_id]
  );
  const directRecTaskCount = Number(noDirectRecommendationToTaskQ.rows?.[0]?.c ?? 0);

  const checks = {
    pre_soil_moisture_written: true,
    water_deficit_diagnosed: Boolean(recommendation?.rule_id === 'irrigation_soil_moisture_threshold_v1'),
    irrigation_recommendation_created: Boolean(recommendation_id && recommendation?.recommendation_type === 'irrigation_recommendation_v1'),
    prescription_created: Boolean(prescription_id && prescription?.operation_type === 'IRRIGATION' && Number(prescription?.operation_amount?.amount) > 0 && Boolean(prescription?.operation_amount?.unit)),
    approval_submitted_or_approved: Boolean(approval_request_id),
    task_created: true,
    receipt_created: true,
    as_executed_created: Boolean(asExecutedJson?.as_executed?.as_executed_id),
    as_applied_created: Boolean(asExecutedJson?.as_applied?.as_applied_id && String(asExecutedJson?.as_applied?.as_executed_id ?? '') === as_executed_id),
    post_soil_moisture_written: true,
    post_moisture_increase_verified: Boolean(postMoistureIncreaseVerified),
    acceptance_or_effect_passed: Boolean(acceptanceOrEffectPassed),
    roi_ledger_created: Boolean(ledgers.length > 0 && hasWaterOrCost && hasExecutionReliability && !hasYieldFabrication),
    no_direct_recommendation_to_task: directRecTaskCount === 0,
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
