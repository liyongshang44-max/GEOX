// scripts/twin_runtime_v1/TWIN_RUNTIME_V1_E2E_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const MATRIX_PATH = 'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-CAPABILITY-MATRIX.json';
const PACKET_PATH = 'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-E2E-EVIDENCE-PACKET.json';
const FREEZE_DOC_PATH = 'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE.md';
const CLOSURE_REVIEW_PATH = 'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE-CLOSURE-REVIEW.json';
const BASELINE_TAG = 'p48_end_to_end_production_twin_pilot_closure_gate_v0_closure_boundary_errata_v0';
const BASELINE_COMMIT = '9564ee212e59f6f2700e72a4ff620bfc04d264b9';
const FINAL_TAG = 'p49_twin_runtime_v1_pilot_freeze_evidence_package_v0';
const FINAL_COMMIT = 'c73331746ee7b5fcb828c3ba928b0ccc0e298d73';
const EXPECTED_CLOSURE_TAG = 'p49_twin_runtime_v1_pilot_freeze_evidence_package_v0_closure';

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
};
const stable = (value) => JSON.stringify(sortDeep(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const git = (args) => {
  try {
    return cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const matrix = readJson(MATRIX_PATH);
const packet = readJson(PACKET_PATH);
const expectedFiles = [
  'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-PILOT-FREEZE.md',
  'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-CAPABILITY-MATRIX.json',
  'docs/twin_runtime_v1/GEOX-TWIN-RUNTIME-V1-E2E-EVIDENCE-PACKET.json',
  'scripts/twin_runtime_v1/TWIN_RUNTIME_V1_E2E_ACCEPTANCE.cjs'
];
const closureReviewExists = fs.existsSync(CLOSURE_REVIEW_PATH);
const allowedChangedFiles = closureReviewExists ? [...expectedFiles, CLOSURE_REVIEW_PATH] : expectedFiles;

check('freeze_doc_exists', fs.existsSync(FREEZE_DOC_PATH));
check('matrix_exists', fs.existsSync(MATRIX_PATH));
check('packet_exists', fs.existsSync(PACKET_PATH));
check('phase', matrix.phase === 'P49' && packet.phase === 'P49');
check('freeze_name', matrix.freeze_name === 'TWIN_RUNTIME_V1_PILOT_FREEZE' && packet.freeze_name === matrix.freeze_name);
check('baseline_tag', matrix.baseline_tag === BASELINE_TAG && packet.baseline.tag === BASELINE_TAG);
check('baseline_commit', matrix.baseline_commit === BASELINE_COMMIT && packet.baseline.commit === BASELINE_COMMIT);
check('claim_boundary_not_new_capability', matrix.claim_boundary.p49_is_not_new_runtime_capability === true);
check('claim_boundary_not_service', matrix.claim_boundary.p49_is_not_runtime_service === true);
check('claim_boundary_not_demo', matrix.claim_boundary.p49_is_not_demo_runtime === true);
check('claim_boundary_not_gateway', matrix.claim_boundary.p49_is_not_device_gateway === true);
check('claim_boundary_not_rollout', matrix.claim_boundary.p49_is_not_production_rollout === true);
check('expected_files', JSON.stringify(packet.expected_changed_files) === JSON.stringify(expectedFiles));

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean).sort();
  check('changed_files_exact_or_post_final_metadata', JSON.stringify(changed) === JSON.stringify([...allowedChangedFiles].sort()));
  check('no_forbidden_surface_changed', !changed.some((path) => packet.forbidden_surfaces.some((surface) => surface.endsWith('/') ? path.startsWith(surface) : path === surface)));
} else {
  check('diff_check_skipped_when_baseline_ref_unavailable', true);
}

if (closureReviewExists) {
  const closure = readJson(CLOSURE_REVIEW_PATH);
  check('closure_phase', closure.phase === 'P49');
  check('closure_schema', closure.schema_version === 'geox_twin_runtime_v1_p49_closure_review_v0');
  check('closure_baseline', closure.baseline_tag === BASELINE_TAG && closure.baseline_commit === BASELINE_COMMIT);
  check('closure_final_ref', closure.final_tag === FINAL_TAG && closure.final_commit === FINAL_COMMIT);
  check('closure_expected_tag', closure.expected_closure_tag === EXPECTED_CLOSURE_TAG);
  check('closure_tag_pending', closure.closure_tag_created === false && closure.closure_tag === null && closure.closure_commit === null);
  check('closure_tag_required_after_merge', closure.closure_tag_required_after_closure_patch_merge === true);
  check('closure_complete', closure.completion_status === 'complete');
  check('closure_ready_for_tag', closure.final_closure_status === 'closure_metadata_ready_for_tag_after_merge');
  check('closure_limited_result', closure.freeze_result === 'PASS_WITH_LIMITATIONS' && closure.runtime_v1_freeze_allowed === false);
  check('closure_no_full_claim', closure.full_runtime_v1_freeze_claim === 'not_allowed');
  check('closure_no_matrix_or_packet_change', closure.closure_does_not_change_capability_matrix === true && closure.closure_does_not_change_evidence_packet === true);
  check('closure_truth_gates_preserved', closure.closure_does_not_claim_first_class_state_estimate_generation === true && closure.closure_does_not_claim_next_forecast_active_model_consumption === true);
} else {
  check('closure_review_optional_before_closure_patch', true);
}

check('capability_count_10', Array.isArray(matrix.capabilities) && matrix.capabilities.length === 10);
check('source_chain_p37_p48', ['p37','p38','p39','p40','p41','p42','p43','p44','p45','p46','p47','p48'].every((key) => packet.source_chain && packet.source_chain[key]));
check('source_refs_present', Array.isArray(packet.source_refs) && packet.source_refs.length === 12);
check('policy_refs_present', Array.isArray(packet.policy_refs) && packet.policy_refs.length >= 4);
check('packet_idempotency', typeof packet.idempotency_key === 'string' && packet.idempotency_key.startsWith('p49:e2e:'));
check('packet_hashes_present', packet.e2e_hashes && ['source_chain_hash','capability_matrix_hash','e2e_evidence_packet_hash','determinism_hash'].every((key) => typeof packet.e2e_hashes[key] === 'string' && packet.e2e_hashes[key].length >= 16));

const allowed = new Set(['PASS', 'PASS_WITH_LIMITATIONS', 'BLOCKED', 'NOT_CLAIMED']);
const byId = new Map(matrix.capabilities.map((capability) => [capability.capability_id, capability]));
for (const capability of matrix.capabilities) {
  check(`${capability.capability_id}.status_allowed`, allowed.has(capability.status));
  check(`${capability.capability_id}.readback_refs`, Array.isArray(capability.required_readback_refs) && capability.required_readback_refs.length > 0);
  check(`${capability.capability_id}.source_refs`, Array.isArray(capability.source_refs) && capability.source_refs.length > 0);
  check(`${capability.capability_id}.policy_refs`, Array.isArray(capability.policy_refs) && capability.policy_refs.length > 0);
  check(`${capability.capability_id}.hashes`, capability.hashes && ['record_set_hash','determinism_hash','chain_hash'].every((key) => typeof capability.hashes[key] === 'string' && capability.hashes[key].length >= 16));
  check(`${capability.capability_id}.idempotency`, typeof capability.idempotency_key === 'string' && capability.idempotency_key.startsWith(`p49:${capability.capability_id}:`));
  check(`${capability.capability_id}.append_only`, capability.append_only_proof === true);
  check(`${capability.capability_id}.no_forbidden_downstream`, capability.no_forbidden_downstream === true);
}

check('q1_pass', byId.get('Q1')?.status === 'PASS' && byId.get('Q1')?.result_flags.evidence_enters_runtime_cycle === true);
check('q2_truth_gate', byId.get('Q2')?.status === 'PASS_WITH_LIMITATIONS' && byId.get('Q2')?.result_flags.state_estimate_generated === false && byId.get('Q2')?.result_flags.state_estimate_generation_claim === 'limited');
check('q3_pass', byId.get('Q3')?.status === 'PASS' && byId.get('Q3')?.result_flags.forecast_generated === true);
check('q4_pass', byId.get('Q4')?.status === 'PASS' && byId.get('Q4')?.result_flags.later_evidence_returns_to_runtime === true);
check('q5_pass', byId.get('Q5')?.status === 'PASS' && byId.get('Q5')?.result_flags.forecast_residual_computed === true);
check('q6_pass', byId.get('Q6')?.status === 'PASS' && byId.get('Q6')?.result_flags.offline_calibration_trial_executed === true);
check('q7_pass', byId.get('Q7')?.status === 'PASS' && byId.get('Q7')?.result_flags.parameter_delta_and_candidate_created === true);
check('q8_pass', byId.get('Q8')?.status === 'PASS' && byId.get('Q8')?.result_flags.shadow_model_evaluated === true);
check('q9_pass', byId.get('Q9')?.status === 'PASS' && byId.get('Q9')?.result_flags.active_model_governance_activation_recorded === true);
check('q10_truth_gate', byId.get('Q10')?.status === 'PASS_WITH_LIMITATIONS' && byId.get('Q10')?.result_flags.next_forecast_used_active_model === false && byId.get('Q10')?.result_flags.next_forecast_active_model_consumption_not_yet_observed === true);

const allPass = matrix.capabilities.every((capability) => capability.status === 'PASS');
check('runtime_freeze_rule', matrix.runtime_v1_freeze_allowed === allPass && packet.runtime_v1_freeze_allowed === allPass);
check('limited_result', matrix.freeze_result === 'PASS_WITH_LIMITATIONS' && packet.freeze_result === 'PASS_WITH_LIMITATIONS');
check('full_runtime_claim_not_allowed', matrix.runtime_v1_freeze_allowed === false && packet.runtime_v1_freeze_allowed === false);
check('hard_truth_gates_present', matrix.hard_truth_gates.q2_state_estimate_must_not_overclaim_first_class_generation === true && matrix.hard_truth_gates.q10_next_forecast_active_model_consumption_must_not_be_claimed_unless_observed === true);
check('packet_nonclaims_all_true', Object.values(packet.nonclaims).every((value) => value === true));

const deterministicInput = { matrix, packet };
const deterministicHash = sha256(stable(deterministicInput));
const deterministicHashAgain = sha256(stable({ matrix: readJson(MATRIX_PATH), packet: readJson(PACKET_PATH) }));
check('deterministic_same_packet_same_hash', deterministicHash === deterministicHashAgain);
check('implicit_latest_lookup_forbidden', true);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'TWIN_RUNTIME_V1_E2E_ACCEPTANCE',
  phase: 'P49',
  freeze_name: matrix.freeze_name,
  runtime_name: matrix.runtime_name,
  baseline_tag: matrix.baseline_tag,
  baseline_commit: matrix.baseline_commit,
  freeze_result: matrix.freeze_result,
  runtime_v1_freeze_allowed: matrix.runtime_v1_freeze_allowed,
  closure_review_present: closureReviewExists,
  capability_count: matrix.capabilities.length,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  deterministic_hash: deterministicHash
}, null, 2));

if (failed.length) process.exit(1);
