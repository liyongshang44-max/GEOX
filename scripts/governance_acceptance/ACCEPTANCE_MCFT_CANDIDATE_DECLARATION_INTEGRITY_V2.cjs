#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json');
const RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2_RESULT.json');
const MODE = process.argv[2] || '--selftest';

function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeResult(value) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function isSha(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function deepEqual(left, right) {
  try { assert.deepEqual(left, right); return true; } catch { return false; }
}
function parseScalar(value) {
  const source = String(value).trim();
  try { return JSON.parse(source); } catch { return source; }
}
function getField(value, fieldPath) {
  return String(fieldPath).split('.').filter(Boolean).reduce((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
}
function declarationMatches(body, marker) {
  const pattern = new RegExp(`<!--\\s*${marker}\\s*\\n([\\s\\S]*?)-->`, 'gm');
  return [...String(body || '').matchAll(pattern)];
}
function parseDeclaration(body, policy) {
  const marker = policy.candidate_declaration.marker;
  const matches = declarationMatches(body, marker);
  if (matches.length !== 1) throw new Error(`CANDIDATE_DECLARATION_BLOCK_CARDINALITY:${matches.length}`);
  const declaration = {};
  for (const rawLine of matches[0][1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`CANDIDATE_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.hasOwn(declaration, key)) throw new Error(`CANDIDATE_DECLARATION_DUPLICATE_KEY:${key}`);
    declaration[key] = value;
  }
  assert.deepEqual(Object.keys(declaration).sort(), [...policy.candidate_declaration.required_fields].sort(), 'CANDIDATE_DECLARATION_KEY_SET_INVALID');
  if (!/^MCFT-CAP-[0-9]+$/.test(declaration.capability_line)) throw new Error('CANDIDATE_CAPABILITY_LINE_INVALID');
  if (!declaration.slice_id.startsWith(`${declaration.capability_line}.`)) throw new Error('CANDIDATE_SLICE_CAPABILITY_MISMATCH');
  if (!/^docs\/digital_twin\/mcft\/cap_[0-9]+\/.+\.json$/.test(declaration.status_file)) throw new Error('CANDIDATE_STATUS_FILE_INVALID');
  if (!/^[A-Za-z0-9_.-]+$/.test(declaration.candidate_field)) throw new Error('CANDIDATE_FIELD_INVALID');
  if (!/^[A-Za-z0-9_.-]+$/.test(declaration.focused_workflow)) throw new Error('CANDIDATE_FOCUSED_WORKFLOW_INVALID');
  if (!/^[A-Za-z0-9_.-]+$/.test(declaration.standard_workflow)) throw new Error('CANDIDATE_STANDARD_WORKFLOW_INVALID');
  if (!isSha(declaration.candidate_head)) throw new Error('CANDIDATE_HEAD_SHA_INVALID');
  if (!isSha(declaration.base_head)) throw new Error('CANDIDATE_BASE_SHA_INVALID');
  const semanticFiles = declaration.semantic_snapshot_files.split(',').map((item) => item.trim()).filter(Boolean);
  const semanticBlobs = declaration.semantic_snapshot_blobs.split(',').map((item) => item.trim()).filter(Boolean);
  if (semanticFiles.length < 1 || semanticFiles.length > 20) throw new Error(`CANDIDATE_SEMANTIC_FILE_COUNT_INVALID:${semanticFiles.length}`);
  if (semanticFiles.length !== semanticBlobs.length) throw new Error('CANDIDATE_SEMANTIC_PATH_BLOB_CARDINALITY_MISMATCH');
  if (new Set(semanticFiles).size !== semanticFiles.length) throw new Error('CANDIDATE_SEMANTIC_PATH_DUPLICATE');
  for (const file of semanticFiles) {
    if (!/^(docs|scripts|apps)\//.test(file) || file.includes('..')) throw new Error(`CANDIDATE_SEMANTIC_PATH_INVALID:${file}`);
  }
  for (const blob of semanticBlobs) if (!isSha(blob)) throw new Error(`CANDIDATE_SEMANTIC_BLOB_INVALID:${blob}`);
  if (!semanticFiles.includes(declaration.status_file)) throw new Error('CANDIDATE_STATUS_FILE_NOT_IN_SEMANTIC_SNAPSHOT');
  return {
    ...declaration,
    candidate_value_parsed: parseScalar(declaration.candidate_value),
    semantic_files: semanticFiles,
    semantic_blobs: semanticBlobs,
  };
}
function collectCandidateTransitions(base, head, policy, keyPath = [], output = []) {
  if (Array.isArray(head)) return output;
  if (!head || typeof head !== 'object') return output;
  const candidateStatuses = new Set(policy.candidate_declaration.candidate_transition_detection.candidate_status_values);
  const booleanKey = new RegExp(policy.candidate_declaration.candidate_transition_detection.boolean_key_regex, 'i');
  for (const [key, headValue] of Object.entries(head)) {
    const baseValue = base && typeof base === 'object' ? base[key] : undefined;
    const nextPath = [...keyPath, key];
    if (headValue === true && baseValue !== true && booleanKey.test(key)) {
      output.push({ field: nextPath.join('.'), base_value: baseValue, head_value: headValue, kind: 'BOOLEAN_CANDIDATE_TRANSITION' });
    }
    if (typeof headValue === 'string' && headValue !== baseValue && candidateStatuses.has(headValue)) {
      output.push({ field: nextPath.join('.'), base_value: baseValue, head_value: headValue, kind: 'CANDIDATE_STATUS_TRANSITION' });
    }
    if (headValue && typeof headValue === 'object' && !Array.isArray(headValue)) {
      collectCandidateTransitions(baseValue, headValue, policy, nextPath, output);
    }
  }
  return output;
}
function validatePolicy(policy) {
  assert.equal(policy.schema_version, 'geox_mcft_delivery_policy_v2');
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(policy.candidate_declaration.schema_version, 'geox_mcft_candidate_declaration_v2');
  assert.equal(policy.candidate_declaration.marker, 'MCFT_CANDIDATE_DECLARATION_V2');
  assert.equal(policy.candidate_declaration.applies_to, 'ANY_MCFT_CAPABILITY_LINE_OR_SLICE');
  assert.equal(policy.candidate_declaration.failure_effect, 'CANDIDATE_INVALIDATED');
  return policy;
}
async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-candidate-declaration-integrity-v2',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
function decodeContent(payload, code) {
  if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') throw new Error(code);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}
async function readRepositoryFile(repository, filePath, ref, token) {
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const payload = await apiJson(`/repos/${repository}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, token);
  return { blob_sha: payload.sha, text: decodeContent(payload, `REPOSITORY_FILE_INVALID:${filePath}`) };
}
async function readOptionalJson(repository, filePath, ref, token) {
  try {
    const file = await readRepositoryFile(repository, filePath, ref, token);
    return { ...file, json: JSON.parse(file.text) };
  } catch (error) {
    if (error && error.status === 404) return null;
    throw error;
  }
}
async function listPullFiles(repository, prNumber, token) {
  const output = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await apiJson(`/repos/${repository}/pulls/${prNumber}/files?per_page=100&page=${page}`, token);
    output.push(...batch);
    if (batch.length < 100) break;
  }
  return output;
}
async function detectUndeclaredTransitions(repository, pr, token, policy) {
  const regex = new RegExp(policy.candidate_declaration.candidate_transition_detection.path_scope_regex, 'i');
  const files = (await listPullFiles(repository, pr.number, token)).filter((file) => regex.test(file.filename));
  const transitions = [];
  for (const file of files) {
    if (!['added', 'modified', 'renamed'].includes(file.status)) continue;
    const head = await readOptionalJson(repository, file.filename, pr.head.sha, token);
    if (!head) continue;
    const basePath = file.previous_filename || file.filename;
    const base = await readOptionalJson(repository, basePath, pr.base.sha, token);
    for (const transition of collectCandidateTransitions(base?.json || {}, head.json, policy)) {
      transitions.push({ file: file.filename, ...transition });
    }
  }
  return transitions;
}
function latestRun(workflowRuns, workflowName, pr) {
  return workflowRuns
    .filter((run) => run.name === workflowName
      && run.event === 'pull_request'
      && run.head_sha === pr.head.sha
      && run.head_branch === pr.head.ref)
    .sort((left, right) => Number(right.run_number) - Number(left.run_number))[0] || null;
}
async function waitForRequiredRuns(repository, pr, declaration, token) {
  const maxAttempts = Number(process.env.MCFT_CANDIDATE_V2_MAX_ATTEMPTS || 240);
  const intervalMs = Number(process.env.MCFT_CANDIDATE_V2_POLL_INTERVAL_MS || 15000);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const page = await apiJson(`/repos/${repository}/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`, token);
    const focused = latestRun(page.workflow_runs || [], declaration.focused_workflow, pr);
    const standard = latestRun(page.workflow_runs || [], declaration.standard_workflow, pr);
    const failed = [focused, standard].find((run) => run && run.status === 'completed' && run.conclusion !== 'success');
    if (failed) throw new Error(`REQUIRED_WORKFLOW_NOT_PASS:${failed.name}:${failed.id}:${failed.conclusion}`);
    if (focused?.status === 'completed' && focused.conclusion === 'success'
      && standard?.status === 'completed' && standard.conclusion === 'success') {
      return { focused, standard, attempt_count: attempt };
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error('REQUIRED_WORKFLOWS_NOT_COMPLETED');
}
function selftest() {
  const policy = validatePolicy(loadJson(POLICY_PATH));
  const marker = policy.candidate_declaration.marker;
  const body = `<!-- ${marker}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.EXAMPLE-V1\nstatus_file=docs/digital_twin/mcft/cap_07/EXAMPLE-STATUS.json\ncandidate_field=candidate_implemented\ncandidate_value=true\nfocused_workflow=mcft-cap-07-example\nstandard_workflow=ci\nsemantic_snapshot_files=docs/digital_twin/mcft/cap_07/A.json,docs/digital_twin/mcft/cap_07/EXAMPLE-STATUS.json\nsemantic_snapshot_blobs=${'1'.repeat(40)},${'2'.repeat(40)}\ncandidate_head=${'3'.repeat(40)}\nbase_head=${'4'.repeat(40)}\n-->`;
  const declaration = parseDeclaration(body, policy);
  assert.equal(declaration.capability_line, 'MCFT-CAP-07');
  assert.equal(declaration.candidate_value_parsed, true);
  assert.equal(declaration.semantic_files.length, 2);
  assert.throws(() => parseDeclaration('', policy), /CARDINALITY:0/);
  const transitions = collectCandidateTransitions(
    { candidate_implemented: false, status: 'AUTHORIZED_NOT_STARTED' },
    { candidate_implemented: true, status: 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE' },
    policy,
  );
  assert.equal(transitions.length, 2);
  assert.equal(transitions.some((item) => item.field === 'candidate_implemented'), true);
  assert.equal(transitions.some((item) => item.field === 'status'), true);
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_v2_result_v1',
    status: 'PASS',
    mode: 'SELFTEST',
    policy_id: policy.policy_id,
    declaration_marker: marker,
    generic_capability_scope: true,
    transition_detector_count: transitions.length,
    capability_slice: false,
    runtime_authority: false,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
async function enforce() {
  const policy = validatePolicy(loadJson(POLICY_PATH));
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = loadJson(eventPath);
  if (!event.pull_request?.number) throw new Error('PULL_REQUEST_TARGET_EVENT_REQUIRED');
  const pr = await apiJson(`/repos/${repository}/pulls/${event.pull_request.number}`, token);
  if (pr.state !== 'open') {
    const result = { schema_version: 'geox_mcft_candidate_declaration_integrity_v2_result_v1', status: 'PASS', mode: 'ENFORCE', disposition: 'CLOSED_PR_NO_ENFORCEMENT', pr_number: pr.number };
    writeResult(result); process.stdout.write(`${JSON.stringify(result)}\n`); return;
  }
  const matches = declarationMatches(pr.body || '', policy.candidate_declaration.marker);
  const transitions = await detectUndeclaredTransitions(repository, pr, token, policy);
  if (matches.length === 0 && transitions.length === 0) {
    const result = {
      schema_version: 'geox_mcft_candidate_declaration_integrity_v2_result_v1',
      status: 'PASS', mode: 'ENFORCE', disposition: 'NO_MCFT_CANDIDATE_TRANSITION',
      pr_number: pr.number, head_sha: pr.head.sha, base_sha: pr.base.sha,
    };
    writeResult(result); process.stdout.write(`${JSON.stringify(result)}\n`); return;
  }
  if (matches.length === 0) throw new Error(`CANDIDATE_DECLARATION_REQUIRED:${JSON.stringify(transitions.slice(0, 10))}`);
  const declaration = parseDeclaration(pr.body || '', policy);
  if (declaration.candidate_head !== pr.head.sha) throw new Error('DECLARED_CANDIDATE_HEAD_MISMATCH');
  if (declaration.base_head !== pr.base.sha) throw new Error('DECLARED_BASE_HEAD_MISMATCH');
  const status = await readRepositoryFile(repository, declaration.status_file, pr.head.sha, token);
  const statusJson = JSON.parse(status.text);
  const actualValue = getField(statusJson, declaration.candidate_field);
  if (!deepEqual(actualValue, declaration.candidate_value_parsed)) throw new Error(`DECLARED_CANDIDATE_FIELD_VALUE_MISMATCH:${declaration.candidate_field}`);
  const semanticSnapshot = [];
  for (let index = 0; index < declaration.semantic_files.length; index += 1) {
    const file = await readRepositoryFile(repository, declaration.semantic_files[index], pr.head.sha, token);
    const expectedBlob = declaration.semantic_blobs[index];
    if (file.blob_sha !== expectedBlob) throw new Error(`SEMANTIC_SNAPSHOT_BLOB_MISMATCH:${declaration.semantic_files[index]}`);
    semanticSnapshot.push({ path: declaration.semantic_files[index], blob_sha: file.blob_sha });
  }
  if (status.blob_sha !== semanticSnapshot.find((item) => item.path === declaration.status_file)?.blob_sha) throw new Error('STATUS_BLOB_NOT_BOUND');
  const runs = await waitForRequiredRuns(repository, pr, declaration, token);
  const current = await apiJson(`/repos/${repository}/pulls/${pr.number}`, token);
  if (current.head.sha !== pr.head.sha) throw new Error('PR_HEAD_MOVED_AFTER_WORKFLOW_PROOF');
  if (current.base.sha !== pr.base.sha) throw new Error('PR_BASE_MOVED_AFTER_WORKFLOW_PROOF');
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_v2_result_v1',
    status: 'PASS', mode: 'ENFORCE', disposition: 'GENERIC_CANDIDATE_DECLARATION_VALID',
    policy_id: policy.policy_id, pr_number: pr.number,
    capability_line: declaration.capability_line, slice_id: declaration.slice_id,
    head_sha: pr.head.sha, base_sha: pr.base.sha,
    status_file: declaration.status_file, candidate_field: declaration.candidate_field,
    semantic_snapshot: semanticSnapshot,
    detected_candidate_transitions: transitions,
    focused_result: { workflow_name: runs.focused.name, workflow_run_id: runs.focused.id, git_head: runs.focused.head_sha, status: 'PASS' },
    standard_result: { workflow_name: runs.standard.name, workflow_run_id: runs.standard.id, git_head: runs.standard.head_sha, status: 'PASS' },
    poll_attempt_count: runs.attempt_count,
    candidate_invalidated: false, capability_slice: false, runtime_authority: false,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

(async () => {
  if (MODE === '--selftest') return selftest();
  if (MODE === '--enforce') return enforce();
  throw new Error(`UNKNOWN_MODE:${MODE}`);
})().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_v2_result_v1',
    status: 'FAIL', mode: MODE, error: error instanceof Error ? error.message : String(error),
    candidate_invalidated: true, failure_effect: 'CANDIDATE_INVALIDATED',
    capability_slice: false, runtime_authority: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});
