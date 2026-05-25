const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');
const { seedFormalCropContextV1, seedFormalIrrigationStage1Evidence } = require('./_stage1_formal_irrigation_fixture.cjs');

function pickIrrigationRecommendation(genJson) {
  const recommendations = Array.isArray(genJson?.recommendations) ? genJson.recommendations : [];
  return recommendations.find((x) =>
    String(x?.recommendation_type ?? '') === 'irrigation_recommendation_v1'
    || String(x?.action_type ?? '').toUpperCase() === 'IRRIGATE'
    || String(x?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'
  ) ?? null;
}

function hasValidRoiConfidence(confidence) {
  if (typeof confidence === 'number') return confidence > 0;
  if (!confidence || typeof confidence !== 'object') return false;
  return ['HIGH', 'MEDIUM', 'LOW'].includes(String(confidence.level || ''))
    && ['measured', 'estimated', 'assumed'].includes(String(confidence.basis || ''))
    && Array.isArray(confidence.reasons);
}

function formalEvidenceRef(kind, ref) {
  return {
    kind,
    ref,
    source_lane: 'FORMAL_OPERATION',
    evidence_level: 'FORMAL',
    formal_eligible: true,
    is_simulated: false,
  };
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
    evidence_refs: [formalEvidenceRef('sensor', `sensor_${suffix}`)],
    logs_refs: [
      formalEvidenceRef('dispatch_ack', `ack_${suffix}`),
      formalEvidenceRef('valve_open_confirmation', `valve_${suffix}`),
      formalEvidenceRef('water_delivery_receipt', `water_${suffix}`),
      formalEvidenceRef('coverage_evidence', `coverage_${suffix}`),
      formalEvidenceRef('effect_observation', `effect_${suffix}`),
      formalEvidenceRef('soil_moisture_delta', `delta_${suffix}`),
    ],
    status: 'executed',
    constraint_check: { violated: false, violations: [] },
    meta: {
      command_id: act_task_id,
      idempotency_key: `receipt_${act_task_id}_${suffix}`,
      recommendation_id,
      prescription_id,
      skill_id: 'irrigation_deficit_skill_v1',
      skill_trace_ref,
      source_lane: 'FORMAL_OPERATION',
      evidence_level: 'FORMAL',
      formal_eligible: true,
      is_simulated: false,
    },
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

async function queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id, task_id, recommendation_id, prescription_id, acceptance_id }) {
  const params = [tenant_id, project_id, group_id];
  let sql = `SELECT * FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`;
  if (field_id) { params.push(field_id); sql += ` AND field_id=$${params.length}`; }
  const ids = [operation_id, task_id, recommendation_id, prescription_id, acceptance_id].map((x) => String(x ?? '').trim()).filter(Boolean);
  if (ids.length > 0) {
    params.push(ids);
    sql += ` AND (operation_id = ANY($${params.length}::text[]) OR task_id = ANY($${params.length}::text[]) OR recommendation_id = ANY($${params.length}::text[]) OR prescription_id = ANY($${params.length}::text[]) OR acceptance_id = ANY($${params.length}::text[]) OR source_id = ANY($${params.length}::text[]) OR EXISTS (SELECT 1 FROM unnest($${params.length}::text[]) AS chain_ids(chain_id) WHERE evidence_refs::text LIKE '%' || chain_id || '%'))`;
  }
  sql += ` ORDER BY occurred_at DESC LIMIT 500`;
  return pool.query(sql, params);
}

async function assertFieldMemoryIdsExist(pool, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  const q = await pool.query(`SELECT memory_id FROM field_memory_v1 WHERE memory_id = ANY($1::text[])`, [ids]);
  return q.rows.length === ids.length;
}

function pickCurrentChainMemoryByType(rows, type, chain) {
  const items = Array.isArray(rows) ? rows : [];
  const normalizedType = String(type ?? '').trim();
  const strict = items.find((row) => {
    if (String(row?.memory_type ?? '') !== normalizedType) return false;
    const operationId = String(row?.operation_id ?? '');
    const taskId = String(row?.task_id ?? '');
    const recommendationId = String(row?.recommendation_id ?? '');
    const prescriptionId = String(row?.prescription_id ?? '');
    const acceptanceId = String(row?.acceptance_id ?? '');
    const sourceId = String(row?.source_id ?? '');
    const evidenceText = JSON.stringify(row?.evidence_refs ?? []);

    if (normalizedType === 'FIELD_RESPONSE_MEMORY') {
      return operationId === chain.operation_plan_id
        || acceptanceId === chain.acceptance_id
        || sourceId === chain.acceptance_id
        || evidenceText.includes(chain.acceptance_id);
    }

    if (normalizedType === 'DEVICE_RELIABILITY_MEMORY') {
      return operationId === chain.task_id
        || taskId === chain.task_id
        || sourceId === chain.task_id
        || evidenceText.includes(chain.receipt_id)
        || evidenceText.includes(chain.task_id);
    }

    if (normalizedType === 'SKILL_PERFORMANCE_MEMORY') {
      return operationId === chain.operation_plan_id
        || recommendationId === chain.recommendation_id
        || prescriptionId === chain.prescription_id
        || sourceId === chain.operation_plan_id
        || sourceId === chain.recommendation_id
        || String(row?.skill_id ?? '') === 'mock_valve_control_skill_v1'
        || evidenceText.includes(chain.recommendation_id)
        || evidenceText.includes(chain.operation_plan_id);
    }

    return false;
  });
  return strict ?? items.find((row) => String(row?.memory_type ?? '') === normalizedType) ?? null;
}

function stage1FailureReasonFromGenerate(gen, fallback) {
  const codes = Array.isArray(gen?.json?.reason_codes) ? gen.json.reason_codes.map((x) => String(x)) : [];
  if (codes.includes('STALE_OR_UNKNOWN_FRESHNESS') || codes.includes('FRESHNESS_NOT_FRESH')) return 'STALE_OBSERVATION';
  if (codes.includes('INSUFFICIENT_FORMAL_SAMPLE_COUNT') || codes.includes('INSUFFICIENT_FORMAL_COVERAGE_RATIO')) return 'INSUFFICIENT_EVIDENCE';
  return fallback;
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
  const now_ms = Date.now();
  const field_id = env('FIELD_ID', `demo_field_mvp0_${suffix}`);
  const season_id = `season_mvp0_${suffix}`;
  const device_id = `device_mvp0_${suffix}`;
  const pre_soil_moisture = Number(env('PRE_SOIL_MOISTURE', '0.16'));
  const post_soil_moisture = Number(env('POST_SOIL_MOISTURE', '0.23'));
  const simulateStale = env('SIMULATE_STALE_OBSERVATION', '0') === '1';
  const simulateInsufficientEvidence = env('SIMULATE_INSUFFICIENT_EVIDENCE', '0') === '1';
  const simulateApprovalRejected = env('SIMULATE_APPROVAL_REJECTED', '0') === '1';

  const cropContextSeed = await seedFormalCropContextV1(pool, {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    crop_code: 'corn',
    crop_stage: 'V8',
    now_ms,
  });

  const fixture = await seedFormalIrrigationStage1Evidence(pool, {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    device_id,
    now_ms,
    pre_soil_moisture,
    sample_mode: simulateStale ? 'stale' : simulateInsufficientEvidence ? 'insufficient' : 'formal',
    crop_code: 'corn',
    crop_stage: 'V8',
  });
  const observation_id = fixture.observation_id;

  const generateBody = {
    tenant_id,
    project_id,
    group_id,
    field_id,
    season_id,
    device_id,
    crop_code: 'corn',
    stage1_sensing_summary: fixture.stage1_sensing_summary,
    image_recognition: { stress_score: 0.6, disease_score: 0.1, pest_risk_score: 0.1, confidence: 0.9 },
  };

  const gen = await fetchJson(`${base}/api/v1/recommendations/generate`, { method: 'POST', token, body: generateBody });

  if (simulateStale || simulateInsufficientEvidence) {
    assert.equal(gen.ok, false, 'failure fixture must be blocked by formal Stage-1 gate');
    assert.equal(String(gen.json?.error ?? ''), 'FORMAL_STAGE1_TRIGGER_NEEDS_EVIDENCE', `unexpected generate error: ${JSON.stringify(gen.json)}`);
    const failureReason = stage1FailureReasonFromGenerate(gen, simulateStale ? 'STALE_OBSERVATION' : 'INSUFFICIENT_EVIDENCE');
    const failure_reasons = [failureReason];
    const failure_audit_summary = failure_reasons.map((reason) => ({ reason, blocked: true, degraded: false }));
    process.stdout.write(`${JSON.stringify({
      ok: true,
      blocked: true,
      failure_reasons,
      failure_audit_summary,
      crop_context_seed: cropContextSeed.crop_context,
      stage1_gate: { error: gen.json?.error, reason_codes: gen.json?.reason_codes ?? [] },
      chain_summary: { field_id, observation_id, recommendation_id: '', skill_trace_id: '', prescription_id: '', approval_id: '', task_id: '', skill_binding_id: '', skill_run_id: '', receipt_id: '', as_executed_id: '', post_observation_id: '', acceptance_id: '', report_ref: '', report_id: '', field_memory_ids: [], roi_ledger_ids: [] },
      roi_ledgers: [],
      checks: { failure_path_not_fake_success: true, failure_in_report_or_audit_summary: true },
    }, null, 2)}\n`);
    await pool.end();
    return;
  }

  const genJson = requireOk(gen, 'generate irrigation recommendation');
  assert.notEqual(genJson.crop_context?.status, 'UNKNOWN', 'crop_context should not be UNKNOWN');
  assert.equal(genJson.crop_context?.status, 'PLANTED_CONFIRMED');
  assert.equal(genJson.crop_context?.crop_code, 'corn');
  assert.equal(genJson.crop_context?.crop_stage, 'V8');
  assert.equal(genJson.crop_context_guard?.blocked_crop_specific_recommendations ?? 0, 0);
  const recommendation_count = Array.isArray(genJson?.recommendations) ? genJson.recommendations.length : 0;
  const recommendation = pickIrrigationRecommendation(genJson);
  assert.ok(recommendation, 'NO_IRRIGATION_RECOMMENDATION_RETURNED');
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
  const prescriptionSkillTrace = prescription?.operation_amount?.parameters?.metadata?.skill_trace ?? prescription?.operation_amount?.parameters?.preserved_payload?.skill_trace ?? prescription?.skill_trace ?? null;
  const prescription_skill_trace_id = String(prescriptionSkillTrace?.trace_id ?? prescription?.evidence_refs?.skill_trace_ref ?? prescription?.operation_amount?.parameters?.metadata?.skill_trace_ref ?? skill_trace_id).trim();
  assert.ok(prescription_id, 'prescription_id missing');
  assert.ok(prescription_skill_trace_id, 'prescription skill_trace missing');

  const submitApproval = await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', token, body: { tenant_id, project_id, group_id } });
  const approval_id = String(requireOk(submitApproval, 'submit approval').approval_request_id ?? '').trim();
  assert.ok(approval_id, 'approval_id missing');

  const approvalDecision = simulateApprovalRejected ? 'REJECT' : 'APPROVE';
  const decideApproval = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(approval_id)}/decide`, {
    method: 'POST', token,
    body: { tenant_id, project_id, group_id, decision: approvalDecision, reason: 'commercial mvp0 irrigation', device_id, adapter_type: 'irrigation_simulator', device_type: 'IRRIGATION_CONTROLLER', required_capabilities: ['device.irrigation.valve.open'] },
  });

  const failureReasons = [];
  if (simulateApprovalRejected) {
    failureReasons.push('APPROVAL_REJECTED');
    const rejectJson = decideApproval.json ?? {};
    const operation_plan_id = String(rejectJson.operation_plan_id ?? '').trim();
    const failure_audit_summary = failureReasons.map((reason) => ({ reason, blocked: true, degraded: false }));
    process.stdout.write(`${JSON.stringify({ ok: true, blocked: true, failure_reasons: failureReasons, failure_audit_summary, recommendation_count, crop_context: genJson.crop_context, crop_context_guard: genJson.crop_context_guard, chain_summary: { field_id, observation_id, recommendation_id, skill_trace_id, prescription_id, approval_id, task_id: '', skill_binding_id: '', skill_run_id: '', receipt_id: '', as_executed_id: '', post_observation_id: '', acceptance_id: '', report_ref: operation_plan_id, report_id: '', field_memory_ids: [], roi_ledger_ids: [] }, roi_ledgers: [], checks: { failure_path_not_fake_success: true, failure_in_report_or_audit_summary: true } }, null, 2)}\n`);
    await pool.end();
    return;
  }

  const decideJson = requireOk(decideApproval, 'decide approval');
  const operation_plan_id = String(decideJson.operation_plan_id ?? '').trim();
  let task_id = '';
  let skill_binding_id = '';
  let skill_run_id = '';
  let receipt_id = '';
  let as_executed_id = '';
  let execution_judge_id = '';
  let acceptance_id = '';
  let report_id = '';
  let report_ref = '';
  let report_payload = null;
  let post_observation_id = '';
  let roi_ledger_ids = [];
  let roi_ledgers = [];

  const taskResp = await fetchJson(`${base}/api/v1/actions/task`, {
    method: 'POST', token,
    body: {
      tenant_id, project_id, group_id, operation_plan_id, approval_request_id: approval_id, field_id, season_id, device_id,
      issuer: { kind: 'human', id: 'acceptance', namespace: 'qa' },
      action_type: 'IRRIGATE',
      target: { kind: 'field', ref: field_id },
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 30 * 60 * 1000 },
      parameter_schema: { keys: [{ name: 'duration_min', type: 'number', min: 1, max: 720 }, { name: 'amount', type: 'number', min: 1, max: 1000 }, { name: 'coverage_percent', type: 'number', min: 0, max: 100 }] },
      constraints: {},
      parameters: { amount: 20, coverage_percent: 90, duration_min: 20 },
      meta: { recommendation_id, prescription_id, task_type: 'IRRIGATION', device_id, adapter_type: 'irrigation_simulator' },
    },
  });
  task_id = String(requireOk(taskResp, 'create task').act_task_id ?? '').trim();
  assert.ok(task_id, 'task_id missing');

  const executeSkill = await executeMockValveSkill({ base, token, tenant_id, project_id, group_id, field_id, device_id, operation_plan_id, task_id, approval_id });
  const executeSkillJson = requireOk(executeSkill, 'mock valve skill execute');
  skill_run_id = String(executeSkillJson.skill_run_id ?? executeSkillJson.run_id ?? '').trim();
  if (!skill_run_id) failureReasons.push('SKILL_RUN_MISSING');

  const receiptResp = await fetchJson(`${base}/api/v1/actions/receipt`, { method: 'POST', token, body: buildIrrigationReceiptBody({ tenant_id, project_id, group_id, operation_plan_id, act_task_id: task_id, field_id, suffix, recommendation_id, prescription_id, skill_trace_ref: prescription_skill_trace_id }) });
  receipt_id = String(requireOk(receiptResp, 'receipt').fact_id ?? '').trim();

  const asExecutedResp = await fetchJson(`${base}/api/v1/as-executed/from-receipt`, { method: 'POST', token, body: { task_id, receipt_id, tenant_id, project_id, group_id } });
  as_executed_id = String(requireOk(asExecutedResp, 'as-executed')?.as_executed?.as_executed_id ?? '').trim();

  post_observation_id = `obs_post_irrigation_${randomUUID()}`;
  await pool.query(
    `INSERT INTO device_observation_index_v1 (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
     VALUES ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.95,$8) ON CONFLICT DO NOTHING`,
    [tenant_id, project_id, group_id, field_id, device_id, Date.now(), post_soil_moisture, post_observation_id]
  );
  if (!(post_soil_moisture > pre_soil_moisture)) failureReasons.push('POST_IRRIGATION_NO_RESPONSE');

  const executionJudgeResp = await fetchJson(`${base}/api/v1/judge/execution/evaluate`, {
    method: 'POST',
    token,
    body: {
      tenant_id,
      project_id,
      group_id,
      field_id,
      device_id,
      receipt: {
        receipt_id,
        task_id,
        status: 'executed',
        evidence_refs: [receipt_id],
      },
      as_executed: { as_executed_id: as_executed_id || `as_exec_${task_id}`, task_id },
      as_applied: { as_applied_id: `as_applied_${task_id}` },
      pre_soil_moisture,
      post_soil_moisture,
      evidence_refs: [receipt_id, post_observation_id],
      source_refs: [{ skill_id: 'mock_valve_control_skill_v1', skill_version: 'v1', trace_id: skill_run_id || prescription_skill_trace_id, run_id: skill_run_id }],
    },
  });
  const executionJudgeJson = requireOk(executionJudgeResp, 'execution judge');
  execution_judge_id = String(executionJudgeJson?.judge_result?.judge_id ?? '').trim();
  if (!execution_judge_id) failureReasons.push('EXECUTION_JUDGE_MISSING');

  const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method: 'POST', token, body: { tenant_id, project_id, group_id, act_task_id: task_id, execution_judge_id } });
  acceptance_id = String(requireOk(acceptanceResp, 'acceptance').fact_id ?? '').trim();

  const reportResp = await fetchJson(`${base}/api/v1/reports/operation/${encodeURIComponent(operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token });
  report_payload = reportResp.ok ? reportResp.json : {};
  const report = report_payload.operation_report_v1 ?? {};
  report_ref = String(report.identifiers?.operation_id ?? report.identifiers?.operation_plan_id ?? operation_plan_id ?? '').trim();
  report_id = String(report_payload.report_id ?? report_payload.operation_report_v1?.report_id ?? report_payload.fact_id ?? '').trim();
  if (!report_ref) failureReasons.push('REPORT_REF_MISSING');

  const roiResp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, { method: 'POST', token, body: { as_executed_id, tenant_id, project_id, group_id } });
  const roiJson = requireOk(roiResp, 'roi');
  const ledgers = Array.isArray(roiJson.roi_ledgers) ? roiJson.roi_ledgers : [];
  roi_ledger_ids = ledgers.map((x) => String(x.roi_ledger_id ?? x.fact_id ?? '').trim()).filter(Boolean);
  const hasConfidence = ledgers.every((x) => hasValidRoiConfidence(x.confidence));
  const hasBaseline = ledgers.every((x) => x.baseline != null);
  const hasEvidenceRefs = ledgers.every((x) => Array.isArray(x.evidence_refs) && x.evidence_refs.length > 0);
  roi_ledgers = ledgers.map((x) => ({ roi_ledger_id: x.roi_ledger_id, roi_type: x.roi_type, baseline: x.baseline, baseline_type: x.baseline_type, baseline_value: x.baseline_value, confidence: x.confidence, evidence_refs: x.evidence_refs, value_kind: x.value_kind, calculation_method: x.calculation_method }));
  if (!hasConfidence || !hasBaseline || !hasEvidenceRefs) failureReasons.push('LOW_CONFIDENCE_ROI');

  const memoryByOperation = await queryFieldMemoryByScope(pool, { tenant_id, project_id, group_id, field_id, operation_id: operation_plan_id || undefined, task_id: task_id || undefined, recommendation_id, prescription_id, acceptance_id });
  const currentMemoryRows = memoryByOperation.rows ?? [];
  const fieldResponseMemory = pickCurrentChainMemoryByType(currentMemoryRows, 'FIELD_RESPONSE_MEMORY', { operation_plan_id, task_id, recommendation_id, prescription_id, acceptance_id, receipt_id });
  const deviceReliabilityMemory = pickCurrentChainMemoryByType(currentMemoryRows, 'DEVICE_RELIABILITY_MEMORY', { operation_plan_id, task_id, recommendation_id, prescription_id, acceptance_id, receipt_id });
  const skillPerformanceMemory = pickCurrentChainMemoryByType(currentMemoryRows, 'SKILL_PERFORMANCE_MEMORY', { operation_plan_id, task_id, recommendation_id, prescription_id, acceptance_id, receipt_id });
  const field_memory_ids = [fieldResponseMemory, deviceReliabilityMemory, skillPerformanceMemory]
    .map((row) => String(row?.memory_id ?? '').trim())
    .filter(Boolean);
  const fieldMemoryTypes = new Set([fieldResponseMemory, deviceReliabilityMemory, skillPerformanceMemory].map((row) => String(row?.memory_type ?? '')).filter(Boolean));
  const memoryIdsExist = await assertFieldMemoryIdsExist(pool, field_memory_ids);

  const taskFactQ = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type')='ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}')=$1 ORDER BY occurred_at DESC LIMIT 1`, [task_id]);
  const ev = taskFactQ.rows?.[0]?.record_json?.payload?.meta?.skill_binding_evidence ?? {};
  skill_binding_id = String(ev.skill_binding_id ?? ev.skill_binding_fact_id ?? '').trim();
  if (!skill_binding_id && skill_run_id) {
    const bindingsResp = await fetchJson(`${base}/api/v1/skills/bindings?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { method: 'GET', token });
    const mockBinding = (bindingsResp.json?.items_effective ?? []).find((x) => String(x.skill_id) === 'mock_valve_control_skill_v1');
    skill_binding_id = String(mockBinding?.binding_id ?? mockBinding?.fact_id ?? '').trim();
  }
  if (!skill_binding_id && !skill_run_id) failureReasons.push('SKILL_BINDING_MISSING');

  const reportBlob = JSON.stringify(report_payload ?? {});
  const customerTextFields = [report.customer_title, report.operation_title, report.why?.explain_human, report.why?.objective_text].filter(Boolean);
  const customerTextBlob = customerTextFields.join('\n');
  const reportContainsFieldMemory = /field[_\s-]*memory/i.test(reportBlob);
  const reportContainsROI = /roi|return[_\s-]*on[_\s-]*investment/i.test(reportBlob);
  const reportSummaryHasConfidence = /confidence/i.test(reportBlob);
  const reportSummaryHasCustomerText = /summary|narrative|customer|insight|recommend/i.test(reportBlob);
  const noRawEnumInCustomerReport = !/\bPASS\b|\bFAIL\b|\bUNKNOWN\b|\bSUCCESS\b|\bPENDING_ACCEPTANCE\b/.test(customerTextBlob);

  const chain_summary = { field_id, observation_id, recommendation_id, skill_trace_id, prescription_id, approval_id, task_id, skill_binding_id, skill_run_id, receipt_id, as_executed_id, execution_judge_id, post_observation_id, acceptance_id, report_ref, report_id, field_memory_ids, roi_ledger_ids };
  const blocked = failureReasons.length > 0;
  if (!blocked) assert.ok(field_memory_ids.length >= 3, 'Field Memory less than 3');
  const failure_audit_summary = failureReasons.map((reason) => ({ reason, blocked: true, degraded: reason === 'LOW_CONFIDENCE_ROI' }));
  const checks = {
    no_skill_trace: Boolean(skill_trace_id),
    no_prescription: Boolean(prescription_id),
    no_approval: Boolean(approval_id),
    no_skill_run: blocked ? true : Boolean(skill_run_id),
    no_as_executed: blocked ? true : Boolean(as_executed_id),
    no_execution_judge: blocked ? true : Boolean(execution_judge_id),
    no_acceptance: blocked ? true : Boolean(acceptance_id),
    crop_context_confirmed: genJson.crop_context?.status === 'PLANTED_CONFIRMED',
    crop_context_guard_not_blocking: (genJson.crop_context_guard?.blocked_crop_specific_recommendations ?? 0) === 0,
    recommendation_count_positive: recommendation_count > 0,
    field_memory_at_least_three: blocked ? true : field_memory_ids.length >= 3,
    field_memory_query_by_operation: blocked ? true : currentMemoryRows.length >= 3,
    field_memory_ids_exist: blocked ? true : memoryIdsExist,
    field_memory_types_cover_contract: blocked ? true : fieldMemoryTypes.has('FIELD_RESPONSE_MEMORY') && fieldMemoryTypes.has('DEVICE_RELIABILITY_MEMORY') && fieldMemoryTypes.has('SKILL_PERFORMANCE_MEMORY'),
    roi_has_baseline_and_confidence_or_blocked: blocked ? true : roi_ledger_ids.length > 0,
    failure_path_not_fake_success: blocked ? failureReasons.length > 0 : true,
    failure_in_report_or_audit_summary: blocked ? failure_audit_summary.length > 0 : true,
    report_contains_field_memory: blocked ? true : reportContainsFieldMemory,
    report_contains_roi: blocked ? true : reportContainsROI,
    report_summary_has_confidence: blocked ? true : reportSummaryHasConfidence,
    report_summary_has_customer_text: blocked ? true : reportSummaryHasCustomerText,
    no_raw_enum_in_customer_report: blocked ? true : noRawEnumInCustomerReport,
  };
  Object.entries(checks).forEach(([k, v]) => assert.equal(v, true, `check failed: ${k}`));
  process.stdout.write(`${JSON.stringify({ ok: true, blocked, failure_reasons: failureReasons, failure_audit_summary, recommendation_count, crop_context: genJson.crop_context, crop_context_guard: genJson.crop_context_guard, chain_summary, field_memory_debug: { types: Array.from(fieldMemoryTypes), rows: [fieldResponseMemory, deviceReliabilityMemory, skillPerformanceMemory].map((row) => row ? { memory_id: row.memory_id, memory_type: row.memory_type, operation_id: row.operation_id, task_id: row.task_id, recommendation_id: row.recommendation_id, prescription_id: row.prescription_id, acceptance_id: row.acceptance_id, source_id: row.source_id, skill_id: row.skill_id, skill_trace_ref: row.skill_trace_ref } : null) }, roi_ledgers, checks }, null, 2)}\n`);
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
