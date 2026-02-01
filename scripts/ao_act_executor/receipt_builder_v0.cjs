#!/usr/bin/env node // Enable direct invocation if needed.
"use strict"; // Enforce strict mode for predictable behavior.

function assert(cond, msg) { // Provide a tiny assertion helper with stable error messages.
  if (!cond) throw new Error(msg); // Throw on failed condition to stop execution.
} // End block.

function mapTargetKindToCoverageKind(targetKind) { // Map task.target.kind to receipt.execution_coverage.kind.
  if (targetKind === "area") return "area"; // Preserve area mapping.
  if (targetKind === "path") return "path"; // Preserve path mapping.
  if (targetKind === "field") return "field"; // Preserve field mapping.
  throw new Error(`TARGET_KIND_INVALID:${String(targetKind)}`); // Reject unknown kinds deterministically.
} // End block.

function shallowCloneObject(obj) { // Clone an object without changing key order semantics.
  assert(obj && typeof obj === "object" && !Array.isArray(obj), "OBJ_REQUIRED"); // Require a plain object.
  return { ...obj }; // Use spread clone for shallow copy of own enumerable properties.
} // End block.

function validateObservedKeysAreSubsetOfSchema(taskRecordJson, observed) { // Enforce observed keys ⊆ parameter_schema.keys.
  const keys = (taskRecordJson?.payload?.parameter_schema?.keys ?? []); // Read schema keys from task payload.
  assert(Array.isArray(keys) && keys.length > 0, "TASK_PARAMETER_SCHEMA_KEYS_REQUIRED"); // Require non-empty schema keys.
  const allowed = new Set(keys.map((k) => String(k?.name ?? ""))); // Build allowed key set from schema.
  for (const k of Object.keys(observed)) { // Iterate observed keys.
    if (!allowed.has(k)) throw new Error(`OBSERVED_KEY_NOT_DECLARED:${k}`); // Reject any undeclared observed key.
  } // End block.
} // End block.

function buildReceiptPayloadV0(taskRecordJson, executorId, nowTs, observedParametersOverride, logsRefOverride) { // Build receipt payload strictly matching ao_act_receipt_v0 required fields.
  assert(taskRecordJson && typeof taskRecordJson === "object", "TASK_RECORD_JSON_REQUIRED"); // Require task record JSON.
  const payload = taskRecordJson.payload; // Alias the task payload for convenience.
  assert(payload && typeof payload === "object", "TASK_PAYLOAD_REQUIRED"); // Require task payload.
  assert(typeof payload.act_task_id === "string" && payload.act_task_id.length > 0, "TASK_ACT_TASK_ID_REQUIRED"); // Require act_task_id.
  assert(payload.target && typeof payload.target === "object", "TASK_TARGET_REQUIRED"); // Require target object.
  assert(typeof payload.target.kind === "string", "TASK_TARGET_KIND_REQUIRED"); // Require target.kind.
  assert(typeof payload.target.ref === "string" && payload.target.ref.length > 0, "TASK_TARGET_REF_REQUIRED"); // Require target.ref.
  assert(payload.time_window && typeof payload.time_window === "object", "TASK_TIME_WINDOW_REQUIRED"); // Require time_window.
  assert(typeof payload.time_window.start_ts === "number", "TASK_TIME_WINDOW_START_REQUIRED"); // Require time_window.start_ts.
  assert(typeof payload.time_window.end_ts === "number", "TASK_TIME_WINDOW_END_REQUIRED"); // Require time_window.end_ts.
  assert(payload.parameters && typeof payload.parameters === "object" && !Array.isArray(payload.parameters), "TASK_PARAMETERS_REQUIRED"); // Require parameters object.

  assert(executorId && typeof executorId === "object", "EXECUTOR_ID_REQUIRED"); // Require executor_id object.
  assert(typeof executorId.kind === "string" && executorId.kind.length > 0, "EXECUTOR_ID_KIND_REQUIRED"); // Require executor_id.kind.
  assert(typeof executorId.id === "string" && executorId.id.length > 0, "EXECUTOR_ID_ID_REQUIRED"); // Require executor_id.id.
  assert(typeof executorId.namespace === "string" && executorId.namespace.length > 0, "EXECUTOR_ID_NAMESPACE_REQUIRED"); // Require executor_id.namespace.

  const observedBase = observedParametersOverride ?? payload.parameters; // Default observed_parameters to task.parameters for deterministic sim.
  const observed = shallowCloneObject(observedBase); // Clone observed object to avoid accidental mutation.
  validateObservedKeysAreSubsetOfSchema(taskRecordJson, observed); // Ensure observed keys are declared in parameter_schema.

  const coverageKind = mapTargetKindToCoverageKind(payload.target.kind); // Derive execution_coverage.kind from target.kind.
  const coverageRef = payload.target.ref; // Derive execution_coverage.ref from target.ref.

  const logRef = logsRefOverride ?? { kind: "executor_log", ref: `local://ao_act/${payload.act_task_id}` }; // Provide at least one logs_refs entry.

  const receiptPayload = { // Construct receipt payload with only schema-allowed keys.
    act_task_id: payload.act_task_id, // Link receipt to task by act_task_id.
    executor_id: { kind: executorId.kind, id: executorId.id, namespace: executorId.namespace }, // Record executor identity for audit.
    execution_time: { start_ts: payload.time_window.start_ts, end_ts: payload.time_window.end_ts }, // Use task time_window as execution_time (v0 demo).
    execution_coverage: { kind: coverageKind, ref: coverageRef }, // Record coverage consistent with task target.
    resource_usage: { fuel_l: null, electric_kwh: null, water_l: null, chemical_ml: null }, // Provide required resource_usage fields as nulls.
    logs_refs: [ { kind: String(logRef.kind), ref: String(logRef.ref) } ], // Provide required logs_refs array with one entry.
    constraint_check: { violated: false, violations: [] }, // Provide required constraint_check with consistent values.
    observed_parameters: observed, // Provide observed_parameters consistent with task schema.
    created_at_ts: nowTs // Provide required created_at_ts audit timestamp.
  }; // End of receipt payload construction.

  return receiptPayload; // Return payload to be sent to /api/control/ao_act/receipt.
} // End block.

module.exports = { // Export stable builder API for executors and acceptance.
  buildReceiptPayloadV0, // Export receipt payload builder.
  validateObservedKeysAreSubsetOfSchema // Export validator for reuse in device mode.
}; // Line is part of control flow.
