const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const qualification = json('docs/frontend-productization/PFE-14-EVIDENCE-HEALTH-PRODUCTIZATION-QUALIFICATION-V1.json');
const ruling = json('docs/frontend-productization/PFE-14-CLASS-B-OPERATIONAL-PROJECTION-ADJUDICATION-V1.json');
const scheduler = read('apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts');
const availability = read('apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts');
const forecastContract = read('apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts');
const readApi = read('apps/server/src/services/mcft_field_twin_read_api_v1.ts');
const migration = read('apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql');
const adapterConfig = read('apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts');

assert.equal(authority.first_legal_next_action, 'PFE_14_ADJUDICATE_CLASS_B_OPERATIONAL_PRODUCT_PROJECTION');
assert.equal(authority.class_b_operational_projection_adjudication_authorized, true);
assert.equal(authority.class_b_operational_extension_implementation_authorized, false);
assert.equal(authority.class_c_field_implementation_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(qualification.class_b_projection_adjudication.authorized_next_candidate, true);
assert.equal(qualification.class_b_projection_adjudication.implementation_authorized, false);

assert.equal(ruling.record_status, 'ADJUDICATION_CANDIDATE_NO_IMPLEMENTATION_AUTHORITY');
assert.equal(ruling.runtime_effect, false);
assert.equal(ruling.backend_effect, false);
assert.equal(ruling.database_effect, false);
assert.equal(ruling.kbs_policy_effect, false);
assert.equal(ruling.class_b_implementation_authorized, false);
assert.equal(ruling.class_c_implementation_authorized, false);
assert.equal(ruling.pfe14_s4_effective, false);
assert.deepEqual(ruling.proposed_next_candidate_fields, ['runtime_degradation_status','degradation_reason_codes','forecast_status','scenario_source_eligible']);

assert(availability.includes('runtime_health_status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE"'));
assert(availability.includes('if (!input.checkpoint) return "UNAVAILABLE"'));
assert(availability.includes('input.freshness !== "FRESH" || input.lag > 0'));
assert(scheduler.includes('async listMissedSlots'));
assert(scheduler.includes('if (active) return []'));
assert(forecastContract.includes('status: "COMPLETED" | "BLOCKED"'));
assert(forecastContract.includes('scenario_eligible: boolean'));
assert(readApi.includes('CURRENT_FORECAST_COMPLETED_SCENARIO_ELIGIBILITY_INVALID'));
assert(readApi.includes('SCENARIO_SOURCE_FORECAST_NOT_ELIGIBLE'));
assert(migration.includes("CHECK (slot_id IN ('O00'"));
assert(migration.includes('PRIMARY KEY (tenant_id,project_id,group_id,field_id,season_id,zone_id,logical_time)'));
assert(adapterConfig.includes('slot_interval_seconds: 3600'));
assert.equal(ruling.blocked_class_b_fields.backfill_status, 'DURABLE_BACKFILL_PROVENANCE_NOT_PRESENT');
assert.equal(ruling.blocked_class_b_fields.o00_o23_product_status, 'EXACT_LOGICAL_TIME_WINDOW_IDENTITY_REQUIRED');
assert.equal(ruling.blocked_class_b_fields.refresh_after_seconds, 'SCHEDULER_INTERVAL_IS_NOT_PRODUCT_REFRESH_POLICY');
assert.deepEqual(ruling.class_c_fields_unchanged, ['runtime_stage','latest_tick_started_at','restart_detected','recovery_status']);

console.log(JSON.stringify({
  status: 'PASS',
  adjudication: 'PFE-14-CLASS-B-OPERATIONAL-PROJECTION-ADJUDICATION-V1',
  safe_provider_candidate_fields: ruling.proposed_next_candidate_fields,
  blocked_class_b_field_count: Object.keys(ruling.blocked_class_b_fields).length,
  class_b_implementation_authorized: false,
  class_c_implementation_authorized: false,
  pfe14_s4_effective: false,
  proposed_next_candidate: ruling.proposed_next_candidate
}, null, 2));
