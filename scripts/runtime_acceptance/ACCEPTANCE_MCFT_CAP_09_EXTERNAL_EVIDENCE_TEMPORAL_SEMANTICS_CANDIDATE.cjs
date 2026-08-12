#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EXTERNAL-EVIDENCE-TEMPORAL-SEMANTICS-CANDIDATE-V1.json');
const FIXTURE_PATH = path.join(ROOT, 'scripts/runtime_acceptance/fixtures/MCFT_CAP_09_EXTERNAL_EVIDENCE_TEMPORAL_SEMANTICS_FIXTURES_V1.json');
const OUTPUT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EXTERNAL_EVIDENCE_TEMPORAL_SEMANTICS_CANDIDATE_RESULT.json');
const HOUR_MS = 3600_000;

const loadJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function ms(value, code='TIME_INVALID') {
  const n = Date.parse(value);
  assert(Number.isFinite(n), `${code}:${value}`);
  assert.equal(new Date(n).toISOString(), value, `${code}_NOT_CANONICAL:${value}`);
  return n;
}
const iso = (n) => new Date(n).toISOString();

function validateContract(contract) {
  assert.equal(contract.schema_version, 'geox_mcft_cap09_external_evidence_temporal_semantics_candidate_v1');
  assert.equal(contract.record_status, 'NON_EFFECTIVE_ARCHITECTURE_CANDIDATE');
  assert.equal(contract.base_protected_main_sha, '0da26233e8787f6e014e21f701e3837506ba6c15');
  assert.equal(contract.clock_model.E_event_time.must_not_be_relabelled, true);
  assert.equal(contract.clock_model.A_source_availability_time.existing_runtime_field_reused, false);
  assert.equal(contract.clock_model.A_source_availability_time.exact_time_may_be_claimed_without_provider_timestamp_or_observed_bracket, false);
  assert.equal(contract.clock_model.I_ingested_at.backdating_authorized, false);
  assert.equal(contract.clock_model.K_runtime_knowledge_time.existing_field_authority, 'available_to_runtime_at');
  assert.equal(contract.clock_model.K_runtime_knowledge_time.must_be_gte_ingested_at, true);
  assert.equal(contract.causality_policy.late_after_authorized_cutoff, 'DOES_NOT_RETROACTIVELY_SATISFY_OR_RESCUE_THE_ORIGINAL_FORMAL_SLOT');
  assert.equal(contract.duplicate_and_revision_policy.existing_record_rewrite_authorized, false);
  assert.equal(contract.delayed_assimilation_candidate.effectiveness, 'NOT_AUTHORIZED_BY_THIS_CANDIDATE');
  assert.equal(contract.delayed_assimilation_candidate.historical_lineage_mutation_authorized, false);
  assert.equal(contract.delayed_assimilation_candidate.historical_fact_delete_authorized, false);
  assert.equal(contract.revision_lifecycle_reuse.transaction_family, 'E_REVISION_LINEAGE_STEP_COMMIT');
  assert.equal(contract.revision_lifecycle_reuse.new_revision_transaction_family_required, false);
  assert.equal(contract.kbs_current_claim.publication_pattern_adjudicated_by_this_candidate, false);
  assert.equal(contract.kbs_current_claim.daily_batch_claimed, false);
  for (const [key, value] of Object.entries(contract.authority_effect)) {
    if (key === 'formal_execution_count') assert.equal(value, '0/24');
    else assert.equal(value, false, `AUTHORITY_EFFECT_MUST_REMAIN_FALSE:${key}`);
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
    const A = ms(record.availability_observation.provider_published_at, 'PROVIDER_PUBLISHED_AT_INVALID');
    assert(E <= A, 'PROVIDER_AVAILABILITY_BEFORE_EVENT_FORBIDDEN');
    assert(L < A && A <= F, 'PROVIDER_AVAILABILITY_OUTSIDE_OBSERVED_BRACKET');
    return {kind:'EXACT_PROVIDER_TIMESTAMP', exact_at:iso(A), lower_exclusive:iso(L), upper_inclusive:iso(F)};
  }
  return {kind:'OBSERVED_BRACKET', lower_exclusive:iso(L), upper_inclusive:iso(F)};
}

function deriveFirstAffectedLogicalTick(record) {
  const E = ms(record.event_time, 'EVENT_TIME_INVALID');
  if (record.record_type === 'observed_rainfall_v1' || record.record_type === 'historical_et0_estimate_v1') {
    assert.equal(E % HOUR_MS, 0, `EXACT_INTERVAL_END_MUST_BE_HOURLY:${record.source_record_id}`);
    return E;
  }
  if (record.record_type === 'soil_moisture_observation_v1') return Math.ceil(E / HOUR_MS) * HOUR_MS;
  throw new Error(`FIRST_AFFECTED_TICK_ROLE_MAPPING_REQUIRED:${record.record_type}`);
}

const semanticIdentity = (r) => `${r.source_id}|${r.record_type}|${r.event_time}`;
function groupIncoming(records) {
  const byRef = new Map();
  const accepted=[]; const duplicates=[]; const conflicts=[]; const revisions=[]; const availabilityProofs=[];
  for (const r of records) {
    availabilityProofs.push({source_record_id:r.source_record_id, availability:validateTemporalEvidence(r)});
    const prev = byRef.get(r.source_record_id);
    if (prev) {
      if (prev.payload_hash === r.payload_hash) duplicates.push(r); else conflicts.push(r);
      continue;
    }
    byRef.set(r.source_record_id, r); accepted.push(r);
  }
  const bySemantic = new Map();
  for (const r of accepted) {
    const key = semanticIdentity(r); const prev = bySemantic.get(key);
    if (!prev) { bySemantic.set(key, r); continue; }
    if (prev.payload_hash === r.payload_hash) { duplicates.push(r); continue; }
    const provenRevision = r.supersedes_source_record_ref === prev.source_record_id && typeof r.provider_revision_id === 'string' && r.provider_revision_id.length > 0;
    if (provenRevision) { revisions.push({previous:prev,current:r}); bySemantic.set(key,r); }
    else conflicts.push(r);
  }
  return {accepted:[...bySemantic.values()], duplicates, conflicts, revisions, availabilityProofs};
}

function classifyCadence(samples) {
  if (!Array.isArray(samples) || samples.length < 3) return 'INSUFFICIENT_SAMPLES';
  const ordered=[...samples].sort((a,b)=>ms(a.event_time)-ms(b.event_time));
  const events=ordered.map(s=>ms(s.event_time));
  const seen=ordered.map(s=>ms(s.first_seen_at));
  if (!events.slice(1).every((v,i)=>v-events[i]===HOUR_MS)) return 'IRREGULAR_EVENT_CADENCE';
  if (new Set(seen).size===1 && events.at(-1)-events[0]>=2*HOUR_MS) return 'BATCHED_PUBLICATION';
  if (!seen.slice(1).every((v,i)=>v-seen[i]===HOUR_MS)) return 'HOURLY_EVENTS_VARIABLE_PUBLICATION';
  const latency=events.map((v,i)=>seen[i]-v);
  const spread=Math.max(...latency)-Math.min(...latency);
  const mean=latency.reduce((a,b)=>a+b,0)/latency.length;
  if (Math.max(...latency)<=HOUR_MS) return 'HOURLY_LOW_LATENCY';
  if (spread<=15*60_000 && mean>6*HOUR_MS) return 'HOURLY_DELAYED_HIGH_LATENCY';
  if (spread<=15*60_000) return 'HOURLY_FIXED_LATENCY';
  return 'HOURLY_EVENTS_VARIABLE_PUBLICATION';
}

function adjudicateScenario(scenario) {
  const grouped=groupIncoming(scenario.records);
  assert.equal(grouped.conflicts.length,0,`UNPROVEN_CONFLICT:${scenario.id}`);
  for (const r of grouped.accepted) {
    assert.equal(ms(r.first_affected_logical_tick), deriveFirstAffectedLogicalTick(r), `FIRST_AFFECTED_TICK_MISMATCH:${scenario.id}:${r.source_record_id}`);
  }
  const preexisting=new Set(scenario.preexisting_refs||[]);
  const materiallyNew=grouped.accepted.filter(r=>!preexisting.has(r.source_record_id));
  const delayed=materiallyNew.filter(r=>ms(r.available_to_runtime_at)>ms(r.causal_cutoff_at));
  const revisionCandidates=[...delayed];
  for (const pair of grouped.revisions) if (!revisionCandidates.includes(pair.current)) revisionCandidates.push(pair.current);
  const replayRequired=revisionCandidates.length>0;
  const earliest=replayRequired ? Math.min(...revisionCandidates.map(deriveFirstAffectedLogicalTick)) : null;
  return {
    id:scenario.id,
    replay_required:replayRequired,
    earliest_affected_tick:earliest===null?null:iso(earliest),
    duplicate_count:grouped.duplicates.length,
    provider_revision_count:grouped.revisions.length,
    delayed_record_count:delayed.length,
    publication_pattern:classifyCadence(scenario.cadence_samples),
    availability_proofs:grouped.availabilityProofs,
    role_derived_tick_mapping_verified:true,
    revision_transaction_family:replayRequired?'E_REVISION_LINEAGE_STEP_COMMIT':null,
    revision_declaration_authorized_by_candidate:false,
    lineage_promotion_authorized_by_candidate:false,
    old_lineage_mutated:false,
    old_canonical_evidence_deleted:false,
    retroactive_formal_rescue:false
  };
}

function main() {
  const contract=loadJson(CONTRACT_PATH); const fixtures=loadJson(FIXTURE_PATH);
  validateContract(contract);
  assert.equal(fixtures.schema_version,'geox_mcft_cap09_external_evidence_temporal_semantics_fixture_v1');
  const required=[...contract.required_deterministic_fixture_ids].sort();
  const actual=[...fixtures.scenarios.map(s=>s.id)].sort();
  assert.deepEqual(actual,required,'FIXTURE_SET_MUST_BE_EXACT');
  const results=[];
  for (const scenario of fixtures.scenarios) {
    const result=adjudicateScenario(scenario);
    for (const [key,expected] of Object.entries(scenario.expected)) assert.deepEqual(result[key],expected,`${scenario.id}:${key}`);
    assert.equal(result.old_lineage_mutated,false);
    assert.equal(result.old_canonical_evidence_deleted,false);
    assert.equal(result.retroactive_formal_rescue,false);
    assert.equal(result.revision_declaration_authorized_by_candidate,false);
    assert.equal(result.lineage_promotion_authorized_by_candidate,false);
    results.push(result);
  }
  const patterns=Object.fromEntries(results.map(r=>[r.id,r.publication_pattern]));
  assert.equal(patterns.hourly_low_latency,'HOURLY_LOW_LATENCY');
  assert.equal(patterns.hourly_fixed_latency_within_authorized_cutoff,'HOURLY_FIXED_LATENCY');
  assert.equal(patterns.delayed_hourly_beyond_cutoff,'HOURLY_DELAYED_HIGH_LATENCY');
  assert.equal(patterns.daily_batch,'BATCHED_PUBLICATION');
  const availabilityKinds=new Set(results.flatMap(r=>r.availability_proofs.map(p=>p.availability.kind)));
  assert(availabilityKinds.has('EXACT_PROVIDER_TIMESTAMP'),'EXACT_PROVIDER_TIMESTAMP_MODE_NOT_COVERED');
  assert(availabilityKinds.has('OBSERVED_BRACKET'),'OBSERVED_BRACKET_MODE_NOT_COVERED');
  const output={
    schema_version:'geox_mcft_cap09_external_evidence_temporal_semantics_candidate_result_v1',
    status:'PASS', subject_sha:process.env.MCFT_SUBJECT_SHA||null,
    candidate_effective:false, production_runtime_changed:false, external_provider_called:false,
    database_write_count:0, formal_raw_write_count:0, scheduler_write_count:0, canonical_runtime_write_count:0,
    revision_declaration_write_count:0, lineage_promotion_write_count:0,
    kbs_publication_pattern_claimed:false, kbs_freshness_threshold_changed:false, amendment_07_cutoff_changed:false,
    formal_execution_count:'0/24', fixture_count:results.length,
    exact_provider_timestamp_mode_covered:true, observed_availability_bracket_mode_covered:true,
    role_derived_tick_mapping_verified:true, fixture_results:results,
    conclusion:'DETERMINISTIC_TEMPORAL_SEMANTICS_CANDIDATE_QUALIFIED_NON_EFFECTIVE'
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH),{recursive:true});
  fs.writeFileSync(OUTPUT_PATH,`${JSON.stringify(output,null,2)}\n`,'utf8');
  process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
}
main();
