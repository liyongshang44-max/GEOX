// scripts/governance_acceptance/TK14_OPERATOR_WORKFLOW_V0.cjs
// Purpose: verify TK14 operator workflow from queue to explicit ROI and Field Memory formalization.
// Boundary: this script verifies explicit operator-originated writes only; it does not create automatic recommendations, approvals, tasks, receipts, acceptance records, or model updates.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const RUN_ID = String(process.env.TK14_ACCEPTANCE_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, "_");

const FILES = {
  migration: "apps/server/db/migrations/2026_06_28_tk14_operator_workflow_v0.sql",
  route: "apps/server/src/routes/v1/twin_kernel_operator_workflow.ts",
  module: "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  doc: "docs/tasks/TK14-Operator-Workflow-v0.md",
  nextTaskLine: "docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md",
};

function runRef(stem) {
  return `${stem}_${RUN_ID}`;
}

const DEFAULTS = {
  fieldLearningCandidateId: "flc_c23a3ace34c48ce59c205110",
  operatorId: "tk14_acceptance_operator",
  openedAt: "2026-06-28T01:00:00.000Z",
  reviewedBy: "tk14_acceptance_operator",
  reviewedAt: "2026-06-28T01:01:00.000Z",
  formalizedBy: "tk14_acceptance_operator",
  roiFormalizedAt: "2026-06-28T01:02:00.000Z",
  memoryFormalizedAt: "2026-06-28T01:03:00.000Z",
  recommendationId: runRef("rec_tk14_candidate_001"),
  approvalId: runRef("appr_tk14_human_001"),
  operationPlanId: runRef("op_plan_tk14_irrigation_001"),
  actTaskId: runRef("act_tk14_irrigation_001"),
  receiptId: runRef("receipt_tk14_irrigation_001"),
  asExecutedId: runRef("asexec_tk14_irrigation_001"),
  acceptanceId: runRef("acc_tk14_operator_001"),
  postIrrigationVerificationId: runRef("wrv_tk14_irrigation_001"),
};

const assertions = [];

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

async function main() {
  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const migration = read(FILES.migration);
  const route = read(FILES.route);
  const moduleFile = read(FILES.module);
  const doc = read(FILES.doc);
  const nextTaskLine = read(FILES.nextTaskLine);

  assert("migration_tables_present", containsAll(migration, ["CREATE TABLE IF NOT EXISTS operator_session_v0", "CREATE TABLE IF NOT EXISTS operator_decision_review_v0", "CREATE TABLE IF NOT EXISTS operator_formalization_action_v0"]), { file: FILES.migration });
  assert("operator_routes_present", containsAll(route, ["/api/v1/twin-kernel/operator-workflow/decision-cycles", "/api/v1/twin-kernel/operator-workflow/sessions", "/api/v1/twin-kernel/operator-workflow/reviews", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory"]), { file: FILES.route });
  assert("operator_boundaries_present", containsAll(route, ["automatic_roi_created: false", "automatic_field_memory_created: false", "model_update_created: false", "automatic_task_created: false"]), { file: FILES.route });
  assert("module_registered", moduleFile.includes("registerTwinKernelOperatorWorkflowRoutes"), { file: FILES.module });
  assert("doc_boundary_present", containsAll(doc, ["operator_session_v0", "operator_decision_review_v0", "operator_formalization_action_v0", "No UI", "No automatic model update"]), { file: FILES.doc });
  assert("next_task_line_contains_tk14", containsAll(nextTaskLine, ["TK14", "Operator Workflow v0"]), { file: FILES.nextTaskLine });

  const decisionResp = await requestJson("POST", "/api/v1/twin-kernel/decision-cycles", {
    field_learning_candidate_id: DEFAULTS.fieldLearningCandidateId,
    external_refs: {
      recommendation_id: DEFAULTS.recommendationId,
      approval_id: DEFAULTS.approvalId,
      operation_plan_id: DEFAULTS.operationPlanId,
      act_task_id: DEFAULTS.actTaskId,
      receipt_id: DEFAULTS.receiptId,
      as_executed_id: DEFAULTS.asExecutedId,
      acceptance_id: DEFAULTS.acceptanceId,
      post_irrigation_verification_id: DEFAULTS.postIrrigationVerificationId,
    },
  });
  const decisionCycle = record(decisionResp.decision_cycle);
  const decisionCycleId = String(decisionCycle.decision_cycle_id || "");
  assert("decision_cycle_ready_for_operator", decisionResp.ok === true && decisionCycleId.startsWith("dc_") && decisionCycle.current_stage === "ACCEPTED", { decision_cycle_id: decisionCycleId, current_stage: decisionCycle.current_stage, run_id: RUN_ID });

  const queueResp = await requestJson("GET", "/api/v1/twin-kernel/operator-workflow/decision-cycles?limit=100");
  const queued = array(queueResp.decision_cycles).find((item) => record(item).decision_cycle_id === decisionCycleId);
  assert("operator_queue_sees_decision_cycle", queueResp.ok === true && !!queued, { decision_cycle_id: decisionCycleId });
  assert("operator_queue_reports_missing_formalization", array(record(queued).missing_formalization).includes("ROI_FORMALIZATION_MISSING") && array(record(queued).missing_formalization).includes("FORMAL_FIELD_MEMORY_MISSING"), { missing_formalization: array(record(queued).missing_formalization) });

  const sessionResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/sessions", {
    decision_cycle_id: decisionCycleId,
    operator_id: DEFAULTS.operatorId,
    opened_at: DEFAULTS.openedAt,
  });
  const session = record(sessionResp.operator_session);
  const sessionId = String(session.operator_session_id || "");
  assert("operator_session_written", sessionResp.ok === true && sessionId.startsWith("op_sess_") && session.decision_cycle_id === decisionCycleId, { operator_session_id: sessionId });

  const reviewResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/reviews", {
    operator_session_id: sessionId,
    reviewed_by: DEFAULTS.reviewedBy,
    reviewed_at: DEFAULTS.reviewedAt,
    review_status: "NEEDS_FORMALIZATION",
    review_notes: {
      fixture_run_id: RUN_ID,
      reviewed_trace_before_formalization: true,
    },
  });
  const review = record(reviewResp.operator_review);
  const reviewId = String(review.operator_review_id || "");
  assert("operator_review_written", reviewResp.ok === true && reviewId.startsWith("op_review_") && review.operator_session_id === sessionId, { operator_review_id: reviewId });

  const roiResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: DEFAULTS.formalizedBy,
    formalized_at: DEFAULTS.roiFormalizedAt,
    roi_summary: {
      roi_basis: "tk14_operator_workflow_acceptance",
      calculation_status: "FORMALIZED_BY_OPERATOR_ACTION",
      fixture_run_id: RUN_ID,
    },
    evidence_refs: [
      { kind: "operator_review", ref_id: reviewId },
      { kind: "acceptance", ref_id: DEFAULTS.acceptanceId },
    ],
  });
  const roiAction = record(roiResp.operator_action);
  const roiEntry = record(roiResp.roi_entry);
  assert("operator_roi_action_written", roiResp.ok === true && String(roiAction.operator_action_id || "").startsWith("op_action_") && roiAction.action_type === "FORMALIZE_ROI" && String(roiEntry.roi_entry_id || "").startsWith("roi_"), { operator_action_id: roiAction.operator_action_id, roi_entry_id: roiEntry.roi_entry_id });

  const memoryResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: DEFAULTS.formalizedBy,
    formalized_at: DEFAULTS.memoryFormalizedAt,
    memory_statement: {
      memory_type: "FIELD_WATER_RESPONSE_FORMAL_MEMORY",
      source_candidate_id: DEFAULTS.fieldLearningCandidateId,
      write_status: "FORMAL_MEMORY_WRITTEN_BY_OPERATOR_ACTION",
      fixture_run_id: RUN_ID,
    },
    evidence_refs: [
      { kind: "operator_review", ref_id: reviewId },
      { kind: "field_learning_candidate", ref_id: DEFAULTS.fieldLearningCandidateId },
    ],
  });
  const memoryAction = record(memoryResp.operator_action);
  const fieldMemory = record(memoryResp.field_memory);
  assert("operator_field_memory_action_written", memoryResp.ok === true && String(memoryAction.operator_action_id || "").startsWith("op_action_") && memoryAction.action_type === "FORMALIZE_FIELD_MEMORY" && String(fieldMemory.field_memory_id || fieldMemory.memory_id || "").startsWith("fm_") && fieldMemory.model_update_created === false, { operator_action_id: memoryAction.operator_action_id, field_memory_id: fieldMemory.field_memory_id || fieldMemory.memory_id });

  const traceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const trace = record(traceResp.twin_trace);
  const decisionAnswer = record(record(trace.answers).decision_cycle);
  const missingFormalization = array(decisionAnswer.missing_formalization);
  const boundaryFlags = record(decisionAnswer.boundary_flags);
  const pointerRefs = record(trace.pointer_refs);
  assert("trace_roi_missing_cleared", !missingFormalization.includes("ROI_FORMALIZATION_MISSING"), { missing_formalization: missingFormalization });
  assert("trace_field_memory_missing_cleared", !missingFormalization.includes("FORMAL_FIELD_MEMORY_MISSING"), { missing_formalization: missingFormalization });
  assert("trace_reaches_calibrated", decisionAnswer.current_stage === "CALIBRATED", { current_stage: decisionAnswer.current_stage });
  assert("trace_pointer_refs_updated_by_operator_workflow", pointerRefs.roi_entry_id === roiEntry.roi_entry_id && pointerRefs.field_memory_id === (fieldMemory.field_memory_id || fieldMemory.memory_id), { pointer_refs: pointerRefs });
  assert("operator_boundaries_preserved", decisionAnswer.forbidden_auto_writes_absent === true && boundaryFlags.model_updated === false && boundaryFlags.automatic_roi_created === false && boundaryFlags.automatic_field_memory_created === false && boundaryFlags.automatic_task_created === false, { boundary_flags: boundaryFlags });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK14_OPERATOR_WORKFLOW_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    decision_cycle_id: decisionCycleId,
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    roi_operator_action_id: roiAction.operator_action_id,
    field_memory_operator_action_id: memoryAction.operator_action_id,
    roi_entry_id: roiEntry.roi_entry_id,
    field_memory_id: fieldMemory.field_memory_id || fieldMemory.memory_id,
    trace: {
      current_stage: decisionAnswer.current_stage,
      missing_formalization: missingFormalization,
      forbidden_auto_writes_absent: decisionAnswer.forbidden_auto_writes_absent,
    },
    assertions,
    next_step: "TK15_PRODUCTION_INGESTION_V0",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK14_OPERATOR_WORKFLOW_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: "Ensure the API server is running, TK14 migration is applied, and the persisted TK10 field_learning_candidate exists.",
  }, null, 2));
  process.exit(1);
});
