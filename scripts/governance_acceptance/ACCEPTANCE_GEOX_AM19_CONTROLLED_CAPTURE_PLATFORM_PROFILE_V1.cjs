#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

const BASE = '1ed9b1279614fe3f377996d682463b48d69a48d2';
const CAPTURE_V2 = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs';
const CAPTURE_V2_BLOB = 'ba97882c48b1b2dfa841f20f7f11a6bce94681da';
const VERIFY_V2 = 'scripts/qualification/VERIFY_GEOX_T4R1_CONTROLLED_CAPTURE_V2.cjs';
const VERIFY_V2_BLOB = '7aae711e46f28296c6198c5b1c2e568c26a1320e';
const CAPTURE_V3 = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V3.cjs';
const VERIFY_V3 = 'scripts/qualification/VERIFY_GEOX_T4R1_CONTROLLED_CAPTURE_V3.cjs';
const SELF = 'scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_CONTROLLED_CAPTURE_PLATFORM_PROFILE_V1.cjs';

function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function nodeCheck(file) {
  const p = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (p.status !== 0) throw new Error(`AM19_CAPTURE_PLATFORM_NODE_CHECK_FAILED:${file}:${String(p.stderr || p.stdout || '').trim()}`);
}

for (const file of [CAPTURE_V3, VERIFY_V3, SELF]) nodeCheck(file);
assert.equal(git('rev-parse', `HEAD:${CAPTURE_V2}`), CAPTURE_V2_BLOB);
assert.equal(git('rev-parse', `HEAD:${VERIFY_V2}`), VERIFY_V2_BLOB);

const capture = fs.readFileSync(CAPTURE_V3, 'utf8');
const verify = fs.readFileSync(VERIFY_V3, 'utf8');

for (const marker of [
  'WINDOWS_ECCODES_BUNDLED_BINARY_V1',
  'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLES_NATIVE_BINARY_NO_ECCODESLIB_PACKAGE',
  "['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2']",
  "['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2']",
  'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py',
  'mcft_cap09_gfs_scientific_core_v1.py',
  'mcft_cap09_gfs_raw_bundle_decoder_v1.py',
  'python_package_set_digest',
  "mode === 'selftest'",
  'transformed_source_sha256',
  CAPTURE_V2_BLOB,
]) assert.ok(capture.includes(marker), `AM19_CAPTURE_PLATFORM_GUARD_MISSING:${marker}`);

for (const marker of [
  'CONTROLLED_CAPTURE_V3_VERIFIER_WINDOWS_PROFILE_REQUIRED',
  'CONTROLLED_CAPTURE_V3_VERIFIER_PYTHON_PACKAGE_SET_DIGEST_REQUIRED',
  'platform_python_profile_verified',
  CAPTURE_V2_BLOB,
  VERIFY_V2_BLOB,
]) assert.ok(verify.includes(marker), `AM19_CAPTURE_PLATFORM_VERIFIER_GUARD_MISSING:${marker}`);

const transformSelftest = JSON.parse(execFileSync(process.execPath, [CAPTURE_V3, 'selftest'], { encoding: 'utf8', windowsHide: true }));
assert.equal(transformSelftest.status, 'PASS');
assert.equal(transformSelftest.base_adapter_blob, CAPTURE_V2_BLOB);
assert.match(transformSelftest.transformed_source_sha256, /^sha256:[0-9a-f]{64}$/);
assert.equal(transformSelftest.provider_semantics_changed, false);
assert.equal(transformSelftest.runtime_semantic_mutation, false);
assert.equal(transformSelftest.production_mutation, false);
if (process.platform === 'win32') {
  assert.equal(transformSelftest.python_package_profile, 'WINDOWS_ECCODES_BUNDLED_BINARY_V1');
  assert.equal(transformSelftest.eccodeslib_package_required, false);
  assert.deepEqual(transformSelftest.python_packages_required, ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2']);
} else {
  assert.equal(transformSelftest.python_package_profile, 'LINUX_MAC_ECCODESLIB_V1');
  assert.equal(transformSelftest.eccodeslib_package_required, true);
  assert.deepEqual(transformSelftest.python_packages_required, ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2']);
}

const changed = git('diff', '--name-only', BASE, 'HEAD').split(/\r?\n/).filter(Boolean).sort();
const allowed = [CAPTURE_V3, VERIFY_V3, SELF].sort();
assert.deepEqual(changed, allowed, `AM19_CAPTURE_PLATFORM_CHANGESET_OUT_OF_SCOPE:${JSON.stringify(changed)}`);
assert.ok(!changed.some((p) => p.startsWith('.github/workflows/')));
assert.ok(!changed.some((p) => p.startsWith('apps/server/')));

process.stdout.write(JSON.stringify({
  schema_version: 'geox_am19_controlled_capture_platform_profile_acceptance_v1',
  status: 'PASS',
  predecessor_capture_head: BASE,
  capture_v2_blob_preserved: true,
  verifier_v2_blob_preserved: true,
  transform_selftest_pass: true,
  transformed_source_sha256: transformSelftest.transformed_source_sha256,
  active_platform: process.platform,
  active_python_package_profile: transformSelftest.python_package_profile,
  windows_profile: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1',
  windows_eccodeslib_package_required: false,
  windows_eccodes_binary_source: 'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLED_NATIVE_BINARY',
  linux_mac_eccodeslib_pin_preserved: 'eccodeslib==2.47.3.23',
  eccodes_selfcheck_required: true,
  gfs_scientific_core_selftest_required: true,
  gfs_raw_bundle_decoder_selftest_required: true,
  runtime_semantic_mutation: false,
  production_mutation: false,
  github_owner_reactivated: false,
  changed_files: changed,
}, null, 2) + '\n');
