'use strict';
// Explicit offline signing command. Never imported by local admission or launcher.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const c = require('./contract.cjs');
function sign(kind, payload, privateKey, policy, now = Date.now()) {
  c.validatePolicy(policy, now);
  const key = crypto.createPrivateKey(privateKey); assert.equal(key.asymmetricKeyType, 'ed25519');
  const envelope = {payload, signature_base64:crypto.sign(null, Buffer.from(c.DOMAINS[kind] + c.canonical(payload)), key).toString('base64')};
  c.verifyEnvelope(envelope, kind, policy, now); return envelope;
}
function qualification(report, materials, evidence, key, policy, now = Date.now()) {
  const {validateQualificationPayload,validateQualification} = require('./verifier.cjs');
  c.validatePolicy(policy, now); c.validateChecks(report.check_manifest, policy, evidence);
  validateQualificationPayload(report, policy, materials, now);
  const envelope = sign('qualification', report, key, policy, now);
  validateQualification(envelope, policy, materials, now); return envelope;
}
function permit(payload, qualificationEnvelope, materials, evidence, context, key, policy, now = Date.now()) {
  const v = require('./verifier.cjs');
  v.validateQualification(qualificationEnvelope, policy, materials, now);
  const envelope = sign('permit', payload, key, policy, now);
  v.admit({qualification:qualificationEnvelope, permit:envelope, policy, materials, evidence, context, now}); return envelope;
}
if (require.main === module) {
  try {
    const [kind, requestFile, policyFile, keyFile, outputFile] = process.argv.slice(2);
    assert(['qualification','permit'].includes(kind) && process.argv.length === 7, 'USAGE: signer kind request policy private-key output');
    const r = c.read(requestFile), policy = c.read(policyFile); c.noLinks(keyFile);
    const key = fs.readFileSync(keyFile, 'utf8');
    const result = kind === 'qualification' ? qualification(r.report,r.materials,r.evidence,key,policy) :
      permit(r.payload,r.qualification,r.materials,r.evidence,r.context,key,policy);
    c.writeOnce(outputFile,result);
    console.log(JSON.stringify({status:'SYNTHETIC_ARTIFACT_SIGNED',execution_authorized:false,production_authorized:false}));
  } catch { console.error(JSON.stringify({status:'ADOPTION_INCOMPLETE',reason_code:'SIGNING_REJECTED',execution_authorized:false})); process.exitCode = 1; }
}
module.exports = {qualification,permit};
