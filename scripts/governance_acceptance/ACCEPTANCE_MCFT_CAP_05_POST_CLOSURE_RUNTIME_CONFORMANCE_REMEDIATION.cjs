// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION.cjs
// Purpose: enforce the append-only CAP-05 post-closure Runtime conformance remediation authority, non-canonical execution-view separation, successor block, and candidate acceptance evidence.
// Boundary: repository and child-process acceptance only; no database mutation, canonical Twin write, active binding, Model Activation, calibration, route, scheduler, CAP-06 Runtime authority, merge-effectiveness claim, or predecessor-eligibility restoration.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

const CONTRACT = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION.md';
const STATUS = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-STATUS.json';
const CLOSURE = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json';
const VIEW = 'apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts';
const RESOLVER = 'apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts';
const TICK = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
const PENDING = 'apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts';
const RECEIPT = 'apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts';
const RUNNER = 'apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts';
const RUNTIME_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_EXECUTION_CONFIG_RESOLUTION.ts';
const OBSOLETE_FAKE_ENVELOPE = 'apps/server/src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.ts';

let pass = 0;
const ok = (label) => {
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
};

for (const relative of [CONTRACT, STATUS, CLOSURE, VIEW, RESOLVER, TICK, PENDING, RECEIPT, RUNNER, RUNTIME_ACCEPTANCE]) {
  assert.equal(exists(relative), true, `REQUIRED_FILE_MISSING:${relative}`);
}
assert.equal(exists(OBSOLETE_FAKE_ENVELOPE), false, 'FAKE_CANONICAL_ENVELOPE_ADAPTER_MUST_BE_ABSENT');
ok('required remediation authority and source files exist; obsolete fake-envelope adapter is absent');

const closure = readJson(CLOSURE);
assert.equal(closure.capability_line_id, 'MCFT-CAP-05');
assert.equal(closure.status, 'COMPLETE');
assert.equal(closure.capability_complete, true);
assert.equal(closure.closure_effective, true);
ok('historical CAP-05 closure facts remain complete and are not rewritten');

const status = readJson(STATUS);
assert.equal(status.authority_id, 'MCFT-CAP-05.POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION-V1');
assert.equal(status.defect_id, 'MCFT-CAP-05-CONFORMANCE-DEFECT-01');
assert.equal(status.defect_owner, 'MCFT-CAP-05');
assert.equal(status.historical_completion_status, 'COMPLETE');
assert.equal(status.historical_closure_rewrite, false);
assert.equal(status.post_closure_conformance_status, 'DEFECT_CONFIRMED_REMEDIATION_IMPLEMENTED_AWAITING_FORMAL_POSTGRESQL_REGRESSION');
assert.deepEqual(status.affected_claims, [
  'BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_ESTABLISHED',
  'FORMAL_POSTGRESQL_RUNNER_TERMINAL_CHAIN_REPRODUCIBLE',
]);
ok('post-closure defect authority is append-only and owned by CAP-05');

assert.equal(status.canonical_cap05_config_mutation, false);
assert.equal(status.replacement_canonical_cap04_config_created, false);
assert.equal(status.derived_execution_view_canonical, false);
assert.equal(status.derived_execution_view_persisted, false);
assert.equal(status.cap04_validator_relaxed, false);
assert.equal(status.dynamics_math_changed, false);
assert.equal(status.forecast_math_changed, false);
assert.equal(status.scenario_math_changed, false);
ok('canonical Config, validators and mathematical kernels remain frozen');

assert.equal(status.successor_capability_line_id, 'MCFT-CAP-06');
assert.equal(status.successor_predecessor_eligibility, 'BLOCKED');
assert.equal(status.cap_06_s0_status, 'BLOCKED_BY_PREDECESSOR_RUNTIME_CONFORMANCE');
assert.equal(status.cap_06_s0_resume_authorized, false);
assert.equal(status.cap_06_runtime_authority, false);
assert.equal(status.cap_06_migration_authority, false);
assert.equal(status.formal_postgresql_runner_regression.status, 'PENDING');
ok('CAP-06 S0 remains blocked and receives no Runtime or migration authority');

const view = readText(VIEW);
assert.match(view, /export type ResolvedCap04ExecutionConfigV1 = \{/);
assert.match(view, /source_config_ref: string;/);
assert.match(view, /source_config_hash: string;/);
assert.match(view, /payload: Cap04RuntimeConfigPayloadV1;/);
assert.match(view, /DIRECT_CAP04_RUNTIME_CONFIG_V1/);
assert.match(view, /CAP05_INHERITED_CAP04_EXECUTION_VIEW_V1/);
const resolvedType = view.slice(
  view.indexOf('export type ResolvedCap04ExecutionConfigV1'),
  view.indexOf('export type Cap04ExecutionConfigResolverPortV1'),
);
assert.doesNotMatch(resolvedType, /\bobject_id\b/);
assert.doesNotMatch(resolvedType, /\bdeterminism_hash\b/);
assert.doesNotMatch(resolvedType, /\bobject_type\b/);
assert.doesNotMatch(resolvedType, /\bidempotency_key\b/);
ok('resolved execution view is structurally non-canonical');

const resolver = readText(RESOLVER);
assert.match(resolver, /validateCanonicalObjectV1\(canonicalConfig\)/);
assert.match(resolver, /validateCap05RuntimeConfigPayloadV1\(payload\)/);
assert.match(resolver, /validateCap04RuntimeConfigPayloadV1\(executionPayload\)/);
assert.match(resolver, /source_config_ref: canonicalConfig\.object_id/);
assert.match(resolver, /source_config_hash: canonicalConfig\.determinism_hash/);
assert.match(resolver, /payload: executionPayload/);
assert.doesNotMatch(resolver, /object_id:\s*canonicalConfig\.object_id/);
assert.doesNotMatch(resolver, /determinism_hash:\s*canonicalConfig\.determinism_hash/);
ok('CAP-05 resolver validates the canonical source and returns only source pins plus execution payload');

const tick = readText(TICK);
assert.match(tick, /assertCanonicalConfigEnvelopeV1/);
assert.match(tick, /executionConfigResolver\.resolveExecutionConfig\(runtimeConfig\)/);
assert.match(tick, /runtime_config: runtimeConfig/);
assert.match(tick, /runtime_config: \{ ref: runtimeConfig\.object_id, hash: runtimeConfig\.determinism_hash \}/);
ok('single-tick service separates envelope validation from payload resolution while persisting canonical CAP-05 pins');

const pending = readText(PENDING);
assert.match(pending, /executionConfigResolver\.resolveExecutionConfig\(runtimeConfig\)/);
assert.match(pending, /ref: runtimeConfig\.object_id/);
assert.match(pending, /hash: runtimeConfig\.determinism_hash/);
const receipt = readText(RECEIPT);
assert.match(receipt, /new Cap05InheritedCap04ExecutionConfigResolverV1\(\)/);
const runner = readText(RUNNER);
assert.match(runner, /new Cap05InheritedCap04ExecutionConfigResolverV1\(\)/);
assert.match(runner, /runtimeRepository/);
ok('receipt, pending-B and formal runner wiring use the separated resolver seam');

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const runtimeResult = spawnSync(command, [
  '-w', 'exec', 'tsx', RUNTIME_ACCEPTANCE,
], {
  cwd: ROOT,
  encoding: 'utf8',
  env: process.env,
});
if (runtimeResult.stdout) process.stdout.write(runtimeResult.stdout);
if (runtimeResult.stderr) process.stderr.write(runtimeResult.stderr);
assert.equal(runtimeResult.status, 0, 'EXECUTION_CONFIG_RUNTIME_ACCEPTANCE_FAILED');
assert.match(runtimeResult.stdout, /SUMMARY 10 PASS \/ 0 FAIL/);
ok('permanent execution-config separation acceptance passes');

assert.equal(pass, 9);
process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
