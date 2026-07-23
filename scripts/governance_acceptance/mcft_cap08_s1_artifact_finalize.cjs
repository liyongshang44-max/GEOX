#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S1_AUTHORITY_ARTIFACT.json');
const STAGE = String(process.env.MCFT_ARTIFACT_STAGE || 'CANDIDATE_HEAD');

function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha(value) { return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value))).digest('hex')}`; }
function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function requiredSha(value, code) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{40}$/.test(raw)) throw new Error(code);
  return git('rev-parse', `${raw}^{commit}`);
}

try {
  if (!['CANDIDATE_HEAD', 'EXACT_MERGE_SHA'].includes(STAGE)) throw new Error(`MCFT_ARTIFACT_STAGE_INVALID:${STAGE}`);
  const boundary = readJson('acceptance-output/MCFT_CAP_08_S1_BOUNDARY_RESULT.json');
  const db = readJson('acceptance-output/MCFT_CAP_08_S1_BASE_RUNTIME_DB_RESULT.json');
  const status = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json');
  const implementation = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-PHASE-ENGINE-IMPLEMENTATION-V1.json');
  const predecessor = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-PREDECESSOR-CONSUMPTION-V1.json');
  assert.equal(boundary.status, 'PASS');
  assert.equal(db.status, 'PASS');
  assert.equal(status.s1_candidate_implemented, true);
  assert.equal(db.phase_engine_contract_digest, implementation.phase_engine_contract_digest);
  assert.equal(db.phase_engine_source_digest, implementation.phase_engine_source_digest);
  assert.equal(db.final_formal_closure_executed, false);
  assert.equal(db.production_runtime_source_authorized, false);

  const candidateHead = requiredSha(
    STAGE === 'EXACT_MERGE_SHA'
      ? readJson('acceptance-output/MCFT_CAP_08_SLICE_EXACT_SHA_ATTESTATION_RESULT.json').candidate_head_sha
      : process.env.MCFT_CANDIDATE_SHA,
    'MCFT_CANDIDATE_SHA_INVALID',
  );
  const baseHead = requiredSha(
    STAGE === 'EXACT_MERGE_SHA'
      ? readJson('acceptance-output/MCFT_CAP_08_SLICE_EXACT_SHA_ATTESTATION_RESULT.json').base_head_sha
      : process.env.MCFT_BASE_SHA,
    'MCFT_BASE_SHA_INVALID',
  );
  const tree = STAGE === 'EXACT_MERGE_SHA'
    ? readJson('acceptance-output/MCFT_CAP_08_SLICE_EXACT_SHA_ATTESTATION_RESULT.json')
    : null;
  const subject = STAGE === 'EXACT_MERGE_SHA'
    ? requiredSha(tree.subject_sha, 'MCFT_SUBJECT_SHA_INVALID')
    : candidateHead;

  const artifact = {
    schema_version: 'geox_mcft_cap08_s1_authority_artifact_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S1',
    stage: STAGE,
    subject_sha: subject,
    subject_commit: subject,
    base_head_sha: baseHead,
    candidate_head_sha: candidateHead,
    candidate_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? tree.candidate_tree_sha : git('rev-parse', `${candidateHead}^{tree}`),
    merge_commit_sha: STAGE === 'EXACT_MERGE_SHA' ? tree.merge_commit_sha : null,
    merge_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? tree.merge_tree_sha : null,
    candidate_to_merge_tree_delta: STAGE === 'EXACT_MERGE_SHA' ? 0 : null,
    attested_tree_sha: STAGE === 'EXACT_MERGE_SHA' ? tree.attested_tree_sha : null,
    predecessor_authority: predecessor,
    status_projection: {
      candidate_field: 's1_candidate_implemented',
      candidate_value: true,
      repository_delivery_state: status.delivery_state,
      effectiveness_condition: status.effectiveness_condition,
    },
    implementation: {
      phase_engine_contract_digest: implementation.phase_engine_contract_digest,
      phase_engine_source_digest: implementation.phase_engine_source_digest,
      phase_order: implementation.phase_order,
      canonical_write_order: implementation.canonical_write_order,
      successful_tick_count: db.successful_tick_count,
      bootstrap_inclusive_state_count: db.bootstrap_inclusive_state_count,
      successful_forecast_count: db.successful_forecast_count,
      forecast_point_count: db.forecast_point_count,
      scenario_set_count: db.scenario_set_count,
      scenario_option_count: db.scenario_option_count,
      scenario_point_count: db.scenario_point_count,
      final_formal_closure_executed: false,
    },
    evidence: {
      changed_file_boundary: boundary,
      fresh_postgresql_slice_acceptance: db,
      exact_sha_attestation: tree,
    },
    effective_delivery_frontier_projection: STAGE === 'EXACT_MERGE_SHA'
      ? { effective_status: 'S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE', effective_next_slice: 'S2' }
      : { effective_status: 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE', effective_next_slice: null },
    effective_authority_projection: {
      bounded_replay_runner_authorized: STAGE === 'EXACT_MERGE_SHA',
      bounded_canonical_transaction_authorized: STAGE === 'EXACT_MERGE_SHA',
      production_runtime_source_authorized: false,
      public_http_writer_authorized: false,
      background_scheduler_authorized: false,
      live_ingestion_authorized: false,
      model_activation_authorized: false,
      mcft_cap_09_authorized: false,
    },
    retention_class: STAGE === 'EXACT_MERGE_SHA' ? 'R1_180_DAYS' : 'TRANSIENT_CANDIDATE',
  };
  artifact.semantic_artifact_digest = sha(artifact);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify(artifact));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
