const fs = require('node:fs');
const assert = require('node:assert/strict');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const qualification = json('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-CANDIDATE-V1.json');
const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');

assert.equal(qualification.record_status, 'EVIDENCE_HEALTH_PRODUCTIZATION_QUALIFIED_CLASS_B_ADJUDICATION_AUTHORIZED_S4_NOT_EFFECTIVE');
assert.equal(qualification.qualified_subject_sha, '9e6a60db8885d1d9e4ce73cb9b2cfe84b4970e5e');
assert.equal(qualification.focused_run_id, 31602800157);
assert.equal(qualification.cap07_lifecycle_run_id, 31602800202);
assert.equal(qualification.standard_ci_run_id, 31602800138);
assert.equal(qualification.frontend_runtime_page_audit_pass, true);
assert.equal(qualification.full_acceptance_pass, true);
assert.equal(qualification.commercial_mvp0_release_gate_pass, true);
assert.equal(qualification.protected_main_merge_claimed, false);
assert.equal(qualification.evidence_health_productization_qualified, true);
assert.equal(qualification.underlying_data_contract_expanded, false);
assert.equal(qualification.browser_freshness_derivation_authorized, false);
assert.equal(qualification.browser_degradation_derivation_authorized, false);
assert.equal(qualification.browser_provider_cadence_inference_authorized, false);
assert.equal(qualification.missing_source_inference_authorized, false);
assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.pfe14_s4_effective, false);

const next = qualification.class_b_projection_adjudication;
assert.equal(next.authorized_next_candidate, true);
assert.equal(next.implementation_authorized, false);
assert.equal(next.must_use_existing_persisted_server_facts, true);
assert.equal(next.must_define_absent_slot_semantics, true);
assert.equal(next.must_define_degradation_vocabulary, true);
assert.equal(next.must_adjudicate_missed_slot_count, true);
assert.equal(next.must_adjudicate_backfill_status, true);
assert.equal(next.must_adjudicate_o00_o23_slot_state, true);
assert.equal(next.must_adjudicate_refresh_after_seconds, true);
assert.equal(next.kbs_policy_change_authorized, false);
assert.equal(next.canonical_write_authorized, false);
assert.equal(qualification.class_b_field_implementation_authorized, false);
assert.equal(qualification.class_c_field_implementation_authorized, false);
assert.equal(qualification.runtime_context_authorized, false);
assert.equal(qualification.shadow_online_label_authorized, false);
assert.equal(qualification.pfe14_s4_effective, false);
assert.equal(qualification.next_action, 'PFE_14_ADJUDICATE_CLASS_B_OPERATIONAL_PRODUCT_PROJECTION');

assert.equal(authority.record_status, 'S4_EVIDENCE_HEALTH_PRODUCTIZATION_QUALIFIED_CLASS_B_ADJUDICATION_AUTHORIZED_NOT_EFFECTIVE');
assert.equal(authority.evidence_health_productization_qualified, true);
assert.equal(authority.evidence_health_productization_proof.subject_sha, qualification.qualified_subject_sha);
assert.equal(authority.evidence_health_productization_proof.all_pass, true);
assert.equal(authority.evidence_health_productization_proof.merged_to_protected_main, false);
assert.equal(authority.class_b_operational_projection_adjudication_authorized, true);
assert.equal(authority.class_b_operational_extension_implementation_authorized, false);
assert.equal(authority.class_c_field_implementation_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(authority.authoritative_runtime_context_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(authority.first_legal_next_action, qualification.next_action);

console.log(JSON.stringify({
  status: 'PASS',
  qualification: 'PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1',
  qualified_subject_sha: qualification.qualified_subject_sha,
  evidence_health_productization_qualified: true,
  class_b_adjudication_authorized: true,
  class_b_implementation_authorized: false,
  class_c_implementation_authorized: false,
  pfe14_s4_effective: false,
  next_action: qualification.next_action
}, null, 2));
