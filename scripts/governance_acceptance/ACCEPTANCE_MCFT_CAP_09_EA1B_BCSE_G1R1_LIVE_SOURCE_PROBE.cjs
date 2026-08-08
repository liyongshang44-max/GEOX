#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1B_BCSE_G1R1_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const EA1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const EA1_BLOB = 'a4329330cfae941a033d65f55e91b8ae8e96d862';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const PRIOR_PROBE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-KBS-CURRENT-WEATHER-MACHINE-PROBE-V1.json';
const PRIOR_PROBE_BLOB = '51adfc1a06f8015c60a64b5b7fc6f77e90830ec6';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1B-BCSE-G1R1-LIVE-SOURCE-PROBE-V1.json';
const PROBE = 'scripts/governance_acceptance/PROBE_MCFT_CAP_09_EA1B_BCSE_G1R1_SOURCES.mjs';

const FILES = [
  '.github/workflows/mcft-cap-09-ea1b-bcse-g1r1-live-source-probe.yml',
  CONFIG,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1B_BCSE_G1R1_LIVE_SOURCE_PROBE.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1B_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1B_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1B_RUNTIME_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1B_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1B_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const ea1BlobAtBase = git(['rev-parse', `${BASE}:${EA1}`]);
  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const priorProbeBlobAtBase = git(['rev-parse', `${BASE}:${PRIOR_PROBE}`]);
  assert.equal(ea1BlobAtBase, EA1_BLOB, 'EA1B_EXACT_EA1_BASE_AUTHORITY_REQUIRED');
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1B_EXACT_AMENDMENT_BASE_AUTHORITY_REQUIRED');
  assert.equal(priorProbeBlobAtBase, PRIOR_PROBE_BLOB, 'EA1B_EXACT_PRIOR_MACHINE_PROBE_AUTHORITY_REQUIRED');

  const config = json(CONFIG);
  const probe = read(PROBE);
  const priorProbe = json(PRIOR_PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(config.capability_line_id, 'MCFT-CAP-09');
  assert.equal(config.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(config.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(config.base_main_sha, '0ceb6b8b9c8205db4f4d4b0dec304c68af107c25');
  assert.equal(config.ea1_authority_blob_sha, EA1_BLOB);
  assert.equal(config.amendment_01_blob_sha, AMENDMENT_BLOB);
  assert.equal(config.prior_machine_probe_blob_sha, PRIOR_PROBE_BLOB);
  assert.equal(config.prior_machine_probe_ruling_consumed, 'KBS_MCSE_T1R1_TOWER_10CM_MACHINE_ACCESS_DOES_NOT_ESTABLISH_FIELD_OR_ROOT_ZONE_EQUIVALENCE');
  assert.equal(priorProbe.site_candidate_id, 'KBS_MCSE_T1R1');
  assert.equal(priorProbe.source_authority.direct_field_equivalence, false);
  assert.equal(priorProbe.source_authority.direct_root_zone_equivalence, false);
  assert.equal(priorProbe.qualification_effect.formal_source_authority_created, false);
  assert.equal(priorProbe.qualification_effect.qualified_formal_site, false);

  assert.equal(config.candidate_site_id, 'KBS_BCSE_G1R1');
  assert.equal(config.candidate_crop, 'corn');
  assert.equal(config.candidate_treatment, 'G1_CONTINUOUS_CORN');
  assert.equal(config.candidate_replicate, 'R1');
  assert.equal(config.probe_mode, 'READ_ONLY_EXTERNAL_HTTP_EXACT_HEAD');

  assert.equal(config.sources.soil_csv.plot, 'G1R1');
  assert.deepEqual(config.sources.soil_csv.required_depth_cm, [0, 30, 60]);
  assert.equal(config.sources.soil_csv.canonical_observation_depth_cm, 0);
  assert.equal(config.sources.soil_csv.epistemic_class, 'OBSERVED');
  assert.equal(config.sources.soil_csv.quantity_kind, 'VOLUMETRIC_WATER_CONTENT');
  assert.equal(config.sources.soil_csv.canonical_unit, 'fraction');
  assert.equal(config.sources.soil_csv.direct_state_equivalence, false);
  assert.equal(config.sources.soil_csv.root_zone_representativeness, 'PARTIAL');
  assert.equal(config.sources.weather_csv.support_class, 'NEAR_SITE_METEOROLOGICAL_SUPPORT');
  assert.equal(config.sources.weather_csv.direct_field_equivalence, false);
  assert.deepEqual(config.sources.weather_csv.required_columns, [
    'datetime_utc', 'solrad_avg', 'wind_speed', 'rh', 'airtmp_107_avg', 'barometer_avg', 'rain_mm',
  ]);

  assert.equal(config.live_thresholds.source_max_age_hours, 6);
  assert.equal(config.live_thresholds.continuity_window_hours, 30);
  assert.equal(config.live_thresholds.minimum_distinct_hourly_points, 24);
  assert.equal(config.raw_payload_policy.provider_payload_may_be_fetched_for_probe, true);
  assert.equal(config.raw_payload_policy.provider_payload_may_be_committed, false);
  assert.equal(config.raw_payload_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(config.raw_payload_policy.result_may_include_raw_values, false);
  assert.equal(config.raw_payload_policy.result_must_include_response_sha256, true);
  assert.equal(config.raw_payload_policy.public_presentation_or_publication_without_written_permission, false);

  for (const source of Object.values(config.sources)) {
    assert(/^https:\/\//.test(source.url), 'EA1B_HTTPS_SOURCE_REQUIRED');
  }
  for (const marker of [
    'READ_ONLY_EXTERNAL_HTTP_EXACT_HEAD',
    'SOIL_DEPTH_',
    'WEATHER_CONTINUITY_INSUFFICIENT_',
    'response_sha256',
    'raw_values_in_result: false',
    'raw_payloads_persisted_or_uploaded: false',
    'database_writes: 0',
    'formal_evidence_writes: 0',
    'formal_site_qualified_by_this_probe: false',
  ]) assert(probe.includes(marker), `EA1B_PROBE_MARKER_REQUIRED:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'pg.Pool', 'INSERT INTO', 'public.facts', 'GEOX_MCFT_CAP09_S6_DATABASE_URL']) {
    assert(!probe.includes(forbidden), `EA1B_PROBE_WRITE_OR_DATABASE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(config.record_status), 'EA1B_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(config)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1B_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1B_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1b_bcse_g1r1_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    ea1_blob_sha: ea1BlobAtBase,
    amendment_01_blob_sha: amendmentBlobAtBase,
    prior_machine_probe_blob_sha: priorProbeBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    candidate_site_id: config.candidate_site_id,
    prior_mcse_tower_probe_consumed_without_equivalence_upgrade: true,
    runtime_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    raw_provider_payload_committed: false,
    raw_provider_payload_uploaded_as_ci_artifact: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1b_bcse_g1r1_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
