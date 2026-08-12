const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const stateForecastQualification = json('docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-QUALIFICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-CANDIDATE-V1.json');
const evidenceQualification = fs.existsSync('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1.json')
  ? json('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1.json') : null;
const page = read('apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx');
const panels = read('apps/web/src/features/operator/fieldRuntime/Pfe14EvidenceHealthProductPanels.tsx');
const client = read('apps/web/src/api/mcftFieldTwinRuntime.ts');

const candidateAction = 'PFE_14_PRODUCTIZE_CURRENT_EVIDENCE_AND_RUNTIME_HEALTH_WITHOUT_NEW_DATA_FIELDS';
const qualifiedAction = 'PFE_14_ADJUDICATE_CLASS_B_OPERATIONAL_PRODUCT_PROJECTION';
assert.ok([candidateAction, qualifiedAction].includes(authority.first_legal_next_action), 'UNRECOGNIZED_EVIDENCE_HEALTH_STAGE');
if (authority.first_legal_next_action === qualifiedAction) {
  assert(evidenceQualification, 'EVIDENCE_HEALTH_QUALIFICATION_REQUIRED');
  assert.equal(evidenceQualification.qualified_subject_sha, '9e6a60db8885d1d9e4ce73cb9b2cfe84b4970e5e');
  assert.equal(evidenceQualification.focused_run_id, 31602800157);
  assert.equal(evidenceQualification.cap07_lifecycle_run_id, 31602800202);
  assert.equal(evidenceQualification.standard_ci_run_id, 31602800138);
  assert.equal(evidenceQualification.protected_main_merge_claimed, false);
  assert.equal(authority.evidence_health_productization_proof.subject_sha, evidenceQualification.qualified_subject_sha);
  assert.equal(authority.evidence_health_productization_proof.all_pass, true);
  assert.equal(authority.evidence_health_productization_proof.merged_to_protected_main, false);
}

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
assert.equal(authority.s4_effective, false);
assert.equal(stateForecastQualification.evidence_health_productization.authorized_next_candidate, true);
assert.equal(stateForecastQualification.evidence_health_productization.existing_get_only_sources_only, true);
assert.equal(stateForecastQualification.evidence_health_productization.new_backend_fields_authorized, false);
assert.equal(stateForecastQualification.evidence_health_productization.browser_degradation_derivation_authorized, false);

for (const field of ['route_delta','api_client_method_delta','backend_delta','database_delta']) assert.equal(candidate[field], 0, `DELTA_MUST_BE_ZERO:${field}`);
for (const field of ['browser_freshness_derivation_added','browser_degradation_derivation_added','browser_provider_cadence_inference_added','coverage_percentage_semantic_added','trace_payload_inference_added','synthetic_values_added','missing_sources_inferred','runtime_degradation_status_inferred','degradation_reason_codes_inferred','missed_slot_count_inferred','backfill_status_inferred','restart_detected_inferred','recovery_status_inferred','shadow_online_label_claimed']) assert.equal(candidate[field], false, `INFERENCE_MUST_BE_FALSE:${field}`);
assert.equal(candidate.pfe14_s4_effective, false);

assert(client.includes('export const readMcftOperationalSummary'));
assert(page.includes('Pfe14EvidenceProductPanel'));
assert(page.includes('Pfe14RuntimeHealthProductPanel'));
assert(page.includes('routeKey === "evidence"'));
assert(page.includes('<Pfe14EvidenceProductPanel trace={bundle.trace} timeline={bundle.timeline} />'));
assert(page.includes('<Pfe14RuntimeHealthProductPanel health={bundle.health} />'));
assert(page.includes('return <EvidenceTrace bundle={bundle} />'));
assert(page.includes('<dd>READ_ONLY_DETERMINISTIC_REPLAY</dd>'));
for (const required of ['readMcftOperationalSummary','evidence.freshness_status','evidence.coverage_ratio','evidence.maximum_gap_ms','scheduler.scheduler_lag_ms','health.health_relationship','trace.nodes.length','timeline?.items.length','不会从 Trace 内容猜测缺失来源','PFE 不根据 scheduler lag 或 Evidence freshness 自行推导']) assert(panels.includes(required), `REQUIRED_PRODUCT_SOURCE_MISSING:${required}`);
for (const forbidden of ['fetch(','Date.now(','Date.parse(','new Date(','toFixed(','SHADOW_ONLINE','tenant_sample','field_sample','season_sample','zone_sample']) assert(!panels.includes(forbidden), `FORBIDDEN_BROWSER_INFERENCE_OR_SAMPLE:${forbidden}`);
assert(!panels.includes('Math.round('));
assert(!panels.includes('Math.floor('));

console.log(JSON.stringify({
  status: 'PASS',
  candidate: 'PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-CANDIDATE-V1',
  historical_candidate_proof_bound: authority.first_legal_next_action === qualifiedAction,
  evidence_server_verdict_only: true,
  runtime_health_signals_not_combined: true,
  class_b_inference: false,
  class_c_inference: false,
  pfe14_s4_effective: false,
  next_action: authority.first_legal_next_action
}, null, 2));
