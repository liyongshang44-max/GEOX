'use strict';

const fs = require('node:fs');

const TASK =
  'BLINE_B5IRR_COMMERCIAL_IRRIGATION_SUCCESSOR_RECON_V1';

const target =
  'scripts/agronomy_acceptance/ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs';

const src = fs.readFileSync(target, 'utf8');

const checks = {};
const pass = (value) => value === true;

const selectorStart =
  src.indexOf('function pickIrrigationRecommendation');
const selectorEnd =
  src.indexOf('function hasValidRoiConfidence', selectorStart);

const selector =
  selectorStart >= 0 && selectorEnd > selectorStart
    ? src.slice(selectorStart, selectorEnd)
    : '';

checks.selector_uses_requirement_successor =
  selector.includes('irrigation_requirement_skill_v1');

checks.selector_removes_deficit_primary_fallback =
  selector.length > 0
  && !selector.includes(
    "String(x?.skill_trace?.skill_id ?? '') === 'irrigation_deficit_skill_v1'"
  );

const receiptStart =
  src.indexOf('function buildIrrigationReceiptBody');
const receiptEnd =
  src.indexOf('async function executeMockValveSkill', receiptStart);

const receipt =
  receiptStart >= 0 && receiptEnd > receiptStart
    ? src.slice(receiptStart, receiptEnd)
    : '';

checks.receipt_accepts_executor_actor =
  receipt.includes('executor_actor_id');

checks.receipt_uses_canonical_executor_identity =
  receipt.includes('executor_runtime_v1')
  && !receipt.includes("'acceptance_executor'")
  && !receipt.includes("namespace: 'qa'");

checks.receipt_accepts_successor_observed_parameters =
  receipt.includes('observed_parameters');

checks.receipt_removes_fixed_legacy_shape =
  !receipt.includes(
    'observed_parameters: { amount: 20, coverage_percent: 90, duration_min: 20 }'
  );

checks.receipt_materializes_execution_summary =
  receipt.includes('execution_summary')
  && receipt.includes('duration_min');

checks.receipt_skill_identity_not_hardcoded_to_deficit =
  !receipt.includes(
    "skill_id: 'irrigation_deficit_skill_v1'"
  );

const mainStart =
  src.indexOf('(async () => {');

const main =
  mainStart >= 0 ? src.slice(mainStart) : '';

const decideAt =
  main.indexOf(
    "const decideJson = requireOk(decideApproval, 'decide approval');"
  );

const afterDecide =
  decideAt >= 0 ? main.slice(decideAt) : '';

checks.successor_auto_task_consumed =
  afterDecide.includes('decideJson.act_task_id');

checks.duplicate_positive_task_create_removed =
  afterDecide.length > 0
  && !afterDecide.includes('/api/v1/actions/task');

checks.executor_runtime_inputs_declared =
  main.includes("EXECUTOR_TOKEN")
  && main.includes("EXECUTOR_ACTOR_ID");

checks.executor_token_used_for_receipt =
  main.includes('token: executorToken');

checks.successor_task_fact_consumed =
  afterDecide.includes('ao_act_task_v0');

checks.successor_task_schema_consumed =
  afterDecide.includes('parameter_schema')
  && afterDecide.includes('successorTaskSchemaKeys');

checks.successor_observed_parameters_derived =
  afterDecide.includes('successorObservedParameters')
  && afterDecide.includes('Object.fromEntries');

checks.successor_observed_parameters_used_in_receipt =
  afterDecide.includes(
    'observed_parameters: successorObservedParameters'
  );

checks.mock_valve_execution_preserved =
  src.includes('executeMockValveSkill')
  && src.includes("skill_id: 'mock_valve_control_skill_v1'");

checks.formal_field_response_not_auto_required =
  !afterDecide.includes(
    "fieldMemoryTypes.has('FIELD_RESPONSE_MEMORY')"
  );

checks.formal_field_memory_not_auto_promoted_check_present =
  afterDecide.includes(
    'formal_field_memory_not_auto_promoted'
  );

checks.technical_memory_not_customer_visible_check_present =
  afterDecide.includes(
    'technical_memory_not_customer_visible'
  );

checks.technical_memory_not_learning_eligible_check_present =
  afterDecide.includes(
    'technical_memory_not_learning_eligible'
  );

checks.technical_memory_contract_preserved =
  afterDecide.includes('DEVICE_RELIABILITY_MEMORY')
  && afterDecide.includes('SKILL_PERFORMANCE_MEMORY');

checks.interim_roi_trust_boundary_asserted =
  afterDecide.includes('AS_EXECUTED_SIGNAL')
  && afterDecide.includes('INTERIM_SUPPORTED')
  && afterDecide.includes('customer_visible_value')
  && afterDecide.includes('interim_roi_not_customer_visible');

checks.no_formal_roi_promotion_in_child =
  !src.includes(
    '/api/v1/roi-ledger/formalize-from-acceptance'
  );

checks.stale_failure_path_preserved =
  src.includes('SIMULATE_STALE_OBSERVATION')
  && src.includes('STALE_OBSERVATION');

checks.insufficient_failure_path_preserved =
  src.includes('SIMULATE_INSUFFICIENT_EVIDENCE')
  && src.includes('INSUFFICIENT_EVIDENCE');

checks.rejected_failure_path_preserved =
  src.includes('SIMULATE_APPROVAL_REJECTED')
  && src.includes('APPROVAL_REJECTED');

const rendered = Object.fromEntries(
  Object.entries(checks).map(
    ([key, value]) => [key, pass(value) ? 'PASS' : 'FAIL']
  )
);

const ok =
  Object.values(checks).every(pass);

process.stdout.write(
  JSON.stringify(
    {
      ok,
      task: TASK,
      checks: rendered,
    },
    null,
    2
  ) + '\n'
);

if (!ok) {
  process.exitCode = 1;
}