#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const operator = fs.readFileSync("apps/server/src/routes/v1/operator_dispatch_actions.ts", "utf8");
const executor = fs.readFileSync("apps/executor/src/run_dispatch_once.ts", "utf8");
const failures = [];
function assert(ok, code) { if (!ok) failures.push(code); }
function ordered(src, tokens, code) {
  let pos = -1;
  for (const token of tokens) {
    const next = src.indexOf(token, pos + 1);
    if (next < 0 || next <= pos) { failures.push(code + ":" + token); return; }
    pos = next;
  }
}

assert(operator.includes("async function writeDispatchIntentFact("), "OPERATOR_INTENT_WRITER_MISSING");
assert(operator.includes('"DISPATCH_REQUESTED" | "RETRY_DISPATCH_REQUESTED"'), "OPERATOR_INTENT_STATUS_CONTRACT_MISSING");
assert(operator.includes("dispatch_intent: true"), "OPERATOR_DISPATCH_INTENT_FLAG_MISSING");
assert(operator.includes("delivery_confirmed: false"), "OPERATOR_DELIVERY_FALSE_MISSING");
assert(operator.includes("acknowledgement_confirmed: false"), "OPERATOR_ACK_FALSE_MISSING");
assert(operator.includes("requested_at,"), "OPERATOR_REQUESTED_AT_MISSING");
assert(!operator.includes("async function writeDispatchFact("), "LEGACY_OPERATOR_DELIVERY_WRITER_FORBIDDEN");
assert(operator.includes('const nextStatus = action === "TASK_DISPATCH" ? "DISPATCH_REQUESTED" : "RETRY_DISPATCH_REQUESTED";'), "OPERATOR_ACTION_MUST_RETURN_REQUESTED_STATUS");
assert(operator.includes('raw.includes("DISPATCH") && (raw.includes("REQUEST") || raw.includes("PENDING"))'), "OPERATOR_REQUESTED_STATUS_MUST_NORMALIZE_PENDING");
assert(operator.includes('dispatch_requested_at: dispatchRequestedAt'), "WORKLIST_REQUEST_TIMESTAMP_MISSING");
assert(operator.includes('dispatched_at: dispatchedAt'), "WORKLIST_DELIVERY_TIMESTAMP_MISSING");

ordered(executor, [
  'await writeDispatchState(args, task, "DISPATCHED")',
  "const execution = await adapter.execute({",
  'await writeDispatchState(args, task, "ACKED")'
], "EXECUTOR_TRANSPORT_AUTHORITY_ORDER_CHANGED");

console.log("BLINE_OPERATOR_DISPATCH_INTENT_STATS " + JSON.stringify({
  operator_delivery_authority: false,
  operator_intent_statuses: ["DISPATCH_REQUESTED", "RETRY_DISPATCH_REQUESTED"],
  worklist_intent_projection: "DISPATCH_PENDING",
  executor_transport_boundary_preserved: true,
  failures: failures.length
}));
for (const f of failures) console.error("FAIL " + f);
if (failures.length) {
  console.error("BLINE_OPERATOR_DISPATCH_INTENT_FAIL count=" + failures.length);
  process.exitCode = 1;
} else {
  console.log("BLINE_OPERATOR_DISPATCH_INTENT_PASS");
}
