const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'docs/frontend-productization/prototypes/PFE-14-STRUCTURE-PROTOTYPE-V1.html');
const DOC_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-14-STRUCTURE-PROTOTYPE-V1.md');
const CONTRACT_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-14-STRUCTURE-PROTOTYPE-V1.json');
const TRUTH_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-TRUTH-MATRIX-V1.json');
const AUTH_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-14-PROTOTYPE-AUTHORITY-V1.json');

const html = fs.readFileSync(HTML_PATH, 'utf8');
const doc = fs.readFileSync(DOC_PATH, 'utf8');
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
const truth = JSON.parse(fs.readFileSync(TRUTH_PATH, 'utf8'));
const authority = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));

assert.equal(contract.schema_version, 'geox_pfe14_structure_prototype_v1');
assert.equal(contract.record_status, 'REVIEW_PROTOTYPE_STRUCTURE_ONLY_NON_EFFECTIVE');
assert.equal(contract.runtime_effect, false);
assert.equal(contract.route_effect, false);
assert.equal(contract.api_effect, false);
assert.equal(contract.javascript_present, false);
assert.equal(contract.network_request_present, false);
assert.equal(contract.selected_scope_present, false);
assert.equal(contract.current_operational_value_present, false);
assert.equal(authority.prototype_policy_revision, 'v1.1_no_fabrication');
assert.equal(authority.artifact_classes.TARGET_STATE_PRODUCT_PROTOTYPE.may_use_design_sample_data, false);
assert.equal(truth.prototype_policy.sample_scope_values_allowed, false);
assert.equal(truth.prototype_policy.invented_runtime_values_allowed, false);

assert.equal(contract.surfaces.length, 12);
assert.equal(new Set(contract.surfaces.map((surface) => surface.id)).size, 12);
for (let i = 1; i <= 12; i += 1) {
  const id = `P${String(i).padStart(2, '0')}`;
  assert(html.includes(`data-screen-id="${id}"`), `MISSING_SCREEN:${id}`);
}

const allowedClasses = new Set([
  'CURRENT_STATIC_NONCLAIM',
  'CURRENT_API_VALUE',
  'ACCEPTED_ARTIFACT_VALUE',
  'UNAVAILABLE_AUTHORITY',
  'LABEL_ONLY'
]);
const valueElements = [...html.matchAll(/data-runtime-value="true"\s+data-value-class="([A-Z_]+)"/g)];
assert(valueElements.length > 0, 'NO_CLASSIFIED_VISIBLE_VALUES');
for (const match of valueElements) {
  assert(allowedClasses.has(match[1]), `INVALID_VISIBLE_VALUE_CLASS:${match[1]}`);
}

for (const token of [
  'tenant_sample',
  'project_sample',
  'group_sample',
  'field_sample',
  'season_sample',
  'zone_sample',
  'SHADOW_ONLINE_SAMPLE'
]) {
  assert(!html.includes(token), `FORBIDDEN_SAMPLE_TOKEN_IN_HTML:${token}`);
}

assert(!/<script\b/i.test(html), 'JAVASCRIPT_NOT_ALLOWED');
assert(!/\bfetch\s*\(/.test(html), 'NETWORK_FETCH_NOT_ALLOWED');
assert(!/XMLHttpRequest/.test(html), 'XHR_NOT_ALLOWED');
assert(!/<form\b/i.test(html), 'FORM_NOT_ALLOWED');
assert(!/<button\b/i.test(html), 'ACTION_BUTTON_NOT_ALLOWED');

const textOnly = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
assert(!/20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/.test(textOnly), 'INVENTED_ISO_TIMESTAMP_NOT_ALLOWED');
assert(!/\b\d+(?:\.\d+)?%\b/.test(textOnly), 'INVENTED_PERCENTAGE_NOT_ALLOWED');

for (const token of contract.current_static_nonclaims) {
  assert(html.includes(token), `CURRENT_STATIC_NONCLAIM_MISSING:${token}`);
}
assert(html.includes('目标态结构 / 当前无权威运行值'));
assert(html.includes('等待 MCFT-9 权威读合同'));
assert(html.includes('等待 Evidence Availability 权威读合同'));
assert(html.includes('等待 Scheduler Summary 权威读合同'));
assert(html.includes('中文 / English'));

assert(doc.includes('no selected six-key Scope') || doc.includes('no selected six-key Scope'.replace('no ', 'no ')));
assert(doc.includes('no synthetic timestamps'));
assert(doc.includes('no network request'));

console.log(JSON.stringify({
  status: 'PASS',
  prototype: 'PFE-14-STRUCTURE-PROTOTYPE-V1',
  surface_count: contract.surfaces.length,
  classified_visible_value_count: valueElements.length,
  selected_scope_present: false,
  current_operational_value_present: false,
  javascript_present: false,
  network_request_present: false,
  runtime_effect: false
}, null, 2));
