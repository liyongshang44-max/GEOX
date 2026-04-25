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
  const post_soil_moisture = 0.24;
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

  const preSoilObservationFactId = `obs_soil_irrigation_loop_${randomUUID()}`;
  const preCanopyObservationFactId = `obs_canopy_irrigation_loop_${randomUUID()}`;

  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES
      ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$9),
      ($1,$2,$3,$4,$5,'canopy_temp_c',to_timestamp($6 / 1000.0),$6,$8,0.88,$10)
     ON CONFLICT DO NOTHING`,
    [
      tenant_id,
      project_id,
      group_id,
      field_id,
      device_id,
      ts0,
      pre_soil_moisture,
      31.2,
      preSoilObservationFactId,
      preCanopyObservationFactId,
    ]
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
  const recommendationSkillTrace = recommendation?.skill_trace ?? null;

  const createPrescription = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
    method: 'POST',
    token,
    body: {
      recommendation_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      device_id,
      crop_id: 'corn',
      zone_id: null,
      device_requirements: {
        device_id,
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
        adapter_type: 'irrigation_simulator',
      },
      operation_amount: {
        amount: 25,
        unit: 'L',
        parameters: {
          device_id,
          duration_sec: 1200,
          flow_lpm: 1,
          adapter_type: 'irrigation_simulator',
          device_type: 'IRRIGATION_CONTROLLER',
          required_capabilities: ['device.irrigation.valve.open'],
          metadata: {
            device_id,
            adapter_type: 'irrigation_simulator',
            device_type: 'IRRIGATION_CONTROLLER',
            required_capabilities: ['device.irrigation.valve.open'],
          },
        },
      },
    },
  });
  const prescriptionJson = requireOk(createPrescription, 'create prescription');
  const prescription = prescriptionJson.prescription;
  const prescription_id = String(prescription?.prescription_id ?? '').trim();
  assert.ok(prescription_id, 'prescription_id missing');
  const prescriptionSkillTrace = prescription?.operation_amount?.parameters?.metadata?.skill_trace
    ?? prescription?.operation_amount?.parameters?.preserved_payload?.skill_trace
    ?? null;

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
    body: {
      tenant_id,
      project_id,
      group_id,
      decision: 'APPROVE',
      reason: 'irrigation closed loop acceptance',
      device_id,
      adapter_type: 'irrigation_simulator',
      device_type: 'IRRIGATION_CONTROLLER',
      required_capabilities: ['device.irrigation.valve.open'],
      device_requirements: {
        device_id,
        adapter_type: 'irrigation_simulator',
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
      },
      execution_context: {
        device_id,
        adapter_type: 'irrigation_simulator',
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
      },
    },
  });
  const decideApprovalJson = requireOk(decideApproval, 'approve prescription request');
  const operation_plan_id = String(
    decideApprovalJson.operation_plan_id
      ?? decideApprovalJson.operation_plan?.operation_plan_id
      ?? decideApprovalJson.plan?.operation_plan_id
      ?? ''
  ).trim();
  assert.ok(operation_plan_id, `operation_plan_id missing from approve response: ${JSON.stringify(decideApprovalJson)}`);
  assert.ok(operation_plan_id && !operation_plan_id.startsWith('op_'), 'approve response must return real operation_plan_id');
  const operationPlanFactQ = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
        AND (
          record_json::jsonb#>>'{payload,operation_plan_id}' = $1
          OR record_json::jsonb#>>'{payload,plan_id}' = $1
        )
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [operation_plan_id]
  );
  assert.ok(
    operationPlanFactQ.rows?.length > 0,
    `operation_plan_v1 not found for operation_plan_id=${operation_plan_id}; approve response=${JSON.stringify(decideApprovalJson)}`
  );
  const operationPlanPayload = operationPlanFactQ.rows?.[0]?.record_json?.payload ?? {};
  assert.equal(operationPlanPayload.adapter_type, 'irrigation_simulator', 'operation_plan.payload.adapter_type must be irrigation_simulator');
  assert.equal(operationPlanPayload.device_id, device_id, 'operation_plan.payload.device_id must match device_id');
  assert.equal(operationPlanPayload.device_type, 'IRRIGATION_CONTROLLER', 'operation_plan.payload.device_type must be IRRIGATION_CONTROLLER');
  assert.ok(
    Array.isArray(operationPlanPayload.required_capabilities)
      && operationPlanPayload.required_capabilities.includes('device.irrigation.valve.open'),
    'operation_plan.payload.required_capabilities must include device.irrigation.valve.open'
  );

  // Step6-D: create action task through AO-ACT API (no direct facts insert).
  const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      approval_request_id,
      field_id,
      season_id,
      device_id,
      issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' },
      action_type: 'IRRIGATE',
      target: { kind: 'device', ref: device_id },
      time_window: { start_ts: ts0, end_ts: ts0 + 3600_000 },
      parameter_schema: {
        keys: [
          { name: 'amount', type: 'number', min: 1, max: 1000 },
          { name: 'coverage_percent', type: 'number', min: 0, max: 100 },
          { name: 'duration_min', type: 'number', min: 1, max: 720 },
          { name: 'prescription_id', type: 'enum', enum: [prescription_id] },
        ],
      },
      parameters: { amount: 20, coverage_percent: 88, duration_min: 20, prescription_id },
      constraints: {},
      meta: {
        recommendation_id,
        prescription_id,
        task_type: 'IRRIGATION',
        device_id,
        adapter_type: 'irrigation_simulator',
        device_type: 'IRRIGATION_CONTROLLER',
        required_capabilities: ['device.irrigation.valve.open'],
      },
    },
  });
  const taskJson = requireOk(taskResp, 'create action task');
  const task_id = String(taskJson.act_task_id ?? '').trim();
  assert.ok(task_id, 'act_task_id missing');

  // Step6-D: submit receipt through AO-ACT API with required payload.
  const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      act_task_id: task_id,
      executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' },
      execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
      execution_coverage: { kind: 'field', ref: field_id },
      resource_usage: { fuel_l: null, electric_kwh: null, water_l: 20, chemical_ml: null },
      observed_parameters: { amount: 20, coverage_percent: 88, duration_min: 20, prescription_id },
      evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }, { kind: 'sensor', ref: `sensor_${suffix}` }],
      logs_refs: [{ kind: 'water_delivery_receipt', ref: `water_${suffix}` }, { kind: 'dispatch_ack', ref: `dispatch_${suffix}` }, { kind: 'valve_open_confirmation', ref: `valve_${suffix}` }],
      status: 'executed',
      constraint_check: { violated: false, violations: [] },
      meta: {
        command_id: task_id,
        idempotency_key: `acceptance_receipt_${suffix}`,
        recommendation_id,
        prescription_id,
      },
    },
  });
  const receiptJson = requireOk(receiptResp, 'submit action receipt');
  const receipt_fact_id = String(receiptJson.fact_id ?? '').trim();
  assert.ok(receipt_fact_id, 'receipt_fact_id missing');
  const receiptFactQ = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE fact_id = $1
      LIMIT 1`,
    [receipt_fact_id]
  );
  const receiptPayload = receiptFactQ.rows?.[0]?.record_json?.payload ?? {};
  assert.equal(Number(receiptPayload?.resource_usage?.water_l ?? NaN), 20, 'receipt.resource_usage.water_l must be 20');
  assert.equal(Number(receiptPayload?.observed_parameters?.amount ?? NaN), 20, 'receipt.observed_parameters.amount must be 20');
  assert.equal(Number(receiptPayload?.observed_parameters?.coverage_percent ?? NaN), 88, 'receipt.observed_parameters.coverage_percent must be 88');
  assert.equal(Number(receiptPayload?.observed_parameters?.duration_min ?? NaN), 20, 'receipt.observed_parameters.duration_min must be 20');
  assert.equal(String(receiptPayload?.observed_parameters?.prescription_id ?? ''), prescription_id, 'receipt.observed_parameters.prescription_id mismatch');
  assert.ok(Array.isArray(receiptPayload?.evidence_refs) && receiptPayload.evidence_refs.length > 0, 'receipt.evidence_refs missing');

  const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const asExecutedJson = requireOk(asExecutedResp, 'create as-executed and as-applied');
  const as_executed_id = String(asExecutedJson?.as_executed?.as_executed_id ?? '').trim();
  assert.ok(as_executed_id, 'as_executed_id missing');
  const as_executed_prescription_id = String(asExecutedJson?.as_executed?.prescription_id ?? '').trim();
  assert.equal(as_executed_prescription_id, prescription_id, 'as_executed.prescription_id must match prescription_id');
  const as_applied_as_executed_id = String(asExecutedJson?.as_applied?.as_executed_id ?? '').trim();
  assert.equal(as_applied_as_executed_id, as_executed_id, 'as_applied.as_executed_id must match as_executed_id');

  // Simulate post-irrigation moisture measurement.
  const postTs = Date.now();
  const postSoilObservationFactId = `obs_post_soil_irrigation_loop_${randomUUID()}`;

  await pool.query(
    `INSERT INTO device_observation_index_v1
      (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.95,$8)
     ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, postTs, post_soil_moisture, postSoilObservationFactId]
  );

  // Step6-F: call system acceptance path to create acceptance_result_v1 verdict.
  const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id, act_task_id: task_id },
  });
  const acceptanceJson = requireOk(acceptanceResp, 'evaluate acceptance verdict');
  const acceptance_fact_id = String(acceptanceJson.fact_id ?? '').trim();
  const acceptance_verdict = String(acceptanceJson.verdict ?? '').trim().toUpperCase();
  assert.ok(acceptance_fact_id, 'acceptance fact_id missing');
  const acceptanceFactQ = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE fact_id = $1
      LIMIT 1`,
    [acceptance_fact_id]
  );
  const acceptancePayload = acceptanceFactQ.rows?.[0]?.record_json?.payload ?? {};
  assert.equal(String(acceptancePayload?.verdict ?? '').toUpperCase(), acceptance_verdict, 'acceptance verdict persistence mismatch');

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
  const postMoistureIncreaseVerified = post_soil_moisture > pre_soil_moisture && postDelta >= 0.03;
  const acceptanceOrEffectPassed = Boolean(postMoistureIncreaseVerified && acceptance_verdict === 'PASS');

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
    irrigation_skill_invoked: Boolean(recommendationSkillTrace),
    water_deficit_diagnosed: Boolean(recommendation?.rule_id === 'irrigation_soil_moisture_threshold_v1'),
    irrigation_recommendation_created: Boolean(recommendation_id && recommendation?.recommendation_type === 'irrigation_recommendation_v1'),
    recommendation_has_skill_trace: Boolean(recommendationSkillTrace),
    skill_trace_skill_id_is_irrigation_deficit: String(recommendationSkillTrace?.skill_id ?? '') === 'irrigation_deficit_skill_v1',
    prescription_created: Boolean(prescription_id && prescription?.operation_type === 'IRRIGATION' && Number(prescription?.operation_amount?.amount) > 0 && Boolean(prescription?.operation_amount?.unit)),
    prescription_inherits_skill_trace: Boolean(prescriptionSkillTrace && String(prescriptionSkillTrace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'),
    approval_submitted_or_approved: Boolean(approval_request_id),
    task_created: true,
    receipt_created: true,
    as_executed_created: Boolean(asExecutedJson?.as_executed?.as_executed_id),
    as_executed_prescription_linked: String(asExecutedJson?.as_executed?.prescription_id ?? '') === prescription_id,
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
