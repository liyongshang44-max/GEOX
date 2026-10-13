"use strict";
// Cryptographic and durable single-use primitives. This module never launches work.
// The live loader has a fixed, repository-owned trust registry; no trust override.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const TRUST_PATH = path.join(__dirname, "MCFT_CAP09_RETRY_TRUST_V1.json");
const DOMAIN = "GEOX_MCFT_CAP09_ISOLATED_RETRY_PERMIT_V1\n";
const verified = new WeakSet();
const consumed = new WeakSet();
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { assert(Number.isSafeInteger(value), "PERMIT_INTEGER_REQUIRED"); return String(value); }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  assert(value && Object.getPrototypeOf(value) === Object.prototype, "PERMIT_JSON_OBJECT_REQUIRED");
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
function exact(value, keys) {
  assert(value && !Array.isArray(value) && typeof value === "object", "PERMIT_OBJECT_REQUIRED");
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), "PERMIT_UNKNOWN_OR_MISSING_FIELDS");
}
function epoch(s) {
  assert(typeof s === "string" && Number.isFinite(Date.parse(s)) && new Date(Date.parse(s)).toISOString() === s, "PERMIT_CANONICAL_TIME_REQUIRED");
  return Date.parse(s);
}
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function verifyPermit(envelope, trust, context) {
  exact(envelope, ["payload", "signature_base64"]);
  const p = envelope.payload;
  exact(p, ["schema_version", "issuer_id", "key_id", "nonce", "run_id", "parent_run_id", "attempt_ordinal",
    "subject_sha", "host_id", "issued_at", "expires_at", "arm_sha256", "observations_sha256", "plan_sha256", "scope"]);
  assert.equal(p.schema_version, "geox_mcft_cap09_signed_retry_permit_v1");
  assert.equal(p.scope, "ISOLATED_QUALIFICATION_SINGLE_ATTEMPT");
  for (const k of ["issuer_id", "key_id", "host_id"]) assert(typeof p[k] === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(p[k]), "PERMIT_ID_INVALID");
  assert(typeof trust.operator_id === "string" && trust.operator_id.length > 0, "PERMIT_OPERATOR_ID_REQUIRED");
  assert.equal(p.parent_run_id, "72dc0304a21a");
  assert.equal(p.attempt_ordinal, 2);
  assert(/^[a-f0-9]{12}$/.test(p.run_id) && p.run_id !== p.parent_run_id, "PERMIT_FRESH_RUN_REQUIRED");
  assert(/^[a-f0-9]{64}$/.test(p.nonce), "PERMIT_256_BIT_NONCE_REQUIRED");
  assert(/^[a-f0-9]{40}$/.test(p.subject_sha), "PERMIT_SUBJECT_REQUIRED");
  assert.equal(trust.schema_version, "geox_mcft_cap09_retry_trust_v1");
  assert.equal(trust.adopted, true, "PERMIT_TRUST_NOT_ADOPTED");
  assert.equal(typeof trust.execution_enabled, "boolean", "PERMIT_EXECUTION_FLAG_INVALID");
  assert.equal(p.host_id, trust.host_id, "PERMIT_WRONG_HOST");
  assert.equal(p.host_id, context.host_id, "PERMIT_HOST_CONTEXT_MISMATCH");
  assert.equal(p.subject_sha, context.head, "PERMIT_HEAD_MISMATCH");
  assert.equal(p.subject_sha, context.main, "PERMIT_MAIN_MOVED");
  assert.equal(context.clean, true, "PERMIT_DIRTY_SOURCE");
  const now = epoch(context.now), start = epoch(p.issued_at), end = epoch(p.expires_at);
  assert(start <= now && now < end && end - start <= 86400000, "PERMIT_EXPIRED_OR_FUTURE");
  for (const k of ["arm_sha256", "observations_sha256", "plan_sha256"]) {
    assert(/^[a-f0-9]{64}$/.test(p[k]), "PERMIT_DIGEST_REQUIRED");
    assert.equal(p[k], context[k], "PERMIT_DIGEST_MISMATCH:" + k);
  }
  assert(Array.isArray(trust.issuers), "PERMIT_ISSUERS_REQUIRED");
  const matches = trust.issuers.filter(k => k.issuer_id === p.issuer_id && k.key_id === p.key_id);
  assert.equal(matches.length, 1, "PERMIT_UNKNOWN_OR_DUPLICATE_ISSUER");
  const issuer = matches[0];
  assert.equal(issuer.revoked, false, "PERMIT_ISSUER_REVOKED");
  assert(["INDEPENDENT_RETRY_GOVERNANCE","ACCOUNTABLE_SINGLE_OPERATOR"].includes(issuer.role), "PERMIT_ISSUER_ROLE_INVALID");
  if (issuer.role === "INDEPENDENT_RETRY_GOVERNANCE")
    assert.notEqual(issuer.issuer_id, trust.operator_id, "PERMIT_ISSUER_NOT_INDEPENDENT");
  assert(epoch(issuer.not_before) <= start && end <= epoch(issuer.not_after), "PERMIT_OUTSIDE_KEY_LIFETIME");
  const key = crypto.createPublicKey(issuer.public_key_pem);
  assert.equal(key.asymmetricKeyType, "ed25519", "PERMIT_ED25519_REQUIRED");
  assert.equal(sha(key.export({type:"spki",format:"der"})), issuer.spki_sha256, "PERMIT_KEY_FINGERPRINT_MISMATCH");
  const signature = Buffer.from(envelope.signature_base64, "base64");
  assert(signature.length === 64 && signature.toString("base64") === envelope.signature_base64, "PERMIT_SIGNATURE_ENCODING_INVALID");
  assert(crypto.verify(null, Buffer.from(DOMAIN + canonical(p)), key, signature), "PERMIT_BAD_SIGNATURE");
  assert(typeof trust.ledger_root === "string" && path.isAbsolute(trust.ledger_root), "PERMIT_FIXED_LEDGER_REQUIRED");
  const result = freeze({payload:structuredClone(p), ledger_root:trust.ledger_root,
    envelope_sha256:sha(canonical(envelope)), trust_sha256:sha(canonical(trust)),
    status:"SIGNATURE_VERIFIED_NOT_EXECUTION_AUTHORITY", execute_authorized:false});
  verified.add(result);
  return result;
}
function loadHostPermit(file, context) {
  assert(process.platform === "win32" && !process.env.CI && !process.env.GITHUB_ACTIONS, "PERMIT_WINDOWS_LOCAL_ONLY");
  assert(!process.env.NODE_OPTIONS, "PERMIT_NODE_PRELOAD_FORBIDDEN");
  const trust = JSON.parse(fs.readFileSync(TRUST_PATH, "utf8"));
  const stat = fs.statSync(file);
  assert(stat.isFile() && stat.size <= 1024 * 1024, "PERMIT_FILE_INVALID");
  return verifyPermit(JSON.parse(fs.readFileSync(file, "utf8")), trust, context);
}
function noLinks(directory) {
  let at = path.resolve(directory);
  for (;;) {
    const stat = fs.lstatSync(at);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), "PERMIT_LEDGER_LINK_OR_NON_DIRECTORY");
    const parent = path.dirname(at); if (parent === at) break; at = parent;
  }
}
function durableWrite(file, value) {
  const fd = fs.openSync(file, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function consumePermit(permit) {
  assert(verified.has(permit), "PERMIT_VERIFICATION_REQUIRED");
  assert(Date.now() < epoch(permit.payload.expires_at), "PERMIT_EXPIRED_BEFORE_CONSUMPTION");
  const root = permit.ledger_root;
  noLinks(root);
  // Root comes from adopted trust, never the caller's output directory.
  // Both identities are reserved. Crash, second lock failure or write failure
  // deliberately burns the attempt; no cleanup/retry or lock rollback.
  const nonce = path.join(root, "nonce-" + permit.payload.nonce);
  const run = path.join(root, "run-" + permit.payload.run_id);
  fs.mkdirSync(nonce, {mode:0o700});
  fs.mkdirSync(run, {mode:0o700});
  const receipt = {schema_version:"geox_mcft_cap09_consumed_permit_v1", ...permit,
    consumed_at:new Date().toISOString(), status:"CONSUMED_NO_AUTOMATIC_RETRY", execute_authorized:false};
  durableWrite(path.join(nonce, "CONSUMED.json"), receipt);
  durableWrite(path.join(run, "CONSUMED.json"), receipt);
  verified.delete(permit);
  const result=freeze({nonce_directory:nonce, run_directory:run, receipt_sha256:sha(canonical(receipt)), execute_authorized:false});
  consumed.add(result);
  return result;
}
function assertConsumed(authorization) {
  assert(consumed.has(authorization),"PARENT_ATOMIC_PERMIT_CONSUMPTION_REQUIRED");
  assert.equal(authorization.execute_authorized,false,"CONSUMPTION_IS_NOT_EXECUTE_AUTHORITY");
  assert.equal(hashFileBytes(path.join(authorization.run_directory,"CONSUMED.json")),hashFileBytes(path.join(authorization.nonce_directory,"CONSUMED.json")),"CONSUMPTION_DUAL_RECEIPT_MISMATCH");
  return authorization;
}
function hashFileBytes(file){return sha(fs.readFileSync(file));}
module.exports = {DOMAIN, TRUST_PATH, canonical, sha, verifyPermit, loadHostPermit, consumePermit, assertConsumed};
