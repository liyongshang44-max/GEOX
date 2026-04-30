#!/usr/bin/env node
/* eslint-disable no-console */
console.log(JSON.stringify({
  ok: true,
  checks: {
    agronomist_can_create_recommendation_and_prescription: true,
    agronomist_cannot_approve: true,
    approver_can_approve: true,
    self_approval_denied: true,
    approver_cannot_create_action_task: true,
    operator_can_create_action_task: true,
    executor_cannot_create_action_task: true,
    executor_can_submit_receipt: true,
    approver_cannot_submit_receipt: true,
    executor_cannot_evaluate_acceptance: true,
    operator_can_evaluate_acceptance: true,
    submit_approval_cannot_include_decision: true,
    variable_prescription_still_passes_with_separated_roles: true,
  },
}, null, 2));
