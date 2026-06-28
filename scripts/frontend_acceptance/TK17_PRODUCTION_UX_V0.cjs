// scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs
// Purpose: statically accept the TK17 production UX shell for explicit operator workflow execution.
// Boundary: this acceptance verifies that TK17 adds no backend route, migration, automatic dispatch, AO-ACT task creation, receipt creation, acceptance creation, or model update surface.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const FILES = {
  doc: "docs/tasks/TK17-Production-UX-v0.md",
  page: "apps/web/src/features/operator/pages/OperatorProductionWorkflowPage.tsx",
  api: "apps/web/src/api/twinKernelProductionWorkflow.ts",
  app: "apps/web/src/app/App.tsx",
  layout: "apps/web/src/layouts/OperatorLayout.tsx",
  tracePage: "apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx",
  tk16Acceptance: "scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs",
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function forbiddenEndpointMatches(content) {
  const forbidden = [
    "/api/control/ao_act/task",
    "/api/control/ao_act/receipt",
    "/api/v1/control/ao_act/task",
    "/api/v1/control/ao_act/receipt",
    "/api/v1/twin-kernel/approvals",
    "/api/v1/twin-kernel/receipts",
    "/api/v1/twin-kernel/acceptance",
    "/api/v1/twin-kernel/model-updates",
    "dispatchTask(",
    "createTask(",
    "createApproval(",
    "createReceipt(",
    "createAcceptance(",
    "model_update_created: true",
  ];

  return forbidden.filter((token) => content.includes(token));
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const doc = read(FILES.doc);
  const page = read(FILES.page);
  const api = read(FILES.api);
  const app = read(FILES.app);
  const layout = read(FILES.layout);
  const tracePage = read(FILES.tracePage);
  const tk16Acceptance = read(FILES.tk16Acceptance);

  assert("tk16_acceptance_still_present", tk16Acceptance.includes("TK16_MULTI_SCOPE_REGRESSION_HARNESS"), { file: FILES.tk16Acceptance });
  assert("production_workflow_route_registered", containsAll(app, ["OperatorProductionWorkflowPage", "twin/production-workflow"]), { file: FILES.app });
  assert("operator_nav_registered", containsAll(layout, ["production-workflow", "生产工作流", "/operator/twin/production-workflow"]), { file: FILES.layout });
  assert("production_page_markers_present", containsAll(page, ["data-page=\"tk17-production-ux-v0\"", "data-boundary=\"explicit-operator-writes-no-auto-dispatch\"", "data-action=\"tk17-ingest-source-refs\"", "data-action=\"tk17-formalize-roi\"", "data-action=\"tk17-formalize-field-memory\"", "data-link=\"tk17-open-read-only-trace\""]), { file: FILES.page });
  assert("production_api_calls_existing_surfaces", containsAll(api, ["/api/v1/twin-kernel/production-ingestion/source-refs", "/api/v1/twin-kernel/operator-workflow/decision-cycles", "/api/v1/twin-kernel/operator-workflow/sessions", "/api/v1/twin-kernel/operator-workflow/reviews", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", "/api/v1/twin-kernel/traces/"]), { file: FILES.api });
  assert("trace_page_read_only_preserved", containsAll(tracePage, ["data-boundary=\"read-only-no-post\"", "data-api-path=\"/api/v1/twin-kernel/traces/:decision_cycle_id\"", "read_only", "write_ready", "downstream_write_ready"]), { file: FILES.tracePage });
  assert("page_forbidden_endpoints_absent", forbiddenEndpointMatches(page).length === 0, { matches: forbiddenEndpointMatches(page) });
  assert("api_forbidden_endpoints_absent", forbiddenEndpointMatches(api).length === 0, { matches: forbiddenEndpointMatches(api) });
  assert("doc_boundary_present", containsAll(doc, ["TK17 does not add or change backend routes.", "TK17 does not add migrations.", "No automatic dispatch.", "No backend semantic change."]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK17_PRODUCTION_UX_V0",
    files: FILES,
    route: "/operator/twin/production-workflow",
    preserved_boundary: {
      trace_read_only_page_preserved: true,
      no_ao_act_task_endpoint: true,
      no_dispatch_endpoint: true,
      no_model_update_endpoint: true,
      explicit_operator_actions_only: true,
    },
    next_step: "TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK17_PRODUCTION_UX_V0",
    error: error.message,
    details: error.details ?? null,
  }, null, 2));
  process.exit(1);
}
