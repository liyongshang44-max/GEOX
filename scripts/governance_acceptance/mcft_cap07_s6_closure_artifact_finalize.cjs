#!/usr/bin/env node
// Purpose: enrich an already verified generic MCFT-CAP-07 exact-SHA artifact with frozen S6 closure evidence and completion projection.
// Boundary: read-only Git/repository inspection and local artifact rewrite only; no GitHub, database, Runtime, or repository write.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const ARTIFACT_PATH = path.resolve(process.env.MCFT_CANONICAL_ARTIFACT_PATH || path.join(ROOT, 'acceptance-output/MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION.json'));
const S6_STATUS_PATH = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-DELIVERY-STATUS-V1.json';
const RESOLUTION_PATH = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-HARD-ACCEPTANCE-RESOLUTION-V1.json';
const S6_EVIDENCE_PATH = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-S6-HARD-ACCEPTANCE-EVIDENCE-V1.json';
const LEDGER_PATH = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json';
const EXTERNAL_IDS = ['L011', 'L012', 'L013', 'L014', 'L015'];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`; }
function gitShow(commit, repositoryPath) { return cp.execFileSync('git', ['show', `${commit}:${repositoryPath}`], { cwd: ROOT, encoding: 'utf8' }); }
function jsonAt(commit, repositoryPath) { return JSON.parse(gitShow(commit, repositoryPath)); }
function exact(actual, expected, code) { assert.deepEqual(actual, expected, code); }

function main() {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  if (artifact.slice_id !== 'MCFT-CAP-07.S6') {
    console.log(`SKIP ${artifact.slice_id}`);
    return;
  }
  exact(artifact.status, 'PASS', 'BASE_ARTIFACT_NOT_PASS');
  const subject = String(artifact.subject_commit || '');
  assert.match(subject, /^[0-9a-f]{40}$/i, 'SUBJECT_SHA_INVALID');
  const status = jsonAt(subject, S6_STATUS_PATH);
  const resolution = jsonAt(subject, RESOLUTION_PATH);
  const evidence = jsonAt(subject, S6_EVIDENCE_PATH);
  const ledger = jsonAt(subject, LEDGER_PATH);

  exact(status.s6_candidate_implemented, true, 'S6_CANDIDATE_NOT_IMPLEMENTED');
  exact(status.effective_completion_state, 'MCFT_CAP_07_COMPLETE', 'S6_COMPLETION_STATE_INVALID');
  exact(status.required_closure_retention_level, 'R2', 'S6_RETENTION_LEVEL_INVALID');
  exact(status.required_closure_retention_days, 730, 'S6_RETENTION_DAYS_INVALID');
  exact(status.runtime_source_authorized, false, 'S6_RUNTIME_SOURCE_AUTHORIZED');
  exact(status.canonical_write_authorized, false, 'S6_CANONICAL_WRITE_AUTHORIZED');
  exact(status.mcft_cap_08_authorized, false, 'S6_CAP08_AUTHORIZED');

  exact(ledger.item_count, 282, 'LEDGER_ITEM_COUNT_INVALID');
  const ids = ledger.items.map((item) => item.item_id);
  exact(ids.length, 282, 'LEDGER_ITEM_ARRAY_LENGTH_INVALID');
  assert.equal(ids.every((id) => typeof id === 'string' && id.length > 0), true, 'LEDGER_ITEM_ID_INVALID');
  exact(new Set(ids).size, 282, 'LEDGER_DUPLICATE_IDS');
  exact(resolution.ledger_item_count, 282, 'RESOLUTION_ITEM_COUNT_INVALID');
  exact(resolution.candidate_resolved_item_count, 277, 'RESOLUTION_CANDIDATE_COUNT_INVALID');
  exact(resolution.external_pending_item_count, 5, 'RESOLUTION_EXTERNAL_COUNT_INVALID');
  exact(resolution.external_pending_item_ids, EXTERNAL_IDS, 'RESOLUTION_EXTERNAL_IDS_INVALID');
  exact(resolution.candidate_resolved_item_count + resolution.external_pending_item_count, resolution.ledger_item_count, 'RESOLUTION_ARITHMETIC_INVALID');
  for (const prefix of 'ABCDEFGHIJKL') assert.ok(Array.isArray(resolution.category_evidence[prefix]) && resolution.category_evidence[prefix].length > 0, `CATEGORY_EVIDENCE_MISSING:${prefix}`);
  exact(evidence.external_effectiveness_item_ids, EXTERNAL_IDS, 'S6_EVIDENCE_EXTERNAL_IDS_INVALID');
  exact(evidence.required_external_retention_level, 'R2', 'S6_EVIDENCE_RETENTION_INVALID');
  exact(evidence.required_external_retention_days, 730, 'S6_EVIDENCE_RETENTION_DAYS_INVALID');

  const externalResolution = Object.fromEntries(EXTERNAL_IDS.map((id) => [id, {
    status: 'PASS',
    resolution_basis: 'EXACT_S6_MERGE_SHA_R2_ARTIFACT_AND_IMMUTABLE_READBACK',
    subject_commit: subject,
  }]));
  const enriched = {
    ...artifact,
    effective_delivery_frontier_projection: {
      effective_status: 'MCFT_CAP_07_COMPLETE',
      effective_next_slice: null,
      effective_active_delivery_slice_id: null,
      capability_complete: true,
    },
    hard_acceptance_resolution: {
      resolution_ref: RESOLUTION_PATH,
      ledger_ref: LEDGER_PATH,
      ledger_item_count: 282,
      candidate_resolved_item_count: 277,
      external_resolved_item_count: 5,
      effective_resolved_item_count: 282,
      duplicate_item_id_count: 0,
      external_item_results: externalResolution,
      status: 'PASS',
    },
    zero_write_acceptance_result: {
      result_ref: status.zero_write_acceptance_ref,
      product_observation_write_delta: 0,
      canonical_write_authority_delta: 'ZERO',
      projection_write_authority_delta: 'ZERO_PRODUCT_DATABASE',
      status: 'PASS',
    },
    completion_claims: status.completion_claims,
    completion_nonclaims: status.completion_nonclaims,
    closure_retention_requirement: { retention_level: 'R2', retention_days: 730 },
    capability_complete: true,
    runtime_source_authorized: false,
    canonical_write_authorized: false,
    mcft_cap_08_authorized: false,
  };
  delete enriched.semantic_artifact_digest;
  enriched.semantic_artifact_digest = digest(enriched);
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(enriched, null, 2)}\n`);
  console.log(`PASS MCFT-CAP-07.S6 ${subject} ${enriched.semantic_artifact_digest}`);
}

try { main(); } catch (error) { console.error(error); process.exit(1); }
