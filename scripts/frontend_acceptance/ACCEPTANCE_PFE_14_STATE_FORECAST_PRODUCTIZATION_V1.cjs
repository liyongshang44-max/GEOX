const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const adjudication = json('docs/frontend-productization/PFE-14-S4-PRODUCT-COMPLETENESS-ADJUDICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-STATE-FORECAST-PRODUCTIZATION-CANDIDATE-V1.json');
const page = read('apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx');
const panels = read('apps/web/src/features/operator/fieldRuntime/Pfe14StateForecastProductPanels.tsx');

assert.equal(authority.state_forecast_current_canonical_productization_authorized, true);
assert.equal(authority.state_forecast_new_backend_fields_authorized, false);
assert.equal(authority.state_forecast_payload_inference_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);
assert.equal(authority.authoritative_runtime_context_authorized, false);
assert.equal(authority.s4_effective, false);
assert.equal(authority.first_legal_next_action, 'PFE_14_PRODUCTIZE_CURRENT_CANONICAL_STATE_AND_FORECAST_WITHOUT_NEW_DATA_FIELDS');
assert.equal(adjudication.state_forecast_productization.authorized_next_candidate, true);
assert.equal(adjudication.state_forecast_productization.existing_get_only_data_only, true);
assert.equal(adjudication.state_forecast_productization.new_backend_fields_authorized, false);
assert.equal(adjudication.state_forecast_productization.payload_inference_authorized, false);
assert.equal(adjudication.state_forecast_productization.synthetic_values_authorized, false);

assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.route_delta, 0);
assert.equal(candidate.api_client_delta, 0);
assert.equal(candidate.backend_delta, 0);
assert.equal(candidate.database_delta, 0);
assert.equal(candidate.current_get_only_data_only, true);
assert.equal(candidate.payload_parsing_added, false);
assert.equal(candidate.payload_inference_added, false);
assert.equal(candidate.browser_clock_semantics_added, false);
assert.equal(candidate.synthetic_values_added, false);
assert.equal(candidate.scenario_eligibility_inferred_from_attachment, false);
assert.equal(candidate.pfe14_s4_effective, false);

assert(page.includes('Pfe14StateProductPanel'));
assert(page.includes('Pfe14ForecastProductPanel'));
assert(page.includes('<Pfe14StateProductPanel page={bundle.collection} />'));
assert(page.includes('<Pfe14ForecastProductPanel runtime={bundle.runtime} page={bundle.collection} />'));
assert(page.includes('<dd>READ_ONLY_DETERMINISTIC_REPLAY</dd>'));

for (const required of [
  'page.items',
  'item.logical_time',
  'item.attachment_status',
  'runtime.current_tick_forecast_result',
  'runtime.latest_successful_forecast',
  'runtime.scenario_source_forecast',
  'State ≠ Sensor Reading',
  'Forecast is not Fact.',
  'Forecast is not Recommendation.',
  'Forecast is not Action.',
  '<details',
]) assert(panels.includes(required), `PFE14_STATE_FORECAST_REQUIRED:${required}`);

for (const forbidden of [
  'fetch(',
  'readMcft',
  'Date.now(',
  'Date.parse(',
  'new Date(',
  'SHADOW_ONLINE',
  'runtime_mode',
  'tenant_sample',
  'field_sample',
  'season_sample',
  'zone_sample',
]) assert(!panels.includes(forbidden), `PFE14_STATE_FORECAST_FORBIDDEN:${forbidden}`);

assert(panels.includes('当前产品读合同未暴露'));
assert(panels.includes('不会以挂接对象存在替代权威 verdict'));
assert(!/toFixed\s*\(/.test(panels), 'NO_NUMERIC_PRESENTATION_INFERENCE');
assert(!/\bconfidence\s*[:=]\s*[0-9]/i.test(panels), 'NO_CONFIDENCE_FABRICATION');

console.log(JSON.stringify({
  status: 'PASS',
  candidate: 'PFE-14-STATE-FORECAST-PRODUCTIZATION-CANDIDATE-V1',
  route_delta: 0,
  api_client_delta: 0,
  backend_delta: 0,
  payload_inference: false,
  synthetic_values: false,
  scenario_eligibility_inferred: false,
  pfe14_s4_effective: false,
  next_action: candidate.next_action_on_exact_head_pass
}, null, 2));
