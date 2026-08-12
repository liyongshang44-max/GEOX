const fs = require('fs');
const assert = require('assert/strict');

const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const ruling = json('docs/frontend-productization/PFE-14-MCFT09-READ-DEPENDENCY-READJUDICATION-V1.json');
const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const dependency = json('docs/frontend-productization/PFE-14-MCFT-09-DEPENDENCY-MAP.json');
const providerCandidate = fs.existsSync('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-CANDIDATE-V1.json')
  ? json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-CANDIDATE-V1.json')
  : null;
const providerQualification = fs.existsSync('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1.json')
  ? json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1.json')
  : null;
const s5Registration = json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-REGISTRY-REGISTRATION-V1.json');
const schedulerMigration = read('apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql');
const schedulerAdapter = read('apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts');
const recoveryAdapter = read('apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts');
const evidenceAdapter = read('apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts');
const taskbook = read('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md');

assert.equal(ruling.record_status, 'DEPENDENCY_PROVIDER_CANDIDATE_AUTHORIZED_S4_NOT_EFFECTIVE');
assert.equal(ruling.mcft09_s4_effectiveness.effective, true);
assert.equal(ruling.mcft09_s4_effectiveness.subject_sha, s5Registration.s4_effective_subject_sha);
assert.equal(ruling.mcft09_s4_effectiveness.exact_sha_r2_run_id, s5Registration.s4_exact_sha_r2_run_id);
assert.equal(ruling.mcft09_s4_effectiveness.artifact_id, s5Registration.s4_exact_sha_artifact_id);
assert.equal(ruling.mcft09_s4_effectiveness.semantic_artifact_digest, s5Registration.s4_semantic_artifact_digest);

for (const table of ['twin_shadow_online_scheduler_cursor_v1','twin_shadow_online_scheduler_slot_v1']) {
  assert(schedulerMigration.includes(table), `SCHEDULER_TABLE_REQUIRED:${table}`);
}
assert(schedulerAdapter.includes('async listMissedSlots'), 'S3_READ_SEMANTICS_REQUIRED');
assert(recoveryAdapter.includes('async inspectOperationalState'), 'S4_OPERATIONAL_INSPECTION_REQUIRED');
assert(recoveryAdapter.includes('BEGIN TRANSACTION READ ONLY'), 'S4_INSPECTION_MUST_BE_READ_ONLY');
assert(evidenceAdapter.includes('Read-only boundary'), 'S2_EVIDENCE_READ_ONLY_BOUNDARY_REQUIRED');
for (const field of ['coverage_ratio_decimal','maximum_gap_seconds','freshest_observed_at','freshness_status','out_of_order_evidence_refs']) {
  assert(evidenceAdapter.includes(field), `EVIDENCE_SOURCE_FIELD_REQUIRED:${field}`);
}
assert(taskbook.includes('read-only Operator Runtime API family'), 'MCFT09_READ_ONLY_OPERATOR_API_AUTHORITY_REQUIRED');

assert.equal(ruling.provider_candidate.method, 'GET');
assert.equal(ruling.provider_candidate.writes_allowed, false);
assert.equal(ruling.provider_candidate.frontend_consumption_authorized, false);
assert.equal(ruling.dependency_satisfied, false);
assert.equal(authority.s4_effective, false);
assert.equal(authority.dependency_provider_backend_candidate_authorized, true);
assert.equal(authority.dependency_provider_get_only_required, true);
assert.equal(authority.s4_runtime_claim_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(ruling.next_action, 'MCFT_CAP_09_IMPLEMENT_GET_ONLY_PFE14_OPERATIONAL_READ_PROVIDER_CANDIDATE');

const stillAtInitialDependencyStage = authority.s4_page_source_authorized === false
  && authority.s4_api_client_source_authorized === false
  && authority.dependency_provider_frontend_consumption_authorized !== true;

if (stillAtInitialDependencyStage) {
  assert.equal(authority.s4_route_source_authorized, false);
  assert.equal(authority.scheduler_ui_authorized, false);
  assert.equal(authority.evidence_freshness_ui_authorized, false);
  assert.equal(dependency.dependency_evidence.product_read_provider_present, false);
  assert.equal(dependency.slice_dependencies.find((x) => x.pfe_slice === 'PFE-14.S4').dependency_satisfied, false);
} else {
  assert(providerCandidate, 'SUCCESSOR_PROVIDER_CANDIDATE_RECORD_REQUIRED');
  assert(providerQualification, 'SUCCESSOR_PROVIDER_QUALIFICATION_RECORD_REQUIRED');
  assert.equal(providerCandidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(providerCandidate.read_only, true);
  assert.equal(providerQualification.qualified_subject_sha, '8841cb8adbbc6829bac773bd8252fa4d675da031');
  assert.equal(providerQualification.focused_run_id, 31563462731);
  assert.equal(providerQualification.frontend_consumption_authorized, true);
  assert.equal(providerQualification.runtime_context_authorized, false);
  assert.equal(providerQualification.shadow_online_label_authorized, false);
  assert.equal(providerQualification.pfe14_s4_effective, false);
  assert.equal(authority.s4_route_source_authorized, false);
  assert.equal(authority.scheduler_ui_authorized, true);
  assert.equal(authority.evidence_freshness_ui_authorized, true);
  assert.equal(dependency.dependency_evidence.product_read_provider_qualified, true);
  assert.equal(dependency.dependency_evidence.product_read_provider_subject_sha, providerQualification.qualified_subject_sha);
  assert.equal(dependency.slice_dependencies.find((x) => x.pfe_slice === 'PFE-14.S4').dependency_satisfied, true);
  assert.equal(dependency.slice_dependencies.find((x) => x.pfe_slice === 'PFE-14.S4').runtime_claim_allowed, false);
}

console.log(JSON.stringify({
  status: 'PASS',
  ruling: 'PFE-14-MCFT09-READ-DEPENDENCY-READJUDICATION-V1',
  mcft09_s4_effective_subject_sha: ruling.mcft09_s4_effectiveness.subject_sha,
  provider_candidate_authorized: true,
  provider_method: 'GET',
  pfe14_s4_effective: false,
  historical_dependency_ruling_preserved: true,
  successor_provider_qualified: !stillAtInitialDependencyStage,
  next_action: stillAtInitialDependencyStage ? ruling.next_action : authority.first_legal_next_action
}, null, 2));