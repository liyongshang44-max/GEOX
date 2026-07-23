#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function requiredSha(name) {
  const value = String(process.env[name] || '').trim();
  assert.match(value, /^[0-9a-f]{40}$/, `${name}_INVALID`);
  return value;
}

function git(root, args) {
  return cp.execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function main() {
  const subjectRoot = path.resolve(String(process.env.MCFT_SUBJECT_ROOT || '').trim());
  const destination = path.resolve(String(process.env.MCFT_BOUNDARY_RESULT_DESTINATION || '').trim());
  const subject = requiredSha('MCFT_SUBJECT_SHA');
  const base = requiredSha('MCFT_BASE_SHA');
  const candidate = requiredSha('MCFT_CANDIDATE_SHA');

  assert.equal(git(subjectRoot, ['rev-parse', 'HEAD']), subject, 'SUBJECT_ROOT_HEAD_MISMATCH');
  const parents = git(subjectRoot, ['rev-list', '--parents', '-n', '1', subject]).split(/\s+/);
  assert.deepEqual(parents, [subject, base, candidate], 'SUBJECT_PARENT_ORDER_MISMATCH');
  assert.equal(
    git(subjectRoot, ['rev-parse', `${subject}^{tree}`]),
    git(subjectRoot, ['rev-parse', `${candidate}^{tree}`]),
    'SUBJECT_CANDIDATE_TREE_MISMATCH',
  );

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap08-s1-boundary-'));
  let added = false;
  try {
    cp.execFileSync('git', ['-C', subjectRoot, 'worktree', 'add', '--detach', tempRoot, candidate], {
      stdio: 'inherit',
    });
    added = true;
    cp.execFileSync(
      process.execPath,
      [path.join(tempRoot, 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S1_BOUNDARY.cjs')],
      {
        cwd: tempRoot,
        env: { ...process.env, MCFT_BASE_SHA: base },
        stdio: 'inherit',
      },
    );
    const source = path.join(tempRoot, 'acceptance-output/MCFT_CAP_08_S1_BOUNDARY_RESULT.json');
    const result = JSON.parse(fs.readFileSync(source, 'utf8'));
    assert.equal(result.status, 'PASS', 'CANDIDATE_BOUNDARY_RESULT_NOT_PASS');
    assert.equal(result.base_sha, base, 'CANDIDATE_BOUNDARY_BASE_MISMATCH');
    assert.equal(result.head_sha, candidate, 'CANDIDATE_BOUNDARY_HEAD_MISMATCH');
    assert.equal(result.changed_file_count, 24, 'CANDIDATE_BOUNDARY_FILE_COUNT_MISMATCH');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    console.log(JSON.stringify({
      status: 'PASS',
      mode: 'CANDIDATE_WORKTREE_BOUNDARY_REPLAY',
      subject_sha: subject,
      base_sha: base,
      candidate_sha: candidate,
      candidate_tree_equals_subject_tree: true,
      boundary_result_destination: destination,
    }));
  } finally {
    if (added) {
      cp.spawnSync('git', ['-C', subjectRoot, 'worktree', 'remove', '--force', tempRoot], {
        encoding: 'utf8',
      });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    cp.spawnSync('git', ['-C', subjectRoot, 'worktree', 'prune'], { encoding: 'utf8' });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
}
