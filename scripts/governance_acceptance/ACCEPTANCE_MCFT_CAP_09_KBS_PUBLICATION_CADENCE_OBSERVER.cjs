#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLICATION-CADENCE-OBSERVER-V1.json');
const DOC = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-PUBLICATION-CADENCE-OBSERVER-V1.md');
const SCRIPT = path.join(ROOT, 'scripts/runtime_acceptance/OBSERVE_MCFT_CAP_09_KBS_PUBLICATION_CADENCE.py');
const RESTORE = path.join(ROOT, 'scripts/runtime_acceptance/RESTORE_MCFT_CAP_09_KBS_PUBLICATION_CADENCE_STATE.py');
const WORKFLOW = path.join(ROOT, '.github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireText(text, token) {
  assert(text.includes(token), `REQUIRED_TEXT_MISSING:${token}`);
}

function validateStatic() {
  const config = readJson(CONFIG);
  const doc = fs.readFileSync(DOC, 'utf8');
  const script = fs.readFileSync(SCRIPT, 'utf8');
  const restore = fs.readFileSync(RESTORE, 'utf8');
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');

  assert.equal(config.schema_version, 'geox_mcft_cap09_kbs_publication_cadence_observer_v1');
  assert.equal(config.status, 'READ_ONLY_OBSERVABILITY_CANDIDATE');
  assert.equal(config.base_protected_main_sha, '0da26233e8787f6e014e21f701e3837506ba6c15');
  assert.equal(config.source.url, 'https://lter.kbs.msu.edu/datatables/13.csv');
  assert.equal(config.source.required_final_host, 'lter.kbs.msu.edu');
  assert.equal(config.source.required_final_path, '/datatables/13.csv');
  assert.equal(config.source.event_time_field, 'datetime_utc');
  assert.equal(config.source.provider_publication_cadence_assumed, false);
  assert.equal(config.operating_profile.provider_operating_profile, 'CONFIRMED_DAILY_BATCH');
  assert.equal(config.operating_profile.observer_machine_evidence_remains_separate, true);
  assert.equal(config.operating_profile.minimum_machine_evidence_transitions, 3);
  assert.equal(config.operating_profile.authority_effect, false);
  assert.equal(config.polling.qualification_window_watcher.poll_interval_minutes, 5);
  assert.equal(config.polling.qualification_window_watcher.maximum_attempts, 24);
  assert.equal(config.polling.qualification_window_watcher.dispatches_ea5e2_live, false);
  assert.equal(config.polling.schedule, 'HOURLY_AT_MINUTE_17_UTC');
  assert.equal(config.polling.minimum_publication_transitions_before_candidate_classification, 3);
  assert.equal(config.state_chain.first_run_behavior, 'BASELINE_ONLY_NO_AVAILABILITY_BRACKET');
  assert.equal(config.state_chain.exact_source_availability_time_claimed_from_polling_alone, false);
  assert.equal(config.state_chain.raw_provider_body_published, false);
  assert.equal(config.state_chain.raw_provider_values_published, false);
  assert.equal(config.semantics.batch_ingestion_future_design_preserves_individual_hour_records, true);
  assert.equal(config.semantics.daily_aggregate_substitution_for_raw_hourly_authorized, false);
  assert.equal(config.semantics.current_kbs_6h_freshness_authority_changed, false);
  assert.equal(config.semantics.amendment_07_fixed_lag_changed, false);
  assert.equal(config.semantics.publication_observer_result_is_authority, false);
  for (const value of Object.values(config.writes)) assert.equal(value, false, 'OBSERVER_WRITE_MUST_BE_FALSE');
  assert.equal(config.activation_effect.ea5e2_operational_activation_qualified, false);
  assert.equal(config.activation_effect.ea5e3_effective, false);
  assert.equal(config.activation_effect.formal_window_started, false);
  assert.equal(config.activation_effect.formal_execution_count, '0/24');
  assert.equal(config.activation_effect.mcft_cap09_completed, false);

  requireText(doc, 'A in (last_not_seen_at, first_seen_at]');
  requireText(doc, 'The first observer run is baseline-only');
  requireText(doc, 'N hourly Evidence records');
  requireText(doc, 'does not emit `DAILY_BATCH` as an authority conclusion');
  requireText(doc, '`CONFIRMED_DAILY_BATCH`');
  requireText(doc, 'polls every five minutes for at most 24 attempts');
  requireText(doc, '#3056 separately prototypes E/A/I/K semantics and remains Draft');

  requireText(script, 'BASELINE_SNAPSHOT');
  requireText(script, 'SINGLE_NEW_EVENT_HOUR');
  requireText(script, 'MULTI_HOUR_FORWARD_BATCH');
  requireText(script, 'BACKFILL_OR_REVISION_ONLY');
  requireText(script, 'BATCHED_OR_BURSTY_OBSERVED');
  requireText(script, 'INSUFFICIENT_TRANSITIONS');
  requireText(script, 'raw_provider_body_published');
  requireText(script, 'raw_provider_values_published');

  requireText(restore, 'StripCrossHostAuthorizationRedirect');
  requireText(restore, 'redirected.remove_header("Authorization")');
  requireText(restore, 'branch": "main"');
  requireText(restore, 'status": "success"');
  requireText(restore, 'authorization_forwarded_cross_host');
  requireText(restore, 'archive_download_url');

  requireText(workflow, "cron: '17 * * * *'");
  requireText(workflow, 'actions: read');
  requireText(workflow, 'contents: read');
  requireText(workflow, 'cancel-in-progress: false');
  requireText(workflow, 'refs/heads/main');
  requireText(workflow, 'RESTORE_MCFT_CAP_09_KBS_PUBLICATION_CADENCE_STATE.py');
  requireText(workflow, '--previous-state');
  assert(!workflow.includes('--restore-github-state'), 'BROKEN_IN_PROCESS_ARTIFACT_RESTORE_MUST_NOT_BE_USED_BY_WORKFLOW');
  requireText(workflow, 'retention-days: 30');

  const python = process.env.PYTHON || 'python3';
  const selftest = spawnSync(python, [SCRIPT, '--selftest'], { cwd: ROOT, encoding: 'utf8' });
  if (selftest.status !== 0) {
    process.stderr.write(selftest.stdout || '');
    process.stderr.write(selftest.stderr || '');
    throw new Error(`OBSERVER_SELFTEST_FAILED:${selftest.status}`);
  }
  const lines = selftest.stdout.trim().split(/\r?\n/).filter(Boolean);
  const result = JSON.parse(lines[lines.length - 1]);
  assert.equal(result.status, 'PASS');
  assert.equal(result.baseline_bracket_fabrication_forbidden, true);
  assert.equal(result.single_hour_first_seen_bracket_verified, true);
  assert.equal(result.multi_hour_batch_first_seen_brackets_verified, true);
  assert.equal(result.provider_revision_metadata_verified, true);
  assert.equal(result.minimum_three_transition_classification_verified, true);
  assert.equal(result.daily_batch_authority_claimed, false);
  assert.equal(result.raw_provider_values_emitted, false);
  assert.equal(result.write_count, 0);

  const restoreSelftest = spawnSync(python, [RESTORE, '--selftest'], { cwd: ROOT, encoding: 'utf8' });
  if (restoreSelftest.status !== 0) {
    process.stderr.write(restoreSelftest.stdout || '');
    process.stderr.write(restoreSelftest.stderr || '');
    throw new Error(`RESTORE_SELFTEST_FAILED:${restoreSelftest.status}`);
  }
  const restoreLines = restoreSelftest.stdout.trim().split(/\r?\n/).filter(Boolean);
  const restoreResult = JSON.parse(restoreLines[restoreLines.length - 1]);
  assert.equal(restoreResult.status, 'PASS');
  assert.equal(restoreResult.cross_host_authorization_stripped, true);
  assert.equal(restoreResult.same_host_authorization_preserved, true);
  assert.equal(restoreResult.raw_provider_values_emitted, false);
  assert.equal(restoreResult.write_count, 0);

  return { observer: result, restore: restoreResult };
}

function validateLive(file) {
  const state = readJson(path.resolve(file));
  assert.equal(state.schema_version, 'geox_mcft_cap09_kbs_publication_cadence_state_v1');
  assert.equal(state.status, 'PASS');
  assert.equal(state.source_url, 'https://lter.kbs.msu.edu/datatables/13.csv');
  assert.equal(state.source_authority_role, 'AVAILABILITY_OBSERVER_ONLY_NOT_FORMAL_EVIDENCE');
  assert.equal(state.candidate_publication_class_is_authority, false);
  assert.equal(state.provider_expected_update_behavior, 'DAILY_BATCH');
  assert.equal(state.provider_operating_profile, 'CONFIRMED_DAILY_BATCH');
  assert.equal(state.provider_operating_profile_authority_effect, false);
  assert.equal(state.provider_operating_behavior_confirmation_is_freshness_authority, false);
  assert.equal(state.exact_source_availability_time_claimed_from_polling_alone, false);
  assert.equal(state.raw_provider_body_published, false);
  assert.equal(state.raw_provider_values_published, false);
  assert.equal(state.daily_aggregate_substitution_authorized, false);
  assert.equal(state.kbs_6h_freshness_authority_changed, false);
  assert.equal(state.amendment_07_fixed_lag_changed, false);
  assert.equal(state.formal_database_write_count, 0);
  assert.equal(state.formal_raw_write_count, 0);
  assert.equal(state.scheduler_write_count, 0);
  assert.equal(state.canonical_runtime_write_count, 0);
  assert.equal(state.formal_execution_count, '0/24');
  assert(Number.isFinite(Date.parse(state.polled_at)), 'POLLED_AT_REQUIRED');
  assert(Number.isFinite(Date.parse(state.latest_event_time)), 'LATEST_EVENT_TIME_REQUIRED');
  assert(typeof state.snapshot_sha256 === 'string' && state.snapshot_sha256.startsWith('sha256:'), 'SNAPSHOT_DIGEST_REQUIRED');
  assert(Number.isInteger(state.response_bytes) && state.response_bytes > 0, 'RESPONSE_BYTES_REQUIRED');
  assert(Array.isArray(state.recent_event_index) && state.recent_event_index.length > 0, 'RECENT_EVENT_INDEX_REQUIRED');
  for (const item of state.recent_event_index) {
    assert(Number.isFinite(Date.parse(item.event_time)), 'RECENT_EVENT_TIME_INVALID');
    assert(typeof item.row_identity_hash === 'string' && item.row_identity_hash.startsWith('sha256:'), 'ROW_IDENTITY_HASH_REQUIRED');
    assert(Number.isInteger(item.row_variant_count) && item.row_variant_count >= 1, 'ROW_VARIANT_COUNT_REQUIRED');
  }
  const allowed = new Set([
    'INSUFFICIENT_TRANSITIONS',
    'HOURLY_INCREMENTAL_OBSERVED',
    'BATCHED_OR_BURSTY_OBSERVED',
    'VARIABLE_PUBLICATION_OBSERVED',
  ]);
  assert(allowed.has(state.candidate_publication_class), 'CANDIDATE_CLASS_INVALID');
  const transition = state.transition;
  assert(transition && typeof transition === 'object', 'TRANSITION_REQUIRED');
  if (transition.baseline_only) {
    assert.equal(transition.shape, 'BASELINE_SNAPSHOT');
    assert.equal(transition.availability_brackets_established, 0);
    assert.deepEqual(transition.first_seen_observations, []);
  } else {
    const polledAt = Date.parse(state.polled_at);
    for (const bracket of transition.first_seen_observations) {
      const lastNotSeenAt = Date.parse(bracket.last_not_seen_at);
      const firstSeenAt = Date.parse(bracket.first_seen_at);
      assert(lastNotSeenAt < firstSeenAt, 'BRACKET_ORDER_INVALID');
      assert(firstSeenAt <= polledAt, 'FIRST_SEEN_AFTER_CURRENT_POLL_INVALID');
    }
  }
  return {
    status: 'PASS',
    live_metadata_only_state_validated: true,
    baseline_only: transition.baseline_only,
    latest_event_time: state.latest_event_time,
    candidate_publication_class: state.candidate_publication_class,
    raw_values_emitted: false,
    write_count: 0,
  };
}

const selftest = validateStatic();
const liveIndex = process.argv.indexOf('--live');
const output = liveIndex >= 0 ? validateLive(process.argv[liveIndex + 1]) : {
  status: 'PASS',
  static_contract_validated: true,
  deterministic_selftest: selftest.observer,
  safe_restore_selftest: selftest.restore,
  raw_values_emitted: false,
  write_count: 0,
};
process.stdout.write(`${JSON.stringify(output)}\n`);
