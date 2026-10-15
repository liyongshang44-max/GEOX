'use strict';
// Shared data contract only: no signing, subprocesses, network or Git operations.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const VERSION = 'MCFT_CAP09_ADOPTION_LOCAL_V1';
const DOMAINS = Object.freeze({qualification: VERSION + ':qualification\n', permit: VERSION + ':permit\n'});
const MATERIALS = ['subject_tree', 'runtime_code', 'dependency_lock', 'dependency_manifest',
  'historical_assertion_manifest', 'frozen_boundary', 'required_authority_schema'];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function canonical(v) {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') { assert(Number.isSafeInteger(v), 'INTEGER_REQUIRED'); return String(v); }
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  assert(v && Object.getPrototypeOf(v) === Object.prototype, 'PLAIN_JSON_REQUIRED');
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}
const digest = v => sha(canonical(v));
function exact(v, keys) {
  assert(v && typeof v === 'object' && !Array.isArray(v), 'OBJECT_REQUIRED');
  assert.deepEqual(Object.keys(v).sort(), [...keys].sort(), 'UNKNOWN_OR_MISSING_FIELDS');
}
function hash(v) { assert(typeof v === 'string' && /^[a-f0-9]{64}$/.test(v), 'HASH_INVALID'); }
function id(v) { assert(typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v), 'ID_INVALID'); }
function epoch(v) { assert(typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v, 'TIME_INVALID'); return Date.parse(v); }
function window(p, now, max) {
  const a = epoch(p.issued_at), b = epoch(p.expires_at);
  assert(a <= now && now < b && b - a <= max, 'EXPIRED_OR_FUTURE');
}
function noLinks(file) {
  let p = path.resolve(file);
  for (;;) { assert(!fs.lstatSync(p).isSymbolicLink(), 'SYMLINK_FORBIDDEN'); const n = path.dirname(p); if (n === p) break; p = n; }
}
function read(file) {
  noLinks(file); const s = fs.statSync(file);
  assert(s.isFile() && s.size <= 16 * 1024 * 1024, 'INPUT_FILE_INVALID');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeOnce(file, data) {
  noLinks(path.dirname(file));
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function inventory(root) {
  noLinks(root); assert(fs.statSync(root).isDirectory(), 'MATERIAL_ROOT_INVALID');
  const rows = [];
  function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir).sort()) {
      assert(/^[A-Za-z0-9_.-]+$/.test(name) && name !== '.' && name !== '..', 'MATERIAL_PATH_INVALID');
      const file = path.join(dir, name), rel = prefix + name, s = fs.lstatSync(file);
      assert(!s.isSymbolicLink(), 'MATERIAL_LINK_FORBIDDEN');
      if (s.isDirectory()) walk(file, rel + '/');
      else { assert(s.isFile() && s.nlink === 1, 'MATERIAL_FILE_INVALID'); rows.push({path: rel, sha256: sha(fs.readFileSync(file))}); }
    }
  }
  walk(root, ''); assert(rows.length > 0, 'EMPTY_MATERIAL'); return rows;
}
function materialDigest(root) { return digest(inventory(root)); }
function materialSet(root) {
  assert.deepEqual(fs.readdirSync(root).sort(), [...MATERIALS].sort(), 'MATERIAL_CATEGORIES_INVALID');
  return Object.fromEntries(MATERIALS.map(k => [k + '_digest', materialDigest(path.join(root, k))]));
}
function validatePolicy(p, now) {
  exact(p, ['schema_version','mode','enabled','subject_commit_sha','contract_version','checks','issuers','host_id','operator_id','ledger_root','max_qualification_ms','max_permit_ms','max_readback_ms','valid_until','revocation_epoch']);
  assert.equal(p.schema_version, VERSION); assert.equal(p.contract_version, VERSION);
  // Deliberately cannot accept TEST_ONLY/PRODUCTION in this candidate implementation.
  assert.equal(p.mode, 'SYNTHETIC_ONLY', 'REAL_AUTHORITY_NOT_IMPLEMENTED'); assert.equal(p.enabled, true, 'TRUST_DISABLED');
  assert(/^[a-f0-9]{40}$/.test(p.subject_commit_sha), 'SUBJECT_INVALID');
  for (const k of ['host_id','operator_id','revocation_epoch']) id(p[k]);
  assert(path.isAbsolute(p.ledger_root), 'FIXED_LEDGER_REQUIRED');
  assert(epoch(p.valid_until) > now, 'POLICY_EXPIRED');
  for (const [k, max] of [['max_qualification_ms',86400000],['max_permit_ms',300000],['max_readback_ms',300000]])
    assert(Number.isSafeInteger(p[k]) && p[k] > 0 && p[k] <= max, 'POLICY_BUDGET_INVALID');
  assert(Array.isArray(p.checks) && p.checks.length > 0, 'CHECK_CONTRACT_REQUIRED');
  const seen = new Set();
  for (const c of p.checks) {
    exact(c, ['check_id','check_revision','allow_not_applicable']); id(c.check_id); id(c.check_revision);
    assert(typeof c.allow_not_applicable === 'boolean' && !seen.has(c.check_id), 'CHECK_CONTRACT_INVALID'); seen.add(c.check_id);
  }
  assert(Array.isArray(p.issuers) && p.issuers.length > 0, 'ISSUER_REQUIRED');
}
function validateChecks(checks, policy, evidenceRoot) {
  assert(Array.isArray(checks) && checks.length === policy.checks.length, 'ADOPTION_INCOMPLETE');
  const seen = new Set();
  for (const c of checks) {
    exact(c, ['check_id','check_revision','policy','applicability','result','reason','scope','evidence_ref','evidence_digest']);
    const expected = policy.checks.find(e => e.check_id === c.check_id);
    assert(expected && !seen.has(c.check_id), 'CHECK_MISSING_OR_DUPLICATE'); seen.add(c.check_id);
    assert.equal(c.check_revision, expected.check_revision, 'CHECK_REVISION_CHANGED');
    assert.equal(c.policy, 'REQUIRED'); assert.equal(c.scope, 'SYNTHETIC_ONLY');
    assert((c.result === 'PASS' && c.applicability === 'APPLICABLE') ||
      (c.result === 'NOT_APPLICABLE' && c.applicability === 'NOT_APPLICABLE' && expected.allow_not_applicable && typeof c.reason === 'string' && c.reason.trim().length > 0), 'ADOPTION_INCOMPLETE');
    assert(typeof c.reason === 'string', 'REASON_REQUIRED');
    assert(/^[A-Za-z0-9_-]+\.json$/.test(c.evidence_ref), 'EVIDENCE_PATH_INVALID'); hash(c.evidence_digest);
    if (evidenceRoot) {
      const file = path.join(evidenceRoot, c.evidence_ref); noLinks(file);
      assert.equal(sha(fs.readFileSync(file)), c.evidence_digest, 'EVIDENCE_TAMPER');
      const e = read(file);
      assert.equal(e.check_id, c.check_id); assert.equal(e.result, c.result); assert.equal(e.subject_commit_sha, policy.subject_commit_sha);
    }
  }
}
function verifyEnvelope(envelope, kind, policy, now) {
  exact(envelope, ['payload','signature_base64']); const p = envelope.payload;
  assert.equal(p.signature_algorithm, 'Ed25519');
  const matches = policy.issuers.filter(i => i.issuer_identity === p.issuer_identity && i.signer_key_id === p.signer_key_id && i.purpose === kind);
  assert.equal(matches.length, 1, 'UNTRUSTED_SIGNER'); const i = matches[0];
  assert.equal(i.test_key, true, 'TEST_KEY_REQUIRED'); assert.equal(i.revoked, false, 'SIGNER_REVOKED');
  assert(epoch(i.not_before) <= epoch(p.issued_at) && epoch(p.expires_at) <= epoch(i.not_after), 'KEY_LIFETIME_INVALID');
  assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_GOVERNANCE'].includes(i.role), 'SIGNER_ROLE_INVALID');
  if (i.role === 'INDEPENDENT_GOVERNANCE') assert.notEqual(i.issuer_identity, policy.operator_id, 'INDEPENDENCE_REQUIRED');
  const key = crypto.createPublicKey(i.public_key_pem); assert.equal(key.asymmetricKeyType, 'ed25519');
  assert.equal(sha(key.export({type:'spki',format:'der'})), i.spki_sha256, 'KEY_FINGERPRINT_INVALID');
  const sig = Buffer.from(envelope.signature_base64, 'base64');
  assert(sig.length === 64 && sig.toString('base64') === envelope.signature_base64, 'SIGNATURE_ENCODING_INVALID');
  assert(crypto.verify(null, Buffer.from(DOMAINS[kind] + canonical(p)), key, sig), 'SIGNATURE_INVALID');
  window(p, now, kind === 'qualification' ? policy.max_qualification_ms : policy.max_permit_ms);
}
module.exports = {VERSION,DOMAINS,MATERIALS,sha,digest,canonical,exact,hash,id,epoch,window,noLinks,read,writeOnce,inventory,materialSet,validatePolicy,validateChecks,verifyEnvelope};
