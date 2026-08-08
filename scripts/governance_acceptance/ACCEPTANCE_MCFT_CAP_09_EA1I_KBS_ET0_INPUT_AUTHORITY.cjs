#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1I_KBS_ET0_INPUT_AUTHORITY_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AUTHORITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const EA1H = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1H-KBS-RAW-HOURLY-LIVE-PROBE-V1.json';
const EA1H_BLOB = 'ea17427e2ac870664a2a9166761b907dfe807daa';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1I_KBS_ET0_INPUT_AUTHORITY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1i-kbs-et0-input-authority.yml',
  AUTHORITY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1I_KBS_ET0_INPUT_AUTHORITY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1I_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1I_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1I_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1I_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1I_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const ea1hBlobAtBase = git(['rev-parse', `${BASE}:${EA1H}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1I_EXACT_AMENDMENT_AUTHORITY_REQUIRED');
  assert.equal(ea1hBlobAtBase, EA1H_BLOB, 'EA1I_EXACT_EA1H_AUTHORITY_REQUIRED');

  const authority = json(AUTHORITY);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.capability_line_id, 'MCFT-CAP-09');
  assert.equal(authority.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(authority.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(authority.base_main_sha, '06b5c61cfd8bb9a3c9fd5767a9a0be37b3aaebbd');
  assert.equal(authority.algorithm_authority.algorithm_id, 'ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1');
  assert.equal(authority.algorithm_authority.reference_surface, 'SHORT_CROP_GRASS_REFERENCE');
  assert.equal(authority.algorithm_authority.pressure_from_elevation.selected, true);
  assert.equal(authority.algorithm_authority.pressure_from_elevation.measured_barometer_path_selected, false);
  assert.equal(authority.algorithm_authority.pressure_from_elevation.equation, 'P_kPa=101.3*((293-0.0065*z_m)/293)^5.26');
  assert.equal(authority.algorithm_authority.wind_height_adjustment.source_height_m, 10);
  assert.equal(authority.algorithm_authority.wind_height_adjustment.target_height_m, 2);
  assert.equal(authority.algorithm_authority.wind_height_adjustment.equation, 'u2=uz*4.87/ln(67.8*z-5.42)');
  assert.equal(authority.algorithm_authority.solar_conversion.equation, 'Rs_MJ_m2_h=SolRad_AVG_W_m2*0.0036');

  assert.equal(authority.kbs_sources.raw_hourly.raw_solar_provider_unit_explicit_on_page, false);
  assert.equal(authority.kbs_sources.raw_hourly.raw_wind_provider_unit_explicit_on_page, false);
  assert.equal(authority.kbs_sources.raw_hourly.raw_ah_provider_unit_explicit_on_page, false);
  assert.equal(authority.kbs_sources.daily_climdb.role, 'HISTORICAL_CROSS_TABLE_UNIT_RECONCILIATION_ONLY');
  assert.equal(authority.kbs_sources.daily_climdb.current_freshness_authority, false);
  assert.equal(authority.kbs_sources.daily_all_variates.semantic_authority.ah, 'average daily absolute humidity, partial pressure');
  assert.equal(authority.kbs_sources.survey_elevation.elevation_m, 286.43);
  assert.equal(authority.kbs_sources.survey_elevation.exact_sensor_elevation_claimed, false);
  assert.equal(authority.kbs_sources.survey_elevation.selected_as_asce_site_elevation_support, true);

  assert.equal(authority.reconciliation_gates.solar_unit.candidate_raw_unit, 'W_per_m2');
  assert(authority.reconciliation_gates.solar_unit.minimum_matching_days >= 30);
  assert.equal(authority.reconciliation_gates.wind_unit.candidate_raw_unit, 'm_per_s');
  assert(authority.reconciliation_gates.wind_unit.minimum_matching_days >= 30);
  assert.equal(authority.reconciliation_gates.ah_unit.candidate_raw_unit, 'kPa');
  assert(authority.reconciliation_gates.ah_unit.minimum_recent_valid_comparison_hours >= 16);
  assert.equal(authority.reconciliation_gates.ah_unit.silent_unit_guessing_forbidden, true);
  assert(authority.reconciliation_gates.elevation.maximum_difference_to_independent_nearby_kbs_station_elevation_m <= 5);

  assert.equal(authority.qualification_effect.formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.historical_et0_derivation_implemented, false);
  assert.equal(authority.qualification_effect.qualified_formal_site, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);
  assert.equal(authority.data_use_policy.provider_payload_may_be_committed, false);
  assert.equal(authority.data_use_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(authority.data_use_policy.raw_numeric_values_may_be_emitted, false);
  assert.equal(authority.data_use_policy.public_data_republication_right_claimed, false);
  assert.equal(authority.data_use_policy.formal_runtime_use_right_established_by_probe, false);

  for (const nonclaim of [
    'NO_UNIT_BINDING_BY_MAGNITUDE_GUESS_ALONE',
    'NO_RAW_BAROMETER_USE_FOR_FORMAL_PRESSURE',
    'NO_RH_CLIPPING_OR_SILENT_IMPUTATION',
    'NO_HISTORICAL_ET0_OUTPUT_FROM_THIS_PROBE',
    'NO_FORMAL_SOURCE_AUTHORITY_FROM_PROBE_ALONE',
    'NO_DATABASE_WRITE',
    'NO_FORMAL_EVIDENCE_WRITE',
    'NO_RUNTIME_PRODUCT_SOURCE_DELTA',
    'NO_FORMAL_WINDOW_START',
    'NO_MCFT_CAP_09_COMPLETION',
  ]) assert(authority.hard_nonclaims.includes(nonclaim), `EA1I_HARD_NONCLAIM_REQUIRED:${nonclaim}`);

  for (const marker of [
    'RAW_HOURLY_DAILY_INTEGRAL_VS_CLIMDB_DAILY_GLOBAL_RADIATION',
    'RAW_HOURLY_ARITHMETIC_MEAN_VS_CLIMDB_DAILY_WIND_MEAN',
    'KBS_PARTIAL_PRESSURE_SEMANTIC_PLUS_RH_T_PHYSICAL_IDENTITY',
    'raw_barometer_used: false',
    'historical_et0_derivation_implemented: false',
    'raw_provider_payload_persisted: false',
    'raw_provider_payload_uploaded: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
  ]) {
    const source = `${read(AUTHORITY)}\n${probe}`;
    assert(source.includes(marker), `EA1I_REQUIRED_MARKER_MISSING:${marker}`);
  }
  for (const forbidden of ['DATABASE_URL', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'pg.Pool', 'INSERT INTO public.facts', 'INSERT INTO facts']) {
    assert(!probe.includes(forbidden), `EA1I_DATABASE_OR_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1I_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(authority)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1I_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1I_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1i_kbs_et0_input_authority_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_blob_sha: amendmentBlobAtBase,
    ea1h_blob_sha: ea1hBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    historical_et0_output_created: false,
    formal_source_authority_created: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1i_kbs_et0_input_authority_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
