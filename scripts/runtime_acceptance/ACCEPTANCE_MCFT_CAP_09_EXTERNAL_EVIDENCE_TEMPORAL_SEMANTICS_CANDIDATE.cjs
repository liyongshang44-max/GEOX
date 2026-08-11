#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(
  ROOT,
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-EVIDENCE-TEMPORAL-SEMANTICS-CANDIDATE-V1.json',
);
const FIXTURE_PATH = path.join(
  ROOT,
  'scripts/runtime_acceptance/fixtures/MCFT_CAP_09_EXTERNAL_EVIDENCE_TEMPORAL_SEMANTICS_FIXTURES_V1.json',
);
const OUTPUT_PATH = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_09_EXTERNAL_EVIDENCE_TEMPORAL_SEMANTICS_CANDIDATE_RESULT.json',
);

const HOUR_MS = 60 * 60 * 1000;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ms(value, code = 'TIME_INVALID') {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), `${code}:${value}`);
  assert.equal(new Date(parsed).toISOString(), value, `${code}_NOT_CANONICAL:${value}`);
  return parsed;
}

function iso(value) {
  return new Date(value).toISOString();
}

function validateContract(contract) {
  assert.equal(
    contract.schema_version,
    'geox_mcft_cap09_external_evidence_temporal_semantics_candidate_v1',
    'TEMPORAL_CONTRACT_SCHEMA_REQUIRED',
  );
  assert.equal(contract.record_status, 'NON_EFFECTIVE_ARCHITECTURE_CANDIDATE');
  assert.equal(contract.base_protected_main_sha, '0da26233e8787f6e014e21f701e3837506ba6c15');
  assert.equal(contract.clock_model.E_event_time.must_not_be_relabelled, true);
  assert.equal(contract.clock_model.A_source_availability_time.existing_runtime_field_reused, false);
  assert.equal(contract.clock_model.A_source_availability_time.exact_time_may_be_claimed_without_provider_timestamp_or_observed_bracket, false);
  assert.equal(contract.clock_model.I_ingested_at.backdating_authorized, false);
  assert.equal(contract.clock_model.K_runtime_knowledge_time.existing_field_authority, 'available_to_runtime_at');
  assert.equal(contract.clock_model.K_runtime_knowledge_time.must_be_gte_ingested_at, true);
  assert.equal(
    contract.causality_policy.late_after_authorized_cutoff,
    'DOES_NOT_RETROACTIVELY_SATISFY_OR_RESCUE_THE_ORIGINAL_FORMAL_SLOT',
  );
  assert.equal(contract.duplicate_and_revision_policy.existing_record_rewrite_authorized, false);
  assert.equal(contract.delayed_assimilation_candidate.effectiveness, 'NOT_AUTHORIZED_BY_THIS_CANDIDATE');
  assert.equal(contract.delayed_assimilation_candidate.historical_lineage_mutation_authorized, false);
  assert.equal(contract.delayed_assimilation_candidate.historical_fact_delete_authorized, false);
  assert.equal(contract.revision_lifecycle_reuse.transaction_family, 'E_REVISION_LINEAGE_STEP_COMMIT');
  assert.equal(contract.revision_lifecycle_reuse.new_revision_transaction_family_required, false);
  assert.equal(contract.kbs_current_claim.publication_pattern_adjudicated_by_this_candidate, false);
  assert.equal(contract.kbs_current_claim.daily_batch_claimed, false);

  for (const [key, value] of Object.entries(contract.authority_effect)) {
    if (key === 'formal_execution_count') {
      assert.equal(value, '0/24');
    } else if (key === 'mcft_cap09_completed') {
      assert.equal(value, false);
    } else {
      assert.equal(value, false, `AUTHORITY_EFFECT_MUST_REMAIN_FALSE:${key}`);
    }
  }
}

function validateTemporalEvidence(record) {
  const E = ms(record.event_time, 'EVENT_TIME_INVALID');
  const L = ms(record.availability_observation.last_not_seen_at, 'LAST_NOT_SEEN_INVALID');
  const F = ms(record.availability_observation.first_seen_at, 'FIRST_SEEN_INVALID');
  const I = ms(record.ingested_at, 'INGESTED_AT_INVALID');
  const K = ms(record.available_to_runtime_at, 'AVAILABLE_TO_RUNTIME_INVALID');

  assert(L < F, 'AVAILABILITY_BRACKET_ORDER_INVALID');
  assert(E <= F, 'EVENT_AFTER_FIRST_SEEN_FORBIDDEN');
  assert(F <= I, 'INGEST_BEFORE_FIRST_SEEN_FORBIDDEN');
  assert(I <= K, 'RUNTIME_KNOWLEDGE_BEFORE_INGEST_FORBIDDEN');

  if (record.availability_observation.provider_published_at) {
    const A = ms(
      record.availability_observation.provider_published_at,
      'PROVIDER_PUBLISHED_AT_INVALID',
    );
    assert(E <= A, 'PROVIDER_AVAILABILITY_BEFORE_EVENT_FORBIDDEN');
    assert(L < A && A <= F, 'PROVIDER_AVAILABILITY_OUTSIDE_OBSERVED_BRACKET');
    return {
      kind: 'EXACT_PROVIDER_TIMESTAMP',
      exact_at: iso(A),
      lower_exclusive: iso(L),
      upper_inclusive: iso(F),
    };
  }

  return {
    kind: 'OBSERVED_BRACKET',
    lower_exclusive: iso(L),
    upper_inclusive: iso(F),
  };
}

function semanticIdentity(record) {
  return `${record.source_id}|${record.record_type}|${record.event_time}`;
}

function groupIncoming(records) {
  const byRef = new Map();
  const accepted = [];
  const duplicates = [];
  const conflicts = [];
  const revisions = [];
  const availabilityProofs = [];

  for (const record of records) {
    availabilityProofs.push({
      source_record_id: record.source_record_id,
      availability: validateTemporalEvidence(record),
    });
    const previous = byRef.get(record.source_record_id);
    if (previous) {
      if (previous.payload_hash === record.payload_hash) {
        duplicates.push(record);
        continue;
      }
      conflicts.push(record);
      continue;
    }
    byRef.set(record.source_record_id, record);
    accepted.push(record);
  }

  const bySemanticIdentity = new Map();
  for (const record of accepted) {
    const identity = semanticIdentity(record);
    const previous = bySemanticIdentity.get(identity);
    if (!previous) {
      bySemanticIdentity.set(identity, record);
      continue;
    }
    if (previous.payload_hash === record.payload_hash) {
      duplicates.push(record);
      continue;
    }
    const explicitRevisionProof =
      record.supersedes_source_record_ref === previous.source_record_id
      && typeof record.provider_revision_id === 'string'
      && record.provider_revision_id.length > 0;
    if (explicitRevisionProof) {
      revisions.push({ previous, current: record });
      bySemanticIdentity.set(identity, record);
    } else {
      conflicts.push(record);
    }
  }

  return {
    accepted: [...bySemanticIdentity.values()],
    duplicates,
    conflicts,
    revisions,
    availabilityProofs,
  };
}

function classifyCadence(samples) {
  if (!Array.isArray(samples) || samples.length < 3) return 'INSUFFICIENT_SAMPLES';

  const ordered = [...samples].sort((a, b) => ms(a.event_time) - ms(b.event_time));
  const eventTimes = ordered.map((sample) => ms(sample.event_time));
  const firstSeenTimes = ordered.map((sample) => ms(sample.first_seen_at));

  const eventHourly = eventTimes.slice(1).every(
    (value, index) => value - eventTimes[index] === HOUR_MS,
  );
  if (!eventHourly) return 'IRREGULAR_EVENT_CADENCE';

  if (
    new Set(firstSeenTimes).size === 1
    && eventTimes[eventTimes.length - 1] - eventTimes[0] >= 2 * HOUR_MS
  ) {
    return 'BATCHED_PUBLICATION';
  }

  const firstSeenHourly = firstSeenTimes.slice(1).every(
    (value, index) => value - firstSeenTimes[index] === HOUR_MS,
  );
  if (!firstSeenHourly) return 'HOURLY_EVENTS_VARIABLE_PUBLICATION';

  const latencies = eventTimes.map((eventTime, index) => firstSeenTimes[index] - eventTime);
  const spread = Math.max(...latencies) - Math.min(...latencies);
  const mean = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

  if (Math.max(...latencies) <= HOUR_MS) return 'HOURLY_LOW_LATENCY';
  if (spread <= 15 * 60 * 1000 && mean > 6 * HOUR_MS) {
    return 'HOURLY_DELAYED_HIGH_LATENCY';
  }
  if (spread <= 15 * 60 * 1000) return 'HOURLY_FIXED_LATENCY';
  return 'HOURLY_EVENTS_VARIABLE_PUBLICATION';
}

function adjudicateScenario(scenario) {
  const grouped = groupIncoming(scenario.records);
  assert.equal(grouped.conflicts.length, 0, `UNPROVEN_CONFLICT:${scenario.id}`);

  const preexistingRefs = new Set(scenario.preexisting_refs || []);
  const materiallyNew = grouped.accepted.filter(
    (record) => !preexistingRefs.has(record.source_record_id),
  );
  const delayed = materiallyNew.filter(
    (record) => ms(record.available_to_runtime_at) > ms(record.causal_cutoff_at),
  );

  const revisionCandidates = [...delayed];
  for (const pair of grouped.revisions) {
    if (!revisionCandidates.includes(pair.current)) revisionCandidates.push(pair.current);
  }

  const replayRequired = revisionCandidates.length > 0;
  const earliestAffectedTick = replayRequired
    ? Math.min(...revisionCandidates.map((record) => ms(record.first_affected_logical_tick)))
    : null;

  return {
    id: scenario.id,
    replay_required: replayRequired,
    earliest_affected_tick: earliestAffectedTick === null ? null : iso(earliestAffectedTick),
    duplicate_count: grouped.duplicates.length,
    provider_revision_count: grouped.revisions.length,
    delayed_record_count: delayed.length,
    publication_pattern: classifyCadence(scenario.cadence_samples),
    availability_proofs: grouped.availabilityProofs,
    revision_transaction_family: replayRequired ? 'E_REVISION_LINEAGE_STEP_COMMIT' : null,
    revision_declaration_authorized_by_candidate: false,
    lineage_promotion_authorized_by_candidate: false,
    old_lineage_mutated: false,
    old_canonical_evidence_deleted: false,
    retroactive_formal_rescue: false,
  };
}

function main() {
  const contract = loadJson(CONTRACT_PATH);
  const fixtures = loadJson(FIXTURE_PATH);
  validateContract(contract);
  assert.equal(
    fixtures.schema_version,
    'geox_mcft_cap09_external_evidence_temporal_semantics_fixture_v1',
  );

  const requiredFixtureIds = new Set(contract.required_deterministic_fixture_ids);
  const actualFixtureIds = new Set(fixtures.scenarios.map((scenario) => scenario.id));
  assert.deepEqual([...actualFixtureIds].sort(), [...requiredFixtureIds].sort(), 'FIXTURE_SET_MUST_BE_EXACT');

  const results = [];
  for (const scenario of fixtures.scenarios) {
    const actual = adjudicateScenario(scenario);
    for (const [key, expected] of Object.entries(scenario.expected)) {
      assert.deepEqual(actual[key], expected, `${scenario.id}:${key}`);
    }
    assert.equal(actual.old_lineage_mutated, false);
    assert.equal(actual.old_canonical_evidence_deleted, false);
    assert.equal(actual.retroactive_formal_rescue, false);
    assert.equal(actual.revision_declaration_authorized_by_candidate, false);
    assert.equal(actual.lineage_promotion_authorized_by_candidate, false);
    results.push(actual);
  }

  const publicationPatterns = Object.fromEntries(
    results.map((result) => [result.id, result.publication_pattern]),
  );
  assert.equal(publicationPatterns.hourly_low_latency, 'HOURLY_LOW_LATENCY');
  assert.equal(
    publicationPatterns.hourly_fixed_latency_within_authorized_cutoff,
    'HOURLY_FIXED_LATENCY',
  );
  assert.equal(publicationPatterns.delayed_hourly_beyond_cutoff, 'HOURLY_DELAYED_HIGH_LATENCY');
  assert.equal(publicationPatterns.daily_batch, 'BATCHED_PUBLICATION');

  const output = {
    schema_version: 'geox_mcft_cap09_external_evidence_temporal_semantics_candidate_result_v1',
    status: 'PASS',
    subject_sha: process.env.MCFT_SUBJECT_SHA || null,
    candidate_effective: false,
    production_runtime_changed: false,
    external_provider_called: false,
    database_write_count: 0,
    formal_raw_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    revision_declaration_write_count: 0,
    lineage_promotion_write_count: 0,
    kbs_publication_pattern_claimed: false,
    kbs_freshness_threshold_changed: false,
    amendment_07_cutoff_changed: false,
    formal_execution_count: '0/24',
    fixture_count: results.length,
    fixture_results: results,
    conclusion: 'DETERMINISTIC_TEMPORAL_SEMANTICS_CANDIDATE_QUALIFIED_NON_EFFECTIVE',
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
