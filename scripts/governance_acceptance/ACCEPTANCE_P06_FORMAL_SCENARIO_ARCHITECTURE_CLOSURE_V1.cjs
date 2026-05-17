#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const files = {
  kernel: 'apps/server/src/services/scenarios/formal_scenario_kernel_v1.ts',
  verify: 'apps/server/src/services/scenarios/formal_scenario_verify_v1.ts',
  irrigationTs: 'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts',
  irrigationCjs: 'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.cjs',
  noProjectionGate: 'scripts/governance_acceptance/ACCEPTANCE_FORMAL_SCENARIO_NO_PROJECTION_WRITE_V1.cjs',
  releaseGate: 'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_SCENARIO_E2E_RELEASE_GATE.cjs',
  flightTableRoute: 'apps/server/src/routes/dev/flight_table_v1.ts',
  artifactDoc: 'docs/flight-table/FORMAL_SCENARIO_ARTIFACT_STRATEGY_V1.md',
};

const kernel = read(files.kernel);
const verify = read(files.verify);
const irrigationTs = read(files.irrigationTs);
const irrigationCjs = read(files.irrigationCjs);
const noProjection = read(files.noProjectionGate);
const releaseGate = read(files.releaseGate);
const flightTable = read(files.flightTableRoute);

assert.match(kernel, /runFormalScenarioKernelV1\s*\(/, 'kernel must expose runFormalScenarioKernelV1');
assert.match(verify, /prescription_created/, 'formal scenario verify must include prescription_created');
assert.match(irrigationTs, /runFormalScenarioKernelV1/, 'formal irrigation script must use runFormalScenarioKernelV1');
assert.doesNotMatch(irrigationTs, /function\s+runId\s*\(/, 'formal irrigation script must not define function runId');
assert.doesNotMatch(irrigationTs, /function\s+fixture\s*\(/, 'formal irrigation script must not define function fixture');
assert.doesNotMatch(irrigationTs, /function\s+manifestOf\s*\(/, 'formal irrigation script must not define function manifestOf');
assert.doesNotMatch(irrigationTs, /function\s+snap\s*\(/, 'formal irrigation script must not define function snap');
assert.match(irrigationTs, /prescription\?\.prescription_id/, 'formal irrigation script must read prescription?.prescription_id from create response');
assert.match(irrigationTs, /ctx\.recordApiSnapshot\s*\(/, 'formal irrigation positive path must record API snapshots via ctx.recordApiSnapshot');
assert.doesNotMatch(irrigationTs, /manifest\s*=\s*\{/, 'formal irrigation positive path must not create local manifest object');
assert.doesNotMatch(irrigationTs, /api_snapshots\s*:\s*\[\]/, 'formal irrigation positive path must not create local snapshot array');
assert.match(verify, /prescription_created:\s*Boolean\(manifest\.prescription_id\)/, 'verify must hard-require manifest.prescription_id for prescription_created');
assert.match(noProjection, /ACCEPTANCE_FORMAL_.*\.\(cjs\|ts\)/, 'no-projection-write gate must scan formal ts acceptance files');

assert.match(irrigationTs, /\/api\/v1\/actions\/index\?/, 'formal irrigation script must fetch task via actions index before receipt');
assert.match(irrigationTs, /buildObservedParametersFromSchema/, 'formal irrigation script must build observed_parameters from task schema');
assert.match(irrigationTs, /assertFormalReceiptContract/, 'formal irrigation script must self-check receipt contract before submit');
assert.doesNotMatch(irrigationTs, /receipt_success_not_acceptance_pass\s*=\s*true/, 'formal irrigation script must not hardcode receipt_success_not_acceptance_pass=true');
assert.match(irrigationTs, /approval_rejected_no_task/, 'formal irrigation script must include approval_rejected_no_task negative gate');
assert.match(irrigationTs, /(decision:\s*['"]REJECT['"]|decision:\s*['"]DECLINE['"]|approved:\s*false)/, 'approval_rejected_no_task flow must include explicit reject/decline semantics');
assert.match(irrigationTs, /requireOk\s*\(\s*taskIndexResp\s*,/, 'formal irrigation receipt flow must requireOk(taskIndexResp, ...) before receipt');
assert.match(irrigationTs, /taskRecord/, 'formal irrigation receipt flow must include explicit taskRecord checks before receipt');
assert.match(irrigationTs, /(FORMAL_RECEIPT_CONTRACT_INVALID|TASK_RECORD_MISSING_BEFORE_RECEIPT|TASK_PARAMETER_SCHEMA_KEYS_MISSING|OBSERVED_PARAMETER_NOT_ALLOWED|NEGATIVE_TASK_RECORD_MISSING_BEFORE_RECEIPT|NEGATIVE_TASK_PARAMETER_SCHEMA_KEYS_MISSING|NEGATIVE_OBSERVED_PARAMETER_NOT_ALLOWED)/, 'formal irrigation receipt flow must include strong pre-receipt validation markers');
assert.doesNotMatch(irrigationTs, /result\.recordApiSnapshot\s*\(/, 'formal irrigation script must not call result.recordApiSnapshot');
assert.doesNotMatch(irrigationTs, /negative[\s\S]{0,4000}result\.manifest\.act_task_id/, 'negative receipt lane must not reuse positive result.manifest.act_task_id');
assert.doesNotMatch(irrigationTs, /observed_parameters:\s*\{\s*duration_min\s*:/, 'formal irrigation script must not put duration/effect metrics into observed_parameters');
assert.match(irrigationTs, /meta:\s*\{[^}]*execution_summary:[\s\S]*effect_observation:/, 'formal irrigation script must keep execution/effect summary in meta');
assert.match(irrigationTs, /(PRESCRIPTION_ID_MISSING|FORMAL_PRESCRIPTION_REQUIRED|manifest\.prescription_id)/, 'formal irrigation script must assert/output non-empty prescription_id semantics');
assert.match(noProjection, /DEVICE_ANOMALY_E2E_V1/, 'no-projection-write gate must scan device anomaly script');
assert.match(releaseGate, /ci:governance:formal-scenario-no-projection-write/, 'release gate must include formal-scenario-no-projection-write');
assert.match(flightTable, /\/api\/v1\/dev\/flight-table\/formal-scenarios/, 'flight table route must expose formal-scenarios endpoint');
assert.match(flightTable, /listFormalScenarioLaneDefinitionsV1/, 'flight table route must use listFormalScenarioLaneDefinitionsV1');
assert.ok(exists(files.artifactDoc), 'artifact strategy document must exist');

const output = {
  ok: true,
  gate: 'P06_FORMAL_SCENARIO_ARCHITECTURE_CLOSURE_V1',
  checks: {
    kernel_runFormalScenarioKernelV1: true,
    verify_prescription_created: true,
    irrigation_uses_kernel: true,
    irrigation_no_local_runtime_helpers: true,
    irrigation_prescription_assertion_or_output: true,
    irrigation_receipt_observed_parameters_schema_aligned: true,
    irrigation_receipt_execution_effect_in_meta: true,
    irrigation_negative_receipt_not_hardcoded_true: true,
    irrigation_negative_approval_uses_reject_semantics: true,
    irrigation_receipt_preindex_require_ok: true,
    irrigation_receipt_taskrecord_strong_validation: true,
    irrigation_no_result_record_api_snapshot: true,
    irrigation_negative_receipt_not_reuse_positive_task: true,
    no_projection_gate_scans_device_anomaly: true,
    release_gate_has_no_projection: true,
    flight_table_formal_scenarios_endpoint: true,
    flight_table_uses_shared_lane_definitions: true,
    artifact_strategy_doc_exists: true,
  },
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
