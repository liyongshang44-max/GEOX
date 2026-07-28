#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const CAP = 'docs/digital_twin/mcft/cap_08';
const PATHS = {
  ledger: `${CAP}/GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json`,
  mapping: `${CAP}/GEOX-MCFT-CAP-08-S6-HA-WITNESS-MAPPING-V1.json`,
  lifecycle: `${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-LIFECYCLE-V1.json`,
  closureMember: `${CAP}/GEOX-MCFT-CAP-08-S6-CLOSURE-MEMBER-MANIFEST-CONTRACT-V1.json`,
  closureContract: `${CAP}/GEOX-MCFT-CAP-08-S6-CLOSURE-CONTRACT-WITNESS-MAPPING-V1.json`,
};
function readJson(repoPath) { return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8')); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticDigest(value) { const copy = structuredClone(value); delete copy.semantic_digest; return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`; }
function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function gitBlob(repoPath, ref = 'HEAD') { return git('rev-parse', `${ref}:${repoPath}`); }
function assertDigest(value, label) { assert.equal(value.semantic_digest, semanticDigest(value), `${label}_SEMANTIC_DIGEST`); }
function loadCatalog({ strictAuthorityBlobs = process.env.MCFT_CAP08_S6_SKIP_EXACT_AUTHORITY_BLOB_CHECK !== '1' } = {}) {
  const ledger = readJson(PATHS.ledger);
  const mapping = readJson(PATHS.mapping);
  const lifecycle = readJson(PATHS.lifecycle);
  const closureMember = readJson(PATHS.closureMember);
  const closureContract = readJson(PATHS.closureContract);
  for (const [label, value] of Object.entries({ mapping, lifecycle, closureMember, closureContract })) assertDigest(value, label.toUpperCase());
  assert.equal(mapping.authority_refs.frozen_ledger.blob_sha, 'd6e0000e1d0e5c88d927b94aaadc4bada07f6bd1');
  if (strictAuthorityBlobs) {
    for (const [key, ref] of Object.entries(mapping.authority_refs)) assert.equal(gitBlob(ref.path), ref.blob_sha, `AUTHORITY_BLOB_DRIFT:${key}`);
  }
  const rules = [];
  for (const shardRef of mapping.rule_shards) {
    const shard = readJson(shardRef.path); assertDigest(shard, `RULE_SHARD:${shardRef.path}`);
    if (strictAuthorityBlobs) assert.equal(gitBlob(shardRef.path), shardRef.blob_sha, `RULE_SHARD_BLOB:${shardRef.path}`);
    assert.equal(shard.semantic_digest, shardRef.semantic_digest); rules.push(...shard.rules);
  }
  const proofContracts = {};
  for (const shardRef of mapping.proof_contract_shards) {
    const shard = readJson(shardRef.path); assertDigest(shard, `PROOF_SHARD:${shardRef.path}`);
    if (strictAuthorityBlobs) assert.equal(gitBlob(shardRef.path), shardRef.blob_sha, `PROOF_SHARD_BLOB:${shardRef.path}`);
    assert.equal(shard.semantic_digest, shardRef.semantic_digest);
    for (const [id, contract] of Object.entries(shard.proof_contracts)) { assert.equal(proofContracts[id], undefined, `DUPLICATE_PROOF_CONTRACT:${id}`); proofContracts[id] = contract; }
  }
  return { ledger, mapping, lifecycle, closureMember, closureContract, rules, proofContracts };
}

function phaseInstances(rule, proofContracts, mapping) {
  const profile = mapping.finalization_profiles[rule.finalization_profile];
  return rule.proof_contract_refs.flatMap((id) => {
    const pc = proofContracts[id];
    if (pc.phase === 'PER_RUN') return ['RUN_A', 'RUN_B'].map((instance) => ({ proof_contract_id: id, phase: pc.phase, phase_instance: instance }));
    if (pc.phase === 'CROSS_RUN') return [{ proof_contract_id: id, phase: pc.phase, phase_instance: 'RUN_A_RUN_B_PAIR' }];
    if (pc.phase === 'MERGE_SHA') return [{ proof_contract_id: id, phase: pc.phase, phase_instance: 'EXACT_MERGE_SHA' }];
    if (pc.phase === 'RETENTION_ATTESTATION') return [{ proof_contract_id: id, phase: pc.phase, phase_instance: 'EXACT_LOCKED_R2_ARTIFACT_VERSION' }];
    throw new Error(`UNKNOWN_HA_PROOF_PHASE:${pc.phase}`);
  });
}
function materialize(options = {}) {
  const c = loadCatalog(options);
  const byIndex = new Map(c.rules.map((r) => [r.ledger_index, r]));
  const items = c.ledger.items.map((identity, ledgerIndex) => {
    const rule = byIndex.get(ledgerIndex); assert.ok(rule, `MISSING_RULE:${ledgerIndex}`);
    const proof_contracts = rule.proof_contract_refs.map((id) => ({ proof_contract_id: id, ...c.proofContracts[id] }));
    return { ledger_index: ledgerIndex, item_id: identity.item_id, requirement: identity.requirement, ledger_status: identity.status, semantic_authority_bindings: rule.semantic_authority_bindings, finalization_profile: rule.finalization_profile, proof_contracts, expected_phase_witness_instances: phaseInstances(rule, c.proofContracts, c.mapping) };
  });
  const expectedCount = items.reduce((n, item) => n + item.expected_phase_witness_instances.length, 0);
  return {
    schema_version: 'geox_mcft_cap08_s6_ha_mapping_review_v4', record_status: 'PROPOSED_FOR_HUMAN_REVIEW',
    source_ledger: { path: PATHS.ledger, blob_sha: c.mapping.authority_refs.frozen_ledger.blob_sha, item_count: c.ledger.item_count },
    source_mapping: { path: PATHS.mapping, blob_sha: options.strictAuthorityBlobs === false ? null : gitBlob(PATHS.mapping), rule_shard_count: c.mapping.rule_shards.length, proof_contract_shard_count: c.mapping.proof_contract_shards.length },
    lifecycle: { path: PATHS.lifecycle, blob_sha: options.strictAuthorityBlobs === false ? null : gitBlob(PATHS.lifecycle), expected_phase_witness_instance_count: c.lifecycle.expected_phase_witness_instance_count },
    item_count: items.length, proof_requirement_count: Object.keys(c.proofContracts).length, expected_phase_witness_instance_count: expectedCount, items,
    nonclaims: c.mapping.nonclaims,
  };
}
function toMarkdown(review) {
  const rows = review.items.map((item) => `| ${item.ledger_index} | ${item.item_id} | ${item.requirement} | ${item.finalization_profile} | ${item.proof_contracts.map((p) => p.proof_contract_id).join(', ')} | ${item.expected_phase_witness_instances.length} |`);
  return ['# MCFT-CAP-08 S6 Hard Acceptance Mapping Review', '', `Status: ${review.record_status}`, '', `Items: ${review.item_count}`, '', `Proof contracts: ${review.proof_requirement_count}`, '', `Expected phase witness instances: ${review.expected_phase_witness_instance_count}`, '', '| Index | Item | Requirement | Finalization | Proof contracts | Instances |', '|---:|---|---|---|---|---:|', ...rows, ''].join('\n');
}
function writeReview(review) {
  const outDir = path.join(ROOT, 'acceptance-output'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'MCFT_CAP_08_S6_HA_MAPPING_REVIEW.json'), `${JSON.stringify(review, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'MCFT_CAP_08_S6_HA_MAPPING_REVIEW.md'), toMarkdown(review));
}
if (require.main === module) { const review = materialize(); writeReview(review); console.log(JSON.stringify({ status: 'PASS', item_count: review.item_count, proof_requirement_count: review.proof_requirement_count, expected_phase_witness_instance_count: review.expected_phase_witness_instance_count }, null, 2)); }
module.exports = { ROOT, PATHS, readJson, canonical, semanticDigest, git, gitBlob, assertDigest, loadCatalog, materialize, toMarkdown, writeReview };
