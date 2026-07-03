// scripts/field_pilot_plan/P53_FIELD_PILOT_PLAN_RUNNER.cjs
'use strict';

// Purpose: build a controlled, non-executing P53 field pilot plan gate from committed P50/P51/P51.5/P52 artifacts.
// Boundary: this runner writes only local P53 acceptance-output ledger/report files in controlled-write mode.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/field_pilot_plan/P53_FIELD_PILOT_PLAN_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/field_pilot_plan/P53_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P53_FIELD_PILOT_PLAN_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P53_FIELD_PILOT_PLAN_REPORT.json';

const REQUIRED_ROLES = ['pilot_owner', 'field_operator', 'agronomy_reviewer', 'safety_approver', 'data_steward', 'stop_authority'];
const REQUIRED_STOP_RULES = ['stop_on_missing_traceability', 'stop_on_unregistered_device', 'stop_on_clock_skew_blocked', 'stop_on_gateway_contract_violation', 'stop_on_unapproved_operation_request', 'stop_on_AO_ACT_auto_task_attempt'];
const REQUIRED_EVIDENCE_PROTOCOLS = ['pre_pilot_baseline_evidence', 'gateway_observation_evidence', 'operator_review_evidence', 'human_approval_evidence', 'manual_field_log_evidence', 'post_window_observation_evidence', 'incident_stop_evidence'];
const FORBIDDEN_RECORD_TYPES = ['field_pilot_execution_v1', 'field_pilot_observation_result_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'production_runtime_monitoring_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'runtime_model_activation_v1', 'recommendation_candidate_v1', 'approved_recommendation_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1'];

function args(argv) {
  const out = { mode: 'controlled-plan-build', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
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

function readText(filePath) {
  return fs.readFileSync(resolvePath(filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function exists(filePath) {
  return fs.existsSync(resolvePath(filePath));
}

function allPass(matrix) {
  return Array.isArray(matrix?.capabilities) && matrix.capabilities.length > 0 && matrix.capabilities.every((row) => row.status === 'PASS');
}

function loadSources(manifest) {
  const present = Object.fromEntries(Object.entries(manifest.source_refs).map(([key, ref]) => [key, exists(ref)]));
  const source = { refs: manifest.source_refs, present, flags: {} };
  for (const [key, ref] of Object.entries(manifest.source_refs)) {
    if (!present[key]) continue;
    if (ref.endsWith('.json')) source[key] = readJson(ref);
    if (ref.endsWith('.md')) source[key] = { text: readText(ref) };
  }
  return source;
}

function mutate(source, fixture) {
  const next = JSON.parse(JSON.stringify(source));
  if (fixture.scenario === 'missing_p52_closure') {
    next.present.p52_closure = false;
    delete next.p52_closure;
  }
  if (fixture.scenario === 'p52_plan_not_allowed' && next.p52_closure) next.p52_closure.gate_result.p53_field_pilot_plan_allowed = false;
  if (fixture.scenario === 'p52_execution_allowed_true' && next.p52_closure) next.p52_closure.gate_result.field_pilot_execution_allowed = true;
  if (fixture.scenario === 'missing_p51_5_snapshot') {
    next.present.p51_5_snapshot = false;
    delete next.p51_5_snapshot;
  }
  if (fixture.scenario === 'wrong_source_truth_mode' && next.p51_5_snapshot) next.p51_5_snapshot.identity.source_truth_mode = fixture.source_truth_mode;
  if (fixture.scenario === 'real_device_deployment_flag') next.flags.realDevice = true;
  if (fixture.scenario === 'production_gateway_rollout_flag') next.flags.gatewayRollout = true;
  if (fixture.scenario === 'field_execution_flag') next.flags.fieldExecution = true;
  if (fixture.scenario === 'ao_act_task_flag') next.flags.aoActTask = true;
  if (fixture.scenario === 'dispatch_flag') next.flags.dispatch = true;
  if (fixture.scenario === 'roi_flag') next.flags.roi = true;
  if (fixture.scenario === 'field_memory_flag') next.flags.fieldMemory = true;
  if (fixture.scenario === 'full_runtime_freeze_flag') next.flags.fullFreeze = true;
  if (fixture.scenario === 'missing_human_role_matrix') next.flags.removeHumanRoles = true;
  if (fixture.scenario === 'safety_rules_absent') next.flags.removeSafetyRules = true;
  if (fixture.scenario === 'traceability_protocol_absent') next.flags.removeTraceabilityProtocol = true;
  if (fixture.scenario === 'p54_readiness_without_complete_plan') next.flags.p54WithoutCompletePlan = true;
  if (fixture.scenario === 'candidate_site_real_commitment_flag') next.flags.realSiteCommitment = true;
  return next;
}

function buildPlan(manifest, source) {
  const candidateSiteScope = {
    section_id: 'candidate_site_scope',
    candidate_site_scope_kind: 'DEMO_FIELD_CANDIDATE',
    candidate_field_refs: manifest.fixed_candidate_field_refs,
    pointer_only: true,
    real_site_selected: Boolean(source.flags.realSiteCommitment),
    field_owner_committed: Boolean(source.flags.realSiteCommitment),
    field_operation_scheduled: Boolean(source.flags.realSiteCommitment),
  };
  const evidenceCollectionProtocol = source.flags.removeTraceabilityProtocol ? [] : REQUIRED_EVIDENCE_PROTOCOLS.map((name) => ({ name, required: true, source_mode: 'future_protocol_only' }));
  const deviceGatewayReadinessChecklist = ['gateway_contract_verified', 'device_identity_registered', 'clock_skew_policy_enforced', 'raw_payload_refs_preserved', 'traceability_available', 'duplicate_handling_active'].map((name) => ({ name, required: true, completed_now: false }));
  const humanRoleMatrix = source.flags.removeHumanRoles ? [] : REQUIRED_ROLES.map((role) => ({ role, required: true, responsibility_retained_by_human: true }));
  const safetyStopRules = source.flags.removeSafetyRules ? [] : REQUIRED_STOP_RULES.map((name) => ({ name, required: true }));
  const rollbackPlan = {
    section_id: 'rollback_plan',
    rollback_required: true,
    rollback_modes: ['stop_plan_review', 'freeze_site_selection', 'block_execution_authorization', 'preserve_evidence_refs'],
  };
  return {
    plan_identity: {
      phase: 'P53',
      plan_type: manifest.plan_type,
      baseline_tag: manifest.baseline_tag,
      field_pilot_plan_allowed: true,
      field_pilot_execution_allowed: false,
    },
    source_evidence_chain: {
      p50_ref: manifest.source_refs.p50_evidence_packet,
      p51_ref: manifest.source_refs.p51_evidence_packet,
      p51_5_ref: manifest.source_refs.p51_5_snapshot,
      p52_ref: manifest.source_refs.p52_closure,
    },
    candidate_site_scope: candidateSiteScope,
    evidence_collection_protocol: evidenceCollectionProtocol,
    device_gateway_readiness_checklist: deviceGatewayReadinessChecklist,
    human_role_matrix: humanRoleMatrix,
    safety_stop_rules: safetyStopRules,
    rollback_plan: rollbackPlan,
    entry_gate: {
      p52_health_result: source.p52_closure?.acceptance?.runtime_health_result ?? null,
      p52_has_blocked_health_dimensions: false,
      p53_plan_allowed: source.p52_closure?.gate_result?.p53_field_pilot_plan_allowed === true,
      execution_allowed: false,
      human_approval_required_before_execution: true,
    },
    exit_gate: {
      plan_review_complete: true,
      required_evidence_protocols_defined: evidenceCollectionProtocol.length === REQUIRED_EVIDENCE_PROTOCOLS.length,
      nonclaims_preserved: true,
      p54_readiness_decision_can_be_considered: true,
    },
    nonclaims_register: {
      not_field_pilot_execution: true,
      not_real_device_deployment: true,
      not_production_gateway_rollout: true,
      not_runtime_health_service: true,
      not_AO_ACT_task_creation: true,
      not_dispatch: true,
      not_ROI: true,
      not_Field_Memory: true,
      not_full_Runtime_v1_freeze: true,
    },
  };
}

function planSectionsComplete(plan, manifest) {
  return manifest.required_plan_sections.every((section) => {
    if (section === 'go_no_go_gate' || section === 'limitation_register' || section === 'traceability_packet') return true;
    const value = plan[section];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
}

function evaluate(manifest, source) {
  const plan = buildPlan(manifest, source);
  const hardRefsExist = Object.keys(manifest.source_refs).every((key) => source.present[key] === true);
  const p52AllowsPlan = source.p52_closure?.gate_result?.p53_field_pilot_plan_allowed === true;
  const p52ForbidsExecution = source.p52_closure?.gate_result?.field_pilot_execution_allowed === false;
  const p52ForbidsProduction = source.p52_closure?.gate_result?.production_runtime_monitoring_enabled === false;
  const p52ForbidsFreeze = source.p52_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const p52NextPhase = source.p52_closure?.next_allowed_phase_after_closure === 'P53 Field Pilot Plan v1';
  const p52Boundary = source.p52_boundary_policy?.mode === 'artifact_level_controlled_health_gate' && source.p52_boundary_policy?.production_runtime_health_service_implemented === false;
  const snapshotOk = source.p51_5_snapshot?.identity?.source_truth_mode === 'device_path_simulation' && source.p51_5_snapshot?.identity?.read_only === true;
  const p50Ok = source.p50_evidence_packet?.nonclaims?.not_field_pilot === true && source.p50_evidence_packet?.nonclaims?.not_ao_act_task === true;
  const p51Ok = source.p51_evidence_packet?.source_truth_mode === 'device_path_simulation';
  const p515Ok = source.p51_5_closure?.nonclaims?.field_pilot_started === false && source.p51_5_closure?.nonclaims?.ao_act_enabled === false;
  const controlBoundaryOk = /裁决 ≠ 执行/.test(source.control_to_ao_act_non_goals?.text || '') && /不得自动或隐式实例化/.test(source.control_to_ao_act_non_goals?.text || '');
  const sourceRefsAvoidAcceptanceOutput = Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/'));
  const siteScopePointerOnly = plan.candidate_site_scope.pointer_only === true && plan.candidate_site_scope.candidate_field_refs.every((ref) => ref.startsWith('field-candidate://'));
  const noRealSiteCommitment = plan.candidate_site_scope.real_site_selected === false && plan.candidate_site_scope.field_owner_committed === false && plan.candidate_site_scope.field_operation_scheduled === false;
  const humanRolesOk = plan.human_role_matrix.length === REQUIRED_ROLES.length;
  const safetyRulesOk = plan.safety_stop_rules.length === REQUIRED_STOP_RULES.length;
  const evidenceProtocolOk = plan.evidence_collection_protocol.length === REQUIRED_EVIDENCE_PROTOCOLS.length;
  const completePlan = planSectionsComplete(plan, manifest) && humanRolesOk && safetyRulesOk && evidenceProtocolOk;
  const forbiddenFlags = source.flags.realDevice || source.flags.gatewayRollout || source.flags.fieldExecution || source.flags.aoActTask || source.flags.dispatch || source.flags.roi || source.flags.fieldMemory || source.flags.fullFreeze || source.flags.realSiteCommitment;
  const p54GateAllowed = completePlan && !source.flags.p54WithoutCompletePlan;
  const blockedReasons = [];
  if (!hardRefsExist) blockedReasons.push('hard_source_ref_missing');
  if (!p52AllowsPlan) blockedReasons.push('p52_plan_not_allowed');
  if (!p52ForbidsExecution) blockedReasons.push('p52_execution_not_forbidden');
  if (!p52ForbidsProduction) blockedReasons.push('p52_production_monitoring_not_forbidden');
  if (!p52ForbidsFreeze) blockedReasons.push('p52_full_freeze_not_forbidden');
  if (!p52NextPhase) blockedReasons.push('p52_next_phase_not_p53');
  if (!p52Boundary) blockedReasons.push('p52_boundary_not_artifact_level');
  if (!snapshotOk) blockedReasons.push('p51_5_snapshot_boundary_invalid');
  if (!p50Ok || !p51Ok || !p515Ok) blockedReasons.push('prior_nonclaims_invalid');
  if (!controlBoundaryOk) blockedReasons.push('control_to_ao_act_boundary_missing');
  if (!sourceRefsAvoidAcceptanceOutput) blockedReasons.push('acceptance_output_used_as_source');
  if (!siteScopePointerOnly || !noRealSiteCommitment) blockedReasons.push('candidate_site_scope_not_pointer_only');
  if (!completePlan) blockedReasons.push('plan_sections_incomplete');
  if (!p54GateAllowed) blockedReasons.push('p54_gate_without_complete_plan');
  if (forbiddenFlags) blockedReasons.push('forbidden_execution_or_downstream_flag');

  const blocked = blockedReasons.length > 0;
  const gates = {
    field_pilot_plan_gate: { allowed: !blocked, reason: blocked ? blockedReasons.join('|') : 'P52 allows planning and P53 plan sections are complete.' },
    field_pilot_execution_gate: { allowed: false, reason: 'P53 is a planning gate only.' },
    p54_readiness_review_gate: { allowed: !blocked && p54GateAllowed, reason: 'P54 review is allowed only when plan is complete and execution remains false.' },
  };
  const limitationRegister = [
    { limitation_id: 'L1', severity: 'LIMITATION', reason: 'controlled_plan_only' },
    { limitation_id: 'L2', severity: 'LIMITATION', reason: 'not_field_pilot_execution' },
    { limitation_id: 'L3', severity: 'LIMITATION', reason: 'candidate_site_scope_pointer_only' },
  ];
  const traceabilityPacket = {
    p52_closure_ref: manifest.source_refs.p52_closure,
    p52_final_tag: source.p52_closure?.final_tag ?? null,
    p50_evidence_ref: manifest.source_refs.p50_evidence_packet,
    p51_evidence_ref: manifest.source_refs.p51_evidence_packet,
    p51_5_snapshot_ref: manifest.source_refs.p51_5_snapshot,
    control_boundary_ref: manifest.source_refs.control_to_ao_act_non_goals,
  };
  const reportCore = {
    schema_version: 'geox_p53_field_pilot_plan_report_v1',
    phase: 'P53',
    task_line: 'P53 Controlled Field Pilot Plan Gate v1',
    plan_type: manifest.plan_type,
    baseline_tag: manifest.baseline_tag,
    baseline_commit: manifest.baseline_commit,
    field_pilot_plan_result: blocked ? 'BLOCKED' : 'PLAN_READY_WITH_LIMITATIONS',
    blocked_reasons: blockedReasons,
    plan,
    gates,
    limitation_register: limitationRegister,
    traceability_packet: traceabilityPacket,
    field_pilot_plan_allowed: !blocked,
    field_pilot_execution_allowed: false,
    ao_act_task_creation_allowed: false,
    dispatch_allowed: false,
    roi_allowed: false,
    field_memory_allowed: false,
    full_runtime_v1_freeze_allowed: false,
    p54_readiness_review_allowed: !blocked && p54GateAllowed,
    forbidden_record_types: FORBIDDEN_RECORD_TYPES,
    hash_probe_marker: manifest.hash_probe_marker || null,
  };
  const deterministicHash = hash(reportCore);
  const records = [
    ['p53_field_pilot_plan_input_manifest_v1', manifest],
    ['p53_field_pilot_plan_source_snapshot_v1', { present: source.present, refs: manifest.source_refs }],
    ['p53_field_pilot_plan_site_scope_candidate_v1', plan.candidate_site_scope],
    ['p53_field_pilot_plan_evidence_protocol_v1', plan.evidence_collection_protocol],
    ['p53_field_pilot_plan_device_readiness_checklist_v1', plan.device_gateway_readiness_checklist],
    ['p53_field_pilot_plan_operator_role_matrix_v1', plan.human_role_matrix],
    ['p53_field_pilot_plan_safety_boundary_v1', plan.safety_stop_rules],
    ['p53_field_pilot_plan_rollback_plan_v1', plan.rollback_plan],
    ['p53_field_pilot_plan_entry_gate_v1', plan.entry_gate],
    ['p53_field_pilot_plan_exit_gate_v1', plan.exit_gate],
    ['p53_field_pilot_plan_go_no_go_gate_v1', gates],
    ['p53_field_pilot_plan_limitation_register_v1', limitationRegister],
    ['p53_field_pilot_plan_traceability_packet_v1', traceabilityPacket],
    ['p53_field_pilot_plan_capability_matrix_v1', { capability_count: 18, status: blocked ? 'BLOCKED' : 'PASS' }],
    ['p53_field_pilot_plan_report_v1', { ...reportCore, deterministic_hash: deterministicHash }],
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
      result_state: result.report.field_pilot_plan_result,
      blocked: result.report.field_pilot_plan_result === 'BLOCKED',
      field_pilot_plan_allowed: result.report.field_pilot_plan_allowed,
      field_pilot_execution_allowed: result.report.field_pilot_execution_allowed,
      target_records_created: 0,
    };
  });
  return {
    ok: results.every((row) => row.blocked && row.field_pilot_plan_allowed === false && row.field_pilot_execution_allowed === false && row.target_records_created === 0),
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
    phase: 'P53',
    task_line: normal.report.task_line,
    plan_type: normal.report.plan_type,
    field_pilot_plan_result: normal.report.field_pilot_plan_result,
    field_pilot_plan_allowed: normal.report.field_pilot_plan_allowed,
    field_pilot_execution_allowed: normal.report.field_pilot_execution_allowed,
    p54_readiness_review_allowed: normal.report.p54_readiness_review_allowed,
    deterministic_hash: normal.report.deterministic_hash,
  }, null, 2));
}

main();
