#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1M_GFS_SPATIAL_EXTRACTION_AUTHORITY_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AUTHORITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const EA1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const EA1_BLOB = 'a4329330cfae941a033d65f55e91b8ae8e96d862';
const EA1L = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json';
const EA1L_BLOB = 'af5f23425e35dd21a949727f508934f1be14d8e9';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1M_GFS_SPATIAL_EXTRACTION_AUTHORITY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1m-gfs-spatial-extraction-authority.yml',
  AUTHORITY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1M_GFS_SPATIAL_EXTRACTION_AUTHORITY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1M_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1M_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1M_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1M_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1M_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const ea1BlobAtBase = git(['rev-parse', `${BASE}:${EA1}`]);
  const ea1lBlobAtBase = git(['rev-parse', `${BASE}:${EA1L}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1M_EXACT_AMENDMENT_AUTHORITY_REQUIRED');
  assert.equal(ea1BlobAtBase, EA1_BLOB, 'EA1M_EXACT_EA1_AUTHORITY_REQUIRED');
  assert.equal(ea1lBlobAtBase, EA1L_BLOB, 'EA1M_EXACT_EA1L_AUTHORITY_REQUIRED');

  const authority = json(AUTHORITY);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.capability_line_id, 'MCFT-CAP-09');
  assert.equal(authority.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(authority.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(authority.base_main_sha, '4612e616da11279fe70696176b1273e42927a907');

  const source = authority.site_geometry_source;
  assert.equal(source.provider, 'KBS_LTER');
  assert.equal(source.official_page, 'https://lter.kbs.msu.edu/datatables/829');
  assert.equal(source.download_path, '/datatables/829.csv');
  assert.equal(source.dataset, 'KBS039');
  assert.equal(source.datatable_id, 'KBS039-006.40');
  assert.equal(source.provider_spatial_method, 'SUBMETER_ACCURACY_GPS');
  assert.equal(source.required_srid, 4326);
  assert.deepEqual(source.selected_row, { treatment: 'T1', replicate: 'R1', subplot: 'main', expected_match_count: 1 });
  assert.equal(source.geometry_type, 'SIMPLE_POLYGON');
  assert.equal(source.holes_allowed, false);
  assert.equal(source.raw_geometry_may_be_committed, false);
  assert.equal(source.raw_geometry_may_be_uploaded_as_ci_artifact, false);
  assert.equal(source.centroid_coordinate_may_be_emitted, false);
  assert.equal(source.selected_source_row_may_be_emitted, false);

  const grid = authority.gfs_grid_authority;
  assert.equal(grid.provider, 'NOAA_NCEP_GFS');
  assert.equal(grid.grid, '0.25_degree_global_lat_lon');
  assert.equal(grid.latitude_spacing_degrees, 0.25);
  assert.equal(grid.longitude_spacing_degrees, 0.25);
  assert.equal(grid.longitude_native_domain, '0_TO_359_75');
  assert.equal(grid.interpolation_method, 'NONE_NEAREST_GRID_POINT');
  assert.equal(grid.bilinear_interpolation_forbidden, true);
  assert.equal(grid.variable_specific_gridpoint_selection_forbidden, true);
  assert.deepEqual(grid.same_grid_point_required_for, ['TMP_2M','RH_2M','UGRD_10M','VGRD_10M','DSWRF_SURFACE','PRATE_SURFACE']);

  const algorithm = authority.selection_algorithm;
  assert.equal(algorithm.algorithm_id, 'CURRENT_POLYGON_ALL_VERTICES_AND_CENTROID_NEAREST_GFS_NODE_V1');
  assert.equal(algorithm.centroid_method, 'PLANAR_SHOELACE_ON_SMALL_WGS84_PLOT_FOR_SELECTION_ONLY');
  assert.equal(algorithm.distance_method, 'HAVERSINE_WGS84_MEAN_RADIUS');
  assert.equal(algorithm.candidate_node_method, 'FOUR_SURROUNDING_0P25_DEGREE_GFS_NODES');
  assert.equal(algorithm.required_consensus, 'POLYGON_CENTROID_AND_EVERY_UNIQUE_VERTEX_SELECT_IDENTICAL_NEAREST_GFS_NODE');
  assert.equal(algorithm.maximum_polygon_diameter_m, 500);
  assert.equal(algorithm.maximum_centroid_to_selected_gridpoint_distance_m, 20000);
  assert.equal(algorithm.maximum_any_vertex_to_selected_gridpoint_distance_m, 20000);
  assert.equal(algorithm.centroid_not_persisted, true);
  assert.equal(algorithm.raw_vertices_not_persisted, true);

  assert.equal(authority.spatial_semantics.canonical_support_class, 'NEAR_SITE_MODEL_GRID_POINT_SUPPORT');
  assert.equal(authority.spatial_semantics.direct_field_equivalence, false);
  assert.equal(authority.spatial_semantics.field_scale_forecast_truth_claimed, false);
  assert.equal(authority.spatial_semantics.subgrid_variability_resolved, false);
  assert.equal(authority.spatial_semantics.same_spatial_support_for_future_weather_and_future_et0, true);

  assert.equal(authority.data_use_boundary.provider_page_declares_publication_permission_requirement, true);
  assert.equal(authority.data_use_boundary.provider_payload_may_be_read_transiently_for_qualification, true);
  assert.equal(authority.data_use_boundary.provider_payload_may_be_committed, false);
  assert.equal(authority.data_use_boundary.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(authority.data_use_boundary.formal_runtime_use_right_established_by_this_probe, false);
  assert.equal(authority.data_use_boundary.formal_runtime_use_right_status, 'PENDING_SEPARATE_SOURCE_USE_IP_SETTLEMENT');
  assert.equal(authority.data_use_boundary.public_raw_geometry_republication_right_claimed, false);

  assert.equal(authority.probe_output_policy.raw_polygon_emitted, false);
  assert.equal(authority.probe_output_policy.centroid_coordinate_emitted, false);
  assert.equal(authority.probe_output_policy.raw_kbs_row_emitted, false);
  assert.equal(authority.probe_output_policy.forecast_values_emitted, false);
  assert.equal(authority.qualification_effect.selected_gridpoint_is_formal_authority_without_later_consolidation, false);
  assert.equal(authority.qualification_effect.forecast_value_canonicalization_implemented, false);
  assert.equal(authority.qualification_effect.future_weather_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.future_et0_formal_source_authority_created, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);

  for (const nonclaim of [
    'NO_KBS_RAW_POLYGON_IN_REPOSITORY',
    'NO_KBS_RAW_POLYGON_IN_CI_ARTIFACT',
    'NO_KBS_CENTROID_COORDINATE_OUTPUT',
    'NO_BILINEAR_INTERPOLATION',
    'NO_VARIABLE_SPECIFIC_GFS_GRIDPOINTS',
    'NO_FIELD_SCALE_FORECAST_TRUTH',
    'NO_SUBGRID_VARIABILITY_RESOLUTION',
    'NO_FORMAL_RUNTIME_USE_RIGHT_FROM_TECHNICAL_PROBE',
    'NO_FORECAST_VALUE_OUTPUT',
    'NO_FORMAL_SOURCE_AUTHORITY_FROM_PROBE_ALONE',
    'NO_DATABASE_WRITE',
    'NO_FORMAL_EVIDENCE_WRITE',
    'NO_RUNTIME_PRODUCT_SOURCE_DELTA',
    'NO_FORMAL_WINDOW_START',
    'NO_MCFT_CAP_09_COMPLETION',
  ]) assert(authority.hard_nonclaims.includes(nonclaim), `EA1M_HARD_NONCLAIM_REQUIRED:${nonclaim}`);

  for (const marker of [
    'centroid_coordinate_emitted: false',
    'raw_polygon_emitted: false',
    'raw_kbs_row_emitted: false',
    'centroid_and_all_vertices_same_nearest_gridpoint: true',
    'same_grid_point_for_all_required_gfs_variables: true',
    'direct_field_equivalence: false',
    'formal_runtime_use_right_established: false',
    'forecast_values_emitted: false',
    'raw_provider_geometry_persisted_or_uploaded: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
  ]) assert(probe.includes(marker), `EA1M_REQUIRED_PROBE_MARKER_MISSING:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'pg.Pool', 'INSERT INTO public.facts', 'INSERT INTO facts']) {
    assert(!probe.includes(forbidden), `EA1M_DATABASE_OR_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1M_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(authority)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1M_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1M_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1m_gfs_spatial_extraction_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_blob_sha: amendmentBlobAtBase,
    ea1_blob_sha: ea1BlobAtBase,
    ea1l_blob_sha: ea1lBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    raw_geometry_output_created: false,
    forecast_value_output_created: false,
    formal_source_authority_created: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1m_gfs_spatial_extraction_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
