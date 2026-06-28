// scripts/governance_acceptance/TK13_FORMALIZATION_LAYER_V0.cjs
// Purpose: verify TK13 explicit ROI and Field Memory formalization against a separate persisted decision cycle.
// Boundary: this script calls only Twin Kernel formalization endpoints and does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, or model updates.

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");

const FILES = {
  migration: "apps/server/db/migrations/2026_06_28_tk13_formalization_layer_v0.sql",
  route: "apps/server/src/routes/v1/twin_kernel_formalization.ts",
  module: "apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts",
  doc: "docs/tasks/TK13-Formalization-Layer-v0.md",
};

const DEFAULTS = {
  fieldLearningCandidateId: "flc_c23a3ace34c48ce59c205110",
  formalizedBy: "tk13_acceptance_operator",
  formalizedAt: "2026-06-28T00:00:00.000Z",
  recommendationId: "rec_tk13_candidate_001",
  approvalId: "appr_tk13_human_001",
  operationPlanId: "op_plan_tk13_irrigation_001",
  actTaskId: "act_tk13_irrigation_001",
  receiptId: "receipt_tk13_irrigation_001",
  asExecutedId: "asexec_tk13_irrigation_001",
  acceptanceId: "acc_tk13_formal_001",
  postIrrigationVerificationId: "wrv_tk13_irrigation_001",
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

  assert("migration_tables_present", containsAll(migration, ["CREATE TABLE IF NOT EXISTS roi_entry_v1", "CREATE TABLE IF NOT EXISTS field_memory_v1", "model_update_created boolean NOT NULL DEFAULT false"]), { file: FILES.migration });
  assert("routes_present", containsAll(route, ["/api/v1/twin-kernel/formalizations/roi", "/api/v1/twin-kernel/formalizations/field-memory", "updateDecisionCycleFormalRefs", "automatic_roi_created: false", "automatic_field_memory_created: false", "model_update_created: false"]), { file: FILES.route });
  assert("module_registered", moduleFile.includes("registerTwinKernelFormalizationRoutes"), { file: FILES.module });
  assert("doc_boundary_present", containsAll(doc, ["explicit formalization layer", "roi_entry_v1", "field_memory_v1", "does not update model parameters"]), { file: FILES.doc });

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
  assert("tk13_decision_cycle_ready", decisionResp.ok === true && decisionCycleId.startsWith("dc_") && decisionCycle.current_stage === "ACCEPTED", { decision_cycle_id: decisionCycleId, current_stage: decisionCycle.current_stage });

  const roiResp = await requestJson("POST", "/api/v1/twin-kernel/formalizations/roi", {
    decision_cycle_id: decisionCycleId,
    formalized_by: DEFAULTS.formalizedBy,
    formalized_at: DEFAULTS.formalizedAt,
    roi_summary: {
      roi_basis: "acceptance_runtime_smoke",
      calculation_status: "FORMALIZED_BY_EXTERNAL_INPUT",
    },
    evidence_refs: [
      { kind: "acceptance", ref_id: DEFAULTS.acceptanceId },
      { kind: "post_irrigation_verification", ref_id: DEFAULTS.postIrrigationVerificationId },
    ],
  });
  const roiEntry = record(roiResp.roi_entry);
  const decisionAfterRoi = record(roiResp.decision_cycle);
  assert("roi_formalized", roiResp.ok === true && String(roiEntry.roi_entry_id || "").startsWith("roi_") && record(decisionAfterRoi.external_refs_json).roi_entry_id === roiEntry.roi_entry_id, { roi_entry_id: roiEntry.roi_entry_id, current_stage: decisionAfterRoi.current_stage });

  const memoryResp = await requestJson("POST", "/api/v1/twin-kernel/formalizations/field-memory", {
    decision_cycle_id: decisionCycleId,
    formalized_by: DEFAULTS.formalizedBy,
    formalized_at: DEFAULTS.formalizedAt,
    memory_statement: {
      memory_type: "FIELD_WATER_RESPONSE_FORMAL_MEMORY",
      source_candidate_id: DEFAULTS.fieldLearningCandidateId,
      write_status: "FORMAL_MEMORY_WRITTEN",
    },
    evidence_refs: [
      { kind: "field_learning_candidate", ref_id: DEFAULTS.fieldLearningCandidateId },
      { kind: "acceptance", ref_id: DEFAULTS.acceptanceId },
    ],
  });
  const fieldMemory = record(memoryResp.field_memory);
  const decisionAfterMemory = record(memoryResp.decision_cycle);
  assert("field_memory_formalized", memoryResp.ok === true && String(fieldMemory.field_memory_id || "").startsWith("fm_") && fieldMemory.model_update_created === false && record(decisionAfterMemory.external_refs_json).field_memory_id === fieldMemory.field_memory_id, { field_memory_id: fieldMemory.field_memory_id, current_stage: decisionAfterMemory.current_stage });

  const traceResp = await requestJson("GET", `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycleId)}`);
  const trace = record(traceResp.twin_trace);
  const decisionAnswer = record(record(trace.answers).decision_cycle);
  const missingFormalization = array(decisionAnswer.missing_formalization);
  const pointerRefs = record(trace.pointer_refs);
  assert("trace_roi_missing_cleared", !missingFormalization.includes("ROI_FORMALIZATION_MISSING"), { missing_formalization: missingFormalization });
  assert("trace_field_memory_missing_cleared", !missingFormalization.includes("FORMAL_FIELD_MEMORY_MISSING"), { missing_formalization: missingFormalization });
  assert("trace_pointer_refs_updated", pointerRefs.roi_entry_id === roiEntry.roi_entry_id && pointerRefs.field_memory_id === fieldMemory.field_memory_id, { pointer_refs: pointerRefs });
  assert("trace_boundaries_preserved", decisionAnswer.forbidden_auto_writes_absent === true && record(decisionAnswer.boundary_flags).model_updated === false, { decision_cycle_answer: decisionAnswer });

  console.log(JSON.stringify({
    ok: true,
    acceptance: "TK13_FORMALIZATION_LAYER_V0",
    base_url: BASE_URL,
    decision_cycle_id: decisionCycleId,
    roi_entry_id: roiEntry.roi_entry_id,
    field_memory_id: fieldMemory.field_memory_id,
    trace: {
      current_stage: decisionAnswer.current_stage,
      missing_formalization: missingFormalization,
      forbidden_auto_writes_absent: decisionAnswer.forbidden_auto_writes_absent,
    },
    assertions,
    next_step: "FORMALIZATION_LAYER_READY_FOR_PAGE_READBACK",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: "TK13_FORMALIZATION_LAYER_V0",
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: "Ensure the API server is running, TK13 migration is applied, and the persisted TK10 field_learning_candidate exists.",
  }, null, 2));
  process.exit(1);
});
