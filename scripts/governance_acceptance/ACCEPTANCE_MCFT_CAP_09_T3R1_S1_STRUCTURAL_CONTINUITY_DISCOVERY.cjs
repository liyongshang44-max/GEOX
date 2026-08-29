#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-DISCOVERY-V1.json');
const PROBE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_DISCOVERY.mjs');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/mcft-cap-09-t3r1-s1-structural-continuity-discovery.yml');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_DISCOVERY_BOUNDARY.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-s1-structural-continuity-discovery.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-DISCOVERY-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_DISCOVERY.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_DISCOVERY.mjs',
].sort();

function assert(condition, code) { if (!condition) throw new Error(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function sameArray(a, b) { return a.length === b.length && a.every((value, index) => value === b[index]); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_S1_BOUNDARY_EXACT_BASE_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_S1_BOUNDARY_EXACT_SUBJECT_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}^{commit}`]) === BASE_SHA, 'T3R1_S1_BOUNDARY_BASE_NOT_COMMIT');
  assert(git(['rev-parse', `${SUBJECT_SHA}^{commit}`]) === SUBJECT_SHA, 'T3R1_S1_BOUNDARY_SUBJECT_NOT_COMMIT');
  execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, SUBJECT_SHA], { cwd: ROOT, stdio: 'ignore' });

  const changedFiles = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(sameArray(changedFiles, EXPECTED_FILES), `T3R1_S1_EXACT_FOUR_FILE_BOUNDARY_FAIL:${changedFiles.join(',')}`);

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const probe = fs.readFileSync(PROBE_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert(config.exact_base_protected_main === BASE_SHA, 'T3R1_S1_CONFIG_BASE_MISMATCH');
  assert(config.record_status === 'DISCOVERY_ONLY', 'T3R1_S1_DISCOVERY_ONLY_REQUIRED');
  assert(config.represented_scope.treatment === 'T3' && config.represented_scope.replicate === 'R1', 'T3R1_S1_SCOPE_MISMATCH');
  assert(config.represented_scope.crop === 'corn' && config.represented_scope.hybrid === 'Pioneer P0306Q', 'T3R1_S1_CROP_IDENTITY_MISMATCH');
  assert(config.conservative_crop_only_subzone_policy.expected_geometry_semantic_hash === 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a', 'T3R1_S1_GEOMETRY_HASH_REQUIRED');
  assert(config.s1_policy.collection === 'sentinel-1-grd', 'T3R1_S1_COLLECTION_REQUIRED');
  assert(config.s1_policy.required_acquisition_mode === 'IW', 'T3R1_S1_IW_REQUIRED');
  assert(config.s1_policy.required_polarization === 'DV', 'T3R1_S1_DV_REQUIRED');
  assert(config.s1_policy.required_resolution === 'HIGH' && config.s1_policy.pixel_spacing_m === 10, 'T3R1_S1_HIGH_RESOLUTION_REQUIRED');
  assert(config.s1_policy.orthorectify === true, 'T3R1_S1_ORTHORECTIFY_REQUIRED');
  assert(config.s1_policy.minimum_plot_valid_fraction >= 0.95, 'T3R1_S1_MINIMUM_COVERAGE_TOO_WEAK');
  assert(config.s1_policy.sar_to_crop_presence_mapping_authorized === false, 'T3R1_S1_CROP_MAPPING_FORBIDDEN');
  assert(config.s1_policy.sar_to_lifecycle_mapping_authorized === false, 'T3R1_S1_LIFECYCLE_MAPPING_FORBIDDEN');
  assert(config.s1_policy.sar_to_phenology_mapping_authorized === false, 'T3R1_S1_PHENOLOGY_MAPPING_FORBIDDEN');
  assert(config.s1_policy.sar_to_kc_mapping_authorized === false, 'T3R1_S1_KC_MAPPING_FORBIDDEN');
  assert(config.authority_boundary.current_management_season_lifecycle_resolved === false, 'T3R1_S1_LIFECYCLE_MUST_REMAIN_FALSE');
  assert(config.authority_boundary.bounded_carry_forward_authorized === false, 'T3R1_S1_CARRY_FORWARD_MUST_REMAIN_FALSE');
  assert(config.authority_boundary.ea5e2_operational_activation_qualified === false, 'T3R1_S1_EA5E2_MUST_REMAIN_FALSE');
  assert(config.authority_boundary.formal_execution_count === '0/24', 'T3R1_S1_FORMAL_ZERO_REQUIRED');

  assert(probe.includes('CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_S1_EPHEMERAL_TOKEN_BINDING_REQUIRED');
  assert(probe.includes('"VV"') && probe.includes('"VH"') && probe.includes('dataMask'), 'T3R1_S1_REQUIRED_BANDS_MISSING');
  assert(probe.includes('structural_signal_candidate_only: true'), 'T3R1_S1_STRUCTURAL_NONCLAIM_REQUIRED');
  assert(probe.includes('sar_to_lifecycle_mapping_authorized: false'), 'T3R1_S1_PROBE_LIFECYCLE_MAPPING_FORBIDDEN');
  assert(probe.includes("formal_execution_count: '0/24'"), 'T3R1_S1_PROBE_FORMAL_ZERO_REQUIRED');
  assert(!/POLYGON\s*\(\([-0-9.\s,]+\)\)/i.test(probe), 'T3R1_S1_COMMITTED_RAW_POLYGON_FORBIDDEN');
  assert(!/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}/.test(probe), 'T3R1_S1_COMMITTED_TOKEN_FORBIDDEN');

  assert(workflow.includes('workflow_dispatch:'), 'T3R1_S1_WORKFLOW_DISPATCH_REQUIRED');
  assert(workflow.includes('secrets.CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_S1_WORKFLOW_SECRET_BINDING_REQUIRED');
  assert(workflow.includes('persist-credentials: false'), 'T3R1_S1_WORKFLOW_GIT_CREDENTIAL_PERSISTENCE_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_s1_structural_continuity_discovery_boundary_v1',
    status: 'PASS', exact_base_sha: BASE_SHA, exact_subject_sha: SUBJECT_SHA,
    exact_four_file_boundary: true, changed_files: changedFiles,
    represented_scope: 'KBS_MCSE_T3R1_CANDIDATE',
    source_class: 'COPERNICUS_SENTINEL_1_GRD_STRUCTURAL_DISCOVERY',
    authority_effect: 'NONE_STATIC_BOUNDARY_ONLY',
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    ea5e2_operational_activation_qualified: false,
    runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0,
    formal_execution_count: '0/24'
  });
} catch (error) {
  write({ schema_version: 'geox_mcft_cap09_t3r1_s1_structural_continuity_discovery_boundary_v1', status: 'FAIL', exact_base_sha: BASE_SHA || null, exact_subject_sha: SUBJECT_SHA || null, authority_effect: 'NONE', current_management_season_lifecycle_resolved: false, bounded_carry_forward_authorized: false, ea5e2_operational_activation_qualified: false, runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0, formal_execution_count: '0/24', error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
