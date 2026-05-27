#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(message) {
  console.error(`[route-response-ownership] FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

function bodyOf(source, startNeedle, endNeedle, label) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `${label}: missing section start: ${startNeedle}`);
  const end = endNeedle
    ? source.indexOf(endNeedle, start + startNeedle.length)
    : source.length;
  assert(end > start, `${label}: missing section end: ${endNeedle}`);
  return source.slice(start, end);
}

const files = {
  aoActPrimary: "apps/server/src/routes/v1/ao_act.ts",
  aoActControl: "apps/server/src/routes/control_ao_act.ts",
};

for (const rel of Object.values(files)) {
  assert(fs.existsSync(path.join(root, rel)), `missing required file: ${rel}`);
}

const aoActPrimary = read(files.aoActPrimary);
const aoActControl = read(files.aoActControl);

assertIncludes(
  aoActPrimary,
  "registerAoActV1Routes(app, pool)",
  "AO-ACT primary route"
);

assertNotIncludes(
  aoActPrimary,
  'app.addHook("preHandler"',
  "AO-ACT primary route must not register response-owning preHandler"
);

assertNotIncludes(
  aoActPrimary,
  "interceptVariablePrescriptionTaskV1",
  "AO-ACT primary route must not intercept variable prescription"
);

assertNotIncludes(
  aoActPrimary,
  "writeVariableTaskCandidateV1",
  "AO-ACT primary route must not write variable task candidate facts"
);

assertNotIncludes(
  aoActPrimary,
  "reply.send(",
  "AO-ACT primary route must not send responses"
);

const fromVariableRouteBlock = bodyOf(
  aoActControl,
  'app.post("/api/v1/actions/task/from-variable-prescription"',
  'app.post("/api/v1/actions/receipt"',
  "from-variable-prescription route"
);

assertIncludes(
  fromVariableRouteBlock,
  "buildVariableActionTaskPayloadV1",
  "from-variable-prescription route"
);

assertIncludes(
  fromVariableRouteBlock,
  "createAoActTaskCoreV1",
  "from-variable-prescription route"
);

assertIncludes(
  fromVariableRouteBlock,
  "ensureVariableOperationPlanV1",
  "from-variable-prescription route"
);

assertIncludes(
  fromVariableRouteBlock,
  'source: "api/v1/actions/task/from-variable-prescription"',
  "from-variable-prescription route"
);

assertNotIncludes(
  fromVariableRouteBlock,
  "postJsonInternal(",
  "from-variable-prescription route must not use internal HTTP subrequest"
);

assertNotIncludes(
  fromVariableRouteBlock,
  "reply.send(",
  "from-variable-prescription route must not explicitly send response"
);

assertNotIncludes(
  fromVariableRouteBlock,
  "sendErrorReply(",
  "from-variable-prescription route must not use explicit reply-sending error helper"
);

assertNotIncludes(
  fromVariableRouteBlock,
  'status: "ACKED"',
  "from-variable-prescription route must not write ACKED"
);

assertNotIncludes(
  fromVariableRouteBlock,
  'to_status: "ACKED"',
  "from-variable-prescription route must not transition to ACKED"
);

console.log("[route-response-ownership] PASS", {
  protected_routes: ["/api/v1/actions/task/from-variable-prescription"],
  response_owner: "apps/server/src/routes/control_ao_act.ts",
  forbidden_response_owner: "apps/server/src/routes/v1/ao_act.ts",
});
