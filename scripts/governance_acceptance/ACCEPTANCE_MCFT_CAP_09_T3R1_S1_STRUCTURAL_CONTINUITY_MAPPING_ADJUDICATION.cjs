#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-MAPPING-ADJUDICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_MAPPING_ADJUDICATION_BOUNDARY.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const EXPECTED_BASE = '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-s1-structural-continuity-mapping-adjudication.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-MAPPING-ADJUDICATION-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-MAPPING-ADJUDICATION-V1.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_MAPPING_ADJUDICATION.cjs'
].sort();

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function near(actual, expected, tolerance, code) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${code}:${actual}:${expected}`);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_S1_MAPPING_BASE_SHA_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_S1_MAPPING_SUBJECT_SHA_REQUIRED');
  assert(BASE_SHA === EXPECTED_BASE, `T3R1_S1_MAPPING_BASE_DRIFT:${BASE_SHA}`);

  const changed = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `T3R1_S1_MAPPING_EXACT_FOUR_FILE_BOUNDARY_REQUIRED:${changed.join(',')}`);

  const x = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  assert(x.schema_version === 'geox_mcft_cap09_t3r1_s1_structural_continuity_mapping_adjudication_v1', 'T3R1_S1_MAPPING_SCHEMA_REQUIRED');
  assert(x.exact_base_protected_main === EXPECTED_BASE, 'T3R1_S1_MAPPING_CONFIG_BASE_REQUIRED');
  assert(x.represented_scope?.site_id === 'KBS_MCSE_T3R1_CANDIDATE', 'T3R1_S1_MAPPING_SCOPE_REQUIRED');
  assert(x.represented_scope?.crop_only_geometry_semantic_hash === 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a', 'T3R1_S1_MAPPING_GEOMETRY_HASH_REQUIRED');

  const o = x.positive_optical_reference;
  assert(o?.acquisition_day_utc === '2026-07-30', 'T3R1_S1_MAPPING_OPTICAL_DAY_REQUIRED');
  assert(o?.plot_clear_land_fraction === 1 && o?.plot_vegetated_fraction_of_clear_land === 1, 'T3R1_S1_MAPPING_OPTICAL_FULL_CLEAR_VEGETATION_REQUIRED');
  assert(Number(o?.plot_mean_ndvi_over_clear_land) > 0.82, 'T3R1_S1_MAPPING_OPTICAL_NDVI_REQUIRED');

  const observations = x.sar_live_evidence?.observations || [];
  assert(observations.length === 3, 'T3R1_S1_MAPPING_THREE_SAR_OBSERVATIONS_REQUIRED');
  assert(observations.every((v) => v.plot_valid_fraction === 1), 'T3R1_S1_MAPPING_FULL_SAR_COVERAGE_REQUIRED');
  const j31 = observations.find((v) => v.acquisition_day_utc === '2026-07-31');
  const a12 = observations.find((v) => v.acquisition_day_utc === '2026-08-12');
  const a13 = observations.find((v) => v.acquisition_day_utc === '2026-08-13');
  assert(j31?.mission === 'S1C' && a12?.mission === 'S1C' && a13?.mission === 'S1D', 'T3R1_S1_MAPPING_MISSION_BINDING_REQUIRED');
  assert(j31?.orbit_state === 'ASCENDING' && a12?.orbit_state === 'ASCENDING', 'T3R1_S1_MAPPING_SAME_ORBIT_DIRECTION_REQUIRED');
  assert(a12.absolute_orbit - j31.absolute_orbit === 175, 'T3R1_S1_MAPPING_REPEAT_ORBIT_DELTA_REQUIRED');
  assert(j31.sensing_start_utc.slice(11) === a12.sensing_start_utc.slice(11), 'T3R1_S1_MAPPING_REPEAT_SENSING_CLOCK_REQUIRED');
  assert(a12.mean_vh_db > j31.mean_vh_db, 'T3R1_S1_MAPPING_NO_VH_COLLAPSE_REQUIRED');
  assert(a12.mean_vh_vv_linear_ratio > j31.mean_vh_vv_linear_ratio, 'T3R1_S1_MAPPING_NO_RATIO_COLLAPSE_REQUIRED');

  const same = x.same_repeat_track_adjudication;
  assert(same?.absolute_orbit_difference === 175 && same?.elapsed_days === 12, 'T3R1_S1_MAPPING_ESA_REPEAT_IDENTITY_REQUIRED');
  near(same.delta_vv_db, a12.mean_vv_db - j31.mean_vv_db, 1e-12, 'T3R1_S1_MAPPING_DELTA_VV_REDERIVATION_REQUIRED');
  near(same.delta_vh_db, a12.mean_vh_db - j31.mean_vh_db, 1e-12, 'T3R1_S1_MAPPING_DELTA_VH_REDERIVATION_REQUIRED');
  const ratioDelta = a12.mean_vh_vv_linear_ratio - j31.mean_vh_vv_linear_ratio;
  near(same.delta_vh_vv_linear_ratio, ratioDelta, 1e-12, 'T3R1_S1_MAPPING_DELTA_RATIO_REDERIVATION_REQUIRED');
  near(same.relative_vh_vv_ratio_change, ratioDelta / j31.mean_vh_vv_linear_ratio, 1e-12, 'T3R1_S1_MAPPING_RELATIVE_RATIO_REDERIVATION_REQUIRED');
  assert(same?.structural_collapse_signature_observed === false, 'T3R1_S1_MAPPING_STRUCTURAL_COLLAPSE_MUST_BE_FALSE');
  assert(same?.structural_continuity_candidate_resolved === true, 'T3R1_S1_MAPPING_STRUCTURAL_CONTINUITY_REQUIRED');

  assert(x.scientific_boundary?.single_uncalibrated_backscatter_series_may_exclude_harvest === false, 'T3R1_S1_MAPPING_HARVEST_EXCLUSION_FORBIDDEN');
  assert(x.scientific_boundary?.site_crop_specific_negative_control_available === false, 'T3R1_S1_MAPPING_NEGATIVE_CONTROL_MUST_BE_ABSENT');

  const a = x.authority_adjudication;
  assert(a?.same_track_structural_continuity_candidate === 'RESOLVED', 'T3R1_S1_MAPPING_CONTINUITY_RESULT_REQUIRED');
  assert(a?.direct_standing_crop_observation_from_sar === 'UNRESOLVED', 'T3R1_S1_MAPPING_SAR_DIRECT_CROP_MUST_REMAIN_UNRESOLVED');
  assert(a?.harvest_exclusion_from_sar === 'UNRESOLVED', 'T3R1_S1_MAPPING_HARVEST_EXCLUSION_MUST_REMAIN_UNRESOLVED');
  assert(a?.season_lifecycle_authority === 'UNRESOLVED', 'T3R1_S1_MAPPING_LIFECYCLE_MUST_REMAIN_UNRESOLVED');
  assert(a?.bounded_carry_forward_authorized === false, 'T3R1_S1_MAPPING_CARRY_FORWARD_FORBIDDEN');

  const b = x.authority_boundary;
  assert(b?.formal_site_rebind_authorized === false, 'T3R1_S1_MAPPING_FORMAL_REBIND_FORBIDDEN');
  assert(b?.ea5e2_operational_activation_qualified === false, 'T3R1_S1_MAPPING_EA5E2_FORBIDDEN');
  assert(b?.runtime_write_count === 0 && b?.database_write_count === 0 && b?.scheduler_write_count === 0 && b?.formal_evidence_write_count === 0, 'T3R1_S1_MAPPING_ZERO_WRITES_REQUIRED');
  assert(b?.formal_execution_count === '0/24', 'T3R1_S1_MAPPING_FORMAL_ZERO_REQUIRED');
  assert(x.next_frontier === 'T3R1_DIRECT_CURRENT_POSITIVE_LIFECYCLE_ANCHOR_OR_SCOPE_COMPLETE_LIFECYCLE_POLICY_REQUIRED', 'T3R1_S1_MAPPING_NEXT_FRONTIER_REQUIRED');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_s1_structural_continuity_mapping_adjudication_boundary_v1',
    status: 'PASS',
    base_sha: BASE_SHA,
    subject_sha: SUBJECT_SHA,
    exact_four_file_boundary: true,
    arithmetic_rederived_from_live_observations: true,
    structural_continuity_candidate_resolved: true,
    direct_standing_crop_observation_from_sar_resolved: false,
    harvest_exclusion_from_sar_resolved: false,
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    next_frontier: x.next_frontier
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_s1_structural_continuity_mapping_adjudication_boundary_v1',
    status: 'FAIL',
    base_sha: BASE_SHA || null,
    subject_sha: SUBJECT_SHA || null,
    exact_four_file_boundary: false,
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
