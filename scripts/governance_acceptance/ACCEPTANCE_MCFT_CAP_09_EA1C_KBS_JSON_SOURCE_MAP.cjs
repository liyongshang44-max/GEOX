#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1C_KBS_JSON_SOURCE_MAP_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EA1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const EA1_BLOB = 'a4329330cfae941a033d65f55e91b8ae8e96d862';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const PRIOR = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-CURRENT-WEATHER-MACHINE-PROBE-V1.json';
const PRIOR_BLOB = '51adfc1a06f8015c60a64b5b7fc6f77e90830ec6';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1C-KBS-JSON-SOURCE-MAP-PROBE-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1C_KBS_JSON_SOURCE_MAP.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1c-kbs-json-source-map.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1C_KBS_JSON_SOURCE_MAP.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1C_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1C_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1C_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1C_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1C_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1Blob = git(['rev-parse', `${BASE}:${EA1}`]);
  const amendmentBlob = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const priorBlob = git(['rev-parse', `${BASE}:${PRIOR}`]);
  assert.equal(ea1Blob, EA1_BLOB, 'EA1C_EXACT_EA1_BASE_AUTHORITY_REQUIRED');
  assert.equal(amendmentBlob, AMENDMENT_BLOB, 'EA1C_EXACT_AMENDMENT_BASE_AUTHORITY_REQUIRED');
  assert.equal(priorBlob, PRIOR_BLOB, 'EA1C_EXACT_PRIOR_MACHINE_PROBE_REQUIRED');

  const config = json(CONFIG);
  const prior = json(PRIOR);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.base_main_sha, '0ceb6b8b9c8205db4f4d4b0dec304c68af107c25');
  assert.equal(config.ea1_authority_blob_sha, EA1_BLOB);
  assert.equal(config.amendment_01_blob_sha, AMENDMENT_BLOB);
  assert.equal(config.prior_machine_probe_blob_sha, PRIOR_BLOB);
  assert.equal(config.source_url, 'https://lter.kbs.msu.edu/current-weather/');
  assert.equal(config.official_host, 'lter.kbs.msu.edu');
  assert.equal(config.endpoint_path_prefix, '/weather/variates/');
  assert.deepEqual(config.previously_observed_endpoint_ids, [4, 19, 21, 22, 23, 25, 52, 55, 57, 61]);
  assert.equal(config.qualification_semantics.soil_moisture_epistemic_class, 'OBSERVED');
  assert.equal(config.qualification_semantics.soil_moisture_spatial_support, 'NEAR_SITE_POINT_SUPPORT');
  assert.equal(config.qualification_semantics.soil_moisture_depth_mm, 100);
  assert.equal(config.qualification_semantics.soil_moisture_direct_field_equivalence, false);
  assert.equal(config.qualification_semantics.soil_moisture_direct_root_zone_equivalence, false);
  assert.equal(config.qualification_semantics.soil_moisture_root_zone_representativeness, 'PARTIAL');
  assert.equal(config.qualification_semantics.machine_source_mapping_is_not_formal_authority, true);
  assert.equal(config.output_policy.raw_numeric_sensor_values_allowed, false);
  assert.equal(config.output_policy.raw_json_body_allowed, false);
  assert.equal(config.output_policy.rendered_dom_allowed, false);
  assert.equal(config.output_policy.unfiltered_string_values_allowed, false);

  assert.equal(prior.source_authority.direct_field_equivalence, false);
  assert.equal(prior.source_authority.direct_root_zone_equivalence, false);
  assert.equal(prior.qualification_effect.formal_source_authority_created, false);
  assert.equal(prior.qualification_effect.qualified_formal_site, false);

  for (const marker of [
    'schemaSummary',
    'approved_metadata_tokens',
    'timestamp_count_detected',
    'response_body_sha256',
    'raw_numeric_sensor_values_emitted: false',
    'raw_unfiltered_strings_emitted: false',
    'raw_json_body_persisted: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
    'qualified_formal_site: false',
  ]) assert(probe.includes(marker), `EA1C_PROBE_MARKER_REQUIRED:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL']) {
    assert(!probe.includes(forbidden), `EA1C_DATABASE_OR_FORMAL_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1C_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(config)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1C_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1C_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1c_kbs_json_source_map_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    ea1_blob_sha: ea1Blob,
    amendment_01_blob_sha: amendmentBlob,
    prior_machine_probe_blob_sha: priorBlob,
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
    schema_version: 'geox_mcft_cap09_ea1c_kbs_json_source_map_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
