#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  devtools: path.join(root, 'apps/server/src/modules/devtools/registerDevtoolsModule.ts'),
  simulator: path.join(root, 'apps/server/src/routes/device_simulator_v1.ts'),
  telemetryIngest: path.join(root, 'apps/server/src/services/telemetry_ingest_service_v1.ts'),
  observation: path.join(root, 'apps/server/src/services/device_observation_service_v1.ts'),
  stage1: path.join(root, 'apps/server/src/domain/decision/stage1_action_boundary_v1.ts'),
  evidencePolicy: path.join(root, 'apps/server/src/domain/evidence/formal_evidence_policy_v1.ts'),
  flightEvidence: path.join(root, 'apps/server/src/routes/dev/flight_table_evidence_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function fail(message) {
  console.error(`[devtools-simulator-not-formal] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}
function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const devtools = read(files.devtools);
const simulator = read(files.simulator);
const telemetryIngest = read(files.telemetryIngest);
const observation = read(files.observation);
const stage1 = read(files.stage1);
const evidencePolicy = read(files.evidencePolicy);
const flightEvidence = read(files.flightEvidence);

// Devtools must be gated globally by explicit feature flag.
assertIncludes(devtools, 'GEOX_DEVTOOLS_ENABLED', 'devtools module feature flag');
assertIncludes(devtools, 'isDevtoolsEnabledV1', 'devtools module flag helper');
assertIncludes(devtools, 'if (!isDevtoolsEnabledV1())', 'devtools module disabled branch');
assertIncludes(devtools, 'devtools_module_disabled', 'devtools module disabled log');

// Simulator routes must also enforce disabled behavior locally for direct registration/regression safety.
assertIncludes(simulator, 'GEOX_DEVTOOLS_ENABLED', 'simulator feature flag');
assertIncludes(simulator, 'DEVTOOLS_DISABLED', 'simulator disabled response');
assertIncludes(simulator, 'devtoolsDisabled(reply)', 'simulator disabled guard');

// Simulator start/stop must require write/admin-level scope, not telemetry.read.
assertIncludes(simulator, 'requireSimulatorRunAuthV1', 'simulator run auth helper');
assertIncludes(simulator, 'dev.simulator.run', 'simulator required run scope');
assertIncludes(simulator, 'security.admin', 'simulator alternate admin scope');
assertIncludes(simulator, 'mode: "run"', 'simulator start stop run mode');
assertIncludes(simulator, 'mode: "read"', 'simulator read mode');
assertIncludes(simulator, 'opts.mode === "run" ? requireSimulatorRunAuthV1(req, reply) : requireAoActScopeV0(req, reply, "telemetry.read")', 'simulator auth split read/run');
assertNotIncludes(simulator, 'const auth = requireAoActScopeV0(req, reply, "telemetry.read");\n  if (!auth) return null;', 'simulator start/stop must not use read scope-only helper');

// Simulator telemetry must be marked simulated and non-formal end to end.
for (const field of ['source_lane', 'is_simulated', 'formal_eligible', 'evidence_level', 'dev_source']) {
  assertIncludes(simulator, field, 'simulator telemetry trust metadata');
  assertIncludes(telemetryIngest, field, 'telemetry ingest trust metadata');
  assertIncludes(observation, field, 'observation trust metadata');
}
assertIncludes(simulator, 'source_lane: "SIMULATED_DEV_ONLY"', 'simulator source lane');
assertIncludes(simulator, 'is_simulated: true', 'simulator simulated flag');
assertIncludes(simulator, 'formal_eligible: false', 'simulator formal eligible false');
assertIncludes(simulator, 'evidence_level: "DEBUG"', 'simulator evidence level debug');
assertIncludes(simulator, 'dev_source: "DEVICE_SIMULATOR_V1"', 'simulator dev source');
assertIncludes(telemetryIngest, 'source_lane = context.source_lane ?? (context.is_simulated ? "SIMULATED_DEV_ONLY" : "UNKNOWN")', 'telemetry ingest source lane default');
assertIncludes(telemetryIngest, 'formal_eligible = is_simulated ? false : context.formal_eligible === true', 'telemetry ingest non-formal simulation');
assertIncludes(observation, 'isSimulatedObservation', 'observation simulated predicate');
assertIncludes(observation, 'if (field_id === "_na_field" || isSimulatedObservation(input))', 'simulated observation must not run formal pipeline');
assertIncludes(observation, 'LEFT JOIN facts f ON f.fact_id = o.fact_id', 'observation loader must inspect fact trust metadata');
assertIncludes(observation, 'if (simulated) return null', 'simulated historical observations must be excluded from pipeline input');
assertIncludes(observation, 'simulated_dev_only_not_formal_stage1', 'observation explanation code for simulated exclusion');

// Stage-1 formal trigger gate must block simulated/dev summaries.
assertIncludes(stage1, 'isSimulatedStage1SummaryV1', 'stage1 simulated summary guard');
assertIncludes(stage1, 'SIMULATED_STAGE1_SUMMARY_NOT_FORMAL_TRIGGER', 'stage1 simulated blocking reason');
assertIncludes(stage1, 'summary.formal_eligible === false', 'stage1 formal eligible guard');
assertIncludes(stage1, 'sourceLane === "SIMULATED_DEV_ONLY"', 'stage1 source lane guard');
assertIncludes(stage1, 'sourceLane === "DEBUG_ONLY"', 'stage1 debug lane guard');
assertIncludes(stage1, 'evidenceLevel === "DEBUG"', 'stage1 evidence level guard');
assertIncludes(stage1, 'containsDevMarker(summaryPayload)', 'stage1 dev marker guard');

// Flight Table evidence must remain non-formal and under admin/feature flag boundaries.
assertIncludes(evidencePolicy, 'FLIGHT_TABLE_DEV_EVIDENCE_NOT_FORMAL', 'formal evidence policy flight table block');
assertIncludes(evidencePolicy, 'SIMULATED_OR_DEV_EVIDENCE', 'formal evidence policy simulated block');
assertIncludes(evidencePolicy, 'flightTableEvidence ? false', 'formal evidence policy flight table formal false');
assertIncludes(evidencePolicy, 'flightTableEvidence ? "SIMULATED_DEV_ONLY"', 'formal evidence policy flight table lane');
assertIncludes(evidencePolicy, 'flightTableEvidence ? "DEBUG"', 'formal evidence policy flight table debug');
assertIncludes(flightEvidence, 'ENABLE_FLIGHT_TABLE_API', 'flight table feature flag');
assertIncludes(flightEvidence, 'security.admin', 'flight table admin scope');

const fixture = String.raw`
const { evaluateFormalStage1TriggerGateV1, isSimulatedStage1SummaryV1 } = await import('./apps/server/src/domain/decision/stage1_action_boundary_v1.ts');
const { classifyEvidenceArtifactV1 } = await import('./apps/server/src/domain/evidence/formal_evidence_policy_v1.ts');
function assertRuntime(condition, message) { if (!condition) throw new Error(message); }
const simulatedStage1 = {
  irrigation_effectiveness: 'low',
  leak_risk: 'high',
  source_lane: 'SIMULATED_DEV_ONLY',
  is_simulated: true,
  formal_eligible: false,
  evidence_level: 'DEBUG',
  dev_source: 'DEVICE_SIMULATOR_V1',
  evidence_sufficiency: 'PASS',
  time_coverage_v1: {
    source_lane: 'SIMULATED_DEV_ONLY',
    is_simulated: true,
    formal_eligible: false,
    evidence_level: 'DEBUG',
    observation_window: { start_ts_ms: 1, end_ts_ms: 2 },
    formal_sample_count: 10,
    formal_coverage_ratio: 1,
    formal_source_eligible: true,
    max_gap_ms: 1,
    expected_sample_interval_ms: 1,
    trigger_metric_evidence: { irrigation_effectiveness: true, leak_risk: true },
    freshness: 'fresh'
  },
  evidence_sufficiency_v1: { evidence_sufficiency: 'PASS' },
  device_health_snapshot_v1: { device_health_status: 'GOOD' },
  conflict_detection_v1: { conflict_status: 'CLEAR' }
};
assertRuntime(isSimulatedStage1SummaryV1(simulatedStage1) === true, 'simulated stage1 summary must be detected');
const gate = evaluateFormalStage1TriggerGateV1(simulatedStage1);
assertRuntime(gate.status !== 'ELIGIBLE', 'simulated stage1 summary must not be formal eligible');
assertRuntime(gate.reason_codes.includes('SIMULATED_STAGE1_SUMMARY_NOT_FORMAL_TRIGGER'), 'simulated stage1 summary must include blocking reason');
const flight = classifyEvidenceArtifactV1({ source: 'FLIGHT_TABLE_DEV_EVIDENCE', dev_source: 'FLIGHT_TABLE', artifact_ref: 'flight-table/run/evidence.json', kind: 'water_delivery_receipt', formal_eligible: true });
assertRuntime(flight.source_lane === 'SIMULATED_DEV_ONLY', 'Flight Table source lane must be simulated');
assertRuntime(flight.is_simulated === true, 'Flight Table evidence must be simulated');
assertRuntime(flight.formal_eligible === false, 'Flight Table evidence must not be formal eligible');
assertRuntime(flight.evidence_level === 'DEBUG', 'Flight Table evidence must be DEBUG');
`;
const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (runtime.status !== 0) {
  process.stderr.write(runtime.stdout || '');
  process.stderr.write(runtime.stderr || '');
  fail('runtime fixture failed');
}
console.log('[devtools-simulator-not-formal] PASS');
