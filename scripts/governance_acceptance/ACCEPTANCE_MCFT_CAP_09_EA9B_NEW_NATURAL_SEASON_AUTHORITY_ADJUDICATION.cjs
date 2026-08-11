#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.MCFT_BASE_SHA;
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA9B_NEW_NATURAL_SEASON_AUTHORITY_ADJUDICATION_GOVERNANCE_RESULT.json');
const CONFIG = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA9B_NEW_NATURAL_SEASON_AUTHORITY_ADJUDICATION.mjs';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA9B_NEW_NATURAL_SEASON_AUTHORITY_ADJUDICATION.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-09-ea9b-new-natural-season-authority-adjudication.yml';
const FILES = [CONFIG, PROBE, GATE, WORKFLOW].sort();

const AMENDMENT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-09-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-AUTHORITY.md';
const EA9A = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-CURRENT-SEASON-CONTEMPORANEOUS-PHENOLOGY-QUALIFICATION-V1.json';
const EA9A_THERMAL = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA9A-P0306Q-THERMAL-THRESHOLD-AUTHORITY-V1.json';
const PINS = {
  [AMENDMENT09]: '422f60257039e0f674171c218a7ff0a2fd7dc1b2',
  [EA9A]: '0e1f809c4bf63b09f4e44431ce507e3b74a966af',
  [EA9A_THERMAL]: 'a4be8bea8fd31f2d451bd49b24da67a2ec3210df'
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
  assert.equal(BASE, '87eab32bfade35f2d2e9ab945031a61288e20adf', 'EA9B_EXACT_BASE_REQUIRED');
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EA9B_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
  assert.equal(changed.length, 4, 'EA9B_EXACT_FILE_COUNT_REQUIRED');
  assert(!changed.some((f) => /(^|\/)(apps|packages)\//.test(f)), 'EA9B_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');
  assert(!changed.some((f) => /migration/i.test(f)), 'EA9B_MIGRATION_DELTA_FORBIDDEN');

  for (const [filePath, sha] of Object.entries(PINS)) {
    assert.equal(blob(BASE, filePath), sha, `EA9B_BASE_PIN:${filePath}`);
    assert.equal(blob('HEAD', filePath), sha, `EA9B_PREDECESSOR_MUTATED:${filePath}`);
  }

  const amendment09 = read(AMENDMENT09);
  for (const marker of [
    'Branch B — new natural-season authority adjudication',
    'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION',
    'EA9B is an architecture adjudication, not an automatic rollover.',
    'a new immutable `season_id`',
    'authoritative current-season crop identity',
    'authoritative planting/emergence timing at the precision actually provided',
    'explicit prohibition on cross-season State/Forecast/Checkpoint/lineage stitching',
    'fabricated new season identity'
  ]) has(amendment09, marker, 'EA9B_AMENDMENT09_RULE_MISSING');

  const thermal = json(EA9A_THERMAL);
  assert.equal(thermal.qualification_contract.allowed_ea9a_terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(thermal.qualification_contract.successor_on_terminal, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');
  assert.equal(thermal.authority_effect.new_natural_season_created, false);
  assert.equal(thermal.authority_effect.formal_execution_count, '0/24');

  const c = json(CONFIG);
  assert.equal(c.schema_version, 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_v1');
  assert.equal(c.base_main_sha, BASE);
  assert.equal(c.frontier, 'S6-EA9B-NEW-NATURAL-SEASON-AUTHORITY-ADJUDICATION');
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.subject_sha, 'e29d04e7e099d7af09843c42a60a7caa4d62c832');
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.workflow_run_id, 31488032942);
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.artifact_id, 9099903917);
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.artifact_digest, 'sha256:05c12002cbb33b226f1b47e5e39656ee83278d990203d1fc53737298be69ed7c');
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.terminal_result, 'CURRENT_SEASON_PHENOLOGY_AUTHORITY_NOT_ESTABLISHED');
  assert.equal(c.authority_predecessors.ea9a_terminal_exact_head_proof.ea9a_terminal_reached, true);

  const anchor = c.historical_scope_anchor;
  assert.equal(anchor.site_id, 'KBS_MCSE_T1R1');
  assert.equal(anchor.field_id, 'field_kbs_mcse_t1r1');
  assert.equal(anchor.season_id, 'season_2026_corn');
  assert.equal(anchor.crop, 'corn');
  assert.equal(anchor.planting_observation_id, 6931);
  assert.equal(anchor.planting_observation_date, '2026-05-11');
  assert.equal(anchor.history_must_remain_append_only, true);
  assert.equal(anchor.historical_scope_may_be_relabelled_as_new_season, false);

  const a = c.adjudication_contract;
  assert.deepEqual(a.allowed_results, [
    'NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_OBSERVED',
    'NO_NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_CURRENTLY_OBSERVED'
  ]);
  assert.equal(a.candidate_result_is_not_new_season_authority, true);
  assert.equal(a.no_candidate_result_is_time_gated_snapshot_not_global_absence, true);
  assert.equal(a.new_season_id_may_be_created_by_this_adjudication, false);
  assert.equal(a.new_crop_identity_may_be_inferred_from_rotation, false);
  assert.equal(a.future_calendar_year_may_define_season_identity, false);
  assert.equal(a.post_anchor_planting_event_alone_may_establish_natural_season, false);
  assert.equal(a.fresh_season_authority_requires_separate_build, true);
  assert.equal(a.future_observations_used, false);
  assert.equal(a.provider_timestamp_relabeling_authorized, false);
  assert.equal(a.cross_season_canonical_stitching_authorized, false);

  const p = c.provider_probe;
  assert.equal(p.provider, 'KBS_AGLOG');
  assert.equal(p.index_url, 'https://aglog.kbs.msu.edu/observations');
  assert.equal(p.anchor_url, 'https://aglog.kbs.msu.edu/observations/6931');
  assert.equal(p.new_candidate_min_observation_date_exclusive, '2026-05-11');
  assert.equal(p.candidate_observation_type_token, 'Planting');
  assert.equal(p.candidate_requires_explicit_provider_observation_id, true);
  assert.equal(p.candidate_requires_explicit_date, true);
  assert.equal(p.candidate_requires_t1_spatial_token, true);
  assert.equal(p.candidate_requires_planting_type, true);
  assert.equal(p.candidate_crop_identity_may_be_emitted_only_if_explicit_in_provider_row, true);
  assert.equal(p.provider_body_text_may_be_emitted, false);
  assert(p.maximum_index_pages >= 5 && p.maximum_index_pages <= 50, 'EA9B_BOUNDED_INDEX_SCAN_REQUIRED');

  const d = c.decision_policy;
  assert.equal(d.new_natural_season_authority_established_by_candidate_detection, false);
  assert.equal(d.season_id_assignment_authorized, false);
  assert.equal(d.crop_assignment_authorized_without_explicit_provider_crop_identity, false);
  assert.equal(d.physical_field_zone_identity_reuse_authorized, false);
  assert.equal(d.canonical_bootstrap_authorized, false);
  assert.equal(d.whole_window_scan_authorized, false);
  assert.equal(d.epoch_selection_authorized, false);

  assert.equal(c.successor_policy.on_candidate, 'S6-EA9B-FRESH-SEASON-AUTHORITY-BUILD');
  assert.equal(c.successor_policy.on_no_candidate, 'S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION');
  assert.equal(c.successor_policy.parallel_operational_successor, 'S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08');

  for (const key of ['database_write_authorized', 'formal_evidence_write_authorized', 'raw_object_write_authorized', 'runtime_config_write_authorized', 'scheduler_write_authorized', 'canonical_runtime_write_authorized']) {
    assert.equal(c.data_use_policy[key], false, `EA9B_WRITE_POLICY_FORBIDDEN:${key}`);
  }
  assert.equal(c.data_use_policy.provider_payload_may_be_committed, false);
  assert.equal(c.data_use_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(c.data_use_policy.provider_body_text_may_be_emitted, false);

  const effect = c.authority_effect;
  assert.equal(effect.current_season_2026_recovery_reopened, false);
  assert.equal(effect.new_natural_season_created, false);
  assert.equal(effect.new_season_id, null);
  assert.equal(effect.new_crop, null);
  assert.equal(effect.new_crop_context_authority_established, false);
  assert.equal(effect.new_canonical_bootstrap_authority_established, false);
  assert.equal(effect.cross_season_state_stitching_authorized, false);
  assert.equal(effect.successor_epoch_selected, false);
  assert.equal(effect.ea5e2_operational_activation_qualified, false);
  assert.equal(effect.ea5e3_effective, false);
  assert.equal(effect.formal_execution_count, '0/24');
  assert.equal(effect.mcft_cap09_completed, false);

  const probe = read(PROBE);
  for (const marker of [
    'NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_OBSERVED',
    'NO_NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_CURRENTLY_OBSERVED',
    'post_anchor_t1_planting_candidate_count',
    'candidate_result_is_new_season_authority: false',
    'rotation_used_to_infer_crop: false',
    'new_natural_season_created: false',
    'new_season_id: null',
    'new_crop: null',
    'database_write_count: 0',
    'successor_epoch_selected: false'
  ]) has(probe, marker, 'EA9B_PROBE_MARKER_REQUIRED');
  for (const forbidden of ['DATABASE_URL', 'INSERT INTO', 'public.facts', "from 'pg'", 'AWS_ACCESS_KEY', 'S3_ACCESS_KEY']) {
    lacks(probe.replace(/\s+/g, ''), forbidden.replace(/\s+/g, ''), 'EA9B_PROBE_WRITE_CAPABILITY_FORBIDDEN');
  }

  const workflow = read(WORKFLOW);
  for (const marker of [
    'Validate exact EA9B natural-season adjudication boundary',
    'Run fail-closed EA9B natural-season evidence adjudication',
    'Upload immutable EA9B adjudication proof'
  ]) has(workflow, marker, 'EA9B_WORKFLOW_STEP_REQUIRED');
  for (const forbidden of ['pull_request_target', 'schedule:', 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID']) {
    lacks(workflow, forbidden, 'EA9B_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN');
  }

  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_governance_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    subject_head_sha: git('rev-parse', 'HEAD'),
    exact_changed_files: changed,
    predecessor_blobs_verified_unchanged: true,
    ea9a_terminal_proof_frozen: true,
    historical_season_id: 'season_2026_corn',
    new_season_creation_authorized: false,
    crop_inference_from_rotation_authorized: false,
    cross_season_stitching_authorized: false,
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea9b_new_natural_season_authority_adjudication_governance_result_v1',
    status: 'FAIL',
    base_main_sha: BASE || null,
    error: error instanceof Error ? error.message : String(error),
    new_season_creation_authorized: false,
    database_write_authorized: false,
    successor_epoch_selected: false,
    formal_execution_count: '0/24'
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
