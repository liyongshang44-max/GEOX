#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_PROBE_STATIC_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1-kbs-current-weather-machine-probe.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-CURRENT-WEATHER-MACHINE-PROBE-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_PROBE.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_ACCESS.mjs',
].sort();

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function json(relative) {
  return JSON.parse(read(relative));
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA1_KBS_PROBE_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1_KBS_PROBE_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1_KBS_PROBE_RUNTIME_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1_KBS_PROBE_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1_KBS_PROBE_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const authority = json('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-CURRENT-WEATHER-MACHINE-PROBE-V1.json');
  const probe = read('scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1_KBS_CURRENT_WEATHER_MACHINE_ACCESS.mjs');
  const packageJson = json('package.json');
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.base_main_sha, '96a505e959895ac1e2f980cc2887d74177dcae2b');
  assert.equal(authority.site_candidate_id, 'KBS_MCSE_T1R1');
  assert.equal(authority.source_authority.official_page, 'https://lter.kbs.msu.edu/current-weather/');
  assert.equal(authority.source_authority.direct_field_equivalence, false);
  assert.equal(authority.source_authority.direct_root_zone_equivalence, false);
  assert.equal(authority.probe_method.method_id, 'OFFICIAL_WEB_UI_BROWSER_RENDER_V1');
  assert.equal(authority.probe_method.raw_response_body_persisted, false);
  assert.equal(authority.probe_method.rendered_dom_persisted, false);
  assert.equal(authority.probe_method.sensor_value_published_in_artifact, false);
  assert.equal(authority.qualification_effect.protected_main_exact_sha_probe_required, true);
  assert.equal(authority.qualification_effect.formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.formal_eligible, false);
  assert.equal(authority.qualification_effect.qualified_formal_site, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);

  assert.equal(packageJson.devDependencies['@playwright/test'], '^1.60.0', 'EA1_KBS_PROBE_PLAYWRIGHT_DEPENDENCY_REQUIRED');
  for (const marker of [
    "const SOURCE_URL = 'https://lter.kbs.msu.edu/current-weather/'",
    "const OFFICIAL_HOST = 'lter.kbs.msu.edu'",
    "const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null",
    "raw_response_body_persisted: false",
    "rendered_dom_persisted: false",
    "raw_sensor_value_published_in_result: false",
    "database_connection_opened: false",
    "database_write_count: 0",
    "formal_evidence_write_count: 0",
    "formal_eligible: false",
    "qualified_formal_site: false",
    "formal_window_started: false",
  ]) assert(probe.includes(marker), `EA1_KBS_PROBE_MARKER_MISSING:${marker}`);

  for (const forbidden of [
    "from 'pg'",
    'from "pg"',
    'DATABASE_URL',
    'POSTGRES',
    'INSERT INTO',
    'UPDATE public.',
    'DELETE FROM',
    'public.facts',
  ]) assert(!probe.includes(forbidden), `EA1_KBS_PROBE_DATABASE_PATH_FORBIDDEN:${forbidden}`);

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1_KBS_PROBE_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');

  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_current_weather_machine_probe_static_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    formal_window_started: false,
    live_probe_required: true,
    exact_main_probe_required: true,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1_kbs_current_weather_machine_probe_static_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
