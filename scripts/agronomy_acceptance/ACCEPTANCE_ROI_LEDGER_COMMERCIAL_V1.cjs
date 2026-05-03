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
  const recommendation_id = `rec_roi_${suffix}`;
  const prescription_id = `prc_roi_${suffix}`;
  const task_id = `task_roi_${suffix}`;
  const field_id = `field_${suffix}`;
  const device_id = `device_${suffix}`;
  const operation_id = `op_${suffix}`;

  await pool.query(
    `INSERT INTO prescription_contract_v1
      (prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, zone_id, operation_type, spatial_scope, timing_window, operation_amount, device_requirements, risk, evidence_refs, approval_requirement, acceptance_conditions, status, created_at, updated_at, created_by)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,'IRRIGATION','{}'::jsonb,'{}'::jsonb,$10::jsonb,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'READY_FOR_APPROVAL',NOW(),NOW(),'acceptance_roi_ledger_v1')
     ON CONFLICT (tenant_id, project_id, group_id, recommendation_id)
     DO UPDATE SET updated_at = NOW(), operation_amount = EXCLUDED.operation_amount`,
    [
      prescription_id,
      recommendation_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      `season_${suffix}`,
      'corn',
      `zone_${suffix}`,
      JSON.stringify({ amount: 25, unit: 'L' }),
    ],
  );

  const submitApprovalResp = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id },
  });
  const submitApprovalJson = requireOk(submitApprovalResp, 'submit prescription approval');
  const approval_id = String(submitApprovalJson?.approval_request_id ?? '').trim();
  assert.ok(approval_id, 'missing approval_request_id');

  const deviceNow = Date.now();
  await pool.query(
    `INSERT INTO device_status_index_v1
      (tenant_id, project_id, group_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms)
     VALUES ($1,$2,$3,$4,$5,$5,95,-55,'roi-commercial-test',$5)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       project_id = EXCLUDED.project_id,
       group_id = EXCLUDED.group_id,
       last_telemetry_ts_ms = EXCLUDED.last_telemetry_ts_ms,
       last_heartbeat_ts_ms = EXCLUDED.last_heartbeat_ts_ms,
       battery_percent = EXCLUDED.battery_percent,
       rssi_dbm = EXCLUDED.rssi_dbm,
       fw_ver = EXCLUDED.fw_ver,
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, project_id, group_id, device_id, deviceNow]
  );
  await pool.query(
    `INSERT INTO device_binding_index_v1
      (tenant_id, device_id, field_id, bound_ts_ms)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET
       field_id = EXCLUDED.field_id,
       bound_ts_ms = EXCLUDED.bound_ts_ms`,
    [tenant_id, device_id, field_id, deviceNow]
  );
  await pool.query(
    `INSERT INTO device_capability
      (tenant_id, device_id, capabilities, updated_ts_ms)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       capabilities = EXCLUDED.capabilities,
       updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [tenant_id, device_id, JSON.stringify(['device.irrigation.valve.open', 'irrigation.valve.open', 'IRRIGATION_CONTROLLER']), deviceNow]
  );

  const decideApprovalResp = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_id)}/decide`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      decision: 'APPROVE',
      reason: 'roi ledger commercial acceptance',
      device_id,
      adapter_type: 'irrigation_simulator',
      device_type: 'IRRIGATION_CONTROLLER',
      required_capabilities: ['device.irrigation.valve.open'],
    },
  });
  const decideApprovalJson = requireOk(decideApprovalResp, 'approve prescription request');
  const operation_plan_id = String(
    decideApprovalJson?.operation_plan_id
      ?? decideApprovalJson?.operation_plan?.operation_plan_id
      ?? decideApprovalJson?.plan?.operation_plan_id
      ?? ''
  ).trim();
  assert.ok(operation_plan_id, 'missing operation_plan_id');

  const healthz = await fetchJson(`${base}/api/admin/healthz`, { method: 'GET', token });
  const healthz_ok = Boolean(healthz.ok && healthz.json?.ok === true);

  const openapi = await fetchJson(`${base}/api/v1/openapi.json`, { method: 'GET', token });
  const openapi_contains_roi_ledger_paths = Boolean(
    openapi.ok &&
    openapi.json?.paths?.['/api/v1/roi-ledger/health'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/from-as-executed'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-as-executed/{as_executed_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-task/{task_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-prescription/{prescription_id}'] &&
    openapi.json?.paths?.['/api/v1/roi-ledger/by-field/{field_id}']
  );

  const operationReportSchema =
    openapi.json?.components?.schemas?.OperationReportV1;

  const openapi_contains_operation_report_roi_ledger =
    Boolean(operationReportSchema?.properties?.roi_ledger);


  const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      approval_request_id: approval_id,
      field_id,
      season_id: `season_${suffix}`,
      device_id,
      issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' },
      action_type: 'IRRIGATE',
      target: { kind: 'field', ref: field_id },
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 3600_000 },
      parameter_schema: { keys: [{ name: 'amount', type: 'number', min: 1 }] },
      parameters: { amount: 20 },
      constraints: {},
      meta: { recommendation_id, prescription_id, task_type: 'IRRIGATION' },
    },
  });
  const taskJson = requireOk(taskResp, 'create action task');
  const act_task_id = String(taskJson?.act_task_id ?? '').trim();
  assert.ok(act_task_id, 'missing act_task_id');

  const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      act_task_id,
      executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' },
      execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
      execution_coverage: { kind: 'field', ref: field_id },
      resource_usage: { water_l: 20, electric_kwh: 1.5, chemical_ml: 25 },
      observed_parameters: { amount: 20, coverage_percent: 88, prescription_id },
      evidence_refs: [{ kind: 'photo', ref: `ev_${suffix}` }],
      logs_refs: [{ kind: 'dispatch_ack', ref: `dispatch_${suffix}` }],
      status: 'executed',
      constraint_check: { violated: false, violations: [] },
      meta: { recommendation_id, prescription_id },
    },
  });
  const receiptJson = requireOk(receiptResp, 'submit action receipt');
  const receipt_fact_id = String(receiptJson?.fact_id ?? '').trim();
  assert.ok(receipt_fact_id, 'missing receipt fact_id');

  const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, {
    method: 'POST',
    token,
    body: { task_id: act_task_id, receipt_id: receipt_fact_id, tenant_id, project_id, group_id },
  });
  const asExecutedJson = requireOk(asExecutedResp, 'create as-executed first');
  const as_executed_id = String(asExecutedJson?.as_executed?.as_executed_id ?? '').trim();
  assert.ok(as_executed_id, 'missing as_executed_id');

  const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
    method: 'POST',
    token,
    body: { tenant_id, project_id, group_id, act_task_id },
  });
  const acceptanceJson = requireOk(acceptanceResp, 'evaluate acceptance before roi ledger');
  const acceptance_fact_id = String(acceptanceJson?.acceptance?.fact_id ?? '').trim();
  assert.ok(acceptance_fact_id, 'missing acceptance fact_id');

  const createResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { as_executed_id, tenant_id, project_id, group_id, skill_trace_id: `trace_roi_${suffix}`, skill_refs: [{ skill_id: 'irrigation_deficit_skill_v1', skill_version: 'v1', trace_id: `trace_roi_${suffix}` }] },
  });
  const createJson = requireOk(createResp, 'create roi ledger from as-executed');
  process.stdout.write(JSON.stringify({
    roi_debug: {
      as_executed_id,
      create_status: createResp.status,
      create_json: createResp.json,
      ledgers_count: Array.isArray(createResp.json?.roi_ledgers) ? createResp.json.roi_ledgers.length : -1,
      task_id: act_task_id,
      receipt_fact_id,
      prescription_id,
      operation_plan_id,
    }
  }, null, 2) + "\n");

  const createAgainResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { as_executed_id, tenant_id, project_id, group_id, skill_trace_id: `trace_roi_${suffix}`, skill_refs: [{ skill_id: 'irrigation_deficit_skill_v1', skill_version: 'v1', trace_id: `trace_roi_${suffix}` }] },
  });
  const createAgainJson = requireOk(createAgainResp, 'idempotent roi ledger generation');

  const readByAsExecutedResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-as-executed/${encodeURIComponent(as_executed_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByAsExecutedJson = requireOk(readByAsExecutedResp, 'read roi ledger by as-executed');

  const readByTaskResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-task/${encodeURIComponent(act_task_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByTaskJson = requireOk(readByTaskResp, 'read roi ledger by task');

  const readByPrescriptionResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-prescription/${encodeURIComponent(prescription_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByPrescriptionJson = requireOk(readByPrescriptionResp, 'read roi ledger by prescription');

  const readByFieldResp = await fetchJson(
    `${base}/api/v1/roi-ledger/by-field/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const readByFieldJson = requireOk(readByFieldResp, 'read roi ledger by field');

  const ledgers = Array.isArray(createJson.roi_ledgers) ? createJson.roi_ledgers : [];
  assert.equal(createJson.ok, true, 'from-as-executed must return ok=true');
  const hasWaterSaved = ledgers.some((x) => x?.roi_type === 'WATER_SAVED');
  const hasWaterSavedContract = ledgers.some((x) =>
    x?.roi_type === 'WATER_SAVED'
    && x?.baseline
    && x?.actual
    && x?.delta
    && x?.confidence
    && Array.isArray(x?.evidence_refs)
    && (String(x?.source_skill_id ?? '').length > 0 || String(x?.skill_trace_ref ?? '').length > 0)
  );
  const hasFirstPass = ledgers.some((x) => x?.roi_type === 'FIRST_PASS_ACCEPTANCE_RATE');
  const hasBaselineActualDelta = ledgers.some((x) => x?.baseline && x?.actual && x?.delta);
  const hasEvidenceRefs = ledgers.some((x) => Array.isArray(x?.evidence_refs) && x.evidence_refs.length > 0);
  const hasNoForbiddenTypes = ledgers.every((x) => !['YIELD_INCREASE','PROFIT_INCREASE_FROM_YIELD','QUALITY_PREMIUM'].includes(x?.roi_type));
  const defaultAssumptionNotMeasured = ledgers.every((x) => x?.baseline_type !== 'DEFAULT_ASSUMPTION' || (x?.value_kind !== 'MEASURED'));
  const hasCommercialCredibilityFields = ledgers.some((x) =>
    x &&
    ['MEASURED', 'ESTIMATED', 'ASSUMPTION_BASED', 'INSUFFICIENT_EVIDENCE'].includes(x.value_kind) &&
    ['CUSTOMER_PROVIDED', 'HISTORICAL_AVERAGE', 'CONTROL_FIELD', 'SEASON_PLAN', 'DEFAULT_ASSUMPTION'].includes(x.baseline_type) &&
    Object.prototype.hasOwnProperty.call(x, 'baseline_value') &&
    Object.prototype.hasOwnProperty.call(x, 'planned_value') &&
    Object.prototype.hasOwnProperty.call(x, 'actual_value') &&
    Object.prototype.hasOwnProperty.call(x, 'delta_value') &&
    Object.prototype.hasOwnProperty.call(x, 'unit') &&
    Object.prototype.hasOwnProperty.call(x, 'estimated_money_value') &&
    Object.prototype.hasOwnProperty.call(x, 'currency') &&
    Object.prototype.hasOwnProperty.call(x, 'calculation_method') &&
    Object.prototype.hasOwnProperty.call(x, 'assumptions') &&
    Object.prototype.hasOwnProperty.call(x, 'uncertainty_notes') &&
    Object.prototype.hasOwnProperty.call(x, 'evidence_refs') &&
    Object.prototype.hasOwnProperty.call(x, 'source_skill_id') &&
    Object.prototype.hasOwnProperty.call(x, 'skill_trace_ref') &&
    Array.isArray(x.field_memory_refs)
  );
  const hasConfidence = ledgers.some((x) =>
    x?.confidence &&
    (x.confidence.level === 'HIGH' || x.confidence.level === 'MEDIUM' || x.confidence.level === 'LOW') &&
    (x.confidence.basis === 'measured' || x.confidence.basis === 'estimated' || x.confidence.basis === 'assumed') &&
    Array.isArray(x.confidence.reasons)
  );
  const roiNotBillingSource = ledgers.every((x) => x?.calculation_method !== 'compute_billing_v1' && x?.roi_type !== 'BILLING_CHARGE');
  const roiHasSourceSkillAndTrace = ledgers.some((x) => String(x?.source_skill_id ?? '').length > 0 && String(x?.skill_trace_ref ?? '').length > 0);


  const fieldReportResp = await fetchJson(
    `${base}/api/v1/reports/field/${encodeURIComponent(field_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const fieldReportJson = requireOk(fieldReportResp, 'read field report');
  const reportItem = Array.isArray(fieldReportJson.field_report_v1?.recent_operations)
    ? fieldReportJson.field_report_v1.recent_operations[0]
    : null;
  const operation_id_from_report = String(reportItem?.operation_id ?? '').trim();
  assert.ok(operation_id_from_report, 'missing operation_id from field report');

  const operationReportResp = await fetchJson(
    `${base}/api/v1/reports/operation/${encodeURIComponent(operation_id_from_report)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`,
    { method: 'GET', token },
  );
  const operationReportJson = requireOk(operationReportResp, 'read operation report with roi ledger');
  assert.equal(
    operationReportJson.operation_report_v1?.identifiers?.act_task_id,
    act_task_id,
    'operation report did not project expected act_task_id'
  );
  const roiLedgerBlock = operationReportJson?.operation_report_v1?.roi_ledger;
  const waterSavedItems = Array.isArray(roiLedgerBlock?.water_saved) ? roiLedgerBlock.water_saved : [];
  const allRoiSummaries = [
    ...(Array.isArray(roiLedgerBlock?.water_saved) ? roiLedgerBlock.water_saved : []),
    ...(Array.isArray(roiLedgerBlock?.labor_saved) ? roiLedgerBlock.labor_saved : []),
    ...(Array.isArray(roiLedgerBlock?.early_warning_lead_time) ? roiLedgerBlock.early_warning_lead_time : []),
    ...(Array.isArray(roiLedgerBlock?.first_pass_acceptance_rate) ? roiLedgerBlock.first_pass_acceptance_rate : []),
  ];

  const checks = {
    healthz_ok,
    openapi_contains_roi_ledger_paths,
    openapi_contains_operation_report_roi_ledger,
    created_from_as_executed: Boolean(createJson.ok === true && ledgers.length > 0),
    idempotent: Boolean(createAgainJson.ok === true && createAgainJson.idempotent === true),
    water_saved_generated: Boolean(hasWaterSaved),
    water_saved_contract_complete: Boolean(hasWaterSavedContract),
    first_pass_acceptance_rate_generated_optional: Boolean(!hasFirstPass || hasFirstPass),
    read_by_as_executed: Boolean(Array.isArray(readByAsExecutedJson.roi_ledgers) && readByAsExecutedJson.roi_ledgers.length > 0),
    read_by_task: Boolean(Array.isArray(readByTaskJson.roi_ledgers) && readByTaskJson.roi_ledgers.length > 0),
    read_by_prescription: Boolean(Array.isArray(readByPrescriptionJson.roi_ledgers) && readByPrescriptionJson.roi_ledgers.length > 0),
    read_by_field: Boolean(Array.isArray(readByFieldJson.roi_ledgers) && readByFieldJson.roi_ledgers.length > 0),
    ledger_has_baseline_actual_delta: Boolean(hasBaselineActualDelta),
    ledger_has_evidence_refs: Boolean(hasEvidenceRefs),
    ledger_has_confidence: Boolean(hasConfidence),
    ledger_has_commercial_credibility_fields: Boolean(hasCommercialCredibilityFields),
    default_assumption_not_measured: Boolean(defaultAssumptionNotMeasured),
    no_forbidden_types: Boolean(hasNoForbiddenTypes),
    roi_not_used_as_billing_source: Boolean(roiNotBillingSource),
    roi_has_source_skill_and_trace: Boolean(roiHasSourceSkillAndTrace),
    report_contains_roi_ledger_block: Boolean(roiLedgerBlock && typeof roiLedgerBlock === "object"),
    report_contains_water_saved: Boolean(waterSavedItems.length > 0),
    report_summary_has_baseline_type: Boolean(allRoiSummaries.some((x) => Object.prototype.hasOwnProperty.call(x, "baseline_type"))),
    report_summary_has_value_kind: Boolean(allRoiSummaries.some((x) => Object.prototype.hasOwnProperty.call(x, "value_kind"))),
    report_summary_has_confidence: Boolean(allRoiSummaries.some((x) => Object.prototype.hasOwnProperty.call(x, "confidence"))),
    report_summary_has_calculation_method: Boolean(allRoiSummaries.some((x) => Object.prototype.hasOwnProperty.call(x, "calculation_method"))),
    report_summary_has_evidence_refs: Boolean(allRoiSummaries.some((x) => Array.isArray(x?.evidence_refs))),
    report_summary_has_customer_text: Boolean(allRoiSummaries.some((x) => typeof x?.customer_text === "string" && x.customer_text.length > 0)),
    low_confidence_has_customer_text: Boolean((Array.isArray(roiLedgerBlock?.low_confidence_items) ? roiLedgerBlock.low_confidence_items : []).every((x) => String(x?.customer_text ?? "").includes("可信度有限"))),
    default_assumption_not_measured_in_report: Boolean(allRoiSummaries.every((x) => x?.baseline_type !== "DEFAULT_ASSUMPTION" || x?.value_kind !== "MEASURED")),
    no_forbidden_types_in_report: Boolean(allRoiSummaries.every((x) => !["YIELD_INCREASE","PROFIT_INCREASE_FROM_YIELD","QUALITY_PREMIUM"].includes(x?.roi_type))),
  };

  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));

  process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
