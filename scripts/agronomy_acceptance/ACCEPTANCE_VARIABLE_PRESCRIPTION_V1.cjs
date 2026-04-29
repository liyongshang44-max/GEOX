const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

let pool;

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const field_id = env('FIELD_ID', 'field_c8_demo');
  const season_id = env('SEASON_ID', 'season_demo');
  const device_id = env('DEVICE_ID', 'dev_onboard_accept_001');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  pool = new Pool({ connectionString: databaseUrl });

  const suffix = Date.now();
  const operation_plan_id = `opl_variable_prescription_${suffix}`;

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthz_ok = Boolean(healthz.ok && healthz.json?.ok === true);

  const zoneLow = {
    tenant_id, project_id, group_id,
    zone_id: 'zone_low_moisture_north',
    zone_name: 'North low moisture zone',
    zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 3.2,
    risk_tags: ['LOW_MOISTURE'],
    agronomy_tags: ['FAST_DRAINAGE'],
    source_refs: ['acceptance_variable_prescription_v1'],
  };
  const zoneNormal = {
    tenant_id, project_id, group_id,
    zone_id: 'zone_normal_south',
    zone_name: 'South normal zone',
    zone_type: 'IRRIGATION_ZONE',
    geometry: { type: 'Polygon', coordinates: [] },
    area_ha: 4.1,
    risk_tags: ['MODERATE_DEFICIT'],
    agronomy_tags: ['NORMAL_DRAINAGE'],
    source_refs: ['acceptance_variable_prescription_v1'],
  };

  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneLow }), 'create zone low');
  requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones`, { method: 'POST', token, body: zoneNormal }), 'create zone normal');
  const zonesRead = requireOk(await fetchJson(`${base}/api/v1/fields/${encodeURIComponent(field_id)}/zones?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token }), 'read zones');

  const nowMs = Date.now();
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(
    `DELETE FROM derived_sensing_state_index_v1
      WHERE tenant_id=$1
        AND field_id=$2
        AND state_type='irrigation_effectiveness_state'
        AND (project_id=$3 OR project_id IS NULL)
        AND (group_id=$4 OR group_id IS NULL)`,
    [tenant_id, field_id, project_id, group_id],
  );
  await pool.query(
    `INSERT INTO derived_sensing_state_index_v1
      (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
     VALUES
      ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.9,'[]'::jsonb,'[]'::jsonb,now(),$5,$6,'["obs_variable_prescription_stage1"]'::jsonb)`,
    [tenant_id, project_id, group_id, field_id, nowMs, randomUUID()],
  );

  const recommendation = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn' } }), 'recommendation');
  const recommendation_id = String(recommendation.recommendations?.[0]?.recommendation_id ?? '').trim();
  const recommendation_skill_trace = recommendation.recommendations?.[0]?.skill_trace ?? recommendation.recommendations?.[0]?.meta?.skill_trace;

  const variable_plan = {
    mode: 'VARIABLE_BY_ZONE',
    zone_rates: [
      { zone_id: zoneLow.zone_id, operation_type: 'IRRIGATION', planned_amount: 30, unit: 'mm', priority: 'HIGH', reason_codes: ['LOW_SOIL_MOISTURE', 'FAST_DRAINAGE'], source_refs: ['judge_low_moisture'] },
      { zone_id: zoneNormal.zone_id, operation_type: 'IRRIGATION', planned_amount: 15, unit: 'mm', priority: 'MEDIUM', reason_codes: ['MODERATE_DEFICIT'], source_refs: ['judge_normal'] },
    ],
  };

  const variablePrescription = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token, body: { tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan } }), 'variable prescription');
  const prescription_id = String(variablePrescription.prescription?.prescription_id ?? '').trim();
  const variablePrescriptionAgain = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method: 'POST', token, body: { tenant_id, project_id, group_id, recommendation_id, field_id, season_id, crop_id: 'corn', variable_plan } }), 'variable prescription idempotent');

  const prescriptionRead = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token }), 'read prescription');
  const p = prescriptionRead.prescription ?? {};

  const submit = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } }), 'submit approval');
  const approval_request_id = String(submit.approval_request_id ?? '').trim();
  let approve = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, { method: 'POST', token, body: { tenant_id, project_id, group_id, decision: 'APPROVE' } });
  if (!approve.ok) {
    approve = await fetchJson(`${base}/api/v1/approvals/approve`, { method: 'POST', token, body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE' } });
  }
  requireOk(approve, 'approve decision');

  const taskResp = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method: 'POST', token, body: { tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id, device_id } }), 'variable action task');
  const act_task_id = String(taskResp.act_task_id ?? '').trim();

  const taskFact = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
        AND (record_json::jsonb#>>'{payload,project_id}')=$2
        AND (record_json::jsonb#>>'{payload,group_id}')=$3
        AND (record_json::jsonb#>>'{payload,operation_plan_id}')=$4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant_id, project_id, group_id, operation_plan_id],
  );
  const taskPayload = taskFact.rows?.[0]?.record_json?.payload ?? {};
  const taskParams = taskPayload.parameters ?? {};
  const taskSchema = taskPayload.parameter_schema ?? {};

  const receiptPayload = {
    tenant_id,
    project_id,
    group_id,
    operation_plan_id,
    act_task_id,
    executor_id: {
      kind: 'script',
      id: 'acceptance_variable_prescription_v1',
      namespace: 'agronomy_acceptance',
    },
    execution_time: {
      start_ts: Date.now() - 1200 * 1000,
      end_ts: Date.now(),
    },
    execution_coverage: {
      kind: 'field',
      ref: field_id,
    },
    resource_usage: {
      fuel_l: null,
      electric_kwh: null,
      water_l: 440,
      chemical_ml: null,
    },
    logs_refs: [
      {
        kind: 'acceptance_log',
        ref: `variable_receipt_${act_task_id}`,
      },
    ],
    status: 'executed',
    constraint_check: {
      violated: false,
      violations: [],
    },
    observed_parameters: {
      duration_sec: 1200,
      duration_min: 20,
      amount: 44,
      coverage_percent: 97,
    },
    meta: {
      command_id: act_task_id,
      idempotency_key: `variable-prescription-${act_task_id}`,
      variable_execution: {
        mode: 'VARIABLE_BY_ZONE',
        zone_applications: [
          {
            zone_id: zoneLow.zone_id,
            planned_amount: 30,
            applied_amount: 29,
            unit: 'mm',
            coverage_percent: 96,
            status: 'APPLIED',
          },
          {
            zone_id: zoneNormal.zone_id,
            planned_amount: 15,
            applied_amount: 15,
            unit: 'mm',
            coverage_percent: 98,
            status: 'APPLIED',
          },
        ],
      },
    },
  };
  const receiptResp = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, {
    method: 'POST', token,
    body: receiptPayload,
  }), 'variable receipt');
  const receipt_id = String(receiptResp.receipt_id ?? receiptResp.fact_id ?? '').trim();

  const asExecuted1 = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id: act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'as-executed 1');
  const asExecuted2 = requireOk(await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id: act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'as-executed 2');

  const acceptance = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { task_id: act_task_id, receipt_id, tenant_id, project_id, group_id } }), 'acceptance');

  const as_executed_id = String(asExecuted1.as_executed?.as_executed_id ?? '').trim();
  const roi1 = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id } }), 'roi 1');
  const roi2 = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id } }), 'roi 2');
  const roiBy = requireOk(await fetchJson(`${base}/api/v1/roi-ledger/by-as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token }), 'roi by as-executed');
  const roiLedgers = Array.isArray(roiBy.roi_ledgers) ? roiBy.roi_ledgers : [];
  const roiTypes = roiLedgers.map((x) => String(x?.roi_type ?? ''));
  const roiMap = Object.fromEntries(roiLedgers.map((x) => [x.roi_type, x]));

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });

  process.stdout.write(`${JSON.stringify({
    variable_prescription_debug: {
      field_id,
      zone_ids: [zoneLow.zone_id, zoneNormal.zone_id],
      recommendation_id,
      prescription_id,
      approval_request_id,
      operation_plan_id,
      act_task_id,
      receipt_id,
      as_executed_id,
      as_applied_id: asExecuted1.as_applied?.as_applied_id ?? null,
      acceptance_result: acceptance.result,
      acceptance_skill_id: acceptance.acceptance_skill_id,
      roi_types: roiTypes,
    },
  }, null, 2)}\n`);

  const allowedPrimitiveKeys = ['duration_sec', 'duration_min', 'amount', 'coverage_percent'];
  const taskParamKeys = Object.keys(taskParams).sort();
  const schemaKeys = Array.isArray(taskSchema.keys)
    ? taskSchema.keys.map((k) => String(k.name ?? '')).filter(Boolean).sort()
    : [];
  const asAppliedApp = asExecuted1.as_applied?.application ?? {};
  const zoneApps = asAppliedApp.zone_applications ?? [];

  const checks = {
    healthz_ok,

    management_zones_created: true,
    management_zones_readable: Array.isArray(zonesRead.items) && zonesRead.items.some((z) => z.zone_id === zoneLow.zone_id) && zonesRead.items.some((z) => z.zone_id === zoneNormal.zone_id),

    recommendation_created: Boolean(recommendation_id),
    recommendation_has_skill_trace: Boolean(recommendation_skill_trace),

    variable_prescription_created: Boolean(prescription_id),
    variable_prescription_idempotent: String(variablePrescriptionAgain?.prescription?.prescription_id ?? '') === prescription_id,
    variable_prescription_has_zone_rates: String(p?.operation_amount?.mode ?? '') === 'VARIABLE_BY_ZONE' && Array.isArray(p?.operation_amount?.zone_rates) && p.operation_amount.zone_rates.length === 2,
    variable_prescription_total_amount_correct: Number(p?.operation_amount?.amount) === 45,
    variable_prescription_skill_trace_preserved: Boolean(p?.skill_trace || p?.meta?.skill_trace),
    variable_prescription_requires_variable_rate_device: Boolean(p?.device_requirements?.variable_rate_required === true && p?.spatial_scope?.mode === 'MANAGEMENT_ZONE' && p?.approval_requirement?.required === true && p?.acceptance_conditions?.zone_level_required === true),

    approval_requested: Boolean(approval_request_id),
    approval_approved: approve.ok === true,

    variable_action_task_created: Boolean(act_task_id),
    task_parameters_are_primitive: taskParamKeys.length === allowedPrimitiveKeys.length && taskParamKeys.every((k, i) => k === allowedPrimitiveKeys.sort()[i]),
    task_parameter_schema_1_to_1: taskParamKeys.length === schemaKeys.length && taskParamKeys.every((k) => schemaKeys.includes(k)),
    task_has_duration_sec: Number(taskParams.duration_sec) > 0,
    task_meta_preserves_variable_plan: String(taskPayload?.meta?.variable_plan?.mode ?? '') === 'VARIABLE_BY_ZONE',
    task_meta_preserves_zone_rates: Array.isArray(taskPayload?.meta?.variable_plan?.zone_rates) && taskPayload.meta.variable_plan.zone_rates.length === 2 && String(taskPayload?.meta?.prescription_id ?? '') === prescription_id && String(taskPayload?.meta?.recommendation_id ?? '') === recommendation_id,

    variable_receipt_created: Boolean(receipt_id),
    receipt_observed_parameters_are_primitive: Object.values(receiptPayload.observed_parameters).every((v) => ['string', 'number', 'boolean'].includes(typeof v) || v == null),
    receipt_meta_preserves_variable_execution: String(receiptPayload.meta.variable_execution.mode ?? '') === 'VARIABLE_BY_ZONE' && Array.isArray(receiptPayload.meta.variable_execution.zone_applications),

    as_executed_created: Boolean(asExecuted1?.as_executed?.as_executed_id),
    as_applied_created: Boolean(asExecuted1?.as_applied?.as_applied_id),
    as_executed_idempotent: asExecuted2?.idempotent === true,
    as_executed_has_variable_execution: String(asExecuted1?.as_executed?.executed?.variable_execution?.mode ?? '') === 'VARIABLE_BY_ZONE',
    as_applied_mode_variable_by_zone: String(asAppliedApp?.mode ?? '') === 'VARIABLE_BY_ZONE',
    as_applied_has_zone_applications: Array.isArray(zoneApps) && zoneApps.length === 2,
    zone_level_deviation_computed: zoneApps.every((z) => typeof z?.deviation_amount === 'number' && typeof z?.deviation_percent === 'number'),
    as_applied_totals_correct: Number(asAppliedApp?.total_planned_amount) === 45 && Number(asAppliedApp?.total_applied_amount) === 44 && Number(asAppliedApp?.avg_coverage_percent) === 97 && asExecuted1?.as_applied?.zone_id === null,

    variable_acceptance_passed: String(acceptance?.result ?? '').toUpperCase() === 'PASSED',
    variable_acceptance_skill_used: String(acceptance?.acceptance_skill_id ?? '') === 'variable_irrigation_acceptance_v1',
    variable_acceptance_metrics_present: Number(acceptance?.metrics?.zone_application_count) === 2 && Number(acceptance?.metrics?.zone_completion_rate) === 1 && Number(acceptance?.metrics?.avg_zone_coverage_percent) === 97 && typeof acceptance?.metrics?.max_zone_deviation_percent === 'number',

    variable_roi_ledger_created: roi1.ok === true && roiLedgers.length > 0,
    variable_roi_ledger_idempotent: roi2.ok === true && roi2.idempotent === true,
    variable_water_saved_created: Boolean(roiMap.VARIABLE_WATER_SAVED),
    zone_completion_rate_created: Boolean(roiMap.ZONE_COMPLETION_RATE),
    variable_execution_reliability_created: Boolean(roiMap.VARIABLE_EXECUTION_RELIABILITY),
    variable_roi_values_correct: Number(roiMap?.VARIABLE_WATER_SAVED?.delta?.amount) === 1 && String(roiMap?.VARIABLE_WATER_SAVED?.delta?.unit ?? '').toLowerCase() === 'mm' && Number(roiMap?.ZONE_COMPLETION_RATE?.actual?.zone_count) === 2 && Number(roiMap?.ZONE_COMPLETION_RATE?.actual?.completed_zone_count) === 2 && Number(roiMap?.ZONE_COMPLETION_RATE?.actual?.completion_rate) === 1 && Number(roiMap?.ZONE_COMPLETION_RATE?.actual?.avg_coverage_percent) === 97 && Number(roiMap?.VARIABLE_EXECUTION_RELIABILITY?.actual?.zone_count) === 2 && Number(roiMap?.VARIABLE_EXECUTION_RELIABILITY?.actual?.applied_count) === 2 && Number(roiMap?.VARIABLE_EXECUTION_RELIABILITY?.actual?.skipped_count) === 0,
    no_yield_or_profit_fabrication: roiTypes.every((t) => !t.includes('YIELD') && !t.includes('PROFIT')),

    openapi_contains_variable_contracts: Boolean(
      openapi.ok
      && openapi.json?.components?.schemas?.ManagementZoneV1
      && openapi.json?.components?.schemas?.VariablePrescriptionPlanV1
      && openapi.json?.components?.schemas?.VariableZoneRateV1
      && openapi.json?.paths?.['/api/v1/prescriptions/variable/from-recommendation']
      && openapi.json?.paths?.['/api/v1/actions/task/from-variable-prescription']
      && openapi.json?.components?.schemas?.VariableExecutionV1
      && openapi.json?.components?.schemas?.VariableZoneApplicationV1
      && openapi.json?.components?.schemas?.AsAppliedApplicationV1
      && openapi.json?.components?.schemas?.VariableAcceptanceMetricsV1
      && openapi.json?.components?.schemas?.VariableAcceptanceExplanationCodeV1
      && Array.isArray(openapi.json?.components?.schemas?.RoiTypeV1?.enum)
      && openapi.json.components.schemas.RoiTypeV1.enum.includes('VARIABLE_WATER_SAVED')
      && openapi.json.components.schemas.RoiTypeV1.enum.includes('ZONE_COMPLETION_RATE')
      && openapi.json.components.schemas.RoiTypeV1.enum.includes('VARIABLE_EXECUTION_RELIABILITY')
    ),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);

  await pool.end();
})().catch(async (err) => {
  try { if (pool) await pool.end(); } catch {}
  console.error(err);
  process.exit(1);
});
