#!/usr/bin/env node
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const VALIDATOR_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION_V1.cjs';
const SOURCE_COMMIT = 'd86f0c979f69a89807e4cd88faa51928be587993';
const SOURCE_BLOB = '3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630';
const ROUTE_TOKENS = [
  '15cdb24667d43cf7c21294d22b68160c6668cf73',
  'candidate_to_merge_tree_delta',
  's3_persistent_sequential_scheduler_effective',
  'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  'semantic_artifact_digest',
];
const REPLACEMENTS = [
  [
    "const FOCUSED_DIGEST = 'sha256:bac8fa6b0cde49aafa84eeaf0a2d505841883888ee9d1bcb926549114aaaf793';",
    "const FOCUSED_DIGEST = 'sha256:bac8fa6b54d56815b1717c8cba2e8aaaec86c2f6658095fcbce323997657b2cf';",
    'FOCUSED_DIGEST',
  ],
  [
    "const FAILED_CONTROL_MERGE = '41d763c7b1b1c9f35efc702b965ab0cea4632447';",
    "const FAILED_CONTROL_MERGE = 'd86f0c979f69a89807e4cd88faa51928be587993';",
    'FAILED_CONTROL_MERGE',
  ],
  [
    "const FAILED_CONTROL_HEAD = '83deb238efb372dc4f573ab71cf49088004b7ac8';",
    "const FAILED_CONTROL_HEAD = 'c38419fb6ebc2e33012c47d4815597a6fa8b7ab5';",
    'FAILED_CONTROL_HEAD',
  ],
  [
    "const FAILED_CONTROL_TREE = 'f04dbb31e5824fb3fcb99cc9ecd99b3303507c6a';",
    "const FAILED_CONTROL_TREE = 'a6d8262bcb23511c06a6f518dd1a91555be51d7e';",
    'FAILED_CONTROL_TREE',
  ],
  ['const FAILED_RUN = 31068800943;', 'const FAILED_RUN = 31072140910;', 'FAILED_RUN'],
  [
    "'b185b1e40f6b6a2c64445548bcb549fa5fa36121',\n'9d50947fa0ae77dac91fd6a8a4bceaa2fb20eb8d',",
    "'e70eded76878000b40bc02b7bc0b3ae7432c4fa7',\n'3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630',",
    'FAILED_CONTROL_BLOBS',
  ],
  ["'S3_EXACT_SHA_R2_REPAIR_V2',", "'S3_EXACT_SHA_R2_REPAIR_V3',", 'WORKFLOW_GENERATION_TOKEN'],
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
function writeFailure(code) {
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
  const committedBlob = git('rev-parse', `HEAD:${VALIDATOR_PATH}`);
  const committedSource = fs.readFileSync(path.join(ROOT, VALIDATOR_PATH), 'utf8');
  if (blobSha(committedSource) !== committedBlob) writeFailure('EXECUTING_VALIDATOR_NOT_COMMITTED_HEAD_BLOB');
  if (git('rev-parse', `${SOURCE_COMMIT}:${VALIDATOR_PATH}`) !== SOURCE_BLOB) {
    writeFailure('FROZEN_SOURCE_VALIDATOR_BLOB_MISMATCH');
  }
  let source = gitRaw('show', `${SOURCE_COMMIT}:${VALIDATOR_PATH}`);
  if (blobSha(source) !== SOURCE_BLOB) writeFailure('FROZEN_SOURCE_BYTES_MISMATCH');
  for (const [from, to, code] of REPLACEMENTS) {
    if (source.split(from).length !== 2) writeFailure(`${code}_REPLACEMENT_CARDINALITY`);
    source = source.replace(from, to);
  }
  for (const token of ROUTE_TOKENS) {
    if (!source.includes(token) || !committedSource.includes(token)) writeFailure(`ROUTE_TOKEN_MISSING:${token}`);
  }
  for (const token of [
    'sha256:bac8fa6b54d56815b1717c8cba2e8aaaec86c2f6658095fcbce323997657b2cf',
    'd86f0c979f69a89807e4cd88faa51928be587993',
    'c38419fb6ebc2e33012c47d4815597a6fa8b7ab5',
    'a6d8262bcb23511c06a6f518dd1a91555be51d7e',
    '31072140910',
    'e70eded76878000b40bc02b7bc0b3ae7432c4fa7',
    '3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630',
    'S3_EXACT_SHA_R2_REPAIR_V3',
  ]) {
    if (!source.includes(token)) writeFailure(`CORRECTED_TOKEN_MISSING:${token}`);
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
  writeFailure(String(error instanceof Error ? error.message : error));
}
