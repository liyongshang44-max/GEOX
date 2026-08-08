#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AUTHORITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const EA1I = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json';
const EA1I_BLOB = '47d41c48027e84285e934e7cda8af52fae6aa47d';
const EA1J = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json';
const EA1J_BLOB = 'eeb7ab49ee3270421efe4d6674305426074d1541';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1k-gfs-exact-cycle-72h-authority.yml',
  AUTHORITY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1K_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1K_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1K_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1K_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1K_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const ea1iBlobAtBase = git(['rev-parse', `${BASE}:${EA1I}`]);
  const ea1jBlobAtBase = git(['rev-parse', `${BASE}:${EA1J}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1K_EXACT_AMENDMENT_AUTHORITY_REQUIRED');
  assert.equal(ea1iBlobAtBase, EA1I_BLOB, 'EA1K_EXACT_EA1I_AUTHORITY_REQUIRED');
  assert.equal(ea1jBlobAtBase, EA1J_BLOB, 'EA1K_EXACT_EA1J_AUTHORITY_REQUIRED');

  const authority = json(AUTHORITY);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.capability_line_id, 'MCFT-CAP-09');
  assert.equal(authority.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(authority.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(authority.base_main_sha, '6567d7826368a76bff72579d9ce1b81a6a036410');
  assert.equal(authority.provider_authority.provider, 'NOAA_NCEP_NOMADS');
  assert.equal(authority.provider_authority.model, 'GFS');
  assert.equal(authority.provider_authority.grid, '0.25_degree_global_lat_lon');
  assert.deepEqual(authority.provider_authority.cycle_hours_utc, [0,6,12,18]);
  assert.equal(authority.provider_authority.hourly_qualification_horizon_max_lead, 120);

  const cycle = authority.tick_and_cycle_policy;
  assert.equal(cycle.canonical_point_count, 72);
  assert.equal(cycle.canonical_point_valid_time_rule, 'point[i].valid_time=T+(i+1)h');
  assert.equal(cycle.candidate_lead_start_rule, 'lead_start_hours=(T-cycle_time_hours)+1');
  assert.equal(cycle.candidate_lead_end_rule, 'lead_end_hours=(T-cycle_time_hours)+72');
  assert.equal(cycle.candidate_requires_lead_start_gte, 1);
  assert.equal(cycle.candidate_requires_lead_end_lte, 120);
  assert.equal(cycle.object_publication_authority, 'HTTP_LAST_MODIFIED');
  assert.equal(cycle.missing_last_modified, 'FAIL_CLOSED');
  assert.equal(cycle.retrieval_after_tick_may_prove_prior_availability_only_when_last_modified_lte_tick, true);
  assert.equal(cycle.valid_time_rewrite_forbidden, true);
  assert.equal(cycle.mechanical_f001_through_f072_selection_forbidden, true);
  assert.equal(cycle.future_file_waiting_for_selected_cycle_forbidden, true);

  assert.deepEqual(authority.required_field_inventory.map((field) => `${field.grib_var}|${field.level}`), [
    'TMP|2 m above ground',
    'RH|2 m above ground',
    'UGRD|10 m above ground',
    'VGRD|10 m above ground',
    'DSWRF|surface',
    'APCP|surface',
    'PRATE|surface',
  ]);
  assert.deepEqual(authority.temporal_semantics_policy.instantaneous_state_fields, ['TMP','RH','UGRD','VGRD']);
  assert.deepEqual(authority.temporal_semantics_policy.statistical_window_fields, ['DSWRF','APCP','PRATE']);
  assert.equal(authority.temporal_semantics_policy.direct_hourly_eligibility_requires_exact_1h_window, true);
  assert.equal(authority.temporal_semantics_policy.multi_hour_average_or_accumulation_requires_frozen_normalization, true);
  assert.equal(authority.temporal_semantics_policy.unknown_or_unparseable_window_requires_frozen_normalization, true);
  assert.equal(authority.temporal_semantics_policy.apcp_direct_hourly_assumption_forbidden, true);
  assert.equal(authority.temporal_semantics_policy.prate_direct_hourly_assumption_forbidden, true);
  assert.equal(authority.temporal_semantics_policy.dswrf_direct_hourly_assumption_forbidden, true);
  assert.equal(authority.temporal_semantics_policy.precipitation_canonical_source_not_selected_by_this_probe, true);
  assert.equal(authority.temporal_semantics_policy.future_et0_solar_canonicalization_not_selected_by_this_probe, true);

  assert.equal(authority.future_et0_binding_boundary.same_exact_gfs_cycle_required_for_future_weather_and_future_et0, true);
  assert.equal(authority.future_et0_binding_boundary.wind_10m_to_2m_factor_from_ea1i, 0.747951075);
  assert.equal(authority.future_et0_binding_boundary.pressure_source, 'ASCE_ELEVATION_PATH_KBS_286_43M');
  assert.equal(authority.future_et0_binding_boundary.solar_w_m2_to_mj_m2_h_factor_from_ea1i, 0.0036);
  assert.equal(authority.future_et0_binding_boundary.solar_factor_may_be_applied_only_after_exact_temporal_window_normalization, true);
  assert.equal(authority.future_et0_binding_boundary.future_et0_values_generated_by_this_probe, false);

  assert.equal(authority.spatial_boundary.grid_cell_or_interpolation_method_selected_by_this_probe, false);
  assert.equal(authority.spatial_boundary.forecast_values_downloaded_by_this_probe, false);
  assert.equal(authority.probe_output_policy.grib_values_emitted, false);
  assert.equal(authority.probe_output_policy.grib_bodies_downloaded, false);
  assert.equal(authority.probe_output_policy.index_bodies_persisted_or_uploaded, false);
  assert.equal(authority.qualification_effect.future_weather_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.future_et0_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.forecast_canonicalization_implemented, false);
  assert.equal(authority.qualification_effect.forecast_spatial_extraction_implemented, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);

  for (const nonclaim of [
    'NO_F001_TO_F072_VALID_TIME_REWRITE',
    'NO_WAIT_FOR_FUTURE_GFS_FILES_TO_COMPLETE_A_SELECTED_CYCLE',
    'NO_GFS_OBJECT_WITH_LAST_MODIFIED_AFTER_TICK_USED_AS_PRIOR_AVAILABLE',
    'NO_APCP_ONE_HOUR_ASSUMPTION',
    'NO_PRATE_ONE_HOUR_ASSUMPTION',
    'NO_DSWRF_ONE_HOUR_ASSUMPTION',
    'NO_FORECAST_VALUE_OUTPUT',
    'NO_GRID_INTERPOLATION_CLAIM',
    'NO_FUTURE_ET0_OUTPUT',
    'NO_FORMAL_SOURCE_AUTHORITY_FROM_PROBE_ALONE',
    'NO_DATABASE_WRITE',
    'NO_FORMAL_EVIDENCE_WRITE',
    'NO_RUNTIME_PRODUCT_SOURCE_DELTA',
    'NO_FORMAL_WINDOW_START',
    'NO_MCFT_CAP_09_COMPLETION',
  ]) assert(authority.hard_nonclaims.includes(nonclaim), `EA1K_HARD_NONCLAIM_REQUIRED:${nonclaim}`);

  for (const marker of [
    'mechanical_f001_through_f072_selection_used: false',
    'future_file_waiting_used: false',
    'valid_time_rewrite_used: false',
    'all_required_objects_published_at_or_before_tick',
    'apcp_direct_hourly_assumption_made: false',
    'prate_direct_hourly_assumption_made: false',
    'dswrf_direct_hourly_assumption_made: false',
    'raw_forecast_values_emitted: false',
    'raw_grib_payload_persisted_or_uploaded: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
  ]) assert(probe.includes(marker), `EA1K_REQUIRED_PROBE_MARKER_MISSING:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'pg.Pool', 'INSERT INTO public.facts', 'INSERT INTO facts']) {
    assert(!probe.includes(forbidden), `EA1K_DATABASE_OR_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1K_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(authority)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1K_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1K_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1k_gfs_exact_cycle_72h_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_blob_sha: amendmentBlobAtBase,
    ea1i_blob_sha: ea1iBlobAtBase,
    ea1j_blob_sha: ea1jBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    forecast_value_output_created: false,
    formal_future_weather_source_authority_created: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1k_gfs_exact_cycle_72h_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
