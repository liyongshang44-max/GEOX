#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1F_ENVIROWEATHER_API_DISCOVERY_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EA1E = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1E-KBS-TRANSIENT-ROLE-MAP-PROBE-V1.json';
const EA1E_BLOB = '69835c9877474f4d46980487f6e5789add803df2';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1F-ENVIROWEATHER-API-DISCOVERY-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1F_ENVIROWEATHER_API_DISCOVERY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1f-enviroweather-api-discovery.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1F_ENVIROWEATHER_API_DISCOVERY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1F_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1F_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1F_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1F_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1F_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1eBlob = git(['rev-parse', `${BASE}:${EA1E}`]);
  assert.equal(ea1eBlob, EA1E_BLOB, 'EA1F_EXACT_EA1E_BASE_AUTHORITY_REQUIRED');

  const config = json(CONFIG);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.base_main_sha, 'f5effeb9cb0f0337b9e29d4e466acb1e27238579');
  assert.equal(config.ea1e_authority_blob_sha, EA1E_BLOB);
  assert.equal(config.source_page, 'https://enviroweather.msu.edu/stations/kbs');
  assert.equal(config.expected_station_slug, 'kbs');
  assert.equal(config.expected_station_label, 'Hickory Corners');
  assert(config.allowed_response_hosts.includes('api.enviroweather.msu.edu'));
  assert.equal(config.probe_method, 'OFFICIAL_BROWSER_NETWORK_JSON_SURFACE_DISCOVERY_V1');
  assert(config.capability_patterns.solar_radiation.includes('solar'));
  assert(config.capability_patterns.rainfall.includes('rainfall'));
  assert.equal(config.output_policy.query_values_allowed, false);
  assert.equal(config.output_policy.raw_numeric_observation_values_allowed, false);
  assert.equal(config.output_policy.raw_json_body_allowed, false);
  assert.equal(config.output_policy.rendered_dom_allowed, false);
  assert.equal(config.output_policy.unfiltered_string_values_allowed, false);
  assert.equal(config.output_policy.query_values_or_credentials_allowed, false);

  for (const marker of [
    'safeRequestIdentity',
    'query_key_names',
    'query_values_emitted: false',
    'canonical_request_identity_sha256',
    'schemaSummary',
    'approved_metadata_tokens',
    'timestamp_count_detected',
    'solar_radiation_signal_present',
    'rainfall_signal_present',
    'raw_numeric_observation_values_emitted: false',
    'raw_json_body_persisted: false',
    'rendered_dom_persisted: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
    'discovery_creates_formal_source_authority: false',
  ]) assert(probe.includes(marker), `EA1F_PROBE_MARKER_REQUIRED:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL']) {
    assert(!probe.includes(forbidden), `EA1F_DATABASE_OR_FORMAL_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1F_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(config)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1F_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1F_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1f_enviroweather_api_discovery_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    ea1e_blob_sha: ea1eBlob,
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
    schema_version: 'geox_mcft_cap09_ea1f_enviroweather_api_discovery_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
