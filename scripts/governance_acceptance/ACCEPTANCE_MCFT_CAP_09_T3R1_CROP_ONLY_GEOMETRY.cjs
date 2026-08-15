#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXPECTED_BASE = '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78';
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_CROP_ONLY_GEOMETRY.mjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_CROP_ONLY_GEOMETRY.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-t3r1-crop-only-geometry.yml';
const OUT = 'acceptance-output/MCFT_CAP_09_T3R1_CROP_ONLY_GEOMETRY_GOVERNANCE_RESULT.json';
const ALLOWED = [CONFIG, PROBE, GATE, WORKFLOW].sort();
const PRESERVED = {
  'docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md': 'e5d151665b1137af87bfab509e874abd1c8d2ec8',
  'docs/digital_twin/mcft/GEOX-MCFT-00-GEOMETRY-CANONICALIZATION.md': '2f413d43c11aeff79dcf3e4e8069be426f71f018',
  'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs': 'ad333b91183c34140766c88b3eab6c88a5638eba',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json': 'eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json': 'dedc8db6e2e3c902066ed94b0d3322a69775b7b6',
};

function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function has(text, marker, code) { assert(text.includes(marker), `${code}:${marker}`); }

try {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  const subject = String(process.env.MCFT_SUBJECT_SHA || '').trim();
  const head = git('rev-parse', 'HEAD');
  assert.equal(base, EXPECTED_BASE, 'T3R1_GEOMETRY_EXACT_BASE_REQUIRED');
  assert.equal(subject, head, 'T3R1_GEOMETRY_EXACT_HEAD_REQUIRED');
  assert.equal(git('merge-base', base, head), base, 'T3R1_GEOMETRY_BASE_NOT_ANCESTOR');
  const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean).sort();
  assert.deepEqual(changed, ALLOWED, 'T3R1_GEOMETRY_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');

  for (const [file, expectedBlob] of Object.entries(PRESERVED)) {
    assert.equal(git('rev-parse', `HEAD:${file}`), expectedBlob, `T3R1_GEOMETRY_PREDECESSOR_MUTATED:${file}`);
  }

  const config = JSON.parse(read(CONFIG));
  assert.equal(config.schema_version, 'geox_mcft_cap09_t3r1_crop_only_geometry_authority_v1');
  assert.equal(config.frontier, 'T3R1_CROP_ONLY_GEOMETRY_AUTHORITY');
  assert.equal(config.exact_base_protected_main, EXPECTED_BASE);
  assert.equal(config.candidate_scope.treatment, 'T3');
  assert.equal(config.candidate_scope.replicate, 'R1');
  assert.equal(config.candidate_scope.geometry_type, 'Polygon');
  assert.equal(config.candidate_scope.crs, 'EPSG:4326');
  assert.equal(config.provider_geometry_selector.required_srid, 4326);
  assert.equal(config.provider_geometry_selector.required_distinct_vertex_count, 4);
  assert.equal(config.provider_geometry_selector.require_convex_quadrilateral, true);
  assert.equal(config.prairie_strip_guard.declared_width_ft, 15);
  assert.equal(config.prairie_strip_guard.declared_length_ft, 300);
  assert.equal(config.prairie_strip_guard.width_m, 4.572);
  assert.equal(config.prairie_strip_guard.length_m, 91.44);
  assert.equal(config.prairie_strip_guard.position, 'CENTER_OF_T3_T4_PLOT');
  assert.equal(config.prairie_strip_guard.strip_geometry_wkt_required, false);
  assert.equal(config.prairie_strip_guard.strip_geometry_may_not_be_invented, true);
  assert.equal(config.conservative_subzone_policy.construction, 'BILINEAR_INTERIOR_RECTANGLE_FROM_PROVIDER_MAIN_QUADRILATERAL_V1');
  assert.equal(config.conservative_subzone_policy.short_axis_fraction_start, 0.15);
  assert.equal(config.conservative_subzone_policy.short_axis_fraction_end, 0.30);
  assert.equal(config.conservative_subzone_policy.long_axis_fraction_start, 0.25);
  assert.equal(config.conservative_subzone_policy.long_axis_fraction_end, 0.75);
  assert(config.conservative_subzone_policy.minimum_center_strip_clearance_m >= 10, 'T3R1_GEOMETRY_MINIMUM_STRIP_CLEARANCE_TOO_WEAK');
  assert(config.conservative_subzone_policy.minimum_outer_boundary_margin_m >= 10, 'T3R1_GEOMETRY_MINIMUM_OUTER_MARGIN_TOO_WEAK');
  assert(config.conservative_subzone_policy.minimum_end_boundary_margin_m >= 20, 'T3R1_GEOMETRY_MINIMUM_END_MARGIN_TOO_WEAK');
  assert.equal(config.conservative_subzone_policy.canonicalization_id, 'GEOX_MCFT_GEOJSON_CANONICALIZATION_V1');
  assert.equal(config.conservative_subzone_policy.provider_raw_geometry_may_be_emitted, false);
  assert.equal(config.conservative_subzone_policy.provider_raw_geometry_may_be_committed, false);
  assert.equal(config.conservative_subzone_policy.derived_geometry_coordinates_may_be_emitted, false);
  assert.equal(config.resolution_policy.formal_rebind_authorized_by_this_probe, false);
  assert.equal(config.resolution_policy.current_lifecycle_authorized_by_this_probe, false);
  assert.equal(config.resolution_policy.ea5e2_authorized_by_this_probe, false);

  for (const [key, predecessor] of Object.entries(config.authority_predecessors)) {
    assert.equal(PRESERVED[predecessor.path], predecessor.blob_sha, `T3R1_GEOMETRY_PREDECESSOR_PIN_INVALID:${key}`);
  }
  for (const claim of [
    'NO_WHOLE_T3R1_PLOT_AS_CROP_ONLY',
    'NO_PRAIRIE_STRIP_WKT_INVENTION',
    'NO_PRAIRIE_STRIP_RELABELLING_AS_CORN',
    'NO_RAW_KBS_GEOMETRY_PUBLICATION',
    'NO_PROVIDER_RAW_GEOMETRY_IN_PUBLIC_ARTIFACT',
    'NO_DERIVED_COORDINATES_IN_PUBLIC_ARTIFACT',
    'NO_T1R1_AUTHORITY_MUTATION',
    'NO_CURRENT_LIFECYCLE_CLAIM',
    'NO_FORMAL_SITE_REBIND',
    'NO_EA5E2_OPERATIONAL_ACTIVATION',
    'NO_FORMAL_WINDOW_START'
  ]) assert(config.hard_nonclaims.includes(claim), `T3R1_GEOMETRY_NONCLAIM_MISSING:${claim}`);

  const probe = read(PROBE);
  for (const marker of [
    "MCFT00_GEOMETRY_AND_HASH.cjs",
    "canonicalGeometry(feature)",
    "geometryValidationCodes(feature)",
    "polygonAreaM2(canonical)",
    "strip_wkt_invented: false",
    "prairie_strip_relabelled_corn: false",
    "whole_t3r1_plot_assumed_crop_only: false",
    "raw_or_derived_coordinates_emitted: false",
    "formal_site_rebind_authorized: false",
    "current_lifecycle_resolved: false",
    "formal_execution_count: '0/24'"
  ]) has(probe, marker, 'T3R1_GEOMETRY_PROBE_RULE_MISSING');
  assert(!probe.includes('field_kbs_mcse_t1r1'), 'T3R1_GEOMETRY_T1R1_FIELD_RELABEL_FORBIDDEN');
  assert(!probe.includes('zone_kbs_mcse_t1r1_formal_v1'), 'T3R1_GEOMETRY_T1R1_ZONE_RELABEL_FORBIDDEN');

  const workflow = read(WORKFLOW);
  has(workflow, 'pull_request:', 'T3R1_GEOMETRY_PR_TRIGGER_REQUIRED');
  has(workflow, 'merge_group:', 'T3R1_GEOMETRY_MERGE_GROUP_TRIGGER_REQUIRED');
  has(workflow, 'persist-credentials: false', 'T3R1_GEOMETRY_READ_ONLY_CHECKOUT_REQUIRED');
  has(workflow, 'PROBE_MCFT_CAP_09_T3R1_CROP_ONLY_GEOMETRY.mjs', 'T3R1_GEOMETRY_LIVE_PROBE_REQUIRED');
  assert(!/^\s{2}push:/m.test(workflow), 'T3R1_GEOMETRY_PUSH_TRIGGER_FORBIDDEN');
  assert(!workflow.includes('workflow_dispatch:'), 'T3R1_GEOMETRY_MANUAL_DISPATCH_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_crop_only_geometry_governance_result_v1',
    status: 'PASS',
    subject_sha: head,
    exact_base_sha: base,
    exact_four_file_boundary: true,
    frozen_mcft00_geometry_helper_reused: true,
    t1r1_formal_authorities_preserved: true,
    provider_raw_geometry_publication_forbidden: true,
    derived_coordinates_publication_forbidden: true,
    strip_wkt_invention_forbidden: true,
    formal_rebind_authorized: false,
    current_lifecycle_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_crop_only_geometry_governance_result_v1',
    status: 'FAIL',
    error: String(error?.message || error),
    formal_rebind_authorized: false,
    current_lifecycle_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_window_started: false,
  });
  process.exitCode = 1;
}
