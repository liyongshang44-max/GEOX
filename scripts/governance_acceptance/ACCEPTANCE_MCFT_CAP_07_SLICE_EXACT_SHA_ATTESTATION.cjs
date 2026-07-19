#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION.cjs
// Purpose: derive the effective MCFT-CAP-07 delivery frontier from one exact main merge SHA without repository writeback.
// Boundary: read-only Git/GitHub/repository inspection and immutable artifact generation only.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION.json',
);

function git(...args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function gitStatus(...args) {
  return cp.spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  }).status;
}

function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto
    .createHash('sha256')
    .update(canonical(value))
    .digest('hex')}`;
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
    throw new Error(
      `GITHUB_API:${response.status}:${apiPath}:${(await response.text()).slice(0, 300)}`,
    );
  }

  return response.json();
}

function parseDeclaration(body) {
  const match = String(body || '').match(
    /<!--\s*MCFT_CANDIDATE_DECLARATION_V2\s*\n([\s\S]*?)-->/,
  );
  if (!match) {
    throw new Error('CANDIDATE_DECLARATION_MISSING');
  }

  const declaration = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator < 1) {
      throw new Error(`DECLARATION_LINE_INVALID:${line}`);
    }
    declaration[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim();
  }
  return declaration;
}

function normalizeCommitSha(value, label) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(raw)) {
    throw new Error(`${label}_SHA_INVALID:${raw}`);
  }
  return git('rev-parse', `${raw}^{commit}`);
}

function readTextAtCommit(commitSha, repositoryPath) {
  return git('show', `${commitSha}:${repositoryPath}`);
}

function pathExistsAtCommit(commitSha, repositoryPath) {
  return gitStatus('cat-file', '-e', `${commitSha}:${repositoryPath}`) === 0;
}

function resolveSuccessfulCheckRuns(checkRuns, token) {
  return checkRuns.filter(
    (run) => String(run.name || '').includes(token) && run.conclusion === 'success',
  );
}

function resolveSuccessfulWorkflowRuns(workflowRuns, token, candidateHead) {
  return workflowRuns.filter((run) => {
    const pathValue = String(run.path || '');
    const nameMatches = String(run.name || '') === token;
    const pathMatches =
      pathValue.endsWith(`/${token}.yml`) || pathValue.endsWith(`/${token}.yaml`);

    return (
      run.head_sha === candidateHead &&
      run.event === 'pull_request' &&
      run.conclusion === 'success' &&
      (nameMatches || pathMatches)
    );
  });
}

(async () => {
  try {
    const subject = normalizeCommitSha(
      process.env.MCFT_SUBJECT_SHA || process.env.GITHUB_SHA || git('rev-parse', 'HEAD'),
      'SUBJECT',
    );

    if (gitStatus('merge-base', '--is-ancestor', subject, 'origin/main') !== 0) {
      throw new Error('SUBJECT_COMMIT_NOT_ON_MAIN');
    }

    const parents = git('rev-list', '--parents', '-n', '1', subject)
      .split(/\s+/)
      .slice(1);
    if (parents.length !== 2) {
      throw new Error(`MERGE_COMMIT_TWO_PARENTS_REQUIRED:${parents.length}`);
    }

    const [baseHead, candidateHead] = parents;
    const subjectTree = git('rev-parse', `${subject}^{tree}`);
    const candidateTree = git('rev-parse', `${candidateHead}^{tree}`);
    if (subjectTree !== candidateTree) {
      throw new Error('CANDIDATE_TO_MERGE_TREE_DELTA_NONZERO');
    }

    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository || !process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_CONTEXT_REQUIRED');
    }

    const pullRequests = await api(
      `/repos/${repository}/commits/${candidateHead}/pulls`,
    );
    const sourcePullRequest =
      pullRequests.find(
        (pullRequest) =>
          pullRequest.merged_at && pullRequest.merge_commit_sha === subject,
      ) || pullRequests.find((pullRequest) => pullRequest.head?.sha === candidateHead);
    if (!sourcePullRequest) {
      throw new Error('SOURCE_PR_NOT_FOUND');
    }

    const declaration = parseDeclaration(sourcePullRequest.body);
    if (
      declaration.capability_line !== 'MCFT-CAP-07' ||
      declaration.candidate_head !== candidateHead ||
      declaration.base_head !== baseHead
    ) {
      throw new Error('DECLARATION_SHA_OR_CAPABILITY_MISMATCH');
    }

    const status = JSON.parse(
      readTextAtCommit(subject, declaration.status_file),
    );
    const candidateField = declaration.candidate_field
      .split('.')
      .reduce((value, key) => value && value[key], status);
    const expectedCandidateValue = JSON.parse(declaration.candidate_value);
    assert.deepEqual(candidateField, expectedCandidateValue);

    const checkRunResponse = await api(
      `/repos/${repository}/commits/${candidateHead}/check-runs?per_page=100`,
    );
    const workflowRunResponse = await api(
      `/repos/${repository}/actions/runs?head_sha=${candidateHead}&event=pull_request&per_page=100`,
    );

    const requiredChecks = {};
    for (const token of [
      declaration.focused_workflow,
      'mcft-candidate-integrity-enforce-current-pr',
      'mcft-release-lane',
    ]) {
      const matches = resolveSuccessfulCheckRuns(
        checkRunResponse.check_runs || [],
        token,
      );
      if (!matches.length) {
        throw new Error(`REQUIRED_CHECK_NOT_PASS:${token}`);
      }
      requiredChecks[token] = matches.map((run) => ({
        authority_type: 'check_run',
        id: run.id,
        name: run.name,
        conclusion: run.conclusion,
      }));
    }

    const standardWorkflowMatches = resolveSuccessfulWorkflowRuns(
      workflowRunResponse.workflow_runs || [],
      declaration.standard_workflow,
      candidateHead,
    );
    if (!standardWorkflowMatches.length) {
      throw new Error(
        `REQUIRED_WORKFLOW_NOT_PASS:${declaration.standard_workflow}`,
      );
    }
    requiredChecks[declaration.standard_workflow] = standardWorkflowMatches.map(
      (run) => ({
        authority_type: 'workflow_run',
        id: run.id,
        name: run.name,
        event: run.event,
        head_sha: run.head_sha,
        conclusion: run.conclusion,
      }),
    );

    const probePath =
      'docs/digital_twin/mcft/cap_07/testing/GEOX-MCFT-CAP-07-S0-UNREGISTERED-PROBE.json';
    if (pathExistsAtCommit(subject, probePath)) {
      throw new Error('NEGATIVE_PROBE_PRESENT_ON_MERGED_MAIN');
    }

    const artifact = {
      schema_version: 'geox_mcft_cap_07_slice_exact_sha_attestation_v1',
      status: 'PASS',
      capability_line_id: 'MCFT-CAP-07',
      slice_id: declaration.slice_id,
      subject_commit: subject,
      base_head: baseHead,
      candidate_head: candidateHead,
      candidate_to_merge_tree_delta: 0,
      source_pr_number: sourcePullRequest.number,
      required_checks: requiredChecks,
      focused_acceptance_result: 'PASS',
      predecessor_artifact_validation:
        status.predecessor_effective_evidence_requirement || null,
      committed_candidate_state: {
        status_file: declaration.status_file,
        candidate_field: declaration.candidate_field,
        candidate_value: expectedCandidateValue,
      },
      effective_delivery_frontier_projection: {
        effective_status:
          status.effective_status_when_attested ||
          status.effective_completion_state ||
          'IMPLEMENTED',
        effective_next_slice: status.effective_next_slice_when_attested || null,
        effective_active_delivery_slice_id:
          status.effective_next_slice_when_attested || null,
      },
      runtime_authority_delta: status.runtime_authority_delta || 'ZERO',
      canonical_write_authority_delta:
        status.canonical_write_authority_delta || 'ZERO',
      repository_write_performed: false,
      postmerge_ssot_writeback_performed: false,
      proof_only_pr_created: false,
      workflow_run_id: process.env.GITHUB_RUN_ID || null,
      workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      workflow_job: process.env.GITHUB_JOB || null,
      generated_at: new Date().toISOString(),
    };
    artifact.semantic_artifact_digest = digest(artifact);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`PASS ${declaration.slice_id} ${subject}`);
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(
      OUT,
      `${JSON.stringify(
        {
          schema_version: 'geox_mcft_cap_07_slice_exact_sha_attestation_v1',
          status: 'FAIL',
          error: String((error && error.message) || error),
          subject_commit:
            process.env.MCFT_SUBJECT_SHA || process.env.GITHUB_SHA || null,
        },
        null,
        2,
      )}\n`,
    );
    console.error(error);
    process.exit(1);
  }
})();
