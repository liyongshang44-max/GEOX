// scripts/governance_acceptance/TWIN_KERNEL_V1_COMPLETION_REVIEW.cjs
// Purpose: statically verify that Twin Kernel v1 completion review files, routes, acceptances, and tags are present.
// Boundary: this script does not call runtime APIs and does not create repository data.

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();

const FILES = {
  reviewDoc: "docs/tasks/TWIN-KERNEL-V1-COMPLETION-REVIEW.md",
  tk13Doc: "docs/tasks/TK13-Formalization-Layer-v0.md",
  tk14Doc: "docs/tasks/TK14-Operator-Workflow-v0.md",
  tk15Doc: "docs/tasks/TK15-Production-Ingestion-v0.md",
  tk16Doc: "docs/tasks/TK16-Multi-Scope-Regression-Harness-v0.md",
  tk17Doc: "docs/tasks/TK17-Production-UX-v0.md",
  tk18Doc: "docs/tasks/TK18-Execution-to-Learning-Business-Closure-v0.md",
  formalizationRoute: "apps/server/src/routes/v1/twin_kernel_formalization.ts",
  operatorRoute: "apps/server/src/routes/v1/twin_kernel_operator_workflow.ts",
  ingestionRoute: "apps/server/src/routes/v1/twin_kernel_production_ingestion.ts",
  traceRoute: "apps/server/src/routes/v1/twin_kernel_trace.ts",
  closureRoute: "apps/server/src/routes/v1/twin_kernel_business_closure.ts",
  module: "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  tk13Acceptance: "scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs",
  tk14Acceptance: "scripts/governance_acceptance/TK14_OPERATOR_WORKFLOW_V0.cjs",
  tk15Acceptance: "scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs",
  tk16Acceptance: "scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs",
  tk17Acceptance: "scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs",
  tk18Acceptance: "scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs",
};

const EXPECTED_TAGS = [
  "tk13_1_task_line_acceptance_idempotency",
  "tk14_operator_workflow_v0",
  "tk15_production_ingestion_v0",
  "tk16_multi_scope_regression_harness_v0",
  "tk17_production_ux_v0",
  "tk18_execution_to_learning_business_closure_v0",
];

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function localTags() {
  try {
    return cp.execSync("git tag --list", { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const reviewDoc = read(FILES.reviewDoc);
  const formalizationRoute = read(FILES.formalizationRoute);
  const operatorRoute = read(FILES.operatorRoute);
  const ingestionRoute = read(FILES.ingestionRoute);
  const traceRoute = read(FILES.traceRoute);
  const closureRoute = read(FILES.closureRoute);
  const moduleFile = read(FILES.module);
  const tk16Acceptance = read(FILES.tk16Acceptance);
  const tk17Acceptance = read(FILES.tk17Acceptance);
  const tk18Acceptance = read(FILES.tk18Acceptance);

  assert("review_doc_freezes_tk13_to_tk18", containsAll(reviewDoc, ["TK13 Formalization Layer v0", "TK14 Operator Workflow v0", "TK15 Production Ingestion v0", "TK16 Multi-scope Regression Harness v0", "TK17 Production UX v0", "TK18 Execution-to-Learning Business Closure v0"]), { file: FILES.reviewDoc });
  assert("review_doc_declares_human_gated_loop", containsAll(reviewDoc, ["human-gated", "not autonomous", "H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL"]), { file: FILES.reviewDoc });
  assert("formalization_surfaces_present", containsAll(formalizationRoute, ["/api/v1/twin-kernel/formalizations/roi", "/api/v1/twin-kernel/formalizations/field-memory"]), { file: FILES.formalizationRoute });
  assert("operator_surfaces_present", containsAll(operatorRoute, ["/api/v1/twin-kernel/operator-workflow/decision-cycles", "/api/v1/twin-kernel/operator-workflow/sessions", "/api/v1/twin-kernel/operator-workflow/reviews", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory"]), { file: FILES.operatorRoute });
  assert("ingestion_surface_present", ingestionRoute.includes("/api/v1/twin-kernel/production-ingestion/source-refs"), { file: FILES.ingestionRoute });
  assert("trace_surface_read_only", containsAll(traceRoute, ["/api/v1/twin-kernel/traces/:decision_cycle_id", "read_only: true", "write_ready: false", "downstream_write_ready: false"]), { file: FILES.traceRoute });
  assert("business_closure_surface_read_only", containsAll(closureRoute, ["/api/v1/twin-kernel/business-closures/:decision_cycle_id", "execution_to_learning_business_closure_v0", "read_only: true", "write_ready: false", "business_closure_complete"]), { file: FILES.closureRoute });
  assert("module_registers_all_completion_surfaces", containsAll(moduleFile, ["registerTwinKernelProductionIngestionRoutes", "registerTwinKernelFormalizationRoutes", "registerTwinKernelOperatorWorkflowRoutes", "registerTwinKernelBusinessClosureRoutes", "registerTwinKernelTraceReadModelRoutes"]), { file: FILES.module });
  assert("regression_acceptance_chains_tk15_to_tk13", containsAll(tk16Acceptance, ["TK16_MULTI_SCOPE_REGRESSION_HARNESS", "production-ingestion/source-refs", "operator-workflow/formalization-actions/roi", "operator-workflow/formalization-actions/field-memory", "CALIBRATED"]), { file: FILES.tk16Acceptance });
  assert("production_ux_acceptance_preserves_boundaries", containsAll(tk17Acceptance, ["TK17_PRODUCTION_UX_V0", "trace_read_only_page_preserved", "no_ao_act_task_endpoint", "explicit_operator_actions_only"]), { file: FILES.tk17Acceptance });
  assert("business_closure_acceptance_completes_loop", containsAll(tk18Acceptance, ["TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0", "business_closure_complete", "model_update_created", "forbidden_auto_writes_absent"]), { file: FILES.tk18Acceptance });

  const tags = localTags();
  const missingTags = EXPECTED_TAGS.filter((tag) => !tags.includes(tag));
  assert("completion_tags_present_locally", missingTags.length === 0, { expected_tags: EXPECTED_TAGS, missing_tags: missingTags });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TWIN_KERNEL_V1_COMPLETION_REVIEW",
    capability_level: "Twin Kernel v1 bounded human-gated execution-to-learning loop",
    expected_tags: EXPECTED_TAGS,
    assertions,
    next_step: "POST_TWIN_KERNEL_V1_PHASE_PLANNING",
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TWIN_KERNEL_V1_COMPLETION_REVIEW",
    error: error.message,
    details: error.details ?? null,
    assertions,
    hint: "Run git fetch --tags before this acceptance if local tags are missing.",
  }, null, 2));
  process.exit(1);
}
