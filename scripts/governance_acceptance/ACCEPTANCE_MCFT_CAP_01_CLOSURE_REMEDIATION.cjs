// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION.cjs
// Purpose: validate MCFT-CAP-01 remediation governance consistency, implementation presence, frozen-authority preservation, Dataset Evidence immutability, and the exact changed-file boundary.
// Boundary: static governance acceptance only; no PostgreSQL, Runtime execution, canonical write, propagation, successful Forecast, Scenario, Recommendation, Decision, AO-ACT, scheduler, or production claim.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = '250053aba801075c17098f8d505d527eb54390e9';
const SLICE = 'MCFT-CAP-01.CLOSURE-REMEDIATION-V1';
let pass = 0;
let fail = 0;

function check(value, message) {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}
function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

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
const packageJson = readJson('apps/server/package.json');
const context = readJson('fixtures/mcft/water_state/replay_v1/configuration_context.json');
const manifestV2 = readJson('fixtures/mcft/water_state/replay_v1/manifest_v2.json');

check(delivery.capability_line_id === 'MCFT-CAP-01', 'delivery status capability identity');
check(delivery.status === 'IN_IMPLEMENTATION', 'capability is reopened as IN_IMPLEMENTATION');
check(delivery.active_delivery_slice_id === SLICE, 'delivery status active remediation slice');
check(delivery.historical_closure?.status === 'SUPERSEDED_PENDING_REMEDIATION', 'historical closure superseded pending remediation');
check(delivery.remediation?.draft_pr === 2316, 'delivery status references PR 2316');
check(delivery.slices.some((slice) => slice.delivery_slice_id === SLICE && slice.status === 'IN_IMPLEMENTATION'), 'remediation slice exists and is active');
check(delivery.slices.some((slice) => slice.delivery_slice_id === 'MCFT-CAP-01.CLOSURE-V1' && slice.status === 'SUPERSEDED_PENDING_REMEDIATION'), 'historical closure slice is superseded');
check(delivery.slices.some((slice) => slice.delivery_slice_id.includes('A0-RUNTIME-INTEGRATION') && slice.withdrawn_claims?.includes('NEXT_TICK_HANDOFF_ESTABLISHED')), 'overstated next-tick handoff claim withdrawn');
check(delivery.slices.some((slice) => slice.delivery_slice_id.includes('A0-RUNTIME-INTEGRATION') && slice.established_claims?.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED')), 'checkpoint-pointer claim retained');
check(delivery.next_authorized_slice_ids.length === 0, 'no successor slice authorized');
check(delivery.nonclaims.includes('NO_MCFT_CAP_01_CLOSURE'), 'capability closure nonclaim restored');
check(delivery.nonclaims.includes('NO_PERSISTED_NEXT_TICK_HANDOFF'), 'persisted handoff nonclaim active pending proof');

const line = matrix.capability_lines.find((item) => item.capability_line_id === 'MCFT-CAP-01');
check(line?.status === 'REMEDIATION_IN_IMPLEMENTATION', 'capability matrix remediation status');
check(line?.active_delivery_slice_id === SLICE, 'capability matrix active remediation slice');
check(line?.historical_closure_status === 'SUPERSEDED_PENDING_REMEDIATION', 'matrix historical closure superseded');
check(line?.remediation_pr === 2316, 'matrix remediation PR reference');
check(line?.delivery_slices?.some((slice) => slice.delivery_slice_id === SLICE && slice.status === 'IN_IMPLEMENTATION'), 'matrix remediation slice active');
check(line?.excluded_owner_work_package_ids?.includes('MCFT-06'), 'MCFT-06 remains excluded');
check(line?.preserved_nonclaims?.includes('NO_PROPAGATION'), 'matrix preserves propagation nonclaim');
check(line?.preserved_nonclaims?.includes('NO_MCFT_CAP_01_CLOSURE'), 'matrix preserves capability closure nonclaim');

check(closureRecord.status === 'SUPERSEDED_PENDING_REMEDIATION', 'Closure Record is superseded pending remediation');
check(closureRecord.active_delivery_slice_id === SLICE, 'Closure Record active remediation slice');
check(closureRecord.historical_claims_suspended.includes('MCFT_CAP_01_COMPLETE'), 'Closure Record suspends capability-complete claim');
check(closureRecord.historical_claims_suspended.includes('NEXT_TICK_HANDOFF_ESTABLISHED'), 'Closure Record suspends next-tick handoff claim');
check(closureRecord.claims_still_valid.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED'), 'Closure Record retains checkpoint-pointer claim');
check(closureRecord.remediation_requirements.includes('A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED'), 'Closure Record requires graph validation');
check(closureRecord.remediation_requirements.includes('CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED'), 'Closure Record requires crop-stage context');
check(closureRecord.next_authorized_slice_ids.length === 0, 'Closure Record authorizes no successor');

check(remediation.delivery_slice_id === SLICE, 'remediation status slice identity');
check(remediation.status === 'IN_IMPLEMENTATION', 'remediation status is IN_IMPLEMENTATION');
check(remediation.baseline_main_commit === BASELINE, 'remediation baseline main commit');
check(remediation.draft_pr === 2316, 'remediation status PR reference');
check(remediation.implemented_candidates.includes('PERSISTED_NEXT_TICK_READ_PORT'), 'persisted next-tick candidate recorded');
check(remediation.implemented_candidates.includes('COMPLETE_A0_CROSS_REFERENCE_GRAPH_VALIDATION'), 'graph-validation candidate recorded');
check(remediation.implemented_candidates.includes('CROP_STAGE_CONFIGURATION_CONTEXT'), 'crop-stage candidate recorded');
check(Object.values(remediation.required_acceptance).every((value) => value === 'PENDING'), 'completion evidence remains pending before local Gates');
check(remediation.successor_authorization === 'NONE', 'remediation status authorizes no successor');

check(s4.status === 'REMEDIATION_REQUIRED', 'S4 status downgraded to remediation required');
check(s4.established_claims.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED'), 'S4 status retains checkpoint pointer');
check(s4.withdrawn_claims.includes('NEXT_TICK_HANDOFF_ESTABLISHED'), 'S4 status withdraws persisted handoff claim');
check(s4.next_authorized_slice_id === SLICE, 'S4 status authorizes remediation only');

check(task.includes('active_delivery_slice:\nMCFT-CAP-01.CLOSURE-REMEDIATION-V1'), 'task book active remediation slice');
check(task.includes('successor:\nNOT_YET_AUTHORIZED'), 'task book blocks successor');
check(task.includes('prepareNextTickInput()'), 'task book requires persisted next-tick service');
check(task.includes('CONFLICTING_DUPLICATE_OBSERVATION'), 'task book requires conflict rejection');
check(task.includes('在 remediation 合并并重新闭合前，禁止开始 MCFT-2'), 'task book blocks MCFT-2');
check(closure.includes('SUPERSEDED_PENDING_REMEDIATION'), 'closure narrative marks historical closure superseded');
check(closure.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED'), 'closure narrative uses corrected checkpoint claim');
check(runtimeDoc.includes('NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED'), 'runtime document uses corrected checkpoint claim');
check(implementationMap.includes('reopened for closure remediation'), 'implementation map records reopening');
check(implementationMap.includes('No MCFT-2 / hourly dynamics work is authorized'), 'implementation map blocks MCFT-2');

check(ports.includes('export interface NextTickReadPortV1'), 'next-tick read port exists');
check(ports.includes('export type PreparedNextTickInputV1'), 'prepared next-tick DTO exists');
for (const field of ['previous_posterior_ref','previous_checkpoint_ref','lineage_id','prior_mean','prior_variance','next_logical_tick_time','runtime_config_ref','reality_binding_ref']) {
  check(ports.includes(field), `prepared next-tick DTO field: ${field}`);
}
check(nextTickService.includes('prepareNextTickInput'), 'prepareNextTickInput application service exists');
check(nextTickService.includes('ACTIVE_LINEAGE_CHECKPOINT_MISMATCH'), 'handoff validates active lineage');
check(nextTickService.includes('CHECKPOINT_STATE_REVISION_MISMATCH'), 'handoff validates revision consistency');
check(nextTickService.includes('PERSISTED_RUNTIME_CONFIG_MISMATCH'), 'handoff validates Runtime Config');
check(nextTickService.includes('PERSISTED_REALITY_BINDING_MISMATCH'), 'handoff validates Reality Binding');
check(nextTickRepository.includes('REPEATABLE READ READ ONLY'), 'PostgreSQL handoff uses consistent read transaction');
check(nextTickRepository.includes('twin_active_lineage_index_v1'), 'PostgreSQL handoff reads active lineage');
check(nextTickRepository.includes('twin_runtime_checkpoint_latest_index_v1'), 'PostgreSQL handoff reads latest checkpoint');
check(nextTickRepository.includes('twin_state_latest_index_v1'), 'PostgreSQL handoff reads latest State');
check(nextTickRepository.includes('twin_runtime_authority_snapshot_v1'), 'PostgreSQL handoff reads Reality Binding snapshot');

check(selector.includes('CONFLICTING_DUPLICATE_OBSERVATION'), 'selector rejects conflicting duplicate observation');
check(selector.includes('ingestedAtV1(b).localeCompare(ingestedAtV1(a))'), 'selector uses ingested_at descending');
check(selector.includes('a.source_record_id.localeCompare(b.source_record_id)'), 'selector uses source ID ascending');
check(selector.includes('CONSUMED_BY_BOOTSTRAP_ESTIMATOR'), 'selector records estimator consumption');
check(selector.includes('CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR'), 'selector records context-only evidence');
for (const field of ['ingested_at','freshness','source_unit','canonical_unit','conversion_rule','limitations','model_consumption_status']) {
  check(selector.includes(field), `Evidence Window trace field: ${field}`);
}

for (const code of ['A0_REF_TRANSITION_ASSIMILATION_MISMATCH','A0_REF_ASSIMILATION_TRANSITION_MISMATCH','A0_REF_STATE_TRANSITION_MISMATCH','A0_REF_TICK_POSTERIOR_MISMATCH','A0_REF_CHECKPOINT_POSTERIOR_MISMATCH','A0_REF_HEALTH_CHECKPOINT_MISMATCH']) {
  check(validator.includes(code), `A0 graph validator code: ${code}`);
}
check(validator.indexOf('validateA0CrossReferenceGraphV1(recordSet)') < validator.indexOf('computeA0RecordSetDeterminismHashV1'), 'graph validation is independent of aggregate hash validation');

check(runner.includes('A0BootstrapRuntimeServiceV1'), 'manual runner executes A0 service');
check(runner.includes('PrepareNextTickInputServiceV1'), 'manual runner prepares persisted handoff');
check(runner.includes('commitRealityBindingSnapshot'), 'manual runner persists Reality Binding snapshot');
check(packageJson.scripts['mcft:water-state:a0']?.includes('MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts'), 'package script exposes manual runner');

check(context.context_class === 'CONFIGURATION_DERIVED_CONTEXT', 'crop-stage context class');
check(context.evidence_record === false, 'crop-stage context is not Evidence');
check(context.determinism_hash === 'sha256:2287c71e983b1ba529e49939f025d9b035e09e195a5effc994fe54b4ef7863ce', 'crop-stage context deterministic hash');
check(Array.isArray(context.crop_stage_schedule) && context.crop_stage_schedule.length === 4, 'crop-stage schedule has four contiguous stages');
check(manifestV2.configuration_context_hash === context.determinism_hash, 'manifest v2 binds crop-stage context hash');
check(manifestV2.configuration_context_is_evidence === false, 'manifest v2 preserves configuration/Evidence boundary');
check(manifestV2.top_level_evidence_record_count === 3604, 'manifest v2 preserves 3604 Evidence records');

try {
  cp.execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
  check(true, 'remediation branch descends from historical closure main');
} catch {
  check(false, 'remediation branch descends from historical closure main');
}

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
} catch {
  check(false, 'frozen MCFT-00 authority and 3604 Evidence records remain byte-unchanged');
}

try {
  const changed = cp.execFileSync('git', ['diff', '--name-only', `${BASELINE}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  const allowed = [
    /^apps\/server\/db\/migrations\/2026_07_10_mcft_cap_01_closure_remediation\.sql$/,
    /^apps\/server\/package\.json$/,
    /^apps\/server\/scripts\/mcft\/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER\.ts$/,
    /^apps\/server\/src\/(adapters|domain|persistence|runtime)\/twin_runtime\//,
    /^docs\/digital_twin\/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP\.md$/,
    /^docs\/digital_twin\/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX\.json$/,
    /^docs\/digital_twin\/mcft\/cap_01\//,
    /^fixtures\/mcft\/water_state\/configuration_context_source_v1\.json$/,
    /^fixtures\/mcft\/water_state\/replay_v1\/(configuration_context|manifest_v2)\.json$/,
    /^scripts\/mcft\/GENERATE_MCFT_CAP_01_REPLAY_DATASET\.cjs$/,
    /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_01_(A0_RUNTIME|CLOSURE_REMEDIATION|CLOSURE_REMEDIATION_DB)\.ts$/,
    /^scripts\/governance_acceptance\/ACCEPTANCE_MCFT_CAP_01_CLOSURE_REMEDIATION\.cjs$/,
  ];
  const forbidden = changed.filter((file) => !allowed.some((pattern) => pattern.test(file)));
  check(changed.length === 29, `exact remediation changed-file count is 29, got ${changed.length}`);
  check(forbidden.length === 0, `remediation changed-file boundary: ${forbidden.join(',')}`);
  check(changed.every((file) => !file.startsWith('apps/web/') && !file.startsWith('apps/server/src/routes/') && !file.includes('propagation') && !file.includes('scenario') && !file.includes('recommendation') && !file.includes('ao_act')), 'no web route propagation Scenario Recommendation or AO-ACT changes');
} catch (error) {
  check(false, `changed-file boundary unavailable: ${error.message}`);
}

console.log(`MCFT-CAP-01 closure remediation governance: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
