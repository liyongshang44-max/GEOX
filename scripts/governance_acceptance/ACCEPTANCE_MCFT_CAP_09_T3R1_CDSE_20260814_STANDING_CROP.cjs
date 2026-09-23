#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-20260814-STANDING-CROP-OBSERVATION-V1.json');
const PROBE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_20260814_STANDING_CROP.mjs');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/mcft-cap-09-t3r1-cdse-20260814-standing-crop.yml');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CDSE_20260814_STANDING_CROP_BOUNDARY.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-cdse-20260814-standing-crop.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-20260814-STANDING-CROP-OBSERVATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_CDSE_20260814_STANDING_CROP.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_20260814_STANDING_CROP.mjs',
].sort();
function assert(condition, code) { if (!condition) throw new Error(code); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function sameArray(a, b) { return a.length === b.length && a.every((value, index) => value === b[index]); }
try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_CDSE_BOUNDARY_EXACT_BASE_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_CDSE_BOUNDARY_EXACT_SUBJECT_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}^{commit}`]) === BASE_SHA, 'T3R1_CDSE_BOUNDARY_BASE_NOT_COMMIT');
  assert(git(['rev-parse', `${SUBJECT_SHA}^{commit}`]) === SUBJECT_SHA, 'T3R1_CDSE_BOUNDARY_SUBJECT_NOT_COMMIT');
  execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, SUBJECT_SHA], { cwd: ROOT, stdio: 'ignore' });
  const changedFiles = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(sameArray(changedFiles, EXPECTED_FILES), `T3R1_CDSE_EXACT_FOUR_FILE_BOUNDARY_FAIL:${changedFiles.join(',')}`);
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const probe = fs.readFileSync(PROBE_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  assert(config.exact_base_protected_main === BASE_SHA, 'T3R1_CDSE_CONFIG_BASE_MISMATCH');
  assert(config.frontier === 'T3R1_CURRENT_LIFECYCLE_AUTHORITY', 'T3R1_CDSE_FRONTIER_MISMATCH');
  assert(config.candidate_scope.treatment === 'T3' && config.candidate_scope.replicate === 'R1', 'T3R1_CDSE_SCOPE_MISMATCH');
  assert(config.candidate_scope.crop === 'corn' && config.candidate_scope.hybrid === 'Pioneer P0306Q', 'T3R1_CDSE_CROP_IDENTITY_MISMATCH');
  assert(config.candidate_scope.planting_date === '2026-05-20', 'T3R1_CDSE_PLANTING_DATE_MISMATCH');
  assert(config.target_acquisition.day_utc === '2026-08-14', 'T3R1_CDSE_TARGET_DAY_MISMATCH');
  assert(config.target_acquisition.sensing_time_is_observation_time === true && config.target_acquisition.retrieval_time_is_availability_time === true, 'T3R1_CDSE_TIME_SEMANTICS_REQUIRED');
  assert(JSON.stringify(config.observation_rule.scl_clear_land_classes) === JSON.stringify([4,5]), 'T3R1_CDSE_STRICT_CLEAR_LAND_CLASSES_REQUIRED');
  assert(config.observation_rule.scl_vegetation_class === 4, 'T3R1_CDSE_SCL_VEGETATION_CLASS_REQUIRED');
  assert(config.observation_rule.minimum_plot_clear_land_fraction >= 0.8, 'T3R1_CDSE_CLEAR_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_vegetated_fraction_of_clear_land >= 0.8, 'T3R1_CDSE_VEGETATION_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_mean_ndvi_over_clear_land >= 0.5, 'T3R1_CDSE_NDVI_THRESHOLD_TOO_WEAK');
  assert(config.scene_binding_policy.allow_multiple_tiles_only_if_same_datatake_identity === true, 'T3R1_CDSE_DATATAKE_BINDING_REQUIRED');
  assert(config.scene_binding_policy.tile_datetime_spread_is_diagnostic_only === true, 'T3R1_CDSE_TILE_TIME_DIAGNOSTIC_REQUIRED');
  assert(config.resolution_policy.current_management_season_lifecycle_authorized_by_this_probe === false, 'T3R1_CDSE_LIFECYCLE_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.bounded_carry_forward_authorized_by_this_probe === false, 'T3R1_CDSE_CARRY_FORWARD_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.formal_site_rebind_authorized_by_this_probe === false, 'T3R1_CDSE_FORMAL_REBIND_MUST_REMAIN_FALSE');
  assert(config.resolution_policy.ea5e2_authorized_by_this_probe === false, 'T3R1_CDSE_EA5E2_MUST_REMAIN_FALSE');
  assert(config.hard_nonclaims.includes('NO_SCL7_AS_CLEAR_LAND'), 'T3R1_CDSE_SCL7_NONCLAIM_REQUIRED');
  assert(probe.includes('CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_CDSE_EPHEMERAL_TOKEN_BINDING_REQUIRED');
  assert(probe.includes('[4, 5].includes(s.SCL)'), 'T3R1_CDSE_PROBE_STRICT_CLEAR_LAND_REQUIRED');
  assert(!probe.includes("accept: 'application/json'"), 'T3R1_CDSE_CATALOG_ACCEPT_HEADER_FORBIDDEN');
  assert(probe.includes('datatake_key'), 'T3R1_CDSE_DATATAKE_KEY_REQUIRED');
  assert(probe.includes("current_management_season_lifecycle_resolved: false"), 'T3R1_CDSE_PROBE_LIFECYCLE_FALSE_REQUIRED');
  assert(probe.includes("formal_execution_count: '0/24'"), 'T3R1_CDSE_FORMAL_ZERO_REQUIRED');
  assert(!/POLYGON\s*\(\([-0-9.\s,]+\)\)/i.test(probe), 'T3R1_CDSE_COMMITTED_RAW_POLYGON_FORBIDDEN');
  assert(workflow.includes('workflow_dispatch:'), 'T3R1_CDSE_WORKFLOW_DISPATCH_REQUIRED');
  assert(workflow.includes('secrets.CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_CDSE_WORKFLOW_SECRET_BINDING_REQUIRED');
  write({ schema_version: 'geox_mcft_cap09_t3r1_cdse_20260814_standing_crop_boundary_v1', status: 'PASS', exact_base_sha: BASE_SHA, exact_subject_sha: SUBJECT_SHA, exact_four_file_boundary: true, changed_files: changedFiles, represented_scope: 'KBS_MCSE_T3R1_CANDIDATE', target_acquisition_day_utc: '2026-08-14', strict_scl_clear_land_classes: [4,5], direct_standing_crop_observation_candidate_may_be_established_by_live_probe: true, current_management_season_lifecycle_authority_established: false, bounded_carry_forward_authorized: false, formal_site_rebind_authorized: false, ea5e2_operational_activation_qualified: false, runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0, formal_execution_count: '0/24', authority_effect: 'NONE_STATIC_BOUNDARY_ONLY' });
} catch (error) {
  write({ schema_version: 'geox_mcft_cap09_t3r1_cdse_20260814_standing_crop_boundary_v1', status: 'FAIL', exact_base_sha: BASE_SHA || null, exact_subject_sha: SUBJECT_SHA || null, current_management_season_lifecycle_authority_established: false, bounded_carry_forward_authorized: false, formal_site_rebind_authorized: false, ea5e2_operational_activation_qualified: false, runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0, formal_execution_count: '0/24', authority_effect: 'NONE', error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1;
}
