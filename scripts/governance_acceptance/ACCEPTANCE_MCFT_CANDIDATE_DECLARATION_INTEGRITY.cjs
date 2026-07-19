// Purpose: enforce declarative exact-head candidate integrity for any configured MCFT capability slice.
// Boundary: read-only delivery governance; no Runtime, canonical, projection, migration, activation or capability authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CANDIDATE_DECLARATION_INTEGRITY_RESULT.json');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json');

function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function valueAt(object, dottedPath) {
  return String(dottedPath).split('.').reduce((value, key) => (
    value && typeof value === 'object' ? value[key] : undefined
  ), object);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function declarationMatches(body, marker) {
  const source = String(body || '');
  const pattern = new RegExp(`<!--\\s*${marker}\\s*\\n([\\s\\S]*?)-->`, 'gm');
  return [...source.matchAll(pattern)].map((match) => {
    try {
      return JSON.parse(match[1].trim());
    } catch (error) {
      throw new Error(`CANDIDATE_DECLARATION_JSON_INVALID:${error.message}`);
    }
  });
}

function validateRuleShape(policy, rule) {
  for (const field of policy.candidate_declaration_contract.required_rule_fields) {
    assert.ok(Object.hasOwn(rule, field), `CANDIDATE_RULE_FIELD_MISSING:${rule.rule_id || 'UNKNOWN'}:${field}`);
  }
  assert.equal(typeof rule.rule_id, 'string');
  assert.equal(typeof rule.capability_line, 'string');
  assert.equal(typeof rule.slice_id, 'string');
  assert.equal(typeof rule.status_file, 'string');
  assert.equal(typeof rule.candidate_field, 'string');
  assert.equal(typeof rule.focused_workflow, 'string');
  assert.equal(typeof rule.standard_workflow, 'string');
  assert.ok(Array.isArray(rule.semantic_snapshot_files) && rule.semantic_snapshot_files.length > 0);
  assert.equal(new Set(rule.semantic_snapshot_files).size, rule.semantic_snapshot_files.length);
  assert.equal(rule.capability_slice, false);
  assert.equal(rule.runtime_authority, false);
}

function policyRules(policy) {
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V1');
  assert.equal(policy.policy_revision, '1.1.0');
  assert.equal(policy.enforcement_mode, 'CURRENT_CANDIDATE_HEAD');
  assert.equal(policy.capability_slice, false);
  assert.equal(policy.runtime_authority, false);
  const rules = policy.candidate_declaration_integrity_rules;
  assert.ok(Array.isArray(rules) && rules.length > 0, 'CANDIDATE_RULES_REQUIRED');
  const ids = new Set();
  for (const rule of rules) {
    validateRuleShape(policy, rule);
    assert.equal(ids.has(rule.rule_id), false, `CANDIDATE_RULE_DUPLICATE:${rule.rule_id}`);
    ids.add(rule.rule_id);
  }
  return rules;
}

function validateDeclaration(policy, rule, declaration) {
  const required = [...policy.candidate_declaration_contract.required_fields].sort();
  assert.deepEqual(Object.keys(declaration).sort(), required, `DECLARATION_KEY_SET_INVALID:${rule.rule_id}`);
  assert.equal(declaration.rule_id, rule.rule_id, `DECLARATION_RULE_ID_MISMATCH:${rule.rule_id}`);
  assert.equal(declaration.capability_line, rule.capability_line, `DECLARATION_CAPABILITY_LINE_MISMATCH:${rule.rule_id}`);
  assert.equal(declaration.slice_id, rule.slice_id, `DECLARATION_SLICE_ID_MISMATCH:${rule.rule_id}`);
  assert.equal(isSha(declaration.candidate_head), true, `DECLARATION_HEAD_SHA_INVALID:${rule.rule_id}`);
  assert.ok(declaration.semantic_snapshot_blobs && typeof declaration.semantic_snapshot_blobs === 'object' && !Array.isArray(declaration.semantic_snapshot_blobs));
  assert.deepEqual(Object.keys(declaration.semantic_snapshot_blobs).sort(), [...rule.semantic_snapshot_files].sort(), `DECLARATION_SNAPSHOT_PATH_SET_INVALID:${rule.rule_id}`);
  for (const [filePath, blob] of Object.entries(declaration.semantic_snapshot_blobs)) {
    assert.equal(isSha(blob), true, `DECLARATION_SNAPSHOT_SHA_INVALID:${rule.rule_id}:${filePath}`);
  }
}

function selftest() {
  const policy = loadJson(POLICY_PATH);
  const rules = policyRules(policy);
  const marker = policy.candidate_declaration_contract.declaration_marker;
  const rule = rules[0];
  const snapshots = Object.fromEntries(rule.semantic_snapshot_files.map((filePath, index) => [filePath, String(index + 1).repeat(40).slice(0, 40)]));
  const declaration = {
    rule_id: rule.rule_id,
    capability_line: rule.capability_line,
    slice_id: rule.slice_id,
    candidate_head: 'a'.repeat(40),
    semantic_snapshot_blobs: snapshots,
  };
  const parsed = declarationMatches(`<!-- ${marker}\n${JSON.stringify(declaration)}\n-->`, marker);
  assert.equal(parsed.length, 1);
  validateDeclaration(policy, rule, parsed[0]);
  assert.equal(sameValue(valueAt({ a: { b: true } }, 'a.b'), true), true);
  assert.equal(sameValue(valueAt({ a: { b: false } }, 'a.b'), true), false);
  assert.throws(() => declarationMatches(`<!-- ${marker}\nnot-json\n-->`, marker), /CANDIDATE_DECLARATION_JSON_INVALID/);
  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v2',
    status: 'PASS',
    mode: 'SELFTEST',
    policy_id: policy.policy_id,
    policy_revision: policy.policy_revision,
    rule_count: rules.length,
    generic_rule_dispatch: true,
    fixed_slice_constants: false,
    declaration_marker: marker,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
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
      'User-Agent': 'geox-mcft-candidate-declaration-integrity-v2',
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
  if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') throw new Error(code);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function readRepositoryFile(repository, filePath, ref, token) {
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const payload = await apiJson(`/repos/${repository}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, token);
  return {
    blob_sha: payload.sha,
    text: decodeContent(payload, `REPOSITORY_FILE_INVALID:${filePath}`),
  };
}

function latestRun(runs, workflowName, pr) {
  return runs
    .filter((run) => run.name === workflowName && run.event === 'pull_request' && run.head_sha === pr.head.sha && run.head_branch === pr.head.ref)
    .sort((left, right) => Number(right.run_number) - Number(left.run_number))[0] || null;
}

async function waitForRequiredRuns(repository, pr, rule, token) {
  const maxAttempts = Number(process.env.MCFT_CANDIDATE_GUARD_MAX_ATTEMPTS || 80);
  const intervalMs = Number(process.env.MCFT_CANDIDATE_GUARD_POLL_INTERVAL_MS || 15000);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const page = await apiJson(`/repos/${repository}/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`, token);
    const focused = latestRun(page.workflow_runs || [], rule.focused_workflow, pr);
    const standard = latestRun(page.workflow_runs || [], rule.standard_workflow, pr);
    const failed = [focused, standard].find((run) => run && run.status === 'completed' && run.conclusion !== 'success');
    if (failed) throw new Error(`REQUIRED_WORKFLOW_NOT_PASS:${rule.rule_id}:${failed.name}:${failed.id}:${failed.conclusion}`);
    if (focused?.status === 'completed' && focused.conclusion === 'success' && standard?.status === 'completed' && standard.conclusion === 'success') {
      return { focused, standard, attempt_count: attempt };
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error(`REQUIRED_WORKFLOWS_NOT_COMPLETED:${rule.rule_id}`);
}

async function optionalFile(repository, filePath, ref, token) {
  try {
    return await readRepositoryFile(repository, filePath, ref, token);
  } catch (error) {
    if (error && error.status === 404) return null;
    throw error;
  }
}

async function enforce() {
  const policy = loadJson(POLICY_PATH);
  const rules = policyRules(policy);
  const marker = policy.candidate_declaration_contract.declaration_marker;
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = loadJson(eventPath);
  const pr = event.pull_request;
  if (!pr || pr.state !== 'open') throw new Error('OPEN_PULL_REQUEST_EVENT_REQUIRED');
  const headSha = pr.head?.sha;
  if (!isSha(headSha)) throw new Error('CURRENT_PR_HEAD_SHA_REQUIRED');
  const declarations = declarationMatches(pr.body || '', marker);
  const declarationByRule = new Map();
  for (const declaration of declarations) {
    if (!declaration || typeof declaration.rule_id !== 'string') throw new Error('DECLARATION_RULE_ID_REQUIRED');
    if (declarationByRule.has(declaration.rule_id)) throw new Error(`DECLARATION_RULE_DUPLICATE:${declaration.rule_id}`);
    declarationByRule.set(declaration.rule_id, declaration);
  }
  const knownRuleIds = new Set(rules.map((rule) => rule.rule_id));
  for (const ruleId of declarationByRule.keys()) assert.equal(knownRuleIds.has(ruleId), true, `DECLARATION_UNKNOWN_RULE:${ruleId}`);

  const ruleResults = [];
  for (const rule of rules) {
    const headStatusFile = await optionalFile(repository, rule.status_file, headSha, token);
    if (!headStatusFile) {
      ruleResults.push({ rule_id: rule.rule_id, disposition: 'STATUS_FILE_ABSENT' });
      continue;
    }
    const headStatus = JSON.parse(headStatusFile.text);
    const headCandidate = sameValue(valueAt(headStatus, rule.candidate_field), rule.candidate_equals);
    if (!headCandidate) {
      ruleResults.push({ rule_id: rule.rule_id, disposition: 'CANDIDATE_FIELD_NOT_ACTIVE' });
      continue;
    }
    const baseStatusFile = await optionalFile(repository, rule.status_file, pr.base.sha, token);
    const baseCandidate = baseStatusFile
      ? sameValue(valueAt(JSON.parse(baseStatusFile.text), rule.candidate_field), rule.candidate_equals)
      : false;
    const declaration = declarationByRule.get(rule.rule_id);
    const declarationRequired = !baseCandidate || Boolean(declaration);
    if (!declarationRequired) {
      ruleResults.push({ rule_id: rule.rule_id, disposition: 'CANDIDATE_INHERITED_FROM_BASE' });
      continue;
    }
    if (!declaration) throw new Error(`CANDIDATE_DECLARATION_REQUIRED:${rule.rule_id}`);
    validateDeclaration(policy, rule, declaration);
    assert.equal(declaration.candidate_head, headSha, `DECLARED_CANDIDATE_HEAD_MISMATCH:${rule.rule_id}`);
    const snapshot = {};
    for (const filePath of rule.semantic_snapshot_files) {
      const file = await readRepositoryFile(repository, filePath, headSha, token);
      assert.equal(declaration.semantic_snapshot_blobs[filePath], file.blob_sha, `SEMANTIC_SNAPSHOT_MISMATCH:${rule.rule_id}:${filePath}`);
      snapshot[filePath] = file.blob_sha;
    }
    const runs = await waitForRequiredRuns(repository, pr, rule, token);
    const currentPr = await apiJson(`/repos/${repository}/pulls/${pr.number}`, token);
    assert.equal(currentPr.head.sha, headSha, `PR_HEAD_MOVED_AFTER_PROOF:${rule.rule_id}`);
    ruleResults.push({
      rule_id: rule.rule_id,
      disposition: 'CANDIDATE_DECLARATION_VALID',
      focused_workflow: { name: runs.focused.name, run_id: runs.focused.id, head_sha: runs.focused.head_sha },
      standard_workflow: { name: runs.standard.name, run_id: runs.standard.id, head_sha: runs.standard.head_sha },
      semantic_snapshot_blobs: snapshot,
      poll_attempt_count: runs.attempt_count,
    });
  }

  const result = {
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v2',
    status: 'PASS',
    mode: 'ENFORCE',
    policy_id: policy.policy_id,
    policy_revision: policy.policy_revision,
    pr_number: pr.number,
    head_sha: headSha,
    rule_results: ruleResults,
    generic_rule_dispatch: true,
    fixed_slice_constants: false,
    candidate_invalidated: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
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
    schema_version: 'geox_mcft_candidate_declaration_integrity_result_v2',
    status: 'FAIL',
    mode: process.argv[2] || '--selftest',
    error: error instanceof Error ? error.message : String(error),
    candidate_invalidated: true,
    failure_effect: 'CANDIDATE_INVALIDATED',
    generic_rule_dispatch: true,
    fixed_slice_constants: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
