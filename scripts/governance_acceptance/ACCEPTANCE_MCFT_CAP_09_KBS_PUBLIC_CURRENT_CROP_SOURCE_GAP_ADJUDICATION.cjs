#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLIC-CURRENT-CROP-SOURCE-GAP-ADJUDICATION.md';
const ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLIC_CURRENT_CROP_SOURCE_GAP_ADJUDICATION.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-kbs-public-current-crop-source-gap-adjudication.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_KBS_PUBLIC_CURRENT_CROP_SOURCE_GAP_ADJUDICATION.json');
const EXPECTED_BASE = '5977e9c46e86ced14ef03fe072dc868f9b5f8a7a';
const BASE = String(process.env.MCFT_BASE_SHA || EXPECTED_BASE).trim();
const SUBJECT = String(process.env.MCFT_SUBJECT_SHA || 'HEAD').trim();

function fail(code) {
  throw new Error(code);
}
function requireMarker(text, marker, code) {
  if (!text.includes(marker)) fail(code);
}
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function write(result) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
}

try {
  if (BASE !== EXPECTED_BASE) fail('KBS_PUBLIC_SOURCE_GAP_EXACT_BASE_MISMATCH');
  if (!/^[0-9a-f]{40}$/.test(git(['rev-parse', SUBJECT]))) fail('KBS_PUBLIC_SOURCE_GAP_SUBJECT_SHA_REQUIRED');
  git(['merge-base', '--is-ancestor', EXPECTED_BASE, SUBJECT]);

  const changed = git(['diff', '--name-only', `${EXPECTED_BASE}...${SUBJECT}`])
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean).sort();
  const expected = [DOC, ACCEPTANCE, WORKFLOW].sort();
  if (JSON.stringify(changed) !== JSON.stringify(expected)) {
    fail(`KBS_PUBLIC_SOURCE_GAP_BOUNDARY_MISMATCH:${changed.join(',')}`);
  }

  const doc = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');

  const markers = [
    'DIRECT_CURRENT_ANCHOR_PUBLIC_SOURCE_GAP_ADJUDICATION',
    'KBS_PUBLIC_CURRENT_SEASON_DIRECT_T1R1_CROP_AUTHORITY_GAP_ESTABLISHED_FOR_REVIEWED_PUBLIC_SURFACES',
    'reviewed_public_kbs_current_2026_data_exists = true',
    'reviewed_public_kbs_p0306q_2026_data_exists = true',
    'reviewed_public_kbs_t1r1_direct_current_crop_authority_established = false',
    'reviewed_public_kbs_t1r1_direct_phenology_authority_established = false',
    'reviewed_public_kbs_t1r1_current_crop_model_parameter_authority_established = false',
    'CURRENT_PROVIDER_POSITIVE_CONTROL_FORMAL_SCOPE_MISMATCH',
    'no T3 -> T1R1 substitution',
    'CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW',
    'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false',
    'Formal = 0/24'
  ];
  for (const marker of markers) requireMarker(doc, marker, `KBS_PUBLIC_SOURCE_GAP_MARKER_MISSING:${marker}`);

  const dangerousPositiveClaims = [
    'T3 observation is authorized for T1R1',
    'GLBRC phenology is authorized for MCSE T1R1',
    'alternative source is automatically authorized',
    'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true',
    'Formal = 24/24'
  ];
  for (const claim of dangerousPositiveClaims) {
    if (doc.includes(claim)) fail(`KBS_PUBLIC_SOURCE_GAP_DANGEROUS_CLAIM:${claim}`);
  }

  requireMarker(workflow, 'https://aglog.kbs.msu.edu/materials/392', 'KBS_PUBLIC_SOURCE_GAP_CURRENT_POSITIVE_CONTROL_CHECK_REQUIRED');
  requireMarker(workflow, 'https://lter.kbs.msu.edu/datatables/39', 'KBS_PUBLIC_SOURCE_GAP_BIOMASS_CHECK_REQUIRED');
  requireMarker(workflow, 'https://lter.kbs.msu.edu/datatables/51', 'KBS_PUBLIC_SOURCE_GAP_YIELD_CHECK_REQUIRED');
  requireMarker(workflow, 'https://lter.kbs.msu.edu/datatables/828', 'KBS_PUBLIC_SOURCE_GAP_PRECISION_YIELD_CHECK_REQUIRED');
  requireMarker(workflow, 'https://lter.kbs.msu.edu/datatables/514', 'KBS_PUBLIC_SOURCE_GAP_PHENOLOGY_CHECK_REQUIRED');
  requireMarker(workflow, 'https://lter.kbs.msu.edu/datatables/794', 'KBS_PUBLIC_SOURCE_GAP_REX_CHECK_REQUIRED');

  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_crop_source_gap_adjudication_v1',
    status: 'PASS',
    exact_base_protected_main: EXPECTED_BASE,
    subject_sha: git(['rev-parse', SUBJECT]),
    exact_three_file_boundary: true,
    reviewed_public_kbs_current_2026_data_exists: true,
    reviewed_public_kbs_p0306q_2026_data_exists: true,
    reviewed_public_kbs_t1r1_direct_current_crop_authority_established: false,
    reviewed_public_kbs_t1r1_direct_phenology_authority_established: false,
    reviewed_public_kbs_t1r1_current_crop_model_parameter_authority_established: false,
    t3_to_t1r1_source_substitution_authorized: false,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    persistence_authority_created: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    next_frontier: 'CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW'
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_crop_source_gap_adjudication_v1',
    status: 'FAIL',
    exact_base_protected_main: EXPECTED_BASE,
    error: message
  });
  process.exitCode = 1;
}
