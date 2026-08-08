#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1D_KBS_ENDPOINT_ROLE_MAP_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EA1C = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1C-KBS-JSON-SOURCE-MAP-PROBE-V1.json';
const EA1C_BLOB = 'ff935707b7b79ce94a7bf64b29bd3d96d08170ec';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1D-KBS-ENDPOINT-ROLE-MAP-PROBE-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1D_KBS_ENDPOINT_ROLE_MAP.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1d-kbs-endpoint-role-map.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1D_KBS_ENDPOINT_ROLE_MAP.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1D_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1D_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1D_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1D_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1D_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1cBlob = git(['rev-parse', `${BASE}:${EA1C}`]);
  assert.equal(ea1cBlob, EA1C_BLOB, 'EA1D_EXACT_EA1C_BASE_AUTHORITY_REQUIRED');

  const config = json(CONFIG);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.base_main_sha, '2157fd9b27939b78c7096136fd20ae96d46dae09');
  assert.equal(config.ea1c_authority_blob_sha, EA1C_BLOB);
  assert.equal(config.ea1c_probe_run_id, 31242861882);
  assert.equal(config.ea1c_probe_artifact_id, 9017569317);
  assert.equal(config.ea1c_probe_artifact_digest, 'sha256:bab961c6b7ba7e9ed8517f265ad67038184dd544d3d381315ed09f307cc0a7f6');
  assert.equal(config.probe_method, 'CAUSAL_NETWORK_ISOLATION_RENDER_ROLE_DELTA_V1');
  assert.deepEqual(config.endpoint_ids, [4, 19, 21, 22, 23, 25, 52, 55, 57, 61]);
  assert(config.roles.some((role) => role.role_id === 'SOIL_MOISTURE_10CM' && role.depth_mm === 100));
  assert(config.required_unique_bindings.includes('SOIL_MOISTURE_10CM'));
  assert.equal(config.soil_moisture_semantics.epistemic_class, 'OBSERVED');
  assert.equal(config.soil_moisture_semantics.spatial_support, 'NEAR_SITE_POINT_SUPPORT');
  assert.equal(config.soil_moisture_semantics.direct_field_equivalence, false);
  assert.equal(config.soil_moisture_semantics.direct_root_zone_equivalence, false);
  assert.equal(config.soil_moisture_semantics.root_zone_representativeness, 'PARTIAL');
  assert.equal(config.output_policy.raw_numeric_sensor_value_allowed, false);
  assert.equal(config.output_policy.rendered_dom_allowed, false);
  assert.equal(config.output_policy.raw_json_body_allowed, false);
  assert.equal(config.output_policy.unfiltered_rendered_text_allowed, false);

  for (const marker of [
    "body: '[]'",
    'countRoles(renderedText)',
    'role_delta_count',
    'EA1D_REQUIRED_UNIQUE_ROLE_BINDING_FAILED',
    'response_body_sha256',
    'latest_timestamp',
    'raw_numeric_sensor_values_emitted: false',
    'raw_json_body_persisted: false',
    'rendered_dom_persisted: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
    'mapping_is_formal_source_authority: false',
  ]) assert(probe.includes(marker), `EA1D_PROBE_MARKER_REQUIRED:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL']) {
    assert(!probe.includes(forbidden), `EA1D_DATABASE_OR_FORMAL_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1D_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(config)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1D_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1D_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1d_kbs_endpoint_role_map_static_acceptance_v1',
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
    schema_version: 'geox_mcft_cap09_ea1d_kbs_endpoint_role_map_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
