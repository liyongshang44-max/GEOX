'use strict';

const assert = require('node:assert/strict');

function validateWitnessContracts(input) {
  const { baseSha, contract, classification, lifecycle, manifest, closureMapping, semanticDigest, duplicates } = input;

  assert.equal(contract.hard_acceptance_contract.ledger_item_count, 24);
  assert.equal(contract.formal_run_contract.run_count, 2);
  assert.deepEqual(contract.formal_run_contract.run_ids, ['RUN_A', 'RUN_B']);
  assert.equal(contract.formal_run_contract.fresh_database_per_run, true);
  assert.equal(contract.formal_run_contract.same_deterministic_formal_run_id, true);
  assert.equal(contract.formal_run_contract.different_operational_run_instance_id, true);
  assert.equal(contract.formal_run_contract.slice_acceptance_object_reuse_forbidden, true);
  assert.equal(contract.formal_run_contract.cross_run_stitching_forbidden, true);
  assert.equal(classification.classes.FINAL_FORMAL_CLOSURE_RUN.eligible_for_closure, true);
  assert.equal(classification.classes.SLICE_ACCEPTANCE_RUN.eligible_for_closure, false);

  for (const value of [lifecycle, manifest, closureMapping]) {
    assert.equal(value.base_main_sha, baseSha);
    assert.equal(value.record_status, 'PROPOSED_FOR_HUMAN_REVIEW');
    assert.equal(value.semantic_digest, semanticDigest(value));
  }
  assert.equal(lifecycle.schema_version, 'geox_mcft_cap08_s6_witness_lifecycle_v2');
  assert.equal(manifest.schema_version, 'geox_mcft_cap08_s6_closure_member_manifest_contract_v2');
  assert.equal(closureMapping.schema_version, 'geox_mcft_cap08_s6_closure_contract_witness_mapping_v2');

  assert.equal(lifecycle.phase_multiplicity.PER_RUN.required_witnesses_per_ledger_item, 2);
  assert.deepEqual(lifecycle.phase_multiplicity.PER_RUN.required_instances, ['RUN_A', 'RUN_B']);
  assert.equal(lifecycle.eligibility_rules.phase_mismatch_status, 'NOT_YET_ELIGIBLE');
  assert.equal(lifecycle.eligibility_rules.pass_outside_required_phase_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_artifact_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_witness_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_phase_instance_id_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_requirement_reload_from_frozen_ledger_forbidden, true);
  assert.equal(lifecycle.canonical_operational_boundary.run_instance_id_part_of_semantic_identity, false);
  assert.equal(lifecycle.canonical_operational_boundary.run_instance_id_required_in_operational_manifest, true);
  assert.equal(lifecycle.merge_binding.full_run_rerun_at_merge_sha_required, false);
  assert.equal(lifecycle.merge_binding.candidate_merge_tree_equality_required, true);
  assert.equal(lifecycle.retention_binding.level, 'R2');
  assert.equal(lifecycle.retention_binding.days, 730);
  assert.equal(lifecycle.witness_identity.requirement_must_be_reloaded_from_frozen_ledger, true);
  assert.equal(lifecycle.witness_identity.duplicate_witness_identity_forbidden, true);
  assert.equal(lifecycle.mapping_freeze_transition.separate_transition_required, true);
  assert.equal(lifecycle.mapping_freeze_transition.required_human_review_disposition, 'APPROVED_FOR_FREEZE');
  assert.equal(lifecycle.mapping_freeze_transition.mapping_blob_change_after_approval_forbidden, true);
  assert.equal(lifecycle.mapping_freeze_transition.witness_implementation_authority_becomes_true_only_after_freeze_effective, true);
  assert.equal(lifecycle.final_settlement.proof_requirement_count, 25);
  assert.equal(lifecycle.final_settlement.expected_ha_phase_witness_instance_count, 47);
  assert.equal(lifecycle.final_settlement.per_run_witness_instance_count, 44);
  assert.equal(lifecycle.final_settlement.cross_run_witness_instance_count, 1);
  assert.equal(lifecycle.final_settlement.merge_sha_witness_instance_count, 1);
  assert.equal(lifecycle.final_settlement.retention_witness_instance_count, 1);
  assert.equal(lifecycle.final_settlement.witness_identity_exact_set_equality_required, true);
  assert.equal(lifecycle.final_settlement.duplicate_witness_identity_count_required, 0);
  const finalizers = lifecycle.producer_separation.filter((producer) => producer.may_finalize_ledger);
  assert.equal(finalizers.length, 1);
  assert.equal(finalizers[0].phase, 'FINAL_SETTLEMENT');

  assert.equal(manifest.manifest_cardinality.per_run, 1);
  assert.deepEqual(manifest.manifest_cardinality.required_run_labels, ['RUN_A', 'RUN_B']);
  assert.equal(manifest.canonical_member_rules.operational_run_instance_id_field_forbidden, true);
  assert.equal(manifest.counting_rules.counts_derive_from_manifest_members_joined_to_canonical_readback, true);
  assert.equal(manifest.counting_rules.global_facts_count_forbidden, true);
  assert.equal(manifest.counting_rules.global_object_type_count_forbidden, true);
  assert.equal(manifest.counting_rules.unscoped_projection_count_forbidden, true);
  assert.equal(manifest.digest_partition.semantic_member_set_digest_excludes_operational_run_instance_id, true);
  assert.equal(manifest.digest_partition.operational_manifest_digest_includes_operational_run_instance_id, true);
  assert.equal(manifest.artifact_only.manifest_is_product_canonical_fact, false);
  assert.equal(manifest.artifact_only.manifest_creation_product_write_delta, 0);
  assert.equal(manifest.operational_event_rules.event_is_product_canonical_fact, false);
  assert.equal(manifest.operational_event_rules.event_run_instance_id_required, true);
  assert.equal(manifest.operational_event_rules.event_formal_run_id_required, true);
  assert.equal(manifest.operational_event_rules.event_exact_subject_sha_required, true);
  assert.equal(manifest.operational_event_rules.duplicate_event_identity_forbidden, true);
  assert.equal(manifest.operational_event_rules.manifest_creation_product_write_delta, 0);
  assert.equal(manifest.digest_partition.operational_event_manifest_digest_includes_operational_run_instance_id, true);
  assert.equal(manifest.digest_partition.operational_event_manifest_digest_excludes_wall_clock_worker_lease_token_job_id, true);

  assert.equal(closureMapping.classification, 'NON_LEDGER_FINAL_CLOSURE_CONTRACT_OBLIGATIONS');
  assert.equal(closureMapping.hard_acceptance_identity_namespace_forbidden, true);
  assert.equal(closureMapping.obligations.length, 8);
  assert.deepEqual(duplicates(closureMapping.obligations.map((item) => item.obligation_id)), []);
  assert.equal(closureMapping.obligations.every((item) => /^FC-\d{2}$/.test(item.obligation_id)), true);
  assert.equal(closureMapping.obligations.some((item) => item.phase === 'EXACT_CANDIDATE_HEAD'), true);
  assert.equal(closureMapping.obligations.some((item) => item.phase === 'FINAL_SETTLEMENT'), true);
  const closureDomains = new Set(closureMapping.allowed_counting_domains);
  for (const obligation of closureMapping.obligations) {
    assert.equal(closureDomains.has(obligation.counting_domain), true);
    assert.notEqual(obligation.object_set_id.length, 0);
    assert.notEqual(obligation.selector_id.length, 0);
    assert.equal(obligation.selector_contract.global_table_count_forbidden, true);
    assert.equal(obligation.selector_contract.global_type_count_forbidden, true);
    assert.equal(obligation.selector_contract.exact_subject_sha_required, true);
    assert.equal(obligation.artifact_contract.exact_subject_sha_required, true);
    assert.equal(obligation.artifact_contract.artifact_digest_required, true);
    assert.equal(obligation.artifact_contract.object_set_ref_required, true);
    assert.equal(obligation.artifact_contract.selector_observed_required, true);
    assert.equal(obligation.status_policy.phase_mismatch_status, 'NOT_YET_ELIGIBLE');
    assert.equal(obligation.status_policy.pass_without_artifact_forbidden, true);
    assert.equal(obligation.status_policy.pass_without_witness_forbidden, true);
  }
}

module.exports = { validateWitnessContracts };
