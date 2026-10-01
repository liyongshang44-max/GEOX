#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');

const BASE_REF = 'scripts/qualification/VERIFY_GEOX_T4R1_CONTROLLED_CAPTURE_V2.cjs';
const BASE_BLOB = '7aae711e46f28296c6198c5b1c2e568c26a1320e';
const BASE_CAPTURE_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs';
const BASE_CAPTURE_BLOB = 'ba97882c48b1b2dfa841f20f7f11a6bce94681da';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}

const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']);
const basePath = path.join(repoRoot, BASE_REF);
const actualBaseBlob = git(repoRoot, ['rev-parse', `HEAD:${BASE_REF}`]);
if (actualBaseBlob !== BASE_BLOB) throw new Error(`CONTROLLED_CAPTURE_V3_VERIFIER_BASE_BLOB_DRIFT:${actualBaseBlob}:${BASE_BLOB}`);

let source = fs.readFileSync(basePath, 'utf8');
source = source.replaceAll('CONTROLLED_CAPTURE_V2', 'CONTROLLED_CAPTURE_V3');
source = source.replaceAll('geox_controlled_rolling_capture_result_v2', 'geox_controlled_rolling_capture_result_v3');
source = source.replaceAll('geox_t4r1_controlled_capture_verification_result_v2', 'geox_t4r1_controlled_capture_verification_result_v3');

const adapterCheck = "  equal(gitBlob(repoRoot, result.launcher_subject_sha, provenance.capture_adapter_ref), provenance.capture_adapter_git_blob_sha, 'CONTROLLED_CAPTURE_V3_VERIFIER_ADAPTER_BLOB_MISMATCH');";
source = exactReplace(
  source,
  adapterCheck,
  `${adapterCheck}\n  equal(provenance.capture_base_adapter_ref, '${BASE_CAPTURE_REF}', 'CONTROLLED_CAPTURE_V3_VERIFIER_BASE_ADAPTER_REF_MISMATCH');\n  equal(provenance.capture_base_adapter_git_blob_sha, '${BASE_CAPTURE_BLOB}', 'CONTROLLED_CAPTURE_V3_VERIFIER_BASE_ADAPTER_DECLARATION_MISMATCH');\n  equal(gitBlob(repoRoot, result.launcher_subject_sha, provenance.capture_base_adapter_ref), provenance.capture_base_adapter_git_blob_sha, 'CONTROLLED_CAPTURE_V3_VERIFIER_BASE_ADAPTER_BLOB_MISMATCH');\n  equal(provenance.python_package_profile, environment.python_package_profile, 'CONTROLLED_CAPTURE_V3_VERIFIER_PYTHON_PROFILE_MISMATCH');\n  equal(provenance.python_binary_policy, environment.python_binary_policy, 'CONTROLLED_CAPTURE_V3_VERIFIER_PYTHON_BINARY_POLICY_MISMATCH');\n  if (!/^sha256:[0-9a-f]{64}$/.test(String(environment.python_package_set_digest ?? ''))) throw new Error('CONTROLLED_CAPTURE_V3_VERIFIER_PYTHON_PACKAGE_SET_DIGEST_REQUIRED');\n  const windows = String(environment.os ?? '').startsWith('win32 ');\n  const expectedPackages = windows ? ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'] : ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];\n  equal(JSON.stringify(environment.python_packages_required), JSON.stringify(expectedPackages), 'CONTROLLED_CAPTURE_V3_VERIFIER_PYTHON_PACKAGE_PROFILE_INVALID');\n  if (windows) {\n    equal(environment.python_package_profile, 'WINDOWS_ECCODES_BUNDLED_BINARY_V1', 'CONTROLLED_CAPTURE_V3_VERIFIER_WINDOWS_PROFILE_REQUIRED');\n    equal(environment.python_binary_policy, 'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLES_NATIVE_BINARY_NO_ECCODESLIB_PACKAGE', 'CONTROLLED_CAPTURE_V3_VERIFIER_WINDOWS_BINARY_POLICY_REQUIRED');\n  } else {\n    equal(environment.python_package_profile, 'LINUX_MAC_ECCODESLIB_V1', 'CONTROLLED_CAPTURE_V3_VERIFIER_LINUX_PROFILE_REQUIRED');\n    equal(environment.python_binary_policy, 'ECCODESLIB_2_47_3_23_EXTERNAL_BINARY_PACKAGE', 'CONTROLLED_CAPTURE_V3_VERIFIER_LINUX_BINARY_POLICY_REQUIRED');\n  }`,
  'CONTROLLED_CAPTURE_V3_VERIFIER_PROFILE_GUARD_TRANSFORM_CARDINALITY'
);

source = exactReplace(
  source,
  "    deterministic_source_materialization_verified: true,",
  "    deterministic_source_materialization_verified: true,\n    platform_python_profile_verified: true,\n    python_package_profile: environment.python_package_profile,",
  'CONTROLLED_CAPTURE_V3_VERIFIER_OUTPUT_TRANSFORM_CARDINALITY'
);

const compiled = new Module(basePath, module);
compiled.filename = basePath;
compiled.paths = Module._nodeModulePaths(path.dirname(basePath));
compiled._compile(source, basePath);
