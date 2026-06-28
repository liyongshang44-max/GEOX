// scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs
// Purpose: run a multi-scope regression harness across TK15 ingestion, TK14 operator workflow, TK13 formalization, and trace readback.
// Boundary: this script adds no runtime behavior; it verifies existing explicit routes and never creates automatic recommendations, approvals, tasks, receipts, acceptance records, ROI, Field Memory, or model updates outside explicit operator calls.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const RUN_ID = String(process.env.TK16_ACCEPTANCE_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, "_");
const DEFAULT_CANDIDATE_ID = "flc_c23a3ace34c48ce59c205110";
const CANDIDATE_IDS = String(process.env.TK16_FIELD_LEARNING_CANDIDATE_IDS || DEFAULT_CANDIDATE_ID).split(",").map((item) => item.trim()).filter(Boolean);

const FILES = {
  tk13Doc: "docs/tasks/TK13-Formalization-Layer-v0.md",
  tk14Doc: "docs/tasks/TK14-Operator-Workflow-v0.md",
  tk15Doc: "docs/tasks/TK15-Production-Ingestion-v0.md",
  tk16Doc: "docs/tasks/TK16-Multi-Scope-Regression-Harness-v0.md",
  tk13Route: "apps/server/src/routes/v1/twin_kernel_formalization.ts",
  tk14Route: "apps/server/src/routes/v1/twin_kernel_operator_workflow.ts",
  tk15Route: "apps/server/src/routes/v1/twin_kernel_production_ingestion.ts",
  tk16Script: "scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs",
  nextTaskLine: "docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md",
};

const assertions = [];

function runRef(stem, index) {
  return `${stem}_case${index}_${RUN_ID}`;
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

function sourceRefs(index) {
  return {
    recommendation_ref_id: runRef("tk16_prod_rec", index),
    approval_ref_id: runRef("tk16_prod_appr", index),
    operation_plan_ref_id: runRef("tk16_prod_plan", index),
    task_ref_id: runRef("tk16_prod_task", index),
    receipt_ref_id: runRef("tk16_prod_receipt", index),
    observation_ref_id: runRef("tk16_prod_observation", index),
    acceptance_ref_id: runRef("tk16_prod_acceptance", index),
    verification_ref_id: runRef("tk16_prod_verification", index),
  };
}

function sameScope(a, b) {
  const left = record(a);
  const right = record(b);
  return left.tenant_id === right.tenant_id && left.project_id === right.project_id && left.group_id === right.group_id && left.field_id === right.field_id;
}

function refsMatch(pointerRefs, refs) {
  const pointers = record(pointerRefs);
  return pointers.recommendation_id === refs.recommendation_ref_id
    && pointers.approval_id === refs.approval_ref_id
    && pointers.operation_plan_id === refs.operation_plan_ref_id
    && pointers.act_task_id === refs.task_ref_id
    && pointers.receipt_id === refs.receipt_ref_id
    && pointers.as_executed_id === refs.observation_ref_id
    && pointers.acceptance_id === refs.acceptance_ref_id
    && pointers.post_irrigation_verification_id === refs.verification_ref_id;
}

async function runCase(candidateId, index) {
  const refs = sourceRefs(index);
  const sourceEventId = runRef("tk16_prod_evt", index);
  const occurredAt = `2026-06-28T03:${String(index).padStart(2, "0")}:00.000Z`;
  const ingestedAt = `2026-06-28T03:${String(index).padStart(2, "0")}:30.000Z`;

  const ingestionResp = await requestJson("POST", "/api/v1/twin-kernel/production-ingestion/source-refs", {
    field_learning_candidate_id: candidateId,
    source_system: "tk16_regression_adapter",
    source_event_id: sourceEventId,
    occurred_at: occurredAt,
    ingested_by: "tk16_regression_harness",
    ingested_at: ingestedAt,
    source_refs: refs,
  });
  const ingestionEvent = record(ingestionResp.production_ingestion_event);
  const decisionCycle = record(ingestionResp.decision_cycle);
  const decisionCycleId = String(decisionCycle.decision_cycle_id || "");
  assert(`case_${index}_ingestion_written`, ingestionResp.ok === true && String(ingestionEvent.production_ingestion_event_id || "").startsWith("ping_") && decisionCycleId.startsWith("dc_"), { candidate_id: candidateId, production_ingestion_event_id: ingestionEvent.production_ingestion_event_id, decision_cycle_id: decisionCycleId });
  assert(`case_${index}_ingestion_scope_available`, !!ingestionEvent.tenant_id && !!ingestionEvent.project_id && !!ingestionEvent.group_id && !!ingestionEvent.field_id, { scope: ingestionEvent });
  assert(`case_${index}_ingestion_boundary_preserved`, ingestionResp.automatic_recommendation_created === false && ingestionResp.automatic_approval_created === false && ingestionResp.automatic_task_created === false && ingestionResp.automatic_receipt_created === false && ingestionResp.automatic_acceptance_created === false && ingestionResp.automatic_roi_created === false && ingestionResp.automatic_field_memory_created === false && ingestionResp.model_update_created === false, { response_flags: ingestionResp });

  const preTraceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const preTrace = record(preTraceResp.twin_trace);
  const preDecision = record(record(preTrace.answers).decision_cycle);
  const preMissing = array(preDecision.missing_formalization);
  assert(`case_${index}_pre_trace_refs_match`, refsMatch(preTrace.pointer_refs, refs), { pointer_refs: preTrace.pointer_refs });
  assert(`case_${index}_pre_trace_formalization_gaps_present`, preMissing.includes("ROI_FORMALIZATION_MISSING") && preMissing.includes("FORMAL_FIELD_MEMORY_MISSING"), { missing_formalization: preMissing });

  const queueResp = await requestJson("GET", "/api/v1/twin-kernel/operator-workflow/decision-cycles?limit=100");
  const queued = array(queueResp.decision_cycles).find((item) => record(item).decision_cycle_id === decisionCycleId);
  assert(`case_${index}_operator_queue_sees_decision`, !!queued, { decision_cycle_id: decisionCycleId });

  const sessionResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/sessions", {
    decision_cycle_id: decisionCycleId,
    operator_id: "tk16_regression_operator",
    opened_at: `2026-06-28T04:${String(index).padStart(2, "0")}:00.000Z`,
  });
  const session = record(sessionResp.operator_session);
  const sessionId = String(session.operator_session_id || "");
  assert(`case_${index}_operator_session_written`, sessionResp.ok === true && sessionId.startsWith("op_sess_"), { operator_session_id: sessionId });
  assert(`case_${index}_session_scope_matches_ingestion`, sameScope(ingestionEvent, session), { ingestion_scope: ingestionEvent, session_scope: session });

  const reviewResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/reviews", {
    operator_session_id: sessionId,
    reviewed_by: "tk16_regression_operator",
    reviewed_at: `2026-06-28T04:${String(index).padStart(2, "0")}:30.000Z`,
    review_status: "NEEDS_FORMALIZATION",
    review_notes: {
      fixture_run_id: RUN_ID,
      fixture_case_index: index,
      field_learning_candidate_id: candidateId,
    },
  });
  const review = record(reviewResp.operator_review);
  const reviewId = String(review.operator_review_id || "");
  assert(`case_${index}_operator_review_written`, reviewResp.ok === true && reviewId.startsWith("op_review_"), { operator_review_id: reviewId });

  const roiResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: "tk16_regression_operator",
    formalized_at: `2026-06-28T05:${String(index).padStart(2, "0")}:00.000Z`,
    roi_summary: {
      roi_basis: "tk16_multi_scope_regression",
      fixture_run_id: RUN_ID,
      fixture_case_index: index,
      field_learning_candidate_id: candidateId,
    },
    evidence_refs: [
      { kind: "operator_review", ref_id: reviewId },
      { kind: "production_ingestion_event", ref_id: String(ingestionEvent.production_ingestion_event_id || "") },
    ],
  });
  const roiEntry = record(roiResp.roi_entry);
  assert(`case_${index}_roi_formalized_explicitly`, roiResp.ok === true && String(roiEntry.roi_entry_id || "").startsWith("roi_") && roiResp.automatic_roi_created === false && roiResp.automatic_task_created === false, { roi_entry_id: roiEntry.roi_entry_id });

  const memoryResp = await requestJson("POST", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory", {
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    formalized_by: "tk16_regression_operator",
    formalized_at: `2026-06-28T05:${String(index).padStart(2, "0")}:30.000Z`,
    memory_statement: {
      memory_type: "TK16_REGRESSION_FORMAL_MEMORY",
      fixture_run_id: RUN_ID,
      fixture_case_index: index,
      field_learning_candidate_id: candidateId,
    },
    evidence_refs: [
      { kind: "operator_review", ref_id: reviewId },
      { kind: "field_learning_candidate", ref_id: candidateId },
    ],
  });
  const fieldMemory = record(memoryResp.field_memory);
  const fieldMemoryId = String(fieldMemory.field_memory_id || fieldMemory.memory_id || "");
  assert(`case_${index}_field_memory_formalized_explicitly`, memoryResp.ok === true && fieldMemoryId.startsWith("fm_") && fieldMemory.model_update_created === false && memoryResp.automatic_field_memory_created === false && memoryResp.model_update_created === false && memoryResp.automatic_task_created === false, { field_memory_id: fieldMemoryId });

  const postTraceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const postTrace = record(postTraceResp.twin_trace);
  const postDecision = record(record(postTrace.answers).decision_cycle);
  const postMissing = array(postDecision.missing_formalization);
  const postBoundary = record(postDecision.boundary_flags);
  const postPointers = record(postTrace.pointer_refs);
  assert(`case_${index}_post_trace_reaches_calibrated`, postDecision.current_stage === "CALIBRATED", { current_stage: postDecision.current_stage });
  assert(`case_${index}_post_trace_formalization_gaps_cleared`, !postMissing.includes("ROI_FORMALIZATION_MISSING") && !postMissing.includes("FORMAL_FIELD_MEMORY_MISSING") && postMissing.includes("H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL"), { missing_formalization: postMissing });
  assert(`case_${index}_post_trace_refs_preserved`, refsMatch(postPointers, refs) && postPointers.roi_entry_id === roiEntry.roi_entry_id && postPointers.field_memory_id === fieldMemoryId, { pointer_refs: postPointers });
  assert(`case_${index}_post_trace_boundaries_preserved`, postDecision.forbidden_auto_writes_absent === true && postBoundary.model_updated === false && postBoundary.automatic_recommendation_created === false && postBoundary.automatic_approval_created === false && postBoundary.automatic_task_created === false && postBoundary.automatic_receipt_created === false && postBoundary.automatic_acceptance_created === false && postBoundary.automatic_roi_created === false && postBoundary.automatic_field_memory_created === false, { boundary_flags: postBoundary });

  return {
    case_index: index,
    field_learning_candidate_id: candidateId,
    scope: {
      tenant_id: ingestionEvent.tenant_id,
      project_id: ingestionEvent.project_id,
      group_id: ingestionEvent.group_id,
      field_id: ingestionEvent.field_id,
    },
    production_ingestion_event_id: ingestionEvent.production_ingestion_event_id,
    decision_cycle_id: decisionCycleId,
    operator_session_id: sessionId,
    operator_review_id: reviewId,
    roi_entry_id: roiEntry.roi_entry_id,
    field_memory_id: fieldMemoryId,
    final_stage: postDecision.current_stage,
    missing_formalization: postMissing,
  };
}

async function main() {
  assert("candidate_list_not_empty", CANDIDATE_IDS.length > 0, { candidate_ids: CANDIDATE_IDS });

  for (const [key, file] of Object.entries(FILES)) {
    assert(`${key}_exists`, exists(file), { file });
  }

  const tk13Route = read(FILES.tk13Route);
  const tk14Route = read(FILES.tk14Route);
  const tk15Route = read(FILES.tk15Route);
  const tk16Doc = read(FILES.tk16Doc);
  const nextTaskLine = read(FILES.nextTaskLine);

  assert("tk13_formalization_surface_present", containsAll(tk13Route, ["/api/v1/twin-kernel/formalizations/roi", "/api/v1/twin-kernel/formalizations/field-memory"]), { file: FILES.tk13Route });
  assert("tk14_operator_surface_present", containsAll(tk14Route, ["/api/v1/twin-kernel/operator-workflow/decision-cycles", "/api/v1/twin-kernel/operator-workflow/formalization-actions/roi", "/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory"]), { file: FILES.tk14Route });
  assert("tk15_ingestion_surface_present", tk15Route.includes("/api/v1/twin-kernel/production-ingestion/source-refs"), { file: FILES.tk15Route });
  assert("tk16_doc_boundary_present", containsAll(tk16Doc, ["TK16 does not add a migration", "does not add production ROI computation", "does not make Twin Kernel autonomous"]), { file: FILES.tk16Doc });
  assert("next_task_line_contains_tk16", containsAll(nextTaskLine, ["TK16", "Multi-scope Regression Harness"]), { file: FILES.nextTaskLine });

  const results = [];
  const seenDecisionCycleIds = new Set();
  const seenIngestionEventIds = new Set();

  for (let index = 0; index < CANDIDATE_IDS.length; index += 1) {
    const result = await runCase(CANDIDATE_IDS[index], index + 1);
    assert(`case_${index + 1}_decision_cycle_unique`, !seenDecisionCycleIds.has(result.decision_cycle_id), { decision_cycle_id: result.decision_cycle_id });
    assert(`case_${index + 1}_ingestion_event_unique`, !seenIngestionEventIds.has(result.production_ingestion_event_id), { production_ingestion_event_id: result.production_ingestion_event_id });
    seenDecisionCycleIds.add(result.decision_cycle_id);
    seenIngestionEventIds.add(result.production_ingestion_event_id);
    results.push(result);
  }

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK16_MULTI_SCOPE_REGRESSION_HARNESS",
    base_url: BASE_URL,
    run_id: RUN_ID,
    candidate_count: CANDIDATE_IDS.length,
    cases: results,
    assertions,
    next_step: "TK17_PRODUCTION_UX_V0",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK16_MULTI_SCOPE_REGRESSION_HARNESS",
    base_url: BASE_URL,
    run_id: RUN_ID,
    candidate_ids: CANDIDATE_IDS,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: "Ensure the API server is running, TK13-TK15 routes are registered, migrations through TK15 are applied, and configured field_learning_candidate ids exist.",
  }, null, 2));
  process.exit(1);
});
