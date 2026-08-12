const fs = require('fs');
const assert = require('assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const qualification = json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-QUALIFICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-S4-SINGLE-SCOPE-OPERATIONAL-READBACK-CANDIDATE-V1.json');
const client = read('apps/web/src/api/mcftFieldTwinRuntime.ts');
const page = read('apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx');
const panel = read('apps/web/src/features/operator/fieldRuntime/Pfe14OperationalReadbackPanel.tsx');

const implementationAction = 'PFE_14_S4_IMPLEMENT_SINGLE_SCOPE_SCHEDULER_EVIDENCE_READBACK';
const adjudicatedSuccessorAction = 'PFE_14_PRODUCTIZE_CURRENT_CANONICAL_STATE_AND_FORECAST_WITHOUT_NEW_DATA_FIELDS';

if (authority.first_legal_next_action === implementationAction) {
  assert.equal(authority.record_status, 'S4_DEPENDENCY_PROVIDER_QUALIFIED_NARROW_FRONTEND_READBACK_AUTHORIZED');
} else {
  assert.equal(authority.first_legal_next_action, adjudicatedSuccessorAction);
  assert.equal(authority.record_status, 'S4_PARTIAL_FRONTEND_READBACK_QUALIFIED_COMPLETENESS_ADJUDICATED_NOT_EFFECTIVE');
  assert.equal(authority.partial_frontend_readback_proof?.subject_sha, '6b99afb119bb012246ab7c43c7a37ab47beb22ed');
  assert.equal(authority.partial_frontend_readback_proof?.pfe14_focused_run_id, 31565598839);
  assert.equal(authority.partial_frontend_readback_proof?.cap07_lifecycle_run_id, 31565598738);
  assert.equal(authority.partial_frontend_readback_proof?.standard_ci_run_id, 31565598703);
  assert.equal(authority.partial_frontend_readback_proof?.all_pass, true);
  assert.equal(authority.partial_frontend_readback_proof?.merged_to_protected_main, false);
  assert.equal(candidate.next_action_on_exact_head_pass, 'PFE_14_S4_PRODUCT_COMPLETENESS_ADJUDICATION');
}

assert.equal(authority.s4_page_source_authorized, true);
assert.equal(authority.s4_api_client_source_authorized, true);
assert.equal(authority.s4_route_source_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(authority.authoritative_runtime_context_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(qualification.frontend_consumption_authorized, true);
assert.deepEqual(qualification.qualified_models, ['scheduler_summary', 'evidence_availability']);

assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.route_delta, 0);
assert.equal(candidate.api_method, 'GET');
assert.equal(candidate.browser_scheduler_derivation, false);
assert.equal(candidate.browser_freshness_derivation, false);
assert.equal(candidate.runtime_mode_changed, false);
assert.equal(candidate.shadow_online_label_claimed, false);
assert.equal(candidate.per_slot_status_inferred, false);
assert.equal(candidate.pfe14_s4_effective, false);

assert(client.includes('export const readMcftOperationalSummary'));
assert(client.includes('getMcft<McftOperationalSummaryV1>(scope, "/operational-summary")'));
assert(client.includes('method: "GET"'));
assert(!/readMcftOperationalSummary[\s\S]{0,240}(POST|PUT|PATCH|DELETE)/.test(client));

assert(page.includes('import Pfe14OperationalReadbackPanel from "./Pfe14OperationalReadbackPanel"'));
assert(page.includes('<Pfe14OperationalReadbackPanel scope={runtime.request_scope} />'));
assert(page.includes('<dd>READ_ONLY_DETERMINISTIC_REPLAY</dd>'));

for (const forbidden of ['Date.now(', 'Date.parse(', 'new Date(', 'SHADOW_ONLINE', 'runtime_mode', 'tenant_sample', 'field_sample', 'season_sample', 'zone_sample']) {
  assert(!panel.includes(forbidden), `FORBIDDEN_OPERATIONAL_BROWSER_INFERENCE_OR_SAMPLE:${forbidden}`);
}
assert(panel.includes('evidence.freshness_status'));
assert(panel.includes('scheduler.scheduler_lag_ms'));
assert(panel.includes('evidence.eligibility_boundary?.slot_id'));
assert(panel.includes('Array.from({ length: 24 }'));
assert(panel.includes('data-evidence-boundary'));
assert(!panel.includes('data-slot-status'));
assert(!panel.includes('toFixed('), 'COVERAGE_RATIO_MUST_REMAIN_RAW_SERVER_VALUE');
assert(panel.includes('这里不会用回放或样例值替代运行数据'));
assert(panel.includes('不推断其他时隙状态'));

for (const forbiddenPath of ['/operator/shadow/', '/operator/mcft9/']) {
  assert(!client.includes(forbiddenPath));
  assert(!panel.includes(forbiddenPath));
}

console.log(JSON.stringify({
  status: 'PASS',
  candidate: 'PFE-14-S4-SINGLE-SCOPE-OPERATIONAL-READBACK-CANDIDATE-V1',
  exact_scope_source: candidate.exact_scope_source,
  qualified_models_consumed: candidate.qualified_models_consumed,
  authority_next_action: authority.first_legal_next_action,
  historical_candidate_proof_bound: authority.first_legal_next_action === adjudicatedSuccessorAction,
  browser_scheduler_derivation: false,
  browser_freshness_derivation: false,
  runtime_mode_changed: false,
  pfe14_s4_effective: false
}, null, 2));