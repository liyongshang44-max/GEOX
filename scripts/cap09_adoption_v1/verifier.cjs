'use strict';
// Read-only offline verifier. No private key, signer, child process, network or Git.
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const c = require('./contract.cjs');
const qualified = new WeakSet();
function validateQualificationPayload(q, policy, materials, now = Date.now()) {
  c.validatePolicy(policy, now);
  c.exact(q, ['qualification_id','schema_version','qualification_contract_version','subject_commit_sha',
    ...c.MATERIALS.map(k => k + '_digest'),'check_manifest','valid_for','issued_at','expires_at',
    'material_invalidation_policy','issuer_identity','signature_algorithm','signer_key_id','policy_digest']);
  assert.equal(q.schema_version, c.VERSION); assert.equal(q.qualification_contract_version, c.VERSION);
  c.id(q.qualification_id); assert.deepEqual(q.valid_for, ['SYNTHETIC_ONLY'], 'REAL_SCOPE_FORBIDDEN');
  assert.equal(q.material_invalidation_policy, 'EXACT_MATERIAL_AND_POLICY_V1');
  assert.equal(q.subject_commit_sha, policy.subject_commit_sha, 'QUALIFICATION_NOT_APPLICABLE');
  assert.equal(q.policy_digest, c.digest(policy), 'POLICY_CHANGED');
  c.window(q, now, policy.max_qualification_ms);
  c.validateChecks(q.check_manifest, policy);
  const actual = c.materialSet(materials);
  for (const [key, value] of Object.entries(actual)) { c.hash(q[key]); assert.equal(q[key], value, 'MATERIAL_DRIFT:' + key); }
  return q;
}
function validateQualification(envelope, policy, materials, now = Date.now()) {
  const q = validateQualificationPayload(envelope.payload, policy, materials, now);
  c.verifyEnvelope(envelope, 'qualification', policy, now);
  return q;
}
function admit({qualification, permit, policy, materials, evidence, context, now = Date.now()}) {
  const started = performance.now();
  const q = validateQualification(qualification, policy, materials, now);
  c.validateChecks(q.check_manifest, policy, evidence);
  c.exact(context, ['host_id','operator_id','run_id','stage','mode','config','observed_at','plan_digest']);
  c.exact(context.config, ['principal','database_endpoint','bucket','acl_digest','environment_digest']);
  for (const k of ['principal','database_endpoint','bucket']) assert(typeof context.config[k] === 'string' && context.config[k].length > 0, 'CONFIG_REQUIRED');
  for (const k of ['acl_digest','environment_digest']) c.hash(context.config[k]);
  assert.equal(context.host_id, policy.host_id, 'HOST_MISMATCH'); assert.equal(context.operator_id, policy.operator_id, 'OPERATOR_MISMATCH');
  assert.equal(context.mode, 'SYNTHETIC_ONLY', 'REAL_SCOPE_FORBIDDEN'); assert.equal(context.stage, 'NO_EFFECT', 'REAL_STAGE_FORBIDDEN');
  c.id(context.run_id); c.hash(context.plan_digest);
  const observed = c.epoch(context.observed_at); assert(observed <= now && now - observed <= policy.max_readback_ms, 'STALE_RESOURCE_READBACK');
  const p = permit.payload;
  c.exact(p, ['schema_version','qualification_id','qualification_digest','subject_commit_sha','policy_digest',
    'host_id','operator_id','run_id','stage','mode','config_digest','observations_digest','plan_digest','nonce',
    'issued_at','expires_at','issuer_identity','signer_key_id','signature_algorithm']);
  assert.equal(p.schema_version, c.VERSION);
  c.verifyEnvelope(permit, 'permit', policy, now);
  assert.equal(p.qualification_id, q.qualification_id, 'QUALIFICATION_ID_MISMATCH');
  assert.equal(p.qualification_digest, c.digest(qualification), 'QUALIFICATION_DIGEST_MISMATCH');
  assert.equal(p.subject_commit_sha, q.subject_commit_sha, 'SUBJECT_MISMATCH');
  assert.equal(p.policy_digest, c.digest(policy), 'PERMIT_POLICY_CHANGED');
  for (const k of ['host_id','operator_id','run_id','stage','mode','plan_digest']) assert.equal(p[k], context[k], 'PERMIT_CONTEXT_MISMATCH:' + k);
  assert.equal(p.config_digest, c.digest(context.config), 'CONFIG_DRIFT');
  assert.equal(p.observations_digest, c.digest(context), 'OBSERVATIONS_DRIFT');
  assert(c.epoch(p.expires_at) <= c.epoch(q.expires_at), 'PERMIT_OUTLIVES_QUALIFICATION'); c.hash(p.nonce);
  const result = Object.freeze({status:'LOCAL_ADMISSION_PASS',reason_code:'SYNTHETIC_ONLY',
    run_id:p.run_id,qualification_id:q.qualification_id,subject_sha:q.subject_commit_sha,stage:p.stage,
    evidence_digest:c.digest({qualification,permit}),elapsed_ms:Math.ceil(performance.now()-started),
    nonce:p.nonce,ledger_root:policy.ledger_root,expires_at:Math.min(c.epoch(p.expires_at),c.epoch(q.expires_at),c.epoch(policy.valid_until),observed+policy.max_readback_ms),
    execution_authorized:false,production_authorized:false});
  qualified.add(result); return result;
}
function isVerified(result) { return qualified.has(result); }
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'USAGE: verifier request trusted-policy');
    const r = c.read(process.argv[2]);
    c.exact(r, ['qualification','permit','materials','evidence','context']);
    console.log(JSON.stringify(admit({...r,policy:c.read(process.argv[3])})));
  } catch { console.error(JSON.stringify({status:'LOCAL_ADMISSION_FAIL',reason_code:'OFFLINE_VERIFICATION_REJECTED',execution_authorized:false,production_authorized:false})); process.exitCode=1; }
}
module.exports = {validateQualificationPayload,validateQualification,admit,isVerified};
