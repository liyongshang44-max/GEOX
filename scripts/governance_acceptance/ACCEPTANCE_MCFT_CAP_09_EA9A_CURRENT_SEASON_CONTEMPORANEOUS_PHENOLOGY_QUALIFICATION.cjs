#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.MCFT_BASE_SHA;
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9A_CURRENT_SEASON_CONTEMPORANEOUS_PHENOLOGY_QUALIFICATION_GOVERNANCE_RESULT.json');
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9A_CURRENT_SEASON_CONTEMPORANEOUS_PHENOLOGY_QUALIFICATION.mjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9A_CURRENT_SEASON_CONTEMPORANEOUS_PHENOLOGY_QUALIFICATION.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-ea9a-current-season-contemporaneous-phenology-qualification.yml';
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();

const AMENDMENT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md';
const EA1J = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json';
const EA2 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json';
const EA1_MATRIX = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1-SOURCE-QUALIFICATION-MATRIX-V1.json';
const FORMAL_MATRIX = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json';
const PINS = {
  [AMENDMENT09]: '422f60257039e0f674171c218a7ff0a2fd7dc1b2',
  [EA1J]: 'eeb7ab49ee3270421efe4d6674305426074d1541',
  [EA2]: 'b5de9d29189cb654444b3f57d00df290eefe16d3',
  [EA1_MATRIX]: 'c6a2394bc0d97ad2df159a8af95c7e1997ba9aed',
  [FORMAL_MATRIX]: '30b7910a1bd27882b80eb56041924d0f6252ae02'
};

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const blob = (ref, p) => git('rev-parse', `${ref}:${p}`);
const has = (text, marker, code) => assert(text.includes(marker), `${code}:${marker}`);
const lacks = (text, marker, code) => assert(!text.includes(marker), `${code}:${marker}`);
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function imageTokenHit(value, tokens) {
  const normalized = String(value || '').toUpperCase();
  return tokens.find((token) => new RegExp(`(^|_)${token}(_|$)`).test(normalized)) || null;
}

try {
  assert.equal(BASE, 'c5a0110e1cff3fd91d3a205315b73d16ac7d6bd7', 'EA9A_EXACT_BASE_REQUIRED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA9A_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA9A_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((f) => /(^|\/)(apps|packages)\//.test(f)), 'EA9A_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((f) => /migration/i.test(f)), 'EA9A_MIGRATION_DELTA_FORBIDDEN');
  for (const [filePath, sha] of Object.entries(PINS)) {
    assert.equal(blob(BASE, filePath), sha, `EA9A_BASE_PIN:${filePath}`);
    assert.equal(blob('HEAD', filePath), sha, `EA9A_PREDECESSOR_MUTATED:${filePath}`);
  }

  const amendment09 = read(AMENDMENT09);
  for (const marker of [
    'S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION',
    'CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED',
    'PhenoCam or another image source may be stage-determinative only after a separate qualification',
    'GDD remains corroborative',
    'exact 2026 T1 crop material/hybrid identity',
    'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION'
  ]) has(amendment09, marker, 'EA9A_AMENDMENT09_RULE_MISSING');

  const c = json(CONFIG);
  assert.equal(c.schema_version, 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_v2');
  assert.equal(c.base_main_sha, BASE);
  assert.equal(c.formal_scope.site_id, 'KBS_MCSE_T1R1');
  assert.equal(c.formal_scope.field_id, 'field_kbs_mcse_t1r1');
  assert.equal(c.formal_scope.season_id, 'season_2026_corn');
  assert.equal(c.qualification_contract.allowed_nonterminal_progress_result, 'CURRENT_SEASON_HYBRID_GDD_QUALIFICATION_REQUIRED');
  assert.equal(c.qualification_contract.gdd_stage_determinative_under_current_ea1j, false);
  assert.equal(c.qualification_contract.future_observations_authorized, false);
  assert.equal(c.qualification_contract.full_season_ex_post_normalization_authorized, false);
  assert.equal(c.hybrid_discovery_probe.historical_or_other_treatment_hybrid_inference_authorized, false);
  assert.equal(c.hybrid_discovery_probe.exact_product_code_may_be_emitted_as_derived_authority_candidate, true);
  assert.equal(c.hybrid_discovery_probe.exact_relative_maturity_days_may_be_emitted_as_derived_authority_candidate, true);
  assert.equal(c.hybrid_discovery_probe.provider_body_text_may_be_emitted, false);
  assert.equal(c.decision_policy.hybrid_identity_is_not_stage_authority, true);
  assert.equal(c.decision_policy.hybrid_identity_requires_separate_thermal_stage_threshold_qualification, true);
  assert.equal(c.decision_policy.relative_maturity_days_alone_is_not_stage_threshold_authority, true);

  const ea1 = json(EA1_MATRIX);
  const formal = json(FORMAL_MATRIX);
  const imageAudit = c.protected_main_image_authority_audit;
  assert.equal(imageAudit.scope, 'EXISTING_PROTECTED_MAIN_MCFT_CAP09_SOURCE_AUTHORITIES_ONLY');
  assert.equal(imageAudit.existing_exact_t1r1_image_stage_authority_established, false);
  assert.equal(imageAudit.global_image_source_absence_claimed, false);
  assert.equal(imageAudit.future_new_image_source_qualification_authorized, true);
  assert.equal(imageAudit.ea1_source_matrix_blob_sha, PINS[EA1_MATRIX]);
  assert.equal(imageAudit.formal_source_binding_matrix_blob_sha, PINS[FORMAL_MATRIX]);

  const ea1SourceKeys = ea1.source_records.map((record) => record.source_key);
  const ea1ImageHits = ea1SourceKeys.map((key) => ({ key, token: imageTokenHit(key, imageAudit.forbidden_existing_image_source_key_tokens) })).filter((x) => x.token);
  assert.deepEqual(ea1ImageHits, [], 'EA9A_EXISTING_EA1_IMAGE_SOURCE_KEY_UNEXPECTED');

  const expectedFormalRoles = ['SOIL_MOISTURE', 'OBSERVED_RAINFALL', 'HISTORICAL_REFERENCE_ET', 'FUTURE_WEATHER', 'FUTURE_REFERENCE_ET'];
  assert.deepEqual(formal.source_bindings.map((binding) => binding.role), expectedFormalRoles, 'EA9A_FORMAL_FIVE_ROLE_BINDING_DRIFT');
  const formalIdentityStrings = formal.source_bindings.flatMap((binding) => [binding.role, binding.source_family, binding.target_existing_type, binding.provider, binding.model, binding.product_family].filter(Boolean));
  const formalImageHits = formalIdentityStrings.map((value) => ({ value, token: imageTokenHit(value, imageAudit.forbidden_existing_image_source_key_tokens) })).filter((x) => x.token);
  assert.deepEqual(formalImageHits, [], 'EA9A_EXISTING_FORMAL_IMAGE_SOURCE_UNEXPECTED');

  assert.equal(c.enumerated_public_source_candidates.length, 5, 'EA9A_EXACT_FIVE_PUBLIC_CANDIDATES_REQUIRED');
  assert(c.enumerated_public_source_candidates.every((x) => x.stage_determinative === false), 'EA9A_STAGE_AUTHORITY_MUST_NOT_BE_PREDECLARED');
  const planting = c.enumerated_public_source_candidates.find((x) => x.candidate_id === 'KBS_AGLOG_2026_T1_PLANTING_6931');
  assert(planting, 'EA9A_EXACT_2026_T1_PLANTING_CANDIDATE_REQUIRED');
  assert.equal(planting.evidence_role, 'CROP_PLANTING_AND_HYBRID_DISCOVERY_ONLY');

  for (const key of ['database_write_authorized', 'formal_evidence_write_authorized', 'raw_object_write_authorized', 'runtime_config_write_authorized', 'scheduler_write_authorized', 'canonical_runtime_write_authorized']) {
    assert.equal(c.data_use_policy[key], false, `EA9A_WRITE_POLICY_FORBIDDEN:${key}`);
  }
  assert.equal(c.data_use_policy.provider_payload_may_be_committed, false);
  assert.equal(c.data_use_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(c.data_use_policy.provider_body_text_may_be_emitted, false);

  const effect = c.qualification_effect_if_expected_nonterminal_progress_is_proved_and_merged;
  assert.equal(effect.ea9a_terminal_reached, false);
  assert.equal(effect.progress_result, 'CURRENT_SEASON_HYBRID_GDD_QUALIFICATION_REQUIRED');
  assert.equal(effect.current_season_contingent_stage_authority_established, false);
  assert.equal(effect.successor_epoch_selected, false);
  assert.equal(effect.new_natural_season_created, false);
  assert.equal(effect.next_primary_successor, 'S6-EA9A-HYBRID-GDD-STAGE-QUALIFICATION');
  assert.equal(effect.fallback_if_hybrid_gdd_cannot_establish_stage, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');
  assert.equal(effect.formal_execution_count, '0/24');
  assert.equal(effect.mcft_cap09_completed, false);

  const probe = read(PROBE);
  for (const marker of [
    'EXACT_UNAMBIGUOUS_HYBRID_AND_RELATIVE_MATURITY_DISCLOSED',
    'S6-EA9A-HYBRID-GDD-STAGE-QUALIFICATION',
    'hybrid_product_code',
    'relative_maturity_days',
    'provider_body_text_emitted: false',
    'database_write_count: 0',
    'successor_epoch_selected: false'
  ]) has(probe, marker, 'EA9A_PROBE_MARKER_REQUIRED');
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', "from 'pg'", 'S3_ACCESS_KEY', 'AWS_ACCESS_KEY']) {
    lacks(probe.replace(/\s+/g, ''), forbidden.replace(/\s+/g, ''), 'EA9A_PROBE_WRITE_CAPABILITY_FORBIDDEN');
  }

  const workflow = read(WORKFLOW);
  for (const marker of ['Validate exact EA9A no-write governance boundary', 'Run fail-closed current-season phenology qualification', 'Upload immutable EA9A qualification proof']) {
    has(workflow, marker, 'EA9A_WORKFLOW_STEP_REQUIRED');
  }
  for (const forbidden of ['pull_request_target', 'schedule:', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID']) {
    lacks(workflow, forbidden, 'EA9A_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN');
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_governance_result_v2',
    status: 'PASS',
    base_main_sha: BASE,
    subject_head_sha: git('rev-parse', 'HEAD'),
    exact_changed_files: changed,
    predecessor_blobs_verified_unchanged: true,
    protected_main_ea1_image_source_key_count: 0,
    protected_main_formal_image_source_identity_count: 0,
    existing_exact_t1r1_image_stage_authority_established: false,
    global_image_source_absence_claimed: false,
    hybrid_gdd_nonterminal_continuation_authorized: true,
    stage_authority_predeclared: false,
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_governance_result_v2',
    status: 'FAIL',
    base_main_sha: BASE || null,
    error: error instanceof Error ? error.message : String(error),
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
