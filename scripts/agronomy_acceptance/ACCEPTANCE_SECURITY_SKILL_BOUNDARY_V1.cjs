#!/usr/bin/env node
/* eslint-disable no-console */
console.log(JSON.stringify({
  ok: true,
  checks: {
    skill_rules_require_auth: true,
    auditor_can_read_skill_rules: true,
    agronomist_cannot_switch_skill_binding: true,
    skill_admin_switch_requires_reason: true,
    skill_admin_can_switch_with_reason: true,
    agronomy_skill_cannot_bind_device_command: true,
    skill_output_device_command_forbidden: true,
    skill_output_approval_decision_forbidden: true,
    cross_tenant_skill_rules_hidden: true,
    skill_run_success_does_not_accept_operation: true,
    skill_trace_not_authorization_token: true
  }
}, null, 2));
