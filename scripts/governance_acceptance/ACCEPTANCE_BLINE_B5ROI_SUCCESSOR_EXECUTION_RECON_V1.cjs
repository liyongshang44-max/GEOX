'use strict';

const fs = require('node:fs');

const task = 'BLINE_B5ROI_SUCCESSOR_EXECUTION_RECON_V1';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const roi = read('scripts/agronomy_acceptance/ACCEPTANCE_ROI_LEDGER_COMMERCIAL_V1.cjs');
const roiRoute = read('apps/server/src/routes/roi_ledger_v1.ts');

const checks = {
  successor_auto_task_consumed:
    roi.includes("decideApprovalJson?.act_task_id"),

  duplicate_positive_task_create_removed:
    !roi.includes("const taskResp = await fetchJson(`${base}/api/v1/actions/task`"),

  executor_actor_env_declared:
    roi.includes("EXECUTOR_ACTOR_ID"),

  receipt_builder_accepts_executor_actor:
    roi.includes('executor_actor_id,'),

  canonical_executor_identity_used:
    roi.includes("executor_id: { kind: 'script', id: executor_actor_id, namespace: 'executor_runtime_v1' }"),

  executor_token_used_for_receipt:
    roi.includes("token: executorToken") && roi.includes('/api/v1/actions/receipt'),

  successor_task_fact_consumed:
    roi.includes("'ao_act_task_v0'") && roi.includes('taskPayload'),

  successor_observed_parameters_derived:
    roi.includes('successorObservedParameters') &&
    roi.includes('parameter_schema') &&
    roi.includes('Object.fromEntries'),

  legacy_fixed_receipt_shape_removed:
    !roi.includes("observed_parameters: {\n      amount,\n      coverage_percent,\n      duration_min,\n    }"),

  receipt_execution_summary_materialized:
    roi.includes('execution_summary: { duration_min: executionDurationMin }'),

  roi_interim_trust_asserted:
    roi.includes('interim_roi_not_customer_visible') &&
    roi.includes('customer_visible_value === false'),

  commercial_child_does_not_formalize_roi:
    !roi.includes('/api/v1/roi-ledger/formalize-from-acceptance'),

  production_from_as_executed_remains_interim:
    roiRoute.includes('default_source_lane: "AS_EXECUTED_SIGNAL"') &&
    roiRoute.includes('customer_visible_value: false'),

  production_formalization_remains_separate:
    roiRoute.includes('/api/v1/roi-ledger/formalize-from-acceptance') &&
    roiRoute.includes('chain_validation_passed: true') &&
    roiRoute.includes('customer_visible_value: true'),

  commercial_safety_checks_preserved:
    roi.includes('roi_not_used_as_billing_source') &&
    roi.includes('no_forbidden_types') &&
    roi.includes('default_assumption_not_measured'),
};

const failed = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

console.log(JSON.stringify({ ok: failed.length === 0, task, checks }, null, 2));

if (failed.length > 0) process.exit(1);
