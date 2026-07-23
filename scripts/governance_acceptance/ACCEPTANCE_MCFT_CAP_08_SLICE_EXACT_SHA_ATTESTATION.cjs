#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_SLICE_EXACT_SHA_ATTESTATION_RESULT.json');
const MARKER = 'MCFT_CANDIDATE_DECLARATION_V2';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json';

function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function canonicalSha(value, label) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(raw)) throw new Error(`${label}_INVALID:${raw}`);
  return git('rev-parse', `${raw}^{commit}`);
}
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); }
function parseMarker(body) {
  const escaped = MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body || '').match(new RegExp(`<!--\\s*${escaped}\\s*\\n([\\s\\S]*?)-->`));
  if (!match) throw new Error('MCFT_CANDIDATE_DECLARATION_V2_MISSING');
  const record = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf('=');
    if (at < 1) throw new Error(`DECLARATION_LINE_INVALID:${line}`);
    record[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return record;
}
async function api(apiPath) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap08-slice-attestation-v1',
    },
  });
  if (!response.ok) throw new Error(`GITHUB_API:${response.status}:${apiPath}:${(await response.text()).slice(0, 300)}`);
  return response.json();
}
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }

async function main() {
  const subject = canonicalSha(process.env.MCFT_SUBJECT_SHA, 'MCFT_SUBJECT_SHA');
  assert.equal(git('rev-parse', 'HEAD'), subject, 'EXACT_SUBJECT_NOT_CHECKED_OUT');
  const parentTokens = git('rev-list', '--parents', '-n', '1', subject).split(/\s+/);
  assert.equal(parentTokens.length, 3, 'PROTECTED_TWO_PARENT_MERGE_REQUIRED');
  const baseHead = canonicalSha(parentTokens[1], 'BASE_PARENT');
  const candidateHead = canonicalSha(parentTokens[2], 'CANDIDATE_PARENT');
  const candidateTree = git('rev-parse', `${candidateHead}^{tree}`);
  const mergeTree = git('rev-parse', `${subject}^{tree}`);
  assert.equal(candidateTree, mergeTree, 'CANDIDATE_MERGE_TREE_DELTA_NONZERO');

  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY_INVALID');
  const pulls = await api(`/repos/${repository}/commits/${subject}/pulls`);
  const merged = pulls.filter((pull) => pull.merge_commit_sha === subject && pull.merged_at);
  assert.equal(merged.length, 1, 'EXACT_MERGED_PR_CARDINALITY');
  const pr = merged[0];
  assert.equal(canonicalSha(pr.head.sha, 'PR_HEAD'), candidateHead, 'PR_HEAD_PARENT_MISMATCH');
  assert.equal(canonicalSha(pr.base.sha, 'PR_BASE'), baseHead, 'PR_BASE_PARENT_MISMATCH');
  const declaration = parseMarker(pr.body);
  assert.equal(declaration.capability_line, 'MCFT-CAP-08');
  assert.equal(declaration.slice_id, 'MCFT-CAP-08.S1');
  assert.equal(declaration.status_file, STATUS_PATH);
  assert.equal(declaration.candidate_field, 's1_candidate_implemented');
  assert.equal(declaration.candidate_value, 'true');
  assert.equal(declaration.focused_workflow, 'mcft-cap-08-s1-base-runtime');
  assert.equal(declaration.standard_workflow, 'ci');
  assert.equal(canonicalSha(declaration.candidate_head, 'DECLARATION_HEAD'), candidateHead);
  assert.equal(canonicalSha(declaration.base_head, 'DECLARATION_BASE'), baseHead);

  const runs = await api(`/repos/${repository}/actions/runs?head_sha=${candidateHead}&event=pull_request&per_page=100`);
  const successful = (name) => runs.workflow_runs.filter((run) => run.name === name && run.head_sha === candidateHead && run.conclusion === 'success');
  assert.equal(successful('mcft-cap-08-s1-base-runtime').length, 1, 'FOCUSED_WORKFLOW_SUCCESS_CARDINALITY');
  assert.equal(successful('ci').length, 1, 'STANDARD_WORKFLOW_SUCCESS_CARDINALITY');

  const status = readJson(STATUS_PATH);
  assert.equal(status.s1_candidate_implemented, true);
  assert.equal(status.effectiveness_condition, 'PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS');
  assert.equal(status.effective_status_when_attested, 'S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE');
  assert.equal(status.effective_next_slice_when_attested, 'S2');
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.final_formal_closure_executed, false);

  const result = {
    schema_version: 'geox_mcft_cap08_slice_exact_sha_attestation_result_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S1',
    subject_sha: subject,
    subject_commit: subject,
    base_head_sha: baseHead,
    candidate_head_sha: candidateHead,
    candidate_tree_sha: candidateTree,
    merge_commit_sha: subject,
    merge_tree_sha: mergeTree,
    candidate_to_merge_tree_delta: 0,
    attested_tree_sha: mergeTree,
    pr_number: pr.number,
    focused_workflow_run_id: successful('mcft-cap-08-s1-base-runtime')[0].id,
    standard_workflow_run_id: successful('ci')[0].id,
    effective_delivery_frontier_projection: {
      effective_status: 'S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE',
      effective_next_slice: 'S2',
    },
    effective_authority_projection: {
      bounded_replay_runner_authorized: true,
      bounded_canonical_transaction_authorized: true,
      production_runtime_source_authorized: false,
      public_http_writer_authorized: false,
      background_scheduler_authorized: false,
      live_ingestion_authorized: false,
      model_activation_authorized: false,
      mcft_cap_09_authorized: false,
    },
  };
  write(result);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  const result = { schema_version: 'geox_mcft_cap08_slice_exact_sha_attestation_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(result.error);
  process.exitCode = 1;
});
