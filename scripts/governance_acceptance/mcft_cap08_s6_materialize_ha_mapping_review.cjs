#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.MCFT_REPO_ROOT
  ? path.resolve(process.env.MCFT_REPO_ROOT)
  : path.resolve(__dirname, '../..');
const CAP08 = 'docs/digital_twin/mcft/cap_08/';
const PATHS = Object.freeze({
  ledger: `${CAP08}GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json`,
  mapping: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-WITNESS-MAPPING-V1.json`,
  lifecycle: `${CAP08}GEOX-MCFT-CAP-08-S6-WITNESS-LIFECYCLE-V1.json`,
});
const OUTPUT_JSON = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_HA_MAPPING_REVIEW.json');
const OUTPUT_MD = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_HA_MAPPING_REVIEW.md');

function readJson(repoPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8'));
}

function loadProofContracts(mapping) {
  const catalog = {};
  for (const shardRef of mapping.proof_contract_shards) {
    const shard = readJson(shardRef.path);
    assert.equal(shard.mapping_id, mapping.mapping_id);
    assert.equal(shard.contract_count, shard.contract_ids.length);
    for (const contractId of shard.contract_ids) {
      assert.equal(Object.hasOwn(catalog, contractId), false, `DUPLICATE_PROOF_CONTRACT:${contractId}`);
      assert.ok(shard.proof_contracts[contractId], `MISSING_SHARD_CONTRACT:${contractId}`);
      catalog[contractId] = shard.proof_contracts[contractId];
    }
  }
  return catalog;
}

function resolveProof(mapping, proofContracts, contractRef) {
  const source = proofContracts[contractRef];
  assert.ok(source, `UNKNOWN_PROOF_CONTRACT:${contractRef}`);
  const selectorProfile = mapping.selector_profiles[source.selector_profile];
  assert.ok(selectorProfile, `UNKNOWN_SELECTOR_PROFILE:${source.selector_profile}`);
  const artifactContract = mapping.artifact_contract_profiles[source.artifact_contract_profile];
  assert.ok(artifactContract, `UNKNOWN_ARTIFACT_PROFILE:${source.artifact_contract_profile}`);
  return {
    proof_contract_ref: contractRef,
    phase: source.phase,
    instance_policy: source.instance_policy,
    producer_id: source.producer_id,
    artifact_kind: source.artifact_kind,
    counting_domain: source.counting_domain,
    object_set_id: source.object_set_id,
    selector_id: source.selector_id,
    selector_profile: source.selector_profile,
    selector_contract: selectorProfile,
    selector_parameters: source.selector_parameters,
    expected_contract: source.expected_contract,
    artifact_contract_profile: source.artifact_contract_profile,
    artifact_contract: artifactContract,
  };
}

function materialize() {
  const ledger = readJson(PATHS.ledger);
  const mapping = readJson(PATHS.mapping);
  const lifecycle = readJson(PATHS.lifecycle);

  assert.equal(ledger.item_count, 24);
  assert.equal(ledger.items.length, 24);
  assert.equal(mapping.rule_count, 24);
  assert.equal(mapping.rules.length, 24);
  assert.equal(mapping.proof_contract_count, 25);
  const proofContracts = loadProofContracts(mapping);
  assert.equal(Object.keys(proofContracts).length, 25);
  assert.equal(mapping.identity_join.join_key, 'ledger_index');
  assert.equal(mapping.proof_contract_location, 'REFERENCED_SHARDED_PROOF_CONTRACT_CATALOG');

  const items = mapping.rules.map((rule, ledgerIndex) => {
    assert.equal(rule.ledger_index, ledgerIndex, `LEDGER_INDEX_MISMATCH:${ledgerIndex}`);
    const ledgerItem = ledger.items[ledgerIndex];
    assert.ok(ledgerItem && typeof ledgerItem === 'object');
    const finalizationRule = mapping.finalization_profiles[rule.finalization_profile];
    assert.ok(finalizationRule, `UNKNOWN_FINALIZATION_PROFILE:${rule.finalization_profile}`);
    return {
      ledger_index: ledgerIndex,
      item_id: ledgerItem.item_id,
      requirement: ledgerItem.requirement,
      authority_bindings: [
        mapping.identity_authority_binding,
        ...rule.semantic_authority_bindings,
      ],
      proof_requirements: rule.proof_contract_refs.map((ref) => resolveProof(mapping, proofContracts, ref)),
      finalization_profile: rule.finalization_profile,
      finalization_rule: finalizationRule,
    };
  });

  return {
    schema_version: 'geox_mcft_cap08_s6_ha_mapping_review_v3',
    record_status: mapping.record_status,
    source_ledger: {
      path: PATHS.ledger,
      blob_sha: mapping.authority_refs.frozen_ledger.blob_sha,
      item_count: ledger.item_count,
    },
    source_mapping: {
      path: PATHS.mapping,
      semantic_digest: mapping.semantic_digest,
      identity_join: mapping.identity_join,
      authority_precedence: mapping.authority_precedence,
      proof_contract_count: mapping.proof_contract_count,
    },
    lifecycle: {
      path: PATHS.lifecycle,
      semantic_digest: lifecycle.semantic_digest,
      phase_multiplicity: lifecycle.phase_multiplicity,
    },
    item_count: items.length,
    proof_requirement_count: items.reduce((sum, item) => sum + item.proof_requirements.length, 0),
    expected_phase_witness_instance_count: lifecycle.final_settlement.expected_ha_phase_witness_instance_count,
    items,
    nonclaims: mapping.nonclaims,
  };
}

function markdown(review) {
  const lines = [
    '# MCFT-CAP-08 S6 Hard Acceptance Mapping Review',
    '',
    `Record status: \`${review.record_status}\``,
    '',
    `Ledger items: \`${review.item_count}\``,
    '',
    `Proof requirements: \`${review.proof_requirement_count}\``,
    '',
    `Required phase witness instances: \`${review.expected_phase_witness_instance_count}\``,
    '',
    '| Item | Requirement | Phase / instance | Counting domain | Object set | Selector | Producer | Artifact |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const item of review.items) {
    for (const proof of item.proof_requirements) {
      lines.push(`| ${item.item_id} | ${item.requirement} | ${proof.phase}:${proof.instance_policy} | ${proof.counting_domain} | ${proof.object_set_id} | ${proof.selector_id} | ${proof.producer_id} | ${proof.artifact_kind} |`);
    }
  }
  lines.push('', '## Authority and proof contracts', '');
  for (const item of review.items) {
    lines.push(`### ${item.item_id} — ${item.requirement}`, '');
    lines.push('Authority bindings:', '', '```json', JSON.stringify(item.authority_bindings, null, 2), '```', '');
    for (const proof of item.proof_requirements) {
      lines.push(`#### ${proof.phase} — ${proof.producer_id}`, '');
      lines.push('```json', JSON.stringify({
        proof_contract_ref: proof.proof_contract_ref,
        instance_policy: proof.instance_policy,
        counting_domain: proof.counting_domain,
        object_set_id: proof.object_set_id,
        selector_id: proof.selector_id,
        selector_profile: proof.selector_profile,
        selector_contract: proof.selector_contract,
        selector_parameters: proof.selector_parameters,
        expected_contract: proof.expected_contract,
        artifact_kind: proof.artifact_kind,
        artifact_contract_profile: proof.artifact_contract_profile,
        artifact_contract: proof.artifact_contract,
      }, null, 2), '```', '');
    }
    lines.push('Finalization rule:', '', '```json', JSON.stringify(item.finalization_rule, null, 2), '```', '');
  }
  return `${lines.join('\n')}\n`;
}

function writeReview(review = materialize()) {
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(review, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_MD, markdown(review));
  return { json: OUTPUT_JSON, markdown: OUTPUT_MD, review };
}

if (require.main === module) {
  const result = writeReview();
  console.log(JSON.stringify({
    status: 'PASS',
    item_count: result.review.item_count,
    proof_requirement_count: result.review.proof_requirement_count,
    expected_phase_witness_instance_count: result.review.expected_phase_witness_instance_count,
  }));
}

module.exports = { materialize, writeReview, loadProofContracts, resolveProof };
