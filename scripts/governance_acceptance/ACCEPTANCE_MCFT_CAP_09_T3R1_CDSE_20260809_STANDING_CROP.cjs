#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-20260809-STANDING-CROP-OBSERVATION-V1.json');
const PROBE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_20260809_STANDING_CROP.mjs');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/mcft-cap-09-t3r1-cdse-20260809-standing-crop.yml');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CDSE_20260809_STANDING_CROP_BOUNDARY.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-cdse-20260809-standing-crop.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-20260809-STANDING-CROP-OBSERVATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_CDSE_20260809_STANDING_CROP.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_20260809_STANDING_CROP.mjs',
].sort();

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_CDSE_BOUNDARY_EXACT_BASE_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_CDSE_BOUNDARY_EXACT_SUBJECT_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}^{commit}`]) === BASE_SHA, 'T3R1_CDSE_BOUNDARY_BASE_NOT_COMMIT');
  assert(git(['rev-parse', `${SUBJECT_SHA}^{commit}`]) === SUBJECT_SHA, 'T3R1_CDSE_BOUNDARY_SUBJECT_NOT_COMMIT');
  execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, SUBJECT_SHA], { cwd: ROOT, stdio: 'ignore' });

  const changedFiles = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`])
    .split(/\r?\n/).filter(Boolean).sort();
  assert(sameArray(changedFiles, EXPECTED_FILES), `T3R1_CDSE_EXACT_FOUR_FILE_BOUNDARY_FAIL:${changedFiles.join(',')}`);

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const probe = fs.readFileSync(PROBE_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert(config.exact_base_protected_main === BASE_SHA, 'T3R1_CDSE_CONFIG_BASE_MISMATCH');
  assert(config.frontier === 'T3R1_CURRENT_LIFECYCLE_AUTHORITY', 'T3R1_CDSE_FRONTIER_MISMATCH');
  assert(config.candidate_scope.treatment === 'T3' && config.candidate_scope.replicate === 'R1', 'T3R1_CDSE_SCOPE_MISMATCH');
  assert(config.candidate_scope.crop === 'corn' && config.candidate_scope.hybrid === 'Pioneer P0306Q', 'T3R1_CDSE_CROP_IDENTITY_MISMATCH');
  assert(config.candidate_scope.planting_date === '2026-05-20', 'T3R1_CDSE_PLANTING_DATE_MISMATCH');
  assert(config.target_acquisition.day_utc === '2026-08-09', 'T3R1_CDSE_TARGET_DAY_MISMATCH');
  assert(config.target_acquisition.sensing_time_is_observation_time === true, 'T3R1_CDSE_SENSING_TIME_SEMANTICS_REQUIRED');
  assert(config.target_acquisition.retrieval_time_is_availability_time === true, 'T3R1_CDSE_RETRIEVAL_TIME_SEMANTICS_REQUIRED');
  assert(config.target_acquisition.catalog_product_presence_is_not_standing_crop_evidence === true, 'T3R1_CDSE_CATALOG_ONLY_NONCLAIM_REQUIRED');
  assert(config.target_acquisition.scene_level_cloud_cover_is_not_plot_clear_fraction === true, 'T3R1_CDSE_SCENE_CLOUD_NONCLAIM_REQUIRED');

  assert(config.conservative_crop_only_subzone_policy.expected_geometry_semantic_hash === 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a', 'T3R1_CDSE_GEOMETRY_HASH_PIN_REQUIRED');
  assert(config.conservative_crop_only_subzone_policy.provider_raw_geometry_may_be_emitted === false, 'T3R1_CDSE_RAW_GEOMETRY_EMISSION_FORBIDDEN');
  assert(config.conservative_crop_only_subzone_policy.derived_geometry_coordinates_may_be_emitted === false, 'T3R1_CDSE_DERIVED_COORDINATE_EMISSION_FORBIDDEN');

  assert(config.observation_rule.scl_vegetation_class === 4, 'T3R1_CDSE_SCL_VEGETATION_CLASS_REQUIRED');
  assert(config.observation_rule.minimum_plot_clear_land_fraction >= 0.8, 'T3R1_CDSE_CLEAR_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_vegetated_fraction_of_clear_land >= 0.8, 'T3R1_CDSE_VEGETATION_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_mean_ndvi_over_clear_land >= 0.5, 'T3R1_CDSE_NDVI_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.ndvi_to_phenology_mapping_authorized === false, 'T3R1_CDSE_NDVI_STAGE_MAPPING_FORBIDDEN');
  assert(config.observation_rule.satellite_to_kc_mapping_authorized === false, 'T3R1_CDSE_SATELLITE_KC_MAPPING_FORBIDDEN');

  assert(config.resolution_policy.current_management_season_lifecycle_authorized_by_this_probe === false, 'T3R1_CDSE_LIFECYCLE_AUTHORITY_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.bounded_carry_forward_authorized_by_this_probe === false, 'T3R1_CDSE_CARRY_FORWARD_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.formal_site_rebind_authorized_by_this_probe === false, 'T3R1_CDSE_FORMAL_REBIND_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.ea5e2_authorized_by_this_probe === false, 'T3R1_CDSE_EA5E2_MUST_REMAIN_FALSE');
  assert(config.next_frontier_on_pass === 'T3R1_BOUNDED_POSITIVE_LIFECYCLE_CARRY_FORWARD_AUTHORITY', 'T3R1_CDSE_NEXT_FRONTIER_MISMATCH');

  const requiredNonclaims = [
    'NO_CATALOG_ONLY_STANDING_CROP_CLAIM',
    'NO_NDVI_TO_PHENOLOGY_STAGE',
    'NO_SATELLITE_TO_KC_MAPPING',
    'NO_PROVIDER_SILENCE_AS_ACTIVE',
    'NO_HISTORICAL_HARVEST_PATTERN_AS_CURRENT_COMPLETENESS',
    'NO_CURRENT_ACTIVE_LIFECYCLE_FROM_THIS_PROBE_ALONE',
    'NO_CARRY_FORWARD_FROM_THIS_PROBE_ALONE',
    'NO_T1R1_AUTHORITY_MUTATION',
    'NO_FORMAL_SITE_REBIND',
    'NO_EA5E2_OPERATIONAL_ACTIVATION',
  ];
  for (const item of requiredNonclaims) assert(config.hard_nonclaims.includes(item), `T3R1_CDSE_NONCLAIM_MISSING:${item}`);

  assert(probe.includes("CDSE_SENTINEL_HUB_ACCESS_TOKEN"), 'T3R1_CDSE_EPHEMERAL_TOKEN_BINDING_REQUIRED');
  assert(probe.includes("SCL") && probe.includes("B04") && probe.includes("B08") && probe.includes("dataMask"), 'T3R1_CDSE_PIXEL_INPUTS_REQUIRED');
  assert(probe.includes("current_management_season_lifecycle_resolved: false"), 'T3R1_CDSE_PROBE_LIFECYCLE_FALSE_REQUIRED');
  assert(probe.includes("bounded_carry_forward_authorized: false"), 'T3R1_CDSE_PROBE_CARRY_FORWARD_FALSE_REQUIRED');
  assert(probe.includes("formal_execution_count: '0/24'"), 'T3R1_CDSE_FORMAL_ZERO_REQUIRED');
  assert(!/POLYGON\s*\(\([-0-9.\s,]+\)\)/i.test(probe), 'T3R1_CDSE_COMMITTED_RAW_POLYGON_FORBIDDEN');
  assert(!/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}/.test(probe), 'T3R1_CDSE_COMMITTED_TOKEN_FORBIDDEN');

  assert(workflow.includes('workflow_dispatch:'), 'T3R1_CDSE_WORKFLOW_DISPATCH_REQUIRED');
  assert(workflow.includes('secrets.CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_CDSE_WORKFLOW_SECRET_BINDING_REQUIRED');
  assert(workflow.includes('persist-credentials: false'), 'T3R1_CDSE_WORKFLOW_GIT_CREDENTIAL_PERSISTENCE_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_cdse_20260809_standing_crop_boundary_v1',
    status: 'PASS',
    exact_base_sha: BASE_SHA,
    exact_subject_sha: SUBJECT_SHA,
    exact_four_file_boundary: true,
    changed_files: changedFiles,
    represented_scope: 'KBS_MCSE_T3R1_CANDIDATE',
    target_acquisition_day_utc: '2026-08-09',
    crop_only_geometry_hash_pinned: true,
    direct_standing_crop_observation_candidate_may_be_established_by_live_probe: true,
    current_management_season_lifecycle_authority_established: false,
    bounded_carry_forward_authorized: false,
    formal_site_rebind_authorized: false,
    ea5e2_operational_activation_qualified: false,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    formal_execution_count: '0/24',
    authority_effect: 'NONE_STATIC_BOUNDARY_ONLY'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_cdse_20260809_standing_crop_boundary_v1',
    status: 'FAIL',
    exact_base_sha: BASE_SHA || null,
    exact_subject_sha: SUBJECT_SHA || null,
    current_management_season_lifecycle_authority_established: false,
    bounded_carry_forward_authorized: false,
    formal_site_rebind_authorized: false,
    ea5e2_operational_activation_qualified: false,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    formal_execution_count: '0/24',
    authority_effect: 'NONE',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
