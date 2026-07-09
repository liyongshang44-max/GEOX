// scripts/governance_acceptance/ACCEPTANCE_DT_02_RUNTIME_ARCHITECTURE_FREEZE.cjs
// Purpose: validate the complete DT-02 architecture after Amendment 01 and Amendment 02, including A0 bootstrap, A1/A2/F outcomes, revision lifecycle, object coverage, and nonclaims.
// Boundary: semantic architecture Gate only; it performs no Runtime write or database mutation.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const F = Object.freeze({
  amendment01: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-01.md',
  amendment02: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02.md',
  bootstrap: 'docs/digital_twin/GEOX-DT-02-BOOTSTRAP-STATE-SEMANTICS.json',
  freeze: 'docs/digital_twin/GEOX-DT-02-RUNTIME-ARCHITECTURE-FREEZE.md',
  adrs: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-DECISION-REGISTER.json',
  objects: 'docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json',
  tx: 'docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json',
  layers: 'docs/digital_twin/GEOX-DT-02-LAYER-DEPENDENCY-CONTRACT.json',
  modes: 'docs/digital_twin/GEOX-DT-02-RUNTIME-MODE-ADAPTER-MATRIX.json',
  api: 'docs/digital_twin/GEOX-DT-02-API-ROUTE-COMPATIBILITY-MATRIX.json',
  legacy: 'docs/digital_twin/GEOX-DT-02-LEGACY-MIGRATION-REGISTER.md',
  map: 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  closure01: 'docs/digital_twin/GEOX-DT-02-CLOSURE-RECORD.md',
  closure02: 'docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-02-CLOSURE-RECORD.md',
  matrix: 'docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json',
});

const passes = [];
const failures = [];
function pass(message) { passes.push(message); console.log(`PASS: ${message}`); }
function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function abs(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return fs.readFileSync(abs(relativePath), 'utf8'); }
function parse(relativePath) { return JSON.parse(read(relativePath)); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function nonEmptyArray(value) { return Array.isArray(value) && value.length > 0; }
function eq(actual, expected, message) {
  actual === expected ? pass(message) : fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function seteq(actual, expected, message) {
  eq(JSON.stringify([...(actual || [])].sort()), JSON.stringify([...expected].sort()), message);
}
function includesAll(actual, expected, message) {
  const missing = expected.filter((value) => !(actual || []).includes(value));
  missing.length ? fail(`${message}: missing ${missing.join(', ')}`) : pass(message);
}
function field(text, key) {
  return (text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
}

for (const relativePath of Object.values(F)) {
  if (!fs.existsSync(abs(relativePath))) fail(`required file missing ${relativePath}`);
  else pass(`file exists ${relativePath}`);
}
if (failures.length) finish();

let ADR;
let O;
let T;
let B;
let C;
try {
  ADR = parse(F.adrs);
  O = parse(F.objects);
  T = parse(F.tx);
  B = parse(F.bootstrap);
  C = parse(F.matrix);
  for (const relativePath of [F.adrs, F.objects, F.tx, F.bootstrap, F.matrix]) pass(`plain JSON parses ${relativePath}`);
} catch (error) {
  fail(`JSON parse failed: ${error.message}`);
  finish();
}

const amendment01 = read(F.amendment01);
const amendment02 = read(F.amendment02);
const freeze = read(F.freeze);
const closure02 = read(F.closure02);
const implementationMap = read(F.map);
const a02Status = field(closure02, 'status');
if (!['PENDING_ACCEPTANCE', 'COMPLETE'].includes(a02Status)) fail(`invalid Amendment 02 closure status ${a02Status}`);
else pass(`Amendment 02 closure status ${a02Status}`);
const expectedA02Status = a02Status;

for (const marker of [
  'status: COMPLETE',
  'record_class',
  'E1_DECLARE_REVISION',
  'Forecast terminal-state semantics',
]) amendment01.includes(marker) ? pass(`Amendment 01 marker ${marker}`) : fail(`Amendment 01 marker missing ${marker}`);

for (const marker of [
  `status: ${expectedA02Status}`,
  'A0_BOOTSTRAP_STATE_COMMIT',
  'Initial activation is not revision promotion',
  'bootstrap_prior_ref: forbidden',
  'INITIAL_LINEAGE_CONFLICT',
  'aggregate idempotency',
  'separate F audit',
]) amendment02.includes(marker) ? pass(`Amendment 02 marker ${marker}`) : fail(`Amendment 02 marker missing ${marker}`);

for (const marker of [
  'A0 BOOTSTRAP',
  'NULL_TO_INITIAL',
  'INITIAL revision_id does not imply a revision-run object',
  'A0 aggregate idempotency',
  'eight transaction families',
  'No Runtime capability is established',
]) freeze.includes(marker) ? pass(`freeze marker ${marker}`) : fail(`freeze marker missing ${marker}`);

if (!implementationMap.includes('A0 plus an `INITIAL` `twin_runtime_lineage_v1`')) fail('implementation map lacks initial activation authority');
else pass('implementation map initial activation authority');
if (!implementationMap.includes('MCFT-06 remains `NOT_STARTED`')) fail('implementation map lost MCFT-06 nonclaim');
else pass('implementation map preserves MCFT-06 nonclaim');

// ADR register and amendment preservation.
eq(ADR.schema_version, 'geox_dt02_architecture_decision_register_v3', 'ADR schema v3');
const decisions = ADR.decisions || [];
eq(decisions.length, 16, 'ADR count');
seteq(decisions.map((row) => row.id), Array.from({length: 16}, (_, index) => `DT02-ADR-${String(index + 1).padStart(3, '0')}`), 'ADR IDs');
const a01 = (ADR.amendments || []).find((row) => row.id === 'DT02-AMENDMENT-01');
const a02 = (ADR.amendments || []).find((row) => row.id === 'DT02-AMENDMENT-02');
eq(a01?.status, 'COMPLETE', 'Amendment 01 remains COMPLETE');
eq(a02?.status, expectedA02Status, 'Amendment 02 register status');
seteq(a02?.supersedes, ['DT02-ADR-003','DT02-ADR-004','DT02-ADR-005','DT02-ADR-006','DT02-ADR-007','DT02-ADR-008','DT02-ADR-015','DT02-ADR-016'], 'Amendment 02 superseded ADR set');
for (const decision of decisions) {
  if (!nonEmpty(decision.title) || !nonEmpty(decision.decision) || !nonEmpty(decision.rationale)) fail(`${decision.id} textual audit metadata incomplete`);
  if (!nonEmptyArray(decision.rejected_alternatives) || !nonEmptyArray(decision.downstream_owners) || !nonEmptyArray(decision.input_packet_topics) || !nonEmptyArray(decision.invariants)) fail(`${decision.id} array audit metadata incomplete`);
  if (!Array.isArray(decision.amendment_refs)) fail(`${decision.id} amendment_refs must be array`);
}
if (!failures.some((item) => item.includes('audit metadata incomplete') || item.includes('amendment_refs'))) pass('all ADR audit metadata complete');
const coveredTopics = new Set(decisions.flatMap((row) => row.input_packet_topics || []));
for (const topic of ADR.input_packet_topics || []) if (!coveredTopics.has(topic)) fail(`uncovered input packet topic ${topic}`);
if (!failures.some((item) => item.startsWith('uncovered input packet topic'))) pass('all input packet topics covered');

// Object set.
eq(O.schema_version, 'geox_dt02_canonical_object_set_v3', 'object schema v3');
includesAll(O.amendment_refs, [F.amendment01, F.amendment02], 'object set amendment history');
const baseRequired = O.envelope_contracts?.base_object_envelope?.required_fields || [];
if (baseRequired.includes('lineage_id') || baseRequired.includes('revision_id')) fail('base envelope wrongly requires lineage identity');
else pass('base envelope excludes lineage identity');
seteq(O.envelope_contracts?.lineage_envelope?.required_fields, ['lineage_id', 'revision_id'], 'lineage envelope identity');
eq(O.envelope_contracts?.lineage_envelope?.conditional_rules?.INITIAL?.revision_run_ref, null, 'INITIAL revision_run_ref null');
eq(O.envelope_contracts?.lineage_envelope?.conditional_rules?.INITIAL?.revision_run_object_required, false, 'INITIAL creates no revision-run object');

const objects = O.objects || [];
const byObject = new Map(objects.map((row) => [row.object_type, row]));
const requiredObjects = [
  'twin_runtime_attempt_v1','twin_runtime_tick_v1','twin_evidence_window_v1','twin_state_transition_v1','twin_assimilation_update_v1','twin_state_estimate_v1','twin_forecast_run_v1','twin_forecast_failure_v1','twin_scenario_set_v1','twin_forecast_residual_v1','twin_decision_record_v1','twin_action_feedback_v1','twin_calibration_candidate_v1','twin_shadow_evaluation_v1','twin_model_activation_v1','twin_runtime_config_v1','twin_runtime_checkpoint_v1','twin_runtime_health_v1','twin_runtime_lineage_v1','twin_revision_run_v1','twin_lineage_promotion_v1'
];
eq(objects.length, 21, 'canonical object count');
seteq(objects.map((row) => row.object_type), requiredObjects, 'canonical object IDs');
for (const object of objects) {
  if (!nonEmpty(object.record_class) || object.history_class !== object.record_class) fail(`${object.object_type} record/history class invalid`);
  if (typeof object.lineage_member !== 'boolean') fail(`${object.object_type} lineage_member invalid`);
  if (object.envelope_profile !== (object.lineage_member ? 'LINEAGE' : 'NON_LINEAGE_CONTEXT')) fail(`${object.object_type} envelope profile invalid`);
  if (!nonEmptyArray(object.transaction_families)) fail(`${object.object_type} transaction_families invalid`);
  if (Object.hasOwn(object, 'transaction_family')) fail(`${object.object_type} singular transaction_family forbidden`);
}
if (!failures.some((item) => item.includes('record/history') || item.includes('lineage_member invalid') || item.includes('envelope profile') || item.includes('transaction_families'))) pass('all object envelope metadata valid');

const lineage = byObject.get('twin_runtime_lineage_v1');
seteq(lineage?.transaction_families, ['A_STATE_TICK_COMMIT', 'E_REVISION_LINEAGE_STEP_COMMIT'], 'lineage transaction families');
includesAll(lineage?.field_contract?.lineage_kind, ['INITIAL', 'REVISION_CANDIDATE'], 'lineage kinds');
eq(lineage?.field_contract?.INITIAL?.revision_run_ref, null, 'INITIAL lineage revision_run_ref null');
includesAll(lineage?.field_contract?.INITIAL?.required_refs, ['bootstrap_runtime_config_ref','bootstrap_reality_binding_ref','initial_revision_id'], 'INITIAL lineage required refs');
eq(lineage?.field_contract?.INITIAL?.activation_authority_kind, 'INITIAL_LINEAGE_DECLARATION', 'INITIAL activation authority kind');
includesAll(lineage?.field_contract?.REVISION_CANDIDATE?.required_refs, ['revision_run_ref','parent_lineage_ref'], 'revision candidate refs');

const transition = byObject.get('twin_state_transition_v1')?.field_contract || {};
includesAll(transition.transition_kind, ['BOOTSTRAP','CONTINUATION','REVISION_REPLAY'], 'transition kinds');
eq(transition.BOOTSTRAP?.previous_posterior_ref, null, 'BOOTSTRAP previous posterior null');
eq(transition.BOOTSTRAP?.bootstrap_prior_required, true, 'BOOTSTRAP embedded prior required');
eq(transition.BOOTSTRAP?.bootstrap_prior_ref_forbidden, true, 'bootstrap_prior_ref forbidden');
eq(transition.BOOTSTRAP?.process_model_status, 'NOT_APPLIED_BOOTSTRAP', 'BOOTSTRAP process model status');
eq(transition.CONTINUATION?.previous_posterior_ref_required, true, 'continuation previous posterior required');
eq(transition.REVISION_REPLAY?.previous_posterior_ref_required, true, 'revision replay previous posterior required');

const checkpoint = byObject.get('twin_runtime_checkpoint_v1')?.field_contract || {};
includesAll(checkpoint.checkpoint_kind, ['INITIAL','CONTINUATION','REVISION'], 'checkpoint kinds');
eq(checkpoint.INITIAL?.previous_checkpoint_ref, null, 'INITIAL previous checkpoint null');
eq(checkpoint.CONTINUATION?.previous_checkpoint_ref_required, true, 'continuation previous checkpoint required');

const state = byObject.get('twin_state_estimate_v1')?.field_contract || {};
eq(state.confidence?.status, 'NOT_ESTABLISHED', 'State confidence not established');
eq(state.confidence?.numeric_score_forbidden, true, 'State numeric confidence forbidden');
eq(state.forecast_prerequisite_reason_codes_forbidden, true, 'Forecast reasons forbidden in State');

const forecast = byObject.get('twin_forecast_run_v1')?.status_contract || {};
eq(forecast.COMPLETED?.points_count, 72, 'Forecast COMPLETED points');
eq(forecast.BLOCKED?.points_count, 0, 'Forecast BLOCKED points');
eq(forecast.BLOCKED?.reason_codes_owner, 'twin_forecast_run_v1', 'Forecast owns BLOCKED reasons');
eq(forecast.FAILED?.permitted, false, 'FAILED forbidden on lineage Forecast');

// Transaction matrix and coverage.
eq(T.schema_version, 'geox_dt02_atomic_transaction_matrix_v3', 'transaction schema v3');
eq(T.transaction_count, 8, 'transaction family count unchanged');
const transactions = T.transactions || [];
const byTx = new Map(transactions.map((row) => [row.id, row]));
const transactionIds = ['A_STATE_TICK_COMMIT','B_SCENARIO_COMMIT','C_FORECAST_RESIDUAL_COMMIT','D_MODEL_GOVERNANCE_STEP_COMMIT','E_REVISION_LINEAGE_STEP_COMMIT','F_OPERATIONAL_ATTEMPT_HEALTH','G_HUMAN_DECISION_LINK_COMMIT','H_ACTION_FEEDBACK_COMMIT'];
seteq([...byTx.keys()], transactionIds, 'transaction family IDs');
function covers(tx, objectType) {
  return (tx?.canonical_appends || []).includes(objectType) || (tx?.operation_variants || []).some((variant) => (variant.canonical_appends || []).includes(objectType));
}
for (const object of objects) {
  for (const family of object.transaction_families || []) {
    const transaction = byTx.get(family);
    if (!transaction) fail(`${object.object_type} references missing ${family}`);
    else if (!covers(transaction, object.object_type)) fail(`${object.object_type} not covered by ${family}`);
  }
}
if (!failures.some((item) => item.includes('not covered') || item.includes('references missing'))) pass('all object transaction families covered');

const A = byTx.get('A_STATE_TICK_COMMIT');
const aVariants = new Map((A?.operation_variants || []).map((row) => [row.id, row]));
seteq([...aVariants.keys()], ['A0_BOOTSTRAP_STATE_COMMIT','A1_COMPLETED','A2_BLOCKED_FORECAST'], 'A transaction variants');
const A0 = aVariants.get('A0_BOOTSTRAP_STATE_COMMIT');
eq(A0?.record_set_member_count, 9, 'A0 record-set member count');
seteq(A0?.canonical_appends, B.canonical_appends, 'A0 canonical append set matches bootstrap contract');
includesAll(A0?.forbidden_appends, ['twin_lineage_promotion_v1','twin_revision_run_v1','twin_forecast_failure_v1'], 'A0 forbidden appends');
eq(A0?.lineage_kind, 'INITIAL', 'A0 lineage kind');
eq(A0?.transition_kind, 'BOOTSTRAP', 'A0 transition kind');
eq(A0?.checkpoint_kind, 'INITIAL', 'A0 checkpoint kind');
eq(A0?.forecast_status, 'BLOCKED', 'A0 Forecast status');
eq(A0?.forecast_points_count, 0, 'A0 Forecast points');
eq(A0?.tick_status, 'COMPLETED_WITH_LIMITATIONS', 'A0 tick status');
eq(A0?.idempotency?.same_key_different_hash, 'IDEMPOTENCY_CONFLICT', 'A0 conflict code');
eq(A0?.idempotency?.declared_hash_mismatch, 'SEMANTIC_HASH_MISMATCH', 'A0 hash mismatch code');
eq(A0?.canonical_initial_uniqueness?.different_existing, 'INITIAL_LINEAGE_CONFLICT', 'INITIAL lineage conflict code');
eq(A0?.canonical_initial_uniqueness?.projection_absence_allows_second_initial, false, 'projection loss cannot authorize second INITIAL');
includesAll(A0?.projection_writes, ['twin_object_idempotency_index_v1 insert'], 'A0 idempotency projection');
includesAll(A0?.projection_non_writes, ['forecast successful latest','scenario latest','decision projection','action projection'], 'A0 forbidden projection writes');

const E = byTx.get('E_REVISION_LINEAGE_STEP_COMMIT');
const eVariants = new Map((E?.operation_variants || []).map((row) => [row.id, row]));
seteq([...eVariants.keys()], ['E1_DECLARE_REVISION','E2_APPEND_REVISION_STATUS','E3_PROMOTE_LINEAGE'], 'revision variants');
eq(eVariants.get('E1_DECLARE_REVISION')?.required_lineage_kind, 'REVISION_CANDIDATE', 'E1 lineage kind');
eq(eVariants.get('E3_PROMOTE_LINEAGE')?.activation_authority_kind, 'LINEAGE_PROMOTION', 'E3 authority kind');

const Ftx = byTx.get('F_OPERATIONAL_ATTEMPT_HEALTH');
includesAll(Ftx?.forbidden_appends, ['twin_runtime_lineage_v1','twin_state_estimate_v1','twin_runtime_tick_v1','twin_runtime_checkpoint_v1','twin_forecast_run_v1'], 'F forbids A0/terminal appends');

// Bootstrap machine contract consistency.
eq(B.schema_version, 'geox_dt02_bootstrap_state_semantics_v1', 'bootstrap semantics schema');
eq(B.status, expectedA02Status, 'bootstrap semantics status');
eq(B.transaction_family_count_unchanged, 8, 'bootstrap preserves transaction count');
eq(B.initial_lineage_activation?.authority_kind, 'INITIAL_LINEAGE_DECLARATION', 'bootstrap initial authority');
eq(B.initial_lineage_activation?.promotion_object_forbidden, true, 'bootstrap promotion forbidden');
eq(B.initial_identity?.revision_run_object_created, false, 'bootstrap creates no revision-run');
eq(B.aggregate_idempotency?.same_input_after_success_requires_null_CAS, false, 'idempotent replay skips null-CAS');
eq(B.canonical_initial_uniqueness?.projection_absence_allows_second_initial, false, 'canonical INITIAL uniqueness independent of projection');
eq(B.failure_semantics?.a0_fact_count, 0, 'failed A0 writes zero A0 facts');
eq(B.failure_semantics?.separate_F_OPERATIONAL_ATTEMPT_HEALTH_audit_permitted, true, 'separate F audit permitted');

// Nonclaims and capability inflation guard.
const capabilityById = new Map((C.capabilities || []).map((row) => [row.capability_id, row]));
for (const id of ['DT-MATRIX-HOURLY-TICK','DT-MATRIX-PROPAGATION','DT-MATRIX-ASSIMILATION','DT-MATRIX-POSTERIOR','DT-MATRIX-CHECKPOINT','DT-MATRIX-RESTART','DT-MATRIX-LATE-REVISION','DT-MATRIX-72H-REGEN']) {
  eq(capabilityById.get(id)?.current_status, 'MISSING', `${id} remains MISSING`);
}
eq(capabilityById.get('DT-MATRIX-LIVE-PRODUCTION-FIELD-TWIN')?.current_status, 'NOT_CLAIMED', 'production remains NOT_CLAIMED');

const allAuthority = [amendment01, amendment02, freeze, read(F.adrs), read(F.objects), read(F.tx), read(F.bootstrap), implementationMap, closure02].join('\n');
for (const forbidden of [
  'public State write endpoint',
  'automatic AO-ACT creation',
  'hourly dynamics implemented: true',
  'successful Forecast established: true',
  'Minimum Complete Field Twin complete: true',
]) {
  allAuthority.includes(forbidden) ? fail(`forbidden positive claim ${forbidden}`) : pass(`forbidden positive claim absent ${forbidden}`);
}

finish();

function finish() {
  console.log(`\nDT-02 amended acceptance summary: ${passes.length} PASS, ${failures.length} FAIL`);
  if (failures.length) process.exit(1);
  if (a02Status === 'COMPLETE') console.log('DT-02 ARCHITECTURE AMENDMENTS 01 AND 02: COMPLETE PASS');
  else console.log('DT-02 ARCHITECTURE AMENDMENT 02: PENDING-ACCEPTANCE PASS');
}
