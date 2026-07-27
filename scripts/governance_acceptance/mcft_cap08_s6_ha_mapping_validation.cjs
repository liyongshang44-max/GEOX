'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function containsForbiddenIdentityKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenIdentityKey);
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'item_id' || key === 'requirement') return true;
    if (containsForbiddenIdentityKey(child)) return true;
  }
  return false;
}

function validateHaMapping(input) {
  const {
    root, paths, baseSha, ledger, mapping, lifecycle, proofShards, materialized,
    actualBlobs, readJson, semanticDigest, loadProofContracts, resolveProof,
  } = input;

  assert.equal(ledger.schema_version, 'geox_mcft_cap08_hard_acceptance_ledger_v1');
  assert.equal(ledger.record_status, 'FROZEN_S0_CONTRACT');
  assert.equal(ledger.item_count, 24);
  assert.equal(ledger.items.length, 24);
  assert.deepEqual(duplicates(ledger.items.map((item) => item.item_id)), []);

  assert.equal(mapping.schema_version, 'geox_mcft_cap08_s6_ha_witness_mapping_v3');
  assert.equal(mapping.base_main_sha, baseSha);
  assert.equal(mapping.record_status, 'PROPOSED_FOR_HUMAN_REVIEW');
  assert.equal(mapping.semantic_digest, semanticDigest(mapping));
  assert.equal(mapping.rule_count, 24);
  assert.equal(mapping.rules.length, 24);
  assert.equal(mapping.proof_contract_count, 25);
  assert.equal(mapping.authority_refs.frozen_ledger.blob_sha, actualBlobs.ledger);
  assert.equal(mapping.authority_refs.s6_contract.blob_sha, actualBlobs.contract);
  assert.equal(mapping.authority_refs.run_classification.blob_sha, actualBlobs.classification);
  assert.equal(mapping.authority_refs.taskbook.blob_sha, actualBlobs.taskbook);
  assert.equal(mapping.authority_refs.retained_architecture.blob_sha, actualBlobs.retained);
  assert.equal(mapping.authority_precedence.item_id_and_requirement, 'frozen_ledger');
  assert.equal(mapping.authority_precedence.numbering_summary_may_override_frozen_ledger, false);
  assert.equal(mapping.authority_precedence.semantic_conflict_resolution, 'FAIL_CLOSED_UNTIL_EXPLICIT_AUTHORITY_RECONCILIATION');
  assert.equal(mapping.identity_join.join_key, 'ledger_index');
  assert.equal(mapping.identity_join.item_id_source, 'FROZEN_LEDGER_AT_RUNTIME');
  assert.equal(mapping.identity_join.requirement_source, 'FROZEN_LEDGER_AT_RUNTIME');
  assert.deepEqual(mapping.identity_join.static_identity_fields_forbidden, ['item_id', 'requirement']);
  assert.equal(mapping.proof_contract_location, 'REFERENCED_SHARDED_PROOF_CONTRACT_CATALOG');
  assert.equal(mapping.identity_authority_binding.authority_key, 'frozen_ledger');
  assert.equal(mapping.identity_authority_binding.pointer_template, 'items[ledger_index]');
  assert.equal(mapping.identity_authority_binding.role, 'IDENTITY_AND_REQUIREMENT');
  assert.equal(containsForbiddenIdentityKey(mapping.rules), false);

  assert.equal(mapping.proof_contract_shards.length, 3);
  for (const [index, shardRef] of mapping.proof_contract_shards.entries()) {
    const shard = proofShards[index];
    assert.equal(shard.schema_version, 'geox_mcft_cap08_s6_ha_proof_contract_shard_v1');
    assert.equal(shard.base_main_sha, baseSha);
    assert.equal(shard.record_status, 'PROPOSED_FOR_HUMAN_REVIEW');
    assert.equal(shard.mapping_id, mapping.mapping_id);
    assert.equal(shard.semantic_digest, semanticDigest(shard));
    assert.equal(shard.semantic_digest, shardRef.semantic_digest);
    assert.equal(shard.contract_count, shard.contract_ids.length);
    assert.equal(shard.contract_count, shardRef.contract_count);
    assert.deepEqual(shard.contract_ids, shardRef.contract_ids);
    assert.equal(actualBlobs[`proofShard${['00', '09', '17'][index]}`], shardRef.blob_sha);
  }

  const proofContracts = loadProofContracts(mapping);
  assert.equal(containsForbiddenIdentityKey(proofContracts), false);
  const mappingSources = [paths.mapping, paths.proofShard00, paths.proofShard09, paths.proofShard17]
    .map((repoPath) => fs.readFileSync(path.join(root, repoPath), 'utf8'));
  for (const ledgerItem of ledger.items) {
    for (const source of mappingSources) {
      assert.equal(source.includes(ledgerItem.item_id), false, `STATIC_ITEM_ID_LITERAL:${ledgerItem.item_id}`);
      assert.equal(source.includes(ledgerItem.requirement), false, `STATIC_REQUIREMENT_LITERAL:${ledgerItem.item_id}`);
    }
  }

  assert.deepEqual(mapping.rules.map((rule) => rule.ledger_index), [...Array(24).keys()]);
  const allowedDomains = new Set(mapping.allowed_counting_domains);
  const allowedPhases = new Set(lifecycle.allowed_proof_phases);
  const proofContractIds = Object.keys(proofContracts).sort();
  assert.equal(proofContractIds.length, 25);
  const referenced = [];
  const expandedByRule = [];
  let perRunRuleCount = 0;
  let perRunWitnessInstances = 0;
  let crossRunWitnessInstances = 0;
  let mergeWitnessInstances = 0;
  let retentionWitnessInstances = 0;

  for (const rule of mapping.rules) {
    assert.equal(Object.hasOwn(rule, 'proof_requirements'), false);
    assert.equal(Object.hasOwn(rule, 'counting_domain'), false);
    assert.equal(Object.hasOwn(rule, 'selector_id'), false);
    assert.equal(Object.hasOwn(rule, 'expected_contract'), false);
    assert.equal(Object.hasOwn(rule, 'status'), false);
    assert.ok(Array.isArray(rule.semantic_authority_bindings) && rule.semantic_authority_bindings.length >= 2);
    for (const binding of rule.semantic_authority_bindings) {
      assert.ok(mapping.authority_refs[binding.authority_key], `UNKNOWN_AUTHORITY_KEY:${binding.authority_key}`);
      assert.notEqual(binding.authority_key, 'frozen_ledger');
      assert.equal(typeof binding.pointer, 'string');
      assert.notEqual(binding.pointer.length, 0);
    }
    assert.ok(mapping.finalization_profiles[rule.finalization_profile]);
    assert.ok(Array.isArray(rule.proof_contract_refs) && rule.proof_contract_refs.length > 0);
    const proofs = rule.proof_contract_refs.map((ref) => {
      referenced.push(ref);
      return resolveProof(mapping, proofContracts, ref);
    });
    expandedByRule.push(proofs);
    for (const proof of proofs) {
      assert.equal(allowedPhases.has(proof.phase), true);
      assert.equal(allowedDomains.has(proof.counting_domain), true);
      assert.notEqual(proof.producer_id.length, 0);
      assert.notEqual(proof.artifact_kind.length, 0);
      assert.notEqual(proof.object_set_id.length, 0);
      assert.notEqual(proof.selector_id.length, 0);
      assert.equal(proof.selector_contract.global_table_count_forbidden, true);
      assert.equal(proof.selector_contract.global_type_count_forbidden, true);
      assert.equal(proof.artifact_contract.exact_subject_sha_required, true);
      assert.equal(proof.artifact_contract.artifact_digest_required, true);
      assert.equal(proof.artifact_contract.object_set_ref_required, true);
      assert.equal(proof.artifact_contract.selector_observed_required, true);
      assert.equal(proof.artifact_contract.counting_domain_required, true);
      assert.equal(proof.artifact_contract.lifecycle_phase_required, true);
      if (proof.phase === 'PER_RUN') {
        assert.equal(proof.instance_policy, 'BOTH_FORMAL_RUN_INSTANCES');
        assert.equal(proof.selector_contract.run_label_required, true);
        assert.equal(proof.selector_contract.formal_run_id_required, true);
        assert.equal(proof.selector_contract.operational_run_instance_id_required_in_witness_provenance, true);
        assert.equal(proof.selector_contract.exact_subject_sha_required, true);
        if (proof.selector_contract.selector_domain === 'CANONICAL_MEMBERS') {
          assert.ok(proof.selector_parameters.member_roles.length > 0);
          assert.equal(proof.selector_contract.closure_manifest_membership_required, true);
          assert.equal(proof.selector_contract.operational_run_instance_id_in_canonical_identity_forbidden, true);
        } else if (proof.selector_contract.selector_domain === 'OPERATIONAL_EVENTS') {
          assert.ok(proof.selector_parameters.event_roles.length > 0);
          assert.equal(proof.selector_contract.six_key_scope_required, true);
          assert.equal(proof.selector_contract.lineage_and_revision_required, true);
          assert.equal(proof.selector_contract.operational_manifest_membership_required, true);
          assert.equal(proof.selector_contract.closure_manifest_membership_required, false);
        } else if (proof.selector_contract.selector_domain === 'READ_MODEL_OUTPUT') {
          assert.ok(proof.selector_parameters.output_roles.length > 0);
          assert.equal(proof.selector_contract.closure_manifest_membership_required, false);
        } else {
          assert.fail(`INVALID_PER_RUN_SELECTOR_DOMAIN:${proof.selector_contract.selector_domain}`);
        }
        perRunWitnessInstances += 2;
      } else if (proof.phase === 'CROSS_RUN') {
        assert.equal(proof.instance_policy, 'EXACT_RUN_A_RUN_B_PAIR');
        assert.equal(proof.selector_contract.operational_run_instance_ids_required_in_pair_provenance, true);
        crossRunWitnessInstances += 1;
      } else if (proof.phase === 'MERGE_SHA') {
        assert.equal(proof.selector_profile, 'MERGE_TREE_PAIR');
        mergeWitnessInstances += 1;
      } else if (proof.phase === 'RETENTION_ATTESTATION') {
        assert.equal(proof.selector_profile, 'R2_RETENTION_VERSION');
        retentionWitnessInstances += 1;
      }
    }
    if (proofs.length === 1 && proofs[0].phase === 'PER_RUN') perRunRuleCount += 1;
  }

  assert.deepEqual([...referenced].sort(), proofContractIds);
  assert.deepEqual(duplicates(referenced), []);
  assert.deepEqual(expandedByRule[0].map((proof) => proof.phase), ['CROSS_RUN']);
  for (let index = 1; index <= 22; index += 1) {
    assert.deepEqual(expandedByRule[index].map((proof) => proof.phase), ['PER_RUN']);
    assert.equal(mapping.finalization_profiles[mapping.rules[index].finalization_profile].both_run_instances_required, true);
  }
  assert.deepEqual(expandedByRule[23].map((proof) => proof.phase), ['MERGE_SHA', 'RETENTION_ATTESTATION']);
  assert.notEqual(expandedByRule[23][0].producer_id, expandedByRule[23][1].producer_id);
  assert.notEqual(expandedByRule[23][0].selector_id, expandedByRule[23][1].selector_id);
  assert.notEqual(expandedByRule[23][0].object_set_id, expandedByRule[23][1].object_set_id);
  assert.notEqual(expandedByRule[23][0].counting_domain, expandedByRule[23][1].counting_domain);
  assert.equal(expandedByRule[23][0].selector_contract.retention_artifact_fields_forbidden, true);
  assert.equal(expandedByRule[23][1].selector_contract.candidate_merge_tree_fields_forbidden, true);
  assert.equal(mapping.finalization_profiles[mapping.rules[23].finalization_profile].combined_phase_witness_forbidden, true);
  assert.equal(perRunRuleCount, 22);
  assert.equal(perRunWitnessInstances, 44);
  assert.equal(crossRunWitnessInstances, 1);
  assert.equal(mergeWitnessInstances, 1);
  assert.equal(retentionWitnessInstances, 1);
  assert.equal(referenced.length, 25);

  assert.equal(mapping.global_selector_policy.operational_run_instance_id_required_in_witness_provenance, true);
  assert.equal(mapping.global_selector_policy.operational_run_instance_id_in_canonical_identity_forbidden, true);
  assert.equal(mapping.global_selector_policy.global_table_count_forbidden, true);
  assert.equal(mapping.global_selector_policy.global_type_count_forbidden, true);

  assert.equal(materialized.item_count, 24);
  assert.equal(materialized.proof_requirement_count, 25);
  assert.equal(materialized.expected_phase_witness_instance_count, 47);
  assert.deepEqual(materialized.items.map((item) => item.item_id), ledger.items.map((item) => item.item_id));
  assert.deepEqual(materialized.items.map((item) => item.requirement), ledger.items.map((item) => item.requirement));

  return {
    ledgerItemCount: 24,
    proofRequirementCount: 25,
    perRunRuleCount,
    perRunWitnessInstances,
    crossRunWitnessInstances,
    mergeWitnessInstances,
    retentionWitnessInstances,
  };
}

module.exports = { duplicates, containsForbiddenIdentityKey, validateHaMapping };
