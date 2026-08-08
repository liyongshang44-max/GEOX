#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1_SITE_SOURCE_QUALIFICATION_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';

const FILES = [
  '.github/workflows/mcft-cap-09-ea1-site-source-qualification.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SOURCE-QUALIFICATION-MATRIX-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1_SITE_SOURCE_QUALIFICATION.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1_RUNTIME_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1_AMENDMENT_01_EXACT_BASE_AUTHORITY_REQUIRED');

  const qualification = readJson('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json');
  const matrix = readJson('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SOURCE-QUALIFICATION-MATRIX-V1.json');
  const signal = readJson('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(qualification.capability_line_id, 'MCFT-CAP-09');
  assert.equal(qualification.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(qualification.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION');
  assert.equal(qualification.base_main_sha, '5a7f2922bcf13c2cc4c76447862bc51d15c28c46');
  assert.equal(qualification.amendment_01_blob_sha, AMENDMENT_BLOB);
  assert.equal(qualification.qualification_policy, 'FAIL_CLOSED_NO_BEST_EFFORT_PROMOTION');
  assert.equal(qualification.qualified_formal_site, null);
  assert.equal(qualification.preferred_candidate, 'KBS_MCSE_T1R1');
  assert.equal(qualification.overall_status, 'INCOMPLETE_AUTHORITY');
  assert.equal(qualification.formal_window_started, false);
  assert.equal(qualification.formal_evidence_write_authorized, false);
  assert.equal(qualification.database_write_authorized, false);
  assert.equal(qualification.runtime_source_delta_authorized, false);
  assert.equal(qualification.mcft_cap_09_complete, false);

  const mcse = qualification.candidate_sites.find((item) => item.site_candidate_id === 'KBS_MCSE_T1R1');
  const km1 = qualification.candidate_sites.find((item) => item.site_candidate_id === 'US-KM1');
  const ne1 = qualification.candidate_sites.find((item) => item.site_candidate_id === 'US-Ne1');
  assert(mcse && km1 && ne1, 'EA1_REQUIRED_SITE_CANDIDATES_MISSING');
  assert.equal(mcse.qualification, 'INCOMPLETE_AUTHORITY');
  assert.equal(mcse.gates.exact_2026_crop_identity, 'PASS_CORN');
  assert.equal(mcse.gates.current_phenology_authority, 'PENDING');
  assert.equal(mcse.gates.contemporaneous_observed_soil_moisture, 'PENDING_MACHINE_FEED_AND_SPATIAL_AUTHORITY');
  assert.equal(mcse.spatial_authority.weather_station_direct_field_equivalence, false);
  assert.equal(mcse.spatial_authority.soil_station_direct_root_zone_equivalence, false);
  assert.equal(mcse.spatial_authority.rex_observations_eligible_as_ambient_field_truth, false);
  assert.equal(km1.qualification, 'INCOMPLETE_AUTHORITY');
  assert.equal(ne1.qualification, 'NOT_QUALIFIED');

  const byKey = new Map(matrix.source_records.map((item) => [item.source_key, item]));
  for (const key of [
    'KBS_MCSE_2026_PLOT_MAP',
    'KBS_AGLOG_CURRENT',
    'KBS_MCSE_PLOT_POLYGONS',
    'KBS_LTER_CURRENT_WEATHER',
    'KBS_LTER_RAW_HOURLY_WEATHER',
    'KBS_REX_HOURLY_VWC',
    'KBS_REX_EXPERIMENT_AUTHORITY',
    'ENVIROWEATHER_KBS_STATION',
    'HPRCC_AWDN_WEB_SERVICES',
    'NOAA_NCEP_GFS_0P25_HOURLY',
    'KBS_LTER_TERMS_OF_USE',
  ]) assert(byKey.has(key), `EA1_SOURCE_RECORD_REQUIRED:${key}`);

  for (const source of matrix.source_records) {
    assert(/^https:\/\//.test(source.source_url), `EA1_HTTPS_SOURCE_URL_REQUIRED:${source.source_key}`);
  }
  assert.equal(matrix.raw_provider_payloads_committed, false);
  assert.equal(byKey.get('KBS_MCSE_PLOT_POLYGONS').raw_geometry_redistributed, false);
  assert.equal(byKey.get('KBS_REX_HOURLY_VWC').qualification, 'NOT_ELIGIBLE_AS_AMBIENT_MCSE_FIELD_TRUTH');
  assert.equal(byKey.get('HPRCC_AWDN_WEB_SERVICES').formal_qc_ruling.E, 'FORBIDDEN_AS_OBSERVED_FORMAL_TRUTH');
  assert.equal(byKey.get('HPRCC_AWDN_WEB_SERVICES').formal_qc_ruling.R, 'FORBIDDEN_AS_OBSERVED_FORMAL_TRUTH');
  assert.equal(byKey.get('HPRCC_AWDN_WEB_SERVICES').formal_qc_ruling.e, 'FORBIDDEN_AS_OBSERVED_FORMAL_TRUTH');
  assert.equal(byKey.get('NOAA_NCEP_GFS_0P25_HOURLY').hourly_output_through_forecast_hour, 120);
  assert.equal(byKey.get('NOAA_NCEP_GFS_0P25_HOURLY').required_formal_points, 72);
  assert.equal(byKey.get('KBS_LTER_TERMS_OF_USE').repository_policy, 'NO_RAW_KBS_DATA_OR_FULL_PROVIDER_DATASETS_COMMITTED');
  assert.equal(matrix.source_gates.estimated_or_gap_filled_values_may_not_be_relabelled_observed, true);
  assert.equal(matrix.source_gates.near_site_weather_station_is_not_field_truth, true);
  assert.equal(matrix.source_gates.rex_manipulated_vwc_is_not_ambient_field_truth, true);
  assert.equal(matrix.overall_status, 'INCOMPLETE_AUTHORITY');

  for (const document of [qualification, matrix]) {
    assert(!signal.explicit_candidate_status_values.includes(document.record_status), 'EA1_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
    const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
    for (const [key, value] of Object.entries(document)) {
      assert(!(candidateBooleanKeys.has(key) && value === true), `EA1_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
      for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
        assert(!(new RegExp(pattern).test(key) && value === true), `EA1_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
      }
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1_site_source_qualification_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_01_blob_sha: amendmentBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_window_started: false,
    qualified_formal_site: null,
    preferred_candidate: qualification.preferred_candidate,
    overall_status: qualification.overall_status,
    next_blocker: matrix.next_blocker,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1_site_source_qualification_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
