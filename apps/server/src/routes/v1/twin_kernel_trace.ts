// apps/server/src/routes/v1/twin_kernel_trace.ts
// Purpose: expose a read-only Twin Kernel trace read model from a persisted decision_cycle_v1 ID.
// Boundary: this route performs readback only; it does not create snapshots, forecasts, scenarios, calibration records, learning candidates, decision cycles, recommendations, approvals, tasks, ROI, Field Memory, or model updates.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>) : [];
}

function iso(rowValue: unknown): unknown {
  return rowValue instanceof Date ? rowValue.toISOString() : rowValue;
}

function hasRef(value: unknown): boolean {
  return text(value).length > 0;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function scopeFromDecision(row: Row): Record<string, unknown> {
  return {
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
  };
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values);
  return (result.rows[0] as Row | undefined) ?? null;
}

async function readSnapshotRow(pool: Pool, snapshotId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_state_snapshot_v1 WHERE snapshot_id = $1 LIMIT 1", [snapshotId]);
}

async function readForecastRunRow(pool: Pool, forecastRunId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_run_v1 WHERE forecast_run_id = $1 LIMIT 1", [forecastRunId]);
}

async function readScenarioSetRow(pool: Pool, scenarioSetId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM scenario_set_v1 WHERE scenario_set_id = $1 LIMIT 1", [scenarioSetId]);
}

async function readCalibrationReplayRow(pool: Pool, replayId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM calibration_replay_v1 WHERE calibration_replay_id = $1 LIMIT 1", [replayId]);
}

async function readForecastErrorRow(pool: Pool, errorId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM forecast_error_v1 WHERE forecast_error_id = $1 LIMIT 1", [errorId]);
}

async function readFieldLearningCandidateRow(pool: Pool, candidateId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id = $1 LIMIT 1", [candidateId]);
}

async function readDecisionCycleRow(pool: Pool, cycleId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id = $1 LIMIT 1", [cycleId]);
}

function exposeSnapshotRow(row: Row): Row {
  return { snapshot_id: row.snapshot_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, season_id: row.season_id ?? null, as_of_ts: iso(row.as_of_ts), status: row.status, state_vector_json: row.state_vector_json, confidence_json: row.confidence_json, evidence_refs_json: row.evidence_refs_json, source_indexes_json: row.source_indexes_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeForecastRunRow(row: Row): Row {
  return { forecast_run_id: row.forecast_run_id, snapshot_id: row.snapshot_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), horizon_days: row.horizon_days, model_version: row.model_version, status: row.status, input_refs_json: row.input_refs_json, forecast_points_json: row.forecast_points_json, risk_timeline_json: row.risk_timeline_json, uncertainty_json: row.uncertainty_json, assumptions_json: row.assumptions_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeScenarioSetRow(row: Row): Row {
  return { scenario_set_id: row.scenario_set_id, forecast_run_id: row.forecast_run_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), scenario_model_version: row.scenario_model_version, status: row.status, input_refs_json: row.input_refs_json, baseline_scenario_json: row.baseline_scenario_json, option_scenarios_json: row.option_scenarios_json, comparison_axes_json: row.comparison_axes_json, constraints_json: row.constraints_json, assumptions_json: row.assumptions_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeCalibrationReplayRow(row: Row): Row {
  return { calibration_replay_id: row.calibration_replay_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), selected_option_id: row.selected_option_id ?? null, status: row.status, input_refs_json: row.input_refs_json, predicted_json: row.predicted_json, observed_json: row.observed_json, error_summary_json: row.error_summary_json, reason_candidates_json: row.reason_candidates_json, evidence_refs_json: row.evidence_refs_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeForecastErrorRow(row: Row): Row {
  return { forecast_error_id: row.forecast_error_id, calibration_replay_id: row.calibration_replay_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), error_metric: row.error_metric, error_value: row.error_value, error_direction: row.error_direction, predicted_json: row.predicted_json, observed_json: row.observed_json, evidence_refs_json: row.evidence_refs_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeFieldLearningCandidateRow(row: Row): Row {
  return { field_learning_candidate_id: row.field_learning_candidate_id, calibration_replay_id: row.calibration_replay_id, forecast_error_id: row.forecast_error_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), candidate_status: row.candidate_status, learning_scope: row.learning_scope, learning_statement_json: row.learning_statement_json, supporting_evidence_refs_json: row.supporting_evidence_refs_json, counter_evidence_refs_json: row.counter_evidence_refs_json, confidence_json: row.confidence_json, formal_gate_refs_json: row.formal_gate_refs_json, h58_gate_status_json: row.h58_gate_status_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function exposeDecisionCycleRow(row: Row): Row {
  return { decision_cycle_id: row.decision_cycle_id, snapshot_id: row.snapshot_id, forecast_run_id: row.forecast_run_id, scenario_set_id: row.scenario_set_id, calibration_replay_id: row.calibration_replay_id, forecast_error_id: row.forecast_error_id, field_learning_candidate_id: row.field_learning_candidate_id, tenant_id: row.tenant_id, project_id: row.project_id, group_id: row.group_id, field_id: row.field_id, as_of_ts: iso(row.as_of_ts), cycle_status: row.cycle_status, current_stage: row.current_stage, external_refs_json: row.external_refs_json, state_machine_json: row.state_machine_json, human_gate_json: row.human_gate_json, boundary_flags_json: row.boundary_flags_json, blocking_reasons_json: row.blocking_reasons_json, determinism_hash: row.determinism_hash, created_at: iso(row.created_at) };
}

function missingFormalization(externalRefs: Record<string, unknown>, candidate: Row): string[] {
  const missing: string[] = [];
  if (!hasRef(externalRefs.roi_entry_id)) missing.push("ROI_FORMALIZATION_MISSING");
  if (!hasRef(externalRefs.field_memory_id)) missing.push("FORMAL_FIELD_MEMORY_MISSING");
  const h58GateStatus = record(candidate.h58_gate_status_json);
  if (boolValue(h58GateStatus.formal_field_memory_write_created) === false) missing.push("H58_FORMAL_WRITE_NOT_CREATED_BY_TWIN_KERNEL");
  return missing;
}

function buildTraceReadModel(args: { snapshot: Row; forecastRun: Row; scenarioSet: Row; calibrationReplay: Row; forecastError: Row; fieldLearningCandidate: Row; decisionCycle: Row }): Row {
  const snapshot = exposeSnapshotRow(args.snapshot);
  const forecastRun = exposeForecastRunRow(args.forecastRun);
  const scenarioSet = exposeScenarioSetRow(args.scenarioSet);
  const calibrationReplay = exposeCalibrationReplayRow(args.calibrationReplay);
  const forecastError = exposeForecastErrorRow(args.forecastError);
  const fieldLearningCandidate = exposeFieldLearningCandidateRow(args.fieldLearningCandidate);
  const decisionCycle = exposeDecisionCycleRow(args.decisionCycle);
  const stateVector = record(snapshot.state_vector_json);
  const soilMoisture = record(stateVector.soil_moisture);
  const confidence = record(snapshot.confidence_json);
  const forecastPoints = recordArray(forecastRun.forecast_points_json);
  const optionScenarios = recordArray(scenarioSet.option_scenarios_json);
  const externalRefs = record(decisionCycle.external_refs_json);
  const boundaryFlags = record(decisionCycle.boundary_flags_json);
  const learningStatement = record(fieldLearningCandidate.learning_statement_json);
  const h58GateStatus = record(fieldLearningCandidate.h58_gate_status_json);
  return {
    object_type: "twin_trace_v1_read_model",
    decision_cycle_id: decisionCycle.decision_cycle_id,
    scope: scopeFromDecision(decisionCycle),
    as_of_ts: decisionCycle.as_of_ts,
    read_only: true,
    write_ready: false,
    downstream_write_ready: false,
    provenance_classes: {
      entered_collected: ["source_indexes_json", "evidence_refs_json", "observed_json"],
      system_derived: ["field_state_snapshot_v1", "forecast_run_v1", "scenario_set_v1", "calibration_replay_v1", "forecast_error_v1", "field_learning_candidate_v1", "decision_cycle_v1"],
      human_confirmed: ["formal_gate_refs_json", "human_gate_json"],
      pointer_ref: Object.keys(externalRefs).filter((key) => hasRef(externalRefs[key])),
    },
    entered_collected: {
      source_indexes_json: snapshot.source_indexes_json,
      snapshot_evidence_refs_json: snapshot.evidence_refs_json,
      observed_json: calibrationReplay.observed_json,
      calibration_evidence_refs_json: calibrationReplay.evidence_refs_json,
    },
    human_confirmed: {
      formal_gate_refs_json: fieldLearningCandidate.formal_gate_refs_json,
      human_gate_json: decisionCycle.human_gate_json,
    },
    pointer_refs: externalRefs,
    system_derived: {
      field_state_snapshot_v1: snapshot,
      forecast_run_v1: forecastRun,
      scenario_set_v1: scenarioSet,
      calibration_replay_v1: calibrationReplay,
      forecast_error_v1: forecastError,
      field_learning_candidate_v1: fieldLearningCandidate,
      decision_cycle_v1: decisionCycle,
    },
    answers: {
      current_field_state: {
        source_object: "field_state_snapshot_v1",
        water_state: soilMoisture.state ?? null,
        soil_moisture_percent: soilMoisture.value ?? null,
        confidence_level: confidence.level ?? null,
        evidence_ref_count: recordArray(snapshot.evidence_refs_json).length,
      },
      seven_day_forecast: {
        source_object: "forecast_run_v1",
        horizon_days: forecastRun.horizon_days,
        point_count: forecastPoints.length,
        first_point: forecastPoints[0] ?? null,
        last_point: forecastPoints[forecastPoints.length - 1] ?? null,
      },
      scenario_comparison: {
        source_object: "scenario_set_v1",
        no_action_baseline_present: record(scenarioSet.baseline_scenario_json).scenario_id === "no_action",
        option_count: optionScenarios.length,
      },
      forecast_error: {
        source_objects: ["calibration_replay_v1", "forecast_error_v1"],
        predicted_soil_moisture_percent: record(calibrationReplay.predicted_json).predicted_soil_moisture_percent ?? null,
        observed_soil_moisture_percent: record(calibrationReplay.observed_json).post_soil_moisture_percent ?? null,
        error_metric: forecastError.error_metric,
        error_value: forecastError.error_value,
        error_direction: forecastError.error_direction,
      },
      learning_candidate: {
        source_object: "field_learning_candidate_v1",
        status: fieldLearningCandidate.candidate_status,
        candidate_only: learningStatement.candidate_only === true,
        formal_field_memory_created: learningStatement.formal_field_memory_created === true,
        model_updated: learningStatement.model_updated === true,
        h58_bypass_allowed: h58GateStatus.h58_bypass_allowed === true,
        candidate_can_enter_formal_gate: h58GateStatus.candidate_can_enter_formal_gate === true,
      },
      decision_cycle: {
        source_object: "decision_cycle_v1",
        status: decisionCycle.cycle_status,
        current_stage: decisionCycle.current_stage,
        missing_formalization: missingFormalization(externalRefs, fieldLearningCandidate),
        human_gate: decisionCycle.human_gate_json,
        boundary_flags: boundaryFlags,
        forbidden_auto_writes_absent: boundaryFlags.automatic_recommendation_created === false && boundaryFlags.automatic_approval_created === false && boundaryFlags.automatic_task_created === false && boundaryFlags.automatic_receipt_created === false && boundaryFlags.automatic_acceptance_created === false && boundaryFlags.automatic_roi_created === false && boundaryFlags.automatic_field_memory_created === false && boundaryFlags.model_updated === false,
      },
    },
  };
}

export function registerTwinKernelTraceReadModelRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/twin-kernel/traces/:decision_cycle_id", async (req: any, reply) => {
    const decisionCycleId = text(req?.params?.decision_cycle_id);
    if (!decisionCycleId) return reply.code(400).send({ ok: false, error: "DECISION_CYCLE_ID_REQUIRED" });
    const decisionCycle = await readDecisionCycleRow(pool, decisionCycleId);
    if (!decisionCycle) return reply.code(404).send({ ok: false, error: "DECISION_CYCLE_NOT_FOUND" });
    const snapshot = await readSnapshotRow(pool, text(decisionCycle.snapshot_id));
    const forecastRun = await readForecastRunRow(pool, text(decisionCycle.forecast_run_id));
    const scenarioSet = await readScenarioSetRow(pool, text(decisionCycle.scenario_set_id));
    const calibrationReplay = await readCalibrationReplayRow(pool, text(decisionCycle.calibration_replay_id));
    const forecastError = await readForecastErrorRow(pool, text(decisionCycle.forecast_error_id));
    const fieldLearningCandidate = await readFieldLearningCandidateRow(pool, text(decisionCycle.field_learning_candidate_id));
    const missing = [
      !snapshot ? "field_state_snapshot_v1" : "",
      !forecastRun ? "forecast_run_v1" : "",
      !scenarioSet ? "scenario_set_v1" : "",
      !calibrationReplay ? "calibration_replay_v1" : "",
      !forecastError ? "forecast_error_v1" : "",
      !fieldLearningCandidate ? "field_learning_candidate_v1" : "",
    ].filter(Boolean);
    if (missing.length > 0) return reply.code(409).send({ ok: false, error: "TWIN_TRACE_LINKED_OBJECTS_MISSING", decision_cycle: exposeDecisionCycleRow(decisionCycle), missing });
    const twinTrace = buildTraceReadModel({ snapshot: snapshot as Row, forecastRun: forecastRun as Row, scenarioSet: scenarioSet as Row, calibrationReplay: calibrationReplay as Row, forecastError: forecastError as Row, fieldLearningCandidate: fieldLearningCandidate as Row, decisionCycle });
    return reply.send({ ok: true, object_type: "twin_trace_v1_read_model", read_only: true, twin_trace: twinTrace });
  });
}
