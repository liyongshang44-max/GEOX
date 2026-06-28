// scripts/governance_acceptance/TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1.cjs
// Purpose: run the persisted TK1-TK8 Twin Kernel API chain and verify readback as a runtime trace.
// Boundary: this script does not seed source-index rows, create schema, or create downstream business objects such as recommendations, approvals, tasks, receipts, acceptance records, ROI entries, Field Memory entries, or model updates.

const DEFAULTS = {
  baseUrl: "http://127.0.0.1:3001",
  tenantId: "tenantA",
  projectId: "projectA",
  groupId: "groupA",
  fieldId: "field_c8_demo",
  seasonId: "season_2026_demo",
  asOfTs: "2026-06-28T00:00:00.000Z",
  selectedOptionId: "irrigation_20mm",
  observedAt: "2026-06-24T06:46:14.389Z",
  postSoilMoisturePercent: 24.8,
  observedWaterState: "NORMAL",
  verificationRefId: "wstate_c8_irrigation_post_response_001",
  acceptanceId: "acc_c8_irrigation_formal_001",
  postIrrigationVerificationId: "wrv_c8_irrigation_001",
  formalEvidenceRefId: "formal_ev_c8_001",
  fieldMemoryGateRoute: "/api/v1/field-memory/from-acceptance",
  recommendationId: "rec_c8_candidate_001",
  approvalId: "appr_c8_human_001",
  operationPlanId: "op_plan_c8_irrigation_001",
  actTaskId: "act_c8_irrigation_001",
  receiptId: "receipt_c8_irrigation_001",
  asExecutedId: "asexec_c8_irrigation_001",
};

function envText(name, fallback) {
  return String(process.env[name] ?? fallback).trim();
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`INVALID_NUMBER_ENV:${name}`);
  return parsed;
}

const config = {
  baseUrl: envText("TWIN_KERNEL_BASE_URL", DEFAULTS.baseUrl).replace(/\/$/, ""),
  tenantId: envText("TK10_TENANT_ID", DEFAULTS.tenantId),
  projectId: envText("TK10_PROJECT_ID", DEFAULTS.projectId),
  groupId: envText("TK10_GROUP_ID", DEFAULTS.groupId),
  fieldId: envText("TK10_FIELD_ID", DEFAULTS.fieldId),
  seasonId: envText("TK10_SEASON_ID", DEFAULTS.seasonId),
  asOfTs: envText("TK10_AS_OF_TS", DEFAULTS.asOfTs),
  selectedOptionId: envText("TK10_SELECTED_OPTION_ID", DEFAULTS.selectedOptionId),
  observedAt: envText("TK10_OBSERVED_AT", DEFAULTS.observedAt),
  postSoilMoisturePercent: envNumber("TK10_POST_SOIL_MOISTURE_PERCENT", DEFAULTS.postSoilMoisturePercent),
  observedWaterState: envText("TK10_OBSERVED_WATER_STATE", DEFAULTS.observedWaterState),
  verificationRefId: envText("TK10_VERIFICATION_REF_ID", DEFAULTS.verificationRefId),
  acceptanceId: envText("TK10_ACCEPTANCE_ID", DEFAULTS.acceptanceId),
  postIrrigationVerificationId: envText("TK10_POST_IRRIGATION_VERIFICATION_ID", DEFAULTS.postIrrigationVerificationId),
  formalEvidenceRefId: envText("TK10_FORMAL_EVIDENCE_REF_ID", DEFAULTS.formalEvidenceRefId),
  fieldMemoryGateRoute: envText("TK10_FIELD_MEMORY_GATE_ROUTE", DEFAULTS.fieldMemoryGateRoute),
  recommendationId: envText("TK10_RECOMMENDATION_ID", DEFAULTS.recommendationId),
  approvalId: envText("TK10_APPROVAL_ID", DEFAULTS.approvalId),
  operationPlanId: envText("TK10_OPERATION_PLAN_ID", DEFAULTS.operationPlanId),
  actTaskId: envText("TK10_ACT_TASK_ID", DEFAULTS.actTaskId),
  receiptId: envText("TK10_RECEIPT_ID", DEFAULTS.receiptId),
  asExecutedId: envText("TK10_AS_EXECUTED_ID", DEFAULTS.asExecutedId),
};

const assertions = [];

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? "").trim();
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

async function requestJson(method, path, body) {
  const url = `${config.baseUrl}${path}`;
  const options = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) options.body = JSON.stringify(body);
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`API_CONNECTIVITY_FAILED:${method}:${path}:${error.message}`);
  }
  const rawText = await response.text();
  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`API_NON_JSON_RESPONSE:${method}:${path}:${response.status}:${rawText.slice(0, 200)}`);
  }
  if (!response.ok) {
    const error = new Error(`API_HTTP_FAILED:${method}:${path}:${response.status}:${json.error ?? "UNKNOWN"}`);
    error.response = json;
    throw error;
  }
  return json;
}

function routePost(path, body) {
  return requestJson("POST", path, body);
}

function routeGet(path) {
  return requestJson("GET", path);
}

function scopeBody() {
  return {
    tenant_id: config.tenantId,
    project_id: config.projectId,
    group_id: config.groupId,
    field_id: config.fieldId,
    season_id: config.seasonId,
    as_of_ts: config.asOfTs,
  };
}

function allFalse(recordValue, keys) {
  const input = record(recordValue);
  return keys.every((key) => input[key] === false);
}

async function main() {
  const snapshotResp = await routePost("/api/v1/twin-kernel/field-state-snapshots", scopeBody());
  const snapshot = record(snapshotResp.snapshot);
  const sourceIndexes = record(snapshot.source_indexes_json);
  const waterIndex = record(sourceIndexes.water_state_estimate_index_v1);
  const stateVector = record(snapshot.state_vector_json);
  const soilMoisture = record(stateVector.soil_moisture);

  assert("snapshot_ready", snapshotResp.ok === true && snapshot.status === "SNAPSHOT_READY", { status: snapshot.status, blocking_reasons_json: snapshot.blocking_reasons_json });
  assert("source_index_water_available", waterIndex.available === true, { water_state_estimate_index_v1: waterIndex });
  assert("entered_collected_soil_moisture_present", soilMoisture.value !== null && soilMoisture.value !== undefined, { soil_moisture: soilMoisture });

  const forecastResp = await routePost("/api/v1/twin-kernel/forecast-runs", { snapshot_id: snapshot.snapshot_id });
  const forecastRun = record(forecastResp.forecast_run);
  const forecastPoints = array(forecastRun.forecast_points_json);
  assert("forecast_ready", forecastResp.ok === true && forecastRun.status === "FORECAST_READY", { status: forecastRun.status });
  assert("forecast_points_present", forecastPoints.length >= 7, { count: forecastPoints.length });

  const scenarioResp = await routePost("/api/v1/twin-kernel/scenario-sets", { forecast_run_id: forecastRun.forecast_run_id });
  const scenarioSet = record(scenarioResp.scenario_set);
  const options = array(scenarioSet.option_scenarios_json);
  assert("scenario_set_ready", scenarioResp.ok === true && scenarioSet.status === "SCENARIO_SET_READY", { status: scenarioSet.status });
  assert("selected_option_present", options.some((item) => record(item).scenario_id === config.selectedOptionId), { selected_option_id: config.selectedOptionId, option_count: options.length });

  const calibrationResp = await routePost("/api/v1/twin-kernel/calibration-replays", {
    scenario_set_id: scenarioSet.scenario_set_id,
    selected_option_id: config.selectedOptionId,
    observed: {
      observed_at: config.observedAt,
      post_soil_moisture_percent: config.postSoilMoisturePercent,
      observed_water_state: config.observedWaterState,
      verification_ref_id: config.verificationRefId,
      evidence_refs: [
        { kind: "water_state_estimate", ref_id: config.verificationRefId },
        { kind: "post_irrigation_verification", ref_id: config.postIrrigationVerificationId },
      ],
    },
  });
  const calibrationReplay = record(calibrationResp.calibration_replay);
  const forecastError = record(calibrationResp.forecast_error);
  assert("calibration_replay_ready", calibrationResp.ok === true && calibrationReplay.status === "CALIBRATION_REPLAY_READY", { status: calibrationReplay.status });
  assert("forecast_error_present", text(forecastError.forecast_error_id).startsWith("fe_"), { forecast_error_id: forecastError.forecast_error_id });

  const learningResp = await routePost("/api/v1/twin-kernel/field-learning-candidates", {
    forecast_error_id: forecastError.forecast_error_id,
    formal_gate_refs: {
      acceptance_id: config.acceptanceId,
      post_irrigation_verification_id: config.postIrrigationVerificationId,
      formal_evidence_ref_id: config.formalEvidenceRefId,
      field_memory_gate_route: config.fieldMemoryGateRoute,
      evidence_refs: [
        { kind: "formal_gate_evidence", ref_id: config.formalEvidenceRefId },
        { kind: "acceptance", ref_id: config.acceptanceId },
        { kind: "post_irrigation_verification", ref_id: config.postIrrigationVerificationId },
      ],
    },
  });
  const candidate = record(learningResp.field_learning_candidate);
  const learningStatement = record(candidate.learning_statement_json);
  assert("field_learning_candidate_ready", learningResp.ok === true && candidate.candidate_status === "LEARNING_CANDIDATE_READY", { candidate_status: candidate.candidate_status });
  assert("candidate_only_no_model_update", learningStatement.candidate_only === true && learningStatement.model_updated === false, { learning_statement_json: learningStatement });
  assert("no_formal_field_memory_write_from_learning", learningResp.formal_field_memory_write_created === false, { formal_field_memory_write_created: learningResp.formal_field_memory_write_created });

  const decisionResp = await routePost("/api/v1/twin-kernel/decision-cycles", {
    field_learning_candidate_id: candidate.field_learning_candidate_id,
    external_refs: {
      recommendation_id: config.recommendationId,
      approval_id: config.approvalId,
      operation_plan_id: config.operationPlanId,
      act_task_id: config.actTaskId,
      receipt_id: config.receiptId,
      as_executed_id: config.asExecutedId,
      acceptance_id: config.acceptanceId,
      post_irrigation_verification_id: config.postIrrigationVerificationId,
    },
  });
  const decisionCycle = record(decisionResp.decision_cycle);
  const externalRefs = record(decisionCycle.external_refs_json);
  const boundaryFlags = record(decisionCycle.boundary_flags_json);
  assert("decision_cycle_ready", decisionResp.ok === true && decisionCycle.cycle_status === "DECISION_CYCLE_READY", { cycle_status: decisionCycle.cycle_status });
  assert("decision_stage_not_roi_when_roi_missing", decisionCycle.current_stage === "ACCEPTED" && !text(externalRefs.roi_entry_id), { current_stage: decisionCycle.current_stage, roi_entry_id: externalRefs.roi_entry_id });
  assert("decision_no_automatic_downstream_writes", decisionResp.automatic_task_created === false && allFalse(boundaryFlags, ["automatic_recommendation_created", "automatic_approval_created", "automatic_task_created", "automatic_receipt_created", "automatic_acceptance_created", "automatic_roi_created", "automatic_field_memory_created", "model_updated"]), { boundary_flags_json: boundaryFlags });

  const traceResp = await routeGet(`/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycle.decision_cycle_id)}`);
  const trace = record(traceResp.twin_trace);
  const systemDerived = record(trace.system_derived);
  const traceDecision = record(systemDerived.decision_cycle_v1);
  const traceAnswers = record(trace.answers);
  const traceDecisionAnswer = record(traceAnswers.decision_cycle);
  const missingFormalization = array(traceDecisionAnswer.missing_formalization);
  const systemDerivedKeys = Object.keys(systemDerived).sort();
  const expectedSystemDerived = [
    "calibration_replay_v1",
    "decision_cycle_v1",
    "field_learning_candidate_v1",
    "field_state_snapshot_v1",
    "forecast_error_v1",
    "forecast_run_v1",
    "scenario_set_v1",
  ].sort();

  assert("trace_readback_ok", traceResp.ok === true && traceResp.object_type === "twin_trace_v1_read_model" && trace.read_only === true, { object_type: traceResp.object_type, read_only: trace.read_only });
  assert("trace_has_all_system_derived_objects", expectedSystemDerived.every((key) => systemDerivedKeys.includes(key)), { system_derived_keys: systemDerivedKeys });
  assert("trace_decision_stage_accepted", traceDecision.current_stage === "ACCEPTED", { current_stage: traceDecision.current_stage });
  assert("trace_missing_formalization_visible", ["ROI_FORMALIZATION_MISSING", "FORMAL_FIELD_MEMORY_MISSING", "H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL"].every((item) => missingFormalization.includes(item)), { missing_formalization: missingFormalization });
  assert("trace_forbidden_auto_writes_absent", traceDecisionAnswer.forbidden_auto_writes_absent === true, { decision_cycle_answer: traceDecisionAnswer });

  const result = {
    ok: true,
    acceptance: "TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1",
    base_url: config.baseUrl,
    scope: {
      tenant_id: config.tenantId,
      project_id: config.projectId,
      group_id: config.groupId,
      field_id: config.fieldId,
      season_id: config.seasonId,
      as_of_ts: config.asOfTs,
    },
    persisted_chain: {
      snapshot_id: snapshot.snapshot_id,
      forecast_run_id: forecastRun.forecast_run_id,
      scenario_set_id: scenarioSet.scenario_set_id,
      calibration_replay_id: calibrationReplay.calibration_replay_id,
      forecast_error_id: forecastError.forecast_error_id,
      field_learning_candidate_id: candidate.field_learning_candidate_id,
      decision_cycle_id: decisionCycle.decision_cycle_id,
    },
    trace: {
      object_type: traceResp.object_type,
      read_only: trace.read_only,
      system_derived_count: systemDerivedKeys.length,
      decision_current_stage: traceDecision.current_stage,
      missing_formalization: missingFormalization,
      forbidden_auto_writes_absent: traceDecisionAnswer.forbidden_auto_writes_absent,
    },
    assertions,
    next_step: "TWIN_KERNEL_RUNTIME_ACCEPTANCE_READY_FOR_REGRESSION_USE",
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const failure = {
    ok: false,
    acceptance: "TK10_PERSISTED_TWIN_TRACE_RUNTIME_ACCEPTANCE_V1",
    error: error.message,
    details: error.details ?? error.response ?? null,
    assertions,
    hint: "Ensure the local server is running, TK1-TK9 migrations are applied, and source-index rows exist for the selected scope. This script does not seed source-index data.",
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
