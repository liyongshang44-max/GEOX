#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SENTINEL2-CURRENT-CROP-LIFECYCLE-DISCOVERY-DESIGN.md';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.mjs';
const ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-sentinel2-current-crop-lifecycle-discovery.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY_BOUNDARY.json');
const EXPECTED_BASE = '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78';
const BASE = String(process.env.MCFT_BASE_SHA || EXPECTED_BASE).trim();
const SUBJECT = String(process.env.MCFT_SUBJECT_SHA || 'HEAD').trim();

function fail(code) { throw new Error(code); }
function requireMarker(text, marker, code) { if (!text.includes(marker)) fail(code); }
function forbidMarker(text, marker, code) { if (text.includes(marker)) fail(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function write(result) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
}

try {
  if (BASE !== EXPECTED_BASE) fail('SENTINEL2_DISCOVERY_EXACT_BASE_MISMATCH');
  const resolvedSubject = git(['rev-parse', SUBJECT]);
  if (!/^[0-9a-f]{40}$/.test(resolvedSubject)) fail('SENTINEL2_DISCOVERY_SUBJECT_SHA_REQUIRED');
  git(['merge-base', '--is-ancestor', EXPECTED_BASE, resolvedSubject]);

  const changed = git(['diff', '--name-only', `${EXPECTED_BASE}...${resolvedSubject}`])
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean).sort();
  const expected = [DOC, PROBE, ACCEPTANCE, WORKFLOW].sort();
  if (JSON.stringify(changed) !== JSON.stringify(expected)) {
    fail(`SENTINEL2_DISCOVERY_BOUNDARY_MISMATCH:${changed.join(',')}`);
  }

  const doc = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  const probe = fs.readFileSync(path.join(ROOT, PROBE), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');
  const combined = `${doc}\n${probe}\n${workflow}`;

  for (const marker of [
    'CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW',
    'SATELLITE_CURRENT_CROP_LIFECYCLE_EVIDENCE_CANDIDATE',
    'KBS039-006.40',
    'treatment T1 / replicate R1 / subplot main',
    'sentinel-2-l2a',
    'scene_binding_ambiguity',
    'Scene-level cloud cover is never treated as plot clear fraction.',
    'current_season_lifecycle_authority_established = false',
    'current_phenology_authority_established = false',
    'current_crop_model_parameter_authority_established = false',
    'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false',
    'Formal = 0/24',
    'authority_effect = NONE',
    'SATELLITE_SOURCE_SPATIAL_TIME_CROP_AND_MAPPING_ADJUDICATION'
  ]) requireMarker(doc, marker, `SENTINEL2_DISCOVERY_DOC_MARKER_MISSING:${marker}`);

  for (const marker of [
    "const KBS_GEOMETRY_URL = 'https://lter.kbs.msu.edu/datatables/829.csv'",
    "const SH_CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search'",
    "const SH_STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1'",
    "const COLLECTION = 'sentinel-2-l2a'",
    "raw_geometry_emitted: false",
    "geometry_coordinates_emitted: false",
    "access_token_emitted: false",
    "authority_effect: 'NONE'",
    "formal_execution_count: '0/24'"
  ]) requireMarker(probe, marker, `SENTINEL2_DISCOVERY_PROBE_MARKER_MISSING:${marker}`);

  for (const marker of [
    'workflow_dispatch:',
    'run_live:',
    'CDSE_SENTINEL_HUB_ACCESS_TOKEN',
    'PROBE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.mjs',
    'ACCEPTANCE_MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.cjs'
  ]) requireMarker(workflow, marker, `SENTINEL2_DISCOVERY_WORKFLOW_MARKER_MISSING:${marker}`);

  forbidMarker(combined, 'SRID=4326;POLYGON((-85.', 'SENTINEL2_DISCOVERY_RESTRICTED_GEOMETRY_LITERAL_FORBIDDEN');
  forbidMarker(combined, 'CDSE_SENTINEL_HUB_CLIENT_SECRET', 'SENTINEL2_DISCOVERY_LONG_LIVED_CLIENT_SECRET_REFERENCE_FORBIDDEN');
  forbidMarker(combined, 'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true', 'SENTINEL2_DISCOVERY_ACTIVATION_CLAIM_FORBIDDEN');
  forbidMarker(combined, 'Formal = 24/24', 'SENTINEL2_DISCOVERY_FORMAL_COMPLETION_CLAIM_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_sentinel2_current_crop_lifecycle_discovery_boundary_v1',
    status: 'PASS',
    exact_base_protected_main: EXPECTED_BASE,
    subject_sha: resolvedSubject,
    exact_four_file_boundary: true,
    restricted_kbs_geometry_committed: false,
    copernicus_secret_values_committed: false,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    current_season_lifecycle_authority_established: false,
    current_phenology_authority_established: false,
    current_crop_model_parameter_authority_established: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    authority_effect: 'NONE',
    live_discovery_required_separately: true,
    next_required_review: 'SATELLITE_SOURCE_SPATIAL_TIME_CROP_AND_MAPPING_ADJUDICATION'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_sentinel2_current_crop_lifecycle_discovery_boundary_v1',
    status: 'FAIL',
    exact_base_protected_main: EXPECTED_BASE,
    authority_effect: 'NONE',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
