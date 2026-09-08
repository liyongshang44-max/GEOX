const fs = require('node:fs');

const TASK_NAME = 'BLINE_B5F5_COMMERCIAL_IRRIGATION_SUCCESSOR_CONSUMPTION_V1';
const target = 'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs';
const src = fs.readFileSync(target, 'utf8');

const passFail = (v) => v ? 'PASS' : 'FAIL';
const checks = {};

const selectorStart = src.indexOf('function pickIrrigationRecommendation');
const selectorEnd = src.indexOf('function hasValidRoiConfidence', selectorStart);
const selectorBlock = selectorStart >= 0 && selectorEnd > selectorStart
  ? src.slice(selectorStart, selectorEnd)
  : '';

checks.irrigation_selector_uses_requirement_primary = passFail(
  selectorBlock.includes("irrigation_requirement_skill_v1")
);
checks.irrigation_selector_no_deficit_primary_fallback = passFail(
  selectorBlock.length > 0 && !selectorBlock.includes("irrigation_deficit_skill_v1")
);

const receiptBuilderStart = src.indexOf('function buildIrrigationReceiptBody');
const receiptBuilderEnd = src.indexOf('async function executeMockValveSkill', receiptBuilderStart);
const receiptBuilder = receiptBuilderStart >= 0 && receiptBuilderEnd > receiptBuilderStart
  ? src.slice(receiptBuilderStart, receiptBuilderEnd)
  : '';

checks.receipt_builder_accepts_successor_observed_parameters = passFail(
  receiptBuilder.includes('observed_parameters')
  && receiptBuilder.includes('observed_parameters,')
);
checks.receipt_builder_no_legacy_fixed_observed_shape = passFail(
  !receiptBuilder.includes('observed_parameters: { amount: 20, coverage_percent: 90, duration_min: 20 }')
);
checks.receipt_builder_no_stale_deficit_skill_hardcode = passFail(
  !receiptBuilder.includes("skill_id: 'irrigation_deficit_skill_v1'")
);

const decideAt = src.indexOf("const decideJson = requireOk(decideApproval, 'decide approval');");
const afterDecide = decideAt >= 0 ? src.slice(decideAt) : '';
checks.decide_result_captured = passFail(decideAt >= 0);
checks.task_consumed_from_decide = passFail(
  afterDecide.includes('decideJson.act_task_id')
);
checks.no_second_task_create_after_decide = passFail(
  afterDecide.length > 0 && !afterDecide.includes('/api/v1/actions/task')
);

checks.successor_task_payload_loaded = passFail(
  afterDecide.includes("(record_json::jsonb->>'type')='ao_act_task_v0'")
  && afterDecide.includes('parameter_schema')
  && afterDecide.includes('parameters')
);
checks.successor_observed_parameters_derived = passFail(
  afterDecide.includes('successorTaskSchemaKeys')
  && afterDecide.includes('successorObservedParameters')
  && afterDecide.includes('Object.fromEntries')
);
checks.receipt_consumes_successor_observed_parameters = passFail(
  afterDecide.includes('observed_parameters: successorObservedParameters')
);
checks.receipt_skill_identity_derived_from_canonical_trace = passFail(
  afterDecide.includes('prescription_skill_id')
  && afterDecide.includes('source_skill_id: prescription_skill_id')
);
checks.mock_valve_execution_preserved = passFail(
  afterDecide.includes('executeMockValveSkill')
  && src.includes("skill_id: 'mock_valve_control_skill_v1'")
);

const ok = Object.values(checks).every((x) => x === 'PASS');
process.stdout.write(`${JSON.stringify({ ok, task: TASK_NAME, checks }, null, 2)}\n`);
if (!ok) process.exitCode = 1;
