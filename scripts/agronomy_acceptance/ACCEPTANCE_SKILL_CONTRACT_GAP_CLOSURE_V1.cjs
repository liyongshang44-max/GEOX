const { Pool } = require('pg');
const { env, fetchJson } = require('./_common.cjs');
const { seedFormalCropContextV1, seedFormalIrrigationStage1Evidence } = require('./_stage1_formal_irrigation_fixture.cjs');

const TASK_NAME = 'COMMERCIAL_MVP0_B_SKILL_CONTRACT_GAP_CLOSURE_FIX';
const toPassFail = (v) => v ? 'PASS' : 'FAIL';

function requireOk(resp, label) {
  if (!resp?.ok || resp?.json?.ok !== true) {
    throw new Error(JSON.stringify({ reason: 'HTTP_REQUEST_FAILED', label, status: resp?.status, response: resp?.json ?? {} }));
  }
  return resp.json;
}

function pickIrrigationRecommendation(genJson) {
  const recommendations = Array.isArray(genJson?.recommendations) ? genJson.recommendations : [];
  return recommendations.find((x) =>
    String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1'
    || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE'
    || String(x?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'
  ) ?? null;
}

function buildIrrigationReceiptBody({ tenant_id, project_id, group_id, operation_plan_id, act_task_id, field_id, suffix, recommendation_id, prescription_id, skill_trace_ref }) {
  return {
    tenant_id,
    project_id,
    group_id,
    operation_plan_id,
    act_task_id,
    executor_id: { kind: 'script', id: 'acceptance_executor', namespace: 'qa' },
    execution_time: { start_ts: Date.now() - 20_000, end_ts: Date.now() - 5_000 },
    execution_coverage: { kind: 'field', ref: field_id },
    resource_usage: { fuel_l: 0, electric_kwh: 0, water_l: 20, chemical_ml: 0 },
    observed_parameters: { amount: 20, coverage_percent: 90, duration_min: 20 },
    evidence_refs: [{ kind: 'sensor', ref: `sensor_${suffix}` }],
    logs_refs: [
      { kind: 'dispatch_ack', ref: `ack_${suffix}` },
      { kind: 'valve_open_confirmation', ref: `valve_${suffix}` },
      { kind: 'water_delivery_receipt', ref: `water_${suffix}` },
    ],
    status: 'executed',
    constraint_check: { violated: false, violations: [] },
    meta: { command_id: act_task_id, idempotency_key: `receipt_${act_task_id}_${suffix}`, recommendation_id, prescription_id, skill_id: 'irrigation_deficit_skill_v1', skill_trace_ref },
  };
}

async function executeMockValveSkill({ base, token, tenant_id, project_id, group_id, field_id, device_id, operation_plan_id, task_id, approval_id }) {
  return fetchJson(`${base}/api/v1/skill/execute`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      skill_id: 'mock_valve_control_skill_v1',
      version: 'v1',
      category: 'DEVICE',
      bind_target: 'mock_valve',
      field_id,
      device_id,
      operation_id: operation_plan_id,
      operation_plan_id,
      input: { task_id, approval_id, command: 'OPEN', duration_sec: 1200, required_capabilities: ['device.irrigation.valve.open'] },
    },
  });
}

async function queryFieldMemoryByOperationOrTask(pool, { tenant_id, project_id, group_id, operation_plan_id, act_task_id }) {
  return pool.query(
    `SELECT * FROM field_memory_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND (operation_id=$4 OR task_id=$5)
      ORDER BY occurred_at DESC LIMIT 500`,
    [tenant_id, project_id, group_id, operation_plan_id, act_task_id]
  );
}

async function main() {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  const checks = {
    irrigation_deficit_skill_query_or_register: 'FAIL',
    mock_valve_control_skill_query_or_register: 'FAIL',
    skill_contract_fields_complete: 'FAIL',
    skill_binding_created_or_found: 'FAIL',
    crop_context_confirmed: 'FAIL',
    crop_context_guard_not_blocking: 'FAIL',
    recommendation_count_positive: 'FAIL',
    recommendation_has_skill_trace: 'FAIL',
    prescription_keeps_skill_trace: 'FAIL',
    task_binds_device_skill: 'FAIL',
    mock_valve_skill_run_created: 'FAIL',
    field_memory_refs_skill_id: 'FAIL',
    roi_refs_skill_trace_or_source_skill: 'FAIL',
    approval_required_before_device_skill: 'FAIL',
    memory_query_by_operation: 'FAIL',
  };
  const failure_paths = {
    device_skill_blocked_without_approval: 'FAIL',
    capability_mismatch_blocked: 'FAIL',
  };
  const ids = { field_id: '', recommendation_id: '', skill_trace_id: '', prescription_id: '', approval_id: '', task_id: '', skill_binding_id: '', skill_run_id: '', field_memory_ids: [], roi_id: '' };

  try {
    const suffix = Date.now();
    const now_ms = Date.now();
    const field_id = `field_gap_closure_${suffix}`;
    const season_id = `season_gap_closure_${suffix}`;
    const device_id = `device_gap_closure_${suffix}`;
    ids.field_id = field_id;

    const skillA = await fetchJson(`${base}/api/v1/skills/irrigation_deficit_skill_v1?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    const skillB = await fetchJson(`${base}/api/v1/skills/mock_valve_control_skill_v1?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    checks.irrigation_deficit_skill_query_or_register = toPassFail(skillA.ok && skillA.json?.ok === true);
    checks.mock_valve_control_skill_query_or_register = toPassFail(skillB.ok && skillB.json?.ok === true);

    const requiredContract = (s) => Boolean(s?.skill_category && s?.risk_level && s?.enabled === true && s?.definition?.input_schema_ref && s?.definition?.output_schema_ref && Array.isArray(s?.capabilities) && s.capabilities.length > 0 && Array.isArray(s?.required_evidence) && s.required_evidence.length > 0 && s?.binding_conditions && s?.fallback_policy && s?.audit_policy);
    checks.skill_contract_fields_complete = toPassFail(requiredContract(skillA.json) && requiredContract(skillB.json));

    const bindingsResp = await fetchJson(`${base}/api/v1/skills/bindings?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    const bindingItems = bindingsResp.json?.items_effective ?? [];
    const mockBinding = bindingItems.find((x) => String(x.skill_id) === 'mock_valve_control_skill_v1');
    if (mockBinding) ids.skill_binding_id = String(mockBinding.binding_id ?? mockBinding.fact_id ?? '');
    checks.skill_binding_created_or_found = toPassFail(Boolean(mockBinding));

    await seedFormalCropContextV1(pool, { tenant_id, project_id, group_id, field_id, season_id, crop_code: 'corn', crop_stage: 'V8', now_ms });
    const fixture = await seedFormalIrrigationStage1Evidence(pool, { tenant_id, project_id, group_id, field_id, season_id, device_id, now_ms, pre_soil_moisture: 0.16, sample_mode: 'formal', crop_code: 'corn', crop_stage: 'V8' });

    const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
      method: 'POST',
      token,
      body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn', stage1_sensing_summary: fixture.stage1_sensing_summary, image_recognition: { stress_score: 0.7, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 } },
    });
    const genJson = requireOk(gen, 'generate recommendation');
    checks.crop_context_confirmed = toPassFail(genJson.crop_context?.status === 'PLANTED_CONFIRMED' && genJson.crop_context?.crop_code === 'corn' && genJson.crop_context?.crop_stage === 'V8');
    checks.crop_context_guard_not_blocking = toPassFail((genJson.crop_context_guard?.blocked_crop_specific_recommendations ?? 0) === 0);
    const recommendation_count = Array.isArray(genJson?.recommendations) ? genJson.recommendations.length : 0;
    checks.recommendation_count_positive = toPassFail(recommendation_count > 0);
    if (checks.crop_context_confirmed !== 'PASS') throw new Error(JSON.stringify({ reason: 'CROP_CONTEXT_NOT_CONFIRMED', crop_context: genJson.crop_context }));
    if (checks.crop_context_guard_not_blocking !== 'PASS') throw new Error(JSON.stringify({ reason: 'CROP_CONTEXT_GUARD_BLOCKED', crop_context_guard: genJson.crop_context_guard }));
    const recommendation = pickIrrigationRecommendation(genJson);
    if (!recommendation?.skill_trace) throw new Error(JSON.stringify({ reason: 'MISSING_SKILL_TRACE', recommendation_generate_response: genJson }));
    ids.recommendation_id = String(recommendation.recommendation_id ?? '');
    ids.skill_trace_id = String(recommendation.skill_trace.trace_id ?? '');
    checks.recommendation_has_skill_trace = toPassFail(String(recommendation.skill_trace.skill_id ?? '') === 'irrigation_deficit_skill_v1' && ids.skill_trace_id.length > 0);

    const prescriptionResp = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
      method: 'POST',
      token,
      body: { tenant_id, project_id, group_id, field_id, season_id, device_id, crop_id: 'corn', recommendation_id: ids.recommendation_id, zone_id: null, device_requirements: { device_id, device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'], adapter_type: 'irrigation_simulator' }, operation_amount: { amount: 20, unit: 'mm', parameters: { duration_min: 20, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] } } },
    });
    const prescription = requireOk(prescriptionResp, 'create prescription').prescription ?? {};
    ids.prescription_id = String(prescription.prescription_id ?? '');
    const pTraceRef = String(prescription?.evidence_refs?.skill_trace_ref ?? prescription?.operation_amount?.parameters?.metadata?.skill_trace_ref ?? '').trim();
    checks.prescription_keeps_skill_trace = toPassFail(Boolean(pTraceRef || prescription?.operation_amount?.parameters?.metadata?.skill_trace));

    const submit = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(ids.prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } });
    ids.approval_id = String(requireOk(submit, 'submit approval').approval_request_id ?? '');

    const runtimeNoApproval = await executeMockValveSkill({ base, token, tenant_id, project_id, group_id, field_id, device_id, operation_plan_id: `op_pre_${suffix}`, task_id: `task_pre_${suffix}`, approval_id: undefined });
    const runtimeBadApproval = await executeMockValveSkill({ base, token, tenant_id, project_id, group_id, field_id, device_id, operation_plan_id: `op_pre2_${suffix}`, task_id: `task_pre2_${suffix}`, approval_id: `bad_approval_${suffix}` });
    const noApprovalBlocked = Number(runtimeNoApproval.status) === 403 && String(runtimeNoApproval.json?.error ?? '') === 'APPROVAL_REQUIRED' && Number(runtimeBadApproval.status) === 403 && String(runtimeBadApproval.json?.error ?? '') === 'DEVICE_SKILL_EXECUTION_BLOCKED';
    checks.approval_required_before_device_skill = toPassFail(noApprovalBlocked);
    failure_paths.device_skill_blocked_without_approval = toPassFail(noApprovalBlocked);

    const mismatchTaskResp = await fetchJson(`${base}/api/v1/actions/task`, {
      method: 'POST',
      token,
      body: { tenant_id, project_id, group_id, operation_plan_id: `op_plan_mismatch_${suffix}`, approval_request_id: ids.approval_id, field_id, season_id, device_id, issuer: { kind: 'human', id: 'qa', namespace: 'qa' }, action_type: 'SPRAY', target: { kind: 'field', ref: field_id }, time_window: { start_ts: Date.now(), end_ts: Date.now() + 3600000 }, parameter_schema: { keys: [{ name: 'amount', type: 'number', min: 1, max: 1000 }, { name: 'coverage_percent', type: 'number', min: 0, max: 100 }, { name: 'duration_min', type: 'number', min: 1, max: 720 }] }, parameters: { amount: 20, coverage_percent: 90, duration_min: 20 }, constraints: {}, meta: { device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.sprayer.execute'] } },
    });
    const mismatchTaskId = String(mismatchTaskResp.json?.act_task_id ?? '');
    let mismatchBoundToMockValve = false;
    if (mismatchTaskId) {
      const mismatchTaskFactQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1 ORDER BY occurred_at DESC LIMIT 1`, [mismatchTaskId]);
      mismatchBoundToMockValve = String(mismatchTaskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence?.device_skill_id ?? '') === 'mock_valve_control_skill_v1';
    }
    failure_paths.capability_mismatch_blocked = toPassFail(!mismatchBoundToMockValve);

    const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(ids.approval_id)}/decide`, {
      method: 'POST',
      token,
      body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'gap closure approval', device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] },
    });
    const operation_plan_id = String(requireOk(decide, 'decide approval').operation_plan_id ?? `op_gap_${suffix}`);

    const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, operation_plan_id, approval_request_id: ids.approval_id, field_id, season_id, device_id, issuer: { kind: 'human', id: 'qa', namespace: 'qa' }, action_type: 'IRRIGATE', target: { kind: 'field', ref: field_id }, time_window: { start_ts: Date.now(), end_ts: Date.now() + 3600000 }, parameter_schema: { keys: [{ name: 'amount', type: 'number', min: 1, max: 1000 }, { name: 'coverage_percent', type: 'number', min: 0, max: 100 }, { name: 'duration_min', type: 'number', min: 1, max: 720 }] }, parameters: { amount: 20, coverage_percent: 90, duration_min: 20 }, constraints: {}, meta: { recommendation_id: ids.recommendation_id, prescription_id: ids.prescription_id, skill_trace_ref: ids.skill_trace_id, device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] } },
    });
    ids.task_id = String(requireOk(taskResp, 'create task').act_task_id ?? '');

    const executeSkill = await executeMockValveSkill({ base, token, tenant_id, project_id, group_id, field_id, device_id, operation_plan_id, task_id: ids.task_id, approval_id: ids.approval_id });
    const executeSkillJson = requireOk(executeSkill, 'mock valve skill execute');
    ids.skill_run_id = String(executeSkillJson.skill_run_id ?? executeSkillJson.run_id ?? '').trim();
    checks.mock_valve_skill_run_created = toPassFail(ids.skill_run_id.length > 0);

    const taskFactQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1 ORDER BY occurred_at DESC LIMIT 1`, [ids.task_id]);
    const ev = taskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence ?? {};
    ids.skill_binding_id = ids.skill_binding_id || String(ev.skill_binding_id ?? ev.skill_binding_fact_id ?? '');
    checks.task_binds_device_skill = toPassFail(ids.task_id.length > 0 && ids.skill_binding_id.length > 0 && ids.skill_run_id.length > 0);

    const receipt = await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: buildIrrigationReceiptBody({ tenant_id, project_id, group_id, operation_plan_id, act_task_id: ids.task_id, field_id, suffix, recommendation_id: ids.recommendation_id, prescription_id: ids.prescription_id, skill_trace_ref: ids.skill_trace_id }) });
    const receipt_fact_id = String(requireOk(receipt, 'receipt').fact_id ?? '');
    if (receipt_fact_id) await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, act_task_id: ids.task_id } });

    const memoryQ = await pool.query(`SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 ORDER BY occurred_at DESC LIMIT 500`, [tenant_id, project_id, group_id, field_id]);
    const memoryByOperationQ = await queryFieldMemoryByOperationOrTask(pool, { tenant_id, project_id, group_id, operation_plan_id, act_task_id: ids.task_id });
    const memRows = memoryQ.rows ?? [];
    ids.field_memory_ids = memRows.map((x) => String(x.memory_id)).filter(Boolean);
    const memDevice = memRows.find((x) => String(x.memory_type) === 'DEVICE_RELIABILITY_MEMORY' && String(x.skill_id) === 'mock_valve_control_skill_v1');
    const memSkill = memRows.find((x) => String(x.memory_type) === 'SKILL_PERFORMANCE_MEMORY' && String(x.skill_id) === 'irrigation_deficit_skill_v1' && String(x.skill_trace_ref ?? '').trim());
    checks.field_memory_refs_skill_id = toPassFail(Boolean(memDevice && memSkill));
    checks.memory_query_by_operation = toPassFail((memoryByOperationQ.rows ?? []).length > 0);

    const asExec = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { tenant_id, project_id, group_id, task_id: ids.task_id, receipt_id: receipt_fact_id } });
    const as_executed_id = String(requireOk(asExec, 'as executed').as_executed?.as_executed_id ?? '');
    const roi = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { tenant_id, project_id, group_id, as_executed_id, skill_trace_id: ids.skill_trace_id, skill_refs: [{ skill_id: 'irrigation_deficit_skill_v1', trace_id: ids.skill_trace_id || undefined }] } });
    const roiRows = requireOk(roi, 'roi').roi_ledgers ?? [];
    ids.roi_id = String(roiRows?.[0]?.roi_ledger_id ?? '');
    const roiRefOk = roiRows.some((x) => String(x.source_skill_id ?? '').trim() || String(x.skill_trace_ref ?? '').trim() || (Array.isArray(x.skill_refs) && x.skill_refs.some((s) => String(s.skill_id).trim())) || String(x.skill_trace_id ?? '').trim());
    checks.roi_refs_skill_trace_or_source_skill = toPassFail(roiRefOk);

    const allPass = Object.values(checks).every((x) => x === 'PASS') && Object.values(failure_paths).every((x) => x === 'PASS');
    process.stdout.write(`${JSON.stringify({ ok: allPass, task: TASK_NAME, checks, failure_paths, recommendation_count, crop_context: genJson.crop_context, crop_context_guard: genJson.crop_context_guard, ids }, null, 2)}\n`);
    if (!allPass) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ ok: false, task: TASK_NAME, checks, failure_paths, ids, failed_reason: message }, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
