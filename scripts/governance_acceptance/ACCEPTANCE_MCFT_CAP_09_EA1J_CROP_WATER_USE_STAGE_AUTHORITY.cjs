#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1J_CROP_WATER_USE_STAGE_AUTHORITY_GOVERNANCE_RESULT.json');
const BASE = process.env.MCFT_BASE_SHA || 'HEAD^';
const AUTHORITY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json';
const AMENDMENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md';
const AMENDMENT_BLOB = '41270b888e15e4d9a6c9a34e1fa3f70e957a275e';
const EA1 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SITE-SOURCE-QUALIFICATION-V1.json';
const EA1_BLOB = 'a4329330cfae941a033d65f55e91b8ae8e96d862';
const EA1I = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json';
const EA1I_BLOB = '47d41c48027e84285e934e7cda8af52fae6aa47d';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1J_CROP_WATER_USE_STAGE_AUTHORITY.mjs';
const FILES = [
  '.github/workflows/mcft-cap-09-ea1j-crop-water-use-stage-authority.yml',
  AUTHORITY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1J_CROP_WATER_USE_STAGE_AUTHORITY.cjs',
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
  assert.deepEqual(changed, FILES, 'EA1J_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA1J_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((file) => /(^|\/)(apps|packages)\//.test(file)), 'EA1J_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /migration/i.test(file)), 'EA1J_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((file) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(file)), 'EA1J_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const amendmentBlobAtBase = git(['rev-parse', `${BASE}:${AMENDMENT}`]);
  const ea1BlobAtBase = git(['rev-parse', `${BASE}:${EA1}`]);
  const ea1iBlobAtBase = git(['rev-parse', `${BASE}:${EA1I}`]);
  assert.equal(amendmentBlobAtBase, AMENDMENT_BLOB, 'EA1J_EXACT_AMENDMENT_AUTHORITY_REQUIRED');
  assert.equal(ea1BlobAtBase, EA1_BLOB, 'EA1J_EXACT_EA1_AUTHORITY_REQUIRED');
  assert.equal(ea1iBlobAtBase, EA1I_BLOB, 'EA1J_EXACT_EA1I_AUTHORITY_REQUIRED');

  const authority = json(AUTHORITY);
  const probe = read(PROBE);
  const signal = json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');

  assert.equal(authority.capability_line_id, 'MCFT-CAP-09');
  assert.equal(authority.slice_id, 'MCFT-CAP-09.S6');
  assert.equal(authority.internal_lifecycle, 'S6-EA1_EXTERNAL_SITE_AND_SOURCE_QUALIFICATION_CONTINUATION');
  assert.equal(authority.base_main_sha, '473d4529af0ee042bab9214d05f46bf8777428e1');
  assert.equal(authority.derived_context_authority, 'FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1');
  assert.equal(authority.scope_candidate.site_candidate_id, 'KBS_MCSE_T1R1');
  assert.equal(authority.scope_candidate.treatment, 'T1_CONVENTIONAL');
  assert.equal(authority.scope_candidate.replicate, 'R1');
  assert.equal(authority.scope_candidate.crop, 'corn');
  assert.equal(authority.scope_candidate.biological_stage_truth_claimed, false);
  assert.equal(authority.scope_candidate.field_phenology_observation_claimed, false);

  assert.equal(authority.planting_authority.provider, 'KBS_AGLOG');
  assert.equal(authority.planting_authority.observation_id, 6931);
  assert.equal(authority.planting_authority.observation_type, 'Planting');
  assert.equal(authority.planting_authority.area, 'T1');
  assert.equal(authority.planting_authority.crop, 'corn');
  assert.equal(authority.planting_authority.planting_local_date, '2026-05-11');
  assert.equal(authority.planting_authority.timezone, 'America/Detroit');
  assert.equal(authority.planting_authority.event_time_precision, 'LOCAL_CALENDAR_DAY_ONLY');
  assert.equal(authority.planting_authority.possible_event_window_utc.start_inclusive, '2026-05-11T04:00:00.000Z');
  assert.equal(authority.planting_authority.possible_event_window_utc.end_exclusive, '2026-05-12T04:00:00.000Z');
  assert.equal(authority.planting_authority.false_precision_forbidden, true);

  assert.equal(authority.model_stage_prior.provider, 'FAO_IRRIGATION_AND_DRAINAGE_PAPER_56_TABLE_11');
  assert.equal(authority.model_stage_prior.crop_row_family, 'MAIZE_GRAIN');
  assert.equal(authority.model_stage_prior.selection_policy, 'ALL_PUBLISHED_MAIZE_GRAIN_STAGE_LENGTH_VARIANTS_MUST_AGREE');
  assert.equal(authority.model_stage_prior.variants.length, 6);
  assert.deepEqual(authority.model_stage_prior.variants.map((v) => [v.initial_days, v.development_days, v.mid_days, v.late_days, v.total_days]), [
    [30,50,60,40,180],
    [25,40,45,30,140],
    [20,35,40,30,125],
    [20,35,40,30,125],
    [30,40,50,30,150],
    [30,40,50,50,170],
  ]);
  assert.equal(authority.model_stage_prior.single_region_best_fit_selection_forbidden, true);
  assert.equal(authority.model_stage_prior.cap08_synthetic_schedule_dates_reuse_forbidden, true);

  assert.deepEqual(authority.derivation_policy.allowed_stage_codes, ['INITIAL','DEVELOPMENT','MID','LATE']);
  assert.equal(authority.derivation_policy.algorithm_id, 'FAO56_MAIZE_GRAIN_CONSENSUS_ENVELOPE_FROM_PLANTING_DATE_V1');
  assert.equal(authority.derivation_policy.future_observations_forbidden, true);
  assert.equal(authority.derivation_policy.future_phenocam_observations_forbidden, true);
  assert.equal(authority.derivation_policy.full_season_ex_post_normalization_forbidden, true);
  assert.equal(authority.derivation_policy.planting_time_uncertainty_must_be_carried, true);
  assert.equal(authority.derivation_policy.backward_stability_hours, 6);
  assert.equal(authority.derivation_policy.forward_transition_guard_hours, 30);
  assert.equal(authority.derivation_policy.forward_guard_class, 'ASSUMED_STAGE_TRANSITION_GUARD');
  assert.equal(authority.derivation_policy.transition_risk_failure_code, 'STAGE_TRANSITION_RISK');
  assert.equal(authority.derivation_policy.no_consensus_failure_code, 'CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS');

  assert.equal(authority.gdd_policy.stage_determinative, false);
  assert.equal(authority.gdd_policy.silent_hybrid_or_relative_maturity_assumption_forbidden, true);
  assert.equal(authority.qualification_effect.expected_current_stage_at_design_time, 'MID');
  assert.equal(authority.qualification_effect.expected_stage_is_normative_without_exact_head_probe, false);
  assert.equal(authority.qualification_effect.formal_crop_context_authority_created, false);
  assert.equal(authority.qualification_effect.qualified_formal_site, false);
  assert.equal(authority.qualification_effect.database_write_authorized, false);
  assert.equal(authority.qualification_effect.formal_evidence_write_authorized, false);
  assert.equal(authority.qualification_effect.runtime_source_authorized, false);
  assert.equal(authority.qualification_effect.formal_window_started, false);

  for (const nonclaim of [
    'NO_OBSERVED_BIOLOGICAL_STAGE_CLAIM',
    'NO_V_STAGE_OR_R_STAGE_GROUND_TRUTH',
    'NO_SINGLE_FAO_REGION_PARAMETER_TREATED_AS_KBS_SITE_TRUTH',
    'NO_CAP08_SYNTHETIC_STAGE_DATES_REUSED',
    'NO_FUTURE_OBSERVATION_USE',
    'NO_FULL_SEASON_EX_POST_NORMALIZATION',
    'NO_HYBRID_SPECIFIC_GDD_STAGE_GUESS',
    'NO_FORMAL_CROP_CONTEXT_AUTHORITY_FROM_PROBE_CONFIG_ALONE',
    'NO_DATABASE_WRITE',
    'NO_FORMAL_EVIDENCE_WRITE',
    'NO_RUNTIME_PRODUCT_SOURCE_DELTA',
    'NO_FORMAL_WINDOW_START',
    'NO_MCFT_CAP_09_COMPLETION',
  ]) assert(authority.hard_nonclaims.includes(nonclaim), `EA1J_HARD_NONCLAIM_REQUIRED:${nonclaim}`);

  for (const marker of [
    'STAGE_TRANSITION_RISK',
    'CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS',
    'all_fao_maize_grain_variants_agree: true',
    'future_observations_used: false',
    'future_phenocam_observations_used: false',
    'full_season_ex_post_normalization_used: false',
    'hybrid_specific_gdd_stage_threshold_used: false',
    'database_write_count: 0',
    'formal_evidence_write_count: 0',
  ]) assert(probe.includes(marker), `EA1J_REQUIRED_PROBE_MARKER_MISSING:${marker}`);
  for (const forbidden of ['DATABASE_URL', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'pg.Pool', 'INSERT INTO public.facts', 'INSERT INTO facts']) {
    assert(!probe.includes(forbidden), `EA1J_DATABASE_OR_WRITE_MARKER_FORBIDDEN:${forbidden}`);
  }

  assert(!signal.explicit_candidate_status_values.includes(authority.record_status), 'EA1J_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
  const candidateBooleanKeys = new Set(signal.explicit_candidate_boolean_field_names);
  for (const [key, value] of Object.entries(authority)) {
    assert(!(candidateBooleanKeys.has(key) && value === true), `EA1J_EXPLICIT_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    for (const pattern of signal.explicit_candidate_boolean_field_patterns) {
      assert(!(new RegExp(pattern).test(key) && value === true), `EA1J_PATTERN_CANDIDATE_BOOLEAN_FORBIDDEN:${key}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea1j_crop_water_use_stage_governance_acceptance_v1',
    status: 'PASS',
    base_sha: BASE,
    amendment_blob_sha: amendmentBlobAtBase,
    ea1_blob_sha: ea1BlobAtBase,
    ea1i_blob_sha: ea1iBlobAtBase,
    changed_files: changed,
    exact_file_count: changed.length,
    runtime_product_source_delta: 0,
    migration_delta: 0,
    database_write_delta: 0,
    formal_evidence_write_delta: 0,
    formal_crop_context_authority_created: false,
    formal_window_started: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1j_crop_water_use_stage_governance_acceptance_v1',
    status: 'FAIL',
    error: error && error.message ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
