#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLIC-CURRENT-AUTHORITY-CANDIDATE-SCREEN.md';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATES.mjs';
const ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATES.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-kbs-public-current-authority-candidates.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATE_SCREEN_BOUNDARY.json');
const EXPECTED_BASE = '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78';
const BASE = String(process.env.MCFT_BASE_SHA || EXPECTED_BASE).trim();
const SUBJECT = String(process.env.MCFT_SUBJECT_SHA || 'HEAD').trim();

function fail(code) { throw new Error(code); }
function requireMarker(text, marker, code) { if (!text.includes(marker)) fail(code); }
function forbidMarker(text, marker, code) { if (text.includes(marker)) fail(code); }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}

try {
  if (BASE !== EXPECTED_BASE) fail('KBS_AUTHORITY_SCREEN_EXACT_BASE_MISMATCH');
  const resolvedSubject = git(['rev-parse', SUBJECT]);
  if (!/^[0-9a-f]{40}$/.test(resolvedSubject)) fail('KBS_AUTHORITY_SCREEN_SUBJECT_REQUIRED');
  git(['merge-base', '--is-ancestor', EXPECTED_BASE, resolvedSubject]);

  const changed = git(['diff', '--name-only', `${EXPECTED_BASE}...${resolvedSubject}`])
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean).sort();
  const expected = [DOC, PROBE, ACCEPTANCE, WORKFLOW].sort();
  if (JSON.stringify(changed) !== JSON.stringify(expected)) {
    fail(`KBS_AUTHORITY_SCREEN_BOUNDARY_MISMATCH:${changed.join(',')}`);
  }

  const doc = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  const probe = fs.readFileSync(path.join(ROOT, PROBE), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');

  for (const marker of [
    'KBS_AGLOG_MCSE_LIVE_FAMILY',
    'KBS004_SEEDS_AND_PLANTING_DATE',
    'KBS_AGLOG_MATERIAL_P0306Q',
    'KBS019_ANNUAL_CROP_BIOMASS',
    'KBS030_ANNUAL_CROP_STAND_COUNTS',
    'KBS020_AGRONOMIC_YIELDS',
    'KBS037_PROCESSED_GEOREFERENCED_YIELD',
    'KBS092_GLBRC_PHENOLOGY',
    'KBS140_REX_ANPP',
    'observation `7095`',
    'historical positive biological lifecycle-anchor candidate',
    'current_runtime_lifecycle_authority_established = false',
    'phenology_authority_established = false',
    'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false',
    'Formal = 0/24',
    'authority_effect = NONE'
  ]) requireMarker(doc, marker, `KBS_AUTHORITY_SCREEN_DOC_MARKER_MISSING:${marker}`);

  for (const marker of [
    'PROBE_MCFT_CAP_09_DIRECT_CURRENT_ANCHOR_REFRESH_DISCOVERY.mjs',
    "'KBS_AGLOG_MCSE_LIVE_FAMILY'",
    "'KBS_AGLOG_MATERIAL_P0306Q'",
    "'KBS019_ANNUAL_CROP_BIOMASS'",
    "'KBS030_ANNUAL_CROP_STAND_COUNTS'",
    "'KBS020_AGRONOMIC_YIELDS'",
    "'KBS037_PROCESSED_GEOREFERENCED_YIELD'",
    "'KBS092_GLBRC_PHENOLOGY'",
    "'KBS140_REX_ANPP'",
    "'WAIT_FOR_NEW_DIRECT_KBS_T1R1_CROP_OR_PHENOLOGY_FACT'",
    "authority_effect: 'NONE'",
    "formal_execution_count: '0/24'"
  ]) requireMarker(probe, marker, `KBS_AUTHORITY_SCREEN_PROBE_MARKER_MISSING:${marker}`);

  for (const marker of [
    'mcft-cap-09-kbs-public-current-authority-candidates',
    'PROBE_MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATES.mjs',
    'ACCEPTANCE_MCFT_CAP_09_KBS_PUBLIC_CURRENT_AUTHORITY_CANDIDATES.cjs'
  ]) requireMarker(workflow, marker, `KBS_AUTHORITY_SCREEN_WORKFLOW_MARKER_MISSING:${marker}`);

  forbidMarker(doc, 'EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true', 'KBS_AUTHORITY_SCREEN_ACTIVATION_CLAIM_FORBIDDEN');
  forbidMarker(doc, 'Formal = 24/24', 'KBS_AUTHORITY_SCREEN_FORMAL_COMPLETION_CLAIM_FORBIDDEN');
  forbidMarker(probe, "authority_effect: 'EFFECTIVE'", 'KBS_AUTHORITY_SCREEN_AUTHORITY_EFFECT_FORBIDDEN');

  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_authority_candidate_screen_boundary_v1',
    status: 'PASS',
    exact_base_protected_main: EXPECTED_BASE,
    subject_sha: resolvedSubject,
    exact_four_file_boundary: true,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    authority_effect: 'NONE',
    formal_execution_count: '0/24'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_kbs_public_current_authority_candidate_screen_boundary_v1',
    status: 'FAIL',
    exact_base_protected_main: EXPECTED_BASE,
    authority_effect: 'NONE',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
