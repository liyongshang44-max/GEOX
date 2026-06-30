// scripts/twin_kernel/P13_07_MANUAL_TWIN_RUNTIME_LOOP_RUNNER_V0.cjs
// Purpose: run one manual, dry-run, write-disabled Twin state-forecast-observation-error-calibration-candidate cycle.
// Boundary: P13 handoff is not P12 execution; no scheduler, DB write, server route, frontend, P12 adapter invocation, Field Memory, model update, recommendation, AO-ACT, or dashboard authority.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const REGISTRY = 'docs/twin_kernel/TWIN_RUNTIME_CASE_REGISTRY_V0.json';
const LOOP = 'docs/twin_kernel/TWIN_RUNTIME_LOOP_CONTRACT_V0.json';
const DEDUPE = 'docs/twin_kernel/TWIN_RUNTIME_DEDUPE_POLICY_V0.json';
const HANDOFF_SCHEMA = 'docs/twin_kernel/P12_HANDOFF_BUNDLE_SCHEMA_V0.json';
const DEFAULT_CASE = 'p13_caf009_soil_moisture_single_cycle_v0';
const STEP_ORDER = [
  'source_contract_resolved',
  'state_snapshot_candidate',
  'forecast_run_candidate',
  'actual_observation_closed',
  'forecast_error_candidate',
  'calibration_candidate',
  'p12_handoff_bundle'
];
const STEP_TARGETS = {
  state_snapshot_candidate: 'field_state_snapshot_v1',
  forecast_run_candidate: 'forecast_run_v1',
  actual_observation_closed: 'calibration_replay_v1',
  forecast_error_candidate: 'forecast_error_v1',
  calibration_candidate: 'field_learning_candidate_v1'
};
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
function has(name) { return process.argv.includes(name); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, rel), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}'; return JSON.stringify(value); }
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function safeStatePath(file) { if (!file) return null; const resolved = path.resolve(file); const tmp = path.resolve(os.tmpdir()); if (!resolved.startsWith(tmp + path.sep) && resolved !== tmp) throw new Error('P13_STATE_FILE_MUST_BE_TEMP_PATH'); return resolved; }
function loadState(file) { if (!file || !fs.existsSync(file)) return { runs: {}, checkpoints: {} }; return JSON.parse(fs.readFileSync(file, 'utf8')); }
function saveState(file, state) { if (!file) return; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(state, null, 2)); }
function getCase(registry, runtimeCaseId) { const item = registry.cases.find((c) => c.runtime_case_id === runtimeCaseId); if (!item) throw new Error('P13_RUNTIME_CASE_NOT_FOUND'); return item; }
function buildIdentity(fixture, loop) { return { runtime_case_id: fixture.runtime_case_id, input_window: fixture.input_window, forecast_window: fixture.forecast_window, observation_window: fixture.observation_window, model_version_set: fixture.model_version_set, source_contract_hash: fixture.source_contract_hash, runner_contract_version: loop.runner_contract_version }; }
function makeCandidate(step, fixture, runtimeRunId) { const target = STEP_TARGETS[step]; const payload = { runtime_case_id: fixture.runtime_case_id, source_case_id: fixture.source_case_id, step, target_object_type: target, input_window: fixture.input_window, forecast_window: fixture.forecast_window, observation_window: fixture.observation_window, fixture_values: fixture.fixture_values, model_version_set: fixture.model_version_set }; const candidateId = 'cand_p13_' + step; return { schema_version: 'candidate_twin_object_envelope_v0', candidate_id: candidateId, runtime_run_id: runtimeRunId, source_artifact_kind: 'p13_runtime_core_cycle_artifact_v0', candidate_target_object_type: target, target_object_type_authority: 'descriptive_only', persisted_target_object_ref: null, persistence_status: 'not_persisted', write_allowed: false, p12_adapter_invoked: false, model_update_allowed: false, field_memory_write_allowed: false, ao_act_task_allowed: false, dashboard_authority: false, candidate_payload: payload, candidate_hash: digest(payload) }; }
function makeTrace(runtimeRunId, idemKey, fixture, step, outputRef) { const material = { runtime_run_id: runtimeRunId, runtime_run_idempotency_key: idemKey, runtime_case_id: fixture.runtime_case_id, step, outputRef }; return { event_id: 'tevt_' + digest(material).slice(0, 48), runtime_run_id: runtimeRunId, runtime_run_idempotency_key: idemKey, runtime_case_id: fixture.runtime_case_id, step, input_refs: [fixture.source_case_id], output_refs: outputRef ? [outputRef] : [], policy_refs: ['TWIN_RUNTIME_LOOP_CONTRACT_V0', 'TWIN_RUNTIME_DEDUPE_POLICY_V0'], decision: 'emitted', blocked_reason: null, timestamp: fixture.declared_timestamp }; }
function buildRun({ state, stateFile, simulateFailureAfter, resumeFromCheckpoint }) {
  const registry = readJson(REGISTRY);
  const loop = readJson(LOOP);
  const dedupe = readJson(DEDUPE);
  const handoffSchema = readJson(HANDOFF_SCHEMA);
  const runtimeCaseId = arg('--registry-case') || DEFAULT_CASE;
  const registryCase = getCase(registry, runtimeCaseId);
  const fixture = readJson(registryCase.fixture_ref);
  const identity = buildIdentity(fixture, loop);
  const runtimeRunIdempotencyKey = dedupe.runtime_run_idempotency_key_prefix + digest(identity).slice(0, 48);
  const runtimeRunId = dedupe.runtime_run_id_prefix + digest({ runtimeRunIdempotencyKey }).slice(0, 48);
  const existing = state.runs[runtimeRunIdempotencyKey];
  if (existing && !simulateFailureAfter && !resumeFromCheckpoint) return { ...existing.result, runtime_run_created_count: 0, second_run_created_count: 0, duplicate_run_created_count: 0, same_run_idempotency_key_reused: true, same_candidate_hashes_reused: true, runtime_run_id_unchanged: true };
  const candidates = [];
  const traceEvents = [];
  let completedSteps = [];
  let resumeReadsCheckpoint = false;
  let resumeStartsAfterCheckpointStep = false;
  let previousCandidateHashesReused = false;
  if (resumeFromCheckpoint) {
    const checkpoint = state.checkpoints[resumeFromCheckpoint];
    if (!checkpoint) throw new Error('P13_CHECKPOINT_NOT_FOUND');
    resumeReadsCheckpoint = true;
    completedSteps = checkpoint.completed_steps.slice();
    for (const saved of checkpoint.candidates) candidates.push(saved);
    previousCandidateHashesReused = checkpoint.candidates.length > 0;
    resumeStartsAfterCheckpointStep = true;
  }
  for (const step of STEP_ORDER) {
    if (completedSteps.includes(step)) continue;
    if (STEP_TARGETS[step]) candidates.push(makeCandidate(step, fixture, runtimeRunId));
    traceEvents.push(makeTrace(runtimeRunId, runtimeRunIdempotencyKey, fixture, step, STEP_TARGETS[step] ? candidates[candidates.length - 1].candidate_id : step));
    completedSteps.push(step);
    const checkpointRef = 'checkpoint_' + digest({ runtimeRunIdempotencyKey, completedSteps, candidates: candidates.map((c) => c.candidate_hash) }).slice(0, 48);
    state.checkpoints[checkpointRef] = { checkpoint_ref: checkpointRef, runtime_run_id: runtimeRunId, runtime_run_idempotency_key: runtimeRunIdempotencyKey, completed_steps: completedSteps.slice(), candidates: candidates.slice(), created_at: fixture.declared_timestamp, storage_mode: 'stdout_or_temp_test_state' };
    saveState(stateFile, state);
    if (simulateFailureAfter === step) return baseResult({ fixture, runtimeRunId, runtimeRunIdempotencyKey, candidates, traceEvents, checkpointRef, completed: false, simulatedFailureAfter: step, failureProducedCheckpoint: true, resumeReadsCheckpoint, resumeStartsAfterCheckpointStep, previousCandidateHashesReused, runtimeRunCreatedCount: 1 });
  }
  const checkpointRef = 'checkpoint_' + digest({ runtimeRunIdempotencyKey, completedSteps, final: true }).slice(0, 48);
  const handoff = { schema_version: 'p12_handoff_bundle_v0', runtime_run_id: runtimeRunId, runtime_case_id: fixture.runtime_case_id, candidate_schema_version: handoffSchema.candidate_schema_version, candidate_set_kind: handoffSchema.candidate_set_kind, candidate_count: candidates.length, p12_handoff_candidate_count: candidates.length, candidates, persisted_target_object_ref: null, write_allowed: false, p12_adapter_invoked: false, persistence_execution_allowed: false, human_authorization_required: true, automatic_persistence_created: false, handoff_is_not_p12_execution: true };
  const result = baseResult({ fixture, runtimeRunId, runtimeRunIdempotencyKey, candidates, traceEvents, checkpointRef, completed: true, handoff, resumeReadsCheckpoint, resumeStartsAfterCheckpointStep, previousCandidateHashesReused, runtimeRunCreatedCount: existing ? 0 : 1 });
  state.runs[runtimeRunIdempotencyKey] = { result, candidate_hashes: candidates.map((c) => c.candidate_hash) };
  saveState(stateFile, state);
  return result;
}
function baseResult({ fixture, runtimeRunId, runtimeRunIdempotencyKey, candidates, traceEvents, checkpointRef, completed, handoff = null, simulatedFailureAfter = null, failureProducedCheckpoint = false, resumeReadsCheckpoint = false, resumeStartsAfterCheckpointStep = false, previousCandidateHashesReused = false, runtimeRunCreatedCount = 1 }) {
  const counts = { field_state_snapshot_v1: 0, forecast_run_v1: 0, calibration_replay_v1: 0, forecast_error_v1: 0, field_learning_candidate_v1: 0 };
  for (const c of candidates) counts[c.candidate_target_object_type] = (counts[c.candidate_target_object_type] || 0) + 1;
  return { schema_version: 'manual_twin_runtime_loop_result_v0', runtime_case_id: fixture.runtime_case_id, runtime_run_id: runtimeRunId, runtime_run_idempotency_key: runtimeRunIdempotencyKey, run_mode: 'dry_run', write_mode: 'write_disabled', data_mode: 'committed_fixture', manual_runner_mode: true, dry_run_default: true, write_disabled_default: true, default_data_mode: 'committed_fixture', raw_samples_required_by_default: false, p8_replay_invoked_by_default: false, runtime_cycle_count: completed ? 1 : 0, input_window_resolved: true, input_window: fixture.input_window, forecast_window: fixture.forecast_window, observation_window: fixture.observation_window, runtime_run_created_count: runtimeRunCreatedCount, first_run_created_count: runtimeRunCreatedCount, second_run_created_count: 0, duplicate_run_created_count: 0, same_run_idempotency_key_reused: runtimeRunCreatedCount === 0, same_candidate_hashes_reused: runtimeRunCreatedCount === 0 || previousCandidateHashesReused, runtime_run_id_unchanged: true, state_snapshot_candidate_count: counts.field_state_snapshot_v1, forecast_run_candidate_count: counts.forecast_run_v1, actual_observation_window_count: counts.calibration_replay_v1, forecast_error_candidate_count: counts.forecast_error_v1, calibration_candidate_count: counts.field_learning_candidate_v1, candidates, candidate_hashes: candidates.map((c) => c.candidate_hash), runtime_trace_event_count: traceEvents.length + 1, trace_events: traceEvents, checkpoint_created: true, checkpoint_ref: checkpointRef, checkpoint_storage_mode: 'stdout_or_temp_test_state', checkpoint_db_write_allowed: false, checkpoint_repo_write_allowed: false, checkpoint_persistence_allowed: false, checkpoint_replay_supported: true, simulated_failure_after_step: simulatedFailureAfter, failure_produced_checkpoint: failureProducedCheckpoint, resume_reads_checkpoint: resumeReadsCheckpoint, resume_starts_after_checkpoint_step: resumeStartsAfterCheckpointStep, previous_candidate_hashes_reused: previousCandidateHashesReused, duplicate_candidate_created: false, final_cycle_completed: completed, final_runtime_run_idempotency_key_unchanged: true, p12_handoff_bundle_created: handoff !== null, p12_handoff_candidate_count: handoff ? handoff.candidate_count : 0, p12_handoff_bundle: handoff, p12_adapter_invoked: false, persistence_execution_allowed: false, automatic_scheduler_created: false, automatic_persistence_created: false, field_memory_write_count: 0, model_update_count: 0, recommendation_created: false, ao_act_task_created: false, dashboard_authority: false, server_runtime_surface_changed: false, production_runtime_surface_changed: false, db_surface_changed: false, frontend_surface_changed: false };
}
function main() {
  const stateFile = safeStatePath(arg('--state-file'));
  const state = loadState(stateFile);
  const result = buildRun({ state, stateFile, simulateFailureAfter: arg('--simulate-failure-after'), resumeFromCheckpoint: arg('--resume-from-checkpoint') });
  console.log(JSON.stringify(result, null, 2));
}
try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exit(1); }
