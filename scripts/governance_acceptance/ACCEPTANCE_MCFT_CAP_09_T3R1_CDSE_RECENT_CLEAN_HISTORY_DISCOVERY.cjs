#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-RECENT-CLEAN-HISTORY-DISCOVERY-V1.json');
const PROBE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_RECENT_CLEAN_HISTORY_DISCOVERY.mjs');
const WORKFLOW_PATH = path.join(ROOT, '.github/workflows/mcft-cap-09-t3r1-cdse-recent-clean-history-discovery.yml');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CDSE_RECENT_CLEAN_HISTORY_DISCOVERY_BOUNDARY.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-cdse-recent-clean-history-discovery.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-RECENT-CLEAN-HISTORY-DISCOVERY-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_CDSE_RECENT_CLEAN_HISTORY_DISCOVERY.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CDSE_RECENT_CLEAN_HISTORY_DISCOVERY.mjs',
].sort();

function assert(c, code) { if (!c) throw new Error(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function write(x) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(x, null, 2)}\n`); console.log(JSON.stringify(x)); }

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_CDSE_DISCOVERY_EXACT_BASE_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_CDSE_DISCOVERY_EXACT_SUBJECT_REQUIRED');
  execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, SUBJECT_SHA], { cwd: ROOT, stdio: 'ignore' });
  const changed = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `T3R1_CDSE_DISCOVERY_EXACT_FOUR_FILE_BOUNDARY_FAIL:${changed.join(',')}`);
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const probe = fs.readFileSync(PROBE_PATH, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert(config.exact_base_protected_main === BASE_SHA, 'T3R1_CDSE_DISCOVERY_BASE_MISMATCH');
  assert(config.record_status === 'DISCOVERY_ONLY' && config.authority_policy.discovery_only === true, 'T3R1_CDSE_DISCOVERY_ONLY_REQUIRED');
  assert(config.candidate_scope.treatment === 'T3' && config.candidate_scope.replicate === 'R1', 'T3R1_CDSE_DISCOVERY_SCOPE_REQUIRED');
  assert(config.candidate_scope.hybrid === 'Pioneer P0306Q' && config.candidate_scope.planting_date === '2026-05-20', 'T3R1_CDSE_DISCOVERY_CROP_IDENTITY_REQUIRED');
  assert(config.conservative_crop_only_subzone_policy.expected_geometry_semantic_hash === 'sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a', 'T3R1_CDSE_DISCOVERY_GEOMETRY_HASH_REQUIRED');
  assert(JSON.stringify(config.observation_rule.scl_clear_land_classes) === JSON.stringify([4, 5]), 'T3R1_CDSE_DISCOVERY_SCL_45_REQUIRED');
  assert(config.observation_rule.scl_7_as_clear_land_forbidden === true, 'T3R1_CDSE_DISCOVERY_SCL7_FORBIDDEN');
  assert(config.observation_rule.minimum_plot_clear_land_fraction >= 0.8, 'T3R1_CDSE_DISCOVERY_CLEAR_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_vegetated_fraction_of_clear_land >= 0.8, 'T3R1_CDSE_DISCOVERY_VEGETATION_THRESHOLD_TOO_WEAK');
  assert(config.observation_rule.minimum_mean_ndvi_over_clear_land >= 0.5, 'T3R1_CDSE_DISCOVERY_NDVI_THRESHOLD_TOO_WEAK');
  assert(config.authority_policy.current_management_season_lifecycle_authorized === false, 'T3R1_CDSE_DISCOVERY_LIFECYCLE_FORBIDDEN');
  assert(config.authority_policy.bounded_carry_forward_authorized === false, 'T3R1_CDSE_DISCOVERY_CARRY_FORWARD_FORBIDDEN');
  assert(config.authority_policy.ea5e2_authorized === false, 'T3R1_CDSE_DISCOVERY_EA5E2_FORBIDDEN');
  assert(probe.includes('CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_CDSE_DISCOVERY_EPHEMERAL_TOKEN_REQUIRED');
  assert(probe.includes("authority_effect: 'NONE_DISCOVERY_ONLY'"), 'T3R1_CDSE_DISCOVERY_NO_AUTHORITY_REQUIRED');
  assert(probe.includes("formal_execution_count: '0/24'"), 'T3R1_CDSE_DISCOVERY_FORMAL_ZERO_REQUIRED');
  assert(!/accept:\s*['\"]application\/json/i.test(probe), 'T3R1_CDSE_DISCOVERY_INVALID_ACCEPT_FORBIDDEN');
  assert(!/POLYGON\s*\(\([-0-9.\s,]+\)\)/i.test(probe), 'T3R1_CDSE_DISCOVERY_RAW_POLYGON_FORBIDDEN');
  assert(workflow.includes('workflow_dispatch:'), 'T3R1_CDSE_DISCOVERY_WORKFLOW_DISPATCH_REQUIRED');
  assert(workflow.includes('secrets.CDSE_SENTINEL_HUB_ACCESS_TOKEN'), 'T3R1_CDSE_DISCOVERY_SECRET_BINDING_REQUIRED');

  write({ schema_version: 'geox_mcft_cap09_t3r1_cdse_recent_clean_history_discovery_boundary_v1', status: 'PASS', exact_base_sha: BASE_SHA, exact_subject_sha: SUBJECT_SHA, exact_four_file_boundary: true, changed_files: changed, strict_scl_45: true, authority_effect: 'NONE_STATIC_BOUNDARY_ONLY', current_management_season_lifecycle_authority_established: false, bounded_carry_forward_authorized: false, ea5e2_operational_activation_qualified: false, formal_execution_count: '0/24' });
} catch (error) {
  write({ schema_version: 'geox_mcft_cap09_t3r1_cdse_recent_clean_history_discovery_boundary_v1', status: 'FAIL', exact_base_sha: BASE_SHA || null, exact_subject_sha: SUBJECT_SHA || null, authority_effect: 'NONE', current_management_season_lifecycle_authority_established: false, bounded_carry_forward_authorized: false, ea5e2_operational_activation_qualified: false, formal_execution_count: '0/24', error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
