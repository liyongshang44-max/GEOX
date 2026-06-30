// scripts/twin_kernel/P12_07_CONTROLLED_PERSISTENCE_ADAPTER_V0.cjs
// Purpose: controlled P12 persistence adapter proof with explicit human authorization.
// Boundary: no server route, dashboard authority, AO-ACT, Field Memory, model update, recommendation, dispatch, receipt, scheduler, or automatic persistence.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const DEFAULT_AUTH = 'docs/twin_kernel/fixtures/p12_authorization/p12_authorized_persistence_fixture_v0.json';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function has(name) { return process.argv.includes(name); }
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8')); }
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function runJson(script) {
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(script + '_FAILED:' + r.stderr);
  return JSON.parse(r.stdout);
}
function loadState(file) {
  if (!file || !fs.existsSync(file)) return { objects: {}, versions: {}, sourceRefs: {}, auditEvents: {}, idempotencyKeys: {} };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}
function validateAuthorization(auth, report) {
  if (!auth || auth.human_authorization_present !== true || auth.persistence_execution_allowed !== true) return { ok: false, reason: 'missing_human_authorization' };
  if (!auth.authorization_ref || !auth.operator_review_ref || !auth.actor || !auth.authorization_scope) return { ok: false, reason: 'missing_human_authorization' };
  const scope = auth.authorization_scope;
  const ids = report.reviews.map((r) => r.candidate_id).sort();
  const allowed = Array.isArray(scope.allowed_candidate_ids) ? [...scope.allowed_candidate_ids].sort() : [];
  if (scope.case_id !== report.case_id) return { ok: false, reason: 'authorization_scope_mismatch' };
  if (scope.candidate_bundle_schema_version !== report.source_bundle_schema_version) return { ok: false, reason: 'authorization_scope_mismatch' };
  if (scope.preflight_report_schema_version !== report.schema_version) return { ok: false, reason: 'authorization_scope_mismatch' };
  if (JSON.stringify(ids) !== JSON.stringify(allowed)) return { ok: false, reason: 'authorization_scope_mismatch' };
  if (auth.dashboard_authority_granted === true || auth.ao_act_authority_granted === true || auth.model_update_authority_granted === true) return { ok: false, reason: 'authorization_scope_mismatch' };
  return { ok: true, reason: null };
}
function blockedResult(reason, report) {
  return {
    schema_version: 'controlled_persistence_result_v0',
    case_id: report.case_id,
    mode: 'blocked',
    candidate_count: report.candidate_count,
    authorized_candidate_count: 0,
    persisted_object_count: 0,
    created_object_count: 0,
    created_version_count: 0,
    source_ref_count: 0,
    audit_event_count: 1,
    idempotency_key_count: 0,
    duplicate_same_object_count: 0,
    conflict_requires_review_count: 0,
    write_count: 0,
    db_write_count: 0,
    fact_write_count: 0,
    field_memory_write_count: 0,
    model_update_count: 0,
    ao_act_task_created: false,
    recommendation_created: false,
    dashboard_authority: false,
    unauthorized_write_blocked: true,
    blocked_reason: reason,
    results: []
  };
}
function buildCandidateIndex(bundle) {
  const map = new Map();
  for (const c of bundle.candidates || []) map.set(c.candidate_id, c);
  return map;
}
function materialize(report, bundle, auth, stateFile, conflictFixture) {
  const candidateById = buildCandidateIndex(bundle);
  const state = loadState(stateFile);
  let createdObjectCount = 0;
  let createdVersionCount = 0;
  let duplicateSameObjectCount = 0;
  let conflictRequiresReviewCount = 0;
  let sourceRefCreatedCount = 0;
  let auditEventCount = 0;
  const results = [];

  for (const review of report.reviews) {
    const candidate = candidateById.get(review.candidate_id) || {};
    const identityKey = review.future_object_identity_key;
    let payloadHash = review.candidate_payload_canonical_hash;
    let idempotencyKey = review.future_idempotency_key;
    if (conflictFixture && conflictFixture.source_candidate_id === review.candidate_id) {
      payloadHash = conflictFixture.conflicting_payload_hash;
      idempotencyKey = 'idem_' + digest({ identityKey, payloadHash, policy_version: 'idempotent_insert_contract_v0' }).slice(0, 48);
    }
    const objectId = 'tobj_' + digest(identityKey).slice(0, 48);
    const versionId = 'tobjv_' + digest({ identityKey, payloadHash }).slice(0, 48);
    const existingObjectId = state.objects[identityKey];
    if (existingObjectId) {
      const existing = state.versions[state.objects[identityKey].current_version_id];
      if (existing && existing.payload_hash === payloadHash) {
        duplicateSameObjectCount += 1;
        results.push({ candidate_id: review.candidate_id, decision: 'duplicate_same_object', object_id: existingObjectId.object_id, version_id: existing.version_id });
        continue;
      }
      conflictRequiresReviewCount += 1;
      auditEventCount += 1;
      results.push({ candidate_id: review.candidate_id, decision: 'conflict_requires_review', object_id: existingObjectId.object_id, write_blocked: true, silent_overwrite: false });
      continue;
    }
    const auditEventId = 'taudit_' + digest({ objectId, versionId, idempotencyKey, decision: 'persisted' }).slice(0, 48);
    const sourceRefId = 'tsrc_' + digest({ objectId, versionId, candidate_id: review.candidate_id }).slice(0, 48);
    state.objects[identityKey] = {
      object_id: objectId,
      object_type: review.candidate_target_object_type,
      object_identity_key: identityKey,
      current_version_id: versionId,
      lifecycle_state: 'active',
      created_by: auth.actor,
      authorization_ref: auth.authorization_ref,
      operator_review_ref: auth.operator_review_ref,
      policy_version: 'p12_controlled_persistence_adapter_v0',
      source_candidate_id: review.candidate_id,
      source_case_id: report.case_id
    };
    state.versions[versionId] = {
      version_id: versionId,
      object_id: objectId,
      payload_hash: payloadHash,
      payload_json: candidate.candidate_payload || {},
      schema_version: candidate.schema_version || 'candidate_twin_object_envelope_v0',
      created_by: auth.actor,
      audit_event_id: auditEventId
    };
    state.sourceRefs[sourceRefId] = {
      source_ref_id: sourceRefId,
      object_id: objectId,
      version_id: versionId,
      source_candidate_id: review.candidate_id,
      source_artifact_kind: candidate.source_artifact_kind || 'unknown_source_artifact_kind',
      source_line_id: candidate.source_line_id || 'offline_real_evidence_replay_kernel',
      target_line_id: candidate.target_line_id || 'server_persisted_twin_kernel',
      case_id: report.case_id,
      evidence_refs_json: candidate.evidence_refs || []
    };
    state.idempotencyKeys[idempotencyKey] = {
      idempotency_key: idempotencyKey,
      object_identity_key: identityKey,
      payload_hash: payloadHash,
      object_id: objectId,
      version_id: versionId,
      status: 'created'
    };
    state.auditEvents[auditEventId] = {
      audit_event_id: auditEventId,
      event_type: 'controlled_persistence_authorized_v0',
      decision: 'persisted',
      object_id: objectId,
      version_id: versionId,
      source_candidate_id: review.candidate_id,
      future_object_identity_key: identityKey,
      idempotency_key: idempotencyKey,
      actor: auth.actor,
      authorization_ref: auth.authorization_ref,
      operator_review_ref: auth.operator_review_ref,
      policy_version: 'p12_controlled_persistence_adapter_v0',
      blocked_reason: null,
      source_evidence_refs_json: candidate.evidence_refs || []
    };
    createdObjectCount += 1;
    createdVersionCount += 1;
    sourceRefCreatedCount += 1;
    auditEventCount += 1;
    results.push({ candidate_id: review.candidate_id, decision: 'created', object_id: objectId, version_id: versionId });
  }
  saveState(stateFile, state);
  return {
    schema_version: 'controlled_persistence_result_v0',
    case_id: report.case_id,
    mode: 'execute_authorized',
    candidate_count: report.candidate_count,
    authorized_candidate_count: report.candidate_count,
    persisted_object_count: Object.keys(state.objects).length,
    created_object_count: createdObjectCount,
    created_version_count: createdVersionCount,
    source_ref_count: Object.keys(state.sourceRefs).length,
    audit_event_count: auditEventCount,
    idempotency_key_count: Object.keys(state.idempotencyKeys).length,
    duplicate_same_object_count: duplicateSameObjectCount,
    conflict_requires_review_count: conflictRequiresReviewCount,
    write_count: createdObjectCount + createdVersionCount + sourceRefCreatedCount + auditEventCount + createdObjectCount,
    db_write_count: createdObjectCount + createdVersionCount + sourceRefCreatedCount + auditEventCount + createdObjectCount,
    fact_write_count: 0,
    field_memory_write_count: 0,
    model_update_count: 0,
    ao_act_task_created: false,
    recommendation_created: false,
    dashboard_authority: false,
    unauthorized_write_blocked: false,
    conflict_requires_review: conflictRequiresReviewCount > 0,
    silent_overwrite: false,
    results
  };
}
function dryRun(report) {
  return {
    schema_version: 'controlled_persistence_result_v0',
    case_id: report.case_id,
    mode: 'dry_run',
    candidate_count: report.candidate_count,
    authorized_candidate_count: 0,
    persisted_object_count: 0,
    created_object_count: 0,
    write_count: 0,
    db_write_count: 0,
    fact_write_count: 0,
    field_memory_write_count: 0,
    model_update_count: 0,
    ao_act_task_created: false,
    recommendation_created: false,
    dashboard_authority: false,
    results: []
  };
}
function main() {
  const report = runJson('scripts/twin_kernel/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0.cjs');
  const bundle = runJson('scripts/twin_kernel/P10_07_READ_ONLY_RECONCILIATION_ADAPTER_PROOF_V0.cjs');
  if (!has('--execute-authorized') && !has('--verify-idempotency')) {
    console.log(JSON.stringify(dryRun(report), null, 2));
    return;
  }
  const authPath = arg('--authorization-fixture') || DEFAULT_AUTH;
  const auth = readJson(authPath);
  const validation = validateAuthorization(auth, report);
  if (!validation.ok) {
    console.log(JSON.stringify(blockedResult(validation.reason, report), null, 2));
    return;
  }
  const stateFile = arg('--state-file') || path.join(os.tmpdir(), 'geox_p12_controlled_persistence_state.json');
  if (has('--verify-idempotency')) {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    const first = materialize(report, bundle, auth, stateFile, null);
    const second = materialize(report, bundle, auth, stateFile, null);
    console.log(JSON.stringify({ schema_version: 'controlled_persistence_idempotency_replay_result_v0', first_run: first, second_run: second }, null, 2));
    return;
  }
  const conflictPath = arg('--conflict-fixture');
  const conflictFixture = conflictPath ? readJson(conflictPath) : null;
  console.log(JSON.stringify(materialize(report, bundle, auth, stateFile, conflictFixture), null, 2));
}

try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exit(1); }
