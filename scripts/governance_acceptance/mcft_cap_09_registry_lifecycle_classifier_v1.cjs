#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TARGET = 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs';
const FROZEN_SUBJECT = '6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f';
const FROZEN_BLOB = 'faa902f363dc66a1406a7d5c90d0b3b0aa4bb614';
const ROUTING_REPAIR_FILES = [
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs',
];
const S5_REGISTRATION_FILES = [
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  '.github/workflows/mcft-cap-09-s5-registry-registration.yml',
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-REGISTRY-REGISTRATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_REGISTRY_REGISTRATION.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs',
];
const EXACT_SHA_CONTROL_FILES = [
  '.github/workflows/mcft-cap-09-s4-exact-sha-attestation.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_EXACT_SHA_ATTESTATION_V1.cjs',
];

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function blobSha(value) {
  const bytes = Buffer.from(value, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest('hex');
}
function sameFiles(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function publish(mode, files) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT_REQUIRED');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
  console.log(JSON.stringify({
    lane: process.env.MCFT_REGISTRY_LANE ?? null,
    mode,
    base_sha: process.env.MCFT_BASE_SHA ?? null,
    files,
  }, null, 2));
}

const base = process.env.MCFT_BASE_SHA;
if (!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const files = git('diff', '--name-only', `${base}...HEAD`)
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

if (sameFiles(files, S5_REGISTRATION_FILES)) {
  publish('s5-registry-registration', files);
  process.exit(0);
}
if (sameFiles(files, ROUTING_REPAIR_FILES)) {
  publish('s4-exact-sha-lifecycle-repair', files);
  process.exit(0);
}
if (sameFiles(files, EXACT_SHA_CONTROL_FILES)) {
  publish('s4-exact-sha-attestation', files);
  process.exit(0);
}

const frozen = cp.execFileSync('git', ['show', `${FROZEN_SUBJECT}:${TARGET}`], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (blobSha(frozen) !== FROZEN_BLOB) {
  throw new Error('FROZEN_S4_CLASSIFIER_BLOB_MISMATCH');
}
const temp = path.join(__dirname, `.mcft-cap09-s4-exact-classifier-${process.pid}.cjs`);
try {
  fs.writeFileSync(temp, frozen);
  const result = cp.spawnSync(process.execPath, [temp, ...process.argv.slice(2)], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  try { fs.unlinkSync(temp); } catch {}
}
