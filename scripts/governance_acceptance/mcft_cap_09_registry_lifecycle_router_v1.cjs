#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const TARGET = 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs';
const FROZEN_SUBJECT = '6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f';
const FROZEN_BLOB = '78b8e0d75b9754099326bbf0a6cfb76b5937e644';
const mode = process.env.MCFT_REGISTRY_MODE;

function blobSha(value) {
  const bytes = Buffer.from(value, 'utf8');
  return crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest('hex');
}
function runNode(argv) {
  const result = cp.spawnSync(process.execPath, argv, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (mode === 's4-exact-sha-lifecycle-repair') {
  process.exitCode = runNode([
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
    '--s4-exact-sha-lifecycle-repair',
  ]);
} else if (mode === 's4-exact-sha-attestation') {
  process.exitCode = runNode([
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
    '--s4-exact-sha-route-only',
  ]);
} else {
  const frozen = cp.execFileSync('git', ['show', `${FROZEN_SUBJECT}:${TARGET}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (blobSha(frozen) !== FROZEN_BLOB) {
    throw new Error('FROZEN_S4_ROUTER_BLOB_MISMATCH');
  }
  const temp = path.join(__dirname, `.mcft-cap09-s4-exact-router-${process.pid}.cjs`);
  try {
    fs.writeFileSync(temp, frozen);
    process.exitCode = runNode([temp, ...process.argv.slice(2)]);
  } finally {
    try { fs.unlinkSync(temp); } catch {}
  }
}
