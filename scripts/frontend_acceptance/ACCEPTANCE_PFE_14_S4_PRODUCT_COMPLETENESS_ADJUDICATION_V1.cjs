const fs = require('node:fs');
const assert = require('node:assert/strict');

const adjudication = JSON.parse(fs.readFileSync('docs/frontend-productization/PFE-14-S4-PRODUCT-COMPLETENESS-ADJUDICATION-V1.json', 'utf8'));
const authority = JSON.parse(fs.readFileSync('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json', 'utf8'));
const taskbook = fs.readFileSync('docs/frontend-productization/PFE-14-SHADOW-ONLINE-OPERATOR-RUNTIME-CONSOLE-TASK.md', 'utf8');
const api = fs.readFileSync('apps/web/src/api/mcftFieldTwinRuntime.ts', 'utf8');
const ports = fs.readFileSync('apps/server/src/runtime/twin_runtime/ports.ts', 'utf8');
const availability = fs.readFileSync('apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts', 'utf8');
const config = fs.readFileSync('apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts', 'utf8');

const requiredFields = [
  'runtime_mode','runtime_stage','request_scope','latest_completed_slot','latest_tick_status','latest_tick_started_at','latest_tick_completed_at','next_target_slot','next_target_at','scheduler_lag_ms','missed_slot_count','backfill_status','restart_detected','recovery_status','latest_evidence_observed_at','latest_evidence_ingested_at','evidence_age_ms','freshness_status','coverage_ratio','maximum_gap_ms','future_excluded_count','late_evidence_count','out_of_order_count','runtime_degradation_status','degradation_reason_codes','state_status','forecast_status','scenario_source_eligible','response_started_at','refresh_after_seconds'
];

assert.equal(adjudication.schema_version, 'geox_pfe14_s4_product_completeness_adjudication_v1');
assert.equal(adjudication.proof.all_pass, true);
assert.equal(adjudication.proof.protected_main_merge_claimed, false);
assert.equal(adjudication.pfe14_s4_effective, false);
assert.equal(adjudication.state_forecast_productization.existing_get_only_data_only, true);
assert.equal(adjudication.state_forecast_productization.new_backend_fields_authorized, false);
assert.equal(adjudication.state_forecast_productization.synthetic_values_authorized, false);
assert.equal(adjudication.class_b_operational_extension.implementation_authorized, false);
assert.equal(adjudication.class_b_operational_extension.freshness_policy_change_authorized, false);
assert.equal(adjudication.class_b_operational_extension.kbs_source_change_authorized, false);
assert.equal(adjudication.class_c.implementation_authorized, false);

const byField = new Map(adjudication.fields.map((item) => [item.field, item]));
assert.equal(byField.size, requiredFields.length, 'FIELD_CLASSIFICATION_CARDINALITY_INVALID');
for (const field of requiredFields) {
  assert(taskbook.includes(field), `TASKBOOK_REQUIRED_FIELD_NOT_FOUND:${field}`);
  assert(byField.has(field), `ADJUDICATION_FIELD_MISSING:${field}`);
  assert(['A','B','C'].includes(byField.get(field).class), `ADJUDICATION_CLASS_INVALID:${field}`);
}
assert.deepEqual([...byField.keys()].sort(), [...requiredFields].sort());

for (const field of ['request_scope','latest_completed_slot','latest_tick_status','latest_tick_completed_at','next_target_slot','next_target_at','scheduler_lag_ms','latest_evidence_observed_at','latest_evidence_ingested_at','evidence_age_ms','freshness_status','coverage_ratio','maximum_gap_ms','future_excluded_count','late_evidence_count','out_of_order_count','response_started_at']) {
  assert.equal(byField.get(field).class, 'A', `EXPECTED_CLASS_A:${field}`);
}
for (const field of ['runtime_stage','latest_tick_started_at','restart_detected','recovery_status']) {
  assert.equal(byField.get(field).class, 'C', `EXPECTED_CLASS_C:${field}`);
  assert.equal(byField.get(field).current_source, null, `CLASS_C_SOURCE_MUST_BE_NULL:${field}`);
}

for (const token of ['readMcftOperationalSummary','McftSchedulerSummaryV1','McftEvidenceAvailabilityV1']) assert(api.includes(token), `OPERATIONAL_API_TOKEN_MISSING:${token}`);
assert(ports.includes('listMissedSlots'), 'MISSED_SLOT_READ_SEMANTIC_MISSING');
assert(availability.includes('runtime_health_status'), 'RUNTIME_HEALTH_SEMANTIC_MISSING');
assert(config.includes('runtime_mode: "SHADOW_ONLINE"'), 'SHADOW_ONLINE_CONFIG_MODE_MISSING');

assert.equal(authority.s4_effective, false, 'S4_MUST_REMAIN_NOT_EFFECTIVE');
assert.equal(authority.shadow_online_label_authorized, false, 'SHADOW_ONLINE_LABEL_MUST_REMAIN_BLOCKED');
assert.equal(authority.authoritative_runtime_context_authorized, false, 'RUNTIME_CONTEXT_MUST_REMAIN_BLOCKED');

console.log(JSON.stringify({
  status: 'PASS',
  required_field_count: requiredFields.length,
  class_A: adjudication.fields.filter((item) => item.class === 'A').length,
  class_B: adjudication.fields.filter((item) => item.class === 'B').length,
  class_C: adjudication.fields.filter((item) => item.class === 'C').length,
  pfe14_s4_effective: false,
  next_action: adjudication.next_action
}, null, 2));
