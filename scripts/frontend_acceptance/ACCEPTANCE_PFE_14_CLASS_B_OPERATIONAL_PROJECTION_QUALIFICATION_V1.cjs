const fs = require('node:fs');
const assert = require('node:assert/strict');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const q = json('docs/frontend-productization/PFE-14-CLASS-B-OPERATIONAL-PROJECTION-QUALIFICATION-V1.json');
const ruling = json('docs/frontend-productization/PFE-14-CLASS-B-OPERATIONAL-PROJECTION-ADJUDICATION-V1.json');
const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');

const fields = ['runtime_degradation_status','degradation_reason_codes','forecast_status','scenario_source_eligible','slot_window'];
assert.equal(q.record_status, 'CLASS_B_OPERATIONAL_PROJECTION_QUALIFIED_NARROW_PROVIDER_IMPLEMENTATION_AUTHORIZED_S4_NOT_EFFECTIVE');
assert.equal(q.qualified_subject_sha, 'd3bb7a4ff8509899981b41efe724a2c6b74540f5');
assert.equal(q.focused_run_id, 31607280419);
assert.equal(q.standard_ci_run_id, 31607280420);
assert.equal(q.frontend_runtime_page_audit_pass, true);
assert.equal(q.full_acceptance_pass, true);
assert.equal(q.commercial_mvp0_release_gate_pass, true);
assert.equal(q.all_pass, true);
assert.equal(q.protected_main_merge_claimed, false);
assert.deepEqual(q.qualified_provider_fields, fields);
assert.equal(q.provider_implementation.authorized, true);
assert.equal(q.provider_implementation.existing_endpoint, 'GET /api/v1/operator/twin/fields/:field_id/runtime/operational-summary');
assert.equal(q.provider_implementation.additive_response_extension_only, true);
assert.equal(q.provider_implementation.new_route_authorized, false);
assert.equal(q.provider_implementation.new_http_method_authorized, false);
assert.equal(q.provider_implementation.database_schema_change_authorized, false);
assert.equal(q.provider_implementation.canonical_write_authorized, false);
assert.equal(q.provider_implementation.scheduler_claim_or_recovery_authorized, false);
assert.equal(q.provider_implementation.frontend_consumption_authorized, false);
assert.equal(q.provider_implementation.kbs_policy_change_authorized, false);
assert.equal(q.generic_class_b_implementation_authorized, false);
assert.equal(q.class_c_implementation_authorized, false);
assert.equal(q.pfe14_s4_effective, false);
assert.equal(q.next_action, 'PFE_14_IMPLEMENT_NARROW_CLASS_B_DEGRADATION_FORECAST_SLOT_PROVIDER');

assert.deepEqual(ruling.proposed_next_candidate_fields, fields);
assert.equal(ruling.class_b_implementation_authorized, false);
assert.equal(ruling.class_c_implementation_authorized, false);
assert.equal(ruling.pfe14_s4_effective, false);

assert.equal(authority.record_status, 'S4_CLASS_B_OPERATIONAL_PROJECTION_QUALIFIED_NARROW_PROVIDER_IMPLEMENTATION_AUTHORIZED_NOT_EFFECTIVE');
assert.equal(authority.class_b_operational_projection_qualified, true);
assert.deepEqual(authority.class_b_narrow_provider_fields, fields);
assert.equal(authority.class_b_narrow_provider_implementation_authorized, true);
assert.equal(authority.class_b_narrow_provider_existing_get_route_required, true);
assert.equal(authority.class_b_narrow_provider_new_route_authorized, false);
assert.equal(authority.class_b_narrow_provider_new_http_method_authorized, false);
assert.equal(authority.class_b_narrow_provider_database_schema_change_authorized, false);
assert.equal(authority.class_b_narrow_provider_frontend_consumption_authorized, false);
assert.equal(authority.class_b_operational_extension_implementation_authorized, false);
assert.equal(authority.class_c_field_implementation_authorized, false);
assert.equal(authority.class_b_operational_projection_adjudication_proof.subject_sha, q.qualified_subject_sha);
assert.equal(authority.class_b_operational_projection_adjudication_proof.focused_run_id, q.focused_run_id);
assert.equal(authority.class_b_operational_projection_adjudication_proof.standard_ci_run_id, q.standard_ci_run_id);
assert.equal(authority.class_b_operational_projection_adjudication_proof.all_pass, true);
assert.equal(authority.class_b_operational_projection_adjudication_proof.merged_to_protected_main, false);
assert.equal(authority.first_legal_next_action, q.next_action);
assert.equal(authority.s4_effective, false);

console.log(JSON.stringify({status:'PASS', qualification:'PFE-14-CLASS-B-OPERATIONAL-PROJECTION-QUALIFICATION-V1', qualified_subject_sha:q.qualified_subject_sha, qualified_provider_fields:fields, narrow_provider_implementation_authorized:true, generic_class_b_implementation_authorized:false, frontend_consumption_authorized:false, pfe14_s4_effective:false, next_action:q.next_action}, null, 2));