#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION_RESULT.json');
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json';
const IMPLEMENTATION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json';
const MARKER = 'MCFT_CANDIDATE_DECLARATION_V2';
const REQUIRED_FIELDS = [
  'capability_line',
  'slice_id',
  'status_file',
  'candidate_field',
  'candidate_value',
  'focused_workflow',
  'standard_workflow',
  'semantic_snapshot_files',
  'semantic_snapshot_blobs',
  'candidate_head',
  'base_head',
].sort();

function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function sha(value, code) {
  const text = String(value || '').trim();
  assert.match(text, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${text}^{commit}`);
}
function parseDeclaration(body) {
  const matches = [...String(body || '').matchAll(new RegExp(`<!--\\s*${MARKER}\\s*\\n([\\s\\S]*?)-->`, 'gm'))];
  assert.equal(matches.length, 1, `S3_CANDIDATE_DECLARATION_CARDINALITY:${matches.length}`);
  const value = {};
  for (const raw of matches[0][1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`S3_CANDIDATE_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const item = line.slice(separator + 1).trim();
    if (Object.hasOwn(value, key)) throw new Error(`S3_CANDIDATE_DECLARATION_DUPLICATE_KEY:${key}`);
    value[key] = item;
  }
  assert.deepEqual(Object.keys(value).sort(), REQUIRED_FIELDS, 'S3_CANDIDATE_DECLARATION_KEY_SET_INVALID');
  return value;
}
function gitJson(commit, relative) {
  return JSON.parse(git('show', `${commit}:${relative}`));
}
async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap08-s3-exact-sha-v1',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}
async function allReviews(repository, number, token) {
  const output = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await apiJson(`/repos/${repository}/pulls/${number}/reviews?per_page=100&page=${page}`, token);
    output.push(...batch);
    if (batch.length < 100) break;
  }
  return output;
}
function validIndependentReview(reviews, pull, candidateHead) {
  const latestByReviewer = new Map();
  for (const review of reviews) {
    const login = String(review.user?.login || '').toLowerCase();
    if (!login) continue;
    const current = latestByReviewer.get(login);
    const submitted = Date.parse(review.submitted_at || 0);
    const currentSubmitted = current ? Date.parse(current.submitted_at || 0) : -1;
    if (!current || submitted > currentSubmitted || (submitted === currentSubmitted && Number(review.id) > Number(current.id))) {
      latestByReviewer.set(login, review);
    }
  }
  const author = String(pull.user?.login || '').toLowerCase();
  const candidates = [...latestByReviewer.values()].filter((review) =>
    String(review.state || '').toUpperCase() === 'APPROVED'
    && review.commit_id === candidateHead
    && String(review.user?.login || '').toLowerCase() !== author
    && String(review.user?.type || '') === 'User'
    && !String(review.user?.login || '').endsWith('[bot]'));
  assert.equal(candidates.length, 1, `S3_INDEPENDENT_EXACT_HEAD_APPROVAL_CARDINALITY:${candidates.length}`);
  const review = candidates[0];
  return {
    review_id: review.id,
    reviewer_login: review.user.login,
    reviewer_type: review.user.type,
    reviewer_author_association: review.author_association || null,
    review_state: review.state,
    review_commit_sha: review.commit_id,
    submitted_at: review.submitted_at,
    candidate_author_login: pull.user.login,
    reviewer_is_candidate_author: false,
  };
}

(async () => {
  try {
    const token = String(process.env.GITHUB_TOKEN || '').trim();
    const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
    const subject = sha(process.env.MCFT_SUBJECT_SHA, 'S3_SUBJECT_SHA_INVALID');
    assert.ok(token, 'S3_GITHUB_TOKEN_REQUIRED');
    assert.match(repository, /^[^/]+\/[^/]+$/, 'S3_GITHUB_REPOSITORY_INVALID');
    assert.equal(git('rev-parse', 'HEAD'), subject, 'S3_CHECKOUT_SUBJECT_MISMATCH');

    const parentLine = git('rev-list', '--parents', '-n', '1', subject).split(/\s+/);
    assert.equal(parentLine.length, 3, `S3_TWO_PARENT_MERGE_REQUIRED:${parentLine.length - 1}`);
    const [, firstParent, secondParent] = parentLine;
    const associated = await apiJson(`/repos/${repository}/commits/${subject}/pulls`, token);
    const merged = associated.filter((pull) =>
      pull.merged_at
      && pull.merge_commit_sha === subject
      && pull.base?.ref === 'main');
    assert.equal(merged.length, 1, `S3_MERGED_PULL_CARDINALITY:${merged.length}`);
    const pull = await apiJson(`/repos/${repository}/pulls/${merged[0].number}`, token);
    const candidateHead = sha(pull.head?.sha, 'S3_PULL_CANDIDATE_HEAD_INVALID');
    const baseHead = sha(pull.base?.sha, 'S3_PULL_BASE_HEAD_INVALID');
    assert.equal(firstParent, baseHead, 'S3_MERGE_FIRST_PARENT_NOT_BASE');
    assert.equal(secondParent, candidateHead, 'S3_MERGE_SECOND_PARENT_NOT_CANDIDATE');

    const candidateTree = git('rev-parse', `${candidateHead}^{tree}`);
    const mergeTree = git('rev-parse', `${subject}^{tree}`);
    assert.equal(mergeTree, candidateTree, 'S3_CANDIDATE_MERGE_TREE_MISMATCH');
    assert.equal(git('diff', '--name-only', candidateHead, subject), '', 'S3_CANDIDATE_TO_MERGE_FILE_DELTA');

    const declaration = parseDeclaration(pull.body);
    assert.equal(declaration.capability_line, 'MCFT-CAP-08');
    assert.equal(declaration.slice_id, 'MCFT-CAP-08.S3');
    assert.equal(declaration.status_file, STATUS);
    assert.equal(declaration.candidate_field, 's3_candidate_implemented');
    assert.equal(declaration.candidate_value, 'true');
    assert.equal(declaration.focused_workflow, 'mcft-cap-08-s3-decision-action-feedback');
    assert.equal(declaration.standard_workflow, 'ci');
    assert.equal(declaration.candidate_head, candidateHead);
    assert.equal(declaration.base_head, baseHead);
    const semanticFiles = declaration.semantic_snapshot_files.split(',').map((item) => item.trim()).filter(Boolean);
    const semanticBlobs = declaration.semantic_snapshot_blobs.split(',').map((item) => item.trim()).filter(Boolean);
    assert.deepEqual(semanticFiles, [STATUS, IMPLEMENTATION, BOUNDARY]);
    assert.equal(semanticBlobs.length, semanticFiles.length);
    for (let index = 0; index < semanticFiles.length; index += 1) {
      assert.equal(semanticBlobs[index], git('rev-parse', `${candidateHead}:${semanticFiles[index]}`), `S3_DECLARED_BLOB_MISMATCH:${semanticFiles[index]}`);
    }

    const status = gitJson(candidateHead, STATUS);
    const implementation = gitJson(candidateHead, IMPLEMENTATION);
    const boundary = gitJson(candidateHead, BOUNDARY);
    assert.equal(status.s3_candidate_implemented, true);
    assert.equal(status.independent_review_required, true);
    assert.equal(status.independent_review_satisfied, false);
    assert.equal(status.independent_review_waived, false);
    assert.equal(status.s3_effective, false);
    assert.equal(implementation.independent_review_required, true);
    assert.equal(implementation.independent_review_satisfied, false);
    assert.equal(implementation.independent_review_waived, false);
    assert.equal(boundary.base_sha, baseHead);
    assert.equal(boundary.record_status, 'FORMAL_S3_CANDIDATE_CHANGED_FILE_BOUNDARY_FROZEN');

    const reviews = await allReviews(repository, pull.number, token);
    const independentReview = validIndependentReview(reviews, pull, candidateHead);
    const result = {
      schema_version: 'geox_mcft_cap08_s3_exact_sha_attestation_result_v1',
      status: 'PASS',
      subject_sha: subject,
      merge_commit_sha: subject,
      base_head_sha: baseHead,
      candidate_head_sha: candidateHead,
      candidate_tree_sha: candidateTree,
      merge_tree_sha: mergeTree,
      attested_tree_sha: mergeTree,
      candidate_to_merge_tree_delta: 0,
      pull_request_number: pull.number,
      declaration_marker: MARKER,
      declaration,
      semantic_snapshot_files: semanticFiles,
      semantic_snapshot_blobs: semanticBlobs,
      independent_review_required: true,
      independent_review_satisfied: true,
      independent_review_waived: false,
      review_commit_sha: independentReview.review_commit_sha,
      independent_review: independentReview,
      production_runtime_source_authorized: false,
      s3_effective_projection_authorized: true,
      s4_effective_next_slice_projection_authorized: true,
      mcft_cap_09_authorized: false,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: 'geox_mcft_cap08_s3_exact_sha_attestation_result_v1',
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(error);
    process.exitCode = 1;
  }
})();
