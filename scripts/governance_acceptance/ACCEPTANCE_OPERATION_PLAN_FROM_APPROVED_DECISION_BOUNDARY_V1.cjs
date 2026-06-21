// scripts/governance_acceptance/ACCEPTANCE_OPERATION_PLAN_FROM_APPROVED_DECISION_BOUNDARY_V1.cjs
const fs = require("fs");
const path = require("path");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail ? ` ${JSON.stringify(detail)}` : "";
    throw new Error(`${message}${suffix}`);
  }
  console.log(`PASS: ${message}`);
}

function extractFunctionBody(source, functionName) {
  const signatureIndex = source.indexOf(`function ${functionName}`);
  assert(signatureIndex >= 0, `${functionName} exists`);
  const openIndex = source.indexOf("{", signatureIndex);
  assert(openIndex >= 0, `${functionName} has a body`);

  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, i);
  }

  throw new Error(`${functionName} body is not balanced`);
}

function walkFiles(root, predicate) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const routeFile = "apps/server/src/routes/control_approval_request_v1.ts";
const builderFile = "apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts";
const projectionFile = "apps/server/src/projections/operation_plan_index_v1.ts";
const authzFile = "apps/server/src/auth/ao_act_authz_v0.ts";
const rolesFile = "apps/server/src/domain/auth/roles.ts";

const route = read(routeFile);
const routeHandler = extractFunctionBody(route, "handleCreateOperationPlanFromApprovalDecision");
const builder = read(builderFile);
const projection = read(projectionFile);
const auth = `${read(authzFile)}\n${read(rolesFile)}`;

assert(route.includes("/api/v1/operator/approval-decisions/:decision_id/create-operation-plan"), "route exists");
assert(route.includes("approval_decision_v1"), "H38 route module reads approval_decision_v1");
assert(route.includes("approval_request_v1"), "H38 route module reads approval_request_v1 transition");
assert(routeHandler.includes("operation_plan_v1"), "H38 handler writes operation_plan_v1");
assert(routeHandler.includes("operator_approval_decision_operation_plan_submission_v1"), "H38 handler writes submission fact");
assert(routeHandler.includes("operation.plan.create"), "H38 handler requires operation.plan.create scope");
assert(routeHandler.includes("latestScopedApprovalDecisionById"), "H38 handler uses scoped approval-decision lookup");
assert(routeHandler.includes("latestApprovalRequestApprovedTransitionForDecision"), "H38 handler uses scoped approval-request-transition lookup");

for (const forbidden of [
  "operation_plan_transition_v1",
  "/api/v1/actions/task",
  "ao_act_task_v0",
  "dispatch_v1",
  "roi_ledger_v1",
  "field_memory_v1",
  "action.task.create",
  "action.task.dispatch",
]) {
  assert(!routeHandler.includes(forbidden), `H38 handler does not create/call ${forbidden}`);
}

for (const forbidden of [
  "operation_plan_transition_v1",
  "ao_act_task_v0",
  "dispatch_v1",
  "roi_ledger_v1",
  "field_memory_v1",
]) {
  assert(!projection.includes(forbidden), `projection helper does not create ${forbidden}`);
}

assert(!/from\s+["']pg["']|from\s+["']fastify["']|routes\//.test(builder), "builder does not import pg / Fastify / routes");
assert(!builder.includes("process.env"), "builder does not read process.env");
assert(!/Date\.now|new Date|randomUUID/.test(builder), "builder does not use Date.now / new Date / randomUUID");
assert(builder.split(/\r?\n/).length > 100, "builder is expanded into auditable multi-function structure");
assert(builder.includes("operation_plan_transition_created") && builder.includes("receipt_created"), "builder guards transition and receipt artifacts");
assert(builder.includes("buildEvidenceRefs"), "builder derives evidence refs from source lineage");

assert(auth.includes("operation.plan.create"), "operation.plan.create scope exists");
assert(/admin:\s*\["\*"\]/.test(auth), "admin role can use operation.plan.create by wildcard");
assert(/operator:\s*\[[^\]]*operation\.plan\.create/.test(auth), "operator role gets operation.plan.create");
assert(!/approver:\s*\[[^\]]*operation\.plan\.create/.test(auth), "approver role does not get operation.plan.create");

const customerFiles = [
  ...walkFiles("apps/server/src/routes", (file) => /\.(ts|tsx|js|jsx)$/.test(file) && /customer|report|dashboard|operations/.test(file)),
  ...walkFiles("apps/web/src", (file) => /\.(ts|tsx|js|jsx)$/.test(file) && /customer|report|dashboard|operations/.test(file)),
];
const customerText = customerFiles.map(read).join("\n");
assert(!customerText.includes("operator_approval_decision_operation_plan_submission_v1"), "customer route/web files do not expose submission fact");
assert(!/confirmed delivery[\s\S]{0,200}operation_plan_v1|operation_plan_v1[\s\S]{0,200}confirmed delivery/i.test(customerText), "customer route/web files do not expose unexecuted operation_plan_v1 as confirmed delivery");
