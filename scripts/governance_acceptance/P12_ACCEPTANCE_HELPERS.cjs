// scripts/governance_acceptance/P12_ACCEPTANCE_HELPERS.cjs
// Purpose: P12 governance acceptance helper.
// Boundary: controlled local adapter proof and static migration/contract checks only; no server route, dashboard, AO-ACT, Field Memory, model update, package, CI, scheduler, or automatic persistence.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const AUTH = 'docs/twin_kernel/fixtures/p12_authorization/p12_authorized_persistence_fixture_v0.json';
const MISSING_AUTH = 'docs/twin_kernel/fixtures/p12_authorization/p12_missing_authorization_fixture_v0.json';
const WRONG_SCOPE_AUTH = 'docs/twin_kernel/fixtures/p12_authorization/p12_wrong_scope_authorization_fixture_v0.json';
const CONFLICT = 'docs/twin_kernel/fixtures/p12_conflict/p12_conflicting_candidate_payload_fixture_v0.json';
const ADAPTER = 'scripts/twin_kernel/P12_07_CONTROLLED_PERSISTENCE_ADAPTER_V0.cjs';
const PRIOR = [
  'scripts/governance_acceptance/P12_00_POST_P11_BASELINE_FREEZE_INHERITANCE_AUDIT.cjs',
  'scripts/governance_acceptance/P12_01_PERSISTENCE_EXECUTION_AUTHORITY_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_02_PERSISTENCE_MIGRATION_V0_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_03_PERSISTED_TWIN_OBJECT_SCHEMA_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_04_AUTHORIZATION_FIXTURE_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_05_IDEMPOTENT_INSERT_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_06_AUDIT_EVENT_WRITE_CONTRACT_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_07_CONTROLLED_PERSISTENCE_ADAPTER_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_08_UNAUTHORIZED_NEGATIVE_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_09_IDEMPOTENCY_REPLAY_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_10_CONFLICT_REQUIRES_REVIEW_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P12_11_SUPERSESSION_RETRACTION_SMOKE_ACCEPTANCE.cjs'
];
const ALLOWED_APPS_SERVER_MIGRATION = 'apps/server/db/migrations/2026_06_30_p12_controlled_twin_object_persistence_v0.sql';
function abs(file) { return path.resolve(ROOT, file); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function exists(file) { return fs.existsSync(abs(file)); }
function runNode(args) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(args.join(' ') + '_FAILED:' + r.stderr);
  return JSON.parse(r.stdout);
}
function stateFile(name) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-p12-')); return path.join(dir, name); }
function assertions() { const list = []; return { list, assert(name, ok, details = {}) { list.push({ name, passed: ok === true, details }); if (ok !== true) { const e = new Error('ASSERTION_FAILED:' + name); e.details = details; throw e; } } }; }
function diffFiles() {
  const r = spawnSync('git', ['diff', '--name-only', 'p11_controlled_persistence_preconditions_runtime_adapter_design_gate...HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return r.status === 0 ? r.stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : [];
}
function checkSurface(assert) {
  const files = diffFiles();
  const bad = files.filter((f) => {
    if (f === ALLOWED_APPS_SERVER_MIGRATION) return false;
    if (f.startsWith('docs/tasks/P12-') || f.startsWith('docs/twin_kernel/') || f.startsWith('scripts/governance_acceptance/P12_') || f === 'scripts/governance_acceptance/P12_ACCEPTANCE_HELPERS.cjs' || f === ADAPTER) return false;
    if (f === 'README_MIGRATION.md') return false;
    return true;
  });
  assert('forbidden_path_diff_count_is_zero', bad.length === 0, { files, bad });
  return { runtime_surface_diff_base: 'p11_controlled_persistence_preconditions_runtime_adapter_design_gate...HEAD', forbidden_path_diff_count: bad.length, runtime_surface_changed: bad.length > 0 };
}
function check00(assert) {
  const tag = spawnSync('git', ['rev-parse', 'p11_controlled_persistence_preconditions_runtime_adapter_design_gate'], { cwd: ROOT, encoding: 'utf8' });
  assert('p11_final_tag_exists', tag.status === 0, {});
  assert('p11_readme_snapshot_present', read('README_MIGRATION.md').includes('P11 Controlled Persistence Preconditions / Runtime Adapter Design Gate Freeze Closure'), {});
  assert('p11_acceptance_exists', exists('scripts/governance_acceptance/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0_ACCEPTANCE.cjs') && exists('scripts/governance_acceptance/P11_10_COMPLETION_REVIEW_ACCEPTANCE.cjs'), {});
  return { baseline_tag: 'p11_controlled_persistence_preconditions_runtime_adapter_design_gate', baseline_commit: '6673ee53' };
}
function check01(assert) { const c = json('docs/twin_kernel/PERSISTENCE_EXECUTION_AUTHORITY_CONTRACT_V0.json'); assert('authority_contract_correct', c.controlled_persistence_execution_allowed === true && c.default_write_allowed === false && c.explicit_human_authorization_required === true && c.operator_review_required === true && c.server_route_allowed === false && c.dashboard_authority === false && c.ao_act_authority === false && c.field_memory_write_allowed === false && c.model_update_allowed === false, { c }); return { controlled_persistence_execution_allowed: true, default_write_allowed: false }; }
function check02(assert) { const m = read(ALLOWED_APPS_SERVER_MIGRATION); for (const table of ['twin_objects', 'twin_object_versions', 'twin_object_source_refs', 'twin_object_audit_events', 'twin_object_idempotency_keys']) assert('migration_declares_' + table, m.includes('CREATE TABLE IF NOT EXISTS ' + table), {}); assert('migration_does_not_mutate_forbidden_tables', !/ALTER\s+TABLE\s+(raw_samples|facts|ao_act|field_memory)/i.test(m) && !/DROP\s+TABLE/i.test(m), {}); return { migration_path: ALLOWED_APPS_SERVER_MIGRATION }; }
function check03(assert) { const c = json('docs/twin_kernel/PERSISTED_TWIN_OBJECT_SCHEMA_CONTRACT_V0.json'); assert('schema_contract_blocks_authority_fields', c.required_tables.length === 5 && c.forbidden_fields.includes('recommendation_id') && c.forbidden_fields.includes('ao_act_task_id') && c.authority_grants.dashboard_authority === false && c.authority_grants.model_update_authority === false, { c }); return { schema_contract_ok: true }; }
function check04(assert) { const c = json('docs/twin_kernel/AUTHORIZED_PERSISTENCE_FIXTURE_CONTRACT_V0.json'); const a = json(AUTH); const m = json(MISSING_AUTH); const w = json(WRONG_SCOPE_AUTH); assert('auth_contract_and_fixtures_valid', c.acceptance_pass_is_authorization === false && c.dashboard_view_is_authorization === false && a.human_authorization_present === true && a.persistence_execution_allowed === true && a.authorization_scope.allowed_candidate_ids.length === 7 && m.human_authorization_present === false && w.authorization_scope.case_id === 'wrong_case', { c, a, m, w }); return { authorized_candidate_count: 7 }; }
function check05(assert) { const c = json('docs/twin_kernel/IDEMPOTENT_INSERT_CONTRACT_V0.json'); assert('idempotent_insert_contract_valid', c.rules.same_identity_same_payload_hash === 'duplicate_same_object' && c.rules.same_identity_different_payload_hash === 'conflict_requires_review' && c.silent_overwrite_allowed === false && c.duplicate_object_creation_allowed === false && c.conflict_write_allowed === false, { c }); return { idempotent_insert_contract_ok: true }; }
function check06(assert) { const c = json('docs/twin_kernel/AUDIT_EVENT_WRITE_CONTRACT_V0.json'); assert('audit_write_contract_valid', c.successful_persistence_audit_event_required === true && c.blocked_decision_audit_required === true && c.conflict_decision_audit_required === true && c.required_fields.includes('authorization_ref') && c.required_fields.includes('operator_review_ref') && c.required_fields.includes('idempotency_key'), { c }); return { audit_event_write_contract_ok: true }; }
function check07(assert) { const state = stateFile('state.json'); const r = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', AUTH, '--state-file', state]); assert('authorized_adapter_materializes_seven', r.schema_version === 'controlled_persistence_result_v0' && r.candidate_count === 7 && r.authorized_candidate_count === 7 && r.persisted_object_count === 7 && r.created_object_count === 7 && r.created_version_count === 7 && r.source_ref_count >= 7 && r.audit_event_count >= 7 && r.idempotency_key_count === 7 && r.dashboard_authority === false && r.recommendation_created === false && r.ao_act_task_created === false && r.field_memory_write_count === 0 && r.model_update_count === 0, { r }); return r; }
function check08(assert) { const s1 = stateFile('missing.json'); const missing = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', MISSING_AUTH, '--state-file', s1]); const s2 = stateFile('wrong.json'); const wrong = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', WRONG_SCOPE_AUTH, '--state-file', s2]); assert('unauthorized_and_wrong_scope_blocked', missing.write_count === 0 && missing.persisted_object_count === 0 && missing.blocked_reason === 'missing_human_authorization' && wrong.write_count === 0 && wrong.persisted_object_count === 0 && wrong.blocked_reason === 'authorization_scope_mismatch', { missing, wrong }); return { unauthorized_write_blocked: true, wrong_scope_write_blocked: true }; }
function check09(assert) { const state = stateFile('idem.json'); const first = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', AUTH, '--state-file', state]); const second = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', AUTH, '--state-file', state]); assert('idempotency_replay_valid', first.created_object_count === 7 && second.created_object_count === 0 && second.duplicate_same_object_count === 7 && second.persisted_object_count === 7 && second.idempotency_key_count === 7 && second.conflict_requires_review_count === 0, { first, second }); return { first_run_created_object_count: first.created_object_count, second_run_created_object_count: second.created_object_count, second_run_duplicate_same_object_count: second.duplicate_same_object_count, total_object_count_after_second_run: second.persisted_object_count, total_idempotency_key_count_after_second_run: second.idempotency_key_count }; }
function check10(assert) { const state = stateFile('conflict.json'); const first = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', AUTH, '--state-file', state]); const conflict = runNode([ADAPTER, '--execute-authorized', '--authorization-fixture', AUTH, '--state-file', state, '--conflict-fixture', CONFLICT]); assert('conflict_requires_review_valid', first.created_object_count === 7 && conflict.conflict_requires_review_count === 1 && conflict.created_object_count === 0 && conflict.created_version_count === 0 && conflict.silent_overwrite === false, { first, conflict }); return { conflict_requires_review: true, created_object_count: conflict.created_object_count, created_version_count: conflict.created_version_count, silent_overwrite: false }; }
function check11(assert) { const c = json('docs/twin_kernel/SUPERSESSION_RETRACTION_SMOKE_CONTRACT_V0.json'); const m = read(ALLOWED_APPS_SERVER_MIGRATION); assert('supersession_retraction_smoke_valid', c.hard_delete_allowed === false && c.silent_overwrite_allowed === false && c.supported_lifecycle_states.includes('active') && c.supported_lifecycle_states.includes('superseded') && c.supported_lifecycle_states.includes('retracted') && c.supersession_event_requires_audit === true && c.retraction_event_requires_audit === true && m.includes("lifecycle_state IN ('active', 'superseded', 'retracted')"), { c }); return { rollback_or_supersession_policy_enforced: true }; }
function runScript(file) { const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); let parsed = null; try { parsed = JSON.parse(r.stdout || r.stderr); } catch {} return { script: file, status: r.status, ok: r.status === 0 && parsed && parsed.ok === true && parsed.failed_assertion_count === 0, parsed }; }
function check12(assert) { const prior = PRIOR.map(runScript); assert('all_prior_p12_acceptance_passed', prior.every((r) => r.ok), { prior }); const review = json('docs/twin_kernel/P12_CONTROLLED_PERSISTENCE_ADAPTER_COMPLETION_REVIEW_V0.json'); assert('completion_review_contract_matches', review.completion_scope.authorized_persistence_passed === true && review.completion_scope.unauthorized_blocked === true && review.completion_scope.idempotency_replay_passed === true && review.completion_scope.conflict_requires_review_passed === true && review.completion_scope.persisted_object_count === 7 && review.completion_scope.duplicate_second_run_created_count === 0 && review.completion_scope.dashboard_authority === false && review.completion_scope.recommendation_created === false && review.completion_scope.ao_act_task_created === false && review.completion_scope.field_memory_write_count === 0 && review.completion_scope.model_update_count === 0, { review }); return { all_prior_p12_acceptance_passed: true, authorized_persistence_passed: true, unauthorized_blocked: true, idempotency_replay_passed: true, conflict_requires_review_passed: true, persisted_object_count: 7, duplicate_second_run_created_count: 0, dashboard_authority: false, recommendation_created: false, ao_act_task_created: false, field_memory_write_count: 0, model_update_count: 0, readme_p12_snapshot_present: read('README_MIGRATION.md').includes('P12 Controlled Persistence Adapter v0 / Human-Gated Twin Object Materialization Freeze Closure') }; }
function run(name) { const a = assertions(); const map = { P12_00_POST_P11_BASELINE_FREEZE_INHERITANCE_AUDIT: check00, P12_01_PERSISTENCE_EXECUTION_AUTHORITY_CONTRACT_ACCEPTANCE: check01, P12_02_PERSISTENCE_MIGRATION_V0_ACCEPTANCE: check02, P12_03_PERSISTED_TWIN_OBJECT_SCHEMA_CONTRACT_ACCEPTANCE: check03, P12_04_AUTHORIZATION_FIXTURE_CONTRACT_ACCEPTANCE: check04, P12_05_IDEMPOTENT_INSERT_CONTRACT_ACCEPTANCE: check05, P12_06_AUDIT_EVENT_WRITE_CONTRACT_ACCEPTANCE: check06, P12_07_CONTROLLED_PERSISTENCE_ADAPTER_ACCEPTANCE: check07, P12_08_UNAUTHORIZED_NEGATIVE_ACCEPTANCE: check08, P12_09_IDEMPOTENCY_REPLAY_ACCEPTANCE: check09, P12_10_CONFLICT_REQUIRES_REVIEW_ACCEPTANCE: check10, P12_11_SUPERSESSION_RETRACTION_SMOKE_ACCEPTANCE: check11, P12_12_COMPLETION_REVIEW_ACCEPTANCE: check12 }; try { a.assert('known_acceptance_entrypoint', typeof map[name] === 'function', { name }); const result = map[name](a.assert); const surface = checkSurface(a.assert); const failed = a.list.filter((x) => !x.passed); console.log(JSON.stringify({ ok: true, acceptance: name, ...result, ...surface, assertion_count: a.list.length, failed_assertion_count: failed.length, failed_assertions: failed.map((x) => x.name) }, null, 2)); } catch (error) { console.error(JSON.stringify({ ok: false, acceptance: name, error: error.message, details: error.details || null, assertions: a.list }, null, 2)); process.exit(1); } }
module.exports = { run };
