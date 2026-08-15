#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-SEASON-LIFECYCLE-PERSISTENT-STATE-SEMANTICS-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_AMENDMENT_16_CURRENT_SEASON_LIFECYCLE_PERSISTENT_STATE_SEMANTICS.json');
const EXPECTED_BASE = '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78';
const BASE_SHA = String(process.env.MCFT_BASE_SHA || '').trim();
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-09-amendment-16-current-season-lifecycle-persistent-state-semantics.yml',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-16-CURRENT-SEASON-LIFECYCLE-PERSISTENT-STATE-SEMANTICS.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-SEASON-LIFECYCLE-PERSISTENT-STATE-SEMANTICS-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_16_CURRENT_SEASON_LIFECYCLE_PERSISTENT_STATE_SEMANTICS.cjs'
].sort();

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function ms(value, code) {
  const out = Date.parse(String(value || ''));
  assert(Number.isFinite(out), code);
  return out;
}

function knownBy(event, T, R) {
  if (!event) return false;
  return ms(event.event_time, 'EVENT_TIME_INVALID') <= T
    && ms(event.available_to_runtime_at, 'EVENT_AVAILABILITY_INVALID') <= R;
}

function earliestTime(...values) {
  const finite = values
    .filter(Boolean)
    .map((value) => ({ value, t: ms(value, 'BOUNDARY_TIME_INVALID') }))
    .sort((a, b) => a.t - b.t);
  return finite.length ? finite[0].value : null;
}

function resolve(input) {
  const T = ms(input.state_evaluation_time, 'STATE_EVALUATION_TIME_INVALID');
  const R = ms(input.authority_evaluated_at, 'AUTHORITY_EVALUATED_AT_INVALID');
  const establishment = input.establishment || null;
  const establishmentKnown = knownBy(establishment, T, R) && input.scope_valid !== false;
  const horizonEnd = earliestTime(input.lifecycle_horizon_end, input.formal_season_close_at);

  let domainState = 'NOT_ESTABLISHED';
  let authorityStatus = 'UNRESOLVED';
  let authorityValidity = 'VALID';
  let authorityMode = null;
  let termination = null;

  const knownSupports = (input.support_events || [])
    .filter((event) => knownBy(event, T, R))
    .sort((a, b) => ms(a.event_time, 'SUPPORT_EVENT_TIME_INVALID') - ms(b.event_time, 'SUPPORT_EVENT_TIME_INVALID'));
  const lastSupport = knownSupports.length ? knownSupports.at(-1) : null;

  if (establishmentKnown) {
    domainState = 'ACTIVE';
    authorityStatus = 'RESOLVED';
    authorityMode = 'GOVERNED_PERSISTENT_STATE';

    const contradictions = (input.contradiction_events || [])
      .filter((event) => knownBy(event, T, R));
    if (contradictions.length > 0) authorityStatus = 'CONFLICTED';

    const terminations = (input.termination_events || [])
      .filter((event) => knownBy(event, T, R))
      .sort((a, b) => ms(a.event_time, 'TERMINATION_EVENT_TIME_INVALID') - ms(b.event_time, 'TERMINATION_EVENT_TIME_INVALID'));

    if (terminations.length > 0) {
      termination = terminations[0];
      domainState = 'TERMINATED';
      authorityStatus = 'RESOLVED';
      authorityMode = 'DIRECT_EVENT';
    } else if (horizonEnd && T > ms(horizonEnd, 'HORIZON_END_INVALID')) {
      authorityStatus = 'UNRESOLVED';
      authorityValidity = 'EXPIRED';
    }
  }

  const activeConsumable = domainState === 'ACTIVE'
    && authorityStatus === 'RESOLVED'
    && authorityValidity === 'VALID';

  const stageSet = Array.isArray(input.stage_set) ? [...new Set(input.stage_set)] : [];
  const stageResolved = activeConsumable && stageSet.length === 1;
  const stage = stageResolved ? stageSet[0] : null;
  const kcMap = input.kc_mapping || {};
  const kc = stageResolved && Number.isFinite(Number(kcMap[stage])) ? Number(kcMap[stage]) : null;

  return {
    domain_state: domainState,
    authority_status: authorityStatus,
    authority_validity: authorityValidity,
    authority_mode: authorityMode,
    active_consumable: activeConsumable,
    establishment_event_time: establishmentKnown ? establishment.event_time : null,
    establishment_available_to_runtime_at: establishmentKnown ? establishment.available_to_runtime_at : null,
    last_support_event_id: lastSupport?.id || null,
    last_support_event_time: lastSupport?.event_time || null,
    termination_event_id: termination?.id || null,
    termination_event_time: termination?.event_time || null,
    termination_available_to_runtime_at: termination?.available_to_runtime_at || null,
    lifecycle_horizon_end: input.lifecycle_horizon_end || null,
    formal_season_close_at: input.formal_season_close_at || null,
    latest_direct_biological_observation_at: input.latest_direct_biological_observation_at || null,
    state_evaluation_time: input.state_evaluation_time,
    authority_evaluated_at: input.authority_evaluated_at,
    phenology_stage_authority: stageResolved ? 'RESOLVED' : 'UNRESOLVED',
    phenology_stage: stage,
    crop_model_parameter_authority: kc !== null ? 'RESOLVED' : 'UNRESOLVED',
    kc,
  };
}

function fixture(overrides = {}) {
  return {
    state_evaluation_time: '2026-08-15T03:00:00.000Z',
    authority_evaluated_at: '2026-08-15T03:00:00.000Z',
    scope_valid: true,
    establishment: {
      id: 'planting-1',
      event_time: '2026-05-20T04:00:00.000Z',
      available_to_runtime_at: '2026-05-20T12:00:00.000Z',
    },
    support_events: [],
    termination_events: [],
    contradiction_events: [],
    lifecycle_horizon_end: '2026-11-17T04:00:00.000Z',
    formal_season_close_at: null,
    latest_direct_biological_observation_at: '2026-07-30T16:28:41.000Z',
    stage_set: [],
    kc_mapping: { INITIAL: 0.30, DEVELOPMENT: 0.70, MID: 1.15, LATE: 0.60 },
    ...overrides,
  };
}

function equalStateProjection(a, b) {
  const keys = [
    'domain_state', 'authority_status', 'authority_validity', 'authority_mode',
    'active_consumable', 'establishment_event_time', 'last_support_event_id',
    'last_support_event_time', 'termination_event_id', 'termination_event_time',
    'lifecycle_horizon_end', 'latest_direct_biological_observation_at'
  ];
  return keys.every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

function runCases() {
  const cases = [];
  function pass(id, fn) {
    fn();
    cases.push({ id, status: 'PASS' });
  }

  pass('A01_AUTHORITATIVE_ESTABLISHMENT', () => {
    const r = resolve(fixture());
    assert(r.domain_state === 'ACTIVE', 'A01_ACTIVE_REQUIRED');
    assert(r.authority_status === 'RESOLVED' && r.authority_validity === 'VALID', 'A01_AUTHORITY_VALID_REQUIRED');
    assert(r.authority_mode === 'GOVERNED_PERSISTENT_STATE' && r.active_consumable === true, 'A01_PERSISTENT_MODE_REQUIRED');
  });

  pass('A02_PROVIDER_SILENCE', () => {
    const before = resolve(fixture({ authority_evaluated_at: '2026-08-14T03:00:00.000Z', state_evaluation_time: '2026-08-14T03:00:00.000Z' }));
    const after = resolve(fixture({ provider_http_status: 200, provider_new_row_count: 0 }));
    assert(before.domain_state === 'ACTIVE' && after.domain_state === 'ACTIVE', 'A02_ACTIVE_PERSISTS');
    assert(after.latest_direct_biological_observation_at === '2026-07-30T16:28:41.000Z', 'A02_OBSERVATION_TIME_MUST_NOT_REFRESH');
  });

  pass('A03_NO_ESTABLISHMENT', () => {
    const r = resolve(fixture({
      establishment: null,
      support_events: [{ id: 'herbicide-1', event_time: '2026-07-01T14:00:00.000Z', available_to_runtime_at: '2026-07-01T18:00:00.000Z' }]
    }));
    assert(r.domain_state === 'NOT_ESTABLISHED', 'A03_NOT_ESTABLISHED_REQUIRED');
    assert(r.active_consumable === false, 'A03_ACTIVE_FORBIDDEN');
  });

  pass('A04_HARVEST_TERMINATION', () => {
    const r = resolve(fixture({ termination_events: [{ id: 'harvest-1', class: 'HARVEST', event_time: '2026-08-10T15:00:00.000Z', available_to_runtime_at: '2026-08-10T20:00:00.000Z' }] }));
    assert(r.domain_state === 'TERMINATED', 'A04_TERMINATED_REQUIRED');
    assert(r.termination_event_id === 'harvest-1' && r.active_consumable === false, 'A04_TERMINATION_PROVENANCE_REQUIRED');
  });

  pass('A05_DESTRUCTION_FAILURE_TERMINATION', () => {
    const r = resolve(fixture({ termination_events: [{ id: 'destroy-1', class: 'CROP_DESTRUCTION', event_time: '2026-08-05T15:00:00.000Z', available_to_runtime_at: '2026-08-05T16:00:00.000Z' }] }));
    assert(r.domain_state === 'TERMINATED' && r.termination_event_id === 'destroy-1', 'A05_TERMINATED_REQUIRED');
  });

  pass('A06_FORMAL_SEASON_CLOSE', () => {
    const r = resolve(fixture({ formal_season_close_at: '2026-08-14T00:00:00.000Z' }));
    assert(r.domain_state === 'ACTIVE', 'A06_LAST_DOMAIN_STATE_ACTIVE_REQUIRED');
    assert(r.authority_status === 'UNRESOLVED' && r.authority_validity === 'EXPIRED', 'A06_EXPIRED_AUTHORITY_REQUIRED');
    assert(r.active_consumable === false && r.termination_event_id === null, 'A06_NO_FAKE_TERMINATION');
  });

  pass('A07_MAXIMUM_HORIZON_EXCEEDED', () => {
    const r = resolve(fixture({ lifecycle_horizon_end: '2026-08-14T00:00:00.000Z' }));
    assert(r.domain_state === 'ACTIVE', 'A07_LAST_DOMAIN_STATE_ACTIVE_REQUIRED');
    assert(r.authority_validity === 'EXPIRED' && r.active_consumable === false, 'A07_EXPIRED_REQUIRED');
  });

  pass('A08_CONTRADICTORY_FACT', () => {
    const r = resolve(fixture({ contradiction_events: [{ id: 'conflict-1', event_time: '2026-08-12T12:00:00.000Z', available_to_runtime_at: '2026-08-12T13:00:00.000Z' }] }));
    assert(r.domain_state === 'ACTIVE', 'A08_LAST_DOMAIN_STATE_ACTIVE_REQUIRED');
    assert(r.authority_status === 'CONFLICTED' && r.active_consumable === false, 'A08_CONFLICTED_REQUIRED');
  });

  pass('A09_STAGE_CANNOT_ESTABLISH_LIFECYCLE', () => {
    const r = resolve(fixture({ establishment: null, stage_set: ['MID'] }));
    assert(r.domain_state !== 'ACTIVE' && r.phenology_stage_authority === 'UNRESOLVED', 'A09_STAGE_MUST_NOT_ESTABLISH');
  });

  pass('A10_LIFECYCLE_INDEPENDENT_FROM_STAGE_AMBIGUITY', () => {
    const r = resolve(fixture({ stage_set: ['MID', 'LATE'] }));
    assert(r.active_consumable === true, 'A10_LIFECYCLE_MUST_REMAIN_ACTIVE');
    assert(r.phenology_stage_authority === 'UNRESOLVED' && r.phenology_stage === null, 'A10_STAGE_UNRESOLVED_REQUIRED');
  });

  pass('A11_LIFECYCLE_PLUS_SINGLETON_STAGE', () => {
    const r = resolve(fixture({ stage_set: ['MID'] }));
    assert(r.active_consumable === true, 'A11_ACTIVE_REQUIRED');
    assert(r.phenology_stage_authority === 'RESOLVED' && r.phenology_stage === 'MID', 'A11_MID_REQUIRED');
  });

  pass('A12_LIFECYCLE_PLUS_SINGLETON_KC', () => {
    const r = resolve(fixture({ stage_set: ['MID'] }));
    assert(r.crop_model_parameter_authority === 'RESOLVED' && r.kc === 1.15, 'A12_KC_1_15_REQUIRED');
  });

  pass('A13_LATE_ESTABLISHMENT_AVAILABILITY', () => {
    const establishment = { id: 'late-planting', event_time: '2026-05-20T04:00:00.000Z', available_to_runtime_at: '2026-08-15T02:00:00.000Z' };
    const prior = resolve(fixture({ establishment, state_evaluation_time: '2026-06-01T00:00:00.000Z', authority_evaluated_at: '2026-06-01T00:00:00.000Z' }));
    const later = resolve(fixture({ establishment, state_evaluation_time: '2026-08-15T03:00:00.000Z', authority_evaluated_at: '2026-08-15T03:00:00.000Z' }));
    assert(prior.active_consumable === false && prior.domain_state === 'NOT_ESTABLISHED', 'A13_NO_RETROACTIVE_ACTIVE');
    assert(later.active_consumable === true, 'A13_LATER_AVAILABILITY_MAY_BE_CONSUMED');
    assert(later.establishment_event_time === '2026-05-20T04:00:00.000Z', 'A13_EVENT_TIME_MUST_REMAIN_HISTORICAL');
  });

  pass('A14_LATE_TERMINATION_ARRIVAL', () => {
    const termination = { id: 'late-harvest', class: 'HARVEST', event_time: '2026-08-10T12:00:00.000Z', available_to_runtime_at: '2026-08-16T02:00:00.000Z' };
    const prior = resolve(fixture({ termination_events: [termination], state_evaluation_time: '2026-08-15T03:00:00.000Z', authority_evaluated_at: '2026-08-15T03:00:00.000Z' }));
    const later = resolve(fixture({ termination_events: [termination], state_evaluation_time: '2026-08-16T03:00:00.000Z', authority_evaluated_at: '2026-08-16T03:00:00.000Z' }));
    assert(prior.active_consumable === true && prior.termination_event_id === null, 'A14_PRIOR_DECISION_MUST_REMAIN_ACTIVE_AT_THEN_KNOWN_STATE');
    assert(later.domain_state === 'TERMINATED' && later.termination_event_time === '2026-08-10T12:00:00.000Z', 'A14_LATE_TERMINATION_MUST_APPLY_LATER');
    assert(prior.domain_state === 'ACTIVE', 'A14_PRIOR_OBJECT_MUST_NOT_BE_REWRITTEN');
  });

  pass('A15_SUPPORT_DOES_NOT_RENEW_HORIZON', () => {
    const withoutSupport = resolve(fixture());
    const withSupport = resolve(fixture({ support_events: [{ id: 'herbicide-1', event_time: '2026-07-01T14:00:00.000Z', available_to_runtime_at: '2026-07-01T18:00:00.000Z' }] }));
    assert(withSupport.last_support_event_id === 'herbicide-1', 'A15_SUPPORT_PROVENANCE_REQUIRED');
    assert(withSupport.lifecycle_horizon_end === withoutSupport.lifecycle_horizon_end, 'A15_HORIZON_RENEWAL_FORBIDDEN');
  });

  pass('A16_HORIZON_EXPIRY_IS_NOT_TERMINATION', () => {
    const r = resolve(fixture({ lifecycle_horizon_end: '2026-08-14T00:00:00.000Z' }));
    assert(r.authority_validity === 'EXPIRED', 'A16_EXPIRED_REQUIRED');
    assert(r.termination_event_id === null && r.termination_event_time === null, 'A16_FAKE_TERMINATION_FORBIDDEN');
    assert(r.domain_state === 'ACTIVE', 'A16_LAST_DOMAIN_STATE_MUST_BE_PRESERVED');
  });

  pass('A17_HTTP_200_NO_NEW_ROWS_CHANGES_NOTHING', () => {
    const baseInput = fixture({ support_events: [{ id: 'herbicide-1', event_time: '2026-07-01T14:00:00.000Z', available_to_runtime_at: '2026-07-01T18:00:00.000Z' }] });
    const before = resolve(baseInput);
    const after = resolve({ ...baseInput, provider_http_status: 200, provider_new_row_count: 0, provider_retrieved_at: '2026-08-15T03:00:00.000Z' });
    assert(equalStateProjection(before, after), 'A17_HTTP_SILENCE_MUST_CHANGE_NOTHING');
  });

  return cases;
}

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}

try {
  assert(/^[0-9a-f]{40}$/.test(BASE_SHA), 'AMENDMENT16_BASE_SHA_REQUIRED');
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'AMENDMENT16_SUBJECT_SHA_REQUIRED');
  assert(BASE_SHA === EXPECTED_BASE, `AMENDMENT16_BASE_DRIFT:${BASE_SHA}`);

  const changed = git(['diff', '--name-only', `${BASE_SHA}..${SUBJECT_SHA}`]).split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `AMENDMENT16_EXACT_FOUR_FILE_BOUNDARY_REQUIRED:${changed.join(',')}`);

  const x = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert(x.schema_version === 'geox_mcft_cap09_current_season_lifecycle_persistent_state_semantics_v1', 'AMENDMENT16_SCHEMA_REQUIRED');
  assert(x.exact_base_protected_main === EXPECTED_BASE, 'AMENDMENT16_CONFIG_BASE_REQUIRED');

  const predecessors = x.authority_predecessors;
  assert(git(['rev-parse', `${BASE_SHA}:${predecessors.amendment_13_path}`]) === predecessors.amendment_13_blob_sha, 'AMENDMENT16_AMENDMENT13_PIN_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}:${predecessors.amendment_15_path}`]) === predecessors.amendment_15_blob_sha, 'AMENDMENT16_AMENDMENT15_PIN_REQUIRED');
  assert(git(['rev-parse', `${BASE_SHA}:${predecessors.ea1j_formal_crop_context_path}`]) === predecessors.ea1j_formal_crop_context_blob_sha, 'AMENDMENT16_EA1J_PIN_REQUIRED');

  const n = x.normative_principles;
  assert(n.season_lifecycle_is_persistent_state === true, 'AMENDMENT16_PERSISTENT_STATE_REQUIRED');
  assert(n.provider_silence_is_lifecycle_evidence === false, 'AMENDMENT16_SILENCE_EVIDENCE_FORBIDDEN');
  assert(n.provider_silence_refreshes_observation === false, 'AMENDMENT16_SILENCE_REFRESH_FORBIDDEN');
  assert(n.provider_silence_terminates_lifecycle === false, 'AMENDMENT16_SILENCE_TERMINATION_FORBIDDEN');
  assert(n.authoritatively_established_active_state_may_persist === true, 'AMENDMENT16_ACTIVE_PERSISTENCE_REQUIRED');
  assert(n.phenology_model_may_establish_lifecycle === false, 'AMENDMENT16_PHENOLOGY_ESTABLISHMENT_FORBIDDEN');

  assert(JSON.stringify(x.state_contract.domain_state) === JSON.stringify(['NOT_ESTABLISHED', 'ACTIVE', 'TERMINATED']), 'AMENDMENT16_DOMAIN_STATE_MODEL_REQUIRED');
  assert(JSON.stringify(x.state_contract.authority_status) === JSON.stringify(['RESOLVED', 'UNRESOLVED', 'CONFLICTED']), 'AMENDMENT16_AUTHORITY_STATUS_MODEL_REQUIRED');
  assert(JSON.stringify(x.state_contract.authority_validity) === JSON.stringify(['VALID', 'EXPIRED']), 'AMENDMENT16_AUTHORITY_VALIDITY_MODEL_REQUIRED');
  assert(x.state_contract.expired_is_real_world_transition === false, 'AMENDMENT16_EXPIRED_NOT_TRANSITION_REQUIRED');

  const h = x.horizon_policy;
  assert(h.required === true && h.horizon_may_only_truncate_persistence === true && h.horizon_may_create_active === false, 'AMENDMENT16_HORIZON_ASYMMETRY_REQUIRED');
  assert(h.support_event_may_renew_horizon === false, 'AMENDMENT16_SUPPORT_RENEWAL_FORBIDDEN');
  const variants = h.ea1j_maize_grain_maximum_envelope_candidate.variant_stage_lengths_days;
  const totals = variants.map((v) => v.reduce((sum, x) => sum + x, 0));
  assert(Math.max(...totals) === 180, 'AMENDMENT16_EA1J_MAX_180_REDERIVATION_REQUIRED');
  assert(h.ea1j_maize_grain_maximum_envelope_candidate.maximum_total_days === 180, 'AMENDMENT16_EA1J_MAX_180_PIN_REQUIRED');
  assert(h.ea1j_maize_grain_maximum_envelope_candidate.eligible_as_positive_active_evidence === false, 'AMENDMENT16_HORIZON_CANNOT_CREATE_ACTIVE');

  assert(x.support_event_policy.may_refresh_direct_biological_observation === false, 'AMENDMENT16_SUPPORT_BIO_REFRESH_FORBIDDEN');
  assert(x.support_event_policy.may_renew_lifecycle_horizon === false, 'AMENDMENT16_SUPPORT_HORIZON_RENEWAL_FORBIDDEN');
  assert(x.downstream_policy.stage_may_establish_lifecycle === false, 'AMENDMENT16_STAGE_REVERSE_INFERENCE_FORBIDDEN');
  assert(x.downstream_policy.lifecycle_may_remain_active_when_stage_unresolved === true, 'AMENDMENT16_STAGE_LIFECYCLE_DECOUPLING_REQUIRED');

  const cases = runCases();
  const expectedCases = x.required_acceptance_cases;
  assert(JSON.stringify(cases.map((c) => c.id)) === JSON.stringify(expectedCases), 'AMENDMENT16_A01_A17_CASE_SET_REQUIRED');
  assert(cases.every((c) => c.status === 'PASS'), 'AMENDMENT16_ALL_CASES_PASS_REQUIRED');

  const t = x.t3r1_successor_boundary;
  assert(t.this_amendment_creates_t3r1_active_authority === false, 'AMENDMENT16_NO_T3R1_SPECIAL_CASE_REQUIRED');
  assert(t.formal_rebind_authorized === false && t.ea5e2_operational_activation_qualified === false, 'AMENDMENT16_NO_OPERATIONAL_EFFECT_REQUIRED');
  assert(t.runtime_write_count === 0 && t.database_write_count === 0 && t.scheduler_write_count === 0 && t.formal_evidence_write_count === 0, 'AMENDMENT16_ZERO_WRITES_REQUIRED');
  assert(t.formal_execution_count === '0/24', 'AMENDMENT16_FORMAL_ZERO_REQUIRED');

  write({
    schema_version: 'geox_mcft_cap09_amendment16_persistent_state_semantics_acceptance_v1',
    status: 'PASS',
    base_sha: BASE_SHA,
    subject_sha: SUBJECT_SHA,
    exact_four_file_boundary: true,
    predecessor_pins_verified: true,
    persistent_state_semantics_verified: true,
    provider_silence_inference_forbidden: true,
    observation_refresh_from_persistence_forbidden: true,
    three_layer_state_model_verified: true,
    ea1j_maximum_envelope_days_rederived: 180,
    horizon_is_truncation_only: true,
    acceptance_cases: cases,
    current_management_season_lifecycle_resolved_by_this_amendment: false,
    t3r1_active_authority_created_by_this_amendment: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    next_frontier: t.next_frontier_after_effectiveness
  });
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_amendment16_persistent_state_semantics_acceptance_v1',
    status: 'FAIL',
    base_sha: BASE_SHA || null,
    subject_sha: SUBJECT_SHA || null,
    current_management_season_lifecycle_resolved_by_this_amendment: false,
    t3r1_active_authority_created_by_this_amendment: false,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
}
