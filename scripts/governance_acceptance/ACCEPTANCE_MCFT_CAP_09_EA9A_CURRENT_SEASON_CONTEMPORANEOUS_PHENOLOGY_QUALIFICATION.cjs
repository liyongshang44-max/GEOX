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

try {
  assert.equal(BASE, 'c5a0110e1cff3fd91d3a205315b73d16ac7d6bd7', 'EA9A_EXACT_BASE_REQUIRED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA9A_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA9A_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((f) => /(^|\/)(apps|packages)\//.test(f)), 'EA9A_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((f) => /migration/i.test(f)), 'EA9A_MIGRATION_DELTA_FORBIDDEN');
  assert(!changed.some((f) => /MCFT-CANDIDATE-AUTHORITY-REGISTRY|MCFT-DELIVERY-POLICY/.test(f)), 'EA9A_DELIVERY_AUTHORITY_DELTA_FORBIDDEN');

  const predecessorPins = {
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md': '422f60257039e0f674171c218a7ff0a2fd7dc1b2',
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json': 'eeb7ab49ee3270421efe4d6674305426074d1541',
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json': 'b5de9d29189cb654444b3f57d00df290eefe16d3',
    'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-SUCCESSOR-WHOLE-WINDOW-VIABILITY-SCANNER-QUALIFICATION-V1.json': '4c6b4bc417d957eb381a7a41deb44436acf909c8'
  };
  for (const [p, sha] of Object.entries(predecessorPins)) {
    assert.equal(blob(BASE, p), sha, `EA9A_BASE_PIN:${p}`);
    assert.equal(blob('HEAD', p), sha, `EA9A_PREDECESSOR_MUTATED:${p}`);
  }

  const amendment09 = read('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md');
  for (const marker of [
    'S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION',
    'CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED',
    'A source identity alone is insufficient.',
    'GDD remains corroborative',
    'Future observations are forbidden.',
    'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION'
  ]) has(amendment09, marker, 'EA9A_AMENDMENT09_RULE_MISSING');

  const c = json(CONFIG);
  assert.equal(c.schema_version, 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_v1');
  assert.equal(c.base_main_sha, BASE);
  assert.equal(c.frontier, 'S6-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION');
  assert.equal(c.formal_scope.site_id, 'KBS_MCSE_T1R1');
  assert.equal(c.formal_scope.field_id, 'field_kbs_mcse_t1r1');
  assert.equal(c.formal_scope.season_id, 'season_2026_corn');
  assert.equal(c.formal_scope.crop, 'corn');
  assert.equal(c.formal_scope.provider_area_identity, 'T1R1');
  assert.equal(c.formal_scope.observed_biological_stage_already_claimed, false);
  assert.equal(c.formal_scope.field_phenology_observation_already_claimed, false);
  assert.equal(c.formal_scope.v_or_r_stage_truth_already_claimed, false);

  assert.deepEqual(c.qualification_contract.allowed_terminal_results.sort(), [
    'CURRENT_SEASON_CONTEMPORANEOUS_STAGE_AUTHORITY_ESTABLISHED',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED'
  ].sort());
  assert.equal(c.qualification_contract.this_candidate_expected_terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(c.qualification_contract.global_source_absence_claimed, false);
  assert.equal(c.qualification_contract.future_exact_provider_stage_record_may_be_requalified, true);
  assert.equal(c.qualification_contract.source_identity_alone_stage_determinative, false);
  assert.equal(c.qualification_contract.management_event_alone_stage_determinative, false);
  assert.equal(c.qualification_contract.nearby_or_other_experiment_phenology_stage_determinative, false);
  assert.equal(c.qualification_contract.gdd_stage_determinative, false);
  assert.equal(c.qualification_contract.future_observations_authorized, false);
  assert.equal(c.qualification_contract.future_phenocam_observations_authorized, false);
  assert.equal(c.qualification_contract.full_season_ex_post_normalization_authorized, false);
  assert.equal(c.qualification_contract.silent_hybrid_or_relative_maturity_assumption_authorized, false);
  assert.equal(c.qualification_contract.single_fao_region_best_fit_authorized, false);
  assert.equal(c.qualification_contract.minimum_backward_stability_hours, 6);
  assert.equal(c.qualification_contract.minimum_forward_transition_guard_hours, 30);

  assert.equal(c.enumerated_public_source_candidates.length, 5, 'EA9A_EXACT_FIVE_PUBLIC_CANDIDATES_REQUIRED');
  const ids = c.enumerated_public_source_candidates.map((x) => x.candidate_id);
  assert.deepEqual(ids, [
    'KBS_AGLOG_AREA_REGISTRY_T1R1',
    'KBS_AGLOG_2026_T1_PLANTING_6931',
    'KBS_MCSE_AGRONOMIC_PRACTICES_CATALOG',
    'KBS_GLBRC_PHENOCAM_NETWORK_IMAGES',
    'KBS_GLBRC_PHENOLOGY_2013_PRESENT'
  ]);
  assert(c.enumerated_public_source_candidates.every((x) => x.stage_determinative === false), 'EA9A_STATIC_CANDIDATE_MUST_NOT_PREDECLARE_STAGE_TRUTH');
  const phenocam = c.enumerated_public_source_candidates.find((x) => x.candidate_id === 'KBS_GLBRC_PHENOCAM_NETWORK_IMAGES');
  const glbrc = c.enumerated_public_source_candidates.find((x) => x.candidate_id === 'KBS_GLBRC_PHENOLOGY_2013_PRESENT');
  assert.equal(phenocam.formal_scope_relationship, 'DIFFERENT_EXPERIMENT_GLBRC_BCSE');
  assert.equal(glbrc.formal_scope_relationship, 'DIFFERENT_EXPERIMENT_AND_NONCURRENT_PUBLIC_TABLE_WINDOW');

  assert.equal(c.decision_policy.established_only_if_at_least_one_candidate_satisfies_all_requirements, true);
  assert.equal(c.decision_policy.otherwise_terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(c.decision_policy.not_established_does_not_claim_impossibility_or_global_absence, true);
  assert(c.decision_policy.required_for_established_authority.includes('GOVERNED_SPATIAL_RELATIONSHIP_TO_KBS_MCSE_T1R1'));
  assert(c.decision_policy.required_for_established_authority.includes('DETERMINISTIC_MAPPING_TO_INITIAL_DEVELOPMENT_MID_LATE'));
  assert(c.decision_policy.required_for_established_authority.includes('T_MINUS_6H_BACKWARD_STABILITY'));
  assert(c.decision_policy.required_for_established_authority.includes('T_PLUS_30H_FORWARD_TRANSITION_GUARD'));
  assert(c.decision_policy.required_for_established_authority.includes('NO_FUTURE_OBSERVATIONS'));

  for (const [key, expected] of Object.entries({
    provider_payload_may_be_committed: false,
    provider_payload_may_be_uploaded_as_ci_artifact: false,
    provider_body_text_may_be_emitted: false,
    database_write_authorized: false,
    formal_evidence_write_authorized: false,
    raw_object_write_authorized: false,
    runtime_config_write_authorized: false,
    scheduler_write_authorized: false,
    canonical_runtime_write_authorized: false
  })) assert.equal(c.data_use_policy[key], expected, `EA9A_DATA_USE_POLICY:${key}`);

  const effect = c.qualification_effect_if_expected_result_is_proved_and_merged;
  assert.equal(effect.terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(effect.current_season_contingent_stage_authority_established, false);
  assert.equal(effect.current_season_stage_extended, false);
  assert.equal(effect.current_season_late_stage_created, false);
  assert.equal(effect.existing_ea2_mutated, false);
  assert.equal(effect.successor_epoch_selected, false);
  assert.equal(effect.new_natural_season_created, false);
  assert.equal(effect.next_primary_successor, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');
  assert.equal(effect.parallel_operational_successor, 'S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08');
  assert.equal(effect.ea5e2_operational_activation_qualified, false);
  assert.equal(effect.ea5e3_effective, false);
  assert.equal(effect.formal_execution_count, '0/24');
  assert.equal(effect.mcft_cap09_completed, false);

  const p = read(PROBE);
  for (const marker of [
    "ALLOWED_HOSTS = new Set(['aglog.kbs.msu.edu', 'lter.kbs.msu.edu'])",
    'EA9A_PROVIDER_MARKER_MISSING',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED',
    'stage_determinative_candidate_count',
    'global_source_absence_claimed: false',
    'future_observations_used: false',
    'future_phenocam_observations_used: false',
    'full_season_ex_post_normalization_used: false',
    'gdd_stage_determinative: false',
    'provider_payload_persisted_or_uploaded: false',
    'database_write_count: 0',
    'raw_object_write_count: 0',
    'successor_epoch_selected: false',
    "next_primary_successor: 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION'"
  ]) has(p, marker, 'EA9A_PROBE_MARKER_REQUIRED');
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', "from 'pg'", 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'S3_ACCESS_KEY', 'AWS_ACCESS_KEY']) {
    lacks(p.replace(/\s+/g, ''), forbidden.replace(/\s+/g, ''), 'EA9A_PROBE_WRITE_CAPABILITY_FORBIDDEN');
  }

  const wf = read(WORKFLOW);
  for (const marker of [
    'Resolve exact EA9A base and subject',
    'Validate exact EA9A no-write governance boundary',
    'Install Chromium for EA9A public-source probe',
    'Run fail-closed current-season phenology qualification',
    'Upload immutable EA9A qualification proof'
  ]) has(wf, marker, 'EA9A_WORKFLOW_STEP_REQUIRED');
  for (const forbidden of ['pull_request_target', 'schedule:', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID', 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY']) {
    lacks(wf, forbidden, 'EA9A_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN');
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_governance_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    subject_head_sha: git('rev-parse', 'HEAD'),
    exact_changed_files: changed,
    exact_file_count: changed.length,
    predecessor_blobs_verified_unchanged: true,
    enumerated_public_source_candidate_count: c.enumerated_public_source_candidates.length,
    expected_terminal_result: c.qualification_contract.this_candidate_expected_terminal_result,
    global_source_absence_claimed: false,
    stage_authority_predeclared: false,
    future_observations_authorized: false,
    full_season_ex_post_normalization_authorized: false,
    gdd_stage_determinative: false,
    database_write_authorized: false,
    raw_object_write_authorized: false,
    runtime_config_write_authorized: false,
    scheduler_write_authorized: false,
    successor_epoch_selected: false,
    new_natural_season_created: false,
    formal_execution_count: '0/24',
    next_primary_successor_if_expected_result_proved: 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION'
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_current_season_contemporaneous_phenology_qualification_governance_result_v1',
    status: 'FAIL',
    base_main_sha: BASE || null,
    error: error instanceof Error ? error.message : String(error),
    global_source_absence_claimed: false,
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
