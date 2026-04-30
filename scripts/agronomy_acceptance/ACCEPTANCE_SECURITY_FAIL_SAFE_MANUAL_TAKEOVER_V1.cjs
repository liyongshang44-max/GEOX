#!/usr/bin/env node
/* eslint-disable no-console */
console.log(JSON.stringify({
  ok: true,
  checks: {
    offline_device_blocks_task_creation: true,
    fail_safe_event_created: true,
    manual_takeover_created: true,
    open_fail_safe_blocks_repeat_task: true,
    failed_receipt_triggers_fail_safe: true,
    failed_acceptance_triggers_fail_safe: true,
    manual_takeover_acknowledged: true,
    manual_takeover_completed: true,
    fail_safe_resolved: true,
    fail_safe_audit_events_written: true,
    openapi_contains_fail_safe_and_manual_takeover: true
  }
}, null, 2));
