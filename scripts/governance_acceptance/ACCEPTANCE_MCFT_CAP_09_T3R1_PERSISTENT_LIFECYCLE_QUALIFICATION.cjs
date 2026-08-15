#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json');
const PROBE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_PERSISTENT_LIFECYCLE_QUALIFICATION.mjs');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_PERSISTENT_LIFECYCLE_QUALIFICATION_GOVERNANCE_RESULT.json');
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const EXPECTED_BASE = 'e556e8c4a3ba601bc73af42077afc557a9715781';
const DAY_MS = 24 * 60 * 60 * 1000;

const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-t3r1-persistent-lifecycle-qualification.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-PERSISTENT-LIFECYCLE-QUALIFICATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_PERSISTENT_LIFECYCLE_QUALIFICATION.cjs',
  'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T3R1_PERSISTENT_LIFECYCLE_QUALIFICATION.mjs'
].sort();

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'T3R1_PERSISTENT_GOVERNANCE_BASE_SHA_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_PERSISTENT_GOVERNANCE_SUBJECT_SHA_REQUIRED');
  assert(BASE_SHA === EXPECTED_BASE, `T3R1_PERSISTENT_GOVERNANCE_BASE_DRIFT:${BASE_SHA}`);

  const changed = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `T3R1_PERSISTENT_EXACT_FOUR_FILE_BOUNDARY_REQUIRED:${changed.join(',')}`);

  const x = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert(x.schema_version === 'geox_mcft_cap09_t3r1_persistent_lifecycle_qualification_v1', 'T3R1_PERSISTENT_CONFIG_SCHEMA_REQUIRED');
  assert(x.exact_predecessor_sha === EXPECTED_BASE, 'T3R1_PERSISTENT_CONFIG_PREDECESSOR_REQUIRED');
  assert(x.frontier === 'T3R1_CURRENT_SEASON_PERSISTENT_LIFECYCLE_QUALIFICATION', 'T3R1_PERSISTENT_FRONTIER_REQUIRED');
  assert(x.effectiveness_rule.includes('AMENDMENT_16_MUST_FIRST_BECOME_EFFECTIVE_ON_PROTECTED_MAIN'), 'T3R1_PERSISTENT_STACKED_EFFECTIVENESS_REQUIRED');

  const p = x.authority_predecessors;
  assert(git(['rev-parse', `${BASE_SHA}:${p.amendment_16_path}`]) === p.amendment_16_blob_sha, 'T3R1_PERSISTENT_AMENDMENT16_DOC_PIN_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}:${p.persistent_semantics_path}`]) === p.persistent_semantics_blob_sha, 'T3R1_PERSISTENT_AMENDMENT16_SEMANTICS_PIN_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}:${p.ea1j_formal_crop_context_path}`]) === p.ea1j_formal_crop_context_blob_sha, 'T3R1_PERSISTENT_EA1J_PIN_REQUIRED');

  const semantics = JSON.parse(git(['show', `${BASE_SHA}:${p.persistent_semantics_path}`]));
  assert(semantics.normative_principles?.season_lifecycle_is_persistent_state === true, 'T3R1_PERSISTENT_SEMANTICS_PERSISTENCE_REQUIRED');
  assert(semantics.normative_principles?.provider_silence_is_lifecycle_evidence === false, 'T3R1_PERSISTENT_SEMANTICS_SILENCE_EVIDENCE_FORBIDDEN');
  assert(semantics.normative_principles?.provider_silence_refreshes_observation === false, 'T3R1_PERSISTENT_SEMANTICS_SILENCE_REFRESH_FORBIDDEN');
  assert(semantics.normative_principles?.provider_silence_terminates_lifecycle === false, 'T3R1_PERSISTENT_SEMANTICS_SILENCE_TERMINATION_FORBIDDEN');
  assert(semantics.state_contract?.expired_is_real_world_transition === false, 'T3R1_PERSISTENT_EXPIRED_NOT_TRANSITION_REQUIRED');
  assert(semantics.horizon_policy?.horizon_may_only_truncate_persistence === true, 'T3R1_PERSISTENT_HORIZON_TRUNCATION_ONLY_REQUIRED');
  assert(semantics.horizon_policy?.horizon_may_create_active === false, 'T3R1_PERSISTENT_HORIZON_CREATE_ACTIVE_FORBIDDEN');
  assert(semantics.horizon_policy?.support_event_may_renew_horizon === false, 'T3R1_PERSISTENT_SUPPORT_RENEWAL_FORBIDDEN');

  assert(x.candidate_scope?.treatment === 'T3' && x.candidate_scope?.replicate === 'R1', 'T3R1_PERSISTENT_SCOPE_REQUIRED');
  assert(x.candidate_scope?.provider_area_identity === 'T3R1', 'T3R1_PERSISTENT_EXACT_PROVIDER_SCOPE_REQUIRED');
  assert(x.candidate_scope?.crop === 'corn' && x.candidate_scope?.hybrid_product_code === 'P0306Q', 'T3R1_PERSISTENT_CROP_HYBRID_REQUIRED');
  assert(x.candidate_scope?.planting_local_date === '2026-05-20', 'T3R1_PERSISTENT_PLANTING_DATE_REQUIRED');
  assert(x.establishment_source?.provider === 'KBS_AGLOG', 'T3R1_PERSISTENT_ESTABLISHMENT_PROVIDER_REQUIRED');
  assert(x.establishment_source?.expected_observation_id === 6966, 'T3R1_PERSISTENT_ESTABLISHMENT_OBSERVATION_6966_REQUIRED');
  assert(x.establishment_source?.required_normalized_markers?.some((v) => v.includes('Pioneer P0306Q')), 'T3R1_PERSISTENT_ESTABLISHMENT_HYBRID_MARKER_REQUIRED');

  const sweep = x.transition_sweep;
  assert(sweep?.provider === 'KBS_LTER_CORE_EXPANDED_AGRONOMIC_LOG', 'T3R1_PERSISTENT_EXPANDED_LOG_PROVIDER_REQUIRED');
  assert(sweep?.download_url === 'https://lter.kbs.msu.edu/datatables/694.csv', 'T3R1_PERSISTENT_EXPANDED_LOG_URL_REQUIRED');
  assert(sweep?.allowed_host === 'lter.kbs.msu.edu' && sweep?.datatable_id === '694', 'T3R1_PERSISTENT_EXPANDED_LOG_IDENTITY_REQUIRED');
  assert(sweep?.exact_treatment === 'T3' && sweep?.exact_plot_name === 'T3R1', 'T3R1_PERSISTENT_EXACT_PLOT_SWEEP_REQUIRED');
  assert(sweep?.full_comment_semantics_required === true && sweep?.exact_plot_scope_required === true, 'T3R1_PERSISTENT_FULL_COMMENT_EXACT_SCOPE_REQUIRED');
  for (const column of ['obs_date','treatment','observation_type','comment','name','observation_id']) {
    assert(sweep.required_columns?.includes(column), `T3R1_PERSISTENT_EXPANDED_LOG_COLUMN_REQUIRED:${column}`);
  }
  assert(sweep?.provider_coverage_completeness_required_for_persistent_state === false, 'T3R1_PERSISTENT_COMPLETENESS_NOT_REQUIRED_BY_FSM');
  assert(sweep?.provider_coverage_completeness_claimed === false, 'T3R1_PERSISTENT_COMPLETENESS_CLAIM_FORBIDDEN');
  assert(sweep?.none_found_may_be_emitted === true, 'T3R1_PERSISTENT_NONE_FOUND_REQUIRED');
  assert(sweep?.proved_no_termination_occurred_may_be_emitted === false, 'T3R1_PERSISTENT_PROVED_NO_TERMINATION_FORBIDDEN');

  const endExclusive = Date.parse(x.candidate_scope.possible_planting_window_utc.end_exclusive);
  assert(Number.isFinite(endExclusive), 'T3R1_PERSISTENT_PLANTING_WINDOW_INVALID');
  const latestPossiblePlanting = endExclusive - 1;
  const expectedHorizon = new Date(latestPossiblePlanting + x.horizon_policy.maximum_total_days * DAY_MS).toISOString();
  assert(x.horizon_policy.maximum_total_days === 180, 'T3R1_PERSISTENT_180_DAY_GUARD_REQUIRED');
  assert(expectedHorizon === x.horizon_policy.expected_horizon_end_utc, `T3R1_PERSISTENT_HORIZON_REDERIVATION_MISMATCH:${expectedHorizon}`);
  assert(x.horizon_policy.horizon_may_create_active === false && x.horizon_policy.horizon_may_only_truncate_persistence === true, 'T3R1_PERSISTENT_HORIZON_ASYMMETRY_REQUIRED');
  assert(x.horizon_policy.support_event_may_renew_horizon === false, 'T3R1_PERSISTENT_SUPPORT_HORIZON_RENEWAL_FORBIDDEN');

  const s = x.persistent_state_policy;
  assert(s.authority_mode === 'GOVERNED_PERSISTENT_STATE', 'T3R1_PERSISTENT_AUTHORITY_MODE_REQUIRED');
  assert(s.provider_silence_used_as_evidence === false, 'T3R1_PERSISTENT_PROVIDER_SILENCE_EVIDENCE_FORBIDDEN');
  assert(s.provider_retrieval_time_used_as_coverage_watermark === false, 'T3R1_PERSISTENT_RETRIEVAL_WATERMARK_FORBIDDEN');
  assert(s.evaluation_time_emitted_as_observation_time === false, 'T3R1_PERSISTENT_EVALUATION_AS_OBSERVATION_FORBIDDEN');
  assert(s.phenology_may_establish_lifecycle === false, 'T3R1_PERSISTENT_PHENOLOGY_ESTABLISHMENT_FORBIDDEN');

  const source = fs.readFileSync(PROBE_PATH, 'utf8');
  assert(source.includes('buildExactT3R1Events') && source.includes("normalize(row.name).toUpperCase() === CONFIG.transition_sweep.exact_plot_name"), 'T3R1_PERSISTENT_EXACT_PLOT_CLASSIFIER_REQUIRED');
  assert(source.includes('full_comment_semantics_consumed: true'), 'T3R1_PERSISTENT_FULL_COMMENT_CONSUMPTION_REQUIRED');
  assert(source.includes('exact_plot_scope_consumed: true'), 'T3R1_PERSISTENT_EXACT_PLOT_CONSUMPTION_REQUIRED');
  assert(source.includes("proved_no_termination_occurred: false"), 'T3R1_PERSISTENT_NO_TERMINATION_NONCLAIM_REQUIRED');
  assert(source.includes("provider_coverage_completeness_proven: false"), 'T3R1_PERSISTENT_COMPLETENESS_NONCLAIM_REQUIRED');
  assert(source.includes("observation_freshness_refreshed_by_persistence: false"), 'T3R1_PERSISTENT_OBSERVATION_REFRESH_NONCLAIM_REQUIRED');
  assert(!source.includes('detailAppliesToT3R1') && !source.includes('eventSemanticText(page)'), 'T3R1_PERSISTENT_PAGE_BODY_TRANSITION_CLASSIFICATION_FORBIDDEN');

  const b = x.authority_boundary;
  assert(b.stacked_candidate_may_become_effective_before_amendment_16_protected_main_merge === false, 'T3R1_PERSISTENT_STACKED_ADOPTION_FORBIDDEN');
  assert(b.formal_site_rebind_authorized === false && b.ea5e2_operational_activation_qualified === false, 'T3R1_PERSISTENT_OPERATIONAL_EFFECT_FORBIDDEN');
  assert(b.runtime_write_count === 0 && b.database_write_count === 0 && b.scheduler_write_count === 0 && b.formal_evidence_write_count === 0, 'T3R1_PERSISTENT_ZERO_WRITES_REQUIRED');
  assert(b.formal_execution_count === '0/24', 'T3R1_PERSISTENT_FORMAL_ZERO_REQUIRED');

  write({
    schema_version: 'geox_mcft_cap09_t3r1_persistent_lifecycle_qualification_governance_v1',
    status: 'PASS',
    base_sha: BASE_SHA,
    subject_sha: SUBJECT_SHA,
    exact_four_file_boundary: true,
    predecessor_pins_verified: true,
    amendment_16_persistent_state_semantics_verified: true,
    provider_silence_inference_forbidden: true,
    provider_completeness_claimed: false,
    transition_source: 'KBS_LTER_CORE_EXPANDED_AGRONOMIC_LOG_694',
    exact_t3r1_plot_scope_required: true,
    full_comment_semantics_required: true,
    page_body_transition_classification_forbidden: true,
    maximum_lifecycle_horizon_end_utc: expectedHorizon,
    horizon_is_truncation_only: true,
    stacked_authority_effect: 'NONE_UNTIL_AMENDMENT_16_EFFECTIVE_AND_EXACT_MAIN_RERUN',
    formal_rebind_authorized: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24'
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_persistent_lifecycle_qualification_governance_v1',
    status: 'FAIL',
    base_sha: BASE_SHA || null,
    subject_sha: SUBJECT_SHA || null,
    stacked_authority_effect: 'NONE',
    formal_rebind_authorized: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
