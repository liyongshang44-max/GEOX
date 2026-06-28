// scripts/governance_acceptance/TK15_PRODUCTION_INGESTION_V0.cjs
// Purpose: verify TK15 production-shaped source ref ingestion into a traceable Twin Kernel decision-cycle pointer chain.
// Boundary: this script verifies source-ref mapping only; it does not create automatic recommendations, approvals, tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const RUN_ID = String(process.env.TK15_ACCEPTANCE_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, "_");

const FILES = {
  migration: "apps/server/db/migrations/2026_06_28_tk15_production_ingestion_v0.sql",
  route: "apps/server/src/routes/v1/twin_kernel_production_ingestion.ts",
  module: "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  doc: "docs/tasks/TK15-Production-Ingestion-v0.md",
  nextTaskLine: "docs/tasks/TWIN-KERNEL-NEXT-TASK-LINE.md",
};

function runRef(stem) {
  return `${stem}_${RUN_ID}`;
}

const DEFAULTS = {
  fieldLearningCandidateId: "flc_c23a3ace34c48ce59c205110",
  sourceSystem: "tk15_acceptance_production_adapter",
  sourceEventId: runRef("prod_evt_tk15_source_refs_001"),
  occurredAt: "2026-06-28T02:00:00.000Z",
  ingestedBy: "tk15_acceptance_ingestor",
  ingestedAt: "2026-06-28T02:01:00.000Z",
  sourceRefs: {
    recommendation_ref_id: runRef("prod_rec_tk15_001"),
    approval_ref_id: runRef("prod_appr_tk15_001"),
    operation_plan_ref_id: runRef("prod_plan_tk15_001"),
    task_ref_id: runRef("prod_task_tk15_001"),
    receipt_ref_id: runRef("prod_receipt_tk15_001"),
    observation_ref_id: runRef("prod_observation_tk15_001"),
    acceptance_ref_id: runRef("prod_acceptance_tk15_001"),
    verification_ref_id: runRef("prod_verification_tk15_001"),
  },
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

  assert("migration_table_present", containsAll(migration, ["CREATE TABLE IF NOT EXISTS production_ingestion_event_v0", "raw_source_refs_json", "mapped_external_refs_json", "boundary_flags_json"]), { file: FILES.migration });
  assert("production_ingestion_route_present", containsAll(route, ["/api/v1/twin-kernel/production-ingestion/source-refs", "production_ingestion_event_v0", "automatic_business_decision_created: false", "automatic_recommendation_created: false", "model_update_created: false"]), { file: FILES.route });
  assert("module_registered", moduleFile.includes("registerTwinKernelProductionIngestionRoutes"), { file: FILES.module });
  assert("doc_boundary_present", containsAll(doc, ["production_ingestion_event_v0", "POST /api/v1/twin-kernel/production-ingestion/source-refs", "No automatic recommendation", "No model update"]), { file: FILES.doc });
  assert("next_task_line_contains_tk15", containsAll(nextTaskLine, ["TK15", "Production Ingestion v0"]), { file: FILES.nextTaskLine });

  const ingestionResp = await requestJson("POST", "/api/v1/twin-kernel/production-ingestion/source-refs", {
    field_learning_candidate_id: DEFAULTS.fieldLearningCandidateId,
    source_system: DEFAULTS.sourceSystem,
    source_event_id: DEFAULTS.sourceEventId,
    occurred_at: DEFAULTS.occurredAt,
    ingested_by: DEFAULTS.ingestedBy,
    ingested_at: DEFAULTS.ingestedAt,
    source_refs: DEFAULTS.sourceRefs,
  });
  const ingestionEvent = record(ingestionResp.production_ingestion_event);
  const decisionCycle = record(ingestionResp.decision_cycle);
  const decisionCycleId = String(decisionCycle.decision_cycle_id || "");
  const mappedRefs = record(ingestionEvent.mapped_external_refs_json);
  assert("production_ingestion_event_written", ingestionResp.ok === true && String(ingestionEvent.production_ingestion_event_id || "").startsWith("ping_") && ingestionEvent.source_event_id === DEFAULTS.sourceEventId, { production_ingestion_event_id: ingestionEvent.production_ingestion_event_id });
  assert("decision_cycle_created_from_ingestion", decisionCycleId.startsWith("dc_") && decisionCycle.current_stage === "ACCEPTED", { decision_cycle_id: decisionCycleId, current_stage: decisionCycle.current_stage, blocking_reasons_json: decisionCycle.blocking_reasons_json });
  assert("production_refs_mapped", mappedRefs.recommendation_id === DEFAULTS.sourceRefs.recommendation_ref_id && mappedRefs.approval_id === DEFAULTS.sourceRefs.approval_ref_id && mappedRefs.operation_plan_id === DEFAULTS.sourceRefs.operation_plan_ref_id && mappedRefs.act_task_id === DEFAULTS.sourceRefs.task_ref_id && mappedRefs.receipt_id === DEFAULTS.sourceRefs.receipt_ref_id && mappedRefs.as_executed_id === DEFAULTS.sourceRefs.observation_ref_id && mappedRefs.acceptance_id === DEFAULTS.sourceRefs.acceptance_ref_id && mappedRefs.post_irrigation_verification_id === DEFAULTS.sourceRefs.verification_ref_id, { mapped_external_refs_json: mappedRefs });
  assert("ingestion_boundaries_preserved", ingestionResp.automatic_business_decision_created === false && ingestionResp.automatic_recommendation_created === false && ingestionResp.automatic_approval_created === false && ingestionResp.automatic_task_created === false && ingestionResp.automatic_receipt_created === false && ingestionResp.automatic_acceptance_created === false && ingestionResp.automatic_roi_created === false && ingestionResp.automatic_field_memory_created === false && ingestionResp.model_update_created === false, { response_flags: ingestionResp });

  const traceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const trace = record(traceResp.twin_trace);
  const decisionAnswer = record(record(trace.answers).decision_cycle);
  const pointerRefs = record(trace.pointer_refs);
  const missingFormalization = array(decisionAnswer.missing_formalization);
  const boundaryFlags = record(decisionAnswer.boundary_flags);
  assert("trace_displays_production_source_refs", pointerRefs.recommendation_id === DEFAULTS.sourceRefs.recommendation_ref_id && pointerRefs.approval_id === DEFAULTS.sourceRefs.approval_ref_id && pointerRefs.operation_plan_id === DEFAULTS.sourceRefs.operation_plan_ref_id && pointerRefs.act_task_id === DEFAULTS.sourceRefs.task_ref_id && pointerRefs.receipt_id === DEFAULTS.sourceRefs.receipt_ref_id && pointerRefs.as_executed_id === DEFAULTS.sourceRefs.observation_ref_id && pointerRefs.acceptance_id === DEFAULTS.sourceRefs.acceptance_ref_id && pointerRefs.post_irrigation_verification_id === DEFAULTS.sourceRefs.verification_ref_id, { pointer_refs: pointerRefs });
  assert("trace_keeps_formalization_gaps", missingFormalization.includes("ROI_FORMALIZATION_MISSING") && missingFormalization.includes("FORMAL_FIELD_MEMORY_MISSING"), { missing_formalization: missingFormalization });
  assert("trace_boundary_flags_preserved", decisionAnswer.forbidden_auto_writes_absent === true && boundaryFlags.model_updated === false && boundaryFlags.automatic_recommendation_created === false && boundaryFlags.automatic_approval_created === false && boundaryFlags.automatic_task_created === false && boundaryFlags.automatic_receipt_created === false && boundaryFlags.automatic_acceptance_created === false && boundaryFlags.automatic_roi_created === false && boundaryFlags.automatic_field_memory_created === false, { boundary_flags: boundaryFlags });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK15_PRODUCTION_INGESTION_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    production_ingestion_event_id: ingestionEvent.production_ingestion_event_id,
    decision_cycle_id: decisionCycleId,
    trace: {
      current_stage: decisionAnswer.current_stage,
      missing_formalization: missingFormalization,
      forbidden_auto_writes_absent: decisionAnswer.forbidden_auto_writes_absent,
    },
    assertions,
    next_step: "TK16_MULTI_SCOPE_REGRESSION_HARNESS",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK15_PRODUCTION_INGESTION_V0",
    base_url: BASE_URL,
    run_id: RUN_ID,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: "Ensure the API server is running, TK15 migration is applied, and the persisted TK10 field_learning_candidate exists.",
  }, null, 2));
  process.exit(1);
});
