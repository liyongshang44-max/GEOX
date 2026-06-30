// scripts/twin_kernel/P11_09_PERSISTENCE_PREFLIGHT_PROOF_V0.cjs
// Purpose: create a read-only persistence preflight report from the P10 candidate bundle.
// Boundary: stdout-only proof; no DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, server, frontend, package, CI, or persisted object write.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function runP10Bundle() {
  const result = spawnSync(process.execPath, ['scripts/twin_kernel/P10_07_READ_ONLY_RECONCILIATION_ADAPTER_PROOF_V0.cjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) throw new Error('P10_BUNDLE_FAILED:' + result.stderr);
  return JSON.parse(result.stdout);
}

function main() {
  const persistencePolicy = readJson('docs/twin_kernel/PERSISTENCE_POLICY_V1.json');
  const identityPolicy = readJson('docs/twin_kernel/OBJECT_IDENTITY_POLICY_V1.json');
  const idempotencyPolicy = readJson('docs/twin_kernel/IDEMPOTENCY_POLICY_V1.json');
  const authorizationGate = readJson('docs/twin_kernel/OPERATOR_REVIEW_HUMAN_AUTHORIZATION_GATE_V1.json');
  const bundle = runP10Bundle();
  const reviews = bundle.candidates.map((candidate) => {
    const payloadHash = hash(candidate.candidate_payload);
    const sourceTimeWindow = candidate.candidate_payload.window || candidate.candidate_payload.forecast_points_json || candidate.candidate_payload.observed_payload || null;
    const identityMaterial = {
      schema_version: candidate.schema_version,
      candidate_target_object_type: candidate.candidate_target_object_type,
      source_line_id: candidate.source_line_id,
      target_line_id: candidate.target_line_id,
      case_id: bundle.case_id,
      source_artifact_kind: candidate.source_artifact_kind,
      source_time_window: sourceTimeWindow,
      model_version_refs: candidate.model_version_refs || [],
      candidate_payload_canonical_hash: payloadHash
    };
    const futureObjectIdentityKey = identityPolicy.identity_key_prefix + hash(identityMaterial).slice(0, 48);
    const futureIdempotencyKey = idempotencyPolicy.idempotency_key_prefix + hash({ futureObjectIdentityKey, payloadHash, policy_version: idempotencyPolicy.schema_version }).slice(0, 48);
    const covered = persistencePolicy.allowed_candidate_target_object_types.includes(candidate.candidate_target_object_type);
    return {
      candidate_id: candidate.candidate_id,
      candidate_target_object_type: candidate.candidate_target_object_type,
      future_object_identity_key: futureObjectIdentityKey,
      future_idempotency_key: futureIdempotencyKey,
      candidate_payload_canonical_hash: payloadHash,
      policy_coverage_status: covered ? 'covered' : 'not_covered',
      operator_review_required: authorizationGate.operator_review_required,
      human_authorization_required: authorizationGate.human_authorization_required,
      human_authorization_present: false,
      persistence_preflight_status: 'blocked_no_human_authorization',
      persistence_execution_allowed: false,
      persisted_target_object_ref: null,
      write_allowed: false
    };
  });

  const report = {
    schema_version: 'persistence_preflight_report_v0',
    case_id: bundle.case_id,
    source_bundle_schema_version: bundle.schema_version,
    candidate_count: reviews.length,
    policy_coverage_count: reviews.filter((item) => item.policy_coverage_status === 'covered').length,
    future_object_identity_key_count: new Set(reviews.map((item) => item.future_object_identity_key)).size,
    future_idempotency_key_count: new Set(reviews.map((item) => item.future_idempotency_key)).size,
    persistence_execution_allowed: false,
    implementation_readiness_status: 'blocked_until_P12',
    persisted_object_count: 0,
    persistence_intent_created: false,
    write_count: 0,
    db_write_count: 0,
    fact_write_count: 0,
    audit_write_count: 0,
    field_memory_write_count: 0,
    model_update_count: 0,
    ao_act_task_count: 0,
    reviews
  };
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
