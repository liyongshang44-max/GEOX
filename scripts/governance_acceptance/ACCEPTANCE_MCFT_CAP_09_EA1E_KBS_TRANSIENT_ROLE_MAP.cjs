#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1E_KBS_TRANSIENT_ROLE_MAP_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EA1C = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1C-KBS-JSON-SOURCE-MAP-PROBE-V1.json';
const EA1C_BLOB = 'ff935707b7b79ce94a7bf64b29bd3d96d08170ec';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1E-KBS-TRANSIENT-ROLE-MAP-PROBE-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1E_KBS_TRANSIENT_ROLE_MAP.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1e-kbs-transient-role-map.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1E_KBS_TRANSIENT_ROLE_MAP.cjs',
  PROBE,
].sort();

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA1E_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1E_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1E_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1E_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1E_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1cBlob = git(['rev-parse', `${BASE}:${EA1C}`]);
  assert.equal(ea1cBlob, EA1C_BLOB, 'EA1E_EXACT_EA1C_BASE_AUTHORITY_REQUIRED');

  const config = json(CONFIG);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.base_main_sha, '2157fd9b27939b78c7096136fd20ae96d46dae09');
  assert.equal(config.ea1c_authority_blob_sha, EA1C_BLOB);
  assert.equal(config.probe_method, 'NORMAL_PAGE_TRANSIENT_VALUE_MATCH_WITH_CAUSAL_AIR_TEMPERATURE_ANCHOR_V1');
  assert.deepEqual(config.high_frequency_endpoint_ids, [19, 21, 22, 23, 25, 52, 55, 57]);
  assert.deepEqual(config.excluded_daily_endpoint_ids, [4, 61]);
  assert.equal(config.causal_anchor.endpoint_id, 55);
  assert.equal(config.causal_anchor.role_id, 'AIR_TEMPERATURE');
  assert.equal(config.causal_anchor.required_role_delta, 1);
  assert.equal(config.freshness.mapped_endpoint_max_age_minutes, 30);
  assert.equal(config.freshness.future_timestamp_tolerance_minutes, 5);
  assert.deepEqual(Object.keys(config.transforms).sort(), [
    'CELSIUS_TO_FAHRENHEIT_V1',
    'DIRECT_V1',
    'FRACTION_TO_PERCENT_V1',
    'MPS_TO_MPH_V1',
  ]);
  assert.deepEqual(config.roles.map((role) => role.role_id), [
    'AIR_TEMPERATURE',
    'WIND_SPEED_3M',
    'WIND_SPEED_10M',
    'RELATIVE_HUMIDITY',
    'SOIL_TEMPERATURE_BARE_5CM',
    'SOIL_MOISTURE_10CM',
  ]);
  assert.equal(config.matching_policy.display_precision_drives_tolerance, true);
  assert.equal(config.matching_policy.require_unique_endpoint_per_role, true);
  assert.equal(config.matching_policy.require_unique_global_one_to_one_assignment, true);
  assert.equal(config.matching_policy.require_unique_transform_per_assigned_role, true);
  assert.equal(config.matching_policy.sensor_values_may_exist_only_in_process_memory, true);
  assert.equal(config.soil_moisture_semantics.epistemic_class, 'OBSERVED');
  assert.equal(config.soil_moisture_semantics.quantity_kind, 'VOLUMETRIC_WATER_CONTENT');
  assert.equal(config.soil_moisture_semantics.canonical_unit, 'fraction');
  assert.equal(config.soil_moisture_semantics.spatial_support, 'NEAR_SITE_POINT_SUPPORT');
  assert.equal(config.soil_moisture_semantics.measurement_depth_mm, 100);
  assert.equal(config.soil_moisture_semantics.direct_field_equivalence, false);
  assert.equal(config.soil_moisture_semantics.direct_root_zone_equivalence, false);
  assert.equal(config.soil_moisture_semantics.root_zone_representativeness, 'PARTIAL');
  assert.equal(config.output_policy.numeric_sensor_values_allowed, false);
  assert.equal(config.output_policy.raw_json_body_allowed, false);
  assert.equal(config.output_policy.rendered_dom_allowed, false);
  assert.equal(config.output_policy.unfiltered_rendered_text_allowed, false);

  for (const marker of [
    'causalAnchorCount',
    "body: '[]'",
    'latestFinitePoint',
    'displayTolerance',
    'CELSIUS_TO_FAHRENHEIT_V1',
    'MPS_TO_MPH_V1',
    'FRACTION_TO_PERCENT_V1',
    'enumerateAssignments',
    'EA1E_GLOBAL_UNIQUE_ASSIGNMENT_REQUIRED',
    'raw_numeric_sensor_values_emitted: false',
    'in_memory_numeric_values_discarded: true',
    'raw_json_body_persisted: false',
    'rendered_dom_persisted: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
    'mapping_is_formal_source_authority: false',
  ]) assert(probe.includes(marker), `EA1E_PROBE_MARKER_REQUIRED:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL']) {
    assert(!probe.includes(forbidden), `EA1E_DATABASE_OR_FORMAL_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1E_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(config)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1E_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1E_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1e_kbs_transient_role_map_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    ea1c_blob_sha: ea1cBlob,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1e_kbs_transient_role_map_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
