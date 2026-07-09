// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION.cjs
// Purpose: validate final MCFT-CAP-01 remediation closure, exact evidence, implementation presence, frozen-authority preservation, and changed-file boundary.
// Boundary: static governance acceptance only; no PostgreSQL, Runtime execution, canonical write, propagation, successful Forecast, Scenario, Recommendation, Decision, AO-ACT, scheduler, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '250053aba801075c17098f8d505d527eb54390e9';
const CANDIDATE = '193f9785e42eb146e300e2a64abeed455f10e54e';
const SLICE = 'MCFT-CAP-01.CLOSURE-REMEDIATION-V1';
let pass = 0;
let fail = 0;

function check(value, message) {
  if (value) { pass += 1; console.log(`PASS ${message}`); }
  else { fail += 1; console.error(`FAIL ${message}`); }
}
function readJson(relativePath) { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }
function readText(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

const delivery = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json');
const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const closureRecord = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-RECORD.json');
const remediation = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE-REMEDIATION-STATUS.json');
const s4 = readJson('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-S4-STATUS.json');
const task = readText('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-TASK.md');
const closure = readText('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md');
const runtimeDoc = readText('docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION.md');
const implementationMap = readText('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');
const ports = readText('apps/server/src/runtime/twin_runtime/ports.ts');
const selector = readText('apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts');
const validator = readText('apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts');
const nextTickService = readText('apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts');
const nextTickRepository = readText('apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts');
const runner = readText('apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts');
const context = readJson('fixtures/mcft/water_state/replay_v1/configuration_context.json');
const manifestV2 = readJson('fixtures/mcft/water_state/replay_v1/manifest_v2.json');

const claims = [
  'MCFT_CAP_01_COMPLETE',
  'FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED',
  'CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED',
  'PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED',
  'CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED',
  'EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED',
  'A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED',
  'OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED',
  'CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED'
];
const nonclaims = [
  'NO_PROPAGATION','NO_SUCCESSFUL_FORECAST','NO_SCENARIO','NO_RECOMMENDATION','NO_DECISION','NO_AO_ACT',
  'NO_CONTINUOUS_RUNTIME','NO_CONTINUOUS_SCHEDULER','NO_RESTART_BACKFILL_PROOF','NO_LATE_EVIDENCE_REVISION_RUNTIME',
  'NO_LIVE_FIELD_CLAIM','NO_MCFT_GATE_A_CLOSURE','NO_MCFT_GATE_B_CLOSURE','NO_MCFT_GATE_C_CLOSURE','NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM'
];

check(delivery.capability_line_id === 'MCFT-CAP-01', 'delivery capability identity');
check(delivery.status === 'COMPLETE', 'delivery capability status COMPLETE');
check(delivery.active_delivery_slice_id === null, 'no active delivery slice');
check(delivery.remediation_implementation_candidate_head === CANDIDATE, 'delivery candidate head exact');
check(delivery.historical_closure.status === 'SUPERSEDED_BY_REMEDIATION', 'historical closure superseded by remediation');
check(delivery.remediation.status === 'COMPLETE', 'remediation block COMPLETE');
check(delivery.remediation.pr === 2316, 'remediation PR exact');
check(delivery.remediation.acceptance.s1_replay_dataset === '12_PASS_0_FAIL', 'S1 evidence recorded');
check(delivery.remediation.acceptance.s4_a0_runtime_static === '21_PASS_0_FAIL', 'S4 static evidence recorded');
check(delivery.remediation.acceptance.s4_a0_runtime_postgres === '12_PASS_0_FAIL', 'S4 PostgreSQL evidence recorded');
check(delivery.remediation.acceptance.remediation_static === '18_PASS_0_FAIL', 'remediation static evidence recorded');
check(delivery.remediation.acceptance.remediation_postgres === '7_PASS_0_FAIL', 'remediation PostgreSQL evidence recorded');
check(delivery.remediation.acceptance.governance_readiness === '106_PASS_0_FAIL', 'governance readiness evidence recorded');
check(delivery.remediation.acceptance.exact_head_ci.run_number === 4491 && delivery.remediation.acceptance.exact_head_ci.run_id === 29038423099 && delivery.remediation.acceptance.exact_head_ci.conclusion === 'success', 'candidate exact-head CI success recorded');
check(delivery.remediation.acceptance.manual_runner_first === 'INSERTED', 'manual runner first execution recorded');
check(delivery.remediation.acceptance.manual_runner_second === 'EXISTING_IDEMPOTENT_SUCCESS', 'manual runner idempotent replay recorded');
check(delivery.slices.length === 7, 'exact seven delivery slices including superseded closure and remediation');
check(delivery.slices.filter((slice) => slice.status === 'COMPLETE').length === 6, 'six effective slices COMPLETE');
check(delivery.slices.some((slice) => slice.delivery_slice_id === 'MCFT-CAP-01.CLOSURE-V1' && slice.status === 'SUPERSEDED_BY_REMEDIATION'), 'historical closure slice superseded');
for (const claim of claims) check(delivery.completion_claims.includes(claim), `delivery completion claim: ${claim}`);
for (const nonclaim of nonclaims) check(delivery.nonclaims.includes(nonclaim), `delivery nonclaim: ${nonclaim}`);
check(!delivery.nonclaims.includes('NO_MCFT_CAP_01_CLOSURE'), 'obsolete capability closure nonclaim removed');
check(!delivery.nonclaims.includes('NO_PERSISTED_NEXT_TICK_HANDOFF'), 'obsolete persisted handoff nonclaim removed');
check(delivery.next_authorized_slice_ids.length === 0, 'no successor authorized');

const line = matrix.capability_lines.find((item) => item.capability_line_id === 'MCFT-CAP-01');
check(line?.status === 'COMPLETE', 'matrix capability COMPLETE');
check(line?.active_delivery_slice_id === null, 'matrix no active slice');
check(line?.remediation_implementation_candidate_head === CANDIDATE, 'matrix candidate head exact');
check(line?.delivery_slices?.length === 7, 'matrix exact seven slices');
check(line?.delivery_slices?.filter((slice) => slice.status === 'COMPLETE').length === 6, 'matrix six effective COMPLETE slices');
check(line?.excluded_owner_work_package_ids?.includes('MCFT-06'), 'MCFT-06 remains excluded');
for (const claim of claims) check(line?.completion_claims?.includes(claim), `matrix completion claim: ${claim}`);
for (const nonclaim of nonclaims) check(line?.preserved_nonclaims?.includes(nonclaim), `matrix nonclaim: ${nonclaim}`);
check(line?.next_authorized_slice_ids?.length === 0, 'matrix authorizes no successor');

check(closureRecord.status === 'COMPLETE', 'Closure Record COMPLETE');
check(closureRecord.active_delivery_slice_id === null, 'Closure Record no active slice');
check(closureRecord.authority.remediation_implementation_candidate_head === CANDIDATE, 'Closure Record candidate head exact');
check(closureRecord.historical_closure.status === 'SUPERSEDED_BY_REMEDIATION', 'Closure Record supersedes historical closure');
check(closureRecord.remediation_evidence.remediation_postgres === '7_PASS_0_FAIL', 'Closure Record DB evidence');
check(closureRecord.remediation_evidence.manual_runner.first_execution_status === 'INSERTED', 'Closure Record runner first execution');
check(closureRecord.remediation_evidence.manual_runner.second_execution_status === 'EXISTING_IDEMPOTENT_SUCCESS', 'Closure Record runner idempotency');
check(closureRecord.remediation_evidence.manual_runner.posterior_mean === 0.192595, 'Closure Record posterior mean');
check(closureRecord.remediation_evidence.manual_runner.posterior_variance === 0.002678, 'Closure Record posterior variance');
check(closureRecord.remediation_evidence.manual_runner.next_logical_tick_time === '2026-06-01T02:00:00.000Z', 'Closure Record next tick');
for (const claim of claims) check(closureRecord.completion_claims.includes(claim), `Closure Record completion claim: ${claim}`);
for (const nonclaim of nonclaims) check(closureRecord.preserved_nonclaims.includes(nonclaim), `Closure Record nonclaim: ${nonclaim}`);
check(closureRecord.next_authorized_slice_ids.length === 0, 'Closure Record authorizes no successor');

check(remediation.status === 'COMPLETE', 'remediation status COMPLETE');
check(remediation.implementation_candidate_head === CANDIDATE, 'remediation status candidate exact');
check(remediation.acceptance.remediation_postgres === '7_PASS_0_FAIL', 'remediation status DB evidence');
check(remediation.acceptance.exact_head_ci.run_number === 4491 && remediation.acceptance.exact_head_ci.conclusion === 'success', 'remediation status CI evidence');
check(remediation.acceptance.manual_runner.first_execution_status === 'INSERTED', 'remediation status runner first execution');
check(remediation.acceptance.manual_runner.second_execution_status === 'EXISTING_IDEMPOTENT_SUCCESS', 'remediation status runner second execution');
check(remediation.successor_authorization === 'NONE', 'remediation status no successor');
for (const claim of claims) check(remediation.completion_claims.includes(claim), `remediation completion claim: ${claim}`);
for (const nonclaim of nonclaims) check(remediation.preserved_nonclaims.includes(nonclaim), `remediation nonclaim: ${nonclaim}`);

check(s4.status === 'COMPLETE', 'S4 status COMPLETE');
check(s4.claims.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED'), 'S4 checkpoint pointer retained');
check(s4.claims.includes('PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED'), 'S4 persisted handoff established');
check(s4.evidence.remediation_postgres_gate === '7_PASS_0_FAIL', 'S4 remediation DB evidence');
check(s4.next_authorized_slice_id === null, 'S4 authorizes no successor');

check(task.includes('status:\nCOMPLETE'), 'task book COMPLETE');
check(task.includes('active_delivery_slice:\nnull'), 'task book no active slice');
check(task.includes('PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED'), 'task book persisted handoff claim');
check(task.includes('MCFT-2 必须在 PR #2316 合并并于 main 复验后'), 'task book blocks automatic MCFT-2');
check(closure.includes('current_capability_status: COMPLETE'), 'closure narrative COMPLETE');
check(runtimeDoc.includes('current_status: COMPLETE'), 'Runtime document COMPLETE');
check(implementationMap.includes('capability status:\nCOMPLETE'), 'implementation map COMPLETE');
check(implementationMap.includes('MCFT-2 / hourly dynamics remains unauthorized'), 'implementation map blocks MCFT-2');

check(ports.includes('active_lineage_id?: string'), 'persisted snapshot distinguishes lineage object ref and semantic ID');
check(nextTickRepository.includes('readCanonicalObjectV1(client, activeLineageRef, "twin_runtime_lineage_v1")'), 'repository resolves active lineage canonical object');
check(nextTickRepository.includes('active_lineage_id: activeLineageId'), 'repository returns active semantic lineage ID');
check(nextTickService.includes('const activeLineageId = persistedActiveLineageId ?? activeLineageRef'), 'service consumes resolved lineage ID');
check(nextTickService.includes('ACTIVE_LINEAGE_CHECKPOINT_MISMATCH'), 'service validates active lineage/checkpoint');
check(nextTickRepository.includes('REPEATABLE READ READ ONLY'), 'PostgreSQL handoff consistent read');
check(selector.includes('CONFLICTING_DUPLICATE_OBSERVATION'), 'selector conflict rejection');
check(selector.includes('ingestedAtV1(b).localeCompare(ingestedAtV1(a))'), 'selector ingested_at descending');
check(selector.includes('CONSUMED_BY_BOOTSTRAP_ESTIMATOR'), 'selector model-consumption trace');
check(validator.includes('validateA0CrossReferenceGraphV1(recordSet);\n  const computed = computeA0RecordSetDeterminismHashV1'), 'graph validation precedes aggregate hash validation');
check(runner.includes('PrepareNextTickInputServiceV1') && runner.includes('commitRealityBindingSnapshot'), 'manual runner executes persisted handoff path');
check(context.context_class === 'CONFIGURATION_DERIVED_CONTEXT' && context.evidence_record === false, 'crop-stage context remains non-Evidence');
check(manifestV2.configuration_context_hash === context.determinism_hash && manifestV2.top_level_evidence_record_count === 3604, 'manifest v2 binds context and preserves Evidence count');

try {
  cp.execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'closure branch descends from historical closure main');
} catch { check(false, 'closure branch descends from historical closure main'); }

try {
  cp.execFileSync('git', ['diff', '--quiet', `${BASELINE}...HEAD`, '--',
    'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json',
    'docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json',
    'docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json',
    'fixtures/mcft/water_state/replay_v1/manifest.json',
    'fixtures/mcft/water_state/replay_v1/soil_moisture',
    'fixtures/mcft/water_state/replay_v1/rainfall',
    'fixtures/mcft/water_state/replay_v1/historical_et0',
    'fixtures/mcft/water_state/replay_v1/future_weather',
    'fixtures/mcft/water_state/replay_v1/future_et0',
    'fixtures/mcft/water_state/replay_v1/irrigation_plan',
    'fixtures/mcft/water_state/replay_v1/irrigation_execution'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'frozen MCFT-00 authority and 3604 Evidence records remain byte-unchanged');
} catch { check(false, 'frozen MCFT-00 authority and 3604 Evidence records remain byte-unchanged'); }

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  const forbidden = changed.filter((file) => file.startsWith('apps/web/') || file.startsWith('apps/server/src/routes/') || file.includes('propagation') || file.includes('scenario') || file.includes('recommendation') || file.includes('ao_act'));
  check(changed.length === 29, `exact remediation changed-file count is 29, got ${changed.length}`);
  check(forbidden.length === 0, `no web route propagation Scenario Recommendation or AO-ACT changes: ${forbidden.join(',')}`);
} catch (error) { check(false, `changed-file boundary unavailable: ${error.message}`); }

console.log(`MCFT-CAP-01 closure remediation final: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
