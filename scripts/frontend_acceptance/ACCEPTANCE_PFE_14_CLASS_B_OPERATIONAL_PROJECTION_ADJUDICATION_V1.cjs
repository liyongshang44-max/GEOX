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
assert.deepEqual(ruling.proposed_next_candidate_fields, [
  'runtime_degradation_status',
  'degradation_reason_codes',
  'forecast_status',
  'scenario_source_eligible',
  'slot_window',
]);

// Runtime degradation is already a server-owned S4 health semantic.
assert(availability.includes('runtime_health_status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE"'));
assert(availability.includes('if (!input.checkpoint) return "UNAVAILABLE"'));
assert(availability.includes('input.freshness !== "FRESH" || input.lag > 0'));

// Missed-slot list is intentionally suppressed while an active slot exists;
// therefore list length is not a universal backlog count.
assert(scheduler.includes('async listMissedSlots'));
assert(scheduler.includes("AND state IN ('CLAIMED','RUNNING') LIMIT 1"));
assert(scheduler.includes('if (active.rows.length) return [];'));

// CAP04 owns Forecast status/scenario eligibility semantics and S4 read API
// revalidates Scenario-source Forecast payloads before attachment.
assert(forecastContract.includes('status: "COMPLETED" | "BLOCKED"'));
assert(forecastContract.includes('scenario_eligible: boolean'));
assert(forecastContract.includes('if (payload.status === "COMPLETED")'));
assert(forecastContract.includes('if (payload.scenario_eligible !== true)'));
assert(forecastContract.includes('if (payload.scenario_eligible !== false)'));
assert(readApi.includes('validateCap04ForecastRunPayloadV1'));
assert(readApi.includes('SOURCE_FORECAST_NOT_COMPLETED_72'));
assert(readApi.includes('CURRENT_FORECAST_BLOCKED'));

// S3 persistence proves one fixed O00-O23 schedule per exact six-key scope.
assert(scheduler.includes('slot_count: 24 as const'));
assert(scheduler.includes('schedule_start_logical_time'));
assert(scheduler.includes('EXACT_O00_O23_SLOT_SET_REQUIRED'));
assert(scheduler.includes('ORDERED_O00_O23_SLOT_SET_REQUIRED'));
assert(adapterConfig.includes('slot_interval_seconds: 3600'));
assert(migration.includes('next_slot_index smallint NOT NULL DEFAULT 0 CHECK (next_slot_index BETWEEN 0 AND 24)'));
assert(migration.includes("slot_id text NOT NULL CHECK (slot_id ~ '^O(0[0-9]|1[0-9]|2[0-3])$')"));
assert(migration.includes('UNIQUE (tenant_id, project_id, group_id, field_id, season_id, zone_id, slot_id)'));
assert.deepEqual(ruling.safe_provider_candidate_fields.slot_window.persisted_states, ['CLAIMED','RUNNING','COMPLETED','DEGRADED','FAILED']);
assert.equal(ruling.safe_provider_candidate_fields.slot_window.entry_count, 24);
assert.equal(ruling.safe_provider_candidate_fields.slot_window.absent_row_state, 'NOT_MATERIALIZED');
assert.equal(ruling.safe_provider_candidate_fields.slot_window.absent_row_failure_inference_authorized, false);

assert.equal(ruling.blocked_class_b_fields.backfill_status, 'DURABLE_BACKFILL_PROVENANCE_NOT_PRESENT');
assert.equal(ruling.blocked_class_b_fields.refresh_after_seconds, 'SCHEDULER_INTERVAL_IS_NOT_PRODUCT_REFRESH_POLICY');
assert.equal(ruling.blocked_class_b_fields.o00_o23_product_status, undefined);
assert.deepEqual(ruling.class_c_fields_unchanged, ['runtime_stage','latest_tick_started_at','restart_detected','recovery_status']);

console.log(JSON.stringify({
  status: 'PASS',
  adjudication: 'PFE-14-CLASS-B-OPERATIONAL-PROJECTION-ADJUDICATION-V1',
  safe_provider_candidate_fields: ruling.proposed_next_candidate_fields,
  blocked_class_b_field_count: Object.keys(ruling.blocked_class_b_fields).length,
  slot_window_authorized_for_candidate: true,
  absent_slot_semantics: 'NOT_MATERIALIZED_ONLY',
  class_b_implementation_authorized: false,
  class_c_implementation_authorized: false,
  pfe14_s4_effective: false,
  proposed_next_candidate: ruling.proposed_next_candidate
}, null, 2));