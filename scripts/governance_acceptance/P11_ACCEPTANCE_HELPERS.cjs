// scripts/governance_acceptance/P11_ACCEPTANCE_HELPERS.cjs
// Purpose: shared read-only P11 governance acceptance logic.
// Boundary: file-system, git-diff, and stdout proof checks only; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, server, frontend, package, CI, or persisted object mutation.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const FORBIDDEN = ['apps/', 'packages/', 'db/', 'prisma/', 'migrations/', 'seeds/', 'docker/', '.github/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const PRIOR = [
  'scripts/governance_acceptance/P11_00_POST_P10_BASELINE_FREEZE_INHERITANCE_AUDIT.cjs',
  'scripts/governance_acceptance/P11_01_PERSISTENCE_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_02_OBJECT_IDENTITY_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_03_IDEMPOTENCY_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_04_PERSISTENCE_SCHEMA_PROPOSAL_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_05_AUDIT_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_06_ROLLBACK_SUPERSESSION_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_07_OPERATOR_REVIEW_HUMAN_AUTHORIZATION_GATE_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_08_READ_MODEL_PROJECTION_POLICY_V1_ACCEPTANCE.cjs',
  'scripts/governance_acceptance/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0_ACCEPTANCE.cjs'
];
function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function assertState() {
  const assertions = [];
  function assert(name, ok, details = {}) {
    assertions.push({ name, passed: ok === true, details });
    if (ok !== true) { const e = new Error('ASSERTION_FAILED:' + name); e.details = details; throw e; }
  }
  return { assertions, assert };
}
function diff() {
  for (const spec of ['p10_runtime_reconciliation_read_only_adapter_proof...HEAD', 'origin/main...HEAD', 'main...HEAD']) {
    const r = spawnSync('git', ['diff', '--name-only', spec], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.status === 0) return { available: true, base_spec: spec, files: r.stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) };
  }
  return { available: false, base_spec: null, files: [] };
}
function verifySurface(assert) {
  const d = diff();
  const hits = d.files.filter((file) => FORBIDDEN.some((prefix) => file === prefix || file.startsWith(prefix)));
  assert('runtime_surface_forbidden_path_diff_is_zero', hits.length === 0, { diff: d, hits });
  return { runtime_surface_changed: hits.length > 0, runtime_surface_diff_checked: d.available, runtime_surface_diff_base: d.base_spec, forbidden_path_diff_count: hits.length };
}
function runScript(file) {
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let parsed = null;
  try { parsed = JSON.parse((r.stdout || r.stderr || '').trim()); } catch {}
  return { file, status: r.status, parsed, stdout: r.stdout, stderr: r.stderr, ok: r.status === 0 && parsed && parsed.ok === true && parsed.failed_assertion_count === 0 };
}
function runProof() {
  const r = spawnSync(process.execPath, ['scripts/twin_kernel/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0.cjs'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error('P11_PREFLIGHT_PROOF_FAILED:' + r.stderr);
  return JSON.parse(r.stdout);
}
function check00(assert) {
  assert('p10_final_tag_resolves', spawnSync('git', ['rev-parse', 'p10_runtime_reconciliation_read_only_adapter_proof'], { cwd: ROOT, encoding: 'utf8' }).status === 0, {});
  assert('p10_final_readme_snapshot_present', read('README_MIGRATION.md').includes('P10-10 Runtime Reconciliation Read-Only Adapter Proof Freeze Closure'), {});
  assert('p10_acceptance_exists', exists('scripts/governance_acceptance/P10_07_READ_ONLY_DRY_RUN_ADAPTER_PROOF_V0_ACCEPTANCE.cjs') && exists('scripts/governance_acceptance/P10_09_RUNTIME_RECONCILIATION_COMPLETION_REVIEW_ACCEPTANCE.cjs'), {});
  return { baseline_tag: 'p10_runtime_reconciliation_read_only_adapter_proof', baseline_commit: '38e1ea82' };
}
function check01(assert) { const p = json('docs/twin_kernel/PERSISTENCE_POLICY_V1.json'); assert('persistence_policy_design_only', p.schema_version === 'persistence_policy_v1' && p.persistence_policy_status === 'design_only' && p.persistence_execution_allowed === false && p.automatic_persistence_allowed === false && p.human_authorization_required === true && p.operator_review_required === true && p.db_write_allowed_by_p11 === false && p.allowed_candidate_target_object_types.length === 6, { p }); return { persistence_execution_allowed: false }; }
function check02(assert) { const p = json('docs/twin_kernel/OBJECT_IDENTITY_POLICY_V1.json'); assert('identity_policy_deterministic_future_only', p.deterministic_identity_required === true && p.future_identity_only === true && p.creates_persisted_object_id === false && p.identity_key_prefix === 'objkey_' && p.forbidden_identity_inputs.includes('random_uuid'), { p }); return { future_identity_only: true }; }
function check03(assert) { const p = json('docs/twin_kernel/IDEMPOTENCY_POLICY_V1.json'); assert('idempotency_policy_future_only', p.future_idempotency_only === true && p.deduplication_write_allowed === false && p.idempotency_key_prefix === 'idem_' && p.rules.same_identity_different_payload_hash === 'conflict_requires_review', { p }); return { future_idempotency_only: true }; }
function check04(assert) { const p = json('docs/twin_kernel/PERSISTENCE_SCHEMA_PROPOSAL_V1.json'); assert('schema_proposal_no_migration', p.proposal_only === true && p.migration_created === false && p.table_created === false && p.db_write_allowed === false && p.implementation_blocked_until_P12 === true && p.future_table_family.length === 5, { p }); return { migration_created: false, table_created: false }; }
function check05(assert) { const p = json('docs/twin_kernel/AUDIT_POLICY_V1.json'); assert('audit_policy_no_write', p.future_audit_required === true && p.audit_write_allowed_by_p11 === false && p.required_future_audit_fields.includes('authorization_ref') && p.required_future_audit_fields.includes('blocked_reason'), { p }); return { audit_write_allowed_by_p11: false }; }
function check06(assert) { const p = json('docs/twin_kernel/ROLLBACK_SUPERSESSION_POLICY_V1.json'); assert('rollback_policy_append_only', p.append_only_required === true && p.hard_delete_allowed === false && p.silent_overwrite_allowed === false && p.rollback_must_be_audited === true && p.p11_uses_state_machine === false, { p }); return { append_only_required: true }; }
function check07(assert) { const p = json('docs/twin_kernel/OPERATOR_REVIEW_HUMAN_AUTHORIZATION_GATE_V1.json'); assert('authorization_gate_explicit', p.operator_review_required === true && p.human_authorization_required === true && p.authorization_must_be_explicit === true && p.authorization_cannot_be_inferred_from_dashboard_view === true && p.authorization_cannot_be_inferred_from_acceptance_pass === true && p.automatic_human_authorization_allowed === false, { p }); return { human_authorization_required: true }; }
function check08(assert) { const p = json('docs/twin_kernel/READ_MODEL_PROJECTION_POLICY_V1.json'); assert('projection_not_authority', p.persisted_object_is_dashboard_authority === false && p.read_model_projection_is_recommendation === false && p.read_model_projection_is_ao_act_task === false && p.read_model_projection_is_dispatch === false && p.projection_must_preserve_uncertainty === true && p.projection_must_preserve_provenance === true, { p }); return { read_model_projection_is_recommendation: false }; }
function check09(assert) { const report = runProof(); assert('preflight_report_passes', report.schema_version === 'persistence_preflight_report_v0' && report.candidate_count === 7 && report.policy_coverage_count === 7 && report.future_object_identity_key_count === 7 && report.future_idempotency_key_count === 7 && report.persistence_execution_allowed === false && report.implementation_readiness_status === 'blocked_until_P12' && report.persisted_object_count === 0 && report.write_count === 0 && report.db_write_count === 0 && report.fact_write_count === 0 && report.audit_write_count === 0 && report.field_memory_write_count === 0 && report.model_update_count === 0 && report.ao_act_task_count === 0, { report }); assert('all_reviews_blocked_no_authorization', report.reviews.every((r) => r.policy_coverage_status === 'covered' && r.persistence_preflight_status === 'blocked_no_human_authorization' && r.persistence_execution_allowed === false && r.persisted_target_object_ref === null && r.write_allowed === false), { reviews: report.reviews }); return report; }
function check10(assert) { const review = json('docs/twin_kernel/P11_CONTROLLED_PERSISTENCE_PRECONDITIONS_COMPLETION_REVIEW_V0.json'); const prior = PRIOR.map(runScript); assert('prior_p11_acceptance_passed', prior.every((r) => r.ok), { prior }); const report = runProof(); assert('completion_review_matches_preflight', review.completion_scope.policy_coverage_count === report.policy_coverage_count && review.completion_scope.candidate_count === report.candidate_count && review.completion_scope.persistence_execution_allowed === false && review.completion_scope.persisted_object_count === 0 && review.completion_scope.implementation_readiness_status === 'blocked_until_P12', { review, report }); return { all_prior_p11_acceptance_passed: true, policy_coverage_count: report.policy_coverage_count, candidate_count: report.candidate_count, persistence_execution_allowed: false, persisted_object_count: 0, implementation_readiness_status: 'blocked_until_P12' }; }
function run(acceptance) {
  const state = assertState();
  const map = { P11_00_POST_P10_BASELINE_FREEZE_INHERITANCE_AUDIT: check00, P11_01_PERSISTENCE_POLICY_V1_ACCEPTANCE: check01, P11_02_OBJECT_IDENTITY_POLICY_V1_ACCEPTANCE: check02, P11_03_IDEMPOTENCY_POLICY_V1_ACCEPTANCE: check03, P11_04_PERSISTENCE_SCHEMA_PROPOSAL_V1_ACCEPTANCE: check04, P11_05_AUDIT_POLICY_V1_ACCEPTANCE: check05, P11_06_ROLLBACK_SUPERSESSION_POLICY_V1_ACCEPTANCE: check06, P11_07_OPERATOR_REVIEW_HUMAN_AUTHORIZATION_GATE_V1_ACCEPTANCE: check07, P11_08_READ_MODEL_PROJECTION_POLICY_V1_ACCEPTANCE: check08, P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0_ACCEPTANCE: check09, P11_10_COMPLETION_REVIEW_ACCEPTANCE: check10 };
  try {
    state.assert('known_acceptance_entrypoint', typeof map[acceptance] === 'function', { acceptance });
    const result = map[acceptance](state.assert);
    const surface = verifySurface(state.assert);
    const failed = state.assertions.filter((x) => !x.passed);
    console.log(JSON.stringify({ ok: true, acceptance, ...result, ...surface, assertion_count: state.assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((x) => x.name) }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, acceptance, error: error.message, details: error.details || null, assertions: state.assertions }, null, 2));
    process.exit(1);
  }
}
module.exports = { run };
