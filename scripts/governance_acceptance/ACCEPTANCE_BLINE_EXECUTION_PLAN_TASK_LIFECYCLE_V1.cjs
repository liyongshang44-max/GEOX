#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const ao = fs.readFileSync("apps/server/src/routes/control_ao_act.ts", "utf8");
const taskService = fs.readFileSync("apps/server/src/domain/controlplane/task_service.ts", "utf8");
const approval = fs.readFileSync("apps/server/src/routes/control_approval_request_v1.ts", "utf8");
const operationState = fs.readFileSync("apps/server/src/projections/operation_state_v1.ts", "utf8");
const fieldProgram = fs.readFileSync("apps/server/src/projections/field_program_state_v1.ts", "utf8");

const failures = [];
function assert(ok, code) { if (!ok) failures.push(code); }
function between(src, start, end) {
  const a = src.indexOf(start);
  if (a < 0) return "";
  const b = src.indexOf(end, a + start.length);
  return src.slice(a, b < 0 ? undefined : b);
}
function ordered(src, tokens, code) {
  let pos = -1;
  for (const token of tokens) {
    const next = src.indexOf(token, pos + 1);
    if (next < 0 || next <= pos) { failures.push(code + ":" + token); return; }
    pos = next;
  }
}

// 1. Generic Task core is downstream-only of an existing ready Plan.
assert(ao.includes("async function requireReadyOperationPlanForApprovedActionTaskV1("), "READY_PLAN_GUARD_MISSING");
assert(ao.includes("OPERATION_PLAN_REQUIRED_BEFORE_TASK"), "TASK_WITHOUT_PLAN_FAIL_CLOSED_MISSING");
assert(ao.includes("OPERATION_PLAN_NOT_READY_FOR_TASK"), "TASK_WITH_NONREADY_PLAN_FAIL_CLOSED_MISSING");
assert(ao.includes("OPERATION_PLAN_TASK_ALREADY_CREATED"), "DUPLICATE_PLAN_TASK_FAIL_CLOSED_MISSING");
assert(!ao.includes("ensureOperationPlanForApprovedActionTaskV1"), "TASK_CORE_PLAN_AUTO_CREATE_FORBIDDEN");

const taskCore = between(ao, "async function createAoActTaskCoreV1(", "async function handleAoActTaskV1");
ordered(taskCore, [
  "await requireReadyOperationPlanForApprovedActionTaskV1",
  "const act_task_id =",
  'type: "ao_act_task_v0"'
], "TASK_CORE_ORDER_INVALID");
assert(!taskCore.includes('type: "operation_plan_v1"'), "TASK_CORE_OPERATION_PLAN_WRITE_FORBIDDEN");
assert(!taskCore.includes('type: "operation_plan_transition_v1"'), "TASK_CORE_PLAN_TRANSITION_WRITE_FORBIDDEN");

// 2. Variable lane expresses READY_TO_DISPATCH directly before Task.
const variablePlan = between(ao, "async function ensureReadyVariableOperationPlanV1(", "async function requireReadyOperationPlanForApprovedActionTaskV1");
assert(variablePlan.includes('status: "READY_TO_DISPATCH"'), "VARIABLE_PLAN_READY_STATUS_MISSING");
assert(variablePlan.includes('ack_status: "ACK_REQUIRED"'), "VARIABLE_PLAN_ACK_REQUIRED_MISSING");
assert(variablePlan.includes('dispatch_status: "NOT_DISPATCHED"'), "VARIABLE_PLAN_NOT_DISPATCHED_MISSING");
assert(!variablePlan.includes('status: "ACKED"'), "VARIABLE_PLAN_AUTO_ACK_FORBIDDEN");
assert(!variablePlan.includes('reason: "VARIABLE_ACTION_TASK_CREATED"'), "VARIABLE_PLAN_TASK_CREATED_TRANSITION_FORBIDDEN");

const variableRoute = between(ao, 'app.post("/api/v1/actions/task/from-variable-prescription"', 'app.post("/api/v1/actions/receipt"');
ordered(variableRoute, [
  "await ensureReadyVariableOperationPlanV1",
  "await createAoActTaskCoreV1"
], "VARIABLE_PLAN_MUST_PRECEDE_TASK");

// 3. Compatibility approval route in task_service: Decision -> Plan APPROVED -> READY -> Task.
const taskApproval = between(taskService, 'app.post("/api/v1/approvals/:request_id/decide"', 'app.post("/api/v1/ao-act/tasks"');
ordered(taskApproval, [
  'type: "approval_decision_v1"',
  'next_status: "APPROVED"',
  'next_status: "READY"',
  'fetchJson(`${hostBaseUrl(req)}/api/v1/actions/task`'
], "TASK_SERVICE_AUTHORITY_ORDER_INVALID");
assert((taskApproval.match(/type: "approval_decision_v1"/g) || []).length === 1, "TASK_SERVICE_DECISION_DUPLICATE");
assert(taskApproval.includes('act_task_id: null'), "TASK_SERVICE_DECISION_MUST_NOT_REFERENCE_FUTURE_TASK");
assert(taskApproval.includes('trigger: "approval_ready_for_task"'), "TASK_SERVICE_READY_TRIGGER_INVALID");
assert(!taskApproval.includes('trigger: "task_created"'), "TASK_SERVICE_TASK_CREATED_MUST_NOT_CREATE_READY_AUTHORITY");

// 4. Legacy /approvals/approve compatibility keeps external task response but orders authority.
const approvalRoute = between(approval, "async function handleApprovalApprove", "export function registerApprovalRequestV1Routes");
ordered(approvalRoute, [
  "const autoTaskDecisionRecord",
  "await ensureCompatibilityApprovalPlanReadyV1",
  'const aoResp = await fetch(`${buildInternalBaseUrl(req)}/api/v1/actions/task`'
], "LEGACY_APPROVAL_AUTHORITY_ORDER_INVALID");
assert(approvalRoute.includes('act_task_id: null'), "LEGACY_DECISION_MUST_NOT_REFERENCE_FUTURE_TASK");
assert(!approvalRoute.includes("auto_task_issued: true"), "LEGACY_DECISION_DOWNSTREAM_RESULT_CLAIM_FORBIDDEN");

const compatibilityPlan = between(approval, "async function ensureCompatibilityApprovalPlanReadyV1(", "function logLegacyApprovalWarning");
ordered(compatibilityPlan, [
  'status: "CREATED"',
  'status: "APPROVED"',
  'status: "READY"'
], "LEGACY_PLAN_LIFECYCLE_ORDER_INVALID");
assert(compatibilityPlan.includes('approval_decision_fact_id: input.approval_decision_fact_id'), "LEGACY_PLAN_DECISION_PROVENANCE_MISSING");

// 5. Manual bootstrap returns explicit Task linkage; consumers must not derive Task existence from Plan detail.
const manualRoute = between(ao, 'app.post("/api/v1/operations/manual"', '\n\n}');
assert(manualRoute.includes("const act_task_id = String(approvalDecision.json.act_task_id"), "MANUAL_BOOTSTRAP_EXPLICIT_TASK_LINKAGE_MISSING");
assert(manualRoute.includes("MISSING_ACT_TASK_ID"), "MANUAL_BOOTSTRAP_TASK_LINKAGE_FAIL_CLOSED_MISSING");
assert(manualRoute.includes("act_task_id,"), "MANUAL_BOOTSTRAP_RESPONSE_TASK_LINKAGE_MISSING");

// 6. Read models cannot promote ready/dispatch/ack/task-exists into execution.
assert(!operationState.includes('["DONE", "SUCCEEDED", "SUCCESS", "EXECUTED", "ACKED"]'), "ACKED_RECEIPT_EXECUTED_INFLATION_FORBIDDEN");
assert(!operationState.includes('["READY", "DISPATCHED"].includes(status)) return "TASK_CREATED"'), "PLAN_STATUS_TASK_SYNTHESIS_FORBIDDEN");
assert(!operationState.includes('["EXECUTING", "RUNNING", "IN_PROGRESS", "DISPATCHED", "READY", "APPROVED"].includes(s)'), "PREEXECUTION_RUNNING_INFLATION_FORBIDDEN");
assert(!operationState.includes('(task_id ? "RUNNING" : "PENDING")'), "TASK_EXISTENCE_RUNNING_INFLATION_FORBIDDEN");
assert(!fieldProgram.includes('["EXECUTING", "RUNNING", "IN_PROGRESS", "DISPATCHED", "ACKED"].includes(ps)'), "PROGRAM_DISPATCH_ACK_EXECUTING_INFLATION_FORBIDDEN");
assert(fieldProgram.includes('["EXECUTING", "RUNNING", "IN_PROGRESS"].includes(ps)'), "PROGRAM_EXECUTION_EVIDENCE_SET_MISSING");

console.log("BLINE_EXECUTION_PLAN_TASK_LIFECYCLE_STATS " + JSON.stringify({
  task_core_requires_ready_plan: true,
  task_core_plan_writes: 0,
  variable_auto_ack: false,
  task_service_decision_before_ready_before_task: true,
  legacy_approval_decision_before_ready_before_task: true,
  manual_bootstrap_explicit_task_linkage: true,
  projection_preexecution_inflation: false,
  failures: failures.length
}));

for (const code of failures) console.error("FAIL " + code);
if (failures.length) {
  console.error("BLINE_EXECUTION_PLAN_TASK_LIFECYCLE_FAIL count=" + failures.length);
  process.exitCode = 1;
} else {
  console.log("BLINE_EXECUTION_PLAN_TASK_LIFECYCLE_PASS");
}
