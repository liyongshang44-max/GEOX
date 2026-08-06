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
const THIRD_FAILED_MERGE = 'e1f8eeeb444672563bdddf60d6c4be4d9cc162b0';
const THIRD_FAILED_HEAD = '2168703bf129a8f56963713253d0c08e137d5ddb';
const THIRD_FAILED_TREE = '92d4ffedc548370b0b6f0afce9e8953a05b5e0cd';
const THIRD_FAILED_RUN = 31074819540;
const THIRD_FAILED_WORKFLOW_BLOB = '171cd5837333bfe75a6164b31f8392fe3bf60a77';
const THIRD_FAILED_VALIDATOR_BLOB = '9196ff2e7603645721a17d1169ed70fd949bcaf7';
const DIGEST_SCOPE = 'ENTIRE_ATTESTATION_EXCLUDING_SEMANTIC_ARTIFACT_DIGEST';

const REQUIRED_TOKENS = [
  '15cdb24667d43cf7c21294d22b68160c6668cf73',
  '41d763c7b1b1c9f35efc702b965ab0cea4632447',
  'd86f0c979f69a89807e4cd88faa51928be587993',
  THIRD_FAILED_MERGE,
  String(THIRD_FAILED_RUN),
  THIRD_FAILED_WORKFLOW_BLOB,
  THIRD_FAILED_VALIDATOR_BLOB,
  DIGEST_SCOPE,
  'candidate_to_merge_tree_delta',
  's3_persistent_sequential_scheduler_effective',
  'MCFT_CAP_09_S4_REGISTRY_REGISTRATION',
  'semantic_artifact_digest',
];

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function gitRaw(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT });
}
function blobSha(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
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
function replaceExact(source, from, to, expectedCount, code) {
  const actual = source.split(from).length - 1;
  if (actual !== expectedCount) fail(`${code}_REPLACEMENT_CARDINALITY:${actual}`);
  return source.split(from).join(to);
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

  let source = gitRaw('show', `${SOURCE_COMMIT}:${VALIDATOR_PATH}`).toString('utf8');
  if (blobSha(source) !== SOURCE_BLOB) fail('FROZEN_V4_VALIDATOR_BYTES_MISMATCH');

  source = replaceExact(
    source,
    "  blobs: [\n    'e70eded76878000b40bc02b7bc0b3ae7432c4fa7',\n    '3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630',\n  ],\n};\n\nconst WORKFLOW =",
    "  blobs: [\n    'e70eded76878000b40bc02b7bc0b3ae7432c4fa7',\n    '3bbf9eb5f3c23e244f619bcd1d3ddddd94f99630',\n  ],\n};\nconst THIRD_FAILED = {\n  merge: 'e1f8eeeb444672563bdddf60d6c4be4d9cc162b0',\n  head: '2168703bf129a8f56963713253d0c08e137d5ddb',\n  tree: '92d4ffedc548370b0b6f0afce9e8953a05b5e0cd',\n  run: 31074819540,\n  parent: SECOND_FAILED.merge,\n  blobs: [\n    '171cd5837333bfe75a6164b31f8392fe3bf60a77',\n    '9196ff2e7603645721a17d1169ed70fd949bcaf7',\n  ],\n};\n\nconst WORKFLOW =",
    1,
    'THIRD_FAILED_CONSTANT',
  );
  source = replaceExact(source, 'S3_EXACT_SHA_R2_REPAIR_V4', 'S3_EXACT_SHA_R2_REPAIR_V6', 1, 'GENERATION');
  source = replaceExact(
    source,
    "must(base === SECOND_FAILED.merge, 'EXACT_CONTROL_PLANE_REPAIR_BASE_REQUIRED');",
    "must(base === THIRD_FAILED.merge, 'EXACT_CONTROL_PLANE_REPAIR_BASE_REQUIRED');",
    1,
    'CONTROL_BASE',
  );
  source = replaceExact(
    source,
    "  assertFailedGeneration(SECOND_FAILED, 'SECOND_FAILED_CONTROL');",
    "  assertFailedGeneration(SECOND_FAILED, 'SECOND_FAILED_CONTROL');\n  assertFailedGeneration(THIRD_FAILED, 'THIRD_FAILED_CONTROL');",
    2,
    'THIRD_FAILED_ASSERTION',
  );
  source = replaceExact(
    source,
    "'S3_EXACT_SHA_R2_REPAIR_V6', SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge,",
    "'S3_EXACT_SHA_R2_REPAIR_V6', SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, THIRD_FAILED.merge,",
    1,
    'WORKFLOW_TOKEN_LINEAGE',
  );
  source = replaceExact(
    source,
    "ROUTE_MERGE, FIRST_FAILED.merge, FIRST_FAILED.run, SECOND_FAILED.merge, SECOND_FAILED.run,",
    "ROUTE_MERGE, FIRST_FAILED.merge, FIRST_FAILED.run, SECOND_FAILED.merge, SECOND_FAILED.run, THIRD_FAILED.merge, THIRD_FAILED.run,",
    1,
    'VALIDATOR_TOKEN_LINEAGE',
  );
  source = replaceExact(
    source,
    "    second_failed_run_id: SECOND_FAILED.run,\n    corrected_focused_artifact_digest:",
    "    second_failed_run_id: SECOND_FAILED.run,\n    third_failed_control_merge_sha: THIRD_FAILED.merge,\n    third_failed_run_id: THIRD_FAILED.run,\n    digest_contract_correction: 'ENTIRE_ATTESTATION_EXCLUDING_SEMANTIC_ARTIFACT_DIGEST',\n    corrected_focused_artifact_digest:",
    1,
    'CONTROL_RESULT_LINEAGE',
  );
  source = replaceExact(
    source,
    "must(process.env.MCFT_FAILED_CONTROL_PLANE_SHA === SECOND_FAILED.merge, 'LATEST_FAILED_CONTROL_ENV_REQUIRED');",
    "must(process.env.MCFT_FIRST_FAILED_CONTROL_PLANE_SHA === FIRST_FAILED.merge, 'FIRST_FAILED_CONTROL_ENV_REQUIRED');\n  must(process.env.MCFT_SECOND_FAILED_CONTROL_PLANE_SHA === SECOND_FAILED.merge, 'SECOND_FAILED_CONTROL_ENV_REQUIRED');\n  must(process.env.MCFT_FAILED_CONTROL_PLANE_SHA === THIRD_FAILED.merge, 'LATEST_FAILED_CONTROL_ENV_REQUIRED');",
    1,
    'FAILED_ENV',
  );
  source = replaceExact(
    source,
    "controlParents.length === 3 && controlParents[1] === SECOND_FAILED.merge",
    "controlParents.length === 3 && controlParents[1] === THIRD_FAILED.merge",
    1,
    'CURRENT_MERGE_PARENT',
  );
  source = replaceExact(
    source,
    "equal(parents(repairHead), [repairHead, SECOND_FAILED.merge], 'CURRENT_REPAIR_HEAD_PARENT');",
    "equal(parents(repairHead), [repairHead, THIRD_FAILED.merge], 'CURRENT_REPAIR_HEAD_PARENT');",
    1,
    'CURRENT_HEAD_PARENT',
  );
  source = replaceExact(
    source,
    "equal(changedFiles(SECOND_FAILED.merge, repairHead), CONTROL_FILES, 'CURRENT_REPAIR_BOUNDARY');",
    "equal(changedFiles(THIRD_FAILED.merge, repairHead), CONTROL_FILES, 'CURRENT_REPAIR_BOUNDARY');",
    1,
    'CURRENT_HEAD_BOUNDARY',
  );
  source = replaceExact(
    source,
    "equal(changedFiles(SECOND_FAILED.merge, controlMerge), CONTROL_FILES, 'CURRENT_REPAIR_MERGE_DELTA');",
    "equal(changedFiles(THIRD_FAILED.merge, controlMerge), CONTROL_FILES, 'CURRENT_REPAIR_MERGE_DELTA');",
    1,
    'CURRENT_MERGE_BOUNDARY',
  );
  source = replaceExact(
    source,
    '[CANDIDATE_HEAD, SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, controlMerge]',
    '[CANDIDATE_HEAD, SUBJECT, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, THIRD_FAILED.merge, controlMerge]',
    1,
    'CANDIDATE_BLOB_LINEAGE',
  );
  source = replaceExact(
    source,
    '[ROUTE_HEAD, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, controlMerge]',
    '[ROUTE_HEAD, ROUTE_MERGE, FIRST_FAILED.merge, SECOND_FAILED.merge, THIRD_FAILED.merge, controlMerge]',
    1,
    'ROUTE_BLOB_LINEAGE',
  );
  source = replaceExact(
    source,
    "[[FIRST_FAILED, 'FIRST'], [SECOND_FAILED, 'SECOND']]",
    "[[FIRST_FAILED, 'FIRST'], [SECOND_FAILED, 'SECOND'], [THIRD_FAILED, 'THIRD']]",
    1,
    'FAILED_RUN_LINEAGE',
  );
  source = replaceExact(
    source,
    "      { merge_sha: SECOND_FAILED.merge, run_id: SECOND_FAILED.run, blobs: SECOND_FAILED.blobs },\n    ],",
    "      { merge_sha: SECOND_FAILED.merge, run_id: SECOND_FAILED.run, blobs: SECOND_FAILED.blobs },\n      { merge_sha: THIRD_FAILED.merge, run_id: THIRD_FAILED.run, blobs: THIRD_FAILED.blobs },\n    ],",
    1,
    'SEMANTIC_FAILED_LINEAGE',
  );
  source = replaceExact(
    source,
    "    second_failed_attestation_run_id: SECOND_FAILED.run,\n    control_plane_repair_merge_sha:",
    "    second_failed_attestation_run_id: SECOND_FAILED.run,\n    third_failed_control_plane_merge_sha: THIRD_FAILED.merge,\n    third_failed_attestation_run_id: THIRD_FAILED.run,\n    control_plane_repair_merge_sha:",
    1,
    'ATTESTATION_FAILED_LINEAGE',
  );
  source = replaceExact(
    source,
    "    semantic_artifact_digest: semanticDigest(semanticArtifact),",
    "    semantic_digest_scope: 'ENTIRE_ATTESTATION_EXCLUDING_SEMANTIC_ARTIFACT_DIGEST',",
    1,
    'DIGEST_SCOPE',
  );
  source = replaceExact(
    source,
    "  write('MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json', attestation);",
    "  const semantic = { ...attestation };\n  attestation.semantic_artifact_digest = semanticDigest(semantic);\n  const retentionStoreSemantic = { ...attestation };\n  delete retentionStoreSemantic.semantic_artifact_digest;\n  must(semanticDigest(retentionStoreSemantic) === attestation.semantic_artifact_digest, 'RETENTION_STORE_DIGEST_COMPATIBILITY');\n  write('MCFT_CAP_09_S3_EXACT_SHA_ATTESTATION.json', attestation);",
    1,
    'DIGEST_COMPUTATION',
  );
  source = replaceExact(
    source,
    'geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v4',
    'geox_mcft_cap09_s3_exact_sha_control_plane_repair_result_v6',
    1,
    'CONTROL_SCHEMA',
  );
  source = replaceExact(
    source,
    'MCFT_CAP_09_S3_EXACT_SHA_R2_DUAL_GENERATION_REPAIR_CANDIDATE',
    'MCFT_CAP_09_S3_EXACT_SHA_R2_TRIPLE_GENERATION_DIGEST_REPAIR_CANDIDATE',
    1,
    'CHANGE_CLASS',
  );
  source = replaceExact(
    source,
    'geox_mcft_cap09_s3_semantic_artifact_v4',
    'geox_mcft_cap09_s3_semantic_artifact_v6',
    1,
    'SEMANTIC_SCHEMA',
  );
  source = replaceExact(
    source,
    'geox_mcft_cap09_s3_exact_sha_attestation_v4',
    'geox_mcft_cap09_s3_exact_sha_attestation_v6',
    1,
    'ATTESTATION_SCHEMA',
  );
  source = replaceExact(source, 'geox-cap09-s3-exact-sha-v4', 'geox-cap09-s3-exact-sha-v6', 1, 'USER_AGENT');

  const declarationMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  if (source.includes(declarationMarker)) fail('DECLARATION_LITERAL_REMAINS');
  for (const token of REQUIRED_TOKENS) {
    if (!source.includes(token) || !committedSource.includes(token)) fail(`REQUIRED_TOKEN_MISSING:${token}`);
  }
  for (const token of [
    'S3_EXACT_SHA_R2_REPAIR_V6',
    'FIRST_FAILED_CONTROL_ENV_REQUIRED',
    'SECOND_FAILED_CONTROL_ENV_REQUIRED',
    'THIRD_FAILED_CONTROL',
    'RETENTION_STORE_DIGEST_COMPATIBILITY',
  ]) {
    if (!source.includes(token)) fail(`V6_TOKEN_MISSING:${token}`);
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
