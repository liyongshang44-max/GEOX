#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1L_GFS_HOURLY_NORMALIZATION_AUTHORITY_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AUTHORITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const EA1I = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json';
const EA1I_BLOB = '47d41c48027e84285e934e7cda8af52fae6aa47d';
const EA1K = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const EA1K_BLOB = 'f36955b2847d1a2b58052f0dec2fea465e7eaec2';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1L_GFS_HOURLY_NORMALIZATION_AUTHORITY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1l-gfs-hourly-normalization-authority.yml',
  AUTHORITY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1L_GFS_HOURLY_NORMALIZATION_AUTHORITY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1L_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1L_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1L_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1L_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1L_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const ea1iBlobAtBase = git(['rev-parse', `${BASE}:${EA1I}`]);
  const ea1kBlobAtBase = git(['rev-parse', `${BASE}:${EA1K}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1L_EXACT_AMENDMENT_AUTHORITY_REQUIRED');
  assert.equal(ea1iBlobAtBase, EA1I_BLOB, 'EA1L_EXACT_EA1I_AUTHORITY_REQUIRED');
  assert.equal(ea1kBlobAtBase, EA1K_BLOB, 'EA1L_EXACT_EA1K_AUTHORITY_REQUIRED');

  const authority = json(AUTHORITY);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.capability_line_id, 'MCFT-CAP-09');
  assert.equal(authority.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(authority.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(authority.base_main_sha, '5a593fe9364e4593676e361af893d67e3cca7766');
  assert.equal(authority.provider.name, 'NOAA_NCEP_NOMADS');
  assert.equal(authority.provider.model, 'GFS');
  assert.equal(authority.provider.grid, '0.25_degree_global_lat_lon');

  const futureWeather = authority.canonical_targets.future_weather;
  assert.equal(futureWeather.canonical_evidence_type, 'future_weather_assumption_v1');
  assert.equal(futureWeather.epistemic_class, 'ASSUMED');
  assert.equal(futureWeather.canonical_unit, 'mm');
  assert.equal(futureWeather.interval, 'EXACT_1H_ENDING_AT_VALID_TIME');
  assert.equal(futureWeather.selected_provider_variable, 'PRATE_AVERAGE_WINDOW_SURFACE');
  assert.equal(futureWeather.apcp_selected, false);
  assert.equal(futureWeather.prate_instantaneous_selected, false);

  const solar = authority.canonical_targets.future_et0_solar_input;
  assert.equal(solar.provider_variable, 'DSWRF_SURFACE');
  assert.equal(solar.provider_unit, 'W_per_m2');
  assert.equal(solar.normalized_quantity, 'EXACT_1H_MEAN_DOWNWARD_SHORTWAVE_RADIATION');
  assert.equal(solar.normalized_unit, 'W_per_m2');
  assert.equal(solar.et0_input_unit, 'MJ_per_m2_per_hour');
  assert.equal(solar.conversion_factor_after_hourly_normalization, 0.0036);

  const cycle = authority.exact_cycle_policy;
  assert.equal(cycle.canonical_point_count, 72);
  assert.deepEqual(cycle.candidate_cycle_hours_utc, [0,6,12,18]);
  assert.equal(cycle.lead_start_rule, 'lead_start=(T-cycle_time)+1h');
  assert.equal(cycle.lead_end_rule, 'lead_end=(T-cycle_time)+72h');
  assert.equal(cycle.support_lead_rule, 'support_lead=lead_start-1');
  assert.equal(cycle.support_lead_is_derivation_only, true);
  assert.equal(cycle.support_lead_must_not_become_canonical_point, true);
  assert.equal(cycle.all_target_and_support_objects_last_modified_lte_tick, true);
  assert.equal(cycle.future_file_waiting_forbidden, true);
  assert.equal(cycle.valid_time_rewrite_forbidden, true);
  assert.equal(cycle.hourly_horizon_max_lead, 120);

  const rolling = authority.rolling_window_family;
  assert.equal(rolling.block_hours, 6);
  assert.equal(rolling.expected_window_start_rule, 'S=6*floor((lead-1)/6)');
  assert.equal(rolling.expected_window_end_rule, 'E=lead');
  assert.deepEqual(rolling.allowed_window_length_hours, [1,2,3,4,5,6]);
  assert.equal(rolling.same_start_predecessor_required_when_window_length_gt_1, true);
  assert.equal(rolling.cross_block_differencing_forbidden, true);
  assert.equal(rolling.missing_predecessor_imputation_forbidden, true);

  const dswrf = authority.dswrf_normalization;
  assert.equal(dswrf.source_variable, 'DSWRF');
  assert.equal(dswrf.source_level, 'surface');
  assert.equal(dswrf.source_unit, 'W_per_m2');
  assert.equal(dswrf.required_statistic, 'AVERAGE_WINDOW');
  assert.equal(dswrf.matching_record_policy, 'EXACTLY_ONE_ROLLING_WINDOW_RECORD_PER_LEAD');
  assert.equal(dswrf.direct_rule_when_L_eq_1, 'hourly_mean_w_m2=A_S_E');
  assert.equal(dswrf.difference_rule_when_L_gt_1, 'hourly_mean_w_m2=L*A_S_E-(L-1)*A_S_Eminus1');
  assert.equal(dswrf.predecessor_requirement, 'previous_lead_record_has_same_S_and_end_Eminus1');
  assert.equal(dswrf.negative_derived_value_policy, 'FAIL_NO_CLIP');
  assert.equal(dswrf.future_et0_conversion_after_normalization, 'MJ_m2_h=hourly_mean_w_m2*0.0036');

  const precip = authority.precipitation_normalization;
  assert.equal(precip.selected_source_variable, 'PRATE');
  assert.equal(precip.source_level, 'surface');
  assert.equal(precip.source_unit, 'kg_per_m2_per_s');
  assert.equal(precip.required_statistic, 'AVERAGE_WINDOW');
  assert.equal(precip.matching_record_policy, 'EXACTLY_ONE_ROLLING_AVERAGE_RECORD_PER_LEAD');
  assert.equal(precip.instantaneous_prate_record_policy, 'NOT_SELECTED_FOR_INTERVAL_DEPTH');
  assert.equal(precip.direct_rule_when_L_eq_1, 'hourly_mean_rate_kg_m2_s=R_S_E');
  assert.equal(precip.difference_rule_when_L_gt_1, 'hourly_mean_rate_kg_m2_s=L*R_S_E-(L-1)*R_S_Eminus1');
  assert.equal(precip.predecessor_requirement, 'previous_lead_average_record_has_same_S_and_end_Eminus1');
  assert.equal(precip.hourly_depth_conversion, 'hourly_depth_mm=hourly_mean_rate_kg_m2_s*3600');
  assert.equal(precip.water_equivalent_identity, '1_kg_per_m2_equals_1_mm_water_depth');
  assert.equal(precip.negative_derived_value_policy, 'FAIL_NO_CLIP');
  assert.equal(precip.apcp_policy, 'NOT_SELECTED_DUE_MULTI_RECORD_FAMILY_AMBIGUITY_IN_EA1K');
  assert.equal(precip.apcp_may_be_used_later_only_as_cross_check, true);

  assert.equal(authority.structural_proof_requirements.support_plus_target_lead_count, 73);
  assert.equal(authority.structural_proof_requirements.every_dswrf_target_has_reconstructible_1h_graph, true);
  assert.equal(authority.structural_proof_requirements.every_prate_target_has_reconstructible_1h_graph, true);
  assert.equal(authority.structural_proof_requirements.all_72_target_valid_times_remain_exactly_T_plus_1_through_T_plus_72, true);
  assert.equal(authority.structural_proof_requirements.raw_forecast_values_required_for_this_probe, false);
  assert.equal(authority.structural_proof_requirements.normalized_values_generated_by_this_probe, false);

  assert.equal(authority.future_et0_boundary.same_selected_gfs_cycle_as_future_weather_required, true);
  assert.equal(authority.future_et0_boundary.hourly_dswrf_normalization_authority_candidate_may_be_established, true);
  assert.equal(authority.future_et0_boundary.future_et0_algorithm_execution_not_implemented_by_this_probe, true);
  assert.equal(authority.future_et0_boundary.spatial_extraction_not_selected_by_this_probe, true);

  assert.equal(authority.output_policy.raw_index_lines_emitted, false);
  assert.equal(authority.output_policy.raw_index_bodies_persisted_or_uploaded, false);
  assert.equal(authority.output_policy.grib_bodies_downloaded, false);
  assert.equal(authority.output_policy.forecast_values_emitted, false);
  assert.equal(authority.qualification_effect.precipitation_source_selection_candidate, 'PRATE_AVERAGE_WINDOW');
  assert.equal(authority.qualification_effect.dswrf_hourly_normalization_candidate, true);
  assert.equal(authority.qualification_effect.forecast_value_canonicalization_implemented, false);
  assert.equal(authority.qualification_effect.future_weather_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.future_et0_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.spatial_extraction_implemented, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);

  for (const nonclaim of [
    'NO_APCP_CANONICAL_SELECTION',
    'NO_PRATE_INSTANTANEOUS_TO_INTERVAL_DEPTH_SHORTCUT',
    'NO_DSWRF_MULTI_HOUR_AVERAGE_USED_AS_ONE_HOUR_VALUE',
    'NO_CROSS_BLOCK_DIFFERENCING',
    'NO_MISSING_PREDECESSOR_IMPUTATION',
    'NO_NEGATIVE_DERIVED_VALUE_CLIPPING',
    'NO_SUPPORT_LEAD_AS_CANONICAL_FORECAST_POINT',
    'NO_FORECAST_VALUE_OUTPUT',
    'NO_SPATIAL_EXTRACTION_CLAIM',
    'NO_FUTURE_ET0_OUTPUT',
    'NO_FORMAL_SOURCE_AUTHORITY_FROM_PROBE_ALONE',
    'NO_DATABASE_WRITE',
    'NO_FORMAL_EVIDENCE_WRITE',
    'NO_RUNTIME_PRODUCT_SOURCE_DELTA',
    'NO_FORMAL_WINDOW_START',
    'NO_MCFT_CAP_09_COMPLETION',
  ]) assert(authority.hard_nonclaims.includes(nonclaim), `EA1L_HARD_NONCLAIM_REQUIRED:${nonclaim}`);

  for (const marker of [
    'support_lead_is_canonical_point: false',
    "selected_source_variable: 'PRATE_AVERAGE_WINDOW'",
    'apcp_selected: false',
    'prate_instantaneous_selected: false',
    'normalized_values_generated: false',
    'forecast_values_emitted: false',
    'grib_bodies_downloaded: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
  ]) assert(probe.includes(marker), `EA1L_REQUIRED_PROBE_MARKER_MISSING:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'pg.Pool', 'INSERT INTO public.facts', 'INSERT INTO facts']) {
    assert(!probe.includes(forbidden), `EA1L_DATABASE_OR_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1L_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(authority)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1L_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1L_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1l_gfs_hourly_normalization_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_blob_sha: amendmentBlobAtBase,
    ea1i_blob_sha: ea1iBlobAtBase,
    ea1k_blob_sha: ea1kBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    forecast_value_output_created: false,
    formal_source_authority_created: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1l_gfs_hourly_normalization_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
