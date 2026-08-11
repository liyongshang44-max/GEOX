#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.MCFT_BASE_SHA;
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9A_P0306Q_THERMAL_THRESHOLD_AUTHORITY_GOVERNANCE_RESULT.json');
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9A_P0306Q_THERMAL_THRESHOLD_AUTHORITY.mjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9A_P0306Q_THERMAL_THRESHOLD_AUTHORITY.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-ea9a-p0306q-thermal-threshold-authority.yml';
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();

const AMENDMENT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md';
const EA9A = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json';
const EA1J = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1J-CROP-WATER-USE-STAGE-AUTHORITY-V1.json';
const EA2 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json';
const PINS = {
  [AMENDMENT09]: '422f60257039e0f674171c218a7ff0a2fd7dc1b2',
  [EA9A]: '0e1f809c4bf63b09f4e44431ce507e3b74a966af',
  [EA1J]: 'eeb7ab49ee3270421efe4d6674305426074d1541',
  [EA2]: 'b5de9d29189cb654444b3f57d00df290eefe16d3'
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

try {
  assert.equal(BASE, '565e2a59cfd34b18185998744b8380c1101ea45b', 'EA9A_THERMAL_EXACT_BASE_REQUIRED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA9A_THERMAL_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA9A_THERMAL_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((f) => /(^|\/)(apps|packages)\//.test(f)), 'EA9A_THERMAL_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((f) => /migration/i.test(f)), 'EA9A_THERMAL_MIGRATION_DELTA_FORBIDDEN');

  for (const [filePath, sha] of Object.entries(PINS)) {
    assert.equal(blob(BASE, filePath), sha, `EA9A_THERMAL_BASE_PIN:${filePath}`);
    assert.equal(blob('HEAD', filePath), sha, `EA9A_THERMAL_PREDECESSOR_MUTATED:${filePath}`);
  }

  const amendment09 = read(AMENDMENT09);
  for (const marker of [
    'GDD remains corroborative',
    'exact 2026 T1 crop material/hybrid identity',
    'applicable thermal-time method and base/cutoff temperatures, stage thresholds, uncertainty, and exact source meteorology',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED',
    'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION'
  ]) has(amendment09, marker, 'EA9A_THERMAL_AMENDMENT09_RULE_MISSING');

  const predecessor = json(EA9A);
  assert.equal(predecessor.qualification_contract.allowed_nonterminal_progress_result, 'CURRENT_SEASON_HYBRID_GDD_QUALIFICATION_REQUIRED');
  assert.equal(predecessor.decision_policy.hybrid_identity_requires_separate_thermal_stage_threshold_qualification, true);
  assert.equal(predecessor.decision_policy.relative_maturity_days_alone_is_not_stage_threshold_authority, true);
  assert.equal(predecessor.qualification_effect_if_expected_nonterminal_progress_is_proved_and_merged.fallback_if_hybrid_gdd_cannot_establish_stage, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');

  const c = json(CONFIG);
  assert.equal(c.schema_version, 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_v1');
  assert.equal(c.base_main_sha, BASE);
  assert.equal(c.formal_scope.site_id, 'KBS_MCSE_T1R1');
  assert.equal(c.formal_scope.season_id, 'season_2026_corn');
  assert.equal(c.formal_scope.hybrid_product_code, 'P0306Q');
  assert.equal(c.formal_scope.relative_maturity_days, 103);

  const proof = c.authority_predecessors.ea9a_exact_head_proof;
  assert.equal(proof.subject_sha, 'fc0cbe0de6e56833be037d336d8f076fb6822d39');
  assert.equal(proof.workflow_run_id, 31485817317);
  assert.equal(proof.artifact_id, 9099063234);
  assert.equal(proof.artifact_digest, 'sha256:2811047e008f3ecdff868bea5cecc4024aca09c37abcc97c8f0a0541a48a22a6');
  assert.equal(proof.proved_hybrid_product_code, 'P0306Q');
  assert.equal(proof.proved_relative_maturity_days, 103);
  assert.equal(proof.proved_progress_result, 'CURRENT_SEASON_HYBRID_GDD_QUALIFICATION_REQUIRED');
  assert.equal(proof.provider_body_emitted, false);

  const q = c.qualification_contract;
  assert.equal(q.allowed_progress_result, 'P0306Q_THERMAL_THRESHOLD_AUTHORITY_ESTABLISHED');
  assert.equal(q.allowed_ea9a_terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(q.successor_on_progress, 'S6-EA9A-ASOF-GDD-STAGE-ADJUDICATION');
  assert.equal(q.successor_on_terminal, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');
  assert.equal(q.product_specific_threshold_required, true);
  assert.equal(q.relative_maturity_to_gdu_conversion_authorized, false);
  assert.equal(q.sibling_or_related_product_point_threshold_transfer_authorized, false);
  assert.equal(q.secondary_dealer_threshold_alone_stage_determinative, false);
  assert.equal(q.generic_crm_gdu_calculator_stage_determinative, false);
  assert.equal(q.current_ea1j_gdd_stage_determinative, false);
  assert.equal(q.stage_authority_created_by_this_qualification, false);
  assert.equal(q.source_meteorology_consumed_by_this_qualification, false);
  assert.equal(q.global_product_source_absence_claimed, false);
  assert.equal(q.future_observations_authorized, false);
  assert.equal(q.full_season_ex_post_normalization_authorized, false);

  const candidates = c.enumerated_public_source_candidates;
  assert.equal(candidates.length, 4, 'EA9A_THERMAL_EXACT_FOUR_SOURCE_CANDIDATES_REQUIRED');
  const method = candidates.find((x) => x.candidate_id === 'PIONEER_OFFICIAL_MATURITY_METHOD');
  const catalog = candidates.find((x) => x.candidate_id === 'PIONEER_OFFICIAL_CURRENT_CORN_CATALOG');
  const calculator = candidates.find((x) => x.candidate_id === 'PIONEER_OFFICIAL_GDU_CALCULATOR');
  const secondary = candidates.find((x) => x.candidate_id === 'LANGFRITZ_SECONDARY_P0306AM_THRESHOLD');
  assert(method && catalog && calculator && secondary, 'EA9A_THERMAL_REQUIRED_SOURCE_SET_MISSING');
  assert.equal(method.may_establish_exact_p0306q_threshold, false);
  assert.equal(catalog.may_establish_exact_p0306q_threshold, true);
  assert.equal(calculator.may_establish_exact_p0306q_threshold, false);
  assert.equal(secondary.may_establish_exact_p0306q_threshold, false);
  assert.equal(secondary.evidence_role, 'SECONDARY_RELATED_CODE_NUMERIC_THRESHOLD_CORROBORATION_ONLY');

  assert.equal(c.exact_product_threshold_parser.target_product_code, 'P0306Q');
  assert.equal(c.exact_product_threshold_parser.both_product_specific_thresholds_required, true);
  assert.equal(c.decision_policy.secondary_or_generic_values_cannot_rescue_missing_exact_product_threshold, true);
  assert.equal(c.decision_policy.rm_103_cannot_be_transformed_into_missing_threshold, true);
  assert.equal(c.decision_policy.no_biological_v_or_r_truth_claim, true);
  assert.equal(c.decision_policy.no_initial_development_mid_late_stage_claim, true);
  assert.equal(c.decision_policy.no_current_ea2_mutation, true);

  for (const key of ['database_write_authorized', 'formal_evidence_write_authorized', 'raw_object_write_authorized', 'runtime_config_write_authorized', 'scheduler_write_authorized', 'canonical_runtime_write_authorized']) {
    assert.equal(c.data_use_policy[key], false, `EA9A_THERMAL_WRITE_POLICY_FORBIDDEN:${key}`);
  }
  assert.equal(c.data_use_policy.provider_payload_may_be_committed, false);
  assert.equal(c.data_use_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(c.data_use_policy.provider_body_text_may_be_emitted, false);
  assert.equal(c.data_use_policy.secondary_related_code_gdu_values_may_be_emitted, false);

  const effect = c.authority_effect;
  assert.equal(effect.current_season_contemporaneous_stage_authority_established, false);
  assert.equal(effect.current_season_stage_extended, false);
  assert.equal(effect.current_season_late_stage_created, false);
  assert.equal(effect.existing_ea2_mutated, false);
  assert.equal(effect.successor_epoch_selected, false);
  assert.equal(effect.new_natural_season_created, false);
  assert.equal(effect.ea5e2_operational_activation_qualified, false);
  assert.equal(effect.ea5e3_effective, false);
  assert.equal(effect.formal_execution_count, '0/24');
  assert.equal(effect.mcft_cap09_completed, false);

  const probe = read(PROBE);
  for (const marker of [
    'P0306Q',
    'P0306Q_THERMAL_THRESHOLD_AUTHORITY_ESTABLISHED',
    'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED',
    'S6-EA9A-ASOF-GDD-STAGE-ADJUDICATION',
    'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION',
    'relative_maturity_to_gdu_conversion_used: false',
    'related_product_point_threshold_transfer_used: false',
    'database_write_count: 0',
    'successor_epoch_selected: false'
  ]) has(probe, marker, 'EA9A_THERMAL_PROBE_MARKER_REQUIRED');
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', "from 'pg'", 'AWS_ACCESS_KEY', 'S3_ACCESS_KEY']) {
    lacks(probe.replace(/\s+/g, ''), forbidden.replace(/\s+/g, ''), 'EA9A_THERMAL_PROBE_WRITE_CAPABILITY_FORBIDDEN');
  }
  lacks(probe, '2500', 'EA9A_THERMAL_SECONDARY_POINT_VALUE_MUST_NOT_BE_HARDCODED_IN_PROBE');
  lacks(probe, '1330', 'EA9A_THERMAL_SECONDARY_POINT_VALUE_MUST_NOT_BE_HARDCODED_IN_PROBE');

  const workflow = read(WORKFLOW);
  for (const marker of ['Validate exact P0306Q thermal authority boundary', 'Run fail-closed P0306Q thermal-threshold qualification', 'Upload immutable P0306Q thermal qualification proof']) {
    has(workflow, marker, 'EA9A_THERMAL_WORKFLOW_STEP_REQUIRED');
  }
  for (const forbidden of ['pull_request_target', 'schedule:', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID']) {
    lacks(workflow, forbidden, 'EA9A_THERMAL_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN');
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_governance_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    subject_head_sha: git('rev-parse', 'HEAD'),
    exact_changed_files: changed,
    predecessor_blobs_verified_unchanged: true,
    predecessor_ea9a_exact_head_proof_frozen: true,
    exact_hybrid_product_code: 'P0306Q',
    exact_relative_maturity_days: 103,
    product_specific_threshold_required: true,
    rm_to_gdu_conversion_authorized: false,
    related_product_point_threshold_transfer_authorized: false,
    stage_authority_predeclared: false,
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9a_p0306q_thermal_threshold_authority_governance_result_v1',
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
