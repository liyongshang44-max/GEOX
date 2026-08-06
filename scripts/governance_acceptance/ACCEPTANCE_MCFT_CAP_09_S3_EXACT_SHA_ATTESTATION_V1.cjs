#!/usr/bin/env node
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const VALIDATOR_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs';
const SOURCE_COMMIT = '2b570287815c54924707f47dcc0f9c88e53d8282';
const SOURCE_BLOB = 'f3ee85a0a1076219d2729eb39e8680095fd22163';
const REQUIRED_TOKENS = [
  '15cdb24667d43cf7c21294d22b68160c6668cf73',
  '41d763c7b1b1c9f35efc702b965ab0cea4632447',
  'd86f0c979f69a89807e4cd88faa51928be587993',
  'candidate_to_merge_tree_delta',
  's3_persistent_sequential_scheduler_effective',
  'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  'semantic_artifact_digest',
];
const REPLACEMENTS = [
  ['S3_EXACT_SHA_R2_REPAIR_V4', 'S3_EXACT_SHA_R2_REPAIR_V5', 'GENERATION'],
  [
    "must(process.env.MCFT_FAILED_CONTROL_PLANE_SHA === SECOND_FAILED.merge, 'LATEST_FAILED_CONTROL_ENV_REQUIRED');",
    "must(process.env.MCFT_FIRST_FAILED_CONTROL_PLANE_SHA === FIRST_FAILED.merge, 'FIRST_FAILED_CONTROL_ENV_REQUIRED');\n  must(process.env.MCFT_FAILED_CONTROL_PLANE_SHA === SECOND_FAILED.merge, 'LATEST_FAILED_CONTROL_ENV_REQUIRED');",
    'FAILED_ENV',
  ],
  ['geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v4', 'geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v5', 'CONTROL_SCHEMA'],
  ['geox_mcft_cap09_s3_semantic_artifact_v4', 'geox_mcft_cap09_s3_semantic_artifact_v5', 'SEMANTIC_SCHEMA'],
  ['geox_mcft_cap09_s3_exact_sha_attestation_v4', 'geox_mcft_cap09_s3_exact_sha_attestation_v5', 'ATTESTATION_SCHEMA'],
];

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function gitRaw(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}
function blobSha(value) {
  const bytes = Buffer.from(value, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest('hex');
}
function fail(code) {
  const output = path.join(ROOT, 'acceptance-output');
  fs.mkdirSync(output, { recursive: true });
  const candidate = process.argv.includes('--control-plane-candidate');
  const name = candidate
    ? 'MCFT_CAP_09_S3_EXACT_SHA_CONTROL_PLANE_RESULT.json'
    : 'MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json';
  const value = { status: 'FAIL', error: code };
  fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
  console.error(JSON.stringify(value, null, 2));
  process.exit(1);
}

try {
  process.chdir(ROOT);
  const committedSource = fs.readFileSync(path.join(ROOT, VALIDATOR_PATH), 'utf8');
  if (blobSha(committedSource) !== git('rev-parse', `HEAD:${VALIDATOR_PATH}`)) {
    fail('EXECUTING_VALIDATOR_NOT_COMMITTED_HEAD_BLOB');
  }
  if (git('rev-parse', `${SOURCE_COMMIT}:${VALIDATOR_PATH}`) !== SOURCE_BLOB) {
    fail('FROZEN_V4_VALIDATOR_BLOB_MISMATCH');
  }
  let source = gitRaw('show', `${SOURCE_COMMIT}:${VALIDATOR_PATH}`);
  if (blobSha(source) !== SOURCE_BLOB) fail('FROZEN_V4_VALIDATOR_BYTES_MISMATCH');
  for (const [from, to, code] of REPLACEMENTS) {
    if (source.split(from).length !== 2) fail(`${code}_REPLACEMENT_CARDINALITY`);
    source = source.replace(from, to);
  }
  const declarationMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  if (source.includes(declarationMarker)) fail('DECLARATION_LITERAL_REMAINS');
  for (const token of REQUIRED_TOKENS) {
    if (!source.includes(token) || !committedSource.includes(token)) fail(`REQUIRED_TOKEN_MISSING:${token}`);
  }
  for (const token of ['S3_EXACT_SHA_R2_REPAIR_V5', 'FIRST_FAILED_CONTROL_ENV_REQUIRED']) {
    if (!source.includes(token)) fail(`V5_TOKEN_MISSING:${token}`);
  }
  fs.writeFileSync(path.join(ROOT, VALIDATOR_PATH), source);
  const child = cp.spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_PATH), ...process.argv.slice(2)], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  if (child.error) throw child.error;
  process.exit(child.status === null ? 1 : child.status);
} catch (error) {
  fail(String(error instanceof Error ? error.message : error));
}
