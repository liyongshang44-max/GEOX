const fs = require('node:fs');
const assert = require('node:assert/strict');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const qualification = json('docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-QUALIFICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-CANDIDATE-V1.json');
const adjudication = json('docs/frontend-productization/PFE-14-S4-PRODUCT-COMPLETENESS-ADJUDICATION-V1.json');
const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');

assert.equal(qualification.record_status, 'STATE_FORECAST_PRODUCTIZATION_QUALIFIED_NEXT_EXISTING_DATA_PRODUCTIZATION_AUTHORIZED_S4_NOT_EFFECTIVE');
assert.equal(qualification.qualified_subject_sha, 'dfa68752d41bfcd6be9d5da763370dc78d9f4f38');
assert.equal(qualification.focused_run_id, 31600089263);
assert.equal(qualification.cap07_lifecycle_run_id, 31600089325);
assert.equal(qualification.standard_ci_run_id, 31600089223);
assert.equal(qualification.frontend_runtime_page_audit_pass, true);
assert.equal(qualification.full_acceptance_pass, true);
assert.equal(qualification.commercial_mvp0_release_gate_pass, true);
assert.equal(qualification.protected_main_merge_claimed, false);
assert.equal(qualification.state_forecast_productization_qualified, true);
assert.equal(qualification.underlying_data_contract_expanded, false);
assert.equal(qualification.state_value_unit_confidence_authorized, false);
assert.equal(qualification.normalized_state_status_authorized, false);
assert.equal(qualification.normalized_forecast_status_authorized, false);
assert.equal(qualification.forecast_horizon_authorized, false);
assert.equal(qualification.scenario_source_eligible_authorized, false);

assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.route_delta, 0);
assert.equal(candidate.api_client_delta, 0);
assert.equal(candidate.backend_delta, 0);
assert.equal(candidate.payload_inference_added, false);
assert.equal(candidate.synthetic_values_added, false);
assert.equal(adjudication.state_forecast_productization.authorized_next_candidate, true);

const next = qualification.evidence_health_productization;
assert.equal(next.authorized_next_candidate, true);
assert.equal(next.existing_get_only_sources_only, true);
assert.equal(next.reuse_operational_summary_authorized, true);
assert.equal(next.reuse_runtime_health_get_authorized, true);
assert.equal(next.reuse_trace_timeline_authorized, true);
assert.equal(next.new_route_authorized, false);
assert.equal(next.new_api_client_method_authorized, false);
assert.equal(next.new_backend_fields_authorized, false);
assert.equal(next.browser_freshness_derivation_authorized, false);
assert.equal(next.browser_degradation_derivation_authorized, false);
assert.equal(next.trace_payload_inference_authorized, false);
assert.equal(next.synthetic_values_authorized, false);

assert.equal(qualification.class_b_field_implementation_authorized, false);
assert.equal(qualification.class_c_field_implementation_authorized, false);
assert.equal(qualification.kbs_policy_change_authorized, false);
assert.equal(qualification.runtime_context_authorized, false);
assert.equal(qualification.shadow_online_label_authorized, false);
assert.equal(qualification.pfe14_s4_effective, false);

assert.equal(authority.record_status, 'S4_STATE_FORECAST_PRODUCTIZATION_QUALIFIED_EVIDENCE_HEALTH_PRODUCTIZATION_AUTHORIZED_NOT_EFFECTIVE');
assert.equal(authority.state_forecast_productization_qualified, true);
assert.equal(authority.state_forecast_productization_proof.subject_sha, qualification.qualified_subject_sha);
assert.equal(authority.state_forecast_productization_proof.all_pass, true);
assert.equal(authority.state_forecast_productization_proof.merged_to_protected_main, false);
assert.equal(authority.evidence_health_current_productization_authorized, true);
assert.equal(authority.evidence_health_existing_operational_summary_reuse_authorized, true);
assert.equal(authority.evidence_health_existing_runtime_health_get_reuse_authorized, true);
assert.equal(authority.evidence_health_existing_trace_timeline_reuse_authorized, true);
assert.equal(authority.evidence_health_new_route_authorized, false);
assert.equal(authority.evidence_health_new_api_client_method_authorized, false);
assert.equal(authority.evidence_health_new_backend_fields_authorized, false);
assert.equal(authority.evidence_health_browser_derivation_authorized, false);
assert.equal(authority.class_b_operational_extension_implementation_authorized, false);
assert.equal(authority.class_c_field_implementation_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(authority.authoritative_runtime_context_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(authority.first_legal_next_action, 'PFE_14_PRODUCTIZE_CURRENT_EVIDENCE_AND_RUNTIME_HEALTH_WITHOUT_NEW_DATA_FIELDS');

console.log(JSON.stringify({
  status: 'PASS',
  qualification: 'PFE-14-STATE-FORECAST-PRODUCTIZATION-QUALIFICATION-V1',
  qualified_subject_sha: qualification.qualified_subject_sha,
  state_forecast_productization_qualified: true,
  next_existing_data_productization_authorized: true,
  class_b_implementation_authorized: false,
  class_c_implementation_authorized: false,
  pfe14_s4_effective: false,
  next_action: qualification.next_action
}, null, 2));
