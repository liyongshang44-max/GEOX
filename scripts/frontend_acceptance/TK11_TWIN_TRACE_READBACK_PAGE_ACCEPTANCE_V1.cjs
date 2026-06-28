// scripts/frontend_acceptance/TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1.cjs
// Purpose: statically accept the read-only Twin Trace readback page contract.
// Boundary: this acceptance checks that the page uses GET readback only and does not expose downstream write actions.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const FILES = {
  doc: "docs/tasks/TK11-Twin-Trace-Readback-Page-Acceptance-v1.md",
  app: "apps/web/src/app/App.tsx",
  api: "apps/web/src/api/twinKernelTrace.ts",
  page: "apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx",
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

function hasForbiddenWriteSurface(content) {
  const forbidden = [
    "method: \"POST\"",
    "method: 'POST'",
    "method: `POST`",
    "method: \"PUT\"",
    "method: 'PUT'",
    "method: \"PATCH\"",
    "method: 'PATCH'",
    "method: \"DELETE\"",
    "method: 'DELETE'",
    "<button",
    "submitOperatorScenarioRecommendation",
    "createRecommendation",
    "createApproval",
    "createOperationPlan",
    "createTask",
    "dispatchTask",
    "createReceipt",
    "createAcceptance",
    "createRoi",
    "createFieldMemory",
  ];

  return forbidden.filter((token) => content.includes(token));
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_file_exists`, exists(file), { file });
  }

  const doc = read(FILES.doc);
  const app = read(FILES.app);
  const api = read(FILES.api);
  const page = read(FILES.page);

  const requiredSystemDerived = [
    "field_state_snapshot_v1",
    "forecast_run_v1",
    "scenario_set_v1",
    "calibration_replay_v1",
    "forecast_error_v1",
    "field_learning_candidate_v1",
    "decision_cycle_v1",
  ];

  const requiredProvenance = [
    "entered_collected",
    "system_derived",
    "human_confirmed",
    "pointer_refs",
  ];

  const missingFormalization = [
    "ROI_FORMALIZATION_MISSING",
    "FORMAL_FIELD_MEMORY_MISSING",
    "H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL",
  ];

  assert("app_lazy_import_present", app.includes("OperatorTwinTraceReadbackPage"), { file: FILES.app });
  assert("app_route_present", app.includes("twin/traces/:decisionCycleId"), { file: FILES.app });

  assert("api_uses_trace_get_endpoint", api.includes("/api/v1/twin-kernel/traces/"), { file: FILES.api });
  assert("api_boundary_comment_present", api.includes("only performs GET readback"), { file: FILES.api });
  assert("api_has_no_write_method", hasForbiddenWriteSurface(api).length === 0, { matches: hasForbiddenWriteSurface(api) });

  assert("page_contract_markers_present", containsAll(page, [
    "data-page=\"operator-twin-trace-readback\"",
    "data-contract=\"twin_trace_v1_read_model\"",
    "data-boundary=\"read-only-no-post\"",
    "data-api-path=\"/api/v1/twin-kernel/traces/:decision_cycle_id\"",
  ]), { file: FILES.page });

  assert("page_displays_required_provenance", containsAll(page, requiredProvenance), { requiredProvenance });
  assert("page_displays_all_system_derived_objects", containsAll(page, requiredSystemDerived), { requiredSystemDerived });
  assert("page_displays_missing_formalization", containsAll(page, missingFormalization), { missingFormalization });
  assert("page_displays_boundary_flags", containsAll(page, [
    "current_stage",
    "read_only",
    "write_ready",
    "downstream_write_ready",
    "forbidden_auto_writes_absent",
    "boundary_flags",
  ]), { file: FILES.page });

  assert("page_has_no_write_surface", hasForbiddenWriteSurface(page).length === 0, { matches: hasForbiddenWriteSurface(page) });

  assert("doc_states_read_only_boundary", containsAll(doc, [
    "TK11 adds and accepts a read-only Operator page",
    "GET /api/v1/twin-kernel/traces/:decision_cycle_id",
    "The page must not call POST, PUT, PATCH, or DELETE.",
  ]), { file: FILES.doc });

  const result = {
    ok: true,
    acceptance: "TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1",
    files: FILES,
    route: "/operator/twin/traces/:decisionCycleId",
    api_endpoint: "GET /api/v1/twin-kernel/traces/:decision_cycle_id",
    boundary: {
      read_only_page: true,
      no_write_methods: true,
      no_downstream_write_actions: true,
      no_direct_recommendation_approval_dispatch: true,
    },
    required_display: {
      provenance: requiredProvenance,
      system_derived: requiredSystemDerived,
      missing_formalization: missingFormalization,
    },
    next_step: "RUN_WEB_AND_OPEN_OPERATOR_TWIN_TRACE_READBACK_PAGE",
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK11_TWIN_TRACE_READBACK_PAGE_ACCEPTANCE_V1",
    error: error.message,
    details: error.details ?? null,
  }, null, 2));
  process.exit(1);
}
