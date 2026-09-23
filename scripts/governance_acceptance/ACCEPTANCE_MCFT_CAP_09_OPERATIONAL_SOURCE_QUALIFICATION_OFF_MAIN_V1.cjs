#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_OPERATIONAL_SOURCE_QUALIFICATION_OFF_MAIN_STATIC_RESULT.json');
const EXACT_BASE = 'cf6bf3e69f2d7f40e7586308f4d846b3350efb1c';
const BASE = String(process.env.MCFT_BASE_SHA || '').trim();
const DOC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-OPERATIONAL-SOURCE-QUALIFICATION-V1.md';
const EWX_CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ENVIROWEATHER-KBS-FIRST-SEEN-OBSERVER-V1.json';
const MRMS_CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-MRMS-OPERATIONAL-PRECIPITATION-QUALIFICATION-V1.json';
const EWX_PROBE = 'scripts/runtime_acceptance/OBSERVE_MCFT_CAP_09_ENVIROWEATHER_KBS_FIRST_SEEN.mjs';
const MRMS_PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_MRMS_OPERATIONAL_PRECIPITATION.py';
const ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_OPERATIONAL_SOURCE_QUALIFICATION_OFF_MAIN_V1.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-operational-source-qualification-off-main.yml';
const ALLOWED = [DOC, EWX_CONFIG, MRMS_CONFIG, EWX_PROBE, MRMS_PROBE, ACCEPTANCE, WORKFLOW].sort();

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  assert.equal(BASE, EXACT_BASE, 'SOURCE_QUALIFICATION_EXACT_CF6_BASE_REQUIRED');
  assert.equal(git(['rev-parse', `${BASE}^{commit}`]), EXACT_BASE, 'SOURCE_QUALIFICATION_BASE_COMMIT_REQUIRED');
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, ALLOWED, 'SOURCE_QUALIFICATION_EXACT_SEVEN_FILE_OFF_MAIN_BOUNDARY_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'SOURCE_QUALIFICATION_PRODUCTION_RUNTIME_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'SOURCE_QUALIFICATION_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'SOURCE_QUALIFICATION_AUTHORITY_REGISTRY_DELTA_FORBIDDEN');

  const ewx = json(EWX_CONFIG);
  const mrms = json(MRMS_CONFIG);
  assert.equal(ewx.exact_base_protected_main, EXACT_BASE);
  assert.equal(mrms.exact_base_protected_main, EXACT_BASE);
  assert.equal(ewx.record_status, 'OFF_MAIN_SOURCE_QUALIFICATION_ONLY_NOT_RUNTIME_AUTHORITY');
  assert.equal(mrms.record_status, 'OFF_MAIN_SOURCE_QUALIFICATION_ONLY_NOT_RUNTIME_AUTHORITY');
  assert.equal(ewx.source_page, 'https://enviroweather.msu.edu/stations/kbs');
  assert.equal(ewx.station_slug, 'kbs');
  assert.equal(ewx.official_api.base_url, 'https://api.enviroweather.msu.edu/ewx-api/api');
  assert.equal(ewx.official_api.documentation_repository, 'enviroweather/enviroweather_py');
  assert.equal(ewx.official_api.documentation_commit, 'e4c2d910b7e82bbbfde987bad78dfdbb482bd106');
  assert.equal(ewx.output_policy.raw_numeric_observation_values_allowed, false);
  assert.equal(ewx.output_policy.database_write_allowed, false);
  assert.equal(ewx.output_policy.runtime_write_allowed, false);
  assert.equal(ewx.output_policy.formal_write_allowed, false);
  assert.equal(ewx.watch.poll_seconds >= 120, true, 'SOURCE_QUALIFICATION_ENVIROWEATHER_POLL_TOO_AGGRESSIVE');
  assert.equal(ewx.watch.maximum_minutes <= 90, true, 'SOURCE_QUALIFICATION_ENVIROWEATHER_BOUNDED_WATCH_REQUIRED');

  assert.deepEqual(mrms.products.map((p) => p.product_id), ['RadarOnly_QPE_15M', 'RadarOnly_QPE_01H', 'MultiSensor_QPE_01H_Pass1']);
  assert(mrms.products.every((p) => p.directory.startsWith('https://mrms.ncep.noaa.gov/2D/')), 'SOURCE_QUALIFICATION_MRMS_OFFICIAL_NCEP_DIRECTORY_REQUIRED');
  assert(mrms.products.every((p) => p.documented_missing === -1 && p.documented_no_coverage === -3), 'SOURCE_QUALIFICATION_MRMS_SENTINEL_CONTRACT_REQUIRED');
  assert.equal(mrms.spatial_probe.field_polygon_mapping_claimed, false);
  assert.equal(mrms.spatial_probe.area_weighted_aggregation_claimed, false);

  const ewxProbe = read(EWX_PROBE);
  const mrmsProbe = read(MRMS_PROBE);
  for (const probe of [ewxProbe, mrmsProbe]) {
    assert(!/DATABASE_URL|postgres(?:ql)?:\/\//i.test(probe), 'SOURCE_QUALIFICATION_DATABASE_BINDING_FORBIDDEN');
    assert(!/formal[_-]database[_-]url/i.test(probe), 'SOURCE_QUALIFICATION_FORMAL_DATABASE_BINDING_FORBIDDEN');
  }
  assert(ewxProbe.includes('raw_numeric_observation_values_emitted: false'));
  assert(mrmsProbe.includes('"raw_grid_values_emitted": False'));

  const workflow = read(WORKFLOW);
  assert(!/^\s*schedule\s*:/m.test(workflow), 'SOURCE_QUALIFICATION_OFF_MAIN_SCHEDULE_TRIGGER_FORBIDDEN');
  assert(!/^\s*push\s*:/m.test(workflow), 'SOURCE_QUALIFICATION_OFF_MAIN_PUSH_TRIGGER_FORBIDDEN');
  assert(workflow.includes('pull_request:'), 'SOURCE_QUALIFICATION_PR_TRIGGER_REQUIRED');
  assert(workflow.includes('MCFT_BASE_SHA: ${{ github.event.pull_request.base.sha }}'), 'SOURCE_QUALIFICATION_EXACT_PR_BASE_BINDING_REQUIRED');
  assert(!/secrets\./.test(workflow), 'SOURCE_QUALIFICATION_SECRET_BINDING_FORBIDDEN');

  const doc = read(DOC);
  assert(doc.includes('OFF-MAIN SOURCE QUALIFICATION ONLY — NOT RUNTIME AUTHORITY'));
  assert(doc.includes('commercial_use_authorized = UNKNOWN'));
  assert(doc.includes('first_seen'));

  write({
    schema_version: 'geox_mcft_cap09_operational_source_qualification_off_main_static_result_v1',
    status: 'PASS',
    exact_base_protected_main: EXACT_BASE,
    changed_file_count: changed.length,
    changed_files: changed,
    production_runtime_delta: 0,
    migration_delta: 0,
    database_binding_count: 0,
    secret_binding_count: 0,
    default_branch_schedule_added: false,
    runtime_authority_effect: false,
    formal_effect: false,
  });
  console.log(JSON.stringify({ status: 'PASS', changed_file_count: changed.length, exact_base: EXACT_BASE }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  write({
    schema_version: 'geox_mcft_cap09_operational_source_qualification_off_main_static_result_v1',
    status: 'FAIL',
    exact_base_protected_main: EXACT_BASE,
    error: message,
    runtime_authority_effect: false,
    formal_effect: false,
  });
  console.error(message);
  process.exitCode = 1;
}
