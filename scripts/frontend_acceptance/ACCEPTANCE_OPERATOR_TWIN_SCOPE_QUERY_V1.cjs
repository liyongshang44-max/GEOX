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

const doc = readText("docs/frontend/GEOX_OPERATOR_TWIN_SCOPE_QUERY_CONTRACT_V1.md");
const api = readText("apps/web/src/api/operatorTwin.ts");
const overview = readText("apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx");
const workspace = readText("apps/web/src/features/operator/pages/OperatorFieldTwinWorkspacePage.tsx");
const pkg = JSON.parse(readText("package.json"));

[
  "tenant_id",
  "project_id",
  "group_id",
  "/operator/twin?tenant_id",
  "scope_policy",
  "scope_applied",
  "missing_reason"
].forEach((token) => assertIncludes(doc, token, "scope query doc " + token));

assertIncludes(api, "OperatorTwinRequestScope", "request scope type");
assertIncludes(api, "OperatorTwinScopePolicy", "scope policy type");
assertIncludes(api, "buildOperatorTwinScopeQuery", "scope query builder");
assertIncludes(api, "new URLSearchParams", "URLSearchParams builder");
assertIncludes(api, 'params.set("tenant_id"', "tenant query param");
assertIncludes(api, 'params.set("project_id"', "project query param");
assertIncludes(api, 'params.set("group_id"', "group query param");
assertIncludes(api, 'withScope("/api/v1/operator/twin", scope)', "overview scoped API path");
assertIncludes(api, 'withScope("/api/v1/operator/twin/fields/" + safeFieldId, scope)', "field scoped API path");
assertIncludes(api, "scope_policy: OperatorTwinScopePolicy", "scope policy response typing");

assertIncludes(overview, "useSearchParams", "overview reads URL search params");
assertIncludes(overview, "scopeFromSearchParams", "overview scope extraction");
assertIncludes(overview, 'searchParams.get("tenant_id")', "overview tenant query read");
assertIncludes(overview, 'searchParams.get("project_id")', "overview project query read");
assertIncludes(overview, 'searchParams.get("group_id")', "overview group query read");
assertIncludes(overview, "fetchOperatorTwinOverview(scope)", "overview passes scope to API");
assertIncludes(overview, "row.twin_href + scopeQueryString", "overview preserves scope into field link");
assertIncludes(overview, "overview.scope_policy", "overview renders scope policy");

assertIncludes(workspace, "useSearchParams", "workspace reads URL search params");
assertIncludes(workspace, "scopeFromSearchParams", "workspace scope extraction");
assertIncludes(workspace, "fetchOperatorFieldTwinWorkspace(fieldId, scope)", "workspace passes scope to API");
assertIncludes(workspace, '"/operator/twin" + scopeQueryString', "workspace preserves scope back to overview");
assertIncludes(workspace, "workspace.scope_policy", "workspace renders scope policy");

[
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/v1/control",
  "POST /api/control/ao_act/task"
].forEach((token) => {
  assertNotIncludes(api + overview + workspace, token, "operator twin frontend scope query must not include " + token);
});

assert(
  pkg.scripts && pkg.scripts["ci:frontend:operator-twin-scope-query"] === "node scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_SCOPE_QUERY_V1.cjs",
  "package script ci:frontend:operator-twin-scope-query missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:operator-twin-scope-query"] }
);

console.log("[operator-twin-scope-query] PASS");
