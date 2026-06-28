// scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs
// Purpose: verify the TK18 read-only execution-to-learning business closure readback.
// Boundary: this script creates fixture records only through existing explicit TK15 and TK14 routes, then verifies TK18 readback performs no writes.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const RUN_ID = String(process.env.TK18_ACCEPTANCE_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, "_");
const FIELD_LEARNING_CANDIDATE_ID = String(process.env.TK18_FIELD_LEARNING_CANDIDATE_ID || "flc_c23a3ace34c48ce59c205110").trim();

const FILES = {
  doc: "docs/tasks/TK18-Execution-to-Learning-Business-Closure-v0.md",
  route: "apps/server/src/routes/v1/twin_kernel_business_closure.ts",
  module: "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  tk16Acceptance: "scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs",
  tk17Acceptance: "scripts/frontend_acceptance/TK17_PRODUCTION_UX_V0.cjs",
};

const assertions = [];

function runRef(stem) {
  return `${stem}_${RUN_ID}`;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
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

function forbiddenWriteSql(content) {
  return ["INSERT INTO", "UPDATE ", "DELETE FROM", "CREATE TABLE", "DROP TABLE", "ALTER TABLE"].filter((token) => content.includes(token));
}

async function requestJson(method, pathName, body) {
  const response = await fetch(`${BASE_URL}${pathName}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error) => {
    throw new Error(`API_CONNECTIVITY_FAILED:${method}:${pathName}:${error.message}`);
  });
  const raw = await response.text();
  const json = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    const error = new Error(`API_HTTP_FAILED:${method}:${pathName}:${response.status}:${json.error || "UNKNOWN"}`);
    error.response = json;
    throw error;
  }
  return json;
}

function sourceRefs() {
  return {
    recommendation_ref_id: runRef("tk18_prod_rec"),
    approval_ref_id: runRef("tk18_prod_appr"),
    operation_plan_ref_id: runRef("tk18_prod_plan"),
    task_ref_id: runRef("tk18_prod_task"),
    receipt_ref_id: runRef("tk18_prod_receipt"),
    observation_ref_id: runRef("tk18_prod_observation"),
    acceptance_ref_id: runRef("tk18_prod_acceptance"),
    verification_ref_id: runRef("tk18_prod_verification"),
  };
}

async function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const doc = read(FILES.doc);
  const route = read(FILES.route);
  const moduleFile = read(FILES.module);
  const tk16Acceptance = read(FILES.tk16Acceptance);
  const tk17Acceptance = read(FILES.tk17Acceptance);

  assert("route_is_registered", moduleFile.includes("registerTwinKernelBusinessClosureRoutes"), { file: FILES.module });
  assert("route_surface_present", containsAll(route, ["/api/v1/twin-kernel/business-closures/:decision_cycle_id", "execution_to_learning_business_closure_v0", "business_closure_complete", "read_only: true", "write_ready: false"]), { file: FILES.route });
  assert("route_has_no_write_sql", forbiddenWriteSql(route).length === 0, { matches: forbiddenWriteSql(route) });
  assert("doc_boundary_present", containsAll(doc, ["TK18 is read-only", "TK18 does not add a migration", "business_closure_complete = true", "No backend semantic change"]), { file: FILES.doc });
  assert("tk16_regression_still_present", tk16Acceptance.includes("TK16_MULTI_SCOPE_REGRESSION_HARNESS"), { file: FILES.tk16Acceptance });
  assert("tk17_acceptance_still_present", tk17Acceptance.includes("TK17_PRODUCTION_UX_V0"), { file: FILES.tk17Acceptance });

  const refs = sourceRefs();
  const ingestionResp = await requestJson("POST", "/api/v1/twin-kernel/production-ingestion/source-refs", {
    field_learning_candidate_id: FIELD_LEARNING_CANDIDATE_ID,
    source_system: "tk18_business_closure_adapter",
    source_event_id: runRef("tk18_prod_evt"),
    occurred_at: "2026-06-28T06:00:00.000Z",
    ingested_by: "tk18_business_closure_harness",
    ingested_at: "2026-06-28T06:01:00.000Z",
    source_refs: refs,
  });
  const ingestionEvent = record(ingestionResp.production_ingestion_event);
  const decisionCycle = record(ingestionResp.decision_cycle);
  const decisionCycleId = String(decisionCycle.decision_cycle_id || "");
  assert("ingestion_fixture_written", ingestionResp.ok === true && String(ingestionEvent.production_ingestion_event_id || "").startsWith("ping_") && decisionCycleId.startsWith("dc_"), { production_ingestion_event_id: ingestionEvent.production_ingestion_event_id, decision_cycle_id: decisionCycleId });

  const sessionResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/sessions", {
    decision_cycle_id: decisionCycleId,
    operator_id: "tk18_business_closure_operator",
    opened_at: "2026-06-28T06:02:00.000Z",
  });
  const session = record(sessionResp.operator_session);
  const sessionId = String(session.operator_session_id || "");
  assert("operator_session_written", sessionResp.ok === true && sessionId.startsWith("op_sess_"), { operator_session_id: sessionId });

  const reviewResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/reviews", {
    operator_session_id: sessionId,
    reviewed_by: "tk18_business_closure_operator",
    reviewed_at: "2026-06-28T06:03:00.000Z",
    review_status: "NEEDS_FORMALIZATION",
    review_notes: { fixture_run_id: RUN_ID, production_ingestion_event_id: ingestionEvent.production_ingestion_event_id },
  });
  const review = record(reviewResp.operator_review);
  const reviewId = String(review.operator_review_id || "");
  assert("operator_review_written", reviewResp.ok === true && reviewId.startsWith("op_review_"), { operator_review_id: reviewId });

  const roiResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: "tk18_business_closure_operator",
    formalized_at: "2026-06-28T06:04:00.000Z",
    roi_summary: { roi_basis: "tk18_business_closure", fixture_run_id: RUN_ID },
    evidence_refs: [{ kind: "operator_review", ref_id: reviewId }, { kind: "production_ingestion_event", ref_id: String(ingestionEvent.production_ingestion_event_id || "") }],
  });
  const roiEntry = record(roiResp.roi_entry);
  assert("roi_formalized_explicitly", roiResp.ok === true && String(roiEntry.roi_entry_id || "").startsWith("roi_") && roiResp.automatic_roi_created === false, { roi_entry_id: roiEntry.roi_entry_id });

  const memoryResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: "tk18_business_closure_operator",
    formalized_at: "2026-06-28T06:05:00.000Z",
    memory_statement: { memory_type: "TK18_BUSINESS_CLOSURE_MEMORY", fixture_run_id: RUN_ID },
    evidence_refs: [{ kind: "operator_review", ref_id: reviewId }, { kind: "field_learning_candidate", ref_id: FIELD_LEARNING_CANDIDATE_ID }],
  });
  const fieldMemory = record(memoryResp.field_memory);
  const fieldMemoryId = String(fieldMemory.field_memory_id || fieldMemory.memory_id || "");
  assert("field_memory_formalized_explicitly", memoryResp.ok === true && fieldMemoryId.startsWith("fm_") && fieldMemory.model_update_created === false, { field_memory_id: fieldMemoryId });

  const traceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const trace = record(traceResp.twin_trace);
  const traceDecision = record(record(trace.answers).decision_cycle);
  const missing = array(traceDecision.missing_formalization);
  assert("trace_closed_before_business_closure_readback", traceDecision.current_stage === "CALIBRATED" && !missing.includes("ROI_FORMALIZATION_MISSING") && !missing.includes("FORMAL_FIELD_MEMORY_MISSING") && missing.includes("H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL"), { current_stage: traceDecision.current_stage, missing_formalization: missing });

  const closureResp = await requestJson("GET", `/api/v1/twin-kernel/business-closures/${encodeURIComponent(decisionCycleId)}`);
  const closure = record(closureResp.business_closure);
  const closureStatus = record(closure.closure_status);
  assert("business_closure_readback_complete", closureResp.ok === true && closureResp.read_only === true && closureResp.write_ready === false && closureResp.downstream_write_ready === false && closureStatus.business_closure_complete === true, { closure_status: closureStatus });
  assert("business_closure_chain_present", closureStatus.production_ingestion_present === true && closureStatus.execution_pointer_chain_present === true && closureStatus.operator_session_present === true && closureStatus.operator_review_present === true && closureStatus.roi_formalized_by_operator_action === true && closureStatus.field_memory_written_by_operator_action === true && closureStatus.trace_reaches_calibrated === true, { closure_status: closureStatus });
  assert("business_closure_boundaries_preserved", closureResp.automatic_business_decision_created === false && closureResp.automatic_recommendation_created === false && closureResp.automatic_approval_created === false && closureResp.automatic_task_created === false && closureResp.automatic_receipt_created === false && closureResp.automatic_acceptance_created === false && closureResp.automatic_roi_created === false && closureResp.automatic_field_memory_created === false && closureResp.model_update_created === false && closureStatus.model_update_created === false && closureStatus.forbidden_auto_writes_absent === true, { closure_status: closureStatus });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    decision_cycle_id: decisionCycleId,
    production_ingestion_event_id: ingestionEvent.production_ingestion_event_id,
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    roi_entry_id: roiEntry.roi_entry_id,
    field_memory_id: fieldMemoryId,
    business_closure: closureStatus,
    assertions,
    next_step: "TWIN_KERNEL_V1_COMPLETION_REVIEW",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: "Ensure the API server is running, TK18 route is registered, and migrations through TK15 are applied.",
  }, null, 2));
  process.exit(1);
});
