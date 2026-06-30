// scripts/twin_kernel/P14_07_CALIBRATION_REVIEW_PROMOTION_GATE_V0.cjs
// Purpose: P14 calibration review and future-activation governance gate proof.
// Boundary: no DB write, no server route, no active model assignment, no runtime model registry mutation, no Field Memory, no runtime model update, no recommendation, no AO-ACT, and no dashboard authority.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const CANDIDATE = 'docs/twin_kernel/fixtures/p14_calibration/p14_field_learning_candidate_fixture_v0.json';
const ACCEPT_REVIEW = 'docs/twin_kernel/fixtures/p14_calibration/p14_human_review_accept_fixture_v0.json';
const REJECT_REVIEW = 'docs/twin_kernel/fixtures/p14_calibration/p14_human_review_reject_fixture_v0.json';
const AUTH = 'docs/twin_kernel/fixtures/p14_calibration/p14_promotion_authorization_fixture_v0.json';
const WRONG_CANDIDATE = 'docs/twin_kernel/fixtures/p14_calibration/p14_wrong_candidate_type_fixture_v0.json';
const CHANGED = 'docs/twin_kernel/fixtures/p14_calibration/p14_changed_review_conflict_fixture_v0.json';

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
function has(name) { return process.argv.includes(name); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, rel), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}'; return JSON.stringify(value); }
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function safeStatePath(file) { if (!file) return null; const resolved = path.resolve(file); const tmp = path.resolve(os.tmpdir()); if (!resolved.startsWith(tmp + path.sep) && resolved !== tmp) throw new Error('P14_STATE_FILE_MUST_BE_OS_TEMP'); return resolved; }
function loadState(file) { if (!file || !fs.existsSync(file)) return { reviews: {}, candidate_decisions: {} }; return JSON.parse(fs.readFileSync(file, 'utf8')); }
function saveState(file, state) { if (!file) return; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(state, null, 2)); }
function base(extra) {
  return { schema_version: 'calibration_review_promotion_gate_result_v0', phase: 'P14', run_mode: 'dry_run', write_mode: 'write_disabled', default_data_mode: 'committed_fixture', p13_runner_invoked_by_default: false, raw_samples_required_by_default: false, p8_replay_invoked_by_default: false, p12_adapter_invoked_by_default: false, calibration_candidate_count: 1, calibration_review_packet_created: false, model_version_proposal_created: false, promotion_gate_decision_created: false, governed_model_version_promotion_record_emitted: false, persisted_promotion_record_count: 0, active_model_assignment_created: false, active_model_assignment_count: 0, runtime_model_registry_mutated: false, model_registry_write_count: 0, production_model_activation_allowed: false, runtime_model_update_count: 0, field_memory_write_count: 0, recommendation_created: false, ao_act_task_created: false, dashboard_authority: false, state_file_must_be_os_temp: true, repo_write_allowed: false, db_write_allowed: false, fixture_mutation_allowed: false, server_runtime_surface_changed: false, production_runtime_surface_changed: false, db_surface_changed: false, frontend_surface_changed: false, package_surface_changed: false, ci_surface_changed: false, promotion_is_not_production_model_activation: true, ...extra };
}
function makePacket(candidate) { return { schema_version: 'calibration_review_packet_v0', calibration_candidate_id: candidate.candidate_id, candidate_target_object_type: candidate.candidate_target_object_type, source_runtime_case_id: candidate.source_runtime_case_id, source_runtime_run_id: candidate.source_runtime_run_id, forecast_error_ref: candidate.forecast_error_ref, candidate_hash: candidate.candidate_hash, model_version_set: candidate.model_version_set || [], proposed_adjustment_summary: candidate.proposed_adjustment_summary || null, evidence_refs: candidate.evidence_refs || [], review_required: true }; }
function makeIds(candidate, review, auth) { const review_idempotency_key = 'ridem_' + digest({ candidate_id: candidate.candidate_id, candidate_hash: candidate.candidate_hash, review_decision: review.review_decision, reviewer_ref: review.reviewer_ref, review_policy_version: review.review_policy_version }).slice(0, 48); const review_decision_id = 'crev_' + digest({ review_idempotency_key }).slice(0, 48); const proposal_model_version_id = 'mvp_' + digest({ source_review_decision_id: review_decision_id, candidate_hash: candidate.candidate_hash, proposed_model_version_material: { adjustment: candidate.proposed_adjustment_summary, model_version_set: candidate.model_version_set } }).slice(0, 48); const promotion_record_id = 'mprom_' + digest({ proposal_id: proposal_model_version_id, promotion_authorization_ref: auth ? auth.promotion_authorization_ref : null, promotion_policy_version: auth ? auth.promotion_policy_version : null }).slice(0, 48); return { review_idempotency_key, review_decision_id, proposal_model_version_id, promotion_record_id }; }
function blocked(reason, extra = {}) { return base({ blocked: true, blocked_reason: reason, missing_review_blocked: reason === 'missing_review', missing_authorization_blocked: reason === 'missing_authorization', wrong_candidate_type_blocked: reason === 'wrong_candidate_type', auto_promotion_blocked: reason === 'auto_promotion', ...extra }); }
function runGate(stateFile) {
  const state = loadState(stateFile);
  const candidate = has('--wrong-candidate-type') ? readJson(WRONG_CANDIDATE) : readJson(CANDIDATE);
  if (candidate.candidate_target_object_type !== 'field_learning_candidate_v1') return blocked('wrong_candidate_type');
  if (has('--auto-promotion-request')) return blocked('auto_promotion');
  if (has('--missing-review')) return blocked('missing_review');
  const reviewMode = arg('--review') || 'accepted';
  const changed = has('--changed-review-conflict') ? readJson(CHANGED) : null;
  const review = changed ? { ...readJson(REJECT_REVIEW), review_decision: changed.changed_review_decision, review_reason: changed.changed_review_reason } : readJson(reviewMode === 'rejected' ? REJECT_REVIEW : ACCEPT_REVIEW);
  const auth = has('--promotion-authorized') && !has('--missing-authorization') ? readJson(AUTH) : null;
  const packet = makePacket(candidate);
  const ids = makeIds(candidate, review, auth);
  const existingByCandidate = state.candidate_decisions[candidate.candidate_id];
  if (existingByCandidate && existingByCandidate.review_decision !== review.review_decision) return base({ calibration_review_packet_created: true, same_candidate_changed_review_conflict_requires_review: true, changed_review_does_not_overwrite_existing_decision: true, existing_review_decision_unchanged: true, existing_review_decision: existingByCandidate.review_decision, duplicate_model_version_proposal_created: false, duplicate_promotion_record_created: false, active_model_assignment_created: false, review_decision: review.review_decision, review_idempotency_key: ids.review_idempotency_key });
  if (state.reviews[ids.review_idempotency_key]) return base({ ...state.reviews[ids.review_idempotency_key].result, first_review_created_count: 0, second_review_created_count: 0, same_review_idempotency_key_reused: true, same_model_version_proposal_id_reused: true, same_promotion_record_id_reused: true, duplicate_promotion_record_created_count: 0 });
  if (review.review_decision === 'rejected') { const result = base({ calibration_review_packet_created: true, calibration_review_packet: packet, review_decision: 'rejected', review_idempotency_key: ids.review_idempotency_key, source_calibration_review_decision_id: ids.review_decision_id, model_version_proposal_created: false, promotion_gate_decision_created: false, governed_model_version_promotion_record_emitted: false }); state.reviews[ids.review_idempotency_key] = { result }; state.candidate_decisions[candidate.candidate_id] = { review_decision: 'rejected', review_idempotency_key: ids.review_idempotency_key }; saveState(stateFile, state); return result; }
  if (!auth || auth.promotion_authorization_present !== true) return blocked('missing_authorization', { calibration_review_packet_created: true, review_decision: 'accepted' });
  const result = base({ calibration_review_packet_created: true, calibration_review_packet: packet, review_decision: 'accepted', review_idempotency_key: ids.review_idempotency_key, source_calibration_review_decision_id: ids.review_decision_id, model_version_proposal_created: true, proposal_model_version_id: ids.proposal_model_version_id, promotion_gate_decision_created: true, governed_model_version_promotion_record_emitted: true, promotion_record_id: ids.promotion_record_id, promotion_decision: 'approved_for_future_activation', first_review_created_count: 1, second_review_created_count: 0, same_review_idempotency_key_reused: false, same_model_version_proposal_id_reused: false, same_promotion_record_id_reused: false, duplicate_promotion_record_created_count: 0 });
  state.reviews[ids.review_idempotency_key] = { result };
  state.candidate_decisions[candidate.candidate_id] = { review_decision: 'accepted', review_idempotency_key: ids.review_idempotency_key, proposal_model_version_id: ids.proposal_model_version_id, promotion_record_id: ids.promotion_record_id };
  saveState(stateFile, state);
  return result;
}
function main() { const stateFile = safeStatePath(arg('--state-file')); console.log(JSON.stringify(runGate(stateFile), null, 2)); }
try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exit(1); }
