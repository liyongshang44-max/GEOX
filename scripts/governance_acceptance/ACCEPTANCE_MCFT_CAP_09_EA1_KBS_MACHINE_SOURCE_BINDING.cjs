#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1_KBS_MACHINE_SOURCE_BINDING_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EXPECTED_BASE = '0ceb6b8b9c8205db4f4d4b0dec304c68af107c25';
const PROBE_PATH = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_ACCESS.mjs';
const PROBE_BLOB = '82364e543d5e10277a3d8bc1d7cffd9384c53bd0';
const QUALIFICATION_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const QUALIFICATION_BLOB = 'a4329330cfae941a033d65f55e91b8ae8e96d862';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1-kbs-machine-source-binding.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-MACHINE-SOURCE-BINDING-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1_KBS_MACHINE_SOURCE_BINDING.cjs',
].sort();

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA1_KBS_BINDING_EXACT_THREE_FILE_BOUNDARY_REQUIRED');
  assert.equal(BASE, EXPECTED_BASE, 'EA1_KBS_BINDING_EXACT_PROTECTED_MAIN_BASE_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1_KBS_BINDING_RUNTIME_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1_KBS_BINDING_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1_KBS_BINDING_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  assert.equal(git(['rev-parse', `${BASE}:${PROBE_PATH}`]), PROBE_BLOB, 'EA1_KBS_BINDING_EXACT_MAIN_PROBE_BLOB_REQUIRED');
  assert.equal(git(['rev-parse', `${BASE}:${QUALIFICATION_PATH}`]), QUALIFICATION_BLOB, 'EA1_KBS_BINDING_EXACT_PREDECESSOR_QUALIFICATION_BLOB_REQUIRED');

  const authority = readJson('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-MACHINE-SOURCE-BINDING-V1.json');
  const signal = readJson('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.base_main_sha, EXPECTED_BASE);
  assert.equal(authority.predecessor_qualification_blob_sha, QUALIFICATION_BLOB);
  assert.equal(authority.exact_main_probe_script_blob_sha, PROBE_BLOB);
  assert.equal(authority.site_candidate_id, 'KBS_MCSE_T1R1');
  assert.equal(authority.source_binding.provider, 'KBS_LTER');
  assert.equal(authority.source_binding.official_surface, 'https://lter.kbs.msu.edu/current-weather/');
  assert.equal(authority.source_binding.access_method, 'OFFICIAL_PUBLIC_RENDERED_UI_WITH_FIRST_PARTY_JSON_FETCH_BACKING');
  assert.equal(authority.source_binding.nominal_depth_mm, 100);
  assert.equal(authority.source_binding.source_unit, 'percent_vwc');
  assert.equal(authority.source_binding.direct_field_equivalence, false);
  assert.equal(authority.source_binding.direct_root_zone_equivalence, false);
  assert.equal(authority.machine_access_ruling.required_probe_subject_sha, EXPECTED_BASE);
  assert.equal(authority.machine_access_ruling.required_probe_script_blob_sha, PROBE_BLOB);
  assert.equal(authority.machine_access_ruling.focused_workflow_must_checkout_exact_base_subject, true);
  assert.equal(authority.machine_access_ruling.raw_response_body_persisted, false);
  assert.equal(authority.machine_access_ruling.rendered_dom_persisted, false);
  assert.equal(authority.machine_access_ruling.sensor_value_published_in_artifact, false);
  assert.equal(authority.machine_access_ruling.hash_only_provenance_required, true);
  assert.equal(authority.machine_access_ruling.first_party_json_fetch_backing_discovered, true);
  assert.equal(authority.machine_access_ruling.individual_variate_role_binding_complete, false);
  assert.equal(authority.qualification_effect.formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.formal_eligible, false);
  assert.equal(authority.qualification_effect.qualified_formal_site, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);
  assert.equal(authority.qualification_effect.mcft_cap_09_complete, false);

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1_KBS_BINDING_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');

  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_machine_source_binding_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    exact_main_probe_blob_sha: PROBE_BLOB,
    predecessor_qualification_blob_sha: QUALIFICATION_BLOB,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    formal_window_started: false,
    exact_base_live_probe_required: true,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_machine_source_binding_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
