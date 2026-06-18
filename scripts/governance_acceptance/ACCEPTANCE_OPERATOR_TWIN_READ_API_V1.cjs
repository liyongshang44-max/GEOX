// scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_READ_API_V1.cjs
// Purpose: verify Operator Twin read API source boundary.
// Boundary: Operator Twin API must be read-only and must not create recommendations, approvals, dispatches, or AO-ACT tasks.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), "missing required token: " + label, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), "forbidden token present: " + label, { needle });
}

const routePath = "apps/server/src/routes/v1/operator_twin.ts";
const registerPath = "apps/server/src/modules/operator/registerOperatorModule.ts";
const packagePath = "package.json";

assert(fs.existsSync(path.join(ROOT, routePath)), "operator twin route file missing", { routePath });

const route = readText(routePath);
const register = readText(registerPath);
const pkg = JSON.parse(readText(packagePath));

assertIncludes(register, "registerOperatorTwinReadRoutes", "operator twin route registration");
assertIncludes(route, 'app.get("/api/v1/operator/twin"', "operator twin overview route");
assertIncludes(route, 'app.get("/api/v1/operator/twin/fields/:field_id"', "operator field twin route");
assertIncludes(route, "operator_twin_overview_v1", "overview projection key");
assertIncludes(route, "operator_field_twin_workspace_v1", "field workspace projection key");
assertIncludes(route, "writeReady: false", "writeReady false");
assertIncludes(route, "dispatchReady: false", "dispatchReady false");
assertIncludes(route, "approvalReady: false", "approvalReady false");
assertIncludes(route, "taskCreationReady: false", "taskCreationReady false");
assertIncludes(route, "no_action_baseline_present", "no_action baseline boundary");
assertIncludes(route, "forecast_horizon_limited", "forecast horizon limitation");

[
  "app.post(",
  "app.put(",
  "app.patch(",
  "app.delete(",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM",
  "decision_recommendation_v1 fact",
  "ao_act_task_v0",
  "dispatchNow",
  "approveNow"
].forEach((token) => {
  assertNotIncludes(route, token, "operator twin read API must not include " + token);
});

assert(
  pkg.scripts && pkg.scripts["ci:governance:operator-twin-read-api"] === "node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_TWIN_READ_API_V1.cjs",
  "package script ci:governance:operator-twin-read-api missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:governance:operator-twin-read-api"] }
);

console.log("[operator-twin-read-api] PASS");
