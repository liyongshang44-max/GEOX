#!/usr/bin/env node
// Purpose: derive the effective MCFT-CAP-07 delivery frontier from one exact main merge SHA without repository writeback.
// Boundary: read-only Git/GitHub/repository inspection and immutable artifact generation only; governance remediation never creates a second candidate transition.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION.json');
const SELFTEST_OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION_SELFTEST.json');
const MODE = process.argv[2] || '--attest';
const CANDIDATE_MARKER = 'MCFT_CANDIDATE_DECLARATION_V2';
const REMEDIATION_MARKER = 'MCFT_GOVERNANCE_REMEDIATION_V1';
const FRONTIER_REMEDIATION_KIND = 'S4_FRONTIER_PROJECTION_CONTRACT';
const OBSERVABILITY_REMEDIATION_KIND = 'S4_ATTESTATION_OBSERVABILITY_CONTRACT';

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitStatus(...args) {
  return cp.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).status;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function api(apiPath) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap07-attestation-v1',
    },
  });
  if (!response.ok) {
    throw new Error(`GITHUB_API:${response.status}:${apiPath}:${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

function parseMarker(body, marker, required = false) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body || '').match(new RegExp(`<!--\\s*${escaped}\\s*\\n([\\s\\S]*?)-->`));
  if (!match) {
    if (required) throw new Error(`${marker}_MISSING`);
    return null;
  }
  const record = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`${marker}_LINE_INVALID:${line}`);
    record[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return record;
}

function parseAuthority(body) {
  const candidate = parseMarker(body, CANDIDATE_MARKER);
  const remediation = parseMarker(body, REMEDIATION_MARKER);
  if (candidate && remediation) throw new Error('MULTIPLE_DELIVERY_AUTHORITY_MARKERS');
  if (candidate) return { kind: 'CANDIDATE', record: candidate };
  if (remediation) return { kind: 'GOVERNANCE_REMEDIATION', record: remediation };
  throw new Error('DELIVERY_AUTHORITY_MARKER_MISSING');
}

function normalizeCommitSha(value, label) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(raw)) throw new Error(`${label}_SHA_INVALID:${raw}`);
  return git('rev-parse', `${raw}^{commit}`);
}

function exactText(record, key, expected, code) {
  if (String(record[key] || '') !== expected) throw new Error(`${code}:${String(record[key] || '')}`);
}

function exactSha(record, key, expected, code) {
  if (normalizeCommitSha(record[key], key.toUpperCase()) !== expected) throw new Error(code);
}

function exactPositiveInteger(record, key, code) {
  const value = Number(record[key]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${code}:${String(record[key] || '')}`);
  return value;
}

function parseJsonValue(value, code) {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(code);
  }
}

function readTextAtCommit(commitSha, repositoryPath) {
  return git('show', `${commitSha}:${repositoryPath}`);
}

function pathExistsAtCommit(commitSha, repositoryPath) {
  return gitStatus('cat-file', '-e', `${commitSha}:${repositoryPath}`) === 0;
}

function getField(value, fieldPath) {
  return String(fieldPath || '').split('.').reduce((current, key) => current && current[key], value);
}

function resolveSuccessfulCheckRuns(checkRuns, token) {
  return checkRuns.filter((run) => String(run.name || '').includes(token) && run.conclusion === 'success');
}

function resolveSuccessfulWorkflowRuns(workflowRuns, token, candidateHead) {
  return workflowRuns.filter((run) => {
    const pathValue = String(run.path || '');
    const nameMatches = String(run.name || '') === token;
    const pathMatches = pathValue.endsWith(`/${token}.yml`) || pathValue.endsWith(`/${token}.yaml`);
    return run.head_sha === candidateHead && run.event === 'pull_request' && run.conclusion === 'success' && (nameMatches || pathMatches);
  });
}

function validateCandidateAuthority(record, candidateHead, baseHead) {
  exactText(record, 'capability_line', 'MCFT-CAP-07', 'DECLARATION_CAPABILITY_MISMATCH');
  exactSha(record, 'candidate_head', candidateHead, 'DECLARATION_CANDIDATE_SHA_MISMATCH');
  exactSha(record, 'base_head', baseHead, 'DECLARATION_BASE_SHA_MISMATCH');
  return {
    sliceId: String(record.slice_id || ''),
    statusFile: String(record.status_file || ''),
    candidateField: String(record.candidate_field || ''),
    candidateValue: parseJsonValue(record.candidate_value, 'DECLARATION_CANDIDATE_VALUE_INVALID'),
    focusedWorkflow: String(record.focused_workflow || ''),
    standardWorkflow: String(record.standard_workflow || ''),
    originalCandidate: null,
    predecessorRemediation: null,
  };
}

async function readOriginalCandidateAuthority(record, repository) {
  const originalPrNumber = exactPositiveInteger(record, 'original_candidate_pr', 'ORIGINAL_CANDIDATE_PR_INVALID');
  const originalPr = await api(`/repos/${repository}/pulls/${originalPrNumber}`);
  if (!originalPr.merged_at || !originalPr.merge_commit_sha) throw new Error('ORIGINAL_CANDIDATE_PR_NOT_MERGED');
  const originalDeclaration = parseMarker(originalPr.body, CANDIDATE_MARKER, true);
  exactText(originalDeclaration, 'capability_line', 'MCFT-CAP-07', 'ORIGINAL_DECLARATION_CAPABILITY_MISMATCH');
  exactText(originalDeclaration, 'slice_id', 'MCFT-CAP-07.S4', 'ORIGINAL_DECLARATION_SLICE_MISMATCH');
  exactSha(record, 'original_candidate_head', originalPr.head.sha, 'ORIGINAL_CANDIDATE_HEAD_RECORD_MISMATCH');
  exactSha(record, 'original_candidate_base', originalPr.base.sha, 'ORIGINAL_CANDIDATE_BASE_RECORD_MISMATCH');
  exactSha(record, 'original_merge_commit', originalPr.merge_commit_sha, 'ORIGINAL_MERGE_RECORD_MISMATCH');
  exactSha(originalDeclaration, 'candidate_head', originalPr.head.sha, 'ORIGINAL_DECLARATION_HEAD_MISMATCH');
  exactSha(originalDeclaration, 'base_head', originalPr.base.sha, 'ORIGINAL_DECLARATION_BASE_MISMATCH');
  exactText(record, 'status_file', originalDeclaration.status_file, 'REMEDIATION_STATUS_FILE_MISMATCH');
  exactText(record, 'candidate_field', originalDeclaration.candidate_field, 'REMEDIATION_CANDIDATE_FIELD_MISMATCH');
  exactText(record, 'candidate_value', originalDeclaration.candidate_value, 'REMEDIATION_CANDIDATE_VALUE_MISMATCH');
  return {
    originalPr,
    originalDeclaration,
    originalCandidate: {
      pr_number: originalPrNumber,
      candidate_head: originalPr.head.sha,
      base_head: originalPr.base.sha,
      merge_commit: originalPr.merge_commit_sha,
      focused_workflow: originalDeclaration.focused_workflow,
      standard_workflow: originalDeclaration.standard_workflow,
    },
  };
}

async function readPredecessorRemediationAuthority(record, repository, expectedBaseHead) {
  const predecessorPrNumber = exactPositiveInteger(record, 'predecessor_remediation_pr', 'PREDECESSOR_REMEDIATION_PR_INVALID');
  const predecessorPr = await api(`/repos/${repository}/pulls/${predecessorPrNumber}`);
  if (!predecessorPr.merged_at || !predecessorPr.merge_commit_sha) throw new Error('PREDECESSOR_REMEDIATION_PR_NOT_MERGED');
  const predecessorAuthority = parseMarker(predecessorPr.body, REMEDIATION_MARKER, true);
  exactText(predecessorAuthority, 'capability_line', 'MCFT-CAP-07', 'PREDECESSOR_REMEDIATION_CAPABILITY_MISMATCH');
  exactText(predecessorAuthority, 'slice_id', 'MCFT-CAP-07.S4', 'PREDECESSOR_REMEDIATION_SLICE_MISMATCH');
  exactText(predecessorAuthority, 'remediation_kind', FRONTIER_REMEDIATION_KIND, 'PREDECESSOR_REMEDIATION_KIND_INVALID');
  exactSha(record, 'predecessor_remediation_head', predecessorPr.head.sha, 'PREDECESSOR_REMEDIATION_HEAD_RECORD_MISMATCH');
  exactSha(record, 'predecessor_remediation_base', predecessorPr.base.sha, 'PREDECESSOR_REMEDIATION_BASE_RECORD_MISMATCH');
  exactSha(record, 'predecessor_remediation_merge_commit', predecessorPr.merge_commit_sha, 'PREDECESSOR_REMEDIATION_MERGE_RECORD_MISMATCH');
  exactSha(predecessorAuthority, 'remediation_head', predecessorPr.head.sha, 'PREDECESSOR_REMEDIATION_DECLARATION_HEAD_MISMATCH');
  exactSha(predecessorAuthority, 'remediation_base', predecessorPr.base.sha, 'PREDECESSOR_REMEDIATION_DECLARATION_BASE_MISMATCH');
  if (expectedBaseHead !== predecessorPr.merge_commit_sha) throw new Error('REMEDIATION_BASE_MUST_BE_PREDECESSOR_REMEDIATION_MERGE');
  return {
    pr_number: predecessorPrNumber,
    remediation_kind: predecessorAuthority.remediation_kind,
    head: predecessorPr.head.sha,
    base: predecessorPr.base.sha,
    merge_commit: predecessorPr.merge_commit_sha,
  };
}

async function validateRemediationAuthority(record, repository, candidateHead, baseHead) {
  exactText(record, 'capability_line', 'MCFT-CAP-07', 'REMEDIATION_CAPABILITY_MISMATCH');
  exactText(record, 'slice_id', 'MCFT-CAP-07.S4', 'REMEDIATION_SLICE_MISMATCH');
  exactSha(record, 'remediation_head', candidateHead, 'REMEDIATION_HEAD_MISMATCH');
  exactSha(record, 'remediation_base', baseHead, 'REMEDIATION_BASE_MISMATCH');
  const kind = String(record.remediation_kind || '');
  if (![FRONTIER_REMEDIATION_KIND, OBSERVABILITY_REMEDIATION_KIND].includes(kind)) {
    throw new Error(`REMEDIATION_KIND_INVALID:${kind}`);
  }

  const original = await readOriginalCandidateAuthority(record, repository);
  let predecessorRemediation = null;
  if (kind === FRONTIER_REMEDIATION_KIND) {
    if (baseHead !== original.originalPr.merge_commit_sha) throw new Error('REMEDIATION_BASE_MUST_BE_ORIGINAL_S4_MERGE');
  } else {
    predecessorRemediation = await readPredecessorRemediationAuthority(record, repository, baseHead);
  }

  return {
    sliceId: String(record.slice_id || ''),
    statusFile: String(record.status_file || ''),
    candidateField: String(record.candidate_field || ''),
    candidateValue: parseJsonValue(record.candidate_value, 'REMEDIATION_CANDIDATE_VALUE_INVALID'),
    focusedWorkflow: String(record.focused_workflow || ''),
    standardWorkflow: String(record.standard_workflow || ''),
    originalCandidate: original.originalCandidate,
    predecessorRemediation,
  };
}

function selftest() {
  const candidateBody = `<!-- ${CANDIDATE_MARKER}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.S4\n-->`;
  const frontierBody = `<!-- ${REMEDIATION_MARKER}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.S4\nremediation_kind=${FRONTIER_REMEDIATION_KIND}\n-->`;
  const observabilityBody = `<!-- ${REMEDIATION_MARKER}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.S4\nremediation_kind=${OBSERVABILITY_REMEDIATION_KIND}\n-->`;
  assert.equal(parseAuthority(candidateBody).kind, 'CANDIDATE');
  assert.equal(parseAuthority(frontierBody).record.remediation_kind, FRONTIER_REMEDIATION_KIND);
  assert.equal(parseAuthority(observabilityBody).record.remediation_kind, OBSERVABILITY_REMEDIATION_KIND);
  assert.throws(() => parseAuthority(`${candidateBody}\n${frontierBody}`), /MULTIPLE_DELIVERY_AUTHORITY_MARKERS/);
  assert.throws(() => parseAuthority(''), /DELIVERY_AUTHORITY_MARKER_MISSING/);
  const result = {
    schema_version: 'geox_mcft_cap_07_slice_exact_sha_attestation_selftest_v1',
    status: 'PASS',
    check_count: 5,
    checks: [
      { name: 'CANDIDATE_MARKER_SUPPORTED', status: 'PASS' },
      { name: 'FRONTIER_REMEDIATION_KIND_SUPPORTED', status: 'PASS' },
      { name: 'OBSERVABILITY_REMEDIATION_KIND_SUPPORTED', status: 'PASS' },
      { name: 'MULTIPLE_MARKERS_FAIL_CLOSED', status: 'PASS' },
      { name: 'MISSING_MARKER_FAILS_CLOSED', status: 'PASS' },
    ],
    repository_write_performed: false,
    candidate_transition_created: false,
  };
  writeJson(SELFTEST_OUT, result);
  console.log('PASS governance-remediation attestation selftest');
}

async function attest() {
  const subject = normalizeCommitSha(process.env.MCFT_SUBJECT_SHA || process.env.GITHUB_SHA || git('rev-parse', 'HEAD'), 'SUBJECT');
  if (gitStatus('merge-base', '--is-ancestor', subject, 'origin/main') !== 0) throw new Error('SUBJECT_COMMIT_NOT_ON_MAIN');
  const parents = git('rev-list', '--parents', '-n', '1', subject).split(/\s+/).slice(1);
  if (parents.length !== 2) throw new Error(`MERGE_COMMIT_TWO_PARENTS_REQUIRED:${parents.length}`);
  const [baseHead, candidateHead] = parents;
  const subjectTree = git('rev-parse', `${subject}^{tree}`);
  const candidateTree = git('rev-parse', `${candidateHead}^{tree}`);
  if (subjectTree !== candidateTree) throw new Error('CANDIDATE_TO_MERGE_TREE_DELTA_NONZERO');

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !process.env.GITHUB_TOKEN) throw new Error('GITHUB_CONTEXT_REQUIRED');
  const pullRequests = await api(`/repos/${repository}/commits/${candidateHead}/pulls`);
  const sourcePullRequest = pullRequests.find((pr) => pr.merged_at && pr.merge_commit_sha === subject)
    || pullRequests.find((pr) => pr.head?.sha === candidateHead);
  if (!sourcePullRequest) throw new Error('SOURCE_PR_NOT_FOUND');

  const authority = parseAuthority(sourcePullRequest.body);
  const resolved = authority.kind === 'CANDIDATE'
    ? validateCandidateAuthority(authority.record, candidateHead, baseHead)
    : await validateRemediationAuthority(authority.record, repository, candidateHead, baseHead);
  if (!resolved.sliceId || !resolved.statusFile || !resolved.candidateField || !resolved.focusedWorkflow || !resolved.standardWorkflow) {
    throw new Error('DELIVERY_AUTHORITY_FIELDS_INCOMPLETE');
  }

  const status = JSON.parse(readTextAtCommit(subject, resolved.statusFile));
  assert.deepEqual(getField(status, resolved.candidateField), resolved.candidateValue);
  const checkRunResponse = await api(`/repos/${repository}/commits/${candidateHead}/check-runs?per_page=100`);
  const workflowRunResponse = await api(`/repos/${repository}/actions/runs?head_sha=${candidateHead}&event=pull_request&per_page=100`);
  const requiredChecks = {};
  for (const token of [resolved.focusedWorkflow, 'mcft-candidate-integrity-enforce-current-pr', 'mcft-release-lane']) {
    const matches = resolveSuccessfulCheckRuns(checkRunResponse.check_runs || [], token);
    if (!matches.length) throw new Error(`REQUIRED_CHECK_NOT_PASS:${token}`);
    requiredChecks[token] = matches.map((run) => ({ authority_type: 'check_run', id: run.id, name: run.name, conclusion: run.conclusion }));
  }
  const standardMatches = resolveSuccessfulWorkflowRuns(workflowRunResponse.workflow_runs || [], resolved.standardWorkflow, candidateHead);
  if (!standardMatches.length) throw new Error(`REQUIRED_WORKFLOW_NOT_PASS:${resolved.standardWorkflow}`);
  requiredChecks[resolved.standardWorkflow] = standardMatches.map((run) => ({
    authority_type: 'workflow_run',
    id: run.id,
    name: run.name,
    event: run.event,
    head_sha: run.head_sha,
    conclusion: run.conclusion,
  }));

  const probePath = 'docs/digital_twin/mcft/cap_07/testing/GEOX-MCFT-CAP-07-S0-UNREGISTERED-PROBE.json';
  if (pathExistsAtCommit(subject, probePath)) throw new Error('NEGATIVE_PROBE_PRESENT_ON_MERGED_MAIN');
  const artifact = {
    schema_version: 'geox_mcft_cap_07_slice_exact_sha_attestation_v1',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-07',
    slice_id: resolved.sliceId,
    delivery_subject_kind: authority.kind,
    subject_commit: subject,
    base_head: baseHead,
    candidate_head: candidateHead,
    candidate_to_merge_tree_delta: 0,
    source_pr_number: sourcePullRequest.number,
    original_candidate: resolved.originalCandidate,
    predecessor_remediation: resolved.predecessorRemediation,
    required_checks: requiredChecks,
    focused_acceptance_result: 'PASS',
    predecessor_artifact_validation: status.predecessor_effective_evidence_requirement || null,
    committed_candidate_state: {
      status_file: resolved.statusFile,
      candidate_field: resolved.candidateField,
      candidate_value: resolved.candidateValue,
    },
    effective_delivery_frontier_projection: {
      effective_status: status.effective_status_when_attested || status.effective_completion_state || 'IMPLEMENTED',
      effective_next_slice: status.effective_next_slice_when_attested || null,
      effective_active_delivery_slice_id: status.effective_next_slice_when_attested || null,
    },
    runtime_authority_delta: status.runtime_authority_delta || 'ZERO',
    canonical_write_authority_delta: status.canonical_write_authority_delta || 'ZERO',
    repository_write_performed: false,
    postmerge_ssot_writeback_performed: false,
    proof_only_pr_created: false,
    candidate_transition_created_by_remediation: false,
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    workflow_job: process.env.GITHUB_JOB || null,
    generated_at: new Date().toISOString(),
  };
  artifact.semantic_artifact_digest = digest(artifact);
  writeJson(OUT, artifact);
  console.log(`PASS ${resolved.sliceId} ${subject} ${authority.kind}`);
}

(async () => {
  try {
    if (MODE === '--selftest-governance-remediation') selftest();
    else if (MODE === '--attest') await attest();
    else throw new Error(`UNKNOWN_MODE:${MODE}`);
  } catch (error) {
    const result = {
      schema_version: MODE === '--selftest-governance-remediation'
        ? 'geox_mcft_cap_07_slice_exact_sha_attestation_selftest_v1'
        : 'geox_mcft_cap_07_slice_exact_sha_attestation_v1',
      status: 'FAIL',
      mode: MODE,
      error: String((error && error.message) || error),
      subject_commit: process.env.MCFT_SUBJECT_SHA || process.env.GITHUB_SHA || null,
    };
    writeJson(MODE === '--selftest-governance-remediation' ? SELFTEST_OUT : OUT, result);
    console.error(error);
    process.exitCode = 1;
  }
})();
