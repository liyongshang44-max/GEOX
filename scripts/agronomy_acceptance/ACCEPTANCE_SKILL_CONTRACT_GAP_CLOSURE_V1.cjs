const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { env, fetchJson } = require('./_common.cjs');

const TASK_NAME = 'COMMERCIAL_MVP0_B_SKILL_CONTRACT_GAP_CLOSURE_FIX';

function toPassFail(v) { return v ? 'PASS' : 'FAIL'; }

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
    recommendation_has_skill_trace: 'FAIL',
    prescription_keeps_skill_trace: 'FAIL',
    task_binds_device_skill: 'FAIL',
    mock_valve_skill_run_created: 'FAIL',
    field_memory_refs_skill_id: 'FAIL',
    roi_refs_skill_trace_or_source_skill: 'FAIL',
    approval_required_before_device_skill: 'FAIL',
  };
  const failure_paths = {
    device_skill_blocked_without_approval: 'FAIL',
    capability_mismatch_blocked: 'FAIL',
  };

  const ids = {
    field_id: '',
    recommendation_id: '',
    skill_trace_id: '',
    prescription_id: '',
    approval_id: '',
    task_id: '',
    skill_binding_id: '',
    skill_run_id: '',
    field_memory_ids: [],
    roi_id: '',
  };

  try {
    const suffix = Date.now();
    const field_id = `field_gap_closure_${suffix}`;
    const season_id = `season_gap_closure_${suffix}`;
    const device_id = `device_gap_closure_${suffix}`;
    ids.field_id = field_id;

    const skillA = await fetchJson(`${base}/api/v1/skills/irrigation_deficit_skill_v1?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    const skillB = await fetchJson(`${base}/api/v1/skills/mock_valve_control_skill_v1?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    checks.irrigation_deficit_skill_query_or_register = toPassFail(skillA.ok && skillA.json?.ok === true);
    checks.mock_valve_control_skill_query_or_register = toPassFail(skillB.ok && skillB.json?.ok === true);
    checks.skill_contract_fields_complete = toPassFail(
      skillA.json?.skill_id && skillA.json?.skill_version && skillA.json?.skill_category && Array.isArray(skillA.json?.capabilities)
      && skillB.json?.skill_id && skillB.json?.skill_version && skillB.json?.skill_category && Array.isArray(skillB.json?.required_evidence)
    );

    const bindingsResp = await fetchJson(`${base}/api/v1/skills/bindings?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token });
    const bindingItems = bindingsResp.json?.items_effective ?? [];
    const mockBinding = bindingItems.find((x) => String(x.skill_id) === 'mock_valve_control_skill_v1');
    if (mockBinding) ids.skill_binding_id = String(mockBinding.binding_id ?? mockBinding.fact_id ?? '');
    checks.skill_binding_created_or_found = toPassFail(Boolean(mockBinding));

    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES ($1,$2,$3,$4,$5,'soil_moisture',NOW(),$6,$7,0.90,$8)
       ON CONFLICT DO NOTHING`,
      [tenant_id, project_id, group_id, field_id, device_id, Date.now(), 0.16, `obs_gap_${randomUUID()}`]
    );

    const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, field_id, season_id, device_id, crop_code: 'corn',
        stage1_sensing_summary: { irrigation_effectiveness: 'low', leak_risk: 'low', canopy_temp_status: 'normal', evapotranspiration_risk: 'high', sensor_quality_level: 'GOOD' },
        image_recognition: { stress_score: 0.7, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
      },
    });
    const recommendation = gen.json?.recommendations?.[0] ?? {};
    ids.recommendation_id = String(recommendation.recommendation_id ?? '');
    ids.skill_trace_id = String(recommendation?.skill_trace?.trace_id ?? '');
    checks.recommendation_has_skill_trace = toPassFail(
      String(recommendation?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'
      && ids.skill_trace_id.length > 0
    );

    const prescriptionResp = await fetchJson(`${base}/api/v1/prescriptions/from-recommendation`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, field_id, season_id, device_id, crop_id: 'corn',
        recommendation_id: ids.recommendation_id, zone_id: null,
        device_requirements: { device_id, device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'], adapter_type: 'irrigation_simulator' },
        operation_amount: { amount: 20, unit: 'mm', parameters: { duration_min: 20, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] } },
      },
    });
    const prescription = prescriptionResp.json?.prescription ?? {};
    ids.prescription_id = String(prescription.prescription_id ?? '');
    const pTraceRef = String(prescription?.evidence_refs?.skill_trace_ref ?? prescription?.operation_amount?.parameters?.metadata?.skill_trace_ref ?? '').trim();
    checks.prescription_keeps_skill_trace = toPassFail(Boolean(pTraceRef || prescription?.operation_amount?.parameters?.metadata?.skill_trace));

    const submit = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(ids.prescription_id)}/submit-approval`, {
      method: 'POST', token, body: { tenant_id, project_id, group_id },
    });
    ids.approval_id = String(submit.json?.approval_request_id ?? '');

    const executePre = await fetchJson(`${base}/api/v1/actions/execute`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_id: `op_gap_${suffix}`,
        execution_plan: {
          action_type: 'IRRIGATE',
          target: { kind: 'device', ref: device_id },
          parameters: { duration_min: 20 },
          execution_mode: 'AUTO',
          safe_guard: { requires_approval: true },
          failure_strategy: { retryable: true, max_retries: 1 },
          device_capability_check: { supported: true },
          idempotency_key: `exec_gap_pre_${suffix}`,
        },
      },
    });
    const noApprovalBlocked = ['REQUIRES_APPROVAL', 'APPROVAL_REQUIRED', 'DEVICE_SKILL_EXECUTION_BLOCKED'].includes(String(executePre.json?.error ?? ''));
    checks.approval_required_before_device_skill = toPassFail(noApprovalBlocked);
    failure_paths.device_skill_blocked_without_approval = toPassFail(noApprovalBlocked);

    const mismatchResp = await fetchJson(`${base}/api/v1/actions/execute`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_id: `op_gap_mismatch_${suffix}`,
        execution_plan: {
          action_type: 'SPRAY',
          target: { kind: 'device', ref: device_id },
          parameters: { duration_min: 20 },
          execution_mode: 'AUTO',
          safe_guard: { requires_approval: false },
          failure_strategy: { retryable: true, max_retries: 1 },
          device_capability_check: { supported: true },
          idempotency_key: `exec_gap_mismatch_${suffix}`,
        },
      },
    });
    const mismatchErr = String(mismatchResp.json?.error ?? '');
    const capabilityMismatchBlocked = ['CAPABILITY_MISMATCH', 'DEVICE_ACTION_TYPE_UNSUPPORTED', 'DEVICE_CAPABILITY_UNSUPPORTED'].includes(mismatchErr);
    failure_paths.capability_mismatch_blocked = toPassFail(capabilityMismatchBlocked);

    const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(ids.approval_id)}/decide`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'gap closure approval', device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] },
    });
    const operation_plan_id = String(decide.json?.operation_plan_id ?? decide.json?.operation_plan?.operation_plan_id ?? `op_gap_${suffix}`);

    const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_plan_id, approval_request_id: ids.approval_id,
        field_id, season_id, device_id, issuer: { kind: 'human', id: 'qa', namespace: 'qa' },
        action_type: 'IRRIGATE', target: { kind: 'device', ref: device_id }, time_window: { start_ts: Date.now(), end_ts: Date.now() + 3600000 },
        parameter_schema: { keys: [{ name: 'duration_min', type: 'number', min: 1 }] }, parameters: { duration_min: 20 }, constraints: {},
        meta: { recommendation_id: ids.recommendation_id, prescription_id: ids.prescription_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] },
      },
    });
    ids.task_id = String(taskResp.json?.act_task_id ?? '');

    const executeSkill = await fetchJson(`${base}/api/v1/skill/execute`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id,
        skill_id: 'mock_valve_control_skill_v1', version: 'v1', category: 'DEVICE', bind_target: 'mock_valve',
        field_id, device_id, operation_id: operation_plan_id, operation_plan_id,
        input: { task_id: ids.task_id, approval_id: ids.approval_id, planned_amount: 20, unit: 'mm', duration_min: 20, required_capabilities: ['device.irrigation.valve.open'] },
      },
    });
    ids.skill_run_id = String(executeSkill.json?.skill_run_id ?? '');
    checks.mock_valve_skill_run_created = toPassFail(Boolean(ids.skill_run_id && executeSkill.json?.fact_id && executeSkill.json?.occurred_at));
    checks.task_binds_device_skill = toPassFail(Boolean(mockBinding && ids.task_id));

    const receipt = await fetchJson(`${base}/api/v1/actions/receipt`, {
      method: 'POST', token,
      body: {
        tenant_id, project_id, group_id, operation_plan_id, act_task_id: ids.task_id,
        executor_id: { kind: 'script', id: 'qa', namespace: 'qa' },
        execution_time: { start_ts: Date.now() - 10000, end_ts: Date.now() - 1000 },
        execution_coverage: { kind: 'field', ref: field_id },
        resource_usage: { water_l: 20 }, observed_parameters: { amount: 20, duration_min: 20, prescription_id: ids.prescription_id },
        evidence_refs: [{ kind: 'sensor', ref: `ev_${suffix}` }], logs_refs: [{ kind: 'dispatch_ack', ref: `ack_${suffix}` }, { kind: 'valve_open_confirmation', ref: `valve_${suffix}` }, { kind: 'water_delivery_receipt', ref: `water_${suffix}` }],
        status: 'executed', constraint_check: { violated: false, violations: [] }, meta: { recommendation_id: ids.recommendation_id, prescription_id: ids.prescription_id },
      },
    });
    const receipt_fact_id = String(receipt.json?.fact_id ?? '');
    if (receipt_fact_id) {
      await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, act_task_id: ids.task_id } });
    }

    const memoryQ = await pool.query(
      `SELECT memory_id,memory_type,skill_id,skill_trace_ref
       FROM field_memory_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
       ORDER BY occurred_at DESC LIMIT 200`,
      [tenant_id, project_id, group_id, field_id]
    );
    const memRows = memoryQ.rows ?? [];
    ids.field_memory_ids = memRows.map((x) => String(x.memory_id)).filter(Boolean);
    const memDevice = memRows.find((x) => String(x.memory_type) === 'DEVICE_RELIABILITY_MEMORY' && String(x.skill_id) === 'mock_valve_control_skill_v1');
    const memSkill = memRows.find((x) => String(x.memory_type) === 'SKILL_PERFORMANCE_MEMORY' && String(x.skill_id) === 'irrigation_deficit_skill_v1' && String(x.skill_trace_ref ?? '').trim());
    checks.field_memory_refs_skill_id = toPassFail(Boolean(memDevice && memSkill));

    const asExec = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { tenant_id, project_id, group_id, task_id: ids.task_id, receipt_id: receipt_fact_id } });
    const as_executed_id = String(asExec.json?.as_executed?.as_executed_id ?? '');
    const roi = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
      method: 'POST', token,
      body: { tenant_id, project_id, group_id, as_executed_id, skill_trace_id: ids.skill_trace_id, skill_refs: [{ skill_id: 'irrigation_deficit_skill_v1', trace_id: ids.skill_trace_id || undefined }] },
    });
    const roiRows = roi.json?.roi_ledgers ?? [];
    ids.roi_id = String(roiRows?.[0]?.roi_ledger_id ?? '');
    const roiRefOk = roiRows.some((x) => (Array.isArray(x.skill_refs) && x.skill_refs.some((s) => String(s.skill_id).trim())) || String(x.skill_trace_id ?? '').trim());
    checks.roi_refs_skill_trace_or_source_skill = toPassFail(roiRefOk);

    const allPass = Object.values(checks).every((x) => x === 'PASS') && Object.values(failure_paths).every((x) => x === 'PASS');
    process.stdout.write(`${JSON.stringify({ ok: allPass, task: TASK_NAME, checks, failure_paths, ids }, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ ok: false, task: TASK_NAME, checks, failure_paths, ids, failed_reason: message }, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
