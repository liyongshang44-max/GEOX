const fs = require('fs');
const assert = require('assert/strict');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const qualification = json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-CANDIDATE-V1.json');
const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const dependency = json('docs/frontend-productization/PFE-14-MCFT-09-DEPENDENCY-MAP.json');

assert.equal(qualification.record_status, 'PROVIDER_QUALIFIED_NARROW_FRONTEND_CONSUMPTION_AUTHORIZED_S4_NOT_EFFECTIVE');
assert.equal(qualification.qualified_subject_sha, '8841cb8adbbc6829bac773bd8252fa4d675da031');
assert.equal(qualification.focused_run_id, 31563462731);
assert.equal(qualification.artifact_id, 9128580507);
assert.equal(qualification.artifact_digest, 'sha256:f1ccde58651a14af46674d67440fdb234abb561617bb3542361cc92caaa2c05a');
assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.read_only, true);
assert.equal(candidate.frontend_consumption_authorized, false, 'CANDIDATE_RECORD_MUST_NOT_RETROACTIVELY_CLAIM_QUALIFICATION');
assert.deepEqual(qualification.qualified_models, ['scheduler_summary', 'evidence_availability']);
assert.equal(qualification.frontend_consumption_authorized, true);
assert.equal(qualification.frontend_api_client_change_authorized, true);
assert.equal(qualification.existing_field_runtime_page_change_authorized, true);
assert.equal(qualification.new_frontend_route_authorized, false);
assert.equal(qualification.runtime_context_authorized, false);
assert.equal(qualification.shadow_online_label_authorized, false);
assert.equal(qualification.per_slot_24h_state_authorized, false);
assert.equal(qualification.pfe14_s4_effective, false);

assert.equal(authority.dependency_provider_frontend_consumption_authorized, true);
assert.equal(authority.s4_page_source_authorized, true);
assert.equal(authority.s4_api_client_source_authorized, true);
assert.equal(authority.s4_route_source_authorized, false);
assert.equal(authority.scheduler_ui_authorized, true);
assert.equal(authority.evidence_freshness_ui_authorized, true);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(authority.authoritative_runtime_context_authorized, false);
assert.equal(authority.s4_runtime_claim_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(authority.first_legal_next_action, 'PFE_14_S4_IMPLEMENT_SINGLE_SCOPE_SCHEDULER_EVIDENCE_READBACK');

const s4 = dependency.slice_dependencies.find((item) => item.pfe_slice === 'PFE-14.S4');
assert(s4, 'PFE14_S4_DEPENDENCY_ROW_REQUIRED');
assert.equal(s4.dependency_satisfied, true);
assert.equal(s4.runtime_claim_allowed, false);
assert.equal(dependency.dependency_evidence.product_read_provider_qualified, true);
assert.equal(dependency.dependency_evidence.product_read_provider_subject_sha, qualification.qualified_subject_sha);

console.log(JSON.stringify({
  status: 'PASS',
  qualification: 'PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1',
  qualified_subject_sha: qualification.qualified_subject_sha,
  focused_run_id: qualification.focused_run_id,
  artifact_id: qualification.artifact_id,
  frontend_consumption_authorized: true,
  runtime_context_authorized: false,
  pfe14_s4_effective: false,
  next_action: authority.first_legal_next_action
}, null, 2));
