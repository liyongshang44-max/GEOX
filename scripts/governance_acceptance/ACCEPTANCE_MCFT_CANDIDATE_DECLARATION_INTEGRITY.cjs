// Purpose: enforce exact-head candidate declaration integrity for MCFT-CAP-06 S9 after focused and standard CI complete.
// Boundary: repository delivery governance only; read-only GitHub metadata/content inspection, no Runtime, canonical, projection, migration or capability authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CANDIDATE_DECLARATION_INTEGRITY_RESULT.json');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');
const RULE_ID = 'MCFT_CAP_06_S9_CANDIDATE_DECLARATION_INTEGRITY_V1';
const DECLARATION_MARKER = 'MCFT_CANDIDATE_DECLARATION_V1';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json';
const AUTHORITY_GRAPH_PATH = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-AUTHORITY-GRAPH.json';
const IMPLEMENTATION_CONTRACT_PATH = 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-IMPLEMENTATION-CONTRACT.json';
const FOCUSED_WORKFLOW = 'mcft-cap-06-s9-non-consumption';
const STANDARD_CI_WORKFLOW = 'ci';
const REQUIRED_DECLARATION_KEYS = [
  'candidate_head',
  'authority_graph_blob',
  'implementation_contract_blob',
  'status_blob',
];

function writeResult(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function declarationMatches(body) {
  const source = String(body || '');
  const pattern = new RegExp(`<!--\\s*${DECLARATION_MARKER}\\s*\\n([\\s\\S]*?)-->`, 'gm');
  return [...source.matchAll(pattern)];
}

function hasDeclarationBlock(body) {
  return declarationMatches(body).length > 0;
}

function candidateDeclarationRequired(headCandidateImplemented, baseCandidateImplemented, declarationBlockPresent) {
  return headCandidateImplemented === true
    && (baseCandidateImplemented !== true || declarationBlockPresent === true);
}

function parseDeclaration(body) {
  const matches = declarationMatches(body);
  if (matches.length !== 1) throw new Error(`CANDIDATE_DECLARATION_BLOCK_CARDINALITY:${matches.length}`);
  const declaration = {};
  for (const rawLine of matches[0][1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`CANDIDATE_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.prototype.hasOwnProperty.call(declaration, key)) {
      throw new Error(`CANDIDATE_DECLARATION_DUPLICATE_KEY:${key}`);
    }
    declaration[key] = value;
  }
  const keys = Object.keys(declaration).sort();
  assert.deepEqual(keys, [...REQUIRED_DECLARATION_KEYS].sort(), 'CANDIDATE_DECLARATION_KEY_SET_INVALID');
  for (const key of REQUIRED_DECLARATION_KEYS) {
    if (!isSha(declaration[key])) throw new Error(`CANDIDATE_DECLARATION_SHA_INVALID:${key}`);
  }
  return declaration;
}

function policyRule(policy) {
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V1');
  assert.equal(policy.capability_slice, false);
  const rules = policy.candidate_declaration_integrity_rules;
  assert.ok(Array.isArray(rules), 'CANDIDATE_DECLARATION_RULES_REQUIRED');
  const matches = rules.filter((rule) => rule.rule_id === RULE_ID);
  assert.equal(matches.length, 1, 'S9_CANDIDATE_DECLARATION_RULE_CARDINALITY');
  const rule = matches[0];
  assert.equal(rule.applies_when.status_file, STATUS_PATH);
  assert.equal(rule.applies_when.field, 's9_candidate_implemented');
  assert.equal(rule.applies_when.equals, true);
  assert.deepEqual(rule.candidate_declaration_detected_by, [
    'HEAD_STATUS_FIELD_TRUE_AND_BASE_STATUS_FIELD_NOT_TRUE',
    'DECLARATION_MARKER_PRESENT',
  ]);
  assert.equal(rule.focused_workflow_name, FOCUSED_WORKFLOW);
  assert.equal(rule.standard_ci_workflow_name, STANDARD_CI_WORKFLOW);
  assert.deepEqual(rule.semantic_snapshot_files, [
    AUTHORITY_GRAPH_PATH,
    IMPLEMENTATION_CONTRACT_PATH,
    STATUS_PATH,
  ]);
  assert.deepEqual(rule.required_simultaneous_conditions, [
    'FOCUSED_RESULT_STATUS_PASS',
    'FOCUSED_RESULT_GIT_HEAD_EQUALS_CURRENT_PR_HEAD',
    'STANDARD_CI_STATUS_PASS',
    'PR_DECLARED_CANDIDATE_HEAD_EQUALS_CURRENT_PR_HEAD',
    'DECLARED_AUTHORITY_CONTRACT_STATUS_BLOBS_EQUAL_CURRENT_HEAD',
  ]);
  assert.equal(rule.failure_effect, 'CANDIDATE_INVALIDATED');
  return rule;
}

function selftest() {
  const policy = loadJson(POLICY_PATH);
  const rule = policyRule(policy);
  const declaration = parseDeclaration(`\n<!-- ${DECLARATION_MARKER}\ncandidate_head=${'1'.repeat(40)}\nauthority_graph_blob=${'2'.repeat(40)}\nimplementation_contract_blob=${'3'.repeat(40)}\nstatus_blob=${'4'.repeat(40)}\n-->\n`);
  assert.equal(declaration.candidate_head, '1'.repeat(40));
  assert.equal(candidateDeclarationRequired(false, false, false), false);
  assert.equal(candidateDeclarationRequired(true, false, false), true);
  assert.equal(candidateDeclarationRequired(true, true, false), false);
  assert.equal(candidateDeclarationRequired(true, true, true), true);
  assert.throws(() => parseDeclaration(''), /CANDIDATE_DECLARATION_BLOCK_CARDINALITY:0/);
  assert.throws(() => parseDeclaration(`<!-- ${DECLARATION_MARKER}\ncandidate_head=bad\n-->`), /CANDIDATE_DECLARATION_KEY_SET_INVALID/);
  assert.throws(() => parseDeclaration(`${`<!-- ${DECLARATION_MARKER}\ncandidate_head=${'1'.repeat(40)}\nauthority_graph_blob=${'2'.repeat(40)}\nimplementation_contract_blob=${'3'.repeat(40)}\nstatus_blob=${'4'.repeat(40)}\n-->`}\n${`<!-- ${DECLARATION_MARKER}\ncandidate_head=${'1'.repeat(40)}\nauthority_graph_blob=${'2'.repeat(40)}\nimplementation_contract_blob=${'3'.repeat(40)}\nstatus_blob=${'4'.repeat(40)}\n-->`}`), /CANDIDATE_DECLARATION_BLOCK_CARDINALITY:2/);
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
    status: 'PASS',
    mode: 'SELFTEST',
    policy_id: policy.policy_id,
    rule_id: rule.rule_id,
    declaration_marker: DECLARATION_MARKER,
    runtime_authority: false,
    capability_slice: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-candidate-declaration-integrity-v1',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function decodeContent(payload, code) {
  if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new Error(code);
  }
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function readRepositoryFile(repository, filePath, ref, token) {
  const payload = await apiJson(`/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`, token);
  return {
    blob_sha: payload.sha,
    text: decodeContent(payload, `REPOSITORY_FILE_INVALID:${filePath}`),
  };
}

async function resolvePullRequest(repository, event, headSha, token) {
  if (event.pull_request && event.pull_request.number) {
    return apiJson(`/repos/${repository}/pulls/${event.pull_request.number}`, token);
  }
  const associated = event.workflow_run && Array.isArray(event.workflow_run.pull_requests)
    ? event.workflow_run.pull_requests
    : [];
  if (associated.length === 1) {
    return apiJson(`/repos/${repository}/pulls/${associated[0].number}`, token);
  }
  if (associated.length > 1) {
    const resolved = await Promise.all(associated.map((item) => apiJson(`/repos/${repository}/pulls/${item.number}`, token)));
    const exact = resolved.filter((pull) => pull.head && pull.head.sha === headSha);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) throw new Error(`CANDIDATE_PR_CARDINALITY:${exact.length}`);
  }
  const pulls = await apiJson(`/repos/${repository}/commits/${headSha}/pulls`, token);
  const open = pulls.filter((pull) => pull.state === 'open' && pull.head && pull.head.sha === headSha);
  if (open.length === 0) return null;
  if (open.length !== 1) throw new Error(`CANDIDATE_PR_CARDINALITY:${open.length}`);
  return apiJson(`/repos/${repository}/pulls/${open[0].number}`, token);
}

function latestRun(workflowRuns, workflowName, pr) {
  return workflowRuns
    .filter((run) => run.name === workflowName
      && run.event === 'pull_request'
      && run.head_sha === pr.head.sha
      && run.head_branch === pr.head.ref)
    .sort((left, right) => Number(right.run_number) - Number(left.run_number))[0] || null;
}

async function waitForRequiredRuns(repository, pr, token) {
  const maxAttempts = Number(process.env.MCFT_CANDIDATE_GUARD_MAX_ATTEMPTS || 80);
  const intervalMs = Number(process.env.MCFT_CANDIDATE_GUARD_POLL_INTERVAL_MS || 15000);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const page = await apiJson(`/repos/${repository}/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`, token);
    const focused = latestRun(page.workflow_runs || [], FOCUSED_WORKFLOW, pr);
    const standard = latestRun(page.workflow_runs || [], STANDARD_CI_WORKFLOW, pr);
    const failed = [focused, standard].find((run) => run && run.status === 'completed' && run.conclusion !== 'success');
    if (failed) throw new Error(`REQUIRED_WORKFLOW_NOT_PASS:${failed.name}:${failed.id}:${failed.conclusion}`);
    if (focused && standard
      && focused.status === 'completed' && focused.conclusion === 'success'
      && standard.status === 'completed' && standard.conclusion === 'success') {
      return { focused, standard, attempt_count: attempt };
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error('REQUIRED_WORKFLOWS_NOT_COMPLETED');
}

async function enforce() {
  const policy = loadJson(POLICY_PATH);
  const rule = policyRule(policy);
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = loadJson(eventPath);
  const headSha = event.pull_request?.head?.sha || event.workflow_run?.head_sha;
  if (!isSha(headSha)) throw new Error('CURRENT_PR_HEAD_SHA_REQUIRED');
  const pr = await resolvePullRequest(repository, event, headSha, token);
  if (!pr) {
    const result = {
      schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
      status: 'PASS',
      mode: 'ENFORCE',
      disposition: 'NO_OPEN_PR_FOR_WORKFLOW_RUN',
      rule_id: rule.rule_id,
      head_sha: headSha,
    };
    writeResult(result);
    console.log(JSON.stringify(result));
    return;
  }
  if (pr.state !== 'open') {
    const result = {
      schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
      status: 'PASS',
      mode: 'ENFORCE',
      disposition: 'CLOSED_PR_NO_ENFORCEMENT',
      rule_id: rule.rule_id,
      pr_number: pr.number,
      head_sha: headSha,
    };
    writeResult(result);
    console.log(JSON.stringify(result));
    return;
  }
  if (pr.head.sha !== headSha) throw new Error('PR_HEAD_MOVED_DURING_GUARD');

  let statusFile;
  try {
    statusFile = await readRepositoryFile(repository, STATUS_PATH, headSha, token);
  } catch (error) {
    if (error && error.status === 404) {
      const result = {
        schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
        status: 'PASS',
        mode: 'ENFORCE',
        disposition: 'S9_STATUS_FILE_ABSENT',
        rule_id: rule.rule_id,
        pr_number: pr.number,
        head_sha: headSha,
      };
      writeResult(result);
      console.log(JSON.stringify(result));
      return;
    }
    throw error;
  }
  const status = JSON.parse(statusFile.text);
  if (status.s9_candidate_implemented !== true) {
    const result = {
      schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
      status: 'PASS',
      mode: 'ENFORCE',
      disposition: 'S9_CANDIDATE_NOT_DECLARED',
      rule_id: rule.rule_id,
      pr_number: pr.number,
      head_sha: headSha,
    };
    writeResult(result);
    console.log(JSON.stringify(result));
    return;
  }

  let baseCandidateImplemented = false;
  try {
    const baseStatusFile = await readRepositoryFile(repository, STATUS_PATH, pr.base.sha, token);
    baseCandidateImplemented = JSON.parse(baseStatusFile.text).s9_candidate_implemented === true;
  } catch (error) {
    if (!error || error.status !== 404) throw error;
  }
  const declarationBlockPresent = hasDeclarationBlock(pr.body || '');
  if (!candidateDeclarationRequired(true, baseCandidateImplemented, declarationBlockPresent)) {
    const result = {
      schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
      status: 'PASS',
      mode: 'ENFORCE',
      disposition: 'S9_CANDIDATE_TRUE_INHERITED_FROM_BASE',
      rule_id: rule.rule_id,
      pr_number: pr.number,
      head_sha: headSha,
      base_head_sha: pr.base.sha,
    };
    writeResult(result);
    console.log(JSON.stringify(result));
    return;
  }

  const declaration = parseDeclaration(pr.body || '');
  if (declaration.candidate_head !== headSha) throw new Error('PR_DECLARED_CANDIDATE_HEAD_MISMATCH');
  const [authority, contract] = await Promise.all([
    readRepositoryFile(repository, AUTHORITY_GRAPH_PATH, headSha, token),
    readRepositoryFile(repository, IMPLEMENTATION_CONTRACT_PATH, headSha, token),
  ]);
  if (declaration.authority_graph_blob !== authority.blob_sha) throw new Error('AUTHORITY_GRAPH_SEMANTIC_SNAPSHOT_MISMATCH');
  if (declaration.implementation_contract_blob !== contract.blob_sha) throw new Error('IMPLEMENTATION_CONTRACT_SEMANTIC_SNAPSHOT_MISMATCH');
  if (declaration.status_blob !== statusFile.blob_sha) throw new Error('STATUS_SEMANTIC_SNAPSHOT_MISMATCH');

  const runs = await waitForRequiredRuns(repository, pr, token);
  const currentPr = await apiJson(`/repos/${repository}/pulls/${pr.number}`, token);
  if (currentPr.head.sha !== headSha) throw new Error('PR_HEAD_MOVED_AFTER_WORKFLOW_PROOF');
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
    status: 'PASS',
    mode: 'ENFORCE',
    disposition: 'S9_CANDIDATE_DECLARATION_VALID',
    rule_id: rule.rule_id,
    pr_number: pr.number,
    head_sha: headSha,
    declared_candidate_head: declaration.candidate_head,
    focused_result: {
      status: 'PASS',
      workflow_name: runs.focused.name,
      workflow_run_id: runs.focused.id,
      git_head: runs.focused.head_sha,
    },
    standard_ci: {
      status: 'PASS',
      workflow_name: runs.standard.name,
      workflow_run_id: runs.standard.id,
      git_head: runs.standard.head_sha,
    },
    semantic_snapshot: {
      authority_graph_blob: authority.blob_sha,
      implementation_contract_blob: contract.blob_sha,
      status_blob: statusFile.blob_sha,
    },
    poll_attempt_count: runs.attempt_count,
    candidate_invalidated: false,
    capability_slice: false,
    runtime_authority: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
}

async function main() {
  const mode = process.argv[2] || '--selftest';
  if (mode === '--selftest') return selftest();
  if (mode === '--enforce') return enforce();
  throw new Error(`UNKNOWN_MODE:${mode}`);
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v1',
    status: 'FAIL',
    mode: process.argv[2] || '--selftest',
    error: error instanceof Error ? error.message : String(error),
    candidate_invalidated: true,
    failure_effect: 'CANDIDATE_INVALIDATED',
    capability_slice: false,
    runtime_authority: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});