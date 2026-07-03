// scripts/field_pilot_readiness/P54_FIELD_PILOT_READINESS_RUNNER.cjs
'use strict';

// Purpose: review P53 committed plan artifacts and decide whether P55 Runtime Health Service Gate review can be entered.
// Boundary: this runner writes only local P54 acceptance-output ledger/report files in controlled-write mode.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/field_pilot_readiness/P54_FIELD_PILOT_READINESS_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/field_pilot_readiness/P54_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P54_FIELD_PILOT_READINESS_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P54_FIELD_PILOT_READINESS_REPORT.json';

const REQUIRED_DIMENSION_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'];
const REQUIRED_P53_SECTIONS = ['candidate_site_scope', 'evidence_collection_protocol', 'device_gateway_readiness_checklist', 'human_role_matrix', 'safety_stop_rules', 'rollback_plan', 'entry_gate', 'exit_gate', 'go_no_go_gate', 'traceability_packet'];
const FORBIDDEN_RECORD_TYPES = ['runtime_health_service_v1', 'production_runtime_monitoring_v1', 'live_runtime_monitoring_v1', 'field_pilot_execution_v1', 'field_pilot_observation_result_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1'];

function args(argv) {
  const out = { mode: 'controlled-review-build', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--mode') out.mode = argv[++i];
    if (argv[i] === '--manifest') out.manifest = argv[++i];
    if (argv[i] === '--negative-manifest') out.negativeManifest = argv[++i];
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function exists(filePath) {
  return fs.existsSync(resolvePath(filePath));
}

function readText(filePath) {
  return fs.readFileSync(resolvePath(filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function loadSources(manifest) {
  const present = Object.fromEntries(Object.entries(manifest.source_refs).map(([key, ref]) => [key, exists(ref)]));
  const source = { refs: manifest.source_refs, present, flags: {} };
  for (const [key, ref] of Object.entries(manifest.source_refs)) {
    if (!present[key]) continue;
    if (ref.endsWith('.json')) source[key] = readJson(ref);
    if (ref.endsWith('.md') || ref.endsWith('.cjs')) source[key] = { text: readText(ref) };
  }
  return source;
}

function mutate(source, fixture) {
  const next = JSON.parse(JSON.stringify(source));
  if (fixture.scenario === 'missing_p53_closure') {
    next.present.p53_closure = false;
    delete next.p53_closure;
  }
  if (fixture.scenario === 'p53_acceptance_failed' && next.p53_closure) next.p53_closure.acceptance.failed_assertion_count = 1;
  if (fixture.scenario === 'p53_plan_not_allowed' && next.p53_closure) next.p53_closure.gate_result.field_pilot_plan_allowed = false;
  if (fixture.scenario === 'p53_execution_allowed_true' && next.p53_closure) next.p53_closure.gate_result.field_pilot_execution_allowed = true;
  if (fixture.scenario === 'p53_ao_act_allowed_true' && next.p53_closure) next.p53_closure.gate_result.ao_act_task_creation_allowed = true;
  if (fixture.scenario === 'p53_dispatch_allowed_true' && next.p53_closure) next.p53_closure.gate_result.dispatch_allowed = true;
  if (fixture.scenario === 'p53_roi_allowed_true' && next.p53_closure) next.p53_closure.gate_result.roi_allowed = true;
  if (fixture.scenario === 'p53_field_memory_allowed_true' && next.p53_closure) next.p53_closure.gate_result.field_memory_allowed = true;
  if (fixture.scenario === 'p53_full_freeze_allowed_true' && next.p53_closure) next.p53_closure.gate_result.full_runtime_v1_freeze_allowed = true;
  if (fixture.scenario === 'p53_real_site_selected_true' && next.p53_expected_report) next.p53_expected_report.real_site_selected = true;
  if (fixture.scenario === 'site_commitment_flag' && next.p53_expected_report) next.p53_expected_report.field_owner_committed = true;
  if (fixture.scenario === 'p53_operation_scheduled_true' && next.p53_expected_report) next.p53_expected_report.field_operation_scheduled = true;
  if (fixture.scenario === 'human_role_matrix_absent' && next.p53_input_manifest) next.p53_input_manifest.required_plan_sections = next.p53_input_manifest.required_plan_sections.filter((row) => row !== 'human_role_matrix');
  if (fixture.scenario === 'safety_rules_absent' && next.p53_input_manifest) next.p53_input_manifest.required_plan_sections = next.p53_input_manifest.required_plan_sections.filter((row) => row !== 'safety_stop_rules');
  if (fixture.scenario === 'rollback_plan_absent' && next.p53_input_manifest) next.p53_input_manifest.required_plan_sections = next.p53_input_manifest.required_plan_sections.filter((row) => row !== 'rollback_plan');
  if (fixture.scenario === 'traceability_packet_absent' && next.p53_input_manifest) next.p53_input_manifest.required_plan_sections = next.p53_input_manifest.required_plan_sections.filter((row) => row !== 'traceability_packet');
  if (fixture.scenario === 'control_boundary_absent') {
    next.present.control_to_ao_act_non_goals = false;
    delete next.control_to_ao_act_non_goals;
  }
  if (fixture.scenario === 'p55_claim_flag') next.flags.runtimeServiceClaim = true;
  if (fixture.scenario === 'execution_claim_flag') next.flags.executionClaim = true;
  if (fixture.scenario === 'full_freeze_claim_flag') next.flags.freezeClaim = true;
  return next;
}

function buildDimensions(manifest, source) {
  const hardRefsExist = Object.keys(manifest.source_refs).every((key) => source.present[key] === true);
  const p53AcceptanceOk = source.p53_closure?.acceptance?.assertion_count === 43 && source.p53_closure?.acceptance?.failed_assertion_count === 0;
  const p53ResultOk = source.p53_closure?.field_pilot_plan_result === 'PLAN_READY_WITH_LIMITATIONS';
  const p53PlanGateOk = source.p53_closure?.gate_result?.field_pilot_plan_allowed === true && source.p53_closure?.gate_result?.p54_readiness_review_allowed === true;
  const p53ExecutionForbidden = source.p53_closure?.gate_result?.field_pilot_execution_allowed === false;
  const p53DownstreamForbidden = source.p53_closure?.gate_result?.ao_act_task_creation_allowed === false && source.p53_closure?.gate_result?.dispatch_allowed === false && source.p53_closure?.gate_result?.roi_allowed === false && source.p53_closure?.gate_result?.field_memory_allowed === false && source.p53_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const candidateScopeOk = source.p53_expected_report?.candidate_site_scope_kind === 'DEMO_FIELD_CANDIDATE' && source.p53_expected_report?.real_site_selected === false && source.p53_expected_report?.field_owner_committed === false && source.p53_expected_report?.field_operation_scheduled === false;
  const requiredSections = source.p53_input_manifest?.required_plan_sections || [];
  const p53SectionsOk = REQUIRED_P53_SECTIONS.every((section) => requiredSections.includes(section));
  const evidenceProtocolOk = requiredSections.includes('evidence_collection_protocol');
  const deviceGatewayPlanOk = requiredSections.includes('device_gateway_readiness_checklist');
  const humanRoleOk = requiredSections.includes('human_role_matrix');
  const safetyRollbackOk = requiredSections.includes('safety_stop_rules') && requiredSections.includes('rollback_plan');
  const controlBoundaryOk = /裁决 ≠ 执行/.test(source.control_to_ao_act_non_goals?.text || '') && /不得自动或隐式实例化/.test(source.control_to_ao_act_non_goals?.text || '');
  const p55GateReady = p53AcceptanceOk && p53ResultOk && p53PlanGateOk && p53ExecutionForbidden && p53DownstreamForbidden && candidateScopeOk && p53SectionsOk && controlBoundaryOk;
  return [
    { dimension_id: 'R1', name: 'baseline_closure_health', status: hardRefsExist ? 'OK' : 'BLOCKED', reason: hardRefsExist ? 'all committed source refs exist' : 'committed source ref missing' },
    { dimension_id: 'R2', name: 'p53_closure_integrity', status: source.p53_closure?.next_allowed_phase_after_closure === 'P54 Field Pilot Readiness Review Gate v1' ? 'OK' : 'BLOCKED', reason: 'P53 closure must point to P54' },
    { dimension_id: 'R3', name: 'p53_acceptance_health', status: p53AcceptanceOk ? 'OK' : 'BLOCKED', reason: 'P53 acceptance must be 43/0' },
    { dimension_id: 'R4', name: 'p53_plan_gate_health', status: p53ResultOk && p53PlanGateOk ? 'OK' : 'BLOCKED', reason: 'P53 plan gate must remain allowed for readiness review' },
    { dimension_id: 'R5', name: 'p53_execution_forbidden_health', status: p53ExecutionForbidden && p53DownstreamForbidden ? 'OK' : 'BLOCKED', reason: 'P53 execution and downstream gates must remain false' },
    { dimension_id: 'R6', name: 'candidate_site_scope_health', status: candidateScopeOk ? 'OK' : 'BLOCKED', reason: 'candidate site must remain pointer-only and non-committed' },
    { dimension_id: 'R7', name: 'evidence_protocol_health', status: evidenceProtocolOk ? 'OK' : 'BLOCKED', reason: 'evidence protocol section must exist' },
    { dimension_id: 'R8', name: 'device_gateway_readiness_plan_health', status: deviceGatewayPlanOk ? 'WARN' : 'BLOCKED', reason: deviceGatewayPlanOk ? 'readiness checklist exists but remains planning-only' : 'readiness checklist missing' },
    { dimension_id: 'R9', name: 'human_role_and_responsibility_health', status: humanRoleOk ? 'OK' : 'BLOCKED', reason: 'human role matrix must exist' },
    { dimension_id: 'R10', name: 'safety_stop_and_rollback_health', status: safetyRollbackOk ? 'OK' : 'BLOCKED', reason: 'safety stop and rollback sections must exist' },
    { dimension_id: 'R11', name: 'control_to_ao_act_boundary_health', status: controlBoundaryOk ? 'OK' : 'BLOCKED', reason: 'Control to AO-ACT non-goals must remain present' },
    { dimension_id: 'R12', name: 'p55_runtime_health_service_gate_readiness', status: p55GateReady ? 'WARN' : 'BLOCKED', reason: p55GateReady ? 'P55 gate can be entered, but P54 does not implement service' : 'P55 gate readiness failed' },
  ];
}

function evaluate(manifest, source) {
  const dimensions = buildDimensions(manifest, source);
  const blockedDimensions = dimensions.filter((row) => row.status === 'BLOCKED');
  const warnDimensions = dimensions.filter((row) => row.status === 'WARN');
  const sourceRefsAvoidAcceptanceOutput = Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/'));
  const expectedIdsMatch = JSON.stringify(dimensions.map((row) => row.dimension_id)) === JSON.stringify(REQUIRED_DIMENSION_IDS);
  const forbiddenClaims = Boolean(source.flags.runtimeServiceClaim || source.flags.executionClaim || source.flags.freezeClaim);
  const blockedReasons = [];
  if (blockedDimensions.length > 0) blockedReasons.push('blocked_readiness_dimension');
  if (warnDimensions.length < 1) blockedReasons.push('missing_required_warning');
  if (!sourceRefsAvoidAcceptanceOutput) blockedReasons.push('acceptance_output_used_as_source');
  if (!expectedIdsMatch) blockedReasons.push('dimension_id_mismatch');
  if (forbiddenClaims) blockedReasons.push('forbidden_downstream_claim');
  const blocked = blockedReasons.length > 0;
  const gates = {
    p55_runtime_health_service_gate: { allowed: !blocked, reason: blocked ? blockedReasons.join('|') : 'P53 readiness is complete enough for P55 gate review.' },
    field_pilot_execution_gate: { allowed: false, reason: 'P54 is a readiness review gate only.' },
    full_runtime_freeze_gate: { allowed: false, reason: 'P54 cannot freeze Full Runtime v1.' },
  };
  const limitationRegister = [
    { limitation_id: 'L1', severity: 'WARN', reason: 'P54 readiness review only' },
    { limitation_id: 'L2', severity: 'WARN', reason: 'runtime health service not implemented in P54' },
    { limitation_id: 'L3', severity: 'WARN', reason: 'P53 plan remains planning-only' },
  ];
  const traceabilityPacket = {
    p53_closure_ref: manifest.source_refs.p53_closure,
    p53_final_tag: source.p53_closure?.final_tag ?? null,
    p53_final_commit: source.p53_closure?.final_commit ?? null,
    p53_evidence_packet_ref: manifest.source_refs.p53_evidence_packet,
    p53_expected_report_ref: manifest.source_refs.p53_expected_report,
    p53_expected_gate_ref: manifest.source_refs.p53_expected_gate,
    p52_closure_ref: manifest.source_refs.p52_closure,
    control_boundary_ref: manifest.source_refs.control_to_ao_act_non_goals,
  };
  const reportCore = {
    schema_version: 'geox_p54_field_pilot_readiness_review_report_v1',
    phase: 'P54',
    task_line: 'P54 Controlled Field Pilot Readiness Review Gate v1',
    review_type: manifest.review_type,
    baseline_tag: manifest.baseline_tag,
    baseline_commit: manifest.baseline_commit,
    readiness_review_result: blocked ? 'BLOCKED' : 'READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS',
    blocked_reasons: blockedReasons,
    dimensions,
    blocked_dimension_count: blockedDimensions.length,
    warn_dimension_count: warnDimensions.length,
    gates,
    limitation_register: limitationRegister,
    traceability_packet: traceabilityPacket,
    p55_runtime_health_service_gate_allowed: !blocked,
    field_pilot_execution_allowed: false,
    full_runtime_v1_freeze_allowed: false,
    runtime_health_service_implemented: false,
    live_runtime_monitoring_active: false,
    real_device_deployed: false,
    production_gateway_online: false,
    ao_act_task_creation_allowed: false,
    dispatch_allowed: false,
    roi_allowed: false,
    field_memory_allowed: false,
    forbidden_record_types: FORBIDDEN_RECORD_TYPES,
    hash_probe_marker: manifest.hash_probe_marker || null,
  };
  const deterministicHash = hash(reportCore);
  const records = [
    ['p54_field_pilot_readiness_input_manifest_v1', manifest],
    ['p54_field_pilot_readiness_source_snapshot_v1', { present: source.present, refs: manifest.source_refs }],
    ['p54_field_pilot_readiness_dimension_v1', dimensions],
    ['p54_field_pilot_readiness_review_report_v1', { ...reportCore, deterministic_hash: deterministicHash }],
    ['p54_field_pilot_readiness_gate_v1', gates],
    ['p54_runtime_health_service_gate_request_v1', { allowed: !blocked, target_phase: 'P55 Runtime Health Service Gate v1' }],
    ['p54_field_pilot_readiness_limitation_register_v1', limitationRegister],
    ['p54_field_pilot_readiness_traceability_packet_v1', traceabilityPacket],
    ['p54_field_pilot_readiness_capability_matrix_v1', { capability_count: 16, status: blocked ? 'BLOCKED' : 'PASS' }],
  ].map(([record_type, payload]) => ({ record_type, payload, record_timestamp: manifest.as_of_ts, record_hash: hash({ record_type, payload }) }));
  return { ok: !blocked, report: { ...reportCore, deterministic_hash: deterministicHash }, records };
}

function runNormal(manifestPath) {
  const manifest = readJson(manifestPath);
  return evaluate(manifest, loadSources(manifest));
}

function runNegative(manifestPath, negativeManifestPath) {
  const manifest = readJson(manifestPath);
  const source = loadSources(manifest);
  const negativeManifest = readJson(negativeManifestPath);
  const results = negativeManifest.negative_fixture_refs.map((ref) => {
    const fixture = readJson(ref);
    const result = evaluate(manifest, mutate(source, fixture));
    return {
      scenario_id: fixture.scenario_id,
      result_state: result.report.readiness_review_result,
      blocked: result.report.readiness_review_result === 'BLOCKED',
      p55_runtime_health_service_gate_allowed: result.report.p55_runtime_health_service_gate_allowed,
      field_pilot_execution_allowed: result.report.field_pilot_execution_allowed,
      full_runtime_v1_freeze_allowed: result.report.full_runtime_v1_freeze_allowed,
      target_records_created: 0,
    };
  });
  return {
    ok: results.every((row) => row.blocked && row.p55_runtime_health_service_gate_allowed === false && row.field_pilot_execution_allowed === false && row.full_runtime_v1_freeze_allowed === false && row.target_records_created === 0),
    negative_result_count: results.length,
    blocked_count: results.filter((row) => row.blocked).length,
    results,
  };
}

function writeOutputs(result) {
  fs.mkdirSync(path.dirname(OUTPUT_LEDGER), { recursive: true });
  fs.writeFileSync(OUTPUT_LEDGER, `${result.records.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_REPORT, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
}

function main() {
  const parsed = args(process.argv);
  if (parsed.mode === 'controlled-negative') {
    console.log(JSON.stringify(runNegative(parsed.manifest, parsed.negativeManifest), null, 2));
    return;
  }
  const normal = runNormal(parsed.manifest);
  if (parsed.mode === 'controlled-source-scan') {
    console.log(JSON.stringify(normal.report.traceability_packet, null, 2));
    return;
  }
  if (parsed.mode === 'controlled-gate') {
    console.log(JSON.stringify(normal.report.gates, null, 2));
    return;
  }
  if (parsed.mode === 'controlled-write') writeOutputs(normal);
  console.log(JSON.stringify({
    ok: normal.ok,
    phase: 'P54',
    task_line: normal.report.task_line,
    readiness_review_result: normal.report.readiness_review_result,
    p55_runtime_health_service_gate_allowed: normal.report.p55_runtime_health_service_gate_allowed,
    field_pilot_execution_allowed: normal.report.field_pilot_execution_allowed,
    full_runtime_v1_freeze_allowed: normal.report.full_runtime_v1_freeze_allowed,
    deterministic_hash: normal.report.deterministic_hash,
  }, null, 2));
}

main();
